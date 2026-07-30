# Text-normalization playbook (#562)

How to give one language the normalization treatment. Distilled from the first thirteen — en, fr, es, hi,
cmn, bn, ar, pt, ru, ur, id, de, ja — each of which was done by hand and each of which taught something the
next one reused.

**The layer's job.** A pre-tokenizer pass, `src/languages/<lang>/normalize.ts`, that rewrites everything
which is not already a pronounceable word into words the existing pipeline speaks. Pure text→text, no IPA.
It runs inside the engine's `text()`, before tokenization.

**The one allowed exception to "pure text→text."** If a rewrite's output words must reach the word path
under different options than plain text would give them, the rule may be matched in the engine's `TOKEN`
and routed into an exported function — but **the rule itself still lives in `normalize.ts`**. Turkish is
the worked example: its number words need `phonemizeWord(w, /*finalStress*/ true)`, because the word path's
pre-accenting morphology mis-stresses exactly the `-Iz` cardinals (`sekiz`, `dokuz`, `otuz`), and emitting
them as plain text regressed ~60 corpus years in the 1900s. Take the exception only with that kind of
measured evidence, and document the coupling at the `TOKEN` definition.

**The premise this rests on.** Every language's orthographic conventions are its own. There is no shared
"normalize dates" function, because Japanese writes 3月14日, German writes `14. März`, and Urdu writes the
ordinal suffix ویں. What *is* shared is the procedure, the failure modes, and the verification. That is
what this document is; the rules themselves are bespoke every time.

---

## Procedure

### 1. Read the corpus before writing any rule

The corpora are FLEURS transcripts under `/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/<dir>/`.
**Column 3 (0-indexed 2) is the original cased text. Column 4 is lowercased and stripped of exactly the
punctuation this layer exists to read** — never judge normalization on column 4.

Tabulate what the corpus actually contains, and probe the *surface form it writes*, not the canonical form
you expect. Count instances of: grouped numbers, decimals, percent, currency, units, dates, times,
ordinals, ranges, abbreviations, initialisms, fractions, signs, and any script-specific mark.

### 2. Probe the current engine on those forms

Run each attested form through `phonemize(form, lang)` and record what actually comes out. Most of the work
is here: the defect list is what the engine produces, not what you assume it produces.

A defect is worth fixing in rough proportion to its corpus count. Report counts in the file header so the
next reader can see the evidence rather than trust the rule.

### 3. Check whether the defect is even in this layer

**In three of the thirteen languages the biggest defects were somewhere else entirely.** Bengali, Urdu and
Indonesian each had a missing `compound` 21–99 map, a `clausePunctuation` block that mapped every mark to a
*padded copy of itself*, or a `number()` that leaked ASCII digits. Writing a normalization rule on top of
any of those hides the real bug. Fix it where it lives.

### 4. Write the rules, ordered, with the ordering documented

`normalize.ts` is a numbered sequence of order-dependent steps. Ordering couplings that came up repeatedly:

- **digit de-grouping first** — a grouping comma or period is otherwise read as clause punctuation
- **units before decimals** — the shared symbol tier matches a unit only when a NUMBER is adjacent, and a
  decimal rewrite destroys that adjacency (this is why Japanese owns its unit table locally)
- **times before units** — `11:30` must not be claimed by a rule looking for a bare number
- **multi-dot abbreviations before single-dot** — else the interior dot survives as a phrase break
- **era markers before generic abbreviations**
- **romans before initialisms** — only for `en`/`fr`; see the registry seam below

State the coupling in a comment at each step. A future reader cannot recover it from the code.

### 5. Verify

Four gates, all of them, every time:

```sh
npx vitest run                      # full suite — catches cross-language regressions
npx tsc --noEmit
npx tsx tools/referee-eval/eval.ts <lang>     # compare against the pre-change run
npx tsx tools/normalization-corpus-diff.ts …  # see below
```

The corpus diff is the one that earns its keep. It caught, among others: an Arabic clock that added a
duplicate الساعة, a Russian clock that claimed a sports time `2:11,60`, an Indonesian clock that restarted
inside `1:09.02`, and a Japanese rule that corrupted twelve instances of 自分の. **None of those were
visible in unit probes.** Read the sampled changes; do not just check the counts.

