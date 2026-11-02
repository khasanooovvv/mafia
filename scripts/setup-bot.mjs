import { GROUP_COMMANDS, PRIVATE_COMMANDS } from '../src/bot-commands.js';
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
await bot.call('setMyCommands',{commands:GROUP_COMMANDS,scope:{type:'all_group_chats'}});
await bot.call('setMyCommands',{commands:PRIVATE_COMMANDS,scope:{type:'all_private_chats'}});
await bot.call('setMyCommands',{commands:PRIVATE_COMMANDS,scope:{type:'default'}});
await bot.call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Mafia öynaş', web_app: { url: new URL(APP_ORIGIN).origin } } });
await bot.call('setWebhook', { url, secret_token: TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message','callback_query','my_chat_member'], drop_pending_updates: false });
console.log('Bot menyusi, komandalar va webhook sozlandi. BotFather’da Main Mini App URL’ini ham APP_ORIGIN manziliga sozlang.');
