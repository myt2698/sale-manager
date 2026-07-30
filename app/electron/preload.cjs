const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  loadState: () => ipcRenderer.invoke("desktop:load-state"),
  saveState: (state) => ipcRenderer.invoke("desktop:save-state", state),
  getInfo: () => ipcRenderer.invoke("desktop:info"),
  openDataDir: () => ipcRenderer.invoke("desktop:open-data-dir"),
  createBackup: () => ipcRenderer.invoke("desktop:backup"),
  restoreBackup: () => ipcRenderer.invoke("desktop:restore"),
  saveExport: (payload) => ipcRenderer.invoke("desktop:save-export", payload),
});
