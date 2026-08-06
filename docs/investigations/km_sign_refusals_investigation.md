# Khmer `+` and `=` — two accepted silences re-examined, and a gate that failed on notes

## Run 1 — 2026-08-06 — what "INTENTIONALLY silent" was costing

`review.ts --lang km` reported `sign classes … none dropped`, because both remaining signs carried an
`ACCEPTED_SIGN_SILENCE` entry. What the same report showed two lines above:

    plus          +5         INTENT  pram
    equals        x = y      INTENT  ˈɛks wˈaᶦ

`+5` read *pram* — "five", the sign gone — and `x = y` read English letter names. The exemptions had quieted the
VERDICT while leaving both readings wrong, which is the failure mode the ACCEPTED tables are most prone to.

Prompted with three candidate readings: ស្មើ for `=` (glosbe), and for `+` a three-way split — បូក as an infix,
លើសូន្យ ("above zero") for temperatures, វិជ្ជមាន ("positive value") for a strict sign value.

### ⚠ The plus refusal measured the wrong population

The recorded reason was: *"of 254 sites with no number before the sign, 142 are LaTeX or C"*. That pooled two
shapes. Measured apart, on a freshly converted and deduplicated dump (161,436 unique paragraphs):

| shape | sites | with a LaTeX/C marker within ±40 chars |
|---|---|---|
| SPACED `+` between operands | 312 | **0** |
| UNSPACED between operands | 169 | 1 |

**Spacing is the discriminator, and it was there to be measured the first time.** Reading the spaced instances,
they are two things a Khmer reader voices as បូក:

  · **grammar formulas**, which are most of them — `(នាម + កំនត់ + ពង្រីក)` "noun + determiner + modifier",
    `(សព្វនាម + ឈ្នាប់ + កន្សោមនាម)`, and etymological compounds `(សមណ + សត្តិ)`. Left silent the two words run
    together as one.
  · **algebra** from the maths articles — `16x² + 24x + 9 = 0`, `( A + B )² = A² + 2AB + B²`.

274 sites gained a reading. The unspaced form is still not read: that is where `x+3\!` and `printf(…a+b)` live.

⚠ **And the "leading" plus was not a leading plus.** All 62 sites with no operand before the sign are the algebra
above — my regex called them leading because the left operand ends in a LETTER (`8x`, `A`) — plus one timezone
offset. There is NO sign-value `+` in this corpus.

### The two supplied words, measured

| word | corpus | verdict |
|---|---|---|
| `វិជ្ជមាន` "positive value" | 419 as a word; 0 as a sign reading | **implemented** for a bare leading `+`, marked as the weaker tier |
| `លើសូន្យ` "above zero" | **0**; its pieces attested (សូន្យ 781) | **refused** — one applicable corpus site, and composing an unattested compound to read it is the zu/xh `Kristu` mistake |
| `ស្មើ` | 2,479 | already implemented (digit-flanked); ស្មើគ្នា 433, ចំស្មើ 0 |

So `+5` now reads *ʋɨcceəmiən pram*, "positive five".

⚠ **A misfire caught while testing**: `៥០%+១` (a voting threshold, "50% + 1") read *fifty percent POSITIVE one*,
because a percent sign is neither a letter nor a digit and the plus looked like a fresh number. `%` is now an
operand for that guard.

### ⚠ The equals refusal HOLDS, and is better evidenced

Of 3,992 `=` in the deduplicated dump, only 66 are digit-flanked arithmetic — which is read. The letter-flanked
shape the probe tests is something else:

    1,158  SPACED Khmer = Khmer   a definitional gloss — `ឧបាយកោសល្លបណ្ឌិត = បណ្ឌិត​ព្រោះ​ឈ្លាស…`, a term and
                                  its explanation, from dictionary and commentary articles
      694  code-shaped            `==`, `!=`, `>=`
      193  Khmer = Latin          a translation gloss
      112  spaced Latin = Latin   mostly EasyTimeline markup — `AlignBars = justify`, `BackgroundColors = canvas:c`

A definitional `=` is not read "equal", and reading it would fire on 1,158 of those against 66 arithmetic. I tried
SPACING as the discriminator here too and it does not separate them, because the glosses are spaced.

⚠ **But the probe's reading shows a DIFFERENT gap**: `x = y` gives *ˈɛks wˈaᶦ* — English letter names inside a
Khmer engine. That is the letter-name seam, not this sign's, and it is worth its own work.

### ⚠ Two tooling defects found on the way

1. **The scan asked for a Khmer reading of LaTeX.** km's artifact carries a maths article's formulas verbatim —
   `z_1z_2 = r_1r_2[cos(\alpha_1+\alpha_2)+isin(\alpha_1+\alpha_2)]\!` — and their signs were reported as km
   math-sign defects. Nothing is read there because nothing should be: `\!` is a thin-space and `\alpha_1` a
   subscripted variable. Added `allOccurrencesInMarkup`, per SIGN rather than per line so a formula beside prose
   still reports the prose half. ⚠ The markers are brace-less as often as not — `\mathbb{R}` has braces,
   `\alpha_1`, `\!`, `i^2` do not — which is why the miner's own markup filter missed exactly these lines.
2. **The gate failed on an artifact with no defects.** `clean` was `out.includes("no defects")`, a string the scan
   prints only when it reports NOTHING AT ALL. Khmer ended with four findings, every one a NOTE — FOREIGN,
   REDUNDANT, ACCEPTED — and no DROP, and the gate said FAIL and then printed the notes as the reason, because the
   message builder finds no DROP line and falls back to the last three lines of output. Same shape as the
   `slice(-3)` bug that file already documents: a verdict taken from the shape of the output instead of its
   content. Now `clean` is "no DROP/LEAK/THROW line". Verified not to hide anything — ig and yo still fail with
   their DROP lines.

Also read: the timezone offset. `UTC+7`, `GMT+9`, `JST (UTC+09:00)` — 11 sites, all genuine, no misfires
available. A reader says "UTC plus seven", so this one unspaced shape is read where LaTeX is not.

**`review.ts --lang km`: checklist clean.** 3,103 tests.
