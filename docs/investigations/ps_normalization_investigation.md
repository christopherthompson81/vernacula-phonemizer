# Pashto (ps) text-normalization investigation

Chronological log. There is no FLEURS for Pashto. Two text sources, and they are NOT the same:

- `tools/corpus/mined/ps.jsonc` — the committed artifact, 178,645 segments, dump-sourced. Its `sample`
  tier is therefore the language's real distribution. 448 utterances reach `corpus-diff`.
- a **fresh** `pswiki-latest-pages-articles.xml.bz2` (52 MB, fetched 2026-08-10) converted with
  `wikidump-to-text.py` + `filter-markup.py` → 255,980 lines, then **13,331 category-residue lines
  dropped** (see Run 0) → `ps_clean.txt`, **242,649 lines / 65.5 M chars**. Every count marked "corpus"
  below is over that file. It is a scratch file; the artifact remains the committed evidence.

---

## Run 0 — 2026-08-10 — state of the language, and a corpus repair before any measurement

`review.ts --lang ps` → `[FAIL] normalizer … missing`. No `normalize.ts`.

`sources.ts --lang ps`: espeak **does not ship Pashto at all**, so there is no letter-name tier and no
decimal-point tier. What Pashto does have that Lingala did not is a **2,566-line referee**.

`mine.ts scan` over the artifact, before any edit:

```
DROP percent ×29 · DROP math-sign ×18 · DROP currency ×16 · DROP degree ×9
DROP minus ×9 · DROP exponent ×9 · DROP ampersand ×3 · FOREIGN math-sign ×2
```

Baseline emitted BEFORE any edit (playbook fan-out rule 2):
`corpus-diff.ts emit --lang ps --corpus mined:ps` → 448 utterances.

**⚠ A corpus repair came first, because otherwise every count below is wrong.** `filter-markup.py` drops
localized *media*-namespace residue but not the localized **category** prefix, and Pashto's is `وېشنيزه:`.
13,331 lines — **5.2% of the corpus** — are category tails like

```
وېشنيزه:1931 مړينې وېشنيزه:1847 زېږېدنې
```

which are bare year+word pairs, i.e. exactly the shape several rules here key on. Dropped locally for the
scratch counts. Not fixed in the shared tool: that is a fleet change and this is one language's commit
(playbook fan-out rule 3) — recorded here so it can be raised on its own.

## Run 1 — 2026-08-10 — probing the engine on real corpus shapes

The defect list is what the engine *produces* (playbook step 2):

```
۳۲۱،۰۰۰   → درې سل او یوویشت , صفر        the grouping ، is a PAUSE; the tail reads "zero"
۱،۲۳۴،۵۶۷ → three numbers, two pauses      ditto, compounded
۷۸.۸      → اته اویا . اته                 the decimal dot is a SENTENCE BREAK
۸،۳۵      → اته , پنځه دېرش                the decimal ، likewise
۲۵٪ / 25% → پنځه ویشت                      the sign is SILENT (٪ ×3574 + % ×1582)
۱۹۶۵-۱۹۷۵ → two cardinals, no connective   (×10,181)
۲/۳       → دوه درې                        no fraction reading
۱۰:۳۰     → لس , دېرش                      the colon is a PAUSE
$۱۰۰      → سل                             the sign is SILENT
۵ km      → پنځه ˈʊkm                      the unit reaches the IPA as a RAW CLUSTER
km²       → ˈʊkm                            ditto, exponent gone
۱۰+۵ / -۵ → the sign is SILENT
A&B       → ˈə bˈiː                         and the two operands MERGE (trap 18)
۲۰۲۰م     → دوه زر او شل  m                 the era marker is a BARE CONSONANT
۱۳۹۹ل     → … l                             ditto
```

Implication: as with Lingala this is a from-zero layer — but the dominant class is one no treated
language has had before.

## Run 2 — 2026-08-10 — the corpus, counted

Digits are the first fact: **`\d` would miss 46,314 of the artifact's 54,969 digit runs.** Pashto writes
Extended Arabic-Indic `۰-۹` (U+06F0) mostly, Arabic-Indic `٠-٩` (U+0660) sometimes, and ASCII sometimes —
often all three in one article. Every pattern below uses `[0-9۰-۹٠-٩]`, never `\d` (playbook: `DIGIT` is
`\p{Nd}`, never `\d`).

