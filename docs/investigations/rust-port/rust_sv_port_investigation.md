# Rust port: Swedish (`sv`)

Branch `worktree-agent-ad20164d70410b7d3`, from main 10f1f021. Part of #1463. The method is the earlier ports'
(rust_de_port_investigation.md): per-module `fn-diff` differentials, then the public entry end to end, then the
golden gate.

## Run 1 — 2026-10-10 21:05 (the import closure, and where the corpus is)

**Question.** What does `src/languages/swedish/` need that the Rust core does not have, does sv have a neural
entry or a Roman policy, and are the FLEURS transcripts reachable?

**Command.** Read swedish.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts and their imports; compared each
against `rust/vernacula-phonemizer/src/core/`; `grep -n sv src/neuralRegistry.ts src/registry.ts`;
`ls /mnt/data/omnivoice_ipa`.

**Raw finding.** Every core import is already ported: `normalizeSymbols` (makeSymbolNormalizer, incl.
`rateDenominators`/`unitPer`), `hostWord` (makeNativiser; `LATIN_RUN` is imported by swedish.ts but unused — the
TOKEN builds its own `SV_WORD`), `clauses`, `loadTsv` (with `fold`), `loadManifest`, `numbers` (digitIndex),
`latinPhones`, `initialisms` (makeInitialismNormalizer, makeUnreadableTest), `provenance` (rewrite). sv does NOT
import `germanicMorphology`. No `sv` in neuralRegistry.ts; no `ROMAN_POLICIES` entry (registry.ts only has the
`case "sv": return createSwedish()` arm), so the default `roman_policy` arm covers it.

`/mnt/data/omnivoice_ipa` no longer exists on this machine: the corpus now lives on
an external drive (`<mount>/omnivoice_ipa/`) (FLEURS `sv_se/{train,dev,test}.tsv` present there). dump.mts hard-codes
the old `FLEURS_ROOT`.

Checked a JS-object hazard while reading: `EXCEPTIONS[w]` is indexed by an arbitrary lowercased word, so
`constructor` would hit `Object.prototype` on a plain object. `phonemize("constructor", "sv")` reads
`kˈɔ̀nstrɵktɔr` — the loaded manifest does not expose the prototype, so a plain Rust map lookup is faithful.

**Implication.** No new core module. Port manifest → numbers → g2p → normalize → swedish, one file each. Give
dump.mts a `FLEURS_ROOT` env override (default unchanged) rather than editing the filesystem outside the worktree.

## Run 2 — 2026-10-10 21:20 (the golden gate, first look)

**Command.** `cd rust && cargo run --release -p parity -- sv`, after porting
`languages/swedish/{manifest,numbers,g2p,normalize,swedish}.rs`, one arm in `build`, `sv` appended to `LANGUAGES`
(no `roman_policy` arm). The symbol tier's argument is the TS object literal from swedish.ts, evaluated and printed
with `JSON.stringify` (`.probe/sv/symbols-json.mts`), embedded verbatim and deserialized into `SymbolData`.

**Raw finding.** `sv: 200/200 identical, 0 differ` on the first build.

**Implication.** The golden has 132 distinct texts; it says little about the compound-prosody branch, the
`-tal` / clock / ordinal-colon arms or the OOV accent rule. The per-module differentials carry the weight.

## Run 3 — 2026-10-10 21:35 (per-module differentials, then end to end)

**Commands.** `FLEURS_ROOT=<external drive>/omnivoice_ipa/corpus/fleurs_transcripts/data npx tsx
rust/tools/fn-diff/dump.mts <name> > .probe/sv/<name>.jsonl`, each replayed with `cd rust && cargo run --release -p
fn-diff -- <name> ../.probe/sv/<name>.jsonl`. Inputs: the sv golden (132 texts), FLEURS sv_se columns 3 and 4
(3,596 texts; checked the first FLEURS row is a 16-word sentence, not a WAV filename) and the new synthetic
`probes/sv.txt` (85 lines: one or more per normalize.ts arm with the neighbour it must decline, plus g2p,
accent, compound, apostrophe and decomposed-vowel corners).
- `sv-normalize`: per text, `normalizeSwedish`, `normalizeSwedishInitialisms` on its output AND on the raw text,
  and the symbol tier on the initialism output — the TS tier rebuilt from swedish.ts's own literal (evaluated
  from source) against the Rust one built from the embedded JSON, so this also proves the generated data;
  `isUnreadableSwedish` over every letter run (as written and lowercased); `ordinal` and `hundredsYear` over
  −2…2100 and the float/NaN/∞/-0/2⁵³ corners.
