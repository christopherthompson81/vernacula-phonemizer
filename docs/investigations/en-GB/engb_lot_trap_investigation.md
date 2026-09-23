# en-GB — the class where the LOT rule produces ɒ but RP has TRAP (#1414)

#1411 dropped 121 words from `en-gb-palm.tsv` whose PALM claim rested only on a length-less `ɑ` row.
The drop was well supported, but of the 50 where espeak endorsed neither `ɑː` nor `ɒ`, **41 read with
TRAP** — so those words moved from one wrong vowel to another. #1414 asks three things, and this log
answers them in order:

1. **Scope it** — the 41 are a by-product of one PR's drop list, not a measurement of the class.
2. **Check the direction is real** on words the PRIMARY referee can arbitrate.
3. Then decide between a sixth generated set (`ɑː → æ`) and `en-gb-lexical.tsv` rows.

## Run 1 — 2026-09-22 — scoping with espeak, as a SEARCH step only

⚠ **espeak's binary output is not admissible as evidence here** — `en-gb-lexical.PROVENANCE.md` admits
the *dictsource* (a per-word human decision) and explicitly refuses the binary, whose letter-to-sound
rules are a G2P guess of exactly the kind this engine already makes. This run is a SEARCH: it asks how
big the class could be, not what any word's reading is.

The candidate universe is every lexicon word carrying an `ɑː` not before `ɹ` — the LOT rule's own
input condition (`s.replace(/ɑː(?!ɹ)/gu, "ɒ")`, english-gb.ts:284), minus PALM members and words
`en-gb-lexical.tsv` owns:

```
awk -F'\t' '!/^#/ && NF>=3 {print $1"\t"$3}' data/languages/english/accent-lexicon.tsv | grep -P 'ɑː(?!ɹ)'
espeak-ng -v en-gb -q --ipa -f <one word per line, blank-separated>
```

```
candidates carrying ɑː not before ɹ : 19022
  excluded (PALM / table-owned)     :   391
  swept                             : 18631
    espeak ɑː  (endorses PALM)       2524   13.5%
    espeak ɒ   (endorses LOT)       10888   58.4%
    espeak a   (TRAP, no ɑː or ɒ)    2931   15.7%
    neither                          2288   12.3%
```

**2,931, against the 41 the issue names — 71×.** But two things make that number unusable as it stands:

⚠ **THE CLASSIFIER IS NOT POSITIONAL.** It asks whether the espeak reading spells a TRAP vowel
*anywhere*, not whether the segment our LOT rule produced is the one spelled `a`. This is the same
approximation `build-en-gb-sets.ts` already documents for its BATH/PALM length test, and here it is
live rather than latent: a polysyllable with our `ɑː` in one syllable and espeak's `a` in another
scores as a hit.

⚠ **AND THE CLASS IS OVERWHELMINGLY PROPER NOUNS**, which is the lexicon's composition rather than a
finding: a random 40 of the 2,931 gives `topanga`, `tornatore`, `abiola`, `malpensa`, `tracz`,
`manriquez`, `trapasso`, `travaglini`, `mascolo`, `trupiano`, `ugalde`, `matsushita`, `adamczak`,
`valdivia`, `valladares` — surnames and place names. The PROVENANCE keeps proper nouns out
deliberately (`hertford`, "a much larger door"), so the shippable class is far smaller than 2,931.

**Implication for the next step:** drop espeak as the scoping instrument and go straight to #1414's
step 2, which uses the admissible source and is positional by construction — the
`build-en-gb-sets.ts` claim method. Apply the candidate edit `ɒ → æ` to the RULES-ONLY output and ask
whether the folded result matches a variant the wikipron UK referee ATTESTS. A whole-string match
cannot be satisfied by a TRAP vowel in the wrong syllable.

## Run 2 — 2026-09-22 — the PRIMARY referee, and the issue's premise is wrong

The probe is `build-en-gb-sets.ts`'s claim loop with one new edit. For every referee row not already
owned by `en-gb-lexical.tsv` and not already in a set, take the RULES-ONLY output (`phonemizeWordRules`,
after the marry set, exactly as the builder does), apply `ɒ → æ`, and ask whether the folded result is a
variant the referee ATTESTS. A whole-string match is positional by construction, which is what Run 1's
espeak classifier could not be.

```
referee rows examined (not owned, not in a set): 73623
of those, our rules-only output has ɒ         : 10193
ɒ→æ edit matches an ATTESTED variant          :   189
  and the referee ALSO attests our ɒ form     :    14
```

