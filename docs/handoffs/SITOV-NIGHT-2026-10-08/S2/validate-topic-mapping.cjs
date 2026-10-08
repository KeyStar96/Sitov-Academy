const fs = require('node:fs'); const assert = require('node:assert/strict'); const ts = require('typescript');
const source = fs.readFileSync('lib/learning/sitov-topic-mapping.ts', 'utf8');
const built = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
assert.equal((built.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const mod = { exports: {} }; new Function('exports', 'module', built.outputText)(mod.exports, mod);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const catalog = { nodes: ['a1.1','a1.2'].flatMap(l => read(`supabase/seeds/path-${l}.json`).flatMap(p => p.nodes.map(n => ({ level: p.level, pathSourceId: p.id, nodeSourceId: n.id })))), targets: [
 ...read('content/vocabulary/sitov-vocabulary-seed.json').units.flatMap(u => u.cards.map(c => ({ kind: 'vocabulary_card', id: c.id, level: u.level, unitId: u.id }))),
 ...read('lib/verbs/catalog-data.json').map(v => ({ kind: 'verb', id: v.id, level: v.level })),
 ...read('supabase/seeds/pronunciation-reading-2026.json').map(t => ({ kind: 'reading_text', id: t.id, level: t.level })),
] };
const { SITOV_TOPIC_MAPPING: mapping, validateSitovTopicMapping: validate } = mod.exports;
assert.deepEqual(validate(mapping, catalog), []);
const clone = () => structuredClone(mapping);
let bad = clone(); bad[0].targets[0].id = 'foreign'; assert(validate(bad,catalog).some(e=>e.startsWith('target:')));
bad = clone(); bad[0].targets[0].unitId = mapping[1].targets[0].unitId; assert(validate(bad,catalog).some(e=>e.startsWith('target:')));
bad = clone(); bad[0].anchors[0].level = 'A1.2'; assert(validate(bad,catalog).some(e=>e.startsWith('anchor:')));
bad = clone(); bad.push(bad[0]); assert(validate(bad,catalog).some(e=>e.startsWith('topic:')));
bad = clone(); bad[0].targets.push(bad[0].targets[0]); assert(validate(bad,catalog).some(e=>e.startsWith('target:')));
console.log('PASS: 7 topics / seed references; foreign ID, wrong unit, wrong-level anchor, duplicate topic/target rejected. No DB publication/access/browser proof.');
