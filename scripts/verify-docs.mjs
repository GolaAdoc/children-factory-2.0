#!/usr/bin/env node
// Docs and contract verification (P0; amended in P1A). Node built-ins only.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FENCE = '`'.repeat(3);
const failures = [];
const fail = (msg) => failures.push(msg);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const REQUIRED_FILES = [
  'AGENTS.md',
  'docs/README.md',
  'docs/adr/0001-modular-monolith-and-stack.md',
  'docs/adr/0002-postgres-source-of-truth.md',
  'docs/diagrams/erd.md',
  'docs/diagrams/order-state-machine.md',
  'docs/diagrams/auth-flow.md',
  'docs/runbooks/branch-protection.md',
  '.github/workflows/docs-ci.yml',
  'scripts/verify-docs.mjs',
  '.github/workflows/app-ci.yml',
  'docs/phase-reports/P1A-database-foundation.md',
];

// STAGE-0 GUARD (Rules 4 and 11): Stage 0 has no Redis or Nginx.
// Retire the redis entries in P3 and the nginx entries in P23.
const FORBIDDEN_ROOT_PATHS = ['nginx', 'redis'];
const FORBIDDEN_COMPOSE_PATTERNS = [/^\s*(redis|nginx)\s*:/im, /image:\s*\S*(redis|nginx)/i];

function finish() {
  if (failures.length) {
    console.error('verify-docs: FAIL');
    for (const f of failures) console.error(' - ' + f);
    process.exit(1);
  }
  console.log('verify-docs: OK');
  process.exit(0);
}

function section(text, headingStart) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ' + headingStart));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}

// 1. Required files and Stage-0 guard
for (const f of REQUIRED_FILES) {
  if (!existsSync(join(ROOT, f))) fail('missing required file: ' + f);
}
for (const f of FORBIDDEN_ROOT_PATHS) {
  if (existsSync(join(ROOT, f))) fail('forbidden Stage 0 path present (Rule 11): ' + f);
}
if (existsSync(join(ROOT, 'docker-compose.yml'))) {
  const compose = read('docker-compose.yml');
  for (const re of FORBIDDEN_COMPOSE_PATTERNS) {
    if (re.test(compose)) fail('docker-compose.yml: redis or nginx service/image is forbidden in Stage 0 (Rule 11)');
  }
}
if (failures.length) finish();

// 2. AGENTS.md structure
const agents = read('AGENTS.md');

const prio = section(agents, 'Design Priorities');
if (prio === null) {
  fail('AGENTS.md: missing "Design Priorities" section');
} else {
  const order = ['Correctness', 'Economic abuse', 'Simple deployment', 'Reasonable future scalability'];
  let last = -1;
  for (const k of order) {
    const i = prio.indexOf(k);
    if (i <= last) fail('AGENTS.md: design priority missing or out of order: ' + k);
    last = i;
  }
}

const rules = section(agents, 'Agent Strict Rules');
if (rules === null) {
  fail('AGENTS.md: missing "Agent Strict Rules" section');
} else {
  const nums = [...rules.matchAll(/^(\d+)\.\s/gm)].map((m) => Number(m[1]));
  const want = Array.from({ length: 16 }, (_, i) => i + 1);
  if (nums.join(',') !== want.join(',')) fail('AGENTS.md: rules must be numbered exactly 1..16, found: ' + nums.join(','));
}

const phases = section(agents, 'Phase Map');
if (phases === null) {
  fail('AGENTS.md: missing "Phase Map" section');
} else {
  for (let n = 0; n <= 25; n++) {
    if (!new RegExp('\\bP' + n + '\\b').test(phases)) fail('AGENTS.md: Phase Map missing P' + n);
  }
  if (!phases.includes('Stage 0 excludes Redis and Nginx')) fail('AGENTS.md: Phase Map must state "Stage 0 excludes Redis and Nginx"');
}

// 3. Diagrams
const mermaidRe = new RegExp(FENCE + 'mermaid\\n([\\s\\S]*?)' + FENCE, 'g');
const DIAGRAMS = [
  { file: 'docs/diagrams/erd.md', type: 'erDiagram', min: 1, markers: ['Status: PROVISIONAL'] },
  { file: 'docs/diagrams/order-state-machine.md', type: 'stateDiagram-v2', min: 1, markers: ['Status: PROVISIONAL', 'affected-row'] },
  { file: 'docs/diagrams/auth-flow.md', type: 'sequenceDiagram', min: 4, markers: ['Status: PROVISIONAL', 'A-1', 'A-2', 'A-3'] },
];
for (const d of DIAGRAMS) {
  const text = read(d.file);
  const blocks = [...text.matchAll(mermaidRe)].map((m) => m[1].trim());
  if (blocks.length < d.min) fail(d.file + ': expected at least ' + d.min + ' mermaid block(s), found ' + blocks.length);
  blocks.forEach((b, i) => {
    if (b.split('\n')[0].trim() !== d.type) fail(d.file + ': block ' + (i + 1) + ' must start with "' + d.type + '"');
  });
  for (const m of d.markers) {
    if (!text.includes(m)) fail(d.file + ': missing marker "' + m + '"');
  }
}

// 4. Workflow assertions
const WORKFLOWS = [
  { file: '.github/workflows/docs-ci.yml', job: 'docs-verify' },
  { file: '.github/workflows/app-ci.yml', job: 'app-verify' },
];
for (const w of WORKFLOWS) {
  const wf = read(w.file);
  if (!new RegExp('^\\s+name:\\s*' + w.job + '\\s*$', 'm').test(wf)) fail(w.file + ': job name must be ' + w.job);
  if (!/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(wf)) fail(w.file + ': top-level permissions must be contents: read');
  if (!/^\s*pull_request:/m.test(wf)) fail(w.file + ': must trigger on pull_request');
  if (!/^\s*push:/m.test(wf)) fail(w.file + ': must trigger on push');
  if (/^\s*paths(-ignore)?:/m.test(wf)) fail(w.file + ': path filters are forbidden (required check would hang)');
}

// 5. Relative markdown links
for (const f of REQUIRED_FILES.filter((x) => x.endsWith('.md'))) {
  const text = read(f);
  for (const m of text.matchAll(/\]\((?!https?:|mailto:|#)([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const target = resolve(dirname(join(ROOT, f)), m[1]);
    if (!existsSync(target)) fail(f + ': broken relative link -> ' + m[1]);
  }
}

// 6. Phase reports (Rule 16)
const REPORT_HEADINGS = ['Executive summary', 'Modules modified', 'Technical implementation', 'Visual evidence'];
for (const f of readdirSync(join(ROOT, 'docs/phase-reports')).filter((x) => /^P\d+[A-Z]?-.+\.md$/.test(x))) {
  const text = read('docs/phase-reports/' + f);
  for (const h of REPORT_HEADINGS) {
    if (!new RegExp('^## ' + h, 'm').test(text)) fail('docs/phase-reports/' + f + ': missing heading "## ' + h + '"');
  }
}

finish();
