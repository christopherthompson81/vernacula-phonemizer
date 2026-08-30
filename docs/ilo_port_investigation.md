# Ilocano (ilo) — C# port investigation

Chronological log of the runs behind the ilo port.

## Run 1 — 2026-08-30 11:10 — scope

    wc -l src/languages/ilocano/*.ts
          128 ilocano.ts · 449 normalize.ts ·  78 numbers.ts   (655 total)

Three modules plus the data manifest `data/languages/ilocano/ilocano.jsonc` (the symbol tier is
hard-coded in `normalize.ts`, as in Hiligaynon — no jsonc block) and the pronunciation lexicon
`data/languages/ilocano/ilo-lexicon.tsv` (975 word→IPA rows mined from the stress-marked
referees). The load-bearing half is the g2p: a shallow near-phonemic scan where the TRIGRAPHS
⟨gui gue qui que⟩ are tried before the digraph ⟨ng⟩, with a word-initial glottal before a vowel,
penultimate stress, and the Ilocano-distinctive HIATUS — a HIGH vowel ⟨i u⟩ before another vowel
GLIDES (dua→dwa, radio→ɾadjo) while a non-high hiatus keeps the glottal (tao→taʔo). `numbers.ts`
is the native Austronesian set composed MORPHOLOGICALLY (sanga- prefix, vowel-final fusion, the
"a" ligature, the "ket" conjunction), covering 0 … <10⁹.

The closest structural models read were **Hiligaynon** (the same three-file shape, the same
`makeSymbolNormalizer` tier, and — ported days earlier in this same environment — the exact
gate list to reproduce) and **Cebuano** (the shared Philippine core). `Registry.cs` already
routes `case "ilo"` (Registry.cs:479) — the factory registration in `Bootstrap.cs` was the only
wiring missing, the same state as the hil/fo ports found themselves in. `csharp/goldens/ilo.tsv`
(94 rows, mined tier) exists, so the parity gate applied from the first run.

⚠ **NO FLEURS in this environment.** `tools/corpus/` carries no transcript tree at all (the
hil port recorded the same state), so PORTING.md's widening (1) — the corpus-wide FLEURS
differential — is unavailable. The weight falls on the 94-row golden, the mined artifact, the
off-golden probes, the provenance gates, and the exhaustive g2p walk. Stated here because it
changes what the gate can and cannot see, not to soften the verdict.

## Run 2 — 2026-08-30 11:20 — the TS side was NOT clean: #1122, live in this file

Before porting, `test/ilocano.test.ts` was run green (20/20) — but reading step 7 of
`normalize.ts` against the fixed shape in the sibling files found the dotted-abbreviation
callback still carrying the UNFIXED #1122 form:

    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}`);

The pattern is built from the table's own keys (`blng|dr|jr|sr|st`) and carries `i`+`u`, so JS's
case fold WIDENS it: the only measured folder landing on a key letter is U+017F (long s → `s`,
per `csharp/fold-pairs.json`), which matches the `s` of `sr`/`st` while `ſr`/`ſt` is not a key.
The `!` then makes `String.replace` stringify `undefined`:

    npx tsx -e '…'   (pre-fix)
    "Bilin ſr. 1" => norm: "Bilin undefined 1" | say: "bˈilin ʔundɛpˈinɛd mˈajsa"

The word "undefined" is read aloud. Hiligaynon's own `normalize.ts` carries the fixed form
(`w === undefined ? m0 : …`), and the same fix is in 24 other languages' files — ilocano was
simply not swept when #1122 landed. Per the bidirectional policy the fix moves TYPESCRIPT FIRST:

    const w = DOTTED_ABBREV[ab.toLowerCase()];
    return w === undefined ? m0 : `${w}`;

pinned by a new row in `test/ilocano.test.ts` (`say("Bilin ſr. 1")` → `bˈilin ɾ . mˈajsa` — the
match falls through unchanged and the g2p drops the long s it has no rule for). The pin was
verified to FAIL against the pre-fix file (stash + run: `expected 'bˈilin ʔundɛpˈinɛd mˈajsa' to
be 'bˈilin ɾ . mˈajsa'`), so it is not decorative.

    npx vitest run test/ilocano.test.ts        20/20 (was 19/20 + 1 new)
    npx tsx tools/gen_parity_goldens.mts ilo   0 FLEURS + 1 mined + 0 lexicon-only; 0 empty

**Regenerated golden: byte-identical, 0 rows moved** — `csharp/goldens/ilo.tsv` carries zero U+017F
(`grep -c`, 0), so the fix is golden-neutral, which is the expected answer for a fold-widened
near-miss no corpus line writes.

## Run 3 — 2026-08-30 11:35 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer          clean (only the pre-existing Marathi CS0108)
    dotnet run --project csharp/tools/parity -- ilo   ilo  OK  94 rows

94/94 byte-identical on the first parity run. Two port decisions worth recording:

- `phonemizeWord`/`phonemizeWordRules` lowercase through `Js.ToLowerCase`, not
  `ToLowerInvariant` — the current contract (PORTING.md, the #1116 rule) even though the Cebuano
  sibling still carries `ToLowerInvariant`. For this alphabet the two agree on every reachable
  character, but the port follows the contract rather than the sibling (the hil decision, same
  terms).
- The TS `scan` is ported verbatim including its faithful oddity: the 3-char trigraph lookup is
  tried with a 2-char string when the word ends at `i+1`, and that 2-char string CAN hit a
  2-char digraph key, after which the scan advances past the end rather than by one.
  Observationally a no-op (the hit can only happen on the word's last two characters, where both
  advances land past the end) — the C# reproduces it, and the g2p walk (Run 7) covers every
  length-2 word.

## Run 4 — 2026-08-30 11:40 — the tests, pinned to the reference

`IlocanoTests.cs` is the portable half of `test/ilocano.test.ts` — 69 cases: the gliding hiatus
and the glottal-stop contrasts, the lexicon's lexical-residual fixes (garcia/kua/biblioteka),
the OOV fallback, 12 number rows (fusion vs ligature, the ket compounds, sanga- magnitudes, the
≥10⁹ digit-by-digit fallback), the load-bearing numbered order pinned AS TEXT (ranges above
decimals, de-grouping first, the tier above the decimal rule so `NOT_VERSION` still sees the dot
in `802.11m`), de-grouping/decimals (including the digit-list survival and the three-digit
fractional refusal), the clock's three measured arms plus all three non-clock colon classes (the
UTC offset, the scripture reference, the ratio), percent and the five currencies (including the
two spellings that had to be measured — `doliar`, `pisos`), the measure word BEFORE its noun
(where ceb/hil are wrong for Ilocano) plus the cube branch, units/rates/`mph`-as-own-key/
ampersand-spaced-both-sides, the per-slot unit, the time coordinate, ranges (including the
decimal-operand ordering branch and the `maika-19` refusal), degrees (including the sign now
being read), the dotted abbreviations (including the #1122 pin and the personal-initial
refusals), the `c.`-before-a-year rule, the sourced refusals, and the code-point digit fallback
(haw/gn/hil finding). `ManifestMappingTests` gained `IlocanoManifestIsFullyMapped` — every key
in `ilocano.jsonc` is consumed by the C# type; all camelCase, so no `[JsonPropertyName]` needed.
`DEF` is `public` for the test's access, as in Hiligaynon.

    dotnet test --filter "FullyQualifiedName~Ilocano|FullyQualifiedName~ManifestMapping"
                                                        221 pass, 0 fail

## Run 5 — 2026-08-30 11:45 — the corpus differential, mined + probes

`tools/corpus/mined/ilo.jsonc` is the WHOLE corpus available in this environment (no FLEURS):
187 `hard` lines + 40 `sample` lines, extracted to **226 unique lines** (the first line is a
sentence — the trap-38 check). Merged with **135 hand-built probes** (one per normalize arm plus
its adversarial neighbour: the digit-list `0,1,8,9`, the three-digit fractional `17.865`, the
`UTC+08:00`/`UTC−05:00` sign-guard pair, the scripture/ratio colons, all three clock arms and
their refusals, all five currencies, all nine unit keys, `802.11m`, `2 km³` (cubed IS declared
here, unlike hil), the per-slot `km²`/`m²`/`km`/`m`, ranges with decimal operands and the
`maika-19` refusal, `16°Am 26'`, `−224 °C`/`−129 °F`, `Blng.`/`Dr.`/`Jr.`/`Sr.`/`St.`, the
sentence-end `Ungto.` refusal, the author-list initials, `ſr.`/`ſt.` (#1122), `c.`/`ca.` and the
initial refusal, the fraction/multiply refusals, plus the g2p corners and the number corners
including `9007199254740993` at the safe-integer boundary) for **361 lines**, run through all
relevant entry points:

    C# sync   vs TS sync:          0 of 361 differ
    C# async  vs TS sync:          0 of 361 differ   (ilo has no neural path)
    C# norm   vs TS norm:          0 of 361 differ   (both after the pre-pass)

Leak sweep over the same lines: **0 of 722** C# or TS outputs carry a raw ASCII digit or a
symbol (`& % $ € ₱ £ ° ± × ÷`).

⚠ THE MINED ARTIFACT AND THE GOLDEN ARE NOT INDEPENDENT WITNESSES — the 94-row golden is
generated from the same mined tier (`0 FLEURS + 1 mined`), and the two overlap heavily. The
independent weight for the word reader is the g2p walk (Run 8), and the independent weight for
the per-slot keys that the corpus only writes as `km²` is Run 9's probe.

⚠ LEXICON REACH, measured rather than assumed: 169 of the 3,749 distinct words in the 361-line
haystack hit the 975-entry lexicon, so the shipped lexicon-first path is exercised through the
differential, not only the rule fallback.

## Run 6 — 2026-08-30 11:48 — the provenance gates

    parity --poison ilo        distinct poison sites: 0 (SUBSTRING 0, desync 0)
    parity --provenance ilo    tokens 3568/3568 (100.0%)
    parity --ipaspans ilo      tokens with IpaSpan 3184/3184 (100.0%), wrong 0
    seam-parity.mts            ilo: absent from the disagreement table — TS rewrite count == C#
                               Rewrite count (gap 0), as with hil

All 13 `Rewrite` sites in `Normalize.cs` are legitimate pipeline-string seams — none named as
SUBSTRING, so nothing was reverted.

## Run 7 — 2026-08-30 11:50 — the g2p walked, not sampled

Ilocano's alphabet is 30 characters (`a-z` plus `ñ` and the three glottal/hyphen members of the
`NATIVE_CLASS` inventory — one more than hil's 29, because hil carries a single apostrophe) and
the g2p is a function of the scan position, so every 1-, 2- and 3-letter string over the
alphabet is enumerated (**27,930** of them) and phonemized at the WORD level through the SHIPPED
path (lexicon first, then rule) in both engines:

    TS phonemizeWord vs C# PhonemizeWord:   0 of 27,930 differ

This covers every trigraph/digraph adjacency, the gliding-hiatus and glottal contexts (including
the trigraph-typed-as-digraph oddity of Run 3), the hyphen arms (word-initial, word-final,
doubled), the unknown-letter skip, the penultimate-stress selection, and the lexicon's 975 keys
in context, exhaustively rather than by sample.

## Run 8 — 2026-08-30 11:52 — the pattern sweep

Every pattern the port compiles, compared against the TS source:

    13 static C# patterns; every one matches its TS counterpart (flags included). Two are spelled
    with `\u2212`/`\u00B2\u00B3` escapes where the TS writes the literal character (the established
    C# convention, cf. the Zhuang/Haitian minus ports) — same compiled pattern.
    2 dynamic: TOKEN (host-word run spliced, same `giu`) and ABBREV/PER_SLOT (built from the
    tables' own keys, longest-first, stable — the TS `Object.keys().sort((a,b)=>b.length-a.length)`
    and the C# `OrderByDescending` yield the same order: `km²|m²|km|m` and `blng|dr|jr|sr|st`;
    verified against a standalone repro, not assumed).
    NATIVE_CLASS + the nativiser flags (`iu`): identical
    the symbol tier: shared core (Core/NormalizeSymbols.cs), already differentially verified

## Run 9 — 2026-08-30 11:54 — the per-slot probe found a C#-only defect

The 10 per-slot probes (the tier cannot reach a unit in the `per` slot, so all four `PER_UNIT`
keys plus the spelled-out non-doubling case) were added AFTER the clean 361-line run, because
the corpus writes this slot only as `km²` — the bare `m` and `km` keys are the adversarial
neighbours the TS comment says "cost nothing" to declare, and a clean differential over a
haystack that never writes them proves nothing about them:

    'iti 550 a tattao tunggal m'    C#: …tunggal m        TS: …tunggal metro
    'iti 550 a tattao tunggal maysa a m'   C#: …a m       TS: …a metro

C# was missing the bare `m`. The cause: the ported pattern string had a stray `}` swallowed into
the last alternative — `(" + PER_UNIT_ALT + @"})` compiled to `(km²|m²|km|m})`, so the final
alternative was `m}` (m followed by a literal brace) and bare `m` could never match, while `km`
(and everything else) worked. The 361-line differential could not see it: no mined line and no
golden row writes a bare `m` in the per slot. Fixed to the TS shape `(" + PER_UNIT_ALT + @")(?…`,
re-ran the per-slot probes (0 diffs), then RE-RAN everything to confirm the rebuild moved
nothing: 361-line differential 0/361, walk 0/27,930, golden 94/94, C# tests 221/221, poison 0,
provenance 3568/3568, IpaSpan 3184/3184, leak sweep 0/722.

⚠ THE FIRST FIX ATTEMPT MADE IT WORSE AND IS RECORDED BECAUSE IT IS THE SHAPE OF THIS BUG CLASS.
Replacing `})` with `)})` put the brace OUTSIDE the group — `(km²|m²|km|m})` → `(km²|m²|km|m)} `
— an unmatched `)` that threw from the type initializer on every line. The TS pattern has no
brace at all: `(${PER_UNIT_ALT})(?![…])`. The port's string splices are the one place a pattern
can drift from the TS without the pattern sweep catching it, which is why Run 8's verification
was against a standalone repro rather than against the file.

## Run 10 — 2026-08-30 11:56 — the full gates

    dotnet test (full suite)                 4,144 pass, 0 fail   (70 Ilocano + manifest)
    parity (ALL goldens)                     158 languages, 30,764 rows, 0 differ, 0 BLOCKED
    npx vitest run (full TS suite)           5,732 pass, 5 skip, 0 fail (290 files)

`ilo` is gated; nothing moved in the other 157 languages (157 → 158, 30,670 → 30,764 rows, the
+94 being the ilo golden, which regenerated byte-identically). TypeScript changed exactly once:
the #1122 fix (Run 2) with its pin — no other reading was touched.

## Read for correctness — notes, nothing filed

The three questions per file, against the TS docstrings:

- **ilocano.ts — the docstring's promises are what the code does.** Trigraphs before digraphs,
  both before the single letters; the initial and non-high-hiatus glottals and the high-vowel
  glide; penultimate stress; the lexicon-first shipped path with the rule as the non-circular
  path the referee eval measures. Every manifest table is REACHED: all six digraph keys in the
  scan (walk-covered), all nineteen consonant rows, all five vowels, all six clause marks
  through the TOKEN's punctuation arm, the whole `numbers` block through `numberToWords` (all
  ten units, the prefix, the ligature, the connector, all four magnitudes), and the lexicon's
  975 keys through `phonemizeWord` (169 of them in the differential haystack — Run 5).
  **One faithful oddity, recorded rather than fixed:** the header calls ⟨ll⟩ "a native geminate
  [lː]", but the g2p has no length rule — `llanada` ships two plain `l`s, exactly as the
  TypeScript does (the manifest's operative point is the parenthetical, "not the Spanish [lj]").
  Both engines agree; the walk covers every `ll` adjacency.
- **normalize.ts — the thirteen steps run in the documented order**, and the order is what four
  of the probes exist to hold still: de-grouping FIRST (so `676,578 km²` is not seen as
  `578 km²`), the per-slot unit BEFORE the tier, the tier ABOVE the decimal rule (so
  `NOT_VERSION` still sees the dot in `802.11m`), the range rule ABOVE the decimal rule (so
  `3.5–3.8` does not read `5 aginggana iti 3`). The clock's leading-sign guard is what keeps arm
  (a) off the 103 UTC offsets, and the minus rule's lookbehind pair keeps it off `UTC−08:00` and
  the space-separated negative exponent — both as the docstring argues from the corpus.
- **numbers.ts — the docstring's composition rules are the code.** sanga- for 1, fusion for the
  vowel-final digit, the ligature for the consonant-final one (and for every multi-word
  multiplier, which is what `count < 10 &&` enforces), the ket chain, the <10⁹ cut with the
  digit-by-digit fallback. `scaleGroup` is never called with 0 (every caller's divisor is ≥ 1),
  which is what keeps `sero` out of a magnitude slot.

---

# PR review (#1194)

## Run A — 2026-08-30 12:20 — rebase onto main, and the conflict that has bitten this fleet before

The branch was 3 commits behind (`is` #1192, the digit-fallback sweep #1193, `ga` #1195). One conflict,
in `Bootstrap.cs`, resolved by keeping all three registrations. `ManifestMappingTests.cs` auto-merged.

⚠ The auto-merge was CHECKED rather than trusted — a naive keep-both on that file has silently detached
a `[Fact]` attribute from its test three times in this porting run. The test project compiles with 0
errors and the whole suite runs, so the attribute is attached.

    parity -- ilo (after the rebase)   ilo  OK  94 rows

## Run B — 2026-08-30 12:25 — **the pattern scanner was wrong before the port was**

The mechanical pattern diff first reported **8 of Ilocano's 9 TypeScript patterns MISSING from the C#**.
None of them were. The scanner only understood `"..."` C# literals, and this port writes them
`@"..."` — where a backslash is literal and `""` is the escape. A scanner that reports a port as broken
is the failure mode that wastes a review; it was fixed to read verbatim strings before anything else was
believed.

With it fixed:

    TS literals: 9 (9 distinct)    C#: 10 (10 distinct)
    in TS, not in C#:  0
    in C#, not in TS:  1   →  /,/gu

The one extra is the de-grouping step's inner replace: the TS spells it `m.replaceAll(",", "")` (a STRING
replace, so no literal for the scanner to find) and the C# spells it `COMMAS.Replace(m.Value, "")`.
Identical in effect, and `JsRe.Replace` is the right call there — the subject is a matched group.

## Run C — 2026-08-30 12:30 — the six DYNAMIC patterns, dumped from both engines

The clock arms, the per-slot and the abbreviation rule are built with `new RegExp` / string concatenation
on both sides, so no source scanner can see them. Dumped instead — a RegExp-constructor hook on the TS
side, reflection over the `JsRe` static fields on the C# side:

    TS  (?<![\d.:+\-−])([01]?\d|2[0-3]):([0-5]\d)(?!\d)(?=\s*(?:[ap]\.?\s?m\.?(?![\p{L}])|GMT|UTC))  giu
    C#  (?<![\d.:+\-−])(…same…)                                                                  giu
    TS  (?<=tunggal\s(?:maysa\s(?:a|nga)\s)?)(km²|m²|km|m)(?![\p{L}\p{M}²³])                          gu
    C#  (?<=tunggal\s(?:maysa\s(?:a|nga)\s)?)(km²|m²|km|m)(?![\p{L}\p{M}²³])                gu
    TS  (?<![\p{L}\p{M}])(blng|dr|jr|sr|st)\.                                                         giu
    C#  (?<![\p{L}\p{M}])(blng|dr|jr|sr|st)\.                                                         giu

All six agree; the only differences are escape-vs-literal for U+2212 and ²³, which JsRegex resolves
identically (and the differentials confirm). **The PER_SLOT alternation is `(km²|m²|km|m)`** — the stray
`}` the port's own probe caught is gone, and both `ABBREV_ALT` and `PER_UNIT_ALT` come out in the same
order on both sides (`OrderByDescending` is stable, matching JS's `Array.prototype.sort`).

## Run D — 2026-08-30 12:35 — the differentials

One process per side, `clearForeignOov()` once, rows in order. Transport is arrays of UTF-16 CODE UNITS,
so a lone surrogate survives (a JSON string cannot carry one; a UTF-8 file makes it U+FFFD — #1193).

    corpus  (543 lines: 262 mined + 132 attest + 149 probes)   norm 0 · text 0
    generated haystack (3,994 lines)                            norm 0 · text 0
    numbers (0…200,000 exhaustive + boundaries + stride + fallback arms; 200,203)     0 differ

The g2p ENUMERATED, at both entry points (the shipped lexicon-first path and the pure rule path):

    full 30-character NATIVE_CLASS alphabet, 1–3 letters      27,930 words   0 differ  (both paths)
    13 class representatives, 5 letters                      371,293 words   0 differ  (both paths)

## Run E — 2026-08-30 12:40 — **THE DEFECT: `PhonemizeWord` threw on a lone surrogate**

The astral/surrogate walk — U+1F600 and its two halves crossed with the letters that decide the scan,
8,379 words — found it:

    PhonemizeWord("a\ud83d")   TS: "ʔˈa"   C#: !!ERR String contains invalid Unicode code points
    2,205 of 8,379 words threw   (the RULE path: 0 of 8,379 — it normalizes composed IPA, not the input)

`Ilocano.cs:123` built the lexicon key with `Js.ToLowerCase(word).Normalize(NormalizationForm.FormC)`.
**.NET's `string.Normalize` refuses a string carrying an unpaired surrogate; JS returns it unchanged.**
A g2p that indexes UTF-16 units hands the halves over one at a time, so this is a designed-for input.

⚠ AND IT IS THE THIRD APPEARANCE OF ONE HAZARD: `LatinPhones` already guards it for its own NFD,
`Js.ToLowerCase` had it via `char.ConvertFromUtf32` (#1195), and the language engines have it on the raw
input word. A fleet sweep from the SHIPPED entry point measured the scale:

    C#:  193 languages × 5 surrogate probes:  100 threw, 715 ok   —  25 languages
         ab ak as bal bm chr chv crh ee eu fa he hmn ht ka ln pbt ps qu rup sv syl ug wo za
    TS:  the same 25 × the same probes:         0 threw, 125 ok

Filed as **#1199** (46 sites). Fixed HERE: the Ilocano site, plus the shared `Js.Normalize` the sweep
will use.

## Run F — 2026-08-30 12:45 — **and the first fix was wrong; its own pin caught it**

The obvious helper body was `IsWellFormedUtf16(s) ? s.Normalize(form) : s`. That is a DIVERGENCE, not a
fix — **JS still normalizes the well-formed parts around an unpaired half**:

    "\uD83Dé"              .normalize("NFC")  →  "\uD83Dé"     (NOT unchanged)
    "a\uD83Déb"  .normalize("NFC")  →  "a\uD83Déb"

The shipped body splits at each unpaired surrogate — every one is a starter, so it blocks composition
across itself — and normalizes each run on its own. Measured against Node over a combinatorial fuzz of
surrogate halves, combining marks, precomposed/decomposed letters, Hangul (algorithmic composition) and
a singleton exclusion, at 1–3 positions:

    7,239 strings, NFC: 0 differ    NFD: 0 differ

and the walk that found the throw, re-run: **0 of 8,379** on both entry points.

## Run G — 2026-08-30 12:50 — the adversarial fuzz, and the one class it leaves

    hostile fuzz (850 lines)   norm: 0 differ    text: 17 differ

**All 17 contain a Tifinagh code point** (checked mechanically, not eyeballed: every differing row has a
character in U+2D30–2D7F, and the residue is empty). That is #1196 — Tifinagh routes to `shi`, which is
not ported to C#, so the foreign run is dropped in every language. `Registry.PortPending` names it:
`PORT PENDING requested: tashelhit`. Not this port's, and not a regression.

## Run H — 2026-08-30 12:55 — the seam gates pointed at a REAL corpus

The 94-row golden is 94 DISTINCT texts (unlike ga's 3), so it is a better witness than most — but still
94 rows. A 4,501-row reference was generated FROM THE TYPESCRIPT over the corpus + haystack, swapped in
for `csharp/goldens/ilo.tsv`, both engines' gates run, and the golden restored.

    parity ilo                 4,501 rows OK, 0 differ
    parity --poison ilo        0 sites (SUBSTRING 0, desync 0)
    parity --provenance ilo    40,599/40,599 (100.0%)
    parity --ipaspans ilo      36,085/36,085 (100.0%), wrong 0

    provenance-poison.mts      0 sites
    provenance-coverage.mts --full   40,599/40,599      ipa-span-coverage.mts --full  36,085/36,085
    seam-parity.mts            ilo absent from the disagreement table

The token counts match EXACTLY across the two engines, which is the stronger reading than either
percentage alone.

    leak sweep   corpus 0/543 · haystack 0/3,994, on BOTH engines

## Run I — 2026-08-30 12:58 — the TypeScript fix, verified rather than trusted

This PR's TS change is the #1122 dotted-abbreviation miss branch. The claim that its pin fails against
the pre-fix file was CHECKED by reverting the file and running the suite:

    against origin/main's normalize.ts   1 failed | 19 passed   ← the new pin, and only it
    against the fixed file               20 passed

## Read for correctness — two unreachable divergences, recorded not changed

Both are `"".includes("")`, which is TRUE in JS and false in the C# equivalents:

- `isVowelFinal("")` — TS `"aeiou".includes(w[w.length-1] ?? "")` is true for an empty word; the C#
  guards `w.Length > 0`. Reachable only if a `units` entry were empty.
- `stressed`'s nucleus test — TS `VOWEL_PH.includes(u[0] ?? "")` counts an EMPTY unit as a nucleus; the
  C# does not. Reachable only if a manifest value were empty.

Neither is reachable: `ilocano.jsonc` has **no empty value** in `digraphs` (6), `consonants` (24),
`vowels` (5), `clausePunctuation` (6) or `numbers.units` (10) — checked mechanically, not assumed. The
5-letter walk covers every path that could reach them.

## Run J — 2026-08-30 13:05 — the full gates

    dotnet test (full suite)          4,374 pass, 0 fail
    parity (ALL goldens)              160 languages, 31,164 rows, 0 differ
    npx vitest run (full suite)       290 files, 5,738 pass, 0 fail

(5,738, not 5,739: this PR's TypeScript change adds an `expect` to an EXISTING test rather than
a new case.)
