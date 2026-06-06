const express = require('express');
const cors = require('cors');
const { Client } = require('discord-rpc');

const app = express();
const port = 3000;
const clientId = '1373525022819225601'; // Discord application ID

let rpc = null;
let isRpcConnected = false;
let connectionAttempts = 0;
const maxRetries = 5;
const retryDelay = 3000; // 3 seconds

// Enhanced CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^http:\/\/localhost(:\d+)?$/i,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/i
    ];

    if (!origin || allowedOrigins.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS and middleware
app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log('Preflight request received from:', req.get('Origin'));
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.get('Origin') || 'unknown origin'}`);
  next();
});

// Initialize Discord RPC with retry logic
async function initializeRPC() {
  try {
    console.log(`🔗 Attempting to connect to Discord RPC (attempt ${connectionAttempts + 1}/${maxRetries})...`);
    
    if (rpc) {
      try {
        rpc.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    rpc = new Client({ transport: 'ipc' });
    
    // Set up event handlers before login
    rpc.on('ready', () => {
      isRpcConnected = true;
      connectionAttempts = 0;
      console.log('Discord RPC connected successfully!');
      console.log(' User:', rpc.user?.username || 'Unknown');
      console.log(' Application ID:', rpc.application?.id || clientId);
    });

    rpc.on('error', (error) => {
      console.error(' Discord RPC error:', error.message);
      isRpcConnected = false;
      
      if (error.message.includes('ENOENT')) {
        console.error(' Make sure Discord is running and logged in');
      }
    });

    rpc.on('disconnected', () => {
      console.log('Discord RPC disconnected');
      isRpcConnected = false;
      
      // Auto-reconnect after disconnection
      setTimeout(() => {
        if (connectionAttempts < maxRetries) {
          initializeRPC();
        }
      }, retryDelay);
    });

    // Attempt login
    await rpc.login({ clientId });
    
  } catch (error) {
    isRpcConnected = false;
    connectionAttempts++;
    
    console.error(` Failed to connect to Discord RPC (attempt ${connectionAttempts}):`, error.message);
    
    if (error.message.includes('ENOENT')) {
      console.error(' Make sure Discord is running and logged in');
    } else if (error.message.includes('RPC_CONNECTION_TIMEOUT')) {
      console.error(' Discord connection timed out - restart Discord and try again');
    } else if (error.message.includes('Cannot read properties of null')) {
      console.error(' Discord RPC initialization error - this is usually temporary');
    }
    
    // Retry connection
    if (connectionAttempts < maxRetries) {
      console.log(` Retrying in ${retryDelay/1000} seconds...`);
      setTimeout(initializeRPC, retryDelay);
    } else {
      console.error(' Max connection attempts reached. Starting server without Discord RPC.');
      console.error(' You can restart the server after Discord is running.');
      startServer();
    }
  }
}

// Start the Express server
function startServer() {
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`\nServer running on http://localhost:${port}`);
    console.log('CORS configured for browser extensions');
    console.log('\nAvailable endpoints:');
    console.log('   GET  /ping   - Health check');
    console.log('   POST /update - Update Discord presence');
    console.log('   POST /clear  - Clear Discord presence');
    console.log(`\n${isRpcConnected ? 'YES' : 'NO'} Discord RPC: ${isRpcConnected ? 'Connected' : 'Not Connected'}`);
    console.log('\n Ready to receive requests from browser extension\n');
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(` Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
    }
  });
}

// Health check endpoint
app.get('/ping', (req, res) => {
  console.log('Ping received from:', req.get('Origin') || 'unknown origin');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: Date.now(),
    server: 'Apple Music RPC Server',
    discord_connected: isRpcConnected,
    rpc_user: rpc?.user?.username || null
  });
});

// Discord RPC update endpoint
app.post('/update', async (req, res) => {
  try {
    console.log('Update request received:', req.body);
    
    const { title, artistName, currentTime, duration, isPlaying } = req.body || {};

    if (!req.body) {
      console.log('No data provided in request body');
      return res.status(400).json({ error: 'No data provided' });
    }

    if (!isRpcConnected || !rpc) {
      console.log('Discord RPC not connected');
      return res.status(503).json({ 
        error: 'Discord RPC not connected',
        suggestion: 'Make sure Discord is running and restart the server'
      });
    }

    const activity = {
      details: title || 'Unknown Song',
      state: artistName || 'Unknown Artist',
      largeImageKey: 'applemusic',
      largeImageText: 'Apple Music',
      smallImageKey: isPlaying ? 'play' : 'pause',
      smallImageText: isPlaying ? 'Playing' : 'Paused',
      instance: false
    };

    if (isPlaying && currentTime && duration) {
      const start = Date.now() - (currentTime * 1000);
      const end = start + (duration * 1000);
      activity.startTimestamp = Math.floor(start / 1000);
      activity.endTimestamp = Math.floor(end / 1000);
    }

    await rpc.setActivity(activity);
    console.log(' Discord presence updated:', {
      title: activity.details,
      artist: activity.state,
      playing: isPlaying
    });

    res.status(200).json({ 
      success: true, 
      activity: {
        title: activity.details,
        artist: activity.state,
        playing: isPlaying
      }
    });

  } catch (error) {
    console.error('Error updating presence:', error);
    
    // If RPC error, try to reconnect
    if (error.message.includes('RPC') || error.message.includes('connection')) {
      isRpcConnected = false;
      setTimeout(() => {
        if (connectionAttempts < maxRetries) {
          initializeRPC();
        }
      }, 1000);
    }
    
    res.status(500).json({ 
      error: 'Failed to update presence',
      details: error.message 
    });
  }
});

// Clear presence endpoint
app.post('/clear', async (req, res) => {
  try {
    if (isRpcConnected && rpc) {
      await rpc.clearActivity();
      console.log('Discord presence cleared');
      res.status(200).json({ success: true, message: 'Presence cleared' });
    } else {
      res.status(503).json({ error: 'Discord RPC not connected' });
    }
  } catch (error) {
    console.error('Error clearing presence:', error);
    res.status(500).json({ error: 'Failed to clear presence' });
  }
});

// Manual reconnect endpoint
app.post('/reconnect', async (req, res) => {
  console.log('Manual reconnect requested');
  connectionAttempts = 0;
  await initializeRPC();
  res.status(200).json({ 
    success: true, 
    message: 'Reconnection attempt initiated',
    connected: isRpcConnected
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down gracefully...');
  
  if (rpc && isRpcConnected) {
    rpc.clearActivity().then(() => {
      rpc.destroy();
      console.log('✅ Discord RPC disconnected');
      process.exit(0);
    }).catch(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log(' Received SIGTERM, shutting down...');
  if (rpc) {
    rpc.destroy();
  }
  process.exit(0);
});

// Start the application
console.log(' Apple Music Discord RPC Server Starting...');
console.log(' Checking Discord connection...');

// First start the server, then try to connect to Discord
startServer();

// Try to connect to Discord (with retries)
initializeRPC();
