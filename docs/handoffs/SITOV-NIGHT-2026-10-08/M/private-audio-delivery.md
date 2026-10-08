# Sitov Academy: private authored audio draft

Status: DRAFT, not RELEASE_READY. Policy: COMMIT_AND_HANDOFF. No production migration, deployment, audio generation, import or publication performed.

The shared adapter uses canonical vocabulary, reading-text and current daily-quest identities. German free-text requests cannot retrieve protected cache entries. The server rechecks authenticated RLS, authored text and, for student reading references, the current exact-body individual pretest proof on every GET, HEAD and Range request. Raw reading-body SHA256 is separate from normalized audio-asset SHA256. Teacher/admin access uses the existing staff-MFA profile loader. No object path, service credential, signed URL or public URL is returned by the new byte endpoint. Real stored reading recordings are retained; no synthesized substitute replaces a human reference.

Additive migration 20261008213300 / VPS 96 makes audio_cache private and denies direct anon/authenticated cache SELECT even under an existing broad permissive policy. The original prepared-audio publication function retains its OID/ACL and emits a private storage pointer. No authored IDs, files, recordings, answers, checkpoints or progress are rewritten. Migration/VPS copies must remain identical. This draft is not yet included in the canonical schema or standardization snapshot.

Deployment ordering is mandatory: reviewed commercial 93 and exact-current pronunciation 94 enforcement, completed authored audio adapters for every affected caller, actual prepared-asset/human-reference inventory, then coordinated app + private bucket migration 96. Existing public cache links must be audited as a live deployment gate. Do not apply 96 alone while old app callers still depend on public cache URLs. Never roll back by automatically republishing a protected cache bucket. Preserve objects and use a verified compatible private-delivery app or a secure forward fix; a public-bucket rollback needs a separate security decision and is not supplied here.

M validation at the draft integration stage: selected audio/daily-quest/pretest/help Jest suites 186/10 passed, authored resolver logic 5 passed, tsc --noEmit --incremental false passed, touched-file ESLint passed, native PostgreSQL17 current92 + migration96 fixture 1 passed. Jest transports/storage are mocks; the native test proves SQL policies, private bucket metadata, original history retention and replay, not Auth/REST/Storage HTTP or playable Qwen audio. Actual browser, HTTP, published assets and all-account live rights evidence are outstanding.

Remaining required integration:

- Bind PronunciationStudio reference buttons through reference {kind: reading_text, id, part: reference}; its historical conversation playback remains separately participant-authorized.
- Only storage://pronunciation_audio references are accepted as real target recordings by this draft. Inventory other existing human reference formats and provide compatible private delivery before activation; never replace them with Qwen audio.
- Audit every German audio caller outside the assigned vocabulary/daily/reference paths; a bare free-text caller now fails safely and needs a canonical authored identity.
- Confirm daily-quest scene/step/discovery references and all existing prepared assets against actual assignment/template records and word timings.
- Verify combined latest 93/94 enforcement, real Auth/JWT/Storage HTTP, byte ranges and revocation; mocks do not close these gates.
- Maintain current92 QA baseline separately when canonical snapshots gain 93–96. Do not silently let the current92 fixture install unpublished features.
- Audit canonical audio URLs and prepared manifests, retain the known 235 missing higher-level sentence-build recordings as an explicit pre-existing gap, and serialize any required local Qwen authoring/import.
