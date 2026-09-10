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

## Live failing-tab inspection (2026-09-08)
- User authorized their existing Chrome tabs; native CUA works after permission. Browser-runtime Chrome connection remains unavailable; these are separate capabilities.
- LLM Terms: history complete, 1 batch, 27 messages, 4 prompts, 0 native controls, 0 visible controls, 1470 × 802. VPN conversation: same except 89 messages. No request issue, no pending requests.
- UI is Chinese. English-only Prompt N detector may miss localization, but a screenshot of LLM Terms also shows no visible native rail.
- Four observed prompts may explain eligibility, but the native minimum and whether count is accurate remain unverified. Do not assert a threshold based on community reports.

- Downloaded observed public ChatGPT JavaScript URLs without credentials (HTTP 200). Source `conversation-small-owrec55n6vm0ekcc.js` function qva counts user turns and requires >=5, rejecting automation-authored user turns. Main component K7n calls this predicate as a mandatory rail render gate. This establishes a five-turn minimum for this captured build, replacing the earlier unverified six-prompt hypothesis.
- Native lazy module `5ff8b827-b1fkqq61n6dz49v3.js` uses hardcoded fallback Prompt N; Chinese UI alone does not establish a detection failure.
- Reproduced helper failure on LLM Terms. Manual scroll to the true first visible prompt leaves the native rail absent and captured metadata unchanged.

- FINAL live confirmation: both ChatGPT selected histories contain exactly 4 user turns; native turn predicate returns false; older cursor absent; no loading. Queried existing read-only selectors and predicate, independently of extension counters. Five-turn native gate explains both failures.
- Native width requirement in captured source is >=1024 CSS px plus hover; original full-width tabs were 1470px. Widen-window advice is not an appropriate diagnosis here.
- Complete report: output/native-investigation/live-failure-findings.md. No extension source changes; native always-visible capability is not achievable through loading alone.

## Automatic and seamless preparation investigation (2026-09-09)
- User independently confirms four-prompt chats are below the native threshold, and all tested >=5-prompt chats work. Requests research only for automatic and seamless behavior.
- Current hook is already MAIN document_start, with route handling; first-request expansion is disabled until manual Prepare. Automatic initialization can target that earlier request, subject to SPA navigation/prefetch timing.
- Host loader iya has no scroll-to-top precondition. Its normal caller is an IntersectionObserver on data-testid=conversation-pagination-sentinel. When passed the actual scroller it flushes the prepend synchronously and offsets scrollTop by the scrollHeight delta. This is source evidence for a no-travel path, not live proof of visual stability.

- Host pagination starter tXe rejects concurrent loads, missing cursor, missing oldest message, and errors unless explicitly retrying. Loader iya is NOT exported from the observed module, so dynamic-importing it is not a ready adapter solution.
- Host pagination sentinel is rendered separately before the virtualized turn list (K7n children include native rail, sentinel component, then turn list). This suggests a narrow DOM-only trigger may be possible: temporarily keep that sentinel inside its own scroll viewport while preserving its layout space. Need an isolated intersection/anchoring probe and live test before claiming success.
- Initial-request expansion preserves the host response contract and can avoid later pagination only if the backend honors enough turns to reach the real boundary. num_turns=100 is a requested batch size, not a guaranteed backend limit or whole-conversation guarantee.
- Full-history response aggregation would delay initial conversation rendering and duplicate host merge/pagination contracts; it is less attractive for seamless reading. The private include_full_conversation flow uses a different response shape, so adding that parameter to the existing paginated request is not an established drop-in fix.

- Isolated Chromium/Playwright CLI probe completed (not ChatGPT, no extension loaded): ordinary offscreen sentinel loaded zero pages; sticky sentinel with a suitable containing block loaded three pages with 0px maximum sampled visible-anchor drift and no travel toward the top.
- Negative controls matter: a sentinel constrained inside a 40px wrapper loaded zero pages; disabling browser scroll anchoring produced a 40px shift when the completed sentinel was removed. Therefore CSS triggering depends on actual DOM containment and host rendering/anchoring, and cannot yet be called universally seamless.
- Probe and raw results saved under output/playwright/seamless-investigation/. Its synchronous prepend compensation models the verified host loader only; React virtualization, delayed rich content, and live endpoint behavior remain untested.

## Seamless implementation evidence
- Initial twelve production-extension automatic cases passed: 220 prompts/three requests, per-frame anchor stability, structural marker labels, four-prompt status, server caps/large answers, stops/interruption, incompatible containment, unsafe anchoring, network/stalled cursors, layout drift, routes, and deep links.
- Pause race found in the manual regression setup: an asynchronous preference message could arrive after route change. Added an immediate document-level preference marker plus tab-wide message handling so the next synchronous host request respects Pause.
- Live Chrome currently has an open long conversation with one native pagination sentinel, a 42,244px containing block, 40px sentinel, normal browser scroll anchoring, no active-stream marker, and no native controls. This offers a bounded live mechanism check; no message contents are needed.

