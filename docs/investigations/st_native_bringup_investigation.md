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

## Run — cardinal number compositor — 2026-07-29

Question: `phonemize("<int>", "st")` leaked the digits (the TOKEN handler had `sink.emit(m[2]) // numbers deferred`).
What numeral FORM should a TTS speak for a bare integer, given that Sesotho 1–5 are adjectival and obligatorily
carry noun-class concord?

**Decision: the CITATION / COUNTING stems for a bare 1–9, and Sesotho's own noun-free `motso`/`metso` ("unit,
digit") construction inside compounds.** A concord form would have to pick some arbitrary noun class; the
motso/metso device is nounless yet fully grammatical, and it is exactly what the sources show for 11/12/21.

Sources: Omniglot "Numbers in Southern Sotho" (verbatim rows for 1–12, 20, 21, 30–90, 100, 1 000, 10⁶) +
the Wits "Counting and Numbers in Sesotho" tutorial material (leshome le motso o le mong, leshome le metso e
meraro/mene/mehlano, mashome a mabedi le motso o le mong / le metso e mmedi). Zero = lefeela.

Raw findings that shaped the code:
- Omniglot's 21 reads "mashome a mabedi **a** motso o le mong" but the Wits material reads "… **le** motso o le
  mong". Went with `le` (the ordinary conjunction, consistent with 11 "leshome **le** motso"); flagged in the jsonc.
- THREE distinct concord series are needed, not one: cl.4 after `metso`, cl.6 after `mashome`/`makgolo`, cl.8
  (`tse`) after `dikete`. The 6–9 stems (tsheletseng, supileng, robedi, robong) are RELATIVE VERB forms and take
  no prefix, so they look identical in all three — that similarity is real, not a collapsed table.
- Above 9 as a cl.8 multiplier the concord word is dropped (`dikete leshome le metso e mmedi` = 12 000), because
  `tse` agrees with a numeral stem, not with a composed number.

Implementation: Pattern B — `src/languages/sesotho/numbers.ts` + a `numbers` block in sesotho.jsonc. Probe CLEAN
for 0–100, 101, 111, 555, 999, 1 000, 1 001, 12 345, 10⁶, 10⁹. Tests added to test/sesotho.test.ts.

**Source-hunt dead ends (kept per the negative-results rule):** languagesandnumbers.com repeatedly
`socket hang up` (never retrievable this session); salanguages.com + sesotho.web.za `ECONNREFUSED`; Quizlet 403;
the Peace Corps *Sepedi* PDF 403. WebFetch's summariser also silently truncated the Omniglot tables on the first
pass — asking for an explicit "N = form" list per numeral was what finally got verbatim rows out of it.
