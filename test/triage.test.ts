import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heuristicTriage } from '../src/ai/fallback.js';
import { payoutFacts } from '../src/ai/draft.js';
import { parseTriage } from '../src/ai/triage.js';

test('heuristic: ISBN errors are at least High', () => {
  const r = heuristicTriage('Wrong ISBN', 'ISBN on Amazon differs from my copy');
  assert.equal(r.category, 'ISBN & Metadata Issues');
  assert.equal(r.priority, 'High');
});
test('heuristic: bio update is General / Low', () => {
  const r = heuristicTriage('Update bio', 'Can I update my author bio on the listing?');
  assert.deepEqual(r, { category: 'General Inquiry', priority: 'Low' });
});
test('heuristic: months without royalty is High, legal threat Critical', () => {
  assert.equal(heuristicTriage('Royalty', "I haven't received any royalty for 6 months").priority, 'High');
  assert.equal(heuristicTriage('Royalty', 'my royalty is missing, I will contact a lawyer').priority, 'Critical');
});
test('parseTriage accepts fenced JSON and rejects bad categories', () => {
  const ok = parseTriage('```json\n{"category":"Royalty & Payments","priority":"High","reason":"overdue"}\n```');
  assert.equal(ok.priority, 'High');
  assert.throws(() => parseTriage('{"category":"Spam","priority":"High"}'));
  assert.throws(() => parseTriage('no json here'));
});
test('payoutFacts gives concrete dates', () => {
  const f = payoutFacts(new Date('2026-10-27T00:00:00Z'));
  assert.match(f, /Previous quarter ended 2026-09-30; its payout is due by 2026-11-14/);
  assert.match(f, /Current quarter ends 2026-12-31; its payout is due by 2027-02-14/);
});
