# The -ary/-ery/-ory weak vowel (#1380)

GenAm carries a secondary-stressed full vowel in this suffix and SSBE does not. The suffix is
PRODUCTIVE, so this is a rule; a lexicon entry per word would be the `aluminium` mistake in the other
direction.

## Run 1 — 2026-09-20 20:00 — sizing the class before designing the rule

    referee headwords spelled -ary/-ery/-ory            774
      attest the REDUCED  əɹi                           662   (418 of them ONLY reduced)
      attest the SYNCOPE  ɹi                            284   ( 40 of them ONLY syncopated)
      attest a FULL vowel somewhere                      44

    our dictionary words spelled that way               703   (referee covers 388)
      already reduced  əɹi                              262
      ˌɛɹi  (secondary + DRESS)                         182
      ˌɔːɹi (secondary + THOUGHT)                       154
      ɛɹi / ɔːɹi, no mark                                50
      already syncopated                                  9

⚠ **THE PARENT IS NOT WRONG HERE, WHICH IS WHY THIS IS AN ACCENT RULE AND NOT A DICTIONARY FIX.** The
dictionary distinguishes `secretary` S EH1 K R AH0 T EH2 R IY0 from `accessory` AE0 K S EH1 S ER0 IY0,
and BOTH are right for GenAm — the first genuinely has the full vowel, the second genuinely reduces.
That is why 262 of the 703 already come out reduced. Nothing upstream needs changing.

⚠ **`-ory` IS THE OTHER HALF OF THE CLASS AND THE ISSUE UNDER-SHOWS IT.** Its GenAm vowel is THOUGHT,
not DRESS — `accusatory` is `əkjˈuːzətʰˌɔːɹi` — and it is 169 of the 386 affected words against the
issue's single `category` example. Measured separately, both halves are net-positive, so it comes too.

### The three decisions, and which of them the data could make

- **REDUCED `əɹi`, not the syncope.** 662 of 774 attest it against 284 for the syncope, and 418 attest
  ONLY the reduced form. Both are real SSBE — the referee lists `sɛkɹətəɹi` AND `sɛkɹətɹi` for 244
  words — so this is a register call, and the corpus supports the reduced one. The syncope would have
  been defensible on `en-gb-yod`'s "prefer the RP-diagnostic realisation whenever attested" policy; it
  is refused because it is attested for barely a third of the class.
- ⚠ **THE SECONDARY STRESS MARK IS DROPPED, AND NOTHING IN THIS REPO CAN VERIFY THAT.** The referee
  carries no stress marks and the eval's fold strips them. Taken on the phonology — a reduced vowel does
  not carry a secondary stress — and recorded as unverifiable rather than asserted as measured.
- **No exception table.** ~65 words resist whatever single target is chosen. A table would be another
  generated artifact to keep fresh, which is what #1381, #1385 and #1388 were all about.

## Run 2 — 2026-09-20 20:20 — ⚠ the first trigger deleted the tonic nucleus

    if (/(ary|ery|ory)$/u.test(w)) s = s.replace(/ˌ?(?:ɛ|ɔː)(ɹi)$/u, "ə$1");

`ˌ?` reads as "an optional secondary mark" and is not: **the PRIMARY mark sits before the vowel too**, so
the pattern matches `ˈɛɹi` with the group empty.

    canary    kənˈɛɹi        →  kənˈəɹi
    actuary   ˌækt͡ʃuːˈɛɹi   →  ˌækt͡ʃuːˈəɹi

Both had the suffix vowel as their TONIC, and the rule reduced it away. ⚠ The comment written directly
above it already said the trigger required a non-primary vowel — **prose stronger than the code, in the
same commit that wrote both.** Two passes now: one takes a secondary mark and drops it, the other takes
an unmarked vowel behind a lookbehind on either mark.

## Run 3 — the product delta

Over the 703 dictionary words spelled this way, against the referee under the eval's own fold:

    69 MISS → HIT        10 HIT → MISS
      -ary/-ery   +45 / −4
      -ory        +24 / −6

