import React, { useCallback, useEffect, useState } from 'react';

function formatCommentDate(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return String(createdAt).slice(0, 10);
  return date.toLocaleDateString('en-CA'); // 本地时区的 YYYY-MM-DD
}

// 问题收集/评论区。
// 第一次留言需要昵称+邮箱（邮箱仅用作注册用途，不公开）；
// 服务端按 IP 记住身份，之后同一 IP 留言不再询问。
export default function Feedback({ pageId = 'site', compact = false }) {
  const [comments, setComments] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments?page=${encodeURIComponent(pageId)}`);
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      setComments(data.comments || []);
      setIdentity(data.identity || null);
      setStatus('ready');
    } catch {
      setStatus('unavailable');
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice('');

    try {
      const payload = {
        page: pageId,
        content,
        anonymous,
        visibility: isPrivate ? 'private' : 'public',
      };
      if (!identity) {
        payload.nickname = nickname;
        payload.email = email;
      }
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        // IP 变化后服务端会要求重新注册身份，把昵称/邮箱输入框还给用户
        if (data.needIdentity) setIdentity(null);
        setNotice(data.error || '提交失败，请稍后再试。');
        return;
      }
      // 私密留言不进公开列表，只发给站长
      if (data.comment.visibility !== 'private') {
        setComments(previous => [data.comment, ...previous]);
      }
      setIdentity(data.identity);
      setContent('');
      setNotice(data.comment.visibility === 'private' ? '已私密发送给站长，不会公开显示。' : '已收到，谢谢！');
    } catch {
      setNotice('网络异常，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'unavailable') {
    return (
      <div className="feedback-box feedback-unavailable">
        <p>评论服务暂不可用。你也可以通过页面底部的联系方式直接找到我。</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'feedback-box feedback-compact' : 'feedback-box'}>
      <form className="feedback-form" onSubmit={submit}>
        {identity ? (
          <p className="feedback-identity">
            以 <strong>{identity.nickname}</strong> 的身份留言（本设备网络已记住你，无需再填昵称）
          </p>
        ) : (
          <div className="feedback-identity-fields">
            <label>
              昵称
              <input
                value={nickname}
                onChange={event => setNickname(event.target.value)}
                maxLength={24}
                placeholder="怎么称呼你"
                required
              />
            </label>
            <label>
              邮箱
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <p className="feedback-hint">邮箱仅用作注册用途，不会公开，也不会用来发邮件打扰你。只需填这一次。</p>
          </div>
        )}
        <label className="feedback-content-label">
          {identity ? '想说的话' : '想说的话 / 想提的问题'}
          <textarea
            value={content}
            onChange={event => setContent(event.target.value)}
            rows={compact ? 3 : 4}
            maxLength={2000}
            placeholder="工具用着有问题、有想要的功能，或者任何想说的，都可以写在这里。"
            required
          />
        </label>
        <div className="feedback-options">
          <label className="feedback-check">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={event => setAnonymous(event.target.checked)}
            />
            <span>匿名显示（列表里不显示我的昵称）</span>
          </label>
          <label className="feedback-check">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={event => setIsPrivate(event.target.checked)}
            />
            <span>仅站长可见（不公开显示）</span>
          </label>
          <p className="feedback-hint feedback-options-hint">
            两者都不影响站长看到你的真实身份，只改变这条留言对其他访客的展示方式。
          </p>
        </div>
        <div className="feedback-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? '提交中…' : '提交'}
          </button>
          {notice && <span className="feedback-notice" role="status">{notice}</span>}
        </div>
      </form>

      <div className="feedback-list" aria-label="留言列表">
        {status === 'loading' && <p className="feedback-empty">正在加载留言…</p>}
        {status === 'ready' && !comments.length && (
          <p className="feedback-empty">还没有留言，欢迎做第一个提问的人。</p>
        )}
        {comments.map(comment => (
          <div className="feedback-item" key={comment.id}>
            <div className="feedback-item-meta">
              <strong>{comment.nickname}</strong>
              <span>{formatCommentDate(comment.createdAt)}</span>
            </div>
            <p>{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
