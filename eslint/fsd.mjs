import path from 'node:path';

const layers = ['shared', 'entities', 'process', 'widgets', 'screens', 'app'];

function location(filename) {
    const relative = path.relative(path.resolve('src'), filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return undefined;
    }
    const parts = relative.split(path.sep);
    const layer = parts.length === 1 ? 'app' : parts[0];
    if (!layers.includes(layer)) {
        return undefined;
    }
    return { layer, slice: parts[1] };
}

export const importBoundaries = {
    meta: {
        type: 'problem',
        schema: [],
        messages: {
            upward: 'FSD: {{from}} cannot import the higher layer {{to}}.',
            sibling: 'FSD: slices in {{layer}} must not import each other.',
            publicApi: 'FSD: import {{slice}} through its public index.ts.',
        },
    },
    create(context) {
        const filename = context.filename;
        const from = location(filename);
        if (!from) {
            return {};
        }
        function check(node) {
            const source = node.source;
            if (typeof source?.value !== 'string') {
                return;
            }
            const specifier = source.value;
            if (!specifier.startsWith('.')) {
                return;
            }
            const target = path.resolve(path.dirname(filename), specifier);
            const to = location(target);
            if (!to) {
                return;
            }
            if (layers.indexOf(to.layer) > layers.indexOf(from.layer)) {
                context.report({
                    node: source,
                    messageId: 'upward',
                    data: { from: from.layer, to: to.layer },
                });
                return;
            }
            if (from.layer === to.layer) {
                if (from.layer !== 'app' && from.layer !== 'shared' && from.slice !== to.slice) {
                    context.report({
                        node: source,
                        messageId: 'sibling',
                        data: { layer: from.layer },
                    });
                }
                return;
            }
            if (to.layer === 'shared' || to.layer === 'app') {
                return;
            }
            const slice = path.join('src', to.layer, to.slice);
            const rest = path.relative(path.resolve(slice), target);
            if (rest && rest !== 'index' && rest !== 'index.ts') {
                context.report({
                    node: source,
                    messageId: 'publicApi',
                    data: { slice },
                });
            }
        }
        return {
            ImportDeclaration: check,
            ExportNamedDeclaration: check,
            ExportAllDeclaration: check,
            ImportExpression: check,
        };
    },
};

export default { rules: { 'import-boundaries': importBoundaries } };
