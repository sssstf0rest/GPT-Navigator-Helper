# Conversation Navigator for ChatGPT

A local prompt outline with exact-target navigation, built as a Chrome Manifest V3 extension.

**Status: working compatibility prototype.** The built extension is tested against controlled virtualized conversations, including 500 user prompts. Current authenticated ChatGPT compatibility has not yet been verified. Full history depends on the payload ChatGPT exposes; the sidebar labels incomplete or unverified history explicitly. See `COMPATIBILITY.md` before treating this as a release.

The sidebar lists user prompts, filters their text, highlights the current prompt, and supports collapse and light/dark themes. Clicking a prompt tries an exact mounted identity and then a bounded virtualized search. A successful result requires that the intended prompt is visibly positioned in the conversation; repeated text alone never qualifies.

**Install locally**

Use Node.js 22.12 or newer. From this repository:

```sh
npm ci
npm run build
```

1. Open Chrome's Extensions page (`chrome://extensions`).
2. Enable Developer mode and select **Load unpacked**.
3. Select this repository's `dist` directory.
4. Open or reload a ChatGPT conversation. Reloading is required so the early capture hook observes the initial history request.
5. Look for **The outline** at the right. On narrow windows, use the **Outline** button to open it.

After rebuilding, reload the extension on the Extensions page, then reload the ChatGPT tab. A changed MAIN-world hook does not update in place through HMR. `npm run dev` is available for development, but the tested installation path is the production `dist` build.

No backend, API key, account registration, or extra extension permissions are required. The manifest matches only `https://chatgpt.com/*`. Prompt data stays in tab memory; this version has no persistent conversation cache, Chrome Sync, telemetry, or extension-initiated history requests. Existing ChatGPT requests still operate normally.

**What the coverage label means**

| Label/source | Meaning |
|---|---|
| Full branch / graph | The captured `mapping` contains an intact parent chain from the explicitly selected node to the root. This describes the captured snapshot. |
| Partial history / graph | Parent links are missing, or the page has changed since capture. |
| Partial history / flat | Flat history has been captured, potentially with cursor-linked older pages; full branch semantics remain unverified. |
| Partial history / DOM | Only prompts observed on the page are known. Unmounting does not erase them, but unseen history cannot be inferred. |

**Connection details** shows the capture status, source, coverage reason, mounted counts, and last jump result/timing. It contains no prompt text or conversation ID. The status line reports success, cancellation, ambiguity, missing history, or an unreachable target. No failure is presented as a successful jump.

**Development and checks**

```sh
npx playwright install chromium
npm run check
```

`npm run test` runs domain/bridge tests. `npm run test:e2e` builds the production extension and runs Playwright. Browser tests load the actual extension in a disposable persistent Chromium profile and intercept every ChatGPT request with local fixture responses. They do not use your Chrome profile or send prompts to ChatGPT. The local fixture server binds only to `127.0.0.1:4173`.

The production-build checker enforces zero permissions, ChatGPT-only content matches, no test hosts, and a directly bundled MAIN-world hook. Screenshots and synthetic jump timings are written to `output/playwright`; Playwright reports go to `playwright-report`. Generated output is ignored by Git.

The fixture server can be opened directly with `npm run fixture` for inspecting its layout. The production extension intentionally does not run on localhost; use the Playwright suite to exercise it with the controlled fixture.

**Code boundaries**

| Directory | Responsibility |
|---|---|
| `src/page` | Standalone early MAIN hook, bounded response capture, route generation, typed bridge |
| `src/conversation` | Graph/flat normalization, selected branch, completeness, observed prompt index |
| `src/navigation` | Mounted identities, scroll-container discovery, bounded cancellation-aware search, visibility verification |
| `src/content` | Lifecycle coordinator, observers, stale-route quarantine, current prompt tracking |
| `src/ui` | Text-only previews, search, status, diagnostics, Shadow DOM styles |
| `tests/fixture` | Independently known conversation timeline and controllable rendering behavior |

The initial strategy intentionally omits private React hooks and speculative authenticated API backfill. If the live site does not expose enough history through observed requests, the compatibility spike must resolve that before promising complete-history navigation. Editing inactive branches, extracting attachment contents, XHR-only capture, SSE-only branch updates, and persistent settings/history are not implemented in this prototype.

The design research and revised implementation brief are retained in `feasibility-and-development.md` and `revised-development-prompt.md`. The implementation is original; the linked projects were used as conceptual and payload-shape references.
