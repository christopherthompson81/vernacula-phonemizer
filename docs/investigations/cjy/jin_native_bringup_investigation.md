# Jin Chinese (cjy) native bring-up — Taiyuan 太原

Jin Chinese / 晋语, ~47M speakers across Shanxi and neighbouring provinces. Treated as a **distinct primary
branch of Sinitic** (not a Mandarin dialect) on the strength of its retention of the Middle Chinese 入声
(checked/entering tone) as a glottal-stop coda **-ʔ** and its rich tone sandhi — the Wu/Min-Nan pattern of a
Sinitic language worth covering in its own right.

The user opted in explicitly knowing this would land at **🔷 (single-source verified)**: "stubs for big
populations are better than nothing." Jin was rejected once before for insufficient data (no wikipron cjy — the
scrape 404s); the route this time is the Wiktionary Chinese dialectal-pronunciation data.

## Data availability (checked up front)

- **wikipron cjy** — none (404). This is why Jin was deferred the first time.
- **epitran** — ships no Jin.
- **Wiktionary/kaikki Chinese** — the machine-readable `kaikki.org-dictionary-Chinese.jsonl` (1.18 GB) carries,
  inside each character/word entry's `sounds` array, a Jin/Taiyuan Sinological-IPA reading:
  `犬 → /t͡ɕʰye¹¹/`, `馬 → /ma⁵³/`, tone as superscript pitch numbers, checked syllables with the -ʔ coda
  (`月 → /yəʔ²/`). **This is the target IPA directly** — no from-scratch romanization converter is needed
  (the plan assumed one; the data is richer than expected).

There is **no independent second referee**: Wiktionary is the only machine-readable Taiyuan IPA, so any
automated check would be circular with the source. → 🔷, exactly as the user anticipated.

## Build

1. **Extract** — streamed the 1.18 GB dump, kept every entry with a `["Jin","Taiyuan","Sinological-IPA"]`
   sound (first/primary reading per word). → 4,434 unique traditional headwords (1,967 single-char + 2,467
   multi-char words, the latter carrying baked tone sandhi as `underlying⁻surface`).
2. **Simplified aliases** — the kaikki headwords are traditional, but Shanxi text is written in simplified Han.
   Converted each key character-by-character via OpenCC `TSCharacters` (Apache-2.0, the precedent already used
   for Wu) and added the simplified form as an alias → +2,033 keys (6,467 total). Without this, `晋语`/`中国`
   returned empty.
3. **Runtime** (`jin.ts`, modelled on `wu.ts` minus the romanization layer, since the IPA is already in the
   dict): greedy longest-match Han segmentation over the dict; per syllable, split the trailing superscript
   tone block, take the **surface** tone after a sandhi arrow `⁻`, and map each pitch digit → a Chao contour
   letter (1→˩ … 5→˥, the fleet tone convention). Han numerals compose through the shared `integerToHan` and
   read back through the dict.

## Tone system (Taiyuan, 5 citation tones)

| category | pitch | Chao | example |
|---|---|---|---|
| 平 píng | 11 | ˩˩ | 犬 t͡ɕʰye˩˩ |
| 上 shǎng | 53 | ˥˧ | 馬 ma˥˧ |
| 去 qù | 45 | ˦˥ | 電 tie˦˥ |
| 阴入 yīn rù | 2 (checked) | ˨ | 月 yəʔ˨ |
| 阳入 yáng rù | 54 (checked) | ˥˦ | 十 səʔ˥˦ |

Sandhi is baked into the multi-char readings (九十 → 九 53→11 → `t͡ɕiəu˩˩ səʔ˥˦`); the surface tone after the
`⁻` arrow is rendered.

## Verdict — 🔷 Single-source verified

A working Taiyuan Jin phonemizer: 6,467 Han→IPA entries covering common characters + real multi-char vocabulary
(with sandhi), the checked-coda -ʔ signature, the five-tone system as Chao letters, simplified + traditional
input, and Han numerals. Verified only *within* the Wiktionary tradition — no independent referee exists, so a
systematic Wiktionary-shared error would be undetectable (the evidence-breadth caveat, not an output-quality
one — the Wu/Igbo/Naija pattern). Deferred: cross-word (phrase-level) sandhi, the OOV single-char tail beyond
Wiktionary's coverage, and the `dated`-survey provenance of the Taiyuan source.
