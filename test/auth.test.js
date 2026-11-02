import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/auth.js';
import { TOKEN, signed } from '../support/signing.js';

test('Telegram name, nickname and photo require a valid signature and safe photo URL', () => {
  const fields = { first_name: 'Ali', last_name: 'Valiyev', username: 'ali_uz', photo_url: 'https://t.me/i/userpic/320/photo.svg' };
  assert.deepEqual(authenticate(signed(1, undefined, fields), TOKEN), { id: '1', name: 'Ali Valiyev', username: 'ali_uz', photoUrl: fields.photo_url });
  assert.equal(authenticate(signed(), TOKEN).photoUrl, null);
  for (const photo_url of ['javascript:alert(1)', 'http://example.com/a', 'https://user:password@example.com/a']) {
    assert.equal(authenticate(signed(1, undefined, { photo_url }), TOKEN).photoUrl, null);
  }
  assert.throws(() => authenticate(signed(1, undefined, fields).replace('ali_uz', 'fake_user'), TOKEN));
});
test('valid Telegram signature accepted; altered, expired and duplicate data rejected', () => {
  assert.equal(authenticate(signed(), TOKEN).id, '1');
  assert.throws(() => authenticate(signed().replace('Player', 'Imposter'), TOKEN));
  assert.throws(() => authenticate(signed(1, 100), TOKEN));
  assert.throws(() => authenticate(signed(1, Math.floor(Date.now() / 1000) + 100), TOKEN));
  assert.throws(() => authenticate(signed() + '&auth_date=1', TOKEN));
  assert.throws(() => authenticate(signed(), 'wrong'));
  assert.throws(() => authenticate(signed(), ''));
});
