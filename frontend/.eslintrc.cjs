/** ESLint 8 (legacy config) — `npm run lint` */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  env: { browser: true, es2022: true },
  ignorePatterns: ['dist'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    // `while (true)` có điều kiện thoát bên trong là cố ý (VD ActionsMenu#move)
    'no-constant-condition': ['error', { checkLoops: false }],
  },
}
