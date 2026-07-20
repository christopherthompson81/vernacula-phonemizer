# Sesotho / Southern Sotho (st) native bring-up

Sesotho / Southern Sotho (st) — Bantu (Sotho-Tswana, S33); ~6M, official in Lesotho + South Africa. Latin,
open CV. Sibling of the done Setswana (tn).

## Gate — no usable referee, not aliasable → authored

No wikipron, no epitran (sot/st), and kaikki "Sotho" has only **3 IPA entries** — unusable as a machine referee.
And it is NOT a clean alias to Setswana: the tn engine on the 3 kaikki words shows systematic differences (Sesotho
marks EJECTIVES pʼ/t͡sʼ, uses [ɑ] and the mid vowels [e/ɛ/ɔ], syllabic l̩, where tn emits plain stops + [ɪ/ʊ]).
So — per the user's decision — authored beyond-referee from standard Sesotho phonology (Doke & Mofokeng), the
Setswana pattern, on the shared greedy-longest-match engine. 🔷 single-source.

## The analysis, anchored on the kaikki attestations

The 3 kaikki words are enough to fix the consonant signature: **phuputso → pʰupʼut͡sʼɔ is an EXACT match** with our
output, validating that the plain voiceless stops are **EJECTIVE** ⟨p t k⟩→[pʼ tʼ kʼ] (vs aspirated ⟨ph th kh⟩→[pʰ
tʰ kʰ]) and ⟨ts⟩→[t͡sʼ]. motswalle→mʊt͡sʼʷɑl̩lɛ and peo→pe(w) corroborate the ejective t͡sʼ, ⟨a⟩→[ɑ], and ⟨h⟩→[ɦ].
Other signatures authored from the grammar: ⟨hl⟩→[ɬ] (voiceless lateral fricative), ⟨tl⟩→[t͡ɬʼ], ⟨kg⟩→[kχ],
⟨sh/š⟩→[ʃ], ⟨ny/ng⟩→[ɲ/ŋ], ⟨q⟩→[!] (the marginal click).

## Residual & verdict: 🔷

The one thing the orthography does not encode is **vowel HEIGHT** — Sesotho's 7 vowels /i e ɛ a ɔ o u/ are written
with 5 letters, so ⟨e⟩ is [e]~[ɛ] and ⟨o⟩ is [ɔ]~[ʊ] (motswalle's o→[ʊ] vs our default [ɔ]). We default the mid
values and leave the raisings as a documented residual (a height lexicon would fix it). Labialisation is emitted as
[w] (kaikki uses the superscript [ʷ]) — a notation difference. Tone (H/L) is lexical + unwritten → deferred. Gold:
`test/sesotho.test.ts` (anchored on the exact phuputso match). No referee-eval floor (no machine referee). Re-grade
if a Sesotho pronunciation corpus appears.
