import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initializeAnalytics } from './analytics.js';
import { cleanOidcCallbackParameters } from './auth.js';
import 'lxgw-wenkai-gb-web/lxgwwenkaigb-regular/result.css';
import 'lxgw-wenkai-gb-web/lxgwwenkaigb-medium/result.css';
import './styles.css';

cleanOidcCallbackParameters();
initializeAnalytics();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
