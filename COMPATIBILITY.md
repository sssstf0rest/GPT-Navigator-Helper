# Native helper compatibility evidence

This document describes the native-helper branch, version 0.2.0. It supersedes the compatibility claims for the custom outline on main.

**Implementation and evidence**

The final `npm run check` passed **16 unit tests and 18 production-extension browser tests**, plus strict TypeScript, the production build, and manifest/standalone-hook verification. The final browser run completed in approximately 1.2 minutes. This includes an unresponsive history edge, recovery after transient errors, a 501-prompt conversation with an oversized answer, and native controls disappearing after restoration.

The browser suite uses the bundled Chromium in a disposable profile and fulfills ChatGPT-origin requests through a local synthetic server. No authenticated ChatGPT conversation was used. A long live conversation URL was requested during this implementation; live compatibility remains unverified.

The fixture starts with only the newest six prompts and supplies no hidden full timeline to its renderer. Older data arrives through delayed host-owned requests, changes the available scroll range, and is prepended with host anchor adjustment. The renderer keeps only a window of messages mounted. This directly exercises the missing-history condition omitted from the original custom navigator's fixture.

Covered behavior:

- Initial passive metadata capture and content-script handshake, including initial history requested before body execution.
- Acknowledgement before the first expanded request; no expansion or automatic preparation on a fresh load; batch expansion disabled after completion/cancellation.
- Loading a 220-prompt conversation from six initially loaded prompts; servers honoring or ignoring larger batch sizes.
- Restoration within an oversized answer in a 501-prompt conversation, and final rejection of a native component that disappears after returning.
- Exact reading-anchor/offset restoration after loading; native first/middle/last clicks reaching the intended mounted message with viewport/hit-test checks.
- Delayed requests without repeated scroll probes; wheel interruption and explicit Stop and return while a request is in flight.
- Nested SPA routes, late previous-route responses, and same-URL replacement through a new initial history request.
- Repeated cursors, failed requests, unknown response shapes, complete history without native controls, and hidden native controls on narrow layouts.
- Keyboard operation, minimization, light/dark rendering, strict request scoping, request option preservation, payload identity checks, graph ancestry, and malformed bridge state.

A successful fixture-native jump validates integration with that fixture. It does not establish that ChatGPT's current native implementation has the same behavior.

**Meaning of completeness**

For known flat responses, `History loaded` requires a captured initial page followed by cursor-linked older pages, without conflicting branch metadata, terminating with an explicit `has_previous_page=false`. This relies on the host's response contract; it is not an independent audit of the server's full conversation graph. An unlinked terminal page cannot certify completion.

For graph responses, the selected node's parent chain must reach an explicit root without invalid messages, duplicate identities, missing nodes, or cycles. Unknown structures remain unknown. A visible native component can be reported separately from verified history completeness.

The helper rechecks native visibility after restoring the reading position. It reports visibility, not a guarantee that every live native entry will navigate successfully.

**Known boundaries**

1. Current native detection recognizes English `Prompt N` accessibility labels/descriptions. A different language or host selector can produce “not detected” even when another form of navigator exists. No account feature flag or private mounting condition is overridden.
2. Conversation history paths, response fields, message attributes, and scroll behavior are host compatibility assumptions. The implementation recognizes same-origin GET `/backend-api/conversation(s)/:id` and `/backend-api/conversation(s)/:id/messages?before=...`, scoped to the open `/c/:id` or nested conversation route.
3. The helper relies on ChatGPT's own scroll-triggered loading. It does not fetch hidden pages into a separate cache or mutate the host's React store. If the site requires another loading trigger, the run stops without guessing.
4. There is no XHR/SSE interception. Branch changes without a captured initial request, route change, or user interaction may not be identifiable. Do not use a trial run as evidence of support for every edited/regenerated branch.
5. Restoration uses a stable message identity plus an offset, seeded by distance from the loaded bottom. After concurrent content changes or a different virtualizer strategy, the anchor may not remount as expected. Corrections are limited, and failure is explicit.
6. An already-issued ChatGPT request is allowed to finish after cancellation. The helper stops making scroll moves and disables request expansion; the host itself may still adjust layout when that response arrives.
7. Limits are three minutes, 80 added pages, 160 edge steps, a 12-second progress deadline, two clone readers, 16 MB/eight seconds per clone, and 10,000 retained message identities. These are bounds, not promises of complete arbitrarily long history.
8. The lower-left helper can overlap host content in narrow layouts; it can be minimized. It does not reserve space in the ChatGPT layout. It detects the previous custom outline and asks for that extension to be disabled before preparing.
9. Initial history requests remain unchanged. Larger batches are requested only during an explicit active Prepare operation; the server may ignore or cap them. A ten-second renewable lease limits a lost content script's request override.
10. Native navigation can still have its own bugs. Appearance alone does not demonstrate usable historical jumps.

**Live trial checklist**

Use a user-selected existing conversation with the previous extension disabled, then reload after installing this build. Do not submit new prompts or publish/share the conversation for the test.

| Step | Evidence to record |
|---|---|
| Initial state | Native component existence/visibility, known missing early prompt, viewport/zoom, metadata status |
| Prepare | Actual earlier requests and progress, whether batches are enlarged, whether the genuine beginning is reached |
| Return | The same message and reading offset restored, or an explicit restoration failure |
| Native use | Oldest, middle, and newest native entries reach the correct messages without sustained twitching |
| Lifecycle | Repeat after reloading and switching conversations; stop while a request is pending |
| Layout | Vary width independently of loaded history to distinguish responsive hiding from missing data |

If history is loaded but the native component remains unavailable or its own jumps remain unstable, report that outcome before adding more invasive mechanisms. Keep unknown live behavior separate from the passing local tests.
