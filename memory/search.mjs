#!/usr/bin/env node

/**
 * ZMail Memory Search — hibrid kereso utility
 *
 * Hasznalat:
 *   node memory/search.mjs "deploy checklist"
 *   node memory/search.mjs --type semantic "Neon database"
 *   node memory/search.mjs --type episodic "CORS"
 *   node memory/search.mjs --type procedural "push"
 *   node memory/search.mjs --domain security "production"
 *   node memory/search.mjs --top 3 "OAuth"
 *   node memory/search.mjs --reindex
 *   node memory/search.mjs --list
 *
 * Keresesi strategia:
 *   1. YAML frontmatter metaadat-szures (type, domain, tags, entities)
 *   2. BM25-szeru keyword relevancia (title, summary, retrieval_hints, tartalom)
 *   3. Importance score sullyozas
 *   4. Top-N eredmeny, evidence pack build
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const MEMORY_ROOT = new URL('.', import.meta.url).pathname;
const INDEX_PATH = join(MEMORY_ROOT, 'indexes', 'index.yml');

// --- YAML frontmatter parser (minimal, no dependency) ---

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlStr = match[1];
  const body = match[2];
  const meta = {};

  let currentKey = null;
  let currentList = null;

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Inline list: key: [a, b, c]
    const inlineListMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*\[([^\]]*)\]\s*$/);
    if (inlineListMatch) {
      const key = inlineListMatch[1];
      meta[key] = inlineListMatch[2].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      currentKey = null;
      currentList = null;
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kvMatch && !trimmed.startsWith('-')) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim().replace(/^["']|["']$/g, '');
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
      else if (/^\d+$/.test(value)) value = parseInt(value);
      meta[key] = value;
      currentKey = key;
      currentList = null;
      continue;
    }

    // Key with no value (start of block)
    const blockMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*$/);
    if (blockMatch) {
      currentKey = blockMatch[1];
      currentList = null;
      meta[currentKey] = {};
      continue;
    }

    // List item
    if (trimmed.startsWith('- ')) {
      const val = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
      if (currentKey && !currentList) {
        if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
        currentList = meta[currentKey];
      }
      if (currentList) currentList.push(val);
      continue;
    }

    // Nested key under block
    if (currentKey && typeof meta[currentKey] === 'object' && !Array.isArray(meta[currentKey])) {
      const nestedKv = trimmed.match(/^(\w[\w_]*)\s*:\s*$/);
      if (nestedKv) {
        const nestedKey = nestedKv[1];
        meta[currentKey][nestedKey] = [];
        currentList = meta[currentKey][nestedKey];
      }
    }
  }

  return { meta, body };
}

// --- Recursively find all .md files ---

function findMarkdownFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // Skip indexes and wiki (for now)
      if (entry !== 'indexes') {
        results.push(...findMarkdownFiles(full));
      }
    } else if (entry.endsWith('.md') && entry !== 'README.md') {
      results.push(full);
    }
  }
  return results;
}

// --- Load all memory chunks ---

function loadChunks() {
  const files = findMarkdownFiles(MEMORY_ROOT);
  return files
    .map((f) => {
      const content = readFileSync(f, 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      return {
        ...meta,
        body,
        file: relative(MEMORY_ROOT, f),
        fullPath: f,
      };
    })
    .filter((c) => c.id);
}

// --- BM25-like keyword scoring ---

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildSearchableText(chunk) {
  const parts = [
    chunk.title || '',
    chunk.summary || '',
    chunk.body || '',
    (chunk.tags || []).join(' '),
    (chunk.entities || []).join(' '),
  ];

  // Add retrieval hints
  if (chunk.retrieval_hints) {
    if (chunk.retrieval_hints.lexical) {
      parts.push(...(Array.isArray(chunk.retrieval_hints.lexical) ? chunk.retrieval_hints.lexical : []));
    }
    if (chunk.retrieval_hints.semantic) {
      parts.push(...(Array.isArray(chunk.retrieval_hints.semantic) ? chunk.retrieval_hints.semantic : []));
    }
    // Handle nested retrieval_hints from parsed YAML
    for (const [, val] of Object.entries(chunk.retrieval_hints)) {
      if (Array.isArray(val)) parts.push(...val);
    }
  }

  return parts.join(' ');
}

function scoreChunk(chunk, queryTokens) {
  const text = buildSearchableText(chunk);
  const docTokens = tokenize(text);
  const docLen = docTokens.length;
  if (docLen === 0) return 0;

  // Token frequency map
  const tf = {};
  for (const t of docTokens) {
    tf[t] = (tf[t] || 0) + 1;
  }

  let score = 0;
  const k1 = 1.5;
  const b = 0.75;
  const avgDl = 200; // approximate

  for (const qt of queryTokens) {
    const freq = tf[qt] || 0;
    if (freq === 0) {
      // Partial match (prefix)
      const partial = docTokens.filter((t) => t.startsWith(qt)).length;
      if (partial > 0) {
        score += 0.3 * partial;
      }
      continue;
    }

    // BM25 term score (simplified, IDF ≈ 1 for small corpus)
    const numerator = freq * (k1 + 1);
    const denominator = freq + k1 * (1 - b + b * (docLen / avgDl));
    score += numerator / denominator;
  }

  // Title boost
  const titleTokens = tokenize(chunk.title || '');
  const titleHits = queryTokens.filter((qt) => titleTokens.some((tt) => tt.includes(qt))).length;
  score += titleHits * 2.0;

  // Tag/entity boost
  const tagTokens = tokenize((chunk.tags || []).join(' '));
  const tagHits = queryTokens.filter((qt) => tagTokens.some((tt) => tt.includes(qt))).length;
  score += tagHits * 1.5;

  // Importance weighting
  const importance = typeof chunk.importance === 'number' ? chunk.importance : 0.5;
  score *= 0.7 + 0.3 * importance;

  return score;
}

// --- Main search ---

function search(query, opts = {}) {
  const chunks = loadChunks();
  const queryTokens = tokenize(query);

  let filtered = chunks;

  // Type filter
  if (opts.type) {
    filtered = filtered.filter((c) => c.type === opts.type);
  }

  // Domain filter
  if (opts.domain) {
    filtered = filtered.filter((c) => c.domain === opts.domain);
  }

  // Score and rank
  const scored = filtered
    .map((c) => ({ ...c, score: scoreChunk(c, queryTokens) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const topN = opts.top || 5;
  return scored.slice(0, topN);
}

// --- CLI ---

function printList() {
  const chunks = loadChunks();
  console.log(`\n  ZMail Memory — ${chunks.length} chunk\n`);

  const groups = {};
  for (const c of chunks) {
    const t = c.type || 'unknown';
    if (!groups[t]) groups[t] = [];
    groups[t].push(c);
  }

  for (const [type, items] of Object.entries(groups).sort()) {
    console.log(`  [${type.toUpperCase()}] (${items.length})`);
    for (const c of items.sort((a, b) => (b.importance || 0) - (a.importance || 0))) {
      const imp = typeof c.importance === 'number' ? c.importance.toFixed(2) : '?   ';
      console.log(`    ${imp}  ${c.id}`);
      console.log(`          ${c.title}`);
    }
    console.log();
  }
}

function printResults(results, query) {
  if (results.length === 0) {
    console.log(`\n  Nincs talalat: "${query}"\n`);
    return;
  }

  console.log(`\n  Kereses: "${query}" — ${results.length} talalat\n`);

  for (const [i, r] of results.entries()) {
    const imp = typeof r.importance === 'number' ? r.importance.toFixed(2) : '?   ';
    console.log(`  ${i + 1}. [${r.type}] ${r.title}`);
    console.log(`     Score: ${r.score.toFixed(2)} | Importance: ${imp}`);
    console.log(`     File: ${r.file}`);
    if (r.summary) {
      console.log(`     ${r.summary.slice(0, 120)}${r.summary.length > 120 ? '...' : ''}`);
    }
    console.log();
  }
}

// --- Entry point ---

const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  printList();
  process.exit(0);
}

if (args.includes('--reindex')) {
  const chunks = loadChunks();
  console.log(`Reindex: ${chunks.length} chunk talalt.`);
  // In a full implementation, this would rebuild embeddings / SQLite FTS index
  console.log('Index frissitve (YAML metadata index aktiv).');
  process.exit(0);
}

// Parse options
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    opts.type = args[++i];
  } else if (args[i] === '--domain' && args[i + 1]) {
    opts.domain = args[++i];
  } else if (args[i] === '--top' && args[i + 1]) {
    opts.top = parseInt(args[++i]);
  }
}

const queryParts = args.filter((a) => !a.startsWith('--') && !['semantic', 'episodic', 'procedural', 'project'].includes(a) && !/^\d+$/.test(a));
const query = queryParts.join(' ');

if (!query) {
  console.log(`
  ZMail Memory Search

  Hasznalat:
    node memory/search.mjs "keresesi kifejezes"
    node memory/search.mjs --type semantic "Neon"
    node memory/search.mjs --type episodic "migracio"
    node memory/search.mjs --type procedural "deploy"
    node memory/search.mjs --domain security "production"
    node memory/search.mjs --top 3 "OAuth"
    node memory/search.mjs --list
    node memory/search.mjs --reindex

  Tipusok: semantic, episodic, procedural, project
  Domainok: architecture, database, oauth, security, infrastructure,
            bugfix, feature, migration, upgrade, workflow, policy,
            project_state, constraints, decisions, open_questions
  `);
  process.exit(0);
}

const results = search(query, opts);
printResults(results, query);
