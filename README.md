# Mafia • Tun shahri — v0.2

Telegram Mini App, real-time o‘yin serveri, guruh bot integratsiyasi, SQLite va matnli muhokama chati. Asosiy interfeys o‘zbekcha, telefon va kompyuterga mos.

## Tayyor qismlar

- Xona yaratish, ochiq xonalarni ko‘rish, taklif havolasi, guruh xonasiga kirish.
- True Mafia uslubidagi 16 rol, yashirin rol kartasi, tun harakatlari, kun ovozi va hukmni tasdiqlash.
- Telegram HMAC autentifikatsiyasi. Mijozga faqat o‘z roli va ruxsat etilgan ma’lumot yuboriladi.
- `/mafia` guruh komandasi, administrator tekshiruvi, a’zolik tekshiruvi, takroriy webhook himoyasi.
- SQLite: xonalar, rollar, harakatlar, ovozlar, muddatlar va yakuniy natijalar diskda saqlanadi.
- Shaxsiy va guruh reytinglari: haftalik, oylik, umumiy. Toshkent vaqti bo‘yicha.
- Docker + Caddy bilan HTTPS joylashtirish fayllari.

## Hozirgi holat

Lokal testlar tayyor. Haqiqiy Telegram guruhi va VPS tekshiruvi joylash vaqtida bajariladi.


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
6. Domen DNS A/AAAA yozuvlarini serverga yo‘naltiring. Serverda Docker va 80/443 portlar kerak. `docker compose up --build -d` ishga tushiring.
5. `docker compose exec app node scripts/setup-bot.mjs` bilan menyu va webhookni sozlang. Bu buyruq Telegram sozlamalarini o‘zgartiradi. Boshqa webhook aniqlansa to‘xtaydi. Mavjud bot backendini saqlash kerak bo‘lsa `/mafia` update’larini shu modul bilan birlashtiring; shunchaki almashtirmang. Ongli ravishda ko‘chirish uchun `--replace-webhook` flagi bor.
8. BotFather → bot → Bot Settings → Configure Mini App orqali Main Mini App URL’ini `APP_ORIGIN`ga sozlang. Bu `?startapp=ROOM_ID` havolasi uchun kerak.
9. Botni guruhga qo‘shib administrator qiling: Telegram boshqa foydalanuvchilar a’zoligini ishonchli tekshirishi uchun kerak. Guruh administratori `/mafia` yuboradi; bot “Qo‘shilish” URL tugmasini yuboradi.

Agar bot hozir long-polling (`getUpdates`) orqali ishlayotgan bo‘lsa, yangi webhook yoqishdan oldin o‘sha jarayonni to‘xtating yoki yangi modulni mavjud backendga qo‘shing. Telegram bir bot uchun polling va webhookni bir vaqtda ishlatmaydi.

Lokal backend (HTTPS tashqi reverse proxy orqali): `npm start`. `GET /health` xizmat holatini ko‘rsatadi. `.env` va SQLite bazasi tashqariga ochilmaydi. Baza Docker named volume’da saqlanadi; `docker compose down -v` bazani ham o‘chiradi.

## O‘yin qoidalari

