# Finnish `N.` ordinals: case agreement (#1574)

Question: `2. kerran` reads *toinen kerran*, but Finnish wants *toisen kerran*. The `N.` rule always emits the
nominative ordinal, and an ordinal agrees in case with its noun. Can the case be read from the following word
reliably enough to inflect the ordinal, given that this engine has no Finnish lexicon?

## Run 1 — 2026-10-15 21:55

**What follows a digit ordinal.** I counted `\d{1,3}\. <lowercase word>` over the FLEURS fi transcripts (raw text)
and `tools/corpus/mined/fi.jsonc`: 236 instances, 37 distinct following words.

- 175 are month names in the partitive (`13. toukokuuta`). There the ordinal is nominative, and that is already
  correct.
- Of the other 61, about half are oblique:
  - genitive: *päivän* ×7, *artiklan* ×2, *herttuan*, *dynastian*, *ulkoradan*, *leveyspiirin*, *kerran*;
  - illative: *päivään* ×2;
  - essive: *päivänä*, *pelaajana*;
  - allative: *sijalle* ×2, *leveyspiirille*;
  - translative: *divisioonaksi*;
  - inessive: *maailmassa*.

  The rest are nominatives (*painos*, *sija*, *lento*, *divisioona*, *rykmentti* …) or *ja* (an ordinal list).

So this is a general agreement rule, not a one-word fix.

## Run 2 — 2026-10-15 22:05

**The paradigm, sourced.** en.wiktionary declension tables (CC-BY-SA; facts, not text):

- *kolmas*, Kotus 45 *kahdeksas*: kolmannen, kolmatta, kolmannessa, kolmannesta, kolmanteen, kolmannella,
  kolmannelta, kolmannelle, kolmantena, kolmanneksi.
- *yhdestoista*: yhdennentoista, yhdettätoista, yhdennessätoista, …; *-toista* is invariant.
- *ensimmäinen*, Kotus 38 *nainen*: ensimmäisen, ensimmäistä, ensimmäisessä, ensimmäiseen, ensimmäisenä,
  ensimmäiseksi, …
- *kahdeskymmenes*: genitive *kahdennenkymmenennen*, so every component inflects. The Appendix:Finnish
  numerals page agrees: "all components receiving the ordinal suffix".

Rule: a type-45 component (`…s`) is stem + `nnen`/`tta`/`nnessa`/`nnesta`/`nteen`/`nnella`/`nnelta`/`nnelle`/
`ntena`/`nneksi`. A type-38 component (`…nen`) is stem + `sen`/`sta`/`sessa`/…. Each component takes its own
vowel harmony.

A scratch generator (`fiord.py`) reproduces every Wiktionary form checked: 3 gen, 11 ine, 20 gen, 1 par, 2 ess.

## Run 3 — 2026-10-15 22:15

**The instrument.** Spelled-out ordinals in running text show agreement directly: in *kolmannella sijalla*, the
ordinal's own ending is the case the next word carries. So every (inflected ordinal, next word) pair in a large
Finnish text is ground truth for "a word with this ending takes an ordinal in this case".

I'm streaming the full fiwiki dump (971 MB, bz2), with every form of 1–999 in 11 cases as the lookup and the
nominative *toinen* excluded, since it doubles as the pronoun "other". Each case detector will be judged on its
precision against that ground truth before it ships.

## Run 4 — 2026-10-15 22:50

**The scan.** `pairs.py` over the full fiwiki dump: 69,574,028 lines, 644,500 (inflected ordinal, next lowercase
word) pairs, 92,702 distinct. Ordinal case totals: gen 198,331 · nom 185,342 · tra 69,530 · ine 42,298 ·
ade 38,458 · par 34,638 · ess 28,903 · ill 18,064 · all 13,437 · ela 11,692 · abl 3,807.

⚠ Translative ordinals are mostly an idiom that ignores the next word's case: *toiseksi suurin* ("second
largest"), *sijoittui kolmanneksi tulleen*. They show up as the main confuser of every rule. A digit ordinal
before a superlative is not the shape this rule serves, so the scores below are given with and without them.

**First rule set** (precision when it fires, ordinals other than tra):
- ine `-ssa` .914 · ade `-lla` .908 · all `-lle` .901 · ess `-na` .901 · par `-aa` .944 · par `-tta` .774
- gen `-n` .845 · ela `-sta` .659 · abl `-lta` .569 · ill `-VVn` .340
- par `-ta` .037. Dead: these are nominatives (*maailmansota* 11,067, *kerta*, *vuosisata*).

