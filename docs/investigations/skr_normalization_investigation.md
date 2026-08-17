# Saraiki (skr) normalization — investigation log

Picked as the largest untreated corpus in the fleet — **120,763 paragraph segments** — and as a deliberate
break from five consecutive Latin-script rounds. Perso-Arabic moves the whole trap surface: three digit
sets, an RTL sign position, the Arabic comma doing two jobs, and a `units` cell that is almost empty
because this language spells its units out.

`tools/corpus/mined/skr.jsonc` — skr.wikipedia dump, 31/35 cells, 672 retained segments.

Corpus-wide: `digit-run` 39,600 · `year` 39,503 · `latin-in-native` 10,614 · `quote-letter` 6,254 ·
`ranges` 4,630 · `initialism` 2,967 · `abbrev` 1,582 · `decimals` 1,401 · `grouped` 875 · `roman` 628 ·
`signs` 556 · `clock` 387 · `fractions` 230 · `signed-number` 126 · `zero-width` 115 · `percent` 86 ·
`ampersand` 87 · `sports-time` 77 · `arithmetic` 69 · `dotted` 65 · `currency` 56 · `degrees` 50 ·
`ordinal-latin` 39 · `scaled-currency` 37 · `version-dot` 34 · `rate` 31 · `exponent` 18 · `era-marker` 7 ·
**`units` 4**.

⚠ That last number is the round's first finding. Aragonese, one round earlier, had `units` 12,366 in
255,887 segments. Saraiki has **four** in 120,763 — because the corpus writes `ملی میٹر`, `کلومیٹر`,
`مربع کلومیٹر`, `فٹ`, `میل`, `کلوگرام` and `فی گھنٹہ` out as words. A unit table here would be a rule with
almost nothing to match.

## Run 1 — 2026-08-16 — what the engine does today

The Saraiki engine is `makeNativePunjabi(..., { saraiki: true })`, and `punjabi.ts` **gates the Punjabi
normalizer off for it** — with the reason in a comment: that pass emits Punjabi words (ਪ੍ਰਤੀਸ਼ਤ, ਡਾਲਰ,
ਡਿਗਰੀ, ਈਸਾ ਪੂਰਵ). So the seam already exists and is already labelled; Saraiki has simply had no layer.

```
"٨٥٪ اکثریت"        → pˈə̃ɲd͡ʒ ˈəsːiː əkəsɾˈiːt̪        the ARABIC PERCENT SIGN dropped
"۵.۵فٹ"            → pˈə̃ɲd͡ʒ . pˈə̃ɲd͡ʒ fˈəʈ           the decimal dot a SENTENCE BREAK
"1,234,567 لوک"     → ˈɪkː , d̪ˈoː sˈɔː t͡ʃˈɔːt̪iː , …   the grouping comma a pause, the number in pieces
"60° درجہ دار قوس"   → sˈəʈʰː d̪ˈəɾd͡ʒaː d̪ˈaːɾ qˈoːs     the degree sign dropped
"2.43 ×10−12 میٹر"  → d̪ˈoː . t̪əɾt̪ˈaːɭiː d̪ˈəs bˈaːɾã   the sign, the exponent and the minus all gone
"$100 ڈالر"         → ˈɪkː sˈɔː ɖˈaːləɾ                the currency sign dropped (the word was written too)
"۳x۳ ہتھ"           → t̪ˈɪ̃n ˈɛks t̪ˈɪ̃n ɦt̪ʰ            ⚠ the ASCII ⟨x⟩ read as the ENGLISH LETTER NAME
"12:30 وجے"         → bˈaːɾã , t̪ˈiːɦ ʋˈəd͡ʒeː          the colon a pause
```

⚠ **THE DIGIT FOLD ALREADY WORKS AND IS WORTH RECORDING AS A NEGATIVE RESULT.** `foldNativeDigits` runs
before `normalize` in the shared factory, and it handles all three sets this corpus uses, so
`١٠ اپریل ١٩٣٢` and `۴/۱۵۰` already read as numbers. Every pattern in the new layer can be written against
ASCII digits. Trap 16: the seam existed.

