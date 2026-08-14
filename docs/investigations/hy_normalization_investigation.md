# hy (Eastern Armenian) — text-normalization investigation

Worktree `vernacula-norm-fanout/hy`, branch `norm-hy`. Playbook: `docs/normalization_playbook.md`.
`FLEURS` is unset, so every corpus gate runs against `mined:hy` / `tools/corpus/mined/hy.jsonc`
(dump-sourced, 2,517,219 segments, 460 retained: 260 hard + 200 sample — and because it is
dump-sourced the sample tier IS the language's real distribution).

---

## Run 1 — 2026-08-14 13:54

**Command.** `git branch --show-current`, `ls docs/normalization_playbook.md src/languages/`,
then playbook rule 0 confirmed. `FLEURS` unset.

**Question.** Am I in the right tree, and which corpus do the gates read?

**Raw finding.** Right tree, branch `norm-hy`, playbook + `src/languages/` both present.
`src/languages/armenian/{armenian.ts,armenian.jsonc}` exist; no `normalize.ts`.
`FLEURS=unset` → `--corpus mined:hy` everywhere.

**Implication.** Emit the corpus-diff baseline BEFORE touching anything (fan-out rule 2).

---

## Run 2 — 2026-08-14 13:56 — the baseline, emitted before any edit

**Command.**
```
npx tsx tools/normalization/corpus-diff.ts emit --lang hy --corpus mined:hy --out /tmp/claude-1000/hy.before
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/hy.jsonc --lang hy
npx tsx tools/normalization/review.ts --lang hy
npx tsx tools/referee-eval/eval.ts hy
npx tsx tools/normalization/sources.ts --lang hy
```

**Question.** What does the untreated engine produce, and what do the mechanical gates say?

**Raw finding.**
```
emitted 459 utterances → /tmp/claude-1000/hy.before

scan:  DROP percent ×52 · DROP exponent ×24 · DROP minus ×17 · DROP currency ×17
       DROP math-sign ×16 · DROP degree ×13 · DROP ampersand ×3
       MARKUP math-sign ×1 · FOREIGN ampersand ×5

review: [FAIL] normalizer  src/languages/armenian/normalize.ts missing   (1 FAILING)

referee: raw exact 11/18090 (0.1%) · folded backbone 14923/18090 (82.5%) · symbol accuracy 96.6%
         (a WORD list — normalization cannot move it; recorded so the after-run is comparable)

sources: [NONE] letter-names   espeak does not ship hy at all
         [NONE] decimal-point  no _dpt, no _., no manifest word
         [NONE] era-phrase     marker occurs and no era vocabulary anywhere
         [chk?] percent/currency/unit/minus/equals/times/ampersand/plus/exponent
```

**Implication.** Six live DROP classes, and no vocabulary shipped for any of them. espeak is not a
route for this language at all, so §5c is closed and everything has to come from the corpus itself,
the referee, or `attest.ts` against hy.wikipedia.

---

## Run 3 — 2026-08-14 14:02 — first probes through `phonemize(x, "hy")`

**Command.** a tsx probe harness over `src/index.ts`, ~30 attested surface forms.

**Question.** What does the engine actually PRODUCE for each shape the corpus writes (playbook step 2)?

**Raw finding.**
```
"5%"              → hinɡ                              percent sign silently GONE
"35,6°"           → jeɾesun hinɡ , vet͡sʰ              decimal comma read as a CLAUSE PAUSE
"10.7"            → tɑsə . jotʰ                       decimal period read as a FULL STOP
"29 743"          → kʰəsɑn inə  jotʰhɑɾjuɾ kʰɑrɑsun jeɾekʰ    two separate numbers
"1 500 000"       → mek hinɡhɑɾjuɾ zəɾo               THREE numbers, and 000 read as "zero"
"36 կմ"           → jeɾesun vet͡sʰ kmə                 ⟨կմ⟩ leaks as a consonant cluster + epenthetic ə
"2500 մ"          → jeɾku hɑzɑɾ hinɡhɑɾjuɾ mə         ⟨մ⟩ → [mə]
"5 կմ²"           → hinɡ kmə                          exponent gone too
"42-րդ"           → kʰɑrɑsun jeɾku ɾdə                the ordinal suffix as a bare cluster [ɾdə]
"5-ին"            → hinɡ in                           bound dative read as a SEPARATE WORD
"20%-ով"          → kʰəsɑn ov                         sign dropped AND the suffix orphaned
"1950-ական …"     → hɑzɑɾ innhɑɾjuɾ hisun ɑkɑn …      decade suffix as a separate word
"մ.թ.ա. 550"      → mə . tʰə . ɑ . hinɡhɑɾjuɾ hisun   era marker letter-by-letter, three false pauses
"հս․ լ․"          → hsə lə                            U+2024 abbreviation dot DROPPED (no pause either)
"10:30"           → tɑsə , jeɾesun
"20 °C"           → kʰəsɑn sˈiː                       ° dropped, ⟨C⟩ read as the ENGLISH letter name
"+15.2°С"         → tɑsnhinɡ . jeɾku s                Cyrillic С; +, ° and the scale all gone
"3/4"             → jeɾekʰ t͡ʃʰoɾs                     two bare cardinals
"ԽՍՀՄ"            → χshmə                             vowel-less cluster
"ԲՀՊՏ"            → bhptə
```

**Implication.** Every high-count cell is defective, and three of them are trap-56 defects that
produce a READING rather than garbage: `1 500 000` → "one five-hundred zero", `41.8կմ2` → "…km TWO",
and the bound case suffixes, which turn one Armenian word into two. The traps the task flagged both
bite: `\b` is useless (Armenian script), and any "not inside a word" guard needs `\p{M}`.

---

## Run 4 — 2026-08-14 14:15 — tabulating what the corpus actually writes

**Command.** dumped `hard` + `sample` out of the artifact and counted shapes with `\p{Nd}`-safe
patterns (the artifact's own `counts` block gives the dump-wide figure).

**Question.** Which defects are worth fixing, in proportion to their corpus count (playbook step 2)?

**Raw finding.** dump-wide / hard-set / sample-tier:

| shape | dump | hard | sample |
|---|---:|---:|---:|
| ranges | 200,448 | 120 | 33 |
| decimals | 143,700 | 189 (122 `.` + 67 `,`) | 37 |
| abbrev | 143,379 | 183 | 19 |
| grouped | 59,563 | 52 | 7 |
| exponent | 49,398 | 29 | 12 |
| percent | 46,637 | 99 | 8 |
| clock | 23,711 | 13 | 0 |
| degrees | 13,805 | 23 | 0 |
| era-marker | 10,231 | 30 | 3 |
| ordinal-latin | 7,393 | 67 (`-րդ`) | 18 |
| signed-number | 6,953 | 16 | 0 |
| currency | 3,194 | 32 | 0 |
| units | 163 | կմ 38 · մ 20 · կգ 10 · սմ 7 · մմ 4 | կմ 12 |

And the shape the cell inventory does NOT have a name for, which is this language's defining one —
**a bound case suffix glued to the digits with a hyphen: 185 in the hard set and 66 in 200 uniform
sample paragraphs**, denser than anything else:

```
-րդ 78 (ordinal)   -ին 57   -ական/-ականների/-ականներին/-ականներից 41 (decade)
-ը 22   -ի 20   -ից 16   -րդն 6   -ն 3   -ով 2   -ամյա/-օրյա/-անոց/-յակի 4
```

**Implication.** Trap 14 (Welsh/Azerbaijani) is hy's defining rule, and trap 15's warning applies —
I checked for the SPACED variant too (`\d+ (ին|ի|ից|ը)`) and hy does not detach these, so the
alternation stays glued-only. The suffix must be glued to the LAST NUMBER WORD, which means
converting the operand to words inside the rule.

---

## Run 5 — 2026-08-14 14:30 — the three ambiguity questions the corpus had to arbitrate

### 5a. Is `\d{1,3}[.,]\d{3}` grouping or a decimal? — BOTH, and hy writes all four conventions

**Question.** hy uses SPACE, PERIOD and COMMA as thousands separators AND PERIOD and COMMA as the
decimal mark. A de-grouping rule that guesses wrong reads 1,380 km² as 1.38 km², or 0.624 km² as
624 km². What discriminates them?

**Raw finding.** Every `\d{1,3}[.,]\d{3}` instance in the retained corpus, read by hand — 34 single-group
+ 6 multi-group:

```
DECIMAL (13)                            GROUPING (21)
0.951                                   1.000-2.500 մ      $100.000 եկամուտ
159,681 մլրդ $      2.955 տրլն          4.090 մետր         44.800 զինվոր
2.917 տրլն          2.095 մլրդ մարդ     210.000 պահեստային $4,719
1,858 միլիարդ       0,012 կգ            $27,875-ով         $27,624-ով
6,022 × 10²³        3,086 × 10¹³        1.327 մետաղադրամներ 3.000 մետրից
0,022 %             0,018 %             NZ$47,836          1.380 կմ²
0,023 տոկոսը        0,624 կմ²                              19.797 մարդ
0,302 կմ²                                                  49.300 մարդ  + 5 timeline-markup
                                        MULTI-GROUP (6): 212,346,064 · 45,000,000 · 37,000,000
                                        3.018.854 · 2.961.801 · 1.400.000.000.000.000.000
```

Three discriminators cover all 13 decimals and misclassify none of the 21 groupings:
1. the integer part is `0` (7 of the 13);
2. a MAGNITUDE word follows — մլն/մլրդ/տրլն/միլիոն/միլիարդ (4);
3. `×` or `%` follows (4, overlapping).
Multiple groups is unambiguously grouping. 1–2 digits after the separator is unambiguously a decimal
(72 instances, e.g. `35,6`, `10.7`, `13.3`, `76.5%`).

**Implication.** De-group only when the group count is ≥2, or the group count is 1 and none of the
three decimal signals is present. Ordering: de-grouping first (playbook step 4), because otherwise
the grouping mark is read as clause punctuation.

### 5b. Is a bare `\d{1,2}:\d{2}` a clock? — NO. Trap 55's ilo lesson, reproduced exactly

**Question.** the `clock` cell is 23,711 dump-wide, which looks like a mandatory rule.

**Raw finding.** all 13 retained instances:

```
ժամը 21:00-ին                                   ← the ONE clock, and it carries ժամը
Շահիհ ալ-Բուխարի, 8:73:56                        a hadith reference
Ժամը 9:26:53-ին                                  a date-TIME, H:MM:SS
00:39:26 + 00:29:43 + 00:30:01 + 00:25:00 + 00:22:59
00:55:42 · 01:39:46 · 00:13:38 · 01:49:51 · 01:30:40    nine FILM DURATIONS, H:MM:SS
```

**Implication.** A ceb-shaped bare-colon clock would fix 1 instance and break 12. REFUSED. The
narrow arm (`ժամը` + clock) would fix exactly 1 and break 0, and is not worth the code or the
`զրո զրո` reading of `:00` it would have to invent. Recorded, re-runnable in one grep.

### 5c. Is a `\d+\.\d+` glued to letters a VERSION (trap 28/46)? — NO, in hy it is always a decimal

**Question.** every layer that declares a one-letter unit key has to answer this, and `մ` = metre is
a one-letter key I want.

**Raw finding.** every `\d+\.\d+[letter]` in the retained corpus:

```
3.2կմ · 1.2Gbps · 3.6Tbps · 19.2Tbps · 3.2մլրդ · 0.5g · 0.53կմ/կմ2 · 0.81կմ/կմ2 · 41.8կմ2 · 16.8կմ2
```

Ten instances, **ten decimals glued to a unit, zero versions**. hy's version-dot cell is 700
dump-wide against a `dotted` cell of 38,341, and none of the 700 reached the retained text.

**Implication.** the inverse of trap 28's 444-against-4. A `NOT_VERSION` guard here would reject
ten true readings to protect against a shape the corpus does not write, so it is deliberately absent.
Two by-products: `կմ2`/`կմ3` with an ASCII digit is hy's ordinary way of writing the exponent
(trap 53 — left alone, `41.8կմ2` reads "…km TWO"), and the decimal rule must anchor its operand so
a dotted DATE (`30.08.1918`, `8.11.1953`, `22.9.1992`) is not claimed.

---

## Run 6 — 2026-08-14 15:05 — sourcing (§5c is closed; §5e route only)

**Command.** in-corpus word-boundary counts with `(?<![Ա-Ֆա-և])` (never `\b` — trap 1), then
`npx tsx tools/normalization/attest.ts --lang hy --words …` in three batches.

**Question.** where does every word this layer would emit come from, and does its SENSE fit the slot?

**Raw finding — sourced from the CORPUS ITSELF, sense read:**

| word | count | the sense, read |
|---|---:|---|
| `տոկոս` | ×11 | **every one** postposed after a figure: `95 տոկոսը`, `76,85 տոկոսը`, `83 տոկոս`, `100 տոկոսով`, `43.6 տոկոսը`. No competing sense. |
| `դոլար` | ×10 | `599 դոլարով`, `49 դոլար`, `186,7 մլրդ ամերիկյան դոլար`, `34 910 ամերիկյան դոլար (NZ$47,836)` — and that last one is the sign and the word in one sentence (trap 12) |
| `խորանարդ` | ×2 | both `խորանարդ ԿԻԼՈՄԵՏՐ` — the cube measure word, **before** the noun |
| `հեկտար` | ×7 | `2677 հեկտար`, `722 հեկտարն`, `115 հազար հեկտար` |
| `մետր` ×33 / `միլիմետր` ×4 | | plain measurements |
| `մեր թվարկությունից … առաջ` | ×1 | `մեր թվարկությունից 28 դար առաջ` — the era phrase, spelled out |
| `թվական` | ×313 | what `թ.` abbreviates |
| ordinals | | `առաջին` ×69 · `երկրորդ` ×13 · `երրորդ` ×7 · `չորրորդ` ×4 · `մեկ վեցերորդը` (a FRACTION: numerator + ordinal denominator) |

**Raw finding — four words the bare count would have got WRONG (trap 37):**

```
աստիճան   ×6  — every one is the ACADEMIC degree or աստիճանաբար "gradually". ZERO temperature/angle.
քառակուսի ×1  — the SHAPE: "4 սյուներով քառակուսի դահլիճ", a square hall. Not a measure word.
եվրո      ×8  — 7 are եվրոպական "European". One (`17 հազար 709 եվրո`) is the currency.
դրամ      ×3  — մետաղադրամներ (coins), դրամատիկական (dramatic), and one real "currency" sense.
```

**Raw finding — `attest.ts` on hy.wikipedia, examples READ:**

```
word                    token arts substr verdict   the sense in the printed prose
Ցելսիուսի աստիճան        4     3    6     attested  "քանզի գրվում է «Ցելսիուսի աստիճան»" — an SI-naming
                                                    article stating the Armenian form; and
                                                    "ջերմաստիճանը 25-40 ցելսիուսի աստիճան է" — the slot
քառակուսի կիլոմետր      35    19    0     attested  "Քառակուսի կիլոմետր (կմ², km², քառ. կմ), մակերեսի
                                                    չափման միավոր" — DEFINES the ² measure word and names
                                                    both abbreviations. Position: BEFORE the noun.
խորանարդ կիլոմետր        8     7    0     attested  "112 հազար խորանարդ կիլոմետր", "38 խորանարդ մետր"
սանտիմետր               41    15    1     attested  "Սանտիմետր (հայերեն հապավումը. սմ; …cm)" — gives the key
կիլոգրամ                61    19    0     attested  "Կիլոգրամ (նշանակումը՝ կգ, kg)" — gives the key
մեր թվարկությունից առաջ 139   15    0     attested  "Մ.թ.ա.-ն հապավվում է «Մեր թվարկությունից առաջ»" —
                                                    the abbreviation DEFINED, in the wiki's own words
կիլոմետր ժամում          3     2    0     attested  "74 կիլոմետր ժամում (40 հանգույց)"; the same article
                                                    writes "0-ից մինչև 161 կմ/ժ" — key and reading together
եվրո                    64    11    0     attested  "Եվրո (տարադրամի կոդը՝ EUR)", "5 եվրո արժողությամբ"
տոկոս                   99    16    0     attested
ամերիկյան դոլար          9     4    1     attested
տասնորդական կոտորակ      3     3   10     attested  ★ see below
հարյուրերորդ 25/16 · տասներորդ 26/13 · հազարերորդ 21/19 · քսաներորդ 21/12 · հիսուներորդ 17/13
քառասուներորդ 22/11 · քսաներկուերորդ 13/12 · քառասուներեքերորդ 4/4 · տասնմեկերորդ 89/19 · վաթսուներորդ 15/13
մինուս                  28     2    0     attested  an article ABOUT the +/− signs. Right word, and see below.
հանած                   22    14    0     attested  ✗ REJECTED ON PART OF SPEECH — every instance is the
                                                    two-operand accounting participle ("ստացված վճարը հանած",
                                                    "գումարած կամ հանած"), never a prefixed negative.
                                                    The Fula `hakkunde` shape.
ամբողջ / ստորակետ                          attested  ✗ on sense, in isolation: `ամբողջ թիվ` is INTEGER and
                                                    `Ստորակետ` is the article on the comma as punctuation.
ամբողջ տասնչորս / ամբողջ հինգ  0  0   0    absent
```

★ **The decimal word, which is the highest-traffic slot in the layer (143,700), was settled by a
probe aimed at something else.** `տասնորդական կոտորակ` ("decimal fraction") returned:

> `0.{\dot {9}}` («**զրո ամբողջ ինը պարբերական**»), պարբերական տասնորդական կոտորակ

That is 0.(9) **read out loud in Armenian**: "zero WHOLE nine repeating". The separator word is
`ամբողջ`, the fractional digits are read as a plain cardinal, not as an ordinal denominator. The
same batch's `ամբողջ մասը` examples corroborate the register: "2,7 թվի ամբողջ մասը հավասար է 2".
Two independent uses, one of them a literal read-aloud of the exact shape the rule fires on.

**Raw finding — the ordinal morphology, fully determined by the attested forms:**

```
առաջին(1) երկրորդ(2) երրորդ(3) չորրորդ(4)     irregular, and ONLY when the number IS 1–4
վեցերորդ(6) յոթերորդ(7) իններորդ(9) տասներորդ(10) տասնմեկերորդ(11) տասնհինգերորդ(15)
քսաներորդ(20) քսաներկուերորդ(22) քսանհինգերորդ(25) քառասուներորդ(40) քառասուներեքերորդ(43)
հիսուներորդ(50) վաթսուներորդ(60) հարյուրերորդ(100) հազարերորդ(1000)
"Հարյուր հիսուներորդ" (150) · "Երկու հարյուրերորդ" (200) · "Երկու հարյուր հիսուներորդ" (250)
```

So: **the suffix `-երորդ` attaches to the LAST cardinal word**, a final `ը` becomes `ն`
(ինը→իններորդ, տասը→տասներորդ), and 22 uses `երկու+երորդ` — the irregular `երկրորդ` is the
standalone form only.

**Implication.** Everything the layer needs is sourced except a plus word (deliberately — see Run 7),
an ampersand word, arithmetic signs, and Armenian letter names.

---

## Run 7 — 2026-08-14 15:25 — the sign classes, priced individually (traps 24, 48, 53)

**Question.** the scan lists DROP minus ×17, math-sign ×16, ampersand ×3. Which are real?

**Raw finding — every minus-shaped instance in the retained corpus, read:**

```
REAL NEGATIVES (4)      -4.9 %   ·   -0,018 %   ·   -20&nbsp;°C   ·   −15&nbsp;°C   (U+2212)
RANGES (6)              10–14 գաուս · (1,0 - 1,4 մՏ) · 0,6 - 30 MHz · (1985 - 2005) · 1917 - 1921
                        · 2000 թվականի հունվար - 2000 թվականի սեպտեմբեր
BIBLIOGRAPHIC (4)       "1480-1630. - 1. - Cambridge" · "1984. - 394 էջ" · "1996. - 455 էջ"
IDENTIFIERS (2)         ISBN 0-521-27698-5 · "գրանցման կոդը - 010401006121…"
MARKUP (5)              shift:(-10,5)
```

**All four true negatives are followed by `%` or `°C`.** That is hi's trap-24 shape exactly, arrived
at from the corpus rather than borrowed: the right context is the discriminator when the left one is
exhausted, and both arms have zero counter-examples here.

**Raw finding — every plus-shaped instance (11):** `+15.2°С`, `+7 °C`, `+26-28°С`, `+8-9 °C`,
`+24-25 °C`, `+28-ից +32 °C`, `+8-ից +10 °C`, `+ 30 … + 40 °C`, `+ 17 … + 20 °C`, `−15/+…`.
**Every single one is a temperature.** No `UTC+1`, no arithmetic plus.

**Raw finding — ampersand (9):** `AT&T` ×2, `R&B` ×2, `Shake, Rattle & Roll`, `Gerry & The
Pacemakers`, `Eddie & the Showmen`, `Film & Drama`, `A. & C. Black`. **Nine of nine sit inside an
English phrase** and reach the engine through the Latin-run router, not through Armenian.

**Raw finding — math-sign (16):** `×` ×4 (all scientific notation, `6,022 × 10²³`), `=` ×10 (LaTeX
`P_C/P_W = a_{LC}/a_{LW}`, linguistic glosses `dé = „deutsch"`, the Armenian-numeral table
`Ա =1, Ժ = 10`, and one `2+2=4`), `>` ×1 (`> 12Tbps`).

**Implication.**
- **Minus: SHIPPED**, narrowly — a sign whose operand is followed by `%` or a degree. 4/4 true, 0 false.
- **Plus: REFUSED**, and the refusal is the playbook's own reasoning rather than mine: omitting a
  measurement plus is lossless (`+30°` and `30°` are the same temperature) where omitting a minus
  inverts. 11/11 instances are that case. Costs nothing and saves authoring an unsourced word.
- **Ampersand: REFUSED to hy**, because it is not hy's — the reading belongs to the English fallback.
- **Arithmetic `= × ÷ ± < >`: REFUSED.** `×` in `6,022 × 10²³` is the only contentful use (4
  instances) and its word would have to be authored from nothing; `=` has no single reading across
  its ten instances.

---

## Run 8 — 2026-08-14 15:40 — what stays deferred, with the count each deferral costs (trap 17)

- **Initialisms — the largest untreated class.** 25 distinct Armenian acronyms in the retained text
  (ԱՄՆ ×17, ՀՆԱ ×12, ԽՍՀՄ ×7, ԵՄ ×5, ՄԱԿ ×4, ՀԽՍՀ ×4 …), `initialism` cell 373,760 dump-wide.
  The seam EXISTS (`core/initialisms.ts`, ~30 languages wired) — I checked, per trap 16 — and it is a
  no-op without a `letterName` table. `sources.ts` says `[NONE] letter-names — espeak does not ship
  this language at all`, so there is no in-repo source for the 38 Armenian letter names and the
  blocker is sourcing, not code. What the refusal costs, read out:
  `ԽՍՀՄ → [χshmə]`, `ԲՀՊՏ → [bhptə]`, `ՀԽՍՀ → [hχshə]`, `ՓԲԸ → [pʰəbə]` — vowel-less clusters, which
  is exactly what that seam exists to prevent. `ՄԱԿ → [mɑk]` and `ՆԱՏՕ → [nɑto]` are already right.
  Recorded as a sourcing job, not a coding one.
- **`՛` (U+055B) ×9** — every instance is the arc-minute in a coordinate (`42°35՛`, `9°16՛`). It is
  otherwise Armenian's emphasis mark, where silence is correct. Left dropped; 9 instances.
- **ASCII `:` ×148** substitutes for the Armenian full stop `։` in five retained sentences
  (`…առաջընթացը: Ըստ…`) while also carrying the durations and foreign bibliographic colons. It is a
  `clausePunctuation` question in the manifest, not a normalization one, and it currently reads as a
  comma-level pause. Left alone; noted.
- **Latin unit keys.** After a number the corpus writes GB ×5, Tbps ×3, MHz ×1, mm ×2, W ×2 — and
  `at ×10 / p ×5 / S ×5 / G ×2`, which are all wiki TIMELINE markup (`bar:1971 at: 1084`,
  `fontsize:S`), not units. Too thin and too contaminated to declare; hy writes its units in Armenian.

---

## Run 9 — 2026-08-14 16:10 — writing the layer

See the header of `src/languages/armenian/normalize.ts` for the shipped step order and the coupling
comment at each step. The choices that were not obvious:

- **Steps run de-grouping → era → abbreviations → ordinal/suffix → decimal → tier.** The decimal step
  is LATE on purpose: it spends the `.`/`,`, and both the de-grouping discriminator (Run 5a) and the
  dotted-date guard need those characters intact (trap 39 — a guard's evidence has a lifetime).
- **The bound-suffix rule converts its operand to WORDS inside the rule** (trap 14), because
  `հինգ`+`ին` has to become one token `հինգին`; a digit cannot take a suffix. Its digit class is
  anchored to end in a digit (trap 14's Welsh hazard) so it cannot eat a trailing clause comma.
- **Range: a PAUSE, not a joiner word.** The corpus attests `N-ից մինչև M` (×6, e.g.
  `2100-ից մինչև 2400-2500 մետր`, `0-ից մինչև 161 կմ/ժ`) but only where the WRITER chose to write it;
  imposing it on all 200,448 bare dashes would over-claim, and `1915-ից մինչև 1923 թվականներին`
  fights the noun's own case. The dash is currently silent and the two operands run together as one
  utterance, so a comma-level pause is the minimal fix that invents no vocabulary. Priced in Run 11.

---

## Run 10 — 2026-08-14 16:40 — the leading zero, found by a test I wrote wrong

**Command.** `npx vitest run test/armenian.test.ts`, on an expectation I had written as
`normalizeArmenian("2.095 մլրդ") === "2 ամբողջ 95 միլիարդ"`.

**Question.** none — it was a typo in a test. What it surfaced was not.

**Raw finding.** `Received: "2 ամբողջ 095 միլիարդ"`. The fractional part was being left as DIGITS (which is
right — words there would destroy the number–unit adjacency the shared tier matches on), and `Number("012")`
is 12, so the engine reads `0,012 կգ` as *զրո ամբողջ ՏԱՍՆԵՐԿՈՒ կիլոգրամ* — **0.12, ten times too big**, in a
well-formed Armenian numeral. Five of the ~200 retained decimals have a leading zero in the fraction
(`0,012`, `0,018`, `0,022`, `0,023`, `2.095`).

**Implication.** This is trap 56's worst shape — a defect that produces a READING, and one no counter sees:
DIGIT, RAWMARK, SLOT-GAP, DROP and the referee are all blind to it, and the corpus diff shows it as a
perfectly ordinary improvement. Fixed by spelling each leading zero with the engine's own `units[0]` and
leaving the rest as digits, so the adjacency survives: `0,012 կգ` → `0 ամբողջ զրո 12 կգ` →
*զրո ամբողջ զրո տասներկու կիլոգրամ*. The complete alternative — a denominator ordinal
(*…հազարերորդ*, composable from the attested series — costs exactly that adjacency, so it was not taken.

**And the general lesson, which is the reason this run is in the log at all:** I found a silent 10× error by
writing an assertion carelessly. Pin a number ladder at every branch boundary (trap 56's own closing line).

---

## Run 11 — 2026-08-14 17:05 — gates

**Command / raw finding.**

```
npx vitest run            245 files, 4225 passed, 5 skipped, 0 failed
                          (test/languageCatalogue.test.ts failed first at "2 cell(s) differ" — expected;
                           regenerated with derive-normalization.py + build.py, see the ⚠ below)
npx tsc --noEmit          clean
npm run check:package     ok — 982 files, no docs/ tools/ test/
npx tsx tools/referee-eval/eval.ts hy
      BEFORE  folded backbone 14923/18090 (82.5%) · symbol accuracy 96.6%
      AFTER   folded backbone 14923/18090 (82.5%) · symbol accuracy 96.6%     ← byte-identical
      (a WORD list; normalization cannot move it. Recorded so "unchanged" is a measurement, not an assumption.)
npx tsx tools/referee-eval/eval.ts hyw
      86.8% / 98.0% — unchanged. The shared engine builder took an optional `pre` defaulting to identity,
      so Western Armenian is provably untouched (trap 55: a sibling is a hypothesis, not a source).
```

⚠ **THE CATALOGUE NOW RECORDS A WRONG CELL FOR `hyw`, AND I HAVE NOT FIXED IT — it is a shared-tool defect,
reported rather than edited.** `derive-normalization.py` follows delegation by asking whether a directory
imports and CALLS a factory (`create*`/`make*`) from another language. `westarmenian.ts` imports
`makeArmenianEngine` from `../armenian/` — it always did — so the moment `src/languages/armenian/normalize.ts`
came into existence, hyw flipped from `(empty)` to `inherited`. **No Armenian normalizer runs for hyw**: the
factory's `pre` parameter defaults to identity and hyw passes nothing. This is precisely the failure the
script's own header documents at length (`rn` borrowing one function from Kinyarwanda "reported `inherited`
the moment kinyarwanda gained a normalize.ts, though no Kinyarwanda normalizer runs for it"), and it calls it
"the worst failure available to it, since a language that needs work reads as done". Not fixed here because
the narrowed FACTORY test is the fleet-wide heuristic, a change to it is a fleet change needing an `--all`
re-verification (trap 21), and three sibling agents are in the same tree.

## Run 12 — 2026-08-14 17:20 — corpus diff, READ rather than counted

```
npx tsx tools/normalization/corpus-diff.ts emit --lang hy --corpus mined:hy --out …/hy.before   (before any edit)
npx tsx tools/normalization/corpus-diff.ts emit --lang hy --corpus mined:hy --out …/hy.after
npx tsx tools/normalization/corpus-diff.ts compare --before …/hy.before --after …/hy.after

  changed 272/459 (59.3%)
  leak classes   DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · THROW 0
                 DROP 117 → 38
```

**79 of the 200 SAMPLE-tier paragraphs moved** — the tier that shows what a rule BREAKS rather than what it
fires on — and every delta was read. A representative slice, before → after:

```
⟪DROP:percent⟫ → tokos                        the sign, in 8 sample paragraphs
kmə → kʰɑrɑkusi kilometəɾ                     կմ² : cluster+schwa → square kilometre
smə → sɑntimetəɾ   ·  kɡə → kiloɡɾɑm  ·  kɡə hɑ → kiloɡɾɑm hektɑɾ   (կգ/հա, the slash rule)
, → ɑmboʁd͡ʒ                                   a decimal comma that was a CLAUSE PAUSE
mek . → hɑzɑɾ   ·   . zəɾo → hɑzɑɾ            `1.000` : "one FULL-STOP zero" → հազար
vet͡sʰ ɾdə → vet͡sʰeɾoɾd  ·  tɑsninə ɾdə → tɑsninneɾoɾd  ·  jeɾekʰ ɾdə → jeɾɾoɾd   (the irregular)
utʰsun ɑkɑn tʰtʰə . → utʰsunɑkɑn tʰəvɑkɑnneɾ  `80-ական թթ.`
kʰəsɑn utʰ . tɑsnmek . → … tʰəvɑkɑni nojembeɾi kʰəsɑn utʰ    `28.11.1953`
mə . tʰə . ɑ . utʰ ɾdə → meɾ tʰəvɑɾkutʰjunit͡sʰ ɑrɑd͡ʒ utʰeɾoɾd    `մ.թ.ա. 8-րդ`
jeɾku it͡sʰ → jeɾkusit͡sʰ  ·  inə in → inin  ·  hinɡ in → hinɡin   the bound suffixes
(blank) → ,                                   a range dash that had been silent
```

**No delta in either tier was a regression.** The one change I introduced and then had to close was
self-inflicted and is in the log at Run 13.

## Run 13 — 2026-08-14 17:30 — the leak a rule of mine CREATED

**Command.** reading the sample-tier delta `[kmə kʰɑr → kilometəɾ kʰɑrɑkusi]`, then
`normalizeArmenian("25 բնակիչ յուրաքանչյուր քառ. կմ վրա")`.

**Raw finding.** `"25 բնակիչ յուրաքանչյուր քառակուսի կմ վրա"` → *… kʰɑrɑkusi KMƏ vəɾɑ*. Expanding the
abbreviation `քառ.` to `քառակուսի` (a correct step) moved the unit out of digit adjacency, so the shared
tier declined it and `կմ` reached the IPA raw — trap 54's `bar` shape, except that this pass caused it.

**Implication.** A step that inserts a word between a number and its unit has to claim the unit itself
(trap 14's "expand anything the shared tier can no longer see", arriving from the abbreviation side).
Closed by a measure-word arm beside the slash arm in step 7b. Same class, three sources, all local:
`13.3 մարդ/կմ²` (common-noun numerator, ×11), `65 հազար հա` (magnitude between — closed instead by adding
`հազար` to the tier's `magnitudes`), and this one.

## Run 14 — 2026-08-14 17:45 — `mine.ts scan` and `review.ts`, with the residue read

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/hy.jsonc --lang hy

  BEFORE                        AFTER
  DROP percent    ×52           —
  DROP exponent   ×24           DROP exponent ×2
  DROP minus      ×17           DROP minus    ×13
  DROP currency   ×17           REDUNDANT currency ×1
  DROP math-sign  ×16           DROP math-sign ×9
  DROP degree     ×13           —
  DROP ampersand  ×3            (exempted — see defects.ts)
  MARKUP math-sign ×1           MARKUP math-sign ×1
  FOREIGN ampersand ×5          FOREIGN ampersand ×5
```

**Every residual position was printed and read**, by re-running the scan's own `[-−–](?=\p{Nd})` probe over
`normalizeArmenian(line)`:

```
10×  shift:(-10,5)                     wiki TIMELINE markup, an X/Y offset — correctly silent
 2×  −15&nbsp;°C  ·  -20&nbsp;°C       ⚠ THE ENGINE READS BOTH. `stripMarkup` decodes `&nbsp;` at the
                                        registry's dispatch point ABOVE this layer, so
                                        `phonemize("… -20&nbsp;°C", "hy")` gives *minus kʰəsɑn
                                        t͡sʰelsiusi ɑstit͡ʃɑn*. The scan reads RAW text, so the entity is
                                        still there when its probe runs — an instrument artefact, not a defect.
 1×  1610?-1661                        a life span whose `?` breaks the digit–dash–digit guard
 1×  մոլ −1                            a superscript-minus EXPONENT flattened by the source
 3×  19.07.-1916 · 0.-1.5 մ · 15.09.-08.10    partial dotted dates (a `D.M.-D.M.YYYY` career list, one
                                        article). The date rule declines them for want of a year and the
                                        decimal rule then claims the `D.M` half. Wrong before and wrong
                                        now, differently; recorded rather than guarded, 3 instances.
```

`review.ts --lang hy` — **two lines stay RED and both are deliberate**:

```
[FAIL] sign classes   DROPPED: minus plus-minus equals less-than greater-than times divide
[FAIL] artifact scan  DROP minus ×13 | DROP math-sign ×9 | DROP exponent ×2
                      — permissible: REDUNDANT currency ×1
```

- `minus` is **shipped, not exempted**, and the red line is the GUARD reporting itself: the probe is a bare
  `-5`, which has zero corpus instances, while all four true negatives carry the `%`/degree right-context the
  rule requires. Widening was measured and is net negative — 0 new true, 6 new false.
- `times`/`equals`/`divide`/`less-than`/`greater-than` are **real sourcing gaps and stay red**, per trap 53's
  ak stance. `×` is contentful in four instances of scientific notation and no Armenian word for it has been
  sourced with its sense read.
- `plus` and `ampersand` are entered in `ACCEPTED_SIGN_SILENCE` with their measurements, because for those two
  the silence is CORRECT rather than missing — 11/11 measurement pluses (lossless), 9/9 ampersands inside
  English phrases (the Latin router's reading, not hy's).
- `exponent ×2` is the BARE exponent (`10⁹`, `10 ²³`) with no `bareExponent` template declared; the unit
  exponent went 24 → 0.
- `REDUNDANT currency ×1` is trap 12's correct outcome: `186,7 մլրդ ամերիկյան դոլար` states the currency in
  words, so the sign is rightly dropped.

`[ ok ] sourcing  all 3 high-traffic words attested`.
