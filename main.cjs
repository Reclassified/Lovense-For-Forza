const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ForzaJS = require('forza.js');
const pkg = require('buttplug');
const { ButtplugClient, ButtplugNodeWebsocketClientConnector } = pkg;

const BUTTPLUG_SERVER_URL = "ws://127.0.0.1:12345";
const SCAN_TIMEOUT_MS = 5000;
const TELEMETRY_THROTTLE_MS = 100;
const MAX_VIBRATION = 20;

let client = null;
let forza = null;
let devices = [];
let connectedDevice = null;
let selectedVibrationOption = 'rpm';
let maxVibrationIntensity = 20;
let telemetryInterval = null;
let lastVibration = 0;
let buttplugConnected = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Forza Buttplug Controller',
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers with real logic and error handling ---
ipcMain.handle('get-devices', async () => {
  try {
    await ensureButtplugConnected();
    return devices.map(d => ({ id: d.index, name: d.name }));
  } catch (err) {
    notifyRenderer('Buttplug/Intiface server not running or connection failed.');
    return [];
  }
});

ipcMain.handle('refresh-devices', async () => {
  try {
    await ensureButtplugConnected();
    await client.startScanning();
    await new Promise(resolve => setTimeout(resolve, SCAN_TIMEOUT_MS));
    await client.stopScanning();
    devices = client.devices;
    return devices.map(d => ({ id: d.index, name: d.name }));
  } catch (err) {
    notifyRenderer('Failed to refresh devices: ' + err.message);
    return [];
  }
});

ipcMain.handle('connect-device', async (event, deviceId) => {
  try {
    await ensureButtplugConnected();
    connectedDevice = devices.find(d => d.index == deviceId) || null;
    if (!connectedDevice) {
      notifyRenderer('Device not found or disconnected.');
      return null;
    }
    // Listen for device disconnect
    connectedDevice.on('disconnect', () => {
      connectedDevice = null;
      notifyRenderer('Device disconnected. Please select a new device.');
      // Optionally, refresh device list
      refreshDevicesAndNotify();
    });
    return { id: connectedDevice.index, name: connectedDevice.name };
  } catch (err) {
    notifyRenderer('Failed to connect to device: ' + err.message);
    return null;
  }
});

ipcMain.handle('start', async (event, mapping, maxVibration) => {
  if (!connectedDevice) {
    notifyRenderer('No device connected.');
    return;
  }
  selectedVibrationOption = mapping;
  maxVibrationIntensity = Number(maxVibration);
  try {
    if (!forza) {
      forza = new ForzaJS.default();
      await forza.loadGames();
      forza.startAllGameSockets();
    }
    const win = BrowserWindow.getAllWindows()[0];
    forza.on('telemetry', throttle((data) => {
      const vibration = calculateVibrationIntensity(data);
      sendVibration(vibration);
      win.webContents.send('telemetry', {
        mapping: selectedVibrationOption,
        telemetry: getTelemetryValue(data, selectedVibrationOption),
        vibration,
        device: connectedDevice ? connectedDevice.name : null
      });
    }, TELEMETRY_THROTTLE_MS));
    win.webContents.send('notification', 'Started!');
  } catch (err) {
    notifyRenderer('Failed to start telemetry: ' + err.message);
  }
});

ipcMain.handle('stop', async () => {
  await sendVibration(0);
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.send('notification', 'Stopped');
});

ipcMain.handle('exit-app', () => {
  app.quit();
});

// --- Helper Functions ---
async function ensureButtplugConnected() {
  if (!client || !buttplugConnected) {
    try {
      const connector = new ButtplugNodeWebsocketClientConnector(BUTTPLUG_SERVER_URL);
      client = new ButtplugClient("Forza Buttplug Client");
      await client.connect(connector);
      buttplugConnected = true;
      await client.startScanning();
      await new Promise(resolve => setTimeout(resolve, SCAN_TIMEOUT_MS));
      await client.stopScanning();
      devices = client.devices;
      // Listen for device disconnects globally
      client.on('deviceremoved', () => {
        devices = client.devices;
        if (connectedDevice && !devices.find(d => d.index === connectedDevice.index)) {
          connectedDevice = null;
          notifyRenderer('Device disconnected. Please select a new device.');
          refreshDevicesAndNotify();
        }
      });
    } catch (err) {
      buttplugConnected = false;
      throw err;
    }
  }
}

function notifyRenderer(msg) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('notification', msg);
}

async function refreshDevicesAndNotify() {
  try {
    await client.startScanning();
    await new Promise(resolve => setTimeout(resolve, SCAN_TIMEOUT_MS));
    await client.stopScanning();
    devices = client.devices;
    // Optionally, notify renderer to refresh device list
    // (renderer will call get-devices on next UI action)
  } catch (err) {
    notifyRenderer('Failed to refresh devices: ' + err.message);
  }
}

function calculateVibrationIntensity(data) {
  if (data.isRaceOn === 0) return 0;
  let vibration = 0;
  switch (selectedVibrationOption) {
    case 'rpm':
      vibration = (data.currentEngineRpm - data.engineIdleRpm) / (data.engineMaxRpm - data.engineIdleRpm);
      break;
    case 'rumble-average':
      vibration = ((data.surfaceRumbleFrontLeft +
        data.surfaceRumbleFrontRight +
        data.surfaceRumbleRearLeft +
        data.surfaceRumbleRearRight) / 4) * 1.666;
      break;
    case 'speed':
      vibration = data.speed / 100;
      break;
    case 'power':
      vibration = Math.abs(data.power) / 1000000;
      break;
    case 'torque':
      vibration = Math.abs(data.torque) / 1000;
      break;
    case 'brake':
      vibration = data.brake / 255;
      break;
    case 'accel':
      vibration = data.accel / 255;
      break;
  }
  return Math.min(Math.round(vibration * maxVibrationIntensity), maxVibrationIntensity);
}

function getTelemetryValue(data, mapping) {
  switch (mapping) {
    case 'rpm':
      return (data.currentEngineRpm - data.engineIdleRpm) / (data.engineMaxRpm - data.engineIdleRpm) * 100;
    case 'rumble-average':
      return ((data.surfaceRumbleFrontLeft +
        data.surfaceRumbleFrontRight +
        data.surfaceRumbleRearLeft +
        data.surfaceRumbleRearRight) / 4) * 1.666 * 10;
    case 'speed':
      return data.speed;
    case 'power':
      return Math.abs(data.power);
    case 'torque':
      return Math.abs(data.torque);
    case 'brake':
      return data.brake;
    case 'accel':
      return data.accel;
    default:
      return 0;
  }
}

async function sendVibration(vibration) {
  if (!connectedDevice) return;
  if (vibration !== lastVibration) {
    lastVibration = vibration;
    const vibrationPercentage = vibration / MAX_VIBRATION;
    try {
      await connectedDevice.vibrate(vibrationPercentage);
    } catch (error) {
      notifyRenderer('Error sending vibration: ' + error.message);
    }
  }
}

function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
} 