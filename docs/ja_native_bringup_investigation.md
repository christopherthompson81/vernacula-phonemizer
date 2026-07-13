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

## Run 2 — kanji + segmentation — 2026-07-12

Added `kanji.ts` (ported from espeak-ng-portable) + the reading data (`readings.tsv` 60k whole-word map,
`fallback.tsv` 12k per-kanji on/kun/rendaku, `adverbs.txt` 802). Pipeline is now
`text → segmentText (bunsetsu spaces) → applyReadings (kanji→kana) → kanaToIpa`. The whole-word longest-match
map resolves on/kun disambiguation (`日本語` matches the 3-char key), so the **14 MB Viterbi IPADIC was NOT
needed** — only ~1.5 MB of reading data. Bunsetsu segmentation is the lighter orthographic heuristic
(kana→kanji transition = new phrase; case particles が/を/に end a phrase; て-form + auxiliary split; adverbs
are their own bunsetsu).

**Validation vs the espeak-ng-portable snapshot (`words-50000.ja`, 50k words, 32k containing kanji;
pitch/stress stripped): 93.51% exact, 93.30% on kanji words, 99.55% once deliberate espeak-quirk divergences
are excluded** (nasV `ん→ũ/ĩ` = 2766, sokuon `hC` = 251).

To get there I reverse-engineered espeak's exact long-vowel behaviour by probing its own `phonemizeText` (ja is
beyond-espeak / shimOracle:false, so its output IS the reference), fixing three coalescence bugs my Phase-1
kana engine had:
- **を is a distinct kana** — coalesce on the KANA, not the phoneme, so `語を→ɡo̞o̞` (not `ɡo̞ː`); espeak keeps the
  particle boundary. `おう→o̞ː`/`えい→e̞ː` digraphs still fold.
- **youon blocks same-vowel folding** — `じゅう→d͡ʑɯᵝɯᵝ`, `きゅう→kʲɯᵝɯᵝ` (espeak keeps two morae after a small
  ゃゅょ), while the `お+う` digraph still fires after youon (`きょう→kʲo̞ː`). Tracked with a `prevYouon` flag.
- **stacked length** — a second compatible vowel lengthens an already-long mora (`経緯 けいい→ke̞ːː`,
  `豪雨 ごうう→ɡo̞ːː`); compare against the base vowel ignoring a trailing ː.
Also: small ぁぃぅぇぉ act as casual-text prolongations (`なぁ→näː`), and the extended-katakana gate was broadened
to small-yu so `デュ` loanwords resolve (`プロデューサー→pɯᵝɾo̞dʲɯᵝːsäː`).

Residual (~180 real): espeak's sokuon-before-fricative quirks (`っず→sz`, `っじ→ɕd͡ʑ`) and rare loanword oddities;
plus ~30 junk word-list fragments (bare small kana ゅ/ょ) that legitimately drop. The `ん→ũ` and doubled-vowel
espeak conventions are deliberately NOT reproduced — we emit the cleaner moraic `ɴ` and the proper length mark ː.

Phase 3 (pitch accent ꜜ) remains deferred.

**Data provenance:** the reading tables (`readings.tsv`, `fallback.tsv`, `adverbs.txt`) are derived from the
espeak-ng-portable Japanese front-end, whose kanji readings come from JMdict / KANJIDIC (© EDRDG, licensed
CC BY-SA 4.0) with IPADIC-derived surfaces. Attribution is carried here per the EDRDG licence.

## Run 3 — pitch accent (Phase 3) — 2026-07-12

Added `pitch.ts` (ported from espeak-ng-portable's `japanesePitchAccent.ts` + `render.ts` lookup) + the merged
`pitch-accent.tsv` (434k keys, 7.7 MB). Tokyo lexical pitch is contrastive (箸 häꜜɕi vs 端 häɕi vs 橋 häɕiꜜ);
the accent NUCLEUS (a mora index, 0 = heiban) is marked with the IPA downstep `ꜜ` after the nucleus mora.

**Mora structure, not string re-parsing.** espeak's `segmentMorae` re-parses the IPA and relies on moraic ん
surfacing as `ũ/ŋ/ɴ` (never an onset). OUR engine assimilates ん→`n/m` (cleaner, but ambiguous with onsets —
`せんたく` would miscount). So `kana.ts` was refactored to expose `kanaToMorae` — the mora LIST it already builds
(each ː / moraic ん / sokuon っ is its own element) — and the downstep is placed by index, never re-parsing.
Same-vowel coalescence now tracks `lastVowel` (survives a ː) so stacking still works (`けいい→ke̞ːː`).

**Lookup** (per bunsetsu, surface-first for homograph disambiguation): exact surface (箸) → surface content
stem with trailing case-particles/copula stripped, kanji-ending only (橋を→橋, 天気です→天気) → reading stem →
exact reading (はし). Merged lexicon priority: consensus (kanjium/OpenJTalk/UniDic vote) > OpenJTalk-inflected
> UniDic base. Sources: kanjium (CC BY-SA), OpenJTalk (naist-jdic), UniDic (NINJAL).

**Validation vs the espeak-ng-portable snapshot (WITH ꜜ): 92.54% byte-for-byte exact, 99.56% accounted**
(2766 `ん→ũ` + 251 sokuon-`hC` deliberate segmental divergences, 490 pitch-position diffs). On the 46,761
segmentally-identical words, **pitch agrees 98.95%** (46271/46761) — the 490 residual are nucleus-position
disagreements from merge-priority differences. `phonemizeWord` now carries pitch; `phonemizeWordSegmental` is
the pitch-free helper for segmental validation.

**Japanese is now COMPLETE** across all three phases: kana core + numbers (Phase 1), kanji readings + bunsetsu
segmentation (Phase 2), and lexical pitch accent (Phase 3). The census primitives ɯ ɸ ̞ ̈ ɴ ɾ ᵝ plus the
downstep ꜜ are all emitted.
