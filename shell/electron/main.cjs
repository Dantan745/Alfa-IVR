const { app, BrowserWindow, protocol, shell, Menu } = require("electron");
const fs = require("fs");
const path = require("path");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function wwwRoot() {
  return path.join(__dirname, "..", "www");
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".ico")) return "image/x-icon";
  if (file.endsWith(".woff2")) return "font/woff2";
  if (file.endsWith(".webmanifest")) return "application/manifest+json";
  return "application/octet-stream";
}

function createWindow() {
  const icon = path.join(__dirname, "..", "resources", "icon.png");
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 390,
    minHeight: 640,
    title: "Alfa Кошелёк ЦР",
    backgroundColor: "#0B0E14",
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL("app://alfa/index.html");
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel.endsWith("/")) rel += "index.html";
    rel = rel.replace(/^\/+/, "");
    const root = path.resolve(wwwRoot());
    const file = path.resolve(root, rel);
    const index = path.join(root, "index.html");
    const rootBound = root.endsWith(path.sep) ? root : root + path.sep;
    if (file !== root && !file.startsWith(rootBound)) return new Response("forbidden", { status: 403 });
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : (!path.extname(rel) && fs.existsSync(index) ? index : "");
    if (!target) return new Response("missing", { status: 404 });
    return new Response(fs.readFileSync(target), { headers: { "content-type": mime(target) } });
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
