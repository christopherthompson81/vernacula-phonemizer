# Odia (or) native bring-up

Odia / ଓଡ଼ିଆ — Eastern Indo-Aryan, ~35M speakers in Odisha, Odia Brahmic abugida. Phonologically Odia's closest
relative is Bengali, and like the Dravidian trio (Telugu/Kannada/Malayalam) it is read by the **generic abugida
engine** (`core/abugida.ts`) with **NO inherent-vowel deletion** — every akshara is pronounced. The bring-up is
therefore an Odia-Unicode data file (`odia.jsonc`) + a thin module (`odia.ts`).

## Data availability (checked up front)

- **wikipron ori** — empty (0 lines, both broad and narrow). No wikipron Odia.
- **kaikki ori** — 2,068 human IPA entries (Wiktionary). The reliable PRIMARY referee.
- **epitran ori-Orya** — exists, used as an independent SECONDARY, but it is **noisy**: it wrongly deletes the
  final inherent vowel Hindi-style (ହାତ→hat) where Odia retains it (kaikki + ours: hat̪ɔ), misses the ଡ଼→ɽ flap
  (oɖia vs correct oɽia), and uses b̤/t notation. So it corroborates only loosely (53.0%), deflated by its own
  bugs — not ours.

## The Odia profile (from kaikki)

- **Inherent vowel /ɔ/, fully retained** — ଘର→ɡʱɔɾɔ, ହାତ→hat̪ɔ, ଭାରତ→bʱaɾɔt̪ɔ. No schwa deletion (unlike Hindi;
  like Bengali/Dravidian). → generic engine, `inherentVowel: "ɔ"`.
- **No phonemic vowel length** — ଇ/ଈ→i, ଉ/ଊ→u (ନୂତନ→n̪ut̪ɔn̪ɔ).
- **Sibilant merger ଶ/ଷ/ସ → [s]** — ଭାଷା→bʱasa (no /ʃ/).
- **Dental t̪ d̪ n̪** vs retroflex ʈ ɖ ɳ; **ଳ→ɭ**; the **retroflex flap ଡ଼→ɽ, ଢ଼→ɽʱ**; **ଯ→d͡ʒ** (historical ya→ja).
- **No intervocalic voicing** (Indo-Aryan — ହାତ→hat̪ɔ keeps t̪, unlike the Dravidian trio's aɖi-type voicing).

## Runs (folded vs kaikki primary)

- **Run 1 — first compile.** 96.3%. The generic engine + the Odia data file (inherent ɔ, no deletion, sibilant
  merger, flap, dental series) + gemination→length + ଳ୍ଳ→ɭː + word-final anusvara→[m] + first-syllable stress.
  Folds: ɦ~h (ହ), gemination, dental notation t̪~t/d̪~d/n̪~n (epitran under-marks; kaikki marks — fold both), b̤~bʱ
  (epitran), tap ɾ~r.
- **Run 2 — conjunct nasal fold.** The only real residual class was the conjunct nasal: ଞ୍ଜ/ଞ୍ଚ/ଜ୍ଞ → we write
  the homorganic palatal ɲ (ଗଞ୍ଜା→ɡɔɲd͡ʒa, correct) where kaikki normalises to n̪ — a nasal-place notation diff.
  Folding ɲ~n (consistent with the existing n̪~n fold) → **98.3%**.

## Verdict — ✅ Referee-limited

**98.3% vs kaikki** (human primary) — Odia is highly rule-derivable, like the Dravidian abugidas. The residual is
single-letter / lone-sign referee noise (ଌ vocalic-l, ଃ visarga, nukta ଫ଼/ଷ଼ letter entries) — no real defect.
The independent epitran secondary corroborates only loosely (53.0%) because of its own final-vowel-deletion bug,
which is itself confirmation that Odia *retains* the inherent vowel (kaikki and ours agree, epitran is the outlier).
Full retroflex/dental series, sibilant merger, flap, inherent-ɔ retention, and numbers all verified. Deferred
(bounded, as for the Dravidian trio): 21-99 irregular number compounds.
