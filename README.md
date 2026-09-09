# Native Navigator Helper for ChatGPT

Automatically prepares conversation history so ChatGPT can show its built-in prompt navigator. This version starts when a conversation opens, including navigation between conversations, and uses the host’s pagination trigger without scrolling to the top and back.

**Experimental version 0.3.0 · branch `seamless-preparation`.** A bounded live ChatGPT test loaded one older page with zero measured reading-anchor movement. The complete extension flow is tested against local paginated, virtualized fixtures. Full live extension validation across conversations remains a trial step; ChatGPT’s layout and loading contracts can change.

## Try it

1. Disable the older **Conversation Navigator** or **Native Navigator Helper** extension, so only this version runs. Reload your ChatGPT tabs after switching versions.
2. Extract `output/releases/native-navigator-helper-0.3.0.zip`. In `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. For a source build, use `dist` instead.
3. Open or reload a conversation in a wide desktop window. The compact lower-left helper prepares automatically when the page is ready and idle. It should stay at the message you are reading.
4. When **Navigator ready** appears, use ChatGPT’s own prompt markers on the right. Check the oldest, middle, and newest entries.

Open the compact helper for status and controls:

- **Stop automatic preparation** ends the current run. Scrolling, typing, touching, or clicking elsewhere also stops it. It does not pull you back to a saved position.
- **Pause automatic preparation** disables subsequent automatic work in this tab, including conversation switches. **Resume** reenables it and checks the current conversation. Reloading resets the preference to enabled; it is not stored across sessions.
- **Prepare navigation** is the explicit manual fallback. It may scroll through earlier history and then return to your reading position. During this run, **Stop and return** attempts to restore that position.

A request already sent by ChatGPT may finish after Stop or Pause. The helper releases its temporary trigger immediately and does not start another page for that run. After stopping through interaction, it waits for a new conversation/history context or a Pause/Resume cycle; it does not repeatedly interrupt your reading with retries.

If a history request fails, use ChatGPT’s own history retry control if present before trying manual preparation again. Reloading can recover an unrecognized or disconnected history capture. Always reload ChatGPT after changing or disabling an extension build: its early page hook lives until the document is replaced.

## How automatic preparation works

The early page hook requests `num_turns=100` on recognized initial history requests for the currently open conversation in a visible tab. It preserves larger existing requests, excludes message deep links and requests for other conversations, and leaves targeted/legacy initial requests unchanged. The server may cap or ignore the batch size. A larger first response can reduce later requests, but may delay initial rendering.

If older history remains, the helper briefly places ChatGPT’s known history-loading sentinel inside its own scroll viewport using scoped sticky styles. ChatGPT’s existing observer then loads the next page and its own renderer preserves the reading position. The helper restores those styles as soon as the request starts, waits for completion, and checks progress before another page. It neither sets the conversation scroll position nor invokes the manual scroll routine in automatic mode.

Automatic paging waits for a visible desktop layout with hover support, at least 1024 CSS pixels of width, no detected active response, and normal scroll anchoring. It stops or defers on unknown history, incompatible containment, message deep links, interrupted reading, a changed route/history, errors, repeated cursors, or limits. An anchor monitor stops further paging if the same message moves more than 8px or disappears for several frames. This guard cannot undo a host layout change that already happened.

ChatGPT’s captured native implementation requires **at least five user turns**, completed older-history loading, and additional layout/mode conditions. Four-prompt conversations are reported accurately; loading cannot force them through the native eligibility gate. The helper detects structural native TOC markers even when their accessibility labels contain prompt text.

## Results and limits

| Result | Meaning |
|---|---|
| Navigator ready | History reached a recognized complete boundary and native controls are visible. |
| History loaded; native hidden/not detected | Captured history is complete, but the native component is hidden or absent. Under five prompts, the helper explains the current minimum. |
| Waiting for a stable layout | Automatic paging is deferred until the supported layout is available. |
| Stopped / history unverified / limit reached | Further loading is not confirmed. Open the helper for the reason and manual controls. |

**Compatibility details** shows counts, pending requests, detected native controls, viewport, and issue category. It excludes prompt text, conversation IDs, and request headers. Completion describes captured host metadata, not an independent audit of every server-side branch or proof that every native jump works.

Automatic runs are bounded to **60 seconds and 20 additional pages**, with a **12-second progress deadline per triggered page**. Manual runs allow three minutes, 80 additional pages, and 160 edge steps. Metadata capture is limited to two readers, 16 MB/eight seconds per response clone, and 10,000 message identities.

## Data handling

The extension runs only on `https://chatgpt.com/*` and adds no extension permissions. It has no backend, analytics, API key, token extraction, or persistent conversation storage. Response bodies are parsed transiently to extract metadata; only identities, counts, and history boundaries remain in tab memory. It does not import private application modules, change React state, fabricate pagination flags, or make separate authenticated history requests. ChatGPT receives its own responses normally.

## Build and test

Use Node.js 22.12 or newer:

```sh
npm ci
npm run build
npx playwright install chromium
npm run check
```

The tests load the real production extension in disposable Chromium. ChatGPT-origin requests are fulfilled by a local fixture on `127.0.0.1:4173`; the suite does not access your live profile. The fixture actually fetches older pages, models the observed native sentinel and prepend compensation, and mounts only a window of messages. Screenshots are saved under `output/playwright`.

See [COMPATIBILITY.md](COMPATIBILITY.md) for validation results and the remaining live trial steps.

| Source | Responsibility |
|---|---|
| `src/native/pageHook.iife.ts` | Early request expansion, text-free metadata capture, route isolation |
| `src/native/historyMetadata.ts` | Conservative history-chain continuity |
| `src/native/seamless.ts` | Scoped native loading trigger, bounds, anchor guard, cleanup |
| `src/native/prepare.ts`, `dom.ts` | Manual preparation, native detection, reading anchors |
| `src/native/content.ts` | Automatic lifecycle, interruption, pause, status |
| `src/native/ui.ts`, `helper.css` | Compact controls and details in Shadow DOM |

The previous manual helper remains on `codex/native-navigator-helper` at `6207f07`; the original custom navigator remains on `main` at `daa709a`. Earlier research documents describe those historical designs.
