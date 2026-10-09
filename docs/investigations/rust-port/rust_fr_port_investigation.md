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
| core/normalizeSymbols `makeSymbolNormalizer` | **not ported** — owned by the es branch (coordinator's call): stubbed as the identity until Run 7, then cherry-picked (`9aceb875` → `6066cd35`) and wired |

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

## Run 5 — 2026-10-09 15:58

**Question:** "every failure I read" in Run 4 covers 15 of 107 rows. Are all 107 caused by the stub?

**Command:** `.probe/fr/untouched.mts` rebuilds French's `SYMBOLS` in TS from `MANIFEST.symbolTier` and keeps
only the dump rows where the tier is the identity on the string it receives. Then I replayed that subset.

**Raw finding:** kept 3,925 rows, and 117 are tier-touched. On the kept rows: phonemize-sync 3,924 / 3,925 and
phonemize-best 3,924 / 3,925. The one differing row is my probe `Il a dit Владимир et Αθήνα et 東京 en passant.`:
the TS reads all three runs, and Rust drops them. That row is **port-pending** on ru, el and cmn, which the
script reader routes to and which are not ported.

**Implication:** the stub is the only engine-side cause. (Tier-touched is 117 while 107 differ, because some
tier rewrites land on the same reading.)

## Run 6 — 2026-10-09 16:00

**Question:** do the trace tokens (span, inputSpan, surface, emitted, source, ipaSpan) match?

**Command:** a new generic `phonemize-trace` dump (fn-diff, for any `LANGS`) and its replay, over fr and, as
a control, en.

**Raw finding:** before the tier was wired, fr gave 3,924 / 4,042 (the 118 failures were the tier rows,
whose `inputSpan` moves with the tier's rewrite). en gave 4,145 / 4,146. Its one failing row is the Greek
probe `α²β and λόγος…`: the Greek runs are dropped because el is port-pending, not a trace defect.

## Run 7 — 2026-10-09 16:01

**Question:** with the es branch's symbol tier cherry-picked (`9aceb875` → `6066cd35` here) and wired from
`MANIFEST.symbolTier` with exactly the nine fields french.ts passes, does the port close?

**Commands:** `cargo run --release -p parity -- fr`, `-- --sync fr`, the replays of every dump, and
`cargo run --release -p parity` (en, en-GB as a control).

**Raw finding:**
- parity fr (best, tagger on): **200/200 identical**.
- parity fr `--sync` (tagger off): **157/200**. The tagger is load-bearing on 43 golden rows.
- phonemize-best **4,041 / 4,042**, phonemize-sync **4,041 / 4,042**, phonemize-trace **4,041 / 4,042**. Each
  failure is the port-pending ru/el/cmn probe row.
- In the TS itself, best differs from sync on 947 of the 4,042 texts.
- Unchanged on re-run: fr-normalize 12,126/0, fr-g2p 139,485/0, fr-numbers 20,084/0, fr-ordinals 20,116/0,
  fr-tagger 15,006/0.
- en 200/200 and en-GB 200/200.

**Implication:** done against the gate. `cargo test --workspace` passes 45 + 1, and `cargo build` gives 0 warnings.

## Run 8 — 2026-10-09 16:02

**Question (per-arm coverage):** which normalize arms does the haystack actually reach?

**Command:** `npx tsx .probe/fr/coverage.mts`. It counts, per source, the texts on whose pre-passed form each
arm's pattern matches (copies of the patterns, with order effects not modelled), and the texts each whole
stage actually changes (the real functions).

**Raw finding** (golden / fleurs / probe, out of 4,042 distinct texts):

| arm | golden | fleurs | probe |
|---|---|---|---|
| 0 digit-group | 4 | 34 | 2 |
| 0 nbsp→space | 0 | 478 | 1 |
| 1 era av. J.-C. | 0 | 10 | 1 |
| 1 era apr. J.-C. | 0 | 0 | 1 |
| 1b spaced degree | 0 | 6 | 1 |
| 2 numéro | 0 | 2 | 2 |
| 3 abbrev + word | 0 | 35 | 6 |
| 3 abbrev phrase-final | 1 | 7 | 3 |
| 3b undotted Dr/Pr | 0 | 10 | 2 |
| 4 name initial | 2 | 54 | 3 |
| 4b money n,cc€ | 0 | 0 | 1 |
| 4b money €n,cc | 0 | 0 | 1 |
| 4c ± | 0 | 0 | 1 |
| 4c x+n | 0 | 2 | 1 |
| 4c +n | 0 | 0 | 2 |
| 5 negative | 0 | 0 | 1 |
| 5b = < > ÷ | 0 | 0 | 1 each |
| 6 fraction | 0 | 2 | 2 |
| 7 time `h` | 1 | 30 | 2 |
| 7 time colon | 0 | 0 | 1 |
| 8 numeric date | 0 | 0 | 3 |
| 8 `1 <month>` | 0 | 0 | 1 |
| stage: normalizeFrench changed | 6 | 581 | 23 |
| stage: ordinal romans changed | 0 | 50 | 2 |
| stage: ordinal digits changed | 0 | 26 | 2 |
| stage: bare romans changed | 0 | 6 | 1 |
| stage: initialisms changed | 3 | 71 | 2 |

**Implication:** every arm is reached by at least one input. Eleven arms (apr. J.-C., both money orders, ±,
+n, negatives, the four relational/division signs, the colon time, the numeric date, `1 <month>`) are reached
ONLY by the synthetic probes. For those, `fr.txt` carries the weight, and fr-normalize is 171/171 on the probe
rows. The probe lines also carry the declining neighbours: a non-3-digit block, a race time `4:41.20`, month 13
and day 32, `3d`, the `ville`/`siècle` homographs and the Cie/cive/clive stoplist, a hyphen range and a score.

## Run 9 — 2026-10-09 16:03

**Question (reading for correctness):** frenchNeural runs its pre-pass over the PRE-PASSED raw text, and
`french.ts` normalizes again inside `render`. English had this defect (#1452). Does French lose readings to it?

**Commands:** `npx tsx .probe/fr/prepass-gap.mts` wraps the oov resolver, records every word the engine asks
for and does not get, and asks the tagger for each one. Then `npx tsx .probe/fr/letters.mts` reads every
letter name three ways.

**Raw finding:** over 3,985 golden+FLEURS texts, 18 contain such a word, and all of them are letter names the
initialism pass emits: `emme`×11, `effe`×6, `ji`×1. All three are absent from Lexique. Their readings by
source:

| word | rule g2p | tagger |
|---|---|---|
| emme | ɛm | ɑ̃m |
| effe | ɛf | ef |
| ji | ʒi | dʒi |

**Implication:** the same shape as #1452 is present in the French TS, but here the gap is PROTECTIVE: the rule
g2p is right and the tagger is wrong on all three. Moving the pre-pass onto the normalized text the way #1452
did for English would REGRESS these readings unless the letter names are added to `supplement.tsv` first.
Reported, not changed (the Rust reproduces the TS).

## Run 10 — 2026-10-09 17:35 (review round)

**Question:** after the review fixes and a rebase onto `origin/main` c64801a5 (#1467 ja + the symbol tier,
#1468 cross-cutting fixes), does every gate still hold?

**What changed:**
- **Rebase.** My cherry-pick of the symbol commit was dropped (`git rebase --skip`), because main carries its
  reviewed version. In the shared lists I kept both sides: LANGUAGES is now `en, en-GB, ja, fr`, and the
  `build` arms are ja then fr, each with its own `.map_err` line, which git had factored out of the hunk. For
  dump.mts I put ja's `trace` closing `},` back before the fr entries, and I re-inserted my distinct
  `phonemize-trace` dump and its replay arm by hand.
- **Loading.** `try_manifest` and the shipped tagger now go through `core::data_source::load_once`, so only
  a successful load is cached.
- **No panic on missing data.** `to_ipa`, `normalize_french`, `normalize_french_initialisms`,
  `is_unreadable_french`, `number_to_words`, `ordinal` and the two ordinal normalizers are now public
  `Result` wrappers that check `try_manifest` first. The engine calls the `pub(crate)` `*_loaded` forms, which
  run only after `create_french` has checked the manifest.
- **Core helpers instead of private copies.** `js_number_to_string` replaced my Number.toString port, and
  `ABBREV_ALT` is built with `sorted_by_length_desc` + `alternation`.
- **Tagger surface.** `french_tagger_unavailable_reason` is exported from the registry and from `lib`.
- **Shared tagger code.** `core::structural_tagger::{TaggerTables, load_tagger}` now holds the meta
  validation (charTags bounds, logits length) and the file and graph load. Both `EnglishTagger` and
  `WordStructuralTagger` use them. TaggerTables re-keys the meta once (code point → id, a Vec of permitted
  ids indexed by id, a Vec of tag chunks), so `tag()` no longer formats an id string per position.
  ⚠ The re-keyed lookup accepts only the CANONICAL decimal key (`String(n)`), which is what a JS property
  lookup hits. English's old `parse()` would also have taken `"01"`. The shipped metas have no such key.
- **Heteronyms.** The heteronym entry is looked up before any neighbour string is built.
- **Dead parameter.** `_is_word` is kept and commented as unused, pending the TS fix.

**Commands:** every fr dump regenerated from the rebased dump.mts and replayed; `parity -- fr ja en en-GB`;
`parity -- --sync fr`; `LANGS=en,en-GB,ja phonemize-best` as a control for the English tagger refactor;
`cargo test --workspace`; `cargo build`.

**Raw finding:**
- parity: fr 200/200, ja 200/200, en 200/200, en-GB 200/200. fr `--sync`: 157/200.
- fn-diff: fr-normalize 12,126/0, fr-g2p 139,485/0, fr-numbers 20,084/0, fr-ordinals 20,116/0,
  fr-tagger 15,006/0.
- phonemize-sync, -best and -trace are each 4,041/4,042. The failing row is the ru/el/cmn port-pending probe.
- en+en-GB+ja best: 11,975/11,977. The 2 failing rows are the Greek probe `α²β and λόγος…` in en and en-GB,
  port-pending on el, as before this change.
- `cargo test --workspace`: 49 + 1 passed. `cargo build`: 0 warnings.

**Implication:** the review changes are behaviour-neutral on every instrument.

## Run 11 — 2026-10-09 17:51 (final rebase, French merges last)

**Question:** rebased once onto `origin/main` 5dd93a1c (ja, it, es, pt, pt-BR, hi and cmn merged), are the
shared lists whole and do all ten languages still pass?

**Resolution:**
- LANGUAGES is `en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr`.
- The `build` arms are whole. Git had factored the shared `.map_err(PhonemizeError::Data),` out of the cmn/fr
  hunk, so I put it back on the cmn arm.
- `languages/mod.rs` keeps both sides.
- In dump.mts I restored the closing `},` of `cmn-trace-extras` before the fr entries, and re-inserted
  `phonemize-trace` by hand (the replay arm auto-merged).
- `PhonemizeError::Input` comes from main and needed nothing from French.
- `TaggerTables` applied as-is. No merged language added a tagger.
- `src/`, `data/` and `csharp/goldens` are unchanged between c64801a5 and 5dd93a1c, so I replayed the previous
  round's dumps.

**Raw finding:**
- parity: every one of en, en-GB, ja, it, es, pt, pt-BR, hi, cmn and fr is 200/200. fr `--sync`: 157/200.
- fn-diff: fr-normalize 12,126/0, fr-g2p 139,485/0, fr-numbers 20,084/0, fr-ordinals 20,116/0, fr-tagger 15,006/0.
- phonemize-sync, -best and -trace are each 4,041/4,042. The probe row now reads `東京` through the merged cmn
  engine (`tʊŋ˥˥ t͡ɕiŋ˥˥`, as in the TS), so it is port-pending on **ru and el** only.
- English best-path control (en, en-GB, ja): 11,975/11,977. Both failing rows are the Greek probe, port-pending
  on el.
- `cargo test --workspace`: 65 + 1 passed. `cargo build`: 0 warnings. `cargo fmt --check` was left alone, since
  it already fails on main.

## Findings in the TS (reported, not fixed in Rust)

1. **`normalizeFrench(input, isWord)` never reads `isWord`.** Its docstring says the parameter "decides
   whether an all-caps run is an acronym to be read as a word or an initialism to be spelled out", but that
   decision moved to `normalizeFrenchInitialisms` (which takes its own `isRecorded`). The parameter is dead and
   the docstring is stale. Behaviour is unaffected.
2. **The neural pre-pass scans the raw text, not the normalized one** (Run 9). The best path never tags words
   that normalization creates. Today the effect is protective (letter names), but it means the tagger's remit
   differs from the one frenchNeural.ts's docstring describes ("the OOV words").
3. **`IN_VOCAB` admits `-` but `WORD` cannot match one**, so the hyphen in the vocabulary test is unreachable.
   A hyphenated OOV compound reaches the tagger only part by part, through `phonemizeWord`'s per-part
   recursion, and that recursion consults the override with each part. Harmless.
4. No reachable `Object.prototype` lookup (Run 1).

## Port-pending

- The synthetic probe `Il a dit Владимир et Αθήνα et 東京 en passant.` needs **ru and el** (the script
  reader's targets for Cyrillic and Greek under host fr). cmn, the target for Han, has merged (Run 11). It is the only failing row in all three
  end-to-end differentials. No golden row and no FLEURS row is port-pending.
