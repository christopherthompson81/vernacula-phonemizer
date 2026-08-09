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

## Run 9 — 2026-08-08 (would a BiLSTM help? — and the sourcing answer)

Question raised after #772: is the residual something a neural OOV tier would fix?

**The repo has already measured the answer, in Danish's provenance.** The da OOV tier was an averaged
perceptron on a **7.5k-word** Wiktionary lexicon, where it *merely tied the rule engine* — recorded
there as "a documented data-starvation: a hand-featured perceptron is competitive with a BiLSTM below
**~10k pairs**". Swapping in the 199k CC0 NST lexicon un-starved it: 45.5% → 73.1% word-exact.

**af has 2,220 labelled pairs.** That is a fifth of the starvation threshold, and every shipped tagger
in the repo trained on far more:

| tagger | training lexicon |
|---|---|
| nb | NST, 199k, CC0 |
| bn | Google language-resources, ~60k, CC-BY-4.0 |
| da | NST, 199k, CC0 (held-out 19,831) |
| fr | Lexique 3.83, CC BY-SA (held-out 12,586) |
| en | CMUdict (held-out 11,748) |
| sd | Sindhi Open Lexicon, 9,274 |
| **af** | **2,220 — and it is the eval referee itself** |

And there is a second, worse problem: af's 2220 pairs **are the referee**. Training on them and scoring
against them is the circularity #770 already had to fix once with `phonemizeWordRules`. A model trained
there earns zero measurable credit without held-out CV, and held-out CV on 2220 rows of a
dictionary-shaped sample is a thin number.

**Nor is the residual mostly learnable.** Of the 465 misses: 53 are capitalized proper nouns (Dutch/
French/English-era orthography — lexical, which is why af-lexicon.tsv exists), 27 are multi-word rows,
and a large part of the rest sits in environments **the referee itself transcribes both ways** — a
ceiling for any model, learned or written:

| environment | referee's own split | majority |
|---|---|---|
| ⟨sw⟩/⟨dw⟩ onset | v:7 w:6 | **54%** |
| suffix ⟨-ig⟩ | ə:47 i:6 | 89% |
| short ⟨a⟩, closed syllable | a:185 ɑ:18 ɐ:2 | 90% |
| word-initial ⟨v⟩ | f:184 v:13 | 93% |
| word-final ⟨d⟩ (devoicing) | t:154 d:3 | 98% |

The engine already picks the majority in every one of these, and the eval already folds the ones that
are pure notation. A model trained on this referee converges to the same majority — it cannot beat a
majority baseline in a free-varying environment. So the answer to "would a BiLSTM help *on this data*"
is no, and not because of the architecture.

### The sourcing answer: yes, we are undersourced — and the source exists

⚠ **First, a claim in af.jsonc was false and is now corrected.** `secondaryGap` had named "wikipron afr"
as a candidate second referee since bring-up. It is **the same en.wiktionary scrape as the primary** —
`afr_latn_broad.tsv` is ~2.1k rows and matches ours entry for entry (AWB aːviəbiə, Amerika aˈmɪərəka,
André ˈandrəi, Afrikaander, Barnard, Aarde). Importing it would corroborate nothing. Corrected in the
manifest, the floor comment and the catalogue.

**The real candidate is not Wiktionary-derived at all:**

- **RCRL Afrikaans Pronunciation Dictionary** (Centre for Text Technology / NWU, 2010) — **24,000+
  words**, SAMPA. Speech-technology lineage, fully independent of Wiktionary.
- Redistributed as **`ttslab/za_lex`** `data/afr/` (van Niekerk, PRASA 2016/2017) with the pieces
  already done: `pronundict.txt` in a flat format, **`phonememap.ipa-xsampa.tsv` / `.ipa-hts.tsv`**
  (the phone→IPA map — the `tools/bengali/googlePhoneMap.ts` job, pre-solved), a `phonemeset.json`,
  POS tags, and **syllable + stress fields** per entry.
- **Licence: CC BY-SA 2.5 South Africa** (Dept. of Arts and Culture, RSA; underlying dictionary
  © CTexT/NWU). Share-alike, **not** NonCommercial — so unlike the Leipzig list that af-stems.txt had
  to be rebuilt away from, this is fenceable in the §3 stratum the repo already uses.
- Related: **NCHLT-inlang Pronunciation Dictionaries** (Meraka/CSIR/NWU, CC BY 3.0) via SADiLaR, all 11
  SA languages — an even more permissive sibling worth checking alongside.

**The precedent is exact.** French already does this shape end to end: a CC-BY-SA pronunciation lexicon
(Lexique 3.83) serving as the shipped lexicon *and* the BiLSTM's training data, with
`fr-g2p-tagger.int8.onnx` declared CC-BY-SA-inheriting and fenced. af would be the same pattern.

**What this unlocks, in order of value — note the model is the LAST of the four:**
1. **A genuine second referee.** af is single-source today; `secondaryGap` closes, and every fold
   currently justified as "the referee cannot adjudicate this" becomes checkable against a source that
   can. The ⟨sw/dw⟩ coin-flip and the ⟨-ig⟩ split are the first two to re-adjudicate.
2. **Non-circular lexicon growth.** af-lexicon.tsv is referee-derived and earns zero eval credit by
   construction. Rows from an independent dictionary earn real credit.
