import { Telegram } from '../src/telegram.js';
const { BOT_TOKEN, BOT_USERNAME, APP_ORIGIN, TELEGRAM_WEBHOOK_SECRET } = process.env;
if (!BOT_TOKEN || !BOT_USERNAME || !APP_ORIGIN?.startsWith('https://') || !/^[A-Za-z0-9_-]{32,256}$/.test(TELEGRAM_WEBHOOK_SECRET || '')) {
  throw new Error('.env: BOT_TOKEN, BOT_USERNAME, HTTPS APP_ORIGIN va kamida 32 belgili TELEGRAM_WEBHOOK_SECRET kerak.');
}
const bot = new Telegram(BOT_TOKEN, BOT_USERNAME);
const me = await bot.call('getMe', {});
if (me.username.toLowerCase() !== bot.username.toLowerCase()) throw new Error('Token va BOT_USERNAME boşqa-boşqa botlarga tegişli');
const webhook = await bot.call('getWebhookInfo', {}), url = `${new URL(APP_ORIGIN).origin}/telegram/webhook`;
if (webhook.url && webhook.url !== url && !process.argv.includes('--replace-webhook')) {
  throw new Error('Bot boşqa webhook bilan işlayapti. Mavjud backend bilan birlaştiring yoki almaştiriş kerak bölsa --replace-webhook bilan işga tuşiring.');
}
const previousCommands = await bot.call('getMyCommands', {});
const commands = new Map(previousCommands.map(c => [c.command, c]));
for (const c of [{command:'referral',description:'Döstlarni taklif qiliş va referal mukofotlari'},{command:'game',description:'Guruhda yangi öyin oçiş'},{command:'leave',description:'Öyindan çiqiş'},{command:'team',description:'Tunda maxfiy mafiya chatiga yozish'}, { command: 'mafia', description: 'Guruhda Mafia xonasini oçiş' }, { command: 'start', description: 'Öyinni boşlaş yoki şaxsiy rolni oçiş' }, { command: 'help', description: 'Öyin böyiça yordam' }]) commands.set(c.command, c);
await bot.call('setMyCommands', { commands: [...commands.values()] });
await bot.call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Mafia öynaş', web_app: { url: new URL(APP_ORIGIN).origin } } });
await bot.call('setWebhook', { url, secret_token: TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message','callback_query','my_chat_member'], drop_pending_updates: false });
console.log('Bot menyusi, komandalar va webhook sozlandi. BotFather’da Main Mini App URL’ini ham APP_ORIGIN manziliga sozlang.');
