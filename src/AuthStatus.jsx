import React, { useCallback, useEffect, useState } from 'react';

import { fetchAuthState, getLoginHref, submitGlobalLogout } from './auth.js';

export default function AuthStatus() {
  const [auth, setAuth] = useState({ state: 'loading' });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setAuth({ state: 'loading' });
    const next = await fetchAuthState();
    setAuth(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    fetchAuthState().then(next => {
      if (active) setAuth(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const logout = async () => {
    setBusy(true);
    const latest = await fetchAuthState();
    if (latest.state === 'authenticated') {
      submitGlobalLogout(latest.csrfToken);
      return;
    }
    setAuth(latest);
    setBusy(false);
  };

  if (auth.state === 'disabled') return null;

  if (auth.state === 'loading') {
    return (
      <div className="auth-status is-loading" role="status" aria-label="正在读取 PACT 身份">
        <span className="auth-status-dot" aria-hidden="true" />
        <span>PACT</span>
      </div>
    );
  }

  if (auth.state === 'anonymous') {
    return (
      <a className="auth-status auth-status-action" href={getLoginHref()}>
        <span className="auth-status-dot" aria-hidden="true" />
        <span>登录 PACT</span>
      </a>
    );
  }

  if (auth.state === 'denied') {
    return (
      <div className="auth-status is-denied" title="当前 PACT 账户未获得博客身份权限">
        <span className="auth-status-dot" aria-hidden="true" />
        <span>未获授权</span>
      </div>
    );
  }

  if (auth.state === 'unavailable') {
    return (
      <button className="auth-status auth-status-action is-unavailable" type="button" onClick={refresh}>
        <span className="auth-status-dot" aria-hidden="true" />
        <span>身份不可用</span>
      </button>
    );
  }

  const name = auth.user.name || 'PACT 用户';
  return (
    <div className="auth-status is-authenticated" title={name}>
      <span className="auth-avatar" aria-hidden="true">{name.slice(0, 1)}</span>
      <span className="auth-name">{name}</span>
      <button type="button" className="auth-logout" onClick={logout} disabled={busy} aria-label="退出全部 PACT 分站">
        {busy ? '…' : '退出'}
      </button>
    </div>
  );
}