## Run 2 — 2026-08-16 — ⚠ THREE DIGIT SETS, AND THE ARABIC COMMA DOES TWO JOBS

The artifact's own header counts what an ASCII-only `\d` would have missed: **2,257 of 39,600 digit-runs**,
i.e. ~6%. Reading the instances shows it is not one alternative set but two, used by different articles:

| set | codepoints | instance |
|---|---|---|
| ASCII | `0-9` | `1,234,567` · `53.7 °C` · `52.66 فیصد` — the majority |
| Extended Arabic-Indic | U+06F0–U+06F9 `۰۱۲۳۴۵۶۷۸۹` | `معجم البلدان ۴/۱۵۰` · `۵.۵فٹ` · `۳x۳ ہتھ` · `۳۳۸ سیکٹر` |
| Arabic-Indic | U+0660–U+0669 `٠١٢٣٤٥٦٧٨٩` | `١٠ اپریل ١٩٣٢` · `٢٥ دسمبر ١٩٩١ء` · `٤٢ فیصد` · `٨٥٪` |

⚠ **AND THE ARABIC COMMA `،` U+060C BOTH GROUPS AND SEPARATES**, which is the Papiamento shape arriving in
a different script:

```
GROUPS       714،000 اضافہ  ·  12،000 بارہ ہزار کلوگرام     ← and the second one GLOSSES ITSELF ("twelve thousand")
SEPARATES    (جنوری 4، 1643ء)  ·  10، 12، 14، 2000، 2006  ·  1954 ، 1925 تے 1928
```

**Implication** The codepoint settles nothing and the THREE-DIGIT TEST settles everything: every grouping
instance has exactly three digits after the mark, every list item has two or four. The same test already
decides the ASCII comma (`476,291`, `3,384,569`, `20,000`, `27,873`), so one mechanism covers both marks.

⚠ **THE ARABIC DECIMAL SEPARATOR U+066B IS ABSENT** — zero instances, along with U+066C. The decimal is the
ASCII dot (`52.66 فیصد`, `44.7°`, `2.43`, `27.24 فٹ`, `2.17 K`), which is what a rule must be written for.

## Run 3 — 2026-08-16 — ⚠ THE PERCENT SIGN IS WRITTEN THREE WAYS, IN TWO POSITIONS, AND SOMETIMES BESIDE ITS OWN WORD

`percent` is 86 corpus-wide and the retained text carries every combination at once:

```
ASCII %, postposed     15%  ·  61.1%  ·  2.5%  ·  3.8%  ·  100%  ·  92%  ·  23 %
ARABIC ٪ U+066A        18٪  ·  3٪  ·  ٨٥٪
⚠ PREPOSED             پاکستان دے کل رقبے دا %6دے قریب        ← the sign BEFORE the digits
⚠ REDUNDANT            وادی سندھ کی 90 % فیصد برادریاں  ·  2%تے 3%فیصد ھووݨ والی زباناں
the WORD alone         ٤٢ فیصد  ·  50 فیصد  ·  پنج فیصد  ·  52.66 فیصد
```

**Implication, and it is a trap-16 result again:** the shared tier ALREADY covers all of it. `PCT` includes
U+066A, `pctPreRe` matches a sign before the number, and `PCT_AFTER`/`PCT_BEFORE` decline a sign whose word
is already written. Declaring `percent: ["فیصد"]` is the entire fix; hand-writing any of the four cases
would have duplicated machinery that was already there.

## Run 4 — 2026-08-16 — ⚠ THE COLON IS NEVER A CLOCK, IN FOUR DIFFERENT WAYS

`clock` is 387 corpus-wide and `sports-time` 77. In the retained text there are fifteen colon-between-digit
segments and **not one is a time of day**:

