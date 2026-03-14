import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/main.ts' },
  format: 'cjs',
  outDir: 'dist',
  noExternal: /.+/,
  dts: false
})
