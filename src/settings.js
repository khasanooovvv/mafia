export const ROLE_ORDER = ['doctor','commissioner','lucky','suicide','kamikaze','hobo','mistress','sergeant','bodyguard','maniac','lawyer','mayor','journalist'];
export const SETTING_SECTIONS = [
 ['Baflar va mavsumiy o‘yin', [
  ['enableBuffs','Baflarni yoqish','Inventardagi himoya, hujjat va faol rol ishlaydi.',false],
  ['halloween','Halloween rejimi','Tinch aholi qovoq bilan harakat qiladi, shirinlik esa undan himoya qiladi.',false]
 ]],
 ['O‘yin qoidalari', [
  ['adminOnlyStart','O‘yinni faqat admin boshlaydi','O‘chirilsa, xonadagi istalgan o‘yinchi boshlashi mumkin.',true],
  ['hiddenVoting','Yashirin ovoz berish','Kim kimga ovoz bergani hammaga ko‘rsatilmaydi.',false],
  ['revealRoles','O‘lganlarning rolini ko‘rsatish','O‘chirilsa, rollar o‘yin yakunigacha yashirin qoladi.',true],
  ['showKillers','Hujum qilgan rolni ko‘rsatish','Tonggi natijada hujum qilgan rol ko‘rsatiladi.',true],
  ['showActions','Tungi harakatlarni ko‘rsatish','Rol harakat qilgani e’lon qilinadi, nishoni yashirin.',true],
  ['showEmoji','Xabarlarda emoji','Botning o‘yin xabarlaridagi emojilar.',true],
  ['friendlyFire','Sheriklarga hujum qilish','Mafiya a’zolari bir-birini nishonga olishi mumkin.',false],
  ['donSearch','Don komissarni qidiradi','Don hujum o‘rniga komissarni qidirishi mumkin.',false],
  ['commissionerShoot','Komissar otishi mumkin','O‘chirilsa, komissar faqat tekshiradi.',true],
  ['firstNightShoot','Birinchi kechada otish','Komissarning birinchi tundagi otishiga ruxsat.',true],
  ['doctorNoRepeat','Ketma-ket davolamaslik','Shifokor oldingi kechadagi odamni yana davolay olmaydi.',false],
  ['kamikazeNight','Kamikaze tunda portlaydi','Tungi hujumda o‘lsa, hujumchini ham olib ketadi.',false]
 ]],
 ['Harakatlar va bildirishnomalar', [
  ['skipNight','Tungi harakatni o‘tkazish','Faol rol harakat qilmaslikni tanlay oladi.',false],
  ['skipVoting','Kunduz ovozini o‘tkazish','O‘yinchi hech kimni tanlamasdan ovoz beradi.',false],
  ['nightNotifications','Tungi tashrif bildirishnomasi','Tashrif bo‘lgan o‘yinchiga shaxsiy hisobot chiqadi.',false],
  ['journalistArticle','Jurnalist maqolasi','Ikki o‘yinchining taqqoslanishi ommaga chiqadi.',false],
  ['pinRegistration','Ro‘yxatni pin qilish','Guruhdagi o‘yinga qo‘shilish xabarini mahkamlaydi.',false],
  ['protectContent','Bot xabarlarini himoyalash','Telegramda nusxalash va uzatishni cheklaydi.',false]
 ]],
 ['Guruhda yozishni cheklash', [
  ['blockDead','O‘lgan o‘yinchilar','O‘yin tugaguncha ularning o‘yin paytidagi xabarlari o‘chiriladi.',false],
  ['blockNight','Tunda yozishni cheklash','Tunda ishtirokchilarning xabarlari o‘chiriladi.',false],
  ['blockOutsiders','O‘yinga kirmaganlar','Faol o‘yin vaqtida begonalarning xabarlari o‘chiriladi.',false],
  ['blockMistress','Ma’shuqa chalg‘itgan o‘yinchi','Keyingi kunduzda shu o‘yinchining xabarlari o‘chiriladi.',false],
  ['deleteMedia','O‘yinchilar mediasini o‘chirish','O‘yin vaqtida foto, video, audio va stikerlarni o‘chiradi.',false],
  ['profanityFilter','So‘kinish filtri','Asosiy haqoratli so‘zlar bor xabarlarni o‘chiradi.',false],
  ['moderatorEnabled','Moderator buyruqlari','Adminlar /mute va /unmute orqali javob berilgan odamni boshqaradi.',false]
 ]]
];
export const BOOLEAN_RULES = Object.fromEntries(SETTING_SECTIONS.flatMap(([,items])=>items.map(([key,,,value])=>[key,value])));
export const ADVANCED_DEFAULTS = {...BOOLEAN_RULES,mafiaDivisor:3,registrationMs:120000,exitCooldownMs:0,roleOrder:ROLE_ORDER};
