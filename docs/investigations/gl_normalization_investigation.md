# Galician (gl) normalization — investigation log

The language picked for this round of the sweep. `tools/corpus/mined/gl.jsonc` already existed
(dump-sourced, 1,698,559 paragraph segments, 33/35 cells covered), so step 0b of the playbook was
already done and this log starts at step 1.

## Run 1 — 2026-08-16 — what the engine does today

**Command** `phonemize(form, "gl")` over one attested form per cell of the artifact.

**Question** Which of the artifact's cells are actually defective in the engine as shipped? Galician has
no `normalize.ts` and no symbol tier at all, so the expectation was "everything" — but the playbook's
step 2 exists because the defect list is what the engine PRODUCES, not what you assume.

**Raw finding**

```
"12,5 km"        → dˈoθe kˈoma θˈiŋko kŋ        ← `km` read as a WORD, [kŋ]
"35 %"           → tɾˈinta e θˈiŋko             ← % dropped
"100 €"          → θˈeŋ                         ← € dropped
"0 °C"           → θˈeɾo k                      ← ° dropped, C read as a bare consonant
"1.500 persoas"  → mˈil θiŋkoθˈentos peɾsˈoas   ← CORRECT (dot-thousands already in the tokenizer)
"2.4 GHz"        → bˈinte e kˈatɾo ɡθ           ← the DOT-DECIMAL read as thousands: 2.4 → "vinte e catro"
"11:35"          → ˈonθe , tɾˈinta e θˈiŋko     ← the colon became a clause PAUSE inside the number
"Dr. Silva"      → dɾ . sˈilβa                  ← the abbreviation read as a word, the dot a full stop
"3/4"            → tɾˈes kˈatɾo
"5²"             → θˈiŋko                       ← the power silently gone
"10 km²"         → dˈeθ kŋ                      ← unit AND exponent gone
"UTC +1"         → ˈutk uŋ                      ← initialism read as a word, `+` dropped
"±2"             → dˈoᶷs
"1º" / "1ª"      → uŋ                           ← the ordinal indicator dropped, cardinal left
"n.º 5"          → ŋ . θˈiŋko
"a. C." / "d. C."→ a . k .                      ← era marker read as two letters and two full stops
"EEUU"           → eˈeᶷᶷ
"B&B"            → b b
"século XIX"     → sˈekulo deθanˈoβe            ← CORRECT (the shared roman pass, cardinal century)
```

**Implication** Every class is defective except dot-thousands and the Roman century. The two that were
NOT predictable from "there is no layer" are the ones worth recording: the dot-decimal is not merely
unread, it is read WRONG (`2.4` → twenty-four), and the colon does not vanish — it becomes a sentence
break in the middle of a timestamp.

`mine.ts scan` on the artifact, same day, for the classes the leak tests are blind to:

```
DROP percent ×29   DROP math-sign ×25   DROP exponent ×21   DROP currency ×17
DROP degree  ×11   DROP minus     ×10   DROP ampersand ×6   DROP iteration ×3
LEAK RAW-LATIN nd ×2  ms ×2  pp ×2  ml ×1
```

## Run 2 — 2026-08-16 — sourcing the words, and where the Portuguese sibling is WRONG

**Command** `attest.ts --lang gl --words …`, then reading every example (playbook: an `attested`
verdict is only usable with a sense you have READ).

**Question** Galician is Ibero-Romance and `pt`'s layer is the obvious template. Which of its words
carry over, and which do not?

**Raw finding** — the ones that carried over, each with the sense checked:

