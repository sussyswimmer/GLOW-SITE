/* ═══════════════════════════════════════════════════════════
   The Anthropic client, built on first use.

   `null` without a key, so the routes can answer 503 `emmai_off` and the
   rest of the site never notices. No client-wide timeout or retry: each
   route sets its own per request (EMMAI 25 s, lesson draft 55 s, never
   retried: a retry would bill twice and overrun Netlify's synchronous
   function limit, see docs/OPERATIONS.md).
   The SDK reads ANTHROPIC_BASE_URL itself, which is how tools/ai-test.mjs
   points it at a fake server.
   ═══════════════════════════════════════════════════════════ */

import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

let client;

export function aiClient() {
  if (!config.ANTHROPIC_API_KEY) return null;
  return (client ??= new Anthropic({
    apiKey: config.ANTHROPIC_API_KEY,
  }));
}

export const MODEL = config.EMMAI_MODEL;