⚠ **NINE OF THE TEN REGRESSIONS ARE THE PREDICTED RESIDUE**, not a surprise: six `-ory` words the
referee gives a full THOUGHT vowel (`amatory` æmətɔːɹi, `minatory`, `nugatory`, `understory`,
`ejaculatory`, `reconciliatory`) and three keeping full `ɛɹi` (`necessary`, `presbytery`,
`confessionary`). The tenth, `quaternary`, misses on an unrelated vowel — our `ɒ` against the referee's
`ɔː` — and is not the suffix at all.

⚠ **`necessary` IS THE ISSUE'S OWN PREDICTION COMING TRUE.** It was the one word scored `ok` on `main`,
and the issue said so explicitly: "it is not a counterexample to the rule, it is a referee row that
admits both". It is now a miss, for exactly that reason.

⚠ And the bound from #1389 Run 5 applies here too: **the delta measures agreement with the referee, not
correctness.** Where the referee attests both realisations — 244 of the 774 — it cannot see this change
at all, so the +69/−10 is a floor on the effect and not a measure of it.

## Run 4 — 2026-09-20 20:50 — the rule moves the eval headline, and invalidates the lexical sets

⚠ **UNLIKE THE LEXICAL SETS, THIS RULE IS ON THE RULES PATH, SO THE EVAL CAN SEE IT.** #1381 and #1389
both had to argue from a product delta because the sets are shipped-path-only and `eval.ts` scores
`rules`. `toRP` is the rules path, so this one moves the honest headline:

    folded backbone  52.1% → 52.2%      symbol accuracy  86.4% → 86.5%

⚠ **AND IT INVALIDATED THE GENERATED SETS, WHICH IS #1388'S CHECK EARNING ITS KEEP ON ITS FIRST OUTING.**
`build-en-gb-sets.ts` probes `phonemizeWordRules`, so changing what that returns changes what can be
claimed: `npm run check:en-gb-sets` reported `bath +1, cloth +4` immediately. Without that check the
sets would have gone stale again the same day they were rebuilt — which is exactly the failure #1381
existed to fix.

Four of the five new claims are clean, each matching a referee reading exactly:

    corollary  kʰˈɒɹələɹi   coronary  kʰˈɒɹənəɹi   offertory  ˈɒfətʰəɹi   oratory  ˈɒɹətʰəɹi

### ⚠ AND THE FIFTH IS A SECOND-ORDER CASUALTY THAT BELONGS TO #1391

`amatory` ˈæmətʰəɹi → **ˈɑːmətʰəɹi**. Reducing its suffix made the rest of the word match, which made it
claimable into BATH — and the row it was claimed on is the referee's `ɑmətəɹi`: a **length-less `ɑ` in a
non-rhotic corpus**, i.e. an American transcription. RP is ˈæmətəɹi.

This rule did not cause it. It *exposed* it, and it is precisely the class filed as #1391 — the same
contamination the PALM guard now catches in #1389, which BATH cannot use because for BATH the RP form
genuinely is `ɑː`. Pinned as-is in `english-gb-ary.test.ts` so the regression is visible rather than
discovered later; when #1391 tightens BATH's claim test, that assertion failing is the signal it worked.

⚠ It is also a concrete instance of a hazard neither #1381 nor #1389 named: **a rules-path change
retargets the set builder**, so any future accent rule has to re-run the sets and read what moved. The
freshness check makes that automatic rather than remembered.

    goldens   6 rows, all the rule firing as intended (`military`, `sanctuary`, `secondary`,
              `contemporary`), each matching a referee reading
    sets      bath 679 → 680, cloth 694 → 698
    suite     6,133 tests;  parity 189 byte-identical;  regex corpus re-extracted

## Run 5 — 2026-09-20 21:40 — review of #1392: the rule stopped at the lemma

Five findings, all real. Two were the rule not being the thing the PR claimed it was.

### ⚠ A RULE SOLD ON BEING PRODUCTIVE THAT STOPPED AT THE LEMMA

Both guards were `$`-anchored, so every inflection escaped:

    ðə sˈɛkɹətʰəɹi ənd ðə sˈɛkɹətʰˌɛɹiz

