import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.resolve(root, "../web/dist");
const to = path.resolve(root, "www");
if (!fs.existsSync(path.join(from, "index.html"))) {
  console.error("Нет web/dist. Сначала npm run build:web");
  process.exit(1);
}
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log("www обновлён");
