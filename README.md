<p align="center">
  <img src="icons/icon128.png" alt="GPT Navigator Helper icon" width="128">
</p>

<h1 align="center">GPT Navigator Helper</h1>

<p align="center">
  A Chrome extension that helps fix ChatGPT’s missing native navigator by automatically loading conversation history.
</p>

## Install from Chrome Web Store

**Pending approval.** The store link will be added here once the extension is available.

<!--
## Install (development)

1. Download [GPT Navigator Helper 0.6.4](https://github.com/sssstf0rest/GPT-Navigator-Helper/releases/download/v0.6.4/gpt-navigator-helper-0.6.4.zip) from [GitHub Releases](https://github.com/sssstf0rest/GPT-Navigator-Helper/releases).
2. Extract the ZIP.
3. Open `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Reload your ChatGPT tabs. Pin **GPT Navigator Helper** to the toolbar for quick access to its status panel.

To update, replace the files in your unpacked folder, click **Reload** on the extension’s card, and reload ChatGPT.

<details>
<summary>Build from source</summary>

Requires Node.js 22.12 or newer.

```sh
git clone https://github.com/sssstf0rest/GPT-Navigator-Helper.git
cd GPT-Navigator-Helper
npm ci
npm run build
```

Load the generated `dist` folder using the steps above.

To run the test suite:

```sh
npx playwright install chromium
npm run check
```

</details>
-->

## Features

- **Automatic:** helps restore native navigation when incomplete history loading is the cause.
- **Unobtrusive:** works to preserve your reading position and yields when you interact.
- **Clear status:** shows navigator visibility, observed prompt count, and reasons for absence.
- **Local processing:** no conversation uploads to the developer, analytics, or persistent conversation storage.

## How it works

ChatGPT’s native prompt navigator can fail to appear when earlier conversation history has not loaded. The helper requests a larger initial history batch and, when needed, triggers ChatGPT’s own earlier-history loader automatically.

Once eligible history is available, ChatGPT can show its native navigator. Use its prompt markers to move through the conversation. Open the extension’s toolbar popup to check status; there are no manual preparation controls.

Preparation yields during interaction and can resume when the page is idle. It uses bounded loading and recovery attempts to avoid endless retries.

## Limitations

- **Chrome 152 or newer** is required. The extension runs only on `chatgpt.com`.
- **At least five user prompts** are required by the observed ChatGPT navigator implementation. Shorter conversations may correctly show no navigator.
- Automatic preparation needs a visible desktop tab at least **1024 CSS pixels wide**. Active replies, message deep links, or unsupported layouts can defer or prevent it.
- Loading history does not override ChatGPT’s account, layout, or conversation eligibility rules. Site changes may affect compatibility.
- Loading is limited to **60 seconds of active preparation, 20 additional pages, and three resumptions**. Errors or exhausted limits may require a page reload.
- The helper aims to preserve your position, but ChatGPT’s own rendering may still move the page.

See the [compatibility notes](docs/compatibility.md) and [privacy policy](docs/privacy-policy.html) for details. Report problems through [GitHub Issues](https://github.com/sssstf0rest/GPT-Navigator-Helper/issues).

## License

A project license has not been specified yet. The bundled Geist font is licensed under the [SIL Open Font License 1.1](public/licenses/Geist-OFL.txt).

GPT Navigator Helper is an independent extension, not affiliated with or endorsed by OpenAI.
