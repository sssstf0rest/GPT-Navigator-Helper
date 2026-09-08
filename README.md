# Native Navigator Helper for ChatGPT

A Chrome extension that prepares the current conversation's history for ChatGPT's built-in prompt navigator. This branch replaces the custom outline and jump engine with a small manual helper.

**Status: experimental trial build, version 0.2.0.** Local browser tests exercise the production extension against genuinely paginated, virtualized conversations. An authenticated live ChatGPT conversation has not yet been verified. This is a package to try, not a claim that every ChatGPT account or layout is supported.

**Try it**

1. Disable the previous **Conversation Navigator for ChatGPT** extension. Reload open ChatGPT tabs to remove its existing page hook and outline.
2. If using the trial ZIP, extract it. In Chrome's Extensions page (`chrome://extensions`), enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
3. Open or reload a long ChatGPT conversation. Reloading lets the early page hook observe the initial history request. Start with a wide browser window.
4. In the lower-left helper, click **Prepare navigation**. The conversation will move while older history loads; the helper then tries to return to the message you were reading.
5. Use ChatGPT's own prompt markers on the right. Try its first, middle, and last entries to check the live result. The helper does not click those controls or implement its own prompt jumps.

**Stop and return** stops preparation and attempts to restore the original reading position. Scrolling, touching, clicking elsewhere in the page, or pressing a scroll key stops the helper immediately and leaves control with you. Use the minus button to minimize the helper.

If the old outline is still present, preparation is disabled with a reminder to disable that extension. After rebuilding, reloading, or disabling this helper, reload the ChatGPT tab too: a MAIN-world page hook lives until its document is replaced.

**What it does**

- Observes metadata from ChatGPT's own JSON history requests: message identities, counts, cursor continuity, and reported history boundaries. It does not retain message text or build another prompt index.
- While an explicit Prepare operation is active, requests at least `num_turns=100` on matching host-owned initial/older-history requests. Existing larger requests are preserved. ChatGPT receives its own response normally; the helper inspects a bounded clone.
- Moves to the currently loaded history edge once per observed change, waiting for network/rendering progress before proceeding. It performs no alternating pixel search.
- Saves a message anchor and relative position, then verifies restoration after history is prepended and messages remount.
- Detects native buttons with the known `Prompt N` accessibility labels and distinguishes visible controls, hidden controls, and no detected component.
- Stops on user interruption, conversation replacement, failed requests, repeated cursors, lack of progress, or resource limits.

Automatic preparation on opening a chat is intentionally deferred. Initial requests are unchanged until you click Prepare. No CSS visibility override, global viewport spoof, private React modification, extension-owned history fetch, or fabricated pagination flag is used.

**Understand the result**

| Result | Meaning |
|---|---|
| History loaded; native navigator visible | A captured graph reached its explicit root, or a linked pagination chain ended according to the host response; native controls are visible after restoration. Live native jump behavior still needs checking. |
| Native navigator visible; full history unconfirmed | The controls exist, but the history metadata was unavailable or unrecognized. |
| History loaded; native navigator hidden/not detected | Loading completed according to captured metadata, but the known controls are hidden or absent. Try a wider window or lower zoom if hidden. The host may use a different implementation. |
| Stopped / limit reached | Further progress was not confirmed. No complete-history or navigation-success claim is made. |

**Compatibility details** contains counts, loading state, native-control detection, viewport size, and an issue category. It excludes conversation IDs, prompt text, and request headers. These details and the final status are useful when reporting a trial result.

History preparation is bounded to three minutes, 80 additional captured pages, and 160 edge steps per run, with a 12-second progress wait. Metadata capture permits at most two simultaneous readers, 16 MB per response, eight seconds per clone, and 10,000 message identities. A manual retry can recover from a transient request failure or stalled page; an unlinked/unknown history chain may require a reload.

**Data handling**

The extension runs only on `https://chatgpt.com/*` and requests no additional extension permissions. It has no backend, API key, persistent conversation storage, analytics, or token extraction. Conversation response bodies are parsed transiently to extract metadata; only identities and counts remain in tab memory. ChatGPT continues making its own authenticated requests, with larger batches temporarily requested during preparation. Larger batches may use more memory and bandwidth, and the server may cap or ignore the parameter.

**Build and test**

Use Node.js 22.12 or newer:

```sh
npm ci
npm run build
```

For a source build, load the generated `dist` folder as the unpacked extension.

```sh
npx playwright install chromium
npm run check
```

The existing Playwright test runner loads the real production extension in a disposable Chromium profile. Every ChatGPT-origin request in the tests is served by the local fixture on `127.0.0.1:4173`; your Chrome profile and live conversations are not used. The fixture initially provides six prompts, fetches older pages only when its own history-loading flow runs, grows its scroll range as pages arrive, preserves a host reading anchor, and renders only a window of loaded messages. Native controls appear only after its history boundary is reached.

Screenshots are saved under `output/playwright`, with fixture content clearly labeled. Build verification enforces ChatGPT-only matches, zero permissions, a standalone early MAIN hook, and exclusion of the old navigator. See `COMPATIBILITY.md` for the evidence boundary and live checklist.

**Implementation map**

| File | Responsibility |
|---|---|
| `src/native/pageHook.iife.ts` | Early fetch observation, temporary request expansion, route isolation, metadata bridge |
| `src/native/historyMetadata.ts` | Text-free summaries and conservative pagination continuity |
| `src/native/prepare.ts` | Bounded, cancellable preparation state machine |
| `src/native/dom.ts` | Native detection, scroll ancestor, reading anchor and restoration |
| `src/native/content.ts` | Lifecycle, bridge acknowledgement, user interruption and status |
| `src/native/ui.ts`, `helper.css` | Compact Shadow DOM helper with light/dark themes |
| `tests/native-*` | Metadata/controller tests, paginated host fixture, production-extension browser tests |

The original custom navigator remains in Git history and on `main` at `daa709a`. This implementation is on `codex/native-navigator-helper`. Earlier feasibility documents describe the previous design and are retained as historical research.
