# Belarusian (be) normalization — investigation log

Picked as the next language in the sweep: the largest untreated mined artifact
(`tools/corpus/mined/be.jsonc`, be.wikipedia dump, **1,371,742** paragraph segments, 33/35 cells), a
Cyrillic script — so a different hazard set from the Romance run that preceded it — and Slavic
three-way count agreement, which the shared symbol tier supports and which `ru`/`uk` give a hypothesis
to test. Step 0b was already done, so this log starts at step 1.

## Run 1 — 2026-08-16 — what the engine does today

**Command** `phonemize(form, "be")` over one attested form per cell.

**Raw finding**

```
"70 %"           → sʲemd͡zʲesʲat                      ← % dropped
"31 800"         → trɨt͡sːat͡sʲ ad͡zʲin vosʲemsot       ← ONE number read as TWO
"3 000 000"      → trɨ nulʲ nulʲ                      ← "three zero zero" for three million
"5,3 %"          → pʲat͡sʲ , trɨ                       ← the decimal comma is a PAUSE
"$7.2 мільярда"  → sʲem . dva mʲilʲjarda              ← $ gone, the dot a full stop
"+28 °C"         → dvat͡sːat͡sʲ vosʲem sˈiː             ← ° gone and ⟨C⟩ read as the ENGLISH letter name
"1991 г."        → … ad͡zʲin x .                        ← `г.` (год) read as the bare consonant [x]
"XIX ст."        → d͡zʲevʲatnat͡sːat͡sʲ st .              ← the roman pass works; `ст.` does not
"10:30"          → d͡zʲesʲat͡sʲ , trɨt͡sːat͡sʲ            ← the colon is a clause pause
"12,5 км"        → dvanat͡sːat͡sʲ , pʲat͡sʲ km           ← `км` read as the cluster [km]
"100 кг"         → sto kx
"1-ы" / "2-і"    → ad͡zʲin ɨ / dva ji                  ← the ordinal suffix read as a bare vowel
"1990-1995"      → …d͡zʲevʲanosta …d͡zʲevʲanosta pʲat͡sʲ ← the dash silent, endpoints fused
"ЗША"            → sʂa                                ← the initialism as a consonant cluster
"СССР"           → sːsr
"н.э." / "да н.э."→ n . ɛ . / da n . ɛ .
"№ 5"            → pʲat͡sʲ                             ← the numero sign dropped
"5²" / "10 км²"  → pʲat͡sʲ / d͡zʲesʲat͡sʲ km             ← the power gone
"1/3"            → ad͡zʲin trɨ
"2,5 млн"        → dva , pʲat͡sʲ mɫn
```

**Implication** Every class is defective. Two are worse than "unread" and are worth separating out:

- **`3 000 000` reads as *тры нуль нуль*.** The tokenizer's number is `\d+`, which cannot span the
  grouping space, so a seven-digit figure becomes three separate numbers of which two are bare zeros.
  This is the largest wrong-magnitude defect in the language and it produces a fluent reading.
- **`+28 °C` reads the ⟨C⟩ as the English letter name** ([sˈiː]) — the Cyrillic-only TOKEN drops the
  Latin run to `core/foreign.ts`, which reads Latin as English. So the defect is not silence but an
  English word inside Belarusian prose.

`mine.ts scan` over the artifact, same day:

```
DROP percent ×33   math-sign ×28   degree ×17   currency ×17   exponent ×16   minus ×11   ampersand ×2
LEAK RAW-LATIN sk ×2   MARKUP math-sign ×1 (LaTeX)
```

## Run 2 — 2026-08-16 — tabulating the corpus, and four things that are NOT what they look like

**Command** counted regexes over the artifact's retained text (459 segments), then printed the
surrounding context of every class before writing any rule (playbook trap 2).

**Raw finding** — the counts:

| shape | n | dominant forms |
|---|---|---|
| dotted abbreviations | 163 | `пам.` 20 · `э.` 17 · `нар.` 10 · `г.` 8 · `інш.` 7 · `с.` 7 · `дол.` 7 · `км.` 6 · `тыс.` 5 · `ст.` 5 · `млрд` 5 |
| multi-dot | 30 | `н.э.` 17 · `н. э.` 2 · `г.д.` · `п. шыр.` |
| unit after a digit | 233 | `года` 39 · `км` 21 · `млрд` 16 · `мм` 10 · `м` 9 · `г` 8 · `км³` 7 · `км²` 6 |
| dot decimals | 82 | `0.1` `2.1` `7.5` `74.2` `57.7` |
| comma decimals | 81 | `0,0` `3,3` `4,5` `2,6` |
| ranges (dash) | 74 | `10—20 мм` · `300—350 км` · `1-3` · `7-14` |
| percent | 54 | spaced (`70 %`) and glued (`25%`) |
| caps runs | 86 | `ВУП` 21 · `ДНС` 17 · `ЗША` 8 · `ААЭ` 5 · `ААН` · `СНД` · `ВІЧ` · `ПАР` |
| numeral + written suffix | 23 | `-е` `-я` `-х` `-й` `-га` `-ай` `-ых` `-мі` |
| space-grouped | 21 | `X 000` ×7 |
| clock | 14 | `23:59` `18:21` `03:40` |
| exponent | 22 | `³` 11 · `²` 10 · `²⁹` |
| signs | 20 | `=` 9 · `×` 7 · `±` 4 |

