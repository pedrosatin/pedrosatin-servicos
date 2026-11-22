#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'comments-baseline.json');
const SCOPE_DIRS = ['src', 'worker', 'shared', 'scripts'];
const CONFIG_FILES = [
  'vite.config.ts',
  'vitest.config.ts',
  'vitest.setup.ts',
  'worker/vitest.config.ts',
  'worker/wrangler.toml',
];
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-ssr', 'graphify-out']);

const EXCEPTION_RE = [
  /^#!/,
  /^\/\/\s*@ts-/,
  /^\/\/\s*eslint-disable/,
  /^\/\/\s*oxlint-disable/,
  /^\/\/\s*prettier-ignore/,
  /^\/\/\/\s*<reference/,
  /^\/\/\s*@vitest-environment/,
  /^\/\*\s*eslint-disable/,
  /^\/\*\s*oxlint-disable/,
  /^\/\*\s*prettier-ignore/,
];

function isException(ctext, startLine) {
  const trimmed = ctext.trim();
  if (trimmed.startsWith('#!')) return true;
  if (
    startLine <= 5 &&
    /(license|copyright|spdx)/i.test(trimmed) &&
    (trimmed.startsWith('/*') || trimmed.startsWith('//'))
  ) {
    return true;
  }
  if (EXCEPTION_RE.some((re) => re.test(trimmed))) return true;
  if (/^\/\*\s*(eslint|oxlint|prettier)/.test(trimmed)) return true;
  if (
    trimmed.startsWith('/**') &&
    /@(param|returns?|return|throws|deprecated|example|template|typedef|property)\b/.test(
      trimmed,
    )
  ) {
    return true;
  }
  return false;
}

function pushComment(comments, text, start, end, kind) {
  let sLine = 1;
  for (let k = 0; k < start; k++) if (text[k] === '\n') sLine++;
  let eLine = sLine;
  for (let k = start; k < end; k++) if (text[k] === '\n') eLine++;
  comments.push({
    start: sLine,
    end: eLine,
    kind,
    text: text.slice(start, end),
    lines: eLine - sLine + 1,
  });
}

function canStartRegex(prev) {
  if (!prev) return true;
  if (/^[A-Za-z0-9_$]+$/.test(prev)) return false;
  if (prev === ')' || prev === ']' || prev === '}') return false;
  return true;
}

function skipRegex(text, from) {
  let i = from + 1;
  let inClass = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      i++;
      continue;
    }
    if (ch === ']' && inClass) {
      inClass = false;
      i++;
      continue;
    }
    if (ch === '/' && !inClass) {
      i++;
      break;
    }
    if (ch === '\n') break;
    i++;
  }
  while (i < n && /[a-z]/i.test(text[i])) i++;
  return i;
}

function extractJsComments(text) {
  const comments = [];
  let i = 0;
  const n = text.length;
  let prevNonWs = '';
  const isIdent = (c) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      const start = i;
      i += 2;
      while (i < n && text[i] !== '\n') i++;
      pushComment(comments, text, start, i, 'line');
      prevNonWs = '';
      continue;
    }
    if (c === '/' && next === '*') {
      const start = i;
      i += 2;
      while (i < n - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(n, i + 2);
      pushComment(comments, text, start, i, 'block');
      prevNonWs = '';
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      while (i < n) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === q) {
          i++;
          break;
        }
        if (text[i] === '\n') break;
        i++;
      }
      prevNonWs = 'str';
      continue;
    }
    if (c === '`') {
      i++;
      while (i < n) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === '`') {
          i++;
          break;
        }
        if (text[i] === '$' && text[i + 1] === '{') {
          i += 2;
          let depth = 1;
          let exprPrev = '';
          while (i < n && depth > 0) {
            const ch = text[i];
            const nx = text[i + 1];
            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
              i++;
              continue;
            }
            if (ch === '/' && nx === '/') {
              const start = i;
              i += 2;
              while (i < n && text[i] !== '\n') i++;
              pushComment(comments, text, start, i, 'line');
              exprPrev = '';
              continue;
            }
            if (ch === '/' && nx === '*') {
              const start = i;
              i += 2;
              while (i < n - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
              i = Math.min(n, i + 2);
              pushComment(comments, text, start, i, 'block');
              exprPrev = '';
              continue;
            }
            if (ch === "'" || ch === '"') {
              const q = ch;
              i++;
              while (i < n) {
                if (text[i] === '\\') {
                  i += 2;
                  continue;
                }
                if (text[i] === q) {
                  i++;
                  break;
                }
                if (text[i] === '\n') break;
                i++;
              }
              exprPrev = 'str';
              continue;
            }
            if (ch === '`') {
              i++;
              let nd = 0;
              while (i < n) {
                if (text[i] === '\\') {
                  i += 2;
                  continue;
                }
                if (text[i] === '`' && nd === 0) {
                  i++;
                  break;
                }
                if (text[i] === '$' && text[i + 1] === '{') {
                  nd++;
                  i += 2;
                  continue;
                }
                if (text[i] === '}' && nd > 0) {
                  nd--;
                  i++;
                  continue;
                }
                i++;
              }
              exprPrev = 'tmpl';
              continue;
            }
            if (ch === '{') {
              depth++;
              exprPrev = '{';
              i++;
              continue;
            }
            if (ch === '}') {
              depth--;
              exprPrev = '}';
              i++;
              continue;
            }
            if (ch === '/' && canStartRegex(exprPrev)) {
              i = skipRegex(text, i);
              exprPrev = 're';
              continue;
            }
            if (isIdent(ch) || ch === '.') {
              let s = '';
              while (i < n && (isIdent(text[i]) || text[i] === '.')) {
                s += text[i];
                i++;
              }
              exprPrev = s;
              continue;
            }
            exprPrev = ch;
            i++;
          }
          continue;
        }
        i++;
      }
      prevNonWs = 'tmpl';
      continue;
    }
    if (c === '/' && canStartRegex(prevNonWs)) {
      i = skipRegex(text, i);
      prevNonWs = 're';
      continue;
    }
    if (isIdent(c) || c === '.') {
      let s = '';
      while (i < n && (isIdent(text[i]) || text[i] === '.')) {
        s += text[i];
        i++;
      }
      prevNonWs = s;
      continue;
    }
    prevNonWs = c;
    i++;
  }
  return comments;
}

