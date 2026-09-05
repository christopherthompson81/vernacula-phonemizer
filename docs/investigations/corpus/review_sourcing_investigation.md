# `review.ts` sourcing check — the local-table blind spot

Worktree `fix/review`. The defect: `review.ts --lang ug` reports
`[??] sourcing — no percent/currency/decimal word declared`, which is false. The Uyghur layer declares a
percent word, three currency words and an explicit decimal refusal — in a table it owns locally rather than
through `makeSymbolNormalizer({…})`, which is the only shape the check could read.

## Run 1 — 2026-08-11 (reproduce)

**Question.** Does the false report reproduce, and what exactly does the check look at?

```
$ npx tsx tools/normalization/review.ts --lang ug
  [ ok ] normalizer         src/languages/uyghur/normalize.ts
  …
  [ ?? ] sourcing           no percent/currency/decimal word declared
  [FAIL] artifact scan      DROP minus ×1  e.g. ياۋروپا ۋاقتى(-2ۋاقىت رايونى)
1 FAILING
```

Reproduced. The `21 %` probe on the same run prints `jiɡirmɛ bir pirsɛnt` — **the checklist prints the
percent word two screens above the line that says no percent word is declared.** That is the sharpest
statement of the bug: the reading is right there in the tool's own output.

The mechanism (`tools/normalization/review.ts`, `highTrafficWords`): every arm is anchored on a
declaration shape.

* `tier = …match(/makeSymbolNormalizer\(\{[\s\S]*?\n\}\)/)` — ug never calls it (`grep` finds the identifier
  only inside a comment explaining *why* it does not: trap 47 reason 3, the shared tier runs after this file
  and this file spends the decimal point).
* `manifestSymbols()` — gated on `/MANIFEST\.symbols/`; ug has no `.jsonc` in its language dir.
* `decimalWord`/`decimalConnector` — same, manifest only.
* `emitted` — the one code-reading arm, and it matches only
  `.replace( /…%…/ , <literal> )`. ug's percent runs through
  `new RegExp(…)` with a **function** replacement that calls a helper, so the pattern is not a literal regex
  and the word is not in the replacement.

So `needles` is empty, `declares` is false, and the check takes the `no … declared` branch — the branch that
means *there is nothing here to check*, when the truth is *the check cannot see what is here*.

**Implication.** This is not a ug quirk; it is a whole shape of layer. Survey the fleet before choosing a
fix, and the fix must distinguish "declares nothing" from "declares something I cannot read".

## Run 2 — 2026-08-11 (how big is it? the whole fleet, before)

**Question.** How many layers does this misreport — i.e. what is the fix worth?

```
$ xargs -a codes.txt -P8 -I{} npx tsx tools/normalization/review.ts --lang {}      # 188 registered codes
   79  no sourcing line at all   (no normalizer — the check exits at gate 1)
   69  [ ok ] all N attested
   35  [ ?? ] … in NO source …   (words found, some unattested — the line doing its job)
    5  [ ?? ] no percent/currency/decimal word declared      ← bm, my, ps, pbt, ug
```

Five codes, four layers (ps and pbt are the same layer). All five DO declare: `bm` kɛmɛsarada + dolar,
`my` ရာခိုင်နှုန်း, `ps` سلنه + ډالر, `ug` پىرسەنت + four currency names. So **five of the 109 codes with a
normalizer — every single one of the five that took the "nothing declared" branch — were false reports.**
The branch has no true positives in the tree at all today.

`grep` for the shape confirms the cause is one thing: `hu`, `km`, `my`, `fa`, `ps`, `ug` build their percent
pattern with `new RegExp(…)` rather than a literal `/…%…/`, which the old arm required. Three of those
(`hu`, `km`, `fa`) still reported `ok` because a manifest or tier arm found some OTHER word — so their local
percent word was never checked at all while the line said "all 1 high-traffic words attested". That is a
**partial false green**, and it is the more dangerous half of the same bug.

**Implication.** The fix has to read code, and reading code is brittle — so it needs a channel for "I saw a
rule and could not read its word", or a parse failure becomes a green line.