⚠ **And four classes are not the class they pattern-match as.** Each was found by printing context,
and each would have shipped a wrong rule:

1. **`с.` is *старонка* (page), not seconds.** Every instance is a bibliography — `552 с.`, `196 с.`,
   `240 с.`. Declaring `с` as the seconds unit would misread every page count in the language's own
   citation style. Refused, and the refusal is why `м/с` cannot be composed from the shared tier here.
2. **The seven `\d+/\d+` "fractions" are ALTERNATIVE DATES.** `(пам. 29/30.10.1937)`, `(нар. 673/674)`,
   `285/286: Марк Аўрэлій Юліян`, `64/67: Пётр, апостал` — a birth or death year known only to within
   a year. **Zero genuine fractions occur in the retained text.** A `\d{1,3}/\d{1,3}` rule of the
   Ukrainian shape would have read every one of them as a fraction.
3. **`=` is mostly a BIBLIOGRAPHIC TITLE SEPARATOR**, the Lithuanian lesson repeating: `Запісы =
   Zapisy`, `Беларускі гістарычны зборнік = Białoruskie Zeszyty Historyczne`, `Беларусіка =
   Albaruthenica`. Two of the nine are real equations (`1 аўстр. дол. = 0,71 дол. ЗША`, `фунт
   стэрлінгаў = 100 пенсаў`) and one is raw LaTeX the dump extraction left in.
4. **`М` after a digit is a TRAIN MODEL** (`81-717.5М/714.5М`), not mega-anything.

**And two ambiguities that are real and need a discriminator, not a refusal:**

- **`г.` is год after a figure and гэтак далей in `і г.д.`** — `438 г. н.э.`, `13 сакавіка 1990 г.`,
  `Python, Ruby і г.д.`, and `574,8 км/г.` where it is *гадзіну* plus a sentence-final stop.
- **`м.` is метраў after a figure and мыс before a place name** — `на глыбіні 100—200 м.` against
  `у раёне м. Ігольнага`. The figure is the discriminator, and the trailing dot in the first is the
  sentence end (trap 58).

**Ranges are genuine here, unlike Ukrainian's.** uk found 3 of 19 dashes were scores; be's are
`10—20 мм ападкаў`, `300—350 км`, `100—200 м`, `3—6 км`, `1-3 працоўных дзён`, `7-14 дзён`,
`7-21 дзень`. The football scores exist (`5—2`, `9-4`) but are the minority.

## Run 3 — 2026-08-16 — sourcing, and four false attestations in one batch

**Command** `attest.ts --lang be --words …` in five batches, then reading every example.

**Raw finding** — the ones that carried, with the sense checked:

| word | hits/arts | the example that settles it |
|---|---|---|
| `працэнт` | 16/13 | its own article, sign and word in one sentence: "гулец, які кідае на **33 %**, пападае кожны трэці кідок. **Працэнт** апісвае некалькі дыскрэтных падзей" |
| `градусаў` / `Цэльсія` | 31/15, 50/17 | "тэмпература **25 градусаў Цэльсія**", "−182.5 **градусаў Цэльсія**"; and the Цэльсія article names the sign ("за **100°** — тэмпература кіпення") |
| `коска` | 25/16 | the Коска article both names the sign and reads a number with it: "у беларускай форме запіса дзесятковых дробаў **коска** аддзяляе цэлую і дробную часткі ліку … напрыклад: **5,7 — пяць цэлых сем дзесятых**" |
| `памножыць на` / `падзяліць на` | 10/7, 13/13 | the multiplication article READS THE NOTATION ALOUD: "**2 ⋅ 3 = 6** … чытаецца «**два памножыць на тры роўна шасці**», або проста «**два на тры ёсць шэсць**»" |
| `менш за` / `больш за` | 21/6, 9/8 | "не **менш за** 20 гадоў", "**больш за** 4 млн узнагароджанняў" — both with a plain numeral |
| `мінус` | 27/17 | be.wikipedia renders the film title `ゴジラ -1.0` as «Гадзіла **мінус адзін**» — the sign read aloud before a numeral |
| `долар` | 101/16 | the currency article, "**Долар** — назва валют мноства краін, першапачаткова ЗША" |
| `у квадраце` | 10/8 | "ват дзяліць на **метр у квадраце**" — exactly the bare-exponent slot |
| the 20 ordinals | 39 … 1 | `першы` ×39 · `трэці` ×47 · `саракавы` ×20 · `дзевяносты` ×8 · `тысячны` ×41; the 50–80 tens are thin (×1–3) but present |

