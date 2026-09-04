# The rate DENOMINATOR is still unread (#1255)

#1249 fixed the numerator: an unreadable rate now reads what it can and strands only the part with no word
behind it. This is about that stranded part. The reporter splits it three ways; the measurement says two of
the three are the same defect wearing different clothes, and that the "visible leak" the design assumes is
not visible in either of them.

## Run 1 — 2026-09-04 11:10 — the fleet, classified

```
npx tsx class55.mts      # phonemize("160 km/h") over all 193 registry codes
```

| outcome | count |
|---|---|
| rate read in full | 106 |
| **class 1** — numerator read, denominator left as raw Latin (`… kˈilomeːtrit h`) | 23 |
| **class 2** — neither part read, whole rate raw (`… km h`) | 24 |
| **class 3** — numerator read, denominator voiced as an ENGLISH LETTER NAME (`… ˈeᶦt͡ʃ`) | 36 |

Class 3 is every non-Latin-script host in the affected set and class 1 is every Latin-script one, which is
the same split #1249 measured for the numerator, one symbol to the right.

Class 2 is the 24 engines with LOCAL unit tables that the shared tier cannot reach — `ln`, `lt`, `ak`, `bm`,
`ht`, `mos`, `bal`, `ee`, `ki`, `lg`, `hmn`, `mn` and friends. They are already ledgered as
`ACCEPTED_DECLINE` in `test/rate-half-reading.test.ts` from #1249, each needing its own per-file edit. Not
this issue's machinery.

## Run 2 — 2026-09-04 11:20 — ⚠ class 1 is NOT "working as specified"

The issue files class 1 as the intended visible leak, "filing it only because a bare `h` in an IPA stream is
still literal Latin text". It is worse than that, and the reason is one line of IPA:

```
et  160 km/h  →  sˈɑdɑ kˈuːskymːend kˈilomeːtrit h
```

**`h` is a valid IPA symbol.** That trailing character is not an inert leak a reader spots — it is the
voiceless glottal fricative, and anything consuming this IPA renders it. Same for `s` → [s], and for the
other short denominators: `l`, `t`, `d`, `m`, `min`, `yr` are all IPA-legal sequences. So class 1 emits a
SPURIOUS PHONE and class 3 emits an English word; neither is a leak anyone can see, and both are wrong
readings rather than gaps.

⚠ AND NO GATE SEES EITHER. `isBareUnitKey`'s own header already records why: "In a Latin-script language that
leak is INVISIBLE to every existing gate — DIGIT hunts digits and RAWMARK hunts punctuation, while a Latin
run in a Latin-script language looks exactly like a word." In a non-Latin host the `h` does not even survive
to the output as `h`; it has already become *ˈeᶦt͡ʃ*. So the "stays where the leak gate can see it" premise
is false on both sides of the split.

## Run 3 — 2026-09-04 11:30 — the precedent, which this repo has already litigated twice

This is not a new question here. `test/bare-exponent.test.ts` carries a test whose name is the finding:

> **⚠ AN UNDECLARED LANGUAGE KEEPS THE DIGITS — the mark was NOT staying visible, it was being eaten.**
> "This test used to CERTIFY THE BUG … its comment claimed the mark 'stays where the RAWMARK leak gate can
> see it'. It does not: the mark survives the symbol tier and is then dropped by the language's own
> tokenizer … 169 of 193 registry codes read `10⁶` as *ten*."

And `normalizeSymbols.ts` states the ordering that resolved it, in the exponent branch:

> **Missing word ≥ wrong word ≫ INVENTED NUMBER.**

Applied here, the stranded denominator is a WRONG word in all 59 languages of classes 1 and 3 — an English
letter name in 36, a spurious phone in 23. Dropping it is a MISSING word. By the repo's own ordering the drop
is the better of the two, and the ordering is not mine: it is the line the exponent branch was written to.

⚠ WHAT IS ACTUALLY BEST IS NEITHER — it is declaring the denominator noun, which is per-language data with
its own attestation requirement (`cmn` reads `km/h` correctly and fails only on `/s`, so these are
per-DENOMINATOR gaps, not per-language ones). Dropping the wrong reading does not close that gap and must not
be allowed to hide it, which is what the ledger below is for.

## Run 4 — 2026-09-04 12:10 — the fix, and a fourth failure mode the first count had scored as success

