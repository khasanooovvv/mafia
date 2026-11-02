const lines={
 commissioner:'🕵️ Komissar dalil izlashga ketdi...',
 hobo:'🚶 Darbadar kimnikigadir shisha olishga ketdi...',
 maniac:'🔪 Qotil butalar orasiga yashirinib oldi...',
 doctor:'👨‍⚕️ Shifokor tungi navbatchilikka ketdi...',
 mistress:'💃 Ma’shuqa qandaydir mehmonni kutyapti...',
 lawyer:'👨‍💼 Advokat Mafiani himoya qilish uchun qidiryapti...',
 mafia:'🤵 Mafia qurbonini tanladi...',don:'🤵 Don qurbonini tanladi...',
 bodyguard:'🛡 Tansoqchi qo‘riqlashga ketdi...',journalist:'📰 Jurnalist ma’lumot izlashga ketdi...'
};
export function nightNarrative(role,action){
 if(action?.skip)return '🚷 Tungi harakat o‘tkazib yuborildi.';
 if(role==='commissioner'&&action?.mode==='kill')return '🕵️ Komissar qurolini tayyorladi...';
 if(role==='don'&&action?.mode==='search')return '🤵 Don Komissarni izlashga ketdi...';
 return lines[role]||'🌙 Tunda kimdir ko‘chaga chiqdi...';
}

const labels={doctor:'👨‍⚕️ Shifokor',don:'🤵🏻 Don',mafia:'🤵🏼 Mafia',hobo:'🧙‍♂️ Daydi',commissioner:'🕵️ Komissar Katani',maniac:'🔪 Qotil',citizen:'👤 Tinch aholi',sergeant:'👮 Serjant',mistress:'💃 Ma’shuqa',lawyer:'👨‍💼 Advokat',suicide:'Suidsid',lucky:'Omadli',kamikaze:'Kamikadze',journalist:'📰 Jurnalist',bodyguard:'🛡 Tansoqchi',mayor:'Mer'};
export function dawnNarrative(event,name){
 if(event.type==='donSuccession')return '🤵🏼 Mafiaga meros qoldi — endi u 🤵🏻 Don.';
 if(event.type!=='eliminated')return '';
 return `Tunda ${event.role?(labels[event.role]||event.role)+' ':''}${name} vahshiylarcha o‘ldirildi...${event.killerRoles?.length?'\nAytishlaricha, unikiga '+[...new Set(event.killerRoles)].map(r=>labels[r]||r).join(' va ')+' kelgan.':''}${event.lastWords?'\nO‘limidan oldin kimdir '+name+' qichqirganini eshitdi:\n'+event.lastWords:''}${event.inactive&&!event.lastWords?'\nO‘limidan oldin kimdir '+name+' qichqirganini eshitdi:\nMen o‘yin paytida boshqa uxlamayma-a-a-a-a-a-an!':''}`;
}
