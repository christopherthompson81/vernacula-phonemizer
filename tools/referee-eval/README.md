# Referee eval — linguistic-correctness validation

vernacula targets **canonical IPA and linguistic correctness**, not espeak parity. The espeak-canonical output
each language was bootstrapped from is a *regression guard* (it catches accidental drift), but it is **not** the
definition of correct. This harness measures the other half: does our output agree with **independent** sources?

> **The referee % is not a maturity score** — it is confounded by referee quality and fold ceilings.
> For "is this language reliable / what work is left?", see [`docs/language-maturity.md`](../../docs/language-maturity.md).

## Method

For each language we compare our phonemizer's **segmental backbone** against one or more **referees** — G2Ps or
human transcriptions that are *independent of espeak*:

- **epitran** (`zul-Latn`, `kaz-Cyrl`, …) — programmatic, broad coverage, but fallible: drops ejectives, writes
  bare clicks, over-marks allophonic palatalization, merges some vowels.
- **wikipron** — human narrow transcriptions; richer but sparser and internally inconsistent.

No referee is an oracle. Each is **fallible**, so:

1. We fold away the layers where we are simply *richer* than the referee (tone, length, depressor voicing,
   ejectives, tie-bars) and the documented **allophonic** differences (mid-vowel raising, dark-l harmony, a/ə).
   Every fold is justified in `config.ts` — a fold either neutralises notation or a genuinely predictable
   allophone, never a real contrast.
2. Whatever **remains** after folding is the linguistic signal: a *candidate* to adjudicate against published
   phonology — **not** an automatic bug, and **not** something to reflex-fix toward the referee. Corroborate
   across ≥2 referees before trusting a divergence.

The committed correctness anchor stays the hand-authored unit test per language (`*.test.ts`); this harness is
the cross-check that those authored expectations are linguistically real.

## Sources: primary / secondary / gap

Each language declares its independent sources in `config.ts` with a **role** — a `primary` and, ideally, an
independent `secondary` (≥2 sources before trusting a divergence). Where no independent secondary exists, that is
recorded as an explicit `secondaryGap` string, **not** silently omitted. `eval.ts` reports the role per referee
and prints the gap; the test floors the **primary**.

Two languages need a non-default path, handled inside the one framework:
- **ar** is evaluated through the **async** ONNX diacritizer (`phonemizeArabic`): the referee's IPA is fully
  voweled, so the short-vowel restoration must run first (the sync `phonemizeWord` would compare skeletons).
- **cmn** is **syllable-level**: the referee is epitran's toneless pinyin-syllable→IPA inventory (no word-level
  wikipron cmn exists), and `PHON[cmn]` is the bare pinyin converter (`createPinyinPhonemizer`).

## Run

```bash
npx tsx tools/referee-eval/eval.ts <ar|ca|cmn|cs|de|en|es|ff|fr|ha|hi|ja|kk|ko|pt|ru|si|sv|ta|th|tr|vi|zu> [--examples N]
npx vitest run tools/referee-eval/referee-eval.test.ts   # primary-source floors
```

Every language with a phonemizer has a referee (or a documented gap). Current backbone corroboration (primary;
independent secondary in parens): **zu 100%** · **es 92.5%** · **ha 90.3%** (epitran 88.4%) · **th 81.9%** ·
**hi 77.7%** · **ta 63.0%** · **tr 76.2%** (epitran 79.8%) · **ru 94.8%** (gold 97.7%) · **si 93.5%** · **sv 52.6%** (Phase 3, NST accent+stress+o-quality lexicon) · **ca 81.3%** (Central; multi-dialect referee, reduction folded) ·
**kk 86.2%** · **cmn 84.7%** (syllable) · **pt 78.0%** (gold 99.4%) · **vi 71.0%** (epitran 51.3%) · **ff 71.2%**
· **cs 69.9%** · **fr 66.5%** (gold 85.6%) · **ga 44.8%** (Celtic broad/slender; 3-dialect referee) · **cy 56.5%** (Welsh; dialect-matched NW referee) · **ko 58.5%** · **ja 57.9%** · **de 70.6%** (wikipron 70.4%) ·
**ar 45.4%** · **en 36.1%**.

The low ones are referee-quality artifacts, not engine defects: **en** vs wikipron is a noisy referee (proper
nouns, British variants, letter-name rows); **de** vs kaikki is dragged down by kaikki's proper-noun/loanword
bulk (the wikipron secondary agrees at 52.2%); **ja/ko** narrow wikipron carries allophonic palatalization and
devoicing detail we fold only partially; **fr** vs raw wikipron is noisy (the adjudicated gold gives 85.6%);
**th** residual is lexical Sanskrit/Pali readings, not segmental; **cs** is deflated by epitran's own voicing
bugs; **ar** is bounded by the ONNX diacritizer's short-vowel misses. Where we differ from a programmatic referee
we are often the more faithful one — a divergence is a candidate to adjudicate, never an auto-fix.

## Referee data (`referees/`)

TSVs are `word<TAB>ipa`, independent of espeak, committed (small):

- `zu.epitran-zul-Latn.tsv`, `si.wikipron-sin.tsv` — copied from espeak-ng-portable's committed referee sets.
- `kk.epitran-kaz-Cyrl.tsv` — generated from the first 1,400 real Cyrillic corpus words via epitran.
- `<lang>.wikipron-*.tsv` (en/ha/hi/ja/ko/ta/th/tr/vi) — stride-sampled (~4.5k, alphabetically uniform) from the
  CUNY wikipron scrape; ja/ko/vi are narrow-only (no broad variant), so their extra narrow detail is folded.
- `ff.epitran-ful-Latn.tsv` — copied from espeak-ng-portable's `tools/qa-compare/ff_gold.tsv` (no wikipron Fula
  exists); the `.venv-epitran` there is also what generated the ha/tr/vi epitran secondaries.

**Secondary gaps that are real, not lazy:** epitran Indic G2Ps are not usable corroborators — `hin-Deva` skips
Hindi schwa-deletion (disagrees with everyone) and `tam-Taml` echoes untransliterated graphemes — so hi/ta
record a `secondaryGap` pointing at a kaikki lexicon as the right second source. en's would-be epitran secondary
is CMU-derived (circular with our g2p). ff has no independent second Fula source at all.

Regenerate an epitran referee (epitran isn't a repo dependency — use a throwaway venv):

```bash
python3 -m venv /tmp/epi && /tmp/epi/bin/pip install epitran
/tmp/epi/bin/python3 -c "import epitran; e=epitran.Epitran('kaz-Cyrl'); \
  [print(w.strip()+'\t'+e.transliterate(w.strip())) for w in open('words.txt')]" > referees/kk.epitran-kaz-Cyrl.tsv
```

Adding a language: add a `CONFIG[lang]` block (referee list + justified folds) and a floor to the test.
