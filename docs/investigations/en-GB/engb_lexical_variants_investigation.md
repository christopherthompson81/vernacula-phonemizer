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

## Run 6 — 2026-09-20 16:20 — review of #1385: four findings, and the inflection one is a blocker

Reviewed by the session that owns the GenAm side. Four findings, all confirmed by re-measurement, and
two of them are defects that would have bitten after merge.

### ⚠ THREE CITATIONS DROPPED THE PARENT'S ASPIRATION

The rows replace the citation WHOLESALE, so every allophonic detail the parent emits has to be written
into the row by hand — and three of them lost the aspiration diacritic:

    pasta       en-GB pˈæstə        against  passive  pʰˈæsɪv
    tomato      en-GB təmˈɑːtəᶷ     against  potato   pətʰˈeᶦtʰəᶷ
    lieutenant  en-GB lɛftˈɛnənt    against  tenant   tʰˈɛnənt

So en-GB shipped an unaspirated /p/ in `pasta` and an unaspirated /t/ in `tomato` and `lieutenant` while
every comparable word aspirates. This is Run 5's own lesson — *store in the parent's alphabet so the
delta still runs over it* — one level down, at the diacritic instead of the vowel. Now `pʰˈæstə`,
`təmˈɑːtʰəᶷ`, `lɛftʰˈɛnənt`.

### ⚠ THE `tomato` PALM ROW WAS A HAND EDIT IN A GENERATED FILE THAT THE GENERATOR WOULD DELETE

`build-en-gb-sets.ts` rewrites `en-gb-palm.tsv` wholesale, and Run 5's own new guard —
`if (owned.has(w)) continue;` — skips every word the lexical table owns, `tomato` included. The
regenerated file contains **zero** `tomato` rows, so the next regeneration would silently regress the
word to `təmˈɒtəᶷ` and break its test. The PR's design note ("a word needing a set membership joins that
set as usual") describes a route the guard closes for exactly these words.

⚠ **AND IT WAS NEVER CLAIMABLE ANYWAY**, which is the deeper point: the builder claims from the
RULES-ONLY output, where `tomato` has no `ɑː` to preserve, so the palm edit never matched. It was always
a hand-added row in a generated file; the guard only made that permanent.

**The fix is not a palm exemption — it is to take the override out of the lexical-SET layer entirely.**
A word the table owns now skips the LOT rule and the whole BATH/CLOTH/yod/LOTR/marry block. The citation
was written with the SSBE target in mind, so a set edit derived for a DIFFERENT word has no business
running over it. The accent's PHONOLOGICAL rules still do — non-rhoticity, GOAT, NURSE/lettER,
un-flapping — which is why `tomato` is `təmˈɑːtʰəᶷ` and not `…oᶷ`.

Blast radius checked: `tomato` is the only row with a bare `ɑː` (`clerk`/`derby` are `ɑːɹ`, which the LOT
rule already skips), and none of the eleven lemmas is in any set. One word moves, and it is the one that
needed it. `en-gb-palm.tsv` goes back to being purely generated.

### ⚠ THE OVERRIDE WAS KEYED ON THE SURFACE WORD, SO ONE SENTENCE SAID BOTH READINGS

    clerk   klˈɑːk      clerks     klˈɜːks
    herb    hˈɜːb       herbs      ˈɜːbz        ← the /h/ appears and disappears
    lever   lˈiːvə      levers     lˈɛvəz
    tomato  təmˈɑːtəᶷ   tomatoes   təmˈeᶦtəᶷz

Before the table both were wrong and CONSISTENT. The table made one right and left the other wrong in
the same utterance, which is more audible for the plural-heavy members than the defect it fixed. **A
change that introduces an inconsistency that did not previously exist does not merge on the promise of a
follow-up.** The table now owns lemmas and their regular inflections — 11 lemmas, 13 inflections.

