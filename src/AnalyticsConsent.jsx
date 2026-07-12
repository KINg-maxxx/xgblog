import React, { useState } from 'react';

import { getAnalyticsConsent, setAnalyticsConsent } from './analytics.js';

const PANEL_ID = 'analytics-consent-panel';

export default function AnalyticsConsent() {
  const [choice, setChoice] = useState(() => getAnalyticsConsent());
  const [open, setOpen] = useState(choice === null);
  const [error, setError] = useState('');

  const choose = nextChoice => {
    if (!setAnalyticsConsent(nextChoice)) {
      setError('无法保存设置，Analytics 保持关闭。');
      return;
    }
    setChoice(nextChoice);
    setError('');
    setOpen(false);
  };

  return (
    <>
      <button
        className="analytics-settings-trigger"
        type="button"
        aria-controls={PANEL_ID}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Analytics settings
      </button>
      {open && (
        <section
          className="analytics-consent-panel"
          id={PANEL_ID}
          role="dialog"
          aria-labelledby="analytics-consent-title"
        >
          <div className="analytics-consent-copy">
            <span>Privacy</span>
            <h2 id="analytics-consent-title">Analytics preference</h2>
            <p>仅在你允许后连接 Google Analytics；必要功能不受选择影响。</p>
            {error && <p className="analytics-consent-error" role="alert">{error}</p>}
          </div>
          <div className="analytics-consent-actions">
            <button type="button" className="analytics-consent-allow" onClick={() => choose('granted')}>
              Allow analytics
            </button>
            <button type="button" onClick={() => choose('denied')}>
              Necessary only
            </button>
          </div>
          {choice !== null && (
            <button
              className="analytics-consent-close"
              type="button"
              aria-label="Close analytics settings"
              onClick={() => setOpen(false)}
            >
              X
            </button>
          )}
        </section>
      )}
    </>
  );
}
