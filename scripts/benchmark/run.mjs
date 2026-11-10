/*
  RECOGNITION BENCHMARK

  Sends every photo in testset.json through the app's real recognition pipeline
  (server/identify.js: prompt, safety filter, iNaturalist grounding) once per model,
  and reports how often the right species comes first or in the top 3, and how long it takes.

  Usage:
    node --env-file=.env scripts/benchmark/run.mjs [--models=default,evren:qwen3-vl-30b,gemini:gemini-3.5-flash-lite]
                                                   [--language=tr] [--limit=10] [--concurrency=2]

  Results are written to scripts/benchmark/results/ (git-ignored).
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleIdentify } from '../../server/identify.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODELS = [
  'evren:gemma-4-31b', 'evren:qwen3-vl-30b', 'evren:qwen3.8-flash-next', 'evren:deepseek-v4.1-flash',
  'gemini:gemini-3.5-flash-lite', 'gemini:gemini-3.5-flash', 'gemini:gemini-3.8-flash',
];
const RETRY_CODES = new Set(['rate-limit', 'busy']);

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const models = (args.models ?? DEFAULT_MODELS.join(',')).split(',');
const language = args.language ?? 'tr';
const concurrency = Number(args.concurrency ?? 2);
const testset = JSON.parse(fs.readFileSync(path.join(DIR, 'testset.json'), 'utf8')).slice(0, Number(args.limit ?? Infinity));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const genusOf = (name) => String(name).split(' ')[0].toLowerCase();
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Download every photo once
const images = new Map();
for (const item of testset) {
  const response = await fetch(item.url, { headers: { 'User-Agent': 'Mushly-benchmark/0.2' } });
  images.set(item.url, Buffer.from(await response.arrayBuffer()).toString('base64'));
}
console.log(`${testset.length} photos, ${models.length} models, language=${language}\n`);

function envFor(model) {
  if (model === 'default') return { ...process.env }; // the app's own chain, as configured
  const [provider, name] = model.split(':');
  const env = { ...process.env, RECOGNIZER_ORDER: provider };
  if (provider === 'evren') env.EVREN_MODEL = name;
  if (provider === 'gemini') env.GEMINI_MODEL = name;
  return env;
}

async function identifyOnce(item, env) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    const { status, body } = await handleIdentify({ image: images.get(item.url), mediaType: 'image/jpeg', language }, env);
    const seconds = (Date.now() - started) / 1000;
    if (status !== 200 && RETRY_CODES.has(body.code) && attempt < 2) {
      await sleep(20_000);
      continue;
    }
    return { status, body, seconds };
  }
}

async function runModel(model) {
  const env = envFor(model);
  const rows = [];
  let next = 0;
  const worker = async () => {
    while (next < testset.length) {
      const item = testset[next++];
      const { status, body, seconds } = await identifyOnce(item, env);
      const names = (body.candidates ?? []).map((c) => c.latinName);
      rows.push({
        species: item.species,
        url: item.url,
        ok: status === 200,
        error: status === 200 ? null : body.code,
        seconds,
        guesses: names,
        top1: same(names[0], item.species),
        top3: names.some((n) => same(n, item.species)),
        genus1: !!names[0] && genusOf(names[0]) === genusOf(item.species),
      });
      process.stdout.write('.');
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return rows;
}

function summarize(model, rows) {
  const n = rows.length;
  const pct = (k) => `${Math.round((rows.filter((r) => r[k]).length / n) * 100)}%`;
  const times = rows.filter((r) => r.ok).map((r) => r.seconds).sort((a, b) => a - b);
  const at = (q) => (times.length ? times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(0) + 's' : '-');
  return {
    model,
    top1: pct('top1'),
    top3: pct('top3'),
    genus: pct('genus1'),
    failed: rows.filter((r) => !r.ok).length,
    median: at(0.5),
    p90: at(0.9),
  };
}

const results = await Promise.all(
  models.map(async (model) => {
    const rows = await runModel(model);
    return { model, rows, summary: summarize(model, rows) };
  })
);

console.log('\n');
console.table(results.map((r) => r.summary));

fs.mkdirSync(path.join(DIR, 'results'), { recursive: true });
const file = path.join(DIR, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-${language}.json`);
fs.writeFileSync(file, JSON.stringify(results, null, 2));
console.log(`Details: ${file}`);
