# Arabic (ar) native bring-up — investigation

Fifth native language. First Semitic / abjad. Sole census provider of ʕ ħ ˤ.
espeak-ng-portable's ar is heavily customized (not stock espeak-ng): diacritization, al- assimilation,
quantity-sensitive stress. Target convention = espeak-PORTABLE canonical.

## The two layers
1. DIACRITIZED → IPA g2p (fully-vowelled Arabic → IPA). Rule-based, CLEANROOM, license-clean. Phase 1.
2. Short-vowel RESTORATION (bare text → vowelled). Hard. espeak-portable has a Tashkeela lexicon (GPL
   provenance) + a neural ONNX diacritizer (both under ADR-0014 "linguistic-facts" posture). Phase 2 —
   DECISION: port ONNX (real-text, +onnxruntime dep), port lexicon, or defer to diacritized-input-only.

## Canonical convention (espeak-portable, from probes)
- consonants: ب b ت t ث θ ج d͡ʒ ح ħ خ x د d ذ ð ر r ز z س s ش ʃ ع ʕ غ ɣ ف f ق q ك k ل l م m ن n ه h و w ي j
- emphatics: ص sˤ ض dˤ ط tˤ ظ ðˤ  ; glottal: ء أ إ ؤ ئ → ʔ ; آ → ʔaː ; ى → aː
- harakat: َ a ِ i ُ u ْ sukun ّ shadda(gemination) ; tanwin ً an ٍ in ٌ un
- long: Cَا aː, Cِي iː, Cُو uː ; diphthongs Cَيْ aj, Cَوْ aw
- article ال: sun letters (ت ث د ذ ر ز س ش ص ض ط ظ ن ل) assimilate l→gemination; moon letters keep l;
  hamzat wasl → initial ʔ (ʔalqamar, ʔaʃʃams)
- ة taː marbuːta → a (dropped after long vowel: صلاة→sˤalaː) ; stress: quantity-sensitive + secondary.

## Probe targets (espeak-portable canonical)
كَتَبَ kˈatabˌa · كِتَاب kitˈaːb · مُدَرِّس mudˈarris · الشَّمْس ʔaʃʃˈams · الْقَمَر ʔalqˈamar · عَرَبِيّ ʕˈarabˌijː
صَلَاة sˤˈalaː · طَالِب tˤˈaːlib · ضَيْف dˤˈajf · ظَنّ ðˤˈann · حَجّ ħˈad͡ʒː · قَلْب qˈalb · بَيْت bˈajt · يَوْم jˈawm · نَعَمْ nˈaʕam

## Referees
- wikipron ara_arab broad+narrow (cached, HAS short vowels — real referee, bare-keyed).
- epitran ara-Arab: bare-text, NO short-vowel restoration (ktaːb), leaves ة — weak, consonant/emphatic check only.

## Phase 1 progress — diacritized g2p

Cleanroom diacritized→IPA engine (g2p.ts + arabic.ts). Handles: consonants + emphatics + pharyngeals,
harakat, long vowels/diphthongs, shadda gemination (either mark order), tanwin, article al- sun/moon
assimilation + hamzat-wasl ʔ, ة silent (pausal), accusative bare-alif → aː, quantity-sensitive stress.

