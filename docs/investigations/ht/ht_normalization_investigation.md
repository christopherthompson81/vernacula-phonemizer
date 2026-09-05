# ht (Haitian Creole) text normalization — investigation log

Branch `norm/ht`, from `fdab9b1`, in its own worktree. Method: `docs/normalization_playbook.md`.
(Scratch paths below are written as `/tmp/…`; they are throwaway files, not part of the repository.)

## Run 1 — 2026-08-11 21:42 — the baselines, emitted before touching anything

Playbook §"Working concurrently" rule 2: emit the "before" side while the tree still IS the baseline.

```
npx tsx tools/normalization/corpus-diff.ts emit --lang ht --corpus mined:ht --out /tmp/ht.before
  → emitted 439 utterances
npx tsx tools/referee-eval/eval.ts ht
  → raw exact 1645/1691 (97.3%) · folded backbone 1652/1691 (97.7%) · symbol accuracy 99.4%
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ht.jsonc --lang ht
  → DROP percent ×19 · currency ×18 · math-sign ×14 · exponent ×10 · minus ×10 · ampersand ×9 · degree ×8
npx tsx tools/normalization/review.ts --lang ht
  → 1 FAILING: normalizer src/languages/haitian/normalize.ts missing   (expected — nothing written yet)
npx tsx tools/normalization/sources.ts --lang ht
  → letter-names NONE (espeak does not ship ht) · decimal-point NONE · scale-names NONE
    percent/currency/minus/equals/ampersand/plus/exponent all `chk?`
```

