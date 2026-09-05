# Wolof (wo) text normalization

The pre-tokenizer pass for Wolof. Wolof is the principal language and lingua franca of Senegal, written here in
the official CLAD Latin orthography. Its engine already exists (`src/languages/wolof/`) with a bespoke
QUINARY number composer (`numbers.ts`) and a grapheme manifest; what it has never had is a symbol layer.

Chronological, one entry per run.

## Run 1 — 2026-08-14 08:38 — the baselines, before touching anything

**Command / question.** What does the tree say about `wo` before any edit — referee, DROP scan, review, and a
pinned corpus-diff baseline?

```
npx tsx tools/referee-eval/eval.ts wo
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/wo.jsonc --lang wo
npx tsx tools/normalization/review.ts --lang wo
npx tsx tools/normalization/corpus-diff.ts emit --lang wo --corpus mined:wo --out /tmp/wo.before
```

**Raw findings.**

```
=== wo vs kaikki Wolof (Wiktionary, human) [primary] (69 words) ===
raw exact:      31/69 (44.9%)
folded backbone:67/69 (97.1%)
symbol accuracy:98.6%
  1×  inchalaxu  ≠  inʃalaxu       (inchaalaaxu — the Arabic loan digraph ⟨ch⟩)
  1×  ɟam  ≠  ɟamːə                (jàmm — the referee's epenthetic final schwa)
```

```
scanned 408 lines of tools/corpus/mined/wo.jsonc as wo
LEAK RAW-LATIN km  ×27    e.g. Réyaayam toll ci 1 219 912 km², di 33° réew ci réyaay ci àdduna bi.
DROP percent       ×25    e.g. … Wolof (43,3 %), Pël (23,8 %), Séeréer …
DROP exponent      ×17    e.g. Réyaayam toll ci 1 219 912 km², di 33° réew …
DROP math-sign     ×17    e.g. Death forever= Aljeeri (Republik Popileer Demokaraatik bu Alseeri) …
DROP degree        ×10    e.g. Senegaal a ngi nekk ci diggante 12°8 ak 16°41 …
DROP currency      ×8     e.g. po - (la drapo kostas po 2 $ dolaroj por metro …
DROP ampersand     ×6     e.g. "Santo Antão - Paisagem & Melodia" (2006)
LEAK RAW-LATIN fr  ×3  ·  tr ×1 · kg ×1 · mn ×1 · dl ×1 · sms ×1 · bn ×1
DROP minus         ×2
```

```
── checklist ──
  [FAIL] normalizer         src/languages/wolof/normalize.ts missing
```

`corpus-diff emit` → 405 utterances (`/tmp/wo.before`). ⚠ `--corpus` is REQUIRED and takes `mined:wo`; the
bare `--lang wo` form in the task brief throws `emit needs --lang --corpus --out`.

**What it implies.** Seven DROP classes plus a raw-Latin `km` tail — a full layer's worth. Two things already
visible in the scan output that I must NOT take at face value:

- the `DROP currency` example is **Esperanto** (`la drapo kostas po 2 $ dolaroj por metro`), i.e. wo.wikipedia
  carries foreign-language text and the adversarial hard-set has concentrated it exactly in the cell I would
  write a currency rule from (playbook §0b, trap 34). Currency needs its instances read one by one.
- `DROP math-sign ×17` on `Death forever= Aljeeri` is a wiki-markup artefact, not arithmetic.

Next: extract the artifact's 408 retained segments to plain text and tabulate every symbol class by hand.

## Run 2 — 2026-08-14 09:05 — the corpus tabulation, and what the engine does to it today

**Command / question.** Extract the artifact's 408 retained segments to plain text, tabulate every symbol
class by hand, then probe each attested shape through the real phonemizer. What does `wo` actually write,
and what does the engine actually say?

**Raw findings — the tabulation.** (408 segments = 208 hard + 200 sample.)