| word | hits/arts | the example that settles it |
|---|---|---|
| `por cento` | 7/1 | the *Porcentaxe* article: "Tamén se lle chama comunmente tanto **por cento**, onde por cento significa…" |
| `graos` | 49/7 | "unha cantidade en **graos**, minutos e segundos"; and the artifact's own `104,45°` sentence spells it: "un ángulo de 104,45 **graos** entre si" |
| `signo igual` | 12/6 | "O **signo igual** (=) é un símbolo matemático empregado para indicar a igualdade" |
| `máis-menos` | 3/3 | "O sinal **máis-menos** (±) é un símbolo matemático" |
| `máis` / `menos` | 114/20, 42/20 | "Os signos de **máis e menos** (+ e −) son símbolos matemáticos" |
| `dividido por` | 1/1 | "8593 **dividido por** 23 dá un cociente de 373 e un resto de 14" |
| `cadrado` / `cúbico` | 219/19, 21/4 | "O metro **cúbico** é unha unidade de volume"; "Quilómetro cúbico" |
| `euro`, `dólar`, `libras`, `ien` | 298, 641, 41, 59 | "O **euro** (EUR ou €)"; "O **ien** (円, えん, … ¥ …)" — both articles name the sign |
| `antes de Cristo` | 30/15 | and the ARTIFACT glosses it directly: "os anos anteriores á época abrévianse **a.C.** para **Antes de Cristo** ou **a. e. c.** para antes da Era común" |
| `despois de Cristo` | 12/10 | — (`despois`, not the Portuguese `depois`) |

⚠ **And three where the sibling's word is the wrong answer, which is trap 55 doing its job:**

- **`dividido entre` scores ×19 in 19 articles and is a FALSE attestation.** Every single hit is
  "divided between" in the geographic sense — "Yorkshire está dividido entre Yorkshire do Leste…",
  "o monte da Zapateira está dividido entre tres concellos". The correct arithmetic word,
  `dividido por`, scores ×1. **A 1-hit finding with the right sense beats a 19-hit finding with the
  wrong one**, and the count alone would have chosen the wrong word.
- **`igual a` ×1 is a false attestation too** — "as leis vinculan por **igual a** gobernantes e
  cidadáns" is "equally to", not the equals sign. The usable source is `signo igual` above.
- **`maior que` ×1 is a false attestation** ("Colexio **Maior que** se aplicaba ironicamente"), and
  the honest comparative in running Galician prose is **`ca`, not `que`**: `é maior ca` ×5/4 and
  `é menor ca` ×8/6 against `é maior que` ×0 and `é menor que` ×0.

  **The tie-break is that the SIGN has a name distinct from the prose**, and gl.wikipedia states it:
  "En Matemáticas o signo `>` significa **maior que** (3 > 0) e `<` significa **menor que** (2 < 5)".
  So the sign readings are `maior que` / `menor que` — the notation's own names — while `ca` is what
  ordinary comparison uses. Both facts are real; only one of them is about the symbol.

**Implication** The pt template is structurally right and lexically unreliable. Every word was
re-sourced; `ca`-vs-`que` and `dividido entre`-vs-`por` would both have shipped wrong from the sibling.

## Run 3 — 2026-08-16 — the ordinal indicator is not always an ordinal

**Command** grep the artifact for `º`/`ª` with 60 characters of left context.

**Question** `ordinal-latin` is 138,420 corpus-wide. What surface forms carry it?

**Raw finding** Nine ordinal instances, every one small: `1º`, `2ª` ×2, `3º`, `5º`, `6ª`, `11º`,
`28º` ("o 28º do mundo"), `29º`, plus `4.ª` — the DOTTED form, which pt's rule also has to accept.
`n.º` and `Nº` occur as *número*.

⚠ **And three instances where `º` is a DEGREE SIGN, not an ordinal:**

```
…de xeso. Unha vez modelada e deixada secar, cócese a 750-950º.
…despois cócese no forno —a temperaturas entre 400º e 1300º, segundo o tipo—
```

Both are kiln temperatures typed with U+00BA MASCULINE ORDINAL INDICATOR instead of U+00B0. So the
indicator rule cannot be unconditional.

**Implication, and the call.** Every genuine ordinal in this corpus is ≤ 29; every bogus one is ≥ 400.
The indicator rule is therefore bounded at **n ≤ 100** — above that the indicator is STRIPPED and the
cardinal stands, which is pt's documented "honest lossiness" (it loses the ordinality, it invents no
morphology, and it puts no raw `º` in the phoneme string). Reading `1300º` as *mil trescentos graos*
was considered and declined: it would be right for both corpus instances and would invent a
temperature on any genuine large ordinal (`o 1000º aniversario`), which three instances cannot license.
The two kiln sentences are a known unclaimed case, recorded here rather than guessed at.

