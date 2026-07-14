import { cp, mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = join(root, "dist", "client");

await rm(join(root, "dist"), { recursive: true, force: true });
await mkdir(join(root, "dist", "server"), { recursive: true });
await mkdir(output, { recursive: true });
await cp(join(root, ".openai"), join(root, "dist", ".openai"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "config.js"]) {
  await cp(join(root, file), join(output, file));
}

await mkdir(join(output, "assets"), { recursive: true });
for (const file of await readdir(join(root, "assets"))) {
  if (!file.endsWith(".png")) await cp(join(root, "assets", file), join(output, "assets", file));
}

await writeFile(join(root, "dist", "server", "index.js"), `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`, "utf8");
console.log("Window Films pronta em dist/client");
