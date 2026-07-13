# Thai (th) native bring-up

Target: Standard (Bangkok) Thai, canonical IPA. Slot #16 in the OmniVoice coverage set (contributes `ɤ`).
Thai is an authored bring-up (espeak-ng shipped only a broken partial) and the HARDEST script in the set: a
Brahmic abugida written with no inter-word spaces, wrap-around vowel circumfixes, silent leaders, and computed
(not lexical) tone.

## Approach — REUSE our authored syllabifier
The genuinely hard subsystem (vowel-span parsing, the epitran-based schwa/inherent-vowel algorithm, leading-
vowel reorder + อักษรนำ leaders, syllable segmentation, and the tone computation) was already written by us in
espeak-ng-portable's `src/Normalize/scriptSegmentation.ts` + `thaiPron.ts`. Rather than reimplement it, we PORT
those (→ `syllabifier.ts` + `thaiTone.ts`), which produce a per-syllable structure `{onset, nucleus, coda,
long, tone}`. In espeak-ng-portable that structure is emitted as PUA markers for the espeak L2S rules; here
`g2p.ts` RENDERS it to IPA directly — so vernacula stays espeak-independent while reusing the hard logic.

The lesson: a first from-scratch attempt (bespoke vowel-pattern matcher + greedy syllabifier) plateaued at 24%
— multi-syllable segmentation is the crux. Swapping in the ported syllabifier took it to 73% with only a thin
IPA renderer (consonant/vowel/coda/tone tables + glide/length/glottal conventions).

## Convention
Onset/coda consonant tables; vowel quality from the unit's graphemes + length from the scan's live/dead
computation; 5 tones as Chao contours (`˧` mid, `˨˩` low, `˦˥` high, `˥˩` falling, `˩˩˦` rising) after the
nucleus. Glide vowels ไ/ใ/ำ/เา are short + a j/w coda; centering diphthongs ua/ia/ɯa take no length. A written
SHORT open syllable takes a glottal `ʔ` — but only word-finally (minor/unstressed short syllables don't). Stress
`ˈ` on the first syllable; `ˌ` on the last when there are ≥3.

## Validation
vs the espeak-ng-portable authored gold (20k words): **exact 89.3%** (73.2% rules-only → 89.3% with the
dictionary; 95% on monosyllables). The lexical irregulars are closed by porting espeak's Thai dictionary
(dictionary.tsv, 1,789 entries, converted from espeak tone digits 1-5 → Chao contours placed after the nucleus,
98.8% self-match to the gold): length irregulars (ได้→daːj, น้ำ→naːm), silent-ร Sanskrit (สร้าง→saːŋ,
จริง→t͡ɕiŋ), cluster-under-leading-vowel (ใคร→kʰraj), and the short เ–ิ exceptions (เงิน) — which let the RULE
treat เ–ิ as long (ɤː) since the exceptions are dictionaried. Secondary stress fixed to even nuclei (≥2). The
remaining residual is ~8% compound words espeak splits into separate words (needs the seg-words segmentation,
also reusable from espeak-ng-portable) + ~3% minor segmental.

## Run 1 — reuse the authored syllabifier — 2026-07-13
Ported scriptSegmentation.ts (Thai portions) + thaiPron.ts; wrote a native IPA renderer over the scan output.
24% (from-scratch) → 73.2% (with the ported syllabifier). 111 tests pass; residual is dictionary-class lexical
irregulars.

## Run 2 — Thai dictionary (Chao notation) — 2026-07-13
Ported+converted espeak's data/th/dictionary.jsonl → dictionary.tsv (1,789 entries). The espeak phoneme tokens
use tone DIGITS 1-5 before the vowel; the converter maps them to Chao contours (˩˩˦/˨˩/˧/˦˥/˥˩) placed AFTER
the nucleus (with length before tone), diphthongs as one nucleus, and stress ˈ-first + ˌ-even-nuclei. 98.8%
self-match to the gold. Wired as a lookup before the rule engine. Also: fixed the g2p secondary-stress rule
(even nuclei ≥2, not last), re-enabled เ–ิ→ɤː long (exceptions now dictionaried), and a final-short-open glottal
(ณ→naʔ). 73.2%→89.3%. Next: port segmentThai + seg-words for the ~8% compound-split residual.
## Run 3 — word segmentation (seg-words DAG) — 2026-07-13
Ported segmentThai + segmentByDag + thaiTccBoundaries (→ segment.ts) and the seg-words set (64,808 words: ICU
thaidict + PyThaiNLP + curated extra). phonemizeWord now SEGMENTS a token into words via the DAG (TCC-boundary-
constrained maximal matching) and phonemizes each, joined by a space — so a compound corpus token espeak split
(ก็คือ → ก็ คือ) now matches. 89.3%→97.1% exact (98.4% on monosyllables). Thai reaches parity-ish by reusing
all three authored subsystems (syllabifier, dictionary, segmentation) + a native IPA renderer. Residual ~3% is
minor segmental (rare vowel/length edge cases, a few multi-word dict compounds).