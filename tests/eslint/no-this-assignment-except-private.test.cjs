'use strict';

const { RuleTester } = require('eslint');
// Path is now corrected to go up two levels from tests/eslint/
const rule = require('../../eslint-rules/no-this-assignment-except-private.cjs'); 

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

console.log('Testing custom ESLint rule: no-this-assignment-except-private...');

ruleTester.run('no-this-assignment-except-private', rule, {
  valid: [
    { code: `class Service { constructor() { this._dependency = null; } }` },
    { code: `class Service { constructor(private _dep: any) {} }`, parser: require.resolve('@typescript-eslint/parser') },
    { code: `function notAClass() { const obj = {}; obj.prop = 1; }` },
  ],
  invalid: [
    {
      code: `class Service { constructor() { this.state = 'forbidden'; } }`,
      errors: [{ messageId: 'forbiddenThis', data: { name: 'state' } }],
    },
    {
      code: `class Service { someMethod() { this.data = []; } }`,
      errors: [{ messageId: 'forbiddenThis', data: { name: 'data' } }],
    },
  ],
});

console.log('All tests passed!');