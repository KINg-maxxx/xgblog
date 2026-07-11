import React, { useEffect, useMemo, useState } from 'react';
import { animate, stagger } from './lib/anime.esm.min.js';
import { contacts, heroCopy, navItems, roadmap, timeline, toolSites } from './data/site.js';
import { getPostBySlug, posts } from './data/posts.js';
import AnimatedContent from './react-bits/AnimatedContent.jsx';
import BlurText from './react-bits/BlurText.jsx';
import DotGrid from './react-bits/DotGrid.jsx';
import SpotlightCard from './react-bits/SpotlightCard.jsx';
import Feedback from './Feedback.jsx';
import { getTimelineUpdateView } from './timeline.js';

export const POST_CATEGORIES = ['随笔', '技术专栏', '学术进度'];

// blog/first-essay.html 是固定链接，必须始终指向这篇文章，而不是 posts 排序后的第一项
const FIRST_ESSAY_SLUG = '2026-07-05-第一篇随笔';

function routeFromLocation(location) {
  const selectedSlug = new URLSearchParams(location.search).get('post');
  if (location.pathname.endsWith('/blog/first-essay.html')) {
    return { page: 'essay', slug: FIRST_ESSAY_SLUG };
  }
  if (selectedSlug) return { page: 'essay', slug: selectedSlug };
  if (location.pathname.includes('/blog/')) return { page: 'blog' };
  return { page: 'home' };
}

