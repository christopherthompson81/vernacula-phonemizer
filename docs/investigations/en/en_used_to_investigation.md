# en: `used to` reads /juːzd/ (#1395)

    I used to walk there.   →   aᶦ jˈuːzd tʰuː wˈɔːk ðˈɛɹ

`used` is **rank 125**. The habitual `used to` is /juːst/, and no POS tag separates it from the passive
"will be used to determine" — which is why #1396 left it out of the `-ed` adjective class.

#1395 stated the blocker precisely: *"it needs measuring against real text before it is worth building.
**The base rate is the whole question** and nothing in this repo currently answers it."*

## Run 1 — 2026-09-22 — answer the base-rate question

`/mnt/data/corpora/` carries seven **Universal Dependencies** English treebanks — syntactically
annotated, which is the instrument this needs, because the distinction *is* syntactic. 101 `used to`
tokens across 17 files.

⚠ **AND THE CORPUS IMMEDIATELY SHOWED A THIRD READING THE ISSUE DID NOT NAME.** "be/get used to
<noun|gerund>" — *He was used to walking briskly*, *Get used to using it yourself* — is the
**accustomed** sense, and it is /juːst/ as well. The issue framed this as habitual-vs-instrumental; it
is a three-way split, and the third class sides with the one that was wrong.

Classifying by UD features rather than by dependency label (the label does not separate them — `VERB/xcomp`
holds both *aircraft used to fly* and *I used to e-mail*):

    juːst  habitual    50        juːzd  passive + purpose   22
    juːst  accustomed  10        juːzd  participle          16
                                 juːzd  instrumental         3
    ──────────────────────────────────────────────────────────
           60  (59%)                    41  (41%)

⚠ **AND THE INSTRUMENTAL — THE CASE THE ISSUE BUILT ITS REFUSAL ON — IS 3 OF 101.** It hides inside the
finite set and is separable there only by an overt object: *"a trick that I used to tame them"* has one,
*"a website I used to run"* does not and is habitual. Being inside a relative clause is **not** the
signature; I assumed it was and the corpus said otherwise.

## Run 2 — 2026-09-22 — the issue's premise about the tagger is refuted

> "The heteronym table conditions on a POS tag, and **no POS tag separates these two**."

Probed against this repo's own perceptron:

    VBD  next=TO   habitual      i used to walk there
    VBD  next=TO   instrumental  the tool i used to open it     ← the only collision
    VBN  next=TO   passive       this date will be used to determine it
    VBN  next=TO   participle    the aircraft used to fly there
    VBN  next=IN   accustomed    he was used to walking briskly
    VBD  next=DT   plain past    she used a hammer

**The tags do separate them, on two axes: this word's VBD/VBN, and whether the following `to` is the
infinitive marker (TO) or a preposition (IN).** Only the instrumental collides with the habitual.

### ⚠ AND HAND-PICKED FRAMES OVERSTATED IT BY 13 POINTS

Those six frames predicted ~98%. Scoring every candidate rule over all 101 corpus tokens, tagged by the
real tagger rather than by me choosing sentences:

     41/101   41%   today (always juːzd)
     60/101   59%   flat bigram: next word is `to`
     82/101   81%   tag is VBD
    ⚠ 86/101  85%   tag is VBD, OR the next tag is IN
     83/101   82%   unless VBN + a bare infinitive

**85%, not 98%.** The gap is tagger noise on real sentences, and it is exactly why the rule was chosen
by measurement rather than by the reasoning that produced the six frames.

## What shipped

A `before` condition on a heteronym entry — one new manifest field, in both ports:

    "used": { "default": "jˈuːzd", "past": "jˈuːst",
              "before": { "word": "to", "tags": ["VBD"], "nextTags": ["IN"], "slot": "past" } }

⚠ **THE ISSUE PROPOSED THE FLAT BIGRAM AND IT WOULD HAVE BEEN NET POSITIVE — 59% against 41%.** It is
not what shipped, because the corpus said the two tag tests were worth another 26 points.

⚠ **AND THE SLOT MUST BE CLEARED, NOT MERELY SET.** `used` is VBD in "she used a hammer" too, and the
`past` slot exists only for this condition, so an entry that only ever *set* it would have broken the
plain past — the exact failure mode #1395 warned about in gold's `{VBD: jˈust}`.

    41% → 85% on the corpus · goldens 0 stale (no golden row contains `used to`) · C# 189 byte-identical

