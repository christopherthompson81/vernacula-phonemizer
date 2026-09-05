# en-GB (SSBE / "BBC") accent-variant bring-up

**Goal:** the FIRST accent variant — modern Standard Southern British / "BBC host" English, as an
accent-transfer over the General-American `en` engine (not a separate language). Validates the accent
architecture codified in the scope gate: parent orthography input + a documented phoneme delta, verifiable
against a real RP referee.

## Architecture

`createEnglishGB()` = `createEnglish()` (the full GenAm G2P: dict + heteronyms + OOV joint-n-gram model) with a
phonological delta `toRP()` applied to the citation IPA. The delta is a Wells-lexical-set transform:

- **Non-rhoticity**: coda /ɹ/ dropped (`CODA` = /ɹ/ not before an optionally-stressed vowel); r-coloured vowels
  remap — NURSE ɝ→ɜː, lettER ɚ→ə, START ɑːɹ→ɑː, NORTH ɔːɹ→ɔː, NEAR ɪɹ→ɪə, SQUARE ɛɹ→ɛə, CURE ʊɹ→ʊə. Before a
  vowel ɚ/ɝ keep a **linking /ɹ/** (different→dɪfəɹənt).
- **Systematic vowel shifts (rule)**: GOAT oᶷ→əʊ; offglides ᶦ→ɪ, ᶷ→ʊ; LOT ɑː→ɒ (undoes the father-bother
  merger); un-flap the tapped /t̬/→[t].
- **Lexical sets (word lists, GenAm carries no split)**: BATH æ→ɑː, CLOTH ɔː→ɒ, yod-retention Cuː→Cjuː,
  PALM (exceptions kept [ɑː] against the LOT rule). Applied on the SHIPPED path only.

**Non-circular eval split** (Greek/Gujarati pattern): `phonemizeWordRules` = rules only (imported by the
referee eval → honest number); `phonemizeWord` = rules + the mined lexical-set lists (shipped). The lists are
mined from the wikipron UK referee, so evaluating the shipped path against it would be circular.

## Run 1 — 2026-07-18 — first cut, non-rhoticity + rule shifts only

39.1% rule-only vs wikipron `eng_latn_uk_broad` (76,284 merged-variant words). Common words correct on spot
check (water→wɔtə, people→pipəl). The 76k referee is dominated by rare/proper/foreign words where the SHARED
OOV model mangles the spelling (bindi→bˈaɪnd dropping the final i; caph→kʰˈææf; camboja→garbage) — the same
referee-noise ceiling as `en`'s own 36% on eng_us. **The % is not the quality signal.**

## Run 2 — lexical-set builder, first pass (build-en-gb-sets.ts)

Mined BATH/CLOTH/yod/PALM by "the edit that turns a folded MISS into a MATCH". yod only 35 words — far too few
for such a signature RP feature.

**Bug 1 (referee attests both variants):** the builder skipped a word if the plain rule output already matched
*any* referee variant. But the referee lists yod-DROPPED American variants too (nude→njuːd / nuːd), so the
yod-less form "already matched" and the word was never claimed. Fix: claim a word when the lexical-set edit
matches an attested variant *regardless* of whether a yod-less variant coexists (the BBC target prefers the
RP-diagnostic realisation whenever attested). → yod 54.

**Bug 2 (stress mark blocks the regex):** `([tdnszθl])uː` fails on stressed monosyllables because the stress
mark sits between onset and vowel — `nˈuː`, not `nuː`. Only unstressed-yod words (costume) matched. Fix:
`([tdnszθl])([ˈˌ]?)uː`. → yod 287, but the canonical new/tune/duty still yod-less.

**Bug 3 (aspiration blocks the regex + full-match gate too strict):** (a) the ENGINE regex missed aspirated
onsets — `tʰˈuː` has ʰ between t and uː; fixed to `([tdnszθl])(ʰ?)([ˈˌ]?)uː`. (b) the builder's full-word-match
gate missed yod words that also differ elsewhere (student: our schwa vs the referee's syllabic n̩). Switched yod
detection to POSITION-based: claim when the referee attests a post-coronal yod glide `[tdnszθl]j` that our GOOSE
slot lacks. → **yod 787**; new/news/nude/student/stupid/enthusiasm/assume all correct.

Final sets: BATH 584, CLOTH 653, yod 787, PALM 407 (2431 words). Shipped path ≈ 41% on the noisy referee — the
+1.9pp confirms the lexical sets are real but small against the rare-word bulk.

## Quality anchor — the diagnostic gold (88 words, 100%)

`english-gb.test.ts` hand-adjudicates the SHIPPED transform on core vocabulary + every Wells lexical set (RP
from Wells / Cambridge EPD conventions, NOT mined → non-circular). All 88 pass: non-rhoticity, BATH, CLOTH/LOT,
NURSE, GOAT, centring diphthongs (near/square/cure), yod-retention, PALM exceptions, dark coda [ɫ], the wide
diphthongs, linking-r. This is the real correctness signal, parallel to the "adjudicated common-word gold" the
other referee-noise-limited languages (en, tl, yue) cite.

## Run 3 — adversarial review (3 findings, all fixed)

1. **The registered public engine applied NO lexical sets** (HIGH). `createEnglishGB().text` called
   `toRP(e.text(input), "", lex)` with `word=""`, so every `set.has("")` was false — BATH/CLOTH/yod dead on the
   registry path AND PALM's LOT-protection lost (`father`→fɒðə). The gold tested `phonemizeWord` (per-word) and
   the eval tested `phonemizeWordRules` (no sets); neither exercised the shipped `.text()`. Fixed by adding a
   per-word output hook to `EnglishPhonemizer.text(input, wordTransform?)` — the GB delta now rides on the
   engine's per-word `Item{word, display}` with full number/heteronym/prosody context (not a fragile
   re-tokenisation). Verified on the registry path: grass→ɡɹɑːs, off→ɒf, new→njuː, father→fɑːðə.
2. **Global vs first-occurrence divergence** (MED-HIGH). The engine applied `/æ/gu` (global) but the builder
   validated `/æ/u` (first only) → `aftermath` (a BATH member) double-converted to ˈɑːftəmˌɑːθ (the `-math`
   syllable is TRAP /æ/). Fixed: engine edits are now first-occurrence, matching the builder. A word whose
   diagnostic vowel is not first never entered the set, so first-occurrence is exactly right.
3. **LOT-before-intervocalic-r** (MED) — already fixed in Run 2.5 via the mined `lotr` set (below).

### Run 2.5 — the LOTR lexical set (found while tracing, pre-review)

`sorry→sˈɑːɹi` (RP sɒɹi): the LOT rule's `(?!ɹ)` guard (needed to protect START coda `ɑːɹ`) also suppressed LOT
for INTERVOCALIC `ɑːɹ`. But it is lexical, not a blanket rule — `starry`/`safari` keep [ɑː] while `sorry`/
`borrow`/`tomorrow` take [ɒ], both `ɑːɹV` in GenAm. Mined a 5th set (`lotr`: ɑːɹ→ɒɹ) exactly like BATH; the
referee correctly separates them (attests sɒɹi but stɑːɹi → starry never claimed). 13 words. Gold +3.

## Deferred (documented residuals)

- **yod-COALESCENCE** after /t d/: modern SSBE tube→t͡ʃuːb, duke→d͡ʒuːk, tune→t͡ʃuːn, duty→d͡ʒuːti. Plain
  yod-insertion (tjuːb) matches neither the referee's coalesced form nor GenAm; a genuine further step (t/d + j →
  t͡ʃ/d͡ʒ). Traditional/conservative RP keeps tjuːb, so this is a register choice, not a bug.
- **Idiosyncratic US/UK lexical vowel swaps**: tomato→təˈmɑːtəʊ (we give the American təˈmeɪtəʊ), pasta→ˈpæstə
  (we give ɒ from the LOT rule). Not a systematic set → would need a small hand-authored override lexicon.
- **Pre-vocalic centring diphthongs** (aaron→ɛəɹən, hearing→hɪəɹɪŋ): lexical (marry-merry-Mary territory), a
  small class.

## Status

🟡 accent-variant, reliable + lexical-tail. Floor 0.38 (rule-only 39.1%, referee-noise-limited). The diagnostic
gold (100%) is the correctness anchor. First accent variant → establishes the pattern for pt-BR, es-419, en-IN.
