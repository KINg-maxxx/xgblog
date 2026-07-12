import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), 'utf8');
const exists = file => existsSync(path.join(root, file));

for (const file of [
  'package.json',
  'index.html',
  'src/main.jsx',
  'src/App.jsx',
  'src/analytics.js',
  'src/AuthStatus.jsx',
  'src/auth.js',
  'src/styles.css',
  'src/data/site.js',
  'src/data/posts.js',
  'src/lib/markdown.js',
  'src/lib/anime.esm.min.js',
  'src/react-bits/BlurText.jsx',
  'src/react-bits/AnimatedContent.jsx',
  'src/react-bits/SpotlightCard.jsx',
  'src/react-bits/DotGrid.jsx',
  'scripts/new-post.mjs',
  'scripts/admin-server.mjs',
  'admin/index.html',
  'admin/admin.css',
  'admin/admin.js',
  'blog/index.html',
  'blog/first-essay.html',
  'functions/_middleware.js',
  'functions/_shared/csrf.js',
  '.dev.vars.example',
]) {
  assert.ok(exists(file), `${file} should exist`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.type, 'module');
assert.ok(packageJson.scripts.test.includes('markdown-parser.test.mjs'));
assert.equal(packageJson.scripts['new:post'], 'node scripts/new-post.mjs');
assert.equal(packageJson.scripts.admin, 'node scripts/admin-server.mjs');
assert.ok(packageJson.scripts.deploy.includes('wrangler pages deploy dist'));
assert.ok(packageJson.scripts.deploy.includes('--project-name xgblog'));
assert.ok(packageJson.scripts.build.includes('vite build'));
assert.ok(packageJson.dependencies.react, 'React should be installed');
assert.ok(packageJson.dependencies['react-dom'], 'React DOM should be installed');

const main = read('src/main.jsx');
const app = read('src/App.jsx');
const analytics = read('src/analytics.js');
const authStatus = read('src/AuthStatus.jsx');
const auth = read('src/auth.js');
const workbench = read('public/tools/annotation-workbench.html');
const postsData = read('src/data/posts.js');
const adminHtml = read('admin/index.html');
const adminJs = read('admin/admin.js');
const timeline = JSON.parse(read('content/timeline.json'));
const postFiles = readdirSync(path.join(root, 'content', 'posts')).filter(name => name.endsWith('.md'));
assert.ok(postFiles.length > 0, 'at least one Markdown post should exist');
const firstPost = read(path.join('content', 'posts', postFiles[0]));

for (const text of [
  'WXG 工具入口',
  '请大家在此寻找对应网站及工具',
  '网站入口',
  '使用说明 / 随笔记录',
  '联系方式',
  '17658162159',
  'G241127N',
  'w982378625@gmail.com',
  'KINg-maxxx',
]) {
  assert.ok(app.includes(text) || read('src/data/site.js').includes(text), `source should include ${text}`);
}

for (const url of [
  'https://www.periopact.cn/',
  'https://huozi-yinshua.pages.dev/',
  'https://pactviewbywxg.pages.dev/',
  'https://www.periopact.cn/m',
  'https://github.com/KINg-maxxx',
]) {
  assert.ok(read('src/data/site.js').includes(url), `site data should include ${url}`);
}

for (const component of ['BlurText', 'AnimatedContent', 'SpotlightCard', 'DotGrid']) {
  assert.ok(app.includes(component), `App should use ${component}`);
}

assert.ok(app.includes("from './data/posts.js'"), 'App should load posts from Markdown data');
assert.ok(app.includes('URLSearchParams'), 'App should read ?post= slug');
assert.ok(postsData.includes('import.meta.glob'), 'posts data should load Markdown files with Vite');
assert.ok(postsData.includes('?raw'), 'posts data should import Markdown as raw text');
assert.match(firstPost, /^---\n/, 'first post should start with frontmatter');
assert.ok(firstPost.includes('excerpt:'));
assert.ok(adminHtml.includes('publishPost'), 'admin page should include a publish button');
assert.ok(adminJs.includes('/api/publish'), 'admin script should call the publish API');
assert.ok(adminJs.includes('addTimelineUpdate'), 'admin should add child updates');
assert.ok(adminJs.includes('moveTimelineUpdate'), 'admin should reorder child updates');
assert.ok(adminJs.includes('removeTimelineUpdate'), 'admin should delete child updates');
assert.ok(adminJs.includes('timeline-subentry'), 'admin should render child update editors');
assert.ok(adminJs.includes("from './timeline-state.js'"), 'admin should use tested state mutations');
assert.ok(adminJs.includes('focusTimelineUpdate'), 'admin should restore focus after rerendering');
assert.ok(adminJs.includes('updateAction'), 'admin controls should expose stable focus targets');
assert.ok(app.includes("from './lib/anime.esm.min.js'"), 'App should import local Anime.js 4.4.1');
assert.match(app, /IntersectionObserver/, 'App should use scroll observation');
assert.match(app, /animate\(/, 'App should run Anime.js animations');
assert.match(read('src/styles.css'), /prefers-reduced-motion/, 'CSS should respect reduced motion');
assert.ok(app.includes('function TimelineItem'), 'timeline should use a focused item component');
assert.ok(app.includes('<AuthStatus'), 'site header should include the fixed-size PACT identity control');
assert.ok(
  main.indexOf('cleanOidcCallbackParameters()') < main.indexOf('initializeAnalytics()'),
  'OIDC callback parameters should be cleaned before Google Analytics initializes',
);
assert.ok(
  main.indexOf('initializeAnalytics()') < main.indexOf('createRoot('),
  'Google Analytics should initialize before React renders',
);
for (const state of ['loading', 'anonymous', 'authenticated', 'denied', 'unavailable']) {
  assert.ok(authStatus.includes(`'${state}'`), `identity control should render the ${state} state`);
}
assert.ok(auth.includes("form.method = 'post'"), 'global logout should submit a POST navigation');
assert.ok(auth.includes("form.action = '/auth/logout'"), 'global logout should use the same-origin Function');
assert.match(read('src/styles.css'), /\.auth-status\s*\{[^}]*width:/s, 'identity control should reserve a stable width');
assert.match(read('src/styles.css'), /\.auth-status\s*\{[^}]*height:/s, 'identity control should reserve a stable height');
assert.ok(workbench.includes('60_000'), 'annotation workbench should heartbeat every 60 seconds');
assert.ok(workbench.includes("visibilitychange"), 'annotation workbench should recheck auth when visible');
assert.ok(workbench.includes("setAttribute('inert', '')"), 'expired auth should lock every workbench surface');
assert.ok(app.includes('getTimelineUpdateView'), 'timeline should use tested display-state logic');
assert.match(analytics, /GOOGLE_ANALYTICS_ID = ['"]G-4MT03MBVYL['"]/, 'Google Analytics should use the production stream');
assert.match(analytics, /googletagmanager\.com\/gtag\/js\?id=/, 'Google Analytics loader should use gtag.js');
assert.match(analytics, /gtag\(['"]config['"],\s*GOOGLE_ANALYTICS_ID\)/, 'Google Analytics should configure the production stream');
assert.match(analytics, /protocol !== ['"]https:['"]/, 'local HTTP development should not pollute production analytics');
assert.ok(app.includes('updateIndex >= visibleCount'), 'timeline should collapse updates after the preview');
assert.ok(app.includes('aria-expanded'), 'timeline expansion control should expose its state');
assert.ok(app.includes('timeline-subupdates'), 'timeline should render a nested visual branch');
assert.match(read('src/styles.css'), /\.timeline-subupdate/);
assert.match(read('src/styles.css'), /grid-template-rows:\s*0fr/);
assert.match(read('src/styles.css'), /overflow-wrap:\s*anywhere/);
assert.ok(
  timeline.some(item => item.updates?.length >= 3),
  'timeline should demonstrate folded child updates',
);
