// Polyfill CustomEvent for Node.js environments (required by pglite-socket in Electron/Node 18)
if (typeof global.CustomEvent === 'undefined') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(event, params = {}) {
      super(event, params);
      this.detail = params.detail || null;
    }
  };
}

const { app, BrowserWindow, protocol, ipcMain, Menu, net } = require("electron");
const path = require("path");
const fs = require("fs");
const spawn = require("cross-spawn");
const os = require("os");
const { PGlite } = require("@electric-sql/pglite");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");

// Register custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

let mainWindow = null;
let settingsWindow = null;
let pgliteDb = null;
let pgliteServer = null;
let backendProcess = null;

// Paths
const configPath = path.join(app.getPath("userData"), "config.json");
const logPath = path.join(app.getPath("userData"), "server.log");

function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    console.error("Failed to write to log file", e);
  }
}

// Load connection config
function loadConfig() {
  try {
    if (!fs.existsSync(path.dirname(configPath))) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load connection config", e);
  }
  return {
    API_URL: "http://localhost:3000/api",
    FRONTEND_URL: "",
    CONNECTION_MODE: ""
  };
}

let config = loadConfig();

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save connection config", e);
  }
}

// Local Database Startup
async function startLocalDatabase() {
  const dbPath = path.join(app.getPath("userData"), "pglite-data");
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  
  logToFile(`[Database] Starting local WASM PostgreSQL database storing at: ${dbPath}`);
  console.log(`[Database] Starting local WASM PostgreSQL database storing at: ${dbPath}`);
  
  pgliteDb = await PGlite.create({
    dataDir: dbPath,
    extensions: {
      pgcrypto
    }
  });
  
  pgliteServer = new PGLiteSocketServer({
    db: pgliteDb,
    port: 15432,
    host: "127.0.0.1",
    maxConnections: 100
  });
  
  await pgliteServer.start();
  logToFile("[Database] Local WASM PostgreSQL database listening on port 15432");
  console.log("[Database] Local WASM PostgreSQL database listening on port 15432");
}

// Run Database Migrations
function runMigrations() {
  return new Promise((resolve, reject) => {
    logToFile("[Migrations] Deploying schema migrations...");
    console.log("[Migrations] Deploying schema migrations...");
    
    const prismaCliPath = app.isPackaged
      ? path.join(app.getAppPath().replace("app.asar", "app.asar.unpacked"), "backend-runtime", "node_modules", "prisma", "build", "index.js")
      : path.join(__dirname, "..", "backend", "node_modules", "prisma", "build", "index.js");

    const backendPath = app.isPackaged
      ? path.join(app.getAppPath().replace("app.asar", "app.asar.unpacked"), "backend-runtime")
      : path.join(__dirname, "..", "backend");

    const migrationProcess = spawn(process.execPath, [prismaCliPath, "migrate", "deploy"], {
      cwd: backendPath,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:15432/logiksense_marketing?schema=public&sslmode=disable&connection_limit=1"
      }
    });

    migrationProcess.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      console.log(`[Migrations] ${msg}`);
      logToFile(`[Migrations] ${msg}`);
    });

    migrationProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      console.error(`[Migrations Error] ${msg}`);
      logToFile(`[Migrations Error] ${msg}`);
    });

    migrationProcess.on("close", (code) => {
      if (code === 0) {
        logToFile("[Migrations] Database migrations completed successfully.");
        console.log("[Migrations] Database migrations completed successfully.");
        resolve();
      } else {
        logToFile(`[Migrations Error] Prisma process exited with code ${code}`);
        console.error(`[Migrations] Prisma process exited with code ${code}`);
        reject(new Error(`Migrations failed with code ${code}`));
      }
    });
  });
}

