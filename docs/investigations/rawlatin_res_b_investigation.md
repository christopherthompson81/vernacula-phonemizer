# RAW-LATIN residuals in my, ht, yo, su, mad — investigation

The `RAW-LATIN` detector (`rawLatinIn`, commit `9a3626c`) reports an ASCII run of ≥2 letters with no vowel
letter that the SOURCE typed and the IPA still says verbatim. These five languages all HAVE a normalization
layer, so every hit is either a gap in that layer or a class it has already refused. The question this log
answers is what each hit IS, one at a time — not how to make the counter go down.

## Run 1 — 2026-08-13 13:20

**Command.** `npx tsx probe-rlscope.scratch.mts` for the brief's figures, then
`npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/<L>.jsonc --lang <L>` per language, then a
per-hit dump of the same detector printing the run, ±90 characters around EVERY whole-token occurrence of the
run in the line, and the IPA around the echoed token.

**Question.** How many hits are there really, and what is each one?

**Raw finding — the probe UNDER-REPORTS, as the brief says.** The probe reads only the artifact's `hard`
tier; `mine.ts scan` reads `hard` + `sample`. Quoting the SCAN, which is the gate:

```
            probe (hard only)                 scan (hard + sample)
my     10   kg:9 ft:1                    10   kg:9 ft:1
ht      9   km:5 pm:1 ms:1 mw:1 th:1     14   km:5 tv:4 pm:1 ms:1 mw:1 th:1 vs:1
yo     11   th:3 ft:3 ml:1 ltd:1 fm:1 km:1
                                         15   th:5 ft:4 ml:1 ltd:1 fm:1 km:1 bg:1 st:1  (+1 ACCEPTED-MARKUP)
su      8   np:1 sp:1 pm:1 gr:1 mph:1 sld:1
                                          9   np sp pm gr mph sld htm pdf mg — one each
mad     7   dpl:2 ktm:1 mc:1 ft:1 pm:1 ps:1
                                          8   dpl:2 ktm:1 mc:1 ft:1 pm:1 ps:1 st:1
```

`my` is the only one where the two agree. `ht` gains four `tv` and a `vs`, `yo` four hits, `su` `htm`/`pdf`,
`mad` an `st`. **All figures below and in every later run are the SCAN's.** Baseline total: **56**.

### Every hit, classified

**my — 10.** One article dominates: a numbered Burmese drug formulary whose drug names and dosing are written
in the international pharmaceutical register and whose indications and side-effects are Burmese.

* `kg` ×8 — `mg/kg` ×7 and `ug/kg` ×1, a mass-per-mass DOSE (`5 mg/kg daily for children`, `30 mg/kg`,
  `0.75 mg/kg BD`, `1.4 ug/kg daily`). ⚠ **A DECLARED UNIT THAT STILL REPORTS.** `kg` IS in the layer's
  `UNITS`; step 11 requires a DIGIT immediately before the abbreviation and here the character before `kg`
  is a slash. Neither `mg` nor `ug` is declared at all, and the layer has no rate machinery: its only slash
  rule (step 8, fractions) requires bare digits on both sides. Cause: **missing key + no `unitPer`**, the
  second of the brief's three.
