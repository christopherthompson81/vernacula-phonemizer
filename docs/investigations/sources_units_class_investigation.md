# `sources.ts` — a unit-word class

Why: `sources.ts` reports on 18 vocabulary classes and **units is not one of them, by design**. That exclusion
is the named root cause of a missing unit word surviving a review cycle: Igbo called the shared symbol tier
with no `units` key at all for the whole life of its layer, `48 kg` read *iɾi anɔ na asatɔ kɡ*, and the
mandated pre-flight said nothing — because the class does not exist. Eleven languages with a normalization
layer had no unit word; ~50 more had the word but no bare-token path.

The shape to follow is the `scale-names` rebuild (`e5a3716`), which was wrong in 41 of 117 verdicts before it:
text evidence is corpus + referee + espeak and **never** the layer source; code evidence is read as arms with
the word taken as the residue; anything unreadable is `[??]`, never `none` and never `ok`.

## Run 1 — 2026-08-13, morning

**Question.** What shapes does a unit declaration actually take across the fleet, and what would a naive probe
get wrong?

**Command.** `grep -rn "units" src/languages/*/*.ts src/languages/*/*.jsonc`, plus a per-layer dump of the
first `units:` line for every directory with a `normalize.ts`.

**Raw finding.**

1. ⚠ **`units` is TWO different keys with one name.** `core/numbers.ts` declares `units: string[]` for the
   DIGIT SPELLINGS 0–9, and every manifest carries `"numbers": { "units": ["аноль", "акы", …] }`. A substring
   search for `units` over the layer source therefore reports a unit table for every language in the fleet —
   the same shape as the Oromo `scale-names` bug (a file documenting an absence read as evidence of presence),
   arrived at through a homonym instead of a comment.
2. The symbol-tier declaration takes four readable shapes and one unreadable one:
   - a literal object inside `makeSymbolNormalizer({ … units: { km: ["kilometro"] } … })` (most of the fleet);
   - the same object in `<lang>.ts` rather than `normalize.ts` (de, es, ja, th, vi…) — `langSrc` concatenates
     the directory, so both are visible, but only if the reader is scoped to the *tier call*, not the file;
   - `Object.fromEntries(Object.entries(UNIT).map(…))` over a local `const UNIT = { km: "kilomita" }`
     (ig, rw, rn) — the words are one identifier away;
   - `MANIFEST.symbols.units.map(([sym, word]) => …)` over a manifest pair array
     `"units": [["км", "километра"], ["м", "метра"]]` (ab) — the words are in the `.jsonc`;
   - anything else (an imported table, a computed key set) — unreadable.
3. Every call site in the fleet is `makeSymbolNormalizer({`, so brace-matching the argument object is exact.

**Implication.** The reader must be scoped to the brace-matched tier object and must resolve ONE level of
indirection (a named `const`, a manifest pair array), or ig/rw/rn/ab — four languages that demonstrably DO
have unit words — all read `[??]`, and the class loses most of its value on the very language that motivated
it. Resolving a named const is still reading the layer's own text, so it stays inside rule 2 (code evidence
is code, not text evidence).

## Run 2 — 2026-08-13, morning

**Question.** Does a corpus probe for "a unit abbreviation after a number" work fleet-wide, and which keys
does it get wrong?

**Command.** scratch `tsx` over `context(code).corpus` for all 117 registered codes, counting
`\p{Nd}\s?(km|kg|…|m|g|l|t|s|h|in|ft|mi)` and the Cyrillic equivalents.

**Raw finding.** 112 of 117 codes have at least one hit; the five with none (ur, pa, fa, cjy, hsn) include
`pa`, which *declares* units. And three keys are noise, each for a different reason:

- `s` — `1990s` is a decade, not four seconds (en s×4, tl s×6, crh s×25).
- `in` — the preposition, in every Latin-script language that has one (nci in×15, la in×13).
- `ft`/`mi`/`lb`/`oz` — imperial, and the Igbo audit already established that these occur almost only as a
  parenthetical gloss of a metric figure the sentence already gave (*"kilomita 115 (71 mi)"*), which a layer
  is right to leave unread.

**Implication.** The probe keeps the SI/metric and digital keys (including one-letter `m g l t`, which carry
the class outright in some corpora — qu m×60, gd m×40, ary m×20) and drops `s`, `h`, `in` and the imperial
set. `s`/`h` are dropped for the reason the tier itself gives for keeping one-letter denominators out of the
standalone alternation: a short key is confidently wrong more often than it is right. And since 5 languages
have no readable hit, `n/a` may only be reported when there is ALSO no declaration — otherwise pa's real
table would be reported as a class that does not apply.

## Run 3 — 2026-08-13, midday

**Question.** With the class written (scoped tier read + one level of indirection), what does the fleet say?

