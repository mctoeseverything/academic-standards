const { app, BrowserWindow, globalShortcut, session, powerSaveBlocker, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV = process.env.KIOSK === 'false';
const LOG = path.join(app.getPath('userData'), 'exam-activity.log');

const BLOCKED_GLOBAL_SHORTCUTS = [
  'Alt+Tab',
  'Alt+F4',
  'Alt+Escape',
  'Alt+Space',
  'CommandOrControl+Escape',
  'CommandOrControl+Shift+Escape',
  'Super',
  'Super+D',
  'Super+E',
  'Super+L',
  'Super+M',
  'Super+R',
  'Super+Tab',
  'Super+V',
  'Super+X',
  'Super+Space',
  'F1',
  'F5',
  'F11',
  'F12',
  'PrintScreen',
];

const BLOCKED_INPUT_SIGNATURES = new Set([
  'alt+tab',
  'alt+f4',
  'alt+escape',
  'alt+space',
  'ctrl+escape',
  'ctrl+shift+escape',
  'ctrl+c',
  'ctrl+p',
  'ctrl+r',
  'ctrl+u',
  'ctrl+v',
  'ctrl+x',
  'ctrl+w',
  'ctrl+shift+c',
  'ctrl+shift+i',
  'ctrl+shift+j',
  'f1',
  'f5',
  'f11',
  'f12',
  'printscreen',
  'meta',
  'meta+d',
  'meta+e',
  'meta+l',
  'meta+m',
  'meta+r',
  'meta+space',
  'meta+tab',
  'meta+v',
  'meta+x',
]);

function log(event, detail) {
  const line = `[${new Date().toISOString()}] ${event}${detail ? ` | ${detail}` : ''}\n`;
  try {
    fs.appendFileSync(LOG, line);
  } catch (_) {}
  console.log(line.trim());
}

function registerShortcuts() {
  for (const accelerator of BLOCKED_GLOBAL_SHORTCUTS) {
    try {
      globalShortcut.register(accelerator, () => log('SHORTCUT_BLOCKED', accelerator));
    } catch (_) {}
  }
}

function normalizeInput(input) {
  const parts = [];

  if (input.control) parts.push('ctrl');
  if (input.alt) parts.push('alt');
  if (input.shift) parts.push('shift');
  if (input.meta) parts.push('meta');

  const key = (input.key || '').toLowerCase();
  if (key) {
    parts.push(key === 'control' ? 'ctrl' : key);
  }

  return parts.join('+');
}

function shouldBlockInput(input) {
  const signature = normalizeInput(input);
  if (BLOCKED_INPUT_SIGNATURES.has(signature)) {
    return signature;
  }

  if (input.meta) {
    return signature || 'meta';
  }

  return null;
}

function enforceWindowSecurity(win) {
  if (DEV || win.isDestroyed()) {
    return;
  }

  if (!win.isKiosk()) win.setKiosk(true);
  if (!win.isFullScreen()) win.setFullScreen(true);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.focus();
}

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: !DEV,
    kiosk: !DEV,
    resizable: DEV,
    minimizable: false,
    maximizable: false,
    closable: false,
    movable: DEV,
    frame: false,
    alwaysOnTop: !DEV,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: DEV,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.removeMenu();
  win.setMenuBarVisibility(false);
  win.setContentProtection(true);
  win.loadFile('index.html');
  log('EXAM_STARTED', DEV ? 'DEV MODE' : 'KIOSK MODE');

  if (!DEV) {
    enforceWindowSecurity(win);

    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });

    win.webContents.on('before-input-event', (event, input) => {
      const blocked = shouldBlockInput(input);
      if (blocked) {
        event.preventDefault();
        log('INPUT_BLOCKED', blocked);
      }
    });
  }

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      log('NAVIGATION_BLOCKED', url);
    }
  });

  win.on('blur', () => {
    log('WINDOW_BLUR');
    win.webContents.send('focus-lost');
    setTimeout(() => {
      if (!win.isDestroyed()) {
        enforceWindowSecurity(win);
      }
    }, 150);
  });

  win.on('focus', () => {
    win.webContents.send('focus-restored');
    enforceWindowSecurity(win);
  });

  win.on('minimize', event => {
    event.preventDefault();
    log('MINIMIZE_BLOCKED');
    enforceWindowSecurity(win);
  });

  win.on('leave-full-screen', () => {
    log('FULLSCREEN_RESTORED');
    enforceWindowSecurity(win);
  });

  win.on('close', event => {
    event.preventDefault();
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Exit Exam?',
      message: 'Are you sure you want to exit?',
      detail: 'Your answers are saved but the exam session will end.',
      buttons: ['Stay in Exam', 'Exit'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 1) {
        log('EXAM_EXITED');
        win.destroy();
        app.quit();
      } else {
        enforceWindowSecurity(win);
      }
    });
  });

  win.webContents.on('context-menu', event => event.preventDefault());
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const url = details.url;
    const ok = url.startsWith('file://') ||
      url.startsWith('data:') ||
      ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'www.desmos.com', 'fonts.googleapis.com', 'fonts.gstatic.com']
        .some(host => url.includes(host));

    if (!ok) {
      log('NETWORK_BLOCKED', url.substring(0, 100));
    }

    callback({ cancel: !ok });
  });

  registerShortcuts();
  powerSaveBlocker.start('prevent-display-sleep');
  createWindow();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

ipcMain.on('request-exit', () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

app.on('browser-window-created', (_event, window) => {
  window.removeMenu();
  window.setMenuBarVisibility(false);
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  log('EXAM_ENDED');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
