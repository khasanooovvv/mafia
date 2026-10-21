import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import { GameError } from './game.js';

export class Voice {
  constructor({ url, apiKey, apiSecret, service } = {}) {
    this.enabled = Boolean(url && apiKey && apiSecret); this.url = url; this.apiKey = apiKey; this.apiSecret = apiSecret;
    this.service = service || (this.enabled ? new RoomServiceClient(url.replace(/^ws/, 'http'), apiKey, apiSecret, { requestTimeout: 5 }) : null);
    this.receiver = this.enabled ? new WebhookReceiver(apiKey, apiSecret) : null;
  }
  room(game) { return `mafia_${game.id}_${game.round}`; }
  allowed(game, id) { return this.enabled && game.phase === 'discussion' && game.now() < game.deadline && game.players.some(p => p.id === id && p.alive); }
  async token(game, id) {
    if (!this.allowed(game, id)) throw new GameError(this.enabled ? 'Ovoz faqat tirik o‘yinchilarga muhokamada ochiladi' : 'Ovoz serveri hali sozlanmagan');
    const token = new AccessToken(this.apiKey, this.apiSecret, { identity: id, name: game.member(id).name, ttl: 30 });
    // A stolen/replayed initial token has no media permissions. The authenticated
    // game socket grants microphone permission only after a fresh phase check.
    token.addGrant({ roomJoin: true, room: this.room(game), canPublish: false, canSubscribe: false, canPublishData: false, canUpdateOwnMetadata: false });
    return { token: await token.toJwt(), url: this.url, room: this.room(game) };
  }
  async ready(game, id) {
    if (!this.allowed(game, id)) throw new GameError('Muhokama tugagan yoki siz o‘yindan chiqqansiz');
    await this.service.updateParticipant(this.room(game), id, { permission: { canPublish: true, canSubscribe: true, canPublishData: false, canPublishSources: [2], canUpdateMetadata: false } });
    if (!this.allowed(game, id)) await this.closeRoom(this.room(game));
  }
  async closeRoom(name) {
    if (!this.enabled) return;
    try { await this.service.deleteRoom(name); }
    catch (e) { if (e.status !== 404 && e.code !== 'not_found') throw e; }
  }
  async close(game) { await this.closeRoom(this.room(game)); }
  async handleWebhook(body, authorization, rooms) {
    if (!this.receiver) throw new GameError('Ovoz sozlanmagan');
    const event = await this.receiver.receive(body, authorization);
    if (!['participant_joined', 'track_published'].includes(event.event)) return;
    const name = event.room?.name, id = event.participant?.identity;
    const game = [...rooms.values()].find(g => this.room(g) === name);
    if (!game || !this.allowed(game, id)) await this.closeRoom(name);
  }
}
