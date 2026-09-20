# en-GB lexical variants — the layer the accent delta could not have

en-GB is not a language here, it is `en` plus a documented accent delta: six tables (BATH, CLOTH,
yod, PALM, LOTR, marry) and a set of phonological rules over the GenAm dictionary's output. That
design is right for accent differences and structurally cannot express a difference of WORD.

Reported from downstream: a TTS reader on a British voice rendered `aluminium` as `əljˈuːmɪnəm`
and an ASR readback heard "Tell you madam". The GenAm reading it starts from is not the defect —
CMUdict's own row is `aluminium AH0 L UW1 M IH0 N AH0 M`, a GenAm reference deliberately reading
the British spelling as the American word, which is correct for `en` and is what `en` ships. The
defect is that en-GB inherited it with nowhere to say otherwise.

## Run 1 — 2026-09-20 — is the referee on the reporter's side?

```
grep -P "^aluminium\t" tools/referee-eval/referees/en-gb.wikipron-uk.tsv
aluminium   æljʊmɪniəm   æljʊmɪnjəm   ælʊmɪniəm   ælʊmɪnjəm
```

Four attested variants, none of them ours. And the word is in `en-gb-yod.tsv` — an ACCENT set —
which is the shape of the bug in miniature: the set builder's coronal-yod probe saw `luː` with no
yod where the referee attests one, and filed a lexical variant under yod-retention. A yod cannot
add the syllable RP has, so the membership was inert; worse, it read as though the word had been
accounted for.

## Run 2 — 2026-09-20 — a detector that was wrong twice, kept because of what it found instead

Hypothesis: an accent delta never changes syllable count, so counting nuclei on both sides should
isolate the lexical class. Collapse the written-as-two diphthongs on both sides, count, flag a word
when no attested variant agrees. Over all 76,284 referee rows:

```
words scanned: 76284   syllable-count mismatches: 10238
by delta: 1:9590  2:567  3:62  4:13  5:5  6:1
```

**Wrong in both directions.** It missed `aluminium` outright, because `æljʊmɪnjəm` is a compressed
four-syllable variant and our four-syllable reading agrees with its COUNT while sharing almost none
of its vowels. And the 10,238 it did flag are overwhelmingly not this class at all:

```
6  parachronisms   ours=pʰˈɑːɹeᶦsˌiːˌeᶦt͡ʃɹˌəᶷniˌɛsˌɛmˌɛs   ref=pɚækɹənɪzmz
5  dwp             ours=dwp                                  ref=diːdʌbəljuːpiː
4  bdsm            ours=bdzm                                 ref=biːdiːɛsɛm
3  fyi             ours=fˌɔːjˌɔːɹˌɪnfəmˈeᶦʃən                ref=ɛfwaɪaɪ
```

Two separate **parent** (`en`) defects, neither British: initialisms that should be spelled out
letter by letter and are instead read as a word (`dwp`, `bdsm`, `blt`), and the reverse — words
where something in the OOV path spells out interior letters that are not an initialism at all
(`parachronisms`, `treacher`, `flymph`). Recorded here because they were found here; they are `en`
work items and not this one. Detector abandoned.

## Run 3 — 2026-09-20 — asking the referee about candidates instead, which separates two classes

Dropped the search-the-whole-corpus approach for the one that fits a hand-curated class: take the
known US/UK splits, run the shipped en-GB render, and ask whether the eval's own fold matches any
attested variant.

```
  MISS aluminium     ours=əljˈuːmɪnəm      ref=æljʊmɪniəm / æljʊmɪnjəm / …
  MISS lieutenant    ours=luːtʰˈɛnənt      ref=ləftɛnənt / lɛftɛnənt
  MISS tomato        ours=təmˈeᶦtʰəᶷ       ref=təmɑːtəʊ
  MISS clerk         ours=klˈɜːk           ref=klɑːk
  MISS derby         ours=dˈɜːbi           ref=dɑːbi
  MISS vitamin       ours=vˈaᶦtəmən        ref=vɪtəmɪn
  MISS herb          ours=ˈɜːb             ref=hɜːb / hɜːɹb
  MISS lever         ours=lˈɛvə            ref=liːvə
  MISS figure        ours=fˈɪɡjə           ref=fɪɡə
  MISS buoy          ours=bˈuːi            ref=bɔɪ
  MISS pasta         ours=pʰˈɒstə          ref=pæstə
  ok   advertisement / controversy / zebra / privacy / garage / niche / patent / speciality / route
```