- `sv-g2p`: `phonemizeWord` and `nat` over every lexicon key (42,052 rows plus the #1068 nativised aliases), every
  letter run of the texts (as written, lowercased, nativised), every 1–3 letter string over `a–z åäöéü ' ’`,
  every 4-letter string over `aeioyäöskgctjrnldh`, and 21 edge strings (empty, lone surrogate, `ſkepp`, `İsa`,
  decomposed ö, `ﬁsk`, `succé`, …); the parsed entry of every lexicon key; `toSegments` over every 97th word ×
  8 stress ordinals (0,1,2,3,7,−1,1.5,NaN) × oLong × 7 compounds (none, secOrd 0/1/1.5/2/3, empty / partial /
  fractional longOrds, secVowelInitial true/false/absent).
- `sv-numbers`: 0…20,000, k·10³(+1,+21), k·10⁶(+1001,+999999,+21000) for k < 1000, powers of ten to 10²¹, the
  float/NaN/∞ corners, 8 raw strings (20 digits, leading zeros, empty, `1a2`, fullwidth).
- end to end: `LANGS=sv` `phonemize-sync`, `phonemize-best` and `trace`; `SYMBOLS_LANGS=sv symbols`.

**Raw finding.** First build, every one:
```
sv-normalize: 31828 identical, 0 DIFFER  (golden 528 / fleurs 14384 / probe 340 / words 12350 / numeric 4226)
sv-g2p: 630994 identical, 0 DIFFER
sv-numbers: 27065 identical, 0 DIFFER
phonemize-sync: 3813 identical, 0 DIFFER
phonemize-best: 3813 identical, 0 DIFFER
trace: 3813 identical, 0 DIFFER
symbols: 6799 identical, 0 DIFFER  (probe 3072 / swedish 3727)
```

**JS semantics reproduced on purpose** (each a place a "cleanup" would diverge):
- the g2p walks UTF-16 code UNITS (`w[i]`), and `three = w.slice(i, i+3)` may be TWO units at the word end, so
  the three-letter digraph lookup claims a final `sj`/`ng`/`ck` before the softening, retroflex and two-letter
  arms see it (one segment, `i` overshoots by one);
- the two-letter digraph arm pushes one segment per CODE POINT (`for (const ch of DIG[two])`), the three-letter
  arm one segment for the whole value;
- stress / secondary ordinals and the `L` set are JS numbers (`Number(…)`, `L0,,1` → 0,0,1), compared with `===`;
- the accent-2 grave goes after the first code UNIT of the vowel, and the word is NFC'd after;
- `numberToWords`' digit fallback maps `[...raw]` code points, `digitIndex` on the first unit.

**Implication.** The modules match on every source. Next: measure which arms the sources actually reach, and
prove the differential can see a defect at all.

## Run 4 — 2026-10-10 21:50 (can the differential see a defect? reverting what it claims to guard)

**Question.** Four JS semantics and guards were ported on purpose. Does the harness fail when each is broken?

**Command.** One mutation at a time in the Rust, rebuilt, replayed with the Run 3 dumps; then reverted.

**Raw finding.**
- three-letter digraph lookup only when `three.len() == 3` (i.e. not reproducing the 2-unit word-end slice):
  `sv-g2p: 630322 identical, 672 DIFFER` — ALL in the `segs` op (e.g. `ingick` ts `kː/0`, rust `k/0 ː/0`);
  `phonemize-sync: 3813 identical, 0 DIFFER`. The JS semantic is real but INVISIBLE in the IPA: the only
  final 2-letter keys (`sj tj kj ng gn ck qu`) split into the same string, and the `g` rule's `[rlɭ]$` prev test
  never sees them. Only a per-segment op can witness it, which is why `segs` is in the dump.
- the accent-2 grave suppressed: `sv-g2p: 543132 identical, 87862 DIFFER` (e.g. `adam` ts `ˈɑ̀ːdam`).
- the compound guard `secOrd < nucleiProbe` removed: `sv-g2p: 630994 identical, 0 DIFFER`. The guard is
  UNREACHED by the shipped data — no `accent-stress.tsv` row (or alias) carries a secondary ordinal at or beyond
  its word's nucleus count. A defensive guard, not a defect; kept as the TS has it.
- the TERMINAL abbreviation's "followed by a capital" test removed: `sv-normalize: 31827 identical, 1 DIFFER`,
  the one row a PROBE (`… 323 f.Kr. Sedan …`); golden and FLEURS 0 — matching the TS header's measurement that
  FLEURS has 0 terminal abbreviations before a mid-sentence capital.
- `cargo test swedish` with GRAVE = U+0301: fails on `skjorta` (`ɧˈúːʈa`), so the extracted TS pins bite.

**Per-arm reach** (`npx tsx .probe/sv/cov/run.mts`: a resolve hook swaps provenance.ts for a counting wrapper
under swedish/normalize.ts only; texts matched/changed per pattern, golden / FLEURS / probe):

| arm | golden | fleurs | probe |
|---|---|---|---|
| 1 space-grouped thousands | 5/5 | 61/61 | 6/6 |
| 2 English comma grouping | 0 | 6/6 | 2/2 |
| 3 sports time | 0 | 2/2 | 2/2 |
| 4 period clock range / single | 0, 2/2 | 2/2, 18/18 | 1/1, 3/1 |
| 5 colon clock | 0 | 7/7 | 2/1 |
| 6 score | 0 | 4/4 | 3/3 |
| 7 abbreviations (13 patterns) | `Jr.` 1/1, rest 0 | every one ≥ 1 | every one ≥ 1 |
| 8 ordinal colon | 0 | 10/10 | 4/3 |
| 9 `-tal` range / single | 0, 0 | 2/2, 68/68 | 1/1, 3/3 |
| 10 ranges | 1/1 | 21/21 | 3/3 |
| 11 bare year 1100–1999 | 6/6 | 123/123 | 5/5 |
| 12 ℃ ℉ / °F | 0 | 0 | 1/1, 2/2 |
| 12 °C / °V / ° | 0 | 2, 1, 1 | 2, 1, 1 |
| 13 `x` multiply | 0 | 2/2 | 1/1 |
| 14 signs (prefix / glued / spaced) | 0 | 2, 2, 0 | 3, 1, 1 |
| 15 nine relational signs | 0 | 0 | 1/1 each |
| 16 ampersand | 0 | 4/4 | 1/1 |
| colon inflection | 2/2 | 30/30 | 2/2 |

g2p reach in word tokens (golden / FLEURS / probe): lexicon compound (`s<N>`) 213 / 5659 / 9; non-initial stress
310 / 8080 / 55; OOV 516 / 14145 / 54; `oLong` 17 / 285 / 4; secondary vowel-initial (`vi`) 12 / 217 / 0;
`-tion/-sion` 33 / 731 / 4; `cc` 2 / 32 / 4; nativised 1 / 45 / 2; medial apostrophe 0 / 14 / 3. Beyond
these, `sv-g2p` runs every one of the 42,052 lexicon keys and the synthetic compounds through the g2p.

**Implication.** Every normalize.ts arm is reached by at least one probe; `℃ ℉ °F`, the spaced `+` and the nine
relational signs ONLY by the probes; the golden reaches 7 of the 46 patterns. The differential is sensitive to
each ported semantic except the guard the data never exercises.

## Run 5 — 2026-10-10 22:00 (reading for correctness: TS findings, reported not fixed)

**Question.** Read against csharp/PORTING.md's three questions — does each docstring's promise hold, is every
table reached, which path does the instrument measure — what is wrong in the TS?

**Command.** `npx tsx .probe/sv/findings.mts` (synthetic inputs through `normalizeSwedish` →
`normalizeSwedishInitialisms` and `phonemize(…, "sv")`); FLEURS reach by `grep -P` over the 1,863 distinct
column-3 sv_se texts. The Rust reproduces each (the inputs are now in `probes/sv.txt`, Run 6).

**Raw finding (TS output, verbatim):**
1. **`osv` and `dvs` have no right edge** (normalize.ts ABBREV, `/(?<![\p{L}\p{M}])osv\.?/giu`,
   `/…dvs\.?/giu`). Every other undotted-capable entry (`fvt`) carries `(?![\p{L}\p{M}])`; these two only a left
   guard, so they fire as a PREFIX of an ordinary word: `Han var osviklig och osvensk.` → `Han var och så
   vidareiklig och och så vidareensk.` → *ɔ soː vˈìːdarɛɪklɪɡ ɔ ɔ soː vˈìːdarɛɛnsk*; `dvsbilen` → `det vill
   sägabilen`. `o-` + `sv…` is productive (osviklig, osvensk, osvarad, osvuren). FLEURS: 0 such words, so no
   measured row moves — a latent misfire.
2. **A period-form clock at a sentence end reads as a DECIMAL** (step 4, lookahead `(?![\d.])`). `Mötet börjar kl.
   20.30.` → `klockan 20.30.` → *ɕˈʉ̀ːɡɔ kˈɔ̀mːa treː nɔlː* ("twenty comma three zero"), while `kl. 20.30 i dag`
   reads *ɕˈʉ̀ːɡɔ trˈɛ̀tːɪɔ*. The step's own comment says the anchor exists for `1.1` and three-place decimals;
   the `.` in the lookahead also declines the sentence period. FLEURS: **1** utterance has it (a timetable
   range "between H.MM and H.MM." at the end of the sentence — the second time reads as a decimal).
3. **A colon-form clock at a sentence end falls to the SCORE rule** (step 5, `(?![\d.,])`). `Vi ses klockan
   12:00.` → `12 00.` → *tɔlv nɔlː*, but mid-sentence `12:00 i dag` → `12 0 0` → *tɔlv nɔlː nɔlː*: the `minutes`
   "00 → two zeros" rule is skipped, and any `:MM` minute reads through step 6 instead. FLEURS: 0 instances.
4. **`2000-talet` keeps the three defects step 9 was written for.** `hundredsYear` returns `undefined` from 2000
   up (the header's reason is the BARE-year ambiguity, *tvåtusentjugo* vs *tjugohundratjugo*), and step 9 reuses
   it for `-tal`, where the compound is unambiguous: `Under 2000-talet och 2100-talet.` → *tvɔtˈʉːsɛn tˈɑːlɛt …
   tvɔtˈʉːsɛn ɛtːhˈɵndra tˈɑːlɛt* — cardinal style, separate words, hyphen dropped. FLEURS: 0 instances (the
   corpus's 68 `-tal` texts are all < 2000), so the measurement could not see it.
5. (by design, noted) `0:e` and `101:a` keep the colon: *nɔlː , eː* / *… ɛtː , ɑː* — the docstring says an
   unclaimable ordinal keeps its digits; the result is a pause plus a letter name. `TV:n` → `te ven`, `USA:s` →
   `u ess as` (the suffix glued to the last letter name).
6. (dead code, harmless) swedish.ts imports `LATIN_RUN` and never uses it; the `secOrd < nucleiProbe` guard is
   unreached by the data (Run 4).

**Implication.** Findings 1–4 go in the PR body for a TS-first fix (the bidirectional rule); the Rust reproduces
the current TS byte for byte and carries no fork.

## Run 6 — 2026-10-10 22:10 (re-run with the finding probes; port-pending)

**Commands.** The five finding inputs appended to `probes/sv.txt` (synthetic; the timetable line re-timed so no
corpus fragment survives), then `sv-normalize`, `sv-g2p`, `phonemize-sync`, `phonemize-best`, `trace` re-dumped
and replayed. Port-pending: `npx tsx .probe/sv/extra.mts > .probe/sv/extra.jsonl` (six synthetic Swedish lines,
each with one foreign-script run: Cyrillic, Greek, Han + Hangul, Hebrew, Arabic, Devanagari), replayed as
`phonemize-sync`.

**Raw finding.**
```
sv-normalize: 31855 identical, 0 DIFFER   (probe 364)
sv-g2p: 630998 identical, 0 DIFFER
phonemize-sync: 3819 identical, 0 DIFFER
phonemize-best: 3819 identical, 0 DIFFER
trace: 3819 identical, 0 DIFFER
extra: 4 identical, 2 DIFFER   — "Det står שלום där." ts `deː stoːr ʃlvm dæːr .`, rust drops the run;
                                 "Hon sa مرحبا." ts `huːn sɑː mrħbˈaː .`, rust drops the run
```

**Implication.** The Rust reproduces every finding byte for byte. PORT-PENDING (synthetic only): a Hebrew or
Arabic run inside Swedish needs the he / ar readers, which are not ported; Cyrillic, Greek, Han, Hangul and
Devanagari runs route to ported engines and match. No golden or FLEURS row needs an unported engine.

## Run 7 — 2026-10-10 22:15 (the gates)

**Commands.** `cd rust && cargo fmt --check`; `cargo clippy --workspace --release` (warnings filtered to the files
this branch touches); `cargo test --release`; `cargo run --release -p regex-diff`; `cargo run --release -p
parity`. Two clippy findings in the new code were fixed first (an `if` with identical `j` blocks in the g2p's
`g` arm, merged with `||` — both conditions are pure, so the order is immaterial; two redundant closures), and
`sv-g2p` / `sv-normalize` / `phonemize-sync` re-replayed after: 0 DIFFER.

**Raw finding.**
```
cargo fmt --check: clean
clippy: the only warning in a touched file is module_inception at languages/swedish/mod.rs (as every language)
  (registry.rs:306 collapsible_if predates this branch)
cargo test --release: 118 passed, 0 failed (+1 doc-test crate) — incl. the 162 extracted TS pins
regex-diff: 144898 probe results identical, 0 DIFFER, 0 patterns refused
parity: en en-GB ja it es pt pt-BR hi cmn fr el ko th ru de sv — each 200/200 identical, 0 differ
```

**Implication.** sv is done on this machine. No TS regex was added, so the regex corpus needs no regeneration.