⚠ **AND THE DISCIPLINE CANNOT BE "REFEREE-ATTESTED" HERE.** The referee has rows for **two** of them
(`clerks klɑːks`, `figures fɪɡəz`); taking only those would leave the table lumpy with most of the
inconsistency intact. So an inflected row's citation is **the lemma's citation plus the suffix the PARENT
itself produced**, which makes the suffix's voicing the parent's rather than an opinion — `clerks` takes
its /s/ from `klˈɝks`, `levers` its /z/ from `lˈɛvɚz`, `herbs` its /z/ from `ˈɝbz`. Both attested rows
AGREE with the entailment, which is the evidence the entailment is sound; they are a check, not the
source. The PROVENANCE file marks every row attested or entailed so the two are never confused later.

⚠ **THE PREFIX TEST HAD TO IGNORE FLAPPING AND ASPIRATION**, and finding that out is what made
`tomatoes` land. The parent aspirates the singular's /t/ (`təmˈeᶦtʰoᶷ`) and FLAPS the plural's
(`təmˈeᶦt̬oᶷz`) — the same phoneme in two allophones — so a raw prefix test refuses the row. `toRP`
un-flaps as its first act, so neither is a difference for this table.

⚠ **FOUR FORMS ARE REFUSED RATHER THAN ENTAILED**, each for a stated reason, because the entailment is a
rule and not a licence: `buoying` (the parent is SELF-INCONSISTENT — `buoy` is `bˈuːi` but `buoying` is
`bˈɔᶦɪŋ` — and it already produces the British reading), `tomatos` (a CMUdict spelling variant whose
parent adds a secondary stress), and `derbies`/`levered` (no parent row at all; `derbies` decodes as
`dˈɝbiʲiz`, a doubled vowel the entailment would have propagated into the table). Dictionary membership
is the guard, and this is what it is for.

### A test that asserted a value against itself

`expect(phonemize("aluminium","en")).toBe(phonemize("aluminium","en"))` can never fail, so the test
titled "leaves the GenAm reading of the same spelling alone" pinned nothing about the GenAm reading. Now
asserts the literal `əlˈuːmɪnəm`.

    table        11 lemmas + 13 inflections = 24 rows
    sets         en-gb-palm.tsv back to purely generated (−1 hand row)
    suite        6,117 tests, 319 files;  goldens 189 / 36,495 / 0 stale;  parity 189 byte-identical
    eval         en-GB unmoved at 52.0% folded backbone / 86.4% symbol, scored path `rules`

## Run 5 — 2026-09-21 — the US-contamination sweep (#1383, move 2)

#1383 names three moves. This is the second: *"a cheap pass that improves every en-GB measurement,
not just this table."*

⚠ **THE en-GB REFEREE HAD NO `excludeRows` AT ALL.** `en.jsonc` carries three non-rhotic rules for the
opposite problem (RP rows in a GenAm corpus); the UK config had nothing for US rows in a UK corpus.

    en-GB referee headwords                                      76,284
      EVERY reading rhotic — an r-coloured ɚ/ɝ, or a coda ɹ      1,441
      SOME reading rhotic beside a clean one                       3,779   ← KEPT

The all-variants criterion is the machinery's own: the scorer credits any variant, so a row with one
clean reading is still evidence. Only a row that cannot arbitrate at all is dropped.

⚠ **AND WE PASS 0 OF THE 1,441.** Not 3, not 1 — zero. They are guaranteed failures sitting in the
denominator, so removing them takes out false disagreements and costs no credit:

    folded backbone   40,363 / 76,284 (52.9%)  →  40,363 / 74,843 (53.9%)
    symbol accuracy   87.0%                    →  87.3%

**The numerator does not move**, which is the same signature the Moby non-rhotic rules produced on
`en` and is the whole evidence that this is a referee defect rather than a scoring gift.

