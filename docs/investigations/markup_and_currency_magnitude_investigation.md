# Markup residue in the mining pipeline, and the magnitude-vs-unit question in the currency path

Two independent items, one per section. Item 1 is a pipeline defect with a fleet-wide blast radius; item 2
is an open reading question whose answer may well be "not separable — leave it".

---

# Item 1 — `.mw-parser-output` CSS reaches the corpus and the IPA

## Run 1 — 2026-08-13 19:45 — where does the CSS actually enter?

**Question.** The long-tail run reported `nya mw` ×2 and `ln mw` as raw-Latin leaks, and `ht` reported `mw`
as an *attested Haitian word* — 76 token hits across 14 articles. Are these one finding or three?

**Command.** Read `tools/normalization/filter-markup.py`, `wikidump-to-text.py` (`RE_MARKUP_RESIDUE`,
`RE_WIKI_ERROR`), `mine.ts` (`extracts()`) and `attest.ts`; grep the committed artifacts.

**Raw finding.** One block, three reports:

```
.mw-parser-output .reflist{margin-bottom:0.5em;list-style-type:decimal}@media screen{.mw-parser-output
.reflist{font-size:90%}}.mw-parser-output .reflist-columns-2{column-width:30em}…
```

It is TemplateStyles output. `<templatestyles src="Template:Reflist/styles.css">` names a stylesheet
subpage; whatever expands it emits the **declaration blocks inline**, and a plaintext renderer has no reason
to treat them as anything but a paragraph of text.

⚠ **The route is the API, not the dump — the same asymmetry `RE_WIKI_ERROR` already documents.** A dump
carries the unexpanded `<templatestyles …>` tag, which `RE_TAG` deletes. `explaintext` *expands* it and
inherits whatever it emits. `mine.ts extracts()` already carries `WIKI_ERROR` and `PERSONAL` guards for
exactly that reason and had nothing for this; `attest.ts` shares the route and had nothing at all.

⚠ **The cell selectors prefer CSS to prose**, which is why so few instances did so much damage. CSS is dense
in what they hunt: `font-size:90%` is the `percent` cell, `0.5em` / `22.5em` is `version-dot` and `decimals`,
`reflist-columns-2` is `digit-run`. Same disproportion the file header already records for LaTeX and for one
vandalized Awadhi page.

**Implication.** Fix on all three routes (the two guards cannot import across the Python/TypeScript line, so
the pattern is stated three times, deliberately and with cross-references). Then measure before touching any
artifact.

## Run 2 — 2026-08-13 19:52 — blast radius across all 162 committed artifacts

**Question.** How many lines does a CSS guard remove, and does it touch prose?

**Command.** A scratch script over `tools/corpus/mined/*.jsonc` (162 files), applying the candidate pattern
to `hard[].text` + `sample[]` — ≈50,000 retained lines — and, for comparison, the *existing*
`RE_MARKUP_RESIDUE` / `RE_FILE` / `RE_MEDIA` / `RE_PERSONAL` guards.

**Raw finding.**

| lang | hard | sample | CSS lines | already caught by existing guards |
|------|------|--------|-----------|-----------------------------------|
| ki   | 172  | 200    | **3**     | 0 |
| nya  | 224  | 200    | **2**     | 0 |
| ln   | 216  | 200    | **1**     | 0 |
| lg   | 248  | 200    | **1**     | 0 |
| st   | 236  | 200    | **1**     | 0 |
| cjy  | 13   | 36     | 1 (`{| style="border-spacing:0px; …"`) | **yes** — the table-opener alternation |

