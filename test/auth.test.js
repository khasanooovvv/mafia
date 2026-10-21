import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/auth.js';
import { TOKEN, signed } from '../support/signing.js';
test('valid Telegram signature accepted; altered, expired and duplicate data rejected', () => {
  assert.equal(authenticate(signed(), TOKEN).id, '1');
  assert.throws(() => authenticate(signed().replace('Player', 'Imposter'), TOKEN));
  assert.throws(() => authenticate(signed(1, 100), TOKEN));
  assert.throws(() => authenticate(signed(1, Math.floor(Date.now() / 1000) + 100), TOKEN));
  assert.throws(() => authenticate(signed() + '&auth_date=1', TOKEN));
  assert.throws(() => authenticate(signed(), 'wrong'));
  assert.throws(() => authenticate(signed(), ''));
});
