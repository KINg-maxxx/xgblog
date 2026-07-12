export const FIRST_ESSAY_SLUG = '2026-07-05-第一篇随笔';

export function routeFromLocation(location) {
  const selectedSlug = new URLSearchParams(location.search).get('post');
  const pathname = location.pathname.replace(/\/+$/, '');
  if (pathname === '/blog/first-essay' || pathname === '/blog/first-essay.html') {
    return { page: 'essay', slug: FIRST_ESSAY_SLUG };
  }
  if (selectedSlug) return { page: 'essay', slug: selectedSlug };
  if (location.pathname.includes('/blog/')) return { page: 'blog' };
  return { page: 'home' };
}
