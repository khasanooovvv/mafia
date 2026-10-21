# Mafia • Tun shahri — v0.2

Telegram Mini App, real-time o‘yin serveri, guruh bot integratsiyasi, SQLite va LiveKit ovoz integratsiyasi. Asosiy interfeys o‘zbekcha, telefon va kompyuterga mos.

## Tayyor qismlar

- Xona yaratish, ochiq xonalarni ko‘rish, taklif havolasi, guruh xonasiga kirish.
- Aylana o‘yin stoli, yashirin rol kartasi, taymer, tun harakatlari, ovoz berish, natija.
- Telegram HMAC autentifikatsiyasi. Mijozga faqat o‘z roli va ruxsat etilgan ma’lumot yuboriladi.
- `/mafia` guruh komandasi, administrator tekshiruvi, a’zolik tekshiruvi, takroriy webhook himoyasi.
- SQLite: xonalar, rollar, harakatlar, ovozlar, muddatlar va yakuniy natijalar diskda saqlanadi.
- Shaxsiy va guruh reytinglari: haftalik, oylik, umumiy. Toshkent vaqti bo‘yicha.
- LiveKit orqali audio: dastlabki token audio yuborish/eshitish huquqini bermaydi. Server tirik o‘yinchiga faqat muhokamada mikrofon ruxsatini beradi; yakunda media xonasini yopadi.
- Docker + Caddy bilan HTTPS joylashtirish fayllari.

## Hozirgi holat

Kod va lokal integratsiya testlari tayyor. Haqiqiy bot tokeni, HTTPS domen va LiveKit hisobining kalitlari kiritilmagan; Telegram guruhiga xabar yuborilmagan va tashqi serverga deploy qilinmagan. Bot va ovoz xizmatining haqiqiy qurilmadagi ishlashi tashqi integratsiya sinovini talab qiladi. Ushbu loyiha bitta Node.js jarayoni uchun mo‘ljallangan.

## Dizaynni hozir ko‘rish

Node.js 24 yoki yangiroq:

```powershell
npm ci
npm run build
npm run preview
```

Brauzerda `http://127.0.0.1:3000` ochiladi. Demo faqat lokal, namunaviy o‘yinchilar bilan ishlaydi. Mikrofon, reyting va Telegram autentifikatsiyasini taqlid qilib haqiqiy deb ko‘rsatmaydi; ishlab turgan server autentifikatsiyasini chetlab o‘tmaydi.

## Haqiqiy botga ulash

1. `Copy-Item .env.example .env` orqali lokal sozlama yarating.
2. BotFather tokenini faqat `.env` ichidagi `BOT_TOKEN`ga, username’ni `BOT_USERNAME`ga kiriting. Tokenni chatga yoki Git’ga yubormang.
3. `APP_ORIGIN=https://sizning-domeningiz.uz`, `DOMAIN=sizning-domeningiz.uz`, `TELEGRAM_WEBHOOK_SECRET` uchun 32–256 belgili tasodifiy maxfiy satr kiriting. `A-Z`, `a-z`, raqam, `_` va `-` belgilaridan foydalaning.
4. LiveKit Cloud yoki o‘zingiz boshqaradigan LiveKit’da `LIVEKIT_URL=wss://...`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`ni oling va `.env`ga kiriting.
5. LiveKit’da imzolangan webhook manzilini `https://sizning-domeningiz.uz/livekit/webhook` qilib sozlang. Ushbu callback eski/yaroqsiz xona ulanishlarini yopadi; uni o‘chirib qo‘ymang.
6. Domen DNS A/AAAA yozuvlarini serverga yo‘naltiring. Serverda Docker va 80/443 portlar kerak. `docker compose up --build -d` ishga tushiring.
7. `docker compose exec app node scripts/setup-bot.mjs` bilan menyu va webhookni sozlang. Bu buyruq Telegram sozlamalarini o‘zgartiradi. Boshqa webhook aniqlansa to‘xtaydi. Mavjud bot backendini saqlash kerak bo‘lsa `/mafia` update’larini shu modul bilan birlashtiring; shunchaki almashtirmang. Ongli ravishda ko‘chirish uchun `--replace-webhook` flagi bor.
8. BotFather → bot → Bot Settings → Configure Mini App orqali Main Mini App URL’ini `APP_ORIGIN`ga sozlang. Bu `?startapp=ROOM_ID` havolasi uchun kerak.
9. Botni guruhga qo‘shib administrator qiling: Telegram boshqa foydalanuvchilar a’zoligini ishonchli tekshirishi uchun kerak. Guruh administratori `/mafia` yuboradi; bot “Qo‘shilish” URL tugmasini yuboradi.