```
TALK-PAGE SIGNATURE   (talk) 15:30, 29 September 2020 (UTC)      ×6, one editor's signature block
MARATHON TIME         2013 بوسٹن میراتھن 2:49:16 دے وقت نال  ·  2:44:06 دا ذاتی ریکارڈ
SWIMMING TIME         ایونٹ وچ 5:34.64 وچ تیراکی کیتی
DRAWING SCALE         کوئی وی مناسب Scale ( مثلاً 1:100 یا 1:50 ) تے ڈرائنگ بݨیج سڳدی ہے
UNIX TIMESTAMP        آخری درست ٹائم سٹیمپ 14 ستمبر ، AD 30828 کوں 02:48:05.4775807 UTC
```

Faroese had two of these senses and Aragonese three; this corpus has four and zero clocks. No clock rule is
written, and the refusal is registered with the counts. ⚠ **The talk-page signatures are also a mining
finding** — six of the fifteen are Wikipedia UI residue rather than Saraiki prose, which is worth knowing
before any count from this cell is quoted.

## Run 5 — 2026-08-16 — ⚠ `×` HAS THREE SENSES AND NO DOMINANT ONE

```
SCIENTIFIC NOTATION   ایہ 2.43 × 10⁻¹² میٹر دے برابر ہے
A PHYSICS LAW         ݙوجھا قانون: قوت = کمیت × تکون (F = ma)
CUBE DIMENSIONS       9×9×9، 11×11×11 تے 17×17×17 مکعب دے وݙے کھݙوݨے
PAPER DIMENSIONS      کاغذ دے سائز (A4; 297x210 mm)          ← and this one with an ASCII ⟨x⟩
```

The last is why `۳x۳ ہتھ` reads *tin eks tin* today: an ASCII `x` between digits reaches the g2p as the
English letter name. Three senses, no majority, and no attested Saraiki word for any of them — the sign is
refused and registered rather than guessed at.

⚠ **But the cube article is also where `=` turns out NOT to be the same story** — the dimensions are
followed by piece counts, and those are real arithmetic. See Run 7; the first reading of this cell was
wrong and the correction is the interesting part.

## Run 6 — 2026-08-16 — ⚠ FIVE FULA-SHAPED RESULTS IN ONE BATCH, AND THE CORPUS OVERTURNED ONE OF THEM

`attest.ts --lang skr` over 38 words: **all 38 attested**. That number is worthless on its own, which is
the point of this run — reading the examples killed five of them:

| word | ×  | what the examples actually show |
|---|---|---|
| `منفی` | 36 | a LITERARY "negative" — منفی کردار, the villain of a folk tale; منفی جملے, unkind remarks |
| `ضرب` | 45 | `ضرب المثل`, "proverb" — every example, in an article about proverbs |
| `ہزار` | 41 | mostly MIR HAZAR KHAN, a Pakistani politician, not "thousand" |
| `سیلسیس` | 19 | ANDERS CELSIUS the astronomer, plus the film title "100 ڈگری سیلسیس" |
| `وجے` | 59 | VIJAY, the Tamil film actor |

⚠ **AND THE RETAINED CORPUS THEN OVERTURNED `منفی`.** The self-gloss is in the Baku article:

```
سطح سمندر توں بلندی منفی 28 میٹر (-92 فٹ) ہے
"the elevation is MINUS 28 metres (-92 feet)"
```

The same measurement, written once with the word and once with the sign, in one parenthesis. That is the
slot attestation the wiki batch could not produce — and it is a reminder that the artifact is evidence too,
not just the thing being fixed. `منفی` ships. `سیلسیس` does not: the scale word is `سینٹی گریڈ`, which the
corpus writes beside the sign (`44.7° سینٹی گریڈ`) and beside the degree word (`28 ڈگری سینٹی گریڈ`).

⚠ **`اعشاریہ` NEARLY FAILED THE SAME CHECK.** Five of its six examples are the decimal SYSTEM (اعشاریہ
اشارے, اعشاریہ نشان, اعشاریہ دے نمبراں دا نظام). The sixth is the slot and glosses itself: "چین دی کل آبادی
**ہک اعشاریہ ترئے ارب** یعنی ہک ارب تریہہ کروڑ" — one point three billion, restated in crores.