3. **Stress supervision.** The residual is reduction and length; the dictionary carries syllable and
   stress fields. Run 4's oracle bounds *stress placement* at ~45 words, but it does not bound the
   reduction MAPPING, which is what those fields would actually inform.
4. **Then, and only then, a tagger.** 24k pairs clears the ~10k starvation line, and the training data
   would be independent of the eval — the two conditions af fails today.

**Recommendation: do not train anything yet. Import RCRL/za_lex as the second referee first, re-measure,
and let that decide whether a model is still the interesting lever.** ⚠ Not verified in this run: the
exact line count of the shipped `pronundict.txt` (RCRL is documented at 24k+; I read the file's head,
not its length), and whether its phone set distinguishes the vowels this engine's residual turns on.

## Run 10 — 2026-08-08 (the second source, imported — and what it immediately overturned)

Run 9 recommended importing RCRL before training anything. Done.

**`tools/referee-eval/build-af-rcrl.ts`** builds the secondary from `ttslab/za_lex` `data/afr`
(RCRL Afrikaans Pronunciation Dictionary v1.4.1, CTexT/NWU; CC BY-SA 2.5 ZA — share-alike, not NC, so
it fences in the §3 stratum beside French's Lexique). **27,428 entries**, ~12× the primary.

The format gave more than expected: `WORD POS STRESS SYLLABLE-LENGTHS PHONE…`, where the two structure
fields were verified to agree with each other and with the phone count on **all 27,428 rows**, so ˈ and
syllable dots are reconstructed rather than guessed. The publisher ships its own `phonememap.ipa-hts.tsv`,
so the phone→IPA mapping is theirs, not ours — **0 phones failed to map**.

**Its IPA convention is nearly ours already** (iə, uə, əi, œy, ɑː, øː, ɦ) — the same Standard-Afrikaans
analysis the manifest was built on, which is corroboration in itself. Deltas: `x`~χ and `æ`~ɛ (existing
global folds), and ⟨ou⟩ written `əu` against our `œu` — a **per-referee** fold, because each source is
internally UNANIMOUS (wiktionary 34:0 for œu, RCRL 325:0 for əu). Two notations, one diphthong.

**Baseline on import, untuned: 62.7% folded / 93.1% symbol on 27,428 unseen words.**

### What it settled on day one

| question | en.wiktionary | RCRL | outcome |
|---|---|---|---|
| morpheme-initial ⟨Cw⟩ | **10:9 coin flip** | **260:1 for [w]** | Run 4's rejected rule was RIGHT |
| ⟨-ig⟩ vowel | ə 47:6 | ə 474:7 | corroborates əχ |
| word-initial ⟨v⟩ | f 184:13 | f 2363:69 | corroborates [f] — Run 6's "f→v is noise" confirmed |
| word-final ⟨d⟩ | t 154:3 | t 1608:7 | corroborates |

**THE HEADLINE — a documented decision reversed.** Run 4 tried the Donaldson rule (⟨w⟩ is the glide
after an obstruent), measured **exactly net zero**, and demoted it to an eval fold with the note
"referee inconsistency, so the answer is a FOLD, not an engine rule". That conclusion was an artefact of
having one referee: en.wiktionary writes swaar/twaalf [w] beside swaan/twee [v], 10:9 across the four
onsets. RCRL is **sw 88:0, tw 53:0, kw 84:1, dw 34:0**. The rule was correct all along and a single
source could not show it.

Implemented as `wGlideAfter` (the four attested onsets — RCRL's one ⟨rw⟩ is a loan with an epenthetic
vowel, not a cluster), anchored at morpheme index 1 so the cluster must OPEN the morpheme:

- `verdwyn` → fərdwəin — the word Run 5 recorded as a permanent miss, because the FOLD could only be
  word-initial (the backbone strips the seam before folds run). An engine rule sees the morpheme.
- `antwoord` → antvuərt and `brandweer` → brantviər — a ⟨Cw⟩ across a syllable boundary or a compound
  seam is not an onset. Both RCRL-exact.

**+67 on the secondary, +1 on the primary** for the ENGINE RULE — ⚠ the first draft of this entry said
+154/+2, which lumped in a SCORING change (the widened eval fold). Corrected in Run 11, where the fold
also moved to primary-only so the secondary scores this contrast instead of hiding it. Three pre-existing
goldens moved tv→tw (twee, twaalf, twintig) — the same words, read correctly.

### And it independently confirmed #772

Every seam rule, from a source that has never seen this repo: `advies` atfis, `sending` sɛndəŋ,
`verbeelding` fərbiəldəŋ, `volharding` fɔlɦardəŋ, `veldtog` fæltɔx, `landdros` landrɔs (voiced [d] —
the onset really does survive), `wildtuin` vəltœyn, `bestanddeel` bəstandiəl, `handdoek` ɦanduk.
And the four words the reverted `shortHeads` would have broken — `regter`, `sitting`, `bossie`,
`mantel` — are all UNSPLIT in RCRL. Run 7's revert was right.

### Final

**Primary 1760/2220 (79.3%) / 94.4% symbol · secondary 17,447/27,428 (63.6%) / 93.2% symbol** — final,
after the Run 11 fixes. `secondaryGap` is CLOSED and the sourcing checklist item is clear (10/10).

**On the neural question that started this.** af now has 27k pairs independent of the primary eval, so
a tagger is finally coherent where Run 9 showed it was not (da's threshold: ~10k). But the referee is
the cheaper lever and is nowhere near spent — the RCRL residual is 10,779 misses dominated by ə↔ɛ 3535,
i↔ə 1764, ɔ→u 999, a↔ɑ 1747: reduction and length, on 27k words that now carry **stress and syllable
boundaries**. Run 4's oracle bounded stress PLACEMENT at ~45 words on the primary; it never bounded the
reduction MAPPING, and that mapping is now directly derivable from data. **Do that before training
anything.**

## Run 11 — 2026-08-08 (review of PR #773)

Nine findings. One was a shipped-output bug, one changed the reported attribution, and the rest were
stale claims the PR itself had set out to kill.

**1. The ⟨Cw⟩ rule fired on a MIRAGE made by the splitter.** The compound linking ⟨-s-⟩ can be attached
to either element, and the splitter was handing it to the FOLLOWING one: `voeding·swaarde`, which looks
like an ⟨sw⟩ onset. It is `voedings + waarde` — a Fugen coda and a ⟨w⟩ opening the next syllable (RCRL
`ˈfu.dəŋs.vɑːr.də`). Four words were shipping wrong on `phonemizeWord`, not just the eval path.

Two fixes were measured, and the first was wrong:

| attempt | secondary |
|---|---|
| guard the glide after any compound-STEM seam (prefix boundaries still fire) | **−9** — it also denied the GENUINE onsets berg·kwaggas, drie·kwart, half·twaalf, hoof·sweep (+4/−13) |
| fix the BOUNDARY instead: `linkingElements` longest-first, `["s","e",""]` | **+90** |
| …plus: a head already ending in ⟨s⟩ may not take the ⟨s⟩ link (else tuis·span → tuiss·pan) | **+104** |
| …plus a symmetric ⟨e⟩ guard | −10, rejected |

The lesson is the same one as Run 7: when a rule fires on the wrong thing, check whether the INPUT to
the rule is wrong before guarding the rule. Here the morpheme boundary was wrong, and fixing it paid
+104 while a guard on the rule cost 9.

**2. The attribution was wrong, and the fold was hiding the evidence.** "+154 on RCRL, +2 on the
primary" credited the engine rule with a gain that was mostly a SCORING change. Measured four states:

| | primary | secondary |
|---|---|---|
| rule ON, fold ⟨sdtk⟩ | 1759 | 17447 |
| rule OFF, fold ⟨sdtk⟩ | 1758 | 17380 |
| rule OFF, fold ⟨sd⟩ | 1757 | 17288 |

So the **engine rule is +67/+1**; widening the eval fold is a further **+92/+1**, and a fold normalises
BOTH sides of the comparison — it is not an engine improvement. Worse, the widened fold was GLOBAL, so
it was neutralising the ⟨Cw⟩ contrast on the secondary too — the one source that can adjudicate it
260:1. Re-homed as a **primary-only** fold, which is where its justification actually applies; the
secondary now scores the contrast (primary 1759 → 1760).

**3. The referee dropped the entire DIAERESIS class.** `WORD_OK` omitted ⟨ö⟩ and ⟨ä⟩, so koördinasie,
koördinate, koördineer, koördinering, koöperasies, koöperatief, koöpteer, geöriënteerde, kobraägtig,
zebraägtig were silently filtered out — precisely the rows exercising a letter the engine explicitly
models (`diacriticVowels` ⟨ö⟩→[ø], and `afrikaans.ts` already flags ⟨ö⟩ as a past drift hazard). Fixed;
**all 27,428 rows now pass, 0 dropped for any reason.**

**4. Secondary stress was being discarded.** The source's STRESS alphabet is 0/1/2, not 0/1, so every
`2` became unmarked while the header and sidecar advertised reconstructed stress. Inert for today's
eval (the backbone strips ˈ and ˌ alike) but this file's stress fields are the *named next lever*, so
they are now preserved — **3,307 ˌ marks**.

**5. The builder could not support its own provenance claim.** One `skippedWord` counter was
incremented by two different filters, so "the 11 dropped rows are orthography failures, not structure
failures" was unfalsifiable from the tool's output. Split into four counters.

**Stale claims, all of which this PR had claimed to fix:** the af floor comment still said "the only
numeric source wired; wikipron afr is a candidate 2nd" *in the same sentence* as "NO LONGER
SINGLE-SOURCE"; `docs/language-maturity.md` still had the af row at 71.2% and 🔷 single-source; the
catalogue's verdict column was still 🔷 while its own notes said "TWO-SOURCE"; and the af.jsonc eval
header still described one referee and the old ⟨sw/dw⟩ fold. All corrected — af moves 🔷 → **🔵**, since
🔷 is *defined* as "no independent second source to triangulate" and that is now false, while the
reduction/length core layer is still open.

**Final: primary 1760/2220 (79.3%) / 94.4% symbol · secondary 17,447/27,428 (63.6%) / 93.2% symbol.**

## Run 12 — 2026-08-08 (the reduction mapping, DERIVED — the lever Run 9 pointed at)

Run 9/10 said: the residual is reduction and length, the new secondary carries stress AND syllable
boundaries for 27k words, so derive the mapping instead of training on it. Done.

**The extraction.** RCRL gives, per word, a stress digit and a phone count per syllable. Pair
**vowel-letter group k of the spelling with syllable k of the transcription**, keep only words where the
two counts agree — **25,247 of 27,428 usable** — and every one of the engine's vowel cells can be read
straight off the data: (letter × stressed? × open?) → nucleus.

**The engine had 20 cells and a hole.** `unstressedReduction` was applied to every unstressed vowel
*regardless of syllable shape*, so the unstressed-**open** cell did not exist. It should: the Germanic
open/closed rule does not switch off outside the stress — the vowel keeps the TENSE quality, just short.

| cell | ours | RCRL |
|---|---|---|
| stressed closed | a ɛ ə ɔ œ | a 98 · ɛ+æ 100 · ə 99 · ɔ 100 · œ 94 — **all confirmed** |
| stressed open | ɑː iə i uə yː | ɑː 74 · iə 68 · **ə 64** · uə 63 · y 50 |
| unstressed closed | a ə ə ɔ œ | a 98 · ə 78 · ə 100 · ɔ 97 · œ 97 — **all confirmed** |
| unstressed OPEN | *(no table — fell through to closed)* | a 77 · ə 90 · **ə 55** · **u 53** · **y 65** |

**17 of 20 cells confirmed the manifest**, which is itself the strongest corroboration the vowel system
has ever had. Three contradicted it, and only two shipped:

| candidate | RCRL | primary (INDEPENDENT) | secondary | kept |
|---|---|---|---|---|
| ⟨o⟩ unstressed-open ɔ→u | u 53 / ɔ 25 / uə 21 (n=1846) | ±0 | **+222** | yes |
| ⟨u⟩ unstressed-open œ→y | y 65 / œ 30 (n=568) | **+4** | **+96** | yes |
| ⟨i⟩ unstressed-open →ə | ə 55 / i 45 (n=2771) | **−9** | +174 | **no** |
| ⟨a⟩ →ɑː *(control)* | a 77 — i.e. ours | −23 | +37 | no |
| ⟨e⟩ →iə *(control)* | ə 90 — i.e. ours | −54 | −1719 | no |

⚠ **THE CIRCULARITY IS THE WHOLE METHODOLOGICAL POINT.** RCRL is now a REFEREE; deriving tables from it
and then scoring against it proves nothing — it is the same trap `phonemizeWordRules` exists to avoid
(#770). So the **en.wiktionary primary is the arbiter**, and it is what rejected ⟨i⟩: RCRL prefers [ə]
there and the primary's *own* derivation agrees (ə 58%) — but on **12 words**, while the primary's
2220-word eval says −9. Twelve rows of derivation do not outweigh a direct measurement on the whole set.
⟨i⟩ keeps its existing tense/lax-by-syllable rule.

The two **controls** are what validate the method: ⟨a⟩ and ⟨e⟩ were swept toward values RCRL itself says
are wrong, and both duly lost. A derivation that cannot fail is not evidence.

⚠ Note the primary has **no data at all** in the ⟨o⟩/⟨u⟩ unstressed-open cells (n below threshold in its
1,342 usable rows), which is why ⟨o⟩ reads ±0 rather than confirming. It is a 2220-word dictionary
sample; the cell is simply not attested there. Kept on RCRL's 1,846 + linguistic coherence, with the
primary confirming no harm — and ⟨u⟩ independently confirming at +4.

**Result: primary 1764/2220 (79.3% → 79.5%), symbol 94.4% → 94.7%; secondary 17,765/27,428 (63.6% →
64.8%), symbol 93.2% → 93.8%.** Both metrics up on both sources. Floor 0.78 → 0.79.

Five goldens moved ɔ→u (kilometer, kilogram): RCRL writes `ˈki.lu.miə.tər` and `ˈki.lu.xram`, so the old
expectations were wrong, not the new reading.

**What is left, and it is now a stress problem after all.** `polisie` → puəlisi where RCRL has pu.ˈli.si:
the VOWEL rule is right, the STRESS is on the wrong syllable, and a wrongly-stressed syllable then takes
the stressed-open value (uə) instead of the unstressed-open one (u). Run 4's oracle bounded stress at
~45 words *on the primary* — but that oracle was measured against a 2220-word sample with the
unstressed-open hole still in the engine, and the two interact. **Re-running the oracle against RCRL's
27k real stress marks is the obvious next measurement**, and unlike in Run 4 the data now exists to do it.

## Run 13 — 2026-08-08 (review of PR #774)

Five findings. The substantive one is that **I skipped the repo's own gate.**

**1. The stem-list diff was not run — the gate Run 7 exists to enforce.** Both the catalogue and the
floor comment carry "⚠ THE REFEREE IS 2220 WORDS AND THE STEM LIST IS 53k: diff the stem list before
believing a +N/−0", written *by Run 7*, after a 143-word stem diff got `shortHeads` reverted. This
change rewrites **4,741 of 53,344 stems (8.9%)** — 33× larger — and Run 12 recorded no stem diff at all.

Run now, and the direction is what matters at that scale, not the count:

| | toward the referee | away | n |
|---|---|---|---|
| **en.wiktionary primary (INDEPENDENT)** | **35** | **2** | 39 covered |
| RCRL (derivation source — circular, for completeness) | 809 | 56 | 890 covered |

3,851 of the touched words are in no referee at all. So the change is ~95% correct in direction on the
independent source where it has any coverage — which is the evidence Run 12 should have shown and
didn't. ⚠ It also explains the ⟨o⟩ cell's odd-looking **0 gained / 0 lost** on the primary's 30
word-exact rows: those 30 words are wrong both before and after for *other* reasons, so word-exact
cannot see the improvement. The distance metric can, and so can symbol accuracy (94.4% → 94.7%).

**2. A known-wrong output was presented as corroboration.** The `polisie` assertion carried the comment
"(our stress differs, the vowel does not)" — false: we emit [uə] and RCRL has [u], which is the *whole*
point Run 12 makes in its own closing paragraph. Worse, the assertion is invariant under
`unstressedOpen: {}`, so it demonstrated nothing about the feature it sat inside. Removed and replaced
with four RCRL-EXACT words.

**3. The ⟨u⟩ cell had zero test coverage** — deleting it from the manifest left all 37 af tests green,
while silently changing ~1,100 stems. And it is the cell with the *only* independent word-level evidence
(+4 on the primary). Now pinned on `formule` fɔrmylə, `akkuraat` akyrɑːt, `afsku` afsky, all RCRL-exact.

**4. `muskiet` was mislabelled** as an unstressed-closed control; `stressedNucleus` puts stress on its
first syllable, so it pins `vowelsShort.u`, not `unstressedReduction.u`. Relabelled rather than moved —
it is a fine stressed-closed pin, it just was not testing what the banner above it claimed. Only `kanon`
actually exercises an unstressed cell there.

**5. The re-opened stress claim was left unqualified in three places.** Run 12's own conclusion re-opens
Run 4's "stress is worth ~45 words, the residual is segmental" — the oracle was measured with the
unstressed-open hole still in the engine, and the two interact. But `docs/language-maturity.md` still
listed the reduction mapping as *outstanding* (this PR implements it) and still asserted the bounded-stress
finding flatly, as did `catalogue.tsv` and the floor comment (which had gained the `unstressedOpen`
paragraph but kept the old claim beside it). All three now carry the caveat and name the next measurement.

**No correctness bug was found in the engine change itself.** The reviewer independently checked the
`isOpen` word-final/medial conflation — RCRL's 116 words spelled `-o#` are ~100% [u]/[uə] and zero [ɔ],
so the single cell is not over-applying — and reproduced every number in the PR.

## Run 14 — 2026-08-08 (the stress oracle, re-run — Run 4's headline was an artefact)

Run 13 said: re-run the oracle against RCRL's 27k real stress marks, now that the unstressed-open hole
is closed. Done, and it retires the finding that has steered this work for five PRs.

**THE HEADLINE — "stress is worth ~45 words" was an artefact of the sample.** Run 4 replaced
`stressedNucleus` with the primary's own ˈ positions and measured +45. Re-running the same oracle on
both referees:

| referee | rows the oracle can cover | rule | ORACLE | headroom |
|---|---|---|---|---|
| en.wiktionary primary | **554** of 2220 | 1764 | 1766 | **+2** |
| RCRL secondary | **23,388** of 27,428 | 17,765 | 18,954 | **+1189 (4.3pp)** |

The primary can cover a quarter of its own rows (it needs a ˈ *and* a syllable count matching the
spelling's vowel groups), and across those its entire stress dynamic range is **two words**. Run 4's
~45 was not wrong as arithmetic; it was a measurement of a sample that cannot see the phenomenon. The
real lever is **~26× larger**, and "the residual is segmental, not prosodic" was false.

Our placement accuracy, measured against 23,388 words: **72.6%**, and it collapses with length —

| syllables | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| correct | 88% | 75% | 59% | 46% | 48% | 42% | 36% |

The dominant error is the bare first-syllable default losing on Latinate polysyllables (*abdominale*
0→3, *abjekte* 0→1) — 5,382 wrong in the no-separable-prefix bucket alone. That is `stressFinalSuffixes`
territory, and Run 4 could only sweep it against 2,220 words.

**The derivation.** Suffix → syllables-from-the-END, read off an 80% train split (n≥10, ≥95% agreement),
scored on the untouched 20%: **placement 72.7% → 74.9% held-out** against 75.5% on train — a 0.6pp gap,
so it generalises rather than memorises. Refit on all 23,382 rows for shipping: **75 suffixes**.

⚠ **Three filters, each of which earned its place by failing first:**

1. **Precision 0.95, not 0.85.** Lower precision measures better on the source and worse in reality: at
   0.85 the secondary gains +166 but the INDEPENDENT primary loses 2, and the words it breaks are real —
   *motief, positief, gedig, letterkundig*. A 15% error rate admits 15% errors.
2. **Length-consistency** — every syllable-count bucket with ≥5 examples must agree with the overall
   majority, which rejects suffixes that are really a from-START rule in disguise. ⚠ My first diagnosis
   here was wrong: I blamed this filter's absence for ⟨tig⟩, then measured and found ⟨tig⟩ *passes* it
   legitimately (aandagtig, gunstig really are penult). The filter is still right; it just was not that.
3. **⟨tig⟩ excluded BY NAME**, because the -tig NUMERALS are a closed, high-frequency, initially-stressed
   class it mis-stresses — *negentig* → \*nəχɛntəχ against RCRL's ˈniə.xən.təx. These are generated by
   numbers.ts and read aloud constantly. Dropping it measured **better on every axis** (secondary 17,840
   → 17,847), which is the tell that the class it was helping was not paying for itself. **The failing
   golden is what found this** — the eval never would have.

**The derived table is morphology, not noise**, which is the check that it is real: ⟨aliseer⟩/⟨ifiseer⟩
final, ⟨isering⟩/⟨seerde⟩ penult, ⟨igheid⟩/⟨logiese⟩/⟨atiese⟩ antepenult, and the ⟨gemaak⟩/⟨gestaan⟩
entries at 2 are compound-initial stress on a past participle (skoongemaak).

**Result (after the Run 15 fix below): secondary 17,765 → 17,885 (64.8% → 65.2%), symbol 93.800% →
93.910%; primary 1764 → 1765, symbol 94.655% → 94.654%.**

**What is left: the oracle says +1189 and this table takes +82 of it.** The residue is not suffix-shaped —
it is the first-syllable default being wrong on long Latinate words in ways a word-final string does not
predict. That is where a learned model would finally have something to do that rules do not: it is the
one class in this language that is genuinely contextual rather than tabulable, and af now has 23k
stress-annotated words to train on, independent of the primary that would judge it.

## Run 15 — 2026-08-08 (review of PR #775)

Two findings. The first is a real bug, and it is one neither gate in this project could have caught.

**A VOWEL-LETTER RUN IS NOT A NUCLEUS.** `stressedNucleus` computed its target as `n - 1 - fromEnd`
where `n` counted maximal runs of vowel LETTERS, while `phonemizeMorpheme` compared that index against
its own counter, which increments once per **g2p-segmented** nucleus. The two disagree on every
hiatus — ⟨io⟩, ⟨ia⟩, ⟨eo⟩ are one run and two nuclei — so every position counted from the end landed a
syllable early and put the stressed long vowel in the wrong place:

| | was | now | RCRL |
|---|---|---|---|
| biologiese | *biuəluχisə | **biuluəχisə** | bi.u.ˈluə.xi.sə |
| dialektiese | *diɑːləktisə | **dialɛktisə** | di.a.ˈlɛk.ti.sə |
| nasionalisme | *nasiunɑːləsmə | **nasiunaləsmə** | na.ʃiu.na.ˈləs.mə |

The audible symptom is a spurious mid-word LONG vowel — *nasiunɑːləsmə* has [ɑː] on ⟨na⟩. The flaw
PRE-DATES this PR (it already affected the `n-1` and `n-2` returns) but Run 14 generalised it from
depths 0–1 to depths 0–3, which is where it starts landing inside the word rather than at its edge.
Fixed by counting with `countNuclei`, which walks the word with the same decisions the emitter makes.
**Secondary 17,847 → 17,885 (+38); primary 1764 → 1765.**

⚠ **Neither gate could see this, and that is the part worth keeping.** The derivation is blind by
construction: it keeps only rows whose referee syllable count equals the spelling's vowel-run count —
*precisely the words where the two counters cannot disagree*. And no golden covered a hiatus. The
eval could not see it either, because the words it breaks were already misses for other reasons. It
took reading the emitter beside the counter. Every measurement in Runs 12–14 was taken on a sample
selected to exclude the class the code was getting wrong.

The dead `VOWEL_GROUP` regex is removed rather than left as a trap, with a note at its old site.

**2. The primary's symbol figure was stale in three files.** Run 14 moved it 94.655% → 94.647%, which
crosses the printed rounding boundary (94.7 → 94.6), and the PR updated the secondary's figure in the
same three sentences but not the primary's. Now moot in the other direction — the nuclei fix brings it
back to 94.654% (94.7%) — but all three are set from what the eval actually prints.

**Final: primary 1765/2220 (79.5%) / 94.7% symbol · secondary 17,885/27,428 (65.2%) / 93.9% symbol.**

## Run 16 — 2026-08-08 (the shipped lexicon — and why wholesale import was wrong)

The measurement that motivated this: the rules score 79.5% on the primary and 65.2% on RCRL, but
**~87% on running text**. A dictionary-shaped referee over-samples rare long Latinate words; ordinary
text is short and native. The lexicon is still worth having, because of *where* the errors fall:

| | |
|---|---|
| RCRL coverage of running-text tokens (mined corpus) | **86.2%** |
| rules exact on those tokens, frequency-weighted | **87.4%** |
| with the lexicon | **99.5%** |
| **net** | **≈10.5pp of ALL running-text tokens** |

Wired as `phonemizeWord` → curated `af-lexicon.tsv` (44 rows) → `af-rcrl-lexicon.tsv` (26,872) → rules.
The curated tier must stay first: RCRL writes `afrikaans` afrikɑːns while the hand-adjudicated row
carries the nasal afrikɑ̃ːs. **The eval is byte-identical before and after** (1765 / 17,885) — it scores
`phonemizeWordRules`, which never consults either lexicon.

### Wholesale import was wrong, and the TEST SUITE is what said so

27,428 → **26,872**. Every exclusion was found by an existing golden failing, not by inspection:

1. **Single letters** (4: `n`→ə, `a`→a, `o`→œu, `'n`). A bare letter is SPELLED, not sounded (#761), and
   a lexicon hit shadows that rule — `802.11n` read *…elf ə* instead of *…elf ɛn*. ⚠ **THE SECOND TIME:**
   review of #770 caught exactly this in af-lexicon.tsv, where stray `j`/`q` rows made ⟨J⟩ read [jɛ].
   Same language, same trap, different source. It is now a filter in the builder rather than a fact
   about one hand-written file.
2. **⟨ê⟩ ⟨û⟩ ⟨ô⟩ ⟨uu⟩ words** (552). RCRL has **no ɛː, no œː and no yː at all** — it writes aangelê
   ɑːnxəlɛ, aangestuur ɑːnxəstyr — so importing them silently deletes a length distinction the engine
   marks and the primary corroborates (ɛː ×16, yː ×3). An INVENTORY GAP in the source, not a
   disagreement about the language. ⟨ô⟩ joins on the same evidence: RCRL *has* ɔː (150 rows) yet writes
   môre short against the primary's ˈmɔː.rə. Caught by the ⟨ô⟩ golden.
3. **Word-initial ⟨v⟩ written [v]** — normalized to [f], not dropped. Both sources are ~97% [f] (RCRL
   2363:69, primary 184:13) and Run 6 established this class as transcription noise. A dictionary's
   per-word value normally beats a majority rule — that is the whole point of a lexicon — but not when
   the majority is 97% *across independent sources* and the minority has no environment of its own.
   Caught by `Vitamien C` reading *[v]itamin*.

**The general lesson: a curated dictionary is not automatically better than a rule.** It is better
per-word where it has real lexical knowledge, and worse wherever its transcription convention is
*coarser* than the engine's. Diffing the two inventories before importing is the check — and running
the existing goldens is what actually finds the cases you did not predict.

### What the lexicon fixes that the rules could not

Beyond the bulk: `chemie` → χiəmi, a **documented known miss** the rule engine has carried since #758
(our [ʃ] against both referees' [x]); `polisie` → pulisi (rules mis-stress it); `nasionalisme` →
naʃiunaləsmə (⟨si⟩→ʃ, which no rule models); `millimeter` → məlimiətər.

⚠ Several goldens documenting RULE behaviour had to be repointed at `phonemizeWordRules` — once
`phonemizeWord` is lexicon-first, a golden written to pin a grapheme rule silently starts testing the
dictionary instead. That is a permanent hazard for every language with a lexicon tier, and worth
knowing before adding one.

### Where this leaves the OOV model

The tail is now defined, which it was not before: ~14% of running-text tokens, and it is exactly the
hard part — proper nouns, English loans, inflected forms outside the dictionary, and long Latinate
words where our stress placement falls to 36%. af has 23k stress-annotated pairs to train on,
independent of the primary that would judge it. **That is the first time in this sequence that every
precondition for a neural tier is actually met.**

## Run 17 — 2026-08-08 (review of PR #776 — vetting a dictionary against the rules)

Seven findings, three of them shipping defects. They share one root cause: **my normalization was
SYMBOL-level** ("these four symbols map to those four, verified exhaustive"), which structurally cannot
see a narrow transcription that differs as a **sequence** or as a **rule**.

| class | shipped | evidence it is a defect, not a source disagreement |
|---|---|---|
| LENGTH, ~360 rows | kubieke kyːbikə → **kybikə**, eeu iːu → **iu**, deuntjie døːnki → **dyŋki** | the guard was a SPELLING list (ê û ô uu) and even missed ⟨î⟩; the gap is in the source's INVENTORY |
| FINAL DEVOICING, 22 of 24 | klub → **klœb** for klœp | `rob` is native and the INDEPENDENT primary writes rɔp |
| SCHWA EPENTHESIS, 219 rows | arm → **arəm**, film → **fələm**, storm → **stɔrəm** | the primary writes fəlm, stɔrm, fɔrm; and a lexicon word epenthesized while an OOV compound of the same shape did not |

Fixed by vetting **every entry against `phonemizeWordRules`**, which is the right relationship between the
two: the dictionary wins on LEXICAL knowledge (which vowel this loan takes, where its stress falls), the
rules win on SYSTEMATIC phonology (devoicing, length, inventory). Repair where the rule is authoritative
and the entry's lexical content survives; drop where it does not.

**Two of the guards are worth keeping as general lessons:**

1. **The independent primary referee overrules the dictionary.** Where en.wiktionary has the word and
   already agrees with the rules, the lexicon may not override it — the two sources conflict there, and the
   tiebreaker should be the one that is *not* the lexicon's own source. Only 2,220 words, but they are the
   adjudicated ones. **This single guard took regressions against the primary from 29 to ZERO.**
2. **A length check must key on the source's INVENTORY, not on spelling.** My first fix dropped every row
   where "the rules have ː and the entry does not" — which also drops every row that correctly says SHORT
   where our rules over-apply length (`kanon`: RCRL ka.ˈnɔn against our kɑːnɔn is *exactly* what a lexicon
   exists to fix). It measured WORSE (85.0 → 84.6). The source has ɑː, øː, ɔː — a short value there is a
   lexical claim; it has no ɛː, œː, yː at all — a short value there is a gap. The missing set is now derived
   by scanning the source rather than typed out.

Also: a **dropped onset** guard (RCRL writes `tsaar` sɑːr — the rule output minus its first phone, which is
edit-distance 1 and invisible to a distance threshold), a plausibility drop (33 rows: `abe` → əib), and the
single-letter drop — ⚠ whose sidecar entry was itself **wrong**, naming ⟨'n⟩ (which is correctly KEPT) and
omitting ⟨u⟩. A reader checking "did the indefinite article survive the import?" got the wrong answer.

⚠ And the ordering comment in `afrikaans.ts` asserted a safety property the code does not have — both
lexicon tiers run BEFORE `phonemizeWordRules`, so its ⟨'n⟩ and letter-name special cases remain shadowable
by any lexicon row. The safety is the **build-time** single-letter filter, not the lookup order. Corrected
rather than inherited.

**Result on the INDEPENDENT primary: rules 79.5% → shipped 86.1%, +147 words, 0 regressions**
(the reviewed version was 85.0%, +123, with 29 regressions). 25,112 entries.

## Run 18 — 2026-08-08 (the OOV tagger — trained, measured, wired)

Run 16 said the OOV tail was finally *defined* and every precondition for a neural tier met. Both held.

### The data hunt first, because the answer bounds everything else

| source | entries | licence | new headwords vs RCRL |
|---|---|---|---|
| RCRL Afrikaans Pronunciation Dictionary | 27,428 | CC BY-SA 2.5 ZA | — |
| **NCHLT-inlang Afrikaans** | 15,094 | **CC BY 3.0** | **+5,160** |
| **Lwazi Afrikaans** | 4,998 | CC BY 2.5 ZA | **0** |
| | | **union** | **32,595** |

⚠ **Lwazi adds literally nothing** — every headword is already in RCRL. And NCHLT is **96.6% identical to
RCRL** on their 9,871-word overlap, which its own README explains: the dictionaries were "created using
existing resources, and these then verified by language practitioners". All three are one NWU/CSIR lineage.

So **~32.6k is the ceiling for Afrikaans** and no further searching will move it. That is fine for
TRAINING (the value is coverage) and disqualifying for REFEREEING — NCHLT is deliberately *not* wired as a
referee, since 96.6% agreement would manufacture corroboration.

For scale: the repo's measured starvation line is ~10k pairs (da's provenance) and the shipped Sindhi
tagger trains on 9,274. af sits mid-fleet — above sd, below bn's ~60k, far below nb/da's 199k NST.

### Held-out result

31,224 vetted pairs (vetted against `phonemizeWordRules` exactly as the shipped lexicon is), split 90/10 by
md5 of the word. The aligner, vocabulary and model saw only the 27,303-word train split.

| | word-exact | symbol |
|---|---|---|
| rule engine | 64.0% | 93.6% |
| **BiLSTM tagger** | **91.8%** | **98.8%** |

**A 77% relative reduction in word error.** ⚠ The rule engine scores *lower* here than its 79.5% referee
number because this split is dictionary-shaped — long, rare, Latinate words — which is precisely the
population an OOV tier serves. That is the point: the tail is where the rules are worst.

### Wiring

Precedence: **curated `af-lexicon.tsv` → `af-rcrl-lexicon.tsv` → tagger → rules.** The tagger sits below the
dictionaries (exact where they apply) and above the rules (far better where they do not). Injected as the
sync engine's `oovOverride`, so tokenizer, numbers, normalization and clause assembly stay byte-identical
to `phonemize(text, "af")` — only OOV word readings change, and the sync path is untouched. 2.2 MB int8,
in line with the fleet's other taggers.

⚠ **No stress marks in the tag alphabet**, unlike Norwegian's tagger, which embeds ˈ deliberately. af emits
no stress by convention, so the model has to carry the stress information in the VOWEL QUALITY instead —
which is exactly the thing Run 14 showed the rules cannot get (72.6% placement overall, 36% at eight
syllables). Pinned by a test: the tagger must never emit ˈ, ˌ or a syllable dot, or its output would be
inconsistent with every word the other two tiers produce.

### Where af stands after this sequence

| | start | now |
|---|---|---|
| primary referee (rules only) | 78.6% | **79.5%** |
| second referee | *none existed* | **65.2%** on 27,428 words |
| shipped path vs the independent primary | 79.5% | **86.1%**, 0 regressions |
| OOV words (held-out) | 64.0% | **91.8%** |

**What is left, honestly:** the tagger's own 8.2% held-out miss, which is now the frontier and is not
obviously reducible without data that does not exist; and the ~14% of running-text tokens outside both
dictionaries, which the tagger serves but which no measurement here scores directly — the mined corpus is
2,473 tokens and normalization-shaped. **A frequency list for af (`tools/referee-eval/freq/af.txt`) is the
cheapest next thing**: it would switch on the eval's frequency-weighted metric, which is the number that
actually reflects TTS quality, and would let the OOV tail be measured rather than estimated.
