window.addEventListener('DOMContentLoaded', () => {
  // Elements
  const deviceStatusValue = document.getElementById('device-status-value');
  const deviceSelect = document.getElementById('device-select');
  const refreshDevicesBtn = document.getElementById('refresh-devices');
  const mappingSelect = document.getElementById('mapping-select');
  const maxVibrationSlider = document.getElementById('max-vibration');
  const maxVibrationValue = document.getElementById('max-vibration-value');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const liveDataDiv = document.getElementById('live-data');
  const notificationDiv = document.getElementById('notification');
  const exitBtn = document.getElementById('exit-btn');

  let connectedDevice = null;
  let running = false;
  let deviceList = [];

  // Helper: Show notification
  function showNotification(msg, timeout = 3000) {
    notificationDiv.textContent = msg;
    notificationDiv.classList.add('show');
    setTimeout(() => notificationDiv.classList.remove('show'), timeout);
  }

  // Enable/disable controls based on state
  function updateControls() {
    const deviceConnected = !!connectedDevice;
    deviceSelect.disabled = !deviceList.length || running;
    refreshDevicesBtn.disabled = running;
    mappingSelect.disabled = running || !deviceConnected;
    maxVibrationSlider.disabled = running || !deviceConnected;
    startBtn.disabled = running || !deviceConnected;
    stopBtn.disabled = !running;
  }

  // Populate device select
  async function populateDevices() {
    deviceSelect.innerHTML = '';
    deviceList = await window.electron.getDevices();
    deviceList.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev.id;
      opt.textContent = dev.name;
      deviceSelect.appendChild(opt);
    });
    if (deviceList.length > 0) {
      deviceSelect.value = deviceList[0].id;
      await connectToDevice(deviceList[0].id);
    } else {
      connectedDevice = null;
      deviceStatusValue.textContent = 'No devices found';
    }
    updateControls();
  }

  // Refresh devices
  async function refreshDevices() {
    deviceStatusValue.textContent = 'Disconnected';
    connectedDevice = null;
    await window.electron.refreshDevices();
    await populateDevices();
    showNotification('Device list refreshed');
    updateControls();
  }

  // Connect to device
  async function connectToDevice(deviceId) {
    connectedDevice = await window.electron.connectDevice(deviceId);
    deviceStatusValue.textContent = connectedDevice ? `Connected to ${connectedDevice.name}` : 'Disconnected';
    updateControls();
    showNotification(connectedDevice ? `Connected to ${connectedDevice.name}` : 'Disconnected');
  }

  deviceSelect.addEventListener('change', async () => {
    await connectToDevice(deviceSelect.value);
  });

  refreshDevicesBtn.addEventListener('click', refreshDevices);

  // Max vibration slider
  maxVibrationSlider.addEventListener('input', () => {
    maxVibrationValue.textContent = maxVibrationSlider.value;
  });

  // Start/Stop logic
  startBtn.addEventListener('click', async () => {
    if (!connectedDevice) {
      showNotification('Please select a device first!');
      return;
    }
    running = true;
    updateControls();
    await window.electron.start(mappingSelect.value, maxVibrationSlider.value);
  });

  stopBtn.addEventListener('click', async () => {
    running = false;
    updateControls();
    await window.electron.stop();
    liveDataDiv.textContent = 'Live telemetry and vibration will appear here.';
  });

  // Listen for telemetry updates
  window.electron.onTelemetry((data) => {
    liveDataDiv.textContent = `Device: ${data.device || 'N/A'}\nMapping: ${data.mapping}\nTelemetry: ${data.telemetry.toFixed(2)}\nVibration: ${data.vibration}`;
  });

  // Listen for notifications
  window.electron.onNotification((msg) => {
    showNotification(msg);
    // Handle device disconnect or error notifications
    if (msg.includes('disconnected') || msg.includes('not running') || msg.includes('not found')) {
      running = false;
      connectedDevice = null;
      deviceStatusValue.textContent = 'Disconnected';
      populateDevices();
    }
    updateControls();
  });

  exitBtn.addEventListener('click', () => {
    if (window.electron && window.electron.exitApp) {
      window.electron.exitApp();
    } else {
      window.close(); // fallback
    }
  });

  // Initial setup
  populateDevices();
  maxVibrationValue.textContent = maxVibrationSlider.value;
  stopBtn.disabled = true;
  updateControls();
}); 