- 6–20 o‘yinchi. Mafiya oilasi `floor(N/3)`; ulardan biri Don. Asosiy rollar: Tinch aholi, Don, Mafiya, Komissar va Shifokor.
- O‘yinchilar soni oshgani sari qo‘shimcha rollar ochiladi: 7 — Omadli; 8 — O‘zini osdiruvchi va Kamikadze; 10 — Darbadar; 12 — Ma’shuqa; 14 — Serjant va Tansoqchi; 16 — Manyak; 18 — Advokat va Mer; 20 — Jurnalist. O‘yinda 16 ta rol turi bor.
- Davra: tun 45 s → muhokama 90 s → ovoz 30 s → hukmni tasdiqlash 30 s.
- Don tirik Mafia bilan tunda nishonni belgilaydi; Don halok bo‘lsa boshqa tirik Mafiya uning vazifasini oladi. Advokat Mafiyani komissar tekshiruvidan bir kecha yashiradi.
- Komissar har kecha aniq rolni tekshiradi yoki otadi; tekshiruv Serjantga ham boradi. Komissar halok bo‘lsa, Serjant uning o‘rnini oladi. Shifokor davolaydi va o‘zini faqat bir marta qutqaradi.
- Ma’shuqa tanlagan o‘yinchining tungi harakatini to‘xtatadi. Tansoqchi boshqa o‘yinchini qo‘riqlab, oddiy hujumda uning o‘rniga halok bo‘ladi. Omadli kishi tunda bir marta 2/3 ehtimol bilan omon qoladi.
- Darbadar tanlagan o‘yinchiga borgan rollarni biladi; Jurnalist ikki o‘yinchi bir tomondami, shuni biladi. Merning kunduzgi ovozi ikki hissa sanaladi. Manyak har kecha alohida hujum qiladi; yakka qolsa yutadi.
- Suidsid kunduzgi hukm bilan osilsa, o‘yin davom etadi va Mafia yoki shahar yakuniy g‘alabasiga sherik bo‘ladi. Kamikadze chiqarilsa, qasos nishonini tanlaydi; Shifokor yoki Tansoqchi uni qutqara oladi.
- Kunduzgi nomzodning chiqarilishi alohida ovozda tasdiqlanishi kerak; tasdiq ovozlari rad ovozlaridan ko‘p bo‘lmasa hech kim chiqarilmaydi. Teng ovozda ham hech kim chiqmaydi.
- Mafiya qolmasa va Manyak ham yo‘q bo‘lsa shahar yutadi. Mafiya tiriklarning kamida yarmiga tenglashsa mafiya yutadi. Manyak oxirgi tirik o‘yinchi bo‘lsa yolg‘iz yutadi.
- O‘yindan chiqqanlar kuzatadi, harakat/ovoz yubora olmaydi va ovozli chatga kirmaydi.
- Uzilish o‘yinni to‘xtatmaydi; qayta kirishda holat tiklanadi. 2 soatdan oshgan o‘yin keyingi faza chegarasida durang bilan yakunlanadi.
- Server qayta ishga tushganda o‘tib ketgan faza bir marta yakunlanadi va keyingi fazaga to‘liq vaqt beriladi.

## Reyting qoidalari

Profil va shaxsiy reyting bir xil hisoblangan o‘yinlardan olinadi: faqat faol ishtirok va ochko berilgan o‘yinlar, ularning g‘alabalari va ochkolari ko‘rsatiladi. Hisobga kirmagan o‘yinlar profil g‘alabalarini ham oshirmaydi. O‘yindan chiqarilgan faol ishtirokchi jamoasi yutsa ham g‘alaba oladi. Natijalar Telegram ID bo‘yicha saqlanadi; ism yoki username o‘zgarishi ochkolarni boshqa hisobga ko‘chirmaydi.

Ism, @username va profil rasmi imzosi tekshirilgan Telegram Mini App ma’lumotidan olinadi. Telegram rasmni bermasa yoki rasm yuklanmasa ismning bosh harfi ko‘rsatiladi. O‘zgargan profil Mini App qayta ochilganda yangi Telegram sessiyasidan olinadi.

Hisobga olinishi uchun: o‘yin yakunlangan, haqiqiy g‘olib bor, kamida 6 o‘yinchi, kamida 3 daqiqa davom etgan va kamida yarmi biror harakat/ovoz yuborgan bo‘lishi kerak.

- Guruh: `10 + o‘yinchilar soni` ochko, bir kunda ko‘pi bilan 5 ta o‘yin.
- Bir xil o‘yinchilar tarkibi bir kunda bir marta hisoblanadi, hatto boshqa guruhda ham.
- Faol o‘yinchi: ishtirok uchun 1, g‘alaba uchun yana 3 ochko; kuniga 5 ta o‘yingacha.
- Guruhsiz xona shaxsiy reytingga kiradi, guruh reytingiga kirmaydi.
- Durang va juda qisqa o‘yinlar ball bermaydi. Natija game ID bo‘yicha bir marta yoziladi.
- Guruh ID faqat tekshirilgan bot update’dan olinadi. Qo‘shilishda guruh a’zoligi tekshiriladi. O‘yin davomida guruhdan chiqish hozir real vaqtda kuzatilmaydi.

Bu dastlabki suiiste’mol cheklovlari; ko‘p akkauntli firibgarlikni to‘liq aniqlamaydi. Hisoblash formulasi `src/store.js` ichida.

## Muhokama

