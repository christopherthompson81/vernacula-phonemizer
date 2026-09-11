# en: the copula `was` reads with the LOT vowel, not the STRUT vowel

Reported from listening to Kokoro output: `was` → *wˈɑːz* ("wahz") does not sound natural; the expected sound
is "wuz", the same vowel the reporter hears in the *ɹə* of `ˈɪnstɹəmənts`. The accompanying observation — "a
little too straight phonemic" — points past the single word at the wider question of whether the copula is
being de-accented like the other auxiliaries at all.

## Run 1 — 2026-09-11 10:16 — reproduce, and find which of the two possible causes it is

There are two independent levers that could produce a too-strong `was`, and they live in different files:

1. **Vowel quality**, fixed entirely by the flat lexicon (`data/languages/english/accent-lexicon.tsv`).
2. **De-accenting**, driven by `unstressedWords` in `data/languages/english/english.jsonc`, which the pass in
   `src/languages/english/english.ts:370` applies by stripping the citation `ˈ` — and *only* by stripping it.
   It never rewrites vowel quality.

Probe over the copula paradigm plus the already-correct auxiliaries, for contrast:

```
"was"                          -> wˈɑːz
"It was a test."               -> ɪt wˈɑːz ə tʰˈɛst .
"The instruments was ready."   -> ðə ˈɪnstɹəmənts wˈɑːz ɹˈɛd̬i .
"That is what it was."         -> ðæt ɪz wˌʌt ɪt wˈɑːz .
"were"                         -> wˈɝ
"am"                           -> ˈæm
"are"                          -> ˈɑːɹ
"does"                         -> dˈʌz      <- reduces correctly in a sentence: ɪt dʌz wˈɝk
"instruments"                  -> ˈɪnstɹəmənts
```

Both levers are wrong for `was`, and they are wrong independently:

- The lexicon carries `was<TAB><TAB>wˈɑːz`, inherited from CMUdict's `was  W AA1 Z`. `AA1` is the LOT vowel.
  GenAm's ordinary copula is /wʌz/ strong, /wəz/ reduced; the *wɑz* variant is real but marked, and CMUdict
  records it as the sole entry with no `WAS(1)` alternate to select from. So the vowel is a plain lexicon
  defect, not a rule misfiring — the neighbours `wash  W AA1 SH` and `wasp  W AA1 S P` genuinely *are* LOT
  words and must keep `ɑː`. This is a one-word override, not a sound change.
- `was` is absent from `unstressedWords`, although `be been is has have had do does did could should would
  might may will` are all present. So it keeps its primary in "It was a test" where `does` correctly loses
  its own (`ɪt dʌz wˈɝk`).

The reporter's comparison to `ɹə` is the diagnostic that separates the two: `ə` is a *quality* judgement, and
no amount of de-accenting would have reached it, because de-accenting only deletes the stress mark. Confirms
the lexicon is the primary cause and the `unstressedWords` omission is a second, additive one.

`wasn't` is a separate lexicon entry and carries the same inherited vowel (`wˈɑːzənt`), so it moves with `was`
or the contraction and the full form stop agreeing.

No golden test or doc references `wˈɑːz` / `W AA1 Z` (grep over `test/ tools/ docs/` is empty), so nothing is
pinned to the old reading.

Next step: change the two lexicon rows to the STRUT vowel, add `was` to `unstressedWords`, and re-probe — the
sentence forms should surface bare `wʌz`, and the clause-final tonic case should still promote back to `wˈʌz`.

## Run 2 — 2026-09-11 10:20 — both levers moved; the tonic guarantee still fires

Changed three rows and one list:

- `accent-lexicon.tsv`: `was  wˈɑːz` → `wˈʌz`, `wasn't  wˈɑːzənt` → `wˈʌzənt`.
- `g2p-dict.tsv`: `was  W AA1 Z` → `W AH1 Z`, so the OOV n-gram's stem inventory tells the same story as the
  flat lexicon rather than contradicting it.
- `english.jsonc` `unstressedWords`: `was` added, between `upon` and `we`.

Re-probe:

```
"was"                          -> wˈʌz
"It was a test."               -> ɪt wʌz ə tʰˈɛst .
"The instruments was ready."   -> ðə ˈɪnstɹəmənts wʌz ɹˈɛd̬i .
"That is what it was."         -> ðæt ɪz wˌʌt ɪt wˈʌz .
"wasn't"                       -> wˈʌzənt
"It wasn't ready."             -> ɪt wˈʌzənt ɹˈɛd̬i .
"washed"                       -> wˈɑːʃt
"wasp"                         -> wˈɑːsp
```

Every predicted behaviour holds. Sentence-medial `was` is bare `wʌz`; the clause-final case promotes back to
`wˈʌz` under the nuclear-tonic rule, which is right — "what it WAS" *is* accented, and `was` is deliberately
not in `nonTonicFinal` (that list is personal pronouns). `wasn't` keeps its primary, also right: the negative
contraction is an accented word, not a function word, and it is correctly absent from `unstressedWords`. The
LOT neighbours `wash`/`washed`/`wasp` are untouched, confirming the override is lexical and local.

