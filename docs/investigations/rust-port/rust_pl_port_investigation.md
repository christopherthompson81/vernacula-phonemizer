# Rust port: Polish (pl)

Polish is a pure rule engine: a left-to-right orthographic scan (digraphs, the ⟨i⟩ palatalizer, ą/ę marking),
nasal-vowel realization, n→ŋ before velars, regressive voicing + final devoicing with progressive devoicing of
w/rz, and fixed PENULTIMATE stress. No lexicon and no neural model (`neuralRegistry.ts` does not list `pl`), so
`phonemize_best` is `phonemize`. The import closure is `polish/{polish,manifest,g2p,normalize,numbers,romanOrdinals}.ts`
plus core `normalizeSymbols` (`makeSymbolNormalizer`), `clauses`, `hostWord` (`LATIN_RUN`, `makeNativiser`),
`initialisms`, `loadManifest`, `numbers` (`digitIndex`), `provenance` and `roman`. Every core module is
already ported, so this port adds NO core module. `registry.ts` names `pl` in `ROMAN_POLICIES` (`romanPl`).

## Run 1 — 2026-10-10 21:05 (baseline, before any Polish code)

**Question.** What do the gates read before Polish is registered, and are the harness inputs where `dump.mts`
expects them?

**Command.** `cd rust && cargo build --release -p parity -p fn-diff && ./target/release/parity`;
`ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/`; `ls node_modules`.

**Raw finding.**
- Parity: all 15 ported languages `200/200 identical, 0 differ`.
- pl golden: 200 rows, 113 distinct texts.
- ⚠ `/mnt/data/omnivoice_ipa` does NOT exist on this machine any more; an unbounded `find /` locates the FLEURS
  transcripts at `<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data/pl_pl/{train,dev,test}.tsv`.
  `dump.mts` hardcodes the old root, and it is LOUD on a missing FLEURS file (throws), so this is not a silent
  hole — but a FLEURS dump cannot run unmodified.
- The worktree has no `node_modules`; symlinked the main checkout's (gitignored by the `node_modules` rule).

**Implication.** `dump.mts`'s `FLEURS_ROOT` gets an env override (`FLEURS_ROOT=…`), default unchanged, so the
FLEURS differential can run here without moving anyone's data. Polish is Latin-script, so registering it routes
no foreign run in another golden to the new engine (scripts.ts routes across scripts only).

## Run 2 — 2026-10-10 21:40 (first end-to-end build, golden)

**Question.** With all six modules ported (manifest, numbers, romanOrdinals, g2p, normalize, polish) and `pl`
registered (`build`, `roman_policy`, `LANGUAGES`), what does the golden gate say?

**Command.** `cd rust && cargo build --release && ./target/release/parity pl`. Before that, a literal check: every
string literal in the six `.rs` files (escapes decoded) searched for verbatim in `src/languages/polish/*.ts`;
the four `format!`-built patterns compared by eye against their TS templates.

**Raw finding.** Literal check: every IPA string, word and regex pattern found verbatim in the TS (only
Rust-side names and error messages, and one test value from the jsonc, were not). `pl: 200/200 identical,
0 differ` on the first build.

**Implication.** The golden passes first time, but it is 113 distinct texts and reaches few normalizer arms.
The per-module differentials and the probes carry the proof.

## Run 3 — 2026-10-10 22:15 (per-module differentials, end to end over FLEURS and probes)

**Question.** Do `normalize.rs`, the g2p, the number compositor, the count-form selector and the Roman policy
match their TS twins beyond the golden?

