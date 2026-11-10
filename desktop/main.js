//electron app configuration file


const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const APP_TITLE = 'Visualizer';
const APP_USER_MODEL_ID = 'xyz.hyndzia.visualizer';
const BACKEND_EXE = 'Visualizer.exe';
const BACKEND_PORT = 58989;
const MAIN_LOG = process.env.VISUALIZER_MAIN_LOG || path.join(os.tmpdir(), 'Visualizer-main.log');

let mainWindow = null;
let backendProcess = null;
let backendLog = null;
let backendPort = null;
let backendExit = null;
let backendError = null;
let appStarted = false;
let isQuitting = false;

function trace(message) {
    try {
        fs.appendFileSync(MAIN_LOG, new Date().toISOString() + ' ' + message + '\n');
    } catch (error) {
        // Logging must never stop the app from starting.
    }
}

trace('main.js loaded');

if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
}

const gotSingleInstanceLock = process.env.VISUALIZER_NO_SINGLE_INSTANCE === '1'
    ? true
    : app.requestSingleInstanceLock();
trace('single instance lock=' + gotSingleInstanceLock);

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    });

    app.whenReady()
        .then(() => {
            trace('app ready');
            startApplication();
        })
        .catch((error) => {
            trace('whenReady failed: ' + error.stack);
        });
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            isQuitting = true;
            stopBackend();
            app.exit(0);
        }
    });
    app.on('before-quit', () => {
        isQuitting = true;
        stopBackend();
    });
}

function dataDirectory() {
    return app.getPath('userData');
}

function backendLogPath() {
    return path.join(dataDirectory(), 'backend.log');
}

function backendExecutablePath() {
    const candidates = [
        path.join(process.resourcesPath || '', 'backend', BACKEND_EXE),
        path.join(__dirname, 'backend', BACKEND_EXE)
    ];

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate;
    }

    throw new Error('Backend executable was not found. Looked in:\n' + candidates.join('\n'));
}

function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once('error', () => {
            reject(new Error(
                'Port ' + BACKEND_PORT + ' is already in use. ' +
                'Close the other Visualizer instance or the application using this port.'
            ));
        });
        server.listen(BACKEND_PORT, '127.0.0.1', () => {
            server.close(() => resolve(BACKEND_PORT));
        });
    });
}

function checkServer(port) {
    return new Promise((resolve) => {
        const request = http.get({
            host: '127.0.0.1',
            port: port,
            path: '/',
            timeout: 1200
        }, (response) => {
            response.resume();
            resolve(response.statusCode === 200);
        });

        request.on('timeout', () => {
            request.destroy();
            resolve(false);
        });
        request.on('error', () => resolve(false));
    });
}

async function waitForServer(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (backendError) {
            throw new Error('The local server could not be started: ' + backendError.message);
        }
        if (backendExit) {
            throw new Error('The local server stopped before it was ready (exit code ' + backendExit.code + ').');
        }
        if (await checkServer(port)) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error('Timed out waiting for the local server on port ' + port + '.');
}

function startBackend(port) {
    const executable = backendExecutablePath();
    const workingDirectory = dataDirectory();
    fs.mkdirSync(workingDirectory, { recursive: true });
    trace('starting backend: ' + executable + ' on port ' + port);

    backendExit = null;
    backendError = null;
    backendLog = fs.createWriteStream(backendLogPath(), { flags: 'a' });
    backendLog.write('\n--- ' + new Date().toISOString() + ' starting ' + executable + ' on port ' + port + ' ---\n');

    const env = {
        ...process.env,
        VISUALIZER_NO_BROWSER: '1',
        VISUALIZER_PORT: String(port),
        VISUALIZER_DATA_DIR: workingDirectory
    };
    delete env.ELECTRON_RUN_AS_NODE;

    backendProcess = spawn(executable, [], {
        cwd: workingDirectory,
        env: env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    trace('backend pid=' + backendProcess.pid);

    backendProcess.stdout.on('data', (chunk) => backendLog.write(chunk));
    backendProcess.stderr.on('data', (chunk) => backendLog.write(chunk));

    backendProcess.on('error', (error) => {
        backendError = error;
        trace('backend error: ' + error.message);
        if (backendLog) backendLog.write('Backend error: ' + error.message + '\n');
    });

    backendProcess.on('exit', (code, signal) => {
        backendExit = { code: code, signal: signal };
        trace('backend exit code=' + code + ' signal=' + signal);
        if (backendLog) backendLog.write('--- backend exited with code ' + code + ' (signal ' + signal + ') ---\n');

        if (!isQuitting && appStarted) {
            dialog.showErrorBox(
                APP_TITLE,
                'The local visualizer server stopped unexpectedly.\n\n' +
                'Exit code: ' + code + '\n' +
                'Log: ' + backendLogPath()
            );
            app.quit();
        }
    });
}

function stopBackend() {
    if (!backendProcess) return;
    trace('stopping backend pid=' + backendProcess.pid);

    const pid = backendProcess.pid;
    backendProcess = null;

    if (backendLog) {
        backendLog.end();
        backendLog = null;
    }

    if (!pid) return;

    try {
        if (process.platform === 'win32') {
            spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
                windowsHide: true,
                timeout: 4000
            });
        } else {
            process.kill(pid, 'SIGTERM');
        }
    } catch (error) {
    }
}

function cleanUserAgent(webContents) {
    const ua = webContents.getUserAgent()
        .replace(/\sElectron\/[\d.]+/g, '')
        .replace(/\sVisualizerApp\/[\d.]+/g, '')
        .trim();

    webContents.setUserAgent(ua + ' VisualizerApp/1.0');
}

function createWindow() {
    trace('createWindow');
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        title: APP_TITLE,
        backgroundColor: '#121212',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            devTools: false,
            spellcheck: false,
            backgroundThrottling: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const localBase = backendPort ? 'http://127.0.0.1:' + backendPort + '/' : null;
        if (localBase && url.startsWith(localBase)) return;

        event.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const key = String(input.key || '').toLowerCase();
        const ctrl = input.control || input.meta;
        if (key === 'f12' ||
            (ctrl && input.shift && (key === 'i' || key === 'j' || key === 'c')) ||
            (ctrl && key === 'u')) {
            event.preventDefault();
        }
    });

    mainWindow.webContents.on('context-menu', (event) => {
        event.preventDefault();
    });

    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
        mainWindow.setTitle(APP_TITLE);
    });

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    cleanUserAgent(mainWindow.webContents);
    mainWindow.loadFile(path.join(__dirname, 'loading.html')).catch((error) => {
        trace('loading window failed: ' + error.stack);
        dialog.showErrorBox(APP_TITLE, 'Could not load the application window.\n\n' + error.message);
        app.quit();
    });
}

async function startApplication() {
    trace('startApplication');
    try {
        Menu.setApplicationMenu(null);
        createWindow();

        const port = await findFreePort();
        backendPort = port;
        trace('selected port ' + port);

        startBackend(port);
        trace('waiting for server');
        await waitForServer(port, 30000);
        trace('server ready');

        if (!mainWindow) return;
        await mainWindow.loadURL('http://127.0.0.1:' + port + '/');
        appStarted = true;
        trace('main window loaded');
    } catch (error) {
        trace('startup failed: ' + error.stack);
        dialog.showErrorBox(
            APP_TITLE,
            'Could not start the local visualizer.\n\n' +
            error.message + '\n\n' +
            'Log: ' + backendLogPath()
        );
        app.quit();
    }
}