* `kg` ×1 — `ပရိုတွန်တစ်ခု၏ ဒြပ်ပမာဏမှာ 1.67262192369(51)×10 −27 kg ဖြစ်၍` — a GENUINE kilogram in Burmese
  prose, the proton's mass. ⚠ **Not a missing key either: the layer's own RANGE rule eats it.** `10 −27` is
  a scientific-notation exponent (U+2212 is in the rule's `DASH` class), so step 9 rewrites it to
  `10 မှ 27 အထိ` — and step 11's digit-then-unit adjacency is destroyed by the Burmese word now standing
  between `27` and `kg`. Cause: **a modifier between the number and the unit**, the third of the three, with
  the layer supplying the modifier itself. `×10` occurs once in this artifact.
* `ft` ×1 — inside a wholly ENGLISH paragraph about an aircraft radar-cross-section test range
  (`placed on a 15-meter (50 ft) articulating pole`). Not Burmese writing; the metric figure is already
  given. English residue.

**ht — 14.**

* `km` ×4 — every one is `km/h` in the cyclone-scale article (`(63 km/h)`, `(117 km/h)`, `(118 km/h)`,
  `408 km/h`). ⚠ **ALREADY A DOCUMENTED REFUSAL**, in `haitian/normalize.ts`'s own `UNITS` header: *"A
  SLASHED UNIT IS NOT CLAIMED. `km/h` ×9 has no attested Haitian reading (`kilomèt` is attested, the
  per-hour idiom is not)"*, and the trailing guard rejects `/` deliberately so `9 km/h` cannot read as
  `9 kilomèt` with a stranded `/h`. Re-opened in Run 3 as a sourcing question, not a coding one.
* `km` ×1 — `yon sifas tè km² ( mil kare) e donk yon dansite de abitan pou chak km² ( pou chak mil kare)`.
  ⚠ **THE TEMPLATE LOST THE FIGURES**: there is no numeral anywhere near either `km²`. This is exactly the
  shape `BARE_UNITS` exists for, and the bare-unit pass cannot reach it — `makeBareUnitNormalizer`'s
  trailing guard excludes `²`/`³` outright. Cause: **the exponent refusal**, the first of the three.
  `km²` → `kilomèt kare` is already declared and attested ×24.
* `tv` ×4 — French filmography lines, `(fim tv)`. `fim` is the Creole word, so the parenthetical is Creole
  even where the film titles are French. An INITIALISM. ⚠ `haitian/normalize.ts` states the fleet-wide block:
  *"NO INITIALISMS … `core/initialisms.ts` … is a NO-OP without a `letterName` table and espeak does not ship
  Haitian Creole at all"*. Classified, not read.
* `pm` ×1 — `nan 4:53 pm tan lokal`, the 2010 earthquake article, translated from English. Meridiem.
* `ms` ×1 — `(Anth. p.40.) (ms. Paysage irréel)` — French bibliographic *manuscrit*, in a French citation.
* `mw` ×1 — `Tanpri di mw li ankò`, twice: SMS-register spelling of `mwen` ("me") in a transcribed
  interview. The language's own word, abbreviated. See Run 3.
* `th` ×1 — `Proceedings of the 40th Hawaiian International Conference` — an English ordinal in an English
  citation.
* `vs` ×1 — `Monstres contre Aliens (Monsters vs. Aliens)`, the English film title beside its French one.

**yo — 15 (+1 already accepted as markup).**

* `th` ×5 — English ordinal tails. Two sit in English lines (`in the 13th century`, `4th Olugayan from
  1936-1949`); three sit in YORUBA prose (`Ni orundun 19th`, `ilaninaro apaiwoorun 68th ati 125`,
  `Nàìjíríà ní 2007 jẹ́ 37th lágbàáyé`). See Run 4 — Yoruba's ordinal is a PREFIX, `kọkàndínlógún`, not a
  tail, so nothing here is a suffix rewrite.
* `st` ×1 — `Trilingual 1st ni Nigeria`, the same English ordinal in a mixed line.
* `ft` ×4 — `2419 m (7936 ft)`, `8.62 mítà (28.3 ft)`, `(75 ft)`, and ⚠ `150 ẹsẹ̀ (ft)`. **The fourth one is
  the corpus GLOSSING THE ABBREVIATION WITH THE YORUBA WORD**, which is why yo is not the ak/sn/mos/jv
  imperial-parenthetical refusal. See Run 4.
* `ml` ×1 — `100 mIU/ml`, `10 sí 100 mIU/ml`, `10 mIU/ml`: a hepatitis-B antibody titre. The NUMERATOR
  (`mIU`, milli-international-units) has no reading in any language here, so declaring `ml` alone cannot
  compose the rate. See Run 4.
* `km` ×1 — `ìwọ̀n ilẹ̀ tó tó 705.78sq km 2 120, 220`. ⚠ `sq` — an ENGLISH modifier — stands between the
  number and the unit, the `so`/`sq mi` cause exactly, and it is template debris (`km 2` is a mangled `km²`
  and `120, 220` a mangled population figure).
* `ltd` ×1 — `University Press ltd.`, an English publisher in a bibliographic citation.
* `fm` ×1 — `odidere fm`, `96.3Fm`, `101.9fm`, `88.3fm`, `98.9Fm`: radio band/callsign. Classified.
* `bg` ×1 — `bg:Списък на най-големите урбанизирани зони в Африка`, a bare interwiki prefix on a Bulgarian
  page title. Template debris; the line is Bulgarian.
* `html` ×1 — already `ACCEPTED-MARKUP RAW-LATIN`, a TripAdvisor URL in a `<a …>` fragment.

**su — 9.** `sundanese/normalize.ts` is a mature layer and `defects.ts`'s `su` entry already accepts several
of this corpus's shapes (algebra over variables, LaTeX `$…$` delimiters, an IUPAC locant chain).

* `pm` ×1 — `Beungkeut O-H na métanol (CH 3 OH) panjangna kira 0.96 Å (96 pm)` — PICOMETRES, a genuine
  length in Sundanese prose. Undeclared key.
* `gr` ×1 — `beuratna 150 gr` — GRAMS, spelled `gr`, in Sundanese prose about the kidney. The layer declares
  `g` but not the `gr` spelling. Undeclared key.
* `mg` ×1 — `ngandung nepi ka 5 mg séng` — MILLIGRAMS in Sundanese prose. Undeclared key.
* `mph` ×1 — `160 km/h (100 mph)`. The imperial-gloss parenthetical, refused fleet-wide. ⚠ **But reading
  this line turned up a defect the raw-Latin detector is structurally blind to**: `160 km/h` reads
  *sarátus genep puluh kilométer **h*** — the `h` is a single letter, so no vowelless-run rule can ever see
  it. See Run 5.
* `sp` ×1 — `karbon nu kahibridisasi sp³`, orbital hybridisation. ⚠ And the `bareExponent` declaration reads
  its cube: the IPA is *sp **kubik***. Chemistry notation, not a unit.
* `np` ×1 — `méan μ = np sarta simpangan baku σ = (n p (1 - p))`: the product of the variables n and p in the
  binomial-approximation formula. The same line is ALREADY instance-listed under `su.math-sign` in
  `defects.ts` for its `1 - p`.
* `sld` ×1, `htm` ×1 — one line, a bare URL path in a citation (`ELMAG305/em8a/sld006.htm`).
* `pdf` ×1 — `large version (pdf, 1.8MB)`, an image-caption file format inside `[[…]]` markup.

**mad — 8.**

* `dpl` ×2 (3 occurrences) — `12 – 74 meter dpl`, `8 mèter dpl … 91 mèter dpl … -1 mèter dpl`. Indonesian
  *di atas permukaan laut*, "above sea level", used in Madurese prose. The language's own borrowing of an
  Indonesian abbreviation. See Run 6.
* `ktm` ×2 — `klabân nyetor ktm`, `klabân merri' ktm`: *Kartu Tanda Mahasiswa*, an Indonesian student-ID
  initialism, in the Universitas Indonesia article. Code; classified, not read.
* `mc` ×1 — `rumus persamaan massa-energi E = mc²`. A formula over VARIABLES. `so` and `tl` already carry
  `mc²` as an accepted `exponent` instance in `defects.ts` for the same reason.
* `ps` ×2 occurrences, 1 run — `Perkasa Bromo 195 ps 4×2`, `220 ps 6×4`: German *Pferdestärke*, metric
  horsepower, in a truck's spec table. A foreign unit code in a designation.
* `pm` ×1 — `torsina sè rajâ ampon èkaandi' sajjhe' pm rendâ`. ⚠ Read against the Indonesian this article was
  translated from (*"torsi besar sudah dimiliki sejak rpm rendah"*), the `pm` is a TRUNCATED `rpm` — the
  source's own typo. Not a word, not a unit, not repairable from this side.
* `ft` ×1 — `277 m (909 ft)`, Mecca's elevation. The imperial-gloss parenthetical again.
* `st` ×1 — `Lucius Annaeus Seneca the Younger (1902) [1st century]`, an English citation.

**Implication.** Of 56 hits, the ones with a plausible layer fix are: my `kg` ×9 (a rate rule plus two
missing keys, and a range-rule guard), ht `km²` ×1 (the bare-unit exponent), su `pm`/`gr`/`mg` ×3 (missing
keys) and su's invisible `km/h` `h`; yo `ft` ×4 turns on whether the corpus's own gloss attests a Yoruba
foot; yo `km` ×1 and `ml` ×1 need a decision; mad `dpl` ×2 needs a sourcing probe. Everything else is
English/French citation residue, codes, formula variables, URL debris or a source typo, and the right
outcome for those is to stay reported with the reason recorded here. Runs 2-6 take them language by
language.

## Run 2 — 2026-08-13 13:27 — my

**Command.** `attest.ts --lang my --words မီလီဂရမ်,ကီလိုဂရမ်,မိုက်ခရိုဂရမ်` and
`--words တစ်နာရီလျှင်,ကီလိုဂရမ်လျှင်,တစ်ကီလိုဂရမ်လျှင်`; then the edits; then
`mine.ts scan --in tools/corpus/mined/my.jsonc --lang my` and `npx vitest run test/burmese.test.ts`.

**Question.** Are the dose nouns and — the harder half — the RATE CONNECTIVE and its WORD ORDER attested,
or would reading `30 mg/kg` be inventing Burmese?

**Raw finding.** Burmese is unspaced, so every verdict is `attested*` (a substring count) and the examples
are the whole of the evidence. Read:

```
မီလီဂရမ်       57 tokens / 14 articles   ဗီတာမင် စီ ၅၀ မီလီဂရမ်ခန့်ပါဝင်သည် · ၂၉၁ မီလီဂရမ်ပါပြီး · ၉၃ မီလီဂရမ် (၃၁%)
ကီလိုဂရမ်      31 / 13                   ကီလိုဂရမ် ဆိုသည်မှာ ဒြပ်ထု ၏ မက်ထရစ် ယူနစ် ဖြစ်သည် — a definitional article
မိုက်ခရိုဂရမ်  7 / 3                     ဗီတာမင်ကေ (Vitamin K) ၂.၂ မိုက်ခရိုဂရမ် · ၁ မိုက်ခရိုဂရမ် (1 microgram=…)
တစ်နာရီလျှင်   6 / 5                     မြန်မာနိုင်ငံ၌ တစ်နာရီလျှင် ၇၅ မိုင်တိုက်ခတ်သော လေမုန်တိုင်း
တစ်ကီလိုဂရမ်လျှင် 4 / 4                  ကတိုးသည် တစ်ကီလိုဂရမ်လျှင် ဒေါ်လာ ၄၅၀၀၀ တန်လေသည်
```

Every microgram and milligram hit is a genuine mass of a nutrient or an element; the kilogram article is
definitional. ⚠ **AND THE WORD ORDER IS THE FINDING, NOT THE WORD.** In all four `တစ်…လျှင်` instances the
rate phrase is a PREPOSED adverbial and the quantity FOLLOWS it — *"civet is, per one kilogram, worth
45 000 dollars"*, *"winds of 75 miles per hour"* — and a fifth instance supplies the day denominator
(`စက်နာရီက တစ်ရက်လျှင် ၂၄ နာရီ ရှိသည်`, "a clock has 24 hours per day"). Emitting `၃၀ မီလီဂရမ် တစ်ကီလိုဂရမ်လျှင်`
would have been the English order dressed in Burmese words, and no corpus instance writes it. This is the
same lesson the layer's header already records for the squared modifier and the fraction.

**Declared.** `mg` → မီလီဂရမ်, `[uµμ]g` → မိုက်ခရိုဂရမ်, and a rate step 2b emitting `တစ်{denom}လျှင် N {unit}`
for `kg`, `h`/`hr`/`hrs` and `d`/`day`. ⚠ Two things had to be got right and both are bugs that happened:

* **The rate runs BEFORE the clock, decimal and range rules, because it MOVES the numeral.** `0.75 mg/kg`
  and `10-15 mg/kg` must still be single tokens when it captures them; relocated, they are then read in
  their new position by those same rules (`၀ ဒသမ ၇ ၅`, `၁၀ မှ ၁၅ အထိ`). Placed after the unit rules it has
  nothing left to carry.
* **`mg`/`ug` are safe only because step 11 demands a digit.** `Mg` is how Burmese writes the honorific
  မောင် (*Maung*) in Latin script and is magnesium's symbol; neither ever follows a digit.
  `normalizeBurmese("Mg Mg")` is unchanged, and that is a golden test.

**The second `kg` was not a missing key at all.** `1.67262192369(51)×10 −27 kg`: U+2212 is in the range
rule's `DASH` class, so `10 −27` read as *"10 မှ 27 အထိ"* — and the `အထိ` the rule inserted then stood
between the number and `kg`, so step 11's digit-then-unit adjacency failed and a DECLARED unit leaked as raw
ASCII. Guarded on a preceding `×`/`x`, the only thing in this corpus that writes a mantissa.
⚠ **AND THE FIRST VERSION OF THAT GUARD DID NOTHING, WHICH IS THE REUSABLE PART.** Rejected at the `1` of
`×10`, the engine stepped one character along and matched `0 −27` instead — the range was still read and the
only difference was where the `မှ` landed. A lookbehind that can be stepped past is not a guard; the left
operand also had to be anchored to the start of its digit run with `(?<![0-9၀-၉])`. The negative exponent
itself stays SILENT, which is negative result 1 in the layer's header holding, not a new refusal.

**Result. my `LEAK RAW-LATIN` 10 → 1.** `scan` now reports only `ft ×1`, and that hit is inside a wholly
English paragraph that already gives the metric figure (`a 15-meter (50 ft) articulating pole`) — the
imperial-gloss-parenthetical class ak, sn, mos and jv all refuse, here with the added fact that the sentence
is not Burmese at all. Left reported. 23 burmese tests pass, 5 of them new.

**Implication.** Two of this language's nine `kg` causes were the two the brief names as invisible from the
unit table, and one of them was the layer eating its own unit. Worth checking the other four layers for a
rule that fires between a number and its unit before assuming a key is missing.

## Run 3 — 2026-08-13 13:31 — ht

**Command.** `attest.ts --lang ht --words "kilomèt alè,pa èdtan,chak èdtan,pa lè,alè,èdtan"`, then
`--words "mw,aprèmidi,diswa"`; then the edits; `mine.ts scan --in tools/corpus/mined/ht.jsonc --lang ht`;
`npx vitest run test/haitian.test.ts`.

**Question.** The layer's own header says the per-hour idiom is not attested. Is that a fact about Haitian
or a fact about the mined artifact? And is `mw` the Creole word `mwen` abbreviated?

**Raw finding — the refusal was measured on the wrong haystack.**

```
kilomèt alè   0 / 0    absent
pa èdtan      2 / 2    attested   van ki ap soufle omwen a 120 KILOMÈT PA ÈDTAN
                                  ki sikile a 185 KILOMÈT PA ÈDTAN
chak èdtan    2 / 2    attested   jiska 1 l pou chak èdtan · plis pase 1 000 Nm3 idwojèn pou chak èdtan
alè          28 / 16   attested   100 mil ALÈ — but 27 others are "on time" / "at the moment"
èdtan        70 / 20   attested   8 èdtan PA jou — same connective, different denominator
```

Both `pa èdtan` hits are the WHOLE PHRASE this rule would emit, number-first and postposed, next to
`kilomèt` — the very noun already declared — and in the same cyclone/wind register as all four leaking
lines. Two hits is thin and is recorded as thin. `alè` is the trap in miniature: a rate reading exists for
it (`100 mil alè`) but 27 of its 28 tokens mean "on time", so it is not the form to take.

⚠ **`mw` IS THE FALSE ATTESTATION OF THIS RUN, AND IT LOOKED STRONG: 76 tokens / 14 articles.** Read, every
single example is `.mw-parser-output .reflist-columns-2{column-width:30em}` — MediaWiki CSS class debris
leaking through the dump's markup stripper. Not one is Creole. So the corpus's `Tanpri di mw li ankò` stays
what it is — SMS-register spelling of `mwen` in a transcribed interview — with no independent evidence that
the written language uses it, and it stays reported. This is `nan`'s `kong-si` and `bar`'s `Komma` again:
the count was real and meant nothing.

**Declared.**

* **A RATE ARM**, `N km/h` → `N kilomèt pa èdtan`, for every non-exponent key. ⚠ It runs BEFORE every arm
  that can take a unit on its own, and that ordering is the whole of what makes the claim safe: the
  single-operand arm sees a number adjacent to `km` in `63 km/h` and would emit `63 kilomèt` with `/h`
  stranded — precisely the new defect the old refusal existed to prevent. The trailing `/`-rejecting guard
  the header describes is untouched and still does its job for any denominator not claimed here.
* **A BARE EXPONENT UNIT**, `km²`/`m²`/`m³` with no numeral anywhere. `makeBareUnitNormalizer` cannot reach
  these by construction — `isBareUnitKey` rejects a key that is not all letters and the trailing guard
  excludes `²³` — and the corpus line is `yon sifas tè km² ( mil kare) e donk yon dansite de abitan pou chak
  km² ( pou chak mil kare)`, where the template lost EVERY figure. Same case the bare-unit pass was written
  for, one superscript further on. Guarded against a preceding digit so a counted `605 km ²` still belongs
  to the counted arm.

**Left reported, with the reason.**

* `tv` ×4 — an initialism, and `haitian/normalize.ts` records the fleet-wide block: no `letterName` table is
  possible because espeak ships no Haitian Creole at all. Nothing to read it WITH.
* `pm` ×1 — inside a class the layer has already refused for a measured reason: *"NO CLOCK. 58
  colon-numerals in Creole text and the majority are SCRIPTURE references … Claiming the colon claims the
  references"*, and that header names `nan 4:53 pm` as one of the few real clocks. ⚠ The meridiem word
  itself IS attested (`aprèmidi` 7/7, `vè 3 zè 15 nan aprèmidi`; `diswa` 6/5, `uitè diswa`) — so this is a
  reading blocked by the clock refusal it depends on, not by a missing word. Reading `pm` alone would give
  "kat, senkanntwa nan aprèmidi": half a clock with the pause still in it.
* `ms` ×1 (French *manuscrit* in a French citation), `th` ×1 (English ordinal in an English citation),
  `vs` ×1 (the English title beside the French one), `mw` ×1 (above).

**Result. ht `LEAK RAW-LATIN` 14 → 9, `km` 5 → 0.** One golden expectation changed and is justified in
place: `normalizeHaitian("9 km/h")` was `"9 km/h"` and is now `"9 kilomèt pa èdtan"`. 21 haitian tests pass.

**Implication.** A refusal recorded against the mined artifact is a refusal against 440 lines. Both of this
group's biggest single runs turned out to be reachable, and neither by expanding an abbreviation.

## Run 4 — 2026-08-13 13:35 — yo

**Command.** `attest.ts --lang yo --words "ẹsẹ̀ bàtà,ẹsẹ bàtà,ẹsẹ bata,mililítà,mílílítà"`; then the edits;
`mine.ts scan --in tools/corpus/mined/yo.jsonc --lang yo`; `npx vitest run test/yorubaNormalize.test.ts
test/yoruba.test.ts test/yorubaNumbers.test.ts`, and every declared reading phonemized and read.

**Question.** ak, sn, mos and jv all leave `ft` reported inside a metric-glossing parenthetical. Is yo the
same case?

**Raw finding — NO, AND THE CORPUS SAYS SO IN ONE LINE.** The reason the other four refuse is that the
language has no foot word. yo's own artifact contains `tí ọkọọkan tó 150 ẹsẹ̀ (ft) ní gíga` — the
abbreviation set beside the Yoruba noun, in the same sentence, as its definition — and the layer's `METRE`
note already quotes `500 mítà (1,600 ẹsẹ̀ bàtà)`.

```
ẹsẹ̀ bàtà   19 / 15  attested   ẹ̀ẹ́dẹ́gbẹ̀rún mítà (900m), ìwọ̀n ẹsẹ̀ bàtà … (2,953ft)
                                mítà méje (ẹsẹ̀ bàtà mẹ́tàlélógún àti ìnṣì)
                                ère … tí ó tó ẹsẹ bàtà mẹrin (1.2 m)
ẹsẹ bàtà     9 / 8   attested   the untoned spelling of the same word
mililítà     0 / 0   absent
mílílítà     0 / 0   absent
```

⚠ **AND THE WORD-ORDER COUNT LOOKED PREPOSED, WHICH IS THIS FILE'S OWN RECORDED TRAP.** Six of the read
hits put the noun first — but in every one of those the number is SPELLED OUT (`ẹsẹ bàtà mẹrin`,
`ẹsẹ̀ bàtà mẹ́tàlélógún`) or the phrase is framed by `ìwọ̀n` ("the measure of"). Where a DIGIT is involved,
which is the only shape a rule can ever match, the corpus writes `1,600 ẹsẹ̀ bàtà` and `150 ẹsẹ̀` — number
first, the tier's default, exactly as the `units` note found for the athletics event names.

**Declared.** `ft` → `ẹsẹ̀ bàtà`, ⚠ the COMPOUND and never bare `ẹsẹ̀`: this file's header already argues
that bare `ẹsẹ̀` is a foot/leg and a verse-line and refuses it for the decimal point on exactly that
ground. Phonemized and read: `tó ga tó 7936 ft` → *…mɛ́rĩ̀dĩ́loɡódʒì **ɛ̀sɛ̀ bàtà***.

**Also declared: `sq` before a declared unit** — the `so` finding reproduced. `ìwọ̀n ilẹ̀ tó tó 705.78sq km 2`
is Ibarapa East's area; the English measure word stands between the number and the unit, so the tier's
digit-adjacent path declines too and the line loses BOTH the `km` reading and the area. Only before a unit
this file can read, so an unreadable one keeps its `sq` rather than half the phrase being spoken.
⚠ Note it is written GLUED to the numeral (`705.78sq`), so the replacement has to carry a leading space or
it fuses the noun onto the number — `8kìlómítà` — for the tokenizer to swallow whole.

**Left reported, with the reason.**

* `th` ×5 / `st` ×1 — English ordinal tails. Three sit in Yoruba prose (`Ni orundun 19th`, `apaiwoorun 68th
  ati 125`, `2007 jẹ́ 37th lágbàáyé`) and the rest in English lines. ⚠ **NOT A SUFFIX REWRITE IN THIS
  LANGUAGE**: Yoruba's ordinal is the PREFIX `kẹ-`/`ìkẹ-` on a spelled-out numeral (`ọ̀rúndún kọkàndínlógún`
  for "19th century"), so there is no tail to replace and reading `19th` means generating the whole ordinal
  word and DELETING the digits the reader can see. That is a numbers-layer question with its own blast
  radius, not a raw-Latin one, and it is left rather than half-done. ht's `th` and mad's `st` are the same
  ordinal in plainly English citations.
