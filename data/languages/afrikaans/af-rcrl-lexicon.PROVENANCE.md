# `af-rcrl-lexicon.tsv` — provenance

**What it is.** 25,112 word→IPA entries: the shipped Afrikaans pronunciation lexicon. Built by
`tools/afrikaans/build_af_lexicon.ts` from the in-repo copy of the source (no network needed).

**Source.** The **RCRL Afrikaans Pronunciation Dictionary v1.4.1**, © 2010 Centre for Text Technology
(CTexT), North-West University, South Africa. Redistributed by **`ttslab/za_lex`** `data/afr/`
(Multilingual Speech Technologies, NWU; © 2016 The Department of Arts and Culture, Government of the
Republic of South Africa). The derivation of the in-repo copy is in
`tools/referee-eval/referees/af.rcrl-apd.PROVENANCE.md`.

**Licence.** Creative Commons Attribution-ShareAlike 2.5 South Africa (CC BY-SA 2.5 ZA). It is share-alike,
not non-commercial. The file is fenced as a §3 share-alike artifact (`LICENSES/PROVENANCE.md`), and the
derived work inherits CC BY-SA.

**What was changed from the source.** It is not copied raw. 27,428 entries were reduced to 25,112:
- **Notation mapped to this engine's inventory:** `x`→`χ`, `æ`→`ɛ` (⟨e⟩ before /r l/), `ʊ`→`u` (the ⟨oo⟩
  onset), the few stop `ɡ` rows → `χ`, and `əu`→`œu`. Stress marks and syllable dots are stripped.
  Word-initial ⟨v⟩ written [v] is normalized to [f].
- **Each entry is vetted against this engine's rule output.**
  - Entries are dropped where the independent primary referee already agrees with the rules (1,294), where
    the rules need a long vowel the source cannot write (985), where the entry is too far from the rules to
    be credible (33), and for single letters (4).
  - Final devoicing, schwa epenthesis in /rm, lm/ and dropped onsets are taken from the rule form.

Build notes and measurements: `docs/investigations/af/af-rcrl-lexicon_build_notes_investigation.md`.
