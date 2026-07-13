# Turkish (tr) native bring-up

Target: Standard Turkish, canonical IPA, espeak-independent. Slot #11 in the OmniVoice coverage set
(contributes the dark-L `ɫ`). Turkish orthography is shallow and near-1:1 (vowel harmony is already spelled
out), so the engine is a rule-based left-to-right g2p — no pronunciation lexicon. espeak has solid Turkish, so
the espeak-ng-portable *canonical* output (its Turkic-fleet convergence) is the oracle/reference.

## Convention (from the espeak-ng-portable canonical output)
Clean phonemic vowels: a e ı i o ö u ü → `a e ɯ i o ø u y` (front = e i ö ü, back = a ı o u). Consonants are
direct except: c→`d͡ʒ`, ç→`t͡ʃ`, ş→`ʃ`, j→`ʒ`, y→`j`, r→`ɾ`, and the context rules below. Stress mark `ˈ`
sits immediately before the stressed vowel. (espeak-ng-portable reaches this via `canonicalGlyphMap`
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
- a small hand-authored lexicon (`stress.tsv`, 116 place names / loanwords, from espeak-ng-portable).
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
Built g2p.ts + turkish.ts + numbers.ts + stress.tsv; registered `tr`. Validation vs the espeak-ng-portable
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
