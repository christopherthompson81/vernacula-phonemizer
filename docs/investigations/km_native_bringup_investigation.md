# Khmer (km) native bring-up

Khmer / ភាសាខ្មែរ (km) — Austroasiatic (Mon-Khmer), Cambodia's national language (~18M). Written in its own
abugida. NON-tonal. One of the HARDEST scripts in the fleet.

**Scope gates:** own community-adopted abugida + a LARGE human referee — **wikipron khm_khmr broad (7107)**, plus
epitran khm-Khmr and a 14 MB kaikki. Well-resourced.

**Khmer's defining feature — the TWO CONSONANT SERIES.** Every base consonant is a-series (1st, inherent ɑː) or
o-series (2nd, inherent ɔː), and the SAME vowel sign is read differently by series (ក+ា = kaː but គ+ា = kiə).
Consonant clusters are written with SUBSCRIPTS (coeng ្). Khmer Unicode is logical-order (base before vowel), so no
leading-vowel reorder is needed (unlike Thai/Lao).

## Run 1 — Phase 1 (the two-series core), 35.6% folded
Derived the tables from wikipron: the consonant series (a/o) + IPA, the two-reading vowel table (each sign's
a-series and o-series value), and the coda table. A left-to-right scan: base (series) → coeng subscripts → vowel
sign (read by series) → coda. Two facts pinned against the referee:
- **the BASE consonant governs the vowel series in a coeng cluster** (ខ្មែ → kʰmae a-series from ខ, NOT o-series
  from the subscript ម — the "subscript governs" textbook rule is wrong for these; base-governs +2.1pp).
- inherent vowel is SHORT ɑ/ɔ in a closed syllable, long ɑː/ɔː open; final voiceless stops are variably glottalised
  (k~ʔ, folded).

