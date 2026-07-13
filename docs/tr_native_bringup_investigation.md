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
Turkish default is FINAL-syllable stress (76.5% of the gold). Exceptions:
- a small hand-authored lexicon (`stress.tsv`, 116 place names / loanwords, from espeak-ng-portable);
- the progressive **-Iyor** pre-stressing suffix rule (stress the I of Iyor: geliyor→ɟelˈijoɾ) — a general
  morphological rule, ~1300 words.

The remaining ~21% non-final stress (penult 12%, antepenult 10%) is morphological/lexical (other pre-stressing
suffixes -ken/-ce/-le/-me, place names, loanwords). A stress lexicon derived from the espeak gold would be
CIRCULAR (the gold is the validation target), so it is deliberately NOT built; the honest path forward is more
general pre-stressing-suffix rules. This is the known residual.

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
