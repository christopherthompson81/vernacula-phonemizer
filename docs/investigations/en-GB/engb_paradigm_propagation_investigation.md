# en-GB: propagating lexical-set membership across regular inflections (#1390)

`build-en-gb-sets.ts` decides membership one surface word at a time, so a lemma and its regular
inflections can land in different sets — and one sentence can then carry both vowels for one word.

    transit  tɹˈɑːnzᵻt        transits     tɹˈænzɪts
    transport tɹˈɑːnspɔːt     transports   tɹˈænspɔːts

This is the class #1385 treated as a BLOCKER for the hand-written lexical-variant table (`clerk`
right and `clerks` wrong in one utterance). The generated sets have it at ~30× the scale and predate
the table.

## Run 1 — 2026-09-22 — measure it from this side before changing anything

    npx tsx tools/referee-eval/engb-paradigm-audit.mts

      bath   members  680   inflections outside the set  233
      cloth  members  708   inflections outside the set  256
      yod    members  856   inflections outside the set  171
      palm   members  550   inflections outside the set   88
      lotr   members    5   inflections outside the set    3
    paradigm splits total 751

⚠ **751 AGAINST THE 732 THE ISSUE FILED**, and the difference is not a discrepancy to reconcile: that
number was measured on #1389's branch and the sets have moved since (the lexical-variant table grew from
11 rows to 49 across #1385/#1405/#1406, and every word it owns is excluded from claiming). The number to
carry forward is the one measured on this tree.

### ⚠ THE AUDIT WORKS BACKWARDS, FROM THE INFLECTION TO THE LEMMA, AND THAT IS NOT A STYLE CHOICE

Generating forms from a lemma has to reproduce e-drop, `y→ies` and consonant doubling, and gets them
wrong in both directions — it invents `transitses` and misses `running`. Stripping a suffix and asking
the DICTIONARY whether the result is a word lets the dictionary arbitrate: `bating` proposes `bat`,
`bate` and `bating`, only the ones the dict carries count, and a wrong proposal simply finds nothing.

### ⚠ AND `-er`/`-est` ARE DELIBERATELY NOT IN THE SUFFIX LIST

Agentive `-er` is DERIVATIONAL and may legitimately change the vowel, comparative `-er` is inflectional,
and **nothing in the spelling separates them**. Including them would have made `dance`/`dancer` a
paradigm obligation on the same footing as `dance`/`dances`. Left out, so the number is a floor rather
than a guess.

## Run 2 — 2026-09-22 — propagate, and find out the headline was measuring the wrong thing

Propagation implemented in `build-en-gb-sets.ts` as **a claim the referee can veto**: an inflection whose
lemma is in a set joins it, unless the referee attests what we already produce and does not attest the
edited form. Attesting BOTH is not a veto — the builder's stated policy prefers the RP-diagnostic
realisation whenever it is attested.

### ⚠ THE MEMBERSHIP COUNT OVER-REPORTS THE DEFECT, AND I NEARLY SHIPPED THE WRONG NUMBER

Looking at what the propagation *declined* is what caught it:

    NOT-LEMMA cloth  accost əkʰˈɔːst is not the lemma of accosted əkʰˈɒstᵻd
    NOT-LEMMA cloth  bog bˈɔːɡ is not the lemma of bogs bˈɒɡz

`bog` is CLOTH and `bogs` is not — a membership split. **The product is not split at all**: en-GB reads
`bˈɒɡ` and `bˈɒɡz`. CMUdict is inconsistent about its own word (`B AO1 G` against `B AA1 G Z`) and the
general LOT rule lands the inflection on `ɒ` with no membership needed. Same for `accost`/`accosted` and
`alcohol`/`alcohols`.

So the audit now measures the SHIPPED READING of both members, and membership is kept only as the thing
that motivated looking:

    membership splits 751   ⚠ PRODUCT splits 648

**103 of the 751 were phantom.** The issue's ~732 is the membership number; the defect is 648.

