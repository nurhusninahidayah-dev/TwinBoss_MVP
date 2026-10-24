// Explicit opt-in: this live regression creates one synthetic request/receipt.
// Run with the development preview running: node scripts/tests/refund-api.mjs --live
import assert from 'node:assert/strict';

if (!process.argv.includes('--live')) {
  console.log('Use --live to run against the local development preview. Creates synthetic data and calls Groq.');
  process.exit(0);
}

const base = 'http://127.0.0.1:80/api';
async function api(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(35_000),
  });
  assert.ok(response.ok, `${path}: HTTP ${response.status}: ${response.ok ? '' : await response.text()}`);
  return response.json();
}

const request = await api('/requests', {
  type: 'refund', customerName: 'Siti Aminah', staffName: 'Synthetic QA',
  title: `Synthetic refund regression ${crypto.randomUUID().slice(0, 8)}`,
  amount: 150, description: 'Synthetic test: damaged item, no tags.',
});
assert.equal(request.status, 'pending');
const analysis = await api(`/requests/${request.id}/recommendation`, {});
assert.ok(['approve', 'store_credit', 'reject'].includes(analysis.recommendation));
const receipt = await api(`/requests/${request.id}/decision`, { action: analysis.recommendation });
assert.equal(receipt.requestId, request.id);
const message = await api(`/requests/${request.id}/message-draft`, {});
assert.ok(message.draft.length > 0 && message.draft.length <= 1200);
const activity = await api('/activity');
assert.ok(activity.some(item => item.receiptNumber === receipt.receiptNumber));
console.log(`PASS: request ${request.id}, analysis, decision, WhatsApp draft, persisted receipt. No messages or payments sent.`);
