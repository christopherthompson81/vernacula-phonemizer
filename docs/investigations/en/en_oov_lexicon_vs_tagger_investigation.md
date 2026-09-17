# Lexicon or tagger: where the remaining English OOV error actually is

Run 18 closed the rule-shaped work on English stress and weak vowels and left one class that no rule
reaches: words the dictionary does not have. This assesses the two levers — expand `g2p-dict.tsv`, or
retrain the BiLSTM tagger — before either is built.

## Run 1 — 2026-09-17 — the type/token framing decides it, and the headline number is misleading

    against misaki gold        words    exact   no stress   +weak-vowel fold
      in the dictionary       36,634    66.7%      73.3%             82.1%
      OOV (tagger path)       52,777    33.5%      40.1%             47.6%

**59% of gold's vocabulary is OOV for us and OOV carries 74% of all remaining error.** On those
numbers the lexicon looks like the whole game.

⚠ **IT IS A TYPE STATISTIC OVER A VOCABULARY THAT OVER-WEIGHTS RARE WORDS.** misaki's gold is a word
list, not a corpus; its OOV tail is clitics (`'em`, `'twixt`), bare affixes (`-able`, `-ful`),
acronyms (`ASDIC`, `ACAT`) and rare lemmas. Measured on RUNNING TEXT instead — the 400 golden
sentences, 8,860 word tokens:

    not a bare dict key                      198 tokens   2.23%
      novel lemma            → TAGGER         52           0.59%
      proper noun            → TAGGER         50           0.56%
      clitic, stem in dict   → possessive      50           0.56%
      compound, pieces in dict → compound      24           0.27%
      regular inflection     → morph            8           0.09%
      abbreviation / initialism                14           0.16%

**Only 1.15% of running text reaches the tagger at all.** The rest is routed by paths that already
work. At the tagger's measured 66–71% word accuracy that is roughly **0.4% of all tokens read wrong
by the OOV path** — about one word in 250, or one per ten twenty-word sentences.

⚠ The frequency list cannot be used for this and was tried first: `g2p-common.txt` is *generated from
CMUdict entries* in Norvig frequency order, so every word in it is in the dictionary by construction
and it reports 0.01% OOV. Circular. Real sentences are the only honest source here.

## The lexicon: no to a bulk import, yes to targeted curation

misaki's gold is Apache-2.0 and holds 52,777 words `g2p-dict.tsv` lacks, and the repo has the
provenance machinery for exactly that import (`en-syllabic.tsv` did it). Three findings against doing
it wholesale:

1. ⚠ **IT COVERS ONLY 30% OF WHAT REAL TEXT ACTUALLY THROWS UP.** Of the 53 OOV types in the golden
   sentences, gold has 16. The other 37 are `km`, `Pago`, `Rossby`, `Aldwych`, `Holborn`,
   `Rustenburg`, `METI`, `UCLA`, `Panthera`, `hairdryer`, `sandbars`, `fire-command` — proper nouns,
   abbreviations and novel compounds. **That is an open set and no lexicon closes it.**
2. ⚠ **IT WOULD IMPORT misaki'S CONVENTIONS FOR 52,000 WORDS**, including the one Run 18 measured as
   wrong: `ə` for unstressed `IH0`, which two independent referees reject at 82%/72%. A bulk import
   buys coverage by adopting a transcription we have evidence against.
3. It makes the comparison **circular** — the instrument that found every defect in this series stops
   working for the imported half.

What IS worth building is a curated, user-extensible lexicon for names and domain terms, which is
where the genuinely unbounded half lives. That is a product feature rather than a data import.

## The tagger: the right lever for the open set, with known headroom

Proper nouns are unbounded, so only a model generalizes. The tagger already earns its place — on the
real OOV words from the corpus it fixes what the n-gram mangles:

    Aldwych     ˈɔːɫdwɪt͡ʃ  (n-gram *ˌɔːɫdwˈaᶦk)      Rustenburg  ɹˈʌsənbɚɡ (n-gram *ɹˈʌstɛnbˌɝɡ)
    Holborn     hˈoᶷɫbɚn    (n-gram *hˌoᶷɫbˈɔːɹn)     Panthera    pʰˈænθəɹə (n-gram *pʰˈænthɪɹə)

Roughly 11 of 16 sampled are right or close, consistent with the recorded 71.5% word-exact
(stress-independent) / 93.4% phone accuracy on a clean CMUdict 90/10 held-out.

⚠ **AND THE HEADROOM IS IN THE TRAINING SETUP, NOT OBVIOUSLY IN THE DATA.** The last retrain gained
**+3.1pp** from one bug — `pack_padded_sequence` missing, so the backward pass crossed padding before
reaching each word's last letter, which is exactly where English puts stress-determining suffixes.
A defect of that shape was worth more than any data addition on offer, and nothing says it was the
last one. Data alternatives are all compromised: wikipron-US is 4,558 rows, wikipron-UK is 76,284 but
the wrong accent, and gold is 90k with the convention problem above.

## The honest ceiling, and two cheaper things first

Both levers are bounded by the same 1.15%. Taking the tagger from 47.6% to 82.1% — i.e. making every
OOV word as good as a dictionary word — is worth about **0.4pp of token accuracy**. Real, audible on
proper nouns, and not large.

Two things measured along the way look like better value per unit of work:

- ⚠ **225 words carry an impossible doubled segment**, 163 of them from the tagger: `ɚɚ` in 141
  (`murderer`, `emperorship`, `terrorization`), `ɚɹ` in 60, plus `ɪɪ` and `əə`. `collapseGeminates`
  deliberately does not merge adjacent identical VOWELS because that would delete a nucleus — but
  `ɚɚ` is not two nuclei, it is one rhotic written twice. This is the Run 14 "doubled rhotic" class,
  still open, and it is a bounded rule fix rather than a data project.
- **Abbreviations are 0.16% of tokens and are a NORMALIZER problem, not a G2P one.** `km`, `UCLA`,
  `METI`, `TT` reach the tagger as letter strings; no amount of tagger training makes `km` read
  "kilometres". That belongs in `normalize.ts` beside the unit handling already there.
