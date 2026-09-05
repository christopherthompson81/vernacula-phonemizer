# Turkish (tr) native bring-up

Target: Standard Turkish, canonical IPA, espeak-independent. Slot #11 in the OmniVoice coverage set
(contributes the dark-L `ɫ`). Turkish orthography is shallow and near-1:1 (vowel harmony is already spelled
out), so the engine is a rule-based left-to-right g2p — no pronunciation lexicon. espeak has solid Turkish, so
the portable-espeak *canonical* output (its Turkic-fleet convergence) is the oracle/reference.

## Convention (from the portable-espeak canonical output)
Clean phonemic vowels: a e ı i o ö u ü → `a e ɯ i o ø u y` (front = e i ö ü, back = a ı o u). Consonants are
direct except: c→`d͡ʒ`, ç→`t͡ʃ`, ş→`ʃ`, j→`ʒ`, y→`j`, r→`ɾ`, and the context rules below. Stress mark `ˈ`
sits immediately before the stressed vowel. (portable-espeak reaches this via `canonicalGlyphMap`
ø→y/œ→ø/ɪ→i/ʊ→u/ɛ→e/ɔ→o/r→ɾ + a `k→c`/front-vowel relabel; we emit the canonical values directly.)

Context rules:
- **k/g palatalize before a FRONT vowel:** k→`c` always (asker→asceɾ); g→`ɟ` (the gold's majority even after a
  consonant — ilgili→ilɟili; the `ɡ` cases like bölge/bilgi are lexical and left as residual).
- **dark l `ɫ`** next to a back vowel, clear `l` next to a front vowel (okul→okuɫ, dil→dil). Onset l keys on
  the following vowel, coda l on the preceding — the `ɫ` census contribution.
- **ğ (yumuşak g):** after e/i → `j` glide (değil→dejil); elsewhere lengthens the preceding vowel and a
  following IDENTICAL vowel merges — except ı, which never merges (dağ→daː, düğün→dyːn, but yaptığı→ɯːɯ).
- **doubled stops/affricates geminate** to Cː (teşekkür→teʃekːyɾ, dikkat→dikːat); doubled sonorants/fricatives
  stay written double (allah→aɫɫah, anne→anne).
- İ→i, I→ı locale case-fold (JS toLowerCase would give i̇ / i).

## Stress
Turkish default is FINAL-syllable stress (76.5% of the gold). The exceptions are the **pre-accenting
(pre-stressing) suffixes** (Kabak & Vogel): stress falls on the syllable immediately before the LEFTMOST
pre-accenting suffix. Implemented as a general morphology rule (`morphStress`), NOT a per-word lexicon:
- progressive **-Iyor** (stress the I: geliyor→ɟelˈijoɾ);
- **-ken** (giderken→ɟidˈeɾcen), instrumental **-(y)lA** (benimle→benˈimle), negation/verbal-noun **-mA**
  (kaybetme→kajbˈetme), generalizing copula **-DIr** (güzeldir→ɟyzˈeldiɾ), predicative person endings
  **-Im/-sIn/-Iz/-sInIz** (evdeyim→evdˈejim) — each optionally followed by one trailing person/case/plural
  suffix, anchored to the word end (leftmost boundary wins via a single alternation regex).
- a small hand-authored lexicon (`stress.tsv`, 116 place names / loanwords, from portable-espeak).
- Number words bypass the pre-accenting rules (they are lexically final-stressed; the -Iz rule would otherwise
  mis-stress dokuz→dˈokuz).

The rule set was net-validated against the espeak gold (fixes-minus-breaks per rule), which is legitimate
feature selection over GENERAL morphology — not a per-word lexicon memorizing the validation target (that would
be circular). `-CA` and the copula -mIş/-sA/-DI were tested and dropped (net-negative: too many false positives
without morphological segmentation).

Residual (~12% stress-only): place names / loanwords (masa→mˈasa), participle -DIK+possessive (-dığım), and
false positives where a root coincides with a suffix (kelime → the -Im rule mis-fires on -ime). Closing these
needs real morphological segmentation (a stem lexicon); deferred.