Muhokama Mini App matnli chatida yoki Telegram guruhida o‘tkaziladi.
Guruh a’zolari zarur bo‘lsa Telegramning o‘z ovozli chatidan foydalanishi mumkin.
Bot ovozli chat yaratmaydi va boshqarmaydi.

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
| `game:night-action` | `{targetId,mode?,targetIds?,revision}` | Tungi harakat (`mode`: Komissar uchun `check`/`kill`; Jurnalistga 2 ta `targetIds`) |
| `game:kamikaze` | `{targetId,revision}` | Chiqarilgan Kamikadzening qasos nishoni |
| `game:vote` | `{targetId,revision}` yoki `{confirm:boolean,revision}` | Kunduzgi ovoz / hukm tasdig‘i |

Server eventlari: `game:state`, `room:left`, `room:expired`. Bir foydalanuvchi bir faol xonada bo‘ladi. Boshlangan o‘yinga yangi o‘yinchi kirmaydi. Guruhlar umumiy ochiq xonalar ro‘yxatida ko‘rsatilmaydi.

## Tekshirish va ishlatish chegaralari

`npm test` o‘yin qoidalari, Telegram imzosi, 6 ta socket bilan to‘liq o‘yin, reconnect, maxfiylik, SQLite tiklash, reyting idempotentligi, webhook va ovoz ruxsatlarini tekshiradi. `npm run build` frontendni yig‘adi.

Bitta jarayon va SQLite kichik boshlang‘ich ishga tushirish uchun. Bir nechta replica ishga tushirmang: har biri xotirada alohida o‘yin holatini yuritadi. Katta trafik uchun PostgreSQL/Redis, distributed locking, tashqi monitoring va foydalanuvchi/IP limiti kerak. Hozir socket komandalarida foydalanuvchi limiti bor; edge DDoS himoyasi yo‘q. Tugagan/lobbi xonalari 1 soatdan keyin o‘chadi, natija va reyting qoladi. SQLite fayli rollarni ham saqlaydi: volume’ni faqat server egasi o‘qisin, zaxira nusxalar himoyalansin.

SQLite backup: serverni to‘xtatib `data` katalogini barcha WAL fayllari bilan nusxalang yoki SQLite backup vositasidan foydalaning. Faqat ishlayotgan `.sqlite` faylini yolg‘iz nusxalash tavsiya etilmaydi.


## React / Telegram UI interface

The view layer uses React 18 and @telegram-apps/telegram-ui (AppRoot, Button,
Input and Tabbar.Item). client/ui.js converts the existing escaped view templates
into React elements so the socket/game controller keeps its established behavior.
client/appearance.css owns semantic light/dark colors and responsive overrides.
Telegram colorScheme/themeChanged takes priority inside Telegram; standalone
browsers follow prefers-color-scheme and update without a reload. Insets from
Telegram and the device are reserved for navigation. Cards retain their artwork.

Build: npm run build. UI smoke tests: npm run test:ui (Microsoft Edge installed).
Tests cover 360/390/768/1280px, both themes, navigation, all 19 catalog cards,
demo game actions and live Telegram theme changes with a mocked Telegram host.
Real Telegram device testing remains a separate check; these UI tests do not
validate the real Telegram service. Backend game rules are covered by npm test.

## Guruh boshqaruvi

Profil → Guruhlarim orqali ochiq guruh @username yoki guruh ID bilan ulanadi.
Yopiq guruhda admin /sozlash buyrug‘ini yuboradi, keyin profilda ro‘yxatni yangilaydi.
Bot ham guruhda administrator bo‘lishi kerak. Har ulash/saqlashda Telegram orqali
foydalanuvchi va bot huquqlari qayta tekshiriladi. Sozlamalar SQLite’da saqlanadi.
Minimal/maksimal o‘yinchilar (6–20) va to‘rt faza vaqti (10–600 soniya) sozlanadi.
Sozlama yangi /mafia xonasiga qo‘llanadi; faol xona o‘zgarmaydi.
Demo interfeys guruhni haqiqiy ulash yoki sozlamalarni saqlashni taqlid qilmaydi.
Tekshiruv: node --test test/groups.test.js test/telegram.test.js

### Guruhning qo‘shimcha qoidalari

Guruhlarim sozlamalarida qo‘shimcha rollar yoqiladi/o‘chiriladi. Mafiya va tinch
aholi asosiy rollar bo‘lib qoladi. Rollarning mavjud o‘yinchi-soni chegaralari saqlanadi.
Tungi harakatni va kunduz ovozini o‘tkazish alohida yoqiladi (dastlab o‘chiq).
Jurnalist maqolasi umumiy Mini App o‘yin ekranida anonim ko‘rsatiladi.
Tekshiruv bildirishnomasi Komissar/Jurnalist nishoniga shaxsiy o‘yin hisobotida
chiqadi; tekshiruvchi shaxsi va roli oshkor qilinmaydi. Bular Telegram guruhiga yoki
shaxsiy chatga alohida xabar yubormaydi. Bloklangan va o‘tkazilgan harakat xabar yaratmaydi.
Qo‘shimcha qoidalar sinovi: node --test test/options.test.js test/groups.test.js


