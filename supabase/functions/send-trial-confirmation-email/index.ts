// Retired on the self-hosted VPS. Business transactions now enqueue mail in
// private.mail_outbox; scripts/mail-worker.mjs delivers through local Postfix.
// Kept as an explicit tombstone so stale HTTP invocations cannot send twice.
Deno.serve(() => new Response(JSON.stringify({ error: 'mail_delivery_moved_to_native_outbox' }), {
  status: 410, headers: { 'Content-Type': 'application/json' },
}))