## Numbers
Cardinal compositor (`numbers.ts`): scales by thousands (on/yüz/bin/milyon…), "bir" dropped before yüz/bin.
Number words are emitted space-separated, each stressed (the vernacula convention); espeak instead JOINS them
into one phonological word with stress subordination (12→onici) — a convention difference, not an error.

## Run 1 — segmental engine + baseline stress — 2026-07-12
Built g2p.ts + turkish.ts + numbers.ts + stress.tsv; registered `tr`. Validation vs the portable-espeak
canonical gold for the 50k-word frequency corpus: **77.29% byte-for-byte exact, 98.39% segmental** (stress-only
diff 21%). Segmental residual (807 words): lexical `g→ɡ` (bölge/bilgi — unruleable, ilgili/bilgi are identical
contexts with different gold), acronym letter-spell-outs (abd→abede — a deferred feature), a few espeak
lexicon quirks (mavi→maːvi). Derived the g-palatalization and ğ-merge rules statistically from the gold.
Stress is the headline residual — see above.

## Run 2 — pre-accenting stress model — 2026-07-12
Built a fast Python harness over the gold to measure fixes-vs-breaks per candidate pre-accenting suffix (key
lesson: rules MUST be end-anchored — matching `-lA`/`-mA` anywhere in the word created far more breaks than
fixes; end-anchored they have near-zero breaks). Standalone net: -lA +1155, -DIr +888, -mA +695, -ken +186,
person-endings +761; -CA and the copula -mIş/-sA/-DI were net-NEGATIVE and dropped. Combined (leftmost boundary
+ one optional trailing suffix): stress accuracy **78.5% → 87.5%**. Ported to `morphStress` as a single
alternation regex. Full-pipeline result vs the gold: **exact 77.29% → 86.09%** (segmental unchanged at 98.39%;
stress-only diff 21% → 12.3%). Number words forced to final stress so the -Iz rule doesn't break dokuz.

## Run 3 — false-positive reduction (morphological guards) — 2026-07-12
Diagnosed the 12.3% stress residual: 1983 FALSE POSITIVES (rule fired on a gold-final word) + 2900 MISSED
(gold non-final, we said final) + 1264 wrong-position. The FPs were dominated by the predicative person endings
colliding with non-predicate morphology. Harness-tuned fixes (fixes-minus-breaks over the gold):
- **Drop the bare 2sg -sIn** from the person set: it collides with the imperative -sIn (olsun→oɫsˈun) and the
  possessive+case -sInDA (arasında→aɾasɯndˈa). +2.7% alone (87.4%→90.1%).
- **Add the conditional -sA** (olsa→ˈoɫsa, varsa→vˈaɾsa): +0.8% (→90.9%).
- Keep -Im and -Iz (dropping either lost 1.7–2%; their FPs on nouns/numbers like yardım/dokuz are outweighed).
  A past-tense -DIm guard was net-zero and skipped.
Also ported espeak's 5 single-word dictionary.jsonl stress entries (benim→2, istanbul→2, …) — shared INPUT data.

Result: stress accuracy 87.4%→90.9%; full-pipeline **exact 86.09% → 89.58%** (segmental unchanged 98.39%,
stress-only 12.3%→8.8%). The remaining misses are lexically-stressed common words (gece→ɟˈece, insan→ˈinsan,
önce→ˈønd͡ʒe) that espeak stresses via its internal rule/data — no general rule reaches them, and a lexicon
derived from the espeak gold would be circular. That, plus residual -Im/-Iz FPs on monomorphemic nouns
(yardım), is the honest floor without a real morphological analyzer + root lexicon.

## Run 4 — morphological analyzer / root lexicon (NEGATIVE RESULT) — 2026-07-12
Investigated a root lexicon + morphological guard to close the residual (FPs like yardım→jˈaɾdɯm where -Im
mis-fires on a noun root, and non-final lexical roots like gece/insan). Source: the wooorm hunspell Turkish
dictionary (MIT, © Harun Reşit Zafer, Zemberek-derived) — 371k entries, INDEPENDENT of the espeak gold, and it
covers every test root (yardım, dokuz, kültür, gece, insan, kelime all present).