### 5b. When a reading is genuinely ambiguous, ask the audio

Most normalization questions are settled by the corpus text. A few are not: where a form has several
interchangeable spoken readings (English `i.e.`, an acronym that may be spelled or said as a word, a range
that may take a connective), the transcript cannot tell you which one the speaker used — and for a TTS
target, *what the speaker used* is the thing that matters.

The audio is available and Vernacula ships Parakeet, so ask it:

```sh
# the wav name is column 2 of the FLEURS tsv; extract ONLY what you need (the archive is ~1.4 GB)
tar -xzf .../audio_cache/data/<lang>/audio/train.tar.gz train/<id>.wav
cd /mnt/data/Programming/vernacula/src/Vernacula.CLI
dotnet run -c Release -p:EP=Cpu -p:Platform=x64 --no-build -- \
    --audio <wav> --model /home/chris/.local/share/Parakeet/models --output <out>.txt --export-format txt
```

Parakeet emits normalized orthography, which is what makes it usable as an arbiter: it wrote `E.g.` where
the reader said the letter names and `For example` where they said the words. It is NOT a phonetic
transcription — it cannot distinguish reduced from full forms, and a dropped token may have been said
quickly rather than skipped, so prefer two independent readers over one.

**Expect the answer to sometimes be "neither".** Asked this of `i.e.`/`e.g.`, the result was three
different readings across four recordings, and `i.e.` omitted outright by both readers of its sentence —
so no rendering matched the audio and the choice was free.

That run also surfaced something that is NOT this repo's problem but is worth knowing while working here:
**a FLEURS transcript is the script the reader was given, not a record of what they said.** Every gate in
this playbook compares the engine against the transcript, so a perfectly correct rule can still pair IPA
with audio that never contained those phonemes. The measurement, and the divergence-audit follow-up, live
with the training scripts — `docs/omnivoice_ipa_corpus_investigation.md`, Run 31, in the `vernacula` repo.

### 5c. Sourcing language data from espeak, without making noise

Several runs have needed numeral spellings or unit words that no in-repo referee carries. espeak is the
usual fallback, with two rules:

**NEVER invoke the binary.** `espeak-ng` synthesises to the speakers by default; `-q` silences it, but the
files are better anyway. Read them:

```
/home/chris/Programming/espeak-ng-portable/data/<lang>/fragments.jsonl   # numerals, keyed "0".."99"
/home/chris/Programming/espeak-ng-portable/data/<lang>/dictionary.jsonl  # word entries
/home/chris/Programming/espeak-ng/dictsource/<lang>_list                 # the raw upstream form
```

The `espeak-ng-portable` JSONL is the better source: decimal keys instead of `_NN` grepping, and a
pre-tokenized `phonemeTokens` array, which is exactly what a skeleton match wants.

**espeak is PHONETIC and cannot hand you orthography**, so a spelling derived from it must be validated.
The method, from the Kannada and Nepali runs: derive the spelling, round-trip it through this repo's own
G2P, and check the result against espeak's mnemonic. Where a referee exists, match candidates against the
phoneme skeleton rather than trusting either alone.

**Measure the method before trusting it.** The Punjabi run built exactly this pipeline for the 39 numerals
its referee lacked, then validated it against the 36 the referee *does* carry: 19/36 exact, and **8 of 36
(22%) were espeak being wrong about the word**, not a spelling variant. It declined to ship the 39 on that
basis. Two by-products worth having: espeak's Punjabi 61–68 coda is refuted by its own 59/60 entries, and
a hand-rolled phoneme segmenter had a silent bug that `phonemeTokens` removed.

A validated refusal is a result. Record the rate and the failure taxonomy so nobody repeats the attempt.

### 6. Commit — one language, one commit

The commit message carries the evidence: the counts, what the defect produced before, and why the rule is
shaped the way it is.

---

## The traps, in order of how often they bit

**1. `\b` is ASCII-defined.** Six appearances, including in shared code. French matched *inside* `siècle`
at the accent; the Hindi, Bengali and Urdu rules matched nothing at all against their own scripts;
`core/initialisms.ts` was a total no-op for Cyrillic, so США came out `[sʂa]`. **Never use `\b` here.** Use
explicit lookarounds: `(?<![\p{L}\p{M}])` … `(?![\p{L}\p{M}])`.

