# `phonemizeAsync` bypasses the registry pre-passes

`phonemize` → `getPhonemizer(lang).text` → the registry's shared pre-passes.
`phonemizeAsync` → `getNeuralPhonemizer(lang)` → the language's neural entry, which builds its engine
directly. Nothing in that second path runs the pre-passes. This log measures what that costs, picks a
fix, and measures again.

---

## Run 1 — 2026-08-14 — reproduce and enumerate the bypass

**Question.** Which async entries reach the registry wrapper, and which build an engine privately?

**Command.** Read `src/index.ts`, `src/neuralRegistry.ts`, `src/registry.ts` (the `getPhonemizer` shadow),
then `grep -n "getPhonemizer\|create<Lang>" src/languages/*/*Neural.ts src/languages/arabic/arabic.ts`.

**Raw finding.**

| async entry | how it renders | reaches the registry wrapper? |
| --- | --- | --- |
| `englishNeural.ts` | `createEnglish()` (module-local `enEngine()`) | no |
| `sindhiNeural.ts` | `createSindhiEngine()` | no |
| `afrikaansNeural.ts` | `createAfrikaans()` | no |
| `bengaliNeural.ts` | `createBengali(latin => getPhonemizer("en").text(latin))` — the *English* fallback goes through the registry; the Bengali engine does not | no |
| `danishNeural.ts` | `createDanish()` | no |
| `norwegianNeural.ts` | `createNorwegian()` | no |
| `frenchNeural.ts` | `createFrench()` | no |
| `hebrewNeural.ts` | `phonemizeWord` + `assembleClauses` directly — no engine at all | no |
| `khmerNeural.ts` | `createKhmer({ segment: false })` (and `createKhmer()` on fallback) | no |
| `arabic.ts:397` (`phonemizeArabic`, 10 registry codes) | `createArabic(variety, useLexicon)` | no |
| `perso-arabic/riderNeural.ts:39` | `getPhonemizer(lang).text(vocalized)` | **yes** |
| `persian/persianNeural.ts` (`:96 :109 :119 :137 :154`) | `getPhonemizer("fa").text(...)` | **yes** |

