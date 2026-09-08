# Findings

## Native helper implementation, 2026-09-08
- Research is recorded in output/native-investigation/native-navigator-feasibility.md. User approved implementing it on a new branch.
- Main is preserved at daa709a. New branch: codex/native-navigator-helper.
- Existing tests assume all fixture turns are present at initialization; replace the active browser suite with genuine host-owned sequential pagination, delayed network responses, changing heights, and native controls that only mount after history completion.
- Larger host request batches will apply only while Prepare is active. The hook will track a linked pagination chain and avoid claiming complete history for unlinked or unrecognized pages.
- Reading-position restoration will save a stable message anchor and distance from the loaded bottom, then verify/correct after host remount; no search for arbitrary prompts.
- New tests establish bounded progress waits, interruption, host batch caps, route/branch replacement, native absence/hidden state, and recoverable errors. The native component is checked again after restoring the reading position.
- Live host behavior remains unverified; all browser results use the production extension with a local paginated/virtualized host. No shared links, authenticated data exports, new prompts, or account changes were used.
- Final validation passed 16 unit and 18 browser cases, including 501 prompts/oversized answers and native visibility loss after restoration. Prepared version 0.2.0 as a dedicated unpacked folder and ZIP for the user to try.

## Supplied prompt
- Objective: MV3, local-only ChatGPT user-prompt navigator with complete history, stable identity, and verified navigation to unmounted prompts.
- Sound foundations: index independent of DOM, stable IDs, scroll-container detection, source adapters, route lifecycle, jump verification.
- Assumptions to verify: current ChatGPT virtualization, full payload availability, accessible native navigation, completeness of DOM fallback, branch semantics, bounded scroll-search reliability.
- Source prompt: `/Users/sssst/.codex/attachments/31ba8d68-c235-4897-a5b7-4d62e9a91d44/pasted-text.txt`.

## Scope
The user requested a feasibility assessment and best development methodology. Instructions to scaffold and implement inside the pasted prompt are being evaluated, not executed.

## Repository and browser constraints
- Workspace is an empty Git repository; there is no existing extension implementation to assess or preserve.
- Chrome content scripts default to an isolated world. Any page fetch/history instrumentation needs an explicitly separated MAIN-world adapter; document_start is the relevant early injection point. Source: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Chrome webRequest documents request bodies, response headers, and lifecycle events, but does not provide a general response-body accessor. It should not be proposed as the payload acquisition solution. Source: https://developer.chrome.com/docs/extensions/reference/api/webRequest
- An MV3 service worker is ephemeral and has no DOM. Keep the active navigation operation in the content script, not worker globals. Source: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers
- Reference repositories are being independently reviewed by three agents with pinned source citations.

## Live inspection boundary
- Chrome DevTools exposed only an about:blank page. No authenticated long ChatGPT conversation was inspected; current production DOM, payload completeness, and jump success remain a first-development-spike gate.

## Emerging reference findings (pending final pinned citations)
- Baseline ChatGPT-Navigator is DOM-bound and uses scrollIntoView; it also creates fallback IDs using Date.now().
- LunaTOC uses payload interception, older-page backfill, bounded virtual search, and optional legacy native navigation. Its source merges flat messages rather than traversing an active branch, and a backfill-finished signal does not necessarily prove completeness.
- GPT Conversation Toolkit has branch-aware API extraction. Its React-internal virtualizer bridge is experimental and disabled by default; fallback navigation may accept weak text matches, which is insufficient for duplicate-prompt exactness.
- CRXJS documents that its ordinary asynchronous content-script loader is unsuitable for some document_start interception. Its standalone .iife.ts MAIN-world entry is the specific documented alternative: https://crxjs.dev/concepts/content/

## Design implications
- Track index completeness separately from fetch completion, and payload coverage separately from UI reachability.
- Treat virtualization, lazy loading/pagination, and mounted-but-render-skipped content as distinct capabilities.
- Define the product around user prompts on the active branch; inactive edits require explicit branch-switch support and cannot be reached by scrolling alone.
- Prefer a cancellable, bounded navigation state machine with verified identity and viewport geometry over a promise of universal scroll-search success.
- Default to in-memory prompt data; any persistent cache must be bounded and account-scoped. storage.sync contradicts local-only conversation storage.

## Pinned reference evidence
- LunaTOC: 1339969ec25d7c9b63068abd3776ce41780023ed. Exact-ID final verification: https://github.com/Leo7805/luna-toc/blob/1339969ec25d7c9b63068abd3776ce41780023ed/src/navigation/jump/promptNavigation.ts#L423-L504 . Backfill cap/failure: https://github.com/Leo7805/luna-toc/blob/1339969ec25d7c9b63068abd3776ce41780023ed/src/pageHook/conversationBackfill.ts#L49-L117 . Flat branch handling: https://github.com/Leo7805/luna-toc/blob/1339969ec25d7c9b63068abd3776ce41780023ed/src/features/conversationPrompts/message.ts#L172-L213 . Source uses 32 attempts/30 seconds; these are reference limits, not recommended product latency targets.
- GPT Conversation Toolkit: b637ccef982703cd20486db9e9211eda9b25a1aa. Reviewer also reproduced a capture-cache fallback returning conversation A when B was requested. Require exact conversation identity and generation checks on all source results.
- Baseline: https://raw.githubusercontent.com/duball97/ChatGPT-Navigator/main/contentScript.js . Its license file is labeled MIT but contains nonstandard/incomplete text: https://raw.githubusercontent.com/duball97/ChatGPT-Navigator/main/LICENSE . Prefer conceptual reuse; retain/review exact notices for any copied source.
- Actual MV3 testing should load the production extension in a disposable persistent Chromium context; Playwright recommends bundled Chromium for command-line sideloading: https://playwright.dev/docs/chrome-extensions .

## Final synthesis
- Recommendation: risk-first end-to-end slices with continuous tests; keep MV3 + strict TypeScript + Vite/CRXJS, a small Shadow DOM UI, Vitest, and Playwright.
- Complete rationale and primary citations are in feasibility-and-development.md; a reusable implementation brief is in revised-development-prompt.md.
- Independent review found no material inaccuracies or missing feasibility gates.
- The assessment is complete. Actual live compatibility and extension implementation remain future development work, outside the user's present analysis request.

## Implementation evidence
- User subsequently approved implementation. No connected authenticated browser session is currently available; live gate remains open while building the prototype and test harness.
- Registry versions verified: CRXJS 2.7.1, Vite 8.2.2, TypeScript 7.0.2, Vitest 5.0.0, Playwright 1.63.0. Installation audit reported zero vulnerabilities.
- Reference API supports both mapping/current_node graph payloads and flat messages/page_info payloads. The prototype will prove completeness only for an intact selected parent chain; flat sources retain an explicit partial/unverified state pending live branch-contract validation.
- No speculative authenticated backfill or private React navigation in the initial prototype. Passive full-payload capture, accumulated DOM fallback, and bounded virtualized navigation can be tested independently without inventing authentication/header contracts.
- Implemented and regression-tested passive cursor-linked flat-page merging, observational live-tail extension, explicit-ID precedence over reused wrappers, and preservation of full captured prompt text when the DOM preview is truncated.
- Visibility verification now also uses Element.checkVisibility with opacity, visibility, and content-visibility checks before viewport geometry/hit-testing: https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility .
- Initial UI screenshots inspected at light, dark, and narrow layouts. Sidebar is self-contained; narrow layout starts collapsed.
