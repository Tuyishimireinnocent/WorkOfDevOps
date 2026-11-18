const http = require('http');

const PORT = 3000;

const page = `<!DOCTYPE html>
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
    p { opacity: 0.85; margin-bottom: 25px; }
    .badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 50px;
      background: #00c9a7;
      color: #043d33;
      font-weight: 600;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello, this is a basic web app!</h1>
    <p>RP-Kigali College &middot; DevOps Y4 &middot; Practical Work #2</p>
    <span class="badge">Served with Node.js + Git</span>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});