// ============================================================
// InboxZero AI — Gmail Parser
// Extracts email data and finds Gmail DOM elements
// ============================================================

const SUBJECT_SELECTORS = ["h2.hP", "h2[data-thread-perm-id]", ".hP", "[data-legacy-thread-id] h2", "h2"];
const BODY_SELECTORS = [".a3s.aiL", ".a3s", ".ii.gt .a3s", "div[data-message-id] .a3s", ".nH .a3s"];
const SENDER_SELECTORS = ["span[email]", ".gD[email]", ".go span[email]", ".go .gD"];
const TOOLBAR_SELECTOR = ".G-atb, .iH, [gh=tm]";
const COMPOSE_BODY_SELECTOR = ".Am.Al.editable";
const COMPOSE_TOOLBAR_SELECTOR = ".aoD.hl, .btC, .gU.Up";

function firstMatch(selectors, root = document) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

// Extract Gmail message ID from URL hash
// e.g. #inbox/18d4f3a9c2b1 → 18d4f3a9c2b1
export function getMessageIdFromUrl() {
  const hash = window.location.hash.replace('#', '');
  const parts = hash.split('/');
  if (parts.length >= 2 && parts[1].length > 6) {
    return parts[1];
  }
  // Also check for thread view: #all/FMfcgz...
  return null;
}

export function extractEmailData() {
  const subjectElement = firstMatch(SUBJECT_SELECTORS);
  const bodyElement = firstMatch(BODY_SELECTORS);
  const senderElement = firstMatch(SENDER_SELECTORS);

  const subject = normalizeText(subjectElement?.innerText || subjectElement?.textContent || "");
  const bodyText = normalizeText(bodyElement?.innerText || bodyElement?.textContent || "");
  const sender =
    normalizeText(senderElement?.getAttribute("email") || "") ||
    normalizeText(senderElement?.innerText || senderElement?.textContent || "");

  const isOpenEmailView = Boolean(subjectElement || bodyElement);

  return {
    subject, sender, bodyText,
    emailText: [subject, bodyText].filter(Boolean).join("\n\n"),
    isOpenEmailView,
    messageId: getMessageIdFromUrl(),
    subjectElement,
    bodyElement,
    senderElement
  };
}

export function getEmailToolbar() {
  return document.querySelector(TOOLBAR_SELECTOR);
}

export function getComposeBody() {
  return document.querySelector(COMPOSE_BODY_SELECTOR);
}

export function getComposeToolbar() {
  const composeBody = getComposeBody();
  if (!composeBody) return null;
  const composeWindow = composeBody.closest(".AD, .nH, [role='dialog']");
  if (!composeWindow) return null;

  const sendButton = composeWindow.querySelector("[data-tooltip='Send'], [aria-label='Send'], .T-I.J-J5-Ji.aoO");
  if (sendButton) {
    const toolbar = sendButton.closest(".aoD, .btC, .gU");
    if (toolbar) return toolbar;
  }
  const all = composeWindow.querySelectorAll(COMPOSE_TOOLBAR_SELECTOR);
  return all.length ? all[all.length - 1] : null;
}