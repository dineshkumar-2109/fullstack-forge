// @ts-check
import { email, object, string } from "../../lib/validation.js";
import { serializeCookie } from "../../lib/http.js";
import { unauthenticated } from "../../lib/errors.js";

export const SESSION_COOKIE = "sid";

const credentialsSchema = object({
  email: email(),
  // Length-based policy (NIST 800-63B): min 10, max 128 to bound hashing cost. No composition rules.
  password: string({ min: 10, max: 128, trim: false }),
});
const signInSchema = object({ email: email(), password: string({ min: 1, max: 128, trim: false }) });
const deleteAccountSchema = object({ password: string({ min: 1, max: 128, trim: false }) });

/**
 * @param {import('../../lib/http.js').Router} router
 * @param {{ auth: ReturnType<typeof import('./auth.service.js').createAuthService>, secureCookies: boolean }} deps
 */
export function registerAuthRoutes(router, { auth, secureCookies }) {
  /** @param {{ token: string, maxAgeSeconds: number }} session */
  const cookie = (session) => serializeCookie(SESSION_COOKIE, session.token, { maxAgeSeconds: session.maxAgeSeconds, secure: secureCookies });
  const clear = serializeCookie(SESSION_COOKIE, "", { maxAgeSeconds: 0, secure: secureCookies });

  router.add("POST", "/api/auth/signup", async (ctx) => {
    const input = credentialsSchema(await ctx.body());
    const { user, session } = await auth.signUp(input);
    return { status: 201, body: { user }, headers: { "Set-Cookie": cookie(session) } };
  }, { auth: false });

  router.add("POST", "/api/auth/signin", async (ctx) => {
    const input = signInSchema(await ctx.body());
    const { user, session } = await auth.signIn(input);
    return { status: 200, body: { user }, headers: { "Set-Cookie": cookie(session) } };
  }, { auth: false });

  router.add("POST", "/api/auth/signout", async (ctx) => {
    auth.signOut(ctx.sessionToken);
    return { status: 204, headers: { "Set-Cookie": clear } };
  }, { auth: false });

  // Session probe for the UI: 200 with user or null, so logged-out visitors don't generate 401 noise.
  router.add("GET", "/api/session", async (ctx) => ({ status: 200, body: { user: ctx.user } }), { auth: false });

  router.add("GET", "/api/me", async (ctx) => {
    if (!ctx.user) throw unauthenticated();
    return { status: 200, body: { user: ctx.user } };
  });

  router.add("GET", "/api/me/export", async (ctx) => {
    if (!ctx.user) throw unauthenticated();
    return {
      status: 200,
      body: auth.exportData(ctx.user.id),
      headers: { "Content-Disposition": 'attachment; filename="tasklane-export.json"' },
    };
  });

  router.add("DELETE", "/api/me", async (ctx) => {
    if (!ctx.user) throw unauthenticated();
    const { password } = deleteAccountSchema(await ctx.body());
    await auth.deleteAccount(ctx.user.id, password);
    return { status: 204, headers: { "Set-Cookie": clear } };
  });
}
