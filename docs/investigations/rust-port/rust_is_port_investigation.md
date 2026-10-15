# Rust port: Icelandic (is)

Part of #1463, the "north" group (fi, et, hu, is, fo). Method as in rust_fi_port_investigation.md.

Icelandic is a greedy longest-match scan (vowel digraphs, the devoiced-sonorant and epenthetic-stop clusters,
fortis/lenis geminates, ⟨k g⟩ palatalisation, the context-dependent ⟨nn⟩), then the velar nasal with its pre-nasal
diphthongisation, ⟨g⟩ spirantisation, preaspiration, the ⟨í⟩ hiatus glide and ⟨f⟩ realisation, with the stress
mark before the first nucleus; a tens-first cardinal compositor with "og" and gender concord (numbers.ts, which
loads its own slice of the jsonc); and a normalizer whose ordinal form is selected by the FOLLOWING word
(normalize.ts). No symbol tier, no initialism pass, no lexicon, no neural entry, no `ROMAN_POLICIES` entry.

## Run 1 — 2026-10-14 23:10 (the import closure, baseline)

**Question.** What does `src/languages/icelandic/` need that the Rust core lacks?

**Command.** Read icelandic.ts, manifest.ts, numbers.ts, normalize.ts and their imports;
`grep -n '"is"' src/registry.ts src/neuralRegistry.ts`.

**Raw finding.**
- Imports: core `clauses`, `hostWord` (`hostWordRun(["Latin"], "'-")` — the apostrophe and hyphen are word
  letters here), `loadManifest`, `numbers` (digitIndex), `provenance`. All ported; no new core module.
- The `IcelandicDef` interface lives in icelandic.ts and manifest.ts only loads it, so the Rust struct is in
  icelandic.rs and manifest.rs holds the loader (the type import is the only edge, as in the TS).
- is golden: 200 rows, 172 distinct texts. FLEURS is_is: 846 distinct column-3 texts.

**Implication.** Port manifest → numbers → normalize → icelandic.

## Run 2 — 2026-10-14 23:13 (first end-to-end build, golden)

**Command.** `./target/release/parity is` after registering `is`.

**Raw finding.** `is: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-14 23:14 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `is-normalize` and `is-g2p` (`is: "is_is"` in `FLEURS_DIR`), one `fn-diff`
arm, run through `north/e2e.sh`. Inputs: golden, FLEURS is_is columns 3 and 4, the new synthetic `probes/is.txt`.
- `is-normalize`: `normalizeIcelandic` per text; synthetic rows: the ordinal 0…40, `07`, `00`, 100, 123 × 8 heads
  (month, `öld` obliques, a neuter noun, a capital, nothing) × a digit-glued variant; grouping and decimals; the
  clock; 16 unit spellings × 2 frames; ranges, signs and relational signs; currency on both sides; the dotted
  abbreviations in 6 spellings.
- `is-g2p`: `phonemizeWord` over every letter run (apostrophe and hyphen included), every 1–3 letter string of 38
  letters, every 4-letter string over `kgnfíaeijt`, corners (lone surrogates, a decomposed `é`, the module's own
  example words); the nativiser; `numberToWords` (0…20,000, magnitudes to 10¹², corners, raw strings).
- end to end `LANGS=is` `phonemize-sync`, `phonemize-best`, `phonemize-trace`, `trace`.

**Raw finding.** First build, every one:
```
is-normalize: 2512 identical, 0 DIFFER  (golden 172 / fleurs 1528 / probe 13 / synthetic 799)
is-g2p: 175782 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 1713 identical, 0 DIFFER each
```

**JS semantics reproduced on purpose.**
- The unit loop rebuilds each pattern from `re.source` with `gu`: the literal's `i` is DROPPED, so `5 KM` is not
  a unit. The Rust table holds the sources, not the literals.
- `w[i - 1] ?? ""` at `i = 0` and `w[i + 2] ?? ""` past the end are the empty string, which no set contains.
- `preaspirate` and `glideJ` insert while walking right to left, over a bound computed once; `velarNasal` and
  `realizeF` walk left to right.
- `prev.ph in PRENASAL_V` also sees `Object.prototype`'s member names; no phone is one, so the table lookup is
  equivalent.
- The manifest loader refuses a jsonc whose geminate or collapsing-double letters lack a grapheme, where the TS
  would build an `undefined` phone (unreachable with the shipped data).

**Guard check (reverting a reproduction).** `preaspirate`'s "already preaspirated" test removed:
`is-g2p: 175689 identical, 93 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-14 23:16 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<worktree> N=languages/icelandic/normalize.ts FN=normalizeIcelandic npx tsx north/t.mts is <texts>`;
`cut -f3` of FLEURS is_is for `\d+,\d+`.

**Raw finding (TS output, verbatim):**
1. **The colon clock has no left guard and drops the minute's zero.** `123:45 var` → `123 45 var` (the tail of a
   three-digit run read as an hour), and `klukkan 9:05` → `hklˈʏhkan nˈijʏ fˈɪm` (09:05 spoken as 9:5).
2. **An English-convention thousands comma becomes a decimal.** `Um 100,000 manns` → `100 komma 0 0 0` →
   `ˈeiht hˈʏntrað kˈɔma nˈutl nˈutl nˈutl`. The Hungarian sibling de-groups a comma before exactly three digits
   for this FLEURS-translation shape; here it is latent (FLEURS is_is: 7 `\d,\d` strings, all real decimals).
3. **A descending pair is read as a range.** `Leikurinn fór 3-2` → `3 til 2` (*þrír til tveir*) — a score; the
   Estonian sibling's range rule is ascending-only.

**Implication.** Reported in the PR; Rust reproduces all three (probes carry each shape).

## Run 5 — 2026-10-14 23:17 (TS suite pins, gates)

**Changes.** icelandic.rs gains a test module: every call test/icelandic.test.ts makes into the engine (84: 36
`phonemizeWord`, 20 `normalizeIcelandic`, 18 `numberToWords`, 10 `createIcelandic().text`), extracted by
`north/pins.mts` (87 expects, 0 failures).

**Raw finding.** parity, all 55 languages byte-identical but mag at its known 199/200; `is: 200/200`. clippy adds
only `module_inception` on `icelandic::icelandic`.

**Implication.** No port-pending rows (TOKEN is all of Latin).
