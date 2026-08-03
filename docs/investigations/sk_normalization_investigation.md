# Slovak (sk) text-normalization investigation (#562)

Chronological. Each run: the command, the question it was meant to answer, the raw finding, the implication.

Corpus: FLEURS `sk_sk`, `/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/sk_sk/{train,dev,test}.tsv`,
**column 3** (cased) — 1,719 unique utterances. Mined artifact: `tools/corpus/mined/sk.jsonc` (already
committed, 1,714 segments, 24/30 cells).

---

## Run 1 — 2026-08-02, the BEFORE baseline

```
npx tsx tools/normalization/corpus-diff.ts emit --lang sk --corpus sk_sk --out /tmp/sk.before
```

Question: pin the pre-change reading of the whole corpus before touching anything (playbook §"Working
concurrently", rule 2 — three other agents are in sibling worktrees, so `git stash` is forbidden and the
baseline must come from my own untouched tree).

Raw finding: `emitted 1719 utterances → /tmp/sk.before`.

Implication: the diff gate is armed. Everything below is measured against it.

---

## Run 2 — 2026-08-02, shape tabulation

```
awk -F'\t' '{print $3}' .../sk_sk/*.tsv | sort -u > sk.txt        # 1719 lines
python3 (regex tabulation over sk.txt)
```

Question: what does the corpus actually write?

Raw finding (count, then the distinct surface forms):

| shape | n | forms |
|---|---|---|
| space-grouped thousands | 42 | `11 000`, `4 800`, `2 500`, `6 387`, `3 850`, `19 500`, `2 243` … |
| period-grouped thousands | **0** | — |
| comma decimals | 17 | `1,5` ×3, `2,2`, `2,8`, `7,7`, `2,4`, `5,0`, `7,75` … |
| `N.` (period after a digit run) | **106** | see Run 3 |
| clock (colon) | 16 | `06:30`, `23:35 hod`, `1:15`, `8:46`, `22:08`, `07:19` … |
| clock (period) | 1 | `12.00 GMT` |
| percent | 4 | `3 %` (NBSP), `88 %`, `93 %`, `80 %` |
| degree | 1 | `+30°C` |
| currency | 2 | `11 000 $`, `22 500 $` (sign POSTPOSED) |
| ranges (dash) | 6 | `160 – 320`, `1418 – 1450`, `1000–1300`, `10–60`, `6-6`, `22:00 - 23:00` |
| `x`/`×` between digits | 5 | `4x4` ×2, `6x6`, `56x56`, `36x24` |
| `+` before a digit | 1 | `+30°C` |
| `&` | 1 | `B&B` |
| slash | 1 | `1995/96` (a SEASON, not a fraction) |
| units | 41 | `km` ×24, `mm` ×6, `cm`, `m` ×3, `kg` ×3, `GHz` ×2 |
| rate / exponent | 8 | `km/h` ×6, `km²` ×2, plus `míľ/h` ×1 |
| era markers | 7 | `pred n.l.`, `pred n. l.` ×2, `n. l.` ×3, `p.n.l.` |
| `n. m.` (above sea level) | 1 | `4892 m n. m.` |
| dotted abbreviations | 22 | `tzv.` ×6, `atď.` ×6, `napr.` ×3, `Jr.` ×3, `t.j.`/`t. j.` ×2, `Dr.` ×2, `č.` ×1 |
| all-caps initialisms | 117 | `USA` ×16, `OSN` ×6, `USD`/`UNESCO`/`HDP` ×3 … |
| relational signs `= < > ÷ ≈` | 0 | — |

Implication: Slovak's crux is the **`N.`** — 106 instances, more than every other shape combined — and the
**space** thousands separator (42). There are **zero period-grouped thousands**, which is the opposite of
Croatian and removes half of the disambiguation problem the brief anticipated.

---

## Run 3 — 2026-08-02, the `N.`-follower tabulation (the evidence the ordinal rule rests on)

```
python3: for each match of (?<![\d.,])(\d{1,4})\. — classify what follows
```