| class | count | note |
|---|---:|---|
| **ERA ز** (زېږديز, CE) | **38,810** | the single biggest class in the language |
| ERA م (ميلادي, AD) | 6,150 | ambiguous with the ordinal — see Run 3 |
| ERA ل (لمريز, solar Hijri) | 1,848 | |
| ERA هـ (هجري) | 1,282 | |
| ERA ق.م (BC) | 196 | ⚠ a naive `ق\.?\s?م` gives **2,695** — see Run 3 |
| ORD مه glued / spaced | 5,789 / 3,074 | |
| ORD مې glued / spaced | 2,893 / 1,023 | |
| ORD م glued | 4,659 | |
| RANGE `D-D` | 10,181 | |
| PCT ٪ / % | 3,574 / 1,582 | and the WORD سلنه ×3,327 |
| DEC `.` / `،` / `٫` | 6,293 / 1,122 / 186 | |
| GROUP `,` / `،` / `.` / space | 1,959 / 1,517 / 650 / 281 | ⚠ `،` is BOTH grouping and decimal |
| ZWNJ (U+200C) | 22,590 | |
| EQ `=` | 7,734 | ⚠ read before believing — see Run 3 |
| PLUS `+` | 2,001 | ditto |
| FRAC `D/D` | 1,060 | |
| UNIT km/cm/mm/kg/m² | 727 | |
| CLOCK `D:D` | 417 | |
| DEG `°` / `°C` | 288 / 109 | |
| CUR `$` / `€£` / `؋` | 162 / 16 / 1 | |
| AMP `&` | 297 | |
| TIMES `×` | 196 | |

The shape of the work is already different from every previous language: Pashto's defining class is the
**era marker**, at 48,286 instances across four markers, and it collides with the **ordinal suffix**,
which is written with the same letter.

## Run 3 — 2026-08-10 — the era/ordinal collision, and three counts that were lies

**The same letter does both jobs, and the SUFFIX FORM separates them.** Tabulating what follows each
shape decided it — the playbook's trap-4 method, and the answer falls out of the table:

| shape | × | what follows it | verdict |
|---|---:|---|---|
| `Nز` | 38,810 | **کال 30,549**, کلونو 1,105, لسيزې 432 | ERA (زېږديز, CE) |
| `Nم` / `N م` | 6,151 | **کال 3,409**, زېږدي 184, زېږيز 56 | ERA (ميلادي, AD) |
| `Nل` | 1,848 | ل 626, **کال 596** | ERA (لمريز, solar) |
| `Nمه` | 8,863 | **نېټه 1,089**, پېړۍ 398, لسیزه 314, ماده 104 | ORDINAL |
| `Nمې` | 3,916 | **پېړۍ 828, لسیزې 641, نېټې 334** | ORDINAL |

So bare `م` is the era marker and `مه`/`مې` are the ordinal — longest-form-first ordering separates them
mechanically. `م` is the one genuinely ambiguous letter, and the digit count settles it: of its 6,151
instances **5,005 are 4-digit** (years) and 830 are <100 (ordinals), so the two senses barely overlap.

**Two counts that were lies, both caught by reading the instances (trap 2).**

- `ق\.?\s?م` reports **2,695**. Digit-anchored it is **196**. The other 2,499 are `قم` inside ordinary
  words — قمچينونه, قمر, and the Iranian city قم. This is the playbook's own Urdu `قم`/قمری example,
  reproduced exactly, in a different language.
- `=` reports **7,734** and essentially none of it is arithmetic: it is wiki HEADING markup that
  `wikidump-to-text.py` leaves in (`==خوي او عادتونه==`) plus chemistry (`P1=750mmHg`). `+` reports
  **2,001** and is almost entirely CHEMICAL EQUATIONS (`2KMnO4+10FeSO4+8H2SO4`, `Cl2+2NaOH`). Both
  refused — a reading built on a contaminated count is worse than silence.

## Run 4 — 2026-08-10 — sourcing, and three refusals that became findings

**The separator is NOT one convention, and the two marks do not behave alike.**

```
،  D{1,3}(،D{3})+   1,468   multi-group 168   + magnitude word  12   → GROUPING
،  D+،D{1,2}        1,122                                            → DECIMAL
.  D{1,3}(.D{3})+     527   multi-group  35   + magnitude word  42   → mostly DECIMAL
.  D+.D{1,2}        6,387                                            → DECIMAL
```