export default function App() {
  const route = useMemo(() => routeFromLocation(window.location), []);

  useEffect(() => {
    if (!window.location.hash) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route.page]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animated = [...document.querySelectorAll('[data-animate]')];

    if (reduceMotion) {
      animated.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return undefined;
    }

    animate('.js-hero-reveal', {
      opacity: [0, 1],
      translateY: [24, 0],
      delay: stagger(90),
      duration: 760,
      ease: 'out(3)',
    });

    animated.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
    });

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const el = entry.target;
          if (entry.isIntersecting) {
            animate(el, {
              opacity: [0, 1],
              translateY: [28, 0],
              duration: el.dataset.animate === 'card' ? 680 : 560,
              delay: Number(el.dataset.delay || 0),
              ease: 'out(3)',
            });
          } else if (el.hasAttribute('data-animate-repeat')) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(28px)';
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );

    animated.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [route.page]);

  return (
    <>
      <DotGrid />
      <SiteHeader />
      {route.page === 'home' && <HomePage />}
      {route.page === 'blog' && <BlogIndex />}
      {route.page === 'essay' && <EssayPage slug={route.slug} />}
      <SiteFooter />
    </>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="shell nav" aria-label="主导航">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>WXG</span>
          <small>Tool Portal</small>
        </a>
        <div className="nav-links">
          {navItems.map(item => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}

function TimelineItem({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const { updates, visibleCount, hiddenCount } = getTimelineUpdateView(item.updates, expanded);
  const updatesId = `timeline-updates-${index}`;

  return (
    <div className={`timeline-item ${item.status === 'doing' ? 'is-doing' : ''}`}>
      <span className="timeline-dot" aria-hidden="true" />
      <div className="timeline-body">
        <div className="timeline-meta">
          <span className="timeline-period">{item.period}</span>
          {item.status === 'doing' && <span className="timeline-badge">进行中</span>}
        </div>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </div>

      {updates.length > 0 && (
        <div className="timeline-subupdates" id={updatesId}>
          {updates.map((update, updateIndex) => {
            const collapsed = updateIndex >= visibleCount;
            return (
              <article
                className={`timeline-subupdate ${collapsed ? 'is-collapsed' : ''}`}
                key={`${update.date}-${update.title}-${updateIndex}`}
                aria-hidden={collapsed || undefined}
              >
                <span className="timeline-subdot" aria-hidden="true" />
                <div className="timeline-subupdate-content">
                  {update.date && <time>{update.date}</time>}
                  <h4>{update.title}</h4>
                  {update.text && <p>{update.text}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          className="timeline-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={updatesId}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? '收起' : `展开其余 ${hiddenCount} 条`}
          <span aria-hidden="true">⌄</span>
        </button>
      )}
    </div>
  );
}

function HomePage() {
  return (
    <main id="top">
      <section className="shell portal-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="hero-badge js-hero-reveal">
            <span className="pulse-dot" aria-hidden="true" />
            {heroCopy.badge}
          </p>
          <BlurText
            as="h1"
            id="hero-title"
            className="hero-title js-hero-reveal"
            text={heroCopy.title}
          />
          <p className="hero-subtitle js-hero-reveal">{heroCopy.subtitle}</p>
          <p className="hero-note js-hero-reveal">{heroCopy.note}</p>
          <div className="hero-actions js-hero-reveal">
            <a className="btn btn-primary" href="/#tools">
              浏览工具
              <span aria-hidden="true">↓</span>
            </a>
            <a className="btn btn-ghost" href="/blog/index.html">
              使用说明与随笔
            </a>
          </div>
          <dl className="hero-stats js-hero-reveal">
            {heroCopy.stats.map(stat => (
              <div className="stat" key={stat.label}>
                <dt>{stat.value}</dt>
                <dd>{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="quick-panel js-hero-reveal" aria-label="快速入口">
          <p className="panel-title">快速进入</p>
          <div className="quick-list">
            {toolSites.map(site => (
              <a key={site.url} className="quick-link" href={site.url} target="_blank" rel="noreferrer">
                <span className="quick-main">
                  <span>{site.name}</span>
                  <small>{site.tagline}</small>
                </span>
                <span className="quick-arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </aside>

        <a className="scroll-cue js-hero-reveal" href="/#tools" aria-label="向下滚动查看工具">
          <span />
        </a>
      </section>

      <section id="tools" className="section-block" aria-labelledby="tools-title">
        <div className="shell">
          <SectionHeader
            eyebrow="Website Directory"
            titleId="tools-title"
            title="网站入口"
            text="请根据使用场景选择对应网站。每张卡片都写明了它是做什么的、适合什么时候用。"
          />
          <div className="tool-grid">
            {toolSites.map((site, index) => (
              <AnimatedContent
                key={site.url}
                className="tool-motion"
                type="card"
                repeat
                delay={index * 70}
              >
                <SpotlightCard
                  className="tool-card"
                  href={site.url}
                  aria-label={`打开 ${site.name}`}
                >
                  <div className="tool-shot-wrap">
                    <img className="tool-shot" src={site.image} alt={`${site.name} 截图`} loading="lazy" />
                  </div>
                  <div className="tool-body">
                    <div className="tool-meta">
                      <span className="tool-label">{site.label}</span>
                      <span>{site.audience}</span>
                    </div>
                    <h3>{site.name}</h3>
                    <p className="tool-tagline">{site.tagline}</p>
                    <p>{site.description}</p>
                    <div className="tool-tags">
                      {site.tags.map(tag => (
                        <span className="tag" key={tag}>{tag}</span>
                      ))}
                    </div>
                    <span className="enter-link">
                      进入网站 <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block section-muted" aria-labelledby="roadmap-title">
        <div className="shell">
          <SectionHeader
            eyebrow="Roadmap"
            titleId="roadmap-title"
            title="这个站点会长成什么样"
            text="现在它是团队的工具入口，之后会一步步变成我的工具发布页、博客和简历。"
          />
          <div className="roadmap-grid">
            {roadmap.map(item => (
              <AnimatedContent key={item.step} type="card" repeat>
                <div className="roadmap-card">
                  <div className="roadmap-top">
                    <span className="roadmap-step">{item.step}</span>
                    <span className={`roadmap-status ${item.status === '进行中' ? 'is-active' : ''}`}>
                      {item.status}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      <section id="timeline" className="section-block" aria-labelledby="timeline-title">
        <div className="shell">
          <SectionHeader
            eyebrow="Timeline"
            titleId="timeline-title"
            title="做过的与正在做的"
            text="按时间倒序记录我做过的内容和手头正在推进的事情，顶部是进行中的项目。"
          />
          <div className="timeline">
            {timeline.map((item, index) => (
              <AnimatedContent key={item.title} type="card" repeat>
                <TimelineItem item={item} index={index} />
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      <section id="notes" className="section-block section-muted" aria-labelledby="notes-title">
        <div className="shell">
          <SectionHeader
            eyebrow="Notes"
            titleId="notes-title"
            title="使用说明 / 随笔记录"
            text="这里会放工具说明、更新记录，以及一些随手写下的工作和阅读笔记。"
          />
          <PostList featured />
        </div>
      </section>

      <section id="feedback" className="section-block" aria-labelledby="feedback-title">
        <div className="shell feedback-grid">
          <SectionHeader
            eyebrow="Feedback"
            titleId="feedback-title"
            title="问题与反馈"
            text="工具用着不顺手、想要新功能，或者发现了 bug，都可以在这里告诉我。第一次留言填一下昵称和邮箱（邮箱仅用作注册用途，不会公开），之后就不用再填了。"
          />
          <AnimatedContent repeat={false}>
            <Feedback pageId="site" />
          </AnimatedContent>
        </div>
      </section>

      <ContactSection />
    </main>
  );
}

function BlogIndex() {
  const [category, setCategory] = useState('全部');
  const filtered = category === '全部' ? posts : posts.filter(post => post.category === category);

  return (
    <main className="page-main">
      <section className="shell blog-masthead">
        <a className="back-link js-hero-reveal" href="/">
          ← 返回网站入口
        </a>
        <p className="eyebrow js-hero-reveal">Blog</p>
        <BlurText
          as="h1"
          className="page-title js-hero-reveal"
          text="使用说明 / 随笔记录"
        />
        <p className="page-lead js-hero-reveal">
          写给团队的工具说明，也写给自己的随笔记录。分随笔、技术专栏、学术进度三个栏目。
        </p>
        <div className="category-tabs js-hero-reveal" role="tablist" aria-label="栏目筛选">
          {['全部', ...POST_CATEGORIES].map(item => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={`category-tab ${category === item ? 'is-active' : ''}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <section className="shell blog-list-section">
        {filtered.length ? (
          <PostList featured={false} items={filtered} />
        ) : (
          <p className="feedback-empty">这个栏目还没有文章。</p>
        )}
      </section>
    </main>
  );
}

function EssayPage({ slug }) {
  const post = getPostBySlug(slug);

  useEffect(() => {
    if (!post) return undefined;
    const previous = document.title;
    document.title = `${post.title} | WXG`;
    return () => {
      document.title = previous;
    };
  }, [post]);

  if (!post) return <PostNotFound slug={slug} />;

  return (
    <main className="page-main">
      <article className="shell essay-page">
        <div className="essay-topbar js-hero-reveal">
          <a className="back-link" href="/blog/index.html">
            ← 返回使用说明
          </a>
          <CopyLinkButton />
        </div>
        <p className="eyebrow js-hero-reveal">{post.date} / {post.category}</p>
        <BlurText as="h1" className="page-title js-hero-reveal" text={post.title} />
        <p className="page-lead js-hero-reveal">{post.excerpt}</p>
        <AnimatedContent className="essay-body" repeat={false}>
          <div className="essay-body-content" dangerouslySetInnerHTML={{ __html: post.html }} />
        </AnimatedContent>
        <div className="essay-feedback">
          <h2 className="essay-feedback-title">留言</h2>
          <p className="essay-feedback-lead">对这篇内容有疑问或想法，欢迎写在这里。</p>
          <Feedback pageId={post.slug} compact />
        </div>
      </article>
    </main>
  );
}

function PostNotFound({ slug }) {
  useEffect(() => {
    const previous = document.title;
    document.title = '没有找到这篇文章 | WXG';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <main className="page-main">
      <article className="shell essay-page">
        <a className="back-link js-hero-reveal" href="/blog/index.html">
          ← 返回使用说明
        </a>
        <h1 className="page-title js-hero-reveal">没有找到这篇文章</h1>
        <p className="page-lead js-hero-reveal">
          链接可能已经失效或文章已被移除{slug ? `（${slug}）` : ''}。你可以回到使用说明看看其它内容。
        </p>
      </article>
    </main>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="copy-link" onClick={onCopy}>
      {copied ? '已复制链接' : '复制链接'}
    </button>
  );
}

function SectionHeader({ eyebrow, title, text, titleId }) {
  return (
    <AnimatedContent className="section-head" repeat>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      <p>{text}</p>
    </AnimatedContent>
  );
}

function PostList({ featured = false, items = posts }) {
  return (
    <div className={featured ? 'post-grid post-grid-featured' : 'post-grid'}>
      {items.map(post => (
        <AnimatedContent key={post.href} type="card" repeat>
          <a className="post-card" href={post.href}>
            <div className="post-meta">{post.date} / {post.category}</div>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <span>阅读全文 <span aria-hidden="true">→</span></span>
          </a>
        </AnimatedContent>
      ))}
    </div>
  );
}

function ContactSection() {
  return (
    <section id="contact" className="section-block contact-section" aria-labelledby="contact-title">
      <div className="shell contact-grid">
        <SectionHeader
          eyebrow="Contact"
            titleId="contact-title"
          title="联系方式"
          text="如果入口不可用，或不确定应该进入哪个系统，可以通过下面方式联系我。"
        />
        <AnimatedContent className="contact-list" repeat>
          {contacts.map(contact => (
            <div className="contact-row" key={contact.label}>
              <span>{contact.label}</span>
              {contact.href ? (
                <a href={contact.href} target={contact.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  {contact.value}
                </a>
              ) : (
                <strong>{contact.value}</strong>
              )}
            </div>
          ))}
        </AnimatedContent>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="shell site-footer">
      <span>© 2026 WXG · 工具入口 / 博客 / 简历</span>
      <a href="/#tools">回到网站入口</a>
      {import.meta.env.DEV && <a href="/admin">后台</a>}
    </footer>
  );
}
