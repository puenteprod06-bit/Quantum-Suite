const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

// ── Configuración ─────────────────────────────────────────────────────────────
const IS_DEV = process.argv.includes('--dev') || !app.isPackaged;
const APP_VERSION = app.getVersion();

// ── Variables globales ────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let fredProxyServer = null;
const FRED_PROXY_PORT = 8765;

// ── Auto-updater config ───────────────────────────────────────────────────────
autoUpdater.autoDownload = false;       // pregunta antes de descargar
autoUpdater.autoInstallOnAppQuit = true;

// ═══════════════════════════════════════════════════════════════════════════════
// PROXY FRED LOCAL (evita CORS sin necesitar server.py externo)
// ═══════════════════════════════════════════════════════════════════════════════
function startFredProxy() {
    fredProxyServer = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);

        // Headers CORS para todos los requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', 'application/json');

        if (parsedUrl.pathname === '/fred-proxy') {
            const targetUrl = parsedUrl.query.url;

            if (!targetUrl || !targetUrl.includes('stlouisfed.org')) {
                res.writeHead(403);
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }

            const fredReq = https.get(targetUrl, {
                headers: { 'User-Agent': 'SolaroTrade-Desktop/1.0' }
            }, (fredRes) => {
                let data = '';
                fredRes.on('data', chunk => data += chunk);
                fredRes.on('end', () => {
                    res.writeHead(200);
                    res.end(data);
                });
            });

            fredReq.on('error', (err) => {
                res.writeHead(502);
                res.end(JSON.stringify({ error: err.message }));
            });

            fredReq.setTimeout(20000, () => {
                fredReq.destroy();
                res.writeHead(504);
                res.end(JSON.stringify({ error: 'Timeout' }));
            });

        } else if (parsedUrl.pathname === '/health') {
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok', version: APP_VERSION }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    });

    fredProxyServer.listen(FRED_PROXY_PORT, '127.0.0.1', () => {
        console.log(`[FRED Proxy] Corriendo en http://localhost:${FRED_PROXY_PORT}`);
    });

    fredProxyServer.on('error', (err) => {
        console.error('[FRED Proxy] Error:', err.message);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENTANA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0a0a0a',
        title: 'SolaroTrade Quantum Suite',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),

        // Titlebar customizado con frame desactivado
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0d0d0d',
            symbolColor: '#f5a623',
            height: 36
        },

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,

            // Permitir CORS para FRED API vía nuestro proxy local
            webSecurity: true,
        },

        show: false,   // evitar flash blanco al arrancar
    });

    // Cargar la app
    const htmlPath = path.join(__dirname, 'src', 'index.html');
    mainWindow.loadFile(htmlPath);

    // Mostrar cuando esté lista (evita flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
    });

    // Manejar links externos en el navegador del sistema
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRAY (icono en la bandeja del sistema)
// ═══════════════════════════════════════════════════════════════════════════════
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray.png');
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'SolaroTrade Quantum Suite', enabled: false },
        { type: 'separator' },
        {
            label: 'Mostrar ventana',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        {
            label: 'Buscar actualizaciones',
            click: () => autoUpdater.checkForUpdates()
        },
        { type: 'separator' },
        {
            label: `Versión ${APP_VERSION}`,
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Salir',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip(`SolaroTrade Quantum Suite v${APP_VERSION}`);
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-UPDATER — Eventos
// ═══════════════════════════════════════════════════════════════════════════════
function setupAutoUpdater() {
    // Verificar actualizaciones al iniciar (solo en producción)
    if (!IS_DEV) {
        setTimeout(() => autoUpdater.checkForUpdates(), 5000);
        // Verificar cada 4 horas
        setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
    }

    autoUpdater.on('checking-for-update', () => {
        sendToRenderer('update-status', { status: 'checking', message: 'Verificando actualizaciones...' });
    });

    autoUpdater.on('update-available', (info) => {
        sendToRenderer('update-status', {
            status: 'available',
            message: `Nueva versión disponible: v${info.version}`,
            version: info.version,
            releaseNotes: info.releaseNotes
        });

        // Preguntar al usuario si quiere descargar
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Actualización disponible',
            message: `SolaroTrade Quantum Suite v${info.version}`,
            detail: `Hay una nueva versión disponible (actualmente en v${APP_VERSION}).\n¿Querés descargarla ahora?`,
            buttons: ['Descargar ahora', 'Luego'],
            defaultId: 0,
            cancelId: 1,
            icon: path.join(__dirname, 'assets', 'icon.png')
        }).then(({ response }) => {
            if (response === 0) autoUpdater.downloadUpdate();
        });
    });

    autoUpdater.on('update-not-available', () => {
        sendToRenderer('update-status', {
            status: 'up-to-date',
            message: `La aplicación está actualizada (v${APP_VERSION})`
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        const msg = `Descargando... ${progress.percent.toFixed(0)}% (${formatBytes(progress.transferred)}/${formatBytes(progress.total)})`;
        sendToRenderer('update-status', {
            status: 'downloading',
            message: msg,
            percent: progress.percent
        });
        mainWindow?.setProgressBar(progress.percent / 100);
    });

    autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.setProgressBar(-1);
        sendToRenderer('update-status', {
            status: 'downloaded',
            message: `v${info.version} descargada. Se instalará al cerrar la app.`
        });

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Actualización lista',
            message: `SolaroTrade v${info.version} descargada`,
            detail: 'La actualización se instalará cuando cierres la aplicación.\n¿Querés instalarla ahora?',
            buttons: ['Instalar ahora', 'Al cerrar'],
            defaultId: 0
        }).then(({ response }) => {
            if (response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    });

    autoUpdater.on('error', (err) => {
        sendToRenderer('update-status', {
            status: 'error',
            message: `Error al actualizar: ${err.message}`
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC — Comunicación renderer ↔ main
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.handle('get-app-info', () => ({
    version: APP_VERSION,
    isDev: IS_DEV,
    platform: process.platform,
    fredProxyUrl: `http://localhost:${FRED_PROXY_PORT}`
}));

ipcMain.handle('check-update', () => {
    if (!IS_DEV) return autoUpdater.checkForUpdates();
    return { message: 'Auto-updater no disponible en modo dev' };
});

ipcMain.handle('open-external', (_, url) => {
    shell.openExternal(url);
});

ipcMain.handle('minimize-window', () => mainWindow?.minimize());
ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.handle('close-window', () => mainWindow?.close());

// ── Helpers ───────────────────────────────────────────────────────────────────
function sendToRenderer(channel, data) {
    if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════
app.whenReady().then(() => {
    startFredProxy();
    createWindow();
    createTray();
    setupAutoUpdater();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    app.isQuiting = true;
    fredProxyServer?.close();
});

// Evitar múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}
