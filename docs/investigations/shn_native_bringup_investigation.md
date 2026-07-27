# Shan (shn) native bring-up investigation

Target: **Shan / Tai Long** (လိၵ်ႈတႆး), Southwestern Tai (Tai-Kadai), Myanmar's
Shan State (~3.3M), the **Shan abugida** (a Myanmar-script variant, Unicode
U+1000–U+109F + the Shan letters U+1075–U+108F), TONAL. Canonical IPA,
espeak-independent. The fleet's first Shan; joins the Tai-Kadai family (Thai/Lao/
Zhuang) but written in the Burmese-family script.

## Run 1 — referee landscape

- **wikipron**: `shn_mymr_broad.tsv` **2607** entries. HUMAN (Wiktionary),
  space-segmented, WITH TONES (Chao letters). The primary referee.
- **kaikki Shan**: no local dump; not pulled (wikipron is sufficient + primary).
- **epitran**: NO `shn-Mymr` mapping.
- **espeak**: ships `shn` (authored) — a second authored impl, not independent
  attestation. Not used as a referee.

Verdict: **🔷 human single-source** (wikipron 2607). The Burmese engine
(`src/languages/burmese/`) is the structural TEMPLATE (same Myanmar-script
abugida, syllable parse: onset → medials → rime[vowel×coda] → tone), BUT Shan
differs crucially: **tone is LEXICAL and marked with EXPLICIT diacritics**, so the
tone mapping is a direct lookup (unlike Burmese's orthographically-derived tone).

## Maps mined from wikipron (Run 1)

**TONES — fully deterministic, 100% consistent on 644 monosyllables:**
| mark | Chao | name |
|---|---|---|
| (unmarked) | ˨˦ rising | tone 1 |
| ႇ U+1087 | ˩ low | SHAN TONE-2 |
| ႈ U+1088 | ˧˧˨ | SHAN TONE-3 |
| း U+1038 visarga | ˥ high | tone 4 |
| ႉ U+1089 | ˦˨ falling | SHAN TONE-5 |
| ႊ U+108A | ˧ mid (rare, 2×) | SHAN TONE-6 |

**ONSETS:** ၵ→k ၶ→kʰ ၸ→t͡ɕ သ→sʰ (aspirated s!) ထ→tʰ ပ→p ၽ→pʰ ၾ→f တ→t ၼ→n
မ→m လ→l ဝ→w ယ→j ရ→r ႁ→h ႀ→θ ဢ→ʔ (glottal/zero onset) င→ŋ ၺ→ɲ. Medials:
ွ/ႂ→w (labialization), ျ→palatalises (ၵျ→t͡ɕ, ၶျ→t͡ɕʰ), ြ→r.

**CODAS (C + asat ်):** င→ŋ ၼ→n မ→m (nasals); ၵ→k̚ တ→t̚ ပ→p̚ (checked stops →
glottal-region); ဝ→w ႆ→j ၺ→j ႂ→ɰ (offglides/diphthong second element).

**VOWEL SIGNS (partial — the rime chart is the Run 2 tuning target):** inherent→a;
ႃ→aː; ိ→i ီ→iː; ု→u ူ→uː; ေ→eː; ႄ→ɛː; ဵ/ႅ→e/ɛ (short "e above"); ေႃ→ɔː;
ႆ→j-offglide (aj); combos ိူ→ɤ, ို→ɯ(ː), ၢႆ→aːj; ၢ (KAREN EU) context-varying.
Vowel quality/length interacts with the coda (an abugida rime chart, Burmese-style)
→ built as a parser + iterated against the referee in Run 2.

## Run 2 — engine (syllable parser) + tuning

Engine (`src/languages/shan/shan.ts`): per-syllable scan (onset → medials → rime →
tone), Shan words space-separated (no DAG segmentation). First pass **35.9% folded
/ 80.8% symbol** — the onset/coda/tone maps were right but the RIME chart was naive.

Tuning (all from the top residual classes):
- **⟨ူ⟩ (UU) → [o] closed / [uː] open; ⟨ူ⟩+ဝ → [oː]** (ၵူၼ်→kon, ၵူဝ်→koː).
- **medial ⟨ွ⟩ + inherent vowel → [ɔ]** (rounds, no -w- glide; ၵွင်→kɔŋ) — the
  Burmese wu-rounding.
- **⟨ၢ⟩ → short [a]** (not ɔ; ၵၢၼ်→kan), ⟨ႃ⟩ → long [aː].
→ **83.7% folded / 95.8% symbol.**

Second pass:
- **⟨ႂ⟩ / ⟨ွ⟩ + asat = a CODA offglide** (ႂ→[ɰ], ွ→[w]), NOT a medial (ၸႂ်→t͡ɕaɰ).
- **palatalisation ⟨ၵျ⟩→[d͡ʑ]** (voiced!), ⟨သျ⟩→[ʃ].
- **T5 (ႉ) glottalises to [˦˨ˀ] on a non-word-final syllable** (phrase-medial; the
  glottal ˀ is NOT backbone-folded, so it mattered).
- **⟨ိူ⟩→[ɤ], ⟨ို⟩→[ɯ] shorten before a coda.**
- tone ordering fixed to nucleus+coda+TONE (canonical; tone-folded so no score change).
→ **95.9% folded / 98.7% symbol.**

Third pass:
- **medial-w glide must not fire when the only sign is ⟨ႆ⟩** (FINAL_Y offglide):
  ⟨ွ⟩+ႆ+inherent → [ɔj], not [wɔj] (ၵွႆး→kɔj).
- **⟨ို⟩+ဝ → [ɯː]** (the ဝ merges to length, like ⟨ူ⟩+ဝ; မိုဝ်း→mɯː).
→ **98.4% folded / 99.1% symbol.**

**Final: 98.4% folded / 99.1% symbol** vs wikipron Shan (2607). The residual tail is
almost entirely a **wikipron ARTIFACT**: multi-lemma headwords whose pronunciation
covers only the sub-lemma, dropping a လွင်ႈ (lɔŋ)/တၢင်း (taŋ) prefix that our engine
correctly reads from the full orthography — our output is MORE faithful. 🔷 human
single-source. All 1253 repo tests pass; typecheck clean. Deferred: numbers (Shan
digits U+1090–99), phrase-level tone sandhi.

## Run 3 — 2-agent review

**★ CRITICAL catch (phonology reviewer): ⟨ၢ⟩ (U+1062) is long [aː], NOT short [a].**
The Run-2 tuning note "⟨ၢ⟩→short a (ၵၢၼ်→kan)" was WRONG — the referee is unanimous
(ၵၢၼ်→kaːn, တၢင်း→taːŋ, ထၢမ်→tʰaːm). Correct Shan orthography: ⟨ၢ⟩ writes
CLOSED-syllable /aː/ and ⟨ႃ⟩ (U+1083) the OPEN one — BOTH long; short /a/ is the
inherent (sign-less) vowel (တတ်း→tat̚). **Why it slipped: the backbone FOLDS length
(ː), so both the folded score AND my residual analysis were length-blind.** Fix:
⟨ၢ⟩→"aa" (long). This corrected ~550 words' canonical length: a length-sensitive
re-eval (tone-stripped, ː KEPT) went **68.9% → 90.3%**. The FOLDED score is unchanged
at 98.4% (ː folded) — the standard fleet metric — but canonical output is now right.
LESSON: a length-folding metric can hide a whole-class vowel-length error; the
phonology reviewer checking CANONICAL output (not the folded %) is what caught it.

**★ Minor (fixed): bare medial ⟨ႂ⟩ (U+1082) stays a -w- glide** (ၵႂၵ်း→kwak̚), it
does NOT round to [ɔ] — only ⟨ွ⟩ (U+103D) rounds the inherent rime.

**★ Code reviewer: the Myanmar DANDAS ။/၊ (U+104A/B) were inside the word range**
`[က-႟]` so the greedy word token claimed them and the pause code was dead. Fixed by
carving U+104A/B (→ punctuation) and the Shan digits U+1090–99 (→ number passthrough,
parity with ASCII) out of the word class.

Verified correct by review (no change): the 5-tone map + non-final T5 glottalisation,
onsets (ႀ→θ, သ→sʰ, ဢ→ʔ, ၸ→t͡ɕ, ⟨ၵျ⟩→d͡ʑ), ⟨ၺ⟩ coda→[j] (not ɲ), ⟨ႂ⟩ coda→ɰ, the
rime resolver (ူ→o/uː, ⟨ိူ⟩→ɤ, ⟨ို⟩→ɯ, medial-ွ→ɔ), and the scan loop (no infinite
loop / dropped syllable). Deferred (noted): a length-SENSITIVE eval mode (shared
tooling — would also surface length tails in lo/my/th) and Shan numbers.