## Run 4 — 2026-08-16 — the minus, and what the dash between two numbers is

**Command** grep the artifact for a sign-initial `-`/`−`/`–` before digits, and for `\d[–-]\d`.

**Raw finding** The minus is REAL in this corpus, unlike Burmese's: `−5°C`, `−22°C`, `-1 °C`,
`-2 °C`, `-1000` (a year), `(–287 a. C.)`, `-1 designa 2 a.C.` — 7 genuine negatives, most of them
temperatures. Against them, two footnote markers (`os mesmos -243- no 1646`, `en 1929. -39.`).

Ranges: `1814–15`, `600–700`, `100–200`, `1824–1843`, `750-950`, `85-106`, `1000-1300` — years, page
ranges and temperature spans, all currently reading as two bare numbers with the dash silent.

**Implication** Both classes earn a rule. The minus takes pt's guard shape plus a `(?!\d*-)` so the
`-243-` footnote is not claimed; `-39.` after a full stop is a residual misfire, recorded and accepted
at 1 instance. The range reads `a`, and per trap 58 the pattern must not require anything after the
second number, or `1924–1999.` gives up at the full stop.

## Run 5 — 2026-08-16 — the shared tier read a plural marker as a unit

**Command** `phonemize("5 millóns de euros", "gl")` after wiring `makeSymbolNormalizer`.

**Raw finding** `θˈiŋko miʎˈoŋ seɣˈundos de ˈeᶷɾos` — "five million SECONDS of euros".

**Why, and it is not a Galician problem.** `core/normalizeSymbols.ts` builds the unit pattern as
*number + optional magnitude + unit* and sorts the magnitude alternation longest-first, with a comment
saying that sorting is what stops a short magnitude stranding an inflectional suffix. Sorting cannot,
because the engine BACKTRACKS: it tried `millóns`, found no unit after it, fell back to `millón`, and
the leftover `s` is Galician's declared seconds unit (needed for `m/s`). Catalan escapes the same
declaration only by accident of morphology — `milions`/`milió` leaves `ns`, which is nobody's unit.

**Fix and its blast radius.** A word-boundary assertion after the magnitude alternation. Measured by
the full suite: one failure, `cmn "1350亿m³"`, because a Latin letter after a Han magnitude is a token
boundary by script change and not a continuation — the same case `unspacedScript` narrows every other
guard in that file for. Boundary disabled under `unspacedScript`; those languages cannot hit the
backtracking hazard anyway, since a Han magnitude has no inflected plural to be a prefix of. Suite
green after that (4,473 tests).

## Run 6 — 2026-08-16 — the corpus diff, which found what no probe did

**Command** `corpus-diff.ts emit` from a pristine worktree at HEAD, then `compare`.

**Raw finding** 234/463 utterances changed (50.5%); `DROP` **103 → 13**; no DIGIT, SLOT-GAP, RAWMARK,
ZERO-WIDTH, RAW-CAPS or THROW on either side. Reading the changes turned up two things unit probes
could not:

- ⚠ `Ec=1/2mV²` → *Ec igual a **mediomV²***. The fraction rule's words landed GLUED to the following
  token, because that formula has no space after the denominator. The second-order damage is the
  interesting part: the fused base is eight letters, which is past the shared tier's three-letter limit
  for a bare exponent, so the `²` was dropped too — and that showed up as a `DROP exponent` line
  attributable to a rule that has nothing to do with exponents. Fixed by capturing the following letter
  and re-emitting it spaced.
- `365,242&nbsp;222&nbsp;2 días` changed from *…coma dous catro dous **douscentos vinte e dous** dous*
  to *…coma dous catro dous dous dous dous dous* — the SI-space de-grouping is what makes the whole
  fractional part read digit by digit, which is correct and was not the reason the rule was written.

Residual `DROP` after the fix, every instance read: 7 negative/non-square exponents (no sourced word —
`ao cubo` ×0), 4 math-signs that are ASCII arrows and markup, 1 minus that is the `-243-` footnote the
guard excludes, 1 iteration mark that is Japanese `みすゞ` inside a Japanese name.

## Run 7 — 2026-08-16 — the gates