### ⚠ AND THE FIRST IMPLEMENTATION MADE THE PRODUCT WORSE ON EVERY WORD THE REFEREE COULD SEE

Of 607 propagated words, only **15** have a referee row at all — which is the issue's own point, and the
reason the claim loop could never reach them. On those 15:

    BEFORE: 8/15 HIT        AFTER: 0/15 HIT

**Eight HIT → MISS, nothing the other way.** All eight were yod — `alluded`, `alludes`, `alluding`,
`deluded`, `lues`, `plumes`, `stewed`, `suited` — and the cause was a hole I had built in by hand: yod's
claim is POSITIONAL, so I passed it no `edit` function, so `e === ours`, so the veto's
`!refFolded.includes(fold(e))` was never true and **yod could not be vetoed at all.** The referee attests
`əluːdɪd` and the propagation was inserting a glide into it.

Fixed by spelling out `YOD_EDIT` as the same replace the runtime applies (`english-gb.ts:293`), so the
veto tests what will actually ship. Vetoes 11 → 22, and:

    BEFORE: 0/7 HIT        AFTER: 0/7 HIT        (0 HIT→MISS, 0 MISS→HIT)

The seven that remain were MISS before and after, for reasons unrelated to membership. **The referee is
blind to this change on 592 of 599 words, and neutral on the other seven** — which is exactly what #1390
predicted ("it cannot be verified by the product delta alone"), now measured rather than assumed.

### The result

    PRODUCT splits   648  →  50      (−92%)
    memberships      +599  (22 vetoed, 134 where the proposed lemma is not the real one, 1 inert)
    bath 680→880   cloth 708→898   yod 856→1006   palm 550→607   lotr 5→7      0 removed

### The 50 that remain, classified rather than counted

- **22 the referee vetoed** — `mass`/`masses`, `math`/`maths`, `prance`/`prancing`, `halt`/`halted`,
  `yaw`/`yaws`. Working as designed: the referee attests the inflection with the un-shifted vowel. ⚠ In
  several of these it is the LEMMA's membership that looks doubtful, which is #1391's class showing
  through from the other side.
- **the parent's own prefix inconsistency** — `enhance ɪnhˈɑːns` against `enhanced ɛnhˈænst`,
  `enchanter`/`enchanters`, `endue`/`endued`. `ɪn-` against `ɛn-` in the parent, so the stem check
  declines.
- **not paradigms at all** — `balm`/`balmes`, `calm`/`calmes`, `andres`/`andress`, `hama`/`hamas`,
  `dues`/`duesing`. Surnames the suffix-stripper proposed; the guard declined them, which is the guard
  working.
- **genuine POS splits in the dictionary** — `alternate ˈɒɫtənət` (adj) against `alternated
  ˈɔːɫtənˌeᶦtᵻd` (verb), `correlate`, `choreograph`. Propagating would paper over a dictionary defect.
- **and a handful the guard rejects wrongly** — `sample sˈɑːmpɫ̩` against `sampling sˈæmplɪŋ`, where the
  syllabic `ɫ̩` folds to `əl` and the `-ing` form has dropped the schwa entirely, so the prefix test fails
  on a real paradigm. Recorded, not chased.

## Run 3 — 2026-09-22 — the golden found a bad membership on `main`, and propagation had spread it

Regenerating the en-GB golden reported **6 stale rows**, which is 3 distinct words twice over:

    castles   kʰˈæsəɫz  -> kʰˈɑːsəɫz     ✓ the defect, fixed
    passports pʰˈæspˌɔːts -> pʰˈɑːspˌɔːts ✓ the defect, fixed
    comets    kʰˈɒməts  -> kʰˈɑːməts     ⚠ WRONG, and not my word

`comet` in RP is /ˈkɒmɪt/ — LOT, not PALM. It is in `en-gb-palm.tsv` **on `main`** and ships as
`kʰˈɑːmət`, the American vowel; propagation then carried the error into `comets` and into the golden,
which is the only reason anyone saw it.

