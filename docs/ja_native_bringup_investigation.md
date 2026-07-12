# Japanese (ja) native bring-up

Target: Standard (Tokyo) Japanese, canonical IPA, espeak-independent. Slot #10 in the OmniVoice coverage set
(contributes `ɯ`, `ɸ`, `̞`, `̈`, `ɴ`, `ɽ`, `ᵝ`). There is EXTENSIVE prior work in the sibling repo
`~/Programming/espeak-ng-portable` (verified, PR #1317): a pure-TS kuromoji-style Viterbi morphological analyzer
(`src/japaneseMorph.ts` + `data/ja/morph-dict.tsv` 10.8 MB + `morph-matrix.bin` 3.5 MB), kanji readings
(`src/kanjiReadings.ts` + JMdict/KANJIDIC/name-reading JSON), pitch accent (`src/japanesePitchAccent.ts` +
lexicon), and number/prose evals. This bring-up REUSES that work.

## Convention (from the espeak-ng-portable canonical snapshot)
Narrow Tokyo Japanese. Vowels: あ→ä (centralized), い→i, う→ɯᵝ (compressed), え→e̞, お→o̞ (mid-lowered).
Consonants: し→ɕ, ち→t͡ɕ, つ→t͡s, ひ→ç, ふ→ɸ, ら-row→ɾ (ɽ canonicalizes to ɾ), ん→ɴ (moraic). Long vowel ː;
おう/えい → o̞ː/e̞ː. Sokuon っ → gemination. Pitch accent → ꜜ downstep (needs the lexicon → Phase 2).
Examples: 私は学生です → wätäɕihä ɡäkɯᵝse̞ide̞sɯᵝ; です → de̞sɯᵝ; する → sɯᵝɾɯᵝ.

## Plan
- **Phase 1 (this run): native kana → IPA + numbers.** A clean mora-based kana/katakana→IPA engine (gojūon +
  dakuten + youon + sokuon + long vowels + moraic ん), plus Japanese number reading. Handles kana text and emits
  the census primitives. No dictionary needed. Segmental only (pitch deferred).
- **Phase 2: kanji + segmentation.** Port japaneseMorph.ts (Viterbi) + morph data + kanjiReadings + the reading
  JSON from espeak-ng-portable → segment unspaced text, resolve kanji→kana, feed the kana engine.
- **Phase 3: pitch accent.** Port japanesePitchAccent.ts + the pitch lexicon → ꜜ downstep.

## Run 1 — kana core — 2026-07-12

Built `src/languages/japanese/{kana,numbers,japanese}.ts` + tests; registered `ja`. Mora-based kana→IPA:
gojūon + dakuten/handakuten + youon (きゃ) + sokuon (っ→geminate, word-final→ʔ) + long vowels (ー, おう→o̞ː,
えい→e̞ː, same-vowel→ː) + moraic ん place-assimilation (n/ŋ/m before coronal/velar/labial, else ɴ) +
extended (foreign-sound) katakana (ファ→ɸä, チェ→t͡ɕe̞, ディ→di, ヴ→v) + Sino-Japanese numbers.

**Validation vs the espeak-ng-portable canonical snapshot** (`words-50000.ja`, kana-only words, pitch/stress
stripped): **93.45% exact (15988/17108)**. The residual is almost entirely DELIBERATE canonical divergence
from espeak's conventions, not error — accounting for those, **98.28%**:

- `ん→ũ` before a fricative (724): espeak inserts a nasalized vowel `ũ` (`フランス→…ɾäũsɯᵝ`); we use the
  cleaner moraic `ɴ` / place-assimilated `n·ŋ·m`. Ours is the standard analysis.
- sokuon `hC` (102): espeak writes `っぱ→hpä`; we use the standard geminate `ppä`.
- vowel **doubling** (`じゅう→d͡ʑɯᵝɯᵝ`, `いい` handled, `じゃあ→d͡ʑää`): espeak doubles the vowel letter; we
  emit the proper IPA length mark `ː` (`d͡ʑɯᵝː`). Doubling is not phonemic-length IPA — `ː` is. Ours is more
  canonical (per `canonical_ipa_validation_goal`). We do NOT chase the snapshot here.

Genuine tail (~a couple hundred): a few espeak sokuon-before-fricative quirks (`っず→sz`, `っじ→ɕd͡ʑ`). Small,
lexicalized loanword cases; deferred.

Phase 1 is segmental only (no pitch) and kana-only (kanji spans are skipped until Phase 2 segmentation).
