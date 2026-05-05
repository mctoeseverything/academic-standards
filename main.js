'use strict';

const {
  app,
  BrowserWindow,
  globalShortcut,
  session,
  screen,
  powerSaveBlocker,
  dialog,
  ipcMain,
  shell,
  clipboard,
} = require('electron');

const { execFile } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs   = require('fs');

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  KIOSK:              true,   // true = full OS kiosk, false = dev mode (resizable window)
  BLOCK_DEVTOOLS:     true,
  BLOCK_MULTI_SCREEN: true,   // refuse to launch if external display detected
  BLUR_AUTO_PAUSE:    true,   // auto-show overlay when window loses focus
  LOG_FILE:           path.join(app.getPath('userData'), 'exam-activity.log'),
  STUDENTS_FILE:      path.join(app.getPath('userData'), 'students.json'),
  EXAM_URL:           `file://${path.join(__dirname, 'index.html')}`,
};

let mainWindow      = null;
let powerBlockerId  = null;
let blurCount       = 0;
let devtoolsWarned  = false;

// ── Activity logger ───────────────────────────────────────
function log(event, detail = '') {
  const line = `[${new Date().toISOString()}] ${event}${detail ? ' | ' + detail : ''}\n`;
  try { fs.appendFileSync(CONFIG.LOG_FILE, line); } catch (_) {}
  console.log(line.trim());
}

function clearSystemClipboard() {
  try {
    clipboard.clear();
    clipboard.writeText('');
    log('CLIPBOARD_CLEARED');
  } catch (error) {
    log('CLIPBOARD_CLEAR_FAILED', error.message);
  }
}

function ensureStudentsStore() {
  if (!fs.existsSync(CONFIG.STUDENTS_FILE)) {
    fs.writeFileSync(CONFIG.STUDENTS_FILE, JSON.stringify({ students: [] }, null, 2));
  }
}

function readStudentsStore() {
  ensureStudentsStore();
  try {
    return JSON.parse(fs.readFileSync(CONFIG.STUDENTS_FILE, 'utf8'));
  } catch (_) {
    return { students: [] };
  }
}

function writeStudentsStore(store) {
  ensureStudentsStore();
  fs.writeFileSync(CONFIG.STUDENTS_FILE, JSON.stringify(store, null, 2));
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function sanitizeStudent(student) {
  return {
    id: student.id,
    fullName: student.fullName,
    username: student.username,
    createdAt: student.createdAt,
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, student) {
  const computed = crypto.scryptSync(String(password), student.passwordSalt, 64);
  const stored = Buffer.from(student.passwordHash, 'hex');
  return stored.length === computed.length && crypto.timingSafeEqual(stored, computed);
}

function minimizeOtherWindows() {
  if (!CONFIG.KIOSK || process.platform !== 'win32') return;

  execFile(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle', 'Hidden',
      '-Command',
      '(New-Object -ComObject Shell.Application).MinimizeAll()',
    ],
    (error) => {
      if (error) {
        log('OTHER_WINDOWS_MINIMIZE_FAILED', error.message);
        return;
      }
      log('OTHER_WINDOWS_MINIMIZED');
    }
  );
}

// ── Block every shortcut that could expose the OS ────────
function registerShortcuts() {
  const blocked = [
    // macOS
    'Command+Tab', 'Command+`', 'Command+Space', 'Command+Q',
    'Command+W', 'Command+M', 'Command+H', 'Command+Option+Escape',
    'Command+Shift+3', 'Command+Shift+4', 'Command+Shift+5',
    'Command+Control+Q', 'Command+Option+D',
    // Windows / Linux
    'Alt+Tab', 'Alt+F4', 'Super+D', 'Super+L', 'Super+Tab',
    'Ctrl+Alt+Delete', 'Ctrl+Escape', 'Meta',
    // Dev tools
    'F12', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C',
    'Command+Option+I', 'Command+Option+J', 'Command+Option+C',
    // Print / clipboard
    'PrintScreen', 'Ctrl+P', 'Command+P',
    'Ctrl+C', 'Ctrl+V', 'Ctrl+X',
    // Browser navigation
    'F5', 'Ctrl+R', 'Command+R', 'Ctrl+Shift+R',
    'Ctrl+U', 'Command+U',
    // Zoom
    'Ctrl+Plus', 'Ctrl+Minus', 'Ctrl+0',
    'Command+Plus', 'Command+Minus', 'Command+0',
  ];

  blocked.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        log('SHORTCUT_BLOCKED', shortcut);
      });
    } catch (_) {
      // Some shortcuts may not be registerable on all platforms — that's fine
    }
  });
}

// ── Network: block everything except local files ──────────
function lockdownNetwork() {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, callback) => {
      // Allow file:// and data: URIs; allow CDN scripts already bundled
      const url = details.url;
      const isLocal = url.startsWith('file://') || url.startsWith('data:');
      // Allow specific CDN hosts used by the exam (MathJax, Desmos, MathQuill, jQuery)
      const allowedHosts = [
        'cdn.jsdelivr.net',
        'cdnjs.cloudflare.com',
        'www.desmos.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com',
      ];
      const isAllowed = isLocal || allowedHosts.some(h => url.includes(h));
      if (!isAllowed) {
        log('NETWORK_BLOCKED', url.substring(0, 120));
      }
      callback({ cancel: !isAllowed });
    }
  );
}

// ── Multi-display check ───────────────────────────────────
function checkDisplays() {
  if (!CONFIG.BLOCK_MULTI_SCREEN) return true;
  const displays = screen.getAllDisplays();
  if (displays.length > 1) {
    dialog.showErrorBox(
      'External Display Detected',
      'This exam cannot be taken with an external monitor connected.\n\n' +
      'Please disconnect all external displays and restart the application.'
    );
    log('LAUNCH_BLOCKED', `${displays.length} displays detected`);
    app.quit();
    return false;
  }
  return true;
}

