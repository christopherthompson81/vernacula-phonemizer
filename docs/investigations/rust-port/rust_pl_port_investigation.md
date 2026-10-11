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
  transcripts at `/media/chris/TOSHIBA_EXT/omnivoice_ipa/corpus/fleurs_transcripts/data/pl_pl/{train,dev,test}.tsv`.
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