`npx tsc --noEmit` clean · `npx vitest run` 4,473 passed · `review.ts --lang gl` green on every
checklist item but the artifact scan (residuals above, left red on the lt/ak/ln precedent) ·
`referee-eval gl` **91.8% folded backbone before and after**, which is the expected result: this layer
rewrites text, not the word g2p, so a moved referee number would have meant a bug.

⚠ One test failed for a reason worth recording: `expect(gl.text("século XV"))` on the raw
`createGalician()` engine returned *sˈekulo **xis uve*** — the shared `core/roman.ts` pass lives in
`registry.ts` wrapping the engine, so a test built on the constructor does not exercise it, and the
layer's own initialism step spells the numeral. Through `phonemize(…, "gl")` it is *sˈekulo kinθe*.
This is trap 16's advice ("pin it with a test through the real phonemizer, using an operand that would
break if the order were wrong") producing exactly the failure it predicts. The test now uses
`phonemize` and keeps `XV` rather than the corpus's `XIX` for that reason.

## Run 8 — 2026-08-16 — the class the header named and the rules had not fixed

**Command** `phonemize("48.26 km", "gl")` and friends, re-probed after the first full pass of gates.

**Question** Run 1 recorded the dot-decimal as "the one class read WRONG rather than merely unread".
Was it actually fixed?

**Raw finding** No.

```
48.26 km   →  kˈatɾo mˈil oᶦtoθˈentos bˈinte e sˈeᶦs kilˈometɾos   (4826 km)
11.1 %     →  θˈento ˈonθe poɾ θˈento                              (111 %)
2.4 GHz    →  bˈinte e kˈatɾo …                                    (24)
```

Every other class had a rule and this one had a paragraph. The layer's gates were all green over it:
the leak classes see no surviving digit, the DROP test sees no vanished symbol, the corpus diff shows
a CHANGED reading (the unit now reads), and the review checklist has no line for "is the number the
right number". A wrong magnitude is invisible to every instrument this repo has — it is trap 56 in its
purest form, a defect that produces a fluent reading.

**Fix** Catalan's discriminator, on Galician's own evidence: exactly three fraction digits is a
thousands group (`1.500`, `460.000`, `106.460.000`, `188.697` — all in this artifact), one or two is a
decimal (`48.26 km`, `(11.1%)`, `2.4 GHz`). Placed after the ordinal rule, which needs `4.ª` and
`1.000º` with their dots intact, and before the range rule, so `4.2-3.9` reads as a range of two
decimals. The corpus diff moves 234 → 236 utterances and the changes it adds are all of this shape:

```
1.6 km   dezaseis quilómetros  →  un coma seis quilómetros
1.0      dez                   →  un coma cero
USB 2.0  u ese be vinte        →  u ese be dous coma cero
```

Known exposure, the same one ca records: a version designation has the same shape, so `802.11n` reads
*oitocentos dous coma once …*. `version-dot` is 396 corpus-wide against `decimals` at 77,321, and the
decimal is the reading that is currently wrong rather than merely odd.

**Lesson for the next language.** Writing the defect into the file header is not the same as writing
the rule, and nothing in the gate set catches the difference. Re-run the ORIGINAL run-1 probe list at
the end, not just the new one.

## Run 9 — 2026-08-16 — the fix for run 5 was gated on a flag nobody had set

**Command** the full suite, again, after the `unspacedScript` gate from run 5.

**Raw finding** `cmn "1350亿m³"` STILL failed. The gate was correct about the language and irrelevant to
the test: `test/normalize-multilang.test.ts` builds the normalizer directly from a literal
`{percent, units, magnitudes, exponentWords}` and never sets `unspacedScript`, so the flag was `false`
and the guard fired anyway.

**Implication, and the better gate.** The condition the guard actually needs is not "is this language
unspaced" but "can backtracking strand a suffix here at all" — which is true exactly when one declared
magnitude is a strict PREFIX of another. `millóns`/`millón` yes; `万`/`亿` no. Gated on the data, the
Chinese pattern is unchanged by construction, and no caller has to remember a flag. Suite green
(4,474 passed) and a core-level regression test now pins the gl case in `normalize-multilang.test.ts`
rather than only in the Galician layer's tests.