— the singular reduced, the plural keeping the American full vowel, in one utterance. That is the
`clerk`/`clerks` split #1385 treated as a blocker and #1390 tracks for the sets, reintroduced by the fix
for a different instance of it. The dictionary alone holds 53 `-aries/-ories` rows with the full vowel.
Now `(ar|er|or)(y|ies)\W?s?$` against phones `(ɛ|ɔː)(ɹiz?)$`.

⚠ **AND THE CLITIC SURVIVED ONE ROUND LONGER.** `secretary's` reaches the rule with the apostrophe
intact and its phones already end `ɹiz`, so only the SPELLING guard was blocking it — the first fix for
the inflections still left the singular and its possessive disagreeing.

### ⚠ `-story` COMPOUNDS WERE FALSE POSITIVES, AND THEY ARE NOT THE DOCUMENTED RESIDUE

`understory` AH1 N D ER0 S T AO2 R IY0 → ˈʌndəstəɹi, `multistory`, and the OOV `backstory`. The spelling
cannot tell a weak suffix from a compound whose final element is the free noun `story`. Run 3 counted
`understory` among "the predicted residue", which was wrong in kind: the residue is a bounded list of
words the rule gets wrong, while this class reaches unseen coinages through the very productivity the
rule is sold on.

⚠ **EXCLUDING THE WHOLE `story$` SPELLING COSTS NOTHING**, which is what makes it a clean fix rather than
a patch: the only other members are `history`, `protohistory` and `celestory`, and the parent already
reduces all three, so the rule was never firing on them.

### The rule was not exempt for table-owned words, unlike every rule above it

`en-gb-lexical.tsv` exists precisely to hand-write forms the rules get wrong, and the first row spelled
this way would have been silently rewritten by the rule it was added to override. Latent — no such row
exists — and gated now.

### ⚠ THE BUILDER AND THE RUNTIME APPLY THIS ON OPPOSITE SIDES OF THE SETS

`build-en-gb-sets.ts` probes on top of `phonemizeWordRules`, i.e. AFTER the suffix rule; `toRP` applies
the sets BEFORE it. For a `marry` word spelled `-ary` the runtime's `ɛɹ → æɹ` would consume the suffix
first and block the reduction while the builder scored it reduced.

⚠ **REORDERING WAS MEASURED AND REFUSED.** `cloth` has EIGHT members spelled this way — `corollary`,
`coronary`, `offertory`, `oratory`, `glossary`, `orrery`, `flory`, `lory` — and its `ɔː → ɒ` is
first-occurrence, so moving the suffix rule ahead of the set block would change those real words to
remove a divergence that affects none. `marry` has zero. So the divergence is left and **guarded**: a
test asserts no `marry` member is spelled this way, and if one is ever added the ordering gets settled
then, on a word that exists.

### ⚠ AND THE PATTERN WAS INVISIBLE TO THE C# TRANSLATOR HARNESS

`tools/extract_regexes.mts` scrapes pattern literals out of `src/` for `regex-diff` to replay through
`JsRegex`, and its scraper **mangles any pattern containing a literal `'` inside a character class**. My
`['’]` made the count go 12 → 13 unparseable, and a dropped pattern is one the translator is never
tested against — the one thing that file's own header says must not happen.

⚠ **IT IS PRE-EXISTING AND NOT MINE**: hebrew, dutch, english, madurese and karakalpak are already in
that list for the same reason. Written as `\W?` instead, which matches the same text and scrapes
cleanly — 12 unparseable again, 2,371 → 2,372 patterns, and `story` now appears in the corpus.

### `amatory` stays deferred, and now with evidence

The obvious #1391 fix — reject a BATH claim supported only by a **length-less `ɑ`**, the discriminator
that works for PALM — was measured and does not work here: **60 of 680 BATH members** are claimed that
way, and they include `dramatize`, whose ONLY referee row is `d̠͡ɹ̠ɑmətaɪz` and which this codebase
explicitly cites as a correct BATH member. wikipron is simply inconsistent about length, so for BATH —
where the RP form genuinely IS `ɑː` — length carries no signal. Recorded on #1391.

    goldens   1 more row (`monasteries`);  sets unchanged;  eval 52.2% / 86.5%
    suite     6,135 tests;  parity 189 byte-identical;  regex corpus 12 unparseable (was 13)
