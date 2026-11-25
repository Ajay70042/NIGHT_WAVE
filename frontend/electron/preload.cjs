const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  openGoogleLogin: () => ipcRenderer.invoke("open-google-login"),
  openExternal: (url) => ipcRenderer.send("open-external", url),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  onMediaKey: (callback) => {
    ipcRenderer.on("media-control", (_, action) => callback(action));
  },
});
