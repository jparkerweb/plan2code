import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/plan2code-loop': 'src/bin/plan2code-loop.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