⚠ **#1414's SECOND PREMISE DOES NOT HOLD.** The issue says *"AND THE REFEREE CANNOT ARBITRATE MOST OF
THEM — their only wikipron rows are written in the length-less convention #1411 refuses as evidence."*
That is true of their `ɑ` rows and irrelevant, because these words have a **separate, properly-spelled
`æ` row sitting beside the ambiguous one**. `æ` carries no length mark, so #1411's refusal never
applied to it:

```
drachma   dɹækmə | dɹɑkmə        regatta   ɹɪɡætə | ɹɪɡɑtə
natasha   nətæʃə | nətɑʃə        aquavit   ækwəviːt | ɑkwəviːt
```

Four of the five specimens the issue names are claimable from the **primary** source alone. The fifth,
`antipasto` (`æntipɑstəʊ`), is correctly refused — its TRAP vowel is in the first syllable and the
segment our LOT rule produced is in the third, which is exactly the discrimination Run 1 lacked.

**The class is the FOREIGN-(a) set**, a well-attested RP/GenAm split: a foreign /a/ that GenAm
nativises as LOT and RP as TRAP. `pasta`, `taco`, `salsa`, `dacha`, `macho`, `mafia`, `plaza`,
`piazza`, `goulash`, `falafel`, `matzo`, `kaddish`, `hanukkah`, `drachma`, `regatta` — plus the proper
nouns that come with it (`kafka`, `picasso`, `krakow`, `dhaka`, `myanmar`).

⚠ **AND `pasta` IS ALREADY IN `en-gb-lexical.tsv`, WHERE IT DOES NOT BELONG.** That file's own bar is
that the two varieties *do not use the same word*; `pasta` is one word with two accent realisations,
and the PROVENANCE row says so in as many words — "TRAP in British, PALM in GenAm". It is there because
there was no set to put it in. This is the set.

### ⚠ THE PALM DISCRIMINATOR IS REQUIRED HERE TOO, AND IT IS NOT A FORMALITY

14 of the 189 have the referee attesting our UN-EDITED `ɒ` as well, and on those our current reading is
simply right:

```
squad  skwæd | skwɒd      wan    wæn | wɒn        guam     ɡwæm | ɡwɑːm | ɡwɒm
aquatic əkwætɪk | əkwɒtɪk  taiwan taɪ̯wæn | …wɒn   genealogy dʒiːniælədʒi | dʒiːniɒlədʒi
```

Claiming them would be a **regression on 7.4% of the set**. ⚠ Ten of the fourteen are the /w/
environment (`squad`, `wan`, `wandle`, `wat`, `guam`, `quassin`, `kwashiorkor`, `aquatic`, `taiwan`,
`rwanda`), where RP genuinely has `ɒ` — so the discriminator is doing real phonological work and not
just filtering noise. It leaves **175 claims**.

⚠ **THE DISCRIMINATOR ONLY FIRES WHEN THE REFEREE HAPPENS TO LIST BOTH**, which for a rare single-row
headword it does not — `wap`, `waff`, `swass`, `wangus`, `wambulance` survive into the set on one row
each, in the very environment the refused fourteen say is dangerous. That is the builder's standing
policy for every set, not a new exposure, but it is where this set's residual risk sits.

### Proper nouns need no special handling

`en-gb-lexical.PROVENANCE.md` keeps proper nouns out of the *hand-written* table deliberately
(`hertford`, "a much larger door"). The GENERATED sets have never had that bar — `boston` is in CLOTH
and `nevada` is in BATH — so a sixth generated set inherits the existing policy and nothing is decided
here that was not already decided.

**Implication:** #1414's step 3 resolves to the sixth set, not to `en-gb-lexical.tsv` rows. Build it in
`build-en-gb-sets.ts` with the PALM-shaped discriminator, let the existing propagation pass carry the
inflections (`drachmas`, `regattas`), and move `pasta` out of the lexical table.

## Run 3 — 2026-09-22 — building it, and the diff that proves the addition is pure

The edit goes LAST in `build-en-gb-sets.ts`'s `edits` array. The claim loop `break`s on the first set
that claims a word, so appending cannot move a word *out* of BATH, CLOTH, LOTR or PALM — it can only
take what they left. That makes the rebuild provable as a pure `+N`:

```
npx tsx tools/referee-eval/build-en-gb-sets.ts --jobs 12
  en-gb-bath.tsv: 814   en-gb-cloth.tsv: 899   en-gb-yod.tsv: 1006
  en-gb-palm.tsv: 484   en-gb-lotr.tsv:   7    en-gb-trap.tsv:  192
lexical-set words claimed 2803 of 76284
paradigm propagation: +599 inflections (19 vetoed, 131 wrong lemma, 1 inert)

git diff --numstat en-gb-{bath,cloth,yod,palm,lotr}.tsv   ->  (empty)
```

