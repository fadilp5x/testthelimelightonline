require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://thelimelightonline.in';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── String Helpers ────────────────────────────────────────────────────────────

const escapeQuotes = (str) => str ? str.replace(/"/g, '&quot;') : '';
const escapeJs = (str) => str
  ? str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
  : '';
// Must match the safeSlug used when writing files to dist/article/
const normalizeSlug = (slug) => slug.replace(/[^a-z0-9\-]/gi, '-').toLowerCase();

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

  const { data: featuredPosts, error: e2 } = await supabase
    .from('posts')
    .select('*, authors(full_name, avatar_url), categories(name, slug)')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(5);
  if (e2) throw new Error('Featured posts fetch failed: ' + e2.message);

  const { data: latestPosts, error: e3 } = await supabase
    .from('posts')
    .select('*, authors(full_name, avatar_url), categories(name, slug)')
    .order('created_at', { ascending: false })
    .range(0, 8);
  if (e3) throw new Error('Latest posts fetch failed: ' + e3.message);

  const { data: allPosts, error: e4 } = await supabase
    .from('posts')
    .select('*, authors(full_name, avatar_url), categories(name, slug)')
    .order('created_at', { ascending: false });
  if (e4) throw new Error('All posts fetch failed: ' + e4.message);

  console.log(
    `Fetched: ${categoriesWithChildren.length} categories, ` +
    `${featuredPosts.length} featured, ${latestPosts.length} latest, ` +
    `${allPosts.length} total articles`
  );

  return { categoriesWithChildren, featuredPosts, latestPosts, allPosts };
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
  const slides = featuredPosts.map((p, i) => `
    <div class="carousel-slide ${i === 0 ? 'active' : ''}">
      <img src="${p.image_url}" class="carousel-image" alt="${escapeQuotes(p.title)}">
      <div class="carousel-overlay">
        <div class="carousel-meta">
          <span>${p.categories?.name || 'General'}</span>
          <span>&bull;</span>
          <span>${new Date(p.created_at).toLocaleDateString()}</span>
        </div>
        <h2 class="carousel-title"><a href="/article/${normalizeSlug(p.slug)}" style="color:white">${p.title}</a></h2>
        <div class="carousel-excerpt">${p.excerpt || ''}</div>
      </div>
    </div>`).join('\n');

  const indicators = featuredPosts.map((_, i) =>
    `<div class="indicator ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
  ).join('\n');

  return { slides, indicators };
}

function generateArticleCardsHtml(latestPosts) {
  return latestPosts.map(p => {
    const href = '/article/' + normalizeSlug(p.slug);
    return `
    <div class="article-card">
      <a href="${href}" class="card-image-wrapper">
        <span class="card-badge">${p.categories?.name || 'General'}</span>
        <img src="${p.image_url}" class="card-image" loading="lazy" alt="${escapeQuotes(p.title)}">
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

function buildCarouselHtml(featuredPosts) {
  if (!featuredPosts || featuredPosts.length === 0) return { slidesHtml: '', indicatorsHtml: '' };
  const slidesHtml = featuredPosts.map((p, i) => {
    const authorName = p.authors?.full_name || 'The Limelight';
    const categoryName = p.categories?.name || 'General';
    const date = new Date(p.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});
    return `<div class="carousel-slide ${i === 0 ? 'active' : ''}">
      <img src="${p.image_url}" class="carousel-image" alt="${p.title}" loading="${i === 0 ? 'eager' : 'lazy'}">
      <div class="carousel-overlay">
        <div class="carousel-meta">
          <span class="carousel-category">${categoryName}</span>
          <span>&bull;</span>
          <span>${date}</span>
        </div>
        <h2 class="carousel-title">
          <a href="/article/${p.slug}/" style="color:white;text-decoration:none;">${p.title}</a>
        </h2>
        <div class="carousel-excerpt">${p.excerpt || ''}</div>
      </div>
    </div>`;
  }).join('\n');
  const indicatorsHtml = featuredPosts.map((_, i) =>
    `<div class="indicator ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
  ).join('\n');
  return { slidesHtml, indicatorsHtml };
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
        <img src="${p.image_url}" class="card-image" loading="lazy" alt="${p.title}">
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
let currentSlide = 0;
let slideInterval;

function changeSlide(dir) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.indicator');
  if (!slides.length) return;
  slides[currentSlide].classList.remove('active');
  dots[currentSlide] && dots[currentSlide].classList.remove('active');
  currentSlide = (currentSlide + dir + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  dots[currentSlide] && dots[currentSlide].classList.add('active');
  resetTimer();
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.indicator');
  if (!slides.length) return;
  slides[currentSlide].classList.remove('active');
  dots[currentSlide] && dots[currentSlide].classList.remove('active');
  currentSlide = index;
  slides[currentSlide].classList.add('active');
  dots[currentSlide] && dots[currentSlide].classList.add('active');
  resetTimer();
}

function startSlideTimer() { slideInterval = setInterval(() => changeSlide(1), 5000); }
function resetTimer() { clearInterval(slideInterval); startSlideTimer(); }

document.addEventListener('DOMContentLoaded', () => {
  startSlideTimer();

  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  if (prevBtn) prevBtn.addEventListener('click', () => changeSlide(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => changeSlide(1));

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
  const { slidesHtml, indicatorsHtml } = buildCarouselHtml(featuredPosts);
  const cardsHtml = buildArticleCardsHtml(latestPosts);
  const footerCatsHtml = categoriesWithChildren.map(p =>
    `<li><a href="/category/${p.slug}.html">${p.name}</a></li>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Limelight | Home</title>
<meta name="description" content="The Limelight Online - Literature, Essays, Arts and Culture">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:title" content="The Limelight Online">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
${allStyles}

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
  font-family: 'Roboto', sans-serif;
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
  font-family: 'Roboto', sans-serif;
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
</style>

</head>
<body>
<header class="site-header">
  <div class="header-inner">
    <a href="/index.html" class="logo-link">
      <img src="https://i.ibb.co/NdsYM9dx/web-logo-123.png" alt="The Limelight" class="logo-img">
    </a>
    <button class="mobile-nav-toggle" aria-label="Toggle navigation">
      <i class="fas fa-bars"></i>
    </button>
    <nav class="main-nav">
      <ul class="nav-list" id="navMenu">
        ${navItemsHtml}
        <li class="nav-item">
          <div class="search-container" id="searchContainer">
            <i class="fas fa-search search-icon" id="searchIcon"></i>
            <input type="text" class="search-input" id="searchInput" placeholder="Search articles...">
            <div class="search-results" id="searchResults"></div>
          </div>
        </li>
      </ul>
    </nav>
  </div>
</header>
<section class="featured-section" id="featuredCarousel">
  <div class="carousel-container" id="carouselContainer">
    ${slidesHtml}
  </div>
  <button class="carousel-btn carousel-prev"><i class="fas fa-chevron-left"></i></button>
  <button class="carousel-btn carousel-next"><i class="fas fa-chevron-right"></i></button>
  <div class="carousel-indicators" id="carouselIndicators">${indicatorsHtml}</div>
</section>
<main class="main-content">
  <h2 style="text-align:center;font-family:'Playfair Display',serif;color:#8B4513;margin:40px 0 30px;font-size:2rem;">Latest Articles</h2>
  <div class="articles-grid" id="articlesGrid">${cardsHtml}</div>
</main>
<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-col">
      <img src="https://i.ibb.co/NdsYM9dx/web-logo-123.png" alt="The Limelight" style="height:50px;margin-bottom:15px;">
      <p style="color:#ccc;font-size:0.9rem;">Literature, essays, arts and culture.</p>
    </div>
    <div class="footer-col">
      <h4 class="footer-heading">Categories</h4>
      <ul class="footer-links" id="footerCategories">${footerCatsHtml}</ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-heading">Quick Links</h4>
      <ul class="footer-links">
        <li><a href="/index.html">Home</a></li>
        <li><a href="/authors.html">Authors</a></li>
        <li><a href="/contact.html">Contact</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; ${new Date().getFullYear()} The Limelight Online. All rights reserved.</p>
  </div>
</footer>
__SCRIPTS_PLACEHOLDER__
</body>
</html>`;

  fs.writeFileSync('dist/index.html', html.replace('__SCRIPTS_PLACEHOLDER__', buildIndexScripts()));
  console.log('✓ Generated dist/index.html');
}

// ─── Phase 2: generateCategoryPages ───────────────────────────────────────────

async function generateCategoryPages(data) {
  const { categoriesWithChildren, allPosts } = data;
  // Read styles ONCE outside the loop for performance
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

  const allCategories = [];
  categoriesWithChildren.forEach(parent => {
    allCategories.push(parent);
    if (parent.children) parent.children.forEach(child => allCategories.push(child));
  });

  fs.mkdirSync('dist/category', { recursive: true });

  for (const category of allCategories) {
    const categoryPosts = allPosts.filter(p =>
      p.categories?.slug === category.slug || p.categories?.name === category.name
    );
    const navHtml = buildNavHtml(categoriesWithChildren);
    const cardsHtml = buildArticleCardsHtml(categoryPosts);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${category.name} | The Limelight</title>
<meta name="description" content="Articles about ${category.name} - The Limelight Online">
<link rel="canonical" href="${SITE_URL}/category/${category.slug}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
${allStyles}
</head>
<body>
<header class="site-header">
  <div class="header-inner">
    <a href="/index.html" class="logo-link">
      <img src="https://i.ibb.co/NdsYM9dx/web-logo-123.png" alt="The Limelight" class="logo-img">
    </a>
    <button class="mobile-nav-toggle"><i class="fas fa-bars"></i></button>
    <nav class="main-nav">
      <ul class="nav-list">${navHtml}</ul>
    </nav>
  </div>
</header>
<main class="main-content" style="padding:40px 20px;max-width:1200px;margin:0 auto;">
  <h1 style="font-family:'Playfair Display',serif;color:#8B4513;font-size:2rem;">${category.name}</h1>
  <p style="color:#666;margin-top:8px;">${categoryPosts.length} article${categoryPosts.length !== 1 ? 's' : ''}</p>
  <hr style="border:1px solid #e0e0e0;margin:15px 0 30px;">
  ${categoryPosts.length > 0
    ? `<div class="articles-grid">${cardsHtml}</div>`
    : `<div style="text-align:center;padding:60px 20px;color:#888;">
        <i class="fas fa-newspaper" style="font-size:3rem;display:block;margin-bottom:20px;"></i>
        <p>No articles in this category yet.</p>
        <a href="/index.html" style="color:#8B4513;">Back to Home</a>
      </div>`}
</main>
<footer class="site-footer">
  <div class="footer-bottom">
    <p>&copy; ${new Date().getFullYear()} The Limelight Online. All rights reserved.</p>
  </div>
</footer>
<script>
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const navList = document.querySelector('.nav-list');
  if (toggle && navList) {
    toggle.addEventListener('click', () => {
      navList.classList.toggle('active');
      const icon = toggle.querySelector('i');
      if (icon) { icon.classList.toggle('fa-bars'); icon.classList.toggle('fa-times'); }
    });
  }
  document.querySelectorAll('.has-dropdown').forEach(item => {
    const link = item.querySelector('.nav-link');
    if (!link) return;
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 992) {
        e.preventDefault();
        item.classList.toggle('mobile-open');
      }
    });
  });
});
</script>
</body>
</html>`;

    fs.writeFileSync(path.join('dist', 'category', `${category.slug}.html`), html);
    console.log(`✓ Category: /category/${category.slug}.html`);
  }
}

// ─── Phase 3: Article Template Validation ─────────────────────────────────────

function validateArticleTemplate(template) {
  const checks = [
    ['__SEO_TITLE__',    'Missing __SEO_TITLE__ placeholder'],
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

function generateArticleHtml(article, template) {
  const authorName   = article.authors?.full_name   || 'The Limelight';
  const authorAvatar = article.authors?.avatar_url   || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2235%22 height=%2235%22 viewBox=%220 0 35 35%22%3E%3Crect width=%2235%22 height=%2235%22 fill=%22%238B4513%22/%3E%3Ctext x=%2217%22 y=%2223%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22%3E%3F%3C/text%3E%3C/svg%3E';
  const categoryName = article.categories?.name      || 'General';
  const safeSlug     = article.slug.replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
  const articleUrl   = `${SITE_URL}/article/${article.slug}/`;
  const formattedDate = new Date(article.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  let output = template;

  // SEO placeholder replacements (all occurrences)
  output = output.replace(/__SEO_TITLE__/g,  escapeQuotes(article.title));
  output = output.replace(/__SEO_DESC__/g,   escapeQuotes(article.excerpt || ''));
  output = output.replace(/__SEO_AUTHOR__/g, escapeQuotes(authorName));
  output = output.replace(/__SEO_URL__/g,    escapeQuotes(articleUrl));
  output = output.replace(/__SEO_IMAGE__/g,  escapeQuotes(article.image_url || ''));

  // Title tag (already covered by __SEO_TITLE__ above, but ensure tab title is clean)
  output = output.replace(
    /<title>[^<]*<\/title>/,
    `<title>${article.title} | The Limelight</title>`
  );

  // Bake article content — replace the loading spinner div
  // Exact markup from article.html line 242-244:
  //   <div style="padding: 100px 0; text-align: center;">
  //     <i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--accent-color)"></i>
  //   </div>
  const bakedContent = `
    <header class="article-header">
      <span class="category-label">${categoryName}</span>
      <h1 class="article-title">${article.title}</h1>
      <div class="article-meta">
        <div class="author-info">
          <img src="${authorAvatar}" alt="${escapeQuotes(authorName)}">
          <span>By <strong>${authorName}</strong></span>
        </div>
        <span>&bull;</span>
        <span>${formattedDate}</span>
      </div>
    </header>
    <div class="featured-image-container">
      <img src="${article.image_url || ''}" alt="${escapeQuotes(article.title)}" class="featured-image">
    </div>
    <div class="article-body" id="articleBody">
      ${article.content || ''}
    </div>`;

  output = output.replace(
    /<div style="padding: 100px 0; text-align: center;">[\s\S]*?<\/div>/,
    bakedContent
  );

  // Remove Supabase CDN script tag
  output = output.replace(
    /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"]*"[^>]*><\/script>/g,
    ''
  );

  // Remove the entire Supabase runtime script block
  output = output.replace(
    /<script>[\s\S]*?const SUPABASE_URL[\s\S]*?<\/script>/,
    ''
  );

  // Share URLs use real IDs from article.html: shareFb, shareTw, shareWa, mShareFb, mShareTw, mShareWa, mShareCp
  const staticScript = `<script>
    document.addEventListener('DOMContentLoaded', () => {
      setupTOC();
      setupShare();
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
      const title = encodeURIComponent(\`${escapeJs(article.title)}\`);
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
  <\/script>`;

  output = output.replace('</body>', staticScript + '\n</body>');

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

  // Phase 3 — Article pages
  const articleTemplate = fs.readFileSync('article.html', 'utf-8');
  validateArticleTemplate(articleTemplate);

  let articleCount = 0;
  for (const article of data.allPosts) {
    try {
      const { html, safeSlug } = generateArticleHtml(article, articleTemplate);
      const dir = path.join('dist', 'article', safeSlug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      articleCount++;
    } catch (err) {
      console.error(`✗ FAILED: ${article.slug} — ${err.message}`);
    }
  }
  console.log(`✓ Generated ${articleCount} article pages`);


  // Phase 4 — Search, sitemap, Cloudflare config
  generateSearchJson(data.allPosts);
  generateSitemap(data.allPosts);
  generateCloudflareFiles();

  // Copy static pages unchanged
  ['authors.html', 'contact.html', 'login.html', 'admin.html'].forEach(f => {
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join('dist', f)); }
  });
  console.log('✓ Copied static pages');

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

main().catch(console.error);
