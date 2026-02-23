import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/plan2code-metrics': 'src/bin/plan2code-metrics.ts',
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
