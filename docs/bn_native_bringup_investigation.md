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

## Run 4 — 2026-07-15 — adjudicated GOLD referee, ordering fix, e→æ harmony (→ 🟡, gold 92%)

Answered "is there a better referee?" — yes: a small ADJUDICATED common-word gold (50 words, hand-verified
standard Kolkata pronunciations in our convention), decoupled from the noisy wikipron. It is the clean quality
signal (like pt/ta). It immediately exposed real bugs the noisy wikipron had hidden:

- **Ordering bug**: medial deletion ran BEFORE final-inherent deletion, so a final inherent ɔ created a false
  V·C·ɔ·C·V context → জীবন→d͡ʒibno, শহর→ʃɔɦɾo, বছর, সময় all wrong. Reordered to harmony → final → medial
  (Hindi order). Fixed all four.
- **Harmony must run FIRST** (before deletion), keying on the ORIGINAL inherent /ɔ/ — otherwise a later-retained
  final [o] spuriously raises the preceding vowel (পদ্ম→pod̪ːo). With harmony first, পদ্ম→pɔd̪ːo correct AND
  করি→koɾi / দেখা→d̪ækʰa still fire (real matra vowels trigger).
- **Affricate-coda bug**: the coda counter treated t͡ʃ/d͡ʒ as two consonants → মাছ→mat͡ʃʰo. Collapse affricates → মাছ→mat͡ʃʰ.
- **e→[æ] before [a]** (height harmony: মিড vowel agrees with the following nucleus): দেখা→d̪ækʰa, লেখা→lækʰa,
  খেলা→kʰæla; দেশ→d̪eʃ / মেয়ে→meje correctly untouched. The referee is inconsistent here (লেখা appears as
  lekʰa AND lækʰa AND lɛkʰa), so a front-mid [e]~[ɛ]~[æ] fold was added for the wikipron backbone.

RESULT: adjudicated gold **56%→92.0%** (46/50) — the engine is actually good on common words. wikipron 39.5→42.5%
(referee-noise-limited; the gold is the real signal). Promoted 🔵→**🟡** (core layers in + verified; remaining is
a documented LEXICAL tail). Gold's 4 misses: final-[o] retention (বড়/ছোট — lexical, some ট/ড়-final words keep [o]),
hiatus harmony (বই→boi), closed-syllable æ (এক→æk). Suite passes; typecheck clean.

## Run 5 — 2026-07-16 — miss-bucketing, two rule wins + one honest fold (42.5 → 44.6%, gold 92 → 94%)

Bucketed the full wikipron miss-set to separate genuinely-fixable rule classes from irreducible referee noise
(a re-check on whether 🟡 could improve). The ~46% ceiling is dominated by GENUINELY VARIABLE features, confirming
the noise-limited verdict — but three honest wins fell out:

- **Word-initial ্যা / অ্যা → [æ]** (ক্যা→kæ, গ্যাস→ɡæʃ, ন্যায়→næj, অ্যাসিড→æʃiɖ). No [æ] matra exists, so
  the sequence is rewritten to a PUA sentinel registered as an æ matra + independent vowel (contained in
  bengali.ts; no data-file edit). **This is lexically split** — word-initial ্যা is [æ] (loanwords + native
  tatsama ব্যাকরণ), but MEDIAL ্যা GEMINATES (বিদ্যা→bid̪ːa, অকাট্য→ɔkaʈʈo), so the rewrite is anchored `^` only;
  the medial phôla-gemination path is untouched. ~27 wikipron words + canonical correctness.
- **Hiatus harmony**: /ɔ/ raises to [o] before a CLOSE vowel [i u] with no consonant between (বই→boi, অই→oi) —
  but NOT before a mid [o e] (অওসৎ→ɔosɔt̪ keeps ɔ, referee-confirmed). Closes the gold's বই→boi miss.
- **ফ fold** (config): ফ is standard-Kolkata [pʰ] (ours) ~ Bangladeshi/loan [f] (referee, ~61 words) — a dialect
  notation difference, same class as the existing dental/ɔ~o folds. pʰ→f in the wikipron backbone.

**Two classes were investigated and DECLINED as not rule-fixable** (they confirm the 🟡 ceiling, not a bug):
- **medial-ɔ retention** (220 wikipron over-deletions, অকথা→ɔkt̪ʰa vs referee ɔkɔt̪ʰa): the Hindi Ohala rule
  over-deletes for Bengali, which keeps the medial ɔ in *tatsama/learned* words (গold শহর→ʃɔɦɔɾ keeps both) but
  deletes in *tadbhava* — a LEXICAL (etymological) split, not a phonotactic one. Disabling medial deletion
  entirely is net-NEGATIVE (wikipron 46→43%, gold 92→90%), so it stays; the residual is an irreducible lexical tail.
- **ɔ~o quality** (369+ words, both directions — অকলুষ we-raise vs অংকন referee-raises): the classic Bengali ô/o
  ambiguity that dictionaries themselves disagree on. Genuinely variable → folded, not chased.

RESULT: wikipron 42.5→**44.6%**, adjudicated gold 92.0→**94.0%** (47/50). Stays **🟡** — the core is now more
complete (hiatus + ্যা), but the remaining tail (final-[o], closed-syllable এক→æk, tatsama medial-ɔ) is genuinely
LEXICAL and, like Amharic's ɨ, sits on a referee that is itself inconsistent on those exact classes — a mined
lexicon would be circular on the noisy wikipron. Suite 7/7; typecheck clean.