Agar bot hozir long-polling (`getUpdates`) orqali ishlayotgan bo‘lsa, yangi webhook yoqishdan oldin o‘sha jarayonni to‘xtating yoki yangi modulni mavjud backendga qo‘shing. Telegram bir bot uchun polling va webhookni bir vaqtda ishlatmaydi.

Lokal backend (HTTPS tashqi reverse proxy orqali): `npm start`. `GET /health` xizmat holatini ko‘rsatadi. `.env` va SQLite bazasi tashqariga ochilmaydi. Baza Docker named volume’da saqlanadi; `docker compose down -v` bazani ham o‘chiradi.

## O‘yin qoidalari

- 6–12 o‘yinchi. Mafiya: `floor(N/3)`, bitta komissar, bitta shifokor, qolganlar tinch aholi.
- Tun 45 s → muhokama 90 s → ovoz berish 30 s.
- Harakat/ovoz bir marta yuboriladi; keyin o‘zgarmaydi. O‘ziga ovoz berilmaydi. Shifokor o‘zini yoki bir kishini takroriy tunlarda himoya qilishi mumkin.
- Mafiya ovozlari yoki kunduzgi ovozlar teng bo‘lsa hech kim chiqmaydi. Komissar natijani tun tugaganda oladi.
- Mafiya qolmasa aholi g‘olib. Mafiya soni qolgan tirik o‘yinchilarga teng/ko‘p bo‘lsa mafiya g‘olib.
- O‘yindan chiqqanlar kuzatadi, harakat/ovoz yubora olmaydi va ovozli chatga kirmaydi.
- Uzilish o‘yinni to‘xtatmaydi; qayta kirishda holat tiklanadi. 2 soatdan oshgan o‘yin keyingi faza chegarasida durang bilan yakunlanadi.
- Server qayta ishga tushganda o‘tib ketgan faza bir marta yakunlanadi va keyingi fazaga to‘liq vaqt beriladi.

## Reyting qoidalari

Hisobga olinishi uchun: o‘yin yakunlangan, haqiqiy g‘olib bor, kamida 6 o‘yinchi, kamida 3 daqiqa davom etgan va kamida yarmi biror harakat/ovoz yuborgan bo‘lishi kerak.

- Guruh: `10 + o‘yinchilar soni` ochko, bir kunda ko‘pi bilan 5 ta o‘yin.
- Bir xil o‘yinchilar tarkibi bir kunda bir marta hisoblanadi, hatto boshqa guruhda ham.
- Faol o‘yinchi: ishtirok uchun 1, g‘alaba uchun yana 3 ochko; kuniga 5 ta o‘yingacha.
- Guruhsiz xona shaxsiy reytingga kiradi, guruh reytingiga kirmaydi.
- Durang va juda qisqa o‘yinlar ball bermaydi. Natija game ID bo‘yicha bir marta yoziladi.
- Guruh ID faqat tekshirilgan bot update’dan olinadi. Qo‘shilishda guruh a’zoligi tekshiriladi. O‘yin davomida guruhdan chiqish hozir real vaqtda kuzatilmaydi.

Bu dastlabki suiiste’mol cheklovlari; ko‘p akkauntli firibgarlikni to‘liq aniqlamaydi. Hisoblash formulasi `src/store.js` ichida.

## Ovozning ishlashi va chegarasi