### ⚠ THE NUCLEUS TEST TOOK SIX ATTEMPTS, AND REVIEW FOUND THE LAST TWO

    1. `[ɹ](?![vowel])`                     — counted `aaronite eəɹn̩aɪt` as a coda: `n̩` IS a nucleus
    2. + syllabic consonants                  — missed `dramatize d̠͡ɹ̠ɑ...`: a combining mark sits
                                                 between the /ɹ/ and its vowel
    3. strip ALL combining marks first        — broke case 1 again, because U+0329 is IN the range
                                                 stripped, so `ɹl̩` became `ɹl`
    4. skip other marks but NOT U+0329        — fixed 1 and 2, and I called it done
    5. — review —                             — 5 MORE ONSET SHAPES still dropped: a GLIDE in the cluster
                                                 (`ryukyuan ɹjuːkjuːən`, `yprois iːpɹwɑː`), a PARENTHESISED
                                                 optional segment (`oleksandrivka …ndɹ⁽ʲ⁾iʌ̯kɐ`), a GEMINATE
                                                 `ɹɹ` (`acrasial`), our own weak vowel `ᵻ`
                                                 (`prevenient pɹᵻviːniənt`), and five PRECOMPOSED vowels
                                                 — the corpus is NOT NFD and the exclusion runs on the raw
                                                 string while the scorer normalises (`petitgrain pətiɡɹã`)
    6. all of the above                       — 1,468 → 1,441, and STILL 0 passing

⚠ **AND THE CLAIM "VERIFIED AGAINST EIGHT FIXTURES IN BOTH DIRECTIONS" WAS TRUE OF MY SCRATCH SCRIPT
AND OF NOTHING IN THE REPO.** `test/referee-exclude-rows.test.ts` exists precisely because "`excludeRows`
DROPS EVIDENCE, so its semantics are pinned here", and it pinned only `en`'s five rules. A rule whose
first four drafts each dropped onsets shipped with no fixture at all. All thirteen are pinned there now,
in both directions, each naming the draft it caught.

That is the third time this session a nucleus test forgot that a syllabic consonant is one (#1403 has
the other two, in the engine and in its own guard). **Write the nucleus definition once and test it
against known-good rows as well as known-bad ones** — a detector verified only on positives will
happily take an onset with it.

### What this does NOT do

The eleven-row lexical-variant table is unchanged. `leisure` is now excluded from the referee rather
than contradicting it, which removes a false disagreement but does not attest the British reading —
`schedule` still has no row at all. That is move 1, and it now has a candidate: **espeak-ng's `en-gb`
voice is installed and independent of wikipron**, and it gives the readings the issue says cannot be
checked:

    schedule ʃˈɛdjuːl   leisure lˈɛʒə   oregano ˌɒɹɪɡˈɑːnəʊ   premier pɹˈɛmɪə
    laboratory lɐbˈɒɹətɹi

⚠ **THAT IS A POLICY CHANGE, NOT A DATA ADDITION**, and is deliberately not made here: the table's
PROVENANCE sets the bar at "attested by the wikipron UK referee", and admitting a second source is a
decision about the bar rather than about a row. Scoped, not taken.

## Run 6 — 2026-09-21 18:40

**Question: #1383's move 3 — the five rows deferred as "attested and genuinely different, but each
needs a second lexical-set membership or a stress decision to land". Which of them actually land?**

    for w in oregano premier process progress laboratory; do grep -P "^$w\t" \
        tools/referee-eval/referees/en-gb.wikipron-uk.tsv; done

| word | referee | ours (en-GB) | verdict |
|---|---|---|---|
| `process` | `pɹəsɛs` \| `pɹəʊsɛs` | `pɹˈɒsˌɛs` | **lands** |
| `progress` | `pɹəɡɹɛs` \| `pɹəʊɡɹɛs` | `pɹˈɒɡɹɛs` | **lands** |
| `premier` | `pɹɛmiə` \| `pɹɛmjə` \| … | `pɹɛmˈɪə` | NOT A MISS — see below |
| `oregano` | `ɒɹɪɡɑːnəʊ` | `ɔːɹˈɛɡənˌəᶷ` | blocked, and I now know why |
| `laboratory` | `ləbɒɹətəɹi` \| `ləbɒɹətɹi` | `lˈæbɹətʰəɹi` | blocked, same reason |

**Two of the five are the SAME defect and it is the cheapest one in the table's history.** British
/ˈprəʊsɛs/ against GenAm /ˈprɑːsɛs/ — LOT against GOAT. The citation is the parent's own row with one
vowel swapped, `ɑː` → `oᶷ`, and the accent's GOAT rule does the rest: `pɹˈoᶷsˌɛs` → `pɹˈəᶷsˌɛs`. No
stress decision, no set membership, nothing hand-invented. Six rows with the inflections; five of the
six are directly attested and the sixth (`progresses`) is entailed.