So 10 of 12 entries bypass; the two that do not are the two the brief names as the correct pattern.
Twenty of the twenty-three registry codes with an async entry are affected (`ur`, `ps`, `pnb` ride the
rider; `fa` rides persianNeural — but `fa`'s *outer* input is still unpre-passed, see Run 2).

**Note on the shadow's shape.** `getPhonemizer` does the work in two layers, and the order matters for
any replacement:

1. outermost, for every language *not* in `ROMAN_NATIVE`: `normalizeRomans(input, policy)`;
2. then the `text` shadow: `pushHost(lang)`, `stripMarkup` → `repairDoubleEncoded` → `foldSquaredDegrees`
   → `foldFullwidthLatin` → `foldCyrillicConfusables` → `foldLatinConfusables` → `foldCaretExponents`,
   then `foldVulgarFractions` (unless `VULGAR_FOLD_OPT_OUT`), then `foldNativeDigits` (unless
   `FOLD_OPT_OUT`, i.e. `te`).

Romans run **before** markup stripping. Any central replacement has to keep that order or it is not the
same pass.

**Implication.** This is drift, not design. Nothing in `index.ts` or `neuralRegistry.ts` states a reason
for the async path to skip the pre-passes; both files describe the async registry purely as "route to the
best path", and `neuralRegistry.ts`'s header says each entry "self-falls-back to the sync engine", which
is precisely the claim that the two paths should agree on everything except the neural upgrade. The two
correct files are the two most recently added of the group, which is the signature of a pattern that was
found late and never backfilled. Next: measure the damage.

---

## Run 2 — 2026-08-14 — the sync-vs-async differential, before any change

**Question.** For every code with an async entry, on a probe per pre-pass, where do `phonemize` and
`phonemizeAsync` disagree?

**Command.** `npx tsx tools/eval/async-sync-differential.ts` (new; 23 codes × 8 probes, each probe a
native host phrase `<word> @ <word>` with `@` replaced by the pre-pass's payload).

**Raw finding.** 153 disagreements. Per language: 8/8 for `af bn he km` and all ten Arabic codes, 7/8 for
`sd nb fr fa da`, 6/8 for `en`, and **0/8 for `ur`, `ps`, `pnb`** — the three that ride `riderNeural`,
i.e. the one file already doing it right. That is the cleanest possible confirmation of the diagnosis:
the languages routed through `getPhonemizer` show no pre-pass difference at all.

Representative rows (sync | async):

```
en  Year ۲۰۲۴ end      jˈɪɹ twˈɛnti twˈɛnti fˈɔːɹ ˈɛnd  |  jˈɪɹ ˈɛnd
sd  سال ۲۰۲۴ ۾          sˈaːlʊ ɓˈə həzˈaːɾʊ t͡ʃoːʋˈiːhə mˈẽ  |  sˈaːlʊ mˈẽ
bn  বছর ২০২৪-in-Arabic-digits  bɔt͡ʃʰoɾ d̪ui ɦad͡ʒaɾ t͡ʃobːiʃ ʃeʃ  |  bɔt͡ʃʰoɾ ʃeʃ
en  Year <i>2024</i> end   jˈɪɹ twˈɛnti twˈɛnti fˈɔːɹ ˈɛnd  |  jˈɪɹ aᶦ tʰˈuː θˈaᶷzənd twˈɛnti fˈɔːɹ aᶦ ˈɛnd
da  År XIV slut        ˈɒːˀ ˈfjoɐdən ˈslud  |  ˈɒːˀ ˈsiw ˈslud        (roman read as a WORD)
af  Jaar ¾ einde       jɑːr dri firdə əində  |  jɑːr əində
```

Three distinct failure modes, not one:

* **silent drop** — native digits, fullwidth digits, vulgar fractions: the payload vanishes;
* **spoken markup** — `<i>` is read aloud (`aᶦ`, and in Arabic as *ʔˈasˤɣar mˈin* "less than");
* **misreading** — `XIV` read as a word (`ˈsiw`, `zˈɪv`, `ksif`).

The brief's claim that Sindhi loses its *own* script's digits is confirmed and is the worst case: it is
not embedded foreign text, it is ordinary Sindhi.

**Implication.** Every neural language is affected and the fix has to be central.

---

## Run 3 — 2026-08-14 — the un-briefed half: the foreign-run HOST is missing too

**Question.** `pushHost` is inside the shadow. The neural entries call a private engine with an empty host
stack. `readForeignRun` returns `undefined` when `hosts` is empty — so what happens to a foreign run?

**Command.** A one-off probe: `<native word> Владимир <native word>` through both entries, 12 codes.

**Raw finding.** The Cyrillic run is **dropped entirely** on the async path for every code except
`ur` (the rider):

```
bn  bɔt͡ʃʰoɾ vɫɐdʲˈimʲɪr ʃeʃ  |  bɔt͡ʃʰoɾ ʃeʃ
he  ʃnt vɫɐdʲˈimʲɪr svf      |  ʃnat sof
fa  sˈaːl vɫɐdʲˈimʲɪr paːjˈaːn |  saːlˈe paːjˈaːn
ur  sˈɑːl vɫɐdʲˈimʲɪr xˈət̪m  |  sˈɑːl vɫɐdʲˈimʲɪr xˈət̪m   ← SAME
```

Not misrouted — gone. `core/foreign.ts`'s script router declines with no host, and the Latin-only
`defaultForeign` never sees a non-Latin run, so the run leaves no gap and `assembleClauses` skips it.

**Implication.** This constrains the fix. `pushHost`/`popHost` are documented as safe *because* the host
stack is "synchronous throughout"; holding a host across an `await` would let two concurrent
`phonemizeAsync` calls interleave and corrupt the stack. So the host cannot simply be pushed around the
async entry — it has to be pushed around the *synchronous render* inside each entry. That is a real
argument against "just wrap `getNeuralPhonemizer`" being the whole fix.

---

## Run 4 — 2026-08-14 — choosing between the two candidate fixes

**Question.** Pre-passes inside `getNeuralPhonemizer`, or neural entries rendering through
`getPhonemizer(lang).text`?

**Raw finding — why "render through `getPhonemizer(lang).text`" (candidate B) cannot be the fix.**

1. **The shadow drops extra arguments.** It is installed as `(input) => original(folded)`. Six entries
   render as `engine.text(text, oovOverride)` and English as `engine.text(text, undefined, tagged.get)`.
   Routed through `getPhonemizer`, the neural readings would be silently discarded — the fix would delete
   the neural upgrade it exists to serve.
2. **Three entries cannot use the registry's engine at all.** `khmerNeural` needs
   `createKhmer({ segment: false })` (it supplies its own boundaries; the registry's instance segments),
   `hebrewNeural` uses no engine (`phonemizeWord` + `assembleClauses`), and `phonemizeArabic` builds a
   variety engine and post-processes with `repairSentence`.
3. **It puts the pre-passes in the wrong place.** The word-level entries tag *before* they render, so
   pre-passes applied at render time would let the tagger see raw `<i>` and un-folded `۲۰۲۴` — the tagger
   would tag markup as a word. On the sync path the pre-passes run before the *tokenizer*; the async
   analogue of "before the tokenizer" is "before the tagger", not "before the render".

**Decision.** Candidate A — the pre-passes run once, centrally, in `getNeuralPhonemizer`, on the input,
before the neural entry sees it. Plus the host, which A alone does not cover, pushed around each entry's
synchronous render.

**The double-application hazard, and what it forces.** `riderNeural` and `persianNeural` render through
`getPhonemizer`, which runs the pre-passes *again*. The folds are idempotent, but `stripMarkup` is not:
it decodes entities, so `&amp;lt;` → `&lt;` → `<` — the exact "an author writing ABOUT a tag" case
`core/markup.ts` documents as the reason tags are stripped before entities are decoded. So the two
already-correct files must switch to a render that pushes the host but does **not** re-run the pre-passes.

**Shape of the change.**

* `registry.ts` exports `neuralPrePass(lang, input)` — romans-then-folds, in the sync order, honouring
  `ROMAN_NATIVE`, `VULGAR_FOLD_OPT_OUT` and `FOLD_OPT_OUT` (so `te`'s opt-out is preserved by
  construction, not by a second copy of the list). The shadow itself is rewritten to call the same two
  helpers, so there is exactly one definition of the chain.
* `registry.ts` exports `renderInHost(lang, input)` — the language's engine with the host pushed and the
  pre-passes **not** re-run, for a caller that has already pre-passed.
* `core/foreign.ts` exports `withHost(lang, fn)` — `pushHost`/`try`/`finally`/`popHost` around a
  synchronous `fn`. Typed to take a sync callback, which is what keeps the "synchronous throughout"
  invariant from being broken by a future edit.
* `neuralRegistry.ts` applies `neuralPrePass` to every entry, both the `NEURAL` table and the Arabic
  branch.
* Each bypassing entry wraps its synchronous render in `withHost`; `riderNeural`/`persianNeural` swap
  `getPhonemizer(lang).text(x)` for `renderInHost(lang, x)`.

---

## Run 5 — 2026-08-14 — after the change: the differential again

**Command.** `npx tsx tools/eval/async-sync-differential.ts`, plus the Run 3 foreign-run probe.

**Raw finding.** 153 disagreements → **92**, and every remaining one is the neural upgrade rather than a
bypass. Per language, before → after:

| lang | before | after | what the residual is |
| --- | --- | --- | --- |
| en | 6 | 1 | the BiLSTM reads the OOV `km` as *kʰˈeᶦəm*, sync's lexicon as *ˈʊkm* |
| sd | 7 | 0 | — |
| af | 8 | 0 | — |
| bn | 8 | 0 | — |
| da | 7 | 0 | — |
| nb | 7 | 0 | — |
| fr | 7 | 0 | — |
| fa | 7 | 2 | vowel restoration (*daɾd͡ʒˈe* → *daɾad͡ʒejˈe*); and async now reads a `²` sync drops |
| he | 8 | 8 | vowel restoration only — *ʃnt … svf* vs *ʃnat … sof*; the payload is identical in all 8 |
| km | 8 | 1 | the BiLSTM re-segments *ʔɑŋsaː seː* to *ʔɑŋsaːseː* |
| ar arz apc ajp apd acm afb acw ary ayl | 8 each | 8 each | vowel restoration only (*sn … nhˈaːj* vs *sˈana … nihˈaːja*) |
| ur ps pnb | 0 | 0 | — (already correct before) |

The payload now survives on both sides everywhere. The abjad rows illustrate the difference:

```
BEFORE  ar  سنة ¾ نهاية   sn θalaːθa ʕˈalaː ʔarbaʕa nhˈaːj  |  sˈana nihˈaːja            (DROPPED)
AFTER   ar  سنة ¾ نهاية   sn θalaːθa ʕˈalaː ʔarbaʕa nhˈaːj  |  sˈana θalaːθa ʕˈalaː ʔarbaʕa nihˈaːja
```

The Run 3 foreign-run probe closes completely: every code now reads `Владимир`, and for the nine
non-abjad codes the two entries agree byte-for-byte on it.

**Implication.** The class is closed. Ship, then measure on real text rather than probes.

---

## Run 6 — 2026-08-14 — real text: an ASYNC corpus differential, baseline vs this tree

**Question.** The probes are constructed. On the committed mined artifacts, what does `phonemizeAsync`
actually read differently, and is each difference a recovery or a regression?

**Command.** A baseline worktree pinned at the starting commit, a script emitting `phonemizeAsync` per
utterance in each tree, diffed by source text. (Not `corpus-diff.ts` — that tool phonemizes with the SYNC
entry, which is exactly the path this change must NOT move; it is run separately in Run 7.)

**Raw finding.**

| lang | utterances changed | what changed |
| --- | --- | --- |
| km | **83 / 448 (18.5%)** | `°C` was read as the bare letter C — *sˈiː*, English "see", the degree sign lost. Now *ʔɑŋsaːseː*, Khmer "degrees Celsius". |
| he | 22 / 373 | foreign runs that were DROPPED are now read: *ɑɾɑz ozbilis*, *itʰɛˈjoŋ*, *md͡ʒzr ħmˈaː* |
| nb | 7 / 147 | Roman numerals (Ludvig **XVI** → *sɛkstn*, Håkon **VII** → *ʃʉː*, Elisabeth **II** → *tuː*, previously the letters *ˈɑiː*/*ˈʋiːɪ*), a vulgar fraction, and a recovered Cyrillic run |
| sd | 5 / 98 | Roman numerals (Louis **XVI** → *sˈoːɾəhənə*, previously nothing at all) and `29¾`/`24½` → *ʈˈeː t͡ʃˈaːɾ* / *hˈɪkʊ ɓˈə* |
| da | 2 / 109 | a vulgar fraction and a Roman numeral (**III** → *ˈtʁeːˀ*, was *ˈiiːˀ*) |
| en | 2 / 140 | `29¾` → *θɹˈiː kwˈɔːɹt̬ɚz*, and a dropped Japanese run now read (*kˈimino̞ näꜜwä*) |
| ar | 1 / 82 | `29¾` → *θalaːθa ʕˈalaː ʔarbaʕa* |
| fa | 1 / 79 | `29¾` → *sˈeh t͡ʃahˈaːɾ* |
| af | 1 / 109 | `B&amp;B's` — the doubly-escaped entity now decodes, *biə ɛn bs* → *biə ɛn biəs* |
| bn | 0 / 95 | no utterance in the artifact carries a pre-pass payload |
| fr | 0 / 107 | " |
| **ur** | **0 / 77** | expected — it already routed through `getPhonemizer`; this is the check that swapping it to `renderInHost` changed nothing |

Every single difference is RECOVERED CONTENT — a number, a unit, a numeral or a foreign name that was
previously unspoken. Not one utterance lost anything. `ur`'s clean zero is the most informative row: it
is the control, and it confirms `renderInHost` renders identically to what `getPhonemizer(lang).text` did
for a caller that has already pre-passed.

**Implication.** The largest mover is Khmer at 18.5%, and it is a unit the language was simply not
reading. Nothing here needs a golden revised, because no golden covers async on these shapes — which is
itself the reason the defect survived this long, and the reason Run 8 adds the test.

---

## Run 7 — 2026-08-14 — the negative controls: did the SYNC path move at all?

**Question.** `registry.ts`'s shadow was refactored into `romanPass` + `foldPass` and the same helpers now
serve both entries. That refactor must be byte-neutral for `phonemize`. Is it?

**Commands.**
- `corpus-diff.ts emit`/`compare` (which phonemizes with the SYNC entry), baseline vs this tree, five
  languages: `sd bn af km fa`.
- `referee-eval.ts` for all 22 neural codes with a referee file, baseline vs this tree.

**Raw finding.**

```
sd  changed 0/98  (0.0%)      bn  changed 0/95  (0.0%)     af  changed 0/109 (0.0%)
km  changed 0/448 (0.0%)      fa  changed 0/79  (0.0%)
```

All five leak summaries (DIGIT, SLOT-GAP, RAWMARK, ZERO-WIDTH, RAW-CAPS, DROP, THROW) are zero on both
sides, unchanged.

The referee evaluations are **byte-identical** before and after for all 22 codes — `diff` of the captured
`raw exact` / `folded backbone` / `symbol accuracy` lines is empty. That is the expected result rather
than a surprise, and worth stating as a negative: `referee-eval/eval.ts` maps each language to its
`phonemizeWord` (or, for the Arabic family, to `phonemizeArabic` with no `host`), so it evaluates single
WORDS through the language module directly and never touches the registry dispatch at all. The referee
harness therefore cannot see this change in either direction — a real limitation of it as a gate here,
not evidence of safety. `test/referee-eval.test.ts` (171 floors) passes.

For the record, the after-side numbers for the neural languages (primary referee, folded backbone):
en 36.2%, sd 77.5%, af 72.0%, bn 79.5%, da 65.2%, nb 47.4%, fr 93.2%, fa 27.4%, he 23.0%, km 27.7%,
ur 79.4%, ps 91.3%, ar 71.3%, arz 88.9%, apc 88.4%, ajp 65.8%, apd 49.4%, acm 56.8%, afb 59.4%,
acw 42.5%, ary 47.0%, ayl 46.9% — each identical to the baseline run.

**Implication.** The sync path is untouched, and the referee harness is the wrong instrument for this
particular change. The async corpus differential in Run 6 is the one that carries the evidence.

---

## Run 8 — 2026-08-14 — the drift guard, and the gates

**Question.** What stops the eleventh copy?

**Raw finding / what was added.** `test/phonemizeAsync.test.ts` gains five tests. The load-bearing one is
stated as an invariant that holds for EVERY async language including the abjads: for each pre-pass probe,
`phonemizeAsync(frame-with-payload)` must differ from `phonemizeAsync(frame-with-payload-deleted)`. That
catches a silent drop without pinning a reading, so it cannot be defeated by a language whose async
output legitimately differs from its sync output. Alongside it: exact sync/async equality on all six
probes for the nine codes where that holds, markup-not-spoken, foreign-run-keeps-its-host, the
double-application case (`&amp;lt;i&amp;gt;` — an author writing about a tag), and a pin that `te`'s
digit-fold opt-out still resolves through the sync path.

**Gates.**

* `npx tsc --noEmit` — clean.
* `npx vitest run` — **242 files, 4099 passed, 5 skipped, 0 failed.** No golden's expected value changed
  anywhere in the suite.
  An earlier run of the same tree reported 3 failures and all three were TIMEOUTS under concurrent load
  rather than assertion failures — `test/onnx-optional.test.ts` at its 5s cap and `test/referee-eval.test.ts`'s
  `ar`/`ary` at 30s. Worth recording as a negative because it wasted a cycle: `onnx-optional` was
  reproduced timing out on the BASELINE worktree too, which is what identified it as pre-existing and
  load-driven rather than a regression. Both pass on a settled machine.
* `test/phonemizeAsync.test.ts` — 40 passed, including the 5 new ones.
* The differential, referee and corpus runs above.

**Implication.** Done. The one thing a future reader should know: `withHost` is typed to take a
SYNCHRONOUS callback deliberately. If a later change makes an async entry want to hold the host across an
`await`, the type will refuse it, and that refusal is the point — `core/foreign.ts`'s stack is not
async-safe and making it so is a separate piece of work.
