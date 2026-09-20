# Initialisms read as words, and words spelled out as initialisms (#1382)

Two `en` defects, opposite directions, filed together on the hypothesis that they "share a decision
point, which would make this one fix rather than two". They do not. They share a SUBJECT — the
letter-name reading — and nothing else, and the two mechanisms are in different files.

## Run 1 — 2026-09-20 15:40 — two defects, two mechanisms, and the issue's hypothesis is wrong

#1382 reports the `fyi` row as evidence that the two halves "share a decision point, which would make
this one fix rather than two". They do not. `fyi` is a THIRD thing, and the two halves live in
different files.

### Class 2 — a word spelled out: `compoundSplit` eating initialism rows

    treacher   [tre|acher→ach+er]   T R EY1 EY2 S IY2 EY2 CH ER0   "tray-A-C-H-er"

⚠ **210 ROWS OF `g2p-dict.tsv` ARE AN INITIALISM SPELLED OUT, NOT A WORD** — `abs` = EY1 B IY1 EH1 S,
`abd`, `ach`, `mph`, `ati`, `ona`, `cia`, `apo`, `llc`. 163 of them are three letters or more, which is
`MINPART`, so `compoundSplit` and `morphDecode` reach for them like any other dictionary row.

Measured over the whole dictionary held out, and over the wikipron-UK headwords we do not carry:

    words decoded through a letter-name piece     dict 287      referee 131

and they are not exotic: `absent` [abs|ent], `absorb` [abs|orb], `abstract` [abs|tract], `abdomen`
[abd|omen], `accrington` [acc|ring|ton], `congregationalist` [con|greg|ati|ona|list]. `abs-` and `abd-`
poison an entire orthographic neighbourhood.

**Fix: an initialism row is not a piece.** Derived, not listed — CMUdict names all 26 letters, so the
reading of an initialism is already in the dictionary and a 210-row table would only go stale against
it. The two letters whose NAME is spelled differently from the letter (`a` → `ay`, `i` → `eye`) come
from the same manifest key `normalize.ts` spells runs with, so the two places cannot drift.

    dict 287 → 0        referee 131 → 0

### Class 1 — an initialism read as a word: a reading with no vowel

    blt → B L T      frb → F R B      hdd → HH D      kph → K F

⚠ **THE CAUSE IS A CASE GATE, NOT THE n-GRAM.** `core/initialisms.ts` reads these correctly — `BLT` is
bˈiː ˈɛɫ tʰˈiː — but it matches ALL-CAPS runs only, deliberately, because in cased text the capitals are
the signal. Lowercase `blt` never reaches it, falls to the n-gram, and the n-gram asked to read a string
of consonants obligingly returns consonants. All 186 vowelless outputs in the swept population are
source N.

⚠ **AND NOTHING CORRECT IS AT RISK, WHICH IS THE WHOLE ARGUMENT.** English does have vowelless words —
`hm`, `hmm`, `mm`, `sh`, `shh`, and all 8 vowelless rows in the dictionary are that shape — but a
RECORDED word never takes the OOV path, so the net cannot see them. Every vowelless output it can see is
already broken. That reframing is what makes a blunt rule safe here.

**Fix: no vowel nucleus on the OOV path → spell the word out**, with two exclusions, both measured.

### ⚠ Three wrong versions of the exclusion, in order

1. **"every letter after the first is the same"** — meant to protect an elongated `hmmmm`. It also
   exempts `hdd` and `cnn`, the very initialisms the net exists to catch. A DOUBLED final letter is
   ordinary English; a TRIPLED one is someone leaning on a key. Now a run of three.
2. **no length floor** — the net fired on two-letter runs, where an English initialism (`fm`, `hz`,
   `mr`) is indistinguishable from a ROMANISATION DIGRAPH arriving through foreign-run delegation. The
   goldens are full of the second kind. Declining two-letter runs costs 51 of the 186 and is taken.
3. **a memo on the predicate** — see below.

### ⚠ THE MEMO WAS POISONED BY THE HOLD-OUT, AND IT COST AN HOUR

`isLetterNameRow` was memoized. A cache keyed on a word is a cache keyed on `dict`, and `dict` is
exactly what this repo's tests and sweeps MUTATE — `en-curation-gap.test.ts` holds each word out one at
a time. When `mph` was itself the held-out word the first time the predicate was asked, `dict.get("mph")`
was `undefined`, the answer `false` was cached, and `stumph`, `flymph` and `woollcott` kept their
letter-name readings for the rest of the run. The residue looked like an incomplete fix and was a
measurement artifact. The predicate is a handful of array reads; it is no longer cached, and the comment
says why so it does not come back.

### What is left, and it is not this fix

    goldens   4 rows get WORSE, all one shape: a romanisation fragment of 3+ letters delegated to the
              ENGLISH OOV path and spelled out as English letters — `sch` (Hakka), `Tsz` (Cantonese),
              `Plč` (Czech), `zh` (Pinyin)
              5 rows get BETTER, including two that were class-2 defects in other languages' goldens:
              `Okayama` and Tatar `mäglümäti`

The remedy for the five is not in `englishG2p.ts`: a Latin-script fragment of a language this engine is
not reading should not arrive at the English OOV path at all, and nothing at this level can tell that it
has. Recorded as a class rather than patched around.

