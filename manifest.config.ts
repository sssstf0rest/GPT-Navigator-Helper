import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Native Navigator Helper for ChatGPT',
  version: '0.3.0',
  description: 'Automatically prepare ChatGPT’s native navigator while preserving your reading position, with pause and manual controls.',
  minimum_chrome_version: '111',
  content_scripts: [
    { matches: ['https://chatgpt.com/*'], js: ['src/native/pageHook.iife.ts'], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://chatgpt.com/*'], js: ['src/native/content.ts'], run_at: 'document_idle', world: 'ISOLATED' },
  ],
});