**Command.** New `dump.mts` entries `pl-normalize`, `pl-g2p`, `pl-numbers`, `pl-roman` (and `pl: "pl_pl"` in
`FLEURS_DIR`), each replayed by a `fn-diff` arm. `FLEURS_ROOT=/media/…/fleurs_transcripts/data npx tsx
rust/tools/fn-diff/dump.mts <name> > .probe/pl/<name>.jsonl`, then `./target/release/fn-diff <name>
../.probe/pl/<name>.jsonl`. Inputs: the golden, FLEURS pl_pl columns 3 and 4, and the new synthetic
`probes/pl.txt` (105 lines: each normalize.ts arm with the neighbour it must decline, the symbol tier, initialisms,
Roman contexts, heavy number inflection, g2p corners): 3,956 distinct texts.
- `pl-normalize`: each stage of text()'s chain separately — `normalizePolish`, `normalizePolishInitialisms`, and the
  symbol tier built exactly as polish.ts builds it — plus `isUnreadablePolish` over every letter run (both cases).
- `pl-g2p`: `phonemizeWord` and `toSegments` (ph/nucleus/nasal/rz per segment) over every letter run of the texts
  (both cases), every 1–3 letter string over the 35 letters + q v x, every 4-letter string over `dzirąęwcsnkbau`,
  and corners (`""`, `İ`, `ſ`, `ẞ`, lone surrogates, astral letters, ą/ę sequences); the nativiser over all of them
  plus ten foreign names.
- `pl-numbers`: `numberToWords` (with and without `raw`), `ordinal`, `plCountForm` over 0..20000, 10^e±, k·10³,
  k·10⁶, k·10⁹ and float/NaN/∞/−0 corners; `readDigits` and `numberToWords(Number(raw), raw)` over 11 raw strings
  (leading zeros, 20 digits, `1e3`, fullwidth/astral digits, `""`, a lone surrogate).
- `pl-roman`: `normalizeRomans(t, ROMAN_POLICY)`. `LANGS=pl phonemize-sync` / `phonemize-best`.

**Raw finding.** First build:
```
pl-normalize: 28299 identical, 0 DIFFER  (golden 339 / fleurs 11214 / probe 315 / words 16431)
pl-numbers: 81271 identical, 0 DIFFER
pl-roman: 3956 identical, 0 DIFFER       (golden 113 / fleurs 3738 / probe 105)
pl-g2p: 295675 identical, 0 DIFFER
phonemize-sync: 3956 identical, 0 DIFFER
phonemize-best: 3956 identical, 0 DIFFER
```
How much of the haystack exercised the normalizer: `normalizePolish` changed 216 of 3,738 FLEURS texts, 10 of 113
golden and 66 of 105 probe lines (the other probe lines are g2p/number/Roman lines with nothing to normalize);
the initialism pass changed 99 FLEURS texts; the symbol tier 66.

**Is the harness blind? (mutation check).** Temporarily changed `plCountForm`'s non-integer arm 3 → 2 and the
instrumental clock case to the oblique one, rebuilt, replayed `pl-normalize`: `28280 identical, 19 DIFFER`
(golden 2, fleurs 9, probe 8; e.g. `przed 23:35` → TS *dwudziestą trzecią*, mutant *dwudziestej trzeciej*).
Restored from the `.probe/pl` backup.

**Implication.** Every module is proven over the three haystacks and the harness sees a one-arm change. Remaining:
the full parity gate, tests, regex-diff, fmt and clippy.

## Run 4 — 2026-10-10 22:30 (reading the TS for correctness)

**Question.** Does each file's docstring promise what its code does (PORTING.md's question 1)? Probed in TS only,
via `.probe/pl/look.mts`.

**Raw finding.** Four TS findings, reported here and NOT fixed (Rust reproduces the TS byte for byte):
1. **Clock rule has no left boundary** (normalize.ts step 8, `/([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)/gu`).
   `Wynik 123:45` → *Wynik 1dwudziesta trzecia 45*; `21:01:05` → *21:pierwsza 05*. Russian's twin carries a `\b`.
