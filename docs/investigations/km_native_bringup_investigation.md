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
