# Apple Music Discord RPC

A simple, lightweight integration that displays your currently playing Apple Music (Web) track on your Discord profile as a Rich Presence activity.

This project uses a two-part system:

1. **Browser Extension (Manifest V3):** Scrapes playback data from `music.apple.com`.
2. **Local Node.js Server:** Bridges the browser data to your local Discord desktop client.

## Features

- Displays current song title and artist
- Shows play/pause status icons
- Displays a live tracking timestamp (elapsed/remaining time)
- Automatically reconnects if Discord is closed and reopened

## Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine
- [Discord Desktop Client](https://discord.com/download) installed and running
- A Chromium-based browser (Chrome, Brave, Edge, Opera)

---

## Installation & Setup

### 1. Start the Local Server

The server acts as a secure bridge between your browser and Discord.

1. Clone or download this repository.
2. Open your terminal and navigate to the project directory:
   ```bash
   cd path/to/applemusic-rpc
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```

Keep this terminal window open in the background while you want the Rich Presence to run.

### 2. Install the Browser Extension

1. Open your browser and navigate to the extensions page (e.g., `chrome://extensions/`).
2. Toggle **Developer mode** on (usually in the top-right corner).
3. Click **Load unpacked**.
4. Select the project folder containing the `manifest.json` file.

---

## Usage

1. Ensure the Discord desktop app is open.
2. Ensure the local Node.js server is running (`node server.js`).
3. Open [music.apple.com](https://music.apple.com) in your browser.
4. Start playing a song — check your Discord profile to see your Rich Presence update!

---

## Troubleshooting

**Activity isn't showing up**
Ensure Discord is open *before* starting the local Node.js server. If the server throws connection errors, restart `server.js`.

**Not updating instantly**
The extension polls for changes every 5 seconds to remain lightweight, so give it a few seconds to reflect pauses or skips.

**Server port in use**
Ensure nothing else on your machine is running on port `3000`.
