# Manifest-lifting survey

Data hardcoded in `src/languages/*/**.ts` that belongs in `data/languages/<lang>/<lang>.jsonc`, read as
`DEF.<key>`. Covers **43 of the 52 ported languages**; the sweep was cut short, so **uk — the language that
prompted this — is NOT covered**, along with af am ar as ast bn bg pa pl pt te th tr.

Test applied throughout: *could a sibling language plug in different values and get a correct reading with
the SAME code?* If yes, it is data. `makeSymbolNormalizer({…})` call sites were excluded by construction —
lifting those is one uniform fleet-wide decision, not 43 separate ones.

## The recurring classes

Nine shapes account for most of the findings. Each already exists as a manifest key in at least one
language, so none of these is a new idea — they are the fleet failing to be consistent with itself.

| class | precedent already in a manifest | languages still hardcoding it |
|---|---|---|
| `letterNames` | af, id, wu | ru 32, es 27, de 29, fr 26, it 26, ja 26, jv 26, ko 26, vi 26, el 26, nl 26, hu 33, ha 30, cmn 26, kn 4 |
| `phonotactics` (`legalOnsets`/`legalCodas`) | — (all hardcoded) | de 100, en 101, ru 59, es 50, it 55, fr 98, hu 87, nl 74, jv 30, id 51, ha 42 |
| `dottedAbbrev` | — | es 31, fr 22+5+2, de 22, it 21, en 34, ru 14+5, hu 5, id 15, ceb 7, nl 17+9, ln 5, sw 4, gu 4, hi 7, el 7 |
| sign / relational words | — | present in **every** language surveyed, ~6-18 each |
| ordinal tables | — | es 41, ru 29, el 23, hu 46, it 13, fr 7, mr 20, gu 15, ur 14, de 6, ro 4 |
| ordinal trigger nouns (Roman numerals) | — | it ~70 (incl. regnal given names), ro ~50, ru ~30, es 22, hu 9 |
| unit / rate / exponent nouns outside the tier | — | en 38, mr 26, ko 11, ms 17, ln 8, my 8, ro 15, kn 5, ja 12, hi 8 |
| `months` | — | es 13, fr 12, de 12, hu 12, en 12 |
| `eraMarkers` | lt | es, sw, de, fr, it, mr, ha, gu, hi, kn, vi, ln |

## Highest value ÷ risk — do these first

1. **`letterNames` across 15 languages** (~370 entries). Single reader each, no ordering, three manifests
   already carry the key. The one lift that makes the fleet consistent rather than novel.
   ⚠ Javanese's must stay ORTHOGRAPHY-valued, not IPA-valued, unlike Indonesian's.
2. **`phonotactics` across 11 languages** (~750 entries). All eleven call the *same*
   `makeUnreadableTest({legalOnsets, legalCodas})`; the sets are pure inventory. `isUnreadable*` is
   exported in several but has no importer outside its own directory.
3. **`dottedAbbrev` across 15** (~190). ⚠ Several store REGEX-ESCAPED bodies (`"B\\.C\\.E"`,
   `"v\\.\\s?Chr"`); store plain and escape at load. Most already sort keys longest-first in code, so
   JSON key order is not significant — that is what makes them cheap.
4. **`months`** (5 languages, 61). Trivial. ⚠ English re-spells its list inline a fourth time at
   `normalize.ts:441`; the lift should collapse all four copies.
5. **Kalaallisut `numbers`** — kalaallisut.jsonc has **no `numbers` key at all**; the native 0-12
   (`ataaseq`, `arfinillit`) and the whole Danish loan series live in `numbers.ts`. Most clear-cut case
   in the survey.
6. **ru `romanOrdinals` tables** (29) — the file's own comment already calls them "a table, not a rule".

## Live duplications — data in two places, free to drift (fix regardless of any lift)