⚠ **And four are FALSE attestations, each with a healthy count:**

- **`роўна` ×49/17 — every hit is RIVNE, the Ukrainian city.** The word for `=` had to come from the
  multiplication article instead.
- **`даляр` ×12/9 — every hit is a PLACE or a PERSON**: "чыгуначная станцыя Даляр" in Azerbaijan, and a
  character name. So the наркамаўка spelling `долар` ships and the тарашкевіца one does not.
- **`плюс` ×40/15 — every hit is «Гродна Плюс», a television channel.** (The sign word is still safe:
  it is the twin of the `мінус` attestation above and the corpus's own `+28 °C` needs it.)
- **`у ступені` ×5/3 — the ORDER-OF-MERIT sense**, "у ступені «Вялікі крыж»", not the exponent.

⚠ **And one where the higher count is the WORSE source.** `адсотак` scored ×20 in 20 articles against
`працэнт`'s ×16 in 13 — but every one of those twenty is the same copy-pasted football-table legend,
`% = Адсотак перамог`. Twenty articles carrying one template is **one** source, not twenty. (The legend
is a genuine sign→word mapping and `адсотак` is a real Belarusian word; the decision is about which
evidence is independent, not about which word exists.)

**A sourced choice that is lossy on purpose.** The Коска article gives the full spoken reading of `5,7`
as *пяць цэлых сем дзесятых* — but `цэлых` AGREES (адна цэлая / дзве цэлыя / пяць цэлых) and the tail
names the decimal place (дзесятых / сотых / тысячных), neither of which the number path can carry. The
punctuation name is emitted instead, the same call `uk` made (кома) and `pl` made (przecinek).

**And one where the case government forced the register.** `роўна` governs the DATIVE (*роўна шасці*)
and this layer emits nominative digits — the problem `ru` solved with `чем` and `uk` with a nominative
attestation. Here the same sentence supplies the short register, *два на тры ёсць шэсць*, nominative on
both sides, so `=` takes `ёсць` and `×` takes the matching `на`.

## Run 4 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 33→2 · `degree` 17→0 · `currency` 17→1 · `exponent` 16→2 · `minus`
  11→2 · `ampersand` 2→0 · `math-sign` 28→10.
- **corpus diff** (baseline emitted from a pristine worktree at HEAD): **261/458 utterances changed
  (57.0%), DROP 96 → 17**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW on either
  side. Reading the changes: `нуль нуль` → `мільён`, `sˈiː` → `градусаў Цэльсія` throughout, `км` →
  `кіламетраў`, `кг/км²` → *кілаграмаў на квадратны кіламетр*, `7-е` → *сёмае*, `1-га` → *першага*,
  `X ст.` → *дзясятае стагоддзя*, and every author's initial (`Станкевіч Я.`, `Шпакоўская Г.`) now a
  letter name instead of a bare consonant plus a spurious full stop.
- **`review.ts --lang be`**: green on every checklist item except the artifact scan; `equals` is
  registered in `ACCEPTED_SIGN_SILENCE` with its measurement rather than left as a bare DROPPED line.
- **`referee-eval be`**: **97.2% folded / 99.6% symbol, before and after** — the expected result for a
  layer that rewrites text rather than the word g2p.
- **`vitest`** 4,484 passed · **`tsc --noEmit`** clean.

**One defect the tests caught that the corpus could not.** `2/5` read as *дзве пятая*: the denominator
was taking the feminine SINGULAR for every numerator, where Belarusian agrees three ways — *адна пятая*
/ *дзве пятыя* / *пяць пятых*. The corpus contains no fraction at all (run 2), so only a branch-pinned
test could find it; the same one-form shape is what `uk`'s rule still has.

**A measurement that ended in "no rule".** be.wikipedia writes some Roman numerals with CYRILLIC
homoglyphs (`ХХ`, `ХІ` for XX, XI), which `core/roman.ts` cannot see. Counted over the retained text:
**2 usable instances** (plus two bare `І`). `М` ×11 and `С`/`СС` ×11 look like the same shape and are
the metro-model letter and the SS division. Two instances do not license a rule (trap 17 in the
direction that says no); they now read as letter names rather than as a consonant cluster, which is the
initialism pass doing its ordinary job.
