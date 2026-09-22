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
