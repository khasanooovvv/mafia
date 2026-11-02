# VPS oldidan lokal tekshiruv — 2026-11-02

Natija: lokal avtomatik tekshiruvlar muvaffaqiyatli. VPS hali joylanmagan.

- `npm test`: 76/76 test o‘tdi. Telegram imzosi, webhook siri va takroriy update,
  guruh a’zoligi/admin huquqi, maxfiy rollar, socket izolyatsiyasi, to‘liq o‘yin,
  SQLite tiklash, hamyon va haftalik mukofot tekshirildi.
- `npm audit` (dev kutubxonalari bilan): 0 ma’lum zaiflik.
- `npm run build`: muvaffaqiyatli.
- `npm run test:ui`: 360/390/768/1280px, light/dark, sahifalar,
  rollar katalogi, tungi harakat, ovoz/hukm va Telegram theme sinovlari o‘tdi.
- `node scripts/check-groups-ui.mjs`: guruh sozlamalari va saqlash sinovi o‘tdi.

Tuzatilganlar:

- Docker build bosqichiga frontend import qiladigan `src` fayllari qo‘shildi.
- Production ishga tushishidan oldin HTTPS origin, bot identifikatori,
  webhook siri, doimiy DB va LiveKit konfiguratsiyasi tekshiriladi.
- Eski UI testlari yangi katalog va boshqaruvlarga moslashtirildi.

VPSda qoladigan tekshiruvlar:

- Docker lokal kompyuterda mavjud emas; haqiqiy `docker compose build` va
  konteyner start/health tekshiruvi VPSda bajarilishi kerak.
- Domen DNS va HTTPS, Telegram haqiqiy webhook yetkazilishi, telefon ichidagi
  Mini App va haqiqiy guruh o‘yini hali bu skan doirasida sinalmagan.
- SQLite volume, restartdan keyin saqlanish va backup/restore VPSda tekshiriladi.
- Agar ovoz ishlatilsa, LiveKit mikrofon ruxsati va ulanishi haqiqiy qurilmada sinaladi.
- Yuklama testi qilinmagan. Hozir bir Node jarayoni va bitta SQLite bazasi ishlatiladi.

Bu tekshiruv xatoliklar mutlaqo yo‘qligiga kafolat bermaydi; yuqoridagi
integratsiya va infratuzilma sinovlari joylashdan keyin yakunlanadi.
