# Seamless preparation compatibility evidence

Version 0.3.0, branch `seamless-preparation`. This document separates local extension tests, observed live behavior, and remaining live validation.

## Live evidence

The user confirmed their four-prompt conversations lack the native navigator, while tested conversations with at least five prompts work. Read-only inspection of two provided conversations agreed: four user turns, no older-history cursor, and a false native eligibility predicate. Captured public client source requires at least five eligible user turns plus history, layout, and mode gates.

A bounded single-page probe in an existing long ChatGPT conversation exercised the same scoped sticky-sentinel mechanism used by the new automatic loader. With the normal 1470px-wide viewport, it triggered **one native older-history request**, recording **0px maximum visible-message anchor drift**, **0 missing frames**, and **344 sampled animation frames**. The scroll offset increased from 40,149 to 138,341 because the host prepended history while keeping the same message in view. Native controls remained absent because more history remained. The temporary styles and request observer were restored after six seconds; DevTools was closed afterward. No prompts were submitted or conversation shared.

This establishes one live invocation of the loading mechanism. It does **not** establish a complete multi-page run of the installed 0.3.0 extension, cold-start batch handling on all accounts, every layout, or successful native jumps in every conversation. Those remain live trial checks.

The captured source uses `data-testid="conversation-pagination-sentinel"` with an IntersectionObserver rooted in the conversation scroller and an 80px upper margin. Its loader compensates the scroll position after a synchronous prepend. Native buttons retain `data-toc-item-index` and `data-toc-active` when their labels become prompt text. These are observed implementation details, not public supported extension APIs.

## Production-extension fixture validation

The test runner loads the built extension into disposable Chromium and serves synthetic ChatGPT-origin responses from the local fixture. The fixture starts with a limited newest-history window, actually fetches older pages, prepends through its own loader, compensates the host reading anchor, and virtualizes mounted messages. Its native rail requires completed history and five prompts. The fixture’s observer dependencies match the captured host cursor/enabled/error behavior; it does not recreate the observer merely because a request ended.

Covered automatic behavior includes:

- An early 100-turn initial request followed by two expanded older requests for 220 prompts, with per-frame anchor sampling, no travel to the top, and fixture-native first/middle/last navigation.
- A complete first response, server caps, huge answers, native labels containing prompt text, and the four-prompt minimum.
- Immediate Stop, wheel interruption, Pause/Resume across routes, and scoped temporary-style cleanup after in-flight requests.
- Simulated visible/hidden lifecycle handling in both MAIN and ISOLATED script worlds, streaming deferral, responsive native visibility, stale route responses, and message deep links.
- Incompatible sentinel containment, disabled anchoring, changed reading geometry, failed requests, repeated cursors, bounded paging, and explicit manual fallback.

The preserved manual suite covers long conversations, anchor restoration, delayed loading, Stop and return, interaction, nested routes, same-URL replacement, unknown payloads, transient recovery, hidden/disappearing native controls, keyboard access, and light/dark UI. Unit tests cover request scoping/options, capture identities, graph ancestry, linked pagination, malformed bridge states, and controller state changes during native waits.

The final `npm run check` passed **18 unit tests and 36 production-extension browser tests**, plus strict TypeScript, production build, and manifest/standalone-hook verification. The browser suite completed in 2.4 minutes. Fixture-native clicks establish behavior of the fixture, not ChatGPT’s own navigation code.

## Completeness and boundaries

- Flat history is complete only after a recognized initial page and cursor-linked older pages end with explicit `has_previous_page=false`, without conflicting branch metadata. Graph history must reach an explicit root through an intact selected parent chain. Unknown structures remain unknown.
- Automatic initial expansion applies only to a validated current-conversation plural `/backend-api/conversations/:id` GET. Prefetched requests issued before the route changes may be missed; cached navigation without a new captured initial response remains unverified. Deep links and targeted initial windows are skipped.
- Automatic pagination requires the known sentinel inside the actual scroll area, compatible containment, a visible tab, a desktop hover layout at least 1024px wide, and stable anchoring without detected streaming. Unsupported layouts stop or defer; there is no automatic scroll fallback.
- Temporary inline sentinel properties are restored on request start, cancellation, route change, failure, timeout, and completion. Other inline styles are preserved. The extension does not rewrite the host history store or render another navigator.
- The reading guard stops further paging above 8px of sampled message-anchor drift or after several missing-anchor frames. It cannot undo shifts, delayed image/math reflow, or a response already in flight. Manual restoration can also fail explicitly under changing content or virtualizer behavior.
- Automatic runs allow 60 seconds and at most 20 additional captured pages; each triggered page gets at most 12 seconds to progress. A final permitted page can still report completion. Manual runs allow three minutes, 80 pages, and 160 edge steps. Capture permits two readers, 16 MB/eight seconds per clone, and 10,000 identities.
- Pause is per tab and survives SPA conversation changes, but reload resets automatic mode to enabled. It cannot retract a first batch already issued. Temporary expansion during an active run has a renewable ten-second lease.
- Interaction ends the current automatic attempt. It does not automatically retry on the same unchanged history context. A new conversation/history load or Pause/Resume can start another attempt. Backgrounding cancels active work and permits a recheck on foregrounding.
- There is no XHR or SSE interception. Same-URL branch edits without a captured replacement initial request or user interaction may not be identifiable. A native history error may require ChatGPT’s own retry control or a reload before manual loading can work again.
- Initial expansion may delay the first render, increase memory/bandwidth, or be capped by the server. Complete captured history does not bypass native minimum-turn, account, mode, responsive, or feature gates, and visible controls do not prove all native jumps work.

## Remaining live trial

After loading the unpacked 0.3.0 folder and reloading ChatGPT:

1. Open a long conversation from both a fresh page load and the sidebar. Check whether preparation begins automatically and the message being read stays still.
2. Verify the true oldest prompt is reachable using the native rail, then try a middle and newest prompt.
3. Stop during a request, type or scroll, and verify no later automatic page is triggered for that run.
4. Pause, switch conversations, resume, and switch tabs while loading. Confirm expected lifecycle behavior.
5. Compare a four-prompt conversation, a supported long desktop conversation, and a narrow/streaming view. Record the helper’s status and compatibility details if it stops.

Keep these observations separate from local passing tests. No new prompts or shared links are needed to run this trial.
