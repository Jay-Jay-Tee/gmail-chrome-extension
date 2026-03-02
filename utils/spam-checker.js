// ============================================================
// InboxZero AI — Spam Checker (Dev 2)
// Pure logic — no AI API needed for this one.
// Scores emails 0-100 based on patterns, keywords, domains.
// ============================================================

// -------------------------------------------------------
// Known spam / promo domains
// -------------------------------------------------------
const SPAM_DOMAINS = [
  'mailchimp.com', 'sendgrid.net', 'constantcontact.com',
  'promo-mail.net', 'bulk-email.net', 'noreply-promo.com',
  'notifications.amazon.com', 'email.flipkart.com',
  'deals.myntra.com', 'offers.zomato.com',
  'newsletter.', 'no-reply.', 'donotreply.',
  'marketing.', 'noreply.', 'bounce.',
];

// -------------------------------------------------------
// High-risk spam keyword patterns
// -------------------------------------------------------
const HIGH_RISK_WORDS = [
  'you have been selected', 'you are a winner', 'claim your prize',
  'click here immediately', 'verify your account now', 'your account will be suspended',
  'wire transfer', 'western union', 'send money', 'bitcoin',
  'nigerian prince', 'inheritance', 'lottery winner',
  'free gift card', 'congratulations you won',
  'your paypal has been limited', 'confirm your identity',
  'act now before it expires', 'limited time offer expires',
  'make money fast', 'work from home earn',
  'enlarge', 'pharmacy', 'prescription drugs',
  'password reset' // only spam if combined with other signals
];

const MEDIUM_RISK_WORDS = [
  'free', 'winner', 'selected', 'urgent', 'important notice',
  'click here', 'verify', 'confirm', 'update your', 'limited offer',
  'don\'t miss', 'exclusive deal', 'special promotion',
  'unsubscribe', 'you\'ve been chosen', 'dear friend',
  'dear customer', 'dear user', 'hello dear',
  'discount', 'sale ends', 'buy now', 'order now',
  'risk free', 'no cost', 'no obligation',
];

// -------------------------------------------------------
// Suspicious URL patterns in email body
// -------------------------------------------------------
const SUSPICIOUS_URL_PATTERNS = [
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,  // raw IP address URLs
  /bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly/,        // URL shorteners
  /[a-z0-9]{20,}\.(com|net|org)/,                     // very long random domain names
];

// -------------------------------------------------------
// Main Spam Check Function
// Returns: { score: 0-100, flagged: bool, flags: string[], level: "safe"|"suspicious"|"danger" }
// -------------------------------------------------------
export async function checkSpam(senderEmail = '', subject = '', bodyText = '') {
  let score = 0;
  const flags = [];

  const senderLower = senderEmail.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const bodyLower = bodyText.toLowerCase();
  const fullText = `${subjectLower} ${bodyLower}`;

  // ---- 1. Sender domain checks ----
  const spamDomainMatch = SPAM_DOMAINS.find(d => senderLower.includes(d));
  if (spamDomainMatch) {
    score += 20;
    flags.push(`Bulk email sender (${spamDomainMatch})`);
  }

  // Sender has no domain (just a name, no @)
  if (!senderLower.includes('@')) {
    score += 15;
    flags.push('Sender has no email domain');
  }

  // Sender domain is very new / random looking (lots of numbers)
  if (/\d{4,}/.test(senderLower.split('@')[1] || '')) {
    score += 10;
    flags.push('Suspicious sender domain (contains many numbers)');
  }

  // ---- 2. High-risk keyword check ----
  HIGH_RISK_WORDS.forEach(word => {
    if (fullText.includes(word)) {
      score += 20;
      flags.push(`High-risk phrase: "${word}"`);
    }
  });

  // ---- 3. Medium-risk keyword check (max +30 total from this section) ----
  let mediumHits = 0;
  MEDIUM_RISK_WORDS.forEach(word => {
    if (fullText.includes(word)) mediumHits++;
  });
  if (mediumHits > 0) {
    const mediumScore = Math.min(mediumHits * 8, 30);
    score += mediumScore;
    if (mediumHits >= 3) flags.push(`Multiple promotional keywords (${mediumHits} found)`);
    else if (mediumHits > 0) flags.push(`Promotional language detected`);
  }

  // ---- 4. Subject line patterns ----
  if (/^(re:|fwd:)/i.test(subjectLower) === false && subjectLower === subjectLower.toUpperCase() && subjectLower.length > 5) {
    score += 15;
    flags.push('Subject is ALL CAPS (common spam pattern)');
  }

  if ((subjectLower.match(/!/g) || []).length >= 2) {
    score += 10;
    flags.push('Multiple exclamation marks in subject');
  }

  if (/\$\d+|\d+%\s*off|\d+\s*free/i.test(subject)) {
    score += 15;
    flags.push('Money or discount amounts in subject line');
  }

  // ---- 5. Suspicious URLs in body ----
  SUSPICIOUS_URL_PATTERNS.forEach(pattern => {
    if (pattern.test(bodyText)) {
      score += 20;
      flags.push('Suspicious URL pattern detected');
    }
  });

  // ---- 6. Body structure checks ----
  const linkCount = (bodyText.match(/https?:\/\//g) || []).length;
  if (linkCount > 5) {
    score += 10;
    flags.push(`Many links in email (${linkCount} found)`);
  }

  // Very short body with link — classic phishing
  if (bodyText.trim().length < 100 && linkCount > 0) {
    score += 15;
    flags.push('Short email with link (possible phishing)');
  }

  // ---- Cap at 100 ----
  score = Math.min(score, 100);

  // Get user's threshold from storage (default 60)
  const threshold = await getSpamThreshold();

  // Determine level
  let level;
  if (score < 30) level = 'safe';
  else if (score < threshold) level = 'suspicious';
  else level = 'danger';

  return {
    score,
    flagged: score >= threshold,
    level,
    flags: [...new Set(flags)], // deduplicate
  };
}

// -------------------------------------------------------
// Read spam threshold from storage (set by Dev 3's popup)
// -------------------------------------------------------
async function getSpamThreshold() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['spamThreshold'], data => {
      resolve(data.spamThreshold ?? 60);
    });
  });
}