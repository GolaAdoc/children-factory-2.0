#!/usr/bin/env node
// P0 docs verification. Node built-ins only.
import { existsSync, readFileSync } from 'node:fs';
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
];

// P0-ONLY tripwire (Rule 11). P1 MUST remove or relax this list.
const FORBIDDEN_ROOT_PATHS = [
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'tsconfig.json', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env', 'apps', 'src', 'prisma', 'nginx',
];

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

// 1. Required files and forbidden paths
for (const f of REQUIRED_FILES) {
  if (!existsSync(join(ROOT, f))) fail('missing required file: ' + f);
}
for (const f of FORBIDDEN_ROOT_PATHS) {
  if (existsSync(join(ROOT, f))) fail('forbidden path present (Rule 11, P0 scope): ' + f);
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
  const want = Array.from({ length: 15 }, (_, i) => i + 1);
  if (nums.join(',') !== want.join(',')) fail('AGENTS.md: rules must be numbered exactly 1..15, found: ' + nums.join(','));
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
const wf = read('.github/workflows/docs-ci.yml');
if (!/^\s+name:\s*docs-verify\s*$/m.test(wf)) fail('workflow: job name must be docs-verify');
if (!/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(wf)) fail('workflow: top-level permissions must be contents: read');
if (!/^\s*pull_request:/m.test(wf)) fail('workflow: must trigger on pull_request');
if (!/^\s*push:/m.test(wf)) fail('workflow: must trigger on push');
if (/^\s*paths(-ignore)?:/m.test(wf)) fail('workflow: path filters are forbidden (required check would hang)');

// 5. Relative markdown links
for (const f of REQUIRED_FILES.filter((x) => x.endsWith('.md'))) {
  const text = read(f);
  for (const m of text.matchAll(/\]\((?!https?:|mailto:|#)([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const target = resolve(dirname(join(ROOT, f)), m[1]);
    if (!existsSync(target)) fail(f + ': broken relative link -> ' + m[1]);
  }
}

finish();
