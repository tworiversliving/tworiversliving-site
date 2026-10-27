// Cloudflare Turnstile check for the booking and enquiry forms.
// With no TURNSTILE_SECRET_KEY set (local development), every request passes.

export async function verifyTurnstile(env: Env, token: unknown, ip?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== 'string' || !token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (e) {
    console.error('Turnstile check failed', e);
    return false;
  }
}