### ⚠ `progressed` AND `progressing` ARE A TRAP THE ENTAILMENT RULE WOULD HAVE WALKED INTO

CMUdict stresses the noun on the first syllable and the participles on the second — `progress
P R AA1 G R EH2 S` beside `progressed P R AH0 G R EH1 S T` — so both varieties already say
`pɹəɡɹˈɛst`. **The syllable this row's swap lives in does not exist in those forms.** Entailing them
from the lemma would have MANUFACTURED a difference rather than recorded one, which is the exact
mirror of the `buoying` refusal in Run 2. The referee has no row for either; that is the check
agreeing, not the reason.

### ⚠ AND `premier` WAS NEVER A MISS — THE REFEREE JUST SPELLS IT DIFFERENTLY

espeak-ng's en-gb voice reads it `pɹˈɛmɪə`, segment-for-segment ours. The referee writes `i` where we
write `ɪ`; that is NOTATION, and the "second lexical-set membership" the issue thought it needed was
a phantom. **A lexical row here would have frozen a reading that is already correct** — the thing the
PROVENANCE file warns about for `klˈɑːk`. One of the five deferred rows was not a defect at all.

### ⚠ `oregano` AND `laboratory` ARE BLOCKED BY THE TABLE'S OWN EXEMPTION, WHICH I DID NOT EXPECT

Both British readings need **ɒ** — `ɒɹɪɡɑːnəʊ`, `ləbɒɹətəɹi` — and `english-gb.ts:252` reads

    if (lexical === undefined && !(lex && lex.palm.has(w))) s = s.replace(/ɑː(?!ɹ)/gu, "ɒ");

so **a table-owned word is exempt from the LOT rule**, deliberately, since Run 4. The only way to get
the ɒ is to hand-write it into a citation the file documents as being in the parent's GenAm alphabet
— i.e. to re-implement the LOT rule inside the table, for two words, and freeze it there. And it
would not even suffice for `oregano`, whose `ɔːɹ` is NORTH and would not have been touched by LOT in
the first place. These two need a finer exemption (phonological rules yes, set rules no, with LOT on
the phonological side) and that is a design change, not a row. **Left out, with the reason now
specific rather than "needs a decision".**

Result: 24 rows → 30. `npm test`, goldens and C# parity below.

## Run 7 — 2026-09-21 19:20

**Question: review on #1405 — does the `progress` row survive contact with the parent's POS tagger?**

    npx tsx … 'we progress quickly'  →  en: pɹəɡɹˈɛs   en-GB: pɹˈəᶷɡɹɛs

**No. It was clobbering the verb.** `progress` is the FIRST word this table has taken that the parent
resolves by part of speech, and `toRP` does `lex?.lexical.get(w)` — an unconditional, POS-blind
replacement of whatever the parent produced. So the noun's citation went into the verb frame and en-GB
said `pɹˈəᶷɡɹɛs`, **which is not RP, not GenAm, and not any speaker.** RP reads the verb
/prəˈɡrɛs/, same as GenAm.

⚠ **THIS IS THE EXACT FAILURE THE PR'S OWN TEXT REFUSES `progressed`/`progressing` FOR**, and the same
class as the `clerk`/`clerks` rationale the table was built on — arriving through the lemma instead of
the inflection. Both new tests missed it because both call the BARE word, which resolves to `default`.

### The fix is a guard field, not a deletion

A row may now carry an optional THIRD field: the GenAm reading it is allowed to replace. It applies only
when the parent produced that reading. 28 rows have one reading and stay unconditional; `progress` names
`pɹˈɑːɡɹɛs` and passes the verb straight through. Deferring the row would also have been clean, but the
guard is worth more than the row: **any of the other 28 could gain a second sense later**, and the field
makes that a data question instead of a silent regression.

### ⚠ AND THE SWEEP FOUND A SECOND ONE THE REVIEW DID NOT

    'she progresses well'  →  en: pɹəɡɹˈɛsᵻz   en-GB: pɹˈəᶷɡɹɛsᵻz

