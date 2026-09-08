import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Native Navigator Helper for ChatGPT',
  version: '0.2.0',
  description: 'Prepare conversation history for ChatGPT’s built-in navigator, with progress, cancellation, and position restoration.',
  minimum_chrome_version: '111',
  content_scripts: [
    { matches: ['https://chatgpt.com/*'], js: ['src/native/pageHook.iife.ts'], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://chatgpt.com/*'], js: ['src/native/content.ts'], run_at: 'document_idle', world: 'ISOLATED' },
  ],
});
