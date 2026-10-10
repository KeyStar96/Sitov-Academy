# Sitov Academy: bounded complete objective adoption

The final source audits require eleven changed objective descriptions in one complete compare-and-swap transaction. The previous parent preparer rejected more than ten, preventing the full verified context from being adopted together.

The preparer now permits at most sixteen full objective pairs. Its two-million-byte input bound,100-node bound, full before-row equality, immutable identifiers/unknown fields, description-only changes, unique objective keys, complete approval requirements, serializable transaction and dependency locks remain enforced. No SQL or database mutation occurs in this change.

Actual offline validation: `python3 -m unittest discover -s deploy/vps/tests -p 'test_sitov_path_*cas.py'` —20 tests PASS. A new regression case accepts eleven and sixteen unique complete objective pairs, then rejects the seventeenth specifically at the objective bound. Existing protected-field, stale-row, duplicate, SQL-encoding and combined recovery cases pass. Native concurrency and full actual-content adoption remain separate required evidence; this CPU test does not certify either.
