# shi (Tashelhit / Shilha) — text normalization investigation

Target: a `src/languages/tashelhit/normalize.ts` pre-tokenizer layer, per `docs/normalization_playbook.md`.

## Run 1 — 2026-08-13 (early) — establish the SCRIPT situation before anything else

**Command**

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/shi.jsonc --lang shi
# plus a script census over the artifact's 403 retained segments (hard 203 + sample 200)
```

**Question.** Tashelhit is catalogued Latin/Tifinagh and is also written in Arabic script. Which does the
engine accept, and which does the corpus actually contain? (The `cdo` precedent: a "Sinitic" language that
turned out not to be written in Han reversed three design decisions.)

**Raw finding.**

- The engine (`src/languages/tashelhit/tashelhit.ts`) tokenizes with
  `hostWordRun(["Latin", "Tifinagh"])` plus a digit group `[0-9٠-٩]+` and a clause-mark group. So the token
  class is the two SCRIPTS, not a letter list — Neo-Tifinagh U+2D30–2D7F is INSIDE the class, and the
  `bal`-style "letter outside the class is deleted, splitting the word" hazard does not apply to Tifinagh.
  **Arabic letters are NOT in the class.**
- Script census over the 403 retained segments:
  - Tifinagh present in **6 / 403** segments (1.5%) — and in every one it is a GLOSS, introduced by
    `(s tfinaɣ : …)` / `(s tifinaɣ: …)`, e.g. `Tga Tafrawt (s tifinaɣ: ⵜⴰⴼⵔⴰⵡⵜ) yat tiɣrmt …`.
  - Arabic present in **51 / 403** segments (12.7%) — and in every one it is likewise a foreign-language
    gloss, introduced by `(s tɛrabt: …)` / `(s taɛrabt: …)` / `(s taserɣint: …)`, e.g.
    `Iga Muḥammad (s tɛrabt: محمد) …`.
  - Running text is **Berber Latin** throughout.
- Artifact: 43,733 segments, dump-sourced (`shi.wikipedia.org dump (pages-articles, paragraphs)`),
  `cellsCovered 28 / cellsTotal 35`.

**Implication.** shi is a **Latin-script job**. Tifinagh and Arabic are both quotation, not orthography, so
the layer is written against Berber Latin; no Tifinagh-specific rule is warranted by the corpus. Two things
still need probing before that is settled:
1. whether an Arabic-only run reads as the **empty string** (the `ug` finding: 8 of 429 segments empty), and
2. one segment writes `mṛṛakⵯc` — a Tifinagh Tamatart (U+2D6F) inside a LATIN word. `phonemize()` picks its
   map with `[...word].some(isTifinagh)`, so a single Tifinagh codepoint switches the WHOLE word onto the
   Tifinagh table, under which every Latin letter falls through as itself. That is a raw-Latin leak by
   construction. Probe it.

**Scan (baseline), full output:**

```
DROP percent       ×136
LEAK RAW-LATIN km  ×25
DROP exponent      ×17
MARKUP math-sign   ×15
DROP degree        ×10
DROP math-sign     ×9
DROP minus         ×8
MARKUP ampersand   ×8
DROP currency      ×4
LEAK RAW-LATIN kg  ×3
ACCEPTED-PHONOTACTIC RAW-LATIN ×285
```

`km ×25` + `kg ×3` = the 26 raw-Latin hits the fleet detector reports for shi (the fleet count is per
finding line, and `ALWAYS_REPORTED` keeps them visible through the Berber vowelless-word exemption).
`DROP percent ×136` is an order of magnitude larger than anything else and is the headline defect.

## Run 2 — 2026-08-13 — is the referee a meter or a tripwire?

**Command.** `npx tsx tools/referee-eval/eval.ts shi` · `grep -n tashelhit tools/referee-eval/*.ts`

**Question.** shi has real referees (wikipron shi_latn 500, kaikki Tashelhit 601). Can a text-normalization
layer move them?

**Raw finding.** `eval.ts:62` binds shi as
`import { phonemizeWord as shi } from "../../src/languages/tashelhit/tashelhit.ts"` — the **WORD path**.
`normalize.ts` runs inside `text()`. The referee therefore never sees this layer. Baseline:

```
wikipron shi_latn_broad (500)   raw 468/500 (93.6%)   folded 487/500 (97.4%)   symbol 99.4%
kaikki Tashelhit (601)          raw 586/601 (97.5%)   folded 588/601 (97.8%)   symbol 99.5%
```

**Implication.** It is a **TRIPWIRE, not a meter**: the correct after-value is byte-identical. Any movement
means the g2p was touched, which this task must not do. (Both referees are Wiktionary-derived and the eval
says so itself — a correlated single-source family, not a triangulation.)

## Run 3 — 2026-08-13 — probe the engine on the corpus's own shapes

**Command.** A probe script over `getPhonemizer("shi").text(...)` for every form the corpus writes, plus an
EMPTY-READING sweep over all 403 retained segments.

**Question.** What does the engine actually do to these forms (playbook step 2), and does any segment read as
the empty string (the `ug` finding)?

**Raw finding — empty readings: 0 / 403.** And the Arabic-script glosses are NOT dropped: `محمد` → `mħmd`.
`assembleClauses` + `core/scripts.ts` route a run in a script the engine does not claim to that script's own
engine, so the Arabic quotations reach the Arabic phonemizer. Nothing to fix there.
The `mṛṛakⵯc` hazard from Run 1 also does **not** fire: `mṛṛakⵯc` → `mṛːakʷc`. The Tamatart U+2D6F is the
LABIAL MARKER in `phonemize()` and is consumed before the map is consulted, so a Latin word carrying one
does not flip to the Tifinagh table. Negative result, kept.

**Raw finding — the defect list:**

```
8665 km²      → tmn alaf u stː mja u χmsa u stːin km    exponent gone, `km` RAW in the IPA
5 kg          → χmsa kɡ                                  `kg` RAW
1 470 m       → jan  rbʕ mja u sbʕin  m                  space grouping = TWO numbers, `m` raw
510.072.000   → three SENTENCE BREAKS                    period grouping read as clause punctuation
8,000         → …  ,  …                                  comma grouping read as a pause
37.4%         → sbʕa u tlatin . rbʕa                     decimal period = a SENTENCE BREAK; % silent
17,9%         → sbʕtaʃ , tsʕud                           decimal comma = a pause; % silent
20°C          → ʕʃrin ʃ                                  ° dropped AND ⟨C⟩ read as the shi grapheme c = ʃ
-45°Silsyus   → the minus dropped
148 D.Ɛ.      → mja u tmnja u rbʕin d . ʕ .              TWO spurious sentence breaks + two bare consonants
$47,203       → the sign silent
2:00          → sin , sˤifr
```

**Implication.** The layer's work is: de-grouping, units+exponent, degrees, era markers, decimals, currency.
`%` needs a word (Run 5). The `⟨C⟩ → ʃ` reading is the "confidently wrong beats merely missing" case and is
the strongest argument for claiming `°C` rather than leaving it.

## Run 4 — 2026-08-13 — the separator question, and a heuristic that LOST

**Command.** A bucketed count over the 403 retained segments, then a scorer for two competing rules.

**Question.** shi.wikipedia writes BOTH `37.4%` and `17,9%`, AND both `8,000 kilumitr` and `510.072.000 km²`.
Which mark is the decimal and which the grouping?

**Raw finding.** Bucketed by the length of the block after the mark, every instance read back:

```
             ≥2 groups   1 group ×3 digits    fraction 1–2 digits   fraction 4+
PERIOD          4            12                    346                  0
COMMA           4            28                     23                  2
```

- **PERIOD is unambiguous.** All 16 of the `\d{1,3}(\.\d{3})+` instances are GROUPING — `20.000 n tkklit`,
  `15.000 n ufgan`, `196.722 km²`, `190.000 d 90.000 q.ɛ`, `710.850 km²`, `180.000Km²`, `510.072.000 km²`.
  All 346 of the 1–2-digit ones are decimals. Zero counter-examples either way.
- **COMMA is mixed.** Of the 32 comma-3-digit-block instances, **29 are grouping** (`8,000 kilumitr`,
  `20,755 umzdaɣ`, `421,844 n mddn`, `103,000 km²`, `$535,000`, `-16,000 usggʷas`, `8,804,180 n umdan`) and
  **3 are decimals**, all in the maths/astronomy articles: `3,125` (a π approximation), `1,989`
  (the solar mass, `1,989 1 × 1030 kg`) and `99,854 %`.

**The heuristic that lost.** I hypothesised per-segment consistency: *if a segment contains an unambiguous
comma-decimal (1–2 or 4+ fraction digits), read its comma-3-digit blocks as decimals too.* Scored:

```
FLAT rule (3-digit block ⇒ always grouping)   29/32 correct   wrong: 3,125 · 1,989 · 99,854
PER-SEGMENT consistency rule                  26/32 correct   wrong: 20,755 · 1,989 · 99,854 · 20,770 · 22,072 · 8,804,180
```

**Implication.** The clever rule is WORSE — it loses four groupings to win one decimal. Take the flat rule,
plus one free exception: a comma-3-digit block **followed by `%`** is a decimal (catches `99,854 %`; no
grouping in the corpus is followed by `%`). That is 30/32. The two residual counter-examples — π and the solar
mass — are stated in the file rather than hidden.

## Run 5 — 2026-08-13 — sourcing: what shi CAN say, and the one word it cannot

**Commands.**
```
npx tsx tools/normalization/sources.ts --lang shi
npx tsx tools/normalization/attest.ts --lang shi --words …          (six batches, 60+ words)
npx tsx tools/normalization/attest.ts --lang shi --after ɛcrin,xmsin,tlatin,mya,sbɛin
npx tsx tools/normalization/concept.ts --items Q11229,Q137985650,Q32043,Q40754 --langs shi,kab,zgh,ary,ar,fr --titles
plus web search for a Tashelhit/Amazigh percent word
```

**`sources.ts --lang shi` (before):**
```
[NONE] letter-names     espeak does not ship this language at all
[NONE] decimal-point    no _dpt, no _., no manifest word — read the fraction digit-by-digit
[  · ] era-phrase       no era marker in the corpus
[NONE] scale-names      ° occurs, neither scale name … — degree-adjacent corpus tokens: Silsyus×2 …
[chk?] percent-word / currency-word / unit-word … [NONE] fraction-series
espeak: NOT SHIPPED · referee: 1104 lines · corpus: 403 lines
```

### WHAT IS SOURCED (every one read in context, not counted)

| slot | word | evidence |
|---|---|---|
| km | `kilumitr` | corpus ×7 digit-adjacent (`8,000 kilumitr`, `6 kilumitr ɣ tasragt`); wiki 36 tokens / 20 articles |
| **km²** | `kilumitr amkkuẓ` | the **collocation** ×5 across independent wiki articles, twice glossed against the imperial: `673 kilumitr amkkuẓ (260 mil amkkuẓ)`, `331,000 kilumitr amkkuẓ (128,000 sq mi)`. Corpus: `20,755 umzdaɣ i yan ukilumiṭṛ amkkuẓ`, `510.072.000 km² (yikilumitren imkuẓn)`. POSTPOSED, settled by the same evidence. |
| m | `mitru` | wiki ×6 digit-adjacent (`27 mitru`, `1 627 mitru`, `3.6 d 9 mitru`) |
| m² / m³ | `mitr amkkuẓ` / `mitr mukaɛɛab` | `60,000 id mitr amkkuẓ`; `24.3 mitr mukaɛɛab ɣ tsnat` |
| kg | `kilugram` | corpus `54 kilugram`; wiki `200 kilugram`, `1,5 kilugram` |
| g | `gram` | wiki ×4 digit-adjacent (`450 gram`, `500 gram n uggurn`, `300 Gram`) |
| cm | `santim` | wiki `gr 24 ar 34 santim`; corpus `130 santimitr` (the longer variant, kept as an alias) |
| mm | `milimitr` | wiki `20 milimitr g usggʷas`, `nig n 2000 milimitr` |
| **°** | `tskflt` | corpus `21.2 n tskflt d 28°`, `18 n tskflt ɣ yiḍ`; wiki `+25 n tskflt` |
| **°C** | `taskflt n Silsyus` | wiki `842 taskflt n Silsus`, and the gloss chain `gr 12 d 26 tafsna (taskflt) silasyuz (°C)`. Corpus writes the scale name GLUED to the sign: `-45°Silsyus`, `30°Silsyus`. |
| /h · /s | `ɣ tasragt` · `ɣ tsnat` | corpus `6 kilumitr ɣ tasragt`; wiki `24.3 mitr mukaɛɛab ɣ tsnat` |
| $ | `dulaṛ` | wiki `440 mlyun dulaṛ amirikani`, `40 mlyun dulaṛ`; corpus `1 agndid n dulaṛ (¥ … nɣd € … nɣd £ …)` |
| € | `uṛu` | wiki `18 mlyun Uṛu`, `17.1 mlyun Uṛu`, `2 id mlyun n Uṛu`; corpus `€3 id mlyun n Wuṛu` |
| era D./Ḍ. | `dat` / `ḍarat` | corpus spells it out: `g 250 **dat tlalit** n Yizus` (250 BC) and uses `250 D.T.`-shaped markers for the same dates; `Ḍarat n yan umnɣi gzzuln` = "after a short war" |

⚠ **`taskflt` is polysemous and the BARE count is the wrong measure** (trap 37). Its wiki hits also mean
RANK (`taskflt n ulyutnan`, "the rank of lieutenant"), LEVEL (`tskflt yattuyn ɣ twssna`), CLASS
(`taskflt tugḍiḍt`) and PLACE (`tskflt tamzwarut ɣ umaḍal`). What settles it is the DIGIT-ADJACENT
collocation, and there are five: `21.2 n tskflt`, `18 n tskflt`, `+25 n tskflt`, `842 taskflt n Silsus`,
`12 d 26 tafsna (taskflt) silasyuz (°C)`. The last glosses the whole thing against `°C` in one line.

### THE PERCENT WORD — A MEASURED REFUSAL

`%` is shi's largest class by an order of magnitude: `DROP percent ×136` in the scan, 234 number+% instances
in the 403 retained segments, and 24,338 in the artifact's whole-corpus cell count. And it is not sourceable.

- `tigmiḍi` — 120 tokens in 20 wiki articles, and **every single one is the same template**:
  `Tigmiḍi n tagufi (…) : 17,9%`, `Tigmiḍi n imzdaɣ lli iɣran … : 27,6%`. It is the NOUN "percentage" used
  as a section heading, standing BEFORE its figure, and the corpus writes it BESIDE the sign. Emitting it
  after the number would give "17.9 percentage". This is the Fula `tere` shape exactly: attested, real,
  wrong slot.
- `attay` (proportion) — 5 tokens, same objection, and 3 of the 5 are "a number of" (`attay n sin ifḍn`).
- Every candidate SPELLING probed on shi.wikipedia is **absent**: `afmiḍi` 0, `tamiḍi` 0, `amiḍi` 0,
  `ɣ mya` 0, `f mya` 0, `zɣ mya` 0, `g mya` 0, `ɣ timiḍi` 0, `lmya` 0, `lmiya` 0, `almya` 0, `pursan` 0,
  `purṣan` 0, `ɣ 100` 0, `zɣ 100` 0.
- `timiḍi` ×20 IS attested and is **not** it: read the quotes and it is the literary numeral 100
  (`100 nɣ Timiḍi`) plus a toponym (`trfiqt n timiḍi`, a douar, ×18 of the 20).
- `concept.ts` on Q11229 (percent) and Q137985650 (percentage): **no article in shi, kab, zgh or ary**.
  The Wikidata/interlanguage route has nothing to offer (trap 51's floor).
- espeak does not ship the language at all, so there is no phonetic fallback.
- Web search returns only the **Moroccan Darija** form `f-lmya` ("in the hundred"). That is a fact about
  Darija. Morocco is trilingual and the brief's own warning applies.

⚠ **AND THE REASON IS STRUCTURAL, WHICH IS WHY MORE CORPUS WOULD NOT HELP.**
`attest.ts --after ɛcrin,xmsin,tlatin,mya,sbɛin` returns **"nothing — no article in the search net puts a
word directly after that noun."** shi.wikipedia never spells a numeral out at all. The percent reading is
therefore absent from text *by construction* — the playbook's own diagnosis for a SIGN — and the escalation
tier for that is the corpus's own AUDIO, which shi does not have (no FLEURS).

**Decision: DECLINE.** `%` stays unread. "A wrong percent word is worse than a dropped sign, because it is
confidently wrong rather than merely missing." Recorded so nobody repeats the search. The redundancy escape
does not rescue it either: only **17 of 234** instances have `tigmiḍi`/`attay` within 90 characters to the
left, so 217 are contentful and the drop is real.

⚠ **AND THAT REFUSAL DECIDES LOCAL-vs-CORE.** `SymbolData.percent` is a REQUIRED field of
`makeSymbolNormalizer` and its arm is unconditional (`normalizeSymbols.ts:641,689`), so a language with no
sourceable percent word **cannot declare the shared tier at all**. shi's units, exponent and rate idioms
would otherwise all fit it (`unitPer` is the invariant `ɣ tasragt`; the exponent is postposed). This is a
FIFTH reason for playbook trap 47's list — not idiom and not ordering, but a mandatory data field the
language cannot fill — and it is **reported, not fixed**: making `percent` optional is a `src/core` change
touching 191 languages and is the reviewer's call.

### ALSO DECLINED, each with its count

- **decimal-point word** — `sources.ts` says `[NONE]`. `tanqqiḍt` is attested ×4 and means "point" in the
  senses GEOGRAPHIC (`ittubna ɣ tanqqiḍt akkʷ yattuyn`, "built at the highest point"), MELTING
  (`Tanqqiḍt n ufsay n waṛẓan n ukalsyum tga 842 taskflt n Silsus`) and PUNCTUATION MARK (in a list of
  grammar terms). None of those is the spoken decimal separator, and `virgul`/`fasila`/`tanqqiṭ` are 0.
  So the fraction is read **digit by digit with no separator word** — what `sources.ts` itself prescribes,
  and the Bambara/Lingala precedent. The defect being fixed is the spurious PAUSE, not the missing word.
- **minus** (15 leading-minus instances). No word is attested. And the instances split three ways —
  a real negative temperature (`-45°Silsyus`), NEGATIVE YEARS (`sg -945 armi ar -924`) and TIMEZONES
  (`gr -12 d +12`) — which is three different readings, not one.
- **fractions** (`1/6`, `2/3`, `22/7`, `25/8`, `256/81`, `223/71`). `[NONE] fraction-series`, and the
  `\d+/\d+` shape in this corpus is dominated by NON-fractions: `14/15 abril` (a date), `1989/1` (a journal
  issue), `4/1` (a series term). A rule here would misfire more than it fired.
- **clock** — the colon shape occurs **twice** (`2:00`, `00:30`) and `09.00` once. No shi reading of a
  digital time is attested.
- **initialisms as letter names** — `[NONE] letter-names, espeak does not ship this language at all`.
  The seam (`core/initialisms.ts`) exists and is a NO-OP without a table (trap 16 checked: the seam is
  there, the DATA is not).
- **`¥` and `£`** — one instance each, both inside the same currency gloss, and no shi word for either.
- **`b.ɛ`** (×2, `571 b.ɛ`, `632 b.ɛ`) — the `b` is not a shi word for "after"; the initials do not compose
  from anything attested, unlike `D.`/`Ḍ.`. Left alone.
- **the LaTeX residue** — `MARKUP math-sign ×15` and `MARKUP ampersand ×8` are one class: raw TeX that
  survived extraction (`\ln(a^n) = n \ln(a)`, `n=2,& (x + y)^2 &= …`). That is a mining artifact, not
  Tashelhit orthography, and no reading of it is correct.

## Run 6 — 2026-08-13 — write the layer, then read all 207 corpus-diff changes

**Commands.**
```
npx tsx tools/normalization/corpus-diff.ts emit --lang shi --corpus mined:shi --out …/shi.before   # BEFORE any edit
# …write src/languages/tashelhit/normalize.ts, wire it into text()…
npx tsx tools/normalization/corpus-diff.ts emit --lang shi --corpus mined:shi --out …/shi.after
npx tsx tools/normalization/corpus-diff.ts compare --before …/shi.before --after …/shi.after
```

**Question.** Does the layer break anything the probes could not see (playbook trap 3)?

**Raw finding.** `changed 207/402 (51.5%)`, `DROP 192 → 172`. `compare` prints only the first 12, so all
207 were dumped word-by-word and read. Three real defects, none of which any probe reported:

1. **The decimal rule's trailing guard was wrong.** `(?![\d.,])` refused the π article's
   `(π≈3,14, π≈22/7)`, because the decimal is followed by the SENTENCE'S OWN COMMA — so that instance kept
   its spurious pause while the identical `3,14` one line earlier was fixed. This is the same correction
   the de-grouping step already carried and it had not been carried across. Fixed to `(?![\d]|[.,]\d)`.
2. **The era marker is also written WITHOUT its final dot**, and looking for one form finds half the
   instances (trap 15's shape). The corpus's own `Ilul ɣ 238 D.Ɛ immt ɣ 148 D.Ɛ.` has both spellings in one
   sentence; `expandDotted` requires the trailing dot, so `238 D.Ɛ` still read `d . ʕ`. A second, dotless
   pass runs after the dotted one.
3. **`b.ɛ` is claimed by the GENERIC dotted run** even though the ERA arm declines it. The header claimed it
   was "left alone", which was inaccurate — the generic rule removes its interior dot (`b . ʕ .` → `bʕ .`),
   which is a pause repair and not a reading. Header corrected rather than the code.

**Pause audit.** Removed pauses: `.` 1299 → 891 (−408), `,` 1580 → 1518 (−62). Every one is accounted for
by a rule with a measured reason — 346 period decimals + ~20 period-grouping dots + ~15 era dots + ~21
dotted-run dots ≈ 402, and 25 comma decimals + ~38 comma-grouping commas ≈ 63. No sentence-final period was
lost: `expandDotted` and the dotted-run rule both keep the final dot when what follows is the end of input
or a capital, and `179 D.T. yat tdri` (lower-case continuation, dot spent) vs `170 Ḍ.Ɛ. Ittwassn`
(capital, dot kept) are pinned in the test file.

**Also confirmed working in the diff:** `¥ 106٬710٬325` de-grouped through the Arabic separator;
`8,000 kilumitr (5,000 mil)` → 8000/5000; `16 500 d 30 000` → 16500/30000; `cm` had been reading as
⟨c⟩+⟨m⟩ = *ʃm* and now reads `santim`; `mm` as *mː*.

## Run 7 — 2026-08-13 — the probe the corpus could not run: trap 46

**Command.** A spot probe of 28 forms through `normalizeTashelhit`, including branches the corpus does not
contain (trap 13/8).

**Raw finding.** `802.11m` → `802 1 1 mitru` — **"802.11 METRES"**, exactly trap 46/28. My header had
already claimed the leading `(?<![\p{L}\p{M}\d.,])` refused it; it does not. Rejected at `802`, the engine
retries from the FRACTIONAL part and matches `11m` on its own, which is trap 28's stated finding and which
a lookbehind alone cannot prevent. The tier's `NOT_VERSION` lookahead was lifted in verbatim.

**Implication.** The one-letter `m` key is worth keeping (4 genuine metres in the retained text, all read)
but it is not free, and the corpus could never have told me — this corpus has ZERO dotted designations.
`4000m` and `12.5 km` still read; `802.11m` now leaves the letter raw, which is the correct silence for a
designation. Negative-space kept: bare `s` and `n` are NOT declared, because `\d+\.\d+ [sn]` is ×60+ here
and every one is a COORDINATE hemisphere letter in a latitude table (`28.1 n`, `60.45 s`).

## Run 8 — 2026-08-13 — the gates, before and after

| gate | before | after |
|---|---|---|
| `mine.ts scan` — LEAK RAW-LATIN | `km ×25` + `kg ×3` = **26** | `km ×1` + `kg ×1` = **2** |
| `mine.ts scan` — DROP exponent | ×17 | ×1 (a footnote superscript, `yan usalay³`) |
| `mine.ts scan` — DROP degree | ×10 | ×5 (the coordinate set, declined) |
| `mine.ts scan` — DROP currency | ×4 | REDUNDANT ×1 |
| `mine.ts scan` — DROP percent | ×136 | class-level refusal (`ACCEPTED_SIGN_SILENCE`) |
| `corpus-diff` | — | changed 207/402 (51.5%), DROP 192 → 172, THROW 0 |
| `referee-eval shi` wikipron | 468/500 raw · 487/500 folded · 99.4% | **byte-identical** |
| `referee-eval shi` kaikki | 586/601 raw · 588/601 folded · 99.5% | **byte-identical** |
| `review.ts --lang shi` | 1 FAILING (normalizer missing) | 2 FAILING — both sourced refusals |
| `sources.ts` unit-word | `[chk?]` no layer yet | `[ ok ] 6 unit word(s) … all attested` |
| `sources.ts` scale-names | `[NONE]` | `[ ?? ]` the layer has a ° arm |
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 3970 passed | 3978 passed (8 new), 0 regressions |
| `test/languageCatalogue.test.ts` | — | passes after `derive-normalization.py` + `build.py` |

⚠ `test/onnx-optional.test.ts` times out at 5s. It fails in isolation too, touches nothing shi-related, and
is untouched by this branch — the known flake, discounted.

**The two `review.ts` FAILs are both correct and stay RED (trap 24).**
1. `sign classes DROPPED: minus` — the deliberate refusal. Omitting a plus is lossless; omitting a minus
   INVERTS. The 15 leading minuses split three ways (a negative temperature `-45°Silsyus`, negative YEARS
   `sg -945 armi ar -924`, UTC offsets `gr -12 d +12`), which is three readings and not one, and no shi word
   for a negative is attested anywhere. Same stance as ak, ln, bm and rw. **Not** added to
   `ACCEPTED_SIGN_SILENCE`.
2. `artifact scan` — minus ×8, degree ×5 (coordinates), km/kg ×1 (rate denominators), exponent ×1 (a
   footnote marker). None is a per-instance span that `ACCEPTED_SILENT` should absorb: each is a refusal
   whose reason is in `normalize.ts`, and quieting the gate for a refusal is the wrong use of that list
   ("a long block is a smell"). Nothing was appended to `test/accepted-silent.test.ts`.

## Run 9 — 2026-08-13 — one thing to report upstream, not fix

`SymbolData.percent` is a REQUIRED field of `makeSymbolNormalizer` and its arm is unconditional
(`src/core/normalizeSymbols.ts:641,689`). A language that cannot source a percent word therefore cannot
declare the shared tier **at all** — even when everything else about it fits, which is shi's case: its
units are ordinary postposed nouns, its exponent word is postposed (`kilumitr amkkuẓ`) and its rate idiom
is the invariant string `ɣ tasragt`, i.e. exactly what `unitPer` takes.

That is a **fifth reason for playbook trap 47's list** — not idiom (reason 1), not the tier's postposing
limit (2), not ordering (3), and not the `zsm` override-failure (4), but a mandatory DATA field the
language cannot fill. Making `percent` optional is a `src/core` change affecting 191 languages, so per the
fan-out rule it is **reported, not edited**. shi ships local rules meanwhile, and the reason is recorded at
the top of `normalize.ts` so it is not rediscovered as a style choice.

One unrelated repair the review surfaced and this branch made: `tashelhit.ts` was rebuilding its tokenizer
`RegExp` inside `text()` on every call. That also made `review.ts`'s trap-6 check ("no word SPELLING
reaches the phoneme sink") read the SCRIPT NAMES `"Latin"`/`"Tifinagh"` as unphonemized word literals — a
false positive it cannot tell from the real defect while the constructor sits in the method. Hoisted to
module scope, which is the fleet's convention (`bambara.ts`'s `TOKEN`) and closes both.
