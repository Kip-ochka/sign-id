export default {
    meta: {
        type: 'layout',
        schema: [],
        messages: { unnecessary: 'Omit parentheses around a single simple arrow function parameter.' }
    },
    create({ sourceCode, report }) {
        return {
            'ArrowFunctionExpression[params.length=1] > Identifier.params'(param) {
                const arrow = param.parent;
                if (param.optional || param.typeAnnotation || arrow.typeParameters || arrow.returnType) {
                    return;
                }

                const opening = sourceCode.getFirstToken(arrow, { skip: arrow.async ? 1 : 0 });
                if (opening.value !== '(') {
                    return;
                }

                const closing = sourceCode.getTokenAfter(param, token => token.value === ')');
                if (!sourceCode.commentsExistBetween(opening, closing)) {
                    report({ node: param, messageId: 'unnecessary' });
                }
            }
        };
    }
};