`npm run typecheck` clean; `npm test` 294 files, 5799 passed / 5 skipped. Nothing regressed.

### Negative result: the referee cannot corroborate this one

Hoped to check the change against the independent source rather than against my own ear.
`tools/referee-eval/referees/en.wikipron-eng-latn-us-broad.tsv` is a sampled subset and **has no `was` row at
all** (nor `of`, nor `wasn't`); its `does  d o ʊ z` is the plural-of-*doe* homograph, not the auxiliary. So the
function-word core of English is largely absent from the referee, and the `en backbone ≥ 30%` test passing
says nothing about this change either way. The justification rests on the GenAm description (/wʌz/ ~ /wəz/,
with /wɑz/ the marked variant CMUdict happens to have recorded as its only entry) plus the reporter's ear,
not on the referee.

### Adjacent, NOT fixed here

The rest of the copula paradigm has the second defect but not the first — `were  wˈɝ`, `am  ˈæm`, `are  ˈɑːɹ`
are all correct citation forms, but none of the three is in `unstressedWords`, so they hold a primary in
positions where `is`/`has`/`does` correctly lose theirs ("They ˈɑːɹ here" vs "It dʌz work"). That is a separate
one-list change with a different risk profile — `are` and `am` are far more often the tonic than `was` is —
and it is left for its own run.

## Run 3 — 2026-09-11 10:34 — is the defect upstream, or in the Kokoro renderer?

Asked because the report said *wˈɑz* but the phonemizer emits *wˈɑːz* — something between the two was
rewriting, and if the rewrite were the culprit the lexicon edit would be treating the wrong layer.

The rewriter is `src/Vernacula.Tts.Base/KokoroFormat.cs` in the parent repo, which renders canonical IPA into
misaki's alphabet. Three checks, all exonerating:

- The only rule that touches this string is the en-us branch's `ps.Replace("ː", "")` — misaki drops length
  marks for en-us (en-GB keeps them). That accounts for the missing `ː` exactly, applies to every en-us vowel
  alike, and never changes vowel identity.
- `KokoroVocab` has both `['ɑ'] = 69` and `['ʌ'] = 138`, so this was not an out-of-vocab fallback quietly
  substituting a reachable vowel for an unreachable one. Kokoro was handed `ɑ` because it was asked for `ɑ`.
- Nothing else in the `Common` replacement table matches `ɑ`, `ʌ`, or `w`.

Verified end-to-end through the real C# path (`KokoroPhonemizer.ToPhonemes`, data tree pointed at the working
submodule) rather than by reading the table:

```
was                            -> wˈʌz
It was a test.                 -> ɪt wʌz ə tˈɛst.
The instruments was ready.     -> ðə ˈɪnstɹəmənts wʌz ɹˈɛdi.
That is what it was.           -> ðæt ɪz wˌʌt ɪt wˈʌz.
It wasn't ready.               -> ɪt wˈʌzənt ɹˈɛdi.
wasp                           -> wˈɑsp
```

`dotnet test --filter Kokoro`: 16/16 pass against the edited data tree.

**Conclusion: upstream phonemizer, not the renderer.** The fix is in the right place. Note the two reasons the
renderer was worth ruling out anyway — it is lossy by design (length marks) and it silently maps several
symbols, so it *is* a plausible suspect for a future "the IPA looks right but it sounds wrong" report, even
though it was innocent here. Also worth recording: because the C# side loads the phonemizer's `data/` tree at
runtime, a lexicon edit reaches Kokoro with no rebuild of the data — only a submodule pointer bump.

## Run 4 — 2026-09-11 10:48 — confirmed against a real export from the parent app

The reporter supplied a full sentence exported from Vernacula.Avalonia — a formal minute-taking register,
declarative past-tense copula mid-clause, which is the position the defect is most audible in. Re-ran a
sentence of the same shape through the fixed build to confirm the export predates the change:

```
"During the review, we noted that the invoice was not related to goods supplied to customers."
  -> dˈʊɹɪŋ ðə ɹivjˈu, wi nˈOTᵻd ðæt ðə ˈɪnvYs wʌz nɑt ɹᵻlˈATᵻd tu ɡˈʊdz səplˈId tu kˈʌstəməɹz.
```

The reported export carried `wˈɑz` at that slot; the fixed build gives `wʌz` — both the vowel and the stray
primary are gone, in running text, through the real app path. Nothing else in the sentence moved.

### Noticed in passing, NOT a defect and NOT changed

`services → sˈɜɹvəsəz` uses `ə` where misaki would likely write the weak vowel `ᵻ` (`sˈɜɹvᵻsᵻz`). This is not
a bad row: `service sˈɝvəs`, `offices ˈɔːfəsəz`, `surfaces sˈɝfəsəz` are a consistent CMUdict `AH0` family, so
the question is whether the engine's weak-vowel rule (`englishArpabet.ts`, KIT → ᵻ) should also cover this
`-ices`/`-aces` environment. That is a rule-level question across thousands of words with its own referee
measurement, not a lexicon override, and is explicitly out of scope for this log. Recorded here only so the
observation is not lost.
