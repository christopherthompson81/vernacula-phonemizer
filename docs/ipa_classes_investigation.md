# Consolidating the per-engine IPA phone-class sets into `core/ipa.ts`

Follow-up to #746, which moved the ORTHOGRAPHIC letter sets into the manifests and deliberately left the
IPA phone-class sets alone: they are mostly re-spellings of one universal class, so nine manifest copies
would enshrine the duplication rather than fix it. This log is the analysis for the shared-helper half.

The thesis is already written in the repo, in `core/unicode.ts` above `IPA_VOWELS`:

> IPA vowel letters — the universal alphabet the stress tokenizer treats as syllable nuclei. **A vowel is a
> vowel regardless of which language declares it, so this is a notation constant, not per-language data.**

So the question is not *whether* to share, but whether each local set is EQUIVALENT IN EFFECT to a shared
one — a superset gives the same answer only for symbols the engine can actually emit.

## Run 1 — 2026-08-07 ~19:40 — what exists, and does a shared constant already cover it?

    grep -rn 'new Set(\[' src/languages/*/*.ts | grep -vE 'Object\.keys|\.map\(|MANIFEST\.|DEF\.' \
      | grep -iE 'IPA_VOWEL|VOWEL_PH|VOWEL_IPA|const VOWELS?\b|NUCLEI|…'

**Question:** how many phone-class sets are there, and is `core/unicode.ts`'s `IPA_VOWELS` already the
union of the vowel ones?

**Raw finding.** 66 phone-class sets overall; **33 of them are vowel classes** spread over 31 engines,
under nine different names (`IPA_VOWEL`, `IPA_VOWELS`, `VOWEL`, `VOWELS`, `VOWEL_PH`, `VOWEL_IPA`,
`VOWEL_BASE`, `NUCLEI`, `R_VOWEL`, `REPAIR_VOWELS`, `PLAIN_VOWEL`).

And the shared constant is **NOT** a superset:

    IPA_VOWELS = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶ"

It omits **ɑ**, **ɒ** and **ʏ**, each of which engines do emit — ɑ in bashkir/tatar/turkmen/karakalpak/
crimeantatar, ɒ in uzbek, ɒ and ɑ in bavarian, ʏ in icelandic.

**Implication — this is the crux of the whole task, and it cuts both ways.**

1. The consolidation cannot simply point every engine at `IPA_VOWELS`: for those engines the shared set is
   NOT a superset of the local one, so the swap would silently *lose* vowels and change output.
2. Extending `IPA_VOWELS` with ɑ/ɒ/ʏ is not free either. It is a regex character class used by
   `core/weightStress.ts`, `hindi.ts` and `bengali.ts`, so adding a symbol changes syllable-nucleus
   detection for every language routed through weight-based stress. That has to be checked, not assumed.

Next: for each of the 33 sets, compute the two-way delta against a candidate universal set, and decide
per symbol whether the difference is REACHABLE — i.e. whether that engine can ever emit it. A difference
on an unreachable symbol is behaviour-neutral and safe to consolidate; a reachable one is not.

## Run 2 — 2026-08-07 ~19:55 — reachability, take 1 (WRONG, kept as the dead end)

    npx tsx scratchpad/reach.ts   # delta vs a symbol appearing ANYWHERE in the engine's files

**Question:** for each of the 33 vowel classes, does the universal set differ on a symbol the engine can
emit?

**Raw finding:** 26 of 33 flagged, nearly all on ⟨y⟩ or ⟨e⟩.

**Implication:** the test is worthless as written. It scanned every string in the engine's files, so it
could not tell a SPELLING letter from an EMITTED phone — every Latin-script engine "reaches" ⟨y⟩ because
⟨y⟩ is a letter of its alphabet. A reachability test has to look only at the OUTPUT side.

## Run 3 — 2026-08-07 ~20:05 — reachability, take 2 (the output alphabet)

    npx tsx scratchpad/reach2.ts

Output alphabet taken from two sources that only ever hold emitted IPA: the VALUES of the manifest's
object tables (arrays skipped — those are the orthographic lists #746 moved in), plus every
`.toBe("…")` / `.toContain("…")` string in the language's own golden file.

**Raw finding:** 19 of 33 provably safe; 14 differ on a symbol that occurs in the output alphabet.
Tracing each of the 14 to its source (`scratchpad/trace.ts`):

| case | where the symbol actually occurs | verdict |
|---|---|---|
| albanian ⟨e⟩, maltese ⟨e i o⟩, turkmen ⟨a⟩, uzbek ⟨y⟩, haitian ⟨y⟩, aragonese ⟨y⟩, bambara ⟨y⟩, fula ⟨y⟩, kabuverdianu ⟨a⟩, luo ⟨y⟩ | `numbers.*` — number WORDS in native orthography (`tletin`, `altmyş`, `yigirma`, `milyon`) | false positive: orthography that gets re-phonemized, not emitted IPA |
| arabic ⟨y⟩ | `variety = "egyptian"`, `iso = "ayl"` | false positive: metadata |
| luxembourgish ⟨y⟩ | goldens that are INPUT text (`"Typ-1-Diabetes"`) | false positive |
| icelandic ⟨æ⟩ | number words (`tvær milljónir`) | false positive |
| **icelandic ⟨e⟩** | **goldens `steitn`, `ceiŋkʏr`, `tveir` — real emitted IPA** | **REAL** |

**Implication:** exactly ONE engine genuinely disagrees with the universal set, and the number-word
tables are the dominant source of noise in any output-alphabet estimate. Worth remembering for the
consonant-class pass: the manifest's `numbers` block is orthography, not IPA.

## Run 4 — 2026-08-07 ~20:15 — the Icelandic disagreement is a LATENT BUG, not a conflict

Icelandic's `VOWEL_PH` is `aɛɪiɔouʏœøy` — no plain ⟨e⟩. But the manifest maps the digraphs ⟨ei⟩ and
⟨ey⟩ to the two-character value `"ei"`, and `startsWithVowel()` tests the FIRST character:

    function startsWithVowel(ph: string): boolean { return VOWEL_PH.has([...ph][0]!); }

So `startsWithVowel("ei")` is FALSE today. Line 158 uses it for hiatus j-insertion — the rule whose own
comment reads "trigger a glide [j] before a following vowel (Biblía→pɪplija)".

Patched `e` into the set and diffed constructed probes:

| input | main | with the universal set |
|---|---|---|
| `nýeyra`   | `nieira`   | `nijeira`   |
| `þríeyki`  | `θrieicɪ`  | `θrijeicɪ`  |
| `síeyra`   | `sieira`   | `sijeira`   |

**Raw finding:** the full suite passes BOTH ways — 228 files / 3134 tests. No golden covers the hiatus
glide at all, which is how the gap survived.

**Implication:** the consolidation is not purely cosmetic here. A hand-written per-language vowel list
omitted a vowel the engine actually emits, and the shared list repairs it — the [j] SHOULD be inserted
per the engine's own documented rule. ⚠ NOT REFEREE-CONFIRMED: the wikipron isl_latn_broad corpus is not
in-repo, so this rests on the engine's stated rule and Icelandic hiatus phonology, not on a measurement.
Flagged in the PR for a domain call rather than folded in quietly.

## Run 5 — 2026-08-07 ~20:35 — widening the SHARED constant breaks Urdu and Bhojpuri

Made `core/ipa.ts` own the class, added the three missing letters ⟨ɑ ɒ ʏ⟩, and re-exported `IPA_VOWELS`
from `unicode.ts` so the existing regex users pick it up. Ran the suite.

**Raw finding:** 11 failures across urdu and bhojpuri. Representative:

    انبار   expected "ˈəmbɑːɾ"   got "əmbˈɑːɾ"
    آبرو    expected "ɑːbɾˈuː"   got "ˈɑːbɾuː"

**Implication — STOP; this is a different change wearing a refactor's clothes.** `IPA_VOWELS` is the
NUCLEUS class for `core/weightStress.ts`, so adding ⟨ɑ⟩ makes every ɑː syllable weight-bearing and moves
stress across the Indic engines. Note the direction: `əmbˈɑːɾ` puts the stress on the LONG syllable,
which is what a weight-based rule is supposed to do — so the widening looks like an improvement, not a
regression, and the goldens may be pinning a bug.

But "looks like" is not a measurement, and these engines have referees (urdu has a mined IPA coverage
lexicon). The wikipron/kaikki corpora for ur and bho are NOT in-repo, so it cannot be settled here.

**Decision.** `core/ipa.ts` defines ONE list and derives both shapes from it:

    export const IPA_VOWELS = "…"              // unchanged: the stress-nucleus class the regexes use
    export const IPA_VOWEL   = new Set(IPA_VOWELS + "ɑɒʏ")   // the membership class the 31 engines use

The three letters are added only on the SET side, which no stress rule reads — so the consolidation lands
with zero behaviour change outside Icelandic (Run 4), and the ⟨ɑ⟩-as-nucleus question is left as its own
change, to be decided with referee numbers rather than by a refactor's side effect.

## Run 6 — 2026-08-07 ~21:00 — conversion, and four sets that were never IPA at all

Pointed the vowel classes at `core/ipa.ts` (script-assisted, diff reviewed by hand) and ran the suite.

**Raw finding:** 2 failures, both quechua:

    42 → expected "tawa chunka iskayniyuq"   got "tawa chunka iskayyuq"

**Implication — Run 3's lesson, repeating in a form the analysis had not caught.** `quechua/numbers.ts`
applies its `VOWELS` set to Quechua WORDS, not phones: the `-yuq`/`-niyuq` suffix depends on whether the
spelling ends in a vowel, and ⟨y⟩ is a CONSONANT letter in Quechua but the IPA vowel [y]. My grep picked
these up by NAME (`const VOWELS`), and a name says nothing about which side of the g2p a set lives on.

Auditing every converted site by its USAGE rather than its name found four of exactly this kind:

| site | applied to | verdict |
|---|---|---|
| `quechua/numbers.ts` VOWELS | Quechua number words | orthographic — reverted |
| `luo/numbers.ts` VOWELS | Luo number words (the gi-/g- elision) | orthographic — reverted |
| `fula/fulaAdlam.ts` VOWELS | the LATIN transliteration adlamToLatin emits | orthographic — reverted |
| `balochi/balochi.ts` R_VOWEL | the ROMAN Balochi spelling in phonemizeRoman | orthographic — reverted |

Each now carries a comment saying it is orthographic and must not be pointed at `core/ipa.ts`. By #746's
rule they belong in their manifests; that is the orthographic sweep's business, not this one's.

**Final state.** 26 engines read the shared class; guaraní reads `[...IPA_VOWEL, …its composed nasals]`
(⟨ɨ̃⟩ is two codepoints, so that class can never live in a per-character shared set); 4 reverted as
orthographic; icelandic converted deliberately WITH the behaviour change and a new golden.

`npm run ci`: 228 files / 3135 tests, typecheck, fence — all green.

## Still open

1. **⟨ɑ⟩ as a stress nucleus** (Run 5). Widening `IPA_VOWELS` moves 11 urdu/bhojpuri goldens toward
   stressing the long syllable, which is what a weight rule should do. Needs the ur/bho referee corpora.
2. **The 33 CONSONANT classes** (NASAL, LIQUID, VOICELESS, SONORANT, SIBILANT, STOPS, VELAR, OBSTRUENT).
   Not the same problem: many are genuinely language-specific — Irish's ⟨ɾˠ ɾʲ l̪ˠ lʲ⟩ are its liquids,
   not liquids-in-general — so this needs a per-class judgment, and the ones that ARE language-specific
   belong in manifests, not here.
3. The four reverted orthographic sets, for the manifest sweep.
