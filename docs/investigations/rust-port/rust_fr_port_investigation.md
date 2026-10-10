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

## Run 12 — 2026-10-09 18:00 (the TS findings, fixed TS-first, branch `fix/fr-port-findings`)

**Question:** can findings 1–3 below be fixed on both sides without regressing a reading? In particular, finding 2
(the pre-pass scans the raw text) is protective today (Run 9). What does moving it change, and in what order
must the change go in?

**Instruments** (all in the gitignored `.probe/fr/`):
- `corpus.mts OUT` reads every fr text: the fr and fr-CA golden text columns, FLEURS fr_fr columns 3+4, and
  probes/fr.txt (4,042 distinct texts). For each it records `phonemizeAsync(fr)`, `phonemize(fr)` and
  `phonemize(fr-CA)`. `diff.mts A B` compares two such runs.
- `letters.mts` reads every word `letterNames` emits four ways: Lexique, supplement, rule g2p, tagger.
- `emitted.mts` is the audit. It collects every word the normalizer can EMIT: the manifest's symbolTier,
  letterNames and numbers blocks, `numberToWords`/`ordinal` for 0–2000, the string literals of normalize.ts, and
  every word of `normalizedFor(t)` over the corpus that is absent from the raw `t`. It keeps the words that
  neither Lexique nor the supplement answers and that pass IN_VOCAB, and compares the g2p with the tagger on each.
- `emit-letter-rows.mts` / `emit-rows.mts` print supplement rows with `toIpa`'s own value, so no IPA is typed.