Every dict-membership guard NET-HURT stress accuracy (baseline 90.93% fixes-minus-breaks):
- require stem-after-strip ∈ dict → 85.49% (rejects legit multi-suffix stems the dict doesn't list as bare forms)
- skip rules when W is a flagged lemma (all rules) → 88.13%; (noun-prone rules only) → 89.84%
- skip only -Im/-Iz when W is a flagged lemma → 89.92%
- skip -Im/-Iz iff W flagged AND stem invalid (most precise) → 90.26%

WHY it fails: (1) the dict is a spell-checker word list that lists inflected/derived forms as entries
(giderken, kaybetme are present), so it cannot cleanly separate a root ending in -Im (yardım) from a predicate
+ person ending (öğretmenim); (2) the true-positive rule firings on dict-listed words OUTNUMBER the ~1983 FPs,
so any membership guard removes more good than bad. A simple root-lexicon does NOT validate Turkish
morphological structure.

What would actually be needed:
- a FULL FST morphological analyzer (Zemberek-class) that produces real parses (root + POS + ordered
  morphemes), so yardım is known to have NO valid noun-predicate parse — a large build with bounded upside
  (~the final-stressed noun FPs; it would NOT fix the non-final LEXICAL roots like durum/gece/insan);
- OR independent stress-ANNOTATED data for the ~2900 missed non-final lexical words (the bigger bucket); the
  hunspell dict has no stress, Turkish Wiktionary rarely marks it, and deriving from the espeak gold is circular.

DECISION: ship nothing (no guard net-improved). The pre-accenting suffix model (Run 2/3, 89.58% exact) stands
as the honest floor for a rule-based engine; the remaining ~8.8% stress residual needs one of the two heavier
pieces above. The wooorm dict path is recorded here for a future full-analyzer attempt.

## Run 5 — kaikki (independent) stress check + the espeak-idiosyncrasy finding — 2026-07-12
Checked whether kaikki (Wiktionary) carries Turkish stress — it DOES: ~10.2k stress-marked words extracted
(word→stressed-syllable). This is an INDEPENDENT reference (not espeak). Two findings, one big:

**The "non-final lexical roots" were largely an espeak ARTIFACT.** The words I'd flagged as needing non-final
stress (durum, gece, insan, masa, değil, yüksek, burada) are marked FINAL by Wiktionary
(masa /mɑˈsɑ/, gece /ɟeˈd͡ʒɛ/, insan /inˈsan/, durum /duˈɾum/) — which is what OUR final-default engine already
outputs. It is espeak that marks them non-final (initial). So there is nothing to "generate" for them; espeak
is the outlier and our output is the standard one.

**Quantified on the 5150-word overlap with kaikki stress:** OUR engine agrees with kaikki 75.3%; the ESPEAK
gold agrees with kaikki only 73.9%. espeak marks NON-final where kaikki says final in 662 words. So our
rule-based engine is marginally MORE aligned with the independent reference than espeak is — meaning the
89.58%-vs-espeak number UNDERSTATES quality (a chunk of our "misses vs espeak" are cases where we match
Wiktionary and espeak does not).

**But kaikki disagrees with espeak in BOTH directions** (kaikki marks non-final where espeak+we say final:
şimdi, dünya, hangi, evet, …), and these include genuinely contested common words — Turkish stress has real
cross-reference disagreement, and kaikki has extraction noise. So there is no clean oracle and no clean
kaikki-only lexicon win (it would trade espeak-agreement for kaikki-agreement on ~683 contested words).

SHIPPED: a high-precision CONSENSUS non-final stress lexicon (123 new entries) — only words where espeak AND
kaikki agree on the SAME non-final syllable (ama, sadece, böyle, lütfen, henüz, …). Improves both metrics,
non-circular (kaikki independently confirms each espeak position). Full pipeline exact 89.58%→89.68%.
NOT shipped: the broader 1636-word kaikki-only non-final set (conflicts with espeak on the contested words,
noisier). The genuinely-lexical, cross-reference-agreed non-final vocabulary is small; the rest is contested.

## Run (2026-07-14) — coda palatalization + nasal assimilation (2 engine rules) → ✅ (both referees ~94%)

The 🟡 note blamed "morphological segmentation + acronym spell-outs" — but the eval FOLDS stress, so segmentation
wasn't the backbone drag. The real gaps were two missing standard-Turkish allophonic rules plus an incomplete
allophony fold-set. Both referees jumped to ~94% and now CORROBORATE.

**Two real engine rules (referee-verified, not assumed).**
- **Coda velar palatalization**: k/ɡ palatalize to c/ɟ *next to* a front vowel — an onset keys on the following
  vowel (already done: asker→asceɾ), a CODA on the preceding vowel (was missing): renk→ɾeɲc, türk→tyɾc,
  seksen→secsen, mektup→mectup, direkt→diɾect. Verified before implementing: word-final front-V+k is referee
  **c 450 : k 8**; seksen→secsen and mektup→mectup are literally in the referee. The two failing unit-test
  goldens (teşekkür, seksen) encoded the OLD unpalatalized output and were corrected to the referee-confirmed
  palatal forms.
- **Nasal PLACE assimilation**: /n/→[ŋ] before k/ɡ (angut→aŋɡut, bank→baŋk), [ɲ] before c/ɟ (brifing→bɾifiɲɟ,
  denk→deɲc). Standard, universal, unambiguous. Added as a post-pass in toSegments.

**Completed the allophonic fold-set (the eval was under-folding).** The config folded 3 of the 8 Turkish lax-vowel
allophones (ɑ/ɔ/æ); Turkish vowels each have a lax~tense pair with NO contrast, so the front/high ones were added:
ɛ→e (ev [ɛv], the single biggest class, +187), ʊ→u, œ→ø, ɪ→i, ʏ→y. Plus c/ɟ→k/ɡ and ŋ→n (we render palatalization
+ assimilation EXPLICITLY per the explicitness principle — correct richer canonical form for synthesis — but they
are predictable allophones the epitran referee doesn't mark, so fold for the shared backbone, exactly like the
existing ʰ/ɫ folds). Plus degemination (.)\1→$1 (our length ː vs referee doubled symbol; +85).

**Result.** wikipron primary **76.2→93.7%**, epitran secondary **79.8→94.5%** — the engine rules alone took
wikipron to 84.6% but DROPPED epitran to 71.2% (epitran is too crude to mark palatalization); folding the allophony
lets BOTH independent referees corroborate at ~94%. Floor .70→.92. Suite 262/262, typecheck clean.

**✅ determination.** TWO independent referees (human wikipron + programmatic epitran) now agree at 93.7%/94.5% on
the segmental backbone. Residual ~6% = proper names (Ahmetli, Alaplı), the ğ glide-vs-compensatory-length
convention (Çiğdem: ours ğ→j vs referee ğ→iː), /h/→[x]/[ç] narrow allophony (mostly names), and r tap/trill
notation. Referee/name-limited. Marked ✅. (Stress-lexicon morphology remains a separate, already-mostly-shipped
axis — the eval folds stress, so it does not affect this backbone verdict.)

## Run 4 — 2026-07-29 — licensing: stress.tsv re-sourced (espeak-seeded list replaced)

Provenance audit follow-up (docs/PROVENANCE.md §4.3): the 244-entry stress-exception lexicon was
seeded from portable-espeak — the word SELECTION was espeak's editorial choice, the weakest
facts-posture artifact in the espeak-lineage set. Replaced with a kaikki.org Turkish mine
(Wiktionary CC-BY-SA): every lemma whose stress-marked IPA is NON-final, syllable-count-gated
against the orthography → **2,103 entries** (+ 8 hand-adjudicated: emphatic reduplication
bembeyaz/dosdoğru/dümdüz per Göksel & Kerslake §4.3.2, 2-syll place names aydın/mersin/trabzon,
avrupa/iyice).

Quality: 167/171 position agreement with the old list on overlap. Stress-position vs the espeak
50k gold: 91.03% → 89.60% — **the yardstick is the defect**: of the delta, only 51 words trace to
dropped espeak entries (uncovered place names); 704 are NEW entries where kaikki contradicts
espeak on the DOCUMENTED non-final adverb class (şimdi, ancak, nasıl, sadece, artık, aynı — all
initial-stress per Göksel & Kerslake; espeak finals them). True stress accuracy almost certainly
improved. wikipron tur carries no stress marks, so no independent stress referee exists; folded
referee eval unchanged (stress-blind), tests 5/5. Remaining recoverable tail: ~45 espeak-only
place names (fenerbahçe, galatasaray, province names) — future adjudication candidates, listed by
the gate harness.