**And a second batch found a different animal in the same trap:**

```
  MISS secretary     ours=sˈɛkɹətʰˌɛɹi     ref=sɛkɹətəɹi / sɛkɹətɹi
  MISS military      ours=mˈɪlətʰˌɛɹi      ref=mɪlɪtəɹi / mɪlɪtɹi
  MISS dictionary    ours=dˈɪkʃənˌɛɹi      ref=dɪkʃnəɹi / dɪkʃənəɹi / dɪkʃənɹi
  MISS ordinary      ours=ˈɔːdə̆nˌɛɹi      ref=ɔːdənɹi / ɔːdɪnəɹi
  MISS category      ours=kʰˈætəɡˌɔːɹi     ref=kætɪɡəɹi
  MISS cemetery      ours=sˈɛmətʰˌɛɹi      ref=sɛmətɹi / sɛmɪtɹi
  MISS monastery     ours=mˈɒnəstˌɛɹi      ref=mɒnəstɹi
```

**Finding: these are two classes and only one of them is a lexicon.** Seven of seven `-ary/-ery/-ory`
words miss identically — GenAm's secondary-stressed `ˌɛɹi` against British reduction to `əɹi`/`ɹi` —
and the family is productive, so it is a RULE this accent is missing, not a word list. Putting it in
a lexicon would be the same mistake the yod set made with `aluminium`, in the other direction.
**Left for its own change**, with its evidence recorded here.

Also excluded, and worth saying why, because "the referee disagrees with us" is not on its own a
reason to add a row:

- `apricot` (ours `ˈeᶦpɹəkʰˌɒt`, ref `eɪpɹɪkɒt`) — the difference is `ə` vs `ɪ` in an unstressed
  syllable, which is the parent's own weak-vowel question and a class this repo has already shown
  the reference is wrong about a third of the time.
- `schedule` — no referee row at all. The famous /ˈʃɛdjuːl/ has nothing here to check against, so it
  is not added on my say-so.
- `leisure` — its only row is `liʒɚ`, which is rhotic and therefore not a British reading; US
  contamination in the referee.
- `ballet` — the referee writes `a` where we write `æ` and carries no stress marks, so the apparent
  miss may be notation rather than reading. Not confident enough.

## Run 4 — 2026-09-20 — where the override goes, and one row that proved the choice

`en-gb-lexical.tsv`, `word → citation`, consulted at the top of `toRP` and REPLACING the parent's
output before any rule runs. Two design choices, both load-bearing:

**The value is in the parent's alphabet, not finished SSBE.** So the whole delta still runs over it.
`clerk` is stored `klˈɑːɹk` and START produces `klˈɑːk`; storing the finished form would freeze a
reading that then silently stopped tracking every later rule change.

**Shipped path only** (`lex` is absent on `phonemizeWordRules`), exactly like the five accent sets,
so the referee headline stays non-circular.

The first pass wrote `herb` as `hˈɜɹb` and it came out `hˈɜb` — no length mark — because `ɜ`+`ɹ` is
not what the parent writes for NURSE. `hˈɝb` gives `hˈɜːb`. The fold matched either way, which is
the argument for the rule still running over the row: a hand-written finished form would have
shipped the short vowel and nothing would have said so.

`tomato` needed the second choice as well. Stored `təmˈɑːtoᶷ`, it came back `təmˈɒtəᶷ` — the LOT
rule eating the /ɑː/ this table had just supplied. The fix is not an exception in the override, it
is a row in `en-gb-palm.tsv`, because in RP `tomato` genuinely IS a PALM word. A lexical variant
takes its lexical-set memberships like any other word.

Eleven rows, every one checked:

```
  ok  aluminium  ˌæljʊmˈɪniəm    ok  buoy   bˈɔᶦ       ok  clerk    klˈɑːk
  ok  derby      dˈɑːbi          ok  figure fˈɪɡə      ok  herb     hˈɜːb
  ok  lever      lˈiːvə          ok  lieutenant lɛftˈɛnənt        ok  pasta  pˈæstə
  ok  tomato     təmˈɑːtəᶷ       ok  vitamin vˈɪtəmɪn
```

`test/english-gb.test.ts` turned out to have named this class in its own header — "idiosyncratic
US/UK lexical vowel swaps (tomato→təˈmɑːtəʊ, pasta→ˈpæstə) — not a systematic set" — under DEFERRED.
True, and the wrong conclusion: they are not a SET because they are not an accent phenomenon at all.
Both words are now rows. The note is rewritten rather than deleted.

