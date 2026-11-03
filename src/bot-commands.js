export const GROUP_COMMANDS=[
 ['game','Guruhda o‘yin boshlash'],['appgame','Mini App’da o‘yin boshlash'],
 ['extended','Registratsiya vaqtini uzaytirish'],['start','O‘yinni boshlash'],
 ['stop','Ro‘yxatga olishni to‘xtatish'],['next','Keyingi o‘yin bildirishnomasi'],
 ['top','Guruh o‘yinchilari reytingi'],['all','Guruh a’zolarini chaqirish'],
 ['share','Do‘stlarni taklif qilish'],['help','Yordam']
].map(([command,description])=>({command,description}));
export const PRIVATE_COMMANDS=[
 ['profile','O‘yin profili'],['start','Botni qayta ishga tushirish'],['leave','O‘yindan chiqish'],
 ['language','O‘yin tili'],['issue','Developer bilan bog‘lanish']
].map(([command,description])=>({command,description}));