* `ml` ×1 — `100 mIU/ml`, a hepatitis-B antibody titre. ⚠ TWO independent blocks, either sufficient: no
  Yoruba millilitre is attested (`mililítà` and `mílílítà` are both 0/0 — the litre `lítà` exists but the
  milli- prefix form does not), and the NUMERATOR `mIU` (milli-international-units) has no reading in any
  language in this repo, so even a declared `ml` would compose *"… mIU per millilitre"* with the numerator
  still raw. An unsourced word here would be invention, which is trap 37.
* `fm` ×1 — `odidere fm`, `96.3Fm`, `101.9fm`, `88.3fm`: the radio band, five occurrences in one article.
  An initialism; yo has no letter-name table wired here.
* `ltd` ×1 — `University Press ltd.` in an English bibliographic citation.
* `bg` ×1 — a bare interwiki prefix on a Bulgarian page title; the line is Bulgarian.
* `html` ×1 — already `ACCEPTED-MARKUP`.

**Result. yo `LEAK RAW-LATIN` 15 → 10**; `ft` 4 → 0, `km` 1 → 0. No golden expectation changed; 5 new
assertions across two new tests. 38 yoruba tests pass.

⚠ **One reading got LOUDER rather than fixed and it is worth recording**: `150 ẹsẹ̀ (ft)` now reads
*150 ẹsẹ̀ (ẹsẹ̀ bàtà)* — the bare-unit pass reads the parenthetical gloss, so the noun is spoken twice.
That is the shared pass behaving as designed on a sentence that defines the abbreviation, and it replaces
two raw ASCII letters with a redundant Yoruba word. Not silenced, because the percent rule's "already
said" suppression keys on a fixed circumfix and there is no general form of that test for units.