The tier's unit pattern gains one optional non-capturing group after the rate/exponent alternation:
`(?:\s?/\s?[A-Za-z]{1,3}(?![\p{L}\p{M}\p{Nd}]))?`. It CONSUMES an unreadable short-ASCII denominator, and the
callback simply does not put it back. One to three ASCII letters, so `12.8 km/秒`, a Cyrillic `⟨/с⟩` and the
`120mg/100ml` ratio are all outside it; non-capturing, because the callback reads its groups positionally.

Re-classified over all 193 codes on `160 km/h`:

| | before | after |
|---|---|---|
| read in full | 106 | **160** |
| class 1 — raw Latin denominator | 23 | **0** |
| class 3 — English letter name | 36 | **5** |
| class 2 — whole rate raw (local-arm engines) | 24 | 24 |

The 5 remaining class-3 codes (`mr ps pbt ka ug`) read their numerator through a LOCAL arm, so the shared
pattern never matches and never covers the `/h`. Same population as class 2 and as #1249's `ACCEPTED_DECLINE`.

⚠ AND A WIDER SWEEP OVER THREE SHAPES FOUND A FOURTH CLASS THE FIRST INSTRUMENT HAD CALLED SUCCESS. Counting
"the rate produced a token the plain reading did not" as "the denominator was read" credits eleven pairs
where what was produced is the HOST'S OWN G2P reading the raw Latin letter as a native phone:

```
haw  160 m/s   →  … mika k       Hawaiian has no /s/, so ⟨s⟩ is read as [k]
ltg  160 km/h  →  … kʲilɔmʲætri x        pl likewise → x
cdo  160 km/h  →  … kuŋ˥˥ li˧˧ h˥˥       a TONED [h]
el   160 kg/h  →  … cila eits            pcm → et͡ʃ
```

That is the most insidious of the four, because nothing about the output looks like a leak. All eleven now
drop the symbol instead. (`READ IN FULL` therefore reads 232 → 221 on the naive count, which is the count
being wrong, not a regression — verified pair by pair.)

⚠ Two instrument defects were found and fixed while measuring, both of the kind that would have shipped a
false ledger: `rate.includes(en(denom))` reported nl's perfectly correct *mˈeːtər pˈɛr sˈeːkɔndə* as a
failure because `zˈɛstəx` contains `ˈɛs` (now whitespace-token comparison), and the same substring test
inflated the "still wrong" count from 47 to 229.

Final counts, three shapes × 190 codes: **read 221 · silent 208 · still speaking the symbol 47** (was
232 / 15 / 229). No pair is newly wrong.

## Run 5 — 2026-09-04 12:40 — the goldens need NOTHING, and the near-miss that established it

First attempt re-rendered every golden with `phonemize()` and reported **74 files, 4,306 rows** — including
whole-file churn in `ar`, `he`, `fa`, `bn`, `sd`, `ur`. That is not this change. `gen_parity_goldens.mts`
renders with **`phonemizeAsync`**, which enables the lexicon/neural tiers those languages depend on; a sync
re-render would have silently rewritten 74 goldens to a weaker path's output and called it a rate fix.

Re-rendered with `phonemizeAsync`: 9 files, 50 rows — and those were *still* not this change. `mi` and `vi`
dominate it, and the diffs are `Daesh`/`ISIL` moving between `dˈʌs ˈaᶦsɪɫ` and `dˈɛʃ ˈɪzəɫ`: the English
neural OOV tier, which depends on whether the ONNX model is loadable in the running environment.

Restricted to rows whose TEXT actually carries the shape (`/` + 1–3 ASCII letters) AND whose new IPA is a
pure truncation of the old:

```
files: 0   rows: 0   skipped (not a truncation): 1
```

⚠ AND THAT ANSWER WAS WRONG TOO — the truncation filter was the third bad instrument in this run, and the
FULL-FLEET PARITY RUN is what caught it. `ilo` has one row with `cm/yr`, and its old reading is not a prefix
of the new one because it was never a truncation to begin with:

```
ilo   was  … tˈallo km jɾ kadaɡˈiti …        Ilocano's own g2p voicing ⟨cm⟩ as [km] and ⟨yr⟩ as [jɾ]
      now  … tˈallo sɛntimˈɛtɾo kadaɡˈiti …  the centimetre read, the year dropped
```

That is the Run-4 fourth class again — a host reading the raw letters as native phones — and a filter built
around "the fix only ever removes something" could not see the one row where it also ADDS a reading. One
golden row moves, `csharp/tools/parity` is byte-identical over the whole fleet with it, and the lesson is
that three separate instruments in this issue were wrong in the same direction: each assumed the shape of the
answer before measuring it.

## Run 6 — 2026-09-04 13:15 — the pins this revises, for the third time

