// Tiny static server for previewing the hero: node serve.js
// Also accepts POST /save?name=videos/<file> so studio.html can save the videos it records.
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = 5173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'POST' && url.pathname === '/save') {
    const name = url.searchParams.get('name') || '';
    if (!/^videos\/[\w.-]+\.(mp4|jpg)$/.test(name)) { res.writeHead(400); return res.end('bad name'); }
    const out = path.join(root, name);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { fs.writeFileSync(out, Buffer.concat(chunks)); res.writeHead(200); res.end('saved'); });
    return;
  }

  const rel = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname);
  const p = path.join(root, rel);
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(p, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = types[path.extname(p)] || 'application/octet-stream';
    // byte ranges: Safari needs these to play video
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(p, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(p).pipe(res);
  });
}).listen(port, () => console.log(`http://localhost:${port}`));
