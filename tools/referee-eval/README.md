# Referee eval — linguistic-correctness validation

vernacula targets **canonical IPA and linguistic correctness**, not espeak parity. The espeak-canonical output
each language was bootstrapped from is a *regression guard* (it catches accidental drift), but it is **not** the
definition of correct. This harness measures the other half: does our output agree with **independent** sources?

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

## Run

```bash
npx tsx tools/referee-eval/eval.ts <zu|si|kk> [--examples N]   # report + residual divergence classes
npx vitest run tools/referee-eval/referee-eval.test.ts          # corroboration floors (regression guard)
```

Current backbone corroboration: **zu 100%** (epitran), **si 93.5%** (wikipron human), **kk 86.2%** (epitran).
kk's residual is dominated by epitran's *own* limitations (it merges ө/ү→ʏ where we correctly keep ө≠ү, and
over-marks the е palatal onglide) — i.e. where we differ from epitran, we are usually the more faithful one.
This is why the espeak-ng-portable kk convergence used wikipron, not epitran; a human kk referee would be a
better second source to add here.

## Referee data (`referees/`)

TSVs are `word<TAB>ipa`, independent of espeak, committed (small):

- `zu.epitran-zul-Latn.tsv`, `si.wikipron-sin.tsv` — copied from espeak-ng-portable's committed referee sets.
- `kk.epitran-kaz-Cyrl.tsv` — generated from the first 1,400 real Cyrillic corpus words via epitran.

Regenerate an epitran referee (epitran isn't a repo dependency — use a throwaway venv):

```bash
python3 -m venv /tmp/epi && /tmp/epi/bin/pip install epitran
/tmp/epi/bin/python3 -c "import epitran; e=epitran.Epitran('kaz-Cyrl'); \
  [print(w.strip()+'\t'+e.transliterate(w.strip())) for w in open('words.txt')]" > referees/kk.epitran-kaz-Cyrl.tsv
```

Adding a language: add a `CONFIG[lang]` block (referee list + justified folds) and a floor to the test.