## Telegram va Mini App’da birgalikda o‘ynash

Admin guruhda `/mafia` yoki `/game` bilan xona ochadi. “Telegram orqali
qo‘shilish” botning shaxsiy chatini ochadi va shu xonaga ulaydi. Guruhdagi
`/start` yoki boshlash tugmasi o‘yinni boshlaydi. Rollar, tungi nishonlar,
Komissar tekshiruvi va boshqa maxfiy natijalar faqat shaxsiy chatga yuboriladi.
Ovoz berish va hukm tasdig‘i guruh tugmalari yoki shaxsiy chatdan bajariladi.
`/start` yoki `/game` shaxsiy chatda joriy o‘yin va yangi tugmalarni qayta ochadi.
`/leave` o‘yindan chiqaradi; faol o‘yinda odatiy chiqish cheklovi amal qiladi.
Tunda Don va mafiyalar `/team xabar` bilan maxfiy jamoaga yozishi mumkin.

Telegram va Mini App bitta Game holatidan foydalanadi: bir kanalda qilingan
harakatni ikkinchisida takrorlash mumkin emas. Reyting, hamyon va haftalik
mukofotlar bir xil natijadan hisoblanadi. Bot bloklangan bo‘lsa, uni shaxsiy
chatda ochib `/start` yuborish kerak; yashirin rol guruhga yuborilmaydi.

Mavjud botni ishga tushirishda `npm run setup-bot` orqali webhook’dagi
`allowed_updates` ichiga `callback_query` ham qo‘shilishi kerak. Ushbu o‘zgarish
lokal demo orqali haqiqiy Telegram akkauntiga xabar jo‘natmaydi.
Sinov: `node --test test/telegram-game.test.js test/telegram.test.js test/group-voting.test.js`.


## VPS oldidan tekshiruv

2026-11-02 tekshiruvi: [tekshiruv hisoboti](SCAN-REPORT.md).
Production ishga tushishda HTTPS APP_ORIGIN (oxirida slashsiz), BOT_USERNAME,
BOT_TOKEN va 32–256 belgili TELEGRAM_WEBHOOK_SECRET tekshiriladi.
Xotiradagi DB va demo rejimi production’da taqiqlangan.


## Avtomatik VPS deploy

`main`ga push: GitHub Actions Node.js 24 bilan test va buildni tekshiradi,
keyin arxivni cheklangan SSH deploy kaliti orqali VPSga yuboradi.
Workflow: `.github/workflows/deploy.yml`; server skripti: `scripts/deploy.sh`.
Actions secrets: `VPS_DEPLOY_KEY`, `VPS_KNOWN_HOSTS`.
VPS: `/opt/mafia`, compose: `deploy/vps/compose.yaml`.
Yangi image eski bot ishlayotganida yig‘iladi, yangilashdan oldin SQLite backup
olinadi. Healthcheck muvaffaqiyatsiz bo‘lsa oldingi image qaytariladi.
`.env` faqat server/lokal kompyuterda turadi, GitHubga yuborilmaydi.
Mavjud umumiy Caddy `mafia-app:3000`ga yo‘naltiradi.


## Referal tizimi

Profil → Do‘stlarni taklif qiling yoki botda `/referral` orqali shaxsiy havola olinadi.
`/start ref_ID` va imzolangan Mini App `start_param=ref_ID` bir xil hisoblanadi.
Faqat yangi foydalanuvchi bir marta biriktiriladi; o‘zini taklif qilish taqiqlangan.
Yangi foydalanuvchining birinchi haqiqatan tanga oladigan faol o‘yinidan keyin
ikkalasiga 10 tangadan beriladi. Bonus o‘yin reytingi ballarini o‘shirmaydi.
Natija va bonus bitta SQLite tranzaksiyasida saqlanadi. Bu Telegram ID bo‘yicha
himoya; bir odamning bir nechta haqiqiy akkauntini aniqlamaydi.


## Bot bosh menyusi va guruhlarni avtomatik ulash

