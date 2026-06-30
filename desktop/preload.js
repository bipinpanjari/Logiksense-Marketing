const { contextBridge, ipcRenderer } = require("electron");

const initialApiUrl = ipcRenderer.sendSync("get-api-url") || "http://localhost:3000/api";
const initialFrontendUrl = ipcRenderer.sendSync("get-frontend-url");
const initialMode = ipcRenderer.sendSync("get-connection-mode");

contextBridge.exposeInMainWorld("desktopEnv", {
  API_URL: initialApiUrl,
  FRONTEND_URL: initialFrontendUrl,
  CONNECTION_MODE: initialMode,
  setApiUrl: (url) => ipcRenderer.send("set-api-url", url),
  setFrontendUrl: (url) => ipcRenderer.send("set-frontend-url", url),
  saveWizardConfig: (mode, apiUrl, frontendUrl) => ipcRenderer.send("save-wizard-config", mode, apiUrl, frontendUrl),
  resetConnectionConfig: () => ipcRenderer.send("reset-connection-config"),
  reload: () => ipcRenderer.send("reload-window"),
  isDesktop: true
});
