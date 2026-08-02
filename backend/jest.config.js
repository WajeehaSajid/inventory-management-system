module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1, // tests share one real database — run serially to avoid race conditions
  testTimeout: 15000,
  testMatch: ['**/tests/**/*.test.js'],
};
