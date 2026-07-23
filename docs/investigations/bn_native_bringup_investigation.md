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

## Run 6 — 2026-07-16 — I over-called it "lexical": the ɔ~o class is RULE-governed ([+high] harmony)

Run 5 declined the ɔ~o quality class as "genuinely lexical, dictionaries disagree." That was too quick — a
reference decides it. **Ferguson & Chowdhury (1960), "The Phonemes of Bengali"** state Bengali height harmony is
triggered by a **[+HIGH]** vowel (i, u) in the following syllable. Our rule was raising /ɔ/ before mid o/e too
(`HIGH_MID = /[iueo]/`) — an over-firing bug, not lexical variation. Restricting the trigger to [i u]:
- **অকলুষ→ɔkoluʃ** (was okoluʃ), **ঘরে→ɡʱɔɾe** (was ɡʱoɾe) — the over-raisings vanish; **করি→koɾi** (before i) kept.
- wikipron **44.6→45.9%**, gold **94.0%** unchanged. A one-line rule change, not a lexicon.

LESSON (mirrors the Amharic Fidel-transparency correction): "the referee disagrees with itself, so it's lexical"
is a weak inference — check the phonology literature first. A documented rule (F&C's [+high] conditioning) settled
it against the lexical hypothesis.

## Run 7 — 2026-07-16 — the deletion class + a genuinely INDEPENDENT referee (breaking the Wiktionary circularity)

The remaining big class is medial inherent-vowel (ɔ) deletion — Run 5's tatsama/tadbhava split. Unlike Amharic,
Bengali is NOT referee-dead: independent, non-Wiktionary sources exist that target exactly this class.
- **Johny et al. 2018, "Brahmic Schwa-Deletion with Neural Classifiers: Bengali"** (ISCA SLTU) — shows Bengali
  inherent-vowel deletion is CLASSIFIER-PREDICTABLE, i.e. conditioned (stratum + phonotactics), NOT idiosyncratic
  word-by-word lexical. So a better-conditioned deletion rule + a tatsama-stratum signal should carry most of it.
- **Google `language-resources/bn`** (Apache-2.0; phone-set G2P + textnorm, deletion via FST) — an independent
  reference implementation + phone set.
- **BanglaIPA "DUAL-IPA"** (arXiv 2601.01778) — 130k unique words with linguistically-validated IPA — a candidate
  genuine SECOND referee (license TBD before shipping).

FOUND & MEASURED the independent referee: **Bengali.AI DUAL-IPA** (`Lancelot53/bengali_ai_ipa` on HF — the
DataVerse/Bhashamul release; 150k linguist-validated sentences, 4 graduate linguists + an independent evaluator;
newspaper 33% + literature 66%). It is genuinely INDEPENDENT of Wiktionary and word-alignable (text & IPA both
space-tokenized per word). Built a 32,941-word lexicon locally (NOT committed — see caveats) by zipping equal-token
sentence pairs, and measured our engine against it (dialect/notation-neutralized fold: ɐ→a, g→ɡ, ɦ→h, ɟ→d͡ʒ, ʲ→j,
ʈ/t̪→t, pʰ→f, degeminate):
- **full segmental 48.2%** — comparable to same-dialect wikipron's 45.9%, which is *reassuring* since DUAL-IPA is a
  DIFFERENT standard (Bangladeshi/Dhaka, not our Kolkata target).
- **vowel-presence skeleton 58.9%; medial-deletion agreement (skeleton ignoring the word-final vowel) 62.8%.**
- The disagreements DECOMPOSE cleanly into: (a) a **systematic DIALECT split** — Dhaka RETAINS the word-final
  inherent vowel Kolkata deletes (আদালত: Dhaka adalɔto vs our adalɔt; 1294 pure word-final cases) + Dhaka raises
  ɔ→o more; and (b) **symmetric** medial-deletion disagreement (they-keep-we-delete 2167 ≈ we-keep-they-delete
  2271). The symmetry is the key result: it is NOT a one-directional rule bug, so medial deletion is genuinely
  VARIABLE/conditioned (matching Johny 2018), not a mistake we can rule our way out of against THIS referee.

TWO conclusions that settle the original question:
1. **Neither class is idiosyncratic-lexical.** The ɔ~o class is a rule (F&C, Run 6, fixed). The deletion class is
   *conditioned* (Johny 2018 classifier-predictable; the DUAL-IPA dialect differences are themselves systematic).
   So the honest ✅ lever is a **better-CONDITIONED deletion rule + an expanded Kolkata gold** — NOT a big lexicon.
2. **DUAL-IPA must NOT be wired as a committed correctness referee.** (a) It is Bangladeshi/Dhaka — matching it
   would push us toward the WRONG target (final-vowel retention, extra raising) for our Kolkata convention; a
   naive gate would reward dialect drift. (b) Its license is unspecified (competition release) → not
   redistributable into the repo. It is valuable for offline analysis (as here), not as a checked-in gate.

NEXT (proposed, not yet done): (i) improve the medial-deletion rule on principled conditioning (syllable
weight / tatsama-stratum tells) and validate on an EXPANDED hand-adjudicated Kolkata gold (150–200 words), the
honest cs/cy ✅ path; (ii) a small curated lexicon only for the true residue (final-[o] retention words, এক).

## Run 8 — 2026-07-16 — expanded gold (50→147) + ওয়া glide rule; PROVED the residue is lexical

Executed the ✅-path step. Adjudicated 103 new common words by running each through the engine and cross-checking
against the independent wikipron: **68 corroborated** (accept engine output), 24 notation-only diffs (accept), 11
no-wikipron (adjudicate). Added 90 corroborated + 7 hand-adjudicated words where the engine currently ERRS (kept at
their true Kolkata form so the gold captures the real error rate). **Gold 50→147 words.**

The 24 disagreements sorted the residual cleanly:
- **ওয়া glide (RULE fix):** খাওয়া/যাওয়া/দেওয়া were getting a spurious [j] (kʰaoja). ওয়া (o + য় + aa) spells
  [oa]/[wa], not [oja] — the য় is not a full glide here. Rewrote ওয়া→ওআ in normalization (মেয়ে→meje, where য় IS
  [j], is untouched). wikipron 45.9→**46.6%**, gold 93.2→**94.6%**.
- **closed-syllable ɔ→o, medial-ɔ retention, bô-phola vs cluster (LEXICAL):** tested whether the closed-syllable
  raising is a rule. It is NOT — the minimal pair **মন[mon] / জন[d͡ʒon] / ধন[d̪ʱon]** (raise) vs **কম[kɔm] /
  বন[bɔn] / রণ[rɔn]** (stay ɔ) is phonologically IDENTICAL (Cɔ + nasal#) with opposite outcomes. No surface
  feature separates them → the split is etymological (tatsama raises), i.e. genuinely LEXICAL. This is the decisive
  evidence the whole referee hunt was after: the residue needs a **curated lexicon**, not a better rule.

RESULT: wikipron **46.6%**, gold **94.6%** (147 words, the 8 misses = the proven-lexical tail). Strong 🟡 with a
much larger verified gold. The honest ✅ lever is now precisely scoped: a curated lexicon for the ~closed-syllable-o
/ tatsama-medial-ɔ / bô-phola residue (built independently, NOT fit to the gold; the rule engine stays the honest
non-lexical signal). Suite 8/8; typecheck clean.

## Run 9 — 2026-07-16 — the CROSS-SOURCE CONSENSUS lexicon (rule 93.9% → shipped 98.0% on the gold)

Built the lexicon for the proven-lexical tail. The naive approach (pin wikipron's vowel where we differ) FAILS:
of 13 entries checkable against the hand gold, **6 were wrong** (~46%) — it imports wikipron's own ɔ/o noise
(শহর→ʃɔɦoɾ but also জীবন→d͡ʒibon, wrong). wikipron is too noisy on the exact class to auto-mine.

The fix is **cross-source consensus**: re-download Bengali.AI DUAL-IPA (offline), and pin a vowel ONLY when
wikipron (Kolkata) AND DUAL-IPA (Dhaka) — two independent dialects — attest the SAME vowel sequence (same
consonant skeleton as ours, lexical-swap-only). Two dialects agreeing filters BOTH noise and dialect-specificity.
Result: **142 entries**, and against the hand gold only 1 "disagreement" (শহর) — which turned out to be MY gold
being wrong (শহর is [ʃɔɦoɾ]; fixed). It correctly ABSTAINS on জীবন→d͡ʒibɔn (sources disagree → not pinned).

WIRING (kept honest): `bengali-lexicon.tsv` overrides only the SHIPPED path (`phonemizeWord`/`text`). The rule
engine `phonemizeWordRules` bypasses it, and the referee eval was pointed at `phonemizeWordRules` — so the wikipron
number stays **non-circular** (the lexicon is wikipron-informed). DUAL-IPA is used OFFLINE for validation only, not
committed (license unspecified); the committed values are corroborated linguistic facts in our convention, on the
same CC-BY-SA footing as the already-committed wikipron referee.

RESULT: **rule engine 93.9% / shipped-with-lexicon 98.0%** on the 147-word gold; wikipron 46.6% (rule-only,
unchanged). Still **🟡**: the lexicon closes the COMMON lexical tail but OOV closed-syllable-o words outside the 142
still err, and 3 classes are uncovered (medial-deletion পুরনো, bô-phola লম্বা, ড়-final বড়/ছোট — not vowel-quality
patterns). Full ✅ needs broader lexicon coverage, capped by the wikipron∩DUAL-IPA overlap (~the reliable ceiling of
the auto method). The mechanism + 142 verified entries are the real deliverable. Suite 53/53; typecheck clean.

## Run 10 — 2026-07-16 — pushing coverage: the reliable ceiling is ~168 (142 → 168), and WHY it stops there

Tried to expand the lexicon "a few hundred more." Findings:
- **No third independent Kolkata human source exists.** Checked the other public Bengali-IPA datasets
  (Virus-Proton/Combined, krishnAbadikelA/massive-ipa + indicxnli-ipa): all are MODEL-GENERATED (stress-marked
  machine G2P) and **bn-BD (Dhaka)** — not independent human Kolkata references. So consensus stays wikipron∩DUAL.
- **Generalized the consensus** from vowel-quality+final-o to ANY vowel sequence both sources attest (added the
  medial-retention/insertion class: ঘোষণা→ɡʱoʃona, গণনা→ɡɔnona, উৎসাহ→ut̪ʃaɦo). Needed a proper consonant-UNIT
  tokenizer (base+ties/modifiers) — the naive char-walk mis-aligned d͡ʒ/t̪. Yield: **156** (0 gold disagreements).
- **Hand supplement (+12)**: adjudicated the top-frequency uncovered words. Most either already agree, or are
  DIALECT-AMBIGUOUS (DUAL is Dhaka — চলে=cɔle, পড়ে=pɔɽe: I'd raise, the source doesn't → SKIPPED, respecting the
  disagreement). Kept only source-corroborated confident ones (verb ô→o before -e: বলে/ধরে/হলে/বসে; the িয়ে
  glide: নিয়ে/দিয়ে/গিয়ে; এক→æk: একটি/এখন; medial: কারণে). **Total 168.**

The hand pass also caught a SECOND error in my own 147-word gold (এখন was ekʰɔn, wikipron says ækʰɔn — fixed;
শহর was the first, Run 9) — concrete evidence that solo adjudication carries a ~1–2% error rate, which is exactly
why the cross-source consensus (not my judgment) is the reliable core.

**The honest ceiling: ~168.** The high-frequency lexical tail is only ~168 words; beyond that, entries are either
dialect-ambiguous (Dhaka-only raising we can't confirm for Kolkata) or low-frequency (low real-text impact). "A few
hundred more" reliable Kolkata entries is NOT achievable from the available sources — it would require a
comprehensive Kolkata pronunciation dictionary that no public resource provides. Bengali is a **strong 🟡**: rule
engine 93.9% + a 168-entry cross-source-verified lexicon (shipped 98.0% on the gold), honestly bounded. Suite green.

## Run 11 — 2026-07-22 — ম্ব cluster rule fix + a THIRD independent source (Google language-resources/bn)

Revisiting the tail. Two findings.

**1. Rule fix — ম্ব geminated instead of clustering (was mis-filed as "lexical").** The phôla-gemination rule
`([ক-হড়-য়])্[যবম]` geminated the preceding consonant for any য/ব/ম 2nd member — correct for obstruents
(ত্ব→t̪ːo) but WRONG after a nasal, where ব is a homorganic CLUSTER: লম্বা→lɔmːa (should be lɔmba), কম্বল→kɔmːɔl,
চুম্বন→t͡ʃumːɔn, ডিম্ব→ɖimːo. (ম্ভ escaped only because ভ isn't in the phôla set.) Fix: exclude nasal+ব from
gemination (`p2==="ব" && "ঙঞণনম".includes(c)` → leave the conjunct for g2p to cluster). Every geminate case
preserved (মহত্ব, বিদ্যা, কন্যা, অকাট্য); fixes লম্বা on the gold AND all OOV ম্ব words. Gold rules 92.5→93.2%,
shipped 98.0→98.6%; full suite (931) green. NOT lexical — a genuine engine bug the prior runs lumped into the tail.

**2. Found the third independent source Run 10 said didn't exist: Google `language-resources/bn`** (65,036 words,
CC-BY-4.0, non-Wiktionary). Its phone set keeps the distinctions wikipron collapses — **retroflex ʈ/ɖ: 100%
agreement** with us (the fix for wikipron's 46% ceiling). NOT a clean drop-in referee, though: even folding notation
+ the whole inherent-vowel class, agreement is only ~46–56%, because Google uses a different vowel-deletion + ɔ→o
convention (retains inherent vowels we delete; raises ɔ→o more broadly incl. word-initial অংশু oŋʃu; encodes a RULE
not the Kolkata lexical raising — মন mɔn vs our gold mon). So it's a systematic independent variety (FST-ish), not a
Kolkata gold. Its value: (a) independent confirmation of our consonants, and (b) a THIRD leg for the cross-source
consensus lexicon — where Google agrees with wikipron/BengaliAI on a word's ɔ/o, that is scaled consensus that can
push the ɔ→o tail past the 168 ceiling. Next: prototype that consensus expansion.

## Run 12 — 2026-07-22 — Google reveals SYSTEMATIC engine errors (not a lexical tail)

User pushback (correct): Google is a reputable source; when the consensus (Google + wikipron,
two independent sources) disagrees with our engine, OUR ENGINE is likely wrong. Classifying the
403 consensus disagreements: UNDER-raised ɔ→o **37%** (consensus [o], we keep ɔ), OVER-deleted a
medial vowel **11%** (অবতার engine ɔbt̪aɾ vs consensus ɔbot̪aɾ; আচরণ at͡ʃɾɔn vs at͡ʃoɾon), over-raised
2%, other 47%. Root cause is in our own code comment: the medial-deletion is *"the same algorithm
as Hindi's schwa deletion but on /ɔ/"* and the ɔ→o raising only fires before an *immediately*
following high [i u]. **Bengali is not Hindi** — it retains many medial inherent vowels (as [o])
and raises ɔ→o more broadly. So a large part of what Runs 6–10 filed as "proven-lexical tail" is
actually a systematic RULE error the 65k reliable Google source exposes. Tested two rule re-derivations (positional ɔ→o raising; medial-deletion OFF) — BOTH crash the gold
(93.2→45.6%% and 93.2→90.5%%): the raising is not positional and Bengali DOES delete some medial vowels, so the
conditioning is genuinely intricate (partly lexical/morphological — no clean rule, confirming Runs 6–10 and the
existence of 135k-entry research G2P dicts). So Google's reliability is applied PER-WORD via the cross-source
consensus lexicon, not a rule: +134 entries where Google language-resources/bn (CC-BY-4.0, third independent
source, retroflex-correct) AND wikipron ben agree on the ɔ/o + deletion, differ from the engine (vowel-only,
consonant-matched), and are NOT gold words. Lexicon 168→302; gold shipped unchanged 98.6%% (no regression). This
breaks Run 10's ~168 ceiling using the third source Run 10 said didn't exist. The one clean RULE win this
session was the ম্ব cluster fix (Run 11, merged). Review hardened the builder: ABSTAIN on Google POS heteronyms (>1 distinct pron, e.g. উত্তর noun utːɔr / verb utːor) and fail on an unmapped phone (0 heteronyms in the current 134, so no data change).

## Run 13 — 2026-07-22 — more from Google: fixed my conversion, found the REPH gemination bug

User: "Google 42.5% — still lots of misses." Re-mining the consonant-skeleton disagreements (which
should NOT be lexical) showed most were MY conversion artifacts, not engine bugs: voiced aspirates
(our bʱ/d̪ʱ/ɡʱ vs my map's plain bʰ/d̪ʰ — 5,135), হ (our ɦ vs my h — 4,446), and geminate ː vs
Google-doubling (4,709). Correcting the Google→IPA map (voiced aspirates→ʱ, h→ɦ) + folding geminate
lifted the honest agreement: full 42.5→49.7%, consonant-skeleton 61→81%.

The remaining consonant misses then exposed a SECOND systematic rule bug (same class as ম্ব):
**reph র্ + [যবম] geminated instead of clustering** — the phôla rule read র্ম as র+ম-phôla and
geminated (ধর্ম→d̪ʱɔɾːo) when reph র্ is a coda-r CLUSTER (ধর্ম→d̪ʱɔɾmo, নির্বাপক→niɾbapɔk,
কার্য→kaɾd͡ʒo, গর্ব→ɡɔɾbo). Fix: exclude c==র from the gemination (~1,300 র্ম/র্ব/র্য words + OOV).
Gold unchanged 98.6%; every geminate case preserved; Google consonant-skeleton 79.5→81.2%.

Also fixed the build-script's copy of the conversion map (aspirate/ɦ words were being excluded from
the consensus by the CS mismatch) → +27 more consensus lexicon entries (অগ্নিগর্ভ, গৃহ, বর্ধমান …).
Remaining Google misses: ~50% is the intricate ɔ/o + deletion (lexical, per Run 12); the residual
consonant gap is the final-য়/ওয়া glide vs hiatus (অতুলনীয় nij/nio) + notation (ড়→ɽ/r, visarga h).
