# fi (Finnish) — text-normalization investigation

Chronological log for the Finnish normalization layer, per `docs/normalization_playbook.md`.
Worktree `vernacula-norm-fanout/fi`, branch `norm-fi`, based on `main`.

## Run 1 — 2026-08-14 13:55

**Command.** `corpus-diff.ts emit --lang fi --corpus mined:fi --out …/fi.before` (400 utterances), then
`mine.ts scan`, `review.ts --lang fi`, `referee-eval/eval.ts fi`, `sources.ts --lang fi`, plus a hand probe of
~30 attested surface forms through `phonemize(form, "fi")`.

**Question.** What does the corpus contain, and what does the engine actually do to it today?

**Raw findings — baseline instruments.**

```
FLEURS: unset → corpus is mined:fi (fi.wikipedia, random 400 + insource: fill), 5139 segments, 31/35 cells
referee: folded backbone 166462/173449 (96.0%), symbol accuracy 99.5%
review.ts: [FAIL] normalizer missing  (the only line — nothing else runs without it)
scan:  LEAK RAW-LATIN km ×25 · DROP percent ×21 · DROP exponent ×15 · DROP ampersand ×12 ·
       DROP degree ×9 · DROP math-sign ×6 · DROP currency ×5 · DROP minus ×3 ·
       LEAK RAW-LATIN ns ×1 · kg ×1 · th ×1
sources.ts: letter-names [NONE] (espeak does not ship fi) · decimal-point [NONE] · era-phrase [·] ·
       scale-names [ok] Celsius+Fahrenheit · percent/currency/unit/minus/times/ampersand/plus/exponent [chk?]
```

