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

## Run 4 — the -vel rule (85.6 → 86.9%)

Bucketed the open/close residual (3159 open/close-ONLY misses = 34% of all misses). One more clean rule:
**BP keeps unstressed ⟨e⟩ CLOSE before coda-l** (the -ável/-ível suffix → [avew], not the EP [avɛw]; túnel→tunew,
possível→posivew — referee-confirmed). Changed the BP beforeDarkL branch e→[e] (was [ɛ]). +743 fixed, −6 broke
(the −6 are derivational secondary-stress cases — cruelmente/papelzinho preserving a base open-ɛ — plus loans
like Elvis; net +737). The stressed-`-ol`→[ɔw] rule was REJECTED (+34/−32): BP opens word-final -ol
(andebol→ɔw) but keeps close before l+consonant (bolsa→owsɐ), so no clean blanket rule.

## Run 5 — the BP open/close lexicon (86.9% rules → 89.3% shipped)

The remaining open/close tail is genuinely LEXICAL: stressed-vowel openness the rules can't predict (cheque [ɛ]
vs sede [e] homographs, the -osa/-ote/verb-morphology open ɔ/ɛ, pretonic preservation). Built a BP open/close
override lexicon (`pt-br-openclose.tsv`, **1369 entries**): word → the correct stressed mid vowel, mined from the
BZ referee for words where the rule output matches NO attested variant (so homographs, which match one reading,
are left untouched — safe). Applied by replacing the char after ˈ; wired through the pt engine's new per-word
`postWord` hook so `text()` gets it too (the en-GB lesson). **Non-circular**: the referee eval scores the
RULE-ONLY path `phonemizeWordRules` (86.9%, unchanged); the lexicon is a SHIPPED refinement → phonemizeWord 89.3%.
Validation: the lexicon corrected three words I'd mis-adjudicated in my OWN gold (pobre→[ˈpɔbɾi], sete→[ˈsɛt͡ʃi],
nove→[ˈnɔvi] are all genuinely open in BP).

(This lexicon was initially framed as "deliberately not built per the `pt` precedent" — that was the wrong call:
if the contrast is real and rule-unpredictable, a lexicon is the right tool, and the rules-only/shipped split
keeps the headline honest. Mined the rules first (Runs 3–4), then the lexicon for the genuine residual.)

**Remaining tail (~11%)** — shared-EP or not-yet-mined: `-ear` glide-vs-hiatus (campear→kɐ̃pjaɾ vs kɐ̃peaɾ — the
shared onglide pass); `sc`-cluster gemination (apascentar, an EP-side grapheme issue); pretonic open-vowel
preservation in -mente adverbs (abertamente); loanwords (allah, catmandu). Further rounds possible.

## Status

✅ VERIFIED (flipped from 🟡 after Runs 3–5, 2026-07-18). Floor 0.86 (rules-only 86.9%, non-circular; shipped
phonemizeWord 89.3% with the open/close lexicon). A genuine referee number, not noise-limited.

**Why ✅ (not 🟡):** gold 100%, and after the open/close lexicon the residual composition is the ✅ profile — the
only remaining SYSTEMATIC classes are INHERITED from the `pt` engine (which is ✅): the sc-cluster (absceder→our
abssedeɾ, EP-side), the güe/gue u-glide (aguei→aɡej, both dialects), -mente pretonic preservation (abertamente),
and EP -ct- spellings (abjecção) all fail identically in pt-PT. The rest of the miss is diffuse — loanwords,
Tupí-Guaraní regionalisms (abaneenga), proper nouns, and rhotic-variant referee noise. No pt-BR-SPECIFIC gap
remains, so pt-BR now has the same residual profile as its ✅ pt-PT parent.

**Training relevance:** the OmniVoice FLEURS corpus labels its Portuguese audio as `pt_br` (data_config.json), not
pt-PT — so pt-BR's phonemization is what the model actually consumes for Portuguese, which is why the sibling was
targeted alongside pt-PT. (The `ɨ` primitive the coverage-set doc credits to `pt` is not emitted by BP, but Welsh
`cy_gb` — also in the corpus — supplies it, so it stays attested.)

Second accent variant after en-GB → the parameterized-engine pattern (vs en-GB's post-process) for deep
phonological deltas. Next accent target: **es-419** (Latin-American Spanish — also a training locale, currently
unbuilt: only generic `es` exists).