2. **The decade rule cannot see a capitalized head.** `/(lat|lata|latach)(\s+)(\d+)\./gu` has no `i`, so the
   callback's `head.toLowerCase() === "lata"` is dead code and a sentence-initial `Lata 90. były dobre` reads
   *Lata dziewięćdziesiąty* (masculine nominative from the generic rule) instead of *dziewięćdziesiąte*;
   `W Latach 20.` likewise.
3. **nasalRealization's docstring says "nasalized ɔ̃/ɛ̃ before a fricative"; the code inserts a nasal stop.**
   `nasalBefore` returns n/m/ŋ for s z ʂ ʐ f v x, so `wąs` → vˈɔns, `węże` → vˈɛnʐɛ, `mąż` → mˈɔnʂ, `wąchać` →
   vˈɔŋxat͡ɕ, `trąf` → trˈɔmf. Only ɕ/ʑ get the [w̃] glide (`gęś` → ɡˈɛw̃ɕ). Standard Polish has the nasal glide
   before every fricative ([vɔw̃s]); which of the docstring and the code is intended needs a decision.
4. **g2p.ts's scan comment "⟨u⟩/⟨i⟩ after another vowel is a glide (… Europa→ɛwrɔpa)"** contradicts the code
   (and the very next comment, "eu/ou stay hiatus"): `Europa` → ɛurˈɔpa, and ⟨i⟩ after a vowel is the [i] vowel
   (`Kraina` → kraˈina).

**Implication.** None of these moves a golden row in either engine; they go in the PR body for a TS-first fix.
5. **A sentence period declines a fraction** (normalize.ts step 11, `(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d.,])`).
   Found while deriving the unit-test values (`.probe/pl/testvals.mts`): `To 1/5 i 1/2.` → *To jedna piąta i 1/2.*
   — the decimal guard `(?![\d.,])` also rejects a following `.` or `,` that is punctuation, so a fraction at the
   end of a sentence or before a comma stays as digits. Russian's twin was given the mirror guards of #1495
   (`(?!…\.\d|,\d+…)`); Polish's was not.

## Run 5 — 2026-10-10 22:50 (the gates)

**Question.** Is the whole tree green with Polish in it?

**Command.** `cd rust && cargo run --release -p parity`; `cargo test --release`; `cargo run --release -p regex-diff`;
`cargo fmt --check`; `cargo clippy --workspace --release` (warnings filtered to `polish/` and the fn-diff arms).

**Raw finding.**
- parity: all 16 languages (en en-GB ja it es pt pt-BR hi cmn fr el ko th ru de pl) `200/200 identical, 0 differ`.
- `cargo test`: 119 passed, 0 failed (3 new: the manifest test and two TS-derived engine tests).
- regex-diff: `144898 probe results identical, 0 DIFFER, 0 patterns refused`. No TS regex was added, so the
  corpus was not regenerated.
- fmt clean. clippy: one new `redundant guard` in g2p.rs (`Some(h) if h == "w̃"`), fixed to a literal pattern and
  re-verified (`pl-g2p` 295,675 / 0 DIFFER, parity pl 200/200); what remains new is only `module_inception` on
  `polish/mod.rs`, as every language module has. The fn-diff warning (`main.rs:617`) is pre-existing, not in the
  Polish arms.

**Implication.** Done. Port-pending rows: none (the pl golden needs no other engine; its Latin foreign names are
nativised by Polish itself). The `.probe/pl` dumps (66 MB) are deleted after this run.

## Run 6 — 2026-10-11 15:05 (#1522: which nasal before a fricative does the referee back?)

**Question.** Item 3 of #1522: the `nasalRealization` docstring says "nasalized vowel before a fricative", the code
inserts n/m/ŋ, and only ɕ/ʑ get [w̃]. Which is intended? Measure, by fricative place.

**Command.** A count over `tools/referee-eval/referees/pl.wikipron-pol.tsv` (every variant field, not only the
first) of what follows ɔ/ɛ before a fricative in words spelt ą/ę + fricative; then
`npx tsx tools/referee-eval/eval.ts pl --jobs 12` with the engine edited three ways.

