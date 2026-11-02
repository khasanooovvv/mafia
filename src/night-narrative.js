const lines={
 commissioner:'🕵️ Komissar dalil izlashga ketdi...',
 hobo:'🚶 Darbadar kimnikigadir shisha olishga ketdi...',
 maniac:'🔪 Qotil butalar orasiga yashirinib oldi...',
 doctor:'👨‍⚕️ Şifokor tungi navbatçilikka ketdi...',
 mistress:'💃 Ma’şuqa qandaydir mehmonni kutyapti...',
 lawyer:'👨‍💼 Advokat Mafiani himoya qiliş uçun qidiryapti...',
 mafia:'🤵 Mafia qurbonini tanladi...',don:'🤵 Don qurbonini tanladi...',
 bodyguard:'🛡 Tansoqçi qöriqlaşga ketdi...',journalist:'📰 Jurnalist ma’lumot izlaşga ketdi...'
};
export function nightNarrative(role,action){
 if(action?.skip)return '🚷 Tungi harakat ötkazib yuborildi.';
 if(role==='commissioner'&&action?.mode==='kill')return '🕵️ Komissar qurolini tayyorladi...';
 if(role==='don'&&action?.mode==='search')return '🤵 Don Komissarni izlashga ketdi...';
 return lines[role]||'🌙 Tunda kimdir köçaga çiqdi...';
}

const labels={doctor:'👨‍⚕️ Şifokor',don:'🤵🏻 Don',mafia:'🤵🏼 Mafia',hobo:'🧙‍♂️ Daydi',commissioner:'🕵️ Komissar Katani',maniac:'🔪 Qotil',citizen:'👤 Tinç aholi',sergeant:'👮 Serjant',mistress:'💃 Ma’şuqa',lawyer:'👨‍💼 Advokat',suicide:'Suidsid',lucky:'Omadli',kamikaze:'Kamikadze',journalist:'📰 Jurnalist',bodyguard:'🛡 Tansoqçi',mayor:'Mer'};
export function dawnNarrative(event,name){
 if(event.type==='donSuccession')return '🤵🏼 Mafiaga meros qoldi — endi u 🤵🏻 Don.';
 if(event.type!=='eliminated')return '';
 return `Tunda ${event.role?(labels[event.role]||event.role)+' ':''}${name} vahşiylarça öldirildi...${event.killerRoles?.length?'\nAytishlaricha, unikiga '+[...new Set(event.killerRoles)].map(r=>labels[r]||r).join(' va ')+' kelgan.':''}${event.lastWords?'\nÖlimidan oldin kimdir '+name+' qichqirganini eshitdi:\n'+event.lastWords:''}${event.inactive&&!event.lastWords?'\nÖlimidan oldin kimdir '+name+' qiçqirganini eşitdi:\nMen öyin paytida boşqa uxlamayma-a-a-a-a-a-an!':''}`;
}
