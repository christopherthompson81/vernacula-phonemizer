# Raw-ASCII-Latin long tail — 21 languages with a normalization layer, 1–4 hits each

The `LEAK RAW-LATIN` class (`defects.ts` → `rawLatinIn`) reports a vowelless ASCII run that the source
typed and the IPA still says byte-for-byte. This batch is the tail of that class: 21 languages that all
HAVE a normalization layer and each report between one and four runs. The premise going in is that at
this count the deliverable is a **recorded classification per hit**, not a repair per language — a hit
left reported with a read reason is a complete result, and silencing a real defect to move a counter is
not.

## Run 1 — 2026-08-13 09:10 (read every hit, on the same line set the gate reads)

**Command.**

```
npx tsx probe-detail.scratch.mts ceb hil nya ln mag wuu bpy he mi ug af bar ff gan ha hi hu km mai ro si
```

**Question.** The brief's counts come from a probe that reads only the artifact's `hard` tier. What is
the real hit set — `hard` + `sample`, i.e. the exact lines `mine.ts scan` walks — and what is each hit?

**Why a local probe rather than 21 `mine.ts scan` runs.** `scan` prints one example per class and a
count; this class needs EVERY instance's full sentence, because the whole question is what the run is.
The probe calls the same `rawLatinIn` and the same `allOccurrencesInMarkup` on the same
`[...doc.hard, ...doc.sample]` line list, so its count is the scan's count. (`mine.ts scan` is still
what the gate quotes below — see Run 8.)

**Raw finding — the hard-tier probe under-reports in six of the 21.**

| lang | brief (hard only) | hard+sample | runs seen |
|---|---|---|---|
| ceb | 4 | 4 | th ×2, mph ×2 |
| hil | 4 | 4 | sg ×4 |
| nya | 4 | 5 | ft ×2, pm ×1, mw ×2 |
| ln  | 3 | 5 | php, pg, mw, pslf, pp |
| mag | 3 | 3 | nm, mv, dv |
| wuu | 3 | 4 | nd ×2, kg, sg |
| bpy | 2 | 2 | nd, sv |
| he  | 2 | 2 | nd, mt |
| mi  | 2 | 2 | pm ×2 |
| ug  | 2 | 2 | kg, skt |
| af  | 1 | 1 | mnr |
| bar | 1 | 2 | km, kn |
| ff  | 1 | 2 | tv, mph |
| gan | 1 | 1 | kg |
| ha  | 1 | 2 | km, rr |
| hi  | 1 | 1 | nd |
| hu  | 1 | 1 | mp |
| km  | 1 | 1 | bd — flagged MARKUP by the same helper the scan uses, so it is a NOTE, not a defect |
| mai | 1 | 1 | nd |
| ro  | 1 | 1 | mph |
| si  | 1 | 1 | kg |

**Implication.** Six languages carry a hit the brief could not see, and two of the six (bar `kn`,
ha `rr`) are shapes nothing in the brief predicted. Read every one before touching any layer.

## Run 2 — 2026-08-13 09:55 (classify all 44 hits; the six units read one at a time)

**Question.** For each hit: is the run a genuine unit/abbreviation of THIS language, foreign residue,
markup residue, or an artefact of the detector? And where it is genuine, WHY did a mature layer that
already declares the key still report?

**Method.** Each candidate was put to the engine directly (`say.scratch.mts`, gitignored) beside a
minimal control, so the cause is measured rather than inferred from the unit table.

### The recurring `kg` and `km` — SIX languages, SIX DIFFERENT CAUSES

The brief warns that the same abbreviation may have different causes in different languages. It has
six, and not one of them is a missing key.

