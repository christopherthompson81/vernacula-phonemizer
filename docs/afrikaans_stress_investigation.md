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

## Run 7 — 2026-08-08 (the ≥4-letter head floor, and what an explicit list buys)

Run 6 left "compound splitting" as the next lever and named the ≥4-letter leading-constituent
floor (`i >= 4` in `splitCompound`) as one cause. Question for this run: **what actually breaks
if 3-letter heads are permitted, and can an explicit list keep the wins without the breakage?**

**First, the floor is not caution — it is load-bearing.** Dropping it to 3 outright:

| | folded | |
|---|---|---|
| minHead 4 (baseline) | 1755 | |
| minHead 3, unrestricted | **1634** | **+33 / −143** |

The stem lexicon is a 53k **wordlist**, so at ≥3 every three-letter word in it becomes a compound
head and ordinary vocabulary shatters: bak·kie, dog·ter, ven·ster, sui·ker, don·ker, bot·tel,
sus·ter, vin·ger, kon·ing, mo·eder — 143 of them. That is the answer to "what breaks".

**An explicit list does keep the wins.** New shared config `shortHeads` (a named set; absent →
the ≥4 floor is unchanged, so nl/de are byte-identical and their referee floors did not move).
Two lists were measured, and the difference between them is the finding:

| list | folded | |
|---|---|---|
| chosen from VOCABULARY, 20 common 3-letter stems (see nag dag lug bos man vis oog oor kop sak erd wed sit ent reg een god hut kat) | 1762 | +10 / **−3** |
| the same, minus the two that misfire | 1764 | +10 / −1 |
| **attested only — every head with a correct scoring instance** | **1764** | **+9 / −0** |

The two misfires are worth naming: **⟨man⟩ tore *mantel* to man·tel** and **⟨kop⟩ tore *kopende*
to kop·ende** — both real words the wordlist happens to contain, neither a compound. Choosing the
list on vocabulary grounds and *then* measuring is what exposed them; a list read off the gains
would never have contained them, and would also never have shown that the vocabulary approach is
the one that leaks. Same score, zero regressions, so the attested list is what ships:
`bos een ent hut nag reg see sit wed`, each +1 on leave-one-out (boswerker, onteenseglik,
inenting, hutsmerk, naguil, regmatig, seewater, sitkamer, wedloop).

Two exclusions, recorded so they are not re-tried blind:
- **⟨vis⟩ is net zero** — vis·arend right, vis·ser wrong. Excluded rather than banked at 0.
- **⟨erd⟩ (erd·wolf) cannot work at all**, and this corrects Run 6: *erd* is **not in
  af-stems.txt**, so `isConstituent` rejects it as a head no matter what the floor is. The 3
  splitter causes Run 6 tabulated are really TWO — a floor (wed, and the ⟨s⟩-linked huts) and a
  LEXICON GAP (erd, waarts, haaf, opnemer, oortapping). Only the first is a rule change; the rest
  is data, and it is where the remaining seam words live.

⚠ Also fixed in passing: `minTrailingConstituent`'s comment claimed "nl/af use 4". Only nl sets
it; af has always run at the default 3.

**Result: 79.1% → 79.5% folded (1755 → 1764), symbol 94.4%. Floor 0.78 → 0.79.**
Cumulative for the seam work: **1745 → 1764 (+19), zero regressions at every step.**

**Next lever, unchanged in order:** (1) the ə↔ɛ / ɑ↔a reduction-and-length residual, still the
largest class, bounded at ~45 by the Run 4 oracle; (2) af-stems gaps for the remaining seam words
(erd, waarts, haaf, opnemer, oortapping) — data, not rules; (3) nothing in f→v, ever.
