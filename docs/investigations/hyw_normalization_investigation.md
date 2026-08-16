# Western Armenian (hyw) normalization — investigation log

Picked as **the sibling test with a layer already on the other side**. `src/languages/armenian/normalize.ts`
(Eastern, hy) is one of the most thorough files in this repo and it solves the same script and the same
defining defect — the bound case suffix glued to a figure. Trap 55 says the closest sibling is a
HYPOTHESIS, and this is the first round in the sweep where the hypothesis could be tested against a
finished implementation rather than against a family resemblance. hyw is also the largest untreated
language left with a mined corpus after Shan (1M speakers).

`tools/corpus/mined/hyw.jsonc` — hyw.wikipedia dump, 140,044 paragraph segments, 31/35 cells.

## Run 1 — 2026-08-16 — what the engine does today

```
"2019-ին"        → …dɑsninə in      the bound suffix as a FREE WORD, 174 instances retained
"3-րորդ"         → jeɾekʰ ɾoɾtʰ     the ordinal suffix as a bare cluster
"7.87%"          → jeotʰ . utʰsun jeotʰ    the DOT a full stop, the sign gone
"5,87 ա.մ."      → hinkʰ , … ɑ . mə .      the COMMA a pause, the unit two letters and two false pauses
"1 377 808"      → three separate numbers
"մ.թ.ա. 85"      → mə . tʰə . ɑ . …        letter-by-letter with three false pauses
"20 °C"          → kʰəsɑn sˈiː             ° gone, ⟨C⟩ as the ENGLISH letter name
"104 °F-ը"       → … ˈɛf ə                 …and the case suffix stranded on top
"5 կմ²"          → hinkʰ ɡmə               unit and power both gone
"1915-1923"      → the two years run together as one utterance
```

## Run 2 — 2026-08-16 — SEVEN things did not transfer

Reading hyw's corpus against hy's layer, slot by slot:

| slot | Eastern (hy) | **Western (hyw)** |
|---|---|---|
| metre / km | մետր · կիլոմետր | **մեթր** ×60 · **քիլոմեթր** ×49 — the classical ⟨թ⟩ |
| dollar | դոլար | **տոլար** ×48 |
| euro | եվրո | **եւրօ** ×62 (against `եւրո` ×18) |
| Celsius | «Ցելսիուսի աստիճան» | **«սելսիուս աստիճան»** — scale first, NO genitive |
| oblique "two" | երկուս- (երկուսի) | **երկուք-** ×17 against երկուս ×1 |
| era abbreviation | մ.թ.ա. only | **Ք.Ա. as well** |
| percent | տոկոս | տոկոս ×42 **and `առ հարիւր`** |

⚠ **The oblique "two" is the one that would have been silently wrong.** hy's `attachSuffix` maps
`երկու` → `երկուս-`; hyw writes **երկուք**, and this corpus's own "**Երկուքին** մէջտեղ կը գտնուի" is the
stem in the exact slot the rule fills. Porting the Eastern stem across gives *երկուսին* for the commonest
declined numeral in the language — a well-formed Armenian word, in the wrong dialect, invisible to every
gate.

⚠ **`առ հարիւր` is a real Western-only percent phrase and it does NOT ship.** It is attested in the exact
slot — "96 առ հարիւրը գրել-կարդալ գիտէ", "98 առ հարիւրը կ'արտադրուի", "3 առ հարիւր աղով ջուրը" — but it
is a two-word prepositional phrase whose article attaches to its SECOND word, and the shared tier can
only postpose a noun. `տոկոս` ×42 is what this corpus's own retained text writes after a figure
("60-70 տոկոսէն ոչ պակաս", "շաքարի տոկոսը կը հասնի 70-ի"). The refusal is a tier limitation, not an
evidence gap, and it is recorded as one.

## Run 3 — 2026-08-16 — the era glosses itself, and the decimal uses both marks

⚠ **The wiki writes both era expansions in one parenthesis, repeatedly**:

> "714 **Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ)**" · "(735-714 Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ))"
> · "Առաջին անգամ յիշատակուած է Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ) 879 տարին"

