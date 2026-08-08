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

**Implication (WRONG — see Run 7):** read as a repair, on the reasoning that a hand-written list had
omitted a vowel the engine emits. Recorded here as stated at the time, including the claim that the
wikipron isl_latn_broad corpus was "not in-repo". It is in-repo, and it settles the question the other
way.

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

But "looks like" is not a measurement. ⚠ THE REASON RECORDED HERE — "the corpora are not in-repo" — WAS
FALSE (Run 7). `ur.wikipron-urd-broad.tsv`, `ur.cle-speech.tsv` and `bho.grammar-mined.tsv` are all
committed. The real blocker is different and worse: `grep -c ˈ` returns 0 in all three, and the eval
folds stress anyway — so widening `IPA_VOWELS` leaves the ur/bho numbers bit-identical. The referee
CANNOT settle a stress question, whatever it can settle. Right call, wrong reason.

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

## Run 7 — 2026-08-07 ~21:40 — the referee corpora ARE in-repo, and Icelandic was a REGRESSION

Code review of #748 checked the claim I had recorded twice — that the relevant referee corpora were not
in the repository — and it was false. They are all under `tools/referee-eval/referees/`. I had searched
`find . -iname '*icel*'`; the file is `is.wikipron-isl-broad.tsv`, keyed by the ISO code. A grep that
matches nothing is not evidence of absence, and I wrote that non-finding into a code comment, a test
comment, this log (twice) and the PR description.

    grep -n 'erkiengill' tools/referee-eval/referees/is.wikipron-isl-broad.tsv
    2311:erkiengill	ɛ r̥ c ɪ e i ɲ c ɪ t l          ← NO hiatus [j]

    npx tsx tools/referee-eval/eval.ts is
    folded backbone: 8086/10093 (80.1%)   on main
    folded backbone: 8085/10093           with VOWEL_PH = IPA_VOWEL

**Raw finding:** the referee attests the GLIDELESS reading of exactly the case Run 4 "fixed", and the
change measurably loses ground. Worse, the referee shows the rule already OVER-applies where it does
fire: `hýena` → engine `hijɛna` vs referee `h iː ɛ n a`; `bavían` → `pavijan` vs `p aː v iː a n`;
`beitieski` → `peitɪjɛscɪ` vs `p e iː t ɪ ɛ s c ɪ`.

**Implication.** Run 4's reasoning was backwards. Icelandic's narrow vowel list was not suppressing a
correct rule; it was accidentally CONTAINING an over-eager one, and widening it extended the
over-application to diphthongs. Icelandic keeps its own list, with the measurement recorded beside it;
the new golden now pins the glideless reading the referee attests instead of the glide.

The general lesson, which is why this log exists: a narrower local class is not automatically a bug, and
"the data isn't available" needs a check that the data isn't available. `tools/referee-eval/eval.ts <code>`
is the check for anything that touches output — it takes seconds and I should have run it in Run 4.

**Also open, new:** the Icelandic hiatus rule genuinely over-applies (3 referee-attested cases above).
→ DONE, see `icelandic_hiatus_investigation.md`: the trigger is the long ⟨í⟩ alone, not the high front
class, and narrowing it moved the backbone 8086 → 8091/10093. The guessed cause in this line (restrict
by the FOLLOWING vowel) was wrong — it is the preceding one.

## Run 8 — 2026-08-07 ~23:00 — the CONSONANT classes should NOT go to core/ipa.ts

The follow-up item assumed the consonant classes were the same problem as the vowel one. They are not.

    npx tsx cons.scratch.ts   # every consonant-class set, grouped by class name

| class | engines | the members |
|---|---|---|
| voiceless | 6 | hungarian `p t k f s ʃ t͡s t͡ʃ c x` · icelandic `p t k s θ f h c` · luxembourgish `p t k s ʃ f χ t͡s t͡ʃ` · occitan `p t k f s` · romanian (obstruent, both voicings) · tibetan (WYLIE tokens, not IPA) |
| velar | 5 | ancientgreek `ɡ k kʰ ks` · galician `k ɡ` · latin `k ɡ kʷ ɡʷ kʰ` · totontepecmixe `k ɡ ɣ` · mindong (romanization finals) |
| sonorant | 5 | chuvash `l r` · irish `ɾˠ ɾʲ l̪ˠ lʲ` · latin `l ɫ r` · scottishgaelic `l̪ˠ lʲ rˠ ɾʲ` · tibetan (Wylie) |
| nasal | 4 | albanian `m n ɲ ŋ` · chuvash `n m ŋ j` · totontepecmixe `m n` · turkmen `m n ŋ` |
| voiced / stop / sibilant | 7 | all per-language |

**Raw finding: no two are the same list.** Unlike `IPA_VOWEL`, where 31 engines held near-identical copies
of one universal alphabet, these share only a class NAME. Each is that language's own inventory, and the
narrowness is deliberate and load-bearing:

    totontepecmixe NASAL = {m, n}     — but the engine DOES emit ŋ; post-nasal voicing fires after m/n only
    occitan VOICELESS_PH = {p t k f s} — but the engine DOES emit ʃ; intervocalic ⟨s⟩→[z] depends on that

Substituting a universal class in either case changes output. The vowel consolidation worked because "the
IPA vowel letters" is a fact about the notation; "the voiceless obstruents OF THIS LANGUAGE" is a fact
about the language.

**Decision: do not consolidate. Move them to their MANIFESTS instead** — the #746 rule, which is where a
language's own inventory belongs, and which lets each carry the rule it serves and why it is narrow.
`core/ipa.ts` stays a vowel-class module.

