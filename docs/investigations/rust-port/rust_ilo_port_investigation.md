# Rust port: Ilocano (`ilo`)

Branch `worktree-agent-a5a40cba5874eaeda`, after hil. Part of #1463. The group's import closure is
rust_id_port_investigation.md Run 1: ilo imports nothing from another language (Northern Luzon, not Bisayan; its
scan differs from ceb/hil in the high-vowel gliding hiatus and the ⟨ll⟩ handling), and every core module it needs is
ported. No neural entry, no Roman policy.

## Run 1 — 2026-10-11 06:21 (the port and the golden gate)

**Command.** Ported `languages/ilocano/{numbers,normalize,ilocano}.rs` (`IlocanoDef` in ilocano.rs, as the TS
declares it there; numbers.ts's own `{ numbers }` load in numbers.rs; the tier's literal printed as JSON by
`.probe/symjson.mts` and embedded), one `build` arm, `ilo` in `LANGUAGES`; `cargo run --release -p parity -- ilo`
and `--sync ilo`.

**Raw finding.** `ilo: 94/94 identical, 0 differ`, both modes, first build. The golden has 94 rows and FLEURS has no
Ilocano, so as for hil the golden plus synthetic text is the whole haystack. One loop shape to keep: the TS scan is a
`for (…; i++)` whose trigraph arm adds 2 and digraph arm 1 (so 3 and 2 in total) and whose glide arm `continue`s
without pushing the vowel; the Rust `while` reproduces each advance.

## Run 2 — 2026-10-11 06:25 (differentials, with generated shapes)

**Commands.** `npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/ilo/<name>.jsonl`, replayed by fn-diff;
`LANGS=ilo`, `SYMBOLS_LANGS=ilo`. Inputs: the golden (94), synthetic `probes/ilo.txt` (13 lines), and for
`ilo-normalize` 2,954 GENERATED lines: every hour 0–25 × five minute shapes × 18 licence contexts (meridiem forms
incl. `p. m.` and `amang`, GMT/UTC, `ti agsapa`/`iti rabii`/`ti aldawen`, `oras a/ti/nga` incl. a double space, none,
and the `+`/`-`/`1.` left guards); h/m/s durations and their neighbours; each `tunggal` per-unit form × six units;
ranges over 5 × 5 endpoints × 4 separators × 5 prefixes; decimals; malformed groups; degrees; U+2212 in five
positions; abbreviations and `c.`/`ca.` with near-misses.
- `ilo-g2p`: `phonemizeWord`, `phonemizeWordRules` and `nat` over every ilo-lexicon key (and uppercased), every letter
  run of the texts, every 1–3 letter string over a–z, ñ, apostrophes, hyphens, every 4-letter string over
  `aeiougqn` (the glide and trigraph contexts), and edge strings incl. a decomposed `é`.
- `ilo-numbers`: as ceb-numbers.

**Raw finding.**
```
ilo-normalize:  3061 identical, 0 DIFFER   (golden 94, probe 13, generated 2954)
ilo-g2p:        117333 identical, 0 DIFFER
ilo-numbers:    22073 identical, 0 DIFFER
phonemize-sync: 107 identical, 0 DIFFER
phonemize-best: 107 identical, 0 DIFFER
trace:          107 identical, 0 DIFFER
symbols:        3192 identical, 0 DIFFER   (probe 3072, ilocano 94, plus 25 mandarin and 1 greek rows: the
                foreign-script probe line's Han and Greek runs reach those engines' own tiers)
```
**Sensitivity**, reverted after and re-replayed green: the high-vowel glide disabled → `ilo-g2p: 4348 DIFFER`; the
U+2212 word misspelt → `ilo-normalize: 3 DIFFER`.

## Run 3 — 2026-10-11 06:29 (reading for correctness: TS findings; the suite; gates)

**Command.** `npx tsx .probe/ilo/findings.mts`; `node .probe/pins.mjs test/ilocano.test.ts`.

**Raw finding (TS defects, reproduced by Rust, not fixed).**
1. **A trigraph hides its vowel from stress**, the same defect as hil: `queso` → *kesˈo*, `Miguel` → *mˈiɡel*,
   `quiet` → *kiˈɛt*. The trigraph unit (`ke`, `ɡi`, …) starts with a consonant, and both `stressed` and the
   hiatus test look only at a unit's first character.
