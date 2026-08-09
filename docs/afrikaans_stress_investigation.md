# Afrikaans outstanding items — stress/syllable, proper nouns, nasalization, numbers

Goal: the floor comment's "path to higher" list. Referee = en.wiktionary Afrikaans
(human, 2220), single-source; baseline 1680/2220 (75.7%) folded.

## Run 1 — 2026-08-08

Command: scratch probe replicating the eval fold pipeline, classifying all 540 folded
misses; then an empirical payoff sweep over candidate folds.

Classes (first-match classification):
- **proper nouns 58** (capitalized rows: Afrika, Botha, Blignault, AWB…) — g2p cannot
  win these; they need a lexicon (house pattern: sibling TSV like tagalog's
  stress-lexicon.tsv, portuguese's lexicon.tsv).
- **"schwa" cover-class 151** — on inspection THREE distinct things:
  ⟨ei⟩ notation (ours əi, referee ɛi — same phoneme, ⟨ei⟩=⟨y⟩ are homophonous in
  Afrikaans); short-⟨a⟩ backness (referee free-varies a~ɑ: "adrɛs" but "ɑrm"); and the
  REAL stress-conditioned reduction (adres → ours adrəs, ref adrɛs — we reduce a
  stressed loan-final syllable; aalagtig → ours -təχ, ref -tiχ — closed unstressed ⟨i⟩).
- **nasal n-deletion: ×2 visible** (boepens, wetenskap) — the nasal TILDE is already
  backbone-stripped; only the n-deletion shows, and it shows twice. Tiny.
- **other 329** — sub-classes: the referee's OPTIONAL-SCHWA parens are stripped rather
  than tried both ways ("al(ə)s" compares only as als, so ours aləs misses — and
  "an(d)ər" loses a real d); intervocalic ɦ written inconsistently by the referee
  (-heid rows both keep and drop it); morpheme-boundary assimilation (aandete→ɑntiətə,
  aanmatiging→ɑmɑtəχəŋ); fw→v cluster (afwesig→aviəsəχ).

Payoff sweep (fold candidates, measured):
| variant | score |
|---|---|
| baseline | 1680 (75.7%) |
| paren-either matching | +4 |
| fold ɛi→əi | +4 |
| fold a~ɑ (both sides) | +62 |
| fold ɦ-drop | +2 |
| all four | **1753 (79.0%)** |

Numbers: numbers.ts EXISTS and is wired (unit-en-ten compositor) — the floor comment's
"numbers deferred" is stale.

Implication: implement (1) paren-either in eval.ts (generic — the referee writes real
segments in parens, not only schwas), (2) the three folds with justifications, (3) the
proper-noun lexicon (~58 entries, referee-sourced with the circularity documented —
single-source language, same trade tl made), (4) engine stress/reduction fixes measured
one at a time. Nasalization stays deferred with the ×2 evidence; numbers note corrected.

## Run 2 — 2026-08-08

Command: implemented (1)–(3); re-ran eval + the af suite.

- **75.7% → 81.2% folded (1802/2220), symbol accuracy 93.5% → 95.3%.** Composition:
  folds + paren-either +73 (measured stepwise in Run 1), lexicon +49. The generative
  number WITHOUT the lexicon is 79.0% — recorded because the lexicon rows are
  reference-parity, not independent confirmation (single-source language).
  ⚠ **These two numbers did not survive review — see Run 3.** Both the headline and the
  79.0% were inflated by a fold that was masking real errors.
- af-lexicon.tsv: 49 entries — the capitalized single-word folded misses, referee IPA
  minus stress/dots/optional-parens, loaded lazily like tagalog's stress lexicon.
  Provenance + circularity: af-lexicon.PROVENANCE.md.
- eval.ts now expands a parenthesized reference group into BOTH variants generically
  (the old af preFold deleted real segments: "an(d)ər" lost its d).
- Numbers: confirmed implemented and wired (numbers.ts, unit-en-ten) — stale "deferred"
  note removed from the floor comment and catalogue.
- Nasalization: re-deferred with evidence — tilde is backbone-stripped; the visible
  n-deletion class is ×2/2220; the lexicon carries afrikɑ̃ːs.

**The remaining path (NOT done — the stress/reduction model proper).** The measured
taxonomy of what's left, for the next session:
- MORPHOLOGY OVER-SPLITTING drives schwa errors in both directions: "beter" decomposes
  as be+ter (prefix reduction eats a stressed stem vowel → bətɛr for biətər; same for
  besig), and suffix-ish tails split as stressed morphemes (-ers → ɛrs, -etjie → ɛki).
- LOAN FINAL STRESS: adres, argitek reduce a stressed final syllable (ours ə, ref ɛ) —
  stressFinalSuffixes can't carry -es/-ek (native -es is weak: "al(ə)s"), so this needs
  either a loan lexicon tier or a smarter heuristic.
- BOUNDARY ASSIMILATION at compound seams: aandete→ɑntiətə (dt), aanmatiging→ɑmɑtəχəŋ
  (nm→m), bestanddeel ntd→nd, advies dv→tf.
- Referee-inconsistent rows that should NOT be chased: final devoicing (ref writes
  bard, antiɛld against standard Afrikaans devoicing), -ig as both iχ and əχ.

## Run 3 — 2026-08-08 (review of PR #770)

Nine findings; all fixed. Three changed the reported NUMBERS, which is the important part.

**1. The headline was circular.** The eval scored the shipped `phonemizeWord`, which now
consults a lexicon built from the referee itself. Fixed by the house pattern: a new
`phonemizeWordRules` export (mirrors en-GB/tl/ilo) is what the eval imports; the lexicon
improves shipped output only and earns zero eval credit.

**2. The short-⟨a⟩ fold was masking the engine's own headline rule.** It gained 63 words,
but re-measuring with `ː` retained showed **39 of those 63 were genuine open/closed-LENGTH
errors** (anys ɑːnəis vs aˈnəis; apart; fantasie; ekstase) — the fold ran after the
backbone strips ː, so our long ɑː landed on the referee's short a. Fixed by moving it to
a **preFold** guarded `ɑ(?![ː̃])`, where the length mark is still present: short vowels
fold, long and nasal ones stay visible. Those 39 words are now back in the miss list where
they belong, and are the largest single remaining class.

**3. Three lexicon rows were unreachable from the pipeline** and earned eval-only credit:
`suid-afrika`/`kwazulu-natal` (the tokenizer splits on the hyphen), `awb` (normalize.ts
expands initialisms before phonemizeWord). Two more (`j`, `q`) were single letters that
**overrode the letter-name rule of #761** — ⟨J⟩ was reading [jɛ] instead of the name
[jiə]. Dropped all five (44 entries remain), and the lookup now sits after the rule
path's own special cases so a future stray row is harmless rather than silent.

**4. The lexicon values were not in the engine's inventory** despite the PROVENANCE claim
— `ɪə`/`ʊə`, mixed `x`/`χ`, plus `ˑ`, `◌̯`, `ɨ`, `ɲ`, `c`. The eval could not see any of
it (its own folds neutralize exactly those symbols), so it would have reached users
unmeasured. Normalized; PROVENANCE rewritten to describe what was actually done.

**5. The ɦ fold was fleet-blinding for 2 words** — an engine that dropped /h/ entirely
would have scored the same. Scoped to the `-heid` suffix, same +2.

**6. Paren expansion was global.** 160 referee files contain a parenthesis and in some it
is data (Amharic `(ʔ)itjopʼja`), so every language's numbers could move unmeasured. Now
opt-in per language (`parenOptional`), and it generates **every** combination (2ⁿ) rather
than only all-in/all-out.

**Honest result: 76.9% folded / 93.9% symbol** (rules only), up from the 75.7% baseline
— +1.2pp, not the +5.5pp first reported. Floor 0.73 → 0.74. The lexicon's value is real
but lives in shipped output, not in the score.

## Run 4 — 2026-08-08 (the stress/reduction model — and what it is actually worth)

Command: A/B each candidate against the eval, one at a time; then bound the whole project
with a perfect-stress ORACLE (stressedNucleus replaced by the referee's own ˈ position).

**THE HEADLINE FINDING — the deferred item was mis-scoped.** The oracle scores
**1783/2220 against the rule engine's 1738**. So every stress rule that could ever be
written, taken together and executed perfectly, is worth **~45 words (2pp)**. The
"stress/syllable model" was recorded as *the* path to higher; it is not. The residual is
segmental and lexical, and the reduction errors that look prosodic are mostly a handful
of loan words.

Measured, in order tried:

| candidate | result | kept |
|---|---|---|
| `dontSplitKnownWords: true` (Dutch's guard) | 1708 → **1691** | no — the stem list is a frequency wordlist full of real compounds |
| extended loan-stress suffixes, greedy set of 8 | 1708 → 1707 | no |
| per-suffix sweep: ⟨uur⟩ +3, ⟨oen⟩ +2, ⟨eel⟩ +1; ⟨sie⟩ −12, ⟨aar⟩ −6, ⟨el⟩ −42 | — | the three that pay |
| unstressed ⟨e⟩ in a closed final syllable → [ɛ] | 1738 → **1556** | no — that vowel is the schwa of -es/-en/-er |
| morpheme-initial ⟨sw/dw⟩ → [w] (Donaldson) | net **exactly 0** | no — see below |
| referee-notation folds (ɦ~h, æ~ɛ, ɐ~a, ʋ~v) | +25 | yes |
| ⟨sw⟩/⟨dw⟩ onset fold | +5 | yes |

⚠ **Leave-one-out, re-measured in review** (each fold removed from the final 1745 config —
the honest per-fold contribution, since folds interact):

| fold | without it | contributes |
|---|---|---|
| ɦ~h (rename) | 1734 | **+11** |
| ⟨sw/dw⟩ onset | 1740 | **+5** |
| æ~ɛ | 1739 | **+6** |
| ɐ~a | 1740 | **+5** |
| ʋ~v | 1740 | **+5** |
| ⟨-heid⟩ h | 1744 | **+1** |

These sum to more than the total because they overlap; the config-level truth is the
1708 → 1745 delta. The first draft of this PR reported +25/+30 from single-fold
measurements taken against different baselines — corrected here.

**The sw/dw case is the instructive one.** The engine rule is linguistically correct
(Donaldson: /v/ is [w] after an obstruent) and it measured net zero — it fixed six words
and broke six. Reading them explains why: the referee writes `swaar, swart, swyn, Swede,
dwaal` with [sw] and `swaan, sweep, sweet, swembad, swaartekrag, dwarsoor` with [sv], in
the same environment. That is referee inconsistency, so the answer is a FOLD, not an
engine rule — the engine keeps its simpler [v] and the eval stops scoring a coin flip.

**Result: 76.9% → 78.6% folded, 93.9% → 94.3% symbol.** Of that, +30 is folds (the eval
learning what this referee cannot adjudicate) and +6 is engine (three loan suffixes).

**What the remaining 476 misses are** (single-symbol repair tally, after the new folds):
ə↔ɛ 36+18, ɑ↔a 28+13, ə↔i 9+7 — i.e. reduction and length, bounded at +45 by the oracle;
then f→v 13 and d↔t 14, which are morpheme-seam voicing (aan·dete, ad·vies), the one
class with real headroom left and no prosody involved. Anyone continuing here should
start with the seam, not with stress.

## Run 5 — 2026-08-08 (review of PR #771)

Six findings, all fixed. The one that cost a word:

- **The ⟨-heid⟩ fold was DEAD.** Folds apply in sequence, and the new `ɦ→h` rename runs
  first, so a `ɦ(?=əit)`-keyed pattern could never match — the rewrite to `h(?=əit)` that
  was supposed to accompany the rename silently failed to apply (an exact-string replace
  that missed). Revived: **1744 → 1745**, and the ordering dependency is now written into
  both the rule's own note and the file header.
- The ⟨sw/dw⟩ note claimed "+12 measured" — 12 is the size of the *environment*; the fold
  contributes **+5**. Corrected, and every fold note now carries a leave-one-out number.
- The header's fold inventory listed only the pre-existing folds and still advertised the
  -heid rule as live. Rewritten to list all of them in application order.
- `stressFinalSuffixes` was no longer longest-first, contradicting its own comment three
  lines above (inert today — `byLen` sorts at build time and both patterns are anchored —
  but the comment asserts an invariant a later append would trust). Reordered.
- The ⟨sw/dw⟩ lookbehind is word-initial, not morpheme-initial as its note said: the
  backbone strips ˈ and the syllable dots before folds run, so there is no seam to anchor
  on and `verdwyn` keeps its miss. Wording corrected rather than the pattern widened.

Final: **1745/2220 (78.6%), symbol 94.3%.**

## Run 6 — 2026-08-08 (the morpheme seam — Run 4's "one class with real headroom")

Command: reclassify the 475 folded misses by single-symbol repair, split the two seam classes
by hand, then A/B each candidate against the eval one at a time (`gained`/`lost` word lists,
not just the total).

**THE HEADLINE FINDING — half the class was misfiled.** Run 4 tallied `f→v 13` and `d↔t 14`
and called both "morpheme-seam voicing (aan·dete, ad·vies)". Reading the 17 f→v rows (the
count is 17 at the current fold config, not 13):

| | |
|---|---|
| f→v | **not a seam at all.** Every row is word-initial or prefix-initial ⟨v⟩: *vesel, vriend, vulkaan, voorouer, van, verdraagsaam, slavin, universiteit*. Afrikaans ⟨v⟩ is /f/; the referee writes **[f] 184 times and [v] 13** for word-initial ⟨v⟩, and writes *ver-* both ways (fərbiəldəŋ beside vərdrɑχsɑm). Referee noise. |
| | And it is **not foldable either** — ⟨w⟩ is [v] and ⟨v⟩ is [f], so f~v is a live contrast (*wat* ≠ *vat*). Folding it would blind the eval to one of this language's four signature segments. **Nothing to do here; 17 words are simply lost.** |
| d↔t | real, and three different mechanisms wearing one label. Split below. |

Taking the d↔t rows apart (13 `d→t` + 10 `t→d`, plus 13 `t→∅` that turned out to belong with
them):

1. **The regressive trigger was written over LETTERS.** `"ptksfcgx".includes(next)` — a
   spelling-level restatement of "voiceless" that had drifted from the grapheme table it
   mirrors. ⟨v⟩ is [f] and ⟨q⟩ is [k], so neither devoiced a preceding ⟨d⟩ and `advies` read
   **[adfis]**: a voiced stop against a voiceless fricative, which Afrikaans does not have.
   Derived from `fixed` + a new `voicelessPhones` list instead. **1745 → 1746** (advies), 0 lost.
2. **A vowel-initial SUFFIX resyllabifies, and a coda rule cannot reach a segment that is no
   longer a coda.** send·ing is *sen·ding* [sɛndəŋ], not *[sɛntəŋ]. Each morpheme is phonemized
   independently, so the stem was devoicing at every seam. **1746 → 1750**, 0 lost
   (sending, skoolvoeding, verbeelding, volharding; *voeding* still misses on its f→v).
   ⚠ Implemented as a CLOSED LIST (`resyllabifyingSuffixes`), not a "next part starts with a
   vowel" test, and that distinction is load-bearing: a vowel-initial compound ELEMENT is its own
   prosodic word and the stem DOES devoice in front of it — the referee writes aandete [ɑntiətə],
   bandopnemer [bantɔpniəmər], bloedoortapping [blutuərtapəŋ]. The list is the three tails the
   splitter actually produces at a voiced-obstruent seam in 2220 words (⟨ing⟩ ×5, ⟨ers⟩ ×1,
   ⟨eer⟩ ×1), all corroborated. A fourth environment, ⟨ana⟩ in *bandana*, was deliberately NOT
   listed — not a suffix, just a loanword the stem splitter tore in half.
3. **Seam degemination**, and the guard on it is the interesting part. A ⟨d⟩ against a following
   /t/ or /d/ surfaces as one consonant and the ONSET is what survives — veld·tog [fɛltɔχ],
   land·dros [land**r**ɔs] (voiced! it takes the onset's voicing, so this is deletion of the coda,
   not a merge), be·stand·deel [bəstandiəl], wild·tuin [vəltœin]. Tried UNCONDITIONALLY over
   coronal stops first: **+5 / −1**, and the −1 is *groottoon* → the referee writes `χrʊət.tʊən`,
   a true geminate. Restricting the coda to spelled ⟨d⟩ — the stop Auslautverhärtung has already
   neutralized, so it has no contrast left to protect, unlike an underlying /t/ — makes it
   **+5 / −0**. **1750 → 1755.** Keyed on the SPELLING because after phonemization both are [t].

**Result: 78.6% → 79.1% folded (1745 → 1755), symbol 94.3% → 94.4%. Floor 0.76 → 0.78.**
Ten words, zero regressions, all three rules measured separately.

**What is left of d↔t is NOT voicing — it is COMPOUND SPLITTING.** Nine of the original 13 `d→t`
rows never reach a seam because there is no seam: the rule is correct and has nothing to fire at.
Causes measured one word at a time:

| word | why it does not split |
|---|---|
| erdwolf, wedloop | `splitCompound` requires a head of **≥4 letters** (`i >= 4`), so *erd*/*wed* are never tried |
| noordwaarts, suidwaarts | *waarts* is not in af-stems.txt |
| handhaaf | *haaf* is not in af-stems.txt |
| bandopnemer, bloedoortapping | *opnemer* / *oortapping* are not in af-stems.txt |
| strydwa | the tail *wa* is 2 letters, below `minTrailingConstituent` 3 |
| aandete | the stressed-prefix strip runs BEFORE `splitCompound`, and *dete* IS in af-stems.txt (a frequency wordlist carries fragments), so `realWordStressedPrefixes` is satisfied and *aan·dete* wins |

⚠ **and the aandete case had been documented as already fixed** — afrikaans.ts, afrikaans.jsonc
and morphology.ts all cited *aand·ete → ɑnt·iətə* as the worked example of seam devoicing, and
morphology.ts claimed its `realWordStressedPrefixes` guard was what saved it. It never did.
Comments corrected in all three (the example is now huis·deur, which is real).

Measured the fix rather than guessing at it: trying `splitCompound` before the stressed-prefix
strip is worth **exactly +1 word in af** (aandete), 0 lost — but `germanicMorphology.ts` is
SHARED with nl/de, so a +1 reordering of the fleet's decomposition is not a trade worth taking
blind. Left alone and written down. Anyone picking this up should do it as a measured af-only
config flag, together with the `i >= 4` head floor and the af-stems gaps, and score nl/de too.

**Next lever, in order of measured size:** (1) the ə↔ɛ / ɑ↔a reduction-and-length residual, still
the largest class and still bounded at ~45 by the Run 4 oracle; (2) compound-splitting coverage,
~9 words visible from the seam alone; (3) nothing in f→v, ever.

## Run 7 — 2026-08-08 (3-letter compound heads: measured, and REJECTED)

Run 6 named the ≥4-letter leading-constituent floor (`i >= 4` in `splitCompound`) as one cause of
the unsplit seam words. Question: **what breaks if 3-letter heads are permitted, and can an
explicit list keep the wins without the breakage?**

**The floor is load-bearing, not caution.** Dropping it to 3 outright: **1755 → 1634, +33/−143.**
The stem lexicon is a 53k *wordlist*, so every three-letter word in it becomes a compound head and
ordinary vocabulary shatters — bak·kie, dog·ter, ven·ster, sui·ker, don·ker, bot·tel, sus·ter.

**An explicit list looked like it worked.** A `shortHeads` config, measured two ways:

| list | folded | |
|---|---|---|
| chosen from VOCABULARY — 20 common 3-letter stems | 1762 | +10 / **−3** |
| attested only — every head with a correct scoring instance | **1764** | **+9 / −0** |

The vocabulary list's three losses were instructive on their own: **⟨man⟩ tore *mantel* to man·tel**
and **⟨kop⟩ tore *kopende* to kop·ende**, real words the wordlist happens to contain. Choosing the
list on linguistic grounds and measuring second is what exposed them.

**And then the review measured the thing the referee cannot see, and it is why this is reverted.**
The referee is 2220 words. **af-stems.txt is 53,344.** Diffing `phonemizeWordRules` over the whole
stem list against `HEAD~1` — the harness this run should have built first — gives **444 changed
words**: 301 from the seam rules (Run 6; spot-checked and almost uniformly right) and **143 from
`shortHeads`, most of them regressions the +9/−0 could not see**:

| head | off-referee damage |
|---|---|
| ⟨reg⟩ ×22 | reg·ter rɛχtɛr, reg·ina, reg·ion, reg·ard, reg·eer, reg·gekom **rɛχχəkɔm** — the exact ven·ster/dog·ter shatter class the floor exists to prevent |
| ⟨ent⟩ ×22 | **ent·jie ɛntki** — the split destroys the ⟨jie⟩→[ki] grapheme; also komm·ent·aar, wies·ent·hal, gele·ent·hede |
| ⟨sit⟩ ×18 | sit·ting **səttəŋ**, sit·ter, voor·sit·ter, baby·sit·ting — a spelled geminate with nothing to collapse it |
| ⟨bos⟩ ×13 | bos·sie **bɔssi**, bos·ses; the genuine bos·werker/bos·veld are right |
| ⟨een⟩ ×25, ⟨see⟩ ×19 | mixed — een·kant and see·bodem right, een·der and geko·nden·see·rde wrong |
| ⟨nag⟩ ×11, ⟨wed⟩ ×11, ⟨hut⟩ ×1 | essentially all right |

**Why it cannot simply be guarded, which is the actual finding.** The geminate class wants
"collapse identical phones at the seam" — sit+ting [t]+[t] → sətəŋ, bos+sie [s]+[s] → bɔsi,
reg+gekom [χ]+[χ] → rɛχəkɔm. But **groot·toon is also [t]+[t] and must NOT collapse** (referee
`χrʊət.tʊən`), and it is the word that already forced the ⟨d⟩-coda restriction in Run 6. The two
are indistinguishable to the splitter:

```
sitting     sit·ting     kinds = stem,stem
groottoon   groot·toon   kinds = stem,stem
```

Separating them needs a compound-seam / derivational-seam distinction that `kinds` does not carry
(the af splitter labels every part "stem", because the tails come from the wordlist, not the suffix
list). That is a real project, not a guard, so **`shortHeads` is reverted in full** — the shared
`MorphologyConfig` field, the af manifest list, and the test.

**Kept from this run:** the ≥4 floor now carries its measured justification in the core, and the
comment claiming `dontSplitKnownWords` is "(nl/af)" is corrected — only nl sets it, and it was
measured for af and rejected at −17 back in Run 4, which is also now written where it is read.

**THE DURABLE LESSON, and the reason this run is worth keeping in full: a `+N/−0` on the referee
is not a regression test.** The referee is a 2220-word dictionary sample; the language's own stem
list is 53k. A change that touches decomposition can be clean on the referee and wrong on 143
words nobody looked at. **Diff the stem list before believing the score.** That harness is three
lines and belongs in any run that touches the splitter:

```bash
git worktree add /tmp/af-base HEAD~1     # phonemize af-stems.txt in each, then diff
```

## Run 8 — 2026-08-08 (review of PR #772)

Seven findings. Three (geminates, ⟨jie⟩, the off-referee shatter class) were all one root cause and
are resolved by the Run 7 revert above. The rest:

- **`dontSplitKnownWords` is documented "(nl/af)" and af never sets it.** True, and it is why
  `sitting`/`regter` were tearable at all. Corrected in the core, with Run 4's −17 measurement
  recorded at the point of use so the next reader does not re-try it blind.
- **The `raadgewer` test did not test what it claimed.** `decompose("raadgewer")` returns ONE part —
  there was no seam, the [t] came from the intra-morpheme regressive rule, and the "a vowel-initial
  compound ELEMENT does not block devoicing" decision had **no coverage at all**. Re-pinned on
  `bloedarm` (bloed·arm → blutarm) and `handomkeer` (hand·om·keer → ɦantɔmkiər), both of which
  actually split, with the decomposition asserted alongside the IPA so it cannot silently stop.
- **"Derived from `fixed`, so the two cannot diverge again" was overstated.** The trigger is
  `fixed` ∩ `voicelessPhones`, and `voicelessPhones` is hand-written — a new single-letter grapheme
  whose phone nobody adds there drops out of the trigger silently, which is the old `"ptksfcgx"`
  failure mode relocated one file over. The derived set's CONTENTS are now asserted as a set in the
  tests; that assertion, not the derivation, is the guard. Wording corrected in both files.
- `minHead` hardcoding "shortHeads are exactly 3 letters" — moot, reverted with the feature.

**Final: 1755/2220 (79.1% folded), symbol 94.4%, floor 0.78.** The seam work stands; the splitter
work does not.