## Run 5 — 2026-08-13 13:38 — su

**Command.** `attest.ts --lang su --words "miligram,pikométer,pikometer,gram"`, a regex census of the four
unit shapes in the artifact, then the edits, `mine.ts scan --in tools/corpus/mined/su.jsonc --lang su` and
`npx vitest run test/sundanese.test.ts`.

**Question.** `defects.ts`'s `su` entry already accepts several of this corpus's shapes. Which of the nine
hits are units the layer could read, and which are already-argued refusals?

**Raw finding.**

```
miligram    16 / 7   attested   ⚠ su.wikipedia's *Gram* article is a DEFINITION LIST of this very table:
                                "Simbol gram nyaéta g. 1 MILIGRAM (MG) = 0,001 gram 1 sentigram (sg) = 0,01
                                gram … 1 kilogram (kg) = 1000 gram"
                                and running prose to match: "269 miligram kalium", "55 miligram Vitamin C"
pikométer    1 / 1   attested   "panjang gelombang di antara 10 nanométer jeung 100 PIKOMÉTER"
pikometer    0 / 0   absent     (the unaccented spelling)
gram        34 / 20  attested   definitional, plus nutrition tables
```

Census of the artifact: `\d gr` ×1, `\d pm` ×1, `\d mg` ×1, `km/` ×1. Every one is a single instance, so
every declaration below is made on the WIKI's evidence and not the artifact's.

