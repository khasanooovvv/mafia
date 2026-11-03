import { GameError } from './game.js';
export class TelegramApiError extends GameError {
  constructor(method, status) {
    super('Telegram sörovi bajarilmadi. Bot huquqlarini tekşiring.');
    this.method = method;
    this.status = status;
  }
}
export class Telegram {
  constructor(token, username, fetcher = fetch) { this.token = token; this.username = (username || '').replace(/^@/, ''); this.fetcher = fetcher; }
  async call(method, body) {
    const response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new TelegramApiError(method, Number(data.error_code || response.status));
    return data.result;
  }
  async photo(fileId) {
    const file=await this.call('getFile',{file_id:fileId});
    if(!/^[a-zA-Z0-9_./-]+$/.test(file.file_path||'') || file.file_path.includes('..'))throw new GameError('Rasm topilmadi');
    const response=await this.fetcher(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new GameError('Rasm yuklanmadi');
    return Buffer.from(await response.arrayBuffer());
  }
  link(roomId = '') {
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(this.username)) throw new GameError('BOT_USERNAME sozlanmagan');
    return `https://t.me/${this.username}${roomId ? `?startapp=${encodeURIComponent(roomId)}` : '?startapp'}`;
  }
  async member(groupId, userId, admin = false) {
    const m = await this.call('getChatMember', { chat_id: groupId, user_id: Number(userId) });
    const allowed = admin ? ['creator', 'administrator'].includes(m.status) : ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member);
    if (!allowed) throw new GameError(admin ? 'Xonani guruh administratori oçadi' : 'Avval Telegram guruhiga a’zo böling');
  }
  send(chatId, text, roomId = '', buttonText = '', options = {}) {
    return this.call('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: buttonText || (roomId ? '🎭 Öyinga qöşiliş' : '🎭 Mini App’ni oçiş'), url: this.link(roomId) }]] }, ...options });
  }
}