| language | the duplication |
|---|---|
| **ur** | `longVowels` and `glides` ARE in urdu.jsonc, ARE declared in `UrduDef`, and are **never read** — g2p.ts hardcodes both. The sibling `punjabi/shahmukhi.ts` DOES read `DEF.longVowels`. Two dead keys. |
| **nl** | THREE different Dutch vowel-letter inventories: `g2p.ts:20`, `morphology.ts:255` (already drifted — no circumflexes), and the manifest's IPA-side `vowelChars`. Also `UNSTRESSED_PREFIX` duplicates `morphology.prefixUnstressed`, which is already in the jsonc. |
| **mr** | `£` is `पौंड` in normalize.ts and `पाउंड` in marathi.ts. `%` is declared in three places. |
| **en** | `ROMAN` map and its `(ii\|iii\|iv…)` alternation at :573 are two copies; `st`/`dr`/`mt` appear in a third inline object at :261. |
| **ja** | `UNIT_KANA` (normalize.ts) duplicates the `units` block in japanese.ts verbatim; `平方/立方` likewise. |
| **cmn** | `平方/立方` in both the tier and `POWER`. |
| **ha** | the unit map is written out THREE times inside separate regex callbacks, and the three have already diverged. |
| **es** | `"áéó"` duplicates `vowels.strong`; `FINAL_VOWEL` duplicates the manifest vowels; `menos` is declared twice. |
| **el** | `SYN_PAL` partially duplicates the manifest's `palatal`. |
| **de** | `PREFIX_GUESS` duplicates `morphology.prefixUnstressed`. |
| **ru** | `isUnreadableRussian`'s vowel regex duplicates `vowelLetters`; `одна`/`две` partly duplicate `numbers.thousandFeminine`. |
| **sw**, **yo**, **fr** | vowel-letter constants duplicating `Object.keys(DEF.vowels)`. |
| **mi** | `NATIVE_CLASS` and `isNativeWord` hardcode the same three punctuation characters separately. |
| **qu** | `"k'atma"` appears as the emitted word AND inside its own redundancy guard. |

## Comments that are now false

- `ru/g2p.ts:10` asserts *"All letter→IPA / voicing lookup tables are DATA (russian.jsonc)"*. False for the
  vowels: `stressedVowel`/`reducedVowel` are 20 hardcoded cases.
- `ja/pitch.ts:47` asserts *"The affix sets are DATA (japanese.jsonc → pitchStrip)"* ten lines above
  `PARTICLE_TOKENS`, 24 hardcoded particles.
- `en/englishArpabet.ts` says `def` supplies "the variety-specific IPA values", but six allophones
  (`ŋ t̬ pʰ ɫ ᵻ ʲ`) bypass `def` entirely — so an en-GB variety cannot change them.

## Leave alone

- **ru/es/nl/de/fr g2p tables.** Highest value on paper, highest risk in fact: switch arms interleave with
  context conditions and post-switch overrides patch the results. French's `g2p.ts` letter classes are the
  worst — touching them moves vowel quality everywhere.
- **ja `kanji.ts` segmentation particles** and **cmn sandhi triggers** — inside state machines.
- **ko `NATIVE_COUNTER`** — each entry carries its own negative lookahead (`시(?![간드속])`); needs a
  structured `{counter, notBefore[]}` shape before it can move at all.
- **`NATIVE_CLASS`** in qu/ro/es/sw/hu/it/jv/kl/mi. Four files frame it as a CLAIM ABOUT THE G2P that
  `test/native-inventory.test.ts` measures character by character. Contested.
- **en `englishG2p.ts` `SUFFIXES`** — the file is a PURE FUNCTION of injected data by explicit design and
  must never call `loadManifest`; it can only move through the `G2pClasses` injection parameter.

## Inheritance hazards

- **hi** is inherited by bho/mag/awa/hne/mai/rkt through `makeNativeHindi`, and **id** by ms/zsm through
  `createIndonesian`. A lift there changes 6-9 engines at once. Today those inheritors silently speak
  Hindi's and Indonesian's words — which is exactly the defect `overrides` was added for.
- **ms has no manifest file at all**; every Malay finding requires creating `data/languages/malay/`.
  ⚠ Its own header warns that "a Malay file that re-states Indonesian for no measured reason is worse
  than the alias."

## Deliberate — do NOT lift

Roughly 40 sites state their reason in the source. The load-bearing categories:

- **"The ALGORITHMS that read them stay in code"** — ru, es, ja, hu, kn, ko, cmn, vi, umb, yo, fr, de, el,
  nl, qu manifests all carry this sentence. It exempts the *scan/compositor*, not the tables inside them.
- **Deliberate ABSENCES that must survive any lift** — yue has no `¥` and no `m`; yue `LETTERS` is missing
  H and W ("rather than invent them"); sw has no `letterNames` ("a MISSING reading rather than a
  confidently wrong one"); mi has no `t`/`kg`; kn's letter table is closed to the 4 attested forms
  because "a Latin→Kannada letter-name table would be invented data"; ln has no initialisms at all.
- **Deliberate NEGATIVE RULES** — nl's bare `N.`, nl and mr's absent minus rule ("reading 'उणे एक' is
  worse than silence"), my's bare-sign rule, vi's list of nine shapes left alone.
- **Placement arguments** — ja/ko/mr/yo each explain why a unit table is LOCAL rather than in the shared
  tier: the tier matches a unit only when a number is directly adjacent, and the local rule must run
  before the step that destroys adjacency. That argues against moving to the tier, NOT against a
  manifest key.
- **id `laxVowels`** is in the manifest and deliberately unread — do not "wire it up".
- **`hungarian.jsonc:111`** already states the principle this whole survey serves: *"Dead data drifts
  silently; a mapped key is not a read one."*
