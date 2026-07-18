# pt-BR (Brazilian Portuguese) accent-variant bring-up

**Goal:** the SECOND accent variant — "neutral"/standard (paulistano-based) Brazilian Portuguese as an
accent-transfer over the European Portuguese `pt` engine. Where en-GB was a surface post-process, pt-BR needed
**engine parameterization**, because the deepest EP→BP difference (vowel reduction) is not recoverable from EP
surface forms.

## Why parameterization, not a post-process

EP reduces pretonic vowels: /o/→[u], /e/→[ɨ] (bonito→buˈnitu, português→puɾtuˈɡeʃ). BP keeps them mid
(boˈnitu, poɾtuˈɡes). Once the EP engine has collapsed pretonic /o/→[u], a post-process can't tell it from an
underlying /u/ (rua→ˈʁuɐ). So the dialect is a **parameter of the engine** (`dialect: "ep" | "bp"`, default ep)
threaded through `toSegments → sibilants → realize → renderWord`, plus a BP consonant post-step. EP behaviour is
untouched (default arg; 11/11 EP tests + probes identical).

## The EP→BP delta (calibrated against wikipron por_latn_bz)

- **Reduction (realize)** — position-split, not blanket. Only the FINAL atonic vowel raises (e→i, o→u, a→ɐ:
  cidade→sidad͡ʒi, estado→estadu); pretonic/postonic-medial stay MID (e→e, o→o, a→a). No [ɨ], no EP initial-e→i
  (estado→estadu not the EP iʃtadu).
- **Coda sibilant (sibilants)** — alveolar [s]/[z], not EP [ʃ]/[ʒ] (paulistano/"neutral": estado→estadu, três→tɾes).
- **Affrication (bpConsonants post-step)** — /t d/ → [t͡ʃ]/[d͡ʒ] before [i]/[ĩ] incl. the raised final ⟨e⟩
  (tia→t͡ʃia, dia→d͡ʒia, gente→ʒẽt͡ʃi, cidade→sidad͡ʒi) — the BP signature.
- **Coda-l vocalization** — [ɫ]→[w] (sal→saw, Brasil→bɾaziw, soldado→sowdadu).
- **-em nucleus (toSegments)** — BP [ẽj̃] vs EP [ɐ̃j̃] (tem→tẽj̃, homem→omẽj̃, viagem→viaʒẽj̃); -am stays [ɐ̃w̃] and
  ⟨-ãe⟩ stays [ɐ̃j̃] (mãe→mɐ̃j̃) — source-distinguished in toSegments, so not a blanket ɐ̃j̃→ẽj̃ swap.
- **Coda-r / rr** — KEPT: coda [ɾ], rr/initial [ʁ]. The BZ referee attests [ɾ], [ʁ], [ɻ], [h] for coda-r with
  no single "neutral" value; [ɾ]/[ʁ] are attested and avoid the regionally-marked [h]/[x]/[ɻ] choice.

The open/close correction lexicon is shared with EP (EP-derived; mostly valid for BP, a small stressed-mid tail
differs — telefone [ɔ]~[o]). No referee-mined data → the eval scores the SHIPPED path directly (non-circular).

## Run 1 — 2026-07-18 — first cut

83.0% (after the -em fix) vs wikipron por_latn_bz broad (57,131 merged variants). **NOT referee-noise-limited**
(unlike English) — the `pt` rule engine has real coverage, so this is a genuine number. Systematic fix found in
the residuals: **-em→[ẽj̃]** (amem/atem/aterrisagem all showed our EP [ɐ̃j̃] vs referee [ẽj̃]); threaded dialect to
toSegments (82.0→83.0%). Bug found while vetting the gold: **`fácil`→fasow** — the `beforeDarkL` branch forced
its else-case to [o], wrongly catching raw ⟨i⟩/⟨u⟩; fixed to keep i/u (fácil→fasiw, útil→ut͡ʃiw).

Residual (~17%) is the lexical tail: open/close stressed-mid words the shared EP lexicon gets wrong for BP
(beringela [ɛ], andebol [ɔ], telefone [o]), ea-hiatus (Ceará→seaɾa vs our glide sjaɾɐ — a shared onglide
behaviour, not BP-specific), and loanwords (allah, catmandu). None systematic.

## Quality anchor — the diagnostic gold (66 words, 100%)

`test/portuguese-br.test.ts` hand-adjudicates the BP output on core vocabulary + every signature feature
(affrication, coda-l→w, coda-s, position-split reduction, -em→ẽj̃), from Cristófaro Silva / Wikipédia BP
conventions corroborated against the referee. Excludes the documented open/close lexical tail.

