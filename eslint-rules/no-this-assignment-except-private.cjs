'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce stateless services by disallowing `this.prop` assignments, allowing only `this._prop` for dependency injection.',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      forbiddenThis: '[BLOCKER] STATEFUL_SERVICE: Services must be stateless. Avoid assigning to instance property "{{name}}". Use an underscore prefix (e.g., `this._{{name}}`) only for injected dependencies.',
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        const left = node.left;
        if (left?.type === 'MemberExpression' && left.object?.type === 'ThisExpression') {
          let propName = null;
          if (left.property?.type === 'Identifier') {
            propName = left.property.name;
          }
          if (propName && !propName.startsWith('_')) {
            context.report({
              node: left.property,
              messageId: 'forbiddenThis',
              data: { name: propName },
            });
          }
        }
      },
    };
  },
};