// Spawn NestJS Backend
function startLocalBackend() {
  return new Promise((resolve) => {
    logToFile("[Backend] Spawning local NestJS process...");
    console.log("[Backend] Spawning local NestJS process...");
    
    const backendScript = app.isPackaged
      ? path.join(app.getAppPath().replace("app.asar", "app.asar.unpacked"), "backend-runtime", "dist", "main.js")
      : path.join(__dirname, "..", "backend", "dist", "main.js");

    const backendDir = app.isPackaged
      ? path.join(app.getAppPath().replace("app.asar", "app.asar.unpacked"), "backend-runtime")
      : path.join(__dirname, "..", "backend");

    backendProcess = spawn(process.execPath, [backendScript], {
      cwd: backendDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:15432/logiksense_marketing?schema=public&sslmode=disable&connection_limit=1",
        REDIS_ENABLED: "false",
        PORT: "3000"
      }
    });

    backendProcess.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      console.log(`[Backend] ${msg}`);
      logToFile(`[Backend] ${msg}`);
      if (msg.includes("Server running on http://")) {
        resolve();
      }
    });

    backendProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      console.error(`[Backend Error] ${msg}`);
      logToFile(`[Backend Error] ${msg}`);
    });

    backendProcess.on("close", (code) => {
      logToFile(`[Backend] NestJS process closed with exit code ${code}`);
      console.log(`[Backend] NestJS process closed with exit code ${code}`);
    });

    // Timeout fallback resolve
    setTimeout(resolve, 5000);
  });
}

// Telemetry check-in
async function runTelemetryCheckIn() {
  if (!pgliteDb) return;
  try {
    const res = await pgliteDb.query("SELECT email, first_name, last_name FROM customers LIMIT 1");
    let userEmail = "anonymous";
    let userName = "Anonymous User";
    if (res.rows.length > 0) {
      userEmail = res.rows[0].email;
      userName = `${res.rows[0].first_name || ""} ${res.rows[0].last_name || ""}`.trim();
    }
    
    const payload = {
      email: userEmail,
      name: userName,
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      timestamp: new Date().toISOString()
    };
    
    logToFile(`[Telemetry] Sending telemetry check-in for ${userEmail}...`);
    console.log(`[Telemetry] Sending telemetry check-in for ${userEmail}...`);
    
    net.fetch("https://telemetry.logiksense.com/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((response) => {
      logToFile(`[Telemetry] Response status: ${response.status}`);
      console.log(`[Telemetry] Response status: ${response.status}`);
    }).catch(() => {
      logToFile("[Telemetry] Telemetry server unreachable (offline).");
      console.log("[Telemetry] Telemetry server unreachable (offline).");
    });
  } catch (e) {
    logToFile(`[Telemetry Error] Failed to execute telemetry check-in: ${e.message}`);
    console.error("[Telemetry] Failed to execute telemetry check-in", e);
  }
}

// Group Database & Backend boot logic
async function bootDatabaseAndBackend() {
  logToFile("=== Initiating Local Server Boot Sequence ===");
  try {
    await startLocalDatabase();
    await runMigrations();
    await startLocalBackend();
  } catch (err) {
    logToFile(`[Boot Error] Local server startup sequence encountered errors: ${err.message}`);
    console.error("[Boot] Local server startup sequence encountered errors:", err);
  }
}

// IPC Handlers
ipcMain.on("get-api-url", (event) => {
  event.returnValue = config.API_URL || "http://localhost:3000/api";
});

ipcMain.on("get-frontend-url", (event) => {
  event.returnValue = config.FRONTEND_URL;
});

ipcMain.on("get-connection-mode", (event) => {
  event.returnValue = config.CONNECTION_MODE;
});

ipcMain.on("set-api-url", (event, url) => {
  config.API_URL = url;
  saveConfig();
});

ipcMain.on("set-frontend-url", (event, url) => {
  config.FRONTEND_URL = url;
  saveConfig();
});

ipcMain.on("save-wizard-config", (event, mode, apiUrl, frontendUrl) => {
  config.CONNECTION_MODE = mode;
  config.API_URL = apiUrl;
  config.FRONTEND_URL = frontendUrl;
  saveConfig();
  
  if (mode === "host") {
    bootDatabaseAndBackend().then(() => {
      loadMainUrl();
      runTelemetryCheckIn();
    });
  } else {
    loadMainUrl();
  }
});

ipcMain.on("reset-connection-config", () => {
  console.log("[Reset] Resetting connection configuration...");
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (e) {
    console.error("[Reset] Failed to delete config file", e);
  }
  
  config = { API_URL: "", FRONTEND_URL: "", CONNECTION_MODE: "" };
  
  // Clean up host processes if active
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (pgliteServer) {
    pgliteServer.stop();
    pgliteServer = null;
  }
  pgliteDb = null;
  
  // Reload window back to onboarding wizard
  loadMainUrl();
});