**Raw finding.**
- Variant sets per word: {n, w̃} 1273, {n, oral, w̃} 206, {n, w̃, ̃} 36, {ŋ} 80, {oral, ŋ} 12, {w̃} 12 (all labial:
  `-ąwszy`, `fąfel`), {̃} 7, singletons. So before s z ʂ ʐ the referee lists BOTH [n] and [w̃]; before x only [ŋ];
  before f/v only [w̃] (13 rows, 0 [m]).
- eval, primary wikipron / secondary epitran (folded backbone):
  - baseline: 127407 / 109343
  - f v → w̃ only: 127420 (+13) / 109343
  - f v s z ʂ ʐ → w̃: 127420 / 109343 (identical to labial-only: the dental class is invisible to both referees)
  - f v s z ʂ ʐ x → w̃: 127327 (−80) / 109256 (−87)
- Note on the instrument: the BACKBONE strips combining marks, so w̃ is compared as w. That is still a w-vs-n
  distinction, and the dental class is flat because the referee credits either variant, not because the fold is blind.

**Implication.** Labial [m] is not an attested reading: fixed to [w̃] (+13). Velar stays [ŋ] (referee 92:0). The
dental/retroflex class is a both-real variant — [w̃] is the normative careful reading, [n] the engine's — so it is a
convention choice, not a defect: kept [n], and the docstring now says so with the numbers. The docstring and the
g2p comment (item 4, `Europa→ɛwrɔpa`, contradicted by the code and by "eu/ou stay hiatus") are rewritten.

## Run 7 — 2026-10-11 15:30 (#1522: the normalize fixes, rows moved, tests proved)

**Question.** Do the clock left guard, the `[Ll]` decade head and the mirrored fraction guards do what the issue
asks, and what do they move?

**Command.** `plvals.mts` (synthetic probes through `normalizePolish` / `phonemizeWord`); `plmeasure.mts`
(an unfixed snapshot of `src/` vs the fixed tree over every FLEURS pl_pl transcript + the golden's texts, 1932
distinct); `npx tsx tools/gen_parity_goldens.mts pl`; `npm run check:goldens`; a revert loop that undoes each
fix alone and runs `test/polish-1522.test.ts`.

**Raw finding.**
- `Wynik 123:45 i 21:01:05.` → unchanged (was `1dwudziesta trzecia 45` / `21:pierwsza 05`); `o 12:30` still
  `o dwunastej 30`.
- `Lata 90. były dobre.` → `Lata dziewięćdziesiąte` (was masculine `dziewięćdziesiąty`); `W Latach 20.` →
  `dwudziestych`; `Lata 90. Potem` still declines (sentence period). The `i` flag was NOT used: under `iu`,
  `\p{Ll}` in the lookahead matches uppercase too, which would erase the sentence-period discriminator.
- `To 1/5 i 1/2.` → `jedna piąta i jedna druga.`; `1/2, a` reads; `3/1/2`, `1/2,5`, `1,5/2` still decline.
- Rows moved over 1932 texts: **1**, `pɔt͡ʂˈɔmfʂɨ → pɔt͡ʂˈɔw̃fʂɨ` (a `-cząwszy` participle: item 3; wikipron writes
  `rozpocząwszy` with [w̃]). The golden is not among them: regenerated pl.tsv is byte-identical, check:goldens 0 stale.
