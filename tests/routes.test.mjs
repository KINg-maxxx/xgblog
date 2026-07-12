import assert from 'node:assert/strict';

import { routeFromLocation } from '../src/routes.js';

const locationFor = href => new URL(href);

assert.deepEqual(
  routeFromLocation(locationFor('https://blog.periopact.cn/blog/first-essay.html')),
  { page: 'essay', slug: '2026-07-05-第一篇随笔' },
);
assert.deepEqual(
  routeFromLocation(locationFor('https://blog.periopact.cn/blog/first-essay')),
  { page: 'essay', slug: '2026-07-05-第一篇随笔' },
);
assert.deepEqual(
  routeFromLocation(locationFor('https://blog.periopact.cn/blog/')),
  { page: 'blog' },
);
assert.deepEqual(
  routeFromLocation(locationFor('https://blog.periopact.cn/blog/?post=custom-post')),
  { page: 'essay', slug: 'custom-post' },
);