ipcMain.on("reload-window", () => {
  if (mainWindow) {
    loadMainUrl();
  }
});

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 450,
    height: 440,
    title: "Connection Settings",
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function loadMainUrl() {
  if (!config.CONNECTION_MODE || config.CONNECTION_MODE.trim() === "") {
    mainWindow.loadFile(path.join(__dirname, "onboarding.html"));
    return;
  }
  
  const frontendUrl = config.FRONTEND_URL;
  if (frontendUrl && frontendUrl.trim() !== "") {
    mainWindow.loadURL(frontendUrl);
  } else {
    mainWindow.loadURL("app://./index.html");
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "LogikSense Marketing",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  loadMainUrl();

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (settingsWindow) {
      settingsWindow.close();
    }
  });
}

function setAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Preferences...", accelerator: "Cmd+,", click: createSettingsWindow },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    }] : []),
    {
      label: "File",
      submenu: [
        ...(!isMac ? [
          { label: "Connection Settings...", accelerator: "Ctrl+,", click: createSettingsWindow },
          { type: "separator" }
        ] : []),
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About LogikSense",
          click: async () => {
            const { dialog } = require("electron");
            dialog.showMessageBox({
              title: "About LogikSense Marketing",
              message: "LogikSense Marketing Operations Client",
              detail: "Version 1.0.0\nSecure desktop wrapper for LogikSense marketing workflows.",
              buttons: ["OK"]
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // If local host mode is configured, start local database and backend immediately
  if (config.CONNECTION_MODE === "host") {
    await bootDatabaseAndBackend();
  }

  // Register app protocol
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    let normalizedPath = path.normalize(pathname);
    if (normalizedPath.startsWith("\\") || normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.slice(1);
    }
    
    const distDir = path.join(__dirname, "frontend-dist");
    if (!fs.existsSync(distDir)) {
      return new Response(
        `<html>
          <body style="font-family: sans-serif; background-color: #0b0f19; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center;">
            <div style="background: rgba(17, 24, 39, 0.7); padding: 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <h2 style="color: #818cf8; margin-top: 0;">Frontend Assets Not Found</h2>
              <p style="color: #9ca3af; max-width: 400px; line-height: 1.5;">The frontend files have not been bundled yet. Please run the build command inside the desktop folder to compile and copy the Next.js assets.</p>
              <code style="background: rgba(255,255,255,0.08); padding: 10px 16px; border-radius: 6px; display: inline-block; font-size: 0.9em; border: 1px solid rgba(255,255,255,0.05); color: #f3f4f6; margin-top: 12px;">npm run build:frontend</code>
            </div>
          </body>
        </html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    let filePath = path.join(distDir, normalizedPath);
    
    if (normalizedPath === "" || normalizedPath === "." || normalizedPath.endsWith("/") || normalizedPath.endsWith("\\")) {
      filePath = path.join(distDir, "index.html");
    }

    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      const htmlPath = filePath + ".html";
      if (fs.existsSync(htmlPath)) {
        filePath = htmlPath;
      } else {
        if (normalizedPath.startsWith("email/campaigns/") || normalizedPath.startsWith("email\\campaigns\\")) {
          filePath = path.join(distDir, "email", "campaigns", "fallback.html");
        } else if (normalizedPath.startsWith("email/sequences/") || normalizedPath.startsWith("email\\sequences\\")) {
          filePath = path.join(distDir, "email", "sequences", "fallback.html");
        } else if (normalizedPath.startsWith("linkedin/") || normalizedPath.startsWith("linkedin\\")) {
          filePath = path.join(distDir, "linkedin", "fallback.html");
        } else if (normalizedPath.startsWith("scraper/jobs/") || normalizedPath.startsWith("scraper\\jobs\\")) {
          filePath = path.join(distDir, "scraper", "jobs", "fallback.html");
        } else {
          filePath = path.join(distDir, "index.html");
        }
      }
    }

    try {
      const fileUrl = "file://" + filePath.replace(/\\/g, "/");
      return net.fetch(fileUrl);
    } catch (err) {
      console.error("Failed to read file for protocol app://", err);
      return new Response("Asset not found", { status: 404 });
    }
  });

  createMainWindow();
  setAppMenu();

  if (config.CONNECTION_MODE === "host") {
    runTelemetryCheckIn();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  // Clean termination of local backend child process and database server
  if (backendProcess) {
    backendProcess.kill();
  }
  if (pgliteServer) {
    pgliteServer.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
