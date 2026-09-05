# he (Hebrew) text-normalization investigation

Working log for the normalization layer on `src/languages/hebrew/`. Method: `docs/normalization_playbook.md`.

Evidence base: `tools/corpus/mined/he.jsonc` — **there is no FLEURS corpus for Hebrew**, so the artifact
(he.wikipedia, random 400 + targeted `insource:` fill, 5,141 segments, 373 emitted utterances = 180 hard +
200 sample, `covered 29/35`) is the whole corpus tier, plus `attest.ts` against he.wikipedia, the
en.wiktionary vocalized→Modern-Israeli referee (2,561 words), and the engine's own `hebrew.jsonc`.
espeak ships **no** Hebrew at all.

---

## Run 1 — 2026-08-12 09:10 — baseline gates, before any edit

Commands (worktree clean at `e7916ad`):

```
npx tsx tools/normalization/corpus-diff.ts emit --lang he --corpus mined:he --out <before>
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/he.jsonc --lang he
npx tsx tools/normalization/sources.ts --lang he
npx tsx tools/normalization/review.ts --lang he
npx tsx tools/referee-eval/eval.ts he
```

Question: what is the pre-layer state, and which classes does the fleet's own instrumentation already call
defective?

Raw findings:

- `corpus-diff emit` → **373 utterances**.
- `mine.ts scan`:
  `DROP percent ×35 · ampersand ×12 · math-sign ×10 · degree ×8 · minus ×8 · exponent ×5 · currency ×4`
