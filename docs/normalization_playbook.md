# Text-normalization playbook (#562)

How to give one language the normalization treatment. Distilled from the first thirteen — en, fr, es, hi,
cmn, bn, ar, pt, ru, ur, id, de, ja — each of which was done by hand and each of which taught something the
next one reused.

**The layer's job.** A pre-tokenizer pass, `src/languages/<lang>/normalize.ts`, that rewrites everything
which is not already a pronounceable word into words the existing pipeline speaks. Pure text→text, no IPA.
It runs inside the engine's `text()`, before tokenization.

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

**2. Build the baseline from a pinned read-only worktree instead.** Once, for the whole fan-out:

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

**3. One language, one commit, and touch only that language.** The only shared files are `src/core/*` and
`registry.ts`. If your language genuinely needs a change there, **stop and report it rather than editing** —
a core change affects all 191 languages and must not land as a side effect of one language's rules.

**Progress is derived from git, not from a status file.** A language is done when
`src/languages/<dir>/normalize.ts` exists in a commit. There is no queue file to corrupt or to fall out of
sync, and a halted session resumes by listing what is already committed:

```sh
ls src/languages/*/normalize.ts
```
