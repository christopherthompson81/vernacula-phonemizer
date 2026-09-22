# en-GB: BATH admits lexically-TRAP words (#1391)

`build-en-gb-sets.ts` claims a word into BATH when a single `æ → ɑː` edit produces a form the referee
**attests**, on the stated policy that the BBC target "prefers the RP-diagnostic realisation whenever it
is attested". #1391 names four words that policy admits and RP says with TRAP: `plasticity`,
`blaspheme`, `allistic`, `aquacise`.

The issue's own prerequisite — a US-contamination sweep of the referee — landed as #1404 (the rhotic
tell). This picks it up from there.

## Run 1 — 2026-09-22 — both remedies the issue contemplates are refuted by measurement

### ⚠ "REQUIRE THE ɑː ROW TO BE THE ONLY READING" EJECTS `bath` FROM BATH

    bath     bæθ | bɑːθ | bɐːθ          chance   t͡ʃɑːns | t͡ʃans
    path     pɑt̪ʰ | pɑːθ                dance    dɑːns

The type specimen has a TRAP row attested beside its BATH row, and so does `chance`. A policy of
requiring the `ɑː` row to stand alone would remove the word the set is named after. **Refuted in one
grep**, which is the cheapest refutation available and was worth doing before anything else.

### ⚠ AND A TRAP-BATH ENVIRONMENT GATE MISSES ALL FOUR AND BREAKS #1390

The linguistically obvious rule: BATH is a *conditioned* environment — /æ/ before a voiceless fricative
(f θ s) or a nasal + consonant. Gate the claim on it. Measured, with the gate wired behind a probe flag:

    BATH 880 → 851       dropped 29
    of #1391's four words, dropped:  0

**All 29 dropped are propagated inflections whose lemmas stay in BATH** — `transits`, `transitions`,
`translates`, `dramatized`, `platforms`, `pianos` — so the gate re-opens exactly the paradigm splits
#1390 had just closed, including `transit`/`transits`, that issue's own headline example. It rejects
nothing the issue is about and damages what the issue is not about.

⚠ **AND THE DEEPER REASON IT CANNOT WORK: THIS SET IS NOT BATH.** It is the `æ → ɑː` set, which contains
the TRAP-BATH split *and* the words where RP has PALM from a GenAm TRAP — `banana` is in it and RP
genuinely says `bənˈɑːnə`. An environment gate derived from the TRAP-BATH split rejects the second class
by construction. The name is the misleading part, not the membership.

## Run 2 — 2026-09-22 — the tell that does work: a length-less ɑ

`allistic`'s row is `ɑlɪstɪk` — **no length mark**. The backbone strips LENGTH, so an American `plɑtfɔːm`
is indistinguishable from an RP `plɑːtfɔːm` once folded. Is that a convention or free variation?

    headwords with any ɑ      6,259
      ONLY length-less ɑ      1,130
      ONLY ɑː                 5,024
      both spellings            105

**Two conventions, not free variation.** 105 headwords of 6,259 mix them. So a claim whose every
supporting row is written the short way is resting on a row from the other convention — the same shape
as #1383's rhotic tell, and the same remedy.

    BATH members whose claim rests SOLELY on a length-less ɑ row:  58

They are overwhelmingly foreign proper nouns and loanwords — `nanjing`, `pingshan`, `xingshan`,
`taqueria`, `trattoria`, `plattdeutsch`, `zemlyanka`, `tanghulu`, `obamna` — plus a handful of ordinary
English words the claim gets audibly wrong:

    platform   shipped plˈɑːtfˌɔːm      fang    fˈɑːŋ
    dramatize  dɹˈɑːmətʰˌaᶦz            amatory ˈɑːmətʰəɹi        intaglio ɪntˈɑːɫjəᶷ

### ⚠ THE SECOND SOURCE CONFIRMS IT ON EVERY ORDINARY ENGLISH WORD

    espeak-ng en-gb:  plˈatfɔːm  fˈaŋ  dɹˈamɐtˌaɪz  ˈamətəɹi  ɪntˈaɡlɪˌəʊ  pˈastəl  tˈablə  tɹatˈɔːɹiə

TRAP in every one (`a` is espeak's TRAP symbol). And `khaki`, which the tell **keeps**, it reads `kˈɑːki`
— PALM, agreeing with us. The detector discriminates in both directions, which is the check a detector
verified only on positives does not get.

### The cost, stated plainly

    BATH 880 → 814      (58 lemmas + 8 propagated inflections that follow them)
    referee agreement on those 66:   58/58 HIT  →  27/58 HIT      −31

⚠ **AND THE SHAPE OF THE −31 IS THE WHOLE ARGUMENT: 0 OF THE 31 HAVE A PROPERLY-SPELLED `ɑː` ROW.**
Every single loss is a headword whose ONLY transcription is written in the other convention. There is no
case where this gives up agreement with a properly spelled RP row. The other 27 still HIT — the referee
carries a TRAP row for them too, and we now match THAT one, so for 27 words the referee itself attests
the new reading.

### ⚠ AND IT IS "SOLELY", NOT "AT ALL"

`bath`, `chance` and `path` all have a length-less or TRAP row BESIDE a proper `ɑː` one and are untouched.
The policy of preferring the RP-diagnostic realisation whenever it is attested is unchanged; only claims
with no properly spelled support at all are refused.

### What this does NOT settle

`plasticity`, `blaspheme` and `aquacise` are still claimed — their `ɑː` rows are properly spelled. For the
first two that is arguably correct (conservative RP genuinely has /plɑːˈstɪsɪti/, /blɑːsˈfiːm/); for
`aquacise` it is a bad referee row with no mechanical tell. **One of #1391's four words is fixed by this,
and the other three are a different question.**

⚠ **AND PALM HAS THE SAME EXPOSURE, UNMEASURED HERE: 113 of its 605 members have referee rows where NO
row spells `ɑː`.** PALM's edit also targets `ɑː` and it already carries its own guard on a different
axis, so extending the tell there is a change of comparable size to this one and wants its own product
delta. Filed rather than bolted on.

### ⚠ AND A TEST WRITTEN MONTHS AGO PREDICTED ITS OWN RESOLUTION, THEN FIRED

`test/english-gb-ary.test.ts` carried `amatory` pinned at `ˈɑːmətʰəɹi` with the note:

> ⚠ PINNED AS-IS SO THE REGRESSION IS VISIBLE rather than discovered later: when #1391 tightens BATH's
> claim test this assertion should go back to `ˈæmətʰəɹi`, **and this test failing is the signal that
> it worked**.

It failed, exactly as written, the moment the length tell landed — and that comment had already
identified the cause as "a LENGTH-LESS `ɑ` in a non-rhotic corpus, i.e. an American transcription",
which is the detector this run arrived at independently. **The diagnosis was sitting in the test file the
whole time; what was missing was the measurement that a length-less `ɑ` is a CONVENTION (1,130 against
5,024) rather than one row's quirk.** Flipped to the resolved value, with its history kept.