| lang | run | control | cause |
|---|---|---|---|
| ug  | `1-1.5kgغىچە` → `… kɡ ʁit͡ʃɛ` | `1.5 kg` → `… kiloɡrɑm` ✓ | **A BOUND CASE SUFFIX GLUED TO THE KEY.** `kg` IS declared. The unit arm's right guard is `(?![\p{L}…])` and `غ` is a letter, so the arm declines the whole match. ug's own file already solves this exact shape for `%` (`PCT_SUFFIX`) and had not carried it to units. |
| gan | `10⁻²⁷ kg` → `sɨt̚˨ kɡ` | `10 kg` ✓, `10-27 kg` ✓ | **A SUPERSCRIPT RUN BETWEEN THE NUMBER AND THE UNIT.** `kg` is declared and `exponentWords` is declared, but neither covers an exponent on a BARE base: `bareExponent` is absent, `⁻²⁷` is not folded, and it sits between `10` and `kg`, destroying the adjacency the tier matches on. The ASCII spelling of the same figure reads correctly. |
| si  | `1.9 kg/m3` → `… kɡ ˈɛm t̪ˈunə` | `1.9 kg` → `kˈiloːɡræːm …` ✓ | **A RATE DECLINED WHOLE.** `kg` is declared; `unitPer` is deliberately NOT (si's denominator takes a dative suffix and LEADS the phrase, which one invariant string cannot express — the file says so and handles `km/h` and `m/s` locally instead). With no rate arm the `/` fails the unit guard and the numerator is left raw with the denominator. The `mg` shape from the brief, in the language that documented why. |
| wuu | `kg·m·s −2` → `kɡ ˈɛm ˈɛs …` | `5 kg` ✓ | **NO NUMERAL AT ALL.** A bare SI citation in the definition of the newton. `kg` is declared and the counted arm needs a number; the standalone arm (`makeBareUnitNormalizer`) is switched OFF for `unspacedScript` languages by design, because "standalone" is not a thing a pattern can see there. |
| bar | `3,2 Eihwohna/km²` → `… ɑɛ̯ʋonɐ km` | `5 km²` → `fimf kvɑd̥rɑd̥ɡ̥ilomed̥ɐ` ✓ | **A RATE WHOSE NUMERATOR IS A COMMON NOUN.** Population density. `km` and `Quadrat`/`Kubik` are all declared and compose correctly after a numeral; here the numeral belongs to *Eihwohna*, so nothing is adjacent to `km²`. The standalone path cannot rescue it either — its guards exclude a key preceded by `/` and a key followed by `²`, both deliberately. |
| ha  | `nisan km 2-3` → `… km bˈi˥ju˥ …` | `5 km` ✓ | **THE UNIT PRECEDES THE NUMERAL, AND THAT IS HAUSA'S OWN ORDER.** Not a typo: the same artifact writes the SPELLED-OUT noun in the same order five times — `kilomita 1`, `kilomita 7` ×2, `kilomita 2` ×2 — against `km 2` ×1. The tier fires only after a numeral. |

⚠ **`bar`'s hit is NOT the ak exponent refusal it looks like.** ak refuses `km²` on purpose because no
Akan square word is attested; bar attests and declares one, and `5 km²` reads. Same run, same class,
opposite diagnosis — read the control before quoting the precedent.

### The rest, by class

**Genuine abbreviations of the language (4 — all repaired, see Runs 4–7):**
`hil sg` ×4 (the shorthand for the genitive particle *sang*), `af mnr` (*meneer*),
`hu mp` (*másodperc*), `mag nm` (nanometre, via the Hindi tier — see Run 3).

**Genuine unit, no sourced reading — DECLINED (2):**
- `ln pg` — `120–180 picomol/L (170–250 pg/mL)`, a serum-B12 reference range. A picogram is real, but
  Lingala's unit table is local and hand-sourced (`kilogálame`, `kilomɛtrɛ`); a *pikogálame* would be
  coined here and nowhere else. Trap 37. Left reported.
- `ug skt` — `120km/skt`, in context unmistakably *sékunt*. `attest.ts --lang ug` settles it and settles
  it AGAINST: `سېكۇنت` 39 tokens / 15 articles **attested**, `skt` **0 tokens / 1 substring-only**. The
  WORD is Uyghur; this LATIN ABBREVIATION OF IT is one writer's, not the language's. Left reported.
  ⚠ This is the run I would have "fixed" from the unit table alone; the probe is what stopped it.

**English / web residue in a non-English sentence (13):** `ceb th` ×2 (`ika-18th`, `11th Hussars`),
`ceb mph` ×2 and `ro mph`, `ff mph` (all inside a parenthetical `35-40 mph (56-64 km/h)` conversion —
the same sentence, translated, in three unrelated languages), `nya ft` ×2 (`4 ft 11 in`, `5,604 ft`),
`nya pm` (in a run of untranslated English), `mi pm` ×2 (`11:35 pm`, `10:00-11:00 pm MDT`),
`he nd` / `bpy nd` / `mai nd` (`2nd Duke`, `2nd edn` — English inside a citation or a gloss),
`ln pp` (`pp. 236 - 274`, a French bibliography).

**Wiki markup / URL residue that `filter-markup.py` did not strip (5):** `nya mw` ×2 and `ln mw` — the
same `.mw-parser-output .reflist{…}` CSS block, in two unrelated artifacts; `ln php` (a geohack
`geohack.php?pagename=…` URL); `bpy sv` (`sv:Alfabetisk …`, an interwiki prefix); `hi nd` (inside the
URL of a bracketed external link, `…gharwali-and-kumaon-bhasha-diwas…-1st-and-2nd-september`).
`km bd` is the same family and is the one the scan already classifies for itself — it is inside
`\,(a + bi)(c + di) = … + bd i^2`, and `allOccurrencesInMarkup` marks it `ACCEPTED-MARKUP`, so **km
reports no raw-Latin defect at all.**

**Detector artefacts — the run is not a run (3):**
- `he mt` — the source is `sḏm ḥmt`, transliterated Egyptian. `RAW_LATIN_RUN` is `[A-Za-z]+`, and
  `ḥ` (U+1E25) is not in it, so the scanner's "run" is the tail `mt` of a word whose head it cannot see.
  The engine is echoing the transliteration, which is the correct treatment of a cited foreign form.
- `bar kn` — the source is `kraun­kn`, i.e. *kraunkn* with a SOFT HYPHEN (U+00AD) inside it, from a
  hyphenated-list dump. Same mechanism: the run is the fragment after an invisible character.
- `wuu sg` — inside `-{zh-cn:0814; zh-hant:814; zh-sg:814;}-`, a MediaWiki language-conversion marker.
  `zh-sg` is the Singapore variant tag, not a word.

**A metalinguistic letter citation (1):** `ha rr` — `tabbatar da furta r da rr daban` ("be sure to
pronounce r and rr differently"), from the article on Hausa orthography. The engine echoes both the `r`
and the `rr`; `r` has a vowel-test pass and only `rr` reports. Reading a cited digraph as itself is
defensible and no unit rule is involved.

**Formula variables (2):** `mag mv` / `dv` — `जन्ने राशी mv के कण संवेग` and `a = dv/dt`, Newton's second
law. Italic single-letter physics variables copied into running text. Not units, and no language reads
them as words.

**Implication.** Two repairs are sourced and land in a shared tier (Run 3), four in a single language
each (Runs 4–7). Twenty-eight hits are correctly reported and stay reported. Two genuine units are
declined on measured evidence, one of them against my own first reading.

## Run 3 — 2026-08-13 10:30 (attestation, and the one it stopped)

**Question.** Four runs look like genuine abbreviations of their language. Is each one actually the
language's, in the sense the slot needs?

**Commands** (`attest.ts`, default `--limit`, cache written to `tools/corpus/attest/<lang>.jsonc`):

```
attest.ts --lang af --words meneer,mevrou      attest.ts --lang af --words mnr,mev
attest.ts --lang hu --words másodperc,perc     attest.ts --lang hu --words mp
attest.ts --lang hi --words नैनोमीटर,नेनोमीटर    attest.ts --lang ug --words سېكۇنت,skt
```

**Raw findings.**

- **af — both halves attested, in the same construction.** `meneer` 6/6 examples the honorific before a
  name; `mnr` likewise, `Mnr. G.J. Bisschop`, `Mnr. G. Goodwin`, `Mnr. Blake`. The abbreviation and its
  expansion attest independently — the pair the dotted-abbreviation table needs. `mev`/`mevrou`
  attest just as well and are **deliberately not declared**: ×0 in af's artifact, so declaring them
  would be widening on a guess. Recorded in the manifest so it need not be re-derived.
- **hu — the wiki glosses the abbreviation from BOTH ends.** The *másodperc* article: "(szövegben – az
  **mp** rövidítést is)". The ⟨mp⟩ disambiguation page: "mp, Mp – időre vonatkozó mértékegységként a
  másodperc egyik jelölése, helyesen: s". 156 tokens / 18 articles.
  ⚠ **That same page lists a SECOND unit sense and it was read, not skipped**: `mp` is also the
  MILLIPOND, an obsolete CGS force unit. Declaring that instead would be this week's `kong-si` error.
  The time sense is the one the second's own article names as ordinary written usage.
- **hi — the wiki glosses the SYMBOL itself.** The नैनोमीटर article opens "नैनोमीटर (प्रतीक: नैमी या **nm**)",
  and the word is in digit-adjacent use elsewhere ("380 नैनोमीटर से 750 नैनोमीटर", "1000 नैनोमीटर के
  तरंगदैघ्य पर 0.17 नैनोमीटर"). The variant नेनोमीटर probes ×1 and is not declared.
- ⚠ **ug — ATTESTED AGAINST, and this is the run I would otherwise have "fixed" from the unit table.**

  ```
  word     token  arts  substr-only  verdict
  سېكۇنت    39     15    0            attested
  skt        0      0    1            substring-only
  ```

  The WORD is Uyghur and unarguable. The LATIN ABBREVIATION of it is not: zero tokens across
  ug.wikipedia. `120km/skt` is one writer's shorthand, and *sékunt* was sitting right there in the unit
  table waiting to be declared for it. **`skt` stays reported.** Trap 37 caught in the act, by the probe.

**Implication.** Three declarations, one refusal. Proceed to the repairs.

## Run 4 — 2026-08-13 11:05 (the six repairs)

**Question.** What is the smallest change that closes each sourced hit without moving anything else?

| lang | change | file |
|---|---|---|
| hi (+7 riders) | `nm: ["नैनोमीटर"]` added to the shared Hindi `units` | `src/languages/hindi/hindi.ts` |
| hu | `mp: ["másodperc"]` added to `units` — a NUMERATOR key, where `s` is denominator-only | `src/languages/hungarian/normalize.ts` |
| af | `"mnr": "Meneer"` added to `dottedAbbreviations` | `src/languages/afrikaans/afrikaans.jsonc` |
| hil | new step 8: `sg` → `sang`, lower case, bounded against `.:/-` | `src/languages/hiligaynon/normalize.ts` |
| ug | the unit arm's right guard relaxed from `\p{L}` to `A-Za-z` **for Latin keys only**, plus an ⟨ئ⟩ word-boundary arm | `src/languages/uyghur/normalize.ts` |
| ha | new step 10b: a vowel-free multi-letter unit key BEFORE a numeral spells out in place | `src/languages/hausa/normalize.ts` |

**The cross-language relationship, stated rather than left to be rediscovered.** ⚠ **THE `nm` LEAK IS
MAGAHI'S AND THE FIX IS HINDI'S.** mag, mai, bpy, awa, bgc, bho, hne and rkt have no symbol tier of
their own; `makeNativeHindi` resolves `overrides.symbols ?? SYMBOLS` and only mr passes an override. So
a Devanagari rider's unit leak can only ever be repaired in `hindi/hindi.ts`, and hi's OWN artifact
contains no `nm` at all — the key was findable only from a rider. The converse is the risk the gate has
to answer: one key added there declares a word for eight engines, so the corpus-diff below covers
hi, mai, awa and mr as well as mag.

⚠ **A SECOND UG LEAK TURNED UP THAT THE RAW-LATIN SCAN COULD NOT SEE.** Relaxing the guard first read
`180kmئېگىزلىكتە` ("at a height of 180 km") as one fused token. The pre-existing reading was worse and
was invisible: `ˈʊkm ʔeɡizliktɛ` — `km` through the ENGLISH fallback, so it was never byte-identical
with its source and `rawLatinIn` was structurally blind to it. ⟨ئ⟩ U+0626 is Uyghur's word-initial
vowel carrier — every vowel-initial WORD opens with it, no suffix ever does — so it separates a glued
next word from a bound suffix orthographically rather than lexically. `kilometir ʔeɡizliktɛ`.

⚠ **THE HAUSA RULE DOES NOT MOVE THE NUMBER.** Rewriting `km 2-3` to `2-3 kilomita` would close the
leak by imposing the tier's digit-first order on a language whose own corpus writes the other one five
times out of six. Only the symbol is spelled out; the count stays where Hausa puts it.

## Run 5 — 2026-08-13 12:40 (gates)

**Question.** Did anything move that was not aimed at?

**`mine.ts scan`** — the real count, hard + sample, before (a `git archive` of the parent commit into a
scratch tree; no refs created) and after:

```
hil   LEAK RAW-LATIN sg ×4                → no defects
hu    LEAK RAW-LATIN mp ×1                → no defects
af    LEAK RAW-LATIN mnr ×1               → no defects
mag   LEAK RAW-LATIN nm/mv/dv ×3          → mv, dv ×2   (formula variables — Run 2)
ug    LEAK RAW-LATIN kg, skt ×2           → skt ×1      (attested against — Run 3)
ha    LEAK RAW-LATIN km, rr ×2            → rr ×1       (a cited digraph — Run 2)
hi    LEAK RAW-LATIN nd ×1                → nd ×1       (URL residue — unchanged, as expected)
mai / awa / mr                            → identical before and after
```

**`corpus-diff.ts emit` / `compare`**, ten languages:

```
hil 4/132 changed   hu 1/107   af 1/109   ha 1/104   ug 2/428   mag 1/302
hi 0/135   mai 0/408   awa 0/393   mr 0/106
⚠ DIGIT, SLOT-GAP, RAWMARK, DROP and THROW IDENTICAL BEFORE AND AFTER for all ten.
```

Every changed line is the targeted line and no other. Read: hil's four `sg`→`sˈaŋ`; af's `mnr .` →
`məniər` (a spurious phrase break gone with it); hu's `ˈmp ˈh` → `ˈmaːʃotpɛrt͡s ˈpɛr ˈoːrɒ`; ha's `km` →
`kilomˈita` with the range `bˈi˥ju˥ zˈu˥wa˩ ˈu˥ku˩` intact; ug's `kɡ ʁit͡ʃɛ` → `kiloɡrɑmʁit͡ʃɛ` and
`ˈʊkm ʔeɡizliktɛ` → `kilometir ʔeɡizliktɛ`; mag's `nm` → `nˈɛnomiʈəɾ`.

**`review.ts --lang`**, all eight touched engines. hu, af and hil are now **checklist clean**. ha goes
3 FAILING → 2 (the `km` line closed; `sign classes DROPPED: plus-minus divide` and the `yen` sourcing
line are pre-existing, verified against the baseline tree). ug and hi keep one FAIL each, and both are
a residual RAW-LATIN hit classified in Run 2 rather than a new failure. mag and mai fail on
`normalizer … missing` — also pre-existing and also verified against the baseline: review.ts looks for a
per-language `normalize.ts`, which a Hindi rider by construction does not have.

**`sources.ts`** — diffed whole, before against after: **byte-identical, zero lines differ.**

**`tsc --noEmit`** clean. **`vitest run`** 242 files / 3952 passed, 5 skipped. ⚠ **NO EXISTING GOLDEN
CHANGED ITS EXPECTED VALUE.** Twelve new assertions were added (hil, af, hu, ha, ug, mag), including the
negative ones that pin the guards: `zh-sg:814` and `http://a.sg/x` must NOT become `sˈaŋ`,
`Dromaeosauridae` must not become *Dokter*, and ug's `450,295 km²` / `10 مىڭ كم²` must read as before.

## Run 6 — 2026-08-13 13:10 (the residual, and what stays reported)

**Question.** Of the 28 hits left across the 21 languages, is any of them a defect being tolerated
rather than a report being kept honestly?

Read every one; the classifications are Run 2's and are unchanged by the repairs. Nothing was added to
`VOWELLESS_WORDS`, and that is deliberate — ⚠ **the residual is exactly what that table forbids.** Its
own header says an entry naming a unit abbreviation is "a defect being silenced and belongs nowhere near
this table", and an entry is a claim about the language's PHONOTACTICS. None of the survivors qualifies:

- `ha rr` is a cited digraph in the orthography article, not a Hausa word. Listing it would tell the
  scanner that Hausa writes vowelless words, which it does not.
- `si kg`, `bar km`, `wuu kg`, `gan kg`, `ug skt`, `ln pg` are units. Listing any of them is precisely
  the move the table refuses.
- `he mt`, `bar kn`, `wuu sg` are not runs at all (an invisible character or a markup tag inside the
  span). The right home for those is the detector's own boundary handling, not a per-language list, and
  the detector belongs to shared tooling this branch does not own.
- The English and markup residue is correctly reported: the sentence really does contain untranslated
  English or unstripped wiki CSS, and the engine really is reading it as ASCII.

⚠ **`nya mw` ×2 and `ln mw` are the SAME `.mw-parser-output .reflist{…}` CSS block, in two unrelated
artifacts.** `filter-markup.py` strips wiki templates and LaTeX but not an inline stylesheet, and the
scan's `allOccurrencesInMarkup` does not recognise CSS either. That is one finding about the extraction
pipeline, not two about Chichewa and Lingala, and it is left where it can be acted on by whoever owns
that file — an artifact has to stay regenerable from the command it records (trap 32), so the lines are
not hand-removed here.

**Nothing was added to `defects.ts`.** No table there fits this residual: `ACCEPTED_SILENT` and
`ACCEPTED_SIGN_SILENCE` are for DROP classes, `CITED_WORDS` is for the sourcing gate, and
`VOWELLESS_WORDS` refuses these by design. **The classifications in Run 2 are the record.**

**Implication — and the shape of the result.** 44 hits read; 16 closed by six repairs; 28 left reported,
each with a cause named and, where it matters, measured against a control. Two genuine units were
declined on evidence, one of them against my own first reading of it.
