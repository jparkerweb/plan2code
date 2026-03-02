import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/plan2code-bot': 'src/bin/plan2code-bot.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
