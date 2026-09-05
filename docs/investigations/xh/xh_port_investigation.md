# Xhosa (xh) — C# port investigation

Chronological log of the runs behind the xh port and the TypeScript fixes it sent back.

Corpus: FLEURS `xh_za` (3,466 rows, columns 3+4 → 3,018 unique lines), `tools/corpus/mined/xh.jsonc`
(134 string leaves), and the 200 golden texts (95 unique). Union: **3,047 unique lines**
(`.probe/xh/corpus.txt`). There is no `tools/corpus/attest/xh.jsonc`.

## Run 1 — 2026-08-27 — what does the corpus contain, and what does the pass drop?

Question: which arms of `normalize.ts` does real Xhosa text reach, and what reaches the g2p raw?

    .probe/xh/corpus.mts, .probe/xh/residual.mts, .probe/xh/tokens.mts

Shape counts over the 3,047 lines (lines containing at least one instance):

| shape | n | shape | n |
|---|---|---|---|
| a digit | 657 | letter-hyphen-digit (the concord) | 493 |
| all-caps run | 114 | unit key adjacent to a number | 40 |
| decimal comma | 38 | comma-grouped thousands | 36 |
| decimal dot | 36 | range dash | 24 |
| colon clock | 22 | English ordinal suffix | 18 |
| currency sign | 16 | space-grouped thousands | 15 |
| a.m./p.m. marker | 13 | rate slash | 12 |
| `Mnu` honorific | 10 | percent | 8 |
| mph/kph | 6 | `km²` | 6 |
| single-dot capital pair | 6 | dotted capital run | 4 |
| `Jr.` | 4 | `njll` | 4 |
| ampersand | 4 | degree sign | 4 |
| `+` | 4 | `US$` | 3 |
| dot-clock + timezone | 2 | glued personal initial | 2 |

**Zero attestation**, so any rule for them rests on the probes alone: the relational signs `= ≈ < >`,
`÷`, U+2212, caret exponents, and any digit run ≥ 16 digits.

**Residual audit** — characters surviving `normalizeXhosa` + the shared symbol tier that the TOKEN regex
does not claim, i.e. dropped or read as a pause. Everything found is expected (concord hyphens ×2,436,
quotes, brackets, parentheses, the word/word slash ×28) **with one exception**:

- `°` ×1 survives, in `…kwimpuma 35°w`. The compass arm (step 12b) is `([NSEW])` under `gu` while the
  Celsius arm one line above is `[CF]` under `gui`, so the lowercase column's `35°w` matches neither
  arm: the degree sign is DROPPED and the `w` reaches the g2p as a bare [w]. See Run 4.

**Leading-zero digit runs reaching the number path** (`Number("0230")` → 230): `00` ×4, `0230` ×2,
`09` ×2. Read: the `00`s are score/clock fragments in the lowercased column, the `09` is `1: 09.02`
(a sports pace, where *nine* is the correct reading anyway), and the only genuine one is `0230UTC`
— see "found and not fixed".

**Digit runs ≥ 16 digits: 0.** So the ACCEPTED_LOSSY entry is latent here, not live (Run 3).

## Run 2 — 2026-08-27 — the reported `\p{Lu}`-under-`/i` guard at normalize.ts:194