**8 lines in 5 artifacts, plus 1 in cjy that the existing table guard already condemns. Zero prose false
positives across all 162 artifacts.** The three lines that name CSS *in prose* — nya ×2 ("masamba otchedwa
CSS…"), tk ×1 — are correctly kept: the brace in `\{[^{}]*prop:` is what separates a stylesheet from a
sentence about stylesheets.

**Implication.** The guard is safe. The pattern is three alternations, because the block is recognisable
three ways and a rule can arrive without its wrapper class: `mw-parser-output`; `@media screen|print|all|only`;
and a declaration block naming a CSS property, brace required.

## Run 3 — 2026-08-13 19:56 — is the same route leaking other residue? (`php`, `html`, `px`, `nbsp`, `pdf`)

**Question.** The raw-Latin findings also list `php`, `html`, `px`, `nbsp`, `pdf`. Same pipeline gap?

**Command.** Word-boundary counts for `php html px nbsp pdf css xml svg jsp cgi aspx` over all artifacts,
each hit classified by whether a URL / file-link appears in its ±80-character window.

**Raw finding — mostly NEGATIVE, and that is the useful part.**

| token | occurrences | languages | inside a URL/file-link | **prose** |
|-------|------------|-----------|------------------------|-----------|
| `pdf`  | 50   | 33 | 3 | **47** |
| `html` | 24   | 12 | 1 | **23** |
| `php`  | 19   | 13 | 3 | **16** |
| `svg`  | 4    | 1  | — | 4 |
| `xml`  | 5    | 4  | — | 5 |
| `css`  | 3    | 2  | — | 3 |
| `px`   | 1    | 1  | — | 1 (a Lao codename, "ໂຄງການ PX") |
| `nbsp` | **2312** | **76** | — | — (HTML entity) |

⚠ These are **wiki articles about the web**: Faroese and Igbo explaining that MediaWiki is written in PHP,
Latgalian on HTML 4.01, Sinhala on the SVG specification, Aragonese listing e-book formats. A word-level
guard on them would delete real sentences to remove three URLs. **Measured and declined**; the decision is
pinned as a `--self-test` fixture so it cannot be quietly reversed.

⚠ `nbsp` is a **different, already-known, out-of-scope defect**: the HTML entity, 2,312 instances in 76
artifacts, matching the "94 of 154 artifacts carry entities, 2,653 occurrences" figure recorded when
`filter-markup.py` gained `decode_entities`. The converter was fixed then; the committed artifacts were
never re-run through the filter. **Not touched here**, because decoding 2,312 entities across 76 artifacts
would move counts in a great many recorded refusals (ki's `ampersand` note counts its own `&nbsp;` ×16), and
that is a fleet operation with its own blast radius, not a side effect of this one.

**Implication.** The CSS is the only member of the raw-Latin long tail that is genuinely a pipeline gap.
`px` was already guarded (`\d{2,4}\s*px`, including the `55x55px` case).

## Run 4 — 2026-08-13 20:02 — the fix, and exactly what moves in each artifact

**Question.** Can the artifacts be repaired without re-mining, and what does the repair move?

**Command.** Guard added on all three routes; the 8 lines deleted from the 5 artifacts (a **deletion**, which
is exact — never a re-mine, which resamples); then per-artifact deltas recomputed.

**Raw finding.**

| lang | hard | cells affected | `=` | `%` | `.` | cellsCovered |
|------|------|----------------|-----|-----|-----|--------------|
| ki   | 172→169 | percent 8→6, version-dot 3→2 | 7→**2** | 24→20 | 886→794 | 30 (unchanged) |
| nya  | 224→222 | version-dot 3→1 | 14→**9** | 41→39 | 1476→1411 | 31 (unchanged) |
| lg   | 248→247 | version-dot 8→7 | 19 (unchanged) | 63→61 | 1360→1331 | 31 (unchanged) |
| st   | 236→235 | version-dot 8→7 | 14 (unchanged) | 57→55 | 1253→1224 | 31 (unchanged) |
| ln   | 216→215 | **version-dot 1→0** | 16 (unchanged) | 48→46 | 842→813 | **30→29** |

⚠ **ln's ONLY `version-dot` example was the CSS block.** The cell read as covered on a `0.5em` in a
stylesheet. That is a correction, not a loss — there is no evidence in this artifact that Lingala writes a
version dot at all, and `cellsCovered` is now 29. (`cellsCovered` is written by `mine.ts` and read by
nothing, so hand-correcting it is safe; it is corrected anyway, because a wrong number in a committed
artifact is how the next reader gets misled.)

⚠ **Two `defects.ts` refusals quoted the CSS in their measured counts, and both were restated rather than
left to drift** — deleting evidence *for* a refusal is the direction that can invalidate one:

- `nya.equals`: *"all 14 `=` … 9 EasyTimeline directives and 5 CSS declarations"* → **all 9 `=` are
  EasyTimeline directives**. Same verdict, smaller n; still zero Chichewa arithmetic.
- `ki.equals`: *"`=` ×7 … two chess records and five CSS attribute selectors"* → **`=` ×2, both chess
  records**. Same verdict, smaller n.

The two counts reconcile *exactly* with the measured CSS contribution (nya 5, ki 5), which is independent
confirmation that both refusals had already read these lines correctly as markup — they simply counted
markup that should never have been in the haystack.

⚠ **`counts` in each artifact is a whole-corpus figure and was NOT recomputed.** Recomputing means re-mining,
which resamples every tier — moving every figure quoted from these files elsewhere, to correct a handful of
instances in five-digit totals. Each of the 5 artifacts carries an errata comment saying so.

**Implication.** No artifact needs regeneration. Nothing outside these 5 artifacts, `ht.jsonc` (below) and
2 `defects.ts` strings moved.

## Run 5 — 2026-08-13 20:05 — `ht`'s `mw`: the attestation probe's own false positive

**Question.** `ht` reported `mw` **attested**, 76 token hits / 14 articles / 0 substring-only — the strongest
verdict `attest.ts` can issue. Why did no column catch it?

**Raw finding.** All six recorded examples are the stylesheet. And **no column of that artifact could have
flagged it**: `substringOnly` is the designed defence against a word that merely *looks* sourced, and
`.mw-parser-output` puts a `.` before the letters and a `-` after — both word boundaries — so `mw` genuinely
*is* a token, 76 times. `articles: 14` looked like the multi-source corroboration the file header calls the
difference between a lead and a finding; it is just the number of ht articles carrying a reference list.

⚠ **And it was not inert.** `review.ts` folds the *example prose* of every `attested` finding into the
sourcing haystack, so this entry was putting a MediaWiki stylesheet into the evidence base against which
Haitian words are declared attested.

⚠ **The guard had to move before the whitespace collapse.** Both `attest.ts` call sites opened with
`String(p.extract).replace(/\s+/gu," ")`, which destroys the paragraph boundary the guard needs: after it,
the CSS and the article's prose are one string with no seam to cut at, and the only options left are keeping
the CSS or discarding a real article whole. Splitting first makes it the same **line-level discard** every
other stage performs — the stylesheet is its own paragraph in a plaintext extract, which is exactly why it
became one line of a mined artifact.

The finding is **deleted with errata** rather than re-probed: re-running would resample the search, and the
finding is known-void from its own examples. The corrected verdict is *not asserted*, because it has not
been run.

⚠ Note: `ht`'s **mined** artifact also carries one `mw`, and it is **not** this defect — `MN:Madanm ou te gen
yon pwoblèm…` is a transcript speaker label. Separate, still open, out of scope.

## Run 6 — 2026-08-13 20:07 — gates

**Command.** `filter-markup.py --self-test`; `npx tsc --noEmit`; `npx vitest run`; `mine.ts scan` before
(against `git show HEAD:` copies) and after, on all 5 affected languages plus ht.

**Raw finding.**

- `filter-markup.py --self-test`: **13/13** (was 9/9; 4 fixtures added — the CSS block, its skin-scoped half
  with no leading `.mw-parser-output`, prose *about* CSS, prose about PHP).
- `npx tsc --noEmit`: clean.
- `npx vitest run`: **242 files, 4008 passed, 5 skipped, 0 failed.** No golden changed.
- `mine.ts scan`, `LEAK RAW-LATIN mw`:

| lang | before | after |
|------|--------|-------|
| nya  | ×2 | **0** |
| ki   | ×3 | **0** |
| ln   | ×1 | **0** |
| lg   | ×1 | **0** |
| st   | ×1 | **0** |
| ht   | ×1 (`MN:Madanm…`, unrelated) | ×1 (unchanged, correctly) |

  Every other class in every scan is byte-identical before and after — the deletion removed exactly the CSS
  and nothing else. ln's `DROP minus ×6` (its genuine negatives, which `defects.ts` deliberately does not
  exempt) is untouched.

**Implication.** Item 1 is closed. The finding was one pipeline gap, as the `ht` agent read it, and it is
now guarded on all three routes that can produce it.

---

# Item 2 — the magnitude-vs-unit question in the CURRENCY path

## Run 7 — 2026-08-13 20:10 — reproduce, and confirm the `NOT_VERSION` run's conclusion

**Question.** `$1.5m` reads as `dˈɑːlɚzəm`. Is that a version-guard problem?

**Command.** `phonemize` on `$1.5m`, `£2.3m`, `a $1.5m grant`, `$2bn`, `£5k`, `US$1.5m` in `en`.

**Raw finding.** All leak the suffix — `wˈʌn pʰɔᶦnt fˈaᶦv dˈɑːlɚzəm`, `tʰˈuː dˈɑːlɚzbn`, `fˈaᶦv pʰˈɔːəndsk`.
`$1.5 million` is correct, so the *spelled* magnitude already hops the currency.

The `NOT_VERSION` run was right and its reason is visible in the code: **English does not use the shared
symbol tier at all** (`english/normalize.ts` header), and its own step 1 currency rule runs before anything
else and **consumes the number**. `NOT_VERSION` guards the UNIT rule, which by then has nothing left to
match. The question lives in the currency path, exactly as reported.

**Implication.** Any fix must go into the currency rule itself, not into a guard downstream of it.

## Run 8 — 2026-08-13 20:14 — how widely does the shape occur, and is it separable from the unit?

**Command.** Scan all 162 mined artifacts for `CURRENCY-SIGN + digits + glued letters`, and separately for
bare `digits + m` with no sign.

**Raw finding — the two populations do not overlap.**

| shape | occurrences | artifacts |
|-------|-------------|-----------|
| currency sign + digits + **glued** abbreviation | **43** | 15 |
| bare digits + `m`, no sign | **1,327** | 110 |

Every one of the 43 is a magnitude, read individually with context. The 1,327 are overwhelmingly metres —
mountain heights, athletics distances, building dimensions. ⚠ **The same language writes both**: `gd` has
`£1.5m`, `£216m`, `£8m` *and* 38 bare `1,018m` / `1.2m` summit heights; `sn` has 30 bare `1.2m`. The
currency sign is the only thing separating them, and there is no counterexample in either direction — you
cannot have five dollars *metres*.

⚠ **AND THE DISCRIMINATOR IS NOT NEW. Three engines in this tree reached it independently before this run.**

- `akan/normalize.ts` — its unit table carries a currency lookbehind: *"a one-letter `m` after a money
  amount is the magnitude, not the metre. `US$ 1m`, `€2.5m`, `£2.19m`, `US$100m` — 5 instances across the
  two dumps, and the rule as first written read all five as* mita *… A currency sign in front is the
  discriminator."*
- `sinhala/normalize.ts` — spends `US$100m` as the magnitude, having first shipped it as *ඩොලර් මීටර් 100*.
- `naija/normalize.ts` — expands a glued ⟨bn⟩ and **refuses ⟨m⟩**, because it has no currency guard to lean
  on and its own corpus writes `di 100 mita race`.

**Implication.** The reading is decided, on three prior independent measurements plus this one: **with a
currency sign the magnitude wins; without one the unit wins.** The remaining question is where a fix is
possible, not what the answer is.

## Run 9 — 2026-08-13 20:16 — the SPACED form: a measured refusal

**Question.** `$60 m`, `£83.037 mln` — does the same rule extend to the spaced form?

**Command.** The same fleet scan with `\s+` before the abbreviation, run twice: once with an **ASCII** letter
boundary and once with a **Unicode** one.

**Raw finding — NO, and this is the sharpest negative in this investigation.**

| boundary | hits |
|----------|------|
| `[A-Za-z]` (ASCII) | **15** |
| `\p{L}` (Unicode)  | **3** |

The twelve that vanish were never magnitudes. In each, the `m` is **the first letter of the next word**, and
the next word is usually the language's own spelled-out magnitude:

```
kmr   $ 125 m…      →  $ 125 mîlyon          yo   $500 m…    →  $500 mílíọ̀nù
hak   $600 M…       →  $600 Mî-ngièn         et   $50, m…    →  $50, mängija A panustab
mi    $22,500 m…    →  $22,500 mō            gn   $65.000 k… →  $65.000 kóva
```

⚠ **`[a-z]` cannot see a boundary before `î`, `í` or `ä`.** That is the ASCII-`\b` trap this repo already
records for the initialism pass and for `mine.ts`'s `\d`, arriving in a new place — and it is *specifically*
dangerous here, because the word it collides with is the very word the rule would be claiming to supply.

A rule worth 3 real instances that manufactures 12 confidently wrong readings is not worth having.
**Spaced form declined**, pinned as a test.

## Run 10 — 2026-08-13 20:20 — the fix for `en`, and 0/140 corpus movement

**Command.** Extend `english/normalize.ts` step 1 (currency) so the optional magnitude group accepts a
**glued** abbreviation as well as a spelled word; map ⟨m/M⟩→million, ⟨bn/BN/Bn/B⟩→billion, ⟨k/K⟩→thousand.
Then `corpus-diff.ts emit`/`compare` on en, plus pcm, de, es and fr (unchanged).

**Raw finding.**

```
$1.5m         → wˈʌn pʰɔᶦnt fˈaᶦv mˈɪɫjən dˈɑːlɚz      (was: … dˈɑːlɚzəm)
a $1.5m grant → ə wˈʌn pʰɔᶦnt fˈaᶦv mˈɪɫjən dˈɑːlɚz ɡɹˈænt
$2bn          → tʰˈuː bˈɪɫjən dˈɑːlɚz                  £5k → fˈaᶦv θˈaᶷzənd pʰˈaᶷndz
he ran 100m   → … wˈʌn hˈʌndɹəd mˈiːt̬ɚz               a 5m drop → … mˈiːt̬ɚz     (unchanged)
```

⚠ **A BOUNDARY-GUARD PLACEMENT BUG WAS FOUND AND FIXED IN PASSING, and it made the rule worse than the leak.**
With `(?![\p{L}\p{M}\d])` after the *whole* optional group, an unmatched abbreviation still has to satisfy
it — so on `$2.5tn` the engine **backtracks the number** to `$2` (the `.` passes the lookahead) and reads
*two dollars* with `.5tn` stranded. Moving the guard inside the abbreviation arm restores the old behaviour
when nothing matches. Pinned.

⚠ **corpus-diff: `en` changed 0/140 (0.0%). Every leak class 0 before and 0 after.** So does pcm (0/429),
de (0/117), es (0/115), fr (0/107). `mine.ts scan --lang en`: **no defects**, before and after.

⚠ **That zero is the honest headline, and it is stated rather than buried.** English's mined artifact
contains **no instance of the shape at all** — 0 glued, 0 spaced; what it writes is `$2.3 billion`,
`$45 million`, `US$14.7 billion` spelled out, and its three bare `NUMBER+m` (`1,854 m`, `420 m`, `4892 m`)
are metres. So this is a **robustness rule, not a corpus repair**, and it is admissible on the same ground
`bavarian/normalize.ts` states for its `±`: it composes nothing new. "million", "billion" and "thousand" are
already the words step 1 hops with when the text spells them; the abbreviation is simply allowed to reach
the reading the spelled form already gets. The corpus gate says nothing either way, so it is not cited as if
it did.

⚠ **⟨tn⟩ and bare lowercase ⟨b⟩ are LEFT OUT** — both ×0 across the fleet, the same count on which naija
declined ⟨tn⟩. `$2.5tn` still leaks, deliberately, and is pinned so the leak is a decision and not an
oversight.

## Run 11 — 2026-08-13 20:24 — the other 14 languages: refused, with counts

**Question.** 43 instances sit in 15 artifacts. Does the fix generalise?

**Command.** For each of the 15, phonemize the figure **with and without** the abbreviation, to separate
"the magnitude leaks" from "the currency itself is missing".

**Raw finding — NO, and for two different reasons, neither of which is the magnitude question.**

| lang | n | bare figure reads the currency? | with abbreviation |
|------|---|--------------------------------|-------------------|
| tn  | 10 | **no** — `$1.2` → *bʊŋwɪ . bʊbɪdi* | `bn` leaks |
| lg  | 5 | **no** | `k` leaks |
| gd  | 4 | **no** | `m` leaks |
| kaa | 3 | **no** | `mln` leaks |
| nso | 3 | **no** | `bn` leaks |
| st  | 3 | **no** | `m` leaks |
| bm  | 2 | **no** | `mln` leaks |
| sq  | 2 | **no** | `m` leaks |
| et  | 1 | **no** | `m` leaks |
| haw | 1 | **no** | `m` leaks |
| tl  | 3 | yes — *…doljˈaɾ* | `bn` leaks (`dˈoljaɾbn`) |
| ak  | 2 | yes — *dɔla …* | `B` leaks |
| my  | 2 | yes — *…dɔ˨la˨* | `m` leaks (*ˈɛm*) |
| pcm | 1 | yes | **already correct** — *tu biljan dola* |
| si  | 1 | yes | **already correct** — *ඩොලර් මිලියන* |

⚠ **In TEN of the fifteen the currency sign is dropped at the bare figure already.** `$1.2` in Tswana is
"one point two" and nothing else — there is no currency noun declared, so **there is no word for a magnitude
to hop**. The magnitude question does not arise there; a prior and larger defect does, and it is a
per-language bring-up with its own sourcing (the currency noun, attested, sense-checked) — precisely the
work `attest.ts` exists for.

⚠ **In the remaining three (tl, ak, my) the sign reads and only the abbreviation leaks — and that is still
not a fix I can make here.** Expanding ⟨bn⟩ for Tagalog means asserting that Tagalog reads it as *its own*
billion word, and this text is English press copy quoted verbatim in a Tagalog wiki. That is the same
unsupported preference `sn` refused when both magnitude orders were attested and `nya` had to withdraw when
its corpus turned out to write NOUN+NUMBER+MAGNITUDE with the digits retained. One instance count is not a
register.

⚠ **And the abbreviations are not even a single convention.** ⟨mln⟩ (kaa, bm, lt) is the Slavic/Baltic form,
⟨bn⟩ and ⟨m⟩ the anglophone one, ⟨B⟩/⟨M⟩ the capitalised financial one. A rule that reads all of them as
English magnitudes in fifteen languages is a rule about English financial journalism filed under fifteen
other languages.

**MEASURED REFUSAL: 14 of 15 languages unchanged, with the counts above.** `en` is changed because it is the
one language where the abbreviation is unambiguously its own orthography and the magnitude words are already
shipped. What is genuinely established and now written down for whoever takes the next one: **the currency
sign is the discriminator, it is reliable at 43:1,327 with no counterexample, the glued form is separable
and the spaced form is not.**

## Run 12 — 2026-08-13 20:28 — gates

**Command.** `npx tsc --noEmit`; `npx vitest run`; `corpus-diff emit`/`compare` on en + pcm/de/es/fr;
`mine.ts scan` on en and pcm.

**Raw finding.** tsc clean. **242 files, 4009 passed, 5 skipped, 0 failed** (one test added; 4008 → 4009).
**No golden changed** — no existing expected value moved in either item. corpus-diff 0.0% on all five
languages. `mine.ts scan --lang en`: no defects; `--lang pcm`: identical to before (pcm untouched).

**Implication.** Item 2 is closed: the reading is decided and recorded, `en` is fixed, and the other
fourteen are refused with the counts that make the refusal checkable.
