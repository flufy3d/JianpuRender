const js = require('@eslint/js');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      'no-loss-of-precision': 'off',
      'no-self-assign': 'off',
      'no-case-declarations': 'error',
      'no-prototype-builtins': 'off',
      'no-unsafe-finally': 'off',
      'no-irregular-whitespace': 'off'
    }
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "es5/",
      "es6/",
      "esm/",
      "node/"
    ]
  }
];