- `sources.ts`: `[NONE] letter-names` (espeak ships no Hebrew), `[NONE] decimal-point`
  (**wrong — the manifest DOES carry `numbers.point` = נְקֻדָּה; the check reads espeak `_dpt`/`_.` and a
  `decimalWord` manifest key, and Hebrew's is `numbers.point`**), `[NONE] scale-names`, `[NONE]
  fraction-series`, `[chk?]` for percent/currency/minus/equals/times/ampersand/exponent.
- `review.ts`: 1 FAIL — `normalize.ts missing`. Nothing else runs until it exists.
- `referee-eval he`: raw exact 156/2561 (6.1%), folded backbone 2263/2561 (**88.4%**), symbol accuracy
  **97.0%**. The referee is a WORD LIST, so a normalizer cannot move it; it is recorded as the invariant.

Implication: the layer does not exist, and the DROP classes are the *symbol* half of the story only. The
scan is blind to a symbol that changes TOKENIZATION without surviving, so the corpus had to be tabulated
by hand next.

---

## Run 2 — 2026-08-12 09:35 — tabulate the artifact

Question: what does Hebrew actually write, in the surface form it writes it (playbook §1)?

Counts over the 380 artifact segments (`hard` + `sample`), scratch probes:

```
gershayim ״ U+05F4          2        ASCII " used for it            677 (144 letter-flanked)
geresh    ׳ U+05F3          0        ASCII ' used for it            276 (177 letter-flanked)
proclitic + HYPHEN + digit  311      proclitic + MAQAF ־ + digit     36
digits                     3449      grouped 1,234                   76
decimals                     53      clock HH:MM                      5
percent                      79      currency signs ($ only)         14
degree °                     14      exponent ² ³                    15
range en-dash                30      range hyphen                    16
Latin runs (2+)             752      BIDI FORMAT CONTROLS            27
maqaf ־                      36      niqqud in running text         185
math signs                   18      ampersand                       12
fraction n/n                 11      shekel ₪                         0
zero-width                    0      Hebrew presentation forms        0
```

Raw findings that changed the plan:

1. **The real gershayim/geresh code points are essentially absent; the ASCII quotes carry the class.**
   U+05F4 ×2, U+05F3 ×0, against `[א-ת]"[א-ת]` ×144 and `[א-ת]'` ×227. Any rule keyed on the *correct*
   character would fire twice in the whole corpus.
2. **BIDI FORMAT CONTROLS ×27, and every one is U+200F RLM sitting between a Latin gloss and the Hebrew
   that follows** — `Terry Andrew Davis;‏ 15 בדצמבר 1969`, `Elle Chapman; ‏26 במאי 1999`,
   `Paul-Emile Borduas‏: 1 בנובמבר 1905`. Note `‏26` — RLM **directly against the digit, no space**.
3. `₪` is ×0 — the shekel sign never occurs; `$` ×14 is the only currency sign.

Implication: (2) is the concrete form of the bidi hazard, and it is an ordering/guard fact rather than a
reordering one — a rule anchored on `\s` or `^` fails against `‏26`, a rule anchored on
`(?<![\p{L}\p{M}])` does not. The controls are stripped at the entry of the layer instead of guarded
against 15 times. See Run 5.

---

## Run 3 — 2026-08-12 09:50 — probe the engine on the attested forms

Question: what does the engine produce today (playbook §2)? `phonemize(x, "he")` is the SYNC path — the
Phase-1 rule g2p, which reads only VOCALIZED Hebrew, so an unvocalized word comes out as its bare
consonants. That is expected and out of this layer's scope (the neural nakdan is the Phase-2 path); what
matters here is everything that is *not* a Hebrew word.

```
ב-106      → v meʔa veʃeʃ            THE PROCLITIC IS A BARE CONSONANT   (×311 + ×36 maqaf)
ה-19       → tʃa ʔesʁe               THE DEFINITE ARTICLE READS AS THE EMPTY STRING
כ-90%      → χ tiʃʔim                and the % is silent
מ-2015     → m ʔalpajim veχameʃ ʔesʁe
1,234      → ʔaχat , matajim ʃloʃim veʔaʁba    the grouping comma is a CLAUSE PAUSE   (×76)
$200,000   → matajim , ʔefes         sign silent AND the tail read as "zero"
12:30      → ʃtem ʔesʁe , ʃloʃim     the colon is a clause pause            (×5)
3/4        → ʃaloʃ ʔaʁba             the slash is silent                    (×11)
8² = 64    → ʃmone ʃiʃim veʔaʁba     ² and = both silent
2°C        → ʃtajim sˈiː            ° silent; C reads as the ENGLISH LETTER NAME
18°C-      → ʃmone ʔesʁe sˈiː       …and the MINUS is on the far side (see Run 4)
km³        → ˈʊkm kjˈuːbd            the whole unit leaks to the English fallback
802.11n    → … nkuda ʔaχat ʔaχat ˈɛn
ד"ר        → d ʁ                     acronym → two VOWELLESS fragments
צה"ל       → t͡s l                   (ה is silent word-final, so it vanishes too)
ק"מ        → k m                     קמ"ר → km ʁ · ש"ח → ʃ χ · לפנה"ס → lfn s
ג'יימס     → ɡ jjms                  the geresh SPLITS the word and loses [d͡ʒ]   (×162 for ג/צ/ז)
```

**EMPTY-READING PROBE (the `ug` finding): 0 of 380 segments read as the empty string.** Hebrew's TOKEN
class is `[א-ת]` + `[֑-ׇ]`, the corpus contains no Hebrew presentation forms (×0) and no zero-width
characters (×0), and Latin runs are read by the registry's English fallback rather than dropped. So the
`ug` class does not exist here. It does exist one level down: **`ה` alone reads as `""`** (the g2p's
silent-final-he rule), which is what makes the `ה-19` defect worse than the other five proclitics.

Implication: the layer's biggest class by a factor of three is the proclitic-hyphen, which no DROP class
reports because the hyphen does not survive into the IPA — it is a TOKENIZATION defect, the thing the
playbook says the leak classes are blind to by construction.

---

## Run 4 — 2026-08-12 10:05 — read the sign instances before writing a sign rule

Question: the scan reports `DROP minus ×8`, `degree ×8`, `currency ×4`, `math-sign ×10`. Trap 48 and the
Burmese lesson say read them.

Raw finding — **the minus for a negative temperature is written AFTER the unit in logical byte order**:

```
הטמפרטורה … הממוצעת היא 18°C- בשולי היבשת ו-45°C- בתוך היבשת
טמפרטורות נמוכות מ-60°C-.   …והיא 89.2°C-.   ו-20°C- בתוך היבשת
```

That is bidi: in RTL display the trailing hyphen renders to the LEFT of the quantity, which is where a
minus belongs, so a Hebrew author types it last. Five of the eight `-`-before/after-a-number instances in
the corpus are this shape; the rest are range dashes.

The currency instances show the same thing on the other sign: `$200,000` and `בסך $100` (sign first) sit
in the same corpus as `(60,134$)`, `(50,2…48$)`, `(35,362$)`, `($674)`, `(2,674$)` — **sign last**, inside
a table of GDP-per-capita figures. Both orders are real and both are dollars.

`°` also occurs as a COORDINATE (`78° דרום`, `40°`, `36°30′`) and once with the prime reordered to the
front of the run (`לקו '36°30`) — one instance, left alone.

Implication: every sign rule in this layer needs BOTH orders, and the minus rule's discriminator is the
right context (a degree/temperature), exactly as `ug` and `hi` concluded from the opposite direction.

---

## Run 5 — 2026-08-12 10:30 — the gershayim/geresh partition

Question: the task's standing warning is that an ABBREVIATION rule and a NUMERAL (gematria) rule will
compete for the same character, each re-creating the other's false positive (trap 39 in both directions).
Does that happen in Hebrew, and what actually separates the classes?

Command: tabulate every `[א-ת]["״][א-ת]` and every `[א-ת]['׳]` in the artifact and read them.

Raw finding — **the competition is NOT abbreviation-vs-numeral. It is abbreviation-vs-QUOTATION-MARK.**

```
[א-ת]"[א-ת]   ×146 distinct-92     RHS exactly 1 letter  ×110   RHS ≥ 2 letters  ×36
```

Of the 36 with a multi-letter tail, **32 are an opening quotation mark** with a bare proclitic on its left
— `ו"העיר` `כ"סילוף` `ה"אוטומטיס` `ל"התקפות` `ב"סקאם` `ש"אפיין` `ול"אלבום` — and 4 are genuine acronyms
(`כמנכ"לית`, `ומנכ"לית`, the feminine of מנכ"ל with the suffix appended AFTER the mark; `להט"בים`;
`ול"אלבום` again, which is the false positive). The discriminator that partitions all 146 is shape:

    QUOTE  ⟺ a run of 1–2 PROCLITIC letters, word-initial, then the mark, then ≥2 Hebrew letters
    ACRONYM ⟺ everything else

Both halves are load-bearing and both were added after counting: without the length test the quote arm eats
`מ"מ`/`ש"ח`/`כ"ו`; without the proclitic-class test it eats `כמנכ"לית` (כ,מ,נ,כ — נ is not a proclitic) and
`להט"בים` (ט is not), while `ול` is proclitic all through.

**And the gematria rule does not compete at all, for a reason specific to Hebrew.** A Hebrew year is read
as the joined letters PRONOUNCED AS A WORD — תשפ"ד is *tashpad*, not "five thousand seven hundred
eighty-four" — so the numeral wants exactly the same operation the acronym wants (delete the mark, join).
All five gematria instances (תשפ"ד, תשס"ג, תשמ"ג, י"ב, כ"ו) take the acronym arm and are right for it.
A gematria→cardinal rule would have been the confidently-wrong reading, and it is not written.

The GERESH is a different question again, and it is three things:

```
letter + geresh + letter (PHONEMIC DIGRAPH)  ×177, base letters ג ×101 · צ ×52 · ז ×9 + a tail of 15
word-final geresh                            ×50  — abbreviations (וכו׳ פרופ׳), foreign finals (־ביץ׳,
                                                    נורת׳, קולג׳) and closing quotes (שומעת׳, ביותר׳)
```

⚠ **U+05F3 GERESH is ×0 and U+05F4 GERSHAYIM is ×2 in the whole corpus.** The ASCII `'` (×276) and `"`
(×677) carry the entire class. A rule keyed on the correct code points would fire twice.

Implication: the digraph is 183 instances of a G2P defect, not a normalization one — see Run 6.

---

## Run 6 — 2026-08-12 10:55 — three defects that are not in this layer (playbook §3)

Question: the playbook says the biggest defect is sometimes somewhere else. Probing the engine turned up
three, all inside `src/languages/hebrew/` and none of them normalization.

1. **The token class splits a word at the geresh, and the base letter keeps its plain value.** `hebrew.ts`'s
   TOKEN admits no geresh at all, so `ג'יימס` → *ɡ jjms* (two tokens, and [ɡ] for [d͡ʒ]). `hebrewNeural.ts`'s
   admits it only after the FIRST letter, so `ג'יימס` survives there but the word-MEDIAL `בייג'ינג` splits.
   Fixed as DATA plus a class: `gereshDigraphs` in `hebrew.jsonc` (ג׳ d͡ʒ · צ׳/ץ׳ t͡ʃ · ז׳ ʒ — the live
   Modern Israeli set), the geresh added to `POINT`, and both TOKENs made identical. The other base letters
   (ת׳ ד׳ ח׳ ר׳ ק׳) are deliberately absent: Israeli reads them as the plain letter, so the geresh
   contributes nothing — what it must not do is split the word.

2. **`הַ` read as *ah*.** The furtive-patach rule fired on a ONE-LETTER word: `atEnd && FINAL_GUTTURAL &&
   patach` is true for the bare definite article, so the [a] came out before the ה instead of after it. A
   furtive patach needs a vowel to be furtive to; guarded with `chunks.length > 0`. This is exactly the word
   the new proclitic rule emits 41 times, so the normalization rule could not have worked without it.

3. **`ה` alone reads as the EMPTY STRING** (silent word-final he) — which is why `ה-19` was the worst of the
   six proclitics. This is the `ug` empty-reading class one level down; at the SEGMENT level the probe is
   clean (0/380, no presentation forms, no zero-width, Latin runs reach the English fallback).

Referee before/after: folded backbone **2263 → 2264 / 2561**, symbol accuracy 97.0% → 97.0%, raw exact
156 → 156. One word better, none worse — the referee is a vocalized WORD LIST, so a normalizer cannot move
it and these three engine changes are the only thing that could.

---

## Run 7 — 2026-08-12 11:20 — sourcing, and the one probe run

Question: which words does this layer need, and can each be sourced without inventing one?

Corpus first (`corpus-words.ts`), then he.wikipedia. `attest.ts` 429'd twice against he.wikipedia (three
sibling agents on the same API); the third attempt, after a 7-minute backoff, wrote
`tools/corpus/attest/he.jsonc` cleanly in one run.

| word | verdict | the evidence that settled the SENSE |
|---|---|---|
| `אָחוּז` percent | corpus ×3 digit-adjacent | `נתח של 20 אחוז`, `קיבל 10 אחוז`, `מיוזיק 50 אחוז` — SINGULAR after any number. wiki ×342/10, and its article defines the sign: `בצירוף הסימן "%"` |
| `דּוֹלָר` | corpus ×8, wiki ×206/20 | all monetary, all POSTPOSED (`3 מיליון דולר`, `10,000 דולר`) |
| `מַעֲלוֹת צֶלְזִיוּס` | wiki ×2,865 articles | trap 37's worst case: `מעלות` is ×0 in the corpus and `מעלה` is ×11 SUBSTRING-ONLY inside `למעלה מ־` ("more than"), a different word. The COLLOCATION settles it — `18.7 מעלות צלזיוס`, `38.5 מעלות צלזיוס` — and the wiki article of that title opens `מעלות צלזיוס, שסימנן C°` |
| `מִינוּס` | wiki ×145/18 + insource ×213 | register split, and only one half is usable: `סימני מינוס` / `B מינוס` are the sign's NAME and a grade (hi's `धन` lesson), while `מינוס 80 צלזיוס`, `מינוס 273.15 מעלות צלזיוס`, `מינוס 38 מעלות` are the reading, PREPOSED |
| `בְּרִיבּוּעַ` squared | corpus ×3 | the corpus GLOSSES ITS OWN SYMBOL twice: `"שמונה בריבוע" (כי 8² = 64)` and `c² מהירות האור בריבוע` |
| `קִילוֹמֶטֶר רָבוּעַ` | corpus ×2 collocation | `783.84 קילומטר רבוע`; the wiki article names the abbreviation — `קילומטר רבוע (סמל: ק"מ² או קמ"ר)` |
| `סֶנְטִימֶטֶר מְעֻקָּב` | corpus `מעוקב` ×3 | wiki: `סנטימטר מעוקב (סמ"ק) (cm³)` — sign, abbreviation and words in one line |
| `מִילִימֶטֶר` | corpus ×1 (`מילימטרים`) | wiki: `מילימטר (בראשי תיבות: מ"מ …)` |
| `לִפְנֵי הַסְּפִירָה` | corpus ×1 beside its own ×10 abbreviations | `ב־538 לפני הספירה`; wiki: `ובקיצור לפנה"ס (או לפסה"נ = לפני ספירת הנוצרים)` — both abbreviations named |
| `דּוֹקְטוֹר` | wiki ×258/16 | its article opens `דוקטור (בקיצור, ד"ר; PhD)` |
| `שֶׁקֶל חָדָשׁ` | wiki ×23/11 | `שקל חדש … (בראשי תיבות: ש"ח, סמל: ₪)` |
| `וְכוּלֵי` | **split verdict, both recorded** | `attest.ts` says `absent, 0 token / 0 substring`; a direct `insource:"וכולי"` on the same wiki reports **471 articles** with the "etc." sense. A 0/0 with no substring hits either is a query that found nothing to look in, not an absent word. Kept at ×2 instances, with both numbers written down |

The PROCLITIC vocalizations needed no new sourcing: `hebrew.jsonc` already declares ⟨ו ל ב כ מ⟩ as
proclitics whose word-initial sheva is realised [e], citing two audio-grounded referees. ה takes patach
(the definite article) and ש segol. **The one simplification is מ־**, written מֵ rather than מִ, and it is
stated in the file: the choice depends on the first letter of the SPOKEN numeral, which does not exist at
this point in the pipeline (trap 14), and the corpus's `מ-` instances are overwhelmingly guttural-initial.

---

## Run 8 — 2026-08-12 11:50 — gates, before and after

| gate | before | after |
|---|---|---|
| `vitest run` | 3733 pass | **3742 pass, 0 fail** (9 new Hebrew assertions) |
| `tsc --noEmit` | clean | clean |
| `referee-eval he` | folded 2263/2561 (88.4%), symbol 97.0% | folded **2264**/2561, symbol 97.0% |
| `corpus-diff` DROP | 68 | **27** |
| utterances changed | — | **262 / 373 (70.2%)** |
| DIGIT / SLOT-GAP / RAWMARK / THROW | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| `mine.ts scan` | percent ×35, ampersand ×12, math-sign ×10, degree ×8, minus ×8, exponent ×5, currency ×4 | ampersand ×12, math-sign ×10, minus ×8 |
| `review.ts --lang he` | 1 FAIL (normalizer missing) | **1 FAIL: `minus`** — see below |
| `languageCatalogue.test.ts` | pass (stale after the edit) | pass after `derive-normalization.py` + `build.py` |

The `percent ×1` and `currency ×1` the scan still showed before the declarations are `date +%s` (a shell
format string in the Unix-time article) and `(TT$)` (an ISO code beside a fully spelled-out
`576,000 דולר טרינידדי` — trap 12's permissible drop). Both are instance-listed in `ACCEPTED_SILENT`.

⚠ **`minus` STAYS RED, and that is the result rather than an unfinished item** (trap 24). The layer DOES
read Hebrew's negative — the corpus writes it AFTER the unit (`18°C-`, `נמוכות מ-60°C-`, ×5), because in
RTL display a trailing hyphen renders to the left of the quantity, and `מִינוּס` is sourced for that slot.
What is unread is a LEADING `-5`, and the reason is measurement, not sourcing: all 7 leading instances in
the corpus are a date-range dash inside a birth–death parenthetical, a clause dash, or the aircraft
designation `-700W` — **not one is a negative**, so a rule would be 0-for-7. Omitting a minus INVERTS, so
the class is left failing rather than declared correct; `rw` and `ht` take the same position for the same
reason. Re-checking it costs one grep.

**Read every changed line of the sample tier** (200 segments, 107 changed): no regression found. The shapes
worth recording are the ones that came out right for a non-obvious reason — `למעלה מ-2000` → *le-ma'ala me
alpayim* (the numeral IS guttural-initial, so מֵ is correct there), `בכ-47.9%` → *be ke 47.9 achuz* (a
two-letter proclitic run), `בין 1878 ל-1885` (the ל half of the מ…ל range circumfix, which the layer reads
while declining the bare dash), and `ההפקה … נחשבת לְ "מחזמר העברי הראשון"` (the quote arm, not the acronym
arm).
