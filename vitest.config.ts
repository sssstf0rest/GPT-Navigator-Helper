import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/native-unit/**/*.test.ts'], environment: 'node' } });