So `Ք.Ա.` and `մ.թ.ա.` get their expansions from the same sentences and neither is inferred. Same for the
astronomical unit — "5.23 աստղագիտական միաւոր (**ա.մ.**) է" — and for the currency, "€ **եւրոն**".

⚠ **AND THE DECIMAL SEPARATOR IS BOTH MARKS, IN ONE CLAUSE**:

> "**5.23** աստղագիտական միաւոր (ա.մ.) է, առաւելագոյն մոտեցումը **4.59** ա.մ. է, հեռացումը՝ **5,87** ա.մ."

Eastern's corpus is comma-only. What makes hyw's two decidable is that the GROUPING is by SPACE
(`1 377 808`, `74 000`, `7 239 881`), so neither mark is doing double duty: **the dot is always a decimal,
and the comma is a decimal unless exactly three digits follow it** (`445,000`). Both fold to a single `.`
and the existing decimal step reads them identically.

## Run 4 — 2026-08-16 — ⚠ THE COUNTER-EXAMPLE TO TRAP 62

Trap 62 was written one round ago on five consecutive languages whose `=` was never an equation. hyw has
**44 and most of them ARE arithmetic**, from its number-theory articles:

```
100=47+53   ·   100 = 2 + 3 + 5 + 7 + 11 + 13 + 17 + 19 + 23   ·   105=3 × 5 × 7
155=2²+3!+5!+7²-11-13   ·   364:13=28   ·   144⁵=27⁵+84⁵+110
```

**Implication** The trap's *procedure* transferred and its *answer* did not — which is exactly what the
trap says to expect, and the counter-example is worth as much as the five confirmations. `հաւասար` is
attested in the same article type and the same sense ("Կատարեալ թիւեր, որոնք **հաւասար են** իրենց իսկ
բաժանարարներու գումարին՝ 6, 28, 496, 8128"), so a DIGIT-GATED rule ships. ⚠ The copula is dropped
deliberately: careful Armenian writes «հաւասար է» with the verb after the second operand and the tier's
slot is between them.

⚠ **The neighbouring signs still are not what they look like.** `×` ×6 spans THREE senses — two ammunition
calibres (`7.92×33mm Kurz`, `7.62×39mm M43`), two scientific notations (`4×10¹⁰`), two a product — and no
single word reads all three, so it is refused. `÷` ×2 is a RANGE in the Russian tradition (`0.96÷1.41`,
the same finding ba recorded) and **an album title** (`2017-ի ալպոմին՝ ÷`, Ed Sheeran's).

## Run 5 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 15→0 · `currency` 17→0 · `degree` 13→0 · `math-sign` 42→9 ·
  `exponent` 22→13 · `minus` 5→4. Residual, all read: a superscript run no measure word reaches (an
  isotope `¹⁴⁷Pm`, `10¹⁰`, `1³ + 2³ + 3³ + 4³`, `(1+2+3+4)²`), the calibres and album title above, a
  media duration's leading hyphen, and three `nm` inside an English processor spec.
- **corpus diff** (baseline emitted from a pristine worktree at `4132f01`): **212/442 utterances changed
  (48.0%), DROP 88 → 43**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang hyw`**: green on every checklist item including `sourcing` and `sign classes`.
  ⚠ The sourcing gate caught `սթերլինկ`, a pound word I had declared from nowhere; `£` does not occur in
  this corpus and the key is gone.
- **`referee-eval hyw`**: **0.1% raw / 86.8% folded / 98.0% symbol, before and after** — measured on both
  sides from the pristine worktree, and unchanged as expected.
- **`vitest`** 4,542 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **`առ հարիւր`** — a real Western percent phrase the shared tier's noun slot cannot place. Run 2.
- **The bound suffix on a LATIN stem** — `NASA-ի`, `Intel-ը`, `«Chandelier»-ը`, `A320-ներուն`. The rule
  claims a DIGIT stem only; on a Latin stem the suffix still reads as a free word.
- **No clock rule**, and no initialism pass: `letter-name` is 2,583 corpus-wide and the blocker is the
  same one hy records — sourcing the 38 Armenian letter names, not code.
- **The superscript run** (`¹⁴⁷Pm`, `10¹⁰`, `144⁵`) has no reading in the shared tier at all.
