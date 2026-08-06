import { app, BrowserWindow, ipcMain, protocol } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { readdirSync, existsSync } from "node:fs";
import { promises as fsp } from "node:fs";
import type { AddressInfo } from "node:net";
import managerHtml from "./manager.html?raw";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;

const IMG_DIR = path.join(process.env.VITE_PUBLIC, "img");
const ALLOWED_IMAGE = /\.(jpg|jpeg|png|gif|webp)$/i;
const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
const MANAGER_PORT = Number(process.env.SMARTFRAME_MANAGER_PORT ?? 80);
const MANAGER_FALLBACK_PORT = 8080;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "smartframe-img",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
    frame: false,
    fullscreen: true,
    // menuBar: false,
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("get-images", () => listAllImages());

function getUploadDir(): string {
  return path.join(app.getPath("userData"), "images");
}

function listAllImages(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const dir of [getUploadDir(), IMG_DIR]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!ALLOWED_IMAGE.test(file) || seen.has(file)) continue;
      seen.add(file);
      result.push(file);
    }
  }
  return result;
}

function resolveImagePath(name: string): string | null {
  for (const dir of [getUploadDir(), IMG_DIR]) {
    const filePath = path.join(dir, name);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

function getLocalIp(): string {
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const addr of addrs ?? []) {
      if (String(addr.family) === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return "localhost";
}

function sanitizeImageName(name: string): string | null {
  const base = path.basename(String(name ?? "").replace(/\\/g, "/"));
  if (!base || !ALLOWED_IMAGE.test(base)) return null;
  return base;
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function startManagerServer() {
  const server = http.createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url ?? "/", "http://localhost");

    try {
      if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(managerHtml);
        return;
      }

      if (req.method === "GET" && pathname === "/api/images") {
        const images = listAllImages().map((name) => ({
          name,
          deletable: existsSync(path.join(getUploadDir(), name)),
        }));
        sendJson(res, 200, { images });
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/img/")) {
        const name = sanitizeImageName(pathname.slice("/img/".length));
        if (!name) {
          sendJson(res, 400, { error: "Invalid image name" });
          return;
        }
        const filePath = resolveImagePath(name);
        if (!filePath) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        const data = await fsp.readFile(filePath);
        res.writeHead(200, {
          "Content-Type": IMAGE_MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(data);
        return;
      }

      if (req.method === "POST" && pathname === "/api/images") {
        const name = sanitizeImageName(searchParams.get("name") ?? "");
        if (!name) {
          sendJson(res, 400, { error: "Invalid file name or extension" });
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req as AsyncIterable<Buffer>) {
          chunks.push(Buffer.from(chunk));
        }
        if (chunks.length === 0) {
          sendJson(res, 400, { error: "Empty request body" });
          return;
        }
        const uploadDir = getUploadDir();
        await fsp.mkdir(uploadDir, { recursive: true });
        const ext = path.extname(name);
        const stem = name.slice(0, -ext.length);
        let filePath = path.join(uploadDir, name);
        for (let i = 1; existsSync(filePath); i++) {
          filePath = path.join(uploadDir, `${stem}-${i}${ext}`);
        }
        await fsp.writeFile(filePath, Buffer.concat(chunks));
        sendJson(res, 201, { name: path.basename(filePath) });
        return;
      }

      if (req.method === "DELETE" && pathname.startsWith("/api/images/")) {
        const name = sanitizeImageName(pathname.slice("/api/images/".length));
        if (!name) {
          sendJson(res, 400, { error: "Invalid image name" });
          return;
        }
        const filePath = path.join(getUploadDir(), name);
        if (!existsSync(filePath)) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        await fsp.unlink(filePath);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      console.error("[manager] Request failed:", err);
      sendJson(res, 500, { error: "Internal error" });
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if ((err.code === "EACCES" || err.code === "EPERM") && MANAGER_PORT !== MANAGER_FALLBACK_PORT) {
      console.warn(`[manager] Cannot bind port ${MANAGER_PORT} (${err.code}); falling back to ${MANAGER_FALLBACK_PORT}`);
      server.listen(MANAGER_FALLBACK_PORT, "0.0.0.0");
    } else {
      console.error("[manager] Failed to start:", err.message);
    }
  });

  server.listen(MANAGER_PORT, "0.0.0.0", () => {
    const port = (server.address() as AddressInfo).port;
    console.log(`[manager] SmartFrame manager: http://${getLocalIp()}${port === 80 ? "" : `:${port}`}`);
  });
}

app.whenReady().then(() => {
  protocol.handle("smartframe-img", async (request) => {
    const url = new URL(request.url);
    const name = sanitizeImageName(decodeURIComponent(url.pathname.replace(/^\//, "")));
    const filePath = name ? resolveImagePath(name) : null;
    if (!filePath) {
      return new Response("Not found", { status: 404 });
    }
    const data = await fsp.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  });

  createWindow();
  startManagerServer();
});
