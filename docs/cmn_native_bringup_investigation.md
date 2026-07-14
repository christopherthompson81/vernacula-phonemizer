# Mandarin (cmn) native bring-up — investigation

Third native language for vernacula-phonemizer (after hi, en). Direct-to-vernacula,
independent of the espeak base. Canonical-IPA output only.

## Architecture

`Han text → segment + Hanzi→pinyin (polyphone-aware) → tone sandhi → pinyin→IPA → canonical IPA (Chao tones)`

- Hanzi→pinyin: pypinyin (MIT) char + phrase dicts; Unihan kMandarin fallback. NON-espeak.
- pinyin→IPA: ~410-syllable lookup table GENERATED from espeak-ng-portable's already-converged
  canonical cmn engine (validated vs wikipron+epitran). We carry the OUTPUT correspondence as
  declarative data, not the espeak engine.
- tones: number → Chao contour letters, kept as numbers through sandhi then rendered.
- sandhi: 3-3 (214+214→35+214), 一 yī, 不 bù, neutral tone — engine.

## Phasing
1. Pinyin path: syllable→IPA + tones + sandhi. Anchor: espeak-portable integration-test values
   (zhong1 guo2 → ʈ͡ʂˈoŋ˥˥ kˈuo˧˥ ; ni3 hao3 → nˈi˧˥ xˈɑᵘ˨˩˦ [3-3 sandhi]).
2. Hanzi front-end: char + phrase dict + greedy longest-match segmentation.
3. Numbers + normalization + punctuation→pause.

## Resources located
- /tmp/pptest/pp/pypinyin/{pinyin_dict.json (788K, char→readings), phrases_dict.json (2.5M, phrase→per-char)}
- /tmp/Unihan_Readings.txt (kMandarin, 44,349 chars)
- espeak-ng-portable data/cmn/ (converged; meta.toneChao, sandhi, canonicalGlyphMap)

## Run 1 — Phase 1 complete (pinyin path)

Generated the 424-syllable toneless IPA table from the converged engine. KEY FINDING: espeak places the
Chao tone INCONSISTENTLY — `zhong1→ʈ͡ʂˈoŋ˥˥` (after coda) vs `bang2→pˈɑ˧˥ŋ` (before coda ŋ). Toneless
segments are consistent, so we strip all tone letters and the engine re-appends the tone at SYLLABLE END
uniformly (standard convention `中 [ʈʂʊŋ˥]`; fixes the espeak defect). 8 garbage rows (ü + syllabic-nasal
interjections routed to English) hand-patched from validated pieces (lüe→lˈyɛ, ju→t͡ɕy → lü=lˈy etc.);
non-standard `wong` dropped → 424 syllables.

Engine: parseSyllable → third-tone sandhi (3+3→2+3, L→R pairwise) → append Chao. Reproduces the
espeak-portable anchors exactly (zhong1 guo2 → ʈ͡ʂˈoŋ˥˥ kˈuo˧˥ ; ni3 hao3 → nˈi˧˥ xˈɑᵘ˨˩˦). 4 test groups pass.

OPEN CONVENTION QUESTIONS (surfaced to user):
- per-syllable ˈ on every full-tone syllable (espeak convention, kept) vs drop for a tone language.
- tone-at-end regularization diverges from espeak on -n/-ng syllables (intentional).

Next: Phase 2 Hanzi front-end (pypinyin char + phrase dicts, greedy segmentation, polyphone disambiguation).

## Run 2 — Phase 2 complete (Hanzi front-end) + stress convention

USER DECISION: dropped per-syllable stress (tone-only). Mandarin has no contrastive lexical stress;
tone + neutral-tone absence carry prominence. Stripped ˈ/ˌ from syllable-ipa.tsv.

Built chars.tsv (41,923 Hanzi → base+tone readings) + phrases.tsv (47,111 phrases) from pypinyin (MIT)
via tools/build-cmn-pinyin.mjs (diacritic→base+tone at build time; runtime needs no diacritic parser).
Segmenter: greedy longest-match against phrase dict (polyphone disambiguation), single-char fallback,
non-Han pass-through. Verified: 银行→jin˧˥ xɑŋ˧˥ (行=háng, not xíng), 你好 3-3 sandhi across segmentation,
绿→ly˥˩, phrase-baked 一 sandhi (一不小心→ji˧˥...=yí). Full suite green.

Next: Phase 3 — numbers (Arabic + Chinese numerals), punctuation→pause, 一/不 sandhi for bare chars,
Latin→English routing. Then: independent-referee validation pass (wikipron/epitran) + C# mirror decision.

## Run 3 — Phase 3 complete (numbers, punctuation, Latin) + referee spot-check

Phase 3: Arabic→Chinese-numeral quantity compositor (numbers.ts; 万/亿 grouping, internal 零, 12→十二),
spliced inline before segmentation so number readings inherit sandhi+polyphone (123→一百二十三, 一→yì via
phrase dict). Punctuation 。，、？！→inline pause marks; embedded Latin→injected en phonemizer. 24 tests pass.

