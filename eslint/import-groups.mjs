function group(source) {
    if (/\.css(?:[?#]|$)/.test(source)) {
        return 'style';
    }
    return source.startsWith('.') ? 'relative' : 'package';
}

export default {
    meta: {
        type: 'layout',
        fixable: 'whitespace',
        schema: [],
        messages: { missingSeparator: 'Add a blank line between import groups.' }
    },
    create({ sourceCode, report }) {
        const separator = sourceCode.text.includes('\r\n') ? '\r\n\r\n' : '\n\n';
        return {
            Program({ body }) {
                body.slice(1).forEach((node, index) => {
                    const previous = body[index];
                    if (
                        previous.type !== 'ImportDeclaration' ||
                        node.type !== 'ImportDeclaration' ||
                        group(previous.source.value) === group(node.source.value)
                    ) {
                        return;
                    }

                    const start =
                        sourceCode
                            .getCommentsBefore(node)
                            .find(comment => comment.loc.start.line > previous.loc.end.line) ?? node;
                    const end = sourceCode.getTokenBefore(start, { includeComments: true });
                    if (start.loc.start.line - end.loc.end.line < 2) {
                        report({
                            node,
                            messageId: 'missingSeparator',
                            fix: fixer => fixer.replaceTextRange([end.range[1], start.range[0]], separator)
                        });
                    }
                });
            }
        };
    }
};
