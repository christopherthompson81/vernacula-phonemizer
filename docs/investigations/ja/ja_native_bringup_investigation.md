# Japanese (ja) native bring-up

Target: Standard (Tokyo) Japanese, canonical IPA, espeak-independent. Slot #10 in the OmniVoice coverage set
(contributes `ɯ`, `ɸ`, `̞`, `̈`, `ɴ`, `ɽ`, `ᵝ`). There is EXTENSIVE prior work in the sibling repo
`<portable-espeak checkout>` (verified, PR #1317): a pure-TS kuromoji-style Viterbi morphological analyzer
(`src/japaneseMorph.ts` + `data/ja/morph-dict.tsv` 10.8 MB + `morph-matrix.bin` 3.5 MB), kanji readings
(`src/kanjiReadings.ts` + JMdict/KANJIDIC/name-reading JSON), pitch accent (`src/japanesePitchAccent.ts` +
lexicon), and number/prose evals. This bring-up REUSES that work.

## Convention (from the portable-espeak canonical snapshot)
Narrow Tokyo Japanese. Vowels: あ→ä (centralized), い→i, う→ɯᵝ (compressed), え→e̞, お→o̞ (mid-lowered).
Consonants: し→ɕ, ち→t͡ɕ, つ→t͡s, ひ→ç, ふ→ɸ, ら-row→ɾ (ɽ canonicalizes to ɾ), ん→ɴ (moraic). Long vowel ː;
おう/えい → o̞ː/e̞ː. Sokuon っ → gemination. Pitch accent → ꜜ downstep (needs the lexicon → Phase 2).
Examples: 私は学生です → wätäɕihä ɡäkɯᵝse̞ide̞sɯᵝ; です → de̞sɯᵝ; する → sɯᵝɾɯᵝ.

## Plan
- **Phase 1 (this run): native kana → IPA + numbers.** A clean mora-based kana/katakana→IPA engine (gojūon +
  dakuten + youon + sokuon + long vowels + moraic ん), plus Japanese number reading. Handles kana text and emits
  the census primitives. No dictionary needed. Segmental only (pitch deferred).
- **Phase 2: kanji + segmentation.** Port japaneseMorph.ts (Viterbi) + morph data + kanjiReadings + the reading
  JSON from portable-espeak → segment unspaced text, resolve kanji→kana, feed the kana engine.
- **Phase 3: pitch accent.** Port japanesePitchAccent.ts + the pitch lexicon → ꜜ downstep.

## Run 1 — kana core — 2026-07-12

Built `src/languages/japanese/{kana,numbers,japanese}.ts` + tests; registered `ja`. Mora-based kana→IPA:
gojūon + dakuten/handakuten + youon (きゃ) + sokuon (っ→geminate, word-final→ʔ) + long vowels (ー, おう→o̞ː,
えい→e̞ː, same-vowel→ː) + moraic ん place-assimilation (n/ŋ/m before coronal/velar/labial, else ɴ) +
extended (foreign-sound) katakana (ファ→ɸä, チェ→t͡ɕe̞, ディ→di, ヴ→v) + Sino-Japanese numbers.

**Validation vs the portable-espeak canonical snapshot** (`words-50000.ja`, kana-only words, pitch/stress
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

Added `kanji.ts` (ported from portable-espeak) + the reading data (`readings.tsv` 60k whole-word map,
`fallback.tsv` 12k per-kanji on/kun/rendaku, `adverbs.txt` 802). Pipeline is now
`text → segmentText (bunsetsu spaces) → applyReadings (kanji→kana) → kanaToIpa`. The whole-word longest-match
map resolves on/kun disambiguation (`日本語` matches the 3-char key), so the **14 MB Viterbi IPADIC was NOT
needed** — only ~1.5 MB of reading data. Bunsetsu segmentation is the lighter orthographic heuristic
(kana→kanji transition = new phrase; case particles が/を/に end a phrase; て-form + auxiliary split; adverbs
are their own bunsetsu).

**Validation vs the portable-espeak snapshot (`words-50000.ja`, 50k words, 32k containing kanji;
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
portable-espeak Japanese front-end, whose kanji readings come from JMdict / KANJIDIC (© EDRDG, licensed
CC BY-SA 4.0) with IPADIC-derived surfaces. Attribution is carried here per the EDRDG licence.

## Run 3 — pitch accent (Phase 3) — 2026-07-12

Added `pitch.ts` (ported from portable-espeak's `japanesePitchAccent.ts` + `render.ts` lookup) + the merged
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

**Validation vs the portable-espeak snapshot (WITH ꜜ): 92.54% byte-for-byte exact, 99.56% accounted**
(2766 `ん→ũ` + 251 sokuon-`hC` deliberate segmental divergences, 490 pitch-position diffs). On the 46,761
segmentally-identical words, **pitch agrees 98.95%** (46271/46761) — the 490 residual are nucleus-position
disagreements from merge-priority differences. `phonemizeWord` now carries pitch; `phonemizeWordSegmental` is
the pitch-free helper for segmental validation.

**Japanese is now COMPLETE** across all three phases: kana core + numbers (Phase 1), kanji readings + bunsetsu
segmentation (Phase 2), and lexical pitch accent (Phase 3). The census primitives ɯ ɸ ̞ ̈ ɴ ɾ ᵝ plus the
downstep ꜜ are all emitted.

## Run 4 — 2026-07-14 — independent validation vs OpenJTalk + は/へ particle fix

The wikipron referee (57.9%) is toneless/segmental and can't measure the kanji front-end or pitch; the Run-3
validation was vs the portable-espeak SNAPSHOT the tables were ported from (semi-circular). Wired an INDEPENDENT
reference: pyopenjtalk (OpenJTalk, naist-jdic — a different reading source than our JMdict-derived readings.tsv) over
6000 random Tatoeba sentences. Compared full-sentence reading via our OWN kanaToIpa (normalises katakana/long-vowel
notation → the diff is purely the reading).

**FOUND: は/へ topic/direction particles read as ha/he, not wa/e** — a systematic bug (は is in nearly every
sentence; を already worked). Full-reading match was only 30.4% (kanji-only, particles normalised: 74.8%). FIX
(kanji.ts segmentText): extend the が/を/に particle detection to は/へ (single mora after a content char — はな/へや
that START a word are matched as ≥2-mora units, so a single-char は/へ after content is the particle) and convert
は→わ, へ→え inline so the reading pass emits wa/e. 私は→wätäɕiwä, 東京へ→…e̞, はな→häꜜnä (unchanged). **Full reading
30.4% → 74.2%** (now == the kanji-only 74.9%, i.e. the particle bug is fully closed). Updated 2 goldens that encoded
the old は→ha bug.

REMAINING (next): numbers+counters in kanji-mixed text (8月20日 → our 8つき20ひ vs はちがつはつか — counter readings
月がつ/日か/時じ/人にん + digit reading), a few kanji-reading errors (気に入る→きにいる not きにはいった; 人 じん/ひと),
and the ゅう/ゅー youon long-vowel notation inconsistency (しゅう→ɕɯᵝɯᵝ vs せい→se̞ː). Pitch not yet independently
validated vs OpenJTalk (semi-circular anyway — we merged its data).

## Run 5 — reading is ✅-level (97.7% per-char); full-width digits fixed

Fair per-CHARACTER reading accuracy vs OpenJTalk (5684 non-number Tatoeba sentences, long-vowel-folded, after the
は/へ fix): **97.7%** (whole-sentence exact 83.3% — harsh: one homograph fails a whole sentence). Comparable to cmn's
CC-CEDICT 97.3%. Reusable tool: tools/eval/ja-openjtalk-validate.mts. So the kanji reading front-end is ✅-level.
Fixed: full-width digits ０-９ were dropped (３個 → こ, the 3 lost) → normalise to ASCII in text() (３個 → さんこ,
２０２４年 → …). The residual ~2.3% per-char is homograph context (人 ひと/じん, 彼 かれ/あの, 気に入る→きにいる),
は in fixed greetings (今日は/今晩は matched as whole words → は not converted), and the ゅう long-vowel convention.

REMAINING for ✅: (1) COUNTER readings after numbers — a substantial subsystem: 月がつ, 日 irregular (ついたち/ふつか/
はつか), 時じ, 人 irregular (ひとり/ふたり/にん), 分 rendaku (ぷん/ふん) — currently the standalone kanji reading is
used (8月→はちつき not はちがつ); ~5% of sentences. (2) PITCH accent independent validation (built + self-consistent
92-99% vs the espeak snapshot, but not yet vs OpenJTalk — semi-circular anyway since we merged its data). (3) the
ゅう youon long-vowel notation (espeak-inherited ɯᵝɯᵝ vs the consistent ː).

## Run 6 — 2026-07-14 — counter subsystem (助数詞): 99.9% vs OpenJTalk

Built `src/languages/japanese/counters.ts` (`readCounter(n, counter)`): number+counter euphony — gemination
(促音便: 1→いっ, 8→はっ, 10→じゅっ; 6→ろっ/100→ひゃっ for k/h not s), h-counter handaku/rendaku (本 1→いっぽん,
3→さんぼん), Sino 4/7/9 readings (4月→しがつ, 4時→よじ, 7人→しちにん), and fully-irregular tables (日 ついたち…はつか;
人 ひとり/ふたり). ~28 counters. Data model: `cls` (k/s/h/regular) drives gemination; `three` = post-ん rendaku form
(broad by default: さん AND せん both rendaku, e.g. 本→ぼん, 軒→げん, 足→ぞく); `narrowThree` restricts it to digit-3
(階: 3階さんがい but 1000階せんかい); `four` = post-よん handaku (分→ぷん, 泊→ぱく); `n4/n7/n9` Sino overrides; `irr`/`table`.

Validated vs an OpenJTalk gold of 980 num×counter combos (`tools/eval/ja-counter-validate.mts`, long-vowel-notation-folded,
impossible combos like 13月/32日 skipped): **99.9% (941/942)**. The one "miss" is 1日 ついたち (calendar date) vs
OpenJTalk's いちにち (one-day duration) — both correct, a semantic not a phonological divergence, so kept ついたち.
Iterations that got there: 35.8% → 96.8% (data: 日/人 Sino 7/9, 分/泊 handaku four-form; algorithm: generalize the
digit-3 handaku check to all ん-ending numbers so せん=1000 rendakus like さん) → 99.9% (頭/着/丁 are gemination-class
not regular; 軒/足 broad rendaku; 階 narrowThree).

WIRED into the pipeline: `text()` fuses a `\d+` + following counter kanji into its kana reading BEFORE segmentation
(`/(\d+)(\p{Script=Han})/` → readCounter, null for non-counters → digits pass through), so it flows through the normal
kana path and gets pitch. 1本→iꜜppo̞ɴ, 3個→säꜜŋko̞, 2024年→…jo̞ne̞ɴ (was …jo̞nne̞ɴ, now the 4→よ fusion is correct).
5 counter tests added to test/japanese.test.ts. Full suite 250/250, typecheck clean.

REMAINING for ✅: PITCH accent independent validation (still only self-consistent vs the espeak snapshot; semi-circular
vs OpenJTalk since we merged its data), and the ゅう youon long-vowel notation convention (ɯᵝɯᵝ vs ː).

### Run 6b — review fixes (2 real bugs)

8-angle review of PR #138 surfaced two real bugs (both merged into #138 before merge):
1. **Internal は/へ corrupted by the particle heuristic.** The fused reading was injected into pre-segmentation
   text as hiragana, so segmentText's は→わ / を particle rule mis-fired on a counter reading with an internal は
   (2泊→にはく → にわく → `niwä kɯᵝ`). Fix: emit the reading as KATAKANA (kanaToIpa treats it identically; the
   particle rule is hiragana-specific). にはく now survives.
2. **Fusing before a compound.** `/(\d+)(\p{Script=Han})/` fused a counter kanji even when it heads a longer
   compound word (3時間→さんじ+間→さんじあいだ; 3年生→さんねん+生→さんねんなま; 1日中→ついたち+中). The naive fix
   (negative-lookahead "no kanji may follow") over-corrects — it also kills a legitimate euphonic counter before
   a verb (1冊読む→いっさつ). The dictionary IS the discriminator: 時間/年生/日中/年間/週間/分間/人前 are whole-word
   entries in the 60k readings map; 冊読 is not. New `headsCompound(text)` (kanji.ts) = "a ≥2-char reading word
   starts here"; fusion is suppressed when the counter kanji heads one. 3時間→さん じかん ✓, 1冊読む→いっさつ ✓.

A third finding — the irregular hundreds 300/600/800 (さんびゃく/ろっぴゃく/はっぴゃく) end in びゃく/ぴゃく and missed
the ひゃく gemination (300本→さんびゃくほん should be さんびゃっぽん) — the *validator* had missed it because the
OpenJTalk gold jumped 100→1000, skipping 200–900. Added びゃく/ぴゃく→びゃっ/ぴゃっ to the gemination table (k/h, not
s: 300頭→さんびゃくとう) and widened the gold to all hundreds+thousands (1342 combos): **99.9% (1341/1342)** — again
only the 1日 ついたち/いちにち semantic split remains.

## Run 7 — 2026-07-14 — ː preferred for long vowels (youon inconsistency closed)

Per user steer, ː is now the preferred long-vowel notation EVERYWHERE. Previously the same-vowel coalescence in
kanaToMorae was gated on `!prevYouon` (espeak-matching: じゅう→d͡ʑɯᵝɯᵝ but じゅー→d͡ʑɯᵝː) — an inconsistency where a
doubled vowel and a ー-lengthened vowel of the SAME length rendered differently. Removed the guard (and the now
write-only `prevYouon` var): じゅう→d͡ʑɯᵝː, きゅう→kʲɯᵝː, しゅう→ɕɯᵝː == しゅー. Morae count is unchanged (ː is still its
own mora), so pitch downstep placement is unaffected. Reading validator steady at 97.7% per-char (it already folded
long vowels, so the change is neutral there — but the raw canonical output is now consistent). Updated the 十 golden
(d͡ʑɯᵝɯᵝ→d͡ʑɯᵝː) and stale validator comments.

## Run 8 — 2026-07-14 — pitch-accent validation vs OpenJTalk (committed eval)

Goal: independently validate the Tokyo pitch accent (ꜜ downstep). FINDING on referees: our pitch-accent.tsv merges
the THREE standard Tokyo-accent corpora (kanjium/OpenJTalk/UniDic), and there is NO large free accent source
outside them — the entire 375 MB kaikki/Wiktionary ja extract contains **3** explicit-Tokyo-accent words (it carries
Kyōto/Kagoshima DIALECTAL accents, not standard Tokyo; the note-less default is bare kana with no accent). So a
fully-independent scale referee does not exist. Per the user's steer, validate against OpenJTalk with the honest
semi-circular caveat (OJT is one of the three voters).

Ported the OpenJTalk eval into this repo: `tools/eval/ja-pitch-eval.mts` + committed gold `tools/eval/ja_pitch_reference.tsv`
(2500 complete content words, OJT nucleus/mora/reading — OJT integers only, facts-not-expression). The eval computes
OUR nucleus (accentNucleus) + morae (kanaToMorae), restricts to reading-matched + mora-aligned words (so it measures
ACCENT not reading), and DISCOUNTS OOV-heiban coincidences (a word absent from the lexicon defaults to flat 0).

RESULT: **1911/1990 = 96.0%** nucleus agreement (95.6% discounting the 8 OOV-heiban coincidences → good lexicon
coverage). 503 reading-mismatches (excluded; scored by the reading eval) + 7 mora-mismatches. This matches
portable-espeak's 95.9% — the port is faithful. The 79 disagreements are 52 off-by-1 and are dominated by the
DOCUMENTED contested set (映画 0/1, 毎日 0/1, 期間 1/2, 機会/機械 1/2, 心 2/3) + verb-stem FRAGMENTS (聞い/言い/歩い —
mid-conjugation, ill-defined isolated accent), i.e. contested-accent + measurement artifact, NOT systematic error.
JA accent is an inherent ~90-95% task (dictionaries themselves disagree), so 96% is near the achievable ceiling.

Regression floor: `test/japanese-pitch.test.ts` (agreement ≥94%, sample >1800, OOV-heiban <40). CAVEAT stays honest:
conservative-but-not-fully-independent referee. VERDICT: pitch validated at near-ceiling (semi-circular referee).