### The residue, pinned rather than papered over

The instrumental is still wrong, and `test/en-used-to.test.ts` asserts it **as wrong**, with:

> If a later change fixes it, THIS TEST FAILING IS THE SIGNAL — flip the expectation and raise the 85%.

The same device `english-gb-ary.test.ts` used for `amatory`, which fired as designed at #1391.

⚠ **AND THE PARITY GOLDEN CANNOT SEE ANY OF THIS** — `used to` is in no golden row, so the C# twin's
assertions in `EnglishEdAdjectiveHeteronymTests.cs` are the only thing holding the two ports together
here, exactly as that file's own header says of the `-ed` class.


## Run 3 — 2026-09-22 — review round: I shipped a regression and understated the residue by 11

### ⚠ THE CONDITION READ ACROSS PUNCTUATION, SO IT BROKE THE PLAIN PAST IT WAS BUILT TO PROTECT

    "He used, to my surprise, a hammer."                      → jˈuːst   (main: jˈuːzd)
    "…which tool he used. To be fair, it worked."             → jˈuːst   (main: jˈuːzd)

`allWords` is `units.flatMap(u => u.words…)` and **clause units contribute no words**, so `words[i+1]`
is the next WORD however many commas or full stops lie between. And the tagger cannot see the
punctuation either, so it obligingly tags the bare stream `he used to my surprise` as `VBD IN` and
**both halves of the disjunction fire**. A new regression, in exactly the `she used a hammer` frame the
cleared slot was supposed to make impossible — one clause to the left.

Fixed by building a `breakAfter` map alongside the word stream and refusing to look past a `true`. The
left gate honours it too.

### ⚠ AND THE RESIDUE IS 14, NOT 3 — I QUOTED THE GOLD CLASSES AND CALLED THEM THE RULE'S ERRORS

Scoring the shipped rule and printing every miss, rather than assuming the 3-token instrumental class
was the whole of it:

    SHIPPED: 87/101 = 86%

      ~6  HABITUAL TAGGED VBN — "Car repair used to be a knowledge commons",
          "Poverty and wealth used to depend more on means of livelihood",
          "There were – or used to be – leopards on the outskirts"
       3  INSTRUMENTAL — "a trick that I used to tame them"
      ~4  ACCUSTOMED at the edges of the left gate, or where the UD-derived gold is itself wrong
          ("Get your chickens used to humans" is accustomed; my classifier called it passive)

**The VBN-habitual class is the biggest single group of errors and I had not named it at all.** Worse,
the test pinned `"The aircraft used to fly there"` under the heading *"leaves the passive and the
participle"* — that sentence is habitual in isolation, so a whole missed class was recorded as correct
behaviour and a future fix would have looked like a regression. All three classes are now pinned AS
WRONG, with the usual "this test failing is the signal" marker.

### ⚠ AND THE LEFT GATE DOES NOT RESCUE THE CLASS IT WAS ADDED FOR

Review's `nextTags: ["IN"]` finding is right: any participle before a prepositional `to` flips to
/juːst/. A `be`/`get` gate fixes two of the four counterexamples (`energy used to the limit`, `the data
used to date` — no head) and **not** the other two, because *"the funds were used to that end"* has
`were` and *"He used to great effect a simple trick"* is VBD and matches the first alternative outright.

    `used` + PREPOSITIONAL `to` in the corpus: 15 — and all 15 are the ACCUSTOMED sense.

**So the corpus is silent on the class review found**, and the measurement cannot defend that branch
beyond the sample. The gate ships because it strictly removes errors and adds none; the rest is written
into the test header as a class the 86% does not cover. ⚠ **A measured number is only evidence about
what the sample contains**, which is the same limit that made the `garage`/PALM trade defensible at
#1411 and is worth saying twice.

### And the no-tag-lists form was a silent no-op

`(tags ?? []).includes(…) || (nextTags ?? []).includes(…)` is `false` when both are absent, so a
word-only condition — the flat-bigram form these very comments hold up as the 59% baseline — would have
permanently *cleared* its slot instead of setting it. The shape is now a list of alternatives, and an
empty alternative matches on the word alone.
