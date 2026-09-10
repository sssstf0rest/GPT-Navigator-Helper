import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'GPT Navigator Helper',
  version: '0.6.0',
  description: 'Automatically prepare ChatGPT’s native navigator while preserving your reading position, with a simple status panel.',
  minimum_chrome_version: '152',
  action: { default_title: 'GPT Navigator Helper', default_popup: 'src/popup/index.html' },
  content_scripts: [
    { matches: ['https://chatgpt.com/*'], js: ['src/native/pageHook.iife.ts'], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://chatgpt.com/*'], js: ['src/native/content.ts'], run_at: 'document_idle', world: 'ISOLATED' },
  ],
});