// ── Create the main window ────────────────────────────────
function createWindow() {
  if (!checkDisplays()) return;

  mainWindow = new BrowserWindow({
    fullscreen:       CONFIG.KIOSK,
    kiosk:            CONFIG.KIOSK,
    resizable:        !CONFIG.KIOSK,
    movable:          !CONFIG.KIOSK,
    minimizable:      false,
    maximizable:      false,
    closable:         false,        // prevents Alt+F4 closing without confirmation
    frame:            false,
    alwaysOnTop:      CONFIG.KIOSK,
    title:            'Academic Standards Board — Secure Exam',
    backgroundColor:  '#ffffff',
    webPreferences: {
      nodeIntegration:        false,
      contextIsolation:       true,
      sandbox:                true,
      devTools:               !CONFIG.BLOCK_DEVTOOLS,
      preload:                path.join(__dirname, 'preload.js'),
      // Disable features that could leak exam content
      webgl:                  false,
      plugins:                false,
      experimentalFeatures:   false,
      allowRunningInsecureContent: false,
    },
  });

  // Load the exam
  mainWindow.loadURL(CONFIG.EXAM_URL);
  log('EXAM_STARTED');

  // ── Block devtools from within the window ─────────────
  if (CONFIG.BLOCK_DEVTOOLS) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
      log('DEVTOOLS_BLOCKED');
    });
  }

  // ── Prevent new windows / popups ─────────────────────
  mainWindow.webContents.setWindowOpenHandler(() => {
    log('POPUP_BLOCKED');
    return { action: 'deny' };
  });

  // ── Prevent navigation away from the exam ─────────────
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      log('NAVIGATION_BLOCKED', url.substring(0, 120));
    }
  });

  // ── Focus / blur detection ────────────────────────────
  mainWindow.on('blur', () => {
    blurCount++;
    log('WINDOW_BLUR', `count=${blurCount}`);
    if (CONFIG.BLUR_AUTO_PAUSE) {
      // Tell the renderer to show its lockout overlay
      mainWindow.webContents.send('focus-lost');
    }
    // Force focus back immediately
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        if (CONFIG.KIOSK) mainWindow.setKiosk(true);
      }
    }, 200);
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send('focus-restored');
  });

  // ── Prevent closing without confirmation ─────────────
  mainWindow.on('close', (e) => {
    e.preventDefault();
    dialog.showMessageBox(mainWindow, {
      type:    'warning',
      title:   'Exit Exam?',
      message: 'Are you sure you want to exit?',
      detail:  'Your answers are saved, but the exam session will end.',
      buttons: ['Stay in Exam', 'Exit'],
      defaultId: 0,
      cancelId:  0,
    }).then(({ response }) => {
      if (response === 1) {
        log('EXAM_EXITED', 'user confirmed');
        mainWindow.destroy();
        app.quit();
      } else {
        log('EXIT_CANCELLED');
      }
    });
  });

  // ── Prevent right-click context menu ─────────────────
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
    log('CONTEXT_MENU_BLOCKED');
  });

  // ── Devtools size heuristic (fallback) ────────────────
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { width: ow } = mainWindow.getBounds();
    const cw = mainWindow.webContents.getOwnerBrowserWindow().getBounds().width;
    if (ow - cw > 160 && !devtoolsWarned) {
      devtoolsWarned = true;
      log('DEVTOOLS_SUSPECTED', `window=${ow} content=${cw}`);
      mainWindow.webContents.send('security-warning', 'DevTools detected');
    }
  }, 2000);
}

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(() => {
  // Prevent GPU process from showing system chrome
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

  lockdownNetwork();
  registerShortcuts();
  clearSystemClipboard();
  minimizeOtherWindows();

  // Keep screen awake
  powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  log('POWER_BLOCKER_STARTED', `id=${powerBlockerId}`);

  createWindow();

  // macOS: don't re-create window on activate if it exists
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Force single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log('DUPLICATE_INSTANCE_BLOCKED');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Clean shutdown
app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  if (powerBlockerId !== null) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  log('EXAM_SESSION_ENDED');
});

// On macOS, closing all windows shouldn't quit — keep the app alive
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC from renderer (exam app can request unlock for legitimate exit)
ipcMain.on('request-exit', () => {
  if (mainWindow) mainWindow.emit('close', { preventDefault: () => {} });
});

ipcMain.handle('students:create', async (_event, payload) => {
  const fullName = String(payload?.fullName || '').trim();
  const username = normalizeUsername(payload?.username);
  const password = String(payload?.password || '');

  if (!fullName || !username || !password) {
    throw new Error('Full name, username, and password are required.');
  }

  const store = readStudentsStore();
  if (store.students.some(student => student.username === username)) {
    throw new Error('That username is already in use.');
  }

  const passwordParts = hashPassword(password);
  const student = {
    id: crypto.randomUUID(),
    fullName,
    username,
    passwordSalt: passwordParts.salt,
    passwordHash: passwordParts.hash,
    createdAt: new Date().toISOString(),
  };

  store.students.push(student);
  writeStudentsStore(store);
  log('STUDENT_CREATED', username);
  return sanitizeStudent(student);
});

ipcMain.handle('students:sign-in', async (_event, payload) => {
  const username = normalizeUsername(payload?.username);
  const password = String(payload?.password || '');

  if (!username || !password) {
    throw new Error('Username and password are required.');
  }

  const store = readStudentsStore();
  const student = store.students.find(entry => entry.username === username);
  if (!student || !verifyPassword(password, student)) {
    throw new Error('Invalid username or password.');
  }

  log('STUDENT_SIGNED_IN', username);
  return sanitizeStudent(student);
});