**Declared, at three different strengths, stated rather than levelled.**

* `mg` → *miligram*. The strongest evidence in this whole investigation: the corpus's own article glosses
  the abbreviation with the word, in a list that also glosses `g` and `kg` — the two keys already shipped.
* `gr` → *gram*. ⚠ **NOT A NEW WORD**, a second SPELLING of an abbreviation whose word is already declared
  under `g`. And the limit is stated: the *Gram* article's symbol list has `g` and NOT `gr`, so this is how
  the corpus writes the unit rather than how the standard spells it. Digit-bound like every key here.
* `pm` → *pikométer*, **1 token / 1 article, and that is recorded as a lead rather than dressed up as a
  finding**. What carries it is that the one hit has exactly this sense (a length in a wavelength range,
  beside its neighbouring SI prefix), the corpus instance is the same physics register (`0.96 Å (96 pm)`, a
  bond length), and the form is the transparent compound of a `-méter` series this file already ships four
  members of. The same standard this file's own `liwat` is shipped on, with the thinness in the comment.

⚠ **AND THE FIND OF THIS RUN IS A DEFECT NO COUNTER IN THIS REPO COULD REPORT.** Reading the line the `mph`
hit pointed at: `160 km/h (100 mph)` phonemized as *sarátus genep puluh kilométer **h*** — the tier resolved
the head unit, failed to resolve the DENOMINATOR against a `rateDenominators` keyed only on the Sundanese
words `jam`/`detik`, and re-emitted the letter raw. `h` is ONE letter and `rawLatinIn` requires two, so the
raw-Latin class is blind to it by construction; `LEAK RAW-CAPS` needs an uppercase letter; no drop test
fires because nothing vanished. It survived a mature layer because nothing could see it. `h: "jam"` and
`s: "detik"` added — no new word, the same nouns the `km/jam` spelling already resolves to.