**Result: 35.6% folded (2533/7108) vs wikipron.** The two-series CORE is derived and correct — the demonstration
pair កា/គា → kaː/kiə works, and whole words match the referee (ខ្មែរ→kʰmae, ភាសា→pʰiəsaː, ស្រុក→srok). But this is
a **Phase-1 / in-active-development (🔵)** result: Khmer needs a proper SESQUISYLLABIC syllabifier (a Thai-level
effort — Thai's is 1000+ lines) that the two-series core doesn't yet have. The residual is dominated by:
- **minor syllables** (sesquisyllabic CV̆.CV — អសាធារណ, គជ→kuəc): a full syllabifier is needed;
- **coeng clusters as ONSET-minor-syllable vs word-final CODA** (ក្រមា→krɑmaː onset vs ចន្ទ→can coda) — the
  same coeng sequence resolves differently by position; the naive "always onset" over-vocalises final clusters;
- **series-conversion diacritics** (់ ៉ ៊ ័ ៈ), **independent vowels** (ឥ ឧ ឪ ឯ …), **multi-char vowels**
  (ុំ ាំ ិះ ុះ េះ ោះ), and finer coda glottalisation.

**Verdict: 🔵 in active development.** The defining two-series system is DONE and wikipron-verified; the
sesquisyllabic syllabifier is the substantial next phase. Gold: test/khmer.test.ts (the two-series contrast + wikipron-matching words).

## Run 2 — reference-informed structural fixes (Donley 2020), 35.6 → 38.6%
The user supplied Donley (2020) "Khmer Phonetics and Phonology" — an ESL thesis whose Table 4 (onset cluster
classes: Class 1 tight, Class 2 slight aspiration, Class 3 with an epenthetic [ə] = the minor syllable) and Table 2
(word-final stops unreleased; /k/ → [ʔ]) confirm the structure. Two clear wins it enabled:
- **silent final subscript clusters** — a trailing ្+C on a CODA consonant is dropped (ចន្ទ → cɑn, កម្សាន្ត →
  kɑmsaːn). The earlier regression was from ALSO changing the onset loop; the coda fix alone is safe (+1.7pp).
- **⟨ប⟩ → [p] in a cluster** (ប្រ → pr, not ɓr; +1.3pp).

Still **🔵 38.6%.** The dominant remaining class is the **sesquisyllabic minor-syllable structure** — e.g. សម្រាក
= [sɑm.raːʔ] (ស = a minor syllable with a short inherent vowel; ម្រ then splits/onsets the major syllable). Getting
this right needs a proper Khmer SYLLABIFIER (minor-syllable detection, disyllabic parsing, and the subtle
series-in-cluster behavior the thesis confirms but does not computationally specify — cf. Huffman 1970). That is a
dedicated Thai-scale project (Thai's syllabifier is ~1000 lines), not a few edits. The two-series core remains
correct and wikipron-verified; the syllabifier is the next dedicated phase.

## Run 3 — the Huffman (1970) sesquisyllabic syllabifier, 38.6 → 48.7%
The user supplied **Huffman, Franklin E. (1970), _Cambodian System of Writing and Beginning Reader_** (Yale) —
the definitive computational description of the writing system (public domain since 1975). Its Part One gives the
exact rules the Donley thesis confirmed but did not specify. I rewrote `phonemizeWord` from the old inline scan
into a proper unit-based syllabifier (three passes: unit scan → coda/nasal assignment → governed render).

The four rules that moved the number, each straight from Huffman + verified against the referee before coding:

1. **GOVERNANCE (Ch. VI, the single biggest lever).** "In any syllable which is preceded in the same word by
   consonants of different series, the series of the vowel will be determined by the LAST PRECEDING stop or
   spirant." Dominant = stops/spirants (p t c k q b d f s h); passive = continuants (m n ɲ ŋ w r l y). A dominant
   always beats a passive; among dominants the last (nearest the vowel) wins; and a passive-initial syllable
   harmonises to the last dominant tracked ACROSS THE WHOLE WORD. This replaced the Run-2 "base governs"
   approximation and fixes both clusters (ផ្ទះ → pʰteəh — both dominant, so the subscript ទ o-series governs ះ →
   eəh) and cross-syllable harmony (ចេតនា → ceːtɑnaː — passive ន harmonises to a-series from the preceding ត).

2. **PRESYLLABLE reduction (Ch. IX.A).** A bare-vowel syllable that is NOT the last is an unstressed presyllable
   with a SHORT inherent vowel ɑ/ɔ (referee-confirmed: កករ → k ɑ k ɑː — short presyllable + long main).
   Stressed-open → long ɑː/ɔː; stressed-closed → short a / uə (Huffman IX.A.2; ចន្ទ → can, គណ → kuən).

3. **CODA assignment.** The old greedy coda-grab was wrong (កណ្ដាល is k ɑ n ɗ aː l, not kɑn-). The last bare unit
   supplies the coda; a silent trailing subscript is dropped (ចន្ទ → cɑn). A NASAL at the head of a MEDIAL cluster
   closes the previous syllable and its subscript opens the next (តម្រង → tɑm.rɑŋ, the CVN- rule, Ch. V.B.6);
   word-initial nasal clusters stay genuine onsets (ម្រាម → mriəm). A medial bare unit between two vowelled
   syllables is its own minor syllable (ចេតនា).

4. **ិ o-series → ɨ** (was i). Referee: គិត kɨt, មិន mɨn, និង nɨŋ — all ɨ.

Plus a transcriber-variant fold `ɑ~a` (the short low-central vowel is written both ways: ចន្ទ can ~ cɑn).

**The remaining ~51% is a genuine lexical + narrow-transcription tail**, not a missed systematic rule:
- Pali/Sanskrit **doubled-consonant loanwords** where the 2nd-series short inherent is eə/oə not uə (ភក្ខ pʰeə,
  វត្ត ʋoə) — Huffman's type-2/type-3 split, environmentally/lexically conditioned.
- **special digraphs** (ហ្វ → f in French loans like ហ្វ្រង្ក 'franc').
- **allophonic aspiration** the broad referee marks (ក្ល → kʰl — slight aspiration of a stop before a continuant).
- **bantaq (់) vowel-shortening** (គាត់ → koət, ា+bantaq in o-series) — per-vowel irregular, currently ignored.
- **broad-referee noise**: 441 of 7107 words carry ≥2 differing transcriptions (ɑ~a, aspiration variance,
  presyllable ɔ~ə), so a single output can only match one variant.

**Verdict: 🔵 in active development, Phase 2 (48.7%).** The sesquisyllabic core the earlier runs deferred is now
built and Huffman-grounded. Further gains are per-loanword lexical work (a pronunciation lexicon for the Pali/French
stratum) rather than more structure. Gold: test/khmer.test.ts now pins one word per structural rule.
