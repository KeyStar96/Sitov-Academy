#!/usr/bin/env node
/** Read-only sentence ambiguity audit. Never reads accounts or private own words. */
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function ambiguityReasons(sentence) {
  const text = (sentence ?? '').normalize('NFC')
  const reasons = []
  if (/\b(?:Sie|Ihnen|Ihr(?:e[nsrm]?|en|em|er|es)?|[Dd]u|[Dd]ich|[Dd]ir|[Dd]ein(?:e[nsrm]?|en|em|er|es)?)\b/u.test(text)) reasons.push('du_sie')
  if (/\b(?:heute|morgen|gestern|morgens|mittags|abends|nachts|montags|dienstags|mittwochs|donnerstags|freitags|samstags|sonntags|hier|dort)\b/iu.test(text)
    || /\b(?:in|im|am|auf|bei|nach|vor|hinter|neben|unter|über|aus|zum|zur|von)\s+[^.!?]+/iu.test(text)) reasons.push('word_order')
  if (/\btschüss?\b/iu.test(text)) reasons.push('tschuess')
  if (/\bgeht(?:[’']?s|\s+es)\b/iu.test(text)) reasons.push('gehts')
  if (/\b(?:ich heiße|mein Name ist)\b/iu.test(text)) reasons.push('name_forms')
  if (/\d|\b(?:null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|(?:drei|vier|fünf|sech|sieb|acht|neun)zehn|(?:(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und)?(?:zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)|(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)?hundert|(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)?tausend)\b/iu.test(text)) reasons.push('number')
  if (/€|\b(?:Euro|Cent)\b|\d+[,.]\d{2}/iu.test(text)) reasons.push('price')
  return reasons
}

export function auditCards(cards) {
  return cards.filter(card => card.sentence_practice).flatMap(card => {
    const reasons = ambiguityReasons(card.sentence)
    if (!reasons.length) return []
    const nonempty = values => Array.isArray(values) && values.some(value => typeof value === 'string' && value.trim())
    return [{ ...card, reasons, resolved: nonempty(card.target_form) || nonempty(card.alternative_answers_de) }]
  })
}

export const auditQuery = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT jsonb_build_object('captured_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
 'shared_active_cards',(SELECT count(*) FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE u.is_active AND u.owner_auth_user_id IS NULL),
 'cards',(SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM (
 SELECT c.id,u.level,u.label AS lesson,c.word_de,c.sentence_practice,t.context_sentence AS sentence,
 c.alternative_answers_de,to_jsonb(c)->'target_form' AS target_form
 FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id
 LEFT JOIN public.vocabulary_translations t ON t.card_id=c.id AND t.locale='de'
 WHERE u.is_active AND u.owner_auth_user_id IS NULL AND c.sentence_practice ORDER BY u.level,u.sort_order,c.id) q));
ROLLBACK;`

async function main() {
  const args = process.argv.slice(2)
  const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
  let snapshot
  if (option('--snapshot')) snapshot = JSON.parse(await readFile(option('--snapshot'), 'utf8'))
  else if (option('--ssh-host')) {
    const host = option('--ssh-host')
    if (!/^[a-zA-Z0-9_.@-]+$/.test(host) || host.startsWith('-')) throw new Error('Invalid SSH host')
    const command = 'docker exec -i supabase-db-eknmzxvqilojjicinatnllbt psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atq'
    snapshot = JSON.parse(execFileSync('ssh', [host, command], { input: auditQuery, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }))
  } else throw new Error('Use --snapshot path or --ssh-host sitov-academy; add --check to fail on unresolved cards.')
  if (args.includes('--export')) { process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n'); return }
  const cards = Array.isArray(snapshot) ? snapshot : snapshot.cards
  const findings = auditCards(cards)
  const result = { shared_active_cards: snapshot.shared_active_cards ?? cards.length, sentence_cards: cards.filter(card => card.sentence_practice).length,
    findings: findings.length, unresolved: findings.filter(card => !card.resolved).length, cards: findings }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (args.includes('--check') && result.unresolved) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('vocabulary_variant_audit_failed: use --snapshot path or --ssh-host host; verify input and read access.'); process.exitCode = 1 })
