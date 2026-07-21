const { contextBridge, ipcRenderer } = require('electron');

// ── API segura expuesta al renderer (index.html) ──────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
    // Info de la app
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),

    // Actualizaciones
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (_, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('update-status');
    },

    // Ventana
    minimize: () => ipcRenderer.invoke('minimize-window'),
    maximize: () => ipcRenderer.invoke('maximize-window'),
    close:    () => ipcRenderer.invoke('close-window'),

    // Links externos
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Plataforma
    platform: process.platform,
});