```
%              64      43,3 % · 5% ci at · 20,3% · 3,2% at mu nekk · 80% ci jaaykati Senegaal
$              11      $12 miliyaar ciy dolaar · US$ 65 milyoŋ · US$5 · $150,000 · $2.17 milioŋ
°              24      12°8 · 60° (60 aj) · 4°22′ · 0° (tus aj) · 16°41 — EVERY ONE a coordinate/angle
km             ~28     2 798 km · 30.065.000 km² · 700 km · 146km · km2 · km&sup2
mm              4      150mm ci at · 400mm · 650mm · 950mm
kg              1      9,10 · 10−31 kg
digit + dash   55      1906-2001 · 1939–1940 · 1500-1888 · 2:1-3:22 (verse) · 10-20 fan
digit + `ba`   15      1854 ba 1861 · 48 ba 66 g.K. · 9eem ba 12eem xarnu · 5 ba 7,5i sàntimet
N:NN           33      Pe 2:1 · Jëf 19:26 · Ge 1:26 · Ex 6:20 · suraat 2:30 — ALL scripture
N/N            10      31/12/2007 · 26/06/1945 (dates ×8) · 2/7 · 2/3 (fractions ×2)
decimals       ~20     43,3 · 2,8 milyoŋ · 15.85 · 4.7 · $2.17 · 0.449 · 9,10 · 0,511
grouped        ~43     30.065.000 · 1 219 912 · $150,000 · 700,000 · 2 798 · 14 090 000
&               9      &nbsp; ×3 · &sup2 ×3 · &alpha ×1 · R&B ×1 · "Paisagem & Melodia" ×1
=               8      q e = 1,602 · 10⁻¹⁹ C ×2 (physics) · `baziira = gisug xol` ×6 (glosses)
· / ∙           2      the scientific-notation multiplication sign
dotted era     ~46     g.K. ×23 · j.K. ×8 · j.m ×4 · g.j ×4 · t.s ×3 · j.y. ×3 · g.g ×1
ordinal        12      16eelu xarnu · 9eem · 184eelu · 13eem
initialisms    ~60     ASF ×5 · AOF ×4 · IA ×4 · OMS ×3 · MPLA ×3 · IFAN ×2
```

**⚠ THE `g` TRAP, and `sources.ts` walked straight into it.** Its report reads

```
[chk?] unit-word   the corpus writes g×38 km×25 mm×4 kg×1 after a number — source the unit words
```

There are **50** digit-adjacent `g` in the retained text and **not one is a gram**. Every single one is the
ERA MARKER: `Ci 27 g.K. la juddu` · `atum 1967 g.` · `atum 1392 gg` · `1794 -1796 g.j`. Declaring `g` in
`units` would have read fifty dates as a weight. This is trap 2 (loose patterns over-count) arriving through
a tool that has no way to know, and it is why the report says `chk?` rather than `ok`.

**Raw findings — the engine, probed on the attested forms.** (Trap 57: run it, paste the reading.)

```
"43,3 %"            → ɲɛːnt fukː ak ɲɛtː , ɲɛtː            % dropped; the decimal comma is a CLAUSE PAUSE
"$150,000"          → teːmeːr ak ɟuroːm fukː , tus         "a hundred fifty, ZERO" — sign gone, grouping comma a pause
"30.065.000 km²"    → ɲɛtː fukː . ɟuroːm bɛnː fukː ak ɟuroːm . tus km    THREE sentence breaks inside one number
"2 798 km"          → …ɟuroːm ɲɛtː km                      raw ⟨km⟩ in the IPA
"150mm ci at"       → teːmeːr ak ɟuroːm fukː mː ci at      ⚠ ⟨mm⟩ READ AS A GEMINATE [mː]
"4,033 km2"         → ɲɛːnt , ɲɛtː fukː ak ɲɛtː km ɲaːr    the ASCII exponent read as the NUMBER two
"km&sup2"           → km sup ɲaːr                          entity split into a word and a number
"US$ 65 milyoŋ"     → us ɟuroːm bɛnː fukː ak ɟuroːm miljɔŋ  $ dropped, US read as a word
"60° (60 aj)"       → ɟuroːm bɛnː fukː ɟuroːm bɛnː fukː aɟ  ° dropped (the gloss `aj` survives — REDUNDANT)
"1906-2001"         → ɟunːi ak … ɲaːr ɟunːi ak bɛnː        the span hyphen is silent
"1967 g.K."         → …ɡ . k .                             two sentence breaks mid-clause
"9,10 · 10−31 kg"   → ɟuroːm ɲɛːnt , fukː fukː ɲɛtː fukː ak bɛnː kɡ    raw ⟨kg⟩, sign and power both gone
"15.85 miliyoŋ"     → fukː ak ɟuroːm . ɟuroːm ɲɛtː fukː ak ɟuroːm milijɔŋ   a full stop inside a number
"2/3"               → ɲaːr ɲɛtː                            "two three"
```