**Left reported, with the reason.**

* `mph` ×1 — the imperial gloss in a parenthetical that restates a metric figure given in the same
  sentence, now doubly so: `160 km/h` reads correctly and completely, so the `(100 mph)` beside it is
  redundant as well as foreign. The fleet-wide refusal, unchanged.
* `sp` ×1 — `karbon nu kahibridisasi sp³`, orbital hybridisation. ⚠ Worth recording that `bareExponent`
  reads its cube, so the IPA is *sp kubik*: the layer's own declaration, whose 23-repairs-for-15-misreads
  margin is already argued in its comment, spends a "cubic" on a chemistry label. Consistent with that
  argument, not a new defect.
* `np` ×1 — the product of the variables n and p in the binomial approximation. ⚠ The SAME LINE is already
  instance-listed under `su.math-sign` in `defects.ts` for its `1 - p`, with the reason: reading a dash
  between two variables is the same shape as the reduplication hyphen Sundanese writes constantly.
* `sld` ×1 + `htm` ×1 — one line, a bare URL path in a citation (`ELMAG305/em8a/sld006.htm`).
* `pdf` ×1 — `large version (pdf, 1.8MB)`, an image caption inside `[[…]]`.

**Result. su `LEAK RAW-LATIN` 9 → 6**, plus one invisible defect repaired that the counter never showed.
No golden expectation changed; 6 new assertions in two new tests. 10 sundanese tests pass.

