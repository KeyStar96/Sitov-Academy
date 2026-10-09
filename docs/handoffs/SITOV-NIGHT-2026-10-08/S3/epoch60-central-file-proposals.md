# Sitov Academy — exact central diffs for M (not applied by S3)

In `deploy/vps/migrate-local.py`, immediately after:

```python
ORDER.append('113_sitov_staff_legacy_verb_scope.sql')
```

add:

```python
ORDER.append('114_sitov_path_content_revisions.sql')
```

In `supabase/database.types.ts`, inside public Functions, add the service-only RPC type (the file already defines Json):

```ts
sitov_revise_path_content: {
  Args: { p_request_id: string; p_items: Json }
  Returns: Json
}
```

No learner-facing caller or UI is needed. Do not change learner RPC types. Add the canonical VPS114 path to any M-owned ordered native fixture migration list only after its required predecessor SQL71/72/95 and current owner/grant prerequisites. Run `node --test supabase/tests/sitov-path-content-revisions-static.test.mjs` as the local source contract check, followed by a separately assigned genuine PG15 suite. S3 did not edit central runner, schema, registries or existing tests.
