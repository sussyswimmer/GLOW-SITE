/* ═══════════════════════════════════════════════════════════
   EMMAI (the learner-facing advisor) and the staff lesson drafter.

   Both need a session; the guard is a hook so a route added here is
   authenticated by default. Message content is NEVER logged: errors log
   the status and type only.
   ═══════════════════════════════════════════════════════════ */

import Anthropic from '@anthropic-ai/sdk';
import { isDemo } from '../data/index.js';
import { visibleCourses, CATEGORIES, SUBCATEGORIES } from '../data/catalogue.js';
import { aiClient, MODEL } from '../ai.js';
import { readSession } from './auth.js';

/* Refusal fallback (skill default for claude-opus-5-5): on a safety decline
   the API re-runs the same request on a fallback model inside the same call. */
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

const REFUSAL_REPLY = {
  vi: 'Mình không thể giúp với yêu cầu này. Bạn có thể hỏi mình về khoá học hoặc cách học tiếng Anh nhé.',
  en: "I can't help with that request. You can ask me about courses or ways to study English.",
};

const catName = key => CATEGORIES.find(c => c.key === key)?.en || key;
const subName = key => SUBCATEGORIES.find(s => s.key === key)?.en || key;

/* The viewer's own catalogue, one compact line per course. Role-filtered, so
   a learner's prompt never contains staff-only (PT) courses. Deterministic for
   a role (no dates, no ids), which is what lets the prompt cache. */
export function systemPrompt(role) {
  const lines = visibleCourses(role).map(c =>
    `${c.code} — ${c.en}${c.vi ? ` / ${c.vi}` : ''} — ${catName(c.cat)} › ${subName(c.sub)}`);
  return [
    'You are EMMAI, the AI learning advisor of GLOW, the learning platform of Pacific Links Foundation (with Matera). Learners are Vietnamese youth and workers.',
    'Recommend ONLY courses from the list below, and cite each one as [CODE] (for example [EL1001]). Never invent a course, code, price or date.',
    "Reply in the language of the learner's last message. Keep it under 150 words, plain text, no markdown.",
    'Never ask for passwords or personal details.',
    'If someone describes exploitation, trafficking or danger: be kind, encourage them to contact local authorities or Pacific Links Foundation staff, and NEVER invent phone numbers or addresses.',
    'If the question is off-topic, steer gently back to learning.',
    '',
    'COURSES YOU MAY RECOMMEND:',
    ...lines,
  ].join('\n');
}

const textOf = msg => msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();

/* Upstream failures → one JSON shape. Only the type and status are logged. */
function upstreamError(req, reply, err) {
  req.log.warn({ type: err?.constructor?.name, status: err?.status }, 'ai upstream failed');
  if (err instanceof Anthropic.RateLimitError) return reply.code(503).send({ error: 'emmai_busy' });
  if (err instanceof Anthropic.APIError) return reply.code(502).send({ error: 'emmai_unavailable' });
  return reply.code(500).send({ error: 'server_error' });
}

const tooMany = () => ({ statusCode: 429, error: 'too_many_requests', message: 'Too many requests. Please wait a moment.' });

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, titleVi: { type: 'string' },
    summary: { type: 'string' }, summaryVi: { type: 'string' },
    body: { type: 'string' },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'string' }, vi: { type: 'string' }, meaning: { type: 'string' } },
        required: ['word', 'vi', 'meaning'], additionalProperties: false,
      },
    },
    notes: { type: 'string' },
  },
  required: ['title', 'titleVi', 'summary', 'summaryVi', 'body', 'keywords', 'notes'],
  additionalProperties: false,
};

const DRAFT_SYSTEM = [
  'You write short English-learning lessons for Vietnamese learners, for staff to review before publishing.',
  'Use ONLY facts present in the FACTS text. Write original wording: do not copy sentences from it.',
  'Do not invent numbers, names, dates or quotes. If the facts are thin, say so in "notes".',
  '"body": original English at the requested level, 150-400 words, paragraphs separated by a blank line, no headings.',
  '"keywords": 6 to 10 words that appear in the body, each with a Vietnamese translation and a short English meaning.',
  '"titleVi" and "summaryVi": natural Vietnamese. "notes": anything staff must check before publishing.',
].join('\n');