Three TS assertions and two C# ones failed, all of them the previous thesis stated as a fact:

- `test/rate-half-reading.test.ts` — "the denominator still strands VISIBLY — reading the numerator does not
  hide it". That test was #1249's own case, and its argument was that the `h` "is exactly as present as it
  was under the decline". True; #1255 is the measurement of what *present* then means.
- `test/maltese.test.ts` / `MalteseTests.cs` — `5 km/j`. This residual has now moved **three times**:
  `5 kilometri/j` before #1093, `5 km/j` under #1098's whole-match decline, `5 kilometri/j` when #1249
  measured that the decline bought nothing, and `5 kilometri` now.
- `test/malagasy.test.ts` — the speed of light, still a Malagasy data gap, now silent rather than spoken.

Each comment carries the whole chain rather than just its current value, because the line has been argued
four times and each round's reasoning was correct on the evidence it had.

## What was NOT done, and why

- **Class 2 (24 codes) and the 5 remaining class-3 codes are untouched.** `ln`, `lt`, `ak`, `bm`, `ht`,
  `mos`, `ki`, `lg`, `mr`, `ps`, `pbt`, `ka`, `ug` and the rest read their rate through a LOCAL arm in their
  own engine, so the shared pattern never covers the `/denominator` and cannot consume it. Same population as
  #1249's `ACCEPTED_DECLINE`, same per-file work, now ledgered a second way in `ACCEPTED_SPOKEN`.
- **The denominator nouns are not declared here.** That is the actual repair and it is per-language,
  per-denominator, attested data — `cmn` reads `km/h` and fails only on `/s`. Sourcing 208 readings from
  recall is exactly the unsourced edit this repo's data rules exist to prevent. `SILENT_BUDGET` in
  `test/rate-denominator.test.ts` is the to-do list, and it can only shrink.
- **Class 1 was NOT closed as "working as intended"**, which the issue offered. `h` is a valid IPA symbol, so
  it was never the visible leak the design assumed; it is in scope and it is fixed.

## Run 7 — 2026-09-04 14:20 — review: the guard was eating real words

Probing the shapes languages ACTUALLY write for a rate — not just `km/h` — the `[A-Za-z]{1,3}` guard was
dropping readings that were correct before it:

```
                        before              after (as first written)
nl  160 km/uur   …kˈiloːmətər ˈyr           …kˈiloːmətər        ⟵ Dutch "uur", read correctly
af  160 km/uur   …ˈyːr                      …                   ⟵ likewise
sw  160 km/saa   …sˈaː                      …                   ⟵ Swahili "saa", hour
cs  160 km/hod   …ɦˈot                      …                   sv 160 km/tim → tiːm, fi /tun → tun
```

against the ones the issue is about, where the same slot produces garbage:

```
de  160 km/Std   …ʃtt          es 160 km/hr  …r          fr 160 km/hr  …ʁ          et /h  …h
```

⚠ AND THE DISCRIMINATOR THAT SEPARATES THEM IS ALREADY IN THIS FILE. `isBareUnitKey` decides the same
question five screens up — is this short Latin run a SYMBOL or a WORD? — and answers it with a **vowel test**,
measured: "the vowel-free symbols (`km` ×68, `kg`, `cm`, `mm`) were units in every instance … an alphabet
that writes its vowels does not write vowel-less words". Every regression above has a vowel; every case the
issue reports does not. The guard now excludes vowels, `y` included, exactly as that rule does.

The cost is that `min`, `sec` and `yr` are no longer dropped — they keep today's behaviour, which is the safe
side of a one-sided error. The `160 km/h` fleet numbers are unchanged by the narrowing (160 / 0 / 5 / 24) and
so is the ledger (221 / 208 / 47), because `h` and `s` are vowel-free.

⚠ AND THE `ilo` GOLDEN ROW CAUGHT A MISSED MIRROR. With the narrowing applied to the TypeScript only,
`csharp/tools/parity` reported `ilo DIFF 1/94` — TS `…sɛntimˈɛtɾo jɾ`, C# `…sɛntimˈɛtɾo`. The C# had the wide
guard and was still dropping `/yr`. Mirrored; byte-identical again. Two of this issue's three near-misses were
found by parity rather than by a test, which is an argument for running it on every change that touches the
shared tier and not only when a golden moves.

## Run 8 — 2026-09-04 15:10 — review, and the defect that survived the fix

