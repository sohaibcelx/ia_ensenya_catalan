const cp = require('child_process');
const http = require('http');

function httpGetJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path, agent: false }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Invalid JSON: ' + raw)); }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('Starting server...');
  const server = cp.spawn('node', ['server.js'], { stdio: ['ignore','pipe','pipe'] });
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', async (chunk) => {
    process.stdout.write('[server] ' + chunk);
    if (chunk.includes('Server listening on port')) {
      try {
        const health = await httpGetJson('/api/health');
        console.log('Health OK:', health.ok);
        server.kill();
      } catch (err) {
        console.error('Test failed:', err);
        server.kill();
      }
    }
  });
})();