const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Ets un professor/a nadiu/na de català. Sigues amable, clar/a i adapta les lliçons al nivell de l'estudiant (A1..C2). Dona explicacions concises, exemples, frases per practicar i exercicis de pronunciació (amb transcripció fonètica aproximada si cal).`;

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

app.post('/api/lesson', async (req, res) => {
  try {
    const { level = 'A1', topic = 'salutacions', mode = 'lesson', userPrompt = '' } = req.body || {};

    const userMessage = `Nivell: ${level}\nMode: ${mode}\nTema: ${topic}\nInstruccions addicionals: ${userPrompt}\nGenera: 1) breu explicació 2) 6 frases d'exemple amb traducció 3) 2 exercicis (un de gramàtica, un de parlar).`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ];

    if (process.env.OPENAI_API_KEY) {
      const openaiResp = await callOpenAI(messages);
      const text = openaiResp?.choices?.[0]?.message?.content || JSON.stringify(openaiResp);
      return res.json({ ok: true, text });
    }

    const mock = `Mock lesson (${level} — ${topic} — ${mode})\n\nExplicació breu: Aquesta és una lliçó de prova per practicar salutacions en català.\n\nFrases d'exemple:\n1. Hola — Hello\n2. Bon dia — Good morning\n3. Com estàs? — How are you?\n4. Em dic Anna — My name is Anna\n5. Moltes gràcies — Thank you very much\n6. Fins aviat — See you soon\n\nExercici (Gramàtica): Conjuga el ver \"ser\" en present per: jo, tu, ell/ella.\nExercici (Parlar): Practica la salutació amb un company/a durant 2 minuts.`;

    return res.json({ ok: true, text: mock, note: 'No OPENAI_API_KEY set — this is a mock response' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: (err && err.message) || String(err) });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