- Live single-page sentinel probe succeeded at full 1470px width: 1 native older-history request; maximum anchor drift 0px; 0 missing frames across 344 frames. scrollTop changed from 40,149 to 138,341 due to the host preserving the same visible message after prepending. Native controls remained absent because older history remained. Temporary styles and fetch observer were restored after six seconds. This validates one live mechanism invocation, not the full installed automatic extension lifecycle.
- Final 0.3.0 verification passed 18 unit and 36 real-extension fixture tests. Verified early batching, automatic history loading, per-frame anchor stability, cancellation/cleanup, pause across SPA routes, simulated visibility in both script worlds, streaming deferral, manual fallback, and exact page-budget boundary behavior. Live single-page mechanism evidence and remaining full-extension live trials are separated in COMPATIBILITY.md.

## Toolbar popup
- Chrome action.default_popup and tabs.query/sendMessage provide a popup for the active tab without extra permissions. The popup uses only tab IDs; no URL/title permission is required. Documentation: https://developer.chrome.com/docs/extensions/reference/api/action and https://developer.chrome.com/docs/extensions/reference/api/tabs.
- All injected helper DOM and styles are removed. A tab-owned snapshot service preserves preparation when the popup closes; a per-document token plus conversation/history key prevents stale commands after reload or navigation. Only this extension’s popup sender is accepted.
- Version 0.4.0 full check passed 18 unit/40 real-extension browser tests. Popup document tests use real Chrome runtime/tab messaging; native toolbar-menu opening itself remains a user trial step. The production package includes the action popup and adds zero permissions. The automatic early history hook is unchanged byte-for-byte from the user-confirmed 0.3.0 build.

## Automatic-only release
- Version 0.5.0 removes manual preparation/restoration, pause state, and popup commands. The popup displays GPT NAVIGATOR HELPER, a brief intro, visibility, observed prompt count, and an absence reason. At four or fewer prompts, the native minimum explanation requires complete error-free history; partial and unknown counts are not mistaken for short conversations.
- All 17 unit and 22 browser tests passed. Tests now focus on retained automatic behavior and read-only UI, including no buttons, legacy command rejection, unknown counts, three/four/five-prompt boundaries, active tabs, anchor stability, cancellation, errors, and limits. Light/dark minimal UI screenshots were inspected.

## Publication readiness — 2026-09-10
- Current 0.5.0 scope is suitably focused. No new manual controls, accounts, analytics, or backend are needed.
- Privacy policy URL and accurate dashboard disclosures are needed: ChatGPT response processing is user-data handling even when local. Describe transient processing, retained in-memory metadata, ChatGPT-only access, no developer transmission/storage/analytics, and Limited Use compliance. Official sources: https://developer.chrome.com/docs/webstore/program-policies/privacy and https://developer.chrome.com/docs/webstore/program-policies/user-data-faq.
- Product recommendation: bounded idle resumption after user interruption. Current pointer/keyboard/wheel/touch events abort preparation and retain the attempted context, so ordinary interaction can leave history incomplete until a new history load/reload. This is a usability gap, not a stated store requirement.
- Product recommendation: replace unsupported causal claims about absent native navigation with an honest unavailable/unknown explanation; the five-prompt threshold is observed host behavior, not an extension guarantee.
- Release verification should cover actual installed Chrome fresh install/update, SPA routes, foreground/background, 4/5/long conversations, streaming, unsupported layouts, and performance. The declared Chrome 111 minimum has not been established by current-version fixture tests.
- Existing evidence: recorded 17 unit/22 production-extension fixture tests and user-confirmed prior releases; do not equate this with a full measured live 0.5.0 compatibility matrix.
- Non-icon store assets: required 440x280 small promotional image and at least one 1280x800 or 640x400 screenshot. Existing small popup fixture images are not finished store assets. Source: https://developer.chrome.com/docs/webstore/images.
- Recommend accurate single-purpose listing, independent-product wording, support URL, dedicated demo conversation, and reviewer steps (test-instructions tab is optional: https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions).
- Current implementation remains uncommitted; final reviewed source/version and production ZIP should match before submission. No extension files changed in this assessment.

## Recovery design
- Resume only user/visibility interruption after 2.5 seconds of idle and compatible layout, at most three times per captured history context. Share the existing 60-second active-time and 20-page budgets across resumed attempts. Never retry network, cursor, layout-drift, incompatible-layout, or resource-limit failures automatically.
- DevTools MCP connects to a separate blank browser and lacks extension-install tools. The user's previously authorized computer-use connection can inspect the actual signed-in Chrome and extension UI instead.

- Release baseline: actual installed Google Chrome 152.0.7977.83 and bundled test Chromium 153.0.8010.12. Set the manifest minimum to 152 so the release does not advertise untested Chrome 111 support. This is a conservative support boundary, not evidence that older Chrome fails.

- 0.6.0 release source was already on origin/seamless-preparation (805501a); the missing deliverables were the 0.6.0 archive and updated user/compatibility documentation. User manual testing is explicitly recorded as 0.5.0 evidence.