⚠ **`150mm` → [mː] is trap 56 in a new door.** The engine's CONSONANT GEMINATION rule (a doubled consonant
is [Cː]) claims ⟨mm⟩, so the millimetre does not leak — it becomes a plausible Wolof geminate. No leak class
can see that; only reading the string does. Same family as nya's ⟨cm⟩-reads-as-KILOMETRES.

**Raw findings — three refusals the corpus argues for, before I write a line.**

- **NO CLOCK.** 33 `\d{1,2}:\d{2}` shapes in the retained text and **33 of 33 are scripture references** —
  `Pe 2:1-3:22`, `Jëf 19:26-27`, `Ge 1:26-30`, `Ex 6:20`, `suraat 2:30-38`, `1Ki 15:8-24`. Zero clocks. A
  ceb-shaped bare-colon clock rule would have fixed 0 and broken 33; this is trap 55's ilo/ceb finding with
  an even cleaner split. The `:` already reads as a comma pause, which is a defensible reading of a verse
  reference, so there is nothing to repair either.
- **NO INITIALISMS** (~60 in the retained text, 792 corpus-wide). `sources.ts` says
  `[NONE] letter-names — espeak does not ship this language at all`, and no in-repo source carries a Wolof
  letter-name table. `core/initialisms.ts` without one is a NO-OP (trap 16's converse: I checked the seam,
  and the seam is not what is missing).
- **NO ROMAN RULE.** `wo` is not in `ROMAN_NATIVE` (`registry.ts` line 276 — only en/fr are), so `III`/`XVIII`
  are digits before `text()` ever runs.

**What it implies.** Nine classes to write, all of them measured. Next: source the words. Everything below
must come from the corpus, wo.wikipedia (`attest.ts`), the kaikki referee or a published grammar — nothing
guessed.

## Run 3 — 2026-08-14 09:40 — sourcing every word, and three refusals that came out of it

**Command / question.** espeak does not ship Wolof at all (`sources.ts`: `[NONE] letter-names — espeak does
not ship this language`), so the haystack is the corpus, the kaikki referee, and wo.wikipedia. For each slot:
is there a word, and does the SENSE fit?

```
npx tsx tools/normalization/attest.ts --lang wo --words "ci téeméer,téeméer,kilomet,meetar,sàntimet,\
  milimet,kare,kaare,dolaar,aj,frank,kilogaraam,garaam,tamñareet,junni-junni,milyoŋ,milyaar,tomb,\
  yem ak,tolloo ak,kubik,FCFA,CFA,franc CFA,yuro,euro"
```

**Raw findings.**

```
  word             token  arts  substr-only  verdict
  ci téeméer       4      3     0            attested
  kilomet          50     20    0            attested
  meetar           55     20    0            attested
  sàntimet         43     20    0            attested
  milimet          6      5     0            attested
  kaare            24     13    0            attested
  kare             1      1     0            attested
  dolaar           9      9     0            attested
  garaam           3      3     0            attested
  kilogaraam       1      1     0            attested
  aj               80     20    0            attested
  tomb             33     19    0            attested
  frank            7      4     1            attested
  CFA              8      4     0            attested
  FCFA             0      0     0            absent
  euro             3      3     1            attested
  yuro             0      0     0            absent
  kubik            0      0     0            absent
```

**The senses, read one by one — and two of the biggest counts are the wrong word.**