`english.ts:173-185` resolves a heteronym's regular `-s`/`-es` plural through the SAME entry, so
`progresses` had the identical defect ONE WORD AWAY from the one that was reported. Reading the fix off
the review's list would have shipped half of it. The test therefore sweeps `MANIFEST.heteronyms` against
every table row rather than asserting the two words by name, and it was proved by reverting: stripping
the guard fields fails it with `expected [ 'progress', 'progresses' ] to deeply equal []`.

## Run 8 — 2026-09-21 19:30

**Question: #1383's move 1 — a second UK source was approved. What does espeak-ng's en-gb voice
actually attest, and does `schedule` come with it?**

    espeak-ng -v en-gb -q --ipa "schedule leisure ballet oregano laboratory premier"
    → ʃˈɛdjuːl lˈɛʒə bˈaleɪ ˌɒɹɪɡˈɑːnəʊ lɐbˈɒɹətɹi pɹˈɛmɪə

All six read the way the class says they should. **But the binary's output is not the source** — it is
a G2P guess of exactly the kind this engine already makes, and a guess from another engine is not
evidence about a word. The line that matters is a PER-WORD HUMAN DECISION in `dictsource/`:

    grep -hP "^(leisure|ballet|oregano|laboratory|premier)\s" dictsource/en_list
    leisure    lEZ3        ballet    baleI        oregano  0rIg'A:noU
    laboratory la#b'0r@tri premier   prEmI3
    grep -n "sched" dictsource/en_rules  →  (nothing)

### ⚠ `schedule` IS NOT IN THE DICTIONARY AND IT IS STILL ATTESTED

I nearly refused it on the grep above. The rule block is where it lives:

    _) sch        S          // word-initial sch → /ʃ/
    ?3  sch (ed   sk         // ?3 = GENERAL AMERICAN

`?3` is espeak's variant-conditional marker. **Someone wrote down that the two varieties differ here
and that General American is the marked one** — while writing `school`, `scheme` and `schizoid` out of
the /ʃ/ rule and leaving `schedule` in. That is a decision about this word, in a British-based
dictionary, with the American case explicit. It clears the bar; the bare `espeak-ng` invocation would
not have.

### What the second source settles that the first could not

| word | primary (wikipron UK) | second source | outcome |
|---|---|---|---|
| `schedule` | **no row at all** | `?3 sch (ed → sk` | admitted |
| `leisure` | `liʒɚ` — the US-contaminated row #1383 names | `en_list lEZ3` | admitted |
| `ballet` | `baleɪ` \| `balɪ` — **no stress marks** | `en_list baleI`, first-syllable stress | admitted |

⚠ **AND THE PRIMARY SOURCE HAD `leisure` ALL ALONG, UNDER A DIFFERENT HEADWORD.** Its `leisurely` row
is `lɛʒɜli` — the DRESS vowel, attested, in the corpus that was supposed to be blocking this. The
lemma's row is contaminated and the derived form's is not. Worth remembering as a search move: when a
headword's only reading looks like contamination, **the paradigm may not be contaminated.**

⚠ **AND THE SECOND SOURCE IS WRONG ABOUT INFLECTIONS.** espeak reads `ballets` as `bˈaleɪs`, with a
voiceless /s/. Its inflections are rule-derived, so the entailment rule — the lemma's citation plus the
PARENT's own suffix — stays the authority, and the new source is admitted for LEMMAS only. That is
written into the PROVENANCE bar rather than left as a habit.

### Two things the entailment had to carry for `schedule`

CMUdict's own paradigm is inconsistent: `UW2` in the lemma, `UH0` in all three inflections. Propagating
that would have shipped `ʃˈɛdjuːl` beside `ʃˈɛdjʊld` in one sentence, so the citations take the LEMMA's
stem vowel — the parent's inconsistency about its own word is not a British/American difference. And
`scheduling` keeps a PLAIN /l/ where the other three have dark `ɫ`, because the parent lightens a
prevocalic lateral. **The prefix test cannot see that**, the same way it cannot see flapping, so it is
run over the darkness-folded strings for that one pair.

Result: 30 rows → 38. `oregano`/`laboratory` stay blocked by the LOT exemption from Run 6 — the sources
corroborate them exactly; the blocker was never evidence.
