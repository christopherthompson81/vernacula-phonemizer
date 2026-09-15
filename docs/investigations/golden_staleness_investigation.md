# Golden staleness — diagnosing 103 findings before regenerating

`csharp/goldens/` is a generated artifact committed to the repo and the port's
definition of done. `npm run ci` had been reporting it stale for some time, and
the checker's own instruction is the reason this document exists:

> Decide WHICH is wrong before regenerating — re-recording a row is how a real
> defect survived weeks of green gates (see #1283).

## Run 1 — 2026-09-15 18:20 — is any of it real?

**Question.** 103 findings across 17 of 189 languages. The checker's header
warns that for the 74 ONNX-dependent languages the output is not bit-reproducible
across CPU microarchitectures — 44 rows of 36,495 measured between two runners.
So the first question is not "which row is wrong" but "is this hardware noise or
a real change?"

**Command.** `npx tsx tools/check-goldens.mts --show 30`, then a token-level diff
of every reported row.

**Raw finding.** All 103 rows bucket into five shapes, and every one is
deterministic:

```
  48  secondary stress mark    'ˈɔːnlaᶦn'      -> 'ˈɔːnlˌaᶦn'
  38  strong-form coordinator  'ənd'           -> 'ˈænd'
  19  same, en-IN retroflex    'ənɖ'           -> 'ˈænɖ'
   1  spelling fold            'ləbˈɛlɪŋ'      -> 'lˈeᶦbəlɪŋ'   (labelling)
   1  spelling fold            'splˈɛndəɚ'     -> 'splˈɛndɚ'    (splendour)
   1  spelling fold            'mˈɑːd̬ɚnəsɪd'  -> 'mˈɑːd̬ɚnˌaᶦzd' (modernised)
   1  spelling fold            'flavouɾ'       -> 'fleva'       (flavour)
   1  spelling fold            'haemoɡlobin'   -> 'himaɡloban'  (haemoglobin)
```

**Implication.** Not noise. Every shape traces to a change that merged with its
own argument, measurement and tests:

  · the stress-clash exception — a closed final syllable on a true diphthong
    keeps its 2° (`profile`, `online`, `dormouse`, `thymine`, `Ullstein`);
  · the clause-initial coordinator taking its strong form after a pause;
  · the Commonwealth→American spelling fold.

⚠ **The 14 non-English languages are not independent findings.** Every one is an
English word embedded in a foreign-language row and handed to the English reader
through the foreign-OOV path — `online` in Chuvash and Gan, `dormouse` in Khmer,
`thymine` in Hakka, `splendour` in Gan. One English change moves rows in fourteen
other languages, which is worth knowing when reading a fleet-wide count: 17
languages stale did not mean 17 things went wrong.

**Verdict: the engine is right in all 103 rows; the goldens are stale.** This is
case 1 from the checker's own header — "a change did not regenerate them at all".

## Run 2 — 2026-09-15 18:40 — regenerating without the corpus

**Question.** `gen_parity_goldens.mts` needs a 337 MB FLEURS corpus and an
alignment DB that are not committed; without them it produces a THINNER row set.
So how does one regenerate at all?

**Finding.** The row set does not need re-deriving. The checker already
re-renders each golden's OWN recorded text — that is how it verifies rows without
a corpus — so the same pass can write the IPA back. `--write` does exactly that
and nothing else: no row added, dropped or reordered.

Two traps found while building it, both caught before the write:

  · ⚠ **Rows repeat.** `en.tsv` carries the same text twice. Keying the rewrite
    by line CONTENT writes both copies to the first one's index and leaves the
    second stale — which afterwards reads as a regeneration that did not
    converge. Walked by index instead.
  · ⚠ **The degraded modes must refuse to write.** `--no-ort` manufactures
    mismatches on purpose and skips the neural-liveness assertion; writing under
    it would re-record the fleet from an engine with its neural path switched
    off. That is #1283 at fleet scale. `--write` refuses `--no-ort`,
    `--no-clear`, `--isolate` and `--child`.

**Result.**

```
17 goldens rewritten, 103 insertions, 103 deletions — no row added or dropped
goldens fresh: 189 languages, 36495 rows, 0 stale
189 languages byte-identical, 0 differ (36495 rows ok, 0 differ)   [csharp/tools/parity]
```

⚠ **The C# parity run is the load-bearing confirmation, not the re-check.**
Re-running the checker only proves the file now says what the TS engine says —
it would be green even if the regeneration had captured a TS-only defect. The
port reads the same goldens and reproduces all 36,495 rows byte-identically from
an independent implementation, which is what makes "the engine is right" a
measurement rather than an assertion.