### ⚠ THE PALM GUARD WAS DEFEATED BY A WEAK VOWEL

The guard exists for exactly this (`froggy`, `socks`, #1383): PALM is the one edit that runs *away* from
RP, so the referee must NOT also attest what we already produce. The referee lists both rows —

    comet   kɑmət   kɒmɪt          ours (rules-only, folded)  kɒmət

— and `kɒmət` ≠ `kɒmɪt`. **They differ on the REDUCED VOWEL ALONE**, the guard saw no match, and PALM
claimed the word off the American row with the British row sitting beside it.

`ə`, `ɪ` and `ᵻ` are one slot for this comparison. That is the same equivalence `en-GB.jsonc`'s `ᵻ → ɪ`
fold already asserts, one symbol short. Fixed; the tightened guard removes **exactly one word**:

    diff committed palm vs rebuilt   < comet        (605 members, was 607 with propagation)
    comet  kʰˈɑːmət → kʰˈɒmət        comets kʰˈɒməts

⚠ **AND THIS IS THE STANDING HAZARD OF PROPAGATION, NOT AN ASIDE.** Propagation amplifies whatever the
claim loop got wrong: one bad lemma becomes a bad paradigm. That is an argument for the guards, not
against the change — and it is worth noting that the amplification is also what *surfaced* the error,
after it had shipped quietly on `main`.

### Final

    PRODUCT splits  648 → 50   (−92%)
    memberships     +598      (22 vetoed, 134 not-the-lemma, 1 inert, 0 removed by propagation)
                    bath 680→880  cloth 708→898  yod 856→1006  palm 550→605  lotr 5→7
    referee delta on the 7 propagated words it has rows for: 0 HIT→MISS, 0 MISS→HIT
    golden          2 rows, both the defect being fixed
    suite 6,155 · C# 189 byte-identical · sets reproduce from the builder

### `--jobs N`, because the builder used one core of sixteen

    serial       5m30
    --jobs 12    1m56      byte-identical output

⚠ **AND THE FIRST SHARDED VERSION WAS 7m19 BECAUSE THE PARENT ALSO RAN THE LOOP** — 27m of CPU for a job
whose shards are 32s each. It walked all 76,284 rows and *then* spawned twelve children to walk them
again. Every number it produced was correct, which is why it showed up as nothing but slowness.

## Run 4 — 2026-09-22 — gate the `--jobs` claim, and have the gate disprove one of my comments

A comment in the builder said test/engb-sets-shard.test.ts gated the byte-identical claim. **That test did
not exist** — the same "claimed but never shipped" defect a review caught on #1404 earlier today. Written
now, and affordable because `--limit N` slices the ROW LIST, which leaves the shard arithmetic
(`index % n`) untouched, so the property under test is the real one:

    --dump --limit 6000 --jobs 1   ==   --jobs 3      byte-identical, 49s
    --limit without --dump/--check                    refuses to write the shipped sets

⚠ **AND `--limit` NEARLY SHIPPED BROKEN.** The first version passed it to the parent and NOT to the child
processes, so `--jobs 2 --limit 4000` ran two FULL shards: 3m9 instead of 14s, full-size sets from 4,000
rows, and `0 vetoed` because only the parent's referee map was limited. The `python` replace that was
supposed to add it to the spawn args had silently not matched — **third time today an unasserted replace
has cost me**. Every replacement in this run now asserts both before and after.

### ⚠ AND THE GUARD DISPROVED A COMMENT I HAD JUST WRITTEN

Proving the guard by reverting the fix (the standing rule: a guard that passes after a fix has proved
nothing) — I deleted the pre-propagation `set.sort()`, which a comment claimed was what made `--jobs N`
agree with `--jobs 1`.

**The test still passed.** The claim was wrong: propagation is order-independent *within* a set (two
lemmas proposing the same inflection put it in the same place) and the order *across* sets is fixed in the
loop. What actually makes sharding safe is that each word appears in exactly one referee row, so a merge
cannot double-claim.

The sort stays — `--explain` output is read in order when adjudicating a veto — but the comment now says
what it is for. A comment a test contradicts is worse than no comment.

## Run 5 — 2026-09-22 — review round on #1409: nine findings, and two are the same bug twice

### ⚠ IMPORTING THE AUDIT HELPER CRASHED THE GENERATOR OF THE FILES IT READS

`engb-paradigm-audit.mts` read all five `en-gb-*.tsv` **at module scope**, and `build-en-gb-sets.ts`
imports `lemmaCandidates` from it. So merely importing the helper made the tool that *generates* those
files die with ENOENT on a tree where one of its own outputs is missing — directly contradicting the
invariant the builder documents four lines from its own `--check` ("AN ABSENT SET FILE IS LEGITIMATE …
so this must REPORT it, not die with an ENOENT trace"). The module-level map was also dead: every use
shadowed it. Reads moved inside the main block; verified by moving `en-gb-palm.tsv` aside and running.

### ⚠ THE PROPAGATION VETO NEVER GOT THE WEAK-VOWEL FIX THE CLAIM GUARD JUST RECEIVED

Run 3 fixed the PALM claim guard because `comet`'s British row `kɒmɪt` and our `kɒmət` differ on the
reduced vowel alone. **The propagation veto one page below still used exact match** — so the pass that
AMPLIFIES a bad membership was the one still vulnerable to the defect that motivated the whole fix.
Latent today (only `grandfathering` of the newly propagated PALM words has a referee row at all), which
is precisely why it would have sat there.

### ⚠ AND THE `-es` DUPLICATE WAS INFLATING EVERY DIAGNOSTIC I HAD BEEN READING

`lemmaCandidates("causes")` returned `caus`, `cause`, `cause` — the `-es` and `-s` rules overlap. The
audit `break`s on the first hit so it never noticed; the builder indexes EVERY candidate, so those words
were visited twice and counted twice. Deduped, and the numbers move exactly as predicted:

    memberships  +598  →  +598      (unchanged — `inSomeSet` had always caught the second visit)
    vetoed         22  →   19
    not-the-lemma 134  →  127

**The membership result was never wrong; the counters I had been quoting were.** A diagnostic that
over-counts in one class is the kind of thing that survives indefinitely because nothing depends on it.

### Four more, each real

- **`process.exit(0)` straight after `process.stdout.write`** — stdout is a PIPE for both the shard
  payload and `--dump`, so it is asynchronous and `exit` does not flush. Past what libuv hands the
  kernel in one go the tail is dropped and the parent fails in `JSON.parse`, on a payload that grows
  with the sets. Now `writeSync(1, …)`.
- **`buf += d.toString()` per chunk** decodes a code point straddling a read boundary as two halves.
  ASCII headwords today; `setEncoding("utf8")` now.
- **⚠ THE SHARD TEST WAS VACUOUS ON A ONE-CORE RUNNER.** `jobs` is clamped to the core count, so
  `--jobs 3` there is the serial path and the equivalence test compares serial against serial — green
  for exactly the bug it exists to catch. The builder now reports `[jobs] effective N` on stderr, the
  test asserts it really sharded, and skips below two cores.
- **⚠ AND THE WRITE-GUARD TEST'S FAILURE MODE WAS CLOBBERING FIVE COMMITTED FILES**, while `.toThrow()`
  accepted any non-zero exit — a typo in the path would have passed it. Now asserts the message and
  snapshots/restores the five sets. Proved by removing the guard: the test fails, and
  `check:en-gb-sets` still reports fresh afterwards, so the restore works.

### On the cost of the new test

Review flagged two 300s timeouts as a large fixed cost. Measured: **~19s of CPU and ~0 of wall clock** —
the suite's wall time is set by its longest file (`onset-r`, ~47s) and this runs beside it. The floor is
engine load plus the dict-wide inflection index, which `--limit` cannot reduce. Kept in the suite.