**Raw findings — artifact corpus counts** (from the artifact's own `counts` block, whole corpus, 5139 segments):

```
digit-run 2839 · year 2837 · ordinal-latin 721 · ranges 636 · abbrev 630 · grouped 447 · decimals 430
initialism 1007 · roman 152 · signs 157 · percent 133 · units 67 · dotted 49 · clock 42 · signed-number 29
exponent 27 · ordinal-range 21 · degrees 17 · fractions 16 · rate 8 · currency 4 · arithmetic 4 · ampersand 67
quote-letter 87 · letter-name 328 · sports-time 1 · iteration 1 · version-dot 0 · ordinal-caps 0
```

**Raw findings — the engine's readings** (defect list; `→` is verbatim `phonemize(x,"fi")`):

```
"13. toukokuuta 1931" → kolmetoi̯stɑ . tou̯kokuːtɑ …     CARDINAL + a spurious CLAUSE PAUSE mid-sentence
"1.11.2019"           → yksi . yksitoi̯stɑ . kɑksituhɑtːɑ yhdeksæntoi̯stɑ
"kello 21.01"         → kelːo kɑksikymːentæy̯ksi . yksi
"50,7 %"              → ʋiːsikymːentæ , sei̯tsemæn        decimal comma read as a PAUSE; % silent
"20%"                 → kɑksikymːentæ                    % silent
"53 %:lla"            → ʋiːsikymːentækolme , lːɑ          % silent, ':' a pause, 'lla' a bare word
"13,6 cm"             → kolmetoi̯stɑ , kuːsi km           ⚠ cm READ AS km — trap 56
"1 786"               → yksi sei̯tsemænsɑtɑːkɑhdeksɑŋ…    space-grouped thousands read as TWO numbers
"1994–1997"           → …neljæ …sei̯tsemæn                en dash silent, no joiner
"76,02 km²"           → …kɑksi km                        ² silent, km raw
"120 km/h"            → sɑtɑkɑksikymːentæ km h           raw letters
"3–4 m/s"             → kolme neljæ m s
"−34,3 °C"            → kolmekymːentæneljæ , kolme k     minus, ° silent; C → /k/
"100 $ barrelilta"    → sɑtɑ bɑrːeliltɑ                  $ silent
"1900-luvulla"        → tuhɑt yhdeksænsɑtɑː luʋulːɑ      decade split into two words
"13-vuotias"          → kolmetoi̯stɑ ʋuo̯tiɑs             compound split
"CIA:n"               → kiɑ , n                          initialism read as a WORD
"172001:stä"          → …yksi , stæ
"11:nneksi"           → yksitoi̯stɑ , nːeksi
"2×15 minuuttia"      → kɑksi ʋiːsitoi̯stɑ minuːtːiɑ     × silent
"Robinson & Cook"     → robinson koːk                    & silent
"1/131"               → yksi sɑtɑkolmekymːentæy̯ksi      / silent
"45°28′N"             → …kɑksikymːentækɑhdeksɑn n        ° and ′ silent
"s. 21. helmikuuta"   → s . kɑksikymːentæy̯ksi .          abbreviation spelled as a bare consonant
"eaa."                → eɑː .                            era marker read as a nonword
"n. 259 km2"          → n . …km kɑksi                    ASCII exponent read as the NUMBER two (trap 53 shape)
```

**What it implies.** Almost every class is defective, and the two biggest by count are the two Finnish
writes most: the `N.` ordinal (721 ordinal-latin + most of the 2837 `year` cells are dates) and the decimal
comma (430). Both are also the two that currently *insert a clause pause where none belongs*, so they cost
prosody as well as words.

Two things to establish before writing anything:
1. the `N.` ordinal is trap 4's shape — it must be tabulated, not guessed, because a sentence-final period
   must not be eaten;
2. the colon suffix (`%:lla`, `:n`, `km²:iin`) is trap 14/15 — count the glued AND the spaced forms.

Next: tabulate both, and source the vocabulary (`%`, `$`, units, decimal word, ordinal series).

## Run 2 — 2026-08-14 14:05

**Command.** Tabulations over the artifact's 406 retained segments (`hard` + `sample`), plus
`corpus-words.ts --lang fi`, `attest.ts --lang fi`, and greps over the referee TSV.

**Question.** (a) Can the bare `N.` ordinal be distinguished from a sentence period? (b) Is the colon
suffix (traps 14/15) glued, spaced, or both? (c) Where does the vocabulary come from?

**Raw findings — (a) the `N.` table** (`\d{1,4}\.` + space + token, 333 contexts):

```
MONTH NAME after          147   ordinal date      13. toukokuuta · 28. päivänä
CAPITAL after             159   SENTENCE ENDS     … vuonna 1978. Jakokoski on kylä …
lowercase after            20   ordinal attribute 18. herttuatar · 30. lento. · 2. painos · 17. ja
DIGIT / "(" after           7   range tail, and `2005/34. (PDF)`
segment-final              38   SENTENCE ENDS
```

Clean split on the following word's CASE. So the rule is claimable and the trap-4 invariant is statable.

**Raw findings — (b) the colon**, 78 instances: ~54 on an initialism, 18 on digits (8 ordinal, 10
cardinal-case), 6 on a symbol/unit. `grep -oE '[0-9] (n|ssa|sta|lla|een|s)'` → **1 hit, and it is a stray
`s`**. Finnish does not space the suffix, so trap 15's spaced arm is measured OUT, not assumed out.

**Raw findings — (c) sourcing.** `sources.ts` says espeak does not ship Finnish at all, so the
in-repo tiers are the corpus and the REFEREE. The referee turns out to be far stronger than expected:

- it carries the WHOLE ordinal series as lemmas (ensimmäinen … miljoonas, yhdestoista … yhdeksästoista,
  kahdeskymmenes … yhdeksäskymmenes, kahdessadas, sadas, tuhannes) — every one ×1;
- and **59 spelled-out ACRONYMS with their IPA**, which is an empirical letter-name table:
  `ATK ɑː t eː k oː` · `CD s eː d eː` · `HIFK h oː iː æ f k oː` · `SNTL e s e n t eː e l` /
  `æ s æ n t eː æ l` · `VMTL ʋ eː e m t eː e l` · `YK yː k oː` · `USA u s ɑ` (a WORD) · `IVY i ʋ y` (a word).
  21 of the 29 letters are corroborated directly; the ä-series and the e-series are BOTH attested for the
  same word, so either is a variant rather than an error.
- it is a LEMMA list only: `kilometriä` ×0, `prosenttia` ×0, `asteen` ×0. **Every inflected form has to
  come from the corpus or the wiki** — which is exactly what closes the door on the oblique colon suffix.

`attest.ts` senses READ, not just counted: `pilkku` ×89/18 (the article states `3,141` and "Englannin
kielessä pilkku on tuhansien erotin" — the decimal-separator sense); `miinus` ×53/19 ("Miinus (−),
vähennyslaskun merkki"); `omaa sukua` ×20/17 ("(omaa sukua Vahtola)"); `ennen ajanlaskun alkua` ×31/19,
and one hit names the abbreviation beside the expansion ("merkintöjä eaa. ja jaa.").

**What it implies.** Every rule the corpus asks for is sourceable except the ones that need a numeral to
DECLINE. That is the seam: ship the nominative forms, refuse the oblique ones, and price the refusal.

**Negative result kept:** `sekunti` is ×0 in the corpus, so `m/s` looked unsourceable from tier 1 — the
wiki closed it (`sekunnissa` ×57/16, in the "kertaa sekunnissa" slot). The first hits are a BAND NAME
(*Tuhat kuolemaa sekunnissa*) and had to be read past; a count alone would have been a lead, not a finding.

## Run 3 — 2026-08-14 14:25

**Command.** Wrote `normalize.ts` + the tier declaration in `finnish.ts`, then `npx tsc --noEmit` and a
28-form probe through `phonemize`.

**Question.** Does the rule sequence hold together end to end?

**Raw findings — three real ordering bugs the probe caught, none of which a test would have:**

1. `s. 21. helmikuuta` still read `s .`. The abbreviation step ran AFTER the ordinal step, and three
   abbreviation arms are gated on a FOLLOWING FIGURE (`s.` is *syntynyt* before a date and the SECOND in
   `10,3 s.`). By the time they ran the figure was a word. **Trap 39 exactly — a guard's evidence has a
   lifetime.** Abbreviations moved above the date/ordinal rules.
2. `korvasi Volvo 850:n. Rinnakkaismallina` read "…850 NOIN". The colon-deletion step had turned `850:n.`
   into `850n.`, and the `n.` → *noin* arm's word-boundary lookbehind does not exclude a DIGIT. Guard
   widened to `(?<![\p{L}\p{M}\d:])`.
3. `(engl. Algic languages)` read "englanniksi . Algic" — the shared `keepFinal` heuristic ("a capital
   follows ⇒ it was a sentence end") is backwards for a language tag, which exists precisely to introduce a
   foreign NAME. `keepFinal` set false for all 14 tags.

**What it implies.** Re-probe after every reorder; the sequence is the rule.

## Run 4 — 2026-08-14 14:32

**Command.** `corpus-diff.ts emit/compare` (400 utterances), plus a word-level change inventory over the
two emissions (160 distinct before→after substitutions, read in full).

**Question.** What actually changed, and did anything get worse?

**Raw findings.** `changed 293/400 (73.3%)`, `DROP 63 → 6`, every other leak class 0 both sides.

**The diff found a defect no probe had**, which is the whole reason for step 5:

```
KTM:n   →  koː teː æmn        ⚠ [æmn] is not a possible Finnish word
AHL:ssä →  ɑː hoː ælsːæ
```

A case suffix glued to a CONSONANT-FINAL letter name makes an illegal cluster. That is why the long
Finnish letter names exist: `ämmä`, `ällä`, `ännä`, `ärrä`, `ässä`, `äffä`, `äksä` — all seven are referee
lemmas with exactly the letter-name IPA (`ämmä æ mː æ`, `ällä æ lː æ`, `äksä æ k s æ`). The last letter of
an initialism now takes the long form when a suffix attaches, and only then. `KTM:n` → *koo tee ämmän*.

**The sentence-period invariant, measured rather than asserted.** Source sentence-ends counted after
stripping personal initials and the abbreviations this layer expands: **1,488 across 406 segments, and 0
are lost.** The single `'.' → ''` substitution in the whole diff is `kello 18.39`, a period INSIDE a time.
(A first, cruder counter reported 30 "losses"; every one was an abbreviation dot its regex had not
stripped — the instrument was wrong, not the layer. Kept here because that is the shape of a false alarm.)

**Everything else in the 160-substitution inventory read correctly**, including three I went looking for:
`942 cm³` → *kuutiosenttimetriä*; `kahdeskymmenesseitsemäs` geminating at its own compound seam (correct —
the word is spelled with a double ⟨s⟩); `George W. Bush` → *kaksoisvee* via the shared initial-run rule
while `V. 1998` → *vuonna* via the abbreviation rule, two different readings of the same letter and dot.

## Run 5 — 2026-08-14 14:34

**Command.** `review.ts --lang fi`; then, on its `sign classes` FAIL, a re-measurement of the fleet minus
shape over the retained text.

**Question.** The layer shipped a NARROW minus rule (sign + number + a following degree word) on the
reasoning that every corpus negative is a temperature. Is the narrowness buying anything?

**Raw finding.** `(?:^|[\s(])[-−–]\d` over the retained text: **3 matches, all 3 TRUE** (`−2 °C`,
`−34,3 °C`, `–6 °C`), **0 false positives**. The plus shape: 1 match, the one true `+33,2 °C`. The reason
there are no false positives is structural — a Finnish range always has a digit immediately left of its
dash (`1994–1997`, `(175–11)`, `20.–24.`) and a clause dash is always followed by a space and a capital.

So trap 24 run in the direction that BREAKS a refusal: the narrow guard cost a bare `-5` and bought
nothing. Widened to the fleet shape, plus an infix arm for `(156+27)`.

**Two sign classes stay DROPPED, and both are findings rather than gaps:**

- `÷` — `jaettuna` is attested ×8/6 and the maths hits are real, but **every one puts the divisor in the
  ADESSIVE**: *jaettuna yhdellä*, *jaettuna itsellään*, *jaettuna 2π:llä*. `6 ÷ 3` is *kuusi jaettuna
  kolmella*, and this layer's operands are digits (trap 14). Emitting *jaettuna kolme* would be
  ungrammatical. The attestation is what refutes the rule — a nice inversion of the usual direction.
- `±` — `plusmiinus` reports "attested ×3/3" and **all three are the ice-hockey statistic**
  (`plusmiinus-tilasto`, `plusmiinus-sarakkeen näyttäessä nollaa`), a column name and not a reading of the
  sign. Trap 37 / the Fula lesson, healthy count on the wrong slot. `±` is ×0 in the corpus.

`=`, `<`, `>` DID ship: `pienempi kuin` ×21/12 and `suurempi kuin` ×24/14 come from the fi.wikipedia
inequality article, which names the sign beside the word — "Merkintä a < b tarkoittaa a on pienempi kuin b
ja merkintä a > b tarkoittaa…" — and `yhtä suuri kuin` ×50/20 from the equality article. Nothing in this
corpus writes any of them (×0), so this is robustness, and the file says so.

**Final gate state.** `DROP 63 → 5`. `review.ts` reports two FAILs and both are deliberate:

```
[FAIL] sign classes   DROPPED: plus-minus divide        ← the two argued above
[FAIL] artifact scan  DROP currency ×2 · LEAK km ×2 · DROP exponent ×2 ·
                      DROP math-sign ×1 · LEAK ns ×1 · LEAK th ×1
```

Every scan line was read:

| line | what it is |
|---|---|
| DROP currency ×2 | `$-merkki kirjoitetaan…` and `Jos merkkiä $ käytetään…` — the sign as the TOPIC of the sentence, with no quantity anywhere. There is nothing to read. |
| LEAK km ×2 + DROP exponent ×2 | `asukasta/km²`, `henkeä/km²` — a COMMON-NOUN numerator, trap 54's `bar` case exactly. Nothing the unit table can name. |
| DROP math-sign ×1 | `LGBT+-ihmisten` — a `+` inside an identity term, not an operator. The plus arm requires a digit and correctly declines. |
| LEAK ns ×1 | the declared refusal: `ns.` stands for an AGREEING adjective whose number the abbreviation does not carry. |
| LEAK th ×1 | `Kaupthingin`, `Perthissä`, "Jump the fuck up" — ⟨th⟩ inside foreign words. A g2p/loanword matter, outside this layer, unchanged by it. |

Neither `defects.ts` nor `test/accepted-silent.test.ts` was touched. Both refusals are argued in
`normalize.ts` where the playbook says a refusal belongs, and both stay RED on purpose — a red line that
names a real gap is the correct outcome, and an ACCEPTED entry here would only hide the one class (`÷`)
whose argument is airtight while leaving the sourcing gap (`±`) red anyway.

**Not shipped, and why — the complete list.**

| class | count | why |
|---|---:|---|
| ranges | 636 | elative–illative on both operands; no free joiner word exists; operands are digits (trap 14). Reads as two bare cardinals, exactly as before. |
| oblique colon suffix | 20 | the numeral/unit would have to decline and no in-repo source carries an inflected form. The colon is deleted so the spurious PAUSE goes; nothing is invented. |
| fractions | 16 | 8 of the 9 retained `N/M` shapes are not fractions (publication numbers, seat ratios, a designation, a month). One is. |
| regnal numerals | (roman 152) | the shared Roman pass makes them digits before this file runs, so nothing distinguishes `Filipp II` from any name-plus-number. `Ludvig XV` keeps a cardinal reading. |
| `ns.` / `nk.` | 2 | agreeing adjective, number unrecoverable. |
| sports time `9.29,43` | 3 | the clock is gated on `kello`/`klo`, which is what KEEPS these out; no attested reading for a pace. |
| arc-minute `′`, direction letter | 4 | half-closing a coordinate is worse than leaving it (trap 53). |
| decade `1900-luvulla`, `13-vuotias` | — | measured NON-defect: this engine emits no stress, so gluing the compound changes the phoneme string by one space. |
| `÷`, `±` | 0 | see above. |