**The five existing sets are byte-identical.** 192 = 175 claims + 17 inflections the existing
propagation pass carried (`drachmas`, `regattas`, `pastas`, `tacos`, …).

`--check` at `--jobs 1` reproduces what `--jobs 12` wrote, which is `engb-sets-shard.test.ts`'s
property exercised on the real data rather than on a `--limit` sample.

### What shipped, and what deliberately did not

```
pasta  pʰˈæstə     taco   tʰˈækəᶷ    drachma dɹˈækmə    regatta ɹᵻɡˈætə
salsa  sˈæɫsə      dacha  dˈæt͡ʃə    piazza  piˈætsə    natasha nətʰˈæʃə
squad  skwˈɒd      wan    wˈɒn       guam    ɡwˈɒm      aquatic əkwˈɒtɪk   ← discriminator
father fˈɑːðə      spa    spˈɑː      tomato  təmˈɑːtʰəᶷ  grass  ɡɹˈɑːs     ← untouched
```

⚠ **`pasta` LEFT `en-gb-lexical.tsv` AND ITS READING DID NOT MOVE.** It had been a hand-written
lexical-variant row justified as "TRAP in British, PALM in GenAm" — a description of one word with two
accent realisations, which is precisely what that file's opening section says does *not* belong in it.
It was there because there was nowhere else to put it. Nothing would have prompted re-examining it: the
word was right, the table was green, and the only tell was a justification contradicting the file's own
first paragraph.

⚠ **AND THE PROVENANCE'S ROW COUNT WAS STALE BEFORE I TOUCHED IT.** `english-gb.ts` said the guard-less
form "is correct for the 24 words that have exactly one reading"; the file had 44 before this change and
42 after. Corrected rather than dropped — the count is the only thing there that says how much of the
table the POS guard does *not* cover.

### Gates

```
npm test                              6331 passed  (after re-extracting regex-corpus.jsonl for `ɒ`)
dotnet test csharp                    6939 passed
regex-diff                            145002 probe results identical, 0 DIFFER, 0 threw
check:goldens                         189 languages, 36495 rows, 0 stale
check:en-gb-sets                      fresh — reproduces from the builder
```

⚠ **`check:goldens` REPORTING 0 STALE MEANS THE GOLDENS DO NOT COVER THIS SET**, not that the set is
inert — no golden row is a TRAP member. The coverage is `english-gb-set-examples.test.ts`, which pins
eight members and eight refusals.

⚠ **AND THE REFUSAL HALF OF THAT TEST IS PROVED BY THE PROBE, NOT BY THE TEST.** A negative assertion
that passes after the guard is in place has proved nothing (this repo's standing lesson). What proves it
is Run 2's `alsoUnedited: 14` list, measured *before* the guard existed: all eight of the words the test
asserts are absent were in it, i.e. they would have been claimed without the discriminator.

### Left alone, recorded rather than fixed in passing

⚠ **`palm` ITSELF IS NOT IN `en-gb-palm.tsv`** and ships as `pʰˈɒm` against RP /pɑːm/. The referee has no
row for the headword at all, so the builder cannot claim it — a coverage gap in the source, not a defect
in this set, and entirely pre-existing. Worth its own issue.

⚠ **`garage` IS STILL WRONG**, as #1414 says: `ɡəɹˈɒʒ` against RP /ˈɡærɑːʒ/ or /ˈɡærɪdʒ/, stress on the
first syllable. Its error is STRESS, which no vowel set can reach, and the issue already names it as an
`en-gb-lexical.tsv` row rather than a set membership. Out of scope here and unchanged by this work.

### ⚠ ONE SET OVERLAP, FOUND BY MEASURING RATHER THAN BY ASSUMING

The first draft of the runtime comment said "order is irrelevant here", reasoning from the builder's
`break`. That is true of the six GENERATED sets and false of `marry`, which is built separately:

```
trap ∩ bath  0     trap ∩ palm  0
trap ∩ cloth 0     trap ∩ lotr  0
trap ∩ yod   0     trap ∩ marry 1   ← ararat
```

`ararat` chains through both. Rules-only gives `ˈɛɹəɹˌɒt`; marry takes the `ɛɹ` to `æɹ`
(`ˈæɹəɹˌɒt`); TRAP then takes the `ɒ` to `æ` — `ˈæɹəɹˌæt`, which is the referee's `æɹəɹæt` exactly.
The builder probes with marry applied first, so the shipped order is the one the claim was validated
under — the same shape as the documented marry→BATH chain. **The comment was corrected before the
measurement contradicted it only because the measurement was run.**
