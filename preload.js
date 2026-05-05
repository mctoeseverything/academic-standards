'use strict';

/**
 * preload.js
 * Runs in the renderer context but with access to Node/Electron APIs.
 * Exposes a minimal, safe API to the exam page via contextBridge.
 * The exam (index.html / script.js) must NOT require Node — this is the only bridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('examBridge', {
  // Renderer → Main
  requestExit: () => ipcRenderer.send('request-exit'),

  // Main → Renderer event subscriptions
  onFocusLost:       (cb) => ipcRenderer.on('focus-lost',       () => cb()),
  onFocusRestored:   (cb) => ipcRenderer.on('focus-restored',   () => cb()),
  onSecurityWarning: (cb) => ipcRenderer.on('security-warning', (_, msg) => cb(msg)),
});