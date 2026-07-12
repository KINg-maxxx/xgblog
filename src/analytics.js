export const GOOGLE_ANALYTICS_ID = 'G-4MT03MBVYL';
const ANALYTICS_CONSENT_KEY = 'wxg_analytics_consent';
const PRODUCTION_HOSTS = new Set(['xgblog.pages.dev', 'blog.periopact.cn']);
const CONSENT_CHOICES = new Set(['granted', 'denied']);

function storageFor(windowRef, storageRef) {
  if (storageRef) return storageRef;
  try {
    return windowRef.localStorage;
  } catch {
    return null;
  }
}

export function getAnalyticsConsent({ windowRef = window, storageRef } = {}) {
  try {
    const choice = storageFor(windowRef, storageRef)?.getItem(ANALYTICS_CONSENT_KEY);
    return CONSENT_CHOICES.has(choice) ? choice : null;
  } catch {
    return null;
  }
}

export function initializeAnalytics({ documentRef = document, windowRef = window, storageRef } = {}) {
  const hostname = windowRef.location?.hostname?.toLowerCase();
  if (
    windowRef.location?.protocol !== 'https:'
    || !PRODUCTION_HOSTS.has(hostname)
    || getAnalyticsConsent({ windowRef, storageRef }) !== 'granted'
    || windowRef.__wxgAnalyticsInitialized
  ) return false;

  windowRef.__wxgAnalyticsInitialized = true;
  windowRef.dataLayer = windowRef.dataLayer || [];
  windowRef.gtag = function gtag() {
    windowRef.dataLayer.push(arguments);
  };

  const script = documentRef.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  documentRef.head.appendChild(script);

  windowRef.gtag('js', new Date());
  windowRef.gtag('config', GOOGLE_ANALYTICS_ID);
  return true;
}

export function setAnalyticsConsent(choice, options = {}) {
  if (!CONSENT_CHOICES.has(choice)) return false;
  const windowRef = options.windowRef || window;
  const storage = storageFor(windowRef, options.storageRef);
  try {
    storage?.setItem(ANALYTICS_CONSENT_KEY, choice);
    if (storage?.getItem(ANALYTICS_CONSENT_KEY) !== choice) return false;
  } catch {
    return false;
  }

  if (windowRef.__wxgAnalyticsInitialized) {
    windowRef.gtag?.('consent', 'update', { analytics_storage: choice });
  } else if (choice === 'granted') {
    initializeAnalytics({ ...options, windowRef, storageRef: storage });
  }
  return true;
}
