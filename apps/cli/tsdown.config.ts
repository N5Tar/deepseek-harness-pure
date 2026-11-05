import { defineConfig } from 'tsdown'

/**
 * The dsh CLI ships its command, Desktop command bridge, and profile lifecycle.
 * Declarations come from `tsc -b` (dts: false), matching every package.
 */
export default defineConfig({
  entry: {
    bin: 'lib/types/installed-bin.js',
    'desktop-cli': 'lib/types/desktop-cli.js',
    'profile-boot': 'lib/types/profile-boot.js',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: ['lib/*.js'],
})
