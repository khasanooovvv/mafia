export const OFFICIAL_GROUP_USERNAME = 'MafiaUzAppGr';
export const OFFICIAL_GROUP_URL = 'https://t.me/'+OFFICIAL_GROUP_USERNAME;
export const isOfficialGroup = username => typeof username==='string' && username.toLowerCase()===OFFICIAL_GROUP_USERNAME.toLowerCase();
