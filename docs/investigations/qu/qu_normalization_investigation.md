# qu (Quechua) — text-normalization investigation

Chronological log. Each run: the command, the question it was meant to answer, the raw finding, the
implication for the next step. Negative results are kept deliberately.

## Run 1 — 2026-08-13 20:51 — the starting state

**Command.**

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/qu.jsonc --lang qu
npx tsx tools/normalization/sources.ts --lang qu
npx tsx tools/normalization/review.ts --lang qu
npx tsx tools/referee-eval/eval.ts qu
```

**Question.** What does the engine do today, and which gates can even move?

**Raw finding.**

`mine.ts scan` (446 retained lines):

```
LEAK RAW-LATIN km  ×32       DROP math-sign ×31    DROP exponent  ×20
LEAK RAW-LATIN pp  ×2        DROP currency  ×13    DROP percent   ×11
LEAK RAW-LATIN mm  ×2        DROP degree    ×8     DROP ampersand ×4
LEAK RAW-LATIN nm  ×1        DROP minus     ×2
LEAK RAW-LATIN vlms ×1       MARKUP math-sign ×1
LEAK RAW-LATIN qp  ×1        REDUNDANT currency ×1
LEAK RAW-LATIN pdf ×1
LEAK RAW-LATIN msnm ×1
```

RAW-LATIN total = **41 across 8 distinct tokens**, and `km` alone is 32 of them (78%).

`review.ts --lang qu` → `[FAIL] normalizer  src/languages/quechua/normalize.ts missing`. One line; nothing
else is even evaluated, because the checklist stops at the missing file.

`sources.ts --lang qu` — the useful line is the unit one, which counts the corpus's own digit-adjacent
abbreviations: `m×55 km×23 cm×7 mm×2 km/s×1 mb×1`. espeak does **not ship Quechua at all**, so the espeak
tier that most languages fall back on is empty here. `scale-names` NONE, `decimal-point` NONE,
`fraction-series` NONE, `letter-names` NONE.

`referee-eval qu` → raw exact 8/171 (4.7%), folded backbone **159/171 (93.0%)**, symbol accuracy 97.6%.
The residual 12 classes are every one of them a WORD-level vowel/consonant question (`qoa`≠`qua`,
`songo`≠`soŋxo`, `karru`≠`kaʐu`) — i.e. five-vowel spellings and Ancash/Cusco phonology, not normalization.

**Implication.**

1. `eval.ts qu` binds the referee to `phonemizeWord` over a 171-word kaikki list. **No text-normalization
   rule can move it.** It is a TRIPWIRE (it must not regress), never a meter. Said plainly up front so no
   later number is read as progress.
2. The **RAW-LATIN count IS the meter** here, and `km` is 78% of it. The layer's centre of gravity is
   units, not numbers — Quechua's `numbers.ts` already composes correctly.
3. `sources.ts` shows the fallback tiers are unusually thin: no espeak, no wikipron. Everything must come
   from the corpus, the wiki (`attest.ts`) or a citable dictionary.

## Run 2 — 2026-08-13 21:10 — the variety question, settled by counting the corpus

**Question.** Quechua is a macrolanguage (Cusco-Collao, Ayacucho-Chanka, Ancash, Ecuadorian Kichwa, …) with
real orthographic divergence — three-vowel vs five-vowel spelling and the ⟨q/k⟩ conventions. Which variety
is `qu.wikipedia`, and therefore which variety may source a word for this layer?

**Command.** Greps over the mined artifact's own retained text (446 paragraphs, `hard` + `sample`).

**Raw finding.**

| diagnostic | Southern (Cusco-Collao / Ayacucho) | the alternative |
|---|---:|---|
| locative suffix | `-pi` ×505 | Ancash `-chaw` ×8 |
| "Quechua" | `qhichwa` ×33 | `qichwa` ×3 · Kichwa `kichwa` ×4 |
| Cusco | `Qusqu` ×28 (3-vowel) | `Qosqo` ×3 (5-vowel) |
| numeral 2 / 3 / 5 | `iskay` ×14 · `kimsa` ×6 · `pichqa` ×5 | `ishkay` ×0 · `kinsa` ×0 · `pisqa` ×1 |
| Kichwa markers | — | `shuk` ×2 · `shina` ×1 · `kanchik` ×1 · `ñuka` ×0 |
| ejectives + aspirates | ⟨k' q' p' t' ch' qh chh ph th⟩ = **319 tokens** | (Ancash/Kichwa have neither) |

**Implication — how it is settled.**

`qu.wikipedia` is **Southern Quechua in the standardised trilingual (three-vowel) orthography**, by a margin
of 63:1 on the locative and with the ejective/aspirate series written throughout. That is exactly what
`src/languages/quechua/quechua.jsonc` already declares ("Southern Quechua / Runasimi (Qhichwa; Cusco-Collao
+ Ayacucho)"). The engine and the corpus agree, so I do not have a `bal`-shaped split to declare.

But the minority varieties are **present and must not be allowed to stand for "Quechua"**: 8 Ancash `-chaw`
paragraphs and a handful of Ecuadorian Kichwa ones are in this very corpus (the artifact's own
`degrees` hard-set opens with `Anqas simipi, Ankash shimichu`). So the standing rule for this layer:

> **Every word this layer authors must be sourced from a SOUTHERN Quechua instance, and the file records
> which.** A hit in an Ancash or Kichwa paragraph is a hit in a different variety and is not evidence for
> `qu` as this engine defines it. This is `bal`'s Southern/Western split answered the other way — the
> divergence is real, and the corpus happens to be lopsided enough to name one variety honestly.

## Run 3 — 2026-08-13 21:20 — Spanish contamination, measured before writing any rule

**Command.**

```
# added a qu row (MARKERS + CONTRAST) to tools/normalization/filter-by-language.py
python3 tools/normalization/filter-by-language.py --lang qu --in qu_artifact_text.txt --out qu_artifact.qu.txt
```

**Question.** How much of the evidence I am about to write rules from is Spanish? (`bal` was 37.4%
non-Balochi, `bar` 24%, `ht` 15.1%.)

**Raw finding.** Over all 446 retained paragraphs: **kept 261 (58.5%) · dropped-contrast 88 (19.7%) ·
dropped-undecidable 97 (21.7%)**. And per hard-set cell (8 per cell), it is not spread evenly — this is the
su finding in a different language:

```
era-marker    12.5% qu     dotted      37.5%     degrees   87.5%     decimals        100%
ordinal-caps  12.5%        exponent    37.5%     year      87.5%     percent         100%
fractions     25.0%        clock       50.0%     units     87.5%     letter-name     100%
ordinal-latin 25.0%        currency    50.0%     grouped   87.5%     latin-in-native 100%
sports-time   25.0%        signs       50.0%     roman     87.5%     scaled-currency 100%
TOTAL(hard) 159 qu / 38 contrast / 49 undecidable = 64.6% Quechua
```

Two calibrations that had to be measured before the row could be written, both instances of trap 37:

- **`de` ×25 and `la` ×6 occur INSIDE strongly-Quechua paragraphs** (defined as ≥3 Quechua markers, 143 of
  446), and every one is inside a Spanish PROPER NAME the Quechua sentence is glossing —
  `kastilla simipi: Provincia de Espinar`, `Santiago de Chile`. Glossing a Spanish place name is the most
  ordinary thing a Quechua encyclopaedia paragraph does. Both are left out of the contrast set, exactly as
  `mos` leaves out `de`. `del/al/el/los/las/y` are ×2–4 in the same set and are kept.
- The row is deliberately **not** diagnostic between Quechua varieties — the three share this function-word
  core. Variety is Run 2's question and is settled by reading, not by a word count.

**Implication.**

1. The cells I actually need are the **clean** ones. `units` 87.5%, `percent` 100%, `decimals` 100%,
   `degrees` 87.5%, `grouped` 87.5% — so the RAW-LATIN `km` evidence is Quechua evidence.
2. The cells that are 12–25% Quechua — `era-marker`, `ordinal-caps`, `ordinal-latin`, `fractions`,
   `sports-time` — are **Spanish bibliography blocks and Ministry-of-Education catalogue records**, not
   Quechua orthography. `era-marker`'s hard-set is `3a. ed.`, `S.A.`, `N.Y.`, `p. 108` — Spanish/English
   abbreviations in citations. **A rule written from those cells would be a rule about Spanish text that
   happens to sit in qu.wikipedia.** That is the whole reason to run this before writing anything.
3. The artifact was mined WITHOUT this filter (its `source` line records none). Re-mining needs the dump,
   which is not in the tree; so the filter row is committed and this measurement stands as the record of
   what the artifact contains. Anyone re-mining qu must pass `--lang qu` through it.

## Run 4 — 2026-08-13 21:00 — probing the engine on the corpus's own forms

**Command.** `phonemize(form, "qu")` over 45 shapes tabulated from the artifact.

**Question.** What does the engine actually produce — not what I assume it produces.

**Raw finding** (the ones that changed the plan):

```
3.426.000 runakuna → ˈkimsa . ˈtawa ˈpat͡ʃak … . ˈt͡ʃʼusaq    TWO sentence breaks inside one number,
                                                              and `000` collapsed to a single "zero"
