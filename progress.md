# Project progress

## Baseline
Version 0.6.1 includes automatic recovery, status wording, themed popup, privacy policy, and store artwork. Earlier implementation/test history is preserved in Git; current evidence is in docs/compatibility.md.

## Cleanup — 2026-09-10
- Switched to main and fast-forwarded to the merged remote revision d2999c0.
- Removed obsolete prototype briefs, old release bundles, unpacked duplicate builds, test captures, and generated artwork source copies.
- Retained the latest 0.6.1 ZIP/checksum under releases/, final store images, all source/tests, supplied icons, privacy policy, and font licenses.
- Moved compatibility notes into docs and corrected repository URLs and branch references.
- Condensed working notes and ignored all generated outputs. Backed up the previous output directory (including ignored local investigations/backups) outside the repository at /Users/sssst/.codex/backups/gpt-helper-cleanup-20260910-143425.
- Verification passed: 20 unit tests; TypeScript/build/manifest checks; store-generator syntax; latest archive CRC/SHA-256 and byte equality against rebuilt dist; final artwork checksums; README links. No obsolete repo/branch references remain in maintained user documentation.
- Repository file count reduced from 144 to 53. Runtime source and tests are unchanged; no broad browser rerun was needed. No commit or push performed.
