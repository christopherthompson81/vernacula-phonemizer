# Bengali (bn) native bring-up — investigation log

Espeak-independent canonical-IPA phonemizer for Bengali. Generic abugida engine (core/abugida.ts) +
bengali.jsonc (phoneme tables) + bengali.ts (Bengali-specific vowel harmony, inherent-vowel deletion,
ং→ŋ / ৎ→t̪ normalization). Referee: wikipron ben_beng broad (human, 6666 words, Wiktionary).

## Run 1 — 2026-07-15 — first pass, plumbing + phonology skeleton

Built the phoneme tables from the Unicode Bengali chart + standard phonology: dental t̪/d̪ vs retroflex ʈ/ɖ
(fleet convention), three sibilants শ ষ স → ʃ, ণ/ঞ → n (merged nasals), ং → ŋ, র → ɾ, inherent vowel /ɔ/.
bengali.ts adds: (1) ɔ→o vowel harmony before a high/mid vowel (করি→koɾi), (2) word-final inherent-vowel
deletion after a single C, retention as [o] after a cluster (অংশ→ɔŋʃo, বল→bɔl).

Smoke test looked right: বাংলাদেশ→baŋlad̪eʃ, ভালো→bʱalo, মানুষ→manuʃ, জল→d͡ʒɔl. Known gaps before first eval:
MEDIAL inherent-vowel deletion (একটা→ekɔʈa, should be ækʈa) and the [æ] realization of ⟨e⟩.

## Run 2 — 2026-07-15 — harmony fix, phôla gemination, folds; status 🔵

Fixed and extended against the wikipron ben broad referee (6666 rows / 4357 distinct):
- **Harmony was over-firing** (propagated ɔ→o across closed syllables: অকর্ষিত→okoɾʃit̪). Restricted to an
  OPEN syllable — exactly one onset consonant between the ɔ and a high/mid trigger vowel (করি→koɾi, but
  kɔɾ.ʃit blocks). 30.2→35.8%.
- **Phôla gemination** (jô ্য / bô ্ব / mô ্ম as 2nd conjunct member) GEMINATES the preceding consonant
  medially (বিদ্যা→bid̪ːa, অকাট্য→ɔkaʈːo, মহত্ব→mɔɦɔt̪ːo, পদ্ম→pɔd̪ːo), drops word-initially (ব্যথা→bæ≈bɔ).
- **Geminate-coda retention bug** fixed: a geminate final coda is heavy → retains the inherent vowel as [o]
  (যুদ্ধ→d͡ʒud̪ʱːo, not d͡ʒud̪ʱː).
- **Folds** (config): alveolo-palatal notation ɕ/ʑ/t͡ɕ/d͡ʑ (referee) = ʃ/ʒ/t͡ʃ/d͡ʒ (ours); ɹ/ɾ→r;
  degemination (.)\1→$1 (referee doubles, we use length ː). → **37.5%**.

**Ceiling analysis (why 37.5% is referee-noise, not quality).** Measured on the distinct-word set:
- final-inherent-vowel: referee DELETES 1878 vs retains-[o] 484 — our delete-by-default matches the ~80%
  majority; the retention is an irreducible LITERARY-register lexical tail (~20%).
- retroflex ট/ড: the referee frequently writes them DENTAL [t̪/d̪] (folding them → +3.3%), but ট/ত is a REAL
  phonemic contrast in Bengali (টিন vs তিন) — folding would be dishonest, so we keep it and eat the ceiling.
- epitran ben-Beng (independent) agrees only 23.5% raw, but 38.4% once harmony+final-deletion are neutralized —
  i.e. most of epitran's disagreement is our CORRECT extra phonology (epitran does neither). Not a scored referee.

**Status 🔵 (in-development), not ✅.** The core engine is right (goldens verified), but reaching a stable
plateau needs: general conjunct-cluster handling (many Sanskritic conjuncts assimilate/geminate: ত্ব→tt, ক্ত…),
the [æ] realization of ⟨e⟩ (একটা→ækʈa), medial inherent-vowel deletion (একটা→ækʈa, অকরণ→ɔkrɔn), and a lexical
layer for the literary final-[o] words. Deferred deliberately; documented rather than forced past the noisy referee.

## Run 3 — 2026-07-15 — medial inherent-vowel deletion + ক্ষ/জ্ঞ conjuncts (37.5→39.5%)

Attacked the two biggest residual classes found by re-classifying the miss set:
- **Medial inherent-vowel deletion** (the dominant class — ~300 words across the "medialDel" + "conjunct"
  buckets). The referee deletes the medial inherent ɔ in a V·C·ɔ·C·V context (আপনার→apnaɾ, আকবর→akbɔr,
  অকালবর্ষণ→ɔkalbɔrʃɔn) — exactly Hindi's Ohala schwa-deletion but on /ɔ/. Generalized the shared
  core/schwa.ts deleteMedialSchwa to take the inherent-vowel symbol (default "ə"; Bengali passes "ɔ"), and
  call it after geminate→length, before harmony. Hindi is untouched (default param). +~90 words.
- **ক্ষ → [kʰː]** (অক্ষর→ɔkʰːɔr) and **জ্ঞ → [ɡː]** (বিজ্ঞান→biɡːan) — two specific high-frequency conjuncts
  the akshara mapping gets wrong (kʃ / d͡ʒn). Grapheme presubstitution ক্ষ→ক্খ, জ্ঞ→গ্গ. +~43 words.

Net wikipron 37.5→**39.5%**. Suite 267/267, typecheck clean.

KNOWN IMPERFECTION (documented, not chased): Ohala deletes RIGHT-TO-LEFT, which mispicks on all-ɔ words where
Bengali prefers the first medial (আকবর→akɔbɾo not akbɔr; কলম→kɔlmo not kɔlom). Net-positive on the corpus, but
a Bengali-specific deletion direction/preference would fix the tail. The [æ] realization of ⟨e⟩/্যা (এক→æk,
ক্যা→kæ) is real but context-lexical and low-yield on this noisy referee — deferred.
