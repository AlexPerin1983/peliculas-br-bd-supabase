import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const output = resolve(root, 'dist');
const ignored = new Set(['.git', 'node_modules', 'dist', 'build.mjs', 'package.json']);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (ignored.has(entry.name)) continue;
  await cp(resolve(root, entry.name), resolve(output, entry.name), { recursive: true });
}

const serverOutput = resolve(output, 'server');
await mkdir(serverOutput, { recursive: true });
await writeFile(
  resolve(serverOutput, 'index.js'),
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
  'utf8',
);

console.log('Static site built in dist/');
