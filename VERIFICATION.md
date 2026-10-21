# Tekshirish — v0.2

2026-10-21, lokal Node.js 24 muhitida:

- `npm run build`: muvaffaqiyatli.
- `npm test`: 20 ta test, 20 tasi muvaffaqiyatli.
- O‘yin qoidalari, role privacy, takroriy/kechikkan harakatlar, g‘oliblar va tenglik tekshirildi.
- 6 ta alohida Socket.IO mijoz bilan to‘liq o‘yin va qayta ulanish sinovdan o‘tdi.
- SQLite yopilib qayta ochilganda maxfiy holat va taymer saqlandi.
- Reyting natijasining takror yozilmasligi, bir xil tarkib va kunlik limitlar, Toshkent kalendar chegaralari tekshirildi.
- Telegram webhook secret, takroriy update, administrator va guruh a’zoligi tekshirildi. Tashqi Telegram API mock qilindi.
- LiveKit tokenining boshlang‘ich ruxsatlari, tirik/chiqqan o‘yinchilar cheklovi, soxta webhook va media yopilmasdan ovoz berishga o‘tmaslik tekshirildi. LiveKit boshqaruv API mock qilindi.
- HTTP sahifa 200 javob qaytardi.
- In-app browser: 390×844 va 1280×900 viewportlarda demo UI ko‘rildi; gorizontal overflow yo‘q.
- Xona yaratish, boshlash, rol dialogi, nishon tanlash/tasdiqlash, muhokama/ovoz fazalari, reyting va profil menyusi tekshirildi.
- Brauzer console’da error qayd etilmadi.

## Hali tasdiqlanmagan

- Haqiqiy Telegram bot va guruh: token, username va domen sozlanmagan.
- Haqiqiy ikki qurilmali ovoz, LiveKit webhook, reconnect va token revocation: LiveKit akkaunt/server sozlamalari yo‘q.
- Docker build/deploy: ushbu kompyuterda Docker CLI mavjud emas.
- Tashqi HTTPS va production yuk sinovi bajarilmadi.

Demo rasmlari sintetik o‘yinchilarni ko‘rsatadi; ular haqiqiy online foydalanuvchilar yoki jonli audio ishlayotganining dalili emas.