`voice:token` faqat amaldagi muhokamada tirik o‘yinchiga 30 soniyali boshlang‘ich token beradi. Uning publish/subscribe huquqlari yopiq. Frontend LiveKit’ga ulangach, autentifikatsiyalangan socket orqali `voice:ready` yuboradi; server qayta tekshirib faqat mikrofon audiosiga ruxsat beradi. Kamera, ekran, data publication ruxsatlari berilmaydi.

Muhokama tugaganda server LiveKit xonasini o‘chiradi, undan keyingina ovoz berishga o‘tadi. LiveKit boshqaruv API ishlamasa keyingi faza kutadi va yopishni takrorlaydi. Frontend taymeri ham mikrofonni uzadi. Har davraning audio xona nomi boshqa; webhook eski xonaga ulanishni aniqlab yopadi.

Jonli server yoki media boshqaruv tarmog‘i uzilsa audio uzilishida kechikish bo‘lishi mumkin. Production oldidan haqiqiy qurilmalar va provayderda reconnect/token replay, mikrofon ruxsati, muhokamadan chiqish, kuzatuvchi cheklovi, tarmoq uzilishi sinovlari shart. Lokal testlar media SDK chaqiruvlarini mock qiladi — ular haqiqiy ovoz eshitilganini isbotlamaydi.

## API

Socket ulanishi: `io({auth:{initData:Telegram.WebApp.initData}})`. Sessiya bir soatlik; muddati tugaganda Mini App qayta ochiladi. Komandalar acknowledgement bilan `{ok:true,...}` yoki `{ok:false,error}` qaytaradi.

| Event | Payload | Vazifa |
|---|---|---|
| `home:get` | `{}` | Profil, ochiq xonalar, faol xona |
| `rankings:get` | `{period:'week'|'month'|'all'}` | Guruhlar va o‘yinchilar reytingi |
| `room:create` | `{}` | Mustaqil xona |
| `room:join` | `{roomId}` | Kirish/qayta ulanish |
| `room:leave` | `{}` | Lobbidan chiqish |
| `game:start` | `{}` | Egasi boshlaydi |
| `game:sync` | `{}` | Shaxsiy holat |
| `game:night-action` | `{targetId,revision}` | Tungi harakat |
| `game:vote` | `{targetId,revision}` | Ovoz |
| `voice:token` | `{}` | Cheklangan media token |
| `voice:ready` | `{}` | Server mikrofon ruxsatini beradi |

Server eventlari: `game:state`, `room:left`, `room:expired`. Bir foydalanuvchi bir faol xonada bo‘ladi. Boshlangan o‘yinga yangi o‘yinchi kirmaydi. Guruhlar umumiy ochiq xonalar ro‘yxatida ko‘rsatilmaydi.

## Tekshirish va ishlatish chegaralari

`npm test` o‘yin qoidalari, Telegram imzosi, 6 ta socket bilan to‘liq o‘yin, reconnect, maxfiylik, SQLite tiklash, reyting idempotentligi, webhook va ovoz ruxsatlarini tekshiradi. `npm run build` frontendni yig‘adi.

Bitta jarayon va SQLite kichik boshlang‘ich ishga tushirish uchun. Bir nechta replica ishga tushirmang: har biri xotirada alohida o‘yin holatini yuritadi. Katta trafik uchun PostgreSQL/Redis, distributed locking, tashqi monitoring va foydalanuvchi/IP limiti kerak. Hozir socket komandalarida foydalanuvchi limiti bor; edge DDoS himoyasi yo‘q. Tugagan/lobbi xonalari 1 soatdan keyin o‘chadi, natija va reyting qoladi. SQLite fayli rollarni ham saqlaydi: volume’ni faqat server egasi o‘qisin, zaxira nusxalar himoyalansin.

SQLite backup: serverni to‘xtatib `data` katalogini barcha WAL fayllari bilan nusxalang yoki SQLite backup vositasidan foydalaning. Faqat ishlayotgan `.sqlite` faylini yolg‘iz nusxalash tavsiya etilmaydi.

Manbalar: [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [Telegram Bot API](https://core.telegram.org/bots/api), [LiveKit participant permissions](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/).
