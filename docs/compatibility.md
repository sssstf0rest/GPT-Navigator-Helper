# GPT Navigator Helper compatibility

Version 0.6.1, branch `main`.

## Current scope

The extension is automatic-only. Manual history scrolling/restoration, pause state, popup commands, and their retired tests have been removed. The popup contains the product name, intro, native visibility, observed prompt count, and a short absence explanation. No helper DOM is injected into ChatGPT.

The popup declares `action.default_popup` and uses `chrome.tabs.query` plus `sendMessage` to read the active tab’s top-frame state. It needs no additional permissions, reads no sensitive tab fields, accepts no mutation commands, and stops polling when closed. Tab-owned preparation continues independently. The old manual, stop, and toggle-automatic messages are ignored.

Chrome API references: [action popup](https://developer.chrome.com/docs/extensions/reference/api/action), [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).

## Native minimum

The captured ChatGPT client and the user’s live tests agree on a five-user-turn minimum. Two previously inspected four-prompt conversations had complete history and failed the host’s native eligibility predicate. The user subsequently confirmed the 0.3.0 seamless loader and 0.4.0 popup work well.

The 0.6.0 popup explains the minimum only when captured history is complete, no request is pending, no capture issue exists, and fewer than five prompts are observed. Unknown or partially loaded history does not establish that a conversation is too short. The panel displays an unknown count as an em dash. At five or more prompts, absent navigation can still depend on layout, conversation mode, or other host conditions. Actual visible controls take precedence over an inferred absence reason.

## Validation

Version 0.6.0 passed **20 unit tests and 25 production-extension browser cases** across a full 24-case run and a sequential two-case targeted run (one expanded existing case and one additional case). Strict TypeScript, build, and manifest/popup checks passed. Recovery coverage includes continued interaction, retry exhaustion, shared page/active-time budgets, streaming deferral, and foreground recovery.

The release requires Chrome 152 or newer. Live inspection used Google Chrome 152.0.7977.83 on macOS; fixtures used Chromium 153.0.8010.12. This minimum is a conservative support boundary, not evidence that older Chrome versions fail.

The production-extension browser suite tests initial batching, real older-page requests, server caps, large answers, native first/middle/last navigation, per-frame anchor stability, typing/wheel interruption, scoped style cleanup, failed/repeated cursors, incompatible layouts, streaming deferral, routes, message deep links, and page limits.

Popup cases cover closing/reopening during loading, active-tab switches, unsupported tabs, the absence of buttons and diagnostics, rejection of obsolete commands, short-conversation explanations, five-prompt visibility, unknown capture, and light/dark rendering. Unit tests cover metadata/history continuity, request scoping, bridge validation, and the short-history explanation boundary.

The tests use disposable Chromium, the real extension, and a local synthetic ChatGPT-origin fixture. The popup document uses real extension messaging, but the suite does not operate Chrome’s native Extensions menu. Visibility is simulated in both MAIN and ISOLATED script worlds because Playwright keeps test pages visible.

Earlier live evidence includes a bounded native pagination-sentinel test: one older page loaded with 0px maximum visible-message drift and no missing anchor across 344 frames. This supports the mechanism in that conversation, not a universal guarantee of stable layout or working native jumps. Live 0.6.0 checks verified an in-place extension update, Chrome’s actual Extensions-menu popup, reload guidance on an existing tab, and correct one/four-prompt status after loading. The user reports completing the broader manual checklist on 0.5.0. Live long-conversation recovery, fresh installation, browser Back/Forward, streaming, and other operating systems remain unverified for 0.6.0; the user elected to perform the remaining manual checks. No live CPU/memory or loading-delay measurements were completed.

## Boundaries

- Recognized flat history must form a cursor-linked chain from its initial page to explicit completion. Graph history must reach an explicit root through an intact selected parent chain. Unknown payloads remain unknown.
- Early expansion applies to recognized current-conversation initial requests. Prefetched/cached navigation without a captured initial response may remain unverified. Targeted message windows and deep links are preserved.
- Native pagination relies on the known sentinel inside a compatible scroll area. The loader waits for a visible desktop hover layout at least 1024px wide with stable anchoring and no detected streaming. It stops or defers on unsupported conditions and never falls back to manual scrolling.
- Scoped sentinel styles are restored on request start, cancellation, route change, errors, timeout, and completion. Already-issued host requests may finish after interruption. The 8px anchor guard cannot undo an existing layout shift or late rich-content reflow.
- Each captured history context shares 60 seconds of active preparation and 20 additional captured pages across its attempts, with a 12-second progress deadline for each triggered page. Capture allows two readers, 16 MB/eight seconds per clone, and 10,000 identities. The final permitted page may still complete successfully.
- User interaction immediately ends the current attempt. Preparation can resume after at least 2.5 seconds of idle and a ready visible layout; backgrounding also permits recovery on return. At most three resumptions are allowed, with shared time/page budgets. Fresh conversation/history loading resets the context. Network, stalled-cursor, unsafe-layout, and resource-limit failures do not automatically retry. There is no hidden manual or pause mode.
- There is no XHR/SSE interception or private state mutation. Some branch changes without a captured initial request may not be identifiable. Host changes can invalidate selectors, payload assumptions, or eligibility rules.
- Larger batches may delay first rendering, use more memory/bandwidth, or be capped. Visible native controls do not guarantee every ChatGPT-native jump succeeds.

## Live trial

After loading 0.6.0 and reloading ChatGPT, open the extension from Chrome’s Extensions menu. Confirm the panel has only the requested information, compare three/four/five-prompt conversations, and verify the oldest native entry in a long chat. Closing the popup should leave automatic loading running; typing or scrolling should return control to the reader. After an interruption, stop interacting and verify automatic resumption without moving the reading position. If retry or loading limits are exhausted, reload to retry. No new prompts or shared links are required.

## 0.6.1 visual verification

Production typecheck/build and all six existing popup browser tests passed. Light, dark, and short-history renders were visually inspected. The automatic content bundle, early MAIN hook, and shared status logic are byte-identical to the 0.6.0 release. The popup font and its SIL OFL license are bundled locally. No additional live browser testing was performed; earlier live evidence remains scoped to its recorded versions.