**Command.** scratch `tsx` calling `unitWords(context(code))` for every registered code.

**Raw finding.** `none` for **ten** languages: en ko as it bg ckb za my he syl. Reading all ten — which is the
step the `scale-names` rebuild insists on, because four of its intermediate versions each invented NEW wrong
verdicts — **nine of the ten were false**. Every one owns a unit table the tier never sees:

| language | shape the reader missed |
| --- | --- |
| bg, ug, bal, is | `const UNITS: [string, string][] = [["km", "километра"], …]` |
| my | `const UNITS: [RegExp, string][] = [[/km/giu, "ကီလိုမီတာ"], …]` |
| ckb, ja, ko, id | `const UNIT_WORD: Readonly<Record<string, string>> = { km: "کیلۆمەتر", … }` |
| en | its own `{ km: ["kilometer", "kilometers"] }`, older than the shared tier |
| za | `["km²", "bingzfueng goengleix"]` — the commonest noun in its corpus, ×162 |
| he | a `.replace` whose pattern is a TEMPLATE (`(?<![\p{L}\p{M}0-9.])(${NUM})\s?km³…`) |
| mos | `makeBareUnitNormalizer([["km", "kilometr"]])` — sourced at ×31 across 20 articles |

**Implication.** A false `NONE` rate of 9 in 10 is not a report, it is an accusation — and the accusation here
is "you left every measurement unread". The reader has to cover the four local shapes plus the bare-unit call's
own argument. Only `as` survived: Assamese writes `৩৫mm`, `২৪mm`, `৩৬mm` and has no unit word anywhere in its
layer. That is a 12th language in the state Igbo was in.

## Run 4 — 2026-08-13, midday

**Question.** Italian calls the shared tier and declares nineteen unit words. Why did it read `NONE`?

**Command.** `node -e` over `src/languages/italian/italian.ts`, applying `sources.ts`'s own `stripComments`
and printing `indexOf("magnitudes:")` before and after.

**Raw finding.** −1. `sources.ts` was stripping comments with two regexes, block comments FIRST and with no
notion of a line comment. Italian's currency note ends by naming two magnitude words in emphasis separated by a
slash — asterisk, slash, asterisk — which is a comment CLOSE and a comment OPEN **overlapping in three
characters**. The block-comment regex therefore opened a comment inside a `//` line and ran it to the next
close in the file, deleting `magnitudes`, `units`, `exponentWords` and everything else between.

⚠ Writing the fix's own header reproduced the bug a second time: quoting the offending sequence literally in a
JSDoc closed the JSDoc early and broke the parse. It is spelled out in words in the file for that reason.

**Implication.** Replaced with a scanner that recognises a line comment before a block comment can open inside
it and steps over strings and regex literals — the third time this file has had to stop guessing and parse
(`literals()` and the degree-arm reader are the other two). Measured across the fleet afterwards: **no
pre-existing class changed verdict for any language.** The bug was latent for percent, currency and
scale-names and fatal only for this class, which is luck, not safety — one line of ordinary technical writing
away from silently truncating any layer's source.

## Run 5 — 2026-08-13, afternoon

**Question.** Should attestation drive the verdict? First version: `have` = all declared words attested,
`partial` = some, `check` = none.

**Raw finding.** 79 of 108 layers came back amber, INCLUDING de — whose `Kilometer` occurs in its referee only
inside the compound *Kilometerzähler*, and whose FLEURS corpus is not present in this checkout at all. This
reproduces, at full fleet scale, exactly what `review.ts` already recorded as its reason for excluding units
from the sourcing gate: a unit borrowing is absent from every source in ~30 of the 66 languages it measured.

