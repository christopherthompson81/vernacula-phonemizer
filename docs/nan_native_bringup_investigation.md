# Min Nan / Taiwanese Hokkien (nan) native bring-up

Southern Min, Sinitic, ~50M speakers (Taiwan, Fujian, SE-Asian diaspora) — the fourth Sinitic language (after
cmn, yue, wuu). Unlike the others, Min Nan has a **first-class romanization** tradition — **Tâi-lô** (教育部臺灣閩
南語羅馬字, the MOE standard) and the older **POJ** (Pe̍h-ōe-jī) — so this is **romanization-first** with a Han
front-end on top. Ported from the espeak-ng-portable `nan` authoring (which validated 400/400 vs epitran).

## Architecture — two front-ends, one converter
- **Direct Tâi-lô / POJ → IPA** (the primary path): strip the tone diacritic (identifies the tone: ́=2 ̀=3 ̂=5 ̌=6
  ̄=7 ̍=8 ̋=9; unmarked = 1 open / 4 checked) → `[initial] + final` → IPA + Chao tone letter. Sibilants PALATALISE
  before i (ts/tsh/s/j + i → t͡ɕ/t͡ɕʰ/ɕ/d͡ʑ); checked codas -p̚/-t̚/-k̚ + -h→ʔ; nasalised -nn vowels; syllabic m̩/ŋ̍.
- **Han → Tâi-lô → IPA**: `dict.tsv` (14,970 entries: 3,496 single-char + 11,476 word readings, MOE dict) with
  greedy longest-match segmentation, then the same converter.

The initial (21) / final (106) / tone tables are from the **epitran nan-Latn-tl** map (the Tâi-lô spec).

## Runs — 2026-07-15
- **Run 1** — extracted the initial/final tables from epitran (tone-stripped), wrote the tone-diacritic parser +
  the palatalisation rule + syllabic-nasal handling; generated `dict.tsv` from the espeak-ng-portable Han dict.
  Validated the direct path against the espeak-ng-portable golds (Tâi→tai̯˨˦, pe̍h→peʔ˥ tone-8, tsia̍h→t͡ɕi̯aʔ˥,
  sann→sã˥, sī→ɕi˧). One fix: epitran omits the unreleased mark on checked stops — added -p̚/-t̚/-k̚ (kok→kɔk̚˧,
  as for Cantonese).

## Result — 🟡
The segmental Tâi-lô→IPA converter + Han dict front-end work end-to-end (我食飯→ɡu̯a˥˩ t͡ɕi̯aʔ˥ png˧). Referee
GAP: no independent HUMAN referee exists (no wikipron nan, no kaikki extract); epitran IS the spec the converter
derives from, so wiring it would be circular. Anchored on the adjudicated gold (`test/minnan.test.ts`; the
segmental converter was validated 400/400 vs epitran in the espeak-ng-portable bring-up). 🟡 for the deferrals:
- **Tone SANDHI (連讀變調)** — the defining Min Nan prosody — is deferred; Phase 1 is CITATION tone.
- Han dict coverage gaps (variant chars: 臺/台, 閩) and POJ oa/oe read literally (vs Tâi-lô ua/ue).
