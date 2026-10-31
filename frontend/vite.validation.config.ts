import config from './vite.config'
import { defineConfig } from 'vite'
// Explicit validation entry point: never read local environment files.
export default defineConfig({ ...config, envDir: false, cacheDir: 'node_modules/.vite-ticket-validation', build: { outDir: 'dist-ticket-validation' } })
