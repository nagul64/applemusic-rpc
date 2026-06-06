const SERVER_URL = 'http://127.0.0.1:3000';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING_SERVER') {
    fetch(`${SERVER_URL}/ping`)
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
      
    return true; // Keeps the message channel open for async response
  }
  
  if (message.type === 'UPDATE_PRESENCE') {
    fetch(`${SERVER_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.data)
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
      
    return true;
  }
});