## Run 3 — 2026-08-11 (first extractor: too greedy, measured across the fleet)

**Question.** Does reading the whole `.replace()` call as one blob work?

`ug` went green (6 words, all attested) — and the fleet said no. Diffing the sourcing line of all 188 codes
before against after:

```
cy   +11 needles:  ll rh ch ff ng ph th cilometr milimetr centimetr yen
ha   +6            mita kilogram milimita santimita maki digiri
ff   +6            Awstraliya kilometre metre kilogram milimeta santimeta
ca   +2            graus as
ar acm acw afb ajp apc apd ary arz ayl … (15 Arabic codes), fr, hak, ab, am, gu
     → [ ok ] became [ ?? ] "could not read the word for: percent / currency"
```

Two distinct defects, both instructive:

1. **A sign inside a LOOKAROUND is a guard, not a rule.** Welsh's range rule ends in `(?![%\p{Sc}])` — "stop
   before a percentage or a price", i.e. the rule DECLINES the class — and reading the call as one blob made
   that look like a currency declaration. Its callback then contributed the unit table, and the one-hop
   identifier resolution followed a helper into the DIGRAPH list. Eleven invented needles for a rule that
   reads no symbol at all.
2. **A sign-to-sign fold is not a reading.** Every Arabic dialect starts with `s.replace(/٪/gu, "%")`,
   unifying the two percent signs before any rule runs. A percent rule whose replacement holds no word — so
   the blind channel fired, on fifteen dialects at once, for a line that was correct.

Both would have made the line noise, which is the same cost as the false report. Fixed by splitting the call
into PATTERN and REPLACEMENT (sign looked for in the first, word in the second), stripping lookarounds
before the sign test, and skipping any call whose replacement is a LITERAL with no letter in it — a fold or
a spend, never a word.

**Negative result worth keeping:** the first needle `ug` reported after the extractor could read local
tables was `gu — in NO source`. That is the FLAGS argument of `new RegExp(pattern, "gu")`, which sits inside
the very call being read. The `spelling → g2p` check has carried the same filter since it shipped; this one
now does too.

## Run 4 — 2026-08-12 (five more parse defects, each found by the fleet and not by reading)

Each round below is one full 188-code pass, diffed against Run 2's baseline. Every one of these was
invisible in the ug reproduction and visible only in the diff.

1. **The tier's own block, read twice.** With the local scan running over the whole layer, fourteen codes
   (af as az bn ceb it ms ne pt ro sd su xh zsm) changed verdict — not from local tables but because
   `makeSymbolNormalizer({ currency: {…} })` was being re-read in full, while the tier arm's own
   `currency:\s*\{([^}]*)\}` stops at the first `}` and misses every entry after a nested one. That is a
   REAL defect of the tier arm, and it is not this change: it belongs in its own commit with its own
   before/after. So the local scan now cuts the tier block out first, and the finding is recorded here.
2. **A `function` body needs no semicolon.** The one-hop resolver walked from a definition to the next
   depth-0 `;`, which for a `function` declaration is somewhere in the NEXT declaration. Azerbaijani's
   percent rule hops through `harmoniseSuffix()`, and the era table declared after it came back as
   unsourced percent vocabulary — `eramızdan əvvəl`, `bizim eradan`, plus the suffix `nc`. Fixed by ending a
   definition at the `}` that closes it; a `)` closing an arrow's parameter list does not end one.
3. **A pattern's lookarounds live INSIDE its template.** `new RegExp(\`…(?=\\s*$)\`)` — the anchor is inside
   a string literal, so the lookaround stripper (which skipped literals) never saw it, and Azerbaijani's
   abbreviation rule read as a currency rule.
4. **The apostrophe is not a quote.** Malagasy's percent rule is `.replace(/%\s*n['’]/gu, " isan-jaton'")`.
   The `'` in the CHARACTER CLASS opened a string that ran past the comma, the call could not be split, and
   mg silently went from four attested words to three. ⚠ A LOSS, not a false report — the direction that
   does not announce itself. Caught only by diffing needle COUNTS across the fleet, which is the argument
   for doing the survey before and after rather than after alone.
