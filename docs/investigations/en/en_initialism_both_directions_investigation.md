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

    goldens   5 rows get WORSE, all one shape: a romanisation fragment of 3+ letters delegated to the
              ENGLISH OOV path and spelled out as English letters — `sch` (Hakka), `Tsz` (Cantonese),
              `Plč` (Czech), `zh` (Pinyin), `trọ` (Vietnamese)
              7 rows get BETTER, including three that were class-2 defects in other languages'
              goldens: `Bas` → bˈæs (was "B-A-S"), `Okayama`, Tatar `mäglümäti`

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
