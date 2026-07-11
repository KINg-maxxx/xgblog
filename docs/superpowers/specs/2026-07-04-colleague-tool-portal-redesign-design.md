# Colleague Tool Portal Redesign

## Goal

Redesign the personal site into a colleague-facing tool portal. The homepage should help coworkers quickly find the correct website or tool, while still keeping a small blog area for notes, usage updates, and personal essays.

Primary homepage copy:

> 请大家在此寻找对应网站及工具

## References

- `https://www.lamda.nju.edu.cn/`: use the academic portal feeling, dense useful links, dated lists, restrained color, and credibility-first layout.
- `https://sinyalee.com/blog/`: use the blog rhythm: centered writing identity, article metadata, excerpt cards, featured first post, and compact article grid.

The redesign should borrow structure and mood only. It must not copy brand marks, institutional wording, or exact layouts.

## Recommended Direction

Use a "tool portal first, blog second" structure.

The first viewport should say clearly that this is `WXG 工具入口`, followed by the approved description: `请大家在此寻找对应网站及工具`. The project cards should be the dominant element because coworkers arrive mainly to enter one of the websites.

The blog should become a secondary section named `使用说明 / 随笔记录`. It can include personal essays, but it should also be suitable for short notes about how to use the linked tools.

Because the site now needs to make strong use of both animation libraries, the implementation should move from plain static HTML to a React/Vite static app. The final output can still be deployed as static files, but React is needed to use React Bits components properly.

## Page Structure

### Homepage

1. Header
   - Compact navigation: `网站入口`, `使用说明`, `联系方式`.
   - Keep the page lightweight and direct.

2. Hero
   - Title: `WXG 工具入口`.
   - Subtitle: `请大家在此寻找对应网站及工具`.
   - Optional short identity line can stay understated, not as the main message.

3. Website/tool cards
   - Four cards remain the core content:
     - `https://www.periopact.cn/`
     - `https://huozi-yinshua.pages.dev/`
     - `https://pactviewbywxg.pages.dev/`
     - `https://www.periopact.cn/m`
   - Each card should include image, name, brief use case, short audience hint, and a clear enter link.
   - Visual style should be closer to a serious project directory than a marketing portfolio.

4. Blog/notes preview
   - Use the Sinyalee-style article pattern: metadata, title, excerpt, and read-more link.
   - First article may be featured; later articles can be compact cards.

5. Contact
   - Keep phone, WeChat, email, and GitHub visible.
   - Present it like a simple institutional contact block, useful for coworkers who need help.

### Blog

The blog index should read more like a clean writing archive:

- Page title and short subtitle.
- Featured newest or pinned post.
- Compact article grid/list below.
- No real search, pagination, CMS, or tagging system until there are enough posts to justify them.

## Visual Style

- Base: white or warm off-white background, black text, thin rules, disciplined spacing.
- Accent: restrained academic red for section labels and blue for links.
- Avoid a decorative landing-page feel. The site should look useful first.
- Use card images, but keep cards informative and scannable.

## Motion

Use both local animation libraries deliberately:

- `C:\Users\21319\Documents\电脑操作\react-bits`
  - Use React Bits components for visible animated UI pieces.
  - Recommended candidates: `BlurText` or `SplitText` for the hero line, `ScrollReveal` or `AnimatedContent` for section reveals, `SpotlightCard`/`TiltedCard`/`GlareHover` for website cards, and a restrained background such as `DotGrid`, `Threads`, or `LightRays`.
  - Do not copy the whole React Bits demo site. Bring in only the components used by this project.
- `C:\Users\21319\Desktop\05_软件工具与插件\anime-4.4.1`
  - Use Anime.js 4.4.1 for page-level timing and scroll choreography.
  - Use it for staggered card entrance, section heading underline motion, contact block reveal, and active navigation/identity rail transitions.
  - Prefer the local module or bundle from this folder; do not load Anime.js from a CDN.

Animation behavior should be rich but practical:

- Hero content enters cleanly.
- Website cards reveal in a staggered sequence.
- Blog cards reveal more quietly.
- Section headings can have subtle line or underline motion.
- Avoid animation that slows down entry to the links.

## Architecture

Update the site to a small React/Vite static architecture:

- `index.html` remains the app entry.
- `src/main.jsx` mounts the React app.
- `src/App.jsx` owns the page sections.
- `src/components/` contains local page components and the selected React Bits components.
- `src/data/` contains the website cards, contact data, and blog post metadata.
- `assets/` keeps screenshots and copied local library assets when needed.
- Blog pages can be represented as app routes or simple static sections, whichever keeps the implementation smaller.

The app should build to static files. No CMS, backend, login, or dynamic publishing system is required.

## Testing

Update the existing smoke test so it checks:

- The approved subtitle appears on the homepage.
- All four website links remain present.
- Blog links remain reachable.
- Contact information remains present.
- Local Anime.js 4.4.1 is referenced or imported.
- Selected React Bits components are present in source.
- Portal-oriented section labels are present.

Manual browser verification should check desktop and mobile widths for:

- First viewport clarity.
- Card readability.
- No text overlap.
- Scroll animation timing.
- React Bits effects render without covering the website entry buttons.

## Out of Scope

- Real blog publishing system.
- Login or permissions.
- Search.
- Dynamic website status checks.
- New analytics.
- Loading animation libraries from external CDNs.
- Copying the full React Bits documentation/demo app into this site.
