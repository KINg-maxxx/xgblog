export const GOOGLE_ANALYTICS_ID = 'G-4MT03MBVYL';

export function initializeAnalytics({ documentRef = document, windowRef = window } = {}) {
  if (windowRef.location?.protocol !== 'https:' || windowRef.__wxgAnalyticsInitialized) return false;

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
