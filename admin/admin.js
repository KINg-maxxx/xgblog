const fields = {
  originalSlug: document.querySelector('#originalSlug'),
  title: document.querySelector('#title'),
  date: document.querySelector('#date'),
  category: document.querySelector('#category'),
  excerpt: document.querySelector('#excerpt'),
  body: document.querySelector('#body'),
};

const CATEGORIES = ['全部', '随笔', '技术专栏', '学术进度'];

// 与网站正文渲染保持一致：GFM + 正文标题整体下移一级（# → <h2>）。
if (window.marked && typeof window.marked.use === 'function') {
  window.marked.use({
    gfm: true,
    walkTokens(token) {
      if (token.type === 'heading') token.depth = Math.min(token.depth + 1, 6);
    },
  });
}

const postList = document.querySelector('#postList');
const categoryFilter = document.querySelector('#categoryFilter');
const preview = document.querySelector('#preview');
const previewTitle = document.querySelector('#previewTitle');
const previewMeta = document.querySelector('#previewMeta');
const previewExcerpt = document.querySelector('#previewExcerpt');
const statusLine = document.querySelector('#status');
const deleteButton = document.querySelector('#deletePost');
const publishButton = document.querySelector('#publishPost');

const editorView = document.querySelector('#editorView');
const inboxView = document.querySelector('#inboxView');
const timelineView = document.querySelector('#timelineView');
const tabEditor = document.querySelector('#tabEditor');
const tabInbox = document.querySelector('#tabInbox');
const tabTimeline = document.querySelector('#tabTimeline');
const timelineList = document.querySelector('#timelineList');
const timelineStatus = document.querySelector('#timelineStatus');
const publishTimelineButton = document.querySelector('#publishTimeline');
const inboxCount = document.querySelector('#inboxCount');
const inboxStatus = document.querySelector('#inboxStatus');
const commentList = document.querySelector('#commentList');
const commentsBase = document.querySelector('#commentsBase');
const commentsToken = document.querySelector('#commentsToken');

let posts = [];
let activeCategory = '全部';

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

function setStatus(message) {
  statusLine.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* ---------- 实时预览 ---------- */

function renderPreview() {
  previewTitle.textContent = fields.title.value || '未命名文章';
  previewMeta.textContent = `${fields.date.value || today()} / ${fields.category.value || '随笔'}`;
  previewExcerpt.textContent = fields.excerpt.value;
  previewExcerpt.hidden = !fields.excerpt.value;

  const body = fields.body.value.trim();
  preview.innerHTML = body
    ? window.marked.parse(body)
    : '<p class="preview-placeholder">正文预览会显示在这里。</p>';
}

/* ---------- 文章 CRUD ---------- */

function fillForm(post = {}) {
  fields.originalSlug.value = post.slug || '';
  fields.title.value = post.title || '';
  fields.date.value = post.date || today();
  fields.category.value = CATEGORIES.includes(post.category) && post.category !== '全部' ? post.category : '随笔';
  fields.excerpt.value = post.excerpt || '';
  fields.body.value = post.body || `# ${post.title || '新的随笔'}\n\n在这里开始写正文。`;
  deleteButton.disabled = !post.slug;
  renderPreview();
}

function renderCategoryFilter() {
  categoryFilter.innerHTML = '';
  for (const category of CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-tab ${category === activeCategory ? 'is-active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      activeCategory = category;
      renderCategoryFilter();
      renderList();
    });
    categoryFilter.appendChild(button);
  }
}

function renderList() {
  postList.innerHTML = '';
  const visible = activeCategory === '全部' ? posts : posts.filter(post => post.category === activeCategory);
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'post-empty';
    empty.textContent = '这个栏目还没有文章。';
    postList.appendChild(empty);
    return;
  }
  for (const post of visible) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `post-item ${post.slug === fields.originalSlug.value ? 'active' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.date)} / ${escapeHtml(post.category)}</small>`;
    button.addEventListener('click', () => loadPost(post.slug));
    postList.appendChild(button);
  }
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function loadPosts() {
  const data = await api('/api/posts');
  posts = data.posts;
  renderCategoryFilter();
  renderList();
  if (!fields.originalSlug.value && posts[0]) await loadPost(posts[0].slug);
  if (!posts.length) fillForm();
}

async function loadPost(slug) {
  const data = await api(`/api/posts/${encodeURIComponent(slug)}`);
  fillForm(data.post);
  renderList();
}