REFEREE SPOT-CHECK vs wikipron cmn (independent, Wiktionary): tones align PERFECTLY (˨˩˦=²¹⁴, ˥˩=⁵¹,
˧˥=³⁵, ˥˥=⁵⁵). Segments agree modulo already-adjudicated broad/narrow convention (our oŋ vs their ʊŋ for
-ong; our o vs their ɔ for 我; our glide j/ᶦ/ᵘ vs their i̯/ʊ̯ subscripts). No new defects from the tone-at-end
+ stress-drop transforms. 不 wikipron entry = fǒu (archaic) vs our bù (common, correct). Confirms the
segmental IPA is inherited-validated; new surface (polyphone selection, number composition) is sound.

STATUS: cmn native bring-up FUNCTIONAL across pinyin + Han text. Remaining refinements: year/ID digit-string
reading, bare 一/不 sandhi, colloquial 两, full referee sweep, C# mirror (if pursued).

## Run 4 — Full referee sweep (epitran + wikipron)

Two independent referees, normalizer folds pure notation + adjudicated vowel conventions, diff-core buckets
separate systematic convention from per-syllable defects.

FOUND + FIXED 1 real defect: bare -e monophthong final was rendered INCONSISTENTLY (o for ce/ge/he/e/re/se;
ə for de/te/ne/le) — should be ɤ. Both referees agree (wikipron 特tʰɤ 色sɤ 客kʰɤ; epitran ɤ). Fixed all 16
bare-e syllables → ɤ (tools/cmn-referee-sweep.mjs surfaced it; pinned in mandarin.test.ts). NOT touched:
-eng/-en (ə is standard-accepted before nasal), -ie/-üe (e=ɛ; epitran's ɤ there is ITS bug, ours right).

AGREEMENT after fix (lenient = fold ɑ/a, ɔ/o, ʊ/o):
- epitran cmn-Latn (syllable table): 82.1% (was 75%). Residual = glide sub/superscript, bo/po/mo/fo glide,
  syllabic-nasal interjections, epitran üe naivety.
- wikipron cmn (Hanzi, credit-any-reading, 20,103 chars): 75.8%. Residual buckets each = ONE systematic
  convention across many syllables (y/w glide iy≠y, offglide iau≠iao, glottal onset ˀɤ, üan æ≠ɛ) — NOT
  scattered errors. Confirms segment quality; polyphone selection sound.

CONCLUSION: segmental IPA is referee-corroborated (2 referees). Residual divergence is convention, matching
the espeak-portable convergence experience (which folded more aggressively to 94%). cmn segments VERIFIED.
Tools: tools/cmn-referee-sweep.mjs (epitran), tools/cmn-wikipron-sweep.mts (wikipron).

## Run 5 — Year reading, 一/不 sandhi, colloquial 两

Three refinements added:
- YEAR: a 4-digit run before 年 reads digit-by-digit (2024年 → 二〇二四年 = èr líng èr sì nián); shorter numbers
  and bare numbers stay quantity readings (100年 → 一百年; 2024 → 两千零二十四).
- 一/不 SANDHI (yiBuSandhi.ts, on segmented tokens with source char): 不 before 4th → 2nd (不是 bú shì);
  一 before 4th → 2nd (一个 yí gè), before 1/2/3 → 4th (一天 yì tiān), final/ordinal(第一) → 1st (citation).
- 两: standalone 2 before 千/万/亿 or a leading 百 → 两 (2000 → 两千, 200 → 两百); 2 before a measure word → 两
  (2个 → 两个); but 二 kept in tens/units and inside compounds (十二个, 二十二). group4() `top` flag + measure set.

BUG FOUND + FIXED during this work: pre-substituting numbers into the char stream let a spoken digit 一
(三点一四, 2021年) wrongly take word-一 sandhi. Fixed by tracking a per-char `synth` mask through
substituteNumbers → segment: synthesized digits get no token `src`, so 一/不 sandhi fires only on real input
chars. Quantity 一 sandhi (一百 → yì bǎi) is unaffected (comes from the phrase dict). Refactored text() from a
regex TOKEN loop to a code-point walk carrying the mask. 28 tests pass; syllable-table sweep unchanged (82.1%).

REMAINING (documented in cmn.jsonc): counting-sequence 一 (一二三 reads sandhi'd, not citation — needs
non-tonal context), phone/ID digit-strings, C# mirror.

## Run 6 — PR review + fixes

Two parallel reviewers (numbers+sandhi, segmentation+routing) + self-probing. Found 4 real issues, all fixed:
1. HIGH: oversized/unsafe integers were SILENTLY DROPPED (raw ASCII digits fell into text()'s skip branch).
   Fix: digit-by-digit fallback (9007199254740992 → 九〇〇七… reads out).
2. Quantity 一 sandhi INCONSISTENT: 100→yì bǎi (phrase dict) but 1000→yī qiān, 10000→yī wàn (should be
   yì/yí). Root: the synth-exempt mask was too broad — it exempted quantity 一, not just digit-string 一.
   Fix: exempt ONLY digit-string readings (year, decimal fraction, oversized); quantity integer chars keep
   `src` so 一/不 sandhi fires (1000→yì qiān, matching typed 一千). Renamed mask synth→exempt.
3. Latin-only input (hello, iPhone) passed through raw instead of routing to English. Fix: pinyin fast-path
   now requires a tone digit + all-pinyin shape (PINYIN_INPUT), so bare Latin and number-bearing tokens
   route through Han mode (hello→English, abc2024→ABC+两千零二十四). ü path (lv4) preserved.
4. 第一个 read dì yí gè (greedy grabbed 一个 phrase, bypassing ordinal). Fix: segment forces 一 to a single
   src token after 第 → dì yī gè; bare 一个 unchanged (yí gè).

Reviewers confirmed NOT-bugs: UTF-16 number peek (self-consistent), synth/cp alignment, setTone regex,
loader parsing, code-point walk. LOW direct-API-only (negative int, "3." dangling) — arabicToChinese removed
(superseded by appendNumber). 32 tests pass; sweep unchanged (82.1%).

## Run 7 — 2026-07-14 — independent word-level validation (CC-CEDICT)

The epitran referee (84.7%) only scores SYLLABLE→IPA segment quality — it never tests the Hanzi front-end
(segmentation + polyphone choice), which is the substantive Phase-2 work. Validated it against CC-CEDICT (CC-BY-SA,
124k entries) — INDEPENDENT of our pypinyin-derived dicts, so not circular. Tool: tools/cmn-cedict-validate.mts
(regenerable; CC-CEDICT is a download, not committed). Compares segment(word) base pinyin vs CC-CEDICT citation
pinyin, per syllable, over 103,760 Han-only words:

- **READING (polyphone/segmentation): 97.3%**  ·  **FULL (reading+tone): 92.8%**
- Reading misses (2.7%) are almost all RARE/obscure chars (⺮ radical, 々 iteration mark, 〡–〩 Suzhou numerals,
  CJK-ext 㐌/㐤/𪢌) absent from our common-char dict — noise, not real text.
- Tone gap (4.5%) is mostly CONVENTION: ~2.3% neutral-tone (5) variation (optional/variable), and our phrase dict
  bakes 一/不 SANDHI (一个 → yi2 ge4, the SPOKEN form) where CC-CEDICT gives citation (yi1 ge5) — ours is arguably
  more correct for TTS. The GENUINE tone tail (non-neutral, non-一/不) is **2.14%** (2158 words): specific
  tone-polyphones (趟 tàng/tāng, 一打 dá "dozen", 更 gēng/gèng, 相 xiāng/xiàng), many in obscure idioms.

VERDICT: the Hanzi front-end is BUILT and validated — ~97% reading, ~98% tone-on-common; the 🟠 "pinyin-only,
not raw Hanzi" label is stale. Re-tier 🟠 → 🟡 (reliable for raw Hanzi; a small ~2% tone-polyphone + rare-char tail
a dict layer closes). CAVEAT: CC-CEDICT is isolated words, so this tests segmentation + within-word polyphones but
NOT cross-word CONTEXT disambiguation (rarer; the large phrase dict covers the common cases) — a running-text gold
would test that, same lesson as the Arabic isolated-vs-prose axis.

## Run 8 — 2026-07-14 — cross-word CONTEXT validation (g2pM CPP) → ✅

The CC-CEDICT check (Run 7) is isolated words; the untested axis was CROSS-WORD context polyphones. Validated against
the g2pM CPP benchmark (10,254 real sentences, each a marked target polyphone ▁X▁ + gold pinyin) — the standard
published context-polyphone test. Tool: tools/cmn-g2pm-context.mts (regenerable; g2pM + Unihan are downloads).

- **plain (balanced): 87.9%** — better than pypinyin (~85%), below g2pM's neural (~97.5%).
- **NATURAL-frequency-weighted: 97.7%** (each example weighted by Unihan kHanyuPinlu's real corpus count for its
  (char, gold-reading)).

The benchmark is BALANCED per polyphone — it samples each reading ~evenly, so it OVER-weights hard/non-dominant
readings (剌 la4, 应 yìng, 舍 shè in names). Same adversarial shape as the Arabic isolated-lemma referee. Decomposed:
61% of the balanced errors are wrong-DOMINANT chars, but kHanyuPinlu (frequency-weighted, INDEPENDENT) largely
AGREES with our pypinyin dominants (为 wèi, 应 yīng, 似 shì) and DISAGREES with the balanced benchmark's sampled
majority — confirming the benchmark's per-char distribution is NOT natural frequency. On natural running text (the
real TTS target) our context accuracy is 97.7%, matching the CC-CEDICT word-level 97.3%.

VERDICT: on real-frequency text the Hanzi front-end is ~97.5% (word-level AND context) — ✅. The remaining ~2.5% is
hard context-ambiguous polyphones (39% of the balanced errors) that only a context MODEL (g2pM-style neural) closes;
on natural text their impact is small. Re-tier 🟡 → ✅ (real-text reliable; the balanced-benchmark gap is a context-
model deferral, not a real-text quality gap). Same lesson as Arabic: the adversarial benchmark ≠ the real target.
