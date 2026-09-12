module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  // Replaced at build time by vite's `define`; see vite.config.js.
  globals: { __BUILD_ID__: 'readonly' },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  rules: {
    // The new JSX transform means React need not be in scope, and prop-types
    // is not worth the ceremony in an app this size.
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.js'],
};
