# ZMail Memory — retegezett tudas-architektura

## Mi ez?

Emberileg olvasható, YAML+Markdown alapu, retegezett tudas-architektura a ZMail
projekt teljes ismeretanyagaval. Nem egy nagy prompt dump, hanem strukturalt,
keresheto, karbantarthato memoria, amely a "Lost in the Middle" problemat
architekturalis szinten oldja meg.

## Alapelvek

1. **Forrasreteg = ember altal is olvasható fajlok** (Markdown + YAML frontmatter)
2. **Memoriatipusok szet vannak valasztva** (episodic, semantic, procedural, project)
3. **Hierarchikus szervezes** (L0 raw evidence → L1 atomic memory → L2 synthesis)
4. **A kontextusablakba csak bizonyitek-alapu kivonat menjen** (nem egesz fajlok)

## Konyvtarszerkezet

```
memory/
  episodic/                 # Mi tortent, mikor, milyen kontextusban
    2026/
      2026-02-16/           # CORS hiba javitas
      2026-02-27/           # 2026 Redesign + modernizacio
      2026-03-11/           # Neon PostgreSQL migracio
  semantic/                 # Stabil tenyek, konfiguracio, architektura
    architecture/           # Stack, deployment, features
    database/               # Neon PostgreSQL
    oauth/                  # Google OAuth 2.0
    security/               # Production hardening, CORS
    infrastructure/         # Env vars, CI/CD
    dependencies/           # (bovitheto)
  procedural/               # Hogyan kell csinalni, szabalyok
    workflows/              # Deploy checklist, secrets, Docker
    policies/               # Kritikus szabalyok (CLAUDE.md)
  projects/                 # Aktiv celok, dontesek, nyitott kerdesek
    zmail/
      state.md              # Aktualis projekt allapot
      constraints.md        # Aktiv tiltasok es korlatozasok
      decisions/            # Architekturalis dontesek
      open_questions.md     # Nyitott kerdesek, roadmap
  indexes/
    index.yml               # Master katalogus (osszes chunk metadata)
  wiki/                     # Osszefoglalo oldalak (bovitheto)
    topics/
    entities/
  search.mjs                # Hibrid kereso utility
  README.md                 # Ez a fajl
```

## Keresesi strategia

### Query-time folyamat (AI agent szamara)

1. **Query parse** — a kerdesbol intent + ido + entitas + feladattipus kivonasa
2. **Corpus valasztas** — melyik memoriatipus a releváns:
   - "Ki/mikor/mi tortent?" → `episodic` + temporal boost
   - "Mit tudunk errol?" → `semantic` + wiki
   - "Hogyan kell csinalni?" → `procedural`
   - "Min dolgozunk most?" → `projects` + open_questions
3. **Metadata filter** — type, domain, tags, entities alapjan szukites
4. **Keyword search** — BM25-szeru relevancia scoring
5. **Rerank** — importance score sullyozas
6. **Evidence pack build** — top talalatok, bounded context

### CLI kereso

```bash
# Szabad kereses
node memory/search.mjs "deploy checklist"

# Tipusszures
node memory/search.mjs --type semantic "Neon database"
node memory/search.mjs --type episodic "CORS"
node memory/search.mjs --type procedural "push"

# Domain szures
node memory/search.mjs --domain security "production"

# Top-N
node memory/search.mjs --top 3 "OAuth"

# Osszes chunk listazasa
node memory/search.mjs --list

# Index ujraepites
node memory/search.mjs --reindex
```

## YAML frontmatter sema

Minden memoria fajl YAML frontmatter-rel kezdodik:

```yaml
---
id: sem_arch_stack_001 # Egyedi azonosito (tipus_domain_nev_szam)
type: semantic # semantic | episodic | procedural | project
domain: architecture # Terulet (architecture, database, security, ...)
title: 'Rovid cim'
summary: '1-2 mondatos osszefoglalas'
entities: [React, Express] # Emlitett entitasok
tags: [stack, architecture] # Cimkek
importance: 0.98 # 0.0 - 1.0
confidence: 0.99 # 0.0 - 1.0
status: active # active | archived | superseded
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent # persistent | current | event | session
valid_from: 2026-02-27
valid_to: # Ures = ervenyes
source_refs: # Forras fajlok
  - file:CLAUDE.md
supersedes: # Mit valtott fel
conflicts_with: # Mivel utközik
retrieval_hints:
  lexical: [kulcsszavak] # Pontos talalatok
  semantic: [fogalmak] # Szemantikus talalatok
---
```

## Karbantartas

### Uj memoria hozzaadasa

1. Valaszd a megfelelo tipust (semantic/episodic/procedural/project)
2. Hozd letre a fajlt a megfelelo konyvtarban
3. Toltsd ki a YAML frontmatter-t (id, type, domain, title, summary, ...)
4. Ird meg a Markdown tartalmat
5. Frissitsd az `indexes/index.yml`-t (uj chunk bejegyzes)

### Elavult memoria kezelese

- **NE torold** — allitsd `status: archived`-ra
- **Feluliras:** az uj memoria `supersedes` mezojebe ird be a regi id-t
- **Utkozes:** `conflicts_with` mezoben jelold az utkozo memoria id-t

### Periodikus karbantartas

- Hetente: elavult elemek `archived` statusra allitasa
- Havonta: project state es open_questions frissitese
- Migracio utan: uj episodic memoria + releváns semantic frissites

## Lost in the Middle vedelem

Ez a rendszer architekturalis szinten vedi ki a problemat:

1. **Nem tolti be a teljes memoriat** — csak top releváns chunkokat
2. **Rovid, tagolt working context** — minden chunk max ~200 sor
3. **Relevancia a prompt elejere** — legfontosabb talalat elol
4. **Constraint-ek kulon** — proc_rules_critical a vegren (rendszerblokk)
5. **Ketfazisu retrieval** — elobb recall (tagabb), utana precision (rerank)
6. **Importance sullyozas** — a kritikusabb tudasok elol kerulnek

## Forrasok

Ez a memoriarendszer a kovetkezo kutatasok es rendszerek alapjan keszult:

- "Lost in the Middle" (Liu et al.) — kontextusablak pozicionalis torzitas
- Mem0 — dinamikus kivonás + konszolidálás + retrieval
- HiMem — hierarchikus epizód- és jegyzetmemória
- LongMemEval — tartós memória benchmark (5 keszség)
- QMD — lokális hibrid kereső (BM25 + vector + reranking)
- Knowledge Objects — diszkrét, hash-címzett tényobjektumok