Excluded from the sweep: tibetan's Wylie classes (#741 kept the stack grammar with the parser); the
`VOICELESS` sets in bulgarian/maltese/macedonian, which are DERIVED from each manifest's `DEVOICE` map and
so are already single-sourced; and icelandic, whose files are in flight in #749.

## Run 9 — 2026-08-08 ~00:30 — ⟨ɑ⟩ was not a preference question; stress was VANISHING

Run 5 deferred the ⟨ɑ⟩-as-nucleus question because widening `IPA_VOWELS` moved 11 ur/bho goldens and the
referees carry no stress marks, so placement could not be adjudicated. Run 7 corrected the reason for the
deferral but kept the deferral. Both times I asked only "which placement is right?".

**The other question, never asked: what happens to a word with NO visible nucleus?**

    applyWeightStress("kaːm")  → kˈaːm        applyWeightStress("kɑːm")  → kɑːm
    applyWeightStress("aːp")   → ˈaːp         applyWeightStress("ɑːp")   → ɑːp
    applyWeightStress("saːlaːɾ") → saːlˈaːɾ   applyWeightStress("sɑːlɑːɾ") → sɑːlɑːɾ

The weight rule's fallback chain (rightmost superheavy → rightmost non-final heavy → first syllable) ends
at "first syllable" — but with no nucleus visible there are no syllables at all, so it emits NOTHING. In
the live engine: آپ 'you' → `ɑːp`, کام 'work' → `kɑːm`, بازار → `bɑːzɑːɾ`, all bare. Everyday words.

No referee is needed to call that wrong, which is what I had missed twice.

**And then the referee did adjudicate — via the other language.** Widening `IPA_VOWELS` and re-running:

| referee | main | with ⟨ɑ ɒ ʏ⟩ |
|---|---|---|
| ur.wikipron-urd-broad | 4382/7709 (56.8%) | 4382/7709 — identical |
| ur.cle-speech | 3364/5667 (59.4%) | 3364/5667 — identical |
| **bho.grammar-mined** | **1008/1623 (62.1%)** | **1133/1623 (69.8%)** |

**+125 words for Bhojpuri.** Urdu is genuinely stress-folded and cannot see the change; Bhojpuri improves
because `IPA_VOWELS` is not only the stress nucleus — the Indic engines build SEGMENTAL regexes from it
too (schwa handling, vowel counting), so an invisible ⟨ɑ⟩ was corrupting more than stress.

**Implication.** "The referee can't settle it" was wrong twice over: it can't settle Urdu PLACEMENT, but
it settles the change decisively on Bhojpuri, and the missing-stress half needed no referee at all. The
generalisable error is scoping the question to the first thing I noticed (placement) and treating one
corpus's silence as the whole evidence base.

`IPA_VOWELS` and `IPA_VOWEL` are now one list again — the split #748 introduced was a workaround for a
question that had an answer.

### Run 9a — the residual the fix exposed: the avagraha ⟨ऽ⟩

Review of #752 measured the +125 as **135 words fixed, 10 broken**, and identified the 10:

    बाड़ऽ   was bɑɽˈə (matches the referee's bɑɽʌ)   now bˈɑɽ

⟨ऽ⟩ (U+0973) appears NOWHERE in `src/languages/bhojpuri/` or `src/languages/hindi/`, so it is dropped as
an unknown character — and the invisible ⟨ɑ⟩ had been accidentally suppressing final-schwa deletion for
these forms. Removing the accident exposed the real gap. Avagraha matches fall 15/31 → 5/31.

Not folded into #752: the avagraha is a phonological rule (it writes a final vowel that would otherwise
delete), and `schwaDeletion` in the manifest is already the configurable hook for exactly this. Scope is
31 bho words + 2 mai; nothing else in any referee carries the character. Logged as its own change with a
measurable target, like the Icelandic over-application in Run 7 which became #749.

## Run 10 — 2026-08-07 ~23:30 — the avagraha, closed

The residual from Run 9a. ⚠ FIRST CORRECTION: the character is **U+093D** DEVANAGARI SIGN AVAGRAHA, not
U+0973 as the review reported — checked by dumping the codepoints of a referee headword rather than
trusting the number.

    grep 'ऽ' tools/referee-eval/referees/bho.grammar-mined.tsv

    करऽ  kʌrʌ     दऽ  dʌ      देखऽ  dekʰʌ    खइलऽ  kʰʌilʌ    बाड़ऽ  bɑɽʌ

**Raw finding:** all 31 forms keep the final vowel; none delete it. In Bhojpuri the avagraha is a LIVE
orthographic mark on the imperative/participial forms — not Sanskrit's elision sign — and it writes
exactly the inherent vowel the schwa rule would otherwise remove. The minimal pair कर/करऽ is the rule.

**Implementation.** A `retainOnAvagraha` flag on the manifest's `schwaDeletion` block, tested against the
SPELLING: g2p drops the character, so by the time the phones exist there is nothing left to condition on.
That makes it the one retain-condition that cannot be decided from the IPA string, which is worth the
comment it now carries in hindi.ts.

| | before | after |
|---|---|---|
| **bho** | 1133/1623 (69.8%) | **1153/1623 (71.0%)** |
| **mai** | 141/167 (84.4%) | **142/167 (85.0%)** |

The other 15 engines that compose `makeNativeHindi` are unaffected — the flag is opt-in and off by
default; hi/mr/ne/awa re-measured identical to main.

**Residual, deliberate.** Maithili's referee transcribes the retained vowel LONG (अऽ → əː, अहाँलऽ →
… l əː) and the engine emits short ⟨ə⟩. Retention is right in both languages; the length is a Maithili
detail on two words, and inventing a per-language avagraha vowel for that sample would be fitting noise.