Shaxsiy chatdagi `/start`: guruhga qo‘shish, Guruhlarim, o‘yin, profil, do‘kon,
rollar va referal tugmalari. Har tugma Mini App’dagi tegishli bo‘lumni ochadi.
Bot guruhda administrator qilinganda `my_chat_member` yangilanishi orqali
Telegram tasdiqlagan inson administratorlariga guruh avtomatik biriktiriladi.
`startgroup=mafia` va `/sozlash` ham guruhni ulaydi. Guruhlar ro‘yxatini ochishda
foydalanuvchi va botning administratorligi qayta tekshiriladi.
Telegram API bot ilgari qo‘shilgan barcha guruhlarni avtomatik sanab bermaydi;
eski guruhlar uchun `/sozlash` yoki qo‘lda ulash ishlatiladi.
Bu o‘zgarishni joylashda `setup-bot` webhookning `allowed_updates` ro‘yxatiga
`my_chat_member`ni qo‘shadi. Lokal tayyorlashning o‘zi ishlab turgan webhookni o‘zgartirmaydi.


Bot bosh menyusidagi Profil, Do‘kon, Rollar, Referal, Guruhlarim va O‘yinga kirish
endi `nav|...` callbacklari bilan Telegram shaxsiy chatining o‘zida ishlaydi.
Mini App uchun alohida tugma bor. Do‘kon xaridi 2 daqiqalik, foydalanuvchiga
bog‘langan bir martalik tasdiq bilan bajariladi; bot va Mini App bir hamyonni ishlatadi.


Guruhda `/game` (yoki `/mafia`) Telegram o‘yini uchun ro‘yxat ochadi:
qo‘shilish va boshlash tugmalari bot orqali ishlaydi. `/AppGame` (menyuda `/appgame`)
Mini App o‘yin xonasini ochadi va Mini App havolasini beradi.
Guruhda bitta faol xona saqlanadi: boshqa komanda mavjud o‘yin rejimini almashtirmaydi.


## Guruh va shaxsiy komandalar

Guruh menyusi tartibi: /game, /appgame, /extended, /start, /stop, /next,
/top, /all, /share, /help. Shaxsiy menyu: /profile, /start, /leave,
/language, /issue. Menyular Telegram command scope orqali ajratilgan.
/extended administrator uchun registratsiyaga 30 soniya qo‘shadi.
/stop faqat lobby registratsiyasini bekor qiladi; faol o‘yinni to‘xtatmaydi.
/next keyingi yangi xona ochilganda bir martalik shaxsiy bildirishnoma beradi.
/top shu guruhdagi o‘yinchilarning umumiy tanga reytingidan top 30ni ko‘rsatadi.
/all faqat admin uchun, 5 daqiqada bir marta. Bot tanigan 200 tagacha a’zo
Telegram a’zoligi tekshirilgandan keyin HTML mention bilan chaqiriladi.
Bot API barcha guruh a’zolari ro‘yxatini bermaydi; privacy rejimi ham
bot qaysi oddiy xabarlarni ko‘rishini cheklaydi. Shu sabab /all barcha a’zolarni
kafolatlamaydi. /language hozircha faqat mavjud o‘zbek tilini ko‘rsatadi.
/issue uchun DEVELOPER_USERNAME server sozlamasida beriladi.


## Admin panel

`/admin` manzilida login/parolli kuzatuv paneli bor: foydalanuvchilar va
hamyon balanslari, guruhlar, faol xonalar, umumiy statistika. Ro‘yxatlar 50 tadan
sahifalanadi; panel hozircha ma’lumot ko‘rsatadi, balans yoki o‘yin holatini o‘zgartirmaydi.
`ADMIN_LOGIN` va `ADMIN_PASSWORD` faqat `.env`da saqlanadi. Sozlanmasa API 503
qaytaradi. Parol serverda scrypt bilan solishtiriladi; sessiya bir soatlik,
HttpOnly/SameSite=Strict cookie’da, HTTPSda Secure. Server qayta ishga tushsa
admin sessiyalari bekor bo‘ladi. /api/admin/overview autentifikatsiyasiz ochilmaydi.
Registratsiya qilingan foydalanuvchi va bot administrator bo‘lgan guruhlar
o‘yin o‘ynamagan bo‘lsa ham reytingning mavjud top-100 chegarasida 0 bilan ko‘rinadi.
Guruhning bot adminligi bekor bo‘lgani haqidagi my_chat_member yangilanishi
kelganda guruh reytingdan yashiriladi. Shu sabab eski guruh holati webhook
kelmaguncha so‘nggi ma’lum holatga asoslanadi.
