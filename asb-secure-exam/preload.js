const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('examBridge', {
  requestExit:       () => ipcRenderer.send('request-exit'),
  onFocusLost:       (cb) => ipcRenderer.on('focus-lost',     () => cb()),
  onFocusRestored:   (cb) => ipcRenderer.on('focus-restored', () => cb()),
  onSecurityWarning: (cb) => ipcRenderer.on('security-warning', (_, msg) => cb(msg)),
});
