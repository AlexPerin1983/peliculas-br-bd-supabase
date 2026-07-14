import { cp, mkdir, readdir, rm } from 'node:fs/promises';
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

console.log('Static site built in dist/');
