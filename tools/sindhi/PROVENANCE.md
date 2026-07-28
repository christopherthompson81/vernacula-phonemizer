# `sd.crossscript.tsv` provenance

Cross-script GOLD short-vowel data for Sindhi, mined by `crossscript_sd.ts` from the **Devanagari** sister-script.

## Why this source
Sindhi is written in both Perso-Arabic (a vowel-dropping ABJAD) and Devanagari (a fully-voweled ABUGIDA).
Devanagari writes exactly the short vowels the abjad omits, including the grammatical final -u/-i that Sindhi
retains (اسلام → इस्लामु *islāmu*). Wiktionary links the two forms of the **same lexeme**, so this is NOT cognate
transfer — unlike the Urdu←Hindi "Hindi-fill" path, which scored only 50.3% precisely because Hindi cognates are
a different lexicon.

## Source
`/mnt/data/kaikki-Sindhi.jsonl` — kaikki.org Sindhi (Wiktionary, **CC BY-SA 4.0**). Derived work inherits CC BY-SA 4.0.
1771 entries; 1285 Perso-Arabic words carry a linked Devanagari `forms` entry.

## Method
1. pair (Perso-Arabic, Devanagari) via the linked `forms`
2. read the Devanagari as an abugida → fully-vocalized IPA, in the `sindhi.jsonc` inventory (ɾ, ʋ, dental t̪/d̪,
   implosives ॻॼॾॿ → ɠʄɗɓ). No schwa deletion — Sindhi retains final short vowels, which is the signal being mined.
3. **HARD GATE:** keep the pair only if that IPA's CONSONANT SKELETON matches what the Perso-Arabic rule g2p
   independently produces. Vowels then come from Devanagari, not a guess; a skeleton mismatch means the entries are
   not the same word (or one side is mis-transliterated) and the row is dropped.

## Measured
- **Calibration:** 501 of the pairs also carry an attested IPA, held out as an accuracy check on step 2 →
  **84.6%** agreement on short-vowel quality (folding the length/notation/ʃ~ʂ axes the sd referee config folds).
  Residual misses are genuine variety/epenthesis differences (جانور *jānivaru*~*jānvar*), not reader bugs.
- **Independent corroboration:** of 413 words present in BOTH this mine and the pre-existing kaikki-IPA lexicon —
  two independent signals (Devanagari orthography vs transcribed IPA) — **90.6%** agree.
- **Yield:** 1030 rows kept, 251 dropped on skeleton mismatch, 4 unreadable. **617 words new** to the lexicon.

## Merge policy
Additive only. On conflict the pre-existing entry WINS — it is the kaikki-primary root that Nihalani (1974)
independently corroborates and that the 2-source-verified regression gold is built on. This mine fills OOV words.
Shipped lexicon: 539 → **1156** words.

## Effect on the target corpus
FLEURS `sd_in` token coverage by the lexicon: **18.4% → 28.6%** (36661 tokens). Those tokens get attested short
vowels instead of default-ə. Referee eval is unchanged at 77.5% by construction — it runs the lexicon-FREE
`phonemizeWordRules`.