- **`ci téeméer` — the percent word, and the citation is as good as this gets.** wo.wikipedia writes the SIGN
  and its reading side by side, twice in one sentence: *"lu ci ëpp ci **50% (juroom-fukk ci téeméer)** ba
  **70% (juroom-ñeent-fukk ci téeméer)** ci ñi muy dal ci dee lañuy mujjee"*. The mined corpus has it
  independently — *"lu tolloog juróom-fukk ci téeméer"* — and a third article writes *"juróom-ñaar-fukk ak
  juróom-ñeent ci téeméer ak ñaar-fukk"*. Literally "in a hundred"; POSTPOSED, which is the tier's default.
  This is the Fula `e teemedere` move — sourced arithmetic from `téeméer` = 100 in the engine's own
  `numbers.ts` — except that here it is directly attested rather than composed.
- **`aj` — the DEGREE word, and it is trap 37 exactly.** 80 bare tokens over 20 articles, and **every one is
  the HAJJ**: *AJ MÀKKA*, *faratay aj*, *jëfi aj ji*, *ajkat yi*. The degree sense lives only in the
  COLLOCATION, and the mined corpus carries it three times as a parenthetical gloss beside the sign itself —
  `60° (60 aj)`, `0° (tus aj)`, `12°8(fukk ak ñaari aj juroom-ñett)`. The last one also settles POSITION:
  `12°8` is read *fukk ak ñaar **aj** juroom-ñett*, i.e. the word goes BETWEEN the two operands. 80 hits of
  the wrong sense, 3 of the right one; the bare count would have picked a pilgrimage.