Reading every `D{1,3}.D{3}`: `15.744 ميلیونه ټنه`, `3.180 کیلوګرامه`, `۱۰.۵۳۹ میلیونه نفوس`, `4.0026 u`
are decimals; `192.168.2.10` and `255.255.255.0` are an IP address and a netmask. So a 3-digit tail is a
grouping after `،` and a DECIMAL after `.` — the discriminator is the MARK, not the group size, which is
the opposite of the structural rule Lingala needed. Only the unambiguous multi-group dot form (×35) is
de-grouped, and IPv4 (×29) is guarded as a designation.

**FOUND, and three of them were meant to be refusals.**

- **`اعشاريه` is the decimal-point word** — ×184, and the corpus GLOSSES itself: `۵.۰(صفر اعشاريه پنځه)`,
  `دوه اعشاريه درې ميليونه`, `اته اويا اعشاريه صفر اته سلنه` (78.08%). That last one also settles the
  READING: integer, اعشاريه, then the fractional digits ONE AT A TIME. This is the tier `sources.ts`
  reported as `[NONE] decimal-point` — it is absent from espeak, which does not ship Pashto, and present
  ×184 in the language's own prose.
- **`منفي` is the minus word** — ×52 digit-adjacent and PREPOSED: `منفي ۱۸۰ درجو`,
  `د منفي ٤ څخه تر منفي ٤٥ سانتي گراد`. The bare word ×1,151 is mostly the adjective ("negative votes"),
  which is trap 37 — so the digit-adjacent collocation is the evidence, not the bare count.
- **The clock is `N بجې او M دقیقې`** — `بجې`/`بجو` ×434 (×252 right after a number), `دقیقې` ×289, and
  the corpus writes the whole idiom out: **`۷ بجې او ۲۰ دقیقې`**. `sources.ts` had no clock tier at all.
- **Percent `سلنه`** ×3,327, decisively POSTPOSED: `N سلنه` ×2,657 against `سلنه N` ×29. The sign is
  postposed too but not only — `N٪` ×3,024 / `٪N` ×564, `N%` ×1,259 / `%N` ×502 — so both orders must be
  claimed and both must emit the postposed word.
- **Range connective `تر`** ×1,221 between two bare numerals, every instance read a genuine span
  (`٣ تر ١٠ سانتي مترو`, `۱۵۱۵ تر ۱۵۴۷`, `۴۶۰ تر ۳۷۰`) and grammatical without the `له …څخه…پورې` frame.
- **Era words**: زېږديز ×1,717, لمريز ×2,655, ميلادي ×1,167, هجري ×1,431 — each the expansion of its own
  abbreviation, all attested in running prose.
- **Ordinal series** from the corpus's own words: لومړی ×8,275 (SUPPLETIVE, not یوم ×22), دویم ×2,473,
  درېیم ×794, then regular — څلورم 1,166, شپږم 619, لسم 286, شلم 30. A cardinal ending in ه drops it
  (پنځه→پنځم 607, اووه→اووم 324, اته→اتم 381, نهه→نهم 248); a cardinal ending in ا takes ه (اویا→اویاهم 44).
- **`سانتيګراد`** ×100 (×56 right after a number) and **`ډالر`** ×2,520 (×374 after a number).

**REFUSED, each with the check that refused it.**

- **`=` and `+`** — see Run 3. The counts are heading markup and chemistry.
- **`×`** ×196 is three different things in one glyph: a cartridge dimension (`۳۹×۷،۶۲`), scientific
  notation (`1.60218 × 10 −13`), an engine count (`۲ × Lyulka AL-37FU`) and genuine arithmetic
  (`1×8 + 90×8`). No single reading is right for all four.
- **`&`** ×297 sits inside LATIN text every time — `AT&T`, `P&T`, `Sight & Sound`, `N4 & N405`, and URL
  query strings. Reading it as او would put a Pashto word inside an English name.
- **Initialisms.** `core/initialisms.ts` is a no-op without a `letterName` table and espeak ships no
  Pashto. The fleet's 94-language sourcing block, not a coding one.

## Run 5 — 2026-08-10 — writing, and the six defects the corpus diff found

See `src/languages/pashto/normalize.ts` for the 13 ordered steps and the coupling comments. The layer is a
**factory**, `makePashtoNormalizer({ numeralWords })` — the playbook's documented shape — because the
ordinal rule needs the engine's number speller and the engine calls the normalizer, so a direct import
would be a cycle.

The unit probes were all green before the diff was read. It found six defects, and reading it is the only
reason any of them is fixed:

