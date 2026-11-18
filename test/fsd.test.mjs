import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { Linter } from 'eslint';
import fsd from '../eslint/fsd.mjs';

function diagnostics(filename, code) {
  return new Linter().verify(
    code,
    [
      {
        files: ['**/*.js'],
        plugins: { fsd },
        rules: { 'fsd/import-boundaries': 'error' },
      },
    ],
    { filename: path.resolve(filename) },
  );
}

const cases = [
  [
    'page composes a widget',
    'src/screens/check/page.js',
    "import '../../widgets/signing-process';",
    undefined,
  ],
  [
    'widget composes a feature',
    'src/widgets/signing-process/model.js',
    "import '../../process/check';",
    undefined,
  ],
  [
    'feature reads entity',
    'src/process/check/model.js',
    "import '../../entities/signing';",
    undefined,
  ],
  [
    'internal slice import',
    'src/process/check/model.js',
    "import './prepareCheck';",
    undefined,
  ],
  [
    'shared segments',
    'src/shared/api/network.js',
    "import '../lib/async';",
    undefined,
  ],
  [
    'feature imports a page',
    'src/process/check/model.js',
    "import '../../screens/check';",
    'upward',
  ],
  [
    'entity imports a feature',
    'src/entities/signing/model.js',
    "import '../../process/check';",
    'upward',
  ],
  [
    'shared imports business layer',
    'src/shared/lib/model.js',
    "import '../../entities/signing';",
    'upward',
  ],
  [
    'feature imports sibling',
    'src/process/check/model.js',
    "import '../signing';",
    'sibling',
  ],
  [
    'widget imports sibling',
    'src/widgets/workplace/model.js',
    "import '../signing-process';",
    'sibling',
  ],
  [
    'page imports sibling',
    'src/screens/check/page.js',
    "import '../signing';",
    'sibling',
  ],
  [
    'deep feature import',
    'src/widgets/signing-process/model.js',
    "import '../../process/check/prepareCheck';",
    'publicApi',
  ],
  [
    'dynamic upward import',
    'src/process/check/model.js',
    "import('../../screens/check');",
    'upward',
  ],
  [
    'upward re-export',
    'src/process/check/model.js',
    "export * from '../../screens/check';",
    'upward',
  ],
];

cases.forEach(([name, filename, code, expected]) => {
  test(name, () => {
    const messages = diagnostics(filename, code);
    assert.deepEqual(
      messages.map((message) => message.messageId),
      expected ? [expected] : [],
    );
  });
});
