# Icelandic stress — emitting the mark the engine never had

Follows the same audit that produced `afrikaans_stress_investigation.md`. That sweep flagged three
engines whose "stress not modelled" note was not actually justified; `af` was fixed first, `is` is
this one, `lb` remains.

Referee: `tools/referee-eval/referees/is.wikipron-isl-broad.tsv` (wikipron isl_latn_broad, human,
10093 headwords). Baseline before this work: folded backbone **8091/10093 (80.2%)**, symbol
accuracy 96.8%.

## Run 1 — 2026-08-17 — is the deferral justified?

Question: the engine header ends "Vowel LENGTH, ASPIRATION (pre/post), and DEVOICED SONORANTS are
folded/deferred" and says nothing at all about stress. Is stress a considered deferral or an
omission?

Finding — it is an omission, and a different one from Afrikaans:

- `grep -rn "stress" src/languages/icelandic/` → **no matches at all**. Unlike `af` (which computed
  stress internally for vowel quality and then discarded the mark) and unlike `lb` (which computes a
  rule, measures it at +3.9pp, and suppresses the output), `is` never had the concept. There was no
  decision to justify, so there is nothing here that "deferred" could be describing.
- Icelandic stress is **fixed on the first syllable** with no lexical exceptions to look up and no
  prefix class to except. Loans are nativised to initial stress rather than keeping the donor's
  placement. This is the easiest case in the fleet — strictly easier than Czech, which already emits
  it (`czech.jsonc`: `"stress": "fixed first-syllable ˈ, with ˌ on even non-final nuclei"`).

So: not justified. Implement it.

## Run 2 — 2026-08-17 — what can validate the placement?

Question: what does the referee say about stress?

Raw finding: `grep -c "ˈ" tools/referee-eval/referees/is.wikipron-isl-broad.tsv` → **0**, across all
10093 rows. This is the same property already established for the whole wikipron-broad family (0 of
64 broad referee files mark stress on >50% of entries — the scrape strips it universally).

Second finding: it would not matter anyway. `tools/referee-eval/config.ts:49` is
`[/[ˈˌ]/gu, ""]` in the shared BACKBONE strip — the eval removes stress from **both** sides for every
language. The harness is blind to stress by construction.

Implication — **the referee cannot validate this and no amount of tuning will change that.** The
correctness of the placement has to rest on the fixed-initial generalization, which needs no corpus.
What the corpus *can* validate is the implementation, which is a different and still-worth-asking
question: does the mark land on the first nucleus, exactly once, and change nothing else?

## Run 3 — 2026-08-17 — implementation, and the ⟨e⟩ trap

`stressInitial()` in `icelandic.ts`: find the first nucleus **character** and splice `ˈ` before it.

Character-level, not token-level, because the repo convention puts the mark before the NUCLEUS rather
than the onset (`nˈaða`, not `ˈnaða`) and two graphemes bury a nucleus inside a multi-character
token: ⟨é⟩ scans to `"jɛ"`, whose `[j]` is an onset glide (ég → `jˈɛɣ`), and the diphthongs scan as
two characters.

The trap: the obvious set to reuse is `VOWEL_PH`, and it is the **wrong** one. `VOWEL_PH` omits plain
⟨e⟩ on purpose — that omission is what keeps the hiatus glide from firing before the ⟨ei ey⟩
diphthong, and `icelandic.jsonc` records it as worth 8091 → 8090/10093. But ⟨ei⟩ is obviously a
syllable nucleus, so reusing `VOWEL_PH` would leave `Steinn` unstressed, and "fixing" it by adding
⟨e⟩ to `VOWEL_PH` would silently re-arm the glide rule a previous run spent its time measuring away.
Hence a separate `NUCLEUS_CH = VOWEL_PH ∪ {e}`, with the two questions kept apart in the comment.

Verification over all 10093 referee headwords (before/after dumps via `git stash`):

| check | result |
|---|---|
| rows differing after stripping `ˈ` from the new output | **0 / 10093** |
| rows with more than one mark | 0 |
| rows with no mark | 12 — `b d g h j m n p v x Þ þ`, the vowelless letter-name rows |
| folded backbone, before → after | 8091 → **8091** (80.2%), unchanged |
| symbol accuracy, before → after | 96.8% → 96.8%, unchanged |

Mark offset within the IPA string: 0 ×1411, 1 ×6047, 2 ×2300, 3 ×316, 4 ×7. The deep tail is right —
`strjáll → strjˈautl` (onset /strj/), `kné → hknjˈɛ` (preaspirated k + n + the ⟨é⟩ glide).

One reporting artefact, pre-existing and not introduced here: the eval's `raw exact` line (unfolded
comparison) drops 1848 → 2 for `is`, because raw comparison counts the mark. Czech, which already
emits stress, reads 4/17787 on the same line. The `folded backbone` figure is the one the floors use.

## Run 4 — 2026-08-17 — test churn, audited rather than trusted

39 IPA literals in `test/icelandic.test.ts` changed. Each new value was **predicted from the
fixed-initial rule and then run**, not copied out of the engine — all 39 passed on the first
execution, which is the check that the rule and the expectations were derived independently.

Diff audit: the 39 removed lines and 39 added lines are an **identical multiset once `ˈ` is
stripped**. This is the same audit used on the Afrikaans change and it is worth keeping — a
positional diff read gave four false alarms there purely from inserted comment lines.

Added `test/icelandic.test.ts` → "primary stress is fixed on the first syllable, marked before the
nucleus", pinning the onset cases (`dagur`, `Alaska`, `strjáll`, `ég`, `Hekla`, `Steinn`) and the
no-nucleus case. Since the referee is blind to stress, these assertions are the only guard there is,
and the test says so.

## Not done, and why

**Secondary stress.** Icelandic gives later members of a compound their own stress. Its placement is
a function of the compound seam, and this engine has no decomposer to find one — unlike Afrikaans,
whose `decompose()` already returns a `stressPart`. Czech's trick of putting `ˌ` on even non-final
nuclei does not transfer, because Czech's secondary placement is not seam-dependent and Icelandic's
is; applying it here would drop marks inside morphemes. This waits on a compound splitter, not on a
decision.

**Function-word reduction.** Every word gets a mark, including monosyllables and clitics. This
matches Czech, which marks unconditionally. Sentence-level reduction is a prosody question, not a
lexical one, and no engine in the fleet models it.

## Still open from the parent audit

- `lb_lu` — computes a stress rule, records "measured net +3.9pp over always-first-syllable", emits
  no mark. Same class as this, and the rule already exists.
- `sl` / `sr` / `hr` — genuinely blocked on sourcing a stress-marked lexicon; pitch-accent languages
  where the placement is lexical and not derivable. That deferral is justified.