Question: the sl port (#1079) reported `(u?)Mnu\.?(?=[  ]\p{Lu})` under `giu` as a DEAD positive
guard. Is it dead here, what was it written to prevent, and what does the corpus say it costs?

    grep -oiP '(?<![\p{L}])u?mnu\.?(?=[ \x{00a0}])[^ ]* [^ ]+' .probe/xh/corpus.txt

Raw finding — **the guard is dead exactly as reported**, and all 10 corpus instances are honorific +
name:

    1  Mnu. Rudd        1  mnu rudd
    1  UMnu. Costello   2  umnu costello
    2  uMnu Reid        2  umnu reid
    1  uMnu Costello.

Five are the properly-cased column 3, five are FLEURS' lowercased column 4. So unlike Slovenian —
where the same shape made the honorific fire on the accusative pronoun `ga` and the regnal rule match
ordinary prose — **xh has no attested false positive**: `mnu`/`umnu` is not a Xhosa word, and the token
must be followed by a space, so a longer word starting `mnu…` cannot match either.

⚠ **BUT THE `/i` IS NOT REMOVABLE ON ITS OWN, and that is the part the report could not know.** The
corpus writes the concord in three cases — `Mnu.`, `uMnu`, and sentence-initial `UMnu.` — and `(u?)` is
case-sensitive material under an `i` flag doing two jobs at once. Simply dropping the flag would stop
`UMnu. Costello` expanding, a REGRESSION in the properly-cased column. The sl repair applies: spell the
abbreviation's own case into the class (`([uU]?)Mnu`) and drop the flag.

Measured cost, stated rather than hidden: **5 occurrences over 4 corpus lines change, and every one is
FLEURS' all-lowercase column 4** (`umnu reid`, `umnu costello`, `mnu rudd`) — a transcript artifact, not
Xhosa text. **0 golden rows carry the string at all.**

## Run 3 — 2026-08-27 — ACCEPTED_LOSSY, and whether xh has its own evidence to come off it

Question: `test/large-numeral-fidelity.test.ts` lists xh in the class "NO FALLBACK AT ALL — zu composes
right past it. Giving these a digit-at-a-time arm is a per-language behaviour ADDITION … and wants the
language's own evidence." Does xh have that evidence?

    npx tsx .probe/xh/say.mts 1000000000000000000001 1000000000000000000009

    both → iz̤iɡ̤ˈiːd̤i iz̤iɡ̤ˈiːd̤i iz̤iɡ̤ˈiːd̤i iwˈaːkʼa

Raw finding: identical readings, and the reading is not merely imprecise — it is *izigidi izigidi
izigidi iwaka*, "million million million thousand", the recursion having lost every digit above 2⁵³.

**It has the evidence, and it is in this language's own file.** `normalize.ts`'s `spell()` already reads
a fractional part DIGIT AT A TIME through the same compositor, and its docstring states the reason
("reading `34` as a number would say *amashumi amathathu nane* — 'thirty-four' — which is a different
quantity"). A digit-at-a-time arm above 2⁵³ is therefore not an invention: it produces exactly the string
the existing decimal path already produces for the same digits — `KU[d]` for 1-9, the manifest's `zero`
(*iqanda*) for 0. The Bantu sibling `sesotho/numbers.ts` uses the same `Number.isSafeInteger` gate.

Threaded `raw` through `numberToWords(n, raw?)` and passed the token string at the one call site. ⚠ The
call site passes the STRIPPED string by construction: step 4 removes the grouping commas/spaces from the
TEXT, so the `\d+` token the tokenizer matches is already separator-free. **xh comes off ACCEPTED_LOSSY.**

## Run 4 — 2026-08-27 — the a.m./p.m. marker has no right edge

Question: step 8's marker group is `(?:[  ]*([AaPp])\.?[Mm]\.?)?`. Nothing terminates it. What
does it do to a Xhosa word after a clock?

    npx tsx .probe/xh/say.mts "Ngentsimbi ye 9:30 amaXhosa afika."

Raw finding — **the marker eats the first two letters of the following word**:

    before: ye ithoba namashumi amathathu kusasaaXhosa afika
            ŋɡ̤ɛnt͡sʼˈiːmbi jˈɛː itʰˈɔːɓa namaʃˈuːmi amatʰˈaːtʰu kʼusasaakǁʰˈɔːsa afˈiːkʼa .

`amaXhosa` is destroyed AND a spurious *kusasa* ("in the morning") is emitted. This is not an exotic
neighbour: `ama-` is one of Xhosa's most common noun-class prefixes (*amaqondo, amashumi, amakhulu,
amaXhosa, amapolisa*), and `[  ]*` allows the clock and the "marker" to be separated by any run of
spaces, so a clock followed by ANY `am…`/`Am…` word matches. `14:00 Amabini` → *…kusasaabini*.

Attested: **0** — the corpus's 13 markers are all real (`a.m.`, `p.m.`) and its other clocks are followed
by `kusasa`, `ngokwexesha`, `ababhikishi`, `,`. So this is a latent wrong reading, of the class the
playbook calls trap 56: it produces a plausible-looking Xhosa pseudo-word (*kusasaaXhosa*) that no leak
class and no DROP test can see.

Fixed by giving the marker a right edge — `(?![\p{L}\p{M}])` — which is what tells a genuine `9:30 AM`
from a swallowed prefix. Both spellings still read (`10:30p.m.`, `9:30 AM`).

## Run 5 — 2026-08-27 — the compass arm's case, against the Celsius arm's

Question: step 12's Celsius arm carries `i`; the compass arm one line below does not. Is the asymmetry
load-bearing?

Raw finding: `35°W` → *amaqondo … entshona*; `35°w` → `amaʃˈuːmi amatʰˈaːtʰu nanɬˈaːnu w` — the degree
sign dropped outright and the `w` read as a bare [w]. The module's own header states the standard this
violates: a scale letter reaching the g2p raw is the defect the whole step exists for, and a DROPPED sign
is the one outcome that cannot be right.

⚠ **NOT FIXED, and the reason is the count.** The single instance is FLEURS' lowercased column 4, i.e. a
transcript artifact and not Xhosa orthography — a longitude is written `35°W`. Adding `i` to the arm would
be justified by nothing but that artifact, and it widens the arm onto a bare one-letter `n`/`s`/`e`/`w`
after a degree sign, which Xhosa's vowel-initial locative prefixes make less far-fetched than it looks.
Recorded with its count instead. (The asymmetry with `[CF]` is real and is itself unmeasured: `°c` has 0
instances too.)

## Run 6 — 2026-08-27 — the colon a declined clock leaves behind

Question: `:` is declared clause punctuation in `xhosa.jsonc`. Step 8 DECLINES a sports time on purpose and
step 9 declines anything that is not `hh.mm` before a timezone. What happens to the colon then?

    .probe/xh/counts.mts  → 8 occurrences of a colon still between two digits after normalize

Raw finding — every one of them becomes a PAUSE in the middle of a quantity:

    le-4: 41 3 0, 2: 11 6 0 imizuzu   → lˈɛː kʼˈuːnɛ **,** amaʃˈuːmi amˈaːnɛ nˈaːɲɛ …
    eyi-1: 09 0 2 kancinci            → ˈɛːji kʼˈuːɲɛ **,** itʰˈɔːɓa ikǃˈaːnd̤a kʼuɓˈiːni …
    efumana 2:2 isidanga seklasi      → ɛfumˈaːna kʼuɓˈiːni **,** kʼuɓˈiːni isid̤ˈaːŋɡ̤a

Three constructions across 8 occurrences (the two sports paces and the UK degree class `2:2`), and **all
eight are numeric relations — not one is punctuation.** This is the playbook's "a guard whose safe branch
strands a separator the tokenizer then reads as CLAUSE PUNCTUATION", live.

Fixed by dropping a colon that has a digit on BOTH sides, after both clock rules have had their claim.
Nothing is invented: the operands were already read as bare numbers and only the false pause goes. The
digit-on-both-sides requirement is what keeps a real colon (`Umzekelo: 5 abantu`, `ngo-2007: kwathi`) —
and the corpus has zero digit-colon-digit instances that are punctuation.

## Run 7 — 2026-08-27 — the corpus-wide differential and the off-golden probes

TS ↔ C#, sync AND async:

- **corpus-wide differential**: 3,047 unique lines × 2 modes = **6,094 comparisons, 0 differ, 0 throws**;
- **off-golden probes**: 184 hand-built lines — one per arm of `normalize.ts` plus the adversarial
  neighbour each arm must decline, plus the g2p and loan-lexicon corners — × 2 modes = **368 comparisons,
  0 differ**;
- **parity gate**: `xh` 200/200 byte-identical on the FIRST run, both before and after the colon fix.

⚠ **sync and async are byte-identical for every one of the 3,047 corpus lines.** That is not a broken
async path: xh has no tagger of its own, and its embedded English goes through the already-filed
"a Latin-script host never prewarms" finding (now in `docs/investigations/csharp-port/csharp_port_findings_investigation.md`), so the foreign reader serves the n-gram
reading in both modes. Stated rather than left implied, because for a neural language the same number
would mean the tagger was never installed.

⚠ **What the corpus does NOT exercise, so that the clean differential is not over-read.** Zero attestation
across all 3,047 lines for: the relational signs `= ≈ < >`, `÷`, U+2212, caret exponents, the euro sign,
a digit run of 16+ digits, a comma decimal with a 3+ digit tail, a decimal range carrying a unit, and
spaced personal initials. All of those rest on the probe list alone.

**Literal-inventory audit** (code points per file, TS vs C#): no control characters on either side, and
every "one side only" entry is explained — U+00A0/U+202F/U+2009 appear literally in the C# where the TS
writes `\u00a0` escapes (the Zulu port's convention), and the IPA letters and box-drawing runs that appear
only in the TS are comment text the porting contract deliberately does not transcribe.

**Reachability.** Every `UNIT_WORD` (6), `PER` (3), `CUR_WORD` (5), `COMPASS` (4), `MAGNITUDES` (6),
`WORD_ACRONYMS` (11) and `NGUNI_LETTER_NAME` (26) row is reached by a probe. ⚠ `COALESCE` has **three dead
keys**: `e`, `o` and `u`. `connective(n)` looks the table up on the first letter of `numberToWords(n)`, and
every head it can produce begins with `i` or `a` (*ishumi, amashumi, ikhulu, amakhulu, iwaka, amawaka,
isigidi, izigidi*). Inert, not wrong — the file's own comment says the three-way set is written out for
completeness — and recorded so nobody re-derives it.

## Run 8 — 2026-08-27 — the regex translator over the new patterns

    npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff
    → 117,045 probe results identical, 0 DIFFER, 0 threw, 0 patterns refused

Every pattern this port adds goes through `JsRegex.Compile` with the TS string verbatim, and the freshly
extracted corpus (which now contains them) is byte-identical to Node on all 51 probes.

⚠ **THE CHECKED-IN `csharp/regex-corpus.jsonl` IS STALE, and this is a finding, not a side effect of mine.**
Re-extracting it produced a 579-line diff in languages this port never touched — `zulu/normalize.ts` alone
shows `(\d{1,3})(,\d{3})+` where the source now reads `([1-9]\d{0,2})(,\d{3})+`, and the doubled-plain-space
classes the artifact records were widened to `[ \u00a0\u202f\u2009]` by #925/#935. So the artifact predates
those sweeps: re-running the harness from it exercises patterns that no longer exist and misses the ones that
do. The file was reverted rather than regenerated here, because a 579-line refresh of a shared artifact does
not belong in a language bring-up — but it wants regenerating and committing on its own, and until then the
harness must be run after `extract_regexes.mts`, never from the checked-in copy.

---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the xh port (2026-08-27) — the reported `\p{Lu}` guard was DEAD, and the `/i` was doing a second job

**xh (Xhosa / isiXhosa, ~8M L1)** — 4 files, ~470 C# lines over a 592-line TS module. It is the Nguni
sibling of `zu` and REUSES the ported `Zulu/G2p.cs` scan, `NguniLoans.cs` and `ZuluManifest` shape with its
own table (⟨rh⟩→[x], the Xhosa number words); the shared core needed no change. Gate **118 → 119 languages,
23,296 → 23,496 rows, 0 differ, 0 BLOCKED**; C# tests 1,360 → 1,385. **200/200 on the first parity run**,
before and after the fourth fix. Full log in `docs/investigations/xh/xh_port_investigation.md`.

`createXhosa` takes TWO English hooks and both are live: `readAsEnglish` for an embedded Latin run, and a
PREDICATE asking whether the English LEXICON knows a word — the third of the three signals that decide
click-vs-foreign. ⚠ Those are different questions, and the C# already had the right one: `EnglishKnownWord`
is `KnownWord` (CMUdict + heteronyms, `string?`) and the registry threads `w => … is not null`, matching the
TS's `knownWord(w) !== undefined`. The engine's `KnownWord`/`CanPronounce` distinction would have widened
signal 2 onto every OOV word.

Fixed in TypeScript first with tests, goldens regenerated — **0 of 200 golden rows moved for all four**:

- ⚠ **THE `\p{Lu}`-UNDER-`/i` GUARD REPORTED BY THE sl PORT IS REAL, AND THE REPAIR IS NOT "DROP THE FLAG".**
  `(u?)Mnu\.?(?=[  ]\p{Lu})` under `giu`: the lookahead requires only a letter, so the honorific's
  "expanded ONLY before a capitalised name" guard requires nothing. Unlike Slovenian — where the identical
  shape made `ga.` fire on the accusative pronoun and the regnal rule match ordinary prose — **xh has no
  attested false positive**: all 10 corpus instances are honorific + name, and `mnu`/`umnu` is not a Xhosa
  word. ⚠ **But the `i` was doing a SECOND job the report could not see**: the corpus writes the concord
  three ways — `Mnu.`, `uMnu` and sentence-initial `UMnu.` — and `(u?)` is case-sensitive material under
  that flag, so dropping it alone would stop `UMnu. Costello` expanding, a regression in the properly-cased
  column. Fixed the sl way, by spelling the concord's own case into the class (`([uU]?)`). Measured cost,
  stated: 5 occurrences over 4 corpus lines change and **every one is FLEURS' all-lowercase column 4** — a
  transcript artifact. **The fleet sweep for this shape is now down to one site**, `slovenian`'s `CLOCK_GOV`,
  which that port filed deliberately.
- ⚠ **THE a.m./p.m. MARKER HAD NO RIGHT EDGE, AND `ama-` IS A NOUN-CLASS PREFIX.** Step 8's optional group
  `[  ]*([AaPp])\.?[Mm]\.?` ended wherever it liked, so ` Am` of the FOLLOWING WORD matched it:
  `9:30 amaXhosa` read *ithoba namashumi amathathu **kusasa**aXhosa* — the word destroyed and a spurious
  "in the morning" emitted; `14:00 Amabini` → *…kusasaabini*. `ama-` heads some of the commonest nouns in
  the language (*amaqondo, amashumi, amakhulu, amapolisa*), so the neighbour is ordinary text rather than an
  adversarial construction. ×0 attested, and trap 56 exactly: the pseudo-word it leaves is invisible to every
  leak and DROP class. Fixed with `(?![\p{L}\p{M}])`; `9:30 AM` and `10:30p.m.` still read.
- ⚠ **xh COMES OFF `ACCEPTED_LOSSY`, ON ITS OWN FILE'S EVIDENCE.** It was in the list's "NO FALLBACK AT ALL"
  class ("a per-language behaviour ADDITION … wants the language's own evidence"), and the compositor has no
  ceiling — it recurses through `izigidi` multipliers — so above 2⁵³ it composed right past the rounding and
  `…001` and `…009` both read *izigidi izigidi izigidi iwaka*. The evidence was in `normalize.ts`: `spell()`
  already reads a decimal's fractional part DIGIT AT A TIME through the same compositor, for the reason its
  docstring gives. The fallback emits the string that path already emits (`KU[d]`, and the manifest's `zero`
  for 0 — ⚠ `KU[0]` is the EMPTY STRING), so nothing is invented. ⚠ The call site passes the
  SEPARATOR-STRIPPED token by construction: step 4 de-groups the TEXT, so the `\d+` match is already clean.
  Its sibling `zu` has no such precedent in its own file and stays listed.
- ⚠ **A DECLINED CLOCK STRANDED ITS COLON, AND `:` IS DECLARED CLAUSE PUNCTUATION.** Step 8 refuses a sports
  time on purpose (`4: 41.30` is a pace, not 4:41), and the colon then reached the tokenizer as a PAUSE in
  the middle of a quantity. **8 occurrences across three constructions** — the two paces and the UK degree
  class `2:2 isidanga seklasi` — and not one surviving digit-colon-digit in the corpus is punctuation. The
  playbook's "safe branch strands a separator the tokenizer reads as clause punctuation", live. A colon with
  a digit on BOTH sides is dropped after the two clock rules have had their claim; nothing is invented,
  because the operands already read as bare numbers. `Umzekelo: 5 abantu` and `ngo-2007: kwathi` keep theirs.

**Widenings.** Corpus-wide differential over **3,047 unique lines** (3,018 FLEURS `xh_za` col 3+4, 134 mined,
95 golden texts) × sync AND async = **6,094 comparisons, 0 differ, 0 throws**, plus **184 off-golden probes**
(one per arm plus the adversarial neighbour each arm must decline, the g2p corners and the loan lexicon) ×
both modes = 368 more, 0 differ. ⚠ **sync and async are byte-identical for every corpus line, and that is
correct here**: xh has no tagger of its own and its embedded English hits the already-filed "a Latin-script
host never prewarms" path, so the foreign reader serves the n-gram reading in both modes. ⚠ The corpus
carries **ZERO** instances of the relational signs `= ≈ < >`, `÷`, U+2212, a caret exponent, the euro sign, a
16+-digit run, a comma decimal with a 3+ digit tail, a decimal range carrying a unit, or spaced personal
initials — all of those rest on the probe list alone. Literal-inventory audit: no control characters either
side, and every one-sided code point is explained (the C# writes U+00A0/202F/2009 literally where the TS
escapes them; the IPA letters appear only in TS comment text). Reachability: every `UNIT_WORD`, `PER`,
`CUR_WORD`, `COMPASS`, `MAGNITUDES`, `WORD_ACRONYMS` and `NGUNI_LETTER_NAME` row fires.

**Found and NOT fixed — filed, with the count that decided it:**

- **The compass arm is case-SENSITIVE while the Celsius arm one line above is `/i`**, so `35°w` matches
  neither: the degree sign is DROPPED and the `w` reaches the g2p as a bare [w] — the exact class step 12
  exists to prevent. ×1, and it is FLEURS' lowercased column 4; a longitude is written `35°W`. Widening the
  arm on the strength of a transcript artifact would also admit a bare one-letter `n`/`s`/`e`/`w` after a
  degree sign, which Xhosa's vowel-initial locatives make less far-fetched than it looks. Recorded instead.
- **`0230UTC` reads *amakhulu amabini amashumi amathathu*** — "two hundred and thirty". Two defects in one
  token, both deliberate elsewhere: `Number("0230")` drops the leading zero (the fleet's filed shape), and
  the all-caps rule's `\d` lookbehind leaves a digit-adjacent acronym alone, so `UTC` reaches the g2p raw as
  [ˈuːtʼkǀ] — a DENTAL CLICK, which is the reading the letter-name table was written to remove. ×1 line, and
  a compact `HHMM`+timezone rule invented on n=1 is #955. The same guard costs `I-JAS 39C Gripen`, where the
  `C` reads [kǀ]; ×1.
- **`20 °Cx` loses the sign and reads BOTH letters as clicks** (*…kǀkǁ*) — the su/lo/sl `°Cx` shape, and
  worse here because c and x are clicks. All three degree arms decline on the trailing letter. ×0 attested;
  the repair is the same fleet decision, not an xh edit.
- **`1 / 5` and `1/2` lose the slash** — xh has no fraction rule at all (the fleet-wide su finding). ×0.
- **The euro sign is declared NOWHERE** — not in the tier, not in `CUR_WORD` — so `€14.7` reads *ishumi nane
  isixhenxe* with the sign silently gone, while `$`/`£`/`¥` all read. ×0 attested, and the four declared
  words are corpus tokens; a fifth would be invention.
- **A decimal range carrying a unit loses its joiner**: `1.5-2.5 km` → *kunye kuhlanu kubini kuhlanu
  iikhilomitha*. Step 6's unit arm claims `2.5 km` before step 7 can see a decimal on the right of the dash —
  and step 7's own comment lists its couplings to steps 10 and 15 but not to 6. ×0 attested.
- **SPACED personal initials keep both dots**: `N. W. Wayne` → *n . w . wayne*, two sentence breaks and two
  bare letters. Step 2's dotted-run rule needs the capitals CONTIGUOUS and its glued-initial arm needs the
  next capital adhering, so a conventionally spaced pair matches neither. ×0 attested (the corpus's initials
  are all glued, `uN.Wayne`).
- **`802.11m` reads as a measurement** — *amakhulu asibhozo nambini kunye kunye iimitha* — because step 6's
  unit arm has no version guard. The ckb `NOT_VERSION` shape. ×0.
- **A version number keeps one dot as a pause**: `1.2.3` → *kunye kubini . kuthathu*; the decimal rule
  consumes the first dot and the scan resumes past it. ×0.
- **`100 200` fuses into one number** (*amawaka ikhulu amakhulu amabini*), the space-degrouping rule's known
  ambiguity — the blocks are exactly three digits, which is the only discriminator available. ×0 in this
  shape.
- ⚠ **`csharp/regex-corpus.jsonl` IS STALE — a shared artifact, not an xh one.** Re-extracting it produces a
  579-line diff in languages this port never touched: `zulu/normalize.ts` records `(\d{1,3})(,\d{3})+` where
  the source now reads `([1-9]\d{0,2})(,\d{3})+`, and it still carries the DOUBLED PLAIN SPACE classes that
  #925/#935 widened. Re-running `csharp/tools/regex-diff` from the checked-in copy therefore exercises
  patterns that no longer exist and misses the ones that do. Run over the FRESH extraction it is clean
  (**117,045 results identical, 0 differ, 0 refused**, xh's patterns included). Reverted rather than
  regenerated here — a 579-line refresh of a shared artifact does not belong in a language bring-up.
- **`COALESCE` has three dead keys** (`e`, `o`, `u`): `connective()` looks the table up on the first letter
  of a numeral head, and every head the compositor can produce begins with `i` or `a`. Inert, not wrong —
  the file says the three-way set is written for completeness — and recorded so nobody re-derives it.
