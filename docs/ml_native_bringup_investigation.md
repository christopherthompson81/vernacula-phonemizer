# Malayalam (ml) native bring-up

Malayalam — Dravidian, ~37M speakers, the fourth and last of the major Dravidian languages (with Tamil ta,
Telugu te, Kannada kn). Brahmic abugida, read by the generic engine (`core/abugida.ts`) exactly as Telugu and
Kannada are — NO inherent-vowel deletion (every akshara is pronounced, inherent /a/ = [ɐ]). The bring-up is
therefore a Malayalam-Unicode data file (`malayalam.jsonc`) + a thin module (`malayalam.ts`) for the two
Malayalam-specific features the generic engine can't know.

## Data availability (checked up front)

Unlike the recent Sinitic stubs, Malayalam has **two independent human referees**, so it's a full convergence:
- **wikipron mal_mlym broad** — 10,406 pairs (PRIMARY).
- **kaikki mal** — 10,277 pairs (SECONDARY, Wiktionary), extracted from the 22.5 MB Malayalam kaikki dump.

## The two Malayalam-specific features

1. **Samvritokaram (സംവൃതോകാരം).** A word-final chandrakkala (virama ്) is NOT silent — it is a half-close
   central [ɨ] (നാല്→naːlɨ 'four', വീട്→ʋiːʈɨ 'house'). The referee is completely consistent on this (1,573
   words, ~15% of the corpus, all → ɨ). Detected on the *original* word (before chillu expansion), so chillu-final
   words — which end in the chillu char, not in ് — correctly do NOT get the [ɨ].
2. **Chillu letters (ചില്ലക്ഷരം).** ൺ ൻ ർ ൽ ൾ ൿ are pure coda consonants with no inherent vowel; expanded to
   base + virama so the engine reads them as bare codas (അച്ഛൻ→at͡ʃʰːan, ends in a bare n, no [ɨ]).

## Runs (folded backbone vs wikipron primary)

- **Run 1 — first compile.** 48.4%. Base abugida map + samvritokaram + chillus + word-final anusvara + geminate.
- **Run 2 — INTERVOCALIC VOICING** (the dominant residual class). The Dravidian sonorization rule: a SINGLE
  plosive/affricate voices between vowels (അടി→aɖi, കറുക→karuɡa; k→ɡ, t̪→d̪, ʈ→ɖ, t͡ʃ→d͡ʒ, p→b). Geminates (now
  Cː) and word-initial stops stay voiceless. **Crucially applied BEFORE the samvrit [ɨ] is appended**, so a
  word-final stop (historically utterance-final) stays voiceless — the referee keeps it so (അതത്→ad̪at̪ɨ, not
  ad̪ad̪ɨ). **POST-NASAL voicing was TESTED and REJECTED**: the referee is inconsistent on nasal+stop clusters
  (ɳʈ→ɳɖ voices in native words, but nt̪/mp stay voiceless in Sanskrit loans — not orthographically recoverable),
  and intervocalic-only scored higher. → 66.7%. + the ʱ breathy-voice fold (the referee drops the aspiration on
  Sanskrit voiced aspirates ഭ ധ ഘ) → 73.3%.
- **Run 3 — rhotic tap~trill fold.** We write tap ɾ for ര everywhere; the referee writes ɾ intervocalically but
  r in clusters (akɾamam~akramam). Neutralizing tap~trill (both ര/റ are rhotic) → 82.9%.
- **Run 4 — the -ിക്കുക verb ending + anusvara-before-sibilant.** The referee writes a narrow palatal onglide
  [kkju] for the -ിക്കുക infinitive (from the preceding /i/) where we write plain [kːu] — folded. And medial
  anusvara before a non-stop (sibilant/ഹ/sonorant) → [m] (അംശം→amʃam), authored in the module (before a stop it
  stays for the engine's homorganic assimilation, അംഗം→aŋɡam). → **87.0%**.

## Verdict — ✅ Referee-limited (matches the Dravidian siblings)

**87.0% vs wikipron + 80.0% vs kaikki**, two independent human referees corroborating — comparable to Telugu
(79.6%) and in line with the Dravidian family. The residual is diffuse: referee narrow-notation, and Sanskrit-loan
aspiration the referee inconsistently drops while we emit it correctly (over-folding ʰ would merge the genuinely
contrastive aspirated/unaspirated stops of the loan stratum — declined per the honesty principle). Bounded
deferrals, same character as te/kn: the 21-99 irregular number compounds (the shared Dravidian gap — the renderer
marks it) and visarga-before-stop gemination (അധഃപതനം → -ppa-). The full retroflex/dental/alveolar series, the
Dravidian short/long e·o, ഴ→ɻ, samvritokaram, chillus, intervocalic voicing, and gemination-as-length are all
verified. See the maturity row + `tools/referee-eval/langs/ml.jsonc`.
