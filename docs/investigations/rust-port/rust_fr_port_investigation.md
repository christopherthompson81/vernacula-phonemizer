# Rust port — French (`fr`) investigation log

Porting `src/languages/french/` (french, g2p, manifest, normalize, numbers, ordinals, frenchTagger,
frenchNeural) to `rust/vernacula-phonemizer/src/languages/french/`, with the neural best path (#1463).
Branch `rust-lang-fr`, based on #1466 (rebased onto `origin/main` 78174e0a once it merged).

Import closure, checked against what the Rust core already had:

| TS import | Rust |
|---|---|
| core/foreign `readForeignRun`, `withHost` | ported (`core::foreign`) |
| core/clauses `FOREIGN_RUN` | ported (`core::clauses::foreign_run`) |
| core/trace `enterEngine`/`noteToken`/`noteAssembled` | ported |
| core/roman `normalizeRomans`, `romanToInt` | ported |
| core/loadTsv `loadTsvMap` | ported |
| core/initialisms `makeInitialismNormalizer`, `makeUnreadableTest` | ported |
| core/numbers `digitIndex` | ported |
| core/latinPhones `latinPhone` | ported |
| core/provenance `rewrite` | ported |
| core/structuralTagger `createWordStructuralTagger`, `wordLevelNeuralPrepass` | **not ported** — added to `core/structural_tagger.rs` (French is the only Kokoro language that uses them) |
| core/normalizeSymbols `makeSymbolNormalizer` | **not ported** — owned by the es branch (coordinator's call); stubbed as the identity behind a `TODO(fr, symbol tier)` until it is cherry-picked |

## Run 1 — 2026-10-09 15:20

**Question:** is any `Object.prototype` lookup with a text key reachable in the French TS?

**Command:** `npx tsx .probe/fr/ctor.mts` — `phonemize`/`phonemizeAsync` on `le constructor`,
`constructor avant`, `un Constructor arrive`, `toString`, `hasOwnProperty`.

**Raw finding:** no throw and no `function Object()` text in any output (`constructor avant` →
`kɔ̃stʁyktɔʁ avˈɑ̃`). Reading why: every text-keyed table `french.ts` indexes (`HETERONYMS[word]`,
`LIAISON[prev]`, `CLAUSE_MARK[m[3]]`, `letterNames[l]`) is a MANIFEST object, and `parseJsonc` strips the
prototype at the parse boundary. The TS object literals (`DOTTED_ABBREV`, `UNDOTTED_ABBREV`,
`CURRENCY_WORDS`, `DENOMINATOR`, `LATENT`) are indexed only by a capture from an alternation of their own
keys, by a digit, or by a liaison consonant. The `ſt.` long-s case (#1122) is the one reachable miss, and the
TS already handles it (`w0 === undefined ? _m : …`). The tagger meta is `JSON.parse`d with a prototype, but it
is indexed by single code points and decimal ids only.

**Implication:** nothing to reproduce. The Rust tables are plain lookups.

## Run 2 — 2026-10-09 15:45

**Question:** do the four leaf modules match the TS function for function?

**Commands:** `npx tsx rust/tools/fn-diff/dump.mts fr-normalize|fr-g2p|fr-numbers|fr-ordinals >
.probe/fr/<name>.jsonl`, then `cargo run --release -p fn-diff -- <name> ../.probe/fr/<name>.jsonl`.
Inputs: the fr golden, FLEURS fr_fr columns 3 and 4, and `rust/tools/fn-diff/probes/fr.txt`.
`fr-normalize` replays each stage of the chain separately: `normalizeFrench`, the numeral passes, and the
initialism pass.

**Raw finding:**
- fr-normalize: 12,126 identical, 0 differ (golden 297, fleurs 11,658, probe 171).
- fr-g2p: 139,485 identical, 0 differ. Inputs: every Lexique key, every word of the texts, glued pairs,
  `+ent`, upper-cased forms, `ill-` prefixes, and corner words (empty, lone surrogate, `Málaga`, `ﬁn`, `İle`).
- fr-ordinals: 20,116 identical, 0 differ.
- fr-numbers: **20,076 identical, 8 differ** on the first replay. All 8 are rawless values that are not safe
  integers (`1e21`, `1.23456789e23`): the TS prints `String(n)` (`un e + deux un`), and my fallback printed the
  integer expansion.

**Implication:** the digit fallback needs ECMAScript Number::toString. The engine never reaches it (the
tokenizer always passes `raw`, and the only rawless caller, `ordinal`, refuses unsafe integers), but it is
cheap to make exact. After adding the toString layout: **fr-numbers 20,084 identical, 0 differ.**

## Run 3 — 2026-10-09 15:50

**Question:** does the pure-Rust runtime reproduce the French tagger word for word?

**Command:** `npx tsx rust/tools/fn-diff/dump.mts fr-tagger`, then the replay. Inputs: every distinct
lowercased WORD-regex match in the texts plus every 25th Lexique key.

**Raw finding:** fr-tagger: **15,006 identical, 0 differ** (about 21 s).

**Implication:** the tagger is exact on this machine. Any best-path difference has to be in the pre-pass
or the engine.

## Run 4 — 2026-10-09 15:55

**Question:** end to end, before the symbol tier is in, how far off are we, and is the difference only the
tier?

**Commands:** `LANGS=fr npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` and `phonemize-best`, replayed
with `cargo run --release -p fn-diff`; then `cargo run --release -p parity -- fr` and `-- --sync fr`.

**Raw finding:**
- phonemize-sync 3,935 / 4,042 identical, 107 differ; phonemize-best the same, 3,935 / 4,042 with 107 differing.
- parity (best) **193/200**. The 7 failing rows are 3 distinct texts (the golden repeats rows), all of them
  symbol-tier input: `20 km`, `80 %`, `3,50 m`.
- parity `--sync` (tagger off) **150/200**.
- Every differential failure I read is a `%`, unit or `°F` row where the stub leaves the symbol unread.
  `°F` comes out as `ˈɛf`: the stub leaves the bare letter, and the initialism pass then spells it.

**Implication:** the engine, tokenizer, liaison, trace and neural pre-pass are consistent with the TS.
What remains is the symbol tier. Waiting for the es branch's `makeSymbolNormalizer` to cherry-pick.
