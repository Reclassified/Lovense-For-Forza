# Forza Buttplug Controller

A modern Electron desktop app to sync Buttplug-compatible toys with Forza Motorsport and Forza Horizon telemetry.

## Features

- Beautiful, user-friendly desktop GUI (no web browser needed)
- Device selection, connection, and live status
- Telemetry mapping (RPM, speed, rumble, etc.)
- Max vibration control
- Live telemetry and vibration display
- Robust error handling and notifications
- Portable Windows EXE build (no installer required)

## Requirements

- [Intiface Central](https://intiface.com/) (Buttplug server) running on your PC
- Forza Motorsport 7, Forza Horizon 4, or Forza Horizon 5 with "Data Out" enabled
- Windows 10/11

## Installation & Running

1. **Download the portable EXE** from the [Releases](https://github.com/yourusername/yourrepo/releases) page (or build it yourself, see below).
2. **Run Intiface Central** and connect your toy.
3. **Start Forza** and enable "Data Out" in HUD & Gameplay settings.
4. **Run the EXE**. The GUI will guide you through device selection and telemetry mapping.

## Building a Portable EXE (for developers)

1. Clone this repo and install dependencies:
   ```sh
   npm install
   ```
2. Build the portable EXE:
   ```sh
   npm run dist
   ```
   The EXE will be in the `dist/` folder.

## Usage

- Select your device and telemetry mapping.
- Adjust max vibration as desired.
- Click **Start** to begin syncing with Forza telemetry.
- Click **Stop** or **Exit** to stop.

## Troubleshooting

- **No devices found?**  
  Make sure Intiface Central is running and your toy is connected.
- **Forza not detected?**  
  Ensure "Data Out" is enabled and the correct port is set in Forza.
- **App won't start?**  
  Try running as administrator or check for missing dependencies.

## Credits

- Forked and modernized from [Lat3xKitty/lovense-forza](https://github.com/Lat3xKitty/lovense-forza)
- Uses [Buttplug](https://buttplug.io/) and [Intiface Central](https://intiface.com/)

## License

[ISC](LICENSE)