Two dead ends on the way there, both kept:
- Attesting EVERY declared form demanded that ru's three case forms and fr/es/pt's plurals each appear. The
  citation form (the first count form — the one the tier itself emits for a bare unit, "because a bare symbol
  is a citation, not a count") is the right unit of measurement; the rest is morphology.
- Substring attestation would have called *Kilometer* attested inside *Kilometerzähler*. Token-wise only, which
  is the Fula `tere` discipline.

**Implication.** A line that is amber for three quarters of the fleet teaches the reader to skim it, and the
`NONE`s below it are what would be lost. So the shortfall is reported as `partial` with the ratio, the names
and the caveat, and never as a defect verdict — while an `ok` still REQUIRES text evidence, because a
declaration cannot be its own attestation and an `ok` assembled from one is what would have waved the invented
Lao currency word through.

## Run 6 — 2026-08-13, afternoon

**Question.** Any remaining false greens?

**Raw finding.** Two, both caught by reading the words the tool printed rather than the verdict:
- `hmn` reported `[ ok ] … all attested: mˡ`. Hmong RPA writes ⟨ml⟩ as a digraph and its G2P maps
  `ml: "mˡ"` — a phoneme map pairs a two-letter key with a string exactly as a unit table pairs a word. Same
  family as the Guaraní `mb: "ᵐb"` and Tswana `kh: "k͡χʰ"` hits that made four languages with no layer at all
  report `[ ok ]`. Fixed by narrowing the local-table key set to what no orthography writes as a digraph
  (km kg cm mm and their Cyrillic forms), requiring TWO distinct keys, and rejecting any candidate carrying a
  modifier letter.
- An arm rewriting `km²` to `km²` yielded the ABBREVIATION as its own "word" — a green line for a language
  whose unit still reaches the sink raw. Rejected by identity against the abbreviation list.

**Implication.** Both are the `scale-names` lesson restated: availability is not correctness, and the detail
must print the WORD so a wrong one is visible even when the verdict reads right.

## Run 7 — 2026-08-13, afternoon (the value of the change)

**Question.** Would this class have caught the state the sweep fixed?

**Command.** `git archive efd43de~1 | tar -x` into a scratch tree, the NEW `sources.ts` copied over it, survey
re-run there (no refs created; the worktree is untouched).

**Raw finding.** Pre-sweep the class reports `NONE` for **ig** and **mos** — the two whose layers declared no
unit word at that commit — alongside `as`. Post-sweep, `ig` reads
`[ ok ] 4 unit word(s) in the local UNIT table, all attested: kilomita milimita sentimita kilogram` and `mos`
reads its bare-unit `kilometr`. The other nine languages of the sweep already declared words by that commit
and read `have`/`partial` both before and after, which is the correct answer for them.

**Fleet, at HEAD, over the 121 registered codes with a `normalize.ts`:**

| verdict | count | languages |
| --- | --- | --- |
| `NONE` — no unit word at all | **1** | as |
| `part` — declared, NOTHING attests them | **24** | en es ar arz apc acm afb ary ayl ajp acw de ff ms pnb ro te om pcm uz bg is nan he |
| `part` — declared, some attested | 65 | (the bulk of the fleet) |
| `ok` — declared, all attested | 26 | mg vi sl kmr bn pa tl pl hsn gan jv mk ab bar cdo hmn za nb yo ig my rw mad km mos rn |
| `[??]` — declared, nothing COULD attest | 4 | apd zsm pbt bgc |
| `·` — no abbreviation, none declared | 1 | syl |

The four `[??]`s are the sister standards (Sudanese/Levantine Arabic, Standard Malay, Southern Pashto,
Haryanvi): they share a layer with a parent that declares units, and have no corpus, referee or espeak
dictionary of their own. Nothing could attest those words, so reporting them unattested would be an assertion
about evidence nobody has. ⚠ `review.ts` solves this with `SISTER_STANDARDS`; adopting the same map here would
resolve all four, and is the obvious next improvement — not taken now because it lives in `review.ts`, which
is a CLI, and importing it is the "CLI runs on import" hazard this directory has hit four times.

`syl`'s `·` is a settled refusal preserved: its layer states `units` and `rate` are both ×0 in its artifact,
and the only two hits the probe found were `(Γ00l)` and `l99l` — a Latin ⟨l⟩ standing in for the digit ONE in a
transliterated date. One-letter keys are now required to be SPACED from their number for that reason.

## Run 8 — 2026-08-13, afternoon (gates)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 242 files, 3894 passed, 5 skipped.
- `sources.ts --lang` before/after: `ig` gains `[ ok ]` (was no row at all); `de`/`es` gain `[part]` naming
  every unattested word; `za`/`mg` gain `[ ok ]` and are NOT reported as defects; `as` gains the one `[NONE]`;
  `apd` gains a `[??]`. `--all` diffed column-by-column against the baseline: **no other class changed for any
  language**, so the only delta is the new column.
- `review.ts --lang ig` and `--lang de` — unchanged by this work (ig's pre-existing `artifact scan` failure and
  de's `Yen` sourcing prompt both predate it).

**The reconciliation invariants.** A units row needs no change to either of them, and that is the point rather
than a workaround. `normalization-sources.test.ts` reconciles ONE WAY — every `DROPPABLE` class must have a
source row or a declared exemption — and `review.ts:604` asserts every `DROPPABLE` class maps to a probe. A
unit is LETTERS, not a sign: `km` is not droppable typography, it is a token the reader must be given a word
for, so `units` is not in `DROPPABLE`, needs no probe, and must NOT be added to `SOURCES_EXEMPT` — whose own
test asserts that every exemption names a real `DROPPABLE` class, and would fail. A source row with no sign
behind it is exactly what the one-way direction leaves room for. A test now pins all three facts together so
the next reader does not "complete" the relationship by adding an exemption that cannot exist.
