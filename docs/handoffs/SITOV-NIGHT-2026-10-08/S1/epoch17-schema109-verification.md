# S1 epoch 17 — canonical 109 synchronization and native regression

Sitov Academy: **DRAFT_PARTIALLY_ENFORCED / NOT_RELEASE_READY**.
Base: `42ecdbc127fae0f047c70f43d66c41f4dfa0465b`.
Branch: `codex/sitov-night-s1-schema109-verification`.

The only product change replaces the canonical definition of
`public.get_learning_new_items(text)` with the exact proven migration 109
definition. All bytes outside that single function in `supabase/schema.sql`
remain identical to the assigned base. Migration files, other SQL functions,
access guards, application code, roles and runtime settings were not edited.

The existing script now checks that the canonical schema contains exactly one
definition and that it matches both migration sources byte for byte. It also
provides a native regression using immutable baseline 92, frozen overlays 93–99,
then the explicitly inventoried current VPS files 100–108 followed by 109. Each
100–109 operation uses the existing socket-only PostgreSQL 17 instance, its own
disposable database, an 8-second statement limit and an 8.5-second client bound.
The owned database is dropped in `finally`; the shared process is unchanged.

Native assertions cover exact canonical/migration function-definition parity,
109 replay idempotence, unchanged owner/ACL/VOLATILE/SECURITY DEFINER/search_path,
six unchanged private/other-RPC definitions, existing effective rights and
student history, and the per-text pronunciation gate. In particular, legacy
hard mode alone still cannot read the seeded pronunciation text. The final RPC
returns nonempty, ordered new-content keys with both real fixture lesson labels.

Validation:

- Selected `schema109 parity` tests with `SITOV_NIGHT_NATIVE=1`: **2 PASS, 0 skipped**.
- Native bundled `sitov-night-current-schema`, `sitov-night-integrated99`, and
  `sitov-commercial-current-db`: **20 PASS, 0 skipped in 8.61 seconds**.
- Scoped ESLint and diff checks: PASS.
- Owned database-prefix cleanup: verified separately before handoff.

The original nine full JSON/cost tests were deliberately not repeated: M had
already independently rerun them successfully. Their implementation remains
unchanged; this unit adds canonical and later-overlay coverage. Exact migration
100–108 byte hashes, function metadata, rights/history hashes and the nonempty
result are recorded in `epoch17-native-parity-evidence.json`. Migration 109's raw
SHA-256 remains `3958e8671249b77aadc9ad5a9eed66d458ceb55d82f720ab11733b9982562b6d`.

This proves the stated frozen-plus-current migration installation and the single
canonical function replay. It does **not** claim a fresh install of the entire
current canonical file, production-content equivalence, live transport, actual
QA, audio publication, browser verification or release readiness. No API, app
runtime, production database, synthesis, deployment, full build or full Jest
suite was used. The intentional coherent single-statement snapshot behavior from
epoch 16 remains documented there; the real SQLSTATE 57014 cause remains unproven.

M owns integration and remaining release validation. All existing access,
per-text, audio and release gates remain in force.