**Breakdowns that moved the rules:**
- `-nen` is 87.6% nominative (*suomalainen*, *nainen*, *virallinen*). It gets no genitive claim.
- `-een` is the e-stem genitive (*asteen* 2,167, *vaiheen*, *lähteen*, *joukkueen*); its illative is `-eeseen`.
  So `-seen` is illative and the other `-een` is genitive.
- `-VVn` on a monosyllable (*maan*, *pään*, *kuun*) is genitive (46%); on a polysyllable (*sotaan*, *sijaan*,
  *otteluun*) it is illative.
- `-in` mixes superlatives (*suurin*, wanting *toiseksi*) with genitives (*albumin*, *etapin*). Genitive is the
  better bet for digit text (`5. etapin`).
- ⚠ Most remaining illative errors were a case plus the 3rd-person possessive, which lengthens the case vowel and
  adds `n`: *kaudellaan* = *kaudella* + *-an*, *ottelussaan*. So `-(ss|st|ll|n)VVn`, `-lleen` and `-kseen` map back
  to their case first. With that, the illative goes from .43 to .64.
- `-lta` beats the nominative only .51 to .45 for n≥3. *ensimmäinen vasemmalta* ("first from the left") is a
  caption idiom. Dropped.
- `-VVna`: the nominatives are all `-oona`/`-uuna` loans (*pataljoona*, *persoona*, *divisioona*, *miljoona*);
  the essives are `-eena`/`-aana` (*kappaleena*, *joukkueena*, *maana*). So `-oona`/`-uuna` stays nominative.

**Final rule set, scored against today's always-nominative reading** (ordinal case right):

| subset | nominative (today) | new |
|---|---|---|
| all n, excluding tra | .322 | .833 |
| n ≥ 3, excluding tra | .445 | .850 |
| everything | .288 | .755 |

Every rule beats the nominative it replaces wherever it fires. The digit-ordinal followers from Run 1 come out
25 of 26 right. The one miss was *divisioona*, which the `-oona` exception now handles; *päivien* (plural) gets a
singular genitive.

**The colon forms** (`9:nnen`, `11:nneksi`, `30:nneksi`) write the case out themselves. Now that the paradigm exists
they can be read exactly, from the suffix, with no guessing. Only the ordinal-specific suffixes (`nn…`, `nt…`, `tt…`)
are taken. `1:sten` (plural) and cardinal suffixes (`850:n`) stay with the existing refusal.

## Run 5 — 2026-10-15 23:40

**Implemented** in TS, C# and Rust: `ordinal(n, case)` (TS and C#) / `ordinal_case` (Rust), `ordinalCaseBefore`,
case agreement in the `N.` rule and the ordinal range, and step 6b for the oblique colon suffixes.

**Checks:**
- **Parity with the scratch reference** (`fiord.py` + `final.py`): all 10,989 forms (1–999 × 11 cases) and all
  56,387 distinct instrument words, 0 mismatches in TS and 0 of 67,376 in Rust. The Rust check was a temporary
  test reading the scratch TSV, deleted afterwards.
- **Probes:**
  - `2. kerran` ≡ `toisen kerran`; `3. sijalla` ≡ `kolmannella sijalla`.
  - `28. päivänä` → *kahdentenakymmenentenäkahdeksantena päivänä*.
  - `20.–24. päivänä`: both ordinals take the essive.
  - `9:nnen kerran` → *yhdeksännen*; `11:nneksi` → *yhdenneksitoista*.
  - Unchanged: `13. toukokuuta`, `15. sija`, `10. divisioona`, the sentence-final `1978.`, and the cardinal
    `850:n`.
- **fi golden:** 2 rows, one sentence on both paths. `syyskuun 16. päivään` read *kuudestoista päivään* and now
  reads *kuudenteentoista päivään*, the illative. That is the fix.
- **Guards:**
  - With `ordinalCaseBefore` forced to the nominative, 3 of the 4 new TS tests fail; the fourth is the paradigm,
    which doesn't depend on it.
  - 11 of the new C# tests fail.
  - The Rust test fails.

**Out of scope, recorded:**
- Plural agreement (*päivien* gets a singular genitive).
- The superlative idiom `2. suurin` (*toiseksi suurin*): the `-in` ending is shared with genitives like *albumin*,
  and the measurement favours the genitive.
- An ordinal before `ja` in a list (`2. ja 3. sija`) stays nominative.
