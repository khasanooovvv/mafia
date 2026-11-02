import { Telegram } from '../src/telegram.js';
const { BOT_TOKEN, BOT_USERNAME, APP_ORIGIN, TELEGRAM_WEBHOOK_SECRET } = process.env;
if (!BOT_TOKEN || !BOT_USERNAME || !APP_ORIGIN?.startsWith('https://') || !/^[A-Za-z0-9_-]{32,256}$/.test(TELEGRAM_WEBHOOK_SECRET || '')) {
  throw new Error('.env: BOT_TOKEN, BOT_USERNAME, HTTPS APP_ORIGIN va kamida 32 belgili TELEGRAM_WEBHOOK_SECRET kerak.');
}
const bot = new Telegram(BOT_TOKEN, BOT_USERNAME);
const me = await bot.call('getMe', {});
if (me.username.toLowerCase() !== bot.username.toLowerCase()) throw new Error('Token va BOT_USERNAME boshqa-boshqa botlarga tegishli');
const webhook = await bot.call('getWebhookInfo', {}), url = `${new URL(APP_ORIGIN).origin}/telegram/webhook`;
if (webhook.url && webhook.url !== url && !process.argv.includes('--replace-webhook')) {
  throw new Error('Bot boshqa webhook bilan ishlayapti. Mavjud backend bilan birlashtiring yoki almashtirish kerak bo‘lsa --replace-webhook bilan ishga tushiring.');
}
const previousCommands = await bot.call('getMyCommands', {});
const commands = new Map(previousCommands.map(c => [c.command, c]));
for (const c of [{command:'referral',description:'Döstlarni taklif qiliş va referal mukofotlari'},{command:'game',description:'Guruhda yangi o‘yin ochish'},{command:'leave',description:'O‘yindan chiqish'},{command:'team',description:'Tunda maxfiy mafiya chatiga yozish'}, { command: 'mafia', description: 'Guruhda Mafia xonasini ochish' }, { command: 'start', description: 'O‘yinni boshlash yoki shaxsiy rolni ochish' }, { command: 'help', description: 'O‘yin bo‘yicha yordam' }]) commands.set(c.command, c);
await bot.call('setMyCommands', { commands: [...commands.values()] });
await bot.call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Mafia o‘ynash', web_app: { url: new URL(APP_ORIGIN).origin } } });
await bot.call('setWebhook', { url, secret_token: TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message','callback_query'], drop_pending_updates: false });
console.log('Bot menyusi, komandalar va webhook sozlandi. BotFather’da Main Mini App URL’ini ham APP_ORIGIN manziliga sozlang.');
