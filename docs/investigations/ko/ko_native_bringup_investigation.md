# Korean (ko) native bring-up

Target: Seoul-standard Korean, canonical IPA, espeak-independent. Slot #14 in the OmniVoice coverage set
(contributes `̚` unreleased stop + `͈` tense/fortis). Korean is written in HANGUL — a featural alphabet composed
into syllable blocks; each block decomposes algorithmically into initial (L) / medial (V) / final (T) jamo.
espeak has solid Korean, so the espeak-ng-portable canonical output is the oracle. This is the most
allophony-heavy language in the set — Korean's phonology is a web of cross-syllable sandhi.

## Engine (g2p.ts)
Decompose each Hangul block via the Unicode formula (`S = 0xAC00 + (L·21 + V)·28 + T`), then apply the sandhi
over the jamo sequence (coda of syllable i vs onset of i+1), then neutralise + realise:
- **liaison**: a coda before a null-onset (ㅇ) vowel moves to onset, restoring the UNDERLYING consonant
  (같이→kɐt͡ɕʰi, not the neutralised ㄷ); ㅎ deletes (좋아→t͡ɕoɐ);
- **palatalization**: a LIAISED ㄷ/ㅌ + 이 → t͡ɕ/t͡ɕʰ (같이); gated to liaison so word-initial 팀→tʰim is safe;
- **lenis voicing**: ㄱㄷㅂㅈ → ɡ/d/b/d͡ʑ after a vowel or sonorant coda (가다→kɐdɐ, 한국→hɐnɡuk̚);
- **aspiration**: ㅎ ± a lenis stop → aspirated, either order (놓고→nokʰo, 좋다→t͡ɕotʰɐ);
- **tensification**: an obstruent coda + a lenis stop → tense (학교→hɐk̚k͈jo, 맑다→mɐk̚t͈ɐ);
- **nasalization**: an obstruent coda + a nasal onset → homorganic nasal coda (국물→kuŋmuɭ, 합니→hɐmni);
  and ㄹ → ㄴ after such a coda (독립→toŋnip̚);
- **lateralization**: ㄴㄹ / ㄹㄴ → ll (신라→siɭɭɐ);
- **coda neutralization**: the 7 surface codas (k̚ t̚ p̚ n m ŋ ɭ), obstruents UNRELEASED ̚; two-consonant coda
  clusters (ㄺ ㄼ ㄶ ㅄ …) split — one survives as coda, the other liaises.

## Stress (derived statistically from the gold)
Korean has no lexical stress; espeak's stressRule 8 turned out to be a clean weight rule, confirmed on the gold:
**stress the first HEAVY (coda-bearing) syllable; if no syllable is closed, the first.** For 2-syllable words
this is exact: open+closed → stress 2 (사람→sɐɾˈɐm), everything else → stress 1 (100%/100%/89% in the data).

## Lexical tensification (경음화) — a lexicon, NOT a rule
The one class of Korean tensing that is NOT phonologically derivable: Sino-Korean §26 (한자어 ㄹ받침 + ㄷㅅㅈ →
된소리: 갈등→kɐɭt͈ɯŋ), 사잇소리 compounds (물고기→muɭk͈oɡi), and loanword-initial fortis (게임→k͈eim). The
espeak-ng-portable investigation MEASURED that no rule works — ㄹ+ㄷ is only 14% tense, ㄹ+ㅅ 43% (a blanket
"ㄹ+C→tense" would be wrong 57–88% of the time), because §26 is scoped to Hanja-origin morphemes that Hangul
doesn't mark. So `tensification.tsv` (1,208 entries, `word → syllable indices whose onset tenses`) is ported
from espeak-ng-portable's `koreanTensLexicon.ts` — itself sourced from wikipron (independent human data). We
force-tense those onsets (a tense onset never voices); native ㄹ+C words absent from the lexicon stay lenis
(알다→ɐɭdɐ), so no over-tensing.

## Validation
vs the espeak-ng-portable canonical gold (26.8k Hangul words): **exact 91.2%, segmental 99.4%**. Residual:
- ~0.6% segmental — tensing words beyond the 1,208-entry lexicon's coverage (it is word-level, so a tensing
  word not in wikipron, or inside a spaceless compound, is missed).
- ~8% stress-position — the 11% closed+closed exceptions and longer-word cases beyond the first-heavy rule.

## Numbers
Sino-Korean cardinal compositor (numbers.ts): 일 이 삼 … scaling by 만/억/조 (CJK myriad system).

## Run 1 — Hangul sandhi engine — 2026-07-12
Built g2p.ts (decomposition + the full sandhi + coda neutralisation) + numbers + korean.ts; registered `ko`.
Iterated the sandhi against the gold: fixed liaison to restore the underlying coda, gated palatalization to
liaised onsets, ㅢ→ɯi, ㄹ-after-ㄹ→ɭ. Derived the first-heavy-syllable stress rule statistically (63%→89.5%
exact). Residual is lexical tensification + long-word stress. 107 tests pass.
