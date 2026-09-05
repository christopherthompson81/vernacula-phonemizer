# Sinhala (si) native bring-up

Target: Sinhala, canonical IPA. Slot #18 in the OmniVoice coverage set (contributes the census primitive `ᶯ`,
the prenasalized retroflex from ඬ). Sinhala is a Brahmic **abugida** that espeak ships, so this is a
**shim-parity** convergence: the reference is our own canonical rendering of the espeak 1.52 output (with the
census/tie-bar/dental conventions applied), and the gold is 44,192 real Sinhala words from the 50k frequency
corpus.

## Architecture — shared abugida core + Sinhala post-pass
Reuses `core/abugida.ts` (like Hindi and Tamil): `sinhala.jsonc` declares the consonant / independent-vowel /
vowel-sign IPA maps and the virama; the core does the systematic akshara parsing. `sinhala.ts` is a thin
post-pass over the core's phoneme string:

- **Homorganic anusvara ං** — a nasal coda whose place is set by the FOLLOWING consonant: velar or h → ŋ,
  palatal → ɲ, retroflex → n, everything else (labial / dental / sibilant / liquid) → m. Implemented by
  pre-rewriting each `ං` to the matching nasal letter + virama before the core runs. (ඟ = ᵑɡ is an espeak
  exception → m, not ŋ.)
- **Geminate → length** — a doubled consonant (virama C + C) → Cː. Aspirates are excluded: espeak keeps them
  doubled (ඛ්ඛ → kʰkʰ, not kʰː).
- **Coda / final ව → glide w** — a coda ව් (ʋ not before a vowel) → w (නිව්ටන් → niwʈən); a word-final ව with
  its inherent vowel → w (බව → baw); a word-final geminate ව්ව → wː (පව්ව → pawː).
- **Schwa alternation** — Sinhala's short /a/ comes only from the inherent vowel. The first vowel keeps `a`
  unless it is the very end of the word (an open monosyllable like ක → kə); every later inherent → ə. A closed
  monosyllable keeps its `a` (නම් → nam).
- **Stress** — ˈ on the first vowel; ˌ on even nucleus indices ≥2 **except the last** (Sinhala emits no
  secondary stress on the final nucleus; ˈatərə has none, but 4+-nucleus words like t͡ʃhaːjaːrˌuːpə do).

Canonical conventions baked into the maps: ණ → n and ළ → l (retroflex merge), ත/ද → dental t̪/d̪, ව → ʋ, ශ → s
and ෂ → ʃ (espeak's in-word sibilant rendering), ඡ/ඣ → t͡ʃh/d͡ʒh (aspiration as plain h), ඪ → ɖ, vocalic-r
ෘ → ru, and **ᶯ preserved** in ඬ → ᶯɖ (the census contribution — the canonical merges do NOT touch it).

## Validation
vs the 44,192-word canonical gold: **exact 99.68%, zero stress-only diffs**. The residual 143 are all 1×
long-tail: single/double-letter fragments espeak renders idiosyncratically (අ, ව, ප්ර), malformed vowel-sign
clusters that espeak reads out as sign-NAMES (සෙෙල → "se-kombuva-la", කොම්බුව being the name of the ෙ sign),
and a handful of rare deaspiration cases. No systematic ≥2× bucket remains.

## Numbers — authored (espeak's si number path is broken)
espeak's Sinhala number rendering is unusable: 6 and 7 both render as "දෙසිය එක" (= 200·1) and දහස/1000 is
truncated to `ˈɐhəs`. So there is no shim gold to match. `numbers.ts` is an authored cardinal compositor using
the standard Sinhala numerals; magnitudes ≥100 use the analytic multiplier form (දෙක සියය "two hundred") rather
than the fused colloquial forms, which keeps the morphology unambiguous. The words are phonemized by the g2p, so
the IPA stays consistent with the word engine.

## Run 1 — core + post-pass — 2026-07-13
Built sinhala.jsonc + sinhala.ts (shared abugida core + schwa/anusvara/geminate/coda-w/stress post-pass) +
numbers.ts; registered `si`. Iteration on the 44k gold: 39.9% (first cut) → 51% (ශ→s/ෂ→ʃ, monosyllable-closed
schwa, final ව→w) → 96% (secondary stress = even nuclei EXCEPT last — the single biggest fix) → 99.1%
(homorganic anusvara, vocalic-r ෘ→ru) → 99.6% (coda ව්→w) → **99.68%** (ඟ→m, aspirate geminates stay doubled,
ඣ→d͡ʒh, ඪ→ɖ, final ව්ව→wː). 6 unit tests + full suite (124) green.

Key lessons:
- The gold DID carry secondary stress — an early "gold has no ˌ" read was from a 3-nucleus sample where the
  even-nucleus is also the last (and thus suppressed). Removing secondary entirely dropped exact 51%→44%;
  restoring it with the except-last clause jumped to 96%. Sample across word lengths before concluding a
  convention is absent.
- espeak renders the same letter differently standalone vs in-word (ශ → ʃ alone but s in words); trust the
  in-word gold majority, not the isolated-letter probe.

## Independent-referee corroboration (added 2026-07-13)
Cross-checked against the **espeak-independent** wikipron `sin` human narrow referee via `tools/referee-eval`:
**93.5%** segmental-backbone agreement (648 words) after folding the documented allophonic/notation classes
(ʋ/w, r/ɾ, retroflex merger, dental detail, a/ə, geminate, final-ව offglide); the residual is 1× referee quirks
(e.g. wikipron writing ම්බ as a long mː). `referee-eval.test.ts` pins a 90% floor.