5. **Found-and-empty is not blind.** Yoruba emits its percent circumfix as `${SYM.percentBefore}` where
   `const SYM = MANIFEST.symbols` — the words are DATA, which the manifest arm already reads — and calls a
   tone-folding `fold()` whose body holds no word at all. Both marked the class unreadable, so the report
   said "could not read the word for percent" two lines under the same check printing that word. Blindness
   is now a name with NO definition in the file: an imported table, where the word is real and out of reach.

## Run 5 — 2026-08-12 (the fleet, after)

```
                    BEFORE                AFTER
no normalizer          79                   79      (the check exits at gate 1)
[ ok ]                 69                   64
[ ?? ] unattested      35                   45
[ ?? ] nothing declared 5                    0      ← the false report, gone
[ ?? ] could not read   —                    0      ← the new honest-unknown branch: latent, fires nowhere
needles checked       158                  178
```

**The five false reports are gone**, and four of the five now read as `ok`: `bm` (3 words), `my` (5), `ps`
(2), `ug` (6). The fifth, `pbt`, correctly becomes `[??] سلنه — in NO source`: it is Southern Pashto, served
by the same layer as `ps` but with its own haystack, and the word that `ps`'s corpus attests is not in
`pbt`'s. An honest unattested is the right answer there, not a green.

Nine codes move `ok` → `[??]` (as bn it ln ms ne ro sd zsm) and eleven more gain needles without changing
verdict (da en fa ff fr ht nb pt si xh za). All of these are words the check could not previously SEE —
local currency tables (`{ "$": "dolari", "¥": "yeni" }`, `R$` → *reais*, `£` → *pound*). Checked by hand
against the sources this run had: none of `dolare`, `pound`, `yeni`, `yen`, `reais`, `ڊالر` occurs in its
language's mined artifact or referee. ⚠ `FLEURS` was NOT mounted for these runs, so the corpus leg was
silent on both sides of the diff; a run with it may attest some of them. Either way the line now asks the
question, which is its job — `ms` is the one worth a look first, since its local table says `pound` where
the repo's own notes give the Malay word as *paun*.

**`[??]` that stays `[??]`, and correctly:** `ab` (Цельси, иградус — probed, absent from ab.wikipedia too),
`ff` (`dollar`, the Fula-`tere` family), `yo` (`onígun`), `hr` (`jen`), `sl` (`odstotek`), `uz` (`foizi`).
`cs` stays `ok` at 6 words. None of the ~49 `makeSymbolNormalizer` languages changed for tier reasons.

**The "nothing declared" branch now fires for no language in the tree** — every layer with a normalizer
declares at least one high-traffic word once local tables are readable. It is still correct and still
reachable (a date-and-script layer has nothing to source), so it is pinned by a fixture test rather than by
a language.

## Run 6 — 2026-08-12 (gates)

```
npx tsc --noEmit                     clean
npx vitest run                       238 files, 3650 passed, 5 skipped — including 21 new
review.ts --lang ug                  [ ok ] all 6 high-traffic words attested   (was [ ?? ] nothing declared)
review.ts --lang cs / sl             byte-identical before and after (makeSymbolNormalizer languages)
review.ts --lang ab / ff / yo        still [ ?? ], same words as before
```

⚠ The ug run still ends `1 FAILING` — `DROP minus ×1`, the UTC-offset dash argued in
`docs/investigations/ug/ug_normalization_investigation.md` Run 5. That is trap 24 and is not this change's business.

**Design note, recorded because it was reconsidered three times.** The obvious fix is to ask the layer at
RUNTIME what it emits — normalize `35%` and read the word out — which would be immune to every parse defect
in Run 4. It is not available: eleven layers export a FACTORY (`makeUyghurNormalizer({ numeralWords })`)
whose dependencies the engine supplies, so there is no generic way to construct one, and the only generic
runtime surface, `phonemize`, returns IPA while attestation is a question about ORTHOGRAPHY. Parsing is the
available option; the mitigation for its brittleness is the `unread` channel plus this survey, not
cleverness.
