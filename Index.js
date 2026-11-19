const http = require('http');
const {
  authenticate,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  parseBody,
  sessionCookie,
  clearSessionCookie,
  renderLoginPage,
} = require('./Login');

const PORT = 3000;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function homePage(user) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Web App</title>
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
    }
    .card {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 20px;
      padding: 50px 60px;
      text-align: center;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
      max-width: 90%;
    }
    h1 { font-size: 2rem; margin-bottom: 12px; }
    p { opacity: 0.85; margin-bottom: 16px; }
    .user { margin-bottom: 22px; font-weight: 600; }
    .badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 50px;
      background: #00c9a7;
      color: #043d33;
      font-weight: 600;
      font-size: 0.9rem;
      margin: 0 6px 12px;
    }
    a.logout {
      display: inline-block;
      color: #fff;
      text-decoration: none;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 50px;
      padding: 8px 18px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello, this is a basic web app!</h1>
    <p>RP-Kigali College &middot; DevOps Y4 &middot; Practical Work #2</p>
    <p class="user">Signed in as ${escapeHtml(user.name)} (${escapeHtml(user.role)})</p>
    <span class="badge">Served with Node.js + Git</span>
    <span class="badge">Authenticated</span>
    <div><a class="logout" href="/logout">Sign out</a></div>
  </div>
</body>
</html>`;
}

function redirect(res, location, extraHeaders) {
  res.writeHead(302, { Location: location, ...extraHeaders });
  res.end();
}

function currentSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  return getSession(cookies.sessionId);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const session = currentSession(req);

  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/home')) {
      if (!session) return redirect(res, '/login');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(homePage(session.user));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/login') {
      if (session) return redirect(res, '/');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderLoginPage());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      const body = await parseBody(req);
      const result = authenticate(body.email, body.password);
      if (!result.ok) {
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderLoginPage({ error: result.error, email: body.email }));
        return;
      }
      const created = createSession(result.user, body.remember === 'on');
      redirect(res, '/', { 'Set-Cookie': sessionCookie(created.id, created.maxAge) });
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/logout') {
      const cookies = parseCookies(req.headers.cookie);
      destroySession(cookies.sessionId);
      redirect(res, '/login', { 'Set-Cookie': clearSessionCookie() });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error('Stop the other process, then run: npm start');
    console.error(`Windows: netstat -ano | findstr :${PORT}   then   taskkill /PID <pid> /F`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