## Run 7 — 2026-08-16 — ⚠ `=` IS ARITHMETIC BY MAJORITY HERE, AND IS STILL REFUSED

The first corpus in this sweep where the equals sign is mostly a real equation. Six of twelve:

```
2×2×2 = 8 مکعب ٹکڑے    3×3×3= 27    4×4×4= 64    5×5×5= 125    7×7×7=483
ݙو + چار = چھ دانشوراں کوں چھوڑ ڈتا          ← a satirical couplet, and also real addition
```

(`7×7×7=483` is wrong — it is 343 — which is the corpus's error, not the reader's.) The other six are two
physics formulas, two etymological glosses (`انواء = نوء دی جمع ہے`, `ہائڈرو = پاݨی`), one angle assignment
and one WIKI TEMPLATE PARAMETER the extraction left behind (`ربط= گرینڈ کراس`).

**And it is still refused, on the Chuvash argument.** `برابر` ×45 is attested and means exactly "equal" —
but POSTPOSITIONALLY: the corpus writes "2.43 × 10⁻¹² میٹر **دے برابر ہے**", *is equal TO x*. The shared
tier can only place a connective BETWEEN operands, so even the six genuine equations could not be read
correctly. Trap 47: ask whether the tier CAN say it, not just whether the language has the word.

## Run 8 — 2026-08-16 — two defects found only by reading the residual

⚠ **THE PERCENT SIGN WAS SEPARATED FROM ITS FIGURE BY ZERO-WIDTH JOINERS.** After the tier was declared,
one percentage still read as a bare number: `مسلماناں دی ٨٥٪ اکثریت` has U+200D and U+200C **between** the
digits and `٪`, and the tier allows a space there and nothing else. `zero-width` is 115 corpus-wide. The
fix strips a joiner run that sits between a DIGIT and a SIGN and nowhere else — ZWNJ is meaningful
Perso-Arabic orthography inside a word, so a general strip would be wrong.

⚠ **AND THE CURRENCY RESIDUAL IS A POETRY BULLET.** The four remaining `currency` drops are `¤` U+00A4, the
GENERIC CURRENCY SIGN, used as an ornament separating a couplet from the poster's mobile number —
a devotional couplet, then `¤`, then a contact line. An eighth distinct symbol sense in this sweep, and the
only one where the cell is filled by decoration. (The instances are user-posted contact details in the
article space, so they are described here rather than quoted.)

## Run 9 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 14→0 · `degree` 8→0 · `currency` 18→4 · `minus` 5→1 · `ampersand` 3→0 ·
  `math-sign` 17→0 (registered). Residual, all read: the `¤` poetry bullet ×4, the exponent class ×6
  (scientific notation and a subscript variable, with no unit noun anywhere for a power to attach to),
  and one minus in the AutoCAD article. Two REDUNDANT lines appeared, which is the tier declining a sign
  whose word the writer already supplied.
- **corpus diff** (baseline emitted from a pristine worktree at `3c5e558`): **106/436 utterances changed
  (24.3%), DROP 63 → 27**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW either side.
- **`review.ts --lang skr`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — eight refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval skr`**: 0.6% raw / 75.1% folded / 91.7% symbol, before and after. (The raw figure is a
  property of a thin single-source Wiktionary referee against an abjad, not of this change.)
- **`vitest`** full suite and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **`ڊ` U+068A is SILENT in the g2p** — the scan reports 4 words dropped (`پچاڊھے`, `ڊے`, `پچاڊھ`). A
  Sindhi letter with no rule in the Shahmukhi scanner; a g2p gap, not a normalization one.
- **`1730ء` / `2011ء`** — the `ء` year marker (عیسوی) is silent, so the year reads correctly but the era
  does not. `era-marker` is 7 corpus-wide, which is why no rule is written.
- **`3,25,00000`** — a malformed Indian grouping (2-2-5) in the Assam article, glossed in the same
  sentence as "سوا ترے کروڑ". Neither the 3-3 nor the 2-2-3 rule can claim it, and neither should.
