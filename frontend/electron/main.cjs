const { app, BrowserWindow, ipcMain, globalShortcut, session, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

let mainWindow = null;
let pythonProcess = null;
let isSpawning = false;

function spawnBackend() {
  if (isSpawning || pythonProcess) return;
  isSpawning = true;

  try {
    const candidateRoots = [
      path.resolve(app.getAppPath(), "..", ".."),
      process.cwd(),
      path.resolve(__dirname, "..", "..", ".."),
      path.resolve(__dirname, "..", ".."),
      "C:\\Users\\ajayb\\Documents\\Music_app",
    ];
    const rootDir = candidateRoots.find((d) => fs.existsSync(path.join(d, "backend", "main.py"))) || "C:\\Users\\ajayb\\Documents\\Music_app";
    const cleanEnv = { ...process.env };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;

    const candidatePythons = [
      path.join(process.env.USERPROFILE || "", "AppData", "Local", "hermes", "hermes-agent", "venv", "Scripts", "python.exe"),
      "python",
    ];
    const pyExe = candidatePythons.find((p) => {
      try { return fs.existsSync(p); } catch (_) { return false; }
    }) || "python";

    pythonProcess = spawn(pyExe, ["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"], {
      cwd: rootDir,
      env: cleanEnv,
      detached: false,
      windowsHide: true,
      stdio: "ignore",
    });

    console.log("[NightWave] Auto-started backend engine (PID:", pythonProcess.pid, ")");

    setTimeout(() => {
      isSpawning = false;
    }, 3000);
  } catch (e) {
    console.warn("Could not auto-start python backend:", e);
    isSpawning = false;
  }
}

// Ensure Python FastAPI backend is running once on app start
function startPythonBackend() {
  const req = http.get("http://127.0.0.1:8000/api/health", (res) => {
    // Backend is already active
  });
  req.setTimeout(1500, () => {
    req.destroy();
    spawnBackend();
  });
  req.on("error", () => {
    spawnBackend();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#080810",
    title: "NightWave Music",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#080810",
      symbolColor: "#ffffff",
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows YouTube Iframe audio and local stream requests without CORS issues
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // Forward renderer console logs to terminal
  mainWindow.webContents.on("console-message", (event, level, message) => {
    console.log(`[Renderer]`, message);
  });

  // F12 toggles DevTools
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (process.env.DEBUG_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  const distHtml = path.join(__dirname, "..", "dist", "index.html");
  if (app.isPackaged || fs.existsSync(distHtml)) {
    mainWindow.loadFile(distHtml);
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  // Open any external links in user's default web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Graceful error logging
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("[NightWave] Page failed to load:", errorCode, errorDescription);
  });

  // Register Global Media Keys
  try {
    globalShortcut.register("MediaPlayPause", () => {
      mainWindow?.webContents.send("media-control", "play-pause");
    });
    globalShortcut.register("MediaNextTrack", () => {
      mainWindow?.webContents.send("media-control", "next");
    });
    globalShortcut.register("MediaPreviousTrack", () => {
      mainWindow?.webContents.send("media-control", "previous");
    });
  } catch (err) {
    console.warn("Global shortcut registration failed:", err);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Handle opening external links in system browser ─────────────────────────
ipcMain.on("open-external", (_, url) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    shell.openExternal(url);
  }
});

// ── Google / YouTube Music In-App Login ─────────────────────────────────────
ipcMain.handle("open-google-login", async () => {
  return new Promise((resolve) => {
    const FIREFOX_UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

    const authSession = session.fromPartition("persist:ytmusic");

    authSession.setUserAgent(FIREFOX_UA);

    // Strip client hints (Sec-CH-UA) that reveal Electron to Google
    authSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      headers["User-Agent"] = FIREFOX_UA;
      for (const h of Object.keys(headers)) {
        if (h.toLowerCase().startsWith("sec-ch-ua")) {
          delete headers[h];
        }
      }
      callback({ cancel: false, requestHeaders: headers });
    });

    const authWindow = new BrowserWindow({
      width: 520,
      height: 720,
      parent: mainWindow || undefined,
      modal: true,
      title: "Sign in with Google - YouTube Music",
      autoHideMenuBar: true,
      webPreferences: {
        partition: "persist:ytmusic",
        preload: path.join(__dirname, "auth-preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    authWindow.webContents.setUserAgent(FIREFOX_UA);

    const targetUrl =
      "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F";

    authWindow.loadURL(targetUrl, { userAgent: FIREFOX_UA });

    let completed = false;
    let inProgress = false;

    const checkCookies = async () => {
      if (completed || inProgress) return;
      try {
        const currentUrl = authWindow.webContents.getURL() || "";
        // Only extract cookies once user has actually arrived at music.youtube.com
        if (!currentUrl.includes("music.youtube.com")) {
          return;
        }

        const ytCookies = await authSession.cookies.get({});
        
        // Prioritize youtube.com cookies over google.com cookies for duplicate keys (e.g. SID, SAPISID, HSID)
        const cookieMap = new Map();
        for (const c of ytCookies.filter((c) => c.domain.includes("google.com") && !c.domain.includes("youtube.com"))) {
          cookieMap.set(c.name, c.value);
        }
        for (const c of ytCookies.filter((c) => c.domain.includes("youtube.com"))) {
          cookieMap.set(c.name, c.value);
        }

        const hasEssential = cookieMap.has("SAPISID") || cookieMap.has("__Secure-3PAPISID") || cookieMap.has("SID");

        if (hasEssential) {
          inProgress = true;
          const cookieHeader = Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

          const postData = JSON.stringify({
            headers: `cookie: ${cookieHeader}\nx-goog-authuser: 0\norigin: https://music.youtube.com`,
          });

          const req = http.request(
            {
              hostname: "127.0.0.1",
              port: 8000,
              path: "/api/user/connect",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
              },
            },
            (res) => {
              let body = "";
              res.on("data", (chunk) => { body += chunk; });
              res.on("end", () => {
                if (res.statusCode === 200) {
                  completed = true;
                  try { authWindow.close(); } catch (_) {}
                  resolve({ success: true, message: "Connected successfully!" });
                } else {
                  console.warn("[NightWave] Auth verify status:", res.statusCode, body);
                  inProgress = false;
                }
              });
            }
          );

          req.setTimeout(3500, () => {
            req.destroy();
            inProgress = false;
            spawnBackend();
          });

          req.on("error", (e) => {
            console.warn("[NightWave] Auth connection error:", e.message);
            inProgress = false;
            spawnBackend();
          });

          req.write(postData);
          req.end();
        }
      } catch (err) {
        inProgress = false;
      }
    };

    authWindow.webContents.on("did-finish-load", async () => {
      await checkCookies();
    });

    authWindow.webContents.on("did-navigate", async () => {
      await checkCookies();
    });

    const cookiePoll = setInterval(async () => {
      if (completed) {
        clearInterval(cookiePoll);
        return;
      }
      await checkCookies();
    }, 800);

    authWindow.on("closed", () => {
      clearInterval(cookiePoll);
      if (!completed) {
        resolve({ success: false, message: "Sign-in window closed by user" });
      }
    });
  });
});

// Window controls
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("window-close", () => mainWindow?.close());

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function killBackend() {
  if (pythonProcess && pythonProcess.pid) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", pythonProcess.pid.toString()], { windowsHide: true });
      } else {
        pythonProcess.kill("SIGTERM");
      }
    } catch (_) {}
    pythonProcess = null;
  }
}

app.on("before-quit", () => {
  killBackend();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  killBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