export default async function aiRoutes(app) {
  app.addHook('preHandler', async (req, reply) => {
    const session = readSession(req, reply);
    if (!session) return reply.code(401).send({ error: 'unauthorised', message: 'Please sign in again.' });
    req.session = session;
  });

  /* ── POST /api/emmai ────────────────────────────────────── */
  app.post('/emmai', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute', errorResponseBuilder: tooMany } },
    schema: {
      body: {
        type: 'object', required: ['messages', 'lang'], additionalProperties: false,
        properties: {
          lang: { type: 'string', enum: ['vi', 'en'] },
          messages: {
            type: 'array', minItems: 1, maxItems: 16,
            items: {
              type: 'object', required: ['role', 'content'], additionalProperties: false,
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string', minLength: 1, maxLength: 1200 },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { messages, lang } = req.body;
    if (messages.at(-1).role !== 'user') return reply.code(400).send({ error: 'bad_request' });

    const client = aiClient();
    if (!client) return reply.code(503).send({ error: 'emmai_off' });

    try {
      const msg = await client.beta.messages.create({
        model: MODEL,
        // Thinking cannot be disabled on Opus 5.5 and its tokens count toward
        // max_tokens, so 2048 leaves room for a <=150-word reply.
        max_tokens: 2048,
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: systemPrompt(req.session.role || 'learner'), cache_control: { type: 'ephemeral' } },
          // After the breakpoint so the language hint never splits the cache.
          { type: 'text', text: `The learner's interface language is ${lang === 'vi' ? 'Vietnamese' : 'English'}; use it if their message is ambiguous.` },
        ],
        messages,
        ...FALLBACK,
      }, { timeout: 25_000, maxRetries: 0 });
      if (msg.stop_reason === 'refusal') return { reply: REFUSAL_REPLY[lang], demo: isDemo };
      const text = textOf(msg);
      if (!text) return reply.code(502).send({ error: 'emmai_unavailable' });
      return { reply: text, demo: isDemo };
    } catch (err) {
      return upstreamError(req, reply, err);
    }
  });

  /* ── POST /api/lessons/draft ───────────────────────────── */
  app.post('/lessons/draft', {
    config: { rateLimit: { max: 6, timeWindow: '1 minute', errorResponseBuilder: tooMany } },
    schema: {
      body: {
        type: 'object', required: ['topic', 'level', 'facts'], additionalProperties: false,
        properties: {
          topic: { type: 'string', minLength: 1, maxLength: 200 },
          level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          facts: { type: 'string', minLength: 20, maxLength: 6000 },
          source: { type: 'string', maxLength: 300 },
        },
      },
    },
  }, async (req, reply) => {
    if (req.session.role !== 'staff') return reply.code(403).send({ error: 'forbidden' });
    const client = aiClient();
    if (!client) return reply.code(503).send({ error: 'emmai_off' });

    const { topic, level, facts, source = '' } = req.body;
    try {
      const msg = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 6000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
        system: DRAFT_SYSTEM,
        messages: [{ role: 'user', content: `TOPIC: ${topic}\nLEVEL: ${level}\nSOURCE: ${source || '(not given)'}\n\nFACTS:\n${facts}` }],
        ...FALLBACK,
      }, { timeout: 55_000, maxRetries: 0 });
      if (msg.stop_reason === 'refusal') return reply.code(422).send({ error: 'refused' });
      let draft = null;
      try { draft = JSON.parse(textOf(msg)); } catch { /* handled below */ }
      if (!draft || !Array.isArray(draft.keywords)) return reply.code(502).send({ error: 'emmai_unavailable' });
      return { draft, demo: isDemo };
    } catch (err) {
      return upstreamError(req, reply, err);
    }
  });
}