- Revert loop: each fix reverted alone fails exactly its own test (1/4 each, four times).
- Seen and left alone: `1/2.5` reads `jedna druga kropka pięć` because step 6 rewrites `2.5` to `2 kropka 5`
  before the fraction rule runs (the ht/ln ordering defect of #1495). Not in #1522; unchanged by this fix.

**Implication.** TS done; mirror into C# and Rust, regenerate the regex corpus (three TS regexes changed).

## Run 8 — 2026-10-11 16:10 (#1522: mirrors, fn-diff, gates after rebasing onto main)

**Question.** Do C# and Rust match the fixed TS, and is the whole tree green on top of the sibling el/ko/ru/th/de fixes?

**Command.** C#/Rust edits mirrored; `npx tsx rust/tools/fn-diff/dump.mts pl-normalize|pl-g2p` (probes gained a
sentence-final fraction line and a labial-fricative word line) and `cargo run --release -p fn-diff -- …`; revert
proofs on both ports; then, after `git rebase origin/main`: `npx tsx tools/extract_regexes.mts`, `npm run typecheck`,
`npm test`, `npm run check:goldens`, `dotnet test csharp/Vernacula.Phonemizer.Tests` (full), C# parity and
regex-diff, `cargo fmt --check`, `cargo test --release`, `cargo run --release -p parity`, `-p regex-diff`.

**Raw finding.**
- fn-diff: pl-normalize 28315 identical / 0 DIFFER (probe 321, words 16441); pl-g2p 295705 / 0 DIFFER.
- Revert proofs: Rust with the two source files reverted fails both pl normalize tests (left
  `Wynik 1dwudziesta trzecia 45 i 21:pierwsza 05.`, `To jedna piąta i 1/2.`); C# with its two files reverted fails
  8 of the 11 Polish1522 cases (the 3 that pass pin unchanged behaviour: kąpać, wąs, wąchać).
- The regex corpus re-extracts byte-identical: none of normalize.ts's `rewrite(s, /…/gu, (…) =>` callback-form
  regexes is in it, before or after (13 Polish rows, all other shapes). Pre-existing gap; fn-diff is what covers
  these three patterns.
- Gates: typecheck clean; vitest 6843 passed / 5 skipped (360 files); check:goldens 189 languages 0 stale; dotnet
  test 7533 passed / 0 failed; C# parity 189 languages 0 differ; C# regex-diff 145038 identical / 0 DIFFER; cargo
  fmt clean; cargo test all ok (198 in the library); Rust parity every language identical except the known mag
  199/200 (Arabic); Rust regex-diff 145038 identical / 0 DIFFER.

**Implication.** Done. Left open: `1/2.5` still reads a half then "kropka pięć" (decimal step before fraction step).
- Re-rebased onto main after the uk fix (#1545) landed (disjoint files) and re-ran: corpus re-extract no change;
  vitest 6849 passed / 5 skipped; check:goldens 0 stale; dotnet test 7539 passed; C# parity 189 / 0 differ; C# and
  Rust regex-diff 145096 / 0 DIFFER; cargo test 199 ok; Rust parity 50 languages identical, mag 199/200.

## Run 9 — 2026-10-11 16:50 (#1551: ą/ę before s z ʂ ʐ → [w̃])

**Question.** Run 6 kept [n] before the dental/retroflex fricatives as a convention, because the referees score
[n] and [w̃] the same there. #1551 decides it the other way: standard orthoepy keeps an asynchronous nasal vowel
before a fricative (język [ˈjɛw̃zɨk]). Sources:
- https://en.wikipedia.org/wiki/%C4%98 (ę before a fricative is a nasal vowel / nasal glide, not vowel + [n]).
- https://ruj.uj.edu.pl/entities/publication/de2d8727-f52e-42ad-8bda-351a21042c24 (a study of how students
  pronounce it: ę before a hard fricative is nasal; before a soft fricative the nasality is optional).
What does the change move, and does either referee notice?

**Scope.** In `nasalBefore`, s z ʂ ʐ move from the [n] branch to the [w̃] branch. The soft fricatives ɕ/ʑ were
already in the [w̃] branch (the same rule as f/v), so nothing changes for them. The study's "optional before a soft
fricative" finding would argue for weakening that reading, not strengthening it, and #1551 does not ask for that, so
it is left as is. Velar x stays [ŋ]. The affricates t͡s d͡z t͡ʂ d͡ʐ and the stops t d keep [n]: they are not
fricatives. The `"tdsz".includes(p)` substring test became `"td".includes(p)`, keeping its substring form, in all
three engines.