- **`tomb` — a real word, the wrong slot, and it closes the decimal question.** ×33/19, and the sense is the
  geometric/geographic POINT: *ab tomb*, *ñaari tomb yi* (the two poles), *ci bépp tomb boo jël ci biir
  watatukaay bi* (at any point in the circuit). Nothing puts it between two digit runs. `sources.ts` says
  `[NONE] decimal-point` independently. → **NO DECIMAL WORD**; the fractional digits are read one at a time.
  (This is a SENSE-based refusal, so it stands on the corpus alone — playbook's Igbo caveat does not apply.)
- **`kilomet` ×50 / `meetar` ×55 / `sàntimet` ×43 / `milimet` ×6** — all digit-adjacent in the examples and
  several glossed against the imperial form, which removes any doubt: *29 kilomet (18 mi)*, *80 kilomet
  (50 mi)*, *32 kilomet (20 mi)*, *10 ba 15i milimet*, *200 ba 700 milimet cib taw* (rainfall — the same
  sense as the wo corpus's own `150mm ci at`), *100 meetar*, *17 meetar ak yaatuwaayu 2 meetar*, *40 ba 60
  sàntimet*. `milimet`'s ×6 is a LOW count, not an absent one — trap 25's amendment: five independent
  articles in exactly the slot is a source, and leaving ⟨mm⟩ unread is not the neutral option (see below).
- **`kaare` ×24/13 — the SQUARE word, POSTPOSED to the unit noun.** *54 000 000 **km kaare*** · *44 milyoŋi
  **kilomet yu kaare*** · *17 milyoŋi **kilomet kaare*** · ***meetar kaare*** · *112.622 **yu kaare***.
  `kare` ×1 is the same word with one ⟨a⟩ (the wo corpus writes *44 milyoŋ kilometri kare*).
- **`dolaar` ×9/9 — and glossed against BOTH the sign and the ISO code.** *diggante 50 ba 100 dolaar (USD)* ·
  *15,41 dolaar (USD)* · *565i tamñareet ciy dolaar u Amrig* · and in the mined corpus *$12 miliyaar ciy
  dolaar*, which is trap 12's redundant shape and tells me the connective too.
- **`garaam` ×3/3 — the gram, unambiguously** (*11,6 garaam ci wurus*, *ñaari téemeer ak juróomi garaam*).
  **The word is sourced and the KEY is still refused** — see the `g` finding in Run 2. `kilogaraam` ×1/1 is a
  single hit (*àgg ba 1,5i kilogaraam*), which is a lead not a finding on its own; it is taken because it is
  `kilo-` + the solidly-attested `garaam`, the same productive prefix as `kilomet` ×50, and it sits in the
  slot.

**Three refusals, each measured.**

1. **NO CFA KEY, and this was the thing to check.** The brief flagged `F CFA` / `FCFA`. `FCFA` is **absent**
   from wo.wikipedia; `CFA` ×8/4 is attested but never as a sign after a number — every hit is a bare code in
   a French-shaped noun phrase (*zone CFA*, *xaalis CFA*, *zone franc CFA*), and the one monetary sentence
   writes the amount in Wolof words with the code trailing: *téeméeri milyoŋ ak juroom-ñaar-fukk ak
   juroom-ñaari **dërëm ci CFA** (777 millions de francs CFA)*. `frank` ×7/4 is a real Wolof currency noun
   (*130 milyoŋ yu Frank*, *Frank bu Faraas*) — **but there is no CFA sign in the corpus or on the wiki to
   key it to**, and the playbook's own calibration is that a currency name is checked only if its sign is in
   the corpus. Declaring a key nothing writes buys nothing and risks reading a French acronym as money.
2. **NO `€`.** Zero euro signs in the corpus. `yuro` ×0; `euro` ×3/3 with 1 substring-only, and the two real
   hits are the SAME duplicated sentence (*plaat bu nekk 5 euro*). One sentence is a lead, not a finding.
3. **NO `=` READING.** 20 occurrences in the retained text: **3 physics equations** (`e = 1,602 · 10⁻¹⁹ C`),
   **~9 lexical/translation glosses** (`baziira = gisug xol`, `xarala(fr : économie ; en : economics) =
   koom-koom`, `vin= akusativo`), and **2 wiki heading markers** (`==Melo wi==`, `Death forever=`). `yem ak`
   ×4/4 IS attested as "is equal to" — and its clearest hit is the corpus's own equation sentence, *"moo
   **yem ak** e = 1,602 189 2 ∙ 10-19 C"*, i.e. the REDUNDANT case where the words are already written. That
   leaves a rule that would fire mostly on glosses, in a register nothing attests, and on markup where any
   word is wrong. Refused WHOLE, so the reading is exactly what it is today (trap 53's `ak` shape, not its
   Igbo shape). `·`/`∙` ×3 and the bare exponents `10⁻¹⁹`/`10−31` are refused on the same basis: no sourced
   "times" word, no sourced "to the power of" phrase.

**⚠ A CORE FINDING, measured and NOT fixed here.** `core/markup.ts`'s `ENTITY` regex is
`/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/gu` — it REQUIRES the closing semicolon, and this corpus
writes `km&sup2` without one, ×3:

```
"km&sup2"   → km sup ɲaːr     the entity survives as a word plus the NUMBER two
"km&sup2;"  → km              decoded
```

Blast radius, grepped over all 161 mined artifacts for a semicolon-less named entity that `markup.ts`
otherwise knows: **8 occurrences in 3 languages** — `wo &sup2 ×3`, `pnb &nbsp ×3`, `ee &nbsp ×2`. Bounded
and small; it goes to the backlog rather than into this branch, and `wo` folds `&sup2` locally.

**What it implies.** Everything needed is sourced. Writing the layer next.

## Run 4 — 2026-08-14 09:05 — the layer, and what the review probe caught that the corpus could not

**Command / question.** Write `src/languages/wolof/normalize.ts`, wire it into `WolofPhonemizer.text()`, and
run every gate. Does the layer close the DROPs without moving a leak class or the referee?

```
npx tsc --noEmit
npx vitest run
npx tsx tools/referee-eval/eval.ts wo
npx tsx tools/normalization/corpus-diff.ts emit --lang wo --corpus mined:wo --out /tmp/wo.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/wo.before --after /tmp/wo.after
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/wo.jsonc --lang wo
npx tsx tools/normalization/review.ts --lang wo
```

**Raw finding — the corpus diff.**

```
changed 122/405 (30.1%)
  before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, ZERO-WIDTH: 0, RAW-CAPS: 0, DROP: 68, THROW: 0 }
  after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, ZERO-WIDTH: 0, RAW-CAPS: 0, DROP: 20, THROW: 0 }
```

**Raw finding — the artifact scan, before → after.**

```
                     before   after
LEAK RAW-LATIN km      27       1
DROP percent           25       0
DROP exponent          17       3
DROP math-sign         17       0 (→ ACCEPTED-CLASS ×17, argued)
DROP degree            10       1 (+ REDUNDANT ×3)
DROP currency           8       0 (+ REDUNDANT ×1)
DROP ampersand          6       0
DROP minus              2       2 (deliberately still red)
```

**Raw finding — the sample tier, read line by line.** 13 of 201 sample utterances changed, and every one is
correct: the percent glosses (`Wolof (43,3 %)` → *43 3 ci téeméer*), the year spans (`( 1265 - 1321 g )` →
*1265 ba 1321*), the eulogy dots (`(j.y.m)` → *j y m*), `20 327 000 km², 5,6%` → *20327000 kilomet kaare, 5 6
ci téeméer*, `10-20 fan` → *10 ba 20 fan*, and `605 695` → *605695*.

**⚠ THE ONE REGRESSION, AND ONLY `review.ts` COULD SEE IT.** `°C` is ×0 in this corpus, so nothing in the
diff or the scan exercised it — but the review probes the adversarial neighbour (trap 8):

```
  degrees       20 °C     ɲaːr fukː aɟc
```

The bare-degree arm claimed `20 °` and the scale letter FUSED into the emitted noun: one token *ajC*, which
is worse than the dropped ° it replaced. Fixed by narrowing the arm's lookahead from `(?![\d])` to
`(?![\d\p{L}\p{M}])` — a GLUED letter refuses the whole match (trap 53's `ak` shape), while `0° walla`,
`33° réew` and `1° P` all put a space there and are still claimed.

**And the refusal behind it is worth stating, because the obvious fix is wrong here.** nya claims the scale
letter so it cannot reach the g2p raw. Wolof should not: `sources.ts` says `[NONE] scale-names`, and this
corpus's only post-numeric `C` is the **COULOMB** — `q e = 1,602 · 10⁻¹⁹ C`, `10 -19 C`, ×3 in the physics
article. Inventing a temperature reading for `C` in a corpus where `C` is a charge unit is the trap this
whole document is about. `degrees` therefore stays RED in `review.ts`, deliberately.

**Raw finding — the residual 20 DROPs, read one by one.**

```
ACCEPTED-CLASS math-sign ×17   the `=` refusal of Run 3 — now consulted rather than failing
DROP exponent ×3               `1,602 · 10⁻¹⁹`, `10−31`, `10⁻¹⁹` — the bare exponents; no phrase sourced
DROP minus ×2                  a LIST BULLET and the ASCII half of `∙ 10 -19`; no true negative in the corpus
DROP degree ×1                 `Bulletin de l'IFAN, t. XXXI, série B, n° 3` — the FRENCH *numéro*, not a
                               degree, and correctly declined (no digit precedes the sign)
LEAK RAW-LATIN km ×1           `205.900.000 di km² ci xaaju kol-kol` — the word `di` ("is") stands BETWEEN
                               the number and the unit, breaking the tier's adjacency (trap 54's `so
                               610 deggane/sq mi` shape), and the bare-unit path correctly refuses a key
                               followed by `²` rather than leaving a stray exponent behind
LEAK RAW-LATIN fr/tr/mn/dl/sms/bn ×8   language codes in a multilingual gloss (`el: Κύπρος … tr: Kıbrıs`), a
                               French film credit and the Arabic patronymic `bn` — none is a unit, all
                               pre-existing and untouched by this layer
REDUNDANT degree ×3            the `60° (60 aj)` glosses — the word IS in the reading; permissible (trap 12)
REDUNDANT currency ×1          `$12 miliyaar ciy dolaar` — same shape, on the currency side
```

**Raw finding — the referee, unchanged.**

```
raw exact:      31/69 (44.9%)        (before: 31/69, 44.9%)
folded backbone:67/69 (97.1%)        (before: 67/69, 97.1%)
symbol accuracy:98.6%                (before: 98.6%)
```

Expected and correct: the referee is 69 single WORDS with no symbol in any of them, so a symbol layer cannot
move it in either direction. Quoted here because "unchanged" is the result, not the absence of one.

`npx tsc --noEmit` clean. `npx vitest run` → **244 files, 4161 passed, 5 skipped**, after regenerating
`tools/language-catalogue/{catalogue.tsv,languages.db}` — `derive-normalization.py --check` correctly went
stale the moment `wo` grew a normalizer (`(none)=74, done=128, inherited=13`).

**What it implies.** The layer is done. The two remaining `review.ts` FAILs are both argued refusals, not
gaps, and they are recorded where the tools can read them.

## Run 5 — 2026-08-14 09:30 — the class-level refusals, registered rather than left as noise

**Command / question.** `review.ts --lang wo` reported eight DROPPED sign classes. Which of them are
REFUSALS I can argue, and which must stay red?

**Raw finding.** Registered in `ACCEPTED_SIGN_SILENCE.wo` (`tools/normalization/defects.ts`), each with its
measurement: `equals` (×20 — 3 equations of which one is already glossed *moo yem ak*, ~9 lexical glosses, 2
MediaWiki heading markers), `times` (×0 as `×`/`x`; the 3 middle dots of scientific notation are a shape the
tier does not match and no Wolof word is attested for), and `plus` / `plus-minus` / `less-than` /
`greater-than` / `divide` (all ×0 — trap 48's definitive negatives, recorded so nobody re-investigates them).

**Two stay RED on purpose**, which is the ak / ln / bm / ilo / gn stance:

- **`minus`.** Both instances are non-negatives (a list bullet, and the ASCII half of `∙ 10 -19`) so there is
  nothing here to read — but that is a fact about this corpus and not a licence, and omitting a minus
  INVERTS where omitting a plus is lossless. No Wolof negative-number word is attested in the corpus, on
  wo.wikipedia or in the kaikki referee. The gate comes green when one is.
- **`degrees`.** The coordinate reading works (`12°8` → *12 aj 8*); it is `°C` specifically that is refused,
  for the Coulomb reason in Run 4. An accepted silence would claim the whole class is unread, which is not
  true, and would mask a regression in the arm that does work.

```
  [FAIL] sign classes       DROPPED: minus degrees
  [FAIL] artifact scan      … (the 20 triaged above)
  [ ok ] normalizer · wired into text() · tests · artifact tracked · artifact current
  [ ok ] sign probes cover DROPPABLE all 8 classes mapped to probes
  [ ok ] spelling → g2p     no unphonemized word literal in text()
  [ ok ] sourcing           all 3 high-traffic words attested
```

**Backlog, not fixed here (shared code — the reviewer's call).**

1. **`core/markup.ts` requires a closing semicolon on a named entity.** `ENTITY` is
   `/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/gu`. Reproducing reading, in `wo`:
   `phonemize("km&sup2", "wo")` → **`km sup ɲaːr`** (the entity name read as a word, the digit read as the
   NUMBER two, and the unit left raw) against `phonemize("km&sup2;", "wo")` → `km`. Blast radius grepped
   over all 161 mined artifacts for a semicolon-less named entity `markup.ts` otherwise knows: **8
   occurrences in 3 languages** — `wo &sup2 ×3`, `pnb &nbsp ×3`, `ee &nbsp ×2`. Worked around locally in
   `wolof/normalize.ts` step 1, idempotently.
2. **`sources.ts`'s `unit-word` line reports a raw digit-adjacency count and can name a marker as a unit.**
   For `wo` it prints *"the corpus writes g×38 km×25 mm×4 kg×1 after a number — source the unit words"*, and
   **all 50 digit-adjacent `g` in the retained text are the era marker** (`Ci 27 g.K.`, `atum 1967 g.`,
   `atum 1392 gg`). Acting on it would have read fifty dates as grams. Not a false positive of the kind
   trap 57 catalogues — the line says `chk?` and is honest about being a prompt — but a one-line note
   beside it ("a one-letter key is an era/ordinal marker as often as a unit; read the instances") would
   have carried the warning where the decision happens.