## Run 6 — 2026-08-13 13:41 — mad

**Command.** `attest.ts --lang mad --words "è attas tasè',attas tasè',dpl,mèter è attas tasè'"`, then
`--words "kaki,soko"`; the edit; `mine.ts scan --in tools/corpus/mined/mad.jsonc --lang mad`;
`npx vitest run test/madurese.test.ts`.

**Question.** `dpl` is an Indonesian abbreviation used in Madurese prose. Does Madurese write its expansion,
and in what slot?

**Raw finding — the wiki writes BOTH halves, which is the whole of the argument.**

```
dpl            6 / 4   ⚠ TWO OF THE SIX ARE THE GLOSS ITSELF:
                         bâḍâ è attas 1.000 mèter È ATTAS PARMUKA'AN TASÈ' (DPL)
                         sè tèngghina 0-600 mèter ḌÂRI PARMOKAAN TASÈ' (DPL)
è attas tasè'  5 / 4   the SHORT running form, and always right after the metre word:
attas tasè'    7 / 5     199,27 mèter è attas tasè' · bâdâ è 199 m è attas tasè'
                         0-3 meter è attas tasè' · 277 m (909 ft) è attas tasè'
```

So the language writes the phrase, and it writes the abbreviation as a bracketed gloss OF that phrase. The
short form is the one that occurs in this exact slot — after a metre — four times, so it is the one emitted.
Nothing is loaned and nothing is composed.

**Declared.** Step 8b: `mèter|meter dpl` → `mèter è attas tasè'`. ⚠ **BOUND TO THE METRE WORD**, which is
what keeps it off the two gloss lines — there the `(dpl)` follows `tasè'` and the rule declines, so no
sentence is made to say "above sea level" twice. ⚠ **AFTER the shared tier**, because the tier is what turns
`8 m` into `8 mèter`; before it, half the instances have no metre word to bind to. ⚠ The emitted phrase ends
in an APOSTROPHE, which in this orthography is a letter (the glottal stop) and not punctuation — the hazard
this language's file records and the one `attest.ts`'s boundary test was fixed for in `9539e03`. Verified
through the engine, not the layer: `sirkana 8 mèter dpl` → *siɾkana bɤluʔ mɛtəɾ **ɛ atːas tasɛʔ***.

**Left reported, with the reason.**

* `ft` ×1 — `277 m (909 ft)`, Mecca's elevation, the imperial gloss. ⚠ **AND UNLIKE yo, THE REFUSAL IS
  MEASURED, NOT ASSUMED — both candidate words came back the WRONG SENSE.** `kaki` 21/17 is Indonesian FILM
  TITLES to a hit (*Kaki Palsu*, *Rumah Kaki Seribu*, *Segitiga Lepas Kaki*, *Buli-Buli Lima Kaki*), not one
  a unit and not one Madurese; `soko` 75/20 means an ETHNIC GROUP (*soko Kaili*, *soko Mori*, *soko
  Saluan*), not a leg. Two high counts, two wrong senses — `nan`'s `kong-si` twice over.
