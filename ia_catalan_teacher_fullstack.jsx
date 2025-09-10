# IA Catalan Teacher — Fullstack (fixed + tests)

> **Summary of the fix**
>
> I replaced the previous ES-module-only server with a CommonJS-compatible server (`server.js`) and removed any dependency on ESM-only packages. The server now serves the static frontend from `public/` and provides a `/api/lesson` endpoint. If `OPENAI_API_KEY` is set the server will forward requests to the OpenAI Chat Completions endpoint (using the built-in `https` module). If no key is set it returns a safe **mock** lesson so you can run and test the app without an API key. I also added a small automated test runner to validate the health and lesson endpoints.

---

## Why this fixes the error `SyntaxError: /index.tsx: Unexpected token (1:0)`

That error is typically triggered when a runtime or tool attempts to execute a `.tsx`/`.jsx` file without the required transpilation (Babel/TypeScript). Many sandboxes will try to run a file named `index.*` directly with `node` which causes a syntax error when JSX is present. To avoid that class of problem:

- the frontend is a plain `index.html` + `app.js` (no TypeScript, no JSX files requiring transpilation), and
- the backend is CommonJS (`require(...)`) so it runs with `node server.js` in environments that do not enable ESM by default.

If you *do* want a Next.js/TypeScript project (which *does* use `index.tsx`), I can convert this repo to a Next.js setup — just tell me and I will update the project accordingly.

---

## Files included (all content belongs to the same repo)

### package.json

```json
{
  "name": "ia-catalan-teacher",
  "version": "1.0.1",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "node test/run-tests.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

Notes: there is **no** `type: "module"` here — the server uses CommonJS `require(...)` so it works in sandboxes where ES modules are not enabled.

---

### server.js  (Express backend — CommonJS)

```js
// server.js — CommonJS, works with `node server.js`
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend (public/index.html + public/app.js)
app.use(express.static(path.join(__dirname, 'public')));

// Helper: system prompt to steer the AI as a Catalan teacher
const SYSTEM_PROMPT = `Ets un professor/a nadiu/na de català. Sigues amable, clar/a i adapta les lliçons al nivell de l'estudiant (A1..C2). Dona explicacions concises, exemples, frases per practicar i exercicis de pronunciació (amb transcripció fonètica aproximada si cal).`;

