import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "client");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp" };

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    let file = join(root, pathname === "/" ? "index.html" : pathname);
    if (!(await stat(file).catch(() => null))?.isFile()) file = join(root, "index.html");
    response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.statusCode = 500;
    response.end("Internal server error");
  }
}).listen(process.env.PORT || 4174);