**Raw findings, in order:**
1. `letters.mts`: Lexique lacks 10 letter-name words (cé effe gé ji emme enne pé ku vé zède). The tagger
   disagrees with the g2p on 3 of them: effe ɛf/**ef**, ji ʒi/**dʒi**, emme ɛm/**ɑ̃m**. The g2p is right on
   all 10.
2. Baseline `corpus.mts` → base.jsonl. After adding the 10 rows to supplement.tsv (with the g2p value):
   **best 0, sync 0, fr-CA 0 changed.** That is expected, because the rows equal what the g2p already said.
3. Pre-pass moved onto `normalizedFor(text)`, with `frenchHasWord` (Lexique ∪ supplement) as the skip test:
   **best 0, sync 0, fr-CA 0 changed** over the 4,042 texts.
4. Counterfactual: the pre-pass moved WITHOUT the supplement rows (nosup.jsonl). **best changed on 18 FLEURS +
   2 probe texts, sync 0, fr-CA 0.** Every one is a letter name, and every one regressed: `ɛʁ ɛm` → `ɛʁ ɑ̃m`
   (×11 emme), `dy ɛf be` → `dy ef be` (×6 effe), `aʃ ʒi ɛʁ` → `aʃ dʒi ɛʁ` (×1 ji), and the two probe rows
   (`ʒi` → `dʒi`, `ˈɛf` → `ˈef`). This is Run 9's 18 texts, so the order of the fix was load-bearing.
5. Audit, first pass: **261 emitted words, 35 miss Lexique+supplement, 16 where g2p ≠ tagger.** Classified:

   | word | source | g2p | tagger | class |
   |---|---|---|---|---|
   | kilooctet, kilooctets | symbolTier (`ko`) | kilɔɔktɛ | kilɔktɛ | **REAL regression**: drops kilo's vowel. `un fichier de 5 ko` read sync `kilɔɔktˈɛ`, async `kilɔktˈɛ` |
   | unióenne | corpus-normalized | ynioɛn | "" (declined) | no change: a declined tag falls to the g2p (and see the defect below) |
   | mlles, mmes | DOT_ONLY keys | mlə / mə | ̃l / mamam | no change from the fix: the dot-stripped word was already in the RAW text, so the old scan offered it too |
   | st | DOTTED_ABBREV key | "" | st | not emitted: `st.` is expanded to saint, and a bare `st` is raw text |
   | av | DOTTED_ABBREV key | a | av | not emitted: the expansion is avenue |
   | cetera | comment in normalize.ts | sətəʁa | setəʁa | not emitted (DOT_ONLY exists so it is never expanded) |
   | also, eight, nineteen, numbers, initialisms, manifest, wayne, ts | comments / identifiers in normalize.ts | | | not emitted: a literal-scrape artifact |

   The 19 agreeing words: cuisinéesse, mélangéesse, prononcéesse (corpus-normalized), vingts, centilitre,
   décilitres, gigaoctet, mégaoctet, mégaoctets, millilitres, after, plus the literal-scrape artifacts (and, core,
   eighty, giu, gu, h, james, ordinals).
6. I stopped and reported the kilooctet regression. The coordinator approved the same remedy as for the letter names:
   `kilooctet` and `kilooctets` went into supplement.tsv with the g2p value (kilɔɔktɛ). Re-audit:
   **261 emitted, 33 miss, 14 differ**, and all 14 are the no-change / not-emitted rows above. 0 real disagreements
   remain. `corpus.mts` → fix2.jsonl: **best 0, sync 0, fr-CA 0 changed.** `5 ko` is `kilɔɔktˈɛ` on both paths.

**Pre-existing defects the audit surfaced (NOT fixed here, outside this change):**
- **The name-initial rule fires after a non-ASCII letter.** `Unión.` → `Unióenne` and `cuisinés.` →
  `cuisinéesse`, on the SYNC path too: the final `n.`/`s.` is read as a name initial (`enne`/`esse`), and the
  sentence break is lost. It looks like an ASCII `\b` boundary between `ó`/`é` and the letter. It is visible in
  FLEURS.
- **`Mlles` reads `̃l` on the best path** (a lone combining tilde from the tagger) and `mlə` on the sync path.
  `Mmes` reads `dø miljɛm` (the Roman-numeral path takes `MM`). Both predate this change.

**Gates (pre-rebase):**
- `npx vitest run`: 6,384 passed, 5 skipped (339 files). An earlier run had 7 `check-goldens-jobs` failures:
  the worktree had no `node_modules/.bin/tsx`, which is environmental, and the tests pass once it is linked.
- `npm run check:goldens`: 189 languages, 36,495 rows, **0 stale**, so no golden is regenerated (fr and fr-CA did not move).
- `npx tsx tools/extract_regexes.mts` re-extracted: 1 row changed, the IN_VOCAB pattern without the hyphen.
  The C# regex-diff gives 145,140 identical, 0 DIFFER.
- `dotnet test csharp` (full): **7,039 passed**. No C# test pinned an old reading.
- fn-diff from the fixed TS: fr-normalize 12,126/0, fr-g2p 139,485/0, fr-tagger 15,006/0. phonemize-sync,
  -best and -trace (LANGS=fr) are each **4,041/4,042**. The one differing row is the ru/el port-pending probe,
  unchanged from Run 11.
- `cargo run --release -p parity`: all ten languages 200/200. fr `--sync`: 157/200 (unchanged).
  `cargo test --workspace`: 67 + 1 passed. `cargo build` (debug and release): 0 warnings. `cargo fmt --check`: clean.

**Each test proved by reverting its fix:**
- Scan back on the raw text: the "normalizer-created word is offered" test goes red in TS, C# and Rust.
- Skip test back to Lexique-only: the 4 "supplement word not offered" cases go red in TS, C# and Rust.
- Supplement rows removed: the same 4 go red in TS.
- `isWord` parameter restored: the arity test goes red in TS and C#. In Rust the compiler enforces the signature.

⚠ The first TS test used `vi.mock` on frenchTagger.ts. It passed alone and failed in the full suite, because
vitest runs `isolate: false` here: another file had already memoized an unwrapped tagger in `taggerP`. Replaced by
an exported seam, `frenchPrepassWith(tagger, text)`, which C# (`PrepassWith`, internal) and Rust (`prepass_with`)
mirror.

**Gates after rebasing onto `origin/main` 944b4940 (#1479, the Italian fixes):** the rebase was clean, and the
re-extracted regex corpus matches the committed one. check:goldens 0 stale. vitest 6,388 passed, 5 skipped (340
files). dotnet test 7,043 passed. regex-diff 145,198 identical, 0 DIFFER. fn-diff unchanged (fr-normalize,
fr-g2p and fr-tagger all 0 DIFFER; phonemize-sync, -best and -trace each 4,041/4,042, the ru/el probe). parity:
all ten languages 200/200, fr `--sync` 157/200. cargo test 68 + 1. 0 warnings, fmt clean.

**Implication:** findings 1–3 are fixed on all three engines with no reading moved on any instrument. What the
fix buys is coverage: a normalizer-created OOV word now gets the tagger reading. On today's data every such word
either agrees with the g2p or is a supplement row, so the gain is latent until the normalizer emits a new word.
The audit is the check to re-run when it does.

## Findings in the TS (reported, not fixed in Rust)

**Status: 1–3 are FIXED TS-first, with C# and Rust following (Run 12).**

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