| # | what the diff showed | why |
|---|---|---|
| 1 | `۴۲۳/۴۲۴م‌ز` → `میلادي‌ز` | **A BC date read as its own opposite.** `م.ز` (مخزېږديز ×641) is *before* CE, written four ways including ZWNJ-joined. U+200C is category `Cf`, so `(?![\p{L}\p{M}])` treated it as a word END, the bare-`م` (AD) arm fired, and the `ز` was stranded. ×187 |
| 2 | `۹۹% سلنه` → `۹۹ سلنه سلنه` | the corpus writes both sign and word (×77) — trap 12 |
| 3 | `… نېټه - ۱۹۷۹ د ډسمبر` → `منفي ۱۹۷۹` | **a death year read as a negative.** A SPACED dash between two full dates is a dash; the range rule cannot claim it because its operands are dates. Measured `-[digit]` ×2,538 vs `- [digit]` ×4,296, and the corpus writes its true negatives GLUED (`-7 °C`), so requiring adjacency keeps every real one |
| 4 | `30 130-140ml/ha` → `30130` | **the space-grouping arm was pure exposure** — see below |
| 5 | `د$۲۴۰بيلون` → `ډالربيلون`; `۱۰%سلنه` → `۱۰سلنه` | a rewrite that drops a sign must not drop the BOUNDARY it supplied (trap 26). Both re-spaced |
| 6 | `100 $ میلیارده امریکایي ډالرو` → `100 ډالر میلیارده امریکایي ډالرو` | the name may be on the RIGHT, and a magnitude belongs INSIDE the quantity — the same wrong-slot defect the playbook records for Indonesian's `US$` |

**There is no space-grouping arm, and that is a measurement.** `D{1,3}( D{3})+` matches **115** times and
**not one** is a Western-style space grouping: phone numbers (`90 510`, `+1 613 745-1576`, `059 133`),
data-table columns (`22 1 6 266 6 انگور 17 4 13 504 28 كيله`), page references (`مخ. 8 148`) and a netmask.
Pashto groups with `،` and `,`; the arm was removed after defect #4 showed its cost.

**The stated cost of the dot decision.** `۱۱۰.۹۹۴ کيلو متر مربع` is 110,994 km² — a GROUPING — and now
reads as a decimal. It is structurally identical to `3.180 کیلوګرامه` (3.180 kg, a decimal) and
`15.744 ميلیونه ټنه`, so no guard separates them; the samples leaned decimal and the rule follows the
majority. Recorded rather than hidden.

## Run 6 — 2026-08-10 — gates, and the residual

```
tsc --noEmit           clean
vitest run             233 files, 3334 tests, all pass  (11 in test/pashto.test.ts)
referee-eval ps        1,414 words · folded backbone 787/1,414 (55.7%) · symbol accuracy 83.8%
                       UNCHANGED — the residuals are all short-vowel restoration, the language's
                       documented deferred subsystem, and this layer touches no bare Pashto word
corpus-diff mined:ps   changed 168/447 (37.6%)
                       DROP 78 → 39 · DIGIT 0 → 0 · SLOT-GAP 0 · RAWMARK 0 · THROW 0
mine.ts scan           no defects
review.ts --lang ps    checklist clean
```

`review.ts` reports `[??] sourcing — no percent/currency/decimal word declared`. That is the trap-42 shape
rather than a gap: the check looks for a `makeSymbolNormalizer({percent|currency:…})` declaration and this
layer emits its words directly, because the shared tier runs downstream of the decimal rewrite. Each word
is corpus-sourced with its count at the rule — سلنه ×3,327, ډالر ×2,520, اعشاريه ×184, سانتيګراد ×100.

**The residual, enumerated by instance** and written into `tools/normalization/defects.ts`:

- **class-level** (`ACCEPTED_SIGN_SILENCE`) — `=` (heading markup + chemistry), `+` (chemical equations),
  `×` (four senses in one glyph), `<`/`>` (one imported English fragment), `&` (Latin text every time).
- **per instance** (`ACCEPTED_SILENT`) — `degree` ×5, all geographic coordinates (`۳۳°۳۹'۱۱"N`), where the
  temperature degree IS read; `exponent` ×7, scientific notation plus a numberless `هر km²`, the Pashto
  abbreviation `ک.م²` and a FOOTNOTE marker `يادېږي²`; `currency` ×3 undeclared currencies (₹ £ ₩) and ×3
  permissible `$` drops where the sentence names the dollar in an oblique form; `minus` ×1, an en dash
  inside the scientific-notation range `10¹¹–10¹²` — a span, not a negative.

Pashto is the FIFTH corpus to produce the scientific-notation exponent false positive, after four Sinitic
wikis produced the romanization-tone-number one from four different sources.
