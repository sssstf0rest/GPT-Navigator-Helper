import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Conversation Navigator for ChatGPT',
  version: '0.1.0',
  description: 'A local prompt outline with verified navigation and explicit history coverage.',
  minimum_chrome_version: '111',
  content_scripts: [
    { matches: ['https://chatgpt.com/*'], js: ['src/page/pageHook.iife.ts'], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://chatgpt.com/*'], js: ['src/content/content.ts'], run_at: 'document_idle', world: 'ISOLATED' },
  ],
});
