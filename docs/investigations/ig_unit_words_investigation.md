# Igbo (`ig`) unit words — sourcing the measure nouns the symbol tier was never given

Igbo shipped a normalization layer (`normalization = done`) that declares `percent`, `currency`, `ampersand`,
a range rule, a de-grouping rule and a decimal rule — but **no `units` table at all**. Every metric
abbreviation therefore survived into the phoneme string as raw ASCII.

This log is chronological. Negative results are kept on purpose.

---

## Run 1 — 2026-08-12 — confirm the diagnosis

**Question.** Is the tier called with no `units` key, or with a table that misses `km`/`mm`?

**Command.** Read `src/languages/igbo/normalize.ts`; `grep -n "units" src/core/normalizeSymbols.ts`.

**Raw finding.** `makeSymbolNormalizer({ percent, percentPrefix, currency, ampersand })` — **the `units` key is
absent entirely.** Not a table with a hole in it; there is no table. `unitPrefix`, `unitPer`,
`rateDenominators` and `exponentWords` are likewise undeclared.

The layer's own header already records three deliberate refusals (degrees, multiplication, `£`/`€`), so the
silence on units is not a documented refusal — it is an omission.

**Probe at the IPA level:**

```
"10 km"     -> iɾi km
"1500 mm"   -> otu puku na naɾɪ ise mm
"48 kg"     -> iɾi anɔ na asatɔ kɡ
```

`kg` is the worst of the three: it does not even survive as ASCII, it is *pronounced* `kɡ`, a consonant
cluster asserting itself as Igbo phonology.

**Implication.** The whole table has to be sourced from scratch. Nothing to patch.

---

## Run 2 — 2026-08-12 — measure the exposure, per abbreviation

**Question.** Which abbreviations actually occur in the mined artifact, and how often after a digit? The
after-a-digit count is the one that matters, because the tier matches units only there.

**Command.** A script over the `"text"` fields of the mined `ig` artifact, counting
`\d\s*UNIT(?![\p{L}\p{M}\d])` and the bare-token form.

**Raw finding** (after-digit, then bare token):

| abbr | after digit | token |
|---|---|---|
| `m`   | 14 | 18 |
| `mm`  | 9  | 5  |
| `km`  | 7  | 7  |
| `ft`  | 4  | 4  |
| `km2` | 4  | 4  |
| `mi`  | 3  | 5  |
| `kg`  | 2  | 3  |
| `in`  | 1  | 30 |
| `ha`  | 0  | 54 |
| `s`   | 0  | 19 |
| `cm`  | 0  | 0  |

**Implication, and the first warning in the data.** `ha` has **54 bare tokens and zero after a digit** —
because `ha` is the Igbo third-person plural pronoun *"they"*. `in` (30/1) and `s` (19/0) are the same story.
The bare-token column for a short key measures the LANGUAGE, not the unit. This is the one-letter-key trap the
tier's own `rateDenominators` docs describe (`Il-76s`), and Igbo has a sharper version of it than most: `m` is
the Igbo first-person singular pronoun.

So the after-digit column is the only one that can justify a key, and short keys need their contexts read
individually rather than counted.

---

## Run 3 — 2026-08-12 — attest the candidate words on the wiki

**Question.** `mita`, `kilomita`, `milimita`, `sentimita`, `kilogram` all appear in the mined artifact
(14 / 9 / 1 / 1 / 1 occurrences). Are they real Igbo tokens, and do the dotted-vowel spellings exist?

**Command.** `npx tsx tools/normalization/attest.ts --lang ig --words kilomita,mita,milimita,sentimita,kilogram,kilomịta,mịta`
(default `--limit`; writes `tools/corpus/attest/ig.jsonc`, which did not previously exist).

**Raw finding** (hits / articles / substring-only):

```
kilomita   99  20  0   attested
mita      213  20  0   attested
milimita   47  20  0   attested
sentimita  97  20  0   attested
kilogram   85  20  0   attested
kilomịta    0   0  0   absent
mịta       18   3  0   attested
```

Zero substring-only hits across the board — these are real tokens, not `Libyen`-style artefacts.

**Reading the examples, which is the part that matters:**

- `kilomita` — distances and areas throughout: *"Ala ahụ dị ihe dị ka kilomita 70 ruo 80 n'ogologo, na nkezi
  obosara nke kilomita 10"* (length and width of a stretch of land). Sense unambiguous.