// Small helper that calls OpenAI REST API using core https (no external HTTP lib)
function callOpenAI(messages, model = 'gpt-4o-mini') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reject(new Error('OPENAI_API_KEY not set'));

    const payload = JSON.stringify({ model, messages, max_tokens: 800, temperature: 0.2 });
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid JSON from OpenAI: ' + raw));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// POST /api/lesson — returns a lesson (either from OpenAI or a mock)
app.post('/api/lesson', async (req, res) => {
  try {
    const { level = 'A1', topic = 'salutacions', mode = 'lesson', userPrompt = '' } = req.body || {};

    const userMessage = `Nivell: ${level}\nMode: ${mode}\nTema: ${topic}\nInstruccions addicionals: ${userPrompt}\nGenera: 1) breu explicació 2) 6 frases d'exemple amb traducció 3) 2 exercicis (un de gramàtica, un de parlar).`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ];

    // If API key present, forward to OpenAI
    if (process.env.OPENAI_API_KEY) {
      const openaiResp = await callOpenAI(messages);
      const text = openaiResp?.choices?.[0]?.message?.content || JSON.stringify(openaiResp);
      return res.json({ ok: true, text });
    }

    // Fallback: return a deterministic mock lesson so the project runs without an API key
    const mock = `Mock lesson (${level} — ${topic} — ${mode})\n\nExplicació breu: Aquesta és una lliçó de prova per practicar salutacions en català.\n\nFrases d'exemple:\n1. Hola — Hello\n2. Bon dia — Good morning\n3. Com estàs? — How are you?\n4. Em dic Anna — My name is Anna\n5. Moltes gràcies — Thank you very much\n6. Fins aviat — See you soon\n\nExercici (Gramàtica): Conjuga el ver "ser" en present per: jo, tu, ell/ella.\nExercici (Parlar): Practica la salutació amb un company/a durant 2 minuts.`;

    return res.json({ ok: true, text: mock, note: 'No OPENAI_API_KEY set — this is a mock response' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: (err && err.message) || String(err) });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
```

---

### Frontend: `public/index.html` + `public/app.js` (no build system)

Create a `public` folder and add these two files.

`public/index.html`

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IA Professor Català</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>
<body class="bg-slate-50">
  <div id="root" class="max-w-3xl mx-auto p-6"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

`public/app.js`

```js
const { useState } = React;

function App(){
  const [level, setLevel] = useState('A1');
  const [topic, setTopic] = useState('salutacions');
  const [mode, setMode] = useState('lesson');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(){
    setLoading(true);
    setOutput('');
    try{
      const resp = await fetch('/api/lesson',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level,topic,mode})});
      const data = await resp.json();
      if(data.ok) setOutput(data.text);
      else setOutput('Error: '+(data.error||'unknown'));
    }catch(e){ setOutput('Network error: '+e.message); }
    setLoading(false);
  }

  return React.createElement('div', {className:'space-y-6'},
    React.createElement('h1',{className:'text-2xl font-bold'}, 'IA Professor de Català'),
    React.createElement('div', {className:'flex gap-2'},
      React.createElement('select',{value:level,onChange:e=>setLevel(e.target.value),className:'p-2 border rounded'},
        ['A1','A2','B1','B2','C1','C2'].map(l=>React.createElement('option',{key:l,value:l},l))
      ),
      React.createElement('input',{value:topic,onChange:e=>setTopic(e.target.value),className:'p-2 border rounded flex-1',placeholder:'Tema (ex: verbs ser/estar)'}),
      React.createElement('select',{value:mode,onChange:e=>setMode(e.target.value),className:'p-2 border rounded'},
        ['lesson','practice','pronunciation'].map(m=>React.createElement('option',{key:m,value:m},m))
      ),
      React.createElement('button',{onClick:ask,disabled:loading,className:'px-4 py-2 bg-sky-600 text-white rounded disabled:opacity-50'}, loading? 'Carregant...': 'Genera')
    ),

    React.createElement('div',{className:'bg-white p-4 rounded shadow min-h-[160px] whitespace-pre-line'}, output || 'Aquí apareixerà la lliçó...')
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
```

---

### Tests: `test/run-tests.js`

This simple test script starts the server (as a child process), waits until it prints the "Server listening" message, runs a couple of API checks (health + lesson) and then stops the server. It verifies the basic happy path and the mock behaviour (useful when `OPENAI_API_KEY` is not present).

```js
// test/run-tests.js
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

function httpPostJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Invalid JSON: ' + raw)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
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
        console.log('Checking /api/health...');
        const health = await httpGetJson('/api/health');
        if (!health.ok) throw new Error('Health check failed');
        console.log('Health OK');

        console.log('Checking /api/lesson (mock or real)...');
        const lesson = await httpPostJson('/api/lesson', { level: 'A1', topic: 'salutacions', mode: 'lesson' });
        if (!lesson.ok || typeof lesson.text !== 'string') throw new Error('Lesson endpoint failed: ' + JSON.stringify(lesson));
        console.log('Lesson OK — text length:', lesson.text.length);

        console.log('\nAll tests passed.');
        server.kill();
        process.exit(0);
      } catch (err) {
        console.error('Tests failed:', err);
        server.kill();
        process.exit(1);
      }
    }
  });

  server.stderr.setEncoding('utf8');
  server.stderr.on('data', (c) => process.stderr.write('[server-err] ' + c));
})();
```

Run the tests with:

```bash
npm install
npm test
```

(Tests will pass even without `OPENAI_API_KEY` because the server returns a deterministic mock in that case.)

---

## How to run locally

1. `npm install`
2. (optional) `export OPENAI_API_KEY="sk-..."` if you want real AI answers.
3. `npm start`
4. Open `http://localhost:3000` in your browser.

---

## Troubleshooting: the `index.tsx` unexpected token error

If you see an error like `SyntaxError: /index.tsx: Unexpected token (1:0)` it means the runtime is trying to execute a TypeScript/JSX file directly without transpilation. Solutions:

- **If you intended to use plain HTML/JS:** make sure there are no `index.tsx` / `.tsx` / `.jsx` files in the project root your environment auto-runs. Use plain `index.html` (like this project) or rename `.tsx` to `.jsx` and build with a bundler.
- **If you intended to use Next.js / Create React App / Vite:** run `npm run dev` with the framework's starter (or use `next dev` / `vite`) so the file is transpiled. I can convert this repo to Next.js if you want.
- **Node version:** use Node 18+ to get global `fetch` and modern runtime features, though this project doesn't require `fetch` in the server (it uses `https`).

---

## Where to deploy

- **Vercel** — best if you want to convert frontend into Next.js (I can help).
- **Render** — straightforward for a Node/Express app (just push the repo and set `OPENAI_API_KEY` as an environment variable).
- **Netlify** — fine for static frontend; you'd move the server logic into Netlify Functions.

---

## What I changed (short)

- Converted server to CommonJS (`require`) and added `express.static('public')` so the server serves the frontend directly.
- Removed ESM-only package usage in the example.
- Added a mock path so the app runs without `OPENAI_API_KEY`.
- Added a test runner `test/run-tests.js` and `npm test` script.

---

## Next steps / Questions for you

1. Do you want the app to **always** call the real OpenAI API (requires `OPENAI_API_KEY`) or prefer mock responses by default for development? (Current default: mock unless `OPENAI_API_KEY` is set.)
2. Do you want a **Next.js + TypeScript** version (this will create `index.tsx` files and requires a bundler) or keep the **no-build** simple static frontend + Express server (current)?
3. If you still see the `index.tsx` error when running the updated project, please paste the full stack trace and tell me which command you ran. I'll debug the exact environment issue.

Tell me your preferences and I will update the repo again to match them.
