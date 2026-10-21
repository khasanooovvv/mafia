import { createApp } from '../src/server.js';
const app = createApp({ demo: true });
app.http.listen(3000, '127.0.0.1', () => console.log('Local: http://127.0.0.1:3000'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