### And `fyi` was a dictionary row, not either class

CMUdict glosses it as its EXPANSION — `F AO1 R Y AO1 R IH2 N F ER0 M EY1 SH AH0 N`, "for your
information" — so the engine said the phrase where the referee has ɛfwaɪaɪ. #1382 lists it under "a word
spelled out that is not an initialism" with the polarity reversed: it is the one word in that sample
that IS an initialism, and it was the one getting the phrase.

⚠ It is a DIFFERENT class from the glosses `g2p-curated.tsv` deliberately leaves alone. `lb`
[P AW1 N D], `hz`, `blvd`, `mt`, `dr` are written short forms of a word that IS spoken — "pound",
"hertz", "boulevard" — so the gloss is the right reading there. `fyi` is said as its letters. One
curated row.

    dict rows       1 (`fyi`)
    engine          `isLetterNameRow` + the no-nucleus net, TS and C# both
    suite           6,108 tests;  goldens 189 / 36,495 / 0 stale;  parity 189 byte-identical

## Run 2 — 2026-09-20 17:10 — review of #1386: the guard was in the wrong function

Three findings, all real, and the first two are the fix over-reaching rather than under-reaching.

### ⚠ THE INITIALISM GUARD BLOCKED THE ONE MORPHOLOGICAL THING INITIALISMS DO

Rejecting a letter-name STEM inside `morphDecode` also blocks the correct decode of an initialism's
PLURAL, which is the only inflection they take:

    mphs   ˌɛmpˌiːʲˈeᶦt͡ʃɪz  →  ˌɛmpˌiːʲˌeᶦt͡ʃˈɛs     "em-pee-aitch-ESS"
    oks    ˌoᶷkʰˈeᶦz        →  ˈoᶷks                 "oaks", for a word that is "okays"

`oks` is the second half of it: `ok` is `OW1 K EY1` — ⟨o⟩+⟨k⟩ — so the predicate has a FALSE POSITIVE on
an ordinary word whose reading merely coincides with its letter names. Only `compoundSplit` needs the
rejection, for `treacher` = `tre` + `acher`→`ach`+`er`, so `morphDecode` now takes an `asPiece` flag.

⚠ **AND THE FIRST FIX FOR THAT WAS BACKWARDS, CAUGHT BY A GOLDEN.** Scoping the guard to pieces alone
let `bas` decode as `ba`+`s` — `ba` is itself a letter-name row — and two golden rows went back to
"B-A-z". The obvious repair is to gate on the stem having no vowel letter, which separates `mph`+`s`
from `ba`+`s`. **Measured, that breaks fourteen words to save one.** Over `dict ∪ referee`, words of the
shape `<letter-name row> + s` number 15, and 14 have a vowel in the stem:

    abcs  apis  suvs  ufos  urls  vips  duis  byus  csis  hbos  baas  clos  amas  mmes   (14)
    dvds                                                                                 (1)

The vowel says nothing; the SUFFIX does. So the exemption is the plural suffix itself, and the cost is
the rows where the predicate false-positives — `bas`, `baas`, `clos`, `amas`, `mmes` — against thirteen
common words read correctly. `bas` is two golden rows, French place names delegated from Hakka and Min
Nan, and they revert to their pre-#1386 readings.

### ⚠ A TRAILING `s` WAS READ AS THE LETTER ESS

`blts` → "bee-ell-tee-ESS", while `blt's` — which the clitic strip reaches first — was already correct.
The same word with and without an apostrophe disagreeing is the tell. The net now strips a final `s`
when the remainder is still vowelless and appends the Z allomorph.

### ⚠ SEVEN INTERJECTIONS WERE BEING SPELLED OUT, AND THE PREMISE WAS "NEARLY TRUE"

Run 1 argued the net is safe because "every correct vowelless English word is a recorded interjection
and a recorded word never takes the OOV path". That held for the 8 rows in `g2p-dict.tsv` and not for
`brr`, `grr`, `tsk`, `pst`, `psst`, `pfft`, `hmph`, which CMUdict does not carry: `tsk` came out
"tee-ess-kay". The elongation exemption cannot reach them — `brrr` is exempt and `brr` is not — and
widening it to a consonant set would also exempt `gpt`.

**So the premise was made true instead of the rule loosened**: seven curated rows, and the class the
argument depends on is now actually closed.

⚠ THEY HAD TO GO IN `accent-lexicon.tsv` AS WELL, which is the seam `en_rebuild_lexicon.mts` warns about
in its own header: it WALKS the lexicon and looks each row's ARPABET up, so a word added to
`g2p-dict.tsv` and nowhere else never appears. The first attempt added seven dictionary rows, reported
"would change: 0", and changed nothing at all.

### And the parity gate could not have caught any of this

`csharp/goldens/` contains none of `abs`, `blt`, `hdd`, `mphs` or `fyi` as an OOV word, so a divergence
in `IsLetterNameRow`, `IsElongation`, `SpellOutPhones` or the plural strip would have sat green.
`EnglishInitialismsOovTests.cs` now asserts the same literals as the TS test — that, and not parity, is
what holds the two engines together here.

    goldens   9 rows vs main: 5 better, 4 worse, every regression a romanisation fragment
    suite     6,126 + the C# twin;  parity 189 byte-identical
