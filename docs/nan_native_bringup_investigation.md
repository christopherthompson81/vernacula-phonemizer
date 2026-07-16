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

## Run 2 — 2026-07-16 — independent referee wired; a real finals bug found + fixed

The Run-1 doc claimed "no independent HUMAN referee exists (no wikipron nan)". **That was not checked and is
wrong.** CUNY-CL/wikipron ships `nan_hani_hokkien_broad.tsv` — 46,238 Wiktionary Hokkien readings (Han char →
IPA, numeric pitch-contour tones + sandhi arrows ⁻). It is NOT epitran (the Tâi-lô spec our converter derives
from), so wiring it is NON-CIRCULAR. kaikki Hokkien also exists (HTTP 200).

**A real bug the independent referee immediately exposed.** Segmental agreement started at a puzzling 68% (after
fixing a measurement bug — my tone-stripper used `[⁰-⁹]`, but the superscript ¹²³ are Latin-1, NOT contiguous
with ⁴-⁹, so tones weren't stripped). Bucketing the misses found the cause: **14 nasal-coda / syllabic-nasal
finals were MISSING from `minnan.jsonc` finals** — `an, am, ang, in, im, un, uan, iam, iang, uang, m, ng, mh,
ngh` (the -m/-n/-ng series was only partially extracted from epitran: ong/ian present, an/in/un/ang/am/im/uan
absent). A syllable with a missing rime falls through `baseToIpa`'s `if (fin === undefined) return base` and is
emitted RAW — so 刊→"khan" (not kʰan), 飯→"png" (not pŋ̍), 人→"lang" (not laŋ). This hit **18.1% of all dict
syllables** (5,359/29,636). Because epitran has the SAME gap, the Run-1 "validated 400/400 vs epitran" passed
WITH the bug — exactly the circularity the doc had warned about, made concrete. Fixed: added the 14 finals
(matching the table's conventions — ak→ak so ang→aŋ; ua→u̯a so uan→u̯an; syllabic ng→ŋ̍) + `mh`/`ngh`
special-cases for the standalone syllabic-nasal-checked case. Gold updated (人→laŋ, 飯→pŋ̍ were the old raw
values). Segmental accuracy 68%→**77%**→(with dialect folds) **97.6%**.

**What the residual really is (per the "is this real Min Nan?" audit).**
- **Coverage = 58.4%** of the referee's 5,535 single chars are in our MOE dict. The 2,305 uncovered are NOT
  out-of-language noise: **95.6% are common-CJK (U+4E00–9FFF)** real characters with valid Hokkien readings
  (丘 khiu, 于 î, 互 hō͘, 些 sia, 仲 tiōng) — a genuine dict-coverage gap. Only ~103 are rare-extension chars.
  Closing it needs a fuller single-char Tâi-lô lexicon (the MOE 單字 set beyond our 3,496, or ChhoeTaigi) — a
  bounded, INDEPENDENT-source task (using wikipron/kaikki to expand would re-introduce circularity).
- **Covered-char residual = 2.4%** (77/3,230). Reading each as a word: essentially ALL are polyphonic-char
  (多音字) reading variants where our dict picked one valid reading and wikipron recorded another
  (侍 sū/sāi, 女 lí/lú, 危 guî/huî, 夯 giâ/hāng, 恨 hūn/hīn), or referee gaps (台→our tâi is correct; wikipron
  lists only i/thai). NONE are converter errors — the single-char citation can't disambiguate a 多音字.

**Folds (segmental; tone/sandhi deferred).** Strip the referee's numeric tone + sandhi arrow; fold the ts~t͡ɕ /
s~ɕ / j sibilant palatalisation before i (allophonic — the referee keeps dental t͡s); j→z (dialectal 入 initial);
the Tâi-lô ⟨o⟩ = [ə]~[ɤ] dialect vowel (ours ə, referee ɤ; open -io → iɤ, but -iok raises to iɔk before the
velar as ok→ɔk); the -ing/-eng final iəŋ~iɪŋ. All justified as notation/allophony/dialect.

RESULT: **97.6% segmental accuracy on covered chars** vs an independent human referee (was unmeasurable /
epitran-circular). STATUS stays **🟡** for two REAL limitations, now precisely characterised: (1) tone SANDHI
(連讀變調) deferred — Phase 1 citation tone; (2) dict coverage 58% (real rare chars, closable). The converter
itself is validated. Suite green; typecheck clean.
