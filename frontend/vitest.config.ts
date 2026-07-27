import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: [
        'src/features/lotto/utils/**/*.ts',
        'src/features/score/hooks/useScorePlaybackDerived.ts',
        'src/components/veveno/VevenoStoreStocksPanel.tsx',
        'src/hooks/useVevenoNotices.ts',
      ],
      exclude: ['src/**/*.test.{ts,tsx}'],
    },
  },
})
