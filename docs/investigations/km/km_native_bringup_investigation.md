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

## Run 4 — geminates, phoneme mapping, rules, and referee normalisation, 48.7 → 55.0%
Run 3's "the tail is lexical" was WRONG (user pushback: "That sounds like geminates, phoneme mapping, rules, and
referee problems"). Bucketing every residual by mechanism (not eyeballing the top-12) found five systematic
classes, each fixed by a rule or a fair referee-normalising fold:

1. **Unwritten minor-syllable glottal /ʔ/ (Huffman IX.B.2)** — the referee puts a /ʔ/ after most short open
   syllables (កថា→kaʔtʰaː), but it's OPTIONAL medially ("present in reading, lost in colloquial" — the referee
   carries both variants, e.g. ធនាគារ tʰeəʔ…~tʰɔː…). Adding ʔ to our output NET-HURT (−1.2pp: our no-ʔ already
   matched the colloquial variant). The right move was a FOLD dropping pre-consonantal ʔ on both sides. +1.8pp.
2. **Multi-char vowels ⟨ះ⟩/⟨ំ⟩** — a base vowel sign + reahmuk (-h) / nikahit (-m) was dropping the coda entirely
   (កកេះ → kakeː, should be kakeh). Added a `vowelCombos` table (ោះ→ɑh/uəh, ុះ→oh/uh, េះ→eh, ុំ→om/um, ាំ→am)
   derived from the referee. Part of +1.3pp.
3. **Bantaq (់)** — was ignored. It (a) marks a coda (កង់→kaŋ, not kaŋa as a spurious syllable) and (b) shortens
   the vowel (កាត់→kat, not kaːt). Both fixed. Part of +1.3pp.
4. **Inherent-vowel LENGTH by coda type** — the big one. A stressed CLOSED inherent is LONG on a plain coda
   (កង→kɑːŋ, គង→kɔːŋ) but SHORT on a silent-subscript/doubled coda (ចន្ទ→cɑn, រដ្ឋ→ruət) or bantaq (ចង់→cɑŋ);
   Run 3 wrongly made all closed syllables short. Tracked `codaShort` = "the coda came from a silent subscript".
   This also fixed the nasal-split words (តម្រង→tɑmrɑːŋ). +0.2pp folded but +108 raw.
5. **Epenthesis over-generation** — a medial bare consonant after a written-vowel syllable is that syllable's
   CODA, not a minor syllable (គីមឈី→kiːmcʰiː, not kiːmɔcʰiː). +0.4pp. (Collapses the rarer internal-doubling
   minor syllable ចេតនā→ceːtnaː — an etymological split with no spelling cue; the data favours coda-attachment.)
6. **Phoneme mapping**: ⟨ប៉⟩ (muusikatoan) → [p] not [ɓ] (កប៉ាល់→kɑpal); ិ o-series → ɨ.
7. **Referee notation folds**: breve short-vowel marks (ŭə~uə, ŏə~oə, ĕə~eə) and INCONSISTENT aspiration
   (kʰ~k both directions — កំប្លែង kampʰlaeŋ~kamplaeŋ, ខ្ញុំ kɲom deaspirated). Our output keeps canonical
   per-letter aspiration; the folds only stop the noisy referee from penalising it. +2.6pp combined.

**Where the number actually sits: 55.0% folded (57.4% on unique words).** The genuine residual is now:
the internal-doubling minor-syllable/coda ambiguity (unpredictable from spelling — cf. ចេតនā vs គីមឈី), a stack
of per-loanword Pali/Sanskrit vowel irregularities each ≤2×, and remaining referee variance (ei~eː for ⟨េ⟩
o-series; ɨ~i for ⟨ិ⟩). This IS a lexical/ambiguity tail now — but Run 4 showed most of what looked lexical at
48.7% was in fact five systematic rules + referee noise, exactly as suspected.

## Run 5 — the exceptions lexicon for the lexical residual
Runs 3–4 established that what rules can't reach in Khmer is genuinely LEXICAL: inherent-vowel length
(ចន្ទ can vs កង kɑːŋ — same shape, different length), the internal-doubling minor-syllable/coda split
(ចេតនā vs គីមឈี — no spelling cue), and the Pali/Sanskrit loanword vowels. These are not rule-derivable, so —
the Romanian-stress / akan-tone pattern — a mined lexicon carries them and the shipped `phonemizeWord` consults it
dict-first, falling back to the rule engine for OOV.

- **`src/languages/khmer/km-lexicon.tsv`** — 2822 entries (42.6% of the 6628 attested words), each a word whose
  canonicalised modal wikipron transcription genuinely diverges from the rule output (under the scoring folds).
  Built by `tools/gen/build-km-lexicon.mts`. Canonicalisation: modal transcription per word, breve→plain,
  short-low a→ɑ, optional medial /ʔ/ dropped. Source: wikipron khm_khmr broad (human, from Wiktionary,
  CC-BY-SA 3.0).
- **`phonemizeWord`** (shipped) = lexicon lookup → `phonemizeWordRules`. **`phonemizeWordRules`** (rule-only) is
  the referee-eval signal; eval.ts imports it so the parity number stays **non-circular at 55.0%** (the lexicon
  is derived FROM the wikipron referee — scoring the dict-first path against wikipron would be circular, exactly
  as the en-GB lexical-set word lists are handled).

**On the circularity:** Khmer has no second large independent referee (epitran khm-Deva is thin; kaikki is the
same Wiktionary source as wikipron). So the shipped dict-first path cannot be independently measured — it is a
🔷 single-source situation. That is an accepted trade-off (per the user): when a language's correct output is
irreducibly lexical and only one human source exists, shipping that source as a dictionary is the only path to
good linguistic output, even though it forfeits an independent score on the covered vocabulary. The RULE engine
retains its honest, independently-measured 55.0%; the lexicon adds correct human pronunciations for 2822 common
words on top.

**Net state:** rules 55.0% (independent, wikipron) + a 2822-word exceptions lexicon covering the Huffman-lexical
residual on attested vocabulary. Regenerate the lexicon after any rule change: `npx tsx tools/gen/build-km-lexicon.mts`
(fewer entries survive as the rules improve).
