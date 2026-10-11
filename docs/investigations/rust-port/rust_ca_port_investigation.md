# Rust port: Catalan (`ca`)

Branch `worktree-agent-ab430eb42060893ad` (after es-419, fr-CA, en-IN). Part of #1463. Method as
rust_sv_port_investigation.md: per-module `fn-diff` differentials, then the public entry end to end, then the
golden gate.

## Run 1 — 2026-10-11 00:20 (the import closure)

**Question.** What does `src/languages/catalan/` need that the Rust core lacks? Neural entry? Roman policy?

**Command.** Read catalan.ts, g2p.ts, normalize.ts, numbers.ts, romanOrdinals.ts, manifest.ts and their imports
against `rust/vernacula-phonemizer/src/core/`; `grep -n '\bca\b' src/registry.ts src/neuralRegistry.ts`.

**Raw finding.** Every core import is ported: `makeSymbolNormalizer`, `hostWordRun` (with `·` as an extra letter),
`makeNativiser`, `assembleClauses`, `loadTsvMap` (two OPTIONAL word lists, `mid-vowels.tsv` and
`bl-gl-geminate.tsv`), `loadManifest`, `digitIndex`, `latinPhone`, `makeInitialismNormalizer` /
`makeUnreadableTest`, `rewrite`, `noteRewrite`. No neural entry. `ROMAN_POLICIES` names `ca` (prenominal event
ordinal, any n); `ca` is in `VULGAR_FOLD_OPT_OUT`, already in the Rust registry. The symbol tier's argument is
recorded with the `symbols` dump (`SYMBOLS_LANGS=ca,gl,ro`), embedded as JSON (key order preserved) and
deserialized, as sv's.