**Command.** `npx tsx tools/referee-eval/eval.ts pl --jobs 12`, before and after (scratch copies of the output);
`npx tsx tools/gen_parity_goldens.mts pl` and a script that checks each changed golden row; `npm run check:goldens`;
probes through `phonemizeWord`; revert proofs in all three engines; fn-diff `pl-g2p` / `pl-normalize` with a new
probe line of synthetic s/z/ʂ/ʐ words.

**Raw finding.**
- Referee eval, the same command as Run 6:
  - before: wikipron (primary) folded backbone 127420/129736 (98.2%), symbol accuracy 99.7%; epitran
    (secondary) 109343/129736 (84.3%), 98.1%.
  - after: **byte-identical output**, 127420 / 109343, the residual classes unchanged too.
  - Why it is flat (checked, not assumed; see "flat may mean blind"): wikipron gives both variants for these
    words (`wąs`: `v ɔ n s` | `v ɔ w̃ s`; `język`: `j ɛ n z ɘ k` | `j ɛ w̃ z ɘ k` | `j ɛ̃ z ɨ k`; `mąż`, `wąski`,
    `gęsty` the same), so either reading matches. Epitran writes a nasal vowel (`vɔ̃s`, `jɛ̃zɨk`), which folds to
    an oral vowel, and that matches neither [n] nor [w], so both readings miss it equally. Run 6's result holds:
    neither referee can decide between them.
- Probes (fixed engine): wąs vˈɔw̃s, język jˈɛw̃zɨk, mąż mˈɔw̃ʂ, węże vˈɛw̃ʐɛ, mięso mjˈɛw̃sɔ, gęsty ɡˈɛw̃stɨ,
  wąski vˈɔw̃ski, księżyc kɕˈɛw̃ʐɨt͡s; unchanged: wąchać vˈɔŋxat͡ɕ, ręce rˈɛnt͡sɛ, bęc bˈɛnt͡s, kąpać kˈɔmpat͡ɕ,
  gęś ɡˈɛw̃ɕ, trąf trˈɔw̃f, są sˈɔw̃, się ɕˈɛ.
- pl golden regenerated: **20 of 200 rows moved** (11 distinct texts; FLEURS repeats some sentences). Each moved
  row differs only by [n] → [w̃] before s/z/ʂ/ʐ, and the script checked every word: języka jɛnzˈɨka→jɛw̃zˈɨka (×2),
  często t͡ʂˈɛnstɔ→t͡ʂˈɛw̃stɔ (×4), wciąż ft͡ɕˈɔnʂ→ft͡ɕˈɔw̃ʂ (×2), związaną zvjɔnzˈanɔw̃→zvjɔw̃zˈanɔw̃ (×1),
  powiązanych pɔvjɔnzˈanɨx→pɔvjɔw̃zˈanɨx (×2), związanych zvjɔnzˈanɨx→zvjɔw̃zˈanɨx (×2), ciężkiego
  t͡ɕɛnʂkjˈɛɡɔ→t͡ɕɛw̃ʂkjˈɛɡɔ (×2), cząsteczek t͡ʂɔnstˈɛt͡ʂɛk→t͡ʂɔw̃stˈɛt͡ʂɛk (×2), książkach
  kɕˈɔnʂkax→kɕˈɔw̃ʂkax (×2), zwyciężyła zvɨt͡ɕɛnʐˈɨwa→zvɨt͡ɕɛw̃ʐˈɨwa (×1). check:goldens: 189 languages, 0 stale.
- Revert proofs: TS g2p.ts reverted fails test/polish-1551.test.ts 1/2 (the second test pins unchanged
  behaviour); C# G2p.cs reverted fails Polish1551Tests 5/9 (the 4 that pass are the unchanged cases); Rust g2p.rs
  reverted fails `issue_1551_…` (left `vˈɔns`).
