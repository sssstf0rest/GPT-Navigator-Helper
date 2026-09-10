# GPT Navigator Helper

Automatically loads conversation history so ChatGPT’s built-in navigator can appear, while preserving your reading position.

**Version 0.6.0 · branch `seamless-preparation`.** The extension is entirely automatic. Its read-only Chrome popup shows:

- **GPT NAVIGATOR HELPER** and a brief introduction.
- Whether the native navigator is visible.
- How many prompts have been observed.
- A brief explanation when the navigator is absent.

There are no manual preparation, pause, resume, or stop buttons, and no extension window on the ChatGPT page. Closing the popup does not stop preparation.

## Install

Requires **Chrome 152 or newer**. This is the tested release baseline; older Chrome versions have not been verified.

1. Extract `output/releases/gpt-navigator-helper-0.6.0.zip`.
2. In `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. Disable older copies of this extension.
3. Reload ChatGPT tabs, then open a conversation in a wide desktop window. Preparation begins automatically when the page is ready and idle.
4. To view status, click Chrome’s **Extensions** button and choose **GPT Navigator Helper**. You can pin it to the toolbar for direct access.
5. Navigate using ChatGPT’s own prompt markers on the right.

For a source build, load `dist` as the unpacked extension. Reload ChatGPT after updating or disabling an extension: its early page hook remains until the document is replaced.

## Prompt count and native visibility

The observed ChatGPT implementation requires **at least five prompts**. The popup explains this for conversations with **four or fewer**, once complete, error-free captured history confirms the count. A small partial count during loading is not treated as proof that the conversation is too short.

Unobserved history is shown as **—**, not zero. On unsupported tabs the navigator status is **Unavailable**. Other reasons for absence include ongoing history loading, a narrow or unsupported layout, a linked-message view, and a loading failure. Complete history does not bypass ChatGPT’s own mode or account conditions.

## Automatic behavior

The early hook requests at least `num_turns=100` on recognized initial history requests for the visible current conversation, preserving larger existing requests. The server may cap the batch size. A larger initial response can reduce subsequent paging but may take longer to render.

When older history remains, the extension briefly exposes ChatGPT’s native history-loading sentinel using scoped sticky styles. ChatGPT fetches and prepends its own page; the extension restores those styles and waits for progress before another page. The extension never scrolls to the top or restores the viewport itself. It does not import private application modules, change React state, fabricate history flags, or fetch a separate history cache.

Paging waits for a visible desktop view with hover support, at least 1024 CSS pixels of width, stable anchoring, and no detected active response. Message deep links are preserved. Typing, scrolling, touching, or clicking in the page ends the current attempt to avoid disturbing reading. After at least 2.5 seconds without interaction, preparation resumes automatically when the visible conversation is ready. Backgrounding also stops active work and permits recovery on return. There are at most three resumptions per captured history context. Network errors, stalled history, unsafe layout changes, and exhausted limits do not trigger retry loops. A fresh conversation/history load or reload starts a new budget.

An already-issued ChatGPT request may still finish after interruption. The guard stops further preparation if the visible message shifts more than 8px or disappears for several frames; it cannot undo a shift the host already made.

Automatic preparation is bounded to **60 seconds of active preparation and 20 additional pages shared across all resumptions**, with a **12-second progress deadline per triggered page**. Capture is limited to two readers, 16 MB/eight seconds per response clone, and 10,000 message identities.

## Privacy and permissions

The extension runs only on `https://chatgpt.com/*` and requests no additional Chrome API permissions. It has access to read and modify that site to provide the helper. It has no backend, analytics, API key, token extraction, or persistent conversation storage. Response bodies are parsed transiently for metadata; identities, counts, and history boundaries remain in tab memory. The popup receives only its small status snapshot and cannot send preparation commands.

## Build and test

Use Node.js 22.12 or newer:

```sh
npm ci
npm run build
npx playwright install chromium
npm run check
```

Tests load the real production extension in disposable Chromium and serve synthetic ChatGPT-origin data from a local fixture. The fixture actually fetches older pages and virtualizes rendered messages. Tests cover automatic loading, reading anchors, cancellation, limits, route changes, the read-only popup, active tabs, unknown counts, and the five-prompt threshold. See [COMPATIBILITY.md](COMPATIBILITY.md) for evidence and limitations.

The manual controller and restoration code have been removed. `src/native/content.ts` owns automatic lifecycle, `seamless.ts` owns bounded loading, `panelState.ts` produces the read-only snapshot, and `src/popup/` renders it. Previous release artifacts are retained for reference.

## Changes in 0.6.0

- Automatic recovery after user interaction or backgrounding, with a shared loading budget and at most three resumptions.
- Clear recovery messages and a neutral explanation when history is complete but native navigation is unavailable.
- Chrome 152 minimum aligned with the tested baseline.
- 20 unit tests and 25 browser cases passed across full and targeted runs. Live 0.6.0 checks cover extension updating, the actual toolbar popup, reload guidance, and one/four-prompt conversations. The user completed the broader manual checklist on 0.5.0; that does not establish live recovery behavior in 0.6.0.
