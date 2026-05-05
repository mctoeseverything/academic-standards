'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('examBridge', {
  requestExit: () => ipcRenderer.send('request-exit'),
  createStudent: (payload) => ipcRenderer.invoke('students:create', payload),
  signInStudent: (payload) => ipcRenderer.invoke('students:sign-in', payload),
  onFocusLost: (cb) => ipcRenderer.on('focus-lost', () => cb()),
  onFocusRestored: (cb) => ipcRenderer.on('focus-restored', () => cb()),
  onSecurityWarning: (cb) => ipcRenderer.on('security-warning', (_event, msg) => cb(msg)),
});
