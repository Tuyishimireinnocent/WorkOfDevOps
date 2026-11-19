'use strict';

const crypto = require('crypto');

const MAX_ATTEMPTS = 5;
const LOCK_MS = 2 * 60 * 1000;
const SESSION_MS = 8 * 60 * 60 * 1000;
const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;

const USERS = [
  {
    email: 'student@rpkigali.ac.rw',
    password: 'DevOps@2026',
    name: 'DevOps Student',
    role: 'student',
  },
  {
    email: 'admin@rpkigali.ac.rw',
    password: 'Admin@2026',
    name: 'Lab Admin',
    role: 'admin',
  },
];

const sessions = new Map();
const attempts = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function publicUser(user) {
  return { email: user.email, name: user.name, role: user.role };
}

function getAttempt(email) {
  const row = attempts.get(email);
  if (!row) return { count: 0, lockedUntil: 0 };
  if (row.lockedUntil && Date.now() >= row.lockedUntil) {
    attempts.delete(email);
    return { count: 0, lockedUntil: 0 };
  }
  return row;
}

function recordFailure(email) {
  const row = getAttempt(email);
  const count = row.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0;
  attempts.set(email, { count, lockedUntil });
  return { count, lockedUntil };
}

function authenticate(email, password) {
  const normalized = normalizeEmail(email);
  const pass = String(password || '');

  if (!normalized || !pass) {
    return { ok: false, error: 'Email and password are required.' };
  }
  if (!isValidEmail(normalized)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (pass.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const row = getAttempt(normalized);
  if (row.lockedUntil && Date.now() < row.lockedUntil) {
    const seconds = Math.ceil((row.lockedUntil - Date.now()) / 1000);
    return {
      ok: false,
      error: `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in ${seconds}s.`,
    };
  }

  const user = USERS.find((item) => item.email === normalized);
  if (!user || !safeEqual(user.password, pass)) {
    const failed = recordFailure(normalized);
    if (failed.lockedUntil) {
      return {
        ok: false,
        error: `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in ${Math.ceil(LOCK_MS / 1000)}s.`,
      };
    }
    const left = MAX_ATTEMPTS - failed.count;
    return {
      ok: false,
      error: `Invalid email or password. ${left} attempt${left === 1 ? '' : 's'} remaining.`,
    };
  }

  attempts.delete(normalized);
  return { ok: true, user: publicUser(user) };
}

function createSession(user, remember) {
  const id = crypto.randomBytes(24).toString('hex');
  const maxAge = remember ? REMEMBER_MS : SESSION_MS;
  sessions.set(id, {
    user,
    expiresAt: Date.now() + maxAge,
    remember: Boolean(remember),
  });
  return { id, maxAge };
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function destroySession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

function parseCookies(header) {
  const cookies = {};
  String(header || '')
    .split(';')
    .forEach((part) => {
      const index = part.indexOf('=');
      if (index === -1) return;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) cookies[key] = decodeURIComponent(value);
    });
  return cookies;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 32 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const type = String(req.headers['content-type'] || '');
      if (type.includes('application/json')) {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
        return;
      }
      const body = {};
      new URLSearchParams(raw).forEach((value, key) => {
        body[key] = value;
      });
      resolve(body);
    });
    req.on('error', reject);
  });
}

function sessionCookie(id, maxAge) {
  return `sessionId=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge / 1000)}`;
}

