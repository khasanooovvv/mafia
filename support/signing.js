import { createHmac } from 'node:crypto';
export const TOKEN = 'test-only-not-a-real-bot-token';
export function signed(id = 1, timestamp = Math.floor(Date.now() / 1000)) {
  const p = new URLSearchParams({ auth_date: String(timestamp), user: JSON.stringify({ id, first_name: `Player ${id}` }) });
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const message = [...p].sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  p.set('hash', createHmac('sha256', secret).update(message).digest('hex')); return p.toString();
}
