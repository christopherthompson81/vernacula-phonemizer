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