## Run 2 — adversarial review (1 real bug fixed + 1 inherited gap documented)

1. **pt-BR spoke EUROPEAN number-words** (the referee eval is word-only, so it never exercised the number path).
   The `numberToWords` compositor wasn't dialect-aware: 16→dezasseis (EP) vs BP dezesseis, 17→dezassete vs
   dezessete, 19→dezanove vs dezenove. Fixed by parameterizing `numberToWords(n, dialect)` + `numberTokenToWords`
   with a BP teen override (`SMALL_BP` = {16,17,19}) — the only EP/BP number-word difference. Guarded by a
   numbers test block. (16→dezesˈejs, 1917→miw novesẽtus e dezeset͡ʃi.)
2. **Clitic de/e unreduced** (`wordIpa`): `text("de e")`→`de e`, but neutral BP reduces to [d͡ʒi]/[i]. This is a
   PRE-EXISTING shared gap — EP has the identical defect ([de]/[e] vs the real EP [dɨ]/[i]) because a lone
   clitic's single nucleus is its own stress index, so `realize` skips reduction. Not introduced here; more
   salient in BP. Documented, deferred (a fix belongs in the shared EP function-word path, not the BP delta).

The review confirmed the EP-regression risk (the core dialect parameterization) is clean: every new param
defaults "ep", EP output byte-identical (11/11), and the bpConsonants regex, isFinal reduction on proparoxytones,
beforeDarkL i/u, and the -em fix all verified correct.

## Run 3 — 2026-07-18 — lexical-tail work (83.0 → 85.6%)

Categorized the ~17% tail with a candidate-fix yield+regression harness (each fix applied to the full 57k
referee, counting misses→hits AND hits→misses). Two systematic, dialect-gated wins (EP untouched by
construction):

1. **Palatalise /t d/ before the onset GLIDE [j] from ⟨i⟩** (+799 fixed, −0 broke). The referee palatalises
   categorically before /i/ regardless of syllabicity (abadiado→abad͡ʒjadu, diamante→d͡ʒjamɐ̃t͡ʃi), but our
   affrication only fired before syllabic [i] — the onglide pass had already turned the i→[j]. Extended the
   bpConsonants class to `[iĩj]`. (My earlier "BP skips glide palatalisation" read — from the en-GB-style review
   — was WRONG; the BZ referee is unambiguous.) Zero regressions because the only [j] right after t/d is the
   i-onset glide.
2. **Close a stressed mid vowel before a nasal-onset consonant** (+146 fixed, −1 broke). The BP ô/ê where Europe
   keeps ó/é open: abandona→abɐ̃donɐ (EP abɐ̃dɔnɐ), homem→omẽj̃, fome→fomi (referee-confirmed: come/dona/sono/
   somos/gostoso all close). Implemented in realize() gated on **!seg.accent** so acute-marked ó/é stay open
   (afónica keeps [ɔ]) — the discriminator that turned an unrefined +148/−54 into +146/−1 (the −54 were all
   acute-accented EP-spelled proparoxytones). The lone −1 (donas) is a likely-erroneous referee entry.

Note the eval FOLDS nasalisation (backbone strips combining tildes), so a separate "nasalise before nasal-C"
candidate scored +0 — the closing is what the eval sees; nasalisation is canonically present but invisible here.

**Remaining tail (~14%, diffuse, not pursued)** — all shared-EP or genuinely lexical, no clean discriminator:
open/close stressed-mid lexicon disagreements in BOTH directions (cheque→our [e] vs [ɛ]; contável→our [ɛ] vs
[e]) — needs a BP open/close lexicon, deliberately NOT built (the same call as `pt`, which declined a learned-word
lexicon to keep canonical consistency); `-ear` glide-vs-hiatus (campear→kɐ̃pjaɾ vs kɐ̃peaɾ — the shared onglide
pass); `sc`-cluster gemination (apascentar→apassẽ- vs apasẽ-, an EP-side grapheme issue); stressed `-ol`→[ɔw]
(andebol, shared EP); loanwords (allah, catmandu, aardvark).

## Status

🟡 accent-variant. Floor 0.85 (85.6% after the Run 3 tail work; a genuine referee number, not noise-limited).
Second accent variant after en-GB → the parameterized-engine pattern (vs en-GB's post-process) for deep
phonological deltas. Next: es-419, en-IN.