44.5 km²           → ˈtawa … taˈwajuq . ˈpit͡ʃqa km           a sentence break, then a raw km
28 cm              → ˈiskaj ˈt͡ʃunka pusaqˈnijuq km           ← CENTIMETRES READ AS KILOMETRES
250 km             → … km                                     the same string
20 °C              → ˈiskaj ˈt͡ʃunka k
XV siklupi         → ˈt͡ʃunka pit͡ʃˈqajuq sikˈlupi            already correct — registry.ts owns romans
```

**Implication.** Three things I had not planned for:

1. **The `cm` row is playbook trap 56 and it is the reason the RAW-LATIN count lies.** `quechua.jsonc`
   maps ⟨c⟩→/k/ — correct for the orthography — so an undeclared `cm` is converted, pronounceable, and
   BYTE-IDENTICAL to the kilometre reading. `28 cm` and `250 km` produce the same phoneme string. DIGIT,
   SLOT-GAP, RAWMARK, DROP and THROW are all blind to it; it appears in `LEAK RAW-LATIN km ×32` only
   because that class prints the SOURCE token. Reading the count says "32 kilometres"; reading the
   instances says 7 are centimetres.
2. **Digit grouping is the largest defect and it was not on the RAW-LATIN meter at all.** `.` and `,` are
   declared clause punctuation, so every grouped figure was delivered as two or three sentences.
   Counted in the retained corpus: `.` grouping ×88, ` ` ×14, `,` ×12 — and the SAME two marks are the
   decimal separator (`.` ×30, `,` ×16). qu.wikipedia writes all three conventions at once, so block
   length is the only discriminator and the sibling layers' single-arm de-grouping does not transfer.
3. Romans already work (qu is not in `ROMAN_NATIVE`); no rule needed. Trap 16 answered before it was asked.

## Run 5 — 2026-08-13 21:05 — sourcing, and the two refusals that turned on SENSE

**Command.** `attest.ts --lang qu --words …` in five batches (default `--limit`), plus `WebFetch` of
qu.wikipedia's `Mitru` and `Tupuy` articles.

**Question.** Which words can be authored, and from a SOUTHERN Quechua instance?

**Raw finding.** The decisive source is not a token count — it is a page class *forced to say the thing*
(trap 40). qu.wikipedia's SI-units article names each ABBREVIATION beside its word:

```
Sikundu s: Mit'awi (Pacha)   Mitru m: Karu kay   Litru l: P'ulin   Kilugramu kg: Wisnu
Sintimitru (cm): 10-2 mitru.  Milimitru (mm): 10-3 mitru.  Nanumitru (nm): 10-9 mitru.
Angstrom (Å): 10-10 mitru.        Ångström icha angstrom (sanancha: Å)
A - T'asra mitru m2    P'ulin V - Machina mitru m3 = 1000 Litru l
Utqa kay v - Mitru sikunduman m/s          ← the RATE idiom, in one line
```

Token/article counts with the sense read: `mitru` 49/20 · `kilumitru` 16/13 · `sintimitru` 8/8 ·
`kilugramu` 10/8 · `angstrom` 4/3 · `t'asra` 18/16 · `machina` 12/11 · `k'atma` 8/3 · `thular` 4/3 ·
`dular` 2/2 · `milimitru` 2/2 · `nanumitru` 2/2.

Three findings that changed a decision:

- **The rate is not "A per B".** *Mitru sikunduman* puts the denominator in the DATIVE, as a bound `-man`
  suffix. `unitPer` is one invariant string and cannot express a case suffix, so each rate is declared as
  a WHOLE KEY — Māori's `m/h` move, trap 44.
- **`k'atma` vs `pata` is a VARIETY question, and Run 2's rule decided it.** Both are attested for the
  angular degree and both read well. `k'atma` ×8/3 is the Southern Quechua latitude/longitude articles
  (*isqun chunka k'atma (90° Ch / 90° N)*); `patakuna` is *Tupunin 90°, rimay isqun chunka patakuna* — and
  that sentence says in its own words that it is Ancash: *(Anqas simipi, Ankash shimichu)*. Picking by fit
  alone would have taken the wrong variety's word into a Southern engine.
- **TWO REFUSALS, BOTH ON SENSE — the strong kind, not the `ig` silence kind.**
  - PERCENT. `pachakmanta` ×13/13 looks perfect and is not: TWELVE of thirteen are "N HUNDRED" with an
    ablative (*qanchis pachakmanta aswan rikch'aqkunam*, "more than seven hundred species"), and the
    thirteenth writes the SIGN as well (*sapa pachakmanta 14.6%*). `pursintu`, `pursyintu`, `porsyentu`,
    `pachakchasqa` are ×0. This is Tashelhit's position and the reason `SymbolData.percent` is optional.
  - DECIMAL POINT. `puntu` ×8/4 is a DISTRICT (*Puntu distritu … distrito de Pontó*) and a FERN
    (*puntu-puntu*); `kuma` ×5/5 is the architect Kengo Kuma, a Turkish film and *Q'uma, kichwapi Kuma*.
    Neither is a separator.

**Implication.** The percent arm is omitted (the sign stays visible to the gates). But the decimal is
**not** the same decision, because leaving the separator is not neutral — see Run 6.

## Run 6 — 2026-08-13 21:10 — pricing the decimal refusal (trap 53)

**Question.** With no sourceable decimal word, what does DOING NOTHING read as?

**Raw finding.** `44.5 km²` → *tawa chunka tawayuq **.** pichqa …* — the separator is declared clause
punctuation, so "do nothing" emits a SENTENCE BREAK in the middle of every measurement, ×2895 by the
artifact's whole-corpus cell count.

**Implication.** A refusal here is a choice between two wrong readings, and they are not equally wrong.
Authoring a word is forbidden (both candidates fail on sense). So the separator is replaced with a SPACE:
every digit is still spoken in order and only the unsourceable word is missing. That converts a
confidently-wrong PROSODY into an honest omission, which is what "leave the symbol unread" means
mechanically. Recorded in the file as a known-lossy reading, not as a fix. ⚠ The step must run AFTER the
symbol tier, because the tier's `NOT_VERSION` guard works by seeing the DOT (traps 39/46) — verified on
`802.11m`, which the guard rejects and which must never read as eleven metres.

## Run 7 — 2026-08-13 21:15 — the gates, before and after

**Commands.** `mine.ts scan` · `corpus-diff emit/compare --corpus mined:qu` · `vitest run` · `tsc --noEmit`
· `referee-eval.ts qu` · `review.ts --lang qu` · `sources.ts --lang qu`.

**Raw finding.**

| gate | before | after | kind |
|---|---|---|---|
| `mine.ts scan` RAW-LATIN | **41** over 8 tokens (`km` 32) | **9** over 6 tokens (`km` 3) | **METER** |
| `mine.ts scan` DROP degree | 8 | 0 (+2 REDUNDANT) | meter |
| `mine.ts scan` DROP exponent | 20 | 4 | meter |
| `mine.ts scan` DROP currency | 13 | 4 (+2 REDUNDANT) | meter |
| `mine.ts scan` DROP ampersand | 4 | 0 | meter |
| `mine.ts scan` DROP math-sign | 31 | consulted as an accepted silence | — |
| `corpus-diff` DROP annotations | 83 | **47** | meter (130/445 utterances moved, 29.2%) |
| `referee-eval qu` | 8/171 raw · 159/171 folded · 97.6% | **identical** | **TRIPWIRE** |
| `vitest run` | 241/242 (catalogue stale) | **242/242** | tripwire |
| `tsc --noEmit` | clean | clean | tripwire |
| `review.ts` | 1 FAIL (no normalizer) | 2 FAIL (both sourced refusals) | see below |
| `sources.ts` unit-word | `no normalization layer yet` | `10 unit word(s), all attested` | — |

**The two remaining `review.ts` FAILs are correct and stay RED (trap 24).**
`sign classes: DROPPED minus percent degrees`, and the artifact scan. `minus` is deliberately NOT entered
as an accepted silence — omitting a plus is lossless, omitting a minus INVERTS; `percent` is a real lost
reading with no sourceable word; `degrees` is the SCALE name (`°C` is ×0 here), while the bare `°` does
read. All three are argued in `defects.ts` and in `normalize.ts`.

**One gate had to be un-blinded before it could be believed.** `review.ts`'s sourcing line reported
*"a tier IS declared but this check could not read it"* — it reads currency entries with `/"([^"]+)"\s*:/`,
so an UNQUOTED `$:` key is invisible to it. That is a false NEGATIVE in the direction trap 57 warns about:
the gate went blind rather than passing. Quoting the key costs nothing and turned the line into
`all 2 high-traffic words attested`.

**What is left red in the scan, and why** — `LEAK RAW-LATIN km ×3` is ONE sentence, `sapallan km²-pi
runakuna (km² = t'asra waranqa thatki)`, where the unit has no numeral beside it at all; `pp ×2`,
`vlms ×1`, `pdf ×1`, `msnm ×1` are Spanish bibliography and a filename; `qp ×1` is the Quechua era marker,
left unread because the only paragraph that carries it is the corpus's most variety-mixed one (Run 2's
rule applied to my own convenience). `DROP exponent ×4` is trap 54's `bar` case — a COMMON-NOUN numerator
(`8,76 runa/km²`, inhabitants per km²), which no unit table can name.