2. **A decimal with three or more fraction digits is a pause plus a cardinal**, as ceb/hil: `3.141 a metro` →
   *tˈallo . saŋaɡˈasut kˈɛt ʔˈuppat ʔˈa pˈulo kˈɛt mˈajsa …*.
3. **A compass letter after `°` is read raw**: `45° N` → *… ɡɾˈado n* (the bare-degree arm leaves the letter, which
   the g2p emits as a bare consonant). Indonesian's normalize.ts documents and fixes exactly this shape.
4. Minor: a run of high vowels glides throughout because the glide test reads the OUTPUT (a glide is not a vowel):
   `iii` → *jjˈi*, `uua` → *wwˈa*. Not a real-word shape.
5. The ASCII hyphen-minus before a number is not read (`-5` → *lˈima*) while U+2212 is (*nɛɡatˈibo lˈima*); the
   header limits the rule to the sign the corpus writes, so recorded rather than claimed.

test/ilocano.test.ts gives 7 `phonemizeWordRules`, 4 `phonemizeWord`, 13 numeric and 37 text `say`, 4
`normalizeIlocano`, contains/not-contains pins and the `zzqx` rules-equals-shipped relation, plus the
`toHaveLength(10)` fallback as a count; the file's two `say` helpers were split by type. Guard proved: the glide
disabled → `the_ts_suite_pins_hold ... FAILED`; restored → ok.

**Gates on the final tree.**
```
parity (all 26 codes in LANGUAGES): every row identical (hil 112/112, ilo 94/94, the rest 200/200)
cargo test --workspace --release: 137 passed + 1 doc-test crate, 0 failed
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
cargo fmt --check: clean
cargo clippy: only module_inception on ilocano/mod.rs in the new files
```
No TS regex was added or changed. Large dumps deleted.

**Implication.** Done on this machine, with the no-corpus caveat of Run 1.

## Run 4 — 2026-10-11 16:50 (#1534: fixing the Run 3 findings, TS first)

**Command.** `npx tsx .probe/1534/q.mts ilo …`; a scan of `tools/corpus/mined/ilo.jsonc` for the compass words;
`npx tsx tools/gen_parity_goldens.mts … ilo` and a diff against the saved golden.

**Question.** Is the two-digit decimal cap protecting anything here, and does the corpus name the compass points?

**Raw finding.**
1. **Decimals.** The normalize header already measured this corpus's three-digit fractions as genuine decimals (HDI
   `0.625`, `0.443`, `0.856`, `6.271 a riwriw`) with no period-thousands group to protect. The cap goes:
   `(\d)\.(\d+)(?![\d.,])`. `3.141 a metro` → *tˈallo pˈunto mˈajsa ʔˈuppat mˈajsa …*. The test that pinned
   `17.865` as not a decimal pinned the defect; it becomes `3.141 a metro` = `3 punto 1 4 1 a metro` (TS, C#; the
   Rust row leaves NOTCONTAINS_PINS). Golden rows moved: `4046.8564224 a kuadrado a metro` (was *… ʔinnˈɛm .
   waloɾˈiwɾiw …*) and `50.3764N` (was *limapˈulo . talloɾˈibo …*).
2. **Trigraphs**, as hil: `queso` → *kˈeso*. Golden rows moved: `Quezon` *kesˈon* → *kˈeson*, `Arguilla`
   *ʔˈaɾɡilla* → *ʔaɾɡˈilla*, `Guide` *ɡidˈɛ* → *ɡˈidɛ*. `Miguel` stays *mˈiɡel* (penult default, as `Migel`).
   `quiet` *kiˈɛt* → *kˈiʔɛt*: the trigraph vowel is now a vowel for the hiatus test; an English word either way.
3. **Compass.** amianan ×59, abagatan ×50, daya ×33, laud ×29 in the mined artifact, as directions (`iti abagatan a
   laud`), and the corpus glosses its own coordinate abbreviation: `16°Am 26', 120°Dy 21' (Am=amianan; Dy=daya)`.
   `(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])` before the bare arm: `45° N` → *… ɡɾˈado ʔamjˈanan* (was *ɡɾˈado n*),
   `12°W` → *… lˈaʔud*. Case-sensitive: a lowercase `n` is not claimed. The corpus's `°Am`/`°Dy` and a direction
   after arc-minutes (`126° 34' E`) are other shapes, not in the issue, untouched.

**Implication.** Mirror into C# and Rust. 5 of 94 ilo golden rows move, each explained above.
