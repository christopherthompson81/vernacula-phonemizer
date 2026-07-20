# Sepedi / Northern Sotho (nso) native bring-up

Sepedi / Northern Sotho (nso) — Bantu (Sotho-Tswana, S32); ~5M, official in South Africa. Latin, open CV. Sibling
of the done Setswana (tn) + Sesotho (st).

## Gate — NO referee at all → ⛔ cannot-verify

Sepedi has **no machine referee of any kind**: no wikipron, no kaikki page, no epitran map (worse than Sesotho's 3
kaikki words). Per the user's decision it is authored beyond-referee from standard Sepedi phonology (Ziervogel &
Mokgokong) as a **⛔ cannot-verify** module — a couple of hand examples of the distinctive graphemes, not a verified
gold.

## The analysis

Reuses the shared Sotho-Tswana greedy engine. Sepedi's profile: prominent ⟨š⟩→[ʃ] / ⟨tš⟩→[t͡ʃʼ], ⟨g⟩→[x] /
⟨kg⟩→[kx], the voiceless lateral ⟨hl⟩→[ɬ] and lateral affricate ⟨tl⟩→[t͡ɬʼ], ⟨ny/ng⟩→[ɲ/ŋ]. The plain voiceless
stops are taken as **EJECTIVE** ⟨p t k⟩→[pʼ tʼ kʼ] — the Sotho-Tswana pattern (attested for the sister Sesotho, but
**UNVERIFIED for Sepedi**). No clicks. Vowel height (7-vowel /i e ɛ a ɔ o u/) is unwritten → mid defaults [ɛ ɔ].

## Verdict: ⛔ cannot-verify

No independent referee exists to check any of it; the analysis rests on the grammar + the close Sesotho/Setswana
sisters. The distinctive-grapheme values (š, kg, hl, ejectives) are the confident part; the ejective analysis and
vowel heights are the unverified tail. Gold: `test/sepedi.test.ts` (hand examples). Tone deferred. Re-grade if a
Sepedi pronunciation corpus/wikipron appears.
