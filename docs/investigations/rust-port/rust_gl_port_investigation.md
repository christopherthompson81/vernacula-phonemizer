# Rust port: Galician (`gl`)

Branch `worktree-agent-ab430eb42060893ad` (after es-419, fr-CA, en-IN, ca). Part of #1463. Method as
rust_ca_port_investigation.md.

## Run 1 — 2026-10-11 01:25 (the import closure)

**Question.** What does `src/languages/galician/` need that the Rust core lacks? Neural entry? Roman policy?

**Command.** Read galician.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts and their imports;
`grep -n '\bgl\b' src/registry.ts src/neuralRegistry.ts`.

**Raw finding.** Every core import is ported (`makeSymbolNormalizer`, `LATIN_RUN`, `makeNativiser`,
`assembleClauses`, `loadManifest`, `digitIndex`, `latinPhone`, `makeInitialismNormalizer` / `makeUnreadableTest`,
`rewrite`, `noteRewrite`). No word lists, no neural entry, no `ROMAN_POLICIES` entry (the default policy; a century
reads as a cardinal, which the TS test pins). gl does not share a module with es or pt in the TS — its g2p is its
own file in the Spanish SHAPE — so nothing is reused from the es port beyond core. The symbol tier's literal is
recorded by the `symbols` dump and embedded as JSON (`multiply` with `by`, `ampersand`, a `bareExponent` with
only `squared`). `GROUP_SPACE` holds space, NBSP, THIN SPACE, NNBSP in that order (es's literal has the last two
the other way round); copied as the TS's characters.

**Implication.** No new core module: manifest → numbers → g2p → normalize → galician.

## Run 2 — 2026-10-11 01:40 (golden gate)

**Command.** `cargo run --release -p parity -- gl`.

**Raw finding.** `gl: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-11 01:50 (differentials)

**Commands.** `.probe/bin/dd.sh gl gl gl-normalize gl-g2p gl-numbers phonemize-sync phonemize-best trace`
(`FLEURS_ROOT=<external-drive>/…`). New dumps:
- `gl-normalize`: `normalizeGalician` over the golden (133), FLEURS gl_es columns 3+4 (3,501) and the new synthetic
  `probes/gl.txt`; the symbol tier rebuilt from galician.ts's literal on each output; `isUnreadableGalician` over
  every letter run; `galicianOrdinal` over −2…200 and the float corners.
- `gl-g2p`: `phonemizeWord`, `nat` and `toSegments` over every letter run (as written, lowercased, nativised),
  every 1–3 letter string over the 33 Galician letters, every 4-letter string over `aeiouíúyxnhgqcrsl`, and 22
  edge strings.
- `gl-numbers`: `numberToWords` over 0…20,000, k·10³/10⁶/10⁹/10¹² strides (both scale bands), powers of ten to
  10²¹, the unsafe/float/NaN/∞ corners and 9 raw strings.

**Raw finding.**
```
gl-normalize: 18792 identical, 0 DIFFER
gl-g2p: 394086 identical, 0 DIFFER
gl-numbers: 28066 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 3657 identical, 0 DIFFER each
```
Per-arm reach (`.probe/bin/arms.mts`; golden 133 / FLEURS 3,501 / probe 23): corpus-reached — número 0/2/1,
dotted-capital run 0/1/1, capital dot 5/28/1, ordinal indicator 0/18/1, dot decimal 0/4/1, `°C` `°F` 0/2/1 each,
bare `°` 0/6/1, clock 4/20/1, spaced `+` 0/2/1, ranges 0/10/2. PROBES ONLY: `US$/AUD$/CAD$`, `R$`, `°N/S/E/O`,
`h:mm:ss`, `±`, the minus, the glued `+`, `=`, `<`, `>`, `÷`, `〃`.

Mutation (then reverted): the final `-ns` velarization arm removed → `gl-g2p: 393555 identical, 531 DIFFER`,
`phonemize-sync: 2883 identical, 774 DIFFER`.

## Run 4 — 2026-10-11 02:00 (reading for correctness; TS findings, reported not fixed)

**Command.** `npx tsx .probe/gl/findings.mts`, `.probe/gl/findings2.mts`.

**Raw finding (TS, verbatim).**
1. **A falling diphthong followed by a final `-s` takes PENULT stress**, against the module's own rule.
   `stressedNucleus`'s docstring makes a glide-final word oxytone (`cantou → kantˈoᶷ`, `amei → amˈeᶦ`), but the
   test is `endsNucleus || last === "n" || last === "s"`, so the plural or a lexical `-s` after the glide flips it:
   `cantous → kˈantoᶷs`, `ameis → ˈameᶦs`, `papeis → pˈapeᶦs`, `chapeus → t͡ʃˈapeᶷs`, and — the frequent one —
   `ademais → aðˈemaᶦs`, `xamais → ʃˈamaᶦs` (both oxytone in the standard). **FLEURS gl_es: 70 transcript lines
   contain `ademais` or `xamais`**, so this is a measured-corpus defect, not a latent one. (Catalan's
   `stressedNucleus` checks the segment after the LAST NUCLEUS for exactly this reason; Galician checks the last
   segment.)
2. Checked and NOT a defect: a spaced dash between numbers (`10 – 20`, `1990 - 2000`) could have been claimed by
   the minus rule (`(^|[\s(])[-−–](\d…)`), but that rule needs the digit glued to the sign, and the range rule
   reads both forms as `a` (`Entre 10 a 20`).

**Implication.** Finding 1 goes in the PR body; its line is appended to `probes/gl.txt`.

## Run 5 — 2026-10-11 02:10 (TS test pins, gates)

**Command.** `.probe/bin/extract_pins.py test/galician.test.ts {word | trim:gl.text | trim:phonemize |
call:normalizeGalician | call:galicianOrdinal}` (the extractor now reads a prettier-wrapped `.toBe(\n "…",\n)` too;
re-checked the ca extraction is unchanged by it: 30 / 25 / 17 / 58); `cargo test --release galician`; dumps
re-run; `cargo run --release -p parity`.

**Raw finding.** 25 word + 26 `gl.text` + 2 `phonemize` + 45 normalize + 6 ordinal pins (one `toContain` pin,
`299 792 458 m/s`, is not a `toBe` and is not carried): `2 passed`. Re-run: `gl-normalize 18796 / gl-g2p 394092 /
phonemize-sync 3658 / phonemize-best 3658 / trace 3658 identical, 0 DIFFER`. Parity: all 25 languages 200/200.
