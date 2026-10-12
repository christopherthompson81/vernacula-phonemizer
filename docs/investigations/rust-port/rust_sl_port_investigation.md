# Rust port: Slovenian (sl)

Slovenian has its own engine (not the Serbo-Croatian g2p): `slovenian/{manifest,g2p,numbers,normalize,slovenian}.ts`.
The g2p is a consonant scan (⟨dž⟩, ⟨lj nj⟩ with the coda j-drop, ⟨x⟩), the syllabic-r schwa and regressive
voicing with final devoicing; stress comes from stress.tsv (every key also filed under its `nat` fold, #1068),
else a known compound tail's stress shifted by its prefix's nuclei, else the penultimate. normalize.ts is the
largest module (the clock as a feminine ordinal in the case its preposition governs, regnal ordinals, licensed
`N.` ordinals with a coordinated list, scores and ranges, fractions with the denominator nouns, the five-slot
count selector `slCountForm` and the gender repair of 1–4 after the symbol tier). No neural entry, no Roman
policy. Core imports: `clauses`, `hostWord` (`LATIN_RUN`, `makeNativiser`), `loadTsv` (with `fold`),
`numbers` (`digitIndex`), `normalizeSymbols`, `initialisms`, `provenance`, `loadManifest`: all ported, so NO core
module is added. normalize.ts imports `COUNTED`, `SYMBOLS` and `slCountForm` from slovenian.ts and slovenian.ts
imports `normalizeSlovenian`; Rust keeps the same split (the statics live in slovenian.rs).

## Run 1 — 2026-10-11 10:30 (port, golden)

**Question.** With the five modules ported and `sl` registered, what does the golden say?

**Command.** `cd rust && cargo build --release && ./target/release/parity sl`.

**Raw finding.** First build compiled clean; `sl: 200/200 identical, 0 differ`.

**Implication.** Differentials next.

## Run 2 — 2026-10-11 10:45 (per-module differentials, pins, gates)

**Question.** Do normalize.ts (each pass), the g2p, the stress tiers and the compositor match beyond the golden?

**Command.** New dump entries `sl-normalize`, `sl-g2p`, `sl-numbers` replayed by one `fn-diff` arm, plus
`LANGS=sl phonemize-sync` / `phonemize-best` / `trace`; `FLEURS_ROOT=<external-drive>/…`; new synthetic
`probes/sl.txt` (40 lines, at least one per arm with the neighbour it must decline).
- `sl-normalize`: `normalizeSlovenian`, `normalizeSlovenianInitialisms` and the exported `SYMBOLS` on every text;
  `isUnreadableSlovenian` on every letter run; synthetic rows: `N.` before all 95 licensors (read from the TS
  source) and five bare-ordinal followers over 22 numbers, coordinated lists, decades, hyphen compounds, mixed
  and bare fractions, four regnal titles, every hour × 4 minutes after 10 prepositions (and the dot and UTC
  forms), score/range pairs, every COUNTED form after 1–5, `do 3` and a decimal, the dotted abbreviations and
  honorifics before 7 followers; `ordinalWords` over −1..1100 and corners × all 15 slots.
- `sl-g2p`: `phonemizeWord`, `toSegments`, `nat`, `stressLexiconHas` over every stress.tsv key (with the folded
  aliases), every 53rd key with 6 prefixes (the `bySuffix` tier) and uppercased, every letter run of the texts
  (as written, lowercased, nativised), all 1–2 letter strings, all 3-letter strings over 19 context letters, edges.
- `sl-numbers`: `numberToWords` over 0..20000, multiples and powers to 1e21, corners; `readDigits` on raw strings
  (a lone surrogate included).

**Raw finding.** First build, every replay clean:
```
sl-normalize:   57011 identical, 0 DIFFER  (golden 366 / fleurs 11055 / probe 117 / synthetic 13365 / words 15428 / numeric 16680)
sl-g2p:        248188 identical, 0 DIFFER
sl-numbers:     27075 identical, 0 DIFFER
phonemize-sync:  3846 identical, 0 DIFFER
phonemize-best:  3846 identical, 0 DIFFER
trace:           3846 identical, 0 DIFFER
pins: test/slovenian.test.ts 160 extracted (by .probe/sh/pins.mts, generalised to every language of the group;
      it resolves `sl.text` to the engine or the registry by the nearest `const sl =` definition, since the
      test file defines both — the first attempt took the engine for both and threw on a Roman-numeral pin
      that only the registry's Roman pass reads), 47 skipped (computed expectations, `inflect`/`ordinalBase`)
cargo test --release --workspace: 137 + 1 passed; parity all 24 languages 200/200
clippy: one `if_same_then_else` in count_nuclei (merged into one condition), then only module_inception
```

**JS semantics reproduced on purpose.** stress.tsv values are JS numbers: a fractional or negative ordinal
that is `< nuclei.length` indexes `nuclei[at]` as undefined and no mark is placed (no row has one).
`readDigits` splits by UTF-16 unit. `DOTTED[ab.toLowerCase()]!` stringifies `undefined` on a miss (no
fold-widened miss is reachable from these keys).

## Run 3 — 2026-10-11 10:55 (TS findings from reading; reported, not fixed)

**Command.** `npx tsx .probe/sl/check.mts <text>` (normalizeSlovenian and phonemize in the TS); synthetic inputs.

**Raw finding (TS output, verbatim):**
1. **A list dash before a number reads as a minus.** `Seznam: - 5 jabolk.` → `Seznam: minus 5 jabolk.` The
   sign rule is `(^|[\s(])[-−]\s?(?=\d)`, with none of the guards sr/bs carry (a digit anywhere to the left, a
   digit immediately after the sign).
2. **slovenian.ts's `Counted` docstring says "the tokenizer reads a bare digit as the feminine form", but the
   unit table reads 2 as the MASCULINE `dva`** (`units: ["nič", "ena", "dva", "tri", "štiri", …]`: ena/tri/štiri
   are feminine, dva is not). So a feminine noun outside COUNTED takes the masculine: `Ura je 2 uri in 3 ure.` →
   `… dʋa ˈuri …` (*dve uri* wanted). The gender repair only knows COUNTED's nouns.
3. The `(?<!do )` guard of the gender repair leaves `Od 1 do 3 kilometri.` reading `tri kilometri` (*trije*
   wanted); the TS comment states it as a deliberate range exclusion, recorded here as its visible cost.

Every manifest field is read (checked field by field); nothing routes to an unported engine (no port-pending row).

**Implication.** Reported in the PR; Rust reproduces the TS.

## Run 4 — 2026-10-11 17:10 (#1532: Run 3's findings 1 and 2, fixed TS-first)

**Question.** Does removing the spaced form from the sign rule cost a real minus?

**Command.** `grep -E '(^|[ (])[-−] ?[0-9]' ` over the unique FLEURS sl_si texts, then the before/after normalizer
diff over all 1,903.

**Raw finding.** The grep finds no spaced minus and no list dash before a figure: 0 matches. Diff: 0 lines
change. The fix (`(^|[\s(])[-−](?=\d)`) is reached only by the synthetic probe: `Seznam: - 5 jabolk.` →
`Seznam: - 5 jabolk.` (IPA `… sɛznˈam , pɛt jˈabɔlk .`), and `-5 stopinj` still reads *minus*.
Finding 2 is a docstring correction (slovenian.ts `Counted`): the tokenizer reads 1/3/4 as feminine *ena tri
štiri* and 2 as masculine *dva*. The behaviour it describes (`2 uri` → *dva uri*) is declined: the gender repair
would need the gender of every feminine noun, which no table here has. Finding 3 stays as stated (a deliberate
range exclusion).

**Implication.** No golden should move for sl.

## Run 5 — 2026-10-11 18:10 (#1532: golden, C# and Rust mirrored)

**Raw finding.** `gen_parity_goldens.mts sl`: 0 rows move. C# and Rust carry the same one-character pattern
change. `sl-normalize` replay: 57019 identical, 0 DIFFER (probe 2 new synthetic lines); parity sl 200/200.
