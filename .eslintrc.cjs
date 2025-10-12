// .eslintrc.cjs
const rulesDirPlugin = require('eslint-plugin-rulesdir');
rulesDirPlugin.RULES_DIR = 'eslint-rules'; // Point the plugin to our local rules directory

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'unused-imports',
    'boundaries',
    'rulesdir', // Load our local rules via the plugin
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  settings: {
    'import/resolver': { typescript: { project: './tsconfig.json' } },
		'boundaries/elements': [
			{ type: 'core', pattern: 'src/core/*' },
			{ type: 'services', pattern: 'src/services/*', except: ['src/services/facade.ts'] },
			{ type: 'facade', pattern: 'src/services/facade.ts' },
			{ type: 'ui', pattern: 'src/ui/*' },
			{ type: 'scene', pattern: 'src/scene/*' },
			{ type: 'main', pattern: 'src/main.ts' },
		],
  },
  env: { browser: true, es2022: true },
  ignorePatterns: ['.eslintrc.cjs'],
  
  rules: {
    'no-param-reassign': ['error', { props: true }],
    
    // --- DEFINITIVELY CORRECTED BOUNDARIES RULE ---
    'boundaries/element-types': ['error', {
      default: 'disallow', // By default, no layer can import from another
      rules: [
        { from: ['main'], allow: ['facade', 'scene'] },
        { from: ['ui', 'scene'], allow: ['facade'] },
        { from: ['facade'], allow: ['services', 'core'] },
        { from: ['services'], allow: ['core', 'services'] },
        { from: ['core'], allow: ['core'] },
      ],
    }],

    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    'no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc', caseInsensitive: true } }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'eqeqeq': ['error', 'always'],
  },

  overrides: [
    {
      files: ['src/services/**/*.{ts,tsx,js,jsx}', 'src/core/**/*.{ts,tsx,js,jsx}'],
      rules: {
        'no-restricted-syntax': [
          'error',
          { selector: 'FunctionDeclaration > AssignmentPattern', message: '[BLOCKER] DEFAULT_ARGUMENT: Functions must not use default parameters.' },
          { selector: 'FunctionExpression > AssignmentPattern', message: '[BLOCKER] DEFAULT_ARGUMENT: Functions must not use default parameters.' },
          { selector: 'ArrowFunctionExpression > AssignmentPattern', message: '[BLOCKER] DEFAULT_ARGUMENT: Arrow functions must not use default parameters.' },
          { selector: 'TSMethodSignature > AssignmentPattern', message: '[BLOCKER] DEFAULT_ARGUMENT: Interface methods must not use default parameters.' }
        ],
      },
    },
    {
      files: ['src/services/**/*.ts'],
      rules: {
        'rulesdir/no-this-assignment-except-private': 'error',
      },
    },
  ],
};