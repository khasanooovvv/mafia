export function validateProduction(env) {
 if(env.NODE_ENV!=='production')return;
 if(env.DEMO_MODE==='true')throw new Error('Production’da demo rejimi taqiqlangan');
 if(!env.BOT_TOKEN)throw new Error('BOT_TOKEN kerak');
 if(!/^[a-zA-Z0-9_]{5,32}$/.test((env.BOT_USERNAME||'').replace(/^@/,'')))throw new Error('BOT_USERNAME kerak');
 let origin;try{origin=new URL(env.APP_ORIGIN);}catch{throw new Error('APP_ORIGIN HTTPS manzil bo‘lishi kerak');}
 if(origin.protocol!=='https:' || origin.username || origin.password || origin.origin!==env.APP_ORIGIN)throw new Error('APP_ORIGIN faqat HTTPS origin bo‘lishi kerak, masalan https://mafia.example.com');
 if(!/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET||''))throw new Error('TELEGRAM_WEBHOOK_SECRET 32–256 belgili maxfiy qiymat bo‘lishi kerak');
 if(env.DB_PATH===':memory:')throw new Error('Production’da doimiy SQLite DB_PATH kerak');
 const voice=[env.LIVEKIT_URL,env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET];
 if(voice.some(Boolean)&&!voice.every(Boolean))throw new Error('LiveKit sozlamalari to‘liq berilishi kerak');
}
