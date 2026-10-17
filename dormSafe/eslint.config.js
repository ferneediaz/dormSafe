// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // React Three Fiber elements use three.js props, not DOM attributes.
    files: ['src/components/three/**'],
    rules: { 'react/no-unknown-property': 'off' },
  },
]);
