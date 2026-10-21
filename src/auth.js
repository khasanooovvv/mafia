import { createHmac, timingSafeEqual } from 'node:crypto';

export function authenticate(initData, token, now = Date.now()) {
  if (!token || typeof initData !== 'string' || initData.length > 16000) throw new Error('Telegram autentifikatsiyasi kerak');
  const params = new URLSearchParams(initData), seen = new Set();
  for (const [key] of params) { if (seen.has(key)) throw new Error('Takroriy maydon'); seen.add(key); }
  const hash = params.get('hash');
  if (!/^[0-9a-f]{64}$/.test(hash || '')) throw new Error('Imzo noto‘g‘ri');
  params.delete('hash');
  const data = [...params].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(data).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new Error('Imzo noto‘g‘ri');
  const date = Number(params.get('auth_date')), age = Math.floor(now / 1000) - date;
  if (!Number.isSafeInteger(date) || age < -30 || age > 3600) throw new Error('Telegram sessiyasi eskirgan');
  const user = JSON.parse(params.get('user') || 'null');
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.first_name !== 'string') throw new Error('Foydalanuvchi noto‘g‘ri');
  return { id: String(user.id), name: user.first_name.slice(0, 80) };
}
