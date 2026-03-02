// ============================================================
// InboxZero AI — Background Service Worker (Dev 2)
// This is the brain. All AI calls go through here.
// Content scripts CANNOT call external APIs, so we do it here.
// ============================================================

import { summarizeEmail, categorizeEmail } from '../utils/ai.js';
import { checkSpam } from '../utils/spam-checker.js';

// -------------------------------------------------------
// Message Router — listens to messages from content.js
// -------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[InboxZero] Message received:', message.type);

  switch (message.type) {

    case 'SUMMARIZE':
      summarizeEmail(message.text)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // IMPORTANT: keeps message channel open for async response

    case 'CATEGORIZE':
      categorizeEmail(message.text, message.sender)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SPAM_CHECK':
      checkSpam(message.sender, message.subject, message.text)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'FULL_ANALYZE':
      // Runs all 3 checks at once — used when email is first opened
      Promise.all([
        summarizeEmail(message.text),
        categorizeEmail(message.text, message.sender),
        checkSpam(message.sender, message.subject, message.text)
      ])
        .then(([summary, category, spam]) => {
          sendResponse({ success: true, summary, category, spam });
          // Track stats in storage
          incrementStat('emailsAnalyzed');
          if (spam.flagged) incrementStat('spamDetected');
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    
    case 'GET_TEMPLATES':
        chrome.storage.sync.get(['templates'], (data) => {
            sendResponse({ templates: data.templates || [] });
        });
        return true;

    case 'GET_SETTINGS':
      chrome.storage.sync.get(['autoSummarize', 'autoCategory', 'spamAlerts', 'spamThreshold'], (data) => {
        sendResponse({
          autoSummarize: data.autoSummarize ?? true,
          autoCategory: data.autoCategory ?? true,
          spamAlerts: data.spamAlerts ?? true,
          spamThreshold: data.spamThreshold ?? 60,
        });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
  }
});

// -------------------------------------------------------
// Stats Helper — increments counters for popup dashboard
// -------------------------------------------------------
function incrementStat(key) {
  chrome.storage.local.get([key, 'lastReset'], (data) => {
    const now = Date.now();
    const lastReset = data.lastReset || 0;
    const dayMs = 24 * 60 * 60 * 1000;

    // Reset counts daily
    if (now - lastReset > dayMs) {
      chrome.storage.local.set({ emailsAnalyzed: 0, spamDetected: 0, lastReset: now });
      return;
    }

    const current = data[key] || 0;
    chrome.storage.local.set({ [key]: current + 1 });
  });
}

// -------------------------------------------------------
// Extension Install — set defaults
// -------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  console.log('[InboxZero] Extension installed. Setting defaults...');
  chrome.storage.sync.set({
    autoSummarize: true,
    autoCategory: true,
    spamAlerts: true,
    spamThreshold: 60,
    templates: [
      {
        id: '1',
        name: 'Quick Acknowledgement',
        body: 'Hi,\n\nThank you for reaching out. I have received your email and will get back to you shortly.\n\nBest regards'
      },
      {
        id: '2',
        name: 'Meeting Request',
        body: 'Hi,\n\nI would love to connect. Are you available for a quick call this week? Please let me know your preferred time.\n\nBest regards'
      }
    ]
  });
  chrome.storage.local.set({ emailsAnalyzed: 0, spamDetected: 0, lastReset: Date.now() });
});