import { GameError } from './game.js';
export class Telegram {
  constructor(token, username, fetcher = fetch) { this.token = token; this.username = (username || '').replace(/^@/, ''); this.fetcher = fetcher; }
  async call(method, body) {
    const response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new GameError('Telegram so‘rovi bajarilmadi. Bot huquqlarini tekshiring.');
    return data.result;
  }
  link(roomId = '') {
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(this.username)) throw new GameError('BOT_USERNAME sozlanmagan');
    return `https://t.me/${this.username}${roomId ? `?startapp=${encodeURIComponent(roomId)}` : '?startapp'}`;
  }
  async member(groupId, userId, admin = false) {
    const m = await this.call('getChatMember', { chat_id: groupId, user_id: Number(userId) });
    const allowed = admin ? ['creator', 'administrator'].includes(m.status) : ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member);
    if (!allowed) throw new GameError(admin ? 'Xonani guruh administratori ochadi' : 'Avval Telegram guruhiga a’zo bo‘ling');
  }
  send(chatId, text, roomId = '') {
    return this.call('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: roomId ? '🎭 O‘yinga qo‘shilish' : '🎭 Mini App’ni ochish', url: this.link(roomId) }]] } });
  }
}
