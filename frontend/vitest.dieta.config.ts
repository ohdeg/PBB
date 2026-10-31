// Isolated UI checks never load local environment/secret files.
export default {
  envDir: false,
  test: {
    environment: 'jsdom',
    include: ['src/**/Dieta*.test.tsx', 'src/features/dieta/**/*.test.{ts,tsx}', 'src/api/dietaMappers.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
};
