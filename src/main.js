/**
 * eDEX-UI Main Process
 * Electron main process entry point.
 * Handles window creation, IPC, and app lifecycle.
 */

'use strict';

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference to prevent garbage collection
let mainWindow = null;

// Default configuration
const defaultConfig = {
    theme: 'tron',
    shell: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash'),
    shellArgs: [],
    TTYRows: 30,
    TTYCols: 100,
    fontSize: 17,
    fontFamily: 'Fira Code',
    opacity: 1.0,
    allowTransparency: false,
    workingDirectory: process.env.HOME || process.env.USERPROFILE || '~',
    keyboard: {
        ctrlAltBackspace: false
    }
};

/**
 * Load user config from disk, falling back to defaults.
 * @returns {Object} merged configuration object
 */
function loadConfig() {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            const userConfig = JSON.parse(raw);
            return Object.assign({}, defaultConfig, userConfig);
        }
    } catch (e) {
        console.warn('Failed to load config, using defaults:', e.message);
    }
    return Object.assign({}, defaultConfig);
}

/**
 * Create the main application window.
 */
function createWindow() {
    const config = loadConfig();
    const { width, height } = screen.getPrimaryDisplay().bounds;

    mainWindow = new BrowserWindow({
        width,
        height,
        x: 0,
        y: 0,
        frame: false,
        resizable: false,
        movable: false,
        fullscreen: true,
        backgroundColor: '#000000',
        transparent: config.allowTransparency,
        opacity: config.opacity,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '..', 'assets', 'icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Open DevTools only in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Pass config to renderer once ready
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('config', config);
    });
}

// IPC: allow renderer to request a config reload
ipcMain.on('request-config', (event) => {
    event.reply('config', loadConfig());
});

// IPC: allow renderer to trigger app quit
ipcMain.on('quit', () => {
    app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    // On macOS apps stay active until explicitly quit
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
