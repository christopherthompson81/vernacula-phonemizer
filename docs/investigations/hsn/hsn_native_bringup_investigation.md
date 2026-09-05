# Xiang Chinese (hsn) native bring-up — Changsha 长沙

Xiang Chinese / 湘语, ~37M speakers in Hunan. A distinct primary branch of Sinitic — the **seventh** Sinitic
language covered (after Mandarin, Cantonese, Wu, Min Nan, Jin, Hakka). Same Wiktionary/kaikki route as the Jin
and Hakka stubs, on the shared `sinitic/hanDictIpa.ts` engine.

## The Sinitic-signature contrast

The three recent Sinitic stubs now form a clean minimal contrast on what happened to the Middle Chinese 入声
(entering tone / checked syllables):

| Lect | 入声 reflex | Example (十 'ten') |
|---|---|---|
| **Hakka** (Meixian) | full stop coda -p̚/-t̚/-k̚ | səp̚˥ |
| **Jin** (Taiyuan) | merged to glottal -ʔ | səʔ˨ |
| **Xiang** (Changsha) | **coda LOST — a pure tone (24)** | sz̩˨˦ |

Xiang kept the entering-tone *category* as a distinct tone but lost the coda entirely (no -ptk, no -ʔ), so
月→y̯e̞˨˦, 國→ku̯ɤ̞˨˦ end in a bare vowel. That's the Xiang fingerprint.

## Data availability (checked up front)

- **wikipron hsn** — none. **epitran** — no Xiang. → 🔷 (no independent referee), as with Jin/Hakka.
- **Wiktionary/kaikki Chinese** — carries Xiang Sinological-IPA for **Changsha 长沙** (New Xiang, the prestige
  variety) and **Loudi 娄底** (Old Xiang). Changsha chosen (the Taiyuan/Meixian analogue). Where a character has
  both a `dated` and a current Changsha reading, the current one is kept. The transcriptions carry narrow
  Changsha vowel diacritics (backed a̠, lowered e̞, non-syllabic y̯/i̯, nasalised ẽ, syllabic z̩), kept verbatim.

## Build

Streamed the 1.18 GB dump, kept every Changsha Sinological-IPA sound (current over dated) → **4,548 traditional
headwords** (2,000 single-char + 2,548 multi-char words with baked `underlying⁻surface` sandhi) + **2,043
simplified aliases** (OpenCC `TSCharacters`) → **6,591 entries**. Runs on the shared `hanDictIpa.ts` engine
(greedy Han segmentation, superscript pitch digit → Chao contour letter 1→˩…5→˥, surface tone after the `⁻`
arrow, Han numerals) — no new engine code.

## Tone system (Changsha, 6 citation tones)

陰平 ˧˧ (33) · 陽平 ˩˧ (13) · 上 ˦˩ (41) · 陰去 ˦˥ (45) · 陽去 ˨˩ (21) · 入 ˨˦ (24, no coda).

## Verdict — 🔷 Single-source verified

A working Changsha Xiang phonemizer: 6,591 Han→IPA entries, the coda-less 入声 signature, the six-tone system as
Chao letters, simplified + traditional input, and Han numerals — the third Sinitic language on the shared engine.
Verified only *within* the Wiktionary tradition (no independent referee; the gap is recorded in the referee-eval
config, the anchor is the adjudicated gold). Deferred: cross-word phrase-level sandhi, the OOV single-char tail
beyond Wiktionary coverage, and the choice of Changsha over the Loudi (Old Xiang) pole (a different dict on the
same engine).
