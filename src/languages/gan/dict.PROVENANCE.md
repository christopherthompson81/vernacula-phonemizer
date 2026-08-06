# `dict.tsv` provenance — Gan Chinese / 贛語 (gan), Nanchang 南昌 dialect

Han → Sinological-IPA readings, **5,033 entries**: 3,531 **traditional** headwords (single-character citation
readings + multi-character word readings, with the Nanchang tone sandhi baked in as `underlying⁻surface`) + 1,502
**simplified** aliases generated from them (9 collisions skipped).

- **Dialect choice:** **Nanchang** 南昌 (the provincial capital of Jiangxi) — Gan's prestige/representative variety,
  the Taiyuan-for-Jin / Changsha-for-Xiang analogue and the pole Wiktionary tags for Gan.
- **Source:** the **Wiktionary Chinese** dialectal-pronunciation data, via the machine-readable **kaikki.org**
  extract (`kaikki.org-dictionary-Chinese.jsonl`, 1.18 GB, streamed and filtered server-side). Every entry whose
  `sounds` array carries a pronunciation tagged `["Nanchang","Sinological-IPA"]` was kept; the IPA string is taken
  verbatim (slash delimiters stripped), including the narrow Nanchang vowel diacritics (ɵ, ɨ, ɛ, syllabic n̩,
  palatalised n̠ʲ, etc.).
- **Format:** `<han-word>\t<syllable …>` where each syllable is segmental IPA + a superscript pitch-number tone
  (`ma²¹³`, `sɨt̚²`); multi-syllable readings are space-separated and may carry a sandhi arrow `underlying⁻surface`
  (`pa²¹³⁻²¹ pa¹`). The runtime (`gan.ts` via the shared `hanDictIpa.ts`) segments a Han string by greedy longest
  match over these keys, converts each pitch digit → a Chao contour letter (1→˩ … 5→˥), and renders the SURFACE
  tone after the arrow.
- **Tone system (Nanchang, 7 tones incl. 2 entering):** the most frequent citation contours are 陰平 ˦˨ (42),
  陽平 ˧˥ (35), 上 ˨˩˧ (213), 去 ˨˩ (21), and the two 入 (checked) tones ˥ (5) / ˨ (2). **Gan signature:** the 入声
  (entering) category survives WITH a checked stop coda, and Nanchang has TWO of them — **-t̚** (from Middle
  Chinese -p/-t: 十→sɨt̚˨, 月→n̠ʲyɵt̚˨) and **-ʔ** (from MC -k: 學→hɔʔ˨, 六→liuʔ˥). This is the middle of the
  Sinitic-coda cline: Hakka keeps all three -p̚/-t̚/-k̚, Jin keeps only -ʔ, Xiang lost the coda entirely. Nasal
  codas are -n/-ŋ (MC -m merged into -n); Nanchang also shows the n→l initial merger (南→lan³⁵).
- **Simplified aliases:** the kaikki headwords are traditional; each key is converted character-by-character to
  simplified via **OpenCC `TSCharacters`** (Apache-2.0) and, where the result differs and doesn't collide with an
  existing key, added as an alias pointing at the same reading. 1,502 aliases added, 9 collisions skipped. Same
  merged-simplified-char caveat as Jin/Hakka/Xiang (a merged glyph keeps only its own primary-sense reading).
- **License:** Wiktionary content is CC-BY-SA 3.0; the kaikki extract is a mechanical redistribution of it.
  OpenCC `TSCharacters` is Apache-2.0.

**Single-source (🔷):** no independent second referee for Nanchang Gan (no wikipron gan; epitran ships no Gan), so
this dict is verified only *within* the Wiktionary tradition — a systematic error shared with that source would go
undetected. The correctness anchor is the adjudicated gold in `test/gan.test.ts`. See
.
