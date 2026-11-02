import test from 'node:test';import assert from 'node:assert/strict';import {validateProduction} from '../src/config.js';
const good={NODE_ENV:'production',BOT_TOKEN:'test',BOT_USERNAME:'mafia_test_bot',APP_ORIGIN:'https://mafia.example.com',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),DB_PATH:'/app/data/game.sqlite'};
test('production requires HTTPS, webhook secret, bot identity and persistent storage',()=>{
 assert.doesNotThrow(()=>validateProduction(good));assert.doesNotThrow(()=>validateProduction({}));
 for(const patch of [{BOT_TOKEN:''},{BOT_USERNAME:''},{APP_ORIGIN:'http://localhost:3000'},{APP_ORIGIN:'https://mafia.example.com/path'},{APP_ORIGIN:undefined},{TELEGRAM_WEBHOOK_SECRET:''},{DB_PATH:':memory:'},{DEMO_MODE:'true'},{LIVEKIT_URL:'wss://voice.example.com'}])assert.throws(()=>validateProduction({...good,...patch}));
});