Implication: seven DROP classes to answer, no espeak, and the only referee is wikipron `hat_latn_broad`.
`scale-names NONE` and `letter-names NONE` are the two structural blocks (initialisms are dead without a
letter table — playbook trap 16's data half).

## Run 2 — 2026-08-11 21:43 — a corpus to read, and how much of it is not Haitian

The committed artifact `tools/corpus/mined/ht.jsonc` is dump-sourced (265,368 segments) and carries
corpus-wide `counts`, but only ~440 lines of TEXT — too thin to read instances with (traps 2, 34, 37). So a
fresh dump, the ln recipe:

```
curl https://dumps.wikimedia.org/htwiki/latest/htwiki-latest-pages-articles.xml.bz2   (27.5 MB)
python3 tools/normalization/wikidump-to-text.py htwiki.xml.bz2 ht_paras.txt
  → pages seen 89,479 · 820,901 paragraph lines
python3 tools/normalization/filter-markup.py ht_paras.clean.txt
  → 820,901 → 800,158, dropped 20,743 (2.5%) of table/media residue
```

**The contamination question first, because this language invites it.** `filter-by-language.py` has no `ht`
row and its only adversary is ENGLISH, which is the wrong adversary for a French-lexified creole. So a
measurement-only classifier (scratchpad, not committed) scoring Creole function words that French does not
write — `yon nan ki li se te ak pou yo ap gen epi kote` — against French and English ones:

```
  short (<40 chars)          467,166  (58.4%)
  kept: ht                   154,110  (19.3%)
  dropped: french            120,473  (15.1%)
  dropped: undecidable        47,571  (5.9%)
  dropped: english            10,838  (1.4%)
```

**15.1% of ht.wikipedia's long paragraphs are FRENCH** — larger than the 12.9% English that motivated
`filter-by-language.py` on Sundanese, and concentrated in exactly the pattern-rich places (bibliographies,
`p. 22`, `n° 33`, `1er décembre`, `16ème siècle`). Implication: every count below is reported over BOTH the
whole dump and the Creole-only 154,110, and no rule is written from a count whose Creole share is not stated.
The artifact's own hard-set shows the same thing — its `year`, `decimals`, `dotted` and `clock` cells are
almost entirely English-language bibliography from the "Creole language" article's reference list.

## Run 3 — 2026-08-11 21:50 — the class tally, both corpora

`scratchpad/tally.ts` over the whole dump and the Creole-only subset (counts = occurrences):

```
class                  all   ht-only  ht%        class              all  ht-only  ht%
percent  N%           1686     1449   86%        range hyphen     15665     2717   17%
currency $             233      148   64%        fraction n/m       212       69   33%
currency €              18       14   78%        ordinal  Nyèm     1661     1259   76%
currency £              13       12   92%        ordinal  Nè/Nem   1547      942   61%
degree   °             943      276   29%        clock d:dd         252       58   23%
degree   °C             52       52  100%        math =           93254      304    0%
numero   n°            506       45    9%        math ×             185       32   17%
exponent ²             577      131   23%        zero-width         364      333   91%
exponent km2            60       60  100%        km                 804      401   50%
minus leading          304      126   41%        m                  970      465   48%
ampersand &           1550      339   22%        cm/kg              218       60   —
grouped , / . / space 7744/410/733  3861/321/577  ISBN              593       70   12%
decimal  , / .        1039/2393     585/1443      p./pp.            564       68   12%
```

Implication: percent is the biggest class by a wide margin and 86% Creole; ranges and `n°` and `=` are
mostly NOT Creole and must not be written from their raw counts. `°C` and `km2` are 100% Creole.

## Run 4 — 2026-08-11 21:55 — the degree sign does FIVE jobs here, one more than Lingala's four

`scratchpad/degclass.ts`, over the 276 Creole-text `°`:

```
coordinate                80   `17°29′57″ S`, `52°21′ S`, `(37°21' N)`
number + ° (angle)        59   `23°`, `180 °`, `yon ang 50-53 °`, `meridyen 53° O`
scale °C/°F               57   `15 ° C a 35 ° C`, `−20°C`, `26 °C`
numero n°                 45   `Symphonie n°1`, `wout nasyonal N ° 1`
birth marker (° )         28   `Maurice Chevalier, aktè ak chantè fransè (° )`, `(° 1657)`
other                      7
```

The BIRTH MARKER is the one Lingala did not have: on a French/Dutch-influenced wiki `(°)` opens a
date-of-birth in an anniversary list, and its partner is `(† )` or `(+ 1987)`. Reading either as a degree or
a plus would be nonsense. Implication: the degree rule needs a `(`-lookbehind guard and an `n`-lookbehind
guard, and the plus is disqualified outright by its 55 `(+ 1987)` death markers.

## Run 5 — 2026-08-11 22:00 — sourcing, all from the corpus's own prose

Every word below was read back to its instances (trap 37: the bare modifier is never the attestation).

| slot | word | evidence | count |
|---|---|---|---|
| percent | `pousan` | `90 pousan nan bidjè`, `78 pousan nitwojèn, 21 pousan oksijèn ak 0.03 pousan diyoksid kabòn` — postposed | 82 |
| dollar | `dola` | `90 milyon dola`, `$ 120 milyon dola`, `$19,97 milya dola` — postposed | 493 |
| degree | `degre` | `60 degre latitid nò`, `40 a 50 degre Farenheit` | 180 (polysemous — see below) |
| Celsius | `degre Sèlsiyis` | ⭐ `yon tanperati mwayèn 25 °C (25 degre Sèlsiyis)` — the corpus GLOSSES the symbol | 16 |
| decimal pt | `vigil` | ⭐ `yon rezilta ki gen senkant (,50) apre yon vigil`; `awondi … a twa chif apre vigil la`; `nan katriyèm chif apre vigil la`; `san siy ak san vigil` — four decimal-sense hits in four articles | 19 |
| km² | `kilomèt kare` | `239,567 kilomèt kare`, `20 kilomèt kare` | 24 |
| m² / m³ | `mèt kare` / `mèt kib` | `1000 mèt kare`, `100 milyon mèt kib bwa` | 11 / 3 |
| km, m, cm, kg | `kilomèt mèt santimèt kilogram` | `45 kilomèt`, `2,680 mèt`, `uit santimèt`, `15 kilogram` | 210/665/34/16 |
| range | `a` | `soti nan 1942 a 1945`, `1 a 1,5m`, `50cm a 1,80m` | 398 digit-a-digit |
| numero | `nimewo` | `li te rive nan nimewo 117 sou Billboard 200 la ak nimewo 50` | 381 |
| ampersand | `ak` | the ordinary conjunction | — |
| fraction | ordinal idiom | `prèske yon senkyèm se mizilman`, `yon dizyèm milimèt`, `de tyè`, `twa ka` | — |
| BCE | `anvan Jezi Kris` | ⭐ `anviwon ane 12 800 anvan Jezi Kris (av. J.-K.)` — the corpus glosses its own abbreviation | 87 |

⚠ **`degre` ×180 is trap 37 exactly**: the bare word is mostly "degree/extent" (`yon gwo degre nan pouvwa
politik`, `reklamasyon divès degre`). What licenses the rule is the COLLOCATION — `degre Sèlsiyis` ×16 and
`degre latitid` ×2 — never the bare count.

⚠ **`pwen` ×441 is the same trap, and it is the word a French-first guess would have reached for.** Every
instance is SPORTS/SCORE points (`250 pwen`, `3 pwen yo`, `48 nan 50 pwen posib`, `17 pwen pousantaj`), not
a decimal point. Zulu's `amaphuzu` in Haitian dress.

## Run 6 — 2026-08-11 22:05 — the ordinal, which is this language's own and not French's

`Nyèm` ×1,259 Creole (+ `Nèm`/`Nem` variants). Unlike Lingala — where all 235 `16ème` were inside French
text — this is native Haitian orthography, and the corpus writes the whole series out in words:

```
premye 6723 · dezyèm 10983 · twazyèm 515 · katriyèm 200 · senkyèm 151 · sizyèm 94 · setyèm 76 ·
wityèm 34 · nevyèm 53 · dizyèm 86 · onzyèm 8 · douzyèm 31 · trèzyèm 13 · katòzyèm 8 · kenzyèm 14 ·
sèzyèm 18 · disetyèm 9 · dizwityèm 23 · diznevyèm 35 · ventyèm 40 · trantyèm 5 · karantyèm 3 ·
senkantyèm 1 · swasantyèm 2 · katrevendizyèm 1 · santyèm 6 · milyèm 1
    venteyenyèm 0 · swasanndizyèm 0 · katrevenyèm 0
```

And it glosses itself: `prezante pa 13èm (trèzyèm) Dalai Lama`.

The engine reads `20yèm` today as *ven* + a separate *yèm* — the [t] of *ventyèm* is simply missing — so the
rule has to build the WORD (trap 14's fix shape: convert the operand to words inside the rule).

**The rule is a LONGEST-SUFFIX rewrite of the final cardinal word, and it composes.** Applying the 22
attested pairs above as tail rewrites reproduces every attested form and derives the unattested ones the
same way the attested compounds are derived: `disèt`→`disetyèm` ✓attested, `dizuit`→`dizwityèm` ✓attested,
`diznèf`→`diznevyèm` ✓attested, `katrevendis`→`katrevendizyèm` ✓attested; and then `swasanndis`→
`swasanndizyèm`, `swasannonz`→`swasannonzyèm`, `katreven`→`katreventyèm` fall out for free.

**And the refusal falls out for free too.** `venteyen` (21) and `katrevenen` (81) end in `-en`, which is not
a key, so nothing matches and the rule declines — `21yèm` ×22, `31yèm` ×6, `41/51/61/81yèm` ×~8. That is
exactly the set an independent source (howtocreole.com, "numbers ending in 1 … end in -eyinyèm, except 71st
and 91st which end in -onzyèm") calls irregular, and the corpus writes none of them. Two independent
descriptions agreeing on where the regularity stops is the strongest thing available here; a form nothing
attests is left unread rather than guessed. That same source's other two statements — multiples of ten in
`-tyèm` except 70th/90th in `-dizyèm` — are exactly what the composition produces, which is the check that
made me trust the composition rather than the source.

## Run 7 — 2026-08-11 22:10 — three refusals, each with the measurement that forced it

- **MINUS — declined, and this is the KNOWN-WRONG kind, so it stays RED.** 126 leading-minus instances in
  Creole text: ~36 BCE years (`etabli nan -509`, `-153:`, `ant -451 ak -429`), 6 temperatures (`−20°C`,
  `−4 °C`, `-17.2°C`), ~10 in maths prose, the rest range second-halves and template residue. There IS a
  citation, and it is a real self-gloss: `2+ (-2) = 0 i.e de plis (mwen de) fè zewo … (-2) se mwen de ou
  byen zewo mwen de`. But the word it gives is `mwen`, which is Haitian for **"I / me"** — the commonest
  word in the language — and the language's actual comparative is `mwens` ×569, never once digit-adjacent.
  One sentence, in one article, proposing a reading that is homographic and homophonic with the 1SG pronoun,
  is not enough to put `mwen de` in a speaker's mouth for `-2`. Recorded with the citation so the next
  reader can reopen it rather than re-derive it. NOT added to `ACCEPTED_SILENT`: the silence inverts the
  value, so a green gate here would be a lie (the Lingala precedent, same argument).
- **PLUS — declined, and here the corpus disqualifies the word rather than merely failing to supply it.**
  55 leading-plus instances and the largest single class is `(+ 1987)` / `(† 1867)` — the DEATH marker
  paired with the `(° )` birth marker in anniversary lists. Next is binary arithmetic tables
  (`0 + 0 = 0 0 + 1 = 1`). Omitting a plus is lossless; reading a death marker as *plis* is not.
- **CLOCK — declined.** 58 colon-numerals in Creole text and the majority are SCRIPTURE references
  (`Travay 11:25-26`, `Levitik 25:10`, `Matye 16:18`, `Mak 9:45`), then song durations (`2:14`, `3:10`);
  exactly two are true clocks (`nan 4:53 pm`, `apeprè 8:15`). Claiming the colon claims the references.
  The Lingala finding, reproduced in a different corpus.
- **BARE `è` ORDINAL — declined, on an ambiguity the other suffixes do not have.** `\d+\s?è` ×129 is BOTH
  the ordinal (`16è ak 17è sièk`, `27è moun`) and the HOUR (`bò 4è aprè midi`, `23 è 56 minit 4 segonn`).
  `yèm`/`èm`/`em` carry no such collision and are what the rule claims. Trap 9: a guard widened to a shape
  you cannot disambiguate manufactures misfires.
- **`€` ×14 and `£` ×12 — declined for want of a settled spelling.** The euro word is written `ero` ×22 and
  `ewo`, and `ewo` ×145 is overwhelmingly **"hero"** (`ewo endepandans Ayiti`) — trap 37 again. No pound word
  is attested at all. `$`→`dola` ships; the other two stay silent and are listed by instance in `defects.ts`.

## Run 8 — 2026-08-11 22:05 — the rule sequence, written and probed against its own branches

`src/languages/haitian/normalize.ts`, 13 numbered steps. Probed with `scratchpad/probe.ts` (56 real corpus
shapes) plus a full enumeration of the ordinal's branches (playbook trap 13: diff the rule against itself).
The enumeration is what validated the composition — every attested form reproduced, and the refusal landing
exactly on the `-en` band:

```
1:premye 2:dezyèm 3:twazyèm 4:katriyèm … 17:disetyèm 18:dizwityèm 19:diznevyèm 20:ventyèm
21:—DECLINED 22:venndezyèm … 28:ventwityèm 29:ventnevyèm 30:trantyèm 31:—DECLINED …
70:swasanndizyèm 71:swasannonzyèm 80:katreventyèm 81:—DECLINED 90:katrevendizyèm 91:katrevenonzyèm
99:katrevendiznevyèm 100:santyèm 101:—DECLINED 145:san karannsenkyèm 1000:milyèm
```

Two defects the probe found before any gate did:

- **`US$200.000` came out as a bare *de san mil*.** The rule replaced the whole `US$`, so removing a symbol
  deleted a spoken word — trap 10. The code is re-emitted now.
- **`10.4 milyon km 2` left `km` and `2` raw.** Two separate gaps: a MAGNITUDE WORD standing between the
  number and its unit (the shared tier's `magAltU` hop, done locally here), and the exponent SET OFF BY A
  SPACE (`km 2`, `km ²`). Both are in the corpus; both are now claimed.

## Run 9 — 2026-08-11 22:09 — the corpus diff, which earned its keep again

```
npx tsx tools/normalization/corpus-diff.ts emit --lang ht --corpus mined:ht --out /tmp/ht.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/ht.before --after /tmp/ht.after
  changed 150/439 (34.2%)
  before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 78, THROW: 0 }
  after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 23, THROW: 0 }
```

**And reading the 150 changes — not the counts — found two more defects, both invisible to every probe:**

- `$ 630 millions` read as ***630 DOLA millions*** — the currency audible in the WRONG SLOT, which is the
  Indonesian `US$` failure this playbook records verbatim. The magnitude word is part of the quantity and
  has to be carried over before the noun is appended. ⚠ The list needs the FRENCH plurals in it, because
  the sentence that produced this is itself French-influenced: `6,6 milliards ak $ 630 millions`.
- `($1,00) dola ameriken` read as ***…dola DOLA ameriken*** — the redundancy guard looked at the character
  after the figure, found a CLOSING BRACKET, and never saw the word the sentence had already said.

⚠ And fixing the first introduced a third, caught on the re-probe: a regex alternation is leftmost-first,
so `mil` listed ahead of `millions` matched three letters of `630 millions` and emitted ***630 mil
dolalions*** — a word cut in half. Longest alternative first.

Re-emitted after the fixes: still 150/439 changed, DROP 78 → 23, and no DIGIT / RAWMARK / SLOT-GAP / THROW
in either direction.

## Run 10 — 2026-08-11 22:12 — attest.ts, which confirmed the two biggest words from outside the dump

```
npx tsx tools/normalization/attest.ts --lang ht --words pousan,vigil,dola,degre,nimewo
  word     token  arts  substr-only  verdict
  pousan     50    20     0          attested
  vigil      27    16     0          attested
  dola      129    20     0          attested
  degre      34    19     0          attested
  nimewo     94    19     0          attested
```

The examples are better than the counts, and two of them are outright symbol glosses:

- `Degre Sèlsiyis (senbòl °C) se inite a nan echèl la tanperati Sèlsiyis` — the article on the unit names
  the SYMBOL and its reading in one clause.
- `siy ki reprezante dola ($) ranplase kantite nan kòb peyi sa yo` — "the sign that represents *dola* ($)".
- `Pousan se yon pa nan san` — a dictionary-style definition, "*pousan* is a part in a hundred".
- `Nimewo Entènasyonal Nòmalize Liv` — the Creole expansion of ISBN.

⚠ **`vigil` is the one that needed the sense check, and it survives it with a caveat worth recording.** Of
its 27 hits, some are a Cuban town and several are Spanish surnames in a telenovela cast list. What carries
it is two independent non-name senses: the maths article's decimal use, and a GRAMMAR article listing the
mark's synonyms — `separe ak vigil (vègil, pwen-vig, elatriye)`. So the word is real and means the comma;
the competing spellings `vègil` / `pwen-vig` are recorded here rather than chosen between, and the reading
that ships is the one the maths article puts in the decimal slot.

## Run 11 — 2026-08-11 22:14 — the gates, before and after

| gate | before | after |
|---|---|---|
| `npx vitest run` | 236 files / 3587 pass | **236 files / 3588 pass, 5 skipped** |
| `npx tsc --noEmit` | clean | clean |
| `referee-eval ht` | 1645/1691 raw · 97.7% folded · 99.4% symbol | **identical** (a word-list referee cannot see a symbol layer; stated so nobody reads "no change" as "not run") |
| `corpus-diff` DROP | 78 | **23**, 150/439 utterances changed |
| `mine.ts scan` | percent ×19 · currency ×18 · math-sign ×14 · exponent ×10 · minus ×10 · ampersand ×9 · degree ×8 | **minus ×10 only** (math-sign ×14, currency ×1, exponent ×1 ACCEPTED by instance; currency ×2 REDUNDANT) |
| `review.ts --lang ht` | 1 FAIL (no normalizer) | **2 FAIL, both the minus** — deliberate, see Run 7 |
| `sources.ts --lang ht` | percent/currency/minus/… all `chk?` | unchanged (it reads DATA declarations; ht declares its words in `normalize.ts`) |
| catalogue | `ht` normalization cell empty | `done` — `derive-normalization.py` then `build.py`, `languageCatalogue.test.ts` green |

**The two red gates are the result, not an unfinished edge.** `review.ts` fails on `minus` because Haitian
has no attested word for a negative number and the silence INVERTS the value; accepting it would turn a
known-wrong reading into a green checklist. Trap 24: a red gate that is correct beats a green gate that is
wrong.

## Run 12 — 2026-08-11 22:14 — what a second pass should look at first

- **The de-grouping cost.** `\d{1,3},\d{3}` is grouping 3,861 times and a decimal a handful of times; the
  clearest casualty is `365,256 jou solè` (the sidereal year), now read as an integer. Re-measurable in one
  grep, and the ratio is stated in the step-4 comment rather than hidden.
- **`°F` ×6**, blocked on two spellings with one instance each (`Farenheit`, `Farennayt`).
- **`km/h` ×9**, blocked on the per-hour idiom, not on `kilomèt`.
- **The `-en` ordinals** (`21yèm` ×22 and ~14 more), blocked on one blog's `-eyinyèm` and nothing else.
- **`€` ×14 / `£` ×12**, blocked on `ewo` colliding with "hero" and on no pound word existing.
- **The minus**, blocked on `mwen` being the 1SG pronoun. A Haitian maths textbook would settle all of the
  last three; the wiki has been asked and has answered as much as it can.
