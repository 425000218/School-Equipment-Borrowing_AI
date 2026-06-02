// server.js
// Simple static file server for the School-Equipment-Borrowing project.
// Uses only Node's built‑in modules – no npm dependencies.
// Run with: & "C:/LEARN/node-v24.16.0-win-x64/node.exe" server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const ROOT = path.resolve(__dirname, 'wwwroot');

// Minimal MIME type map for common assets
const MIME = {
  '.html': 'text/html',
  '.htm':  'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain'
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('500 Internal Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  // Decode URL and prevent directory traversal
  const safePath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, safePath);

  // If request ends with '/', treat it as a folder and serve index.html
  if (safePath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }

  // If the path points to a directory without trailing '/', redirect
  if (!safePath.includes('.') && !safePath.endsWith('/')) {
    res.writeHead(301, { Location: safePath + '/' });
    return res.end();
  }

  // If the file doesn't exist, fall back to index.html (SPA/PJAX behavior)
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(filePath, res);
    } else {
      // Fallback to index.html for routes that rely on PJAX
      const indexPath = path.join(ROOT, 'index.html');
      fs.stat(indexPath, (e, s) => {
        if (!e && s.isFile()) {
          serveFile(indexPath, res);
        } else {
          res.writeHead(404);
          res.end('404 Not Found');
        }
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🛡️  Static server listening on http://localhost:${PORT}`);
});