Question: which of the 106 `N.` are ORDINAL markers and which are sentence periods? (Playbook trap 4, the
German method; and Croatian #599's defect — a closed licensor list claimed only half its corpus.)

Raw finding:

```
total N. instances: 106
  lower                                  65
  EOL                                    31
  DIGIT-immediately (version/dot-clock)   6
  UPPER                                   2
  other: “                                1
  other: ,                                1
```

Followers, verbatim:

```
--- lower (65) ---
      7  storočia          4  augusta           1  októbra           1  svetovej
      6  septembra         4  a                 1  mieste            1  storočí,
      6  storočia.         3  rokoch            1  kategórie         1  rokov
      6  júla              2  marca             1  storočím          1  januára,
      5  storočí           2  storočí.          1  februára.         1  typu
      5  augusta.          2  januára.          1  najväčším
      2  storočia,         1  júna              1  gólom
                                                1  najväčšou
--- EOL (31) ---
     31  <EOL>
--- UPPER (2) ---
      1  Tieto             1  Niektoré
--- other:“ (1) --- 1
--- other:, (1) ---  1
--- DIGIT-immediately (6) ---
      2  11n     1  00     1  11a,    1  11b    1  11g.
```

Every EOL instance, verbatim (this is the list that must NOT be claimed):

```
[EOL] 1500. ...datuje okolo roku 1500....        [EOL] 2007. ...hypotekárnej krízy v roku 2007....
[EOL] 16.   ...na turistov z jeho pušky M16....  [EOL] 2009. ...Veľkej ceny Maďarska 2009....
[EOL] 1835. ...Charles Darwin v roku 1835....    [EOL] 2009. ...minimálne po zvyšok sezóny 2009....
[EOL] 1839. ...sa datuje od roku 1839....        [EOL] 2009. ...po Veľkej cene Maďarskav roku 2009....
[EOL] 19.   ...sezónu pre obavy z COVID-19....   [EOL] 2010. ...atlantických hurikánov za rok 2010....
[EOL] 19.   ...pozitívny test na vírus COVID-19. [EOL] 2011. ...prešla oboma komorami v roku 2011....
[EOL] 1958. ...v roku 1945 a zostal do roku 1958 [EOL] 2011. ...niektoré sa konali od roku 2011....
[EOL] 1964. ...kde sa hry konali v roku 1964.... [EOL] 2012. ...na londýnskej olympiáde v roku 2012.
[EOL] 1967. ...pred Šesťdňovou vojnou v roku 196 [EOL] 2016. ...ktoré unikli do novín na jar 2016....
[EOL] 1979. ...Sovietov do Afganistanu, 1979.... [EOL] 2016. ...ceny za literatúru za rok 2016....
[EOL] 1998. ...dokumentoval v knihe z roku 1998. [EOL] 2017. ...prevádzky bola daná až v marci 2017.
[EOL] 2.    ...proti Kanaďanovi je 7:2....       [EOL] 2020. ...stále aktívnych v roku 2020....
[EOL] 2.    ...čísel, sa preto hovorí 3:2....    [EOL] 243.  ...druhý Johnson s počtom bodov 2 243.
[EOL] 2006. ...MS FIFA v roku 2006....           [EOL] 30.   ...odchádza medzi 06:30 a 07:30....
[EOL] 4.    ...s pohonom 4x4....                 [EOL] 76.   ...uzemnilo lietadlá typu Il-76....
[EOL] 9.    ...čerpacej stanice Fort Greely 9....
[UPPER] 1.    ...t.j. 0 alebo 1. Tieto čísla...
[UPPER] 2021. ...od 24. augusta do 5. septembra 2021. Niektoré podujatia...
[other:“] 2005. ...v porovnaní s hladinou v roku 2005.“
[other:,] 11.  ...európskych dejín v 11., 12. a 13. storočí...
```

**The finding that decides the rule, and the divergence from Croatian.** Every one of the 31 EOL periods,
and both UPPER ones, is a SENTENCE PERIOD — including the fourteen that sit right after a YEAR
(`v roku 1835.`, `sezóny 2009.`, `za rok 2010.`). That is because **Slovak, like Czech and unlike
Croatian/Serbian, reads a year as a CARDINAL** (`v roku 1835` = *v roku tisíc osemsto tridsaťpäť*) and
writes it with **no ordinal period at all**. Croatian's `1683. dinastija` — a feminine-genitive ordinal
with *godine* elided — has no Slovak counterpart, and the year-ordinal rule that #599's review demanded of
Croatian would, applied here, destroy fourteen sentence-final pauses.

So the discriminator is the plain one, and it is exactly the German/Czech one: **a `N.` followed by a
lowercase word or a comma is an ordinal; a `N.` followed by an uppercase word, a closing quote, or the end
of the utterance is a sentence period.** 65 + 1 = **66 claimable**, 31 + 2 + 1 = **34 sentence periods
preserved**, 6 digit-adjacent (a version dot `802.11` ×5 and the period clock `12.00` ×1, both claimed by
their own earlier rules).

The 66 also give the CASE, because in every instance the licensing noun is written: `storočia/storočí/
storočím` (neuter century), the month genitives, `rokoch/rokov` (decades), `mieste`, `kategórie`, `gólom`,
`najväčším/najväčšou`, `svetovej`, `typu`. Slovak ordinals are adjectives and must agree, so the rule reads
the following word.

Implication: two ordinal steps — a licensed one that inflects (with list handling for `11., 12. a 13.
storočí` and `19. a začiatku 20. storočia`), then a general one that emits the masculine nominative for
anything the licensor list does not know. The general step claims **0** corpus instances today; it exists
because trap 8 says a closed list is correct exactly where you looked.

---

## Run 4 — 2026-08-02, probing the current engine

```
npx tsx probe.scratch.ts "<38 attested forms>"
```

Question: what does the engine produce TODAY on each attested shape? (Playbook step 2 — the defect list is
what the engine produces, not what I assume.)

Raw finding (verbatim before-readings):

```
V 16. storočí sa Paraguaj.  -> v ʃˈestnaːsc . stˈɔrɔt͡ʃiː sˈa …     ordinal read as CARDINAL + a phrase break
15. augusta 1940 …          -> pˈætnaːsc . ˈauɡˌusta cˈisiːt͡s …
V 60. rokoch 20. storočia.  -> v ʃˈezɟɟesɪ̯at . rˈɔkɔx dvˈatsac . stˈɔrɔt͡ʃɪ̯a .
na 190. mieste              -> nˈa stˈɔ ɟˈevæɟɟˌesɪ̯at . mˈɪ̯esce
1. a 2. svetovej vojny      -> jˈeɟen . ˈa dvˈa . svˈetɔvej vˈɔjni
je 7:2.                     -> jˈe sˈeɟem , dvˈa .                  clock colon = a phrase break
1:15 ráno                   -> jˈeɟen , pˈætnaːsc rˈaːnɔ           and MASCULINE jeden with feminine hodina
o 12.00 GMT                 -> ˈɔ dvˈanaːsc . nˈula ɡmt
802.11n                     -> ˈɔsemstɔ dvˈa . jˈeɟenaːsc n
2,4 GHz a 5,0 GHz           -> dvˈa , ʃtˈiri kxs ˈa pˈæc , nˈula kxs   decimal comma = break; GHz = [kxs]
88 % čistých bodov          -> ˈɔsemɟˌesɪ̯atˌɔsem t͡ʃˈistiːx …      % DROPPED
nad +30°C                   -> nˈat trˈitsac t͡s                    + and ° DROPPED, C read as a letter
64 km/h (40 míľ/h)          -> ʃˈezɟɟesˌɪ̯atʃtiri km x ʃtˈiritsac mˈiːʎ x   km raw, /h read as [x]
19 500 km²                  -> ɟˈevætnaːsc pˈæcstɔ km               ² dropped, and the SPACE split the number
4 800 km od Miami           -> ʃtˈiri ˈɔsemstɔ km ˈɔt mˈɪ̯ami       "štyri osemsto", not "štyritisíc osemsto"
od 11 000 $ do 22 500 $     -> ˈɔt jˈeɟenaːsc nˈula dˈɔ dvˈatsaɟdva pˈæcstɔ   $ DROPPED; "jedenásť nula"
B&B súťažia                 -> p p sˈuːcaʒɪ̯a                       & DROPPED
160 – 320 km/h              -> stˈɔ ʃˈezɟɟesɪ̯at trˈistɔ dvˈatsac km x   dash DROPPED, endpoints fused
1000–1300 n.l.              -> cˈisiːt͡s cˈisiːt͡s trˈistɔ n . ˈl̩ .    era marker = two bogus words + 2 breaks
356 pred n.l.               -> trˈistɔ pˈæɟɟesˌɪ̯atʃesc prˈet n . ˈl̩ .
36x24 mm                    -> trˈitsacʃesc ks dvˈatsacʃtˌiri mː    x read as the LETTER [ks]
35 mm film                  -> trˈitsacpæc mː fˈilm
medzi 06:30 a 07:30.        -> mˈed͡zi ʃˈesc , trˈitsac ˈa sˈeɟem , trˈitsac .
2 243.                      -> dvˈa dvˈestɔ ʃtˈiritsˌactri .        space-split; the final . is CORRECT
typu Il-76.                 -> tˈipu ˈil sˈeɟemɟˌesɪ̯atʃesc .       correct today; must stay correct
Charles Darwin v roku 1835. -> … v rˈɔku cˈisiːt͡s ˈɔsemstɔ trˈitsacpæc .   correct today; must stay correct
```

Implication: every sign class the fleet scan reported (percent, degree, math signs, currency) is genuinely
dropped, plus `&`. The space-thousands defect is worse than the count suggests — `11 000 $` reads *jedenásť
nula*, i.e. the number is not merely mis-grouped, it is unrecognisable.

---

## Run 5 — 2026-08-02, sourcing the words (playbook §5c, §5e)

Question: where does each word this layer will emit come from?

Sources consulted: the corpus itself (token counts over sk.txt), and
`/home/chris/Programming/espeak-ng/dictsource/sk_list` (READ, never invoked).

Corpus attestation (`grep -oiE`, counts):

```
percent 11 · percento 1 · percentami 1 · percentnou 1        stupňov 2 · stupeň 2 · stupne 4
dolárov 3 · doláre 1 · dolárových 1                          kilometrov 12 · kilometra 1 · kilometre 1
hodín 5 · hodinu 5 · hodiny 3 · hodinách 3                   minút 9 · minútu 3 · minúty 1
krát 13 · delené 1 · menší 2 · väčší 7 · rovná 1             libra 1 · plus 1 · tisíc 5 · tisíce 4
"pred naším letopočtom" — SPELLED OUT in the corpus ("Egypťania v treťom storočí pred naším letopočtom")
"míľ za hodinu" — SPELLED OUT in the corpus ("rýchlosť 105 míľ za hodinu (165 km/h)")
```

espeak `sk_list` symbol names (the raw upstream Slovak data):

```
_$ dolár   € euro   £ libra   ¥ jen   ¢ cent   × krát   ÷ delené   ° stupňou   − mínus   ± plus mínus
_< menší   _> väčší   _, čiarka   _. bodka   _/ lomka   ½ polovica   ¼ štvrtina   ¾ tri štvrtiny
_≈ približne sa rovná
```

Raw finding: every high-traffic word this layer needs is attested in the corpus, in espeak's Slovak
dictsource, or in both. The two that are in neither — `gigahertz` and `štvorcových` — are a unit borrowing
and a unit adjective, and `units` is excluded from the §5e sourcing check for exactly that reason.

**`mínus` is the one word absent from the corpus.** It comes from espeak's `−` entry (`mi:nus`). Kept,
because the alternative is dropping the sign, and a negative that reads as a positive is the one outcome
that cannot be right.

**The decimal word is `čiarka`** — espeak's Slovak name for the comma, and the same choice Czech made
(`čárka`) for the same separator. Slovak also says *dva celé štyri*; `celá` was rejected because it agrees
(*jedna celá / dva celé / päť celých*) and `čiarka` does not.

Implication: no invention needed. Fractions are the one place where a table would have to be part-invented
— see Run 8.

---

## Run 6 — 2026-08-02, the clock's governing preposition

Question: Czech reads a clock as *cardinal + counted noun* (`8:46` → osem hodín štyridsaťšesť minút). Is
that the Slovak idiom?

Raw finding — all 16 colon clocks plus the one period clock, with their governor:

```
o 1:15 · o 11:20 · o 8:46 · o 20:30 · o 12:00 · o 12.00 · o 22:08 · o 07:19 · o 21:19   (9 × "o")
po 11:00 · do 23:35 hod                                                                 (2)
medzi 06:30 a 07:30 · medzi 22:00 - 23:00                                               (2 × "medzi", 4 clocks)
(15:00 univerzálneho koordinovaného času)                                               (1, ungoverned apposition)
26:00  ← NOT a clock: "zvíťazila 26:00 nad Zambiou" is a SCORE
```

Implication: **14 of the 15 real clocks are governed by a preposition**, and Slovak reads a governed clock
as a FEMININE ORDINAL hour agreeing with the elided *hodina*: `o` / `do` / `po` govern loc/gen, both `-ej`
(*o ôsmej štyridsaťšesť*); `medzi` governs the instrumental `-ou` (*medzi šiestou tridsať a siedmou
tridsať*). So the clock rule takes the governor into account, and only an ungoverned clock falls back to
the neutral cardinal + counted *hodín*. `26:00` is excluded by the hour ≤ 23 guard, which is what stops the
rule claiming a football score.

---

## Run 7 — 2026-08-02, enumerating the ordinal's BRANCHES (trap 13)

```
npx tsx ord.scratch.ts     # ordinalWords 1..30, 37, 60, 70, 80, 100, 190, 200, 1918 × every slot
```

Question: the corpus exercises the table (1–19) and a handful of tens; does the COMPOSITIONAL path work?

Raw finding: see Run 9 below for the printed table (it is re-run after the code exists). Two things the
enumeration settled before any test was written:

- **Slovak compound tens+units inflect BOTH elements**: `24. augusta` is *dvadsiateho štvrtého augusta*,
  not *dvadsaťštyri augusta* and not *dvadsiaty štvrtého*. The hundreds prefix does NOT: 190th is
  *sto deväťdesiaty*, with `sto` staying cardinal.
- **The ending set is chosen by the citation form's final vowel LENGTH**, which is the Slovak rhythmic law
  in one line: `prvý`→`prvého` but `siedmy`→`siedmeho`, `ôsmy`→`ôsmeho`, `piaty`→`piateho`,
  `dvadsiaty`→`dvadsiateho`, `jedenásty`→`jedenásteho`. A long ending after a long syllable is
  ungrammatical, and every ordinal from 5 up whose stem carries a long nucleus takes the short set. Encoding
  it as "does the citation form end in ý or y" makes it mechanical instead of a second table.
- `tretí` is the only SOFT ordinal in 1–999 and gets an explicit form table (`tretieho`, `treťom`, `tretej`,
  `treťou`, `tretia`, `tretie`, `tretích`) rather than a derivation, because its loc/instr palatalise.

---

## Run 8 — 2026-08-02, what was deliberately NOT done

- **Initialisms (117 instances).** `USA` reads `[ˈusa]`, `OSN` `[osən]`. Fixing this needs a LEXICAL list of
  which Slovak acronyms are letter-spelled and which are said as words, which is exactly the data the
  playbook says not to bulk-invent, and it is a separate seam (`core/initialisms.ts`). Croatian shipped
  without it too. Left for a follow-up.
- **`1995/96`** (the corpus's only slash) is a SPORTS SEASON, not a fraction. The fraction rule is bounded
  to a ≤3-digit numerator so it cannot claim it; the slash stays dropped, which fuses two year-words. A
  season reading is its own rule and there is one instance.
- **`St. Louis`** (1 instance): the dot is a spurious break. Slovak has no settled reading for the
  abbreviation in this place name (*Svätý Louis* is wrong; speakers say the English name), so it is left.
- **Fractions above denominator 10** return the text unchanged rather than guess a derivation.
- **Case on the general ordinal fallback and on `tzv.`**: the masculine-nominative citation form is emitted
  where the following word does not disclose the case. Same trade Czech documents — the right lexeme with
  the wrong ending beats the wrong word.

---

## Run 9 — 2026-08-02, branch enumeration after the code exists

```
npx tsx ord.scratch.ts
```

Question: read the ordinal function's own output across a range, per trap 13's "diff the rule against
itself".

Raw finding:

```
  1 prvý            m.gen prvého          f.gen prvej         pl.gen prvých       n.loc prvom
  2 druhý           m.gen druhého         f.gen druhej        pl.gen druhých      n.loc druhom
  3 tretí           m.gen tretieho        f.gen tretej        pl.gen tretích      n.loc treťom
  4 štvrtý          m.gen štvrtého        f.gen štvrtej       pl.gen štvrtých     n.loc štvrtom
  5 piaty           m.gen piateho         f.gen piatej        pl.gen piatych      n.loc piatom
  6 šiesty          m.gen šiesteho        f.gen šiestej       pl.gen šiestych     n.loc šiestom
  7 siedmy          m.gen siedmeho        f.gen siedmej       pl.gen siedmych     n.loc siedmom
  8 ôsmy            m.gen ôsmeho          f.gen ôsmej         pl.gen ôsmych       n.loc ôsmom
  9 deviaty         m.gen deviateho       f.gen deviatej      pl.gen deviatych    n.loc deviatom
 10 desiaty         m.gen desiateho       …
 19 devätnásty      m.gen devätnásteho    f.gen devätnástej   pl.gen devätnástych
 20 dvadsiaty       m.gen dvadsiateho     pl.loc dvadsiatych
 21 dvadsiaty prvý  m.gen dvadsiateho prvého          ← BOTH elements inflect
 23 dvadsiaty tretí m.gen dvadsiateho tretieho        ← the soft tail inside a compound
 24 dvadsiaty štvrtý m.gen dvadsiateho štvrtého
 37 tridsiaty siedmy f.instr tridsiatou siedmou
 60 šesťdesiaty     pl.loc šesťdesiatych   m.instr šesťdesiatym
 70 sedemdesiaty    pl.gen sedemdesiatych
100 stý             m.gen stého
190 sto deväťdesiaty  n.loc sto deväťdesiatom          ← the HUNDREDS prefix stays cardinal
200 dvojstý         m.gen dvojstého
1918 tisíc deväťsto osemnásty  m.gen tisíc deväťsto osemnásteho
1000 (undefined — an exact thousand needs `tisíci`, a soft paradigm with no in-repo source; the text is
      left untouched, which is the pre-change behaviour)
```

Implication: the boundary cases the corpus never exercises (21/23 compound inflection, 100/200 exact
hundreds, 1918 thousand-prefix) all read correctly, and each is pinned by a test.

---

## Run 10 — 2026-08-02, probing the FIRST draft (five defects, all found by probing not by tests)

```
npx tsx norm.scratch.ts "<58 corpus forms>"
```

Question: does the first draft actually do what the comments claim?

Raw finding — five defects, each in a rule whose unit test would have passed:

1. **The clock's trailing guard `(?![\d:.])` refused every UTTERANCE-FINAL clock.** `medzi 06:30 a
   07:30.` read *šesť hodín tridsať minút a 07:30* — the range rule did not fire and the second clock was
   not claimed at all, because a bare sentence period failed the guard that was meant to exclude a `.dd`
   third field. Fixed to `(?![\d:])(?!\.\d)(?!,\d)`. **This is the rule's most common corpus shape.**
2. **`skCountForm` was wrong for Slovak.** `64 km/h` read *šesťdesiatštyri kilometre* (nominative plural),
   because I had copied Czech's final-digit selector. Standard Slovak puts the counted noun in the
   GENITIVE PLURAL after any compound numeral regardless of its last digit, and **this engine's own
   numbers.ts already encodes exactly that** (`count === 1 ? sg : count >= 2 && count <= 4 ? paucal :
   plural`), which is where the corrected selector comes from. Affected every unit and percent instance
   with a compound count.
3. **The ordinal list ate its own comma.** `v 11., 12. a 13. storočí` read *v jedenástom dvanástom a
   trinástom storočí* — a real pause deleted, trap 14's second hazard exactly.
4. **`atď.,` produced two marks.** The end-of-clause branch appended a period before a following comma:
   *a tak ďalej., obetovaných*. Split into three shapes; only a genuine utterance end gets the period.
5. **`6-6` is not a range.** `za stavu 6-6 vyžiadalo tajbrejk` read *šesť do šesť*. Equal endpoints are
   never a range, so the rule now declines them — no score-vs-range judgement needed.

Implication: every one of these is invisible to a test written from the same misunderstanding as the rule.
Probing the corpus's own surface forms is what found them.

---

## Run 11 — 2026-08-02, the corpus diff, and the REGNAL defect it found

```
npx tsx tools/normalization/corpus-diff.ts emit --lang sk --corpus sk_sk --out /tmp/sk.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/sk.before --after /tmp/sk.after --corpus sk_sk
```

Raw finding:

```
changed 163/1719 (9.5%)
  before  { DIGIT: 0, 'SLOT-GAP': 0, RAWMARK: 0, DROP: 6, THROW: 0 }
  after   { DIGIT: 0, 'SLOT-GAP': 0, RAWMARK: 0, DROP: 0, THROW: 0 }
```

Reading all 163 word-level deltas turned up one defect the probes had not:

```
163. [ˈalʒbeta dvˈa .] => [ˈalʒbeta drˈuɦiː]      ← "kráľovná Alžbeta II. mala byť poslednou"
 38. [ˈalʒbeti dvˈa .] => [ˈalʒbeti drˈuɦiː]      ← "kráľovnej Alžbety II. mala stať"
```

Slovak has no `ROMAN_NATIVE` entry, so the shared roman pass rewrites `Alžbeta II.` to `Alžbeta 2.` before
this engine runs, and the general ordinal then emitted the MASCULINE *druhý* for a queen. The agreement
here comes from the PRECEDING name, not the following word — the one case that inverts the whole design —
so step 8 now reads the name's ending: `-a` → feminine nominative (Alžbeta → **druhá**), `-y` → feminine
genitive (Alžbety → **druhej**), `-ho` → masculine genitive of a vowel-final name (Lealofiho →
**tretieho**), anything else → masculine nominative, which is the previous behaviour.

The corpus's third roman, `Lealofiho III.`, sits at an UTTERANCE END, so the lowercase-follower guard
declines it: it keeps its sentence period and its cardinal reading. That is the deliberate trade — trap 9
says a guard widened past what you counted is a misfire generator, and widening this one to "digit + period
+ end of clause" would claim `čerpacej stanice Fort Greely 9.` as *Greely deviaty* and eat the pause.

Every other delta is one of: a space-thousands number rejoined (*jedenásť nula* → *jedenásťtisíc*), a
licensed ordinal inflected, a clock read as a governed feminine ordinal, an era marker spelled out, a unit
or sign spoken where it had been dropped, a decimal comma become *čiarka*, or a version dot become *bodka*.
`3136 mm2` → *štvorcových milimetrov* is worth singling out: the ASCII-digit exponent, which is the bug the
Japanese migration found in a local rule and which the shared tier gets right.

---

## Run 12 — 2026-08-02, what the `N.` rule claims, counted

```
npx tsx claim.scratch.ts     # every N. in the corpus, through normalizeSlovak
```

Question: does the rule claim what Run 3's table says it should, and does it lose a pause?

```
utterances 1719
N. claimed as ordinal: 73        ← 66 ordinals + 5 version dots (802.11a/b/g/n) + 1 period clock (12.00)
                                   + 1 clock-internal `07:30.`
N. left alone:         33        ← 30 utterance-final, 1 before “ , 2 before an uppercase word
utterance-final terminator LOST:   0
utterance-final terminator GAINED: 0
```

Implication: the figures reconcile exactly with Run 3's tabulation, and **zero sentence-final pauses were
lost** — the check that matters.

---

## Run 13 — 2026-08-02, the gates

```
npx tsc --noEmit                                                     clean
npx vitest run                                                       200 files, 2684 tests pass
npx tsx tools/normalization/mine.ts scan --in …/sk.jsonc --lang sk   no defects
npx tsx tools/normalization/review.ts --lang sk                      checklist clean, sourcing 6/6 attested
npx tsx tools/referee-eval/eval.ts sk                                BYTE-IDENTICAL to the baseline
                                                                     (89.0% folded, 97.9% symbol) — the
                                                                     referee is word-level, so a
                                                                     text→text layer must not move it
npx tsx tools/normalization/corpus-diff.ts compare                   163/1719 changed, all DROP → 0
```

The referee baseline was taken from a detached worktree pinned at `aba9257`
(`git worktree add ../sk-base aba9257 --detach`), never with `git stash` — three other agents were working
in sibling worktrees.

One reading in the review output worth recording as a known ambiguity: `1.234` reads *jeden bodka dvesto
tridsaťštyri*. In a language with SPACE thousands and COMMA decimals that is the version-dot reading, and
the corpus has zero period-grouped thousands, so it is defensible — but a text importing a foreign
convention would be misread.
