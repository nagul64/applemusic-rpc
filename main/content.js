
(() => {
  console.log('[Content] Apple Music RPC Content Script loaded');
  
  // Check if we're on Apple Music
  if (!window.location.href.includes('music.apple.com')) {
    console.log('[Content] Not on Apple Music, exiting');
    return;
  }

  const UPDATE_INTERVAL = 5000;
  let lastSentData = null;
  let serverAvailable = false;

  function getSongInfo() {
    let isPlaying = false;
    let title = null;
    let artist = null;
    let currentTime = 0;
    let duration = 0;

    console.log('[Content] Getting song info...');

    // Try Media Session API first 
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      const metadata = navigator.mediaSession.metadata;
      title = metadata.title || null;
      artist = metadata.artist || null;
      console.log('[Content] Media Session API found:', { title, artist });

      // Check if any audio/video element is playing 
      const mediaElements = [...document.querySelectorAll('audio, video')];
      const playingMedia = mediaElements.find(
        (media) => !media.paused && media.readyState > 2
      );
      if (playingMedia) {
        isPlaying = true;
        currentTime = playingMedia.currentTime || 0;
        duration = playingMedia.duration || 0;
        console.log('[Content] Found playing media:', { isPlaying, currentTime, duration });
      }
    }

    // Fallback: Use DOM queries 
    if (!title || !artist) {
      console.log('[Content] Trying DOM fallback - looking for .lcd-meta-line__fragment');
      
      //key selector
      const fragments = document.querySelectorAll('.lcd-meta-line__fragment');
      console.log('[Content] Found', fragments.length, 'fragments');
      
      if (fragments.length >= 2) {
        title = fragments[0].textContent.trim();
        artist = fragments[1].textContent.trim();
        console.log('[Content] DOM fragments found - Title:', title, 'Artist:', artist);
      } else if (fragments.length === 1) {
        title = fragments[0].textContent.trim();
        artist = 'Unknown Artist';
        console.log('[Content] Only one fragment found - Title:', title);
      }
    }

    // Fallback for playback state 
    if (!isPlaying) {
      console.log('[Content] Checking audio elements for playback state...');
      const audios = document.querySelectorAll('audio');
      for (const audio of audios) {
        if (!audio.paused && audio.readyState > 2) {
          isPlaying = true;
          currentTime = audio.currentTime || 0;
          duration = audio.duration || 0;
          console.log('[Content] Found playing audio element');
          break;
        }
      }
    }

    const result = {
      isPlaying,
      title: title || 'Unknown Song',
      artist: artist || 'Unknown Artist',
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
    };

    console.log('[Content] Final song info:', result);
    return result;
  }

  /**
   * Check server via background script
   */
  async function checkServer() {
    try {
      console.log('[Content] Checking server via background script...');
      const response = await chrome.runtime.sendMessage({ type: 'PING_SERVER' });
      serverAvailable = response && response.success;
      console.log('[Content] Server check result:', serverAvailable);
    } catch (error) {
      console.error('[Content] Server check failed:', error);
      serverAvailable = false;
    }
  }

  /**
   * Send song info via background script
   */
  async function sendSongInfo(songInfo) {
    if (!serverAvailable) {
      console.warn('[Content] Server not available, skipping send');
      return;
    }

    try {
      console.log('[Content] Sending song info via background script:', songInfo);
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_PRESENCE',
        data: songInfo
      });

      if (response && response.success) {
        console.log('[Content] Successfully sent update');
        lastSentData = songInfo;
      } else {
        console.error('[Content] Failed to send update:', response);
        serverAvailable = false;
      }
    } catch (error) {
      console.error('[Content] Error sending update:', error);
      serverAvailable = false;
    }
  }

  /**
   * Main update function 
   */
  async function updateLoop() {
    // Check server if not available
    if (!serverAvailable) {
      await checkServer();
      if (!serverAvailable) {
        console.log('[Content] Server still not available, skipping update');
        return;
      }
    }

    const songInfo = getSongInfo();

    // Only send if song is playing 
    if (songInfo.isPlaying) {
      console.log('[Content] Song is playing, sending update');
      await sendSongInfo(songInfo);
    } else {
      console.log('[Content] No song playing, skipping update');
    }
  }

  // Initialize
  async function init() {
    console.log('[Content] Initializing...');
    
    // Initial server check
    await checkServer();
    
    // Start periodic updates 
    setInterval(updateLoop, UPDATE_INTERVAL);
    
    console.log('[Content] Initialization complete - checking every', UPDATE_INTERVAL, 'ms');
  }

  // Start initialization
  init();
})();
