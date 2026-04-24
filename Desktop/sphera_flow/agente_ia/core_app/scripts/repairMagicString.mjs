import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const esmEntryPath = join(
  process.cwd(),
  'node_modules',
  'magic-string',
  'dist',
  'magic-string.es.mjs',
);

if (!existsSync(esmEntryPath)) {
  mkdirSync(dirname(esmEntryPath), { recursive: true });

  writeFileSync(
    esmEntryPath,
    [
      "import magicStringModule from './magic-string.cjs.js';",
      '',
      "export const Bundle = magicStringModule.Bundle;",
      "export const SourceMap = magicStringModule.SourceMap;",
      "export default magicStringModule.default ?? magicStringModule;",
      '',
    ].join('\n'),
    'utf8',
  );
}