VALIDATION (tools/ar-ref-sweep.mts vs espeak-portable canonical over 2500 diacritized words):
- SEGMENTS 89.9% (folding espeak's inconsistent gemination CC↔Cː → we use consistent Cː; + nasal assim).
- Residual segment buckets are COHERENT: proclitic+article morphology (وَال/لِل/بِال + hamzat-wasl الا, ~140 —
  biggest, deferred feature: proclitic vowel + article alif elision + sun-letter assimilation), pausal
  trailing case-ending vowel (58, espeak adds -a; ours pausal = cleaner), initial long-vowel edges (~15).
- STRESS ~45% (full seg+stress 40.4%). Cairene rule needs calibration: ours = ultima-superheavy→ultima,
  ultima-heavy→penult, penult-heavy→penult, else antepenult. Misses the light-syllable-counting subtlety
  (madrasa H.L.L → espeak penult, ours antepenult).

CONVENTION: gemination Cː (consistent; espeak vacillates). Fold espeak narrow allophony (nasal place assim).

## Phase 2 plan — permissively-sourced neural diacritizer (USER-DIRECTED: not NC-encumbered)
The espeak-portable ONNX diacritizer's only NC input is Leipzig ara_news_2020 (CC BY-NC). Clean path (per its
own PROVENANCE): retrain the BiLSTM with the CATT teacher (Apache-2.0) silver-labeling Arabic Wikipedia
(CC-BY-SA) instead of Leipzig — moots NC at the source. GPU present (RTX 3090). USE /mnt/data (333G free) for
the wiki dump + training. Pipeline exists: tools/diacritization/{catt_silver,train_bilstm_sent,export_onnx}.py.
Then integrate via onnxruntime-node (optional dep, async pre-pass) → feeds the Phase 1 g2p.

## Next
Finish Phase 1: proclitic+article, stress calibration, numbers, text(). Then Phase 2 retrain.

## Stress calibration + metrics (folded gemination)
Refined rule (matches probes): ultima-superheavy→ultima; ultima-heavy(CVV/CVC)→penult; penult-heavy→penult;
all-light + antepenult-light→antepenult; else penult. Verified madrasa→penult, kataba→antepenult, alqamar→
penult, mudarris→penult.

Metrics vs 2500-word canonical (gemination CC↔Cː folded):
- segments 89.9% ; seg + PRIMARY stress 64.5% (of seg-correct, ~72% primary-correct).
- Secondary stress ˌ: espeak marks it, we will FOLD (omit) like Spanish/cmn — primary-only is the target.
- Remaining lifts: proclitic+article (~140, fixes segments AND their stress), pausal trailing-vowel (58,
  espeak adds case -a; ours pausal), initial long-vowel edges (~15), nasal place assim (fold).

## Phase 1 remaining (user chose: finish Phase 1 → PR/merge, THEN Phase 2 retrain)
1. proclitic + article (وَال/بِال/لِل + hamzat-wasl elision + sun assimilation).
2. numbers (Arabic-Indic + ASCII digits → words; the digit compositor).
3. text() routing (words / numbers / punctuation / tanwin; ٪ etc).
4. register es-style, tests, PR + review + merge as the cleanroom "diacritized Arabic" language.
Then Phase 2: permissive BiLSTM retrain on /mnt/data (CATT teacher + Arabic Wikipedia) → onnxruntime-node pre-pass.

## Phase 1 COMPLETE (pending PR/review)
- Proclitic+article (وَال/بِال/لِل + hamzat-wasl elision + sun assimilation) + الّذي/الله lam-gemination → segments 96.0%.
- Refactored mark-gathering (gatherMarks + resolveVowel): shadda/harakat any order, decoupled from long-vowel
  detection (fixes نَّا = fatha-before-shadda-before-alif → aː).
- Stress refined: antepenult heavy-by-LONG-VOWEL attracts stress (ṭaːlib→ṭaː), heavy-by-CODA→penult (madrasa→ra).
- Numbers: numberToIpa (0…<10⁹, MSA counting forms; 2024→ʔalfaːn wa ʔarbaʕa wa ʕiʃruːn == shim). Emitted as IPA
  directly (g2p needs diacritics a bare numeral lacks). Number-internal stress = deferred refinement.
- text(): Arabic+ASCII words/digits/punctuation routing. Registered "ar". 46 tests pass.

Residual (deferred edges, ~4%): initial إي→ʔiː defective spelling, الا hamzat-wasl (form VII/VIII), nasal
place assim (broad/folded), number-word stress. Convention: gemination Cː, pausal (no case ending), fold
secondary stress. NEXT: PR + review + merge, THEN Phase 2 permissive diacritizer retrain (/mnt/data).