function extractCssComments(text) {
  const comments = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '/' && text[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(text.length, i + 2);
      pushComment(comments, text, start, i, 'block');
      continue;
    }
    if (text[i] === "'" || text[i] === '"') {
      const q = text[i];
      i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return comments;
}

function extractTomlComments(text) {
  const comments = [];
  const lines = text.split(/\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let inStr = false;
    let q = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === q) inStr = false;
        continue;
      }
      if (c === "'" || c === '"') {
        inStr = true;
        q = c;
        continue;
      }
      if (c === '#') {
        comments.push({
          start: li + 1,
          end: li + 1,
          kind: 'line',
          text: line.slice(i),
          lines: 1,
        });
        break;
      }
    }
  }
  return comments;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(p, out);
    } else if (EXTS.has(path.extname(ent.name))) {
      out.push(p);
    }
  }
  return out;
}

function listScopedFiles() {
  const files = [];
  for (const r of SCOPE_DIRS) walk(path.join(ROOT, r), files);
  for (const c of CONFIG_FILES) {
    const abs = path.join(ROOT, c);
    if (fs.existsSync(abs) && !files.includes(abs)) files.push(abs);
  }
  return files.sort();
}

function countFile(absPath) {
  const text = fs.readFileSync(absPath, 'utf8');
  const ext = path.extname(absPath);
  let found;
  if (ext === '.css') found = extractCssComments(text);
  else if (ext === '.toml') found = extractTomlComments(text);
  else found = extractJsComments(text);

  let actionable = 0;
  let actionableLines = 0;
  let exceptions = 0;
  for (const c of found) {
    if (isException(c.text, c.start)) {
      exceptions++;
      continue;
    }
    actionable++;
    actionableLines += c.lines;
  }
  return { actionable, actionableLines, exceptions };
}

function relative(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join('/');
}

function scan() {
  const counts = {};
  let total = 0;
  let totalLines = 0;
  let totalExceptions = 0;
  for (const abs of listScopedFiles()) {
    const rel = relative(abs);
    const { actionable, actionableLines, exceptions } = countFile(abs);
    totalExceptions += exceptions;
    if (actionable > 0) {
      counts[rel] = actionable;
      total += actionable;
      totalLines += actionableLines;
    }
  }
  return { counts, total, totalLines, totalExceptions };
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return { files: {}, generatedAt: null };
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function writeBaseline(counts) {
  const payload = {
    generatedAt: new Date().toISOString(),
    total: Object.values(counts).reduce((a, n) => a + n, 0),
    files: Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

const update = process.argv.includes('--update');
const { counts, total, totalLines, totalExceptions } = scan();

if (update) {
  const previous = readBaseline();
  const next = { ...counts };
  const raised = [];
  for (const [file, prev] of Object.entries(previous.files || {})) {
    const now = next[file] ?? 0;
    if (now > prev) {
      raised.push({ file, prev, now });
      next[file] = prev;
    }
    if (now === 0) delete next[file];
  }
  if (raised.length) {
    console.error('check-comments --update: recusou subir o baseline:');
    for (const r of raised) {
      console.error(`  ${r.file}: ${r.prev} → ${r.now}`);
    }
    process.exit(1);
  }
  const written = writeBaseline(next);
  console.log(
    `comments baseline updated: ${written.total} comentários acionáveis em ${Object.keys(written.files).length} arquivos (${totalLines} linhas neste scan; ${totalExceptions} exceções ignoradas)`,
  );
  process.exit(0);
}

const baseline = readBaseline();
const baselineFiles = baseline.files || {};
const failures = [];

for (const [file, count] of Object.entries(counts)) {
  if (!(file in baselineFiles)) {
    failures.push(`${file}: arquivo novo com ${count} comentário(s) (baseline ausente)`);
    continue;
  }
  if (count > baselineFiles[file]) {
    failures.push(
      `${file}: ${count} comentário(s), acima do baseline ${baselineFiles[file]}`,
    );
  }
}

for (const file of Object.keys(baselineFiles)) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs) && baselineFiles[file] > 0) {
  }
}

if (failures.length) {
  console.error('check-comments: falhou o ratchet de comentários');
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    'Apague os comentários novos ou rode `node scripts/check-comments.mjs --update` só depois de reduzir contagens.',
  );
  process.exit(1);
}

const baselineTotal = Object.values(baselineFiles).reduce((a, n) => a + n, 0);
console.log(
  `check-comments: ok (${total}/${baselineTotal} comentários acionáveis; ${totalExceptions} exceções; ${totalLines} linhas acionáveis no scan)`,
);