**2. Loose patterns over-count.** Four appearances. Bengali `ম` matched inside মিটার (147 hits → ~31 real);
Arabic `م.` ×97 was a word-final letter plus a sentence period; Urdu `قم` ×5 was the start of قمری. Before
writing a rule from a count, print the surrounding context of the matches and read them.

**3. The corpus diff sees what probes cannot.** Three appearances, listed in step 5. Budget for reading it.

**4. Ambiguity is resolved by evidence, not intuition.** German's bare `N.` ordinal was excluded from the
first audit as undetectable. It became detectable by tabulating what surrounds it across 2,987 utterances:
`Jahrhundert` ×34 and month names ×66 *after*, `am` ×54 / `im` ×14 *before*, and **79 with nothing after —
the sentence-final periods that must not be claimed.** The rule fell out of the table. Do that instead of
guessing, and state the check that matters: *zero sentence-final pauses were lost.*

**5. Tests can pin the bug.** Several times a failing test was asserting the defective output. Correct the
test; do not preserve the behaviour.

---

## Two standing rules on data

**Letter-spelling vs lexical readings.** Known acronym pronunciation is a *lexical* fact; an unpronounceable
letter run is an *OOV* case. Keep the lists in the language's manifest, not as logic in code trying to guess
at lexical facts. `core/initialisms.ts` and `makeUnreadableTest` exist for this.

**Do not bulk-invent language data.** `tools/normalization-audit.ts` reports ~138 languages that drop the
percent sign and currency signs. Closing that means each language's actual word for "percent" and its
currency names. **A wrong percent word is worse than a dropped sign, because it is confidently wrong rather
than merely missing.** Add the tier when you have a source for that language. If you cannot source it, say
so in the commit and leave it.

---

## The registry seam

Languages **not** in `ROMAN_NATIVE` (`registry.ts`) get Roman numerals converted to digits before `text()`
runs, so the roman-vs-initialism ordering hazard cannot arise for them. Only `en` and `fr` resolve numerals
themselves and must sequence by hand. Check which side your language is on before writing a roman rule.

---

## Working concurrently (the fan-out)

Several agents may be treating different languages at once. Three rules make that safe:

**1. Never run `git stash`.** It is global. One agent's stash silently pockets every other agent's
uncommitted work. This is the single most dangerous operation in a shared checkout, and the hand recipe
used to depend on it for the "before" baseline.

**2. Emit the "before" baseline BEFORE you edit anything.** This is the simplest correct method and needs
no second checkout at all — your tree *is* the baseline until you touch it:

```sh
npx tsx tools/normalization-corpus-diff.ts emit --lang xx --corpus xx_yy --out /tmp/xx.before
# …now write normalize.ts…
npx tsx tools/normalization-corpus-diff.ts emit --lang xx --corpus xx_yy --out /tmp/xx.after
npx tsx tools/normalization-corpus-diff.ts compare --before /tmp/xx.before --after /tmp/xx.after
```

If you have already started editing and no baseline exists, recover one from a pinned read-only worktree:

```sh
git worktree add ../norm-baseline <commit> --detach
ln -s "$PWD/node_modules" ../norm-baseline/node_modules
```

Then emit "before" from that worktree and "after" from your own tree, and compare:

```sh
(cd ../norm-baseline && npx tsx tools/normalization-corpus-diff.ts emit --lang xx --corpus xx_yy --out /tmp/xx.before)
npx tsx tools/normalization-corpus-diff.ts emit --lang xx --corpus xx_yy --out /tmp/xx.after
npx tsx tools/normalization-corpus-diff.ts compare --before /tmp/xx.before --after /tmp/xx.after
```

**0. Confirm you are in the right repository before anything else.** In the first fan-out all four agents
were handed a worktree of a *different* project entirely — one with no `src/languages/`, no `tools/`, no
playbook. Three noticed and built their own worktree of this repo; one worked directly in the main
checkout. Check for `docs/normalization_playbook.md` and `src/languages/`; if they are absent, you are in
the wrong tree. Create your own:

