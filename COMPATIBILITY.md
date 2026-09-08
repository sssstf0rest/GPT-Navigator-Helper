# Compatibility evidence

This document records the boundary between verified behavior and work requiring a current ChatGPT session. The prototype is not yet approved for a public release.

**Verified locally**

The final full `npm run check` passed 14 unit tests and 20 browser tests (57.6 seconds for the browser suite), plus strict typechecking, the production build, and manifest/early-hook validation. A subsequent focused visual test passed after improving screenshot timing. These results are for the implemented prototype, not the full future product scope.

- Chrome MV3 production package, strict TypeScript build, CRXJS standalone MAIN script at `document_start`, and an isolated content runtime.
- Zero extension permissions; only `https://chatgpt.com/*` content-script matches. No backend, token storage, persistent prompt storage, telemetry, or extra conversation fetches.
- Passive interception of JSON responses to known same-origin conversation GET paths. The response returned to ChatGPT is not replaced or awaited by the parser.
- Bounded parsing: at most two concurrent readers, 16 MB per response, an eight-second capture budget, 10,000 normalized turns and 2 million text characters per bridge snapshot. Oversized/unsupported sources cannot be labeled complete.
- Full graph coverage only when the explicitly selected parent chain reaches an explicit root without missing nodes, duplicate message IDs, invalid messages, or cycles.
- Passive flat pagination merges only when its requested cursor matches the previous captured page and branch identity does not conflict. Cursor termination does not certify unverified flat branch semantics.
- DOM observations survive unmounts. New identified turns may extend an observed known tail, reducing coverage to partial until refreshed.
- Exact message IDs outrank container aliases. Multiple matches are ambiguous. Text-only similarity cannot produce success.
- Search is limited to 40 attempts and an eight-second deadline, with cancellation on user scroll intent, a new request, route changes, or a new captured branch revision.
- Final verification checks identity again after settling, connectedness, rendering visibility, leading-anchor geometry, viewport clipping, and hit-testing for occlusion. An oversized prompt does not need to fit entirely.
- Separate initial-load capture/handshake, nested `/g/.../c/...` routes, stale response rejection, old-mount quarantine, and same-URL branch replacement when an updated payload is observed.

These behaviors are covered by the automated fixture suite. The synthetic timeline includes 10/50/200/500 prompts, varying answer heights, repeated identical text, very tall answers, dynamic remounts, temporary empty windows, delayed height changes, partial/flat/graph sources, rapid jumps, route transitions, branch changes, invisible targets, and malformed bridge packets.

The test runner uses Playwright's bundled Chromium 153 in a disposable profile. Requests to the ChatGPT origin are fulfilled by a local synthetic server; no authenticated production conversation is involved. Browser screenshots are explicitly labeled as fixture content. Timing measurements in `output/playwright/jump-metrics.json` are synthetic measurements, not production latency claims.

**Live gate still open**

The connected DevTools browser had only `about:blank`, and no connected ChatGPT browser tab was present. A long conversation URL was requested during implementation; no authenticated conversation was inspected in this implementation session.

Before expanding the compatibility claim, use a user-selected long conversation to record these observations locally:

| Check | Required evidence |
|---|---|
| Cold-load history | Capture reaches the selected branch's oldest prompt; record source shape and completeness evidence without retaining private bodies |
| Rendering mode | Distinguish fully mounted content, placeholders/render skipping, unmounted virtualization, and host pagination |
| DOM identity | Confirm role attributes, explicit message IDs versus graph node/container IDs, actual scroll ancestor, header/composer clipping |
| Historical jumps | Bottom→first, first→last, several distant repeated-text prompts, and long answers verified by exact identity plus visible prompt |
| SPA lifecycle | Conversation switch mid-jump, nested route, new chat ID assignment, same-URL edited branch, and a late prior response |
| Live changes | New prompts and streaming updates; determine when JSON snapshots refresh and when only DOM/SSE changes occur |
| Layout | Narrow window, dark theme, zoom, and coexistence with ChatGPT's own sidebar/tools |

The page's ordinary data transmission to ChatGPT is unchanged. The compatibility inspection should not send new prompts, export conversations, or persist credentials. Diagnostics can be read through the sidebar's Connection details.

**Known limitations and deliberate scope**

1. Passive capture cannot recover an already-completed request or history the host never requests. Reload the conversation after loading the extension. Flat history remains explicitly partial pending live validation.
2. API paths and role/ID attributes are undocumented compatibility assumptions. Unknown payload shapes or removed selectors need adapter updates. A successful synthetic fixture is not evidence that current ChatGPT uses those shapes.
3. Only fetch-based JSON history capture is implemented. No XHR interception, private React scanning, native prompt-menu integration, SSE parser, active pagination, or request rewriting is shipped.
4. Branch changes that produce no captured history response cannot be reconstructed reliably. The index may remain a partial prior snapshot and asks for reload; exact target verification prevents claiming an unavailable prompt was reached.
5. DOM-only history has partial ordering evidence, especially after visiting disjoint windows. It does not establish a complete chronological timeline. Provisional identities apply only to the current mounted content and cannot identify a remounted repeated prompt.
6. Current highlighting depends on mapped mounted message elements. When the viewport contains only an unmapped answer region, it may show no active prompt instead of guessing.
7. The page hook lives with the document. After changing, disabling, or reloading the extension, reload the tab to replace/remove that hook. Collapse and search settings are per-tab and reset on reload.
8. A fixed in-page panel can overlap host content on some layouts. It begins collapsed below 1100 pixels. The actual layout threshold and any reserved-page-space strategy need live checks.

Next milestone: run this unpacked package against the selected live conversation, then choose whether an additional source adapter is necessary. Do not enable speculative backfill or mark flat pages complete solely to make the label look successful.