Two `rewrite(…)` calls in `ordinalWords` act on a STEM and an ordinal, not the pipeline string; kept as `rewrite`
in the Rust (the seam's poison/withhold behaviour is part of what `trace` compares).

**Implication.** No new core module: manifest → numbers → roman_ordinals → g2p → normalize → catalan.

## Run 2 — 2026-10-11 00:40 (golden gate)

**Command.** `cargo run --release -p parity -- ca`.

**Raw finding.** `ca: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-11 00:55 (differentials)

**Commands.** `.probe/bin/dd.sh ca ca ca-normalize ca-g2p ca-numbers phonemize-sync phonemize-best trace`
(`FLEURS_ROOT=<external-drive>/…`; the first FLEURS ca_es row checked to be a sentence). New dumps:
- `ca-normalize`: `normalizeCatalan` over the golden (129 distinct texts), FLEURS ca_es columns 3+4 (3,554) and the
  new synthetic `probes/ca.txt`; the symbol tier rebuilt from catalan.ts's own literal (`symbolsFromLiteral`, which
  evaluates the source object — so this proves the embedded JSON too) on each output; `isUnreadableCatalan` over
  every letter run; `ordinalWords` m/f over −2…2100 and the float/NaN/∞/2⁵³ corners.
- `ca-g2p`: `phonemizeWord` (stressed and proclitic), `nat` and `toSegments` over every mid-vowel and geminate key,
  every letter run (as written, lowercased, nativised), every 1–3 letter string over the 37 Catalan letters
  (incl. `·`), every 4-letter string over `aeiouxgrstlnyc·`, and 24 edge strings (empty, lone surrogates, `ſant`,
  `İgual`, `ﬁ`, `Qatar`, `ñ`, `ß`, …).
- `ca-numbers`: `numberToWords` (with and without raw) and the Roman ordinal over 0…20,000, k·10³/10⁶ strides,
  powers of ten to 10²¹ and the float/NaN/∞ corners; 9 raw strings (20 digits, fullwidth, astral digit, …).

**Raw finding.**
```
ca-normalize: 22395 identical, 0 DIFFER
ca-g2p: 487256 identical, 0 DIFFER
ca-numbers: 52125 identical, 0 DIFFER
phonemize-sync: 3706 identical, 0 DIFFER
phonemize-best: 3706 identical, 0 DIFFER   (best == sync on all 3,706: no neural tier)
trace: 3706 identical, 0 DIFFER
```

Per-arm reach (`.probe/bin/arms.mts`: each regex literal of normalize.ts tested against the raw inputs; golden
129 / FLEURS 3,554 / probe 23 texts):
- reached by the corpus: capital dot before a capital word 2/3/1, ordinals 1/15/1, decades 0/2/1, clock 2/26/1,
  version/decimal dot 1/12/3, `¾` `½` 0/2/1, `°C` 0/2/1, `°N/S/O/E` 0/2/1, Ghz 0/2/1, `+` 0/2/1, `A&B` 0/1/1;
- PROBES ONLY (corpus 0): the dotted-capital run, `°F`, bare `°`, `±`, the minus, ` & `, `=`, `÷`, `<`, `>`, `×`.

**Can it see a defect?** Mutations, each reverted:
- the `-rts → rs` arm dropped from `CLUSTER_DROP_S`: `ca-g2p: 487150 identical, 106 DIFFER`,
  `phonemize-sync: 3574 identical, 132 DIFFER`.
- the cross-word sibilant lookahead ignored: `phonemize-sync: 3706 identical, 0 DIFFER` — **a dead end at first**:
  the guard is unreachable from the corpus and from my first probe list, because the stop it guards is the FIRST
  phone of the following word and no Catalan word begins with a voiced stop + sibilant. Only a (foreign) name
  does: a synthetic line `Va guanyar la Djarova i la Dzelan, i el Bzuret.` makes the mutation visible
  (`ts … ɫə dʒ…` vs `rust … ɫə ðʒ…`: the d of a word-initial d + ʒ stays occlusive only with the guard; 1 DIFFER).
  Kept in the probes.

## Run 4 — 2026-10-11 01:05 (reading for correctness; TS findings, reported not fixed)

**Command.** `npx tsx .probe/ca/findings.mts`.

**Raw finding (TS, verbatim).**
1. **The two Catalan ordinal compositors disagree on 21–99 compounds.** `normalize.ts`'s `ordinalWords` keeps the
   irregular under-ten stem at the end of a compound (`21 → vint i primer`, `22 → vint i segon`, `23 → vint i
   tercer`, `24 → vint i quart`, `31 → trenta primer`), while `romanOrdinals.ts`'s `catalanOrdinal` suffixes the
   cardinal (`vint i unè`, `vint i dosè`, `vint i tresè`, `vint i quatrè`) — the IEC/Optimot form. So `El 21è
   aniversari i el XXI aniversari.` reads `… βˈin i pɾimˈe … βˈin i unˈɛ …`: the same ordinal, two readings, in
   one sentence. `ordinalWords` is not even self-consistent: the branch is gated on `n % 100 > 10`, so `101 → cent
   unè` and `102 → cent dosè` take the regular form. The suffix the writer chose is also ignored: `21è` (an
   -è-series suffix) reads `primer`.
2. (latent, noted) the cross-word spirantizer's `[bdɡ]` also matches the `d` of a word-initial TIED affricate
   (`d͡ʒ`/`d͡z`), where the in-word rule cannot (its keys are single phones); unreached by any native word.

**Implication.** Finding 1 goes in the PR body; the Rust reproduces both.

## Run 5 — 2026-10-11 01:15 (TS test pins, gates)

**Command.** `.probe/bin/extract_pins.py test/catalan.test.ts {word | text ca | call:ph | call:normalizeCatalan |
call:ord | fem:ordinalWords}` → a `#[cfg(test)]` module; `cargo test --release catalan`; re-ran the dumps after the
probe additions; `cargo run --release -p parity`.

**Raw finding.** 58 word + 25 text + 30 `ph` + 17 normalize + 7 Roman + 7 `ordinalWords` pins: `3 passed`.
Re-run: `ca-normalize 22403 / ca-g2p 487280 / phonemize-sync 3707 / phonemize-best 3707 / trace 3707 identical,
0 DIFFER`. Parity: all 24 registered languages 200/200.
