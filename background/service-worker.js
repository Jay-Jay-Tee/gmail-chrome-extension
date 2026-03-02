/* =====================================================
   SERVICE WORKER (Extension Brain)
===================================================== */

/* -------------------------------
   Utility: Get Active Gmail Tab
-------------------------------- */

async function getActiveGmailTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const tab = tabs[0];

  if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
    return null;
  }

  return tab;
}

/* -------------------------------
   Message Router
-------------------------------- */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  handleMessage(message, sender, sendResponse);

  // Required for async responses
  return true;
});

/* -------------------------------
   Message Handler
-------------------------------- */

async function handleMessage(message, sender, sendResponse) {
  try {

    switch (message.type) {

      /* ===============================
         INSERT TEMPLATE
      =============================== */
      case "INSERT_TEMPLATE": {
        const tab = await getActiveGmailTab();

        if (!tab) {
          sendResponse({ success: false, error: "No active Gmail tab" });
          return;
        }

        await chrome.tabs.sendMessage(tab.id, {
          type: "INSERT_TEMPLATE",
          text: message.text
        });

        sendResponse({ success: true });
        break;
      }

      /* ===============================
         FUTURE: API REQUEST
      =============================== */
      case "CALL_API": {
        const { payload } = message;

        const { apiKey } = await chrome.storage.sync.get(["apiKey"]);

        if (!apiKey) {
          sendResponse({ success: false, error: "API key not set" });
          return;
        }

        const result = await callExternalAPI(apiKey, payload);

        sendResponse({ success: true, data: result });
        break;
      }

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }

  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

/* -------------------------------
   External API Stub
-------------------------------- */

async function callExternalAPI(apiKey, payload) {

  // Example placeholder
  const response = await fetch("https://api.example.com/endpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}