async function savePostPayload() {
  const payload = {
    originalSlug: fields.originalSlug.value,
    title: fields.title.value,
    date: fields.date.value,
    category: fields.category.value,
    excerpt: fields.excerpt.value,
    body: fields.body.value,
  };

  const data = await api('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  fillForm(data.post);
  await loadPosts();
  return data.post;
}

async function saveCurrentPost(event) {
  event.preventDefault();
  await savePostPayload();
  setStatus('已保存。重新构建网站后，公开博客会读取这篇文章。');
}

async function publishCurrentPost() {
  publishButton.disabled = true;
  setStatus('正在保存文章...');
  try {
    await savePostPayload();
    setStatus('正在构建并上传到 Cloudflare Pages...');
    await api('/api/publish', { method: 'POST' });
    setStatus('已发布到 xgblog.pages.dev。');
  } catch (error) {
    setStatus(error.message);
  } finally {
    publishButton.disabled = false;
  }
}

async function deleteCurrentPost() {
  const slug = fields.originalSlug.value;
  if (!slug) return;
  if (!window.confirm('确定删除这篇文章吗？')) return;
  await api(`/api/posts/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  setStatus('已删除。');
  fillForm();
  await loadPosts();
}

/* ---------- 评论收件箱 ---------- */

function commentsConfig() {
  return {
    base: (commentsBase.value || '').trim().replace(/\/+$/, ''),
    token: (commentsToken.value || '').trim(),
  };
}

function saveCommentsConfig() {
  window.localStorage.setItem('wxg-comments-base', commentsBase.value.trim());
  window.localStorage.setItem('wxg-comments-token', commentsToken.value.trim());
}

function restoreCommentsConfig() {
  commentsBase.value = window.localStorage.getItem('wxg-comments-base') || 'https://xgblog.pages.dev';
  commentsToken.value = window.localStorage.getItem('wxg-comments-token') || '';
}

function authHeaders() {
  const { token } = commentsConfig();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function renderComments(comments) {
  commentList.innerHTML = '';
  inboxCount.hidden = !comments.length;
  inboxCount.textContent = comments.length;

  if (!comments.length) {
    const empty = document.createElement('p');
    empty.className = 'post-empty';
    empty.textContent = '还没有收到评论。';
    commentList.appendChild(empty);
    return;
  }

  for (const comment of comments) {
    const item = document.createElement('article');
    item.className = 'comment-item';
    const isPrivate = comment.visibility === 'private';
    const badges = [
      isPrivate ? '<span class="comment-badge is-private">仅站长可见</span>' : '',
      comment.anonymous ? '<span class="comment-badge">匿名</span>' : '',
    ].join('');
    item.innerHTML = `
      <header>
        <strong>${escapeHtml(comment.nickname)}</strong>
        ${badges}
        <span class="comment-page">${escapeHtml(comment.page)}</span>
        <time>${escapeHtml(String(comment.createdAt).replace('T', ' ').slice(0, 16))}</time>
      </header>
      <p class="comment-content">${escapeHtml(comment.content)}</p>
      <footer>
        <span>${escapeHtml(comment.email || '')}</span>
        <span>${escapeHtml(comment.ip || '')}</span>
        <button type="button" class="comment-toggle">${isPrivate ? '设为公开' : '设为仅站长可见'}</button>
        <button type="button" class="danger comment-delete">删除</button>
      </footer>
    `;
    item.querySelector('.comment-toggle').addEventListener('click', async () => {
      const nextVisibility = isPrivate ? 'public' : 'private';
      const { base } = commentsConfig();
      try {
        const response = await fetch(`${base}/api/comments/${encodeURIComponent(comment.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ visibility: nextVisibility }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '操作失败');
        await loadComments();
      } catch (error) {
        inboxStatus.textContent = error.message;
      }
    });
    item.querySelector('.comment-delete').addEventListener('click', async () => {
      if (!window.confirm('删除这条评论？')) return;
      const { base } = commentsConfig();
      try {
        const response = await fetch(`${base}/api/comments/${encodeURIComponent(comment.id)}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '删除失败');
        await loadComments();
      } catch (error) {
        inboxStatus.textContent = error.message;
      }
    });
    commentList.appendChild(item);
  }
}

async function loadComments() {
  saveCommentsConfig();
  const { base } = commentsConfig();
  inboxStatus.textContent = '正在拉取评论…';
  try {
    const response = await fetch(`${base}/api/comments/all`, { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '拉取失败');
    renderComments(data.comments || []);
    inboxStatus.textContent = `共 ${data.comments.length} 条。这里能看到昵称、邮箱、IP 和来源页面；公开页面只显示昵称和内容。`;
  } catch (error) {
    renderComments([]);
    inboxStatus.textContent = `拉取失败：${error.message}`;
  }
}

/* ---------- 历程时间线 ---------- */

let timelineEntries = [];

function fieldBlock(labelText, control) {
  const label = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function textInput(value, onInput) {
  const input = document.createElement('input');
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function textArea(value, onInput) {
  const area = document.createElement('textarea');
  area.rows = 2;
  area.value = value;
  area.addEventListener('input', () => onInput(area.value));
  return area;
}

function statusSelect(value, onChange) {
  const select = document.createElement('select');
  for (const [val, text] of [['doing', '进行中'], ['done', '已完成']]) {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = text;
    if (val === value) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function iconButton(label, title, onClick, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  if (extraClass) button.className = extraClass;
  button.addEventListener('click', onClick);
  return button;
}

function moveTimelineEntry(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= timelineEntries.length) return;
  const [item] = timelineEntries.splice(index, 1);
  timelineEntries.splice(target, 0, item);
  renderTimeline();
}

function removeTimelineEntry(index) {
  if (!window.confirm('删除这条历程记录？')) return;
  timelineEntries.splice(index, 1);
  renderTimeline();
}

function addTimelineEntry() {
  timelineEntries.push({ period: '2026', title: '新的里程碑', text: '', status: 'done' });
  renderTimeline();
  timelineList.lastElementChild?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderTimelineEntry(entry, index) {
  const card = document.createElement('article');
  card.className = 'timeline-entry';

  const head = document.createElement('div');
  head.className = 'timeline-entry-head';
  const badge = document.createElement('span');
  badge.className = 'timeline-index';
  badge.textContent = index + 1;
  const controls = document.createElement('div');
  controls.className = 'timeline-controls';
  const up = iconButton('↑', '上移', () => moveTimelineEntry(index, -1));
  const down = iconButton('↓', '下移', () => moveTimelineEntry(index, 1));
  up.disabled = index === 0;
  down.disabled = index === timelineEntries.length - 1;
  controls.append(up, down, iconButton('删除', '删除', () => removeTimelineEntry(index), 'danger'));
  head.append(badge, controls);
  card.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'timeline-grid';
  grid.appendChild(fieldBlock('阶段 / 年份', textInput(entry.period || '', value => { entry.period = value; })));
  grid.appendChild(fieldBlock('状态', statusSelect(entry.status || 'done', value => { entry.status = value; })));
  card.appendChild(grid);

  card.appendChild(fieldBlock('标题', textInput(entry.title || '', value => { entry.title = value; })));
  card.appendChild(fieldBlock('描述', textArea(entry.text || '', value => { entry.text = value; })));
  return card;
}

function renderTimeline() {
  timelineList.innerHTML = '';
  if (!timelineEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'post-empty';
    empty.textContent = '还没有条目，点"新增条目"开始。';
    timelineList.appendChild(empty);
    return;
  }
  timelineEntries.forEach((entry, index) => {
    timelineList.appendChild(renderTimelineEntry(entry, index));
  });
}

async function loadTimeline() {
  try {
    const data = await api('/api/timeline');
    timelineEntries = data.timeline || [];
    renderTimeline();
    timelineStatus.textContent = '';
  } catch (error) {
    timelineStatus.textContent = error.message;
  }
}

async function saveTimelinePayload() {
  const data = await api('/api/timeline', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeline: timelineEntries }),
  });
  timelineEntries = data.timeline || [];
  renderTimeline();
}

async function saveTimeline() {
  timelineStatus.textContent = '正在保存…';
  try {
    await saveTimelinePayload();
    timelineStatus.textContent = '已保存。重新构建网站后，公开页面的历程会更新。';
  } catch (error) {
    timelineStatus.textContent = error.message;
  }
}

async function publishTimeline() {
  publishTimelineButton.disabled = true;
  timelineStatus.textContent = '正在保存历程…';
  try {
    await saveTimelinePayload();
    timelineStatus.textContent = '正在构建并上传到 Cloudflare Pages…';
    await api('/api/publish', { method: 'POST' });
    timelineStatus.textContent = '已发布到 xgblog.pages.dev。';
  } catch (error) {
    timelineStatus.textContent = error.message;
  } finally {
    publishTimelineButton.disabled = false;
  }
}

/* ---------- 视图切换 ---------- */

function showView(view) {
  editorView.hidden = view !== 'editor';
  timelineView.hidden = view !== 'timeline';
  inboxView.hidden = view !== 'inbox';
  tabEditor.classList.toggle('is-active', view === 'editor');
  tabTimeline.classList.toggle('is-active', view === 'timeline');
  tabInbox.classList.toggle('is-active', view === 'inbox');
  if (view === 'inbox') loadComments();
  if (view === 'timeline') loadTimeline();
}

tabEditor.addEventListener('click', () => showView('editor'));
tabTimeline.addEventListener('click', () => showView('timeline'));
tabInbox.addEventListener('click', () => showView('inbox'));
document.querySelector('#addTimelineEntry').addEventListener('click', addTimelineEntry);
document.querySelector('#saveTimeline').addEventListener('click', saveTimeline);
publishTimelineButton.addEventListener('click', publishTimeline);
document.querySelector('#refreshComments').addEventListener('click', loadComments);

document.querySelector('#newPost').addEventListener('click', () => {
  fillForm();
  setStatus('正在新建文章。');
  renderList();
});
document.querySelector('#postForm').addEventListener('submit', event => {
  saveCurrentPost(event).catch(error => setStatus(error.message));
});
publishButton.addEventListener('click', publishCurrentPost);
deleteButton.addEventListener('click', deleteCurrentPost);
for (const field of Object.values(fields)) {
  field.addEventListener('input', renderPreview);
  field.addEventListener('change', renderPreview);
}

restoreCommentsConfig();
loadPosts().catch(error => setStatus(error.message));
