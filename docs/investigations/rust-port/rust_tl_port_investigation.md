# Rust port: Tagalog / Filipino (`tl`)

Branch `worktree-agent-a5a40cba5874eaeda`, after the id/ms port (rust_id_port_investigation.md, whose Run 1 covers
this group's import closure). Part of #1463. Method as the earlier ports: per-module `fn-diff` differentials, then
the public entry end to end, then the golden gate.

## Run 1 — 2026-10-10 22:05 (imports, and two JS-object hazards to check before porting)

**Question.** What does `src/languages/tagalog/` need; does `specialWords[lw]` (indexed by an ARBITRARY lowercased
word) reach `Object.prototype`; what does the `ika-` ordinal do on a number too large for a float?

**Command.** Read manifest.ts, normalize.ts, tagalog.ts; `npx tsx .probe/tl/probe1.mts` (prints the manifest's
prototype, `phonemize` on `constructor`/`toString`/`__proto__`/`hasOwnProperty`, on `ika-` + 400 and + 25 nines, and
the SYMBOLS literal evaluated from source and `JSON.stringify`'d).

**Raw finding.**
- Imports: `clauses`, `hostWord` (LATIN_RUN, makeNativiser), `loadManifest`, `loadTsv` (loadLines, loadTsvMap),
  `normalizeSymbols`, `provenance`. All ported; no new core module. No neural entry, no Roman policy.
- `Object.getPrototypeOf(MANIFEST.specialWords)` is `null`: the loaded manifest has no prototype, so `constructor`
  reads *konstɾˈuktoɾ*. A plain Rust map lookup is faithful (the TS suite pins exactly this).
- `phonemize("ika-" + "9".repeat(400), "tl")` → **THROWS `RangeError: Maximum call stack size exceeded`**:
  `Number(m[4])` is Infinity and `numberWords` recurses on `Math.floor(Infinity / 1e6)` forever. The 25-digit form
  composes on the float.
- The SYMBOLS literal as JSON (embedded verbatim in tagalog.rs as `SYMBOL_DATA`, deserialized into `SymbolData`).

**Implication.** Port manifest → normalize → tagalog, one file each. The throw has to be an ERROR in Rust (a
recursion without end would abort the process): `text` returns `PhonemizeError::Input` for an infinite ordinal, which
is what `phonemize` throwing maps to. `numberWords` stays on `f64` so an unsafe ordinal composes exactly as the TS.

## Run 2 — 2026-10-10 22:12 (the golden gate)

**Command.** `cd rust && cargo run --release -p parity -- tl` (and `--sync tl`), after porting
`languages/tagalog/{manifest,normalize,tagalog}.rs`, one `build` arm and `tl` in `LANGUAGES`.

**Raw finding.** `tl: 200/200 identical, 0 differ`, both modes, first build.

**Implication.** The per-module differentials carry the ordinal, clock, number-stress and lexicon arms.

## Run 3 — 2026-10-10 22:20 (per-module differentials, end to end, sensitivity)

**Commands.** `FLEURS_ROOT=<external-drive>/… npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/tl/<name>.jsonl`, each
replayed by fn-diff; `LANGS=tl` for the end-to-end dumps, `SYMBOLS_LANGS=tl` for symbols. Inputs: the tl golden,
FLEURS **fil_ph** (Filipino; columns 3 and 4, first row checked to be a sentence) and new synthetic `probes/tl.txt`
(entities incl. an unknown one, the three range shapes and the hyphen compounds they must decline, clocks with and
without seconds, every ika- shape incl. fused/capital/leading zero/letter after, grouped and decimal numbers, the
symbol tier's units/rates/ligated magnitudes and their counter-examples `101.1 FM`/`15 GB`, g2p corners).
- `tl-normalize`: `normalizeTagalog`, then the tier on its output (the TS tier rebuilt from tagalog.ts's literal).
- `tl-g2p`: `phonemizeWord`, `phonemizeWordRules`, `phonemizeShippedNoLoan` and `nat` over every key of the three
  lexicons, every letter run of the texts (as written, lower, UPPER), every 1–3 letter string over a–z, ñ and both
  hyphens, and edge strings (lone surrogates, ſ, İ, ﬁ, `constructor`, `__proto__`, `--`, …).
- `tl-numbers`: `numberWords` (exported) over 0…20,000, scaled samples, powers of ten to 10²⁵ (the float path), and
  `phonemize` over 0…1,200 as cardinal / `ika-N` / `ikaN` / `Ika-N`, every hour × four minute values with and
  without seconds, long digit runs and long ika- runs to 30 digits.

**Raw finding.**
```
tl-normalize:   7296 identical, 0 DIFFER   (golden 400, fleurs 6872, probe 24)
tl-g2p:         200408 identical, 0 DIFFER
tl-numbers:     27253 identical, 0 DIFFER
phonemize-sync: 3648 identical, 0 DIFFER
phonemize-best: 3648 identical, 0 DIFFER
trace:          3648 identical, 0 DIFFER
symbols:        6708 identical, 0 DIFFER   (probe 3072, tagalog 3636)
```
**Sensitivity**, two breaks at once, then reverted and re-replayed green: the hiatus glottal stop restricted to
word-initial (`out.is_empty()`) and `numberStressIdx`'s penult arm disabled → `tl-g2p: 15753 DIFFER`,
`tl-numbers: 4738 DIFFER`.

**Implication.** tl meets the parity definition on this machine; nothing is port-pending (the foreign-script probe
line reaches ported ru/el/cmn).

## Run 4 — 2026-10-10 22:30 (reading for correctness: TS findings, then the suite as a Rust test)

**Command.** `npx tsx .probe/tl/findings.mts`; `node .probe/pins.mjs test/tagalog.test.ts` (fixed first: two scopes
in that file both name their array `cases`, and the loop search now starts after each array, so the `numberWords`
cases are no longer paired with the `phonemizeWord` loop — the id/ms pin counts were re-checked unchanged at 65).

**Raw finding (TS defects, reproduced by Rust, not fixed).**
1. **An `ika-` ordinal has no unsafe-integer guard, while the cardinal path does.** `emitNumber` reads a number above
   2⁵³ digit by digit; the ordinal branch calls `numberWords(Number(m[4]))` directly. So `ika-12345678901234567890`
   composes the FLOAT (…*sandaan at animnapu't walo*, i.e. …768: the low digits are wrong), where the cardinal
   `12345678901234567890` reads its digits. At 309+ digits the float is Infinity and `phonemize` throws a
   `RangeError` (stack overflow): one input string takes the whole utterance down.
2. **`numberWords` has no scale above `milyon`**, so 10⁹ is *libong milyon* and 10²¹ *sanlibong milyong milyong
   milyon*: `numberWords(2e9)` = `dalawang libong milyon`. The engine's own symbol tier declares `bilyon`/`trilyon` as
   attested magnitudes (`bilyon` ×21 in the mined artifact), so the number reader and the tier disagree about the
   language's scale words.
3. Not defects, recorded design: a decimal's dot is silent (`3.5` → *tatlˈo limˈa*, refusal documented in the code); a
   comma not followed by three digits is a pause (`1,00` → *ʔisˈa , sˈeɾo*).

**Changes.** tagalog.rs gains a test module: 19 `phonemizeWord`, 7 `phonemizeWordRules`, 25 `phonemize`, 20
`numberWords`, contains / not-contains / relational pins, all extracted mechanically, plus a test that the infinite
ordinal is `PhonemizeError::Input` and a 300-digit one still reads. Guard proved: `ORDINAL_PREFIX_NUCLEI` set to 1 →
`the_ts_suite_pins_hold ... FAILED`; restored → ok. `PhonemizeError::Input`'s doc comment, which said no engine
produces it, now names this producer.

**Implication.** Remaining: the full gate set on the final tree.

## Run 5 — 2026-10-11 05:55 (every gate, after a session break)

The session was interrupted by an API rate limit after Run 4's edits; `git status`/`git log` confirmed the id/ms
commit was in and nothing of tl was committed, so nothing was redone.

**Commands.** `cargo run --release -p parity` (all), `cargo test --workspace --release`, `cargo run --release -p
regex-diff`, `cargo fmt --check`, `cargo clippy --workspace --release`.

**Raw finding.** Clippy flagged one new warning in tagalog.rs, `if_same_then_else` on `numberStressIdx`'s first two
arms (both `strip(2)`); merged into one condition with a note (the third arm sits between the two other `strip(2)`
arms, so only the first two can merge without reordering), then tl-numbers / tl-g2p / phonemize-sync replayed
again: 0 DIFFER.
```
parity (all 23 codes in LANGUAGES, incl. tl): 200/200 identical each
cargo test --workspace --release: 134 passed + 1 doc-test crate, 0 failed
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
cargo fmt --check: clean
cargo clippy: only module_inception on tagalog/mod.rs in the new files
```
No TS regex was added or changed. Nothing is port-pending.

**Implication.** Done on this machine.

## Run 6 — 2026-10-11 16:35 (#1534: fixing the Run 4 findings, TS first)

**Command.** `npx tsx .probe/1534/p.mts tl`; `numberWords` on 1e9, 2e9, 3.005e12, 1e15, 999,999,999.

**Question.** Can the ordinal stop throwing without inventing a reading, and does the scale gap close from data
the engine already declares?

**Raw finding.**
1. **The `ika-` ordinal above 2⁵³** now reads its digits, exactly as the cardinal's `emitNumber` does, with the
   prefix fused onto the first digit word and the same stress shift: `ika-12345678901234567890` → *ʔikaʔisˈa dalawˈa
   tatlˈo …* (was …*sandaʔˈan ʔˈat ʔanimnapˈut walˈo*, the float's …768). `ika-` + 320 nines threw `RangeError`
   before; it now reads 320 words. Rust's `PhonemizeError::Input` for this case is gone (no TS throw left to
   reproduce), as is the `overflow` flag; the registry doc comment now names Czech as the remaining producer, and
   the test `an_infinite_ordinal_is_an_error` is replaced by `the_1534_findings_are_fixed`. C# composed on the
   float too and, on Infinity, never returned; it gets the same digit fallback.
2. **Scales above `milyon`.** tagalog.jsonc `numbers` gains `billion: "bilyon"` and `trillion: "trilyon"`, the
   symbol tier's own corpus-attested magnitudes (bilyon ×21 in the mined artifact, tl.wikipedia 572; trilyon 68).
   `numberWords(2e9)` *dalawang libong milyon* → *dalawang bilyon*; 1e9 *isang bilyon*; 3.005e12 *tatlong trilyon
   limang bilyon*; 1e15 *sanlibong trilyon* (no attested scale above trilyon, so it composes); 999,999,999 is
   unchanged. Ligation is the existing `ligate`, as for milyon.

**Implication.** Mirror into C# (Manifest gains Billion/Trillion) and Rust (NumbersDef gains both, required as in
the TS); regenerate the tl golden.