function clearSessionCookie() {
  return 'sessionId=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLoginPage({ error = '', email = '' } = {}) {
  const errorBlock = error
    ? `<div class="alert" role="alert">${escapeHtml(error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in · RP-Kigali DevOps</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #1e3c72, #2a5298, #6a11cb);
      color: #fff;
      padding: 24px;
    }
    .card {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 20px;
      padding: 42px 40px 32px;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
      width: min(420px, 100%);
    }
    .brand {
      width: 56px;
      height: 56px;
      margin: 0 auto 16px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: #00c9a7;
      color: #043d33;
      font-weight: 800;
      font-size: 1.15rem;
    }
    h1 { font-size: 1.7rem; text-align: center; margin-bottom: 6px; }
    .subtitle {
      text-align: center;
      opacity: 0.85;
      margin-bottom: 26px;
      font-size: 0.95rem;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .field { margin-bottom: 16px; }
    .field input[type="email"],
    .field input[type="password"],
    .field input[type="text"] {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 1rem;
      outline: none;
    }
    .field input::placeholder { color: rgba(255, 255, 255, 0.55); }
    .field input:focus {
      border-color: #00c9a7;
      box-shadow: 0 0 0 3px rgba(0, 201, 167, 0.25);
    }
    .password-wrap { position: relative; }
    .password-wrap input { padding-right: 86px; }
    .toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      color: #00c9a7;
      font-weight: 700;
      cursor: pointer;
      padding: 6px 8px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 4px 0 18px;
      font-size: 0.9rem;
    }
    .remember {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .hint { min-height: 18px; font-size: 0.8rem; color: #ffd6d6; margin-top: 6px; }
    .caps { color: #ffe08a; font-size: 0.8rem; min-height: 16px; margin-top: 6px; }
    button[type="submit"] {
      width: 100%;
      border: 0;
      border-radius: 50px;
      padding: 12px 20px;
      background: #00c9a7;
      color: #043d33;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
    }
    button[type="submit"]:disabled { opacity: 0.7; cursor: wait; }
    .alert {
      background: rgba(255, 80, 80, 0.18);
      border: 1px solid rgba(255, 140, 140, 0.45);
      color: #ffe4e4;
      border-radius: 12px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 0.9rem;
    }
    .demo {
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.18);
      font-size: 0.82rem;
      opacity: 0.9;
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      margin-top: 16px;
      padding: 8px 16px;
      border-radius: 50px;
      background: #00c9a7;
      color: #043d33;
      font-weight: 600;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">RP</div>
    <h1>Welcome back</h1>
    <p class="subtitle">RP-Kigali College &middot; DevOps Y4 &middot; Practical Work #2</p>
    ${errorBlock}
    <form id="login-form" method="POST" action="/login" novalidate>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" value="${escapeHtml(email)}" placeholder="student@rpkigali.ac.rw" required>
        <div class="hint" id="email-hint"></div>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <div class="password-wrap">
          <input id="password" name="password" type="password" autocomplete="current-password" minlength="8" placeholder="Enter your password" required>
          <button class="toggle" type="button" id="toggle-password" aria-label="Show password">Show</button>
        </div>
        <div class="caps" id="caps-hint"></div>
        <div class="hint" id="password-hint"></div>
      </div>
      <div class="row">
        <label class="remember">
          <input type="checkbox" name="remember" value="on">
          Remember me for 7 days
        </label>
      </div>
      <button type="submit" id="submit-btn">Sign in</button>
    </form>
    <p class="demo">
      Demo accounts<br>
      student@rpkigali.ac.rw / DevOps@2026<br>
      admin@rpkigali.ac.rw / Admin@2026
    </p>
    <span class="badge">User authentication feature branch</span>
  </main>
  <script>
    (function () {
      var form = document.getElementById('login-form');
      var email = document.getElementById('email');
      var password = document.getElementById('password');
      var emailHint = document.getElementById('email-hint');
      var passwordHint = document.getElementById('password-hint');
      var capsHint = document.getElementById('caps-hint');
      var toggle = document.getElementById('toggle-password');
      var submit = document.getElementById('submit-btn');
      var emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

      toggle.addEventListener('click', function () {
        var hidden = password.type === 'password';
        password.type = hidden ? 'text' : 'password';
        toggle.textContent = hidden ? 'Hide' : 'Show';
        toggle.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
      });

      password.addEventListener('keyup', function (event) {
        capsHint.textContent = event.getModifierState && event.getModifierState('CapsLock')
          ? 'Caps Lock is on'
          : '';
      });

      form.addEventListener('submit', function (event) {
        emailHint.textContent = '';
        passwordHint.textContent = '';
        var valid = true;
        if (!emailPattern.test(email.value.trim())) {
          emailHint.textContent = 'Enter a valid email address.';
          valid = false;
        }
        if (password.value.length < 8) {
          passwordHint.textContent = 'Password must be at least 8 characters.';
          valid = false;
        }
        if (!valid) {
          event.preventDefault();
          return;
        }
        submit.disabled = true;
        submit.textContent = 'Signing in...';
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  authenticate,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  parseBody,
  sessionCookie,
  clearSessionCookie,
  renderLoginPage,
  USERS,
};

if (require.main === module) {
  require('./Index');
}
