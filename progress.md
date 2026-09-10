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

## Icon fix — 0.6.2
- Cause: supplied icons existed but were not referenced by the manifest. Added icons and action.default_icon for 16/32/48/128px PNGs; CRXJS now includes them automatically.
- Production typecheck/build and icon declaration/dimension/byte-equality checks passed. New archive CRC and full byte equality verified. Existing non-manifest files match 0.6.1 byte-for-byte; no runtime changes.
- Latest release replaced with gpt-navigator-helper-0.6.2.zip (48142 bytes), SHA-256 0befdae6c5407b42e71fcd81513628d49c10559705d5f7be5e94e6a96d9ed2d4. Earlier archive remains in Git history. No commit/push performed.

## Icon padding — 0.6.3
- Measured excess transparent margins and regenerated 16/32/48/128px icons from the unchanged vector master with 1/2/3/16px minimum padding. Added a reproducible generator and reviewed native-size renders.
- Production typecheck/build and icon checks passed. ZIP integrity, source equality, and comparison with 0.6.2 passed: only the manifest and icon PNGs differ. Runtime behavior is unchanged.
- Packaged releases/gpt-navigator-helper-0.6.3.zip (49462 bytes), SHA-256 7fb535c22fcdb41d164e479e68c6111ef483c725c08ae41d4201b7f4738f6bc4. Moved the uncommitted 0.6.2 package into ignored output/releases. No commit/push performed.

## Publication preparation
- Added a plain-text submission reference covering copy, privacy explanations and category recommendations, asset paths, reviewer steps, distribution, and account fields. Public policy URL and personal publisher details remain explicit placeholders.
- User authorized committing and pushing all current changes on main.
- Verified package declarations, generator syntax, ZIP checksum/integrity, byte equality with dist, and clean diff formatting. Remote main matched local HEAD before the release commit. All release and submission changes are included in the authorized commit/push.
