require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://thelimelightonline.in';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── String Helpers ────────────────────────────────────────────────────────────

const escapeQuotes = (str) => str ? str.replace(/"/g, '&quot;') : '';
const escapeJs = (str) => str
  ? str.replace(/\\/g, '\\\\').replace(/`/g, '\`').replace(/\$/g, '\\$')
  : '';
// Must match the safeSlug used when writing files to dist/article/
function estimateReadingTime(text) {
  if (!text) return 1;
  const words = text.replace(/<[^>]*>?/gm, '').split(/\s+/).length;
  return Math.ceil(words / 200) || 1;
}

const normalizeSlug = (slug) => slug.replace(/[^a-z0-9\-]/gi, '-').toLowerCase();

function calcReadingTime(htmlContent) {
  const text = (htmlContent || '').replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function getDarkModeInitScript() {
  return `<script>
(function() {
  var saved = localStorage.getItem('limelight-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
<\/script>`;
}

function getDarkModeCSS() {
  return `
<style>
:root {
  --dm-bg: #121212; --dm-surface: #1e1e1e; --dm-surface2: #2a2a2a;
  --dm-text: #e4e4e4; --dm-text-muted: #aaaaaa; --dm-border: #333333;
  --dm-accent: #d4845a;
}
[data-theme="dark"] {
  --accent-color: #d4845a; --text-color: #e4e4e4; --border-color: #333;
  --card-shadow: 0 4px 10px rgba(0,0,0,0.4);
}
[data-theme="dark"] body { background-color: #121212; color: #e4e4e4; }
[data-theme="dark"] .header, [data-theme="dark"] .site-header { background: #1e1e1e !important; border-bottom-color: #333 !important; }
[data-theme="dark"] .nav-link, [data-theme="dark"] .nav-menu a { color: #ccc !important; }
[data-theme="dark"] .nav-link:hover { color: #d4845a !important; }
[data-theme="dark"] .dropdown, [data-theme="dark"] .has-dropdown .dropdown { background: #1e1e1e; border-color: #333; }
[data-theme="dark"] .dropdown-item { color: #ccc; border-bottom-color: #333; }
[data-theme="dark"] .dropdown-item:hover { background: #2a2a2a; color: #d4845a; }
[data-theme="dark"] .article-card { background: #1e1e1e; border-color: #333; }
[data-theme="dark"] .card-title a { color: #e4e4e4; }
[data-theme="dark"] .card-excerpt { color: #aaa; }
[data-theme="dark"] .card-author { color: #888; border-top-color: #333; }
[data-theme="dark"] .site-footer { background: #0a0a0a; }
[data-theme="dark"] .footer-bottom { border-top-color: #222; }
[data-theme="dark"] .carousel-overlay { background: linear-gradient(to top, rgba(0,0,0,0.95), transparent); }
[data-theme="dark"] .category-header { background: linear-gradient(135deg, #6b3510 0%, #7a3f22 100%); }
[data-theme="dark"] .author-card { background: #1e1e1e; border-color: #333; }
[data-theme="dark"] .author-bio-card { background: #1e1e1e; border-color: #333; }
[data-theme="dark"] .author-page-header { background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); }
.theme-toggle {
  background: none; border: 1.5px solid #ccc; border-radius: 20px;
  padding: 5px 10px; cursor: pointer; font-size: 0.85rem; color: #666;
  display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;
}
.theme-toggle:hover { border-color: #8B4513; color: #8B4513; }
.theme-toggle .icon-dark { display: none; }
.theme-toggle .icon-light { display: inline; }
[data-theme="dark"] .theme-toggle { border-color: #555; color: #ccc; }
[data-theme="dark"] .theme-toggle:hover { border-color: #d4845a; color: #d4845a; }
[data-theme="dark"] .theme-toggle .icon-dark { display: inline; }
[data-theme="dark"] .theme-toggle .icon-light { display: none; }
/* Homepage card fade-in animation */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: no-preference) {
  .article-card {
    opacity: 0;
    animation: fadeSlideUp 0.5s ease forwards;
  }
  .article-card:nth-child(1) { animation-delay: 0.05s; }
  .article-card:nth-child(2) { animation-delay: 0.10s; }
  .article-card:nth-child(3) { animation-delay: 0.15s; }
  .article-card:nth-child(4) { animation-delay: 0.20s; }
  .article-card:nth-child(5) { animation-delay: 0.25s; }
  .article-card:nth-child(6) { animation-delay: 0.30s; }
  .article-card:nth-child(7) { animation-delay: 0.35s; }
  .article-card:nth-child(8) { animation-delay: 0.40s; }
  .article-card:nth-child(9) { animation-delay: 0.45s; }
}
</style>`;
}

function getDarkModeToggleScript() {
  return `
<script>
document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('limelight-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('limelight-theme', 'dark');
      }
    });
  }
});
<\/script>`;
}

function getDarkModeToggleBtn() {
  return `<button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
  <i class="fas fa-moon icon-dark"></i>
  <i class="fas fa-sun icon-light"></i>
</button>`;
}

function getFaviconHtml() {
  return `
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon/favicon-96x96.png">
    <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg">
    <link rel="shortcut icon" href="/favicon/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-title" content="The Limelight">
    <link rel="manifest" href="/favicon/site.webmanifest">
  `;
}

function getSEOHeadTags({ title, description, keywords, author, url, type, image }) {
  const defaultImage = `${SITE_URL}/favicon/favicon-512x512.png`;
  const imgUrl = image || defaultImage;
  return `
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="keywords" content="${keywords}">
<meta name="author" content="${author || 'The Limelight Online'}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="canonical" href="${url}">

<!-- Open Graph (Facebook/LinkedIn sharing) -->
<meta property="og:site_name" content="The Limelight Online">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:url" content="${url}">

<!-- Twitter Card (X/Twitter sharing) -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${imgUrl}">
<meta name="twitter:site" content="@thelimelightonline">
  `.trim();
}

function getOrganizationSchema() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "The Limelight Online",
    "alternateName": [
      "The Limelight",
      "Limelight South",
      "The Limelight Magazine",
      "The Limelight Bimonthly Magazine"
    ],
    "url": SITE_URL,
    "logo": `${SITE_URL}/favicon/favicon-192x192.png`,
    "description": "The Limelight Online is a bimonthly digital magazine covering South Asian literature, essays, arts and culture.",
    "sameAs": [
      "https://www.instagram.com/the_limelight_bimonthly/",
      "https://www.facebook.com/profile.php?id=100091897094886",
      "https://www.youtube.com/@Thelimelightonline"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Editorial"
    }
  });
}

function getWebSiteSchema() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": SITE_URL,
    "name": "The Limelight Online",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  });
}

function getBreadcrumbSchema(breadcrumbs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs
  });
}

function buildRelatedArticlesHtml(currentArticle, allPosts) {
  // Same category first, exclude current
  const sameCategory = allPosts.filter(p =>
    p.category_id === currentArticle.category_id && p.id !== currentArticle.id && p.slug
  ).slice(0, 3);

  let related = [...sameCategory];

  // Fill remainder with random posts (no duplicates, no self)
  if (related.length < 3) {
    const usedIds = new Set([currentArticle.id, ...related.map(p => p.id)]);
    const pool = allPosts.filter(p => !usedIds.has(p.id));
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    related = [...related, ...pool.slice(0, 3 - related.length)];
  }

  if (related.length === 0) return '';

  const cards = related.map(p => {
    const categoryName = p.categories?.name || 'General';
    return `<a href="/article/${normalizeSlug(p.slug)}/" class="related-card" style="text-decoration:none;display:block;">
      <img src="${p.image_url || ''}" alt="${escapeQuotes(p.title)}" class="related-card-img" loading="lazy">
      <div class="related-card-body">
        <div class="related-card-category">${categoryName}</div>
        <span class="related-card-title">${p.title}</span>
      </div>
    </a>`;
  }).join('\n');

  return `
  <section class="related-section">
    <h3 class="related-heading">Related Articles</h3>
    <div class="related-grid">
      ${cards}
    </div>
  </section>`;
}

function buildAuthorSocialLinksHtml(author) {
  if (!author) return '';
  const socialLinks = [];
  if (author.twitter_url && author.twitter_url.trim()) {
    socialLinks.push(`<a href="${author.twitter_url}" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><i class="fab fa-x-twitter"></i></a>`);
  }
  if (author.instagram_url && author.instagram_url.trim()) {
    socialLinks.push(`<a href="${author.instagram_url}" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="fab fa-instagram"></i></a>`);
  }
  if (author.linkedin_url && author.linkedin_url.trim()) {
    socialLinks.push(`<a href="${author.linkedin_url}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="fab fa-linkedin"></i></a>`);
  }
  if (author.website_url && author.website_url.trim()) {
    socialLinks.push(`<a href="${author.website_url}" target="_blank" rel="noopener noreferrer" aria-label="Website"><i class="fas fa-globe"></i></a>`);
  }
  if (author.academia_url && author.academia_url.trim()) {
    socialLinks.push(`<a href="${author.academia_url}" target="_blank" rel="noopener noreferrer" aria-label="Academia.edu"><i class="fas fa-graduation-cap"></i></a>`);
  }
  if (author.orcid_url && author.orcid_url.trim()) {
    socialLinks.push(`<a href="${author.orcid_url}" target="_blank" rel="noopener noreferrer" aria-label="ORCID"><i class="fab fa-orcid"></i></a>`);
  }

  return socialLinks.length > 0
    ? `<div class="author-bio-social">${socialLinks.join('')}</div>`
    : '';
}

function buildAuthorBioCardHtml(article) {
  const author = article.authors || {};
  const authorName = author.full_name || 'The Limelight';
  const authorAvatar = author.avatar_url ||
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%238B4513%22/%3E%3Ctext x=%2240%22 y=%2252%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2236%22%3E%3F%3C/text%3E%3C/svg%3E';
  const authorId = article.author_id || '';
  const authorLink = authorId ? `<a href="/author/${authorId}.html" class="author-bio-name">${authorName}</a>` : `<span class="author-bio-name">${authorName}</span>`;
  const bio = author.bio || '';
  const socialRowHtml = buildAuthorSocialLinksHtml(author);

  return `
  <div class="author-bio-card">
    <div class="author-bio-label">Author</div>
    <img src="${authorAvatar}" alt="${escapeQuotes(authorName)}" class="author-bio-avatar"
         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%238B4513%22/%3E%3Ctext x=%2240%22 y=%2252%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2236%22%3E%3F%3C/text%3E%3C/svg%3E'">
    ${authorLink}
    ${bio ? `<p class="author-bio-text">${bio}</p>` : ''}
    ${socialRowHtml}
  </div>`;
}

// ─── Phase 2: Data Fetching ────────────────────────────────────────────────────

async function fetchAllData() {
  console.log('Fetching data from Supabase...');

  const { data: parentCats, error: e1 } = await supabase
    .from('categories').select('*').is('parent_id', null).order('name');
  if (e1) throw new Error('Categories fetch failed: ' + e1.message);

  const categoriesWithChildren = await Promise.all(
    parentCats.map(async (parent) => {
      const { data: children } = await supabase
        .from('categories').select('*').eq('parent_id', parent.id).order('name');
      return { ...parent, children: children || [] };
    })
  );

  const baseSelect = 'id, title, slug, content, excerpt, image_url, created_at, updated_at, category_id, author_id, is_featured, status, publish_date, authors(full_name, avatar_url, bio, twitter_url, instagram_url, linkedin_url, website_url, academia_url, orcid_url), categories(name, slug)';

  const { data: rawAllPosts, error: e4 } = await supabase
    .from('posts')
    .select(baseSelect)
    .order('created_at', { ascending: false });
  if (e4) throw new Error('All posts fetch failed: ' + e4.message);

  const now = new Date();
  
  // Filter for public listings
  const allPosts = rawAllPosts.filter(p => p.status === 'published' && (!p.publish_date || new Date(p.publish_date) <= now));

  // Derive latest and featured locally to respect the date filter without under-fetching
  const featuredPosts = allPosts.filter(p => p.is_featured).slice(0, 5);
  const latestPosts = allPosts.slice(0, 8);

  const { data: allAuthors, error: e5 } = await supabase
    .from('authors')
    .select('*')
    .order('full_name');
  if (e5) throw new Error('Authors fetch failed: ' + e5.message);

  console.log(
    `Fetched: ${categoriesWithChildren.length} categories, ` +
    `${featuredPosts.length} featured, ${latestPosts.length} latest, ` +
    `${allPosts.length} public articles, ${rawAllPosts.length} total raw articles`
  );

  return { categoriesWithChildren, featuredPosts, latestPosts, allPosts, rawAllPosts, allAuthors };
}

// ─── Phase 2: Homepage Helpers ─────────────────────────────────────────────────

function generateNavHtml(categoriesWithChildren) {
  let html = `<li class="nav-item"><a href="/index.html" class="nav-link">Home</a></li>`;
  categoriesWithChildren.forEach(parent => {
    if (parent.children && parent.children.length > 0) {
      const childLinks = parent.children.map(c =>
        `<a href="/index.html?categories=${c.slug}" class="dropdown-item">${c.name}</a>`
      ).join('\n');
      html += `
        <li class="nav-item has-dropdown">
          <span class="nav-link">${parent.name} <i class="fas fa-chevron-down" style="font-size:10px;margin-left:5px;"></i></span>
          <div class="dropdown">
            <a href="/index.html?categories=${parent.slug}" class="dropdown-item">All ${parent.name}</a>
            ${childLinks}
          </div>
        </li>`;
    } else {
      html += `<li class="nav-item"><a href="/index.html?categories=${parent.slug}" class="nav-link">${parent.name}</a></li>`;
    }
  });
  html += `
    <li class="nav-item"><a href="/authors.html" class="nav-link">Authors</a></li>
    <li class="nav-item"><a href="/contact.html" class="nav-link">Contact</a></li>`;
  return html;
}

function generateFooterCategoriesHtml(categoriesWithChildren) {
  return categoriesWithChildren.map(p =>
    `<li><a href="/index.html?categories=${p.slug}">${p.name}</a></li>`
  ).join('\n');
}

function generateCarouselHtml(featuredPosts) {
  if (!featuredPosts || featuredPosts.length === 0) return '';
  
  const slidesHtml = featuredPosts.map((p, i) => {
    const categoryName = p.categories?.name || '';
    const authorName = p.authors?.full_name || '';
    const authorAvatar = p.authors?.avatar_url || '';
    const readingTime = estimateReadingTime(p.content || p.excerpt || '');
    const date = new Date(p.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    const slug = normalizeSlug(p.slug);
    
    return `
    <div class="hero-slide ${i === 0 ? 'active' : ''}" 
         data-index="${i}" 
         style="background-image: url('${p.image_url}');">
      <div class="hero-cinematic-overlay"></div>
      <div class="hero-content">
        <div class="hero-eyebrow">
          <span class="hero-category">${categoryName}</span>
          <span class="hero-dot">•</span>
          <span class="hero-readtime">${readingTime} MIN READ</span>
        </div>
        <h2 class="hero-title">${p.title}</h2>
        <p class="hero-excerpt">${(p.excerpt || '').substring(0, 160)}</p>
        <div class="hero-author-card">
          ${authorAvatar
            ? `<img src="${authorAvatar}" alt="${authorName}" class="hero-author-avatar">`
            : `<div class="hero-author-initials">${authorName.charAt(0)}</div>`
          }
          <div class="hero-author-info">
            <span class="hero-author-name">${authorName}</span>
            <span class="hero-author-date">${date}</span>
          </div>
        </div>
        <a href="/article/${slug}" class="hero-cta">
          Read Article <span class="hero-cta-arrow">→</span>
        </a>
      </div>
    </div>`;
  }).join('');
  
  const indexPanelHtml = featuredPosts.map((p, i) => `
    <div class="hero-index-item ${i === 0 ? 'active' : ''}" data-slide="${i}">
      <span class="hero-index-num">0${i + 1}</span>
      <img src="${p.image_url}" alt="" class="hero-index-thumb">
      <span class="hero-index-title">${p.title}</span>
    </div>
  `).join('');
  
  return `
  <div class="cinematic-hero" id="cinematicHero">
    <div class="hero-slides-wrapper">${slidesHtml}</div>
    <div class="hero-index-panel">${indexPanelHtml}</div>
    <div class="hero-nav">
      <button class="hero-prev" aria-label="Previous article">←</button>
      <button class="hero-next" aria-label="Next article">→</button>
    </div>
    <div class="hero-progress-bar">
      <div class="hero-progress-fill" id="heroProgressFill"></div>
    </div>
    <div class="hero-counter">
      <span id="heroCurrentSlide">01</span> / 
      <span>${String(featuredPosts.length).padStart(2, '0')}</span>
    </div>
  </div>`;
}


function generateArticleCardsHtml(latestPosts) {
  return latestPosts.map(p => {
    const href = '/article/' + normalizeSlug(p.slug);
    return `
    <div class="article-card">
      <a href="${href}" class="card-image-wrapper">
        <span class="card-badge">${p.categories?.name || 'General'}</span>
        <img src="${p.image_url}" class="card-image" loading="lazy" alt="${escapeQuotes(p.title)}" width="400" height="220" style="aspect-ratio: 400/220; object-fit: cover;">
      </a>
      <div class="card-content">
        <h3 class="card-title"><a href="${href}">${p.title}</a></h3>
        <div class="card-excerpt">${p.excerpt || ''}</div>
        <div class="card-author">
          <img src="${p.authors?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22%3E%3Crect width=%2230%22 height=%2230%22 fill=%22%238B4513%22/%3E%3Ctext x=%2215%22 y=%2220%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22%3E%3F%3C/text%3E%3C/svg%3E'}" class="author-avatar" alt="${escapeQuotes(p.authors?.full_name || '')}">
          <span>${p.authors?.full_name || 'The Limelight'}</span>
          <span style="margin-left:auto;">${new Date(p.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>`;
  }).join('\n');
}



function buildNavHtml(categoriesWithChildren) {
  let html = `<li class="nav-item"><a href="/index.html" class="nav-link">Home</a></li>`;
  categoriesWithChildren.forEach(parent => {
    if (!parent.slug) return;
    if (parent.children && parent.children.length > 0) {
      html += `<li class="nav-item has-dropdown">
        <a href="/category/${parent.slug}.html" class="nav-link">
          ${parent.name} <i class="fas fa-chevron-down" style="font-size:10px;margin-left:4px;"></i>
        </a>
        <div class="dropdown">
          <a href="/category/${parent.slug}.html" class="dropdown-item">All ${parent.name}</a>
          ${parent.children.map(c => `<a href="/category/${c.slug}.html" class="dropdown-item">${c.name}</a>`).join('')}
        </div>
      </li>`;
    } else {
      html += `<li class="nav-item"><a href="/category/${parent.slug}.html" class="nav-link">${parent.name}</a></li>`;
    }
  });
  html += `
    <li class="nav-item"><a href="/authors.html" class="nav-link">Authors</a></li>
    <li class="nav-item"><a href="/contact.html" class="nav-link">Contact</a></li>`;
  return html;
}



function buildArticleCardsHtml(posts) {
  if (!posts || posts.length === 0) return '<p style="text-align:center;color:#888;">No articles found.</p>';
  return posts.map(p => {
    const authorName = p.authors?.full_name || 'The Limelight';
    const authorAvatar = p.authors?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22%3E%3Crect width=%2230%22 height=%2230%22 fill=%22%238B4513%22/%3E%3Ctext x=%2215%22 y=%2220%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22%3E%3F%3C/text%3E%3C/svg%3E';
    const categoryName = p.categories?.name || 'General';
    const date = new Date(p.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
    return `<div class="article-card">
      <a href="/article/${p.slug}/" class="card-image-wrapper">
        <span class="card-badge">${categoryName}</span>
        <img src="${p.image_url}" class="card-image" loading="lazy" alt="${p.title}" width="400" height="220" style="aspect-ratio: 400/220; object-fit: cover;">
      </a>
      <div class="card-content">
        <h3 class="card-title"><a href="/article/${p.slug}/">${p.title}</a></h3>
        <div class="card-excerpt">${p.excerpt || ''}</div>
        <div class="card-author">
          <img src="${authorAvatar}" class="author-avatar" alt="${authorName}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22%3E%3Crect width=%2230%22 height=%2230%22 fill=%22%238B4513%22/%3E%3Ctext x=%2215%22 y=%2220%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22%3E%3F%3C/text%3E%3C/svg%3E'">
          <span>${authorName}</span>
          <span style="margin-left:auto;font-size:0.8rem;color:#888;">${date}</span>
        </div>
      </div>
    </div>`;
  }).join('\n');
}

function buildIndexScripts() {
  return `<script>
(function initCinematicHero() {
  const DURATION = 8000;
  const slides = document.querySelectorAll('.hero-slide');
  const indexItems = document.querySelectorAll('.hero-index-item');
  const progressFill = document.getElementById('heroProgressFill');
  const counterEl = document.getElementById('heroCurrentSlide');
  
  if (!slides.length) return;
  
  let current = 0;
  let timer = null;
  let progressTimer = null;
  let paused = false;
  
  function goTo(n) {
    slides[current].classList.remove('active');
    if (indexItems[current]) indexItems[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (indexItems[current]) indexItems[current].classList.add('active');
    if (counterEl) counterEl.textContent = String(current + 1).padStart(2, '0');
    startProgress();
  }
  
  function startProgress() {
    if (progressFill) {
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          progressFill.style.transition = \`width \${DURATION}ms linear\`;
          progressFill.style.width = '100%';
        });
      });
    }
    clearTimeout(timer);
    if (!paused) timer = setTimeout(() => goTo(current + 1), DURATION);
  }
  
  function pause() { paused = true; clearTimeout(timer); }
  function resume() { paused = false; startProgress(); }
  
  // Buttons
  const prevBtn = document.querySelector('.hero-prev');
  const nextBtn = document.querySelector('.hero-next');
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));
  
  // Index panel
  indexItems.forEach((item, i) => {
    item.addEventListener('click', () => goTo(i));
  });
  
  // Hover pause
  const hero = document.getElementById('cinematicHero');
  if (hero) {
    hero.addEventListener('mouseenter', pause);
    hero.addEventListener('mouseleave', resume);
  }
  
  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });
  
  // Swipe (mobile)
  let touchStartX = 0;
  if (hero) {
    hero.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
    }, { passive: true });
  }
  
  startProgress();
})();

document.addEventListener('DOMContentLoaded', () => {

  const toggle = document.querySelector('.mobile-nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  const navList = document.querySelector('.nav-list');

  if (toggle && mainNav) {
    toggle.addEventListener('click', () => {
      // Toggle main-nav visibility AND nav-list active class
      const isOpen = mainNav.style.display === 'flex' || 
                     mainNav.style.display === 'block';
      mainNav.style.display = isOpen ? 'none' : 'block';
      navList && navList.classList.toggle('active', !isOpen);
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars', isOpen);
        icon.classList.toggle('fa-times', !isOpen);
      }
    });
  }

  document.querySelectorAll('.has-dropdown').forEach(item => {
    const link = item.querySelector('.nav-link');
    if (!link) return;
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 992) {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.has-dropdown.mobile-open').forEach(o => {
          if (o !== item) o.classList.remove('mobile-open');
        });
        item.classList.toggle('mobile-open');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.main-nav') && !e.target.closest('.mobile-nav-toggle')) {
      navList && navList.classList.remove('active');
      document.querySelectorAll('.has-dropdown.mobile-open').forEach(i => i.classList.remove('mobile-open'));
    }
  });

  let searchCache = null;
  const searchContainer = document.getElementById('searchContainer');
  const searchInput = document.getElementById('searchInput');
  const searchIcon = document.getElementById('searchIcon');
  const searchResults = document.getElementById('searchResults');

  if (searchIcon) {
    searchIcon.addEventListener('click', () => {
      searchContainer.classList.toggle('active');
      if (searchContainer.classList.contains('active')) searchInput && searchInput.focus();
      else { if (searchResults) { searchResults.innerHTML = ''; searchResults.style.display = 'none'; } }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', async () => {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length < 2) { searchResults.style.display = 'none'; return; }
      if (!searchCache) {
        try { const res = await fetch('/search.json'); searchCache = await res.json(); }
        catch(e) { console.warn('Search failed', e); return; }
      }
      const results = searchCache
        .filter(p => p.title.toLowerCase().includes(query) || (p.excerpt||'').toLowerCase().includes(query))
        .slice(0, 5);
      searchResults.innerHTML = results.length === 0
        ? '<div style="padding:12px;color:#888;">No results found</div>'
        : results.map(p => \`<a href="/article/\${p.slug}/" class="search-result-item" style="display:flex;gap:10px;padding:10px;align-items:center;text-decoration:none;color:inherit;border-bottom:1px solid #eee;">
            <img src="\${p.image_url}" style="width:50px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">
            <div>
              <div style="font-weight:500;font-size:0.9rem;">\${p.title}</div>
              <div style="font-size:0.75rem;color:#8B4513;">\${p.category}</div>
            </div>
          </a>\`).join('');
      searchResults.style.display = 'block';

    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchContainer')) searchResults.style.display = 'none';
    });
  }

  // Infinite Scroll Logic
  const sentinel = document.getElementById('scrollSentinel');
  let currentLoaded = 9;
  let isLoading = false;
  
  if (sentinel) {
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !isLoading) {
        isLoading = true;
        sentinel.innerHTML = '<i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--accent-color); margin-top:20px;"></i>';
        
        try {
          if (typeof searchCache === 'undefined' || !searchCache) {
            const res = await fetch('/search.json');
            window.searchCache = await res.json();
          }
          const cacheToUse = window.searchCache || searchCache;
          const nextPosts = cacheToUse.slice(currentLoaded, currentLoaded + 9);
          
          if (nextPosts.length > 0) {
            // Simulate slight network delay for the animation to look good
            await new Promise(r => setTimeout(r, 400));
            
            const grid = document.getElementById('articlesGrid');
            nextPosts.forEach((p, index) => {
              const d = new Date(p.date);
              const dateStr = d.toLocaleDateString('en-IN') !== 'Invalid Date' ? d.toLocaleDateString('en-IN') : p.date;
              const authorName = p.author || 'The Limelight';
              const authorAvatar = p.authors?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22%3E%3Crect width=%2230%22 height=%2230%22 fill=%22%238B4513%22/%3E%3Ctext x=%2215%22 y=%2220%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22%3E%3F%3C/text%3E%3C/svg%3E';
              
              const delay = (index * 0.05).toFixed(2);
              
              grid.insertAdjacentHTML('beforeend', \`
                <div class="article-card" style="animation-delay: \${delay}s; animation-fill-mode: both; opacity: 0; animation-name: fadeSlideUp; animation-duration: 0.5s; animation-timing-function: ease;">
                  <a href="/article/\${p.slug}/" class="card-image-wrapper">
                    <span class="card-badge">\${p.category || 'General'}</span>
                    <img src="\${p.image_url}" class="card-image" loading="lazy" alt="\${p.title}" width="400" height="220" style="aspect-ratio: 400/220; object-fit: cover;">
                  </a>
                  <div class="card-content">
                    <h3 class="card-title"><a href="/article/\${p.slug}/">\${p.title}</a></h3>
                    <div class="card-excerpt">\${p.excerpt || ''}</div>
                    <div class="card-author">
                      <img src="\${authorAvatar}" class="author-avatar" alt="\${authorName}">
                      <span>\${authorName}</span>
                      <span style="margin-left:auto;">\${dateStr}</span>
                    </div>
                  </div>
                </div>\`);
            });
            currentLoaded += nextPosts.length;
          }
          
          if (cacheToUse && currentLoaded >= cacheToUse.length) {
            sentinel.style.display = 'none';
            observer.disconnect();
          } else {
            sentinel.innerHTML = '';
          }
        } catch (e) {
          console.warn('Load more failed', e);
          sentinel.innerHTML = 'Error loading articles.';
        }
        isLoading = false;
      }
    });
    observer.observe(sentinel);
  }
});
</script>`;
}

// ─── Phase 2: generateIndexHtml ────────────────────────────────────────────────

function generateIndexHtml(data) {
  const { categoriesWithChildren, featuredPosts, latestPosts } = data;
  // Read index.html and extract ALL style content reliably
  const originalIndex = fs.readFileSync('index.html', 'utf-8');

  // More reliable extraction - gets content BETWEEN style tags
  const styleContents = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(originalIndex)) !== null) {
    styleContents.push(styleMatch[1]); // push content only, not the tags
  }
  const allStyles = styleContents.length > 0
    ? `<style>\n${styleContents.join('\n')}\n</style>`
    : '';

  // Verify extraction worked
  if (!allStyles || allStyles.length < 100) {
    console.error('WARNING: CSS extraction failed or returned very little CSS!');
    console.log('index.html size:', originalIndex.length, 'chars');
    console.log('Style blocks found:', styleContents.length);
  }
  const navItemsHtml = buildNavHtml(categoriesWithChildren);
  const heroHtml = generateCarouselHtml(featuredPosts);
  const cardsHtml = buildArticleCardsHtml(latestPosts);
  const footerCatsHtml = categoriesWithChildren.map(p =>
    `<li><a href="/category/${p.slug}.html">${p.name}</a></li>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
${getSEOHeadTags({
  title: 'The Limelight | Home',
  description: 'The Limelight Online - Literature, Essays, Arts and Culture',
  keywords: 'South Asian literature, essays, culture, Limelight Online',
  url: `${SITE_URL}/`,
  type: 'website'
})}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://i.ibb.co">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
${getFaviconHtml()}
${allStyles}
${getDarkModeCSS()}


<style>
/* ── HEADER LAYOUT FIX ── */
.site-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  width: 100%;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1300px;
  margin: 0 auto;
  padding: 10px 20px;
  gap: 20px;
}

.logo-link { flex-shrink: 0; }
.logo-img { height: 55px; width: auto; display: block; }

/* ── NAV LAYOUT FIX ── */
.main-nav { flex: 1; display: flex; justify-content: flex-end; }

.nav-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 4px;
  flex-wrap: nowrap;
}

.nav-item { position: relative; }

.nav-link {
  display: block;
  padding: 8px 12px;
  font-family: 'Lato', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  color: #333;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  transition: color 0.2s;
  cursor: pointer;
  border: none;
  background: none;
}

.nav-link:hover { color: #8B4513; }

/* ── DROPDOWN FIX ── */
.has-dropdown .dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  background: #fff;
  min-width: 180px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.12);
  border-top: 2px solid #8B4513;
  z-index: 999;
  border-radius: 0 0 6px 6px;
}

.has-dropdown:hover .dropdown { display: block; }

.dropdown-item {
  display: block;
  padding: 10px 16px;
  color: #333;
  text-decoration: none;
  font-size: 0.85rem;
  font-family: 'Lato', sans-serif;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s, color 0.2s;
}

.dropdown-item:hover {
  background: #fef6f0;
  color: #8B4513;
}

.dropdown-item:last-child { border-bottom: none; }

/* ── CAROUSEL FIX ── */
.featured-section {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #1a1a1a;
  margin-top: 0;
}

.carousel-container {
  position: relative;
  width: 100%;
  height: 520px;
  overflow: hidden;
}

.carousel-slide {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}

.carousel-slide.active {
  opacity: 1;
  pointer-events: auto;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.carousel-overlay {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.85));
  padding: 40px 40px 30px;
  color: white;
}

.carousel-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.carousel-category {
  background: #8B4513;
  color: white;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}

.carousel-title {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 10px;
  color: white;
}

.carousel-excerpt {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.85);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 44px; height: 44px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-btn:hover { background: rgba(255,255,255,0.4); }
.carousel-prev { left: 15px; }
.carousel-next { right: 15px; }

.carousel-indicators {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}

.indicator {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  cursor: pointer;
  transition: background 0.2s;
}

.indicator.active { background: white; }

/* ── MOBILE NAV TOGGLE ── */
.mobile-nav-toggle {
  display: none;
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #333;
  cursor: pointer;
  padding: 5px;
  z-index: 1001;
}

/* ── MOBILE STYLES ── */
@media (max-width: 992px) {
  .mobile-nav-toggle { display: flex; align-items: center; }

  .main-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 998; }

  .main-nav.active, .nav-list.active ~ * { display: block; }

  .nav-list {
    flex-direction: column;
    align-items: stretch;
    padding: 10px 0;
    gap: 0;
  }

  .nav-list.active { display: flex; }
  .nav-list:not(.active) { display: none; }

  .nav-link {
    padding: 12px 20px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 0.9rem;
  }

  .has-dropdown .dropdown {
    position: static;
    box-shadow: none;
    border-top: none;
    border-left: 3px solid #8B4513;
    margin-left: 20px;
    display: none;
    border-radius: 0;
  }

  .has-dropdown.mobile-open .dropdown { display: block; }

  .carousel-container { height: 300px; }
  .carousel-title { font-size: 1.3rem; }
  .carousel-overlay { padding: 20px 15px 15px; }

  .header-inner { padding: 10px 15px; position: relative; }
  .main-nav { position: absolute; top: 100%; }
}

@media (max-width: 480px) {
  .carousel-container { height: 250px; }
  .carousel-title { font-size: 1.1rem; }
  .logo-img { height: 40px; }
}

/* ── CINEMATIC HERO LAYOUT ENFORCEMENT ── */
.cinematic-hero {
  position: relative;
  height: 92vh;
  min-height: 600px;
  overflow: hidden;
  background: #0a0a0a;
}
.hero-slides-wrapper, .hero-slide, .hero-cinematic-overlay {
  position: absolute;
  inset: 0;
}
.hero-content {
  position: absolute;
  left: 6%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
}
.hero-index-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 2;
}
@media (max-width: 900px) {
  .hero-index-panel { display: none; }
  .cinematic-hero { height: 75vh; }
}
@media (max-width: 560px) {
  .hero-content { left: 4%; max-width: 90%; }
  .cinematic-hero { height: 85vh; }
}

</style>
${getDarkModeInitScript()}
<script type="application/ld+json">${getOrganizationSchema()}</script>
<script type="application/ld+json">${getWebSiteSchema()}</script>
</head>
<body>
<header class="header">
  <div class="container header-content">
    <a href="/index.html" class="site-title">
      <img src="https://i.ibb.co/NdsYM9dx/web-logo-123.png" alt="The Limelight">
    </a>
    <div class="mobile-controls" style="display: flex; gap: 15px; align-items: center;">
      <button class="mobile-nav-toggle" aria-label="Toggle navigation">
        <i class="fas fa-bars"></i>
      </button>
    </div>
    <ul class="nav-menu" id="navMenu">
      ${navItemsHtml}
      <li class="nav-item">${getDarkModeToggleBtn()}</li>
      <li class="nav-item">
        <div class="search-container" id="searchContainer">
          <input type="text" class="search-input" id="searchInput" placeholder="Search articles...">
          <i class="fas fa-search search-icon" id="searchIcon"></i>
          <div class="search-results" id="searchResults"></div>
        </div>
      </li>
    </ul>
  </div>
</header>
${heroHtml}
<main class="main-content">
  <h2 style="text-align:center;font-family:'Playfair Display',serif;color:#8B4513;margin:40px 0 30px;font-size:2rem;">Latest Articles</h2>
  <div class="articles-grid" id="articlesGrid">${cardsHtml}</div>
  <div style="text-align:center;margin:40px 0;display:flex;justify-content:center;align-items:center;" id="scrollSentinel">
  </div>
</main>
<footer class="site-footer">
  <div class="footer-inner">

    <!-- Column 1: Brand + About tagline -->
    <div class="footer-col footer-brand">
      <h3 class="footer-logo">THE LIMELIGHT</h3>
      <p class="footer-tagline">
        A bimonthly academic web magazine devoted to South Asian
        literature, Islamic thought, arts and culture — writing for
        a world that still believes ideas matter.
      </p>
      <a href="/contact.html" class="footer-about-link">
        About The Limelight &rarr;
      </a>
    </div>

    <!-- Column 2: Explore -->
    <div class="footer-col">
      <h4 class="footer-col-title">Explore</h4>
      <ul class="footer-links">
        <li><a href="/index.html">Home</a></li>
        <li><a href="/authors.html">Authors</a></li>
        <li><a href="/contact.html">Contact Us</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
    </div>

    <!-- Column 3: Categories -->
    <div class="footer-col">
      <h4 class="footer-col-title">Categories</h4>
      <ul class="footer-links" id="footerCategories">
        ${footerCatsHtml}
      </ul>
    </div>

    <!-- Column 4: Follow us -->
    <div class="footer-col">
      <h4 class="footer-col-title">Follow Us</h4>
      <div class="footer-social">
        <a href="https://www.instagram.com/the_limelight_bimonthly/" target="_blank" rel="noopener" aria-label="Instagram">
          <i class="fab fa-instagram"></i>
        </a>
        <a href="https://www.facebook.com/profile.php?id=100091897094886#" target="_blank" rel="noopener" aria-label="Facebook">
          <i class="fab fa-facebook-f"></i>
        </a>
        <a href="https://www.youtube.com/@Thelimelightonline" target="_blank" rel="noopener" aria-label="YouTube">
          <i class="fab fa-youtube"></i>
        </a>
      </div>
    </div>

  </div><!-- /.footer-inner -->

  <div class="footer-bottom">
    <p>&copy; 2025 The Limelight Online. All rights reserved.</p>
    <p class="footer-bottom-links">
      <a href="/contact.html">Contact</a>
      &nbsp;&middot;&nbsp;
      <a href="/sitemap.xml">Sitemap</a>
    </p>
  </div>
</footer>
__SCRIPTS_PLACEHOLDER__
${getDarkModeToggleScript()}
</body>
</html>`;

  fs.writeFileSync('dist/index.html', html.replace('__SCRIPTS_PLACEHOLDER__', buildIndexScripts()));
  console.log('✓ Generated dist/index.html');
}

// ─── Phase 2: generateCategoryPages ───────────────────────────────────────────

// REPLACE the entire generateCategoryPages function (around line 808) with this fixed version

async function generateCategoryPages(data) {
  const { categoriesWithChildren, allPosts } = data;
  
  // Flatten categories array for easy lookup
  const categories = [];
  categoriesWithChildren.forEach(c => {
    categories.push(c);
    if (c.children) categories.push(...c.children);
  });

  const originalIndex = fs.readFileSync('index.html', 'utf-8');
  const styleContents = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(originalIndex)) !== null) {
    styleContents.push(styleMatch[1]);
  }
  const allStyles = styleContents.length > 0
    ? `<style>\n${styleContents.join('\n')}\n</style>`
    : '';

  const navItemsHtml = buildNavHtml(categoriesWithChildren);
  const footerCatsHtml = categoriesWithChildren
    .filter(c => !c.parent_id && c.slug)
    .map(c => `<li><a href="/category/${c.slug}.html">${c.name}</a></li>`)
    .join('\n');

  categories.forEach(category => {
    // 1) Find subcategories
    const subCategories = categories.filter(c => c.parent_id === category.id);
    const subCatsHtml = subCategories.length > 0
      ? `<div class="subcats-nav">
           ${subCategories.map(sub => `<a href="/category/${sub.slug}.html" class="subcat-link">${sub.name}</a>`).join('')}
         </div>`
      : '';

    // 2) Filter posts to this category OR its subcategories
    const categoryIds = [category.id, ...subCategories.map(c => c.id)];
    const catPosts = allPosts.filter(p => categoryIds.includes(p.category_id));

    // 3) Split posts into hero (1), featured (next 3), grid (rest)
    const heroPost = catPosts.length > 0 ? catPosts[0] : null;
    const featuredPosts = catPosts.slice(1, 4);
    const gridPosts = catPosts.slice(4);

    const pageTitle = `${category.name} | The Limelight`;
    const pageDescription = category.description || `Explore articles in ${category.name}`;

    // 4) Build specific HTML sections
    const catHeroHtml = heroPost ? `
      <a href="/article/${normalizeSlug(heroPost.slug)}/" class="cat-hero-card">
        <img src="${heroPost.image_url}" alt="" class="cat-hero-img">
        <div class="cat-hero-overlay"></div>
        <div class="cat-hero-content">
          <h2 style="font-family:'Playfair Display',serif; font-size:42px; margin:0 0 15px;">${heroPost.title}</h2>
          <p style="font-family:'Lato',sans-serif; font-size:16px; opacity:0.9;">${(heroPost.excerpt || '').substring(0, 150)}</p>
        </div>
      </a>
    ` : '';

    const catFeaturedHtml = featuredPosts.length ? `
      <div class="cat-featured-grid">
        ${buildArticleCardsHtml(featuredPosts)}
      </div>
    ` : '';

    const catGridHtml = gridPosts.length ? `
      <div class="articles-grid">
        ${buildArticleCardsHtml(gridPosts)}
      </div>
    ` : '';

    // 5) Build full HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<meta name="description" content="${pageDescription}">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${pageDescription}">
<meta property="og:url" content="${SITE_URL}/category/${category.slug}.html">
<meta property="og:type" content="website">
<link rel="canonical" href="${SITE_URL}/category/${category.slug}.html">
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://i.ibb.co">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
${getFaviconHtml()}
${allStyles}
${getDarkModeCSS()}
<style>
/* ── HEADER LAYOUT FIX ── */
.header { position: sticky; top: 0; z-index: 1000; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.header-content { display: flex; align-items: center; justify-content: space-between; height: 80px; }
.site-title img { height: 50px; width: auto; display: block; }
.nav-menu { display: flex; align-items: center; gap: 20px; margin: 0; padding: 0; list-style: none; }
.nav-item { position: relative; }
.nav-link { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 600; color: #333; text-decoration: none; text-transform: uppercase; padding: 10px 0; transition: color 0.3s; }
.nav-link:hover { color: #8B4513; }
.mobile-nav-toggle { display: none; background: none; border: none; font-size: 24px; color: #333; cursor: pointer; }
[data-theme="dark"] .header { background: #1a1a1a; }
[data-theme="dark"] .nav-link, [data-theme="dark"] .mobile-nav-toggle { color: #f5f5f5; }
[data-theme="dark"] .nav-link:hover { color: #C89A47; }
</style>
${getDarkModeInitScript()}
</head>
<body>

<header class="header">
  <div class="container header-content">
    <a href="/index.html" class="site-title">
      <img src="https://i.ibb.co/NdsYM9dx/web-logo-123.png" alt="The Limelight">
    </a>
    <div class="mobile-controls" style="display: flex; gap: 15px; align-items: center;">
      <button class="mobile-nav-toggle" aria-label="Toggle navigation">
        <i class="fas fa-bars"></i>
      </button>
    </div>
    <ul class="nav-menu" id="navMenu">
      ${navItemsHtml}
      <li class="nav-item">${getDarkModeToggleBtn()}</li>
    </ul>
  </div>
</header>

<main class="main-content" style="padding-top: 0; max-width: 100%;">
  
  <header class="cat-page-header">
    <h1 class="cat-page-title">${category.name}</h1>
    <p class="cat-page-desc">${category.description || ''}</p>
    ${subCatsHtml}
  </header>

  <div class="cat-layout-wrapper">
    ${catHeroHtml}
    ${catFeaturedHtml}
    ${catGridHtml}
    
    ${catPosts.length === 0 ? '<p style="text-align:center; padding: 100px 0; font-family:\'Lato\',sans-serif; color:#666;">No articles in this category yet.</p>' : ''}
  </div>

</main>

<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-col footer-brand">
      <h3 class="footer-logo">THE LIMELIGHT</h3>
      <p class="footer-tagline">
        A bimonthly academic web magazine devoted to South Asian
        literature, Islamic thought, arts and culture — writing for
        a world that still believes ideas matter.
      </p>
      <a href="/contact.html" class="footer-about-link">About The Limelight &rarr;</a>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">Explore</h4>
      <ul class="footer-links">
        <li><a href="/index.html">Home</a></li>
        <li><a href="/authors.html">Authors</a></li>
        <li><a href="/contact.html">Contact Us</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">Categories</h4>
      <ul class="footer-links" id="footerCategories">
        ${footerCatsHtml}
      </ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">Follow Us</h4>
      <div class="footer-social">
        <a href="https://www.instagram.com/the_limelight_bimonthly/" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
        <a href="https://www.facebook.com/profile.php?id=100091897094886#" target="_blank" rel="noopener" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="https://www.youtube.com/@Thelimelightonline" target="_blank" rel="noopener" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; ${new Date().getFullYear()} The Limelight Online. All Rights Reserved.</p>
  </div>
</footer>

<script>
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (toggle && navMenu) {
    toggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }
});
</script>
${getDarkModeToggleScript()}
</body>
</html>`;

    const categoryDir = path.join('dist', 'category');
    if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });
    const filePath = path.join(categoryDir, `${category.slug}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`✓ Category: /category/${category.slug}.html (${catPosts.length} posts)`);
  });
}

async function generateAuthorPages(data) {
  const { categoriesWithChildren, allPosts, allAuthors } = data;
  if (!allAuthors || allAuthors.length === 0) {
    console.log('No authors found, skipping author pages');
    return;
  }

  const originalIndex = fs.readFileSync('index.html', 'utf-8');
  const styleContents = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(originalIndex)) !== null) {
    styleContents.push(styleMatch[1]);
  }
  const allStyles = styleContents.length > 0
    ? `<style>\n${styleContents.join('\n')}\n</style>`
    : '';

  fs.mkdirSync('dist/author', { recursive: true });
  const navHtml = buildNavHtml(categoriesWithChildren);

  for (const author of allAuthors) {
    const authorPosts = allPosts.filter(p => p.author_id === author.id);
    const cardsHtml = buildArticleCardsHtml(authorPosts);
    const authorAvatar = author.avatar_url ||
      'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%238B4513%22/%3E%3Ctext x=%2240%22 y=%2252%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2236%22%3E%3F%3C/text%3E%3C/svg%3E';
    const pageTitle = `${author.full_name} — Author`;
    const pageDesc = author.bio ? author.bio.substring(0, 160) : `Read articles by ${author.full_name} on The Limelight Online.`;
    const authorUrl = `${SITE_URL}/author/${author.id}.html`;

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      'name': author.full_name,
      'url': authorUrl,
      'image': author.avatar_url || '',
      'description': author.bio || ''
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle} | The Limelight</title>
<meta name="description" content="${escapeQuotes(pageDesc)}">
<meta property="og:title" content="${escapeQuotes(pageTitle)}">
<meta property="og:description" content="${escapeQuotes(pageDesc)}">
<meta property="og:url" content="${authorUrl}">
<meta property="og:type" content="profile">
<meta property="og:image" content="${escapeQuotes(author.avatar_url || `${SITE_URL}/favicon/favicon-512x512.png`)}">
<link rel="canonical" href="${authorUrl}">
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
${allStyles}
${getDarkModeCSS()}
<style>
/* ── HEADER LAYOUT FIX ── */
.header { position: sticky; top: 0; z-index: 1000; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.header-content { display: flex; align-items: center; justify-content: space-between; height: 80px; }
.site-title img { height: 50px; width: auto; display: block; }
.nav-menu { display: flex; align-items: center; gap: 20px; margin: 0; padding: 0; list-style: none; }
.nav-item { position: relative; }
.nav-link { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 600; color: #333; text-decoration: none; text-transform: uppercase; padding: 10px 0; transition: color 0.3s; }
.nav-link:hover { color: #8B4513; }
.mobile-nav-toggle { display: none; background: none; border: none; font-size: 24px; color: #333; cursor: pointer; }
[data-theme="dark"] .header { background: #1a1a1a; }
[data-theme="dark"] .nav-link, [data-theme="dark"] .mobile-nav-toggle { color: #f5f5f5; }
[data-theme="dark"] .nav-link:hover { color: #C89A47; }

.author-page-header {
  background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
  color: white; padding: 50px 20px; text-align: center;
}
.author-page-avatar {
  width: 100px; height: 100px; border-radius: 50%; object-fit: cover;
  border: 4px solid rgba(255,255,255,0.5); margin: 0 auto 20px; display: block;
}
.author-page-name {
  font-family: 'Playfair Display', serif; font-size: 2rem;
  margin: 0 0 10px; color: white;
}
.author-page-bio {
  font-size: 1rem; color: rgba(255,255,255,0.85);
  max-width: 600px; margin: 0 auto; line-height: 1.6;
}
.author-articles-section {
  max-width: 1300px; margin: 0 auto; padding: 40px 20px 60px;
}
.author-articles-heading {
  font-family: 'Playfair Display', serif; font-size: 1.6rem;
  color: #8B4513; margin-bottom: 30px;
}
.articles-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 30px;
}
body { display: flex; flex-direction: column; min-height: 100vh; }
main { flex: 1; }
.author-bio-social { display: flex; gap: 12px; justify-content: center; margin-top: 14px; }
.author-bio-social a { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.15); color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; text-decoration: none; transition: background 0.2s, color 0.2s; }
.author-bio-social a:hover { background: white; color: #8B4513; }
</style>
${getDarkModeInitScript()}
</head>
<body>
<header class="header">
  <div class="container header-content">
    <a href="/index.html" class="site-title">
      <img src="https://i.ibb.co/NdsYM9dx/web-logo-123.png" alt="The Limelight">
    </a>
    <div class="mobile-controls" style="display: flex; gap: 15px; align-items: center;">
      <button class="mobile-nav-toggle" aria-label="Toggle navigation"><i class="fas fa-bars"></i></button>
    </div>
    <ul class="nav-menu" id="navMenu">
      ${navHtml}
      <li class="nav-item">${getDarkModeToggleBtn()}</li>
    </ul>
  </div>
</header>

<main>
  <div class="author-page-header">
    <img src="${authorAvatar}" alt="${escapeQuotes(author.full_name)}" class="author-page-avatar"
         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%238B4513%22/%3E%3Ctext x=%2240%22 y=%2252%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2236%22%3E%3F%3C/text%3E%3C/svg%3E'">
    <h1 class="author-page-name">${author.full_name}</h1>
    ${author.bio ? `<p class="author-page-bio">${author.bio}</p>` : ''}
    ${buildAuthorSocialLinksHtml(author)}
  </div>
  <div class="author-articles-section">
    <h2 class="author-articles-heading">Articles by ${author.full_name} (${authorPosts.length})</h2>
    ${authorPosts.length > 0
      ? `<div class="articles-grid">${cardsHtml}</div>`
      : '<p style="color:#888;text-align:center;padding:40px 0;">No articles published yet.</p>'
    }
  </div>
</main>

<footer class="site-footer">
  <div class="footer-inner">

    <!-- Column 1: Brand + About tagline -->
    <div class="footer-col footer-brand">
      <h3 class="footer-logo">THE LIMELIGHT</h3>
      <p class="footer-tagline">
        A bimonthly academic web magazine devoted to South Asian
        literature, Islamic thought, arts and culture — writing for
        a world that still believes ideas matter.
      </p>
      <a href="/contact.html" class="footer-about-link">
        About The Limelight &rarr;
      </a>
    </div>

    <!-- Column 2: Explore -->
    <div class="footer-col">
      <h4 class="footer-col-title">Explore</h4>
      <ul class="footer-links">
        <li><a href="/index.html">Home</a></li>
        <li><a href="/authors.html">Authors</a></li>
        <li><a href="/contact.html">Contact Us</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
    </div>

    <!-- Column 3: Categories -->
    <div class="footer-col">
      <h4 class="footer-col-title">Categories</h4>
      <ul class="footer-links" id="footerCategories">
        ${data.categoriesWithChildren
          .filter(c => !c.parent_id)
          .map(c => `<li><a href="/category/${c.slug}.html">${c.name}</a></li>`)
          .join('')}
      </ul>
    </div>

    <!-- Column 4: Follow us -->
    <div class="footer-col">
      <h4 class="footer-col-title">Follow Us</h4>
      <div class="footer-social">
        <a href="https://www.instagram.com/the_limelight_bimonthly/" target="_blank" rel="noopener" aria-label="Instagram">
          <i class="fab fa-instagram"></i>
        </a>
        <a href="https://www.facebook.com/profile.php?id=100091897094886#" target="_blank" rel="noopener" aria-label="Facebook">
          <i class="fab fa-facebook-f"></i>
        </a>
        <a href="https://www.youtube.com/@Thelimelightonline" target="_blank" rel="noopener" aria-label="YouTube">
          <i class="fab fa-youtube"></i>
        </a>
      </div>
    </div>

  </div><!-- /.footer-inner -->

  <div class="footer-bottom">
    <p>&copy; 2025 The Limelight Online. All rights reserved.</p>
    <p class="footer-bottom-links">
      <a href="/contact.html">Contact</a>
      &nbsp;&middot;&nbsp;
      <a href="/sitemap.xml">Sitemap</a>
    </p>
  </div>
</footer>
<script>
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (toggle && navMenu) {
    toggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }
});
</script>
${getDarkModeToggleScript()}
</body>
</html>`;

    const filePath = `dist/author/${author.id}.html`;
    fs.writeFileSync(filePath, html);
    console.log(`✓ Author: /author/${author.id}.html — ${authorPosts.length} articles`);
  }
  console.log(`✓ Generated ${allAuthors.length} author pages`);
}

// ─── Phase 3: Article Template Validation ─────────────────────────────────────

function validateArticleTemplate(template) {
  const checks = [
    ['__SEO_HEAD_TAGS__', 'Missing __SEO_HEAD_TAGS__ placeholder'],
    ['id="mainContent"', 'Missing id="mainContent" element'],
    ['id="tocList"',     'Missing id="tocList" element'],
  ];
  let valid = true;
  checks.forEach(([marker, msg]) => {
    if (!template.includes(marker)) { console.error('TEMPLATE ERROR: ' + msg); valid = false; }
  });
  if (!valid) process.exit(1);
  console.log('✓ Article template validation passed');
}

// ─── Phase 3: generateArticleHtml ─────────────────────────────────────────────

function generateArticleHtml(article, template, allPosts, categoriesWithChildren) {
  const authorName   = article.authors?.full_name   || 'The Limelight';
  const authorAvatar = article.authors?.avatar_url   || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2235%22 height=%2235%22 viewBox=%220 0 35 35%22%3E%3Crect width=%2235%22 height=%2235%22 fill=%22%238B4513%22/%3E%3Ctext x=%2217%22 y=%2223%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22%3E%3F%3C/text%3E%3C/svg%3E';
  const categoryName = article.categories?.name      || 'General';
  const safeSlug     = article.slug.replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
  const articleUrl   = `${SITE_URL}/article/${article.slug}/`;
  const formattedDate = new Date(article.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  let output = template;

  const articleKeywords = `${categoryName}, ${authorName}, South Asian literature, essays, culture, The Limelight Online`;

  let seoHeadTags = getSEOHeadTags({
    title: `${article.title} | The Limelight`,
    description: article.excerpt || '',
    keywords: articleKeywords,
    author: authorName,
    url: articleUrl,
    type: 'article',
    image: article.image_url || ''
  });

  if (article.status !== 'published') {
    seoHeadTags = seoHeadTags.replace(
      '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">',
      '<meta name="robots" content="noindex, nofollow">'
    );
  }

  // Inject our dynamic SEO tags
  output = output.replace('__SEO_HEAD_TAGS__', seoHeadTags);

  // Bake article content — replace the loading spinner div
  // Exact markup from article.html line 242-244:
  //   <div style="padding: 100px 0; text-align: center;">
  //     <i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--accent-color)"></i>
  //   </div>
  const readingTime = calcReadingTime(article.content || '');
  const authorId = article.author_id || '';
  const authorLink = authorId ? `/author/${authorId}.html` : '#';
  const relatedHtml = buildRelatedArticlesHtml(article, allPosts || []);
  const authorBioHtml = buildAuthorBioCardHtml(article);

  // Strip literal <p><br></p> sequences from article.content to avoid double spacing
  const cleanContent = (article.content || '').replace(/<p><br><\/p>/gi, '');

  const schemaHtml = `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "${escapeJs(article.title)}",
      "image": [
        "${escapeJs(article.image_url || `${SITE_URL}/favicon/favicon-512x512.png`)}"
       ],
      "datePublished": "${new Date(article.created_at).toISOString()}",
      "dateModified": "${article.updated_at ? new Date(article.updated_at).toISOString() : new Date(article.created_at).toISOString()}",
      "author": [{
          "@type": "Person",
          "name": "${escapeJs(authorName)}",
          "url": "${SITE_URL}${authorLink}"
      }],
      "publisher": {
          "@type": "Organization",
          "name": "The Limelight Online",
          "logo": {
            "@type": "ImageObject",
            "url": "${SITE_URL}/favicon/favicon-192x192.png"
          }
      },
      "articleBody": "${escapeJs((article.content || '').replace(/<[^>]*>?/gm, ' ').substring(0, 500))}"
    }
    </script>
    <script type="application/ld+json">
    ${getBreadcrumbSchema([
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": categoryName, "item": `${SITE_URL}/category/${article.categories?.slug || 'general'}.html` },
      { "@type": "ListItem", "position": 3, "name": escapeJs(article.title), "item": articleUrl }
    ])}
    </script>
  `;

  const bakedContent = `
    <header class="article-header">
      <span class="category-label">${categoryName}</span>
      <h1 class="article-title">${article.title}</h1>
      <div class="article-meta">
        <div class="author-info">
          <img src="${authorAvatar}" alt="${escapeQuotes(authorName)}">
          <span>By <a href="${authorLink}" style="color:inherit;font-weight:600;">${authorName}</a></span>
        </div>
        <span>&bull;</span>
        <span class="reading-time"><i class="fas fa-clock" style="margin-right:4px;"></i>${readingTime} min read</span>
        <span>&bull;</span>
        <span>${formattedDate}</span>
      </div>
    </header>
    <div class="featured-image-container">
      <img src="${article.image_url || ''}" alt="${escapeQuotes(article.title)}" class="featured-image">
    </div>
    <div class="article-body" id="articleBody">
      ${cleanContent}
    </div>
    ${relatedHtml}
    ${authorBioHtml}`;

  output = output.replace(
    /<div style="padding: 100px 0; text-align: center;">[\s\S]*?<\/div>/,
    bakedContent
  );

  // Inject Schema right before closing head
  output = output.replace('</head>', schemaHtml + '\n</head>');

  // Remove Supabase CDN script tag
  output = output.replace(
    /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"]*"[^>]*><\/script>/g,
    ''
  );

  // Remove the entire Supabase runtime script block
  output = output.replace(
    /<script>[^<]*?const SUPABASE_URL[\s\S]*?<\/script>/,
    ''
  );

  // Share URLs use real IDs from article.html: shareFb, shareTw, shareWa, mShareFb, mShareTw, mShareWa, mShareCp
  const staticScript = `<script>
    document.addEventListener('DOMContentLoaded', () => {
      setupTOC();
      setupShare();
      setupThemeToggle();
    });

    function setupTOC() {
      const body = document.getElementById('articleBody');
      const list = document.getElementById('tocList');
      if (!body || !list) return;
      const headers = body.querySelectorAll('h2');
      if (headers.length === 0) { list.innerHTML = '<li>No sections</li>'; return; }
      headers.forEach((h, i) => {
        h.id = 'section-' + i;
        const li = document.createElement('li');
        li.innerHTML = '<a href="#section-' + i + '">' + h.innerText + '</a>';
        list.appendChild(li);
      });
      window.addEventListener('scroll', () => {
        let current = '';
        headers.forEach(h => { if (scrollY >= h.offsetTop - 150) current = h.id; });
        list.querySelectorAll('a').forEach(a => {
          a.classList.remove('active');
          if (current && a.getAttribute('href').includes(current)) a.classList.add('active');
        });
      });
    }

    function setupShare() {
      const url   = encodeURIComponent(window.location.href);
      const title = encodeURIComponent(\`\${escapeJs(article.title)}\`);
      const fb = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
      const tw = 'https://twitter.com/intent/tweet?text=' + title + '&url=' + url;
      const wa = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;

      const s = (id, href) => { const el = document.getElementById(id); if (el) el.href = href; };
      s('shareFb', fb); s('shareTw', tw); s('shareWa', wa);
      s('mShareFb', fb); s('mShareTw', tw); s('mShareWa', wa);

      const cp = document.getElementById('mShareCp');
      if (cp) cp.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(decodeURIComponent(url)).then(() => {
          cp.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => { cp.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
        });
      });
    }

    function setupThemeToggle() {
      const btn = document.getElementById('themeToggle');
      if (btn) {
        let isAnimating = false;
        btn.addEventListener('click', (e) => {
          if (isAnimating) return;
          isAnimating = true;
          
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          const nextTheme = isDark ? 'light' : 'dark';
          
          const rect = btn.getBoundingClientRect();
          const x = e.clientX || (rect.left + rect.width / 2);
          const y = e.clientY || (rect.top + rect.height / 2);
          
          const overlay = document.createElement('div');
          overlay.className = 'theme-clip-overlay animating';
          overlay.style.backgroundColor = nextTheme === 'dark' ? '#121212' : '#ffffff';
          overlay.style.setProperty('--x', x + 'px');
          overlay.style.setProperty('--y', y + 'px');
          
          // Ensure styles for overlay exist (in case not loaded via CSS file)
          if (!document.getElementById('clipOverlayStyles')) {
            const style = document.createElement('style');
            style.id = 'clipOverlayStyles';
            style.textContent = \`
              .theme-clip-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 9999;
                pointer-events: none;
                clip-path: circle(0px at var(--x) var(--y));
              }
              .theme-clip-overlay.animating {
                animation: clip-expand 0.6s ease-in forwards;
              }
              @keyframes clip-expand {
                0% { clip-path: circle(0px at var(--x) var(--y)); }
                100% { clip-path: circle(150vmax at var(--x) var(--y)); }
              }
            \`;
            document.head.appendChild(style);
          }
          
          document.body.appendChild(overlay);
          
          setTimeout(() => {
            if (nextTheme === 'dark') {
              document.documentElement.setAttribute('data-theme', 'dark');
              localStorage.setItem('limelight-theme', 'dark');
            } else {
              document.documentElement.removeAttribute('data-theme');
              localStorage.setItem('limelight-theme', 'light');
            }
            overlay.remove();
            isAnimating = false;
          }, 580);
        });
      }
    }
  <\/script>`;

  output = output.replace('</body>', staticScript + '\n</body>');

  const footerCatsHtml = (categoriesWithChildren || [])
    .filter(c => !c.parent_id) // top-level only
    .map(c => `<li><a href="/category/${c.slug}.html">${c.name}</a></li>`)
    .join('');
  output = output.replace('__FOOTER_CATEGORIES__', footerCatsHtml);

  return { html: output, safeSlug };
}

// ─── Phase 4: generateSearchJson ──────────────────────────────────────────────

function generateSearchJson(allPosts) {
  const searchIndex = allPosts.map(p => ({
    title:     p.title,
    slug:      p.slug,
    excerpt:   p.excerpt || '',
    image_url: p.image_url || '',
    category:  p.categories?.name || 'General',
    author:    p.authors?.full_name || 'The Limelight',
    date:      p.created_at
  }));
  fs.writeFileSync('dist/search.json', JSON.stringify(searchIndex));
  console.log(`✓ Generated dist/search.json (${searchIndex.length} entries)`);
}

// ─── Phase 4: generateSitemap ─────────────────────────────────────────────────

function generateSitemap(allPosts) {
  const fmt = (d) => new Date(d).toISOString().split('T')[0];
  const articleUrls = allPosts.map(p => `
  <url>
    <loc>${SITE_URL}/article/${p.slug}/</loc>
    <lastmod>${fmt(p.created_at)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${fmt(new Date())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/authors.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${SITE_URL}/contact.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>${articleUrls}
</urlset>`;

  fs.writeFileSync('dist/sitemap.xml', sitemap);
  console.log('✓ Generated dist/sitemap.xml');
}

// ─── Phase 4: generateCloudflareFiles ─────────────────────────────────────────

function generateCloudflareFiles() {
  const redirects = [
    '/article/:slug    /article/:slug/index.html   200',
    '/article/:slug/   /article/:slug/index.html   200',
    '/category/:slug   /category/:slug.html        200'
  ].join('\n');
  fs.writeFileSync('dist/_redirects', redirects);
  console.log('✓ Generated dist/_redirects');

  const headers = `/search.json
  Cache-Control: public, max-age=300
/sitemap.xml
  Cache-Control: public, max-age=86400
/article/*
  Cache-Control: public, max-age=86400
/index.html
  Cache-Control: public, max-age=300
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin`;
  fs.writeFileSync('dist/_headers', headers);
  console.log('✓ Generated dist/_headers');

  const routes = JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2);
  fs.writeFileSync('dist/_routes.json', routes);
  console.log('✓ Generated dist/_routes.json');
}



// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Starting Limelight static build...\n');
  const startTime = Date.now();

  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
    console.log('✓ Cleaned previous dist/');
  }
  fs.mkdirSync('dist/article', { recursive: true });

  const data = await fetchAllData();

  // Debug: verify CSS extraction
  const testIndex = fs.readFileSync('index.html', 'utf-8');
  const testStyles = testIndex.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  console.log(`CSS blocks found in index.html: ${testStyles.length}`);
  console.log(`Total CSS size: ${testStyles.join('').length} characters`);
  if (testStyles.join('').length < 500) {
    console.error('ERROR: Very little CSS found — check index.html has <style> blocks');
    process.exit(1);
  }

  // Phase 2 — Homepage
  generateIndexHtml(data);
  await generateCategoryPages(data);
  await generateAuthorPages(data);

  // Phase 3 — Article pages
  const articleTemplate = fs.readFileSync('article.html', 'utf-8');
  validateArticleTemplate(articleTemplate);

  let articleCount = 0;
  for (const article of data.rawAllPosts) {
    try {

      const { html, safeSlug } = generateArticleHtml(article, articleTemplate, data.allPosts, data.categoriesWithChildren);
      const dir = path.join('dist', 'article', safeSlug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      articleCount++;
    } catch (err) {
      console.error(`✗ FAILED: ${article.slug} — ${err.message}`);
    }
  }
  console.log(` Generated ${articleCount} article pages`);

  // Phase 4 — Search, sitemap, Cloudflare config
  generateSearchJson(data.allPosts);
  generateSitemap(data.allPosts);
  generateCloudflareFiles();

  // Copy static pages unchanged
  ['authors.html', 'contact.html', 'login.html', 'admin.html'].forEach(f => {
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join('dist', f)); }
  });
  console.log('✓ Copied static pages');
  
  // Copy Favicon files
  const faviconSrcDir = path.join(__dirname, 'favicon');
  const faviconDistDir = path.join('dist', 'favicon');
  if (fs.existsSync(faviconSrcDir)) {
      fs.mkdirSync(faviconDistDir, { recursive: true });
      const faviconFiles = fs.readdirSync(faviconSrcDir);
      faviconFiles.forEach(f => {
          fs.copyFileSync(path.join(faviconSrcDir, f), path.join(faviconDistDir, f));
      });
      console.log('✓ Copied favicon files');
  }
  
  await runPostBuildSanityCheck();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`
=== BUILD SUMMARY ===
Homepage:     dist/index.html
Articles:     ${articleCount} pages
Search index: dist/search.json
Sitemap:      dist/sitemap.xml
Build time:   ${elapsed}s
=====================
`);
}

async function runPostBuildSanityCheck() {
  console.log('\n--- Running Post-Build Broken Link Sanity Check ---');
  let brokenLinksFound = 0;
  
  function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const brokenRegex = /href=["'](?:#|undefined|null|)["']/g;
        let match;
        while ((match = brokenRegex.exec(content)) !== null) {
          console.warn(`[WARNING] Broken link found in ${fullPath}: href="${match[1]}"`);
          brokenLinksFound++;
        }
      }
    }
  }
  
  if (fs.existsSync('dist')) {
    walk('dist');
  }
  
  if (brokenLinksFound === 0) {
    console.log('✓ No broken placeholder links (href="#", href="", etc.) found!');
  } else {
    console.warn(`! Found ${brokenLinksFound} broken link(s) across generated HTML files.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
