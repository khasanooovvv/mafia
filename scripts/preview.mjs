import { createApp } from '../src/server.js';
import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
const local=existsSync('.env')?parseEnv(readFileSync('.env','utf8')):{};
const app = createApp({ demo: true, origin:'http://127.0.0.1:3000', adminLogin:local.ADMIN_LOGIN, adminPassword:local.ADMIN_PASSWORD });
app.http.listen(3000, '127.0.0.1', () => console.log('Local: http://127.0.0.1:3000'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
