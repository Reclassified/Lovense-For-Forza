const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Device actions
  getDevices: () => ipcRenderer.invoke('get-devices'),
  connectDevice: (deviceId) => ipcRenderer.invoke('connect-device', deviceId),
  refreshDevices: () => ipcRenderer.invoke('refresh-devices'),
  // Telemetry actions
  start: (mapping, maxVibration) => ipcRenderer.invoke('start', mapping, maxVibration),
  stop: () => ipcRenderer.invoke('stop'),
  // Listen for live telemetry/vibration updates
  onTelemetry: (callback) => ipcRenderer.on('telemetry', (event, data) => callback(data)),
  // Listen for notifications
  onNotification: (callback) => ipcRenderer.on('notification', (event, msg) => callback(msg)),
  // Exit app
  exitApp: () => ipcRenderer.invoke('exit-app'),
}); 