**1. The denominator's own EXPONENT was not covered, so the whole defect survived in `m/s²` and `kg/m³`.**
The stranded group had no `(²|³)?` of its own — unlike the declared-rate branch, which has always taken one —
and the trailing lookahead refuses a following superscript, so on `9.8 m/s²` the group matched `/s`, the
lookahead rejected the `²`, the engine backtracked the group to empty and stranded `/s²` exactly as before.
All three classes, intact, in a shape the mined corpora actually carry (`kg/m³`, `g/cm³`, `g/m²`, `l/m²`):

```
ja  9.8 m/s²    …me̞ːto̞ɾɯᵝ ˈɛs no̞ nid͡ʑo̞ː     et  9.8 m/s²  …mˈeːtrit s      haw  …mika k
ja  9.8 m/s2    …me̞ːto̞ɾɯᵝ ˈɛs ni            ⟵ the ASCII 2 read as a NUMBER
```

The last line is this file's own "≫ INVENTED NUMBER", the outcome its ordering ranks last. Both spellings
are now taken. The three shapes the test probes are all exponent-free, so nothing would have caught it.

**2. And `1000 kg/m³` needed the OTHER path.** Where the denominator IS a declared unit but the language has
no `unitPer`, the regex's stranded group never sees it and the #1249 fall-through re-emits the tail — am read
*…kiloɡɨɾam ˈɛm kjˈuːbd*. The same vowel-free ASCII test now governs both, spelled once as `STRANDED_SYMBOL`
so the regex and the callback cannot drift apart. A Cyrillic `⟨/км²⟩` is re-emitted as before, verified.

**3. ⚠ THE INSTRUMENT COULD NOT SEE THE CLASS ITS OWN HEADER CALLS THE WORST.** `classify` scored "spoken"
by listing the ways a symbol can surface — the raw letter, its uppercase, English's reading — and anything
else counted as success. But the fourth class *is* anything else: the host's g2p reading the letter as a
native phone. It now asks the ENGINE what it says for the bare symbol, which covers all four routes at once
because in every one of them the engine is simply phonemizing the symbol. That surfaced **seven more**
pairs — da `/h` → *ˈhɔːˀ*, nb → *ˈhoː*, mt → *ħ*, za `/s` → *θ*, smj ×3 — every one verified pre-existing by
running the widened classifier on both sides of the change. `ACCEPTED_SPOKEN` was a lower bound, not a census.

⚠ That is the third time in three issues that an instrument shared the blind spot of the defect it was
written to catch (#1250's `GENAM_VOWEL` twice, now this). The pattern is always the same: the instrument
enumerates the failure modes already known instead of asking the engine.

**4. The accepted cost of the vowel test is now pinned.** `min`, `sec` and `yr` keep being spoken — et
`160 km/min` → *…mˈin*, ja → *mˈɪn*, et `160 cm/yr` → *…ˈir* — and `csharp/goldens/ilo.tsv` records one of
them (`3 cm/yr` → *…sɛntimˈɛtɾo jɾ*). Pinned rather than left to a comment, because "documented in a comment"
is exactly how the leak-gate premise this issue retired survived three rounds.

**5. Not fixed, reported:** `csharp/goldens/km.tsv` is stale against the current engine on one row, including
Khmer word-segmentation differences this change cannot touch (`/s` strands identically on both sides). Its
parity gate is presumably already red. Pre-existing drift, outside this issue.

## Run 9 — 2026-09-04 15:40 — full-fleet parity found a golden #1249 left stale

Running `csharp/tools/parity` over all 189 languages rather than the two this change touches:

```
188 languages byte-identical, 1 differ (36,494 rows ok, 1 differ)
  ab  DIFF 1/200
```

```
ab  0,6км/км²   golden  … anolʲ fba kʼm kʼm …            the state before #1249
                engine  … anolʲ fba kʼilometʼra kʼm …    the state since #1249
```

⚠ **THAT ROW HAS BEEN RED SINCE #1249 MERGED.** That change made the arm read the numerator of an unreadable
rate and its abkhaz effect was pinned in `test/abkhaz.test.ts` — but the parity golden was never re-rendered,
because parity was only run for the two languages that PR's own probes touched. Nothing else looks at a
golden's IPA column, so it sat there. Re-rendered; byte-identical again.

The lesson is the one Run 7 already drew and this makes concrete: **run full-fleet parity on any change to
the shared tier**, not just on the languages the change was reasoned about. Four separate problems in this
issue were found by parity rather than by a test — the sync re-render that would have rewritten 74 goldens,
the truncation filter that hid `ilo`, the C# guard left un-mirrored, and now a stale golden from a previous
merge. No test in either suite asserts a golden's IPA column, so parity is the only gate that reads it.
