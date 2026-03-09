/* PDRL - Shared Application JavaScript */

// ============ AUTH ============
const Auth = {
  TOKEN_KEY: 'pdrl_token',
  EXPIRES_KEY: 'pdrl_token_expires',

  getToken() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const expires = localStorage.getItem(this.EXPIRES_KEY);
    if (token && expires && Date.now() / 1000 < parseInt(expires)) {
      return token;
    }
    if (token && expires && Date.now() / 1000 >= parseInt(expires)) {
      this.clearToken();
    }
    return null;
  },

  setToken(token, expiresAt) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.EXPIRES_KEY, expiresAt);
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.EXPIRES_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  login() {
    window.location.href = '/api/v1/auth/login';
  },

  async logout() {
    try {
      const res = await fetch('/api/v1/auth/logout');
      const data = await res.json();
      this.clearToken();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        window.location.href = '/';
      }
    } catch (e) {
      this.clearToken();
      window.location.href = '/';
    }
  },

  async getUser() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await API.get('/api/v1/auth/me');
      return res;
    } catch (e) {
      return null;
    }
  },

  // Handle the auth callback - reads token from URL params
  handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const expiresAt = params.get('expires_at');
    if (token && expiresAt) {
      this.setToken(token, expiresAt);
      window.location.href = '/';
      return true;
    }
    return false;
  }
};

// ============ API HELPER ============
const API = {
  async request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = Auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  get(url, params) {
    let fullUrl = url;
    if (params) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') qs.set(k, String(v));
      });
      const qsStr = qs.toString();
      if (qsStr) fullUrl += '?' + qsStr;
    }
    return this.request(fullUrl);
  },

  post(url, body) {
    return this.request(url, { method: 'POST', body: JSON.stringify(body) });
  },

  put(url, body) {
    return this.request(url, { method: 'PUT', body: JSON.stringify(body) });
  },

  delete(url, body) {
    const opts = { method: 'DELETE' };
    if (body) opts.body = JSON.stringify(body);
    return this.request(url, opts);
  }
};

// ============ PUBLIC API (no auth) ============
const PublicAPI = {
  async fetchEvents(params = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', params.limit);
    if (params.sort) qs.set('sort', params.sort);
    if (params.status) qs.set('status', params.status);
    const res = await fetch('/api/v1/public/events?' + qs.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  },

  async fetchFlyerUrl(objectKey, bucketName = 'event-flyers') {
    if (!objectKey) return null;
    const cleanKey = objectKey.includes('/') ? objectKey.split('/').pop() : objectKey;
    try {
      const qs = new URLSearchParams({ object_key: cleanKey, bucket_name: bucketName });
      const res = await fetch('/api/v1/public/flyer-url?' + qs.toString());
      if (!res.ok) return null;
      const data = await res.json();
      return data.download_url || null;
    } catch (e) {
      return null;
    }
  },

  async fetchRaceTimes(params = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', params.limit);
    if (params.skip) qs.set('skip', params.skip);
    if (params.query) qs.set('query', JSON.stringify(params.query));
    if (params.sort) qs.set('sort', params.sort);
    const res = await fetch('/api/v1/entities/race_times/all?' + qs.toString());
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  },

  async fetchRegistrations(params = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', params.limit);
    if (params.skip) qs.set('skip', params.skip);
    const res = await fetch('/api/v1/registrations/public?' + qs.toString());
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  },

  async fetchDriverProfile(driverName) {
    const qs = new URLSearchParams({ driver_name: driverName });
    const res = await fetch('/api/v1/driver/profile?' + qs.toString());
    if (!res.ok) throw new Error('Driver not found');
    return res.json();
  },

  async searchDrivers(q = '') {
    const qs = new URLSearchParams({ q });
    const res = await fetch('/api/v1/driver/search?' + qs.toString());
    if (!res.ok) return { items: [] };
    return res.json();
  }
};

// ============ UI HELPERS ============
const UI = {
  $(sel) { return document.querySelector(sel); },
  $$(sel) { return document.querySelectorAll(sel); },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDate(dateStr) {
    if (!dateStr) return 'TBA';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  },

  showAlert(container, message, type = 'info') {
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    container.prepend(el);
    setTimeout(() => el.remove(), 5000);
  },

  showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p class="mt-4">Loading...</p></div>';
  },

  getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  // Determine which nav link is active
  currentPage() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return path;
  }
};

// ============ RENDER HEADER ============
function renderHeader(containerId = 'site-header') {
  const el = document.getElementById(containerId);
  if (!el) return;

  const currentPath = UI.currentPage();
  const navLinks = [
    { href: '/classes.html', label: 'Classes' },
    { href: '/rules.html', label: 'Rules' },
    { href: '/events.html', label: 'Events' },
    { href: '/leaderboard.html', label: 'Leaderboard' },
    { href: '/register.html', label: 'Register' },
    { href: '/about.html', label: 'About' },
    { href: '/contact.html', label: 'Contact' },
  ];

  const navHtml = navLinks.map(l => {
    const isActive = currentPath === l.href || currentPath === l.href.replace('.html', '');
    return `<a href="${l.href}" class="${isActive ? 'active' : ''}">${l.label}</a>`;
  }).join('');

  const loggedIn = Auth.isLoggedIn();
  const authHtml = loggedIn
    ? `<div class="header-auth">
         <a href="/admin.html" class="btn btn-ghost btn-sm">Admin</a>
         <button class="btn btn-ghost btn-sm" onclick="Auth.logout()">Logout</button>
       </div>`
    : `<div class="header-auth">
         <button class="btn btn-primary btn-sm" onclick="Auth.login()">Login</button>
       </div>`;

  el.innerHTML = `
    <div class="container">
      <div class="header-inner">
        <a href="/" class="header-logo">
          <img src="/logo.png" alt="PDRL" onerror="this.style.display='none'">
          <div>
            <div class="header-logo-text">PDRL</div>
            <div class="header-logo-sub">Pro Drag Racing League</div>
          </div>
        </a>
        <button class="nav-toggle" onclick="toggleNav()" aria-label="Toggle menu">☰</button>
        <nav class="header-nav" id="main-nav">
          ${navHtml}
          ${authHtml}
        </nav>
      </div>
    </div>`;
}

function toggleNav() {
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.toggle('open');
}

// ============ RENDER FOOTER ============
function renderFooter(containerId = 'site-footer') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const year = new Date().getFullYear();
  el.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem">
            <img src="/logo.png" alt="PDRL" style="height:40px" onerror="this.style.display='none'">
            <div>
              <div style="font-weight:700">Pro Drag Racing League</div>
              <div class="text-xs text-secondary">Official PDRL Website</div>
            </div>
          </div>
          <p class="text-sm text-secondary">Promote fair, competitive, and professional drag racing.</p>
        </div>
        <div class="footer-col">
          <h4>League</h4>
          <a href="/about.html">About</a>
          <a href="/classes.html">Classes</a>
          <a href="/rules.html">Rules</a>
        </div>
        <div class="footer-col">
          <h4>Events</h4>
          <a href="/events.html">Upcoming</a>
          <a href="/leaderboard.html">Leaderboard</a>
          <a href="/register.html">Register</a>
        </div>
        <div class="footer-col">
          <h4>Connect</h4>
          <a href="/contact.html">Contact</a>
          <a href="/admin.html">Admin</a>
          <a href="#" onclick="window.scrollTo({top:0,behavior:'smooth'});return false;">Back to top</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${year} PDRL. All rights reserved.</span>
        <span>Made for fast loading &amp; easy updates.</span>
      </div>
    </div>`;
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
});