- The old `wąs → vˈɔns` assertions were updated (test/polish.test.ts) or removed (the #1522 tests in all three
  engines), because they pinned the old convention.
- fn-diff: pl-g2p 295714 identical / 0 DIFFER (probe 324, words 16445); pl-normalize 28322 / 0 DIFFER.

**Implication.** This is a choice made on orthoepic grounds, and the referees do not register it, so no score can
confirm or contradict it. The soft-fricative caveat in the study is left alone (see Scope). Next: rebase, then the
gates.

## Run 10 — 2026-10-11 17:15 (#1551: gates)

**Command.** `git rebase origin/main` (already up to date at 9d80d2e7); `npx tsx tools/extract_regexes.mts`;
`npm run typecheck`; `npm test`; `npm run check:goldens`; `dotnet test csharp/Vernacula.Phonemizer.Tests` (full);
C# `parity` and `regex-diff`; `cargo fmt --check`, `cargo test --release`, `cargo run --release -p parity`, `-p regex-diff`.

**Raw finding.** regex corpus re-extracts with no change (no TS regex was touched); typecheck clean; vitest 6884
passed / 5 skipped (363 files); check:goldens 189 languages, 36495 rows, 0 stale; dotnet test 7609 passed / 0
failed; C# parity 189 languages, 0 differ; C# regex-diff 145212 identical / 0 DIFFER; cargo fmt clean; cargo test
203 + 1 ok; Rust parity: every language identical (pl 200/200) except the known mag 199/200 (Arabic); Rust
regex-diff 145212 identical / 0 DIFFER.

**Implication.** Done.
- main moved while the gates ran (the ne fix #1552 landed; its files do not overlap these). Rebased onto 89054126 and
  re-ran everything: corpus re-extract no change; typecheck clean; check:goldens 0 stale; dotnet test 7612 passed;
  C# parity 189 / 0 differ; C# and Rust regex-diff 145212 / 0 DIFFER; cargo fmt clean; cargo test 203 + 1 ok; Rust
  parity identical except mag 199/200. The first vitest run after the rebase failed 2 tests on a 5 s timeout
  (`foreign-runs.test.ts`, neural English OOV reader) at a machine load of ~100. That file passed alone (47/47),
  and the full rerun passed: 6884 passed / 5 skipped. The failures were load, not this change.

## Run 11 — 2026-10-14 (#1551: `1/2.5`, a period decimal beside a slash)

**Question.** Run 8 left `1/2.5` reading *jedna druga kropka pięć*. Why does the fraction rule's `\.\d` guard miss
it?

**Command.** `normalizePolish`/`phonemize` on synthetic lines, main vs fix; `FLEURS_ROOT=… npx tsx
rust/tools/fn-diff/dump.mts pl-normalize` (28,322 rows) before and after.

**Raw finding.**
- **Cause.** Step 6 (version dots) has already rewritten `2.5` to `2 kropka 5` by the time step 11 runs, so the
  fraction's `\.\d` arms never see a period. The left side has the same shape: `0.1/2` read *zero kropka jedna
  druga*.
- **The fix.** ` kropka ` + digit (right) and `\d kropka ` (left) are now decimal tails too. `1/2.5` reads
  *jeden dwa kropka pięć* and `0.1/2` *zero kropka jeden dwa*, each identical to the comma spelling apart from
  the point word. `1/2.`, `1/2, a` and `1/2 i 3/4` are unchanged.
- **Impact.** pl-normalize changes 0 of 28,322 rows.
- **Tests.** In `test/leftovers-1551.test.ts`, C# `Leftovers1551Tests` and Rust
  `the_1551_period_decimal_is_not_a_fraction`. They fail with the fix reverted.

**Implication.** Done. The other #1551 items (tr, uk, nl) stay open for want of data or a native reader.
