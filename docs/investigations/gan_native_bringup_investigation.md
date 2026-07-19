# Gan Chinese (gan) native bring-up

Gan Chinese / 贛語 (gan), Nanchang 南昌 dialect — the **eighth Sinitic language** (after Mandarin, Cantonese, Wu,
Min Nan, Jin, Hakka, Xiang), and the fifth to ride the shared Han→IPA dictionary engine (`sinitic/hanDictIpa.ts`).
Gan is a distinct primary branch of Sinitic spoken mainly in Jiangxi; Nanchang (the provincial capital) is its
prestige variety — the Taiyuan-for-Jin / Changsha-for-Xiang analogue.

**Scope gates:** written in Han characters (community orthography, trivially passes) + a machine-readable reading
source (Wiktionary/kaikki Nanchang Sinological-IPA). No independent second referee (no wikipron gan; epitran ships
no Gan) → **🔷 single-source**, the Jin/Hakka/Xiang pattern.

**Architecture (thin, zero new engine):** `createGan` = `createHanDictPhonemizer(dict, DEF, foreign)` over the
shared engine (greedy longest-match Han segmentation, superscript-pitch → Chao contour letters, sandhi arrow ⁻, Han
numerals). New files: `gan.ts` (wrapper), `gan.jsonc` (chao map + punctuation), `dict.tsv`, `dict.PROVENANCE.md`.
Registered `case "gan"`; eval `langs/gan.jsonc` (empty referees, gap recorded); gold `test/gan.test.ts`.

## Run 1 — build
Extracted the Nanchang readings from the 1.18 GB kaikki Chinese dump, streamed and filtered server-side (kept
`sounds` tagged `["Nanchang","Sinological-IPA"]`, slash delimiters stripped): **3,531 traditional headwords** →
**5,033** after OpenCC `TSCharacters` simplified aliases (1,502 added, 9 collisions).

**Gan's place in the Sinitic set — the checked-coda cline.** The coda/tone census over the dict:
- **checked stop codas: -t̚ (791) and -ʔ (455)** — Nanchang keeps TWO (MC -p/-t → -t̚, MC -k → -ʔ). This is the
  middle of the cline: Hakka keeps all three -p̚/-t̚/-k̚, Jin keeps only -ʔ, Xiang lost the coda entirely. So
  十→sɨt̚˨ (Hakka səp̚˥, Xiang sz̩˨˦), 學→hɔʔ˨, 月→n̠ʲyɵt̚˨.
- **nasal codas: -n (1885), -ŋ (1108)** — MC -m merged into -n (no -m).
- Nanchang **n→l initial merger** surfaces in the data (南→lan˧˥, 你→n̩ but 人→n̠ʲin).
- 7 tones incl. two entering; top contours 陰平 ˦˨, 陽平 ˧˥, 上 ˨˩˧, plus the checked ˥/˨.

The engine renders all of it correctly (gold 5/5): tones as Chao letters, both checked codas preserved, simplified
aliases resolve to the same reading (中国 = 中國), full text + punctuation via the registry (我食飯。→ ŋo˨˩˧ sɨt̚˨
fan˩˩ .). Verified within the Wiktionary tradition; the adjudicated gold is the correctness anchor. **🔷 single-source.**