* `ktm` ×2 — *Kartu Tanda Mahasiswa*, an Indonesian student-ID initialism in the Universitas Indonesia
  article (`klabân nyetor ktm`). A card's name, and this file records that no letter-name table exists for
  Madurese.
* `mc` ×1 — `rumus persamaan massa-energi E = mc²`, a formula over VARIABLES. `so` and `tl` already carry
  `mc²` as an accepted `exponent` instance in `defects.ts` on the same ground.
* `ps` ×1 (2 occurrences) — `Perkasa Bromo 195 ps 4×2`, `220 ps 6×4`: German *Pferdestärke*, metric
  horsepower, in a truck spec table beside a designation. A foreign unit code.
* `pm` ×1 — `torsina sè rajâ ampon èkaandi' sajjhe' pm rendâ`. ⚠ Read against the Indonesian this article
  was translated from — *"torsi besar sudah dimiliki sejak rpm rendah"* — the run is a TRUNCATED `rpm`, the
  source's own typo. There is no word here to read; the `r` is simply missing.
* `st` ×1 — `[1st century]` in an English bibliographic citation.

**Result. mad `LEAK RAW-LATIN` 8 → 6.** No golden expectation changed; 6 new assertions, one new test and
one appended to "the declined classes stay declined". 19 madurese tests pass.

## Run 7 — 2026-08-13 13:50 — the gate run

**Command.** `npx tsc --noEmit`; `npx vitest run`; `corpus-diff.ts emit` from a scratch `git archive` of the
Run-1 commit (no refs created, no `git stash`) and `compare` for each of the five; `review.ts --lang` ×5;
`sources.ts --all` diffed line by line against the same baseline.

**Question.** Did anything get traded for the improvement?

**Raw finding.**

```
tsc --noEmit   clean
vitest run     242 files, 3948 passed / 5 skipped, 0 failed

corpus-diff (mined:<lang>, baseline = the Run-1 commit)
             changed          before                                    after
  my         16/473  3.4%     DIGIT 0 SLOT-GAP 0 RAWMARK 0 DROP 3  THROW 0   identical
  ht          5/439  1.1%     DIGIT 0 SLOT-GAP 0 RAWMARK 0 DROP 22 THROW 0   identical
  yo          8/452  1.8%     DIGIT 0 SLOT-GAP 0 RAWMARK 0 DROP 34 THROW 0   identical
  su          5/447  1.1%     DIGIT 0 SLOT-GAP 0 RAWMARK 0 DROP 10 THROW 0   identical
  mad         2/435  0.5%     DIGIT 0 SLOT-GAP 0 RAWMARK 0 DROP 16 THROW 0   identical
```

⚠ **NO DEFECT COUNTER MOVED IN EITHER DIRECTION FOR ANY OF THE FIVE.** DIGIT, SLOT-GAP, RAWMARK, DROP and
THROW are byte-identical before and after; the only thing that changed is which words 36 lines say. That is
the check that says nothing was traded, and it is the one that matters more than the leak count.

`sources.ts --all`: **zero lines differ** across all 210 rows of the fleet. Every word declared in this
branch was already inside the sourcing gate's haystack, so no verdict moved — which is the expected result
when the evidence came from the wiki the gate already reads.

`review.ts --lang` ×5 — every FAIL is one of two things and neither is new:
* the `minus` / `plus-minus` refusals each layer documents in its own file (my's two negative results, ht's
  death-marker `+` measurement, mad's deliberately-not-class-silenced minus, yo's three);
* the residual RAW-LATIN hits, every one classified in Runs 1–6 above.
No sourcing line failed: `all N high-traffic words attested` for all five.

**Result — the whole group.**

```
              baseline (scan)   after   removed
  my               10             1        9    kg 9 → 0, ft 1 left
  ht               14             9        5    km 5 → 0
  yo               15            10        5    ft 4 → 0, km 1 → 0
  su                9             6        3    mg/gr/pm → 0, plus one invisible `h` defect repaired
  mad               8             6        2    dpl 2 → 0
  ────────────────────────────────────────────
  total            56            32       24
```

Goldens changed: **one**, `normalizeHaitian("9 km/h")`, justified in place and in Run 3. 30 new assertions
across 7 new tests and one appended.

**Implication — what the 24 were, by cause.** Not one of them was "expand an abbreviation because it is an
abbreviation":

* **9** were units the layer ALREADY DECLARED, blocked by something else: my's range rule inserting a word
  between the number and its unit (×1), my's missing rate machinery (×8).
* **1** was a declared unit the shared bare-unit pass cannot reach because it carries an exponent (ht).
* **4** were a rate the corpus writes out in full and a refusal measured on too small a haystack (ht).
* **5** were a unit whose word the corpus GLOSSES the abbreviation with, in the same sentence (yo `ft`) or
  the modifier standing between number and unit (yo `sq`).
* **3** were missing keys with the word attested on the wiki (su).
* **2** were an abbreviation the wiki writes its own expansion for, in brackets, twice (mad `dpl`).

And the 32 that remain are, to a hit: English/French citation apparatus, an initialism in a language with
no letter-name table, template and URL debris, formula variables, an imperial gloss whose word is either
absent or the wrong sense, a clock the layer refuses for a measured reason, and one source typo.
