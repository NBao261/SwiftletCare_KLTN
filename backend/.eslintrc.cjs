/** ESLint 8 (legacy config) — `npm run lint` */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  rules: {
    // Log qua utils/logger.util — console chỉ dùng có chủ đích (kèm eslint-disable)
    'no-console': 'error',
    // `_next` trong error handler Express bắt buộc có đủ 4 tham số dù không dùng
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
  overrides: [
    // Script CLI (npm run seed / mdns) in thẳng ra terminal
    { files: ['src/scripts/**'], rules: { 'no-console': 'off' } },
  ],
}