- `sentimita` — *"nkata dị sentimita 18 … na dayameta"* (a basket's diameter), *"naabụkarị sentimita 9
  nobobosara"* (plank width). Unambiguous.
- `kilogram` — weight classes in wrestling/weightlifting, *"ihe omume ụmụ nwoke 55 kilogram"*. Unambiguous.
- `mita` — **contaminated.** The overwhelming majority of wiki hits are athletics EVENT NAMES calqued from
  English: *"Ọsọ mita 3000"*, *"mita 5000"*, *"ihe mgbochi mita 80"*. The word is real; the sample is not a
  sample of measurement.
- `milimita` — ⚠ **the top wiki hits are a false friend.** The single densest passage is a banknote
  denomination list: *"Otu nde 5 milimita 10 milimita 20 milimita 50 milimita 100 milimita 200 milimita dinar
  1 dinar Dinar 2 Dinar 5"*. That is the **Tunisian *millime*, a currency subunit**, not the millimetre. This
  is exactly the `bar`/`Komma`, `ti`/`ናቕፋ`, `ht`/`pwen` failure mode, and a hit count alone would have walked
  straight into it.

**Implication.** `milimita` cannot be declared on the strength of the wiki count. It needs a separate,
sense-checked source. Continued in Run 5.

`mịta` is a real minority spelling (18 hits / 3 articles) but `kilomịta` is flatly absent — so the dotted
vowel is not a systematic Igbo-ization of these loans, and the undotted forms are the ones to ship.

---

## Run 4 — 2026-08-12 — the word order, which is the thing English gets wrong

**Question.** Does the measure noun precede or follow its number? Igbo numerals follow the noun they count
(*ụlọ atọ*, "house three" = three houses), so the English order cannot be assumed — and this layer already
records that Igbo puts `pasent` BEFORE its number while writing the sign after.

**Command.** `npx tsx tools/normalization/attest.ts --lang ig --after kilomita,sentimita,milimita,kilogram`,
plus `insource:` counts on ig.wikipedia, plus every spelled-out instance in the mined artifact.

**Raw finding.**

The `--after` tier reports the commonest followers of the noun as **numerals**: `iri` ×3, `irí` ×2, `na` ×2.
Examples:

- *"kilomita irí isii na anọ"* — 64 km, noun then spelled numeral
- *"sentimita iri abụọ na anọ"* — 24 cm, same
- *"38 milimita na 50 milimita"* — digits then noun, the other order

ig.wikipedia `insource:` counts on `kilomita` (the one term with no substring contamination — `mita` is
inside `kilomita`/`sentimita`/`milimita` and cannot be counted this way):

| pattern | hits |
|---|---|
| `kilomita` + spelled numeral | 330 |
| spelled numeral + `kilomita` | 61 |
| `kilomita` + digits | 773 |
| digits + `kilomita` | 284 |

**Noun-first is the majority in both: 84% when the number is spelled out, 73% when it is digits.**

Attested noun-first with spelled numerals — the diagnostic case, because a writer spelling the phrase out is
not copying a numeric layout:

- *"kilomita iri ise"* (50 km), *"kilomita atọ"* (3 km), *"kilomita abụọ na ụka ise"* (2.5 km)
- *"kilogram iri asaa na ise"* (75 kg)
- *"mita iri ato na otu"* (31 m)

And with digits: *"kilomita 115 (71 mi)"*, *"kilomita 3,000"*, *"sentimita 9.4"*, *"sentimita 60-80"*,
*"kilogram 25"*, *"milimita 3.4"*, *"square kilomita 469"*.

The mined artifact agrees once the athletics event names are set aside: preposed *"kilomita otu narị na iri
isii na ise"*, *"kilomita 115"*, *"kilomita iri abụo na atọ"*, *"square kilomita puku abụọ"*, *"sentimita
60-80"*, *"kilogram 25"* (6) against postposed *"20 kilomita"*, *"580 milimita"*, *"5 na 6 mita"* (3).

**A caveat kept honestly:** every DIGIT+ABBREVIATION instance in the artifact is written number-first —
*"773 km"*, *"1,287 mm"*, *"124 kg"*. That is the written layout of the abbreviation, not the spoken phrase,
and it is the same split this layer already recorded for `%`: sign after, word before. The spelled-out
instances are the evidence about what a reader says, and they are noun-first 84/16.

**Implication.** `unitPrefix: true`. Same conclusion `hil`, `rw`, `sw`, `si` and `om` reached, reached here
from Igbo's own noun-numeral syntax rather than by analogy.

A minority number-first pattern is real (*"na-aga ihe ruru iri kilomita kwa ụbọchị"*) and is not being served.
That is the documented cost of picking the majority order; it is 16% of the spelled cases.

---

## Run 5 — 2026-08-12 — rescuing `mm` from the *millime* problem

**Question.** Run 3 disqualified the wiki hit count for `milimita`. Is there sense-clear evidence for the
MILLIMETRE reading, given `mm` is the second-highest-exposure abbreviation in the artifact (9 after a digit)?

**Command.** Read all nine after-digit `mm` contexts in the mined artifact; search ig.wikipedia running text
for `milimita` in a measurement frame.

**Raw finding.** All nine artifact `mm` instances are **rainfall**, without exception:

```
Ozuzomiri ya bụ ihe dika 1,287 mm nime otu afǫ
mmiri ozuzo kwa afọ nke ihe dị ka 1,500 mm (59.1 in)
nwere mmiri ozuzo kwa afọ n'etiti 1,100mm na 1,300mm
mmiri ozuzo kwa afọ, nke dị n'etiti 990.3 mm na 1318mm
ihu igwe na-abụkarị sentimita 60-80 (1,524 ruo 2,032 mm) kwa afọ
```

And the artifact's single spelled instance is the same frame with the word: *"Ndjamena na-edekọ mmiri ozuzo
kachasị elu kwa afọ nke 580 milimita (22.8 in)"* — **the corpus glosses its own abbreviation.** Rainfall in
millimetres, spelled out, in Igbo, in the artifact this layer is measured against.

On the wiki, two further measurement frames: *"Ọkpụkpụ ya dị ka oval dị milimita 3.4 n'ogologo"* (a seed,
length) and *"Nkezi mmiri ozuzo kwa afọ na Jamaare bụ 90.02 milimita (3.54 sentimita)"* (rainfall again).

**Implication.** `mm` → `milimita` is declarable. The *millime* passage is a real trap in the hit count and is
recorded here so nobody re-derives it, but it does not touch the measurement sense, which the corpus itself
supplies with the abbreviation beside the word.

---

## Run 6 — 2026-08-12 — the refusal: `m`

**Question.** `m` has the highest after-digit exposure of any abbreviation (14). Declare it?

**Command.** Read all 14 after-digit `m` contexts in the mined artifact.

**Raw finding.**

- **1 is not a metre at all:** *"director of a $60 m big-screen adaptation"* — English text inside the Igbo
  artifact, where `m` is *million*. Declaring `m` reads this as *"mita 60"*, a confident and specific error.
- **2 are genuine metres:** *"Chappal Waddi na 2419 m (7936 ft)"*, *"ugwu Vlašić (1943 m)"* — elevations.
- **11 are athletics event names:** *"4 × 200 m freestyle relay"*, *"100 m na Olympics"*, *"4 × 400 m"*.

**Implication. REFUSED.** Three reasons, and the first alone would be enough:

1. A live in-corpus counterexample. 1-in-14 wrong is not a rate this project accepts for a rule that
   *replaces* text; the tier's own docs refuse `s` for exactly this (`Il-76s`).
2. `m` is the Igbo **first-person singular pronoun**, the commonest bound morpheme in the language. The
   artifact's 18 bare `m` tokens are mostly that. Any digit-then-pronoun sequence the corpus does not happen
   to contain is a latent version of the `$60 m` failure.
3. The wiki sample for `mita` (Run 3) is dominated by calqued event names, so the strongest evidence for the
   word is also the weakest evidence about the unit.

`m` therefore stays unauthored, with 14 after-digit occurrences left unread. Preferring an unauthored word
over an invented one is the project's rule; preferring an unauthored KEY over a wrong one is the same rule
applied to the table.

Note this leaves `m` reaching the phoneme sink as the letter `m`, which Igbo g2p voices as `m` — a leak, but a
silent and harmless one, unlike `kg` → `kɡ`.

---

## Run 7 — 2026-08-12 — the refusals: `km²`, the rate, `ft`/`mi`/`in`/`ha`

**Question.** What else in the exposure table can be served?

**Raw finding and decisions.**

- **`km2` / `km²` (4 after a digit) — refused here, and the refusal was WRONG. Overturned in Run 10.** The
  reasoning at the time: both the artifact and the wiki write the ENGLISH word — *"square kilomita 469"*,
  *"155 square kilomita"* — and declaring an English adjective as Igbo language data is the `tere` failure
  wearing a different hat. That was right about `square` and wrong about the language. See Run 10.
- **`km/h` and the rate — NOT DECLARED, zero exposure.** `h` is 0 after a digit in the artifact and there is
  no `km/h` instance at all. `unitPer` would need both a connective and an hour noun sourced to serve nothing.
- **`ft` (4), `mi` (3), `in` (1) — NOT DECLARED.** These are imperial, and in every artifact instance they
  appear as a PARENTHETICAL GLOSS of a metric figure the sentence already gave: *"kilomita 115 (71 mi)"*,
  *"1,500 mm (59.1 in)"*, *"2419 m (7936 ft)"*. The metric half is now read; reading the gloss too would say
  the same measurement twice. No Igbo word was sought for them.
- **`ha` (0 after a digit, 54 tokens) — NOT DECLARED**, and the 54 tokens are the pronoun *"they"*. See Run 2.
- **`cm` (0 after a digit) — DECLARED ANYWAY**, and this is the one entry with no artifact exposure. The WORD
  is the second-best attested of the five (97 hits / 20 articles, sense unambiguous — diameters, widths,
  heights), the abbreviation is unambiguous, and the wiki writes `cm` beside it (*"nkata dị sentimita 18 (cm
  46)"*). Declared on the word's evidence, with the zero exposure stated rather than hidden.

---

## Run 8 — 2026-08-12 — do the words survive Igbo g2p?

**Question.** Igbo is tonal and written with dotted vowels. Do the four words phonemize cleanly, and does the
untoned register match the rest of the layer?

**Command.** `phonemize(w, "ig")` on each word.

**Raw finding.**

```
kilomita  -> kilomita
milimita  -> milimita
sentimita -> sentimita
kilogram  -> kiloɡɾam
```

All four are plain, all-undotted, all-untoned. `kilogram` shows the engine's `r` → `ɾ` tap, which is the same
rule that already gives this layer `naiɾa`, `dollaɾ` and `ntʊk͡pɔ`. Nothing needs a diacritic, which is
consistent with Run 3's finding that `kilomịta` has zero attestations — these loans are not dotted in Igbo.

**Implication.** Ship untoned and undotted, matching `pasent`, `naira`, `dollar`, `na` and `ntụkpọ`.

---

## Run 9 — 2026-08-12 — the change, and the first probe of it

Declared in `src/languages/igbo/normalize.ts`:
`units: { km, mm, cm, kg }` from the words above, plus `unitPrefix: true`.

```
"10 km"   -> kilomita iɾi
"1500 mm" -> milimita otu puku na naɾɪ ise
"48 kg"   -> kiloɡɾam iɾi anɔ na asatɔ
"24 cm"   -> sentimita iɾi abʊɔ na anɔ
"$60 m"   -> iɾi isii dollaɾ m          (the refusal holds — the letter stays unread)
```

**But the same probe found a REGRESSION**, and it is the direct consequence of Run 7's refusal:

```
"790 km2" -> naɾɪ asaa na iɾi itoolu kilomita abʊɔ      ← "790 kilometres TWO"
"790 km²" -> naɾɪ asaa na iɾi itoolu kilomita           ← the ² silently vanishes
```

With `exponentWords` undeclared the tier re-emits the exponent, which its own comment justifies as leaving
the mark "where the leak gate can see it". That reasoning holds for `²` and **fails for an ASCII `2`**,
because an ascii 2 is not a leak — it is a NUMBER, and the number path then reads it. The artifact writes
`km2` in ascii, always, and contains no `km²` at all. So declaring `km` without a measure word does not leave
`km2` as it was; it invents a wrong quantity where before there was only raw text.

**Implication.** Run 7's refusal is not a neutral silence. Either find the measure word or the `km` key makes
`km2` worse. Go back and look properly.

---

## Run 10 — 2026-08-12 — the squared word, and the candidate that was hiding it

**Question.** Is there an Igbo word for *square* in the measurement frame, or is `square kilomita` really all
there is?

**Command.** `npx tsx tools/normalization/attest.ts --lang ig --words square,skwea,skwuea`

**Raw finding.**

```
square   154  20  0   attested
skwea     44  19  0   attested
skwuea     0   0  0   absent
```

⚠ **The higher count is the wrong word, and only the examples say so.** Every `square` example is an English
proper noun: *P-Square* (a Nigerian duo), *Cabot Square* (a plaza in Montreal), *Square Records*. Had Run 7
been decided on the count, it would have declared a band name as Igbo measurement vocabulary.

`skwea` is a third the size and **every single example is this exact slot**:

```
…mpaghara dị ihe dị ka kilomita skwea 7,223 (maịl skwea 2,789)…
…na-ekpuchi ihe dị ka kilomita skwea 900 (maịl skwea 350)…
…fọdụrụ naanị n'ime ihe dị ka kilomita skwea 220 nke ahịhịa…
…Mpaghara nnakọta mmiri ya na-ekpuchi ihe dị ka kilomita skwea 49,800…
```

NOUN, then modifier, then number — in 19 independent articles.

**Implication.** `exponentWords: { squared: ["skwea"], position: "after" }`. `unitPrefix` then completes it
into the attested three-part shape with no further arrangement, which is a good sign the two options are
describing the same fact about the language. `cubed` stays undeclared — no `km³` in the artifact, no
candidate word found.

```
"790 km2" -> kilomita skʷea naɾɪ asaa na iɾi itoolu
"790 km²" -> kilomita skʷea naɾɪ asaa na iɾi itoolu
```

`skwea` → `skʷea` via the engine's own `kw` → `kʷ` rule, the same one that gives Igbo `àkwụ́kwọ́` → `akʷʊkʷɔ`.

**Kept as the lesson of this run:** a refusal is not automatically safe. Run 7 refused a word and thereby
shipped a wrong number; the refusal had a cost it had not been checked for.

---

## Run 11 — 2026-08-12 — corpus diff, and a defect this layer introduced

**Question.** Does the change do anything at corpus scale that the probes could not see?

**Command.**

```
corpus-diff.ts emit --lang ig --corpus mined:ig --out …/ig.before     # from a detached worktree at HEAD
corpus-diff.ts emit --lang ig --corpus mined:ig --out …/ig.after
corpus-diff.ts compare --before …/ig.before --after …/ig.after --corpus mined:ig
```

(The baseline came from a read-only detached worktree pinned at the starting commit, never from `git stash` —
this is a shared checkout and a stash is global state.)

**Raw finding.** `changed 18/459 (3.9%)`, defect counts flat:

```
before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 43, THROW: 0 }
after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 43, THROW: 0 }
```

⚠ **And a defect none of the counters caught**, found by reading the changed lines:

```
SRC  Ọ nwere mpaghara ala198 km2 na onu ogugu ndi mmadu nke 219,632
 -   ɔ ŋʷeɾe mpaɣaɾa ala otu naɾɪ na iɾi itoolu na asatɔ km abʊɔ na …
 +   ɔ ŋʷeɾe mpaɣaɾa alakilomita skʷea otu naɾɪ na iɾi itoolu na asatɔ na …
```

The source writes `ala198` with no space. Before, that read fine — the number path inserts its own boundary
when it replaces the digits. But **`unitPrefix` moves the unit noun LEFTWARD**, and the unit rule's match
starts at the digit, so the noun lands flush against `ala` and the utterance gained a fused word,
*alakilomita*. Not a DIGIT, not a RAWMARK, and not a SLOT-GAP either — SLOT-GAP detects a DOUBLE space, and
this is a MISSING one. Invisible to every counter the gate has.

**Implication.** A defect this layer introduced, and one that any `unitPrefix` language over messy text can
have. Fixed locally as rule 2b: insert a space between a letter and a digit run **only when a declared unit
follows it**, which is what makes the digits a quantity by construction. The unit list is derived from the
one `UNIT` table so the guard cannot drift from the tier's keys.

Checked that the narrowness is real, since a general letter/digit split would maul the corpus:

```
"mpaghara ala198 km2" -> mpaghara ala kilomita skwea 198   (fixed)
"Il-76 na 1990"       -> Il-76 na 1990                     (untouched)
"COVID19 na 2020"     -> COVID19 na 2020                   (untouched)
```

Re-run after the fix: still `18/459`, defect counts still flat, and the fused reading is gone.

---

## Run 12 — 2026-08-12 — the remaining gates

| gate | before | after |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 3844 pass / 1 fail | 3850 pass / 0 fail (242/242 files) |
| `corpus-diff compare` | — | 18/459 changed (3.9%), DROP 43 → 43, no new DIGIT/RAWMARK/SLOT-GAP/THROW |
| `mine.ts scan --lang ig` | DROP minus ×11, currency ×3, iteration ×1 | **identical** |
| `review.ts --lang ig` | 1 FAILING (artifact scan) | 1 FAILING (artifact scan), same three counts |
| `sources.ts --lang ig` | 18 classes | **identical** |
| `referee-eval.ts ig` | — | **cannot run at all** |

The "before" column's single failure was `test/onnx-optional.test.ts`, which times out at 5s under concurrent
load; it passed on the final unloaded run and is unrelated either way. **No golden expectation changed**; the
five new test blocks in
`test/igboNormalize.test.ts` are all additions, and `test/igbo.test.ts` (the hand-adjudicated canonical-IPA
gold) is untouched and passes.

**`review.ts` still FAILS, and it failed identically before this change** — DROP minus ×11 (all geographic
coordinates, `4°06′12′′S 141°39′54′′E`), DROP currency ×3 (all inside English sentences embedded in the Igbo
wiki), DROP iteration ×1. Every one is a documented intentional silence of this layer, none is a unit, and
none moved. What DID move in the report is the exponent row: `5 km²` went from `INTENT → ise km` to
`kilomita skʷea ise`.

**`sources.ts` cannot measure this change at all** — its eighteen classes are letter-names, decimal-point,
era-phrase, scale-names, percent-word, currency-word, fraction-series and the arithmetic signs. **There is no
unit-word class.** Output is byte-identical before and after. Worth recording as an instrument gap rather
than as a passing gate.

**⚠ `referee-eval.ts ig` CANNOT MEASURE THIS, and cannot measure anything for Igbo:**

```
Error: no referee config for "ig"
```

Igbo has no independent referee at all — wikipron `ibo_latn`, epitran `ibo-Latn` and the kaikki extract are
all 404, which `normalize.ts` and `igboNormalize.test.ts` already record in their headers. So this is not the
familiar "the referee is a word list that no symbol layer can move" result; it is a step weaker than that.
There is no referee to run. The evidence for this change is the corpus diff, the attestation cache, and the
hand-adjudicated gold — nothing else was available, and the layer was built that way from the start.

---

## Summary — what was declared and what was refused

**Declared** (`src/languages/igbo/normalize.ts`), all four abbreviations plus the squared modifier:

| key | word | wiki | artifact | sense read in the examples |
|---|---|---|---|---|
| `km` | `kilomita` | 99 / 20 | ×9 | *"kilomita 70 ruo 80 n'ogologo"* — a length |
| `mm` | `milimita` | 47 / 20 | ×1 | *"mmiri ozuzo … nke 580 milimita (22.8 in)"* — rainfall |
| `cm` | `sentimita` | 97 / 20 | ×1 | *"nkata dị sentimita 18 na dayameta"* — a diameter |
| `kg` | `kilogram` | 85 / 20 | ×1 | *"ihe omume ụmụ nwoke 55 kilogram"* — a weight class |
| `²`/`2` | `skwea` | 44 / 19 | — | *"kilomita skwea 7,223 (maịl skwea 2,789)"* — an area |

Word order **`unitPrefix: true`**, exponent **`position: "after"`**.

**Refused**, with the count each refusal leaves unread:

| | exposure | why |
|---|---|---|
| `m` | 14 after a digit | *"a $60 m big-screen adaptation"* is *million*; `m` is the Igbo 1sg pronoun |
| `ft` / `mi` / `in` | 4 / 3 / 1 | imperial, and every instance is a gloss of a metric figure already read |
| `ha` | 0 after a digit | the 54 bare tokens are the pronoun *"they"* |
| `cubed` | 0 | no `km³` anywhere, no candidate word |
| `unitPer` (rate) | 0 | no `km/h` at all; would need two words sourced to serve nothing |

`cm` is declared despite ZERO artifact exposure, on the word's evidence rather than the abbreviation's.
