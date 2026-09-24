const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } }); }
function id() { return `${Date.now().toString(36)}-${crypto.randomUUID()}`; }
function cleanText(value) { return typeof value === 'string' ? value.trim().slice(0, 1200) : ''; }
function cleanImage(value) {
  if (!value || typeof value !== 'object') return null;
  const type = String(value.type || ''); const name = String(value.name || 'image').trim().slice(0, 100); const data = String(value.data || '');
  if (!/^image\/(png|jpe?g|gif|webp)$/i.test(type) || !data.startsWith(`data:${type};base64,`)) return null;
  const encoded = data.slice(data.indexOf(',') + 1);
  if (!encoded || encoded.length > Math.ceil((2 * 1024 * 1024) * 4 / 3)) return null;
  return { name, type, data };
}
function cleanAccount(value) { if (!value || typeof value !== 'object') return null; const id = String(value.id || '').trim().slice(0, 64); const name = String(value.name || '').trim().slice(0, 24); return id && name ? { id, name } : null; }
function dmKey(one, two) { return [one, two].sort().join(':'); }
async function readMessages(env, scope, limit = 10, before = '') {
  const keys = (await env.LCC_KV.get(`index:${scope}`, 'json')) || [];
  const end = before ? keys.indexOf(before) : keys.length;
  if (end < 0) return { messages: [], nextBefore: null };
  const selected = keys.slice(Math.max(0, end - limit), end);
  const values = await Promise.all(selected.map(key => env.LCC_KV.get(key, 'json')));
  return { messages: values.filter(Boolean), nextBefore: selected.length && end - selected.length > 0 ? selected[0] : null };
}
async function writeMessage(env, scope, message) { const messageKey = `message:${scope}:${id()}`; const indexKey = `index:${scope}`; const index = (await env.LCC_KV.get(indexKey, 'json')) || []; index.push(messageKey); await Promise.all([env.LCC_KV.put(messageKey, JSON.stringify(message)), env.LCC_KV.put(indexKey, JSON.stringify(index.slice(-500)))]); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.LCC_KV) return json({ error: 'LCC_KV binding is not configured.' }, 503);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.join('/') === 'api/v1/health') return json({ ok: true, service: 'linkup-api' });
    if (parts.join('/') === 'api/v1/channels/central/messages') {
      if (request.method === 'GET') { const limit = Math.min(25, Math.max(1, Number(url.searchParams.get('limit')) || 10)); return json(await readMessages(env, 'central', limit, url.searchParams.get('before') || '')); }
      if (request.method === 'POST') {
        const payload = await request.json().catch(() => null);
        const text = cleanText(payload?.text); const image = cleanImage(payload?.image); const author = cleanAccount(payload?.author);
        if ((!text && !image) || !author) return json({ error: 'text and author are required.' }, 400);
        const message = { id: id(), text, image, author, createdAt: Date.now(), channel: 'central' };
        await writeMessage(env, 'central', message);
        return json({ message }, 201);
      }
    }
    if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'dms' && parts[3]) {
      const partnerId = decodeURIComponent(parts[3]);
      if (request.method === 'GET') {
        const user = String(url.searchParams.get('user') || '').trim().slice(0, 64);
        if (!user) return json({ error: 'user query parameter is required.' }, 400);
        const limit = Math.min(25, Math.max(1, Number(url.searchParams.get('limit')) || 10));
        return json(await readMessages(env, `dm:${dmKey(user, partnerId)}`, limit, url.searchParams.get('before') || ''));
      }
      if (request.method === 'POST') {
        const payload = await request.json().catch(() => null);
        const text = cleanText(payload?.text); const image = cleanImage(payload?.image); const author = cleanAccount(payload?.author);
        if ((!text && !image) || !author) return json({ error: 'text and author are required.' }, 400);
        const scope = `dm:${dmKey(author.id, partnerId)}`;
        const message = { id: id(), text, image, author, createdAt: Date.now(), recipientId: partnerId };
        await writeMessage(env, scope, message);
        return json({ message }, 201);
      }
    }
    if (parts.join('/') === 'api/v1/notifications/subscriptions' && request.method === 'POST') {
      const payload = await request.json().catch(() => null);
      const accountId = String(payload?.accountId || '').trim().slice(0, 64);
      const subscription = payload?.subscription;
      if (!accountId || !subscription?.endpoint) return json({ error: 'accountId and a push subscription are required.' }, 400);
      await env.LCC_KV.put(`push:${accountId}:${id()}`, JSON.stringify({ subscription, createdAt: Date.now() }));
      return json({ ok: true }, 201);
    }
    return json({ error: 'Not found.' }, 404);
  }
};
