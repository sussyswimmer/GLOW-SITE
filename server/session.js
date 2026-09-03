/* ═══════════════════════════════════════════════════════════
   Sessions — stateless, encrypted, in a cookie.

   THE IMPORTANT PROPERTY OF THIS FILE: this server has no database
   and no session store. Nothing about a learner is written to disk
   here, ever. The session is a sealed envelope handed to the browser
   and handed back; the server keeps only the key that opens it.

   That is a deliberate security posture, not a shortcut. Moodle is
   already the system of record for every learner — it has their name,
   their email, their grades, and the backup and GDPR tooling that goes
   with holding those. Duplicating any of it here would create a second
   copy to secure, patch, back up and eventually breach, and would buy
   nothing. So this tier stores nothing and is not worth attacking:
   there is no user table to dump.

   What IS in the envelope is the learner's Moodle web-services token,
   which is why the envelope is encrypted rather than merely signed.
   ═══════════════════════════════════════════════════════════ */

import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

/* AES-256-GCM: one standard authenticated cipher, used the standard way.
   GCM gives confidentiality and integrity in one pass, so a tampered
   cookie fails to decrypt rather than decrypting to attacker-chosen
   nonsense — there is no separate signature step to get wrong. */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // 96 bits, the size GCM is defined for
const TAG_LEN = 16;
const VERSION = 1;   // lets a future key or format change reject old cookies cleanly

/**
 * Seal a session payload into an opaque cookie string.
 * Layout: version(1) ‖ iv(12) ‖ tag(16) ‖ ciphertext — base64url.
 */
export function seal(payload) {
  /* A fresh random IV per seal. GCM's one hard requirement is never
     reusing an IV with the same key; 96 random bits per session write
     is the recommended way to satisfy it. */
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, config.SESSION_SECRET, iv);

  const json = JSON.stringify(payload);
  const body = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([VERSION]), iv, tag, body]).toString('base64url');
}

/**
 * Open a cookie string. Returns null for anything that is not a valid,
 * unexpired session — malformed, tampered, wrong key, or timed out.
 * Callers treat null as "signed out" and never as an error worth showing.
 */
export function unseal(raw) {
  if (typeof raw !== 'string' || raw.length < 40 || raw.length > 8192) return null;

  let buf;
  try {
    buf = Buffer.from(raw, 'base64url');
  } catch {
    return null;
  }
  if (buf.length < 1 + IV_LEN + TAG_LEN) return null;
  if (buf[0] !== VERSION) return null;

  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const body = buf.subarray(1 + IV_LEN + TAG_LEN);

  let payload;
  try {
    const decipher = createDecipheriv(ALGO, config.SESSION_SECRET, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    payload = JSON.parse(json);
  } catch {
    /* Bad tag, bad key, bad JSON — all the same answer to the caller.
       Distinguishing them in a response would tell an attacker which
       part of the cookie they got right. */
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;

  /* Expiry is inside the sealed payload, never in a cookie attribute.
     Max-Age on the cookie is a hint the browser is free to ignore and
     the user is free to edit; this is the copy that decides. */
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;

  return payload;
}

/**
 * Build the session payload for a freshly authenticated learner.
 * Only what a request genuinely needs is kept — the token to call Moodle
 * with, and enough identity to render the header without a round trip.
 * Notably absent: email, ID number, anything about their courses.
 */
export function makeSession({ token, userId, username, fullname, privateToken }) {
  const now = Date.now();
  return {
    v: VERSION,
    token,                 // Moodle web-services token, this learner's own
    privateToken: privateToken || null,  // used for the auto-login deep link, see sso.js
    userId,
    username,
    fullname,
    iat: now,
    exp: now + config.SESSION_TTL_MS,
  };
}

/* Cookie attributes, in one place so they cannot drift between the
   set-on-login and clear-on-logout paths — a mismatch there is the
   classic "logout doesn't log you out" bug, because a cookie is only
   replaced by one with identical name, path and domain. */
function cookieOptions() {
  return {
    httpOnly: true,                    // JavaScript can never read the token
    secure: config.isProd,             // HTTPS only in production
    sameSite: 'lax',                   // survives a normal link click, blocks cross-site POSTs
    path: '/',
    maxAge: Math.floor(config.SESSION_TTL_MS / 1000),
  };
}

export function setSession(reply, payload) {
  reply.setCookie(config.COOKIE_NAME, seal(payload), cookieOptions());
}

export function clearSession(reply) {
  reply.setCookie(config.COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
}

/**
 * Sliding expiry: every authenticated request pushes the deadline out,
 * so an active learner is never logged out mid-session, while an
 * abandoned session still dies on schedule.
 *
 * Re-sealing costs one AES operation, but writing Set-Cookie on every
 * single response makes responses uncacheable, so it only re-issues once
 * the session is past its half-life.
 */
export function touchSession(reply, session) {
  const age = Date.now() - session.iat;
  if (age < config.SESSION_TTL_MS / 2) return session;

  const next = { ...session, iat: Date.now(), exp: Date.now() + config.SESSION_TTL_MS };
  setSession(reply, next);
  return next;
}

/** Constant-time string compare, for anything that gates on a secret value. */
export function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}
