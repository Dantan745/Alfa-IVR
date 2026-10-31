import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const SUB = process.env.TUNNEL_SUBDOMAIN || "alfa-koshelek-cr";
const PORT = process.env.PORT || "8787";
const URL_FILE = path.join(root, "public-url.txt");
const TOKEN = process.env.CLOUDFLARE_TUNNEL_TOKEN || "";

function saveUrl(url) {
  fs.writeFileSync(URL_FILE, String(url).trim() + "\n", "utf8");
  console.log("Публичная ссылка:", url);
}

function run(cmd, args, onLine) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    const feed = (buf) => {
      const text = buf.toString();
      process.stdout.write(text);
      for (const line of text.split(/\r?\n/)) onLine(line);
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function namedCloudflare() {
  const bin = path.join(root, "server", "cloudflared.exe");
  if (!TOKEN || !fs.existsSync(bin)) return 1;
  console.log("Именованный Cloudflare-туннель (постоянный домен)");
  return run(bin, ["tunnel", "run", "--token", TOKEN], () => {});
}

async function locaLt() {
  console.log(`Закреплённый адрес: https://${SUB}.loca.lt`);
  saveUrl(`https://${SUB}.loca.lt`);
  return run("npx", ["--yes", "localtunnel", "--port", PORT, "--subdomain", SUB], (line) => {
    const m = line.match(/https:\/\/[a-z0-9.-]+/i);
    if (m) saveUrl(m[0]);
  });
}

while (true) {
  const code = TOKEN ? await namedCloudflare() : await locaLt();
  console.log("Туннель закрылся, код", code, "— перезапуск через 3 с");
  await new Promise((r) => setTimeout(r, 3000));
}