## Run 5 — 2026-09-20 — the builder guard, and a bigger thing behind it

`build-en-gb-sets.ts` now skips words the lexical table owns, so `aluminium` cannot be re-claimed
into yod. Running it to regenerate the sets was meant to be the proof:

```
  en-gb-bath.tsv: 673   en-gb-cloth.tsv: 694   en-gb-yod.tsv: 824
  en-gb-palm.tsv: 566   en-gb-lotr.tsv: 6
lexical-set words claimed 2763 of 76284
```

**And it rewrote hundreds of rows that have nothing to do with this change** — `abaht` and `ancho`
out of BATH, `agadir` and `ansible` in, and so on down all five files. The checked-in sets are no
longer what the current builder reproduces from the current referee: the dictionary underneath them
has moved (the English work of the last month is exactly the kind that would do it) and the sets
have not been rebuilt since.

**Not fixed here.** Regenerating them is a real change with a real referee evaluation attached, and
burying it inside a lexical-variant fix would make both unreviewable. Reverted to the checked-in
sets, and the two edits this change actually needs were made by hand:

```
 data/languages/english-gb/en-gb-palm.tsv | 1 +      (tomato)
 data/languages/english-gb/en-gb-yod.tsv  | 1 -      (aluminium)
```

The guard stays in the builder so that whoever does rebuild them gets the right answer.

## Open, in priority order — all filed

1. **#1380 — the `-ary/-ery/-ory` weak vowel.** A productive rule, re-verified at 8 of 9 on current
   `main`, the largest single win available to this accent.
2. **#1381 — the en-GB lexical sets no longer reproduce from their builder** (Run 5). Rebuild with a
   referee evaluation of the delta; `cloth` and `lotr` shrinking is the interesting part.
3. **#1382 — `en` reads initialisms as words and spells out words as initialisms** (Run 2). Two
   defects, both in the parent, neither British; `fyi` does both and suggests one shared decision
   point.
4. **#1383 — the lexical-variant class is open.** Eleven rows is where the referee's support ran
   out, not where the language does. The blocker is the source, not the curation: `schedule` has no
   referee row at all, and `leisure`'s only row is rhotic.

## Run 6 — 2026-09-20 — measured with the repo's own instruments, which is what should have happened first

Review question: the ad-hoc candidate probe in Runs 2-3 was hand-written and single-core, and this
repo already ships tested, parallel tools for exactly this. Correct. Re-measured with them.

**`npx tsx tools/referee-eval/eval.ts en-GB --jobs 14`** — the supported scorer, sharded across 14
child processes:

```
=== en-GB vs wikipron eng_latn_uk (human, narrow) [primary] (76284 words) ===
raw exact:      2/76284 (0.0%)
folded backbone:39700/76284 (52.0%)  — after the config folds
symbol accuracy:86.4%  — 1 − phone-error-rate
scored path:    rules  — the rules-only engine, DELIBERATELY
product delta:  110/300 compared rows read differently by phonemize() — NOT a defect count
```

**The headline does not move, and that is the contract rather than a disappointment.** The scored
path is `phonemizeWordRules`, which does not consult the lexical table any more than it consults
the five accent sets — a table whose rows were checked against the referee must not be able to
flatter a score measured against that referee. The eleven rows show up only in `product delta`,
the shipped-vs-rules gap, which the tool itself labels as not a defect count.

So the eval is the regression check here, not the success metric: it confirms the rules are
untouched. The success metric is the per-row referee agreement in Run 4, which is what the change
is actually claiming.

The residual classes the run prints are a useful cross-check on Run 3's triage, and they agree with
it — `lu ≠ lju` (lew), `nu ≠ nju` (knew), `nuk ≠ njuk` (neuk) are the yod set doing its job on the
shipped path and correctly absent from the rules path; `kɛɹəl ≠ kæɹəl` (carol), `ɛɹən ≠ æɹən`
(aaron) are the marry–merry set likewise. None of the top twelve is a lexical variant, which is
the evidence that eleven rows is roughly where this class's referee support ends.

**`npm run ci`** (typecheck + 6,097 tests + goldens + fence), full and green:

```
Test Files  318 passed (318)
     Tests  6097 passed | 5 skipped (6102)
goldens fresh: 189 languages, 36495 rows, 0 stale
```

⚠ `check-goldens` also takes `--jobs`, added in #1349, and this run did not pass it. It cost
nothing but wall-clock here; noted so the next one uses it.
