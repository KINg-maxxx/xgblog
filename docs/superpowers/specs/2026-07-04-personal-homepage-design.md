# Personal Homepage Design

## Goal

Build a quiet, professional personal homepage in `C:\Users\21319\Documents\个人网页` that can be opened directly as a static site.

The page should introduce the owner, show selected websites as visual link cards, and use the local Anime.js 4.4.1 library for restrained motion.

## Scope

- One static homepage: `index.html`.
- Local assets folder for Anime.js and website screenshots.
- No build tool, framework, backend, CMS, or package install.
- Website cards link to:
  - `https://www.periopact.cn/`
  - `https://huozi-yinshua.pages.dev/`
  - `https://pactviewbywxg.pages.dev/`
  - `https://www.periopact.cn/m`

## Layout

The homepage uses a single-page structure:

1. Header with simple navigation anchors.
2. Hero section with professional identity copy and a calm visual accent.
3. Website section with four cards. Each card includes a screenshot, category, title, short description, and external link.
4. Contact section with editable email and profile-link fields.

## Website Cards

Card copy:

- PerioPACT 主站: 围绕牙周长期治疗建立的数字化工作台，把患者、疗程和随访放在同一条清晰路径上。
- 活字印刷: 把 Markdown 变成干净、有留白感的分享图，让内容排版从“能读”变成“愿意读”。
- PACT View: 面向口腔影像的三维查看器，用更直观的空间视图辅助理解 CBCT 与口扫数据。
- PerioPACT 移动端: 为移动访问保留的轻量入口，让 PACT 在诊间、随访和临时查看场景下更容易打开。

## Motion

Use Anime.js only for small enhancements:

- hero text entrance,
- website cards staggered entrance,
- subtle hover lift,
- reduced-motion fallback that leaves the page fully usable.

## Visual Direction

Use the approved “克制专业” direction:

- warm off-white page background,
- dark text,
- restrained green and ochre accents,
- card radius no larger than 8px,
- no decorative gradient blobs or heavy animation.

## Verification

Open the page locally and check:

- all four external links open in a new tab,
- screenshots render,
- layout works on desktop and mobile widths,
- no console errors from the local Anime.js file.