```sh
git -C /path/to/vernacula-phonemizer worktree add <dir> -b norm-<lang>-562 main
ln -s /path/to/vernacula-phonemizer/node_modules <dir>/node_modules   # gitignored, so not in the worktree
```

**3. One language, one commit, and touch only that language.** The only shared files are `src/core/*` and
`registry.ts`. If your language genuinely needs a change there, **stop and report it rather than editing** —
a core change affects all 191 languages and must not land as a side effect of one language's rules.

**Progress is derived from git, not from a status file.** A language is done when
`src/languages/<dir>/normalize.ts` exists in a commit. There is no queue file to corrupt or to fall out of
sync, and a halted session resumes by listing what is already committed:

```sh
ls src/languages/*/normalize.ts
```

---

## When several languages write the same private code

Three Dravidian engines — Tamil, Telugu, Kannada — each carry their own number composer (101, 127 and 119
lines), written independently for overlapping reasons: the shared `indicNumberWords` cannot express a
fused 21–99, a suppletive round hundred (Kannada ಇನ್ನೂರು, not "two hundred"), or a combining magnitude
form (ನೂರಾ before a following ten). `NumbersDef.hundreds` exists for the first of those but only
`westernNumberWords` reads it.

**Not consolidated, deliberately.** There is no live defect: all three are correct today, and a shared
composer would have to satisfy three corpus diffs to prove it changed nothing. The right moment is when a
FOURTH language would otherwise become a fourth copy — Malayalam is the likely one, since it is Dravidian
and still on `indicNumberWords`. Consolidate then, with Malayalam's corpus as the gate, rather than
refactoring three working languages against no measurement.

The general rule this instantiates: **duplication is evidence, not yet a reason.** Wait for the consumer
that makes the shared thing testable.

---

## Migrating a local rule to a shared seam

When a capability is lifted into `core/`, the languages that already solved it privately should be
**migrated as an experiment, not left alone** — and the corpus decides, not taste. The gate is a
before/after diff over that language's whole corpus:

- **byte-identical** → keep the migration; the local rule was duplication
- **changed for the better** → keep it, and say so in the commit
- **changed for the worse, or the idiom cannot be expressed** → revert THAT language and record why

Run over ja, ko, th, vi, it, pl, nl for the rate (`km/h`) and exponent (`km²`) seams, the result was
5 migrated, 2 kept local, 1 not applicable — and two of the migrations fixed bugs:

| language | rate | exponent | evidence |
|---|---|---|---|
| it | **kept local** | migrated | `chilometri orari` / `al secondo` — an adjective and a contracted article, not "A per B" |
| nl | migrated | migrated | 0/1829 changed |
| pl | **kept local** | migrated | rate is `na` + ACCUSATIVE, has a bare numberless form, and needs `keepFinal` so its dot cannot eat a sentence period |
| vi | n/a | migrated | 0/1978 changed |
| ja | n/a | migrated | **fixed a bug**: the local rule matched only `²`, so `mm2` read the ASCII 2 as the number *ni* |
| ko | **kept local** | n/a | 시속 is a PREFIX and claims a whole range (`35-40 mph` → 시속 35-40 마일) |
| th | n/a | n/a | no rate or exponent handling exists |

Polish's exponent migration **fixed an agreement bug**: the local rule hardcoded the genitive plural, so
`864 mm2` read *milimetrów kwadratowych* where 864 takes the paucal *milimetry kwadratowe*.

Two things the experiment taught, both now in `core/normalizeSymbols.ts`:

1. **A rate denominator must not be matchable standalone.** Declaring `s` in `units` so `m/s` could
   compose also made a bare `76s` match, and the Dutch corpus's `Il-76s` (the aircraft) became
   *zesenzeventig seconde* — confidently wrong, which is worse than the raw letter it replaced. Hence
   `rateDenominators`.
2. **Position needs three values, not two.** `before` and `compound` are different: Russian wants a
   spaced agreeing adjective (*квадратных километров*), Swedish and Japanese fuse it into one word
   (*kvadratkilometer*, 平方キロメートル). Collapsing them produced *квадратныхкилометров*.

**A test that asserts on the language-local function will fail after migration, and that is correct** — it
is testing the wrong layer. Re-assert through `phonemize`, and note in the test that the behaviour moved.
