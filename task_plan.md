# Current work plan

## Repository cleanup
- [x] Switch to main and fast-forward to origin/main; verify it matches the merged branch.
- [x] Remove obsolete prototypes, old releases, generated captures, and duplicate generated artwork sources.
- [x] Keep the latest ZIP, final store images, icons, extension source/tests, privacy policy, and licenses.
- [x] Move compatibility notes into docs; update renamed repository links and main-branch references.
- [x] Verify build/tests, archive integrity, and remaining references (20 unit tests, build, archive byte equality, artwork checksums, README links).

No commit or push requested. Historical investigation details remain in Git history. Continue future work on main.

## Icon integration fix — 0.6.2
- [x] Declare supplied PNGs for both extension and toolbar icons.
- [x] Verify built icon paths, PNG sizes, and byte equality; create updated release ZIP.
- [x] Update release documentation. No commit/push requested.

## Icon padding — 0.6.3
- [x] Measure transparent margins and regenerate PNGs from the unchanged SVG master with size-specific padding.
- [x] Inspect output and verify production package; document and package 0.6.3.

## Publication reference and source release
- [x] Prepare docs/chrome-web-store-submission.txt with listing, privacy, assets, reviewer instructions, and publisher-owned placeholders.
- [x] Verify and prepare all current changes for the authorized commit/push on main.

## Missing-navigator positioning — 0.6.4
- [x] Align manifest, popup, README, policy purpose, submission text, and artwork copy with helping fix missing navigation caused by incomplete history.
- [x] Rebuild, regenerate and inspect artwork, verify package, and prepare the authorized commit/push.
