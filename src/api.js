/* ═══════════════════════════════════════════════════════════
   The one way this front end talks to the server.

   Everything goes through `request()` so the four things that must
   happen on every call happen in one place: credentials are attached,
   a 401 ends the session cleanly, the network being down is told apart
   from the server being broken, and nothing hangs forever.
   ═══════════════════════════════════════════════════════════ */

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(message, { status, code, kind } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    /* 'offline' | 'timeout' | 'auth' | 'server' | 'client'
       The view layer branches on this, never on the status code — it is
       the difference between "check your connection" and "something went
       wrong our end", which are different sentences to a learner. */
    this.kind = kind;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  /* Checked before the fetch, because a dropped connection otherwise
     surfaces as a generic TypeError several seconds later and the
     learner gets a worse message than the browser already knows. */
  if (!navigator.onLine) {
    throw new ApiError('You appear to be offline.', { kind: 'offline' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      /* The session cookie is HttpOnly, so this is what carries it —
         and same-origin means it is never sent anywhere else. */
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('That took too long. Please try again.', { kind: 'timeout' });
    }
    throw new ApiError('Could not reach the server.', { kind: 'offline' });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    throw new ApiError('Your session has ended. Please sign in again.', {
      status: 401, kind: 'auth',
    });
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* an empty or non-JSON body is fine */ }

  if (!res.ok) {
    throw new ApiError(
      payload?.message || 'Something went wrong. Please try again.',
      { status: res.status, code: payload?.error, kind: res.status >= 500 ? 'server' : 'client' },
    );
  }

  return payload;
}

export const api = {
  me:        ()      => request('/api/auth/me'),
  login:     (b)     => request('/api/auth/login', { method: 'POST', body: b }),
  logout:    ()      => request('/api/auth/logout', { method: 'POST' }),
  dashboard: ()      => request('/api/dashboard'),
  courses:   ()      => request('/api/courses'),
  course:    (id)    => request(`/api/courses/${encodeURIComponent(id)}`),
  catalog:   (key)   => request(`/api/catalog/${encodeURIComponent(key)}`),
};

/* Signing out is a navigation, not a fetch — the redirect has to survive
   the cookie being cleared, and a half-signed-out tab is worse than a
   reload. Failures are swallowed on purpose: if the request did not get
   through, sending them to the login page is still the right outcome. */
export async function signOut() {
  try { await api.logout(); } catch { /* going to the login page regardless */ }
  location.href = './login.html';
}

/* Where to send someone whose session has ended, remembering where they
   were so they land back there rather than on a generic dashboard. */
export function toLogin(reason) {
  const here = location.pathname.split('/').pop() || 'dashboard.html';
  const url = new URL('./login.html', location.href);
  if (here !== 'login.html') url.searchParams.set('next', here + location.search);
  if (reason) url.searchParams.set('reason', reason);
  location.replace(url);
}
