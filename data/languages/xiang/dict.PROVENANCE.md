# `dict.tsv` provenance — Xiang Chinese / 湘语 (hsn), Changsha 长沙 (New Xiang) dialect

Han → Sinological-IPA readings, **6,591 entries**: 4,548 **traditional** headwords (2,000 single-character
citation readings + 2,548 multi-character word readings, with the Changsha tone sandhi baked in as
`underlying⁻surface`) + 2,043 **simplified** aliases generated from them.

- **Dialect choice:** Xiang has two poles in Wiktionary — Changsha 长沙 (New Xiang, the provincial-capital
  prestige variety) and Loudi 娄底 (Old Xiang). **Changsha** was chosen as the representative dialect (the
  Taiyuan-for-Jin / Meixian-for-Hakka analogue). Where a character has both a `dated` and a current Changsha
  reading, the current one is kept.
- **Source:** the **Wiktionary Chinese** dialectal-pronunciation data, via the machine-readable **kaikki.org**
  extract (`kaikki.org-dictionary-Chinese.jsonl`, 1.18 GB). Every entry whose `sounds` array carries a
  pronunciation tagged `["Changsha","Sinological-IPA"]` was kept; the IPA string is taken verbatim, including the
  narrow Changsha vowel diacritics (backed a̠, lowered e̞, non-syllabic y̯/i̯, nasalised ẽ, syllabic z̩, etc.).
- **Format:** `<han-word>\t<syllable …>` where each syllable is segmental IPA + a superscript pitch-number tone
  (`ma̠⁴¹`, `sz̩²⁴`); multi-syllable readings are space-separated and may carry a sandhi arrow `underlying⁻surface`.
  The runtime (`xiang.ts` via the shared `hanDictIpa.ts`) segments a Han string by greedy longest match over these
  keys, converts each pitch digit → a Chao contour letter (1→˩ … 5→˥), and renders the SURFACE tone after the arrow.
- **Tone system (Changsha, 6 citation tones):** 陰平 ˧˧ (33), 陽平 ˩˧ (13), 上 ˦˩ (41), 陰去 ˦˥ (45), 陽去 ˨˩ (21),
  入 ˨˦ (24). **Xiang signature:** the 入声 (entering) category survives as a *tone* (24) but the checked stop coda
  is entirely LOST — no -p̚/-t̚/-k̚ (Hakka keeps them) and no -ʔ (Jin keeps it), so 十→sz̩˨˦, 月→y̯e̞˨˦ have no coda.
- **Simplified aliases:** the kaikki headwords are traditional; each key is converted character-by-character to
  simplified via **OpenCC `TSCharacters`** (Apache-2.0) and, where the result differs and doesn't collide with an
  existing key, added as an alias pointing at the same reading. 2,043 aliases added, 11 collisions skipped. Same
  merged-simplified-char caveat as Jin/Hakka (a merged glyph keeps only its own primary-sense reading).
- **License:** Wiktionary content is CC-BY-SA 3.0; the kaikki extract is a mechanical redistribution of it.
  OpenCC `TSCharacters` is Apache-2.0.

**Single-source ():** no independent second referee for Changsha Xiang (no wikipron hsn; epitran ships no Xiang),
so this dict is verified only *within* the Wiktionary tradition — a systematic error shared with that source would
go undetected.
