# RAW-LATIN leaks in ig / mg / so / nan

The `RAW-LATIN` detector (`rawLatinIn`, `tools/normalization/defects.ts`) reports an ASCII run of ≥2 letters,
carrying no vowel, that the source typed and the IPA still says verbatim. This log covers the four languages
in group 1 — all four already have a normalization layer, so every hit here is actionable in principle.

The standing rule for this log: **a hit left reported with a reason is a better outcome than a wrong reading.**
The counter is not the objective.

## Run 1 — 2026-08-13 07:32

**Command**

```
npx tsx probe-rlscope.scratch.mts                       # the fleet view, group-1 rows
npx tsx tools/normalization/review.ts --lang {ig,mg,so,nan}
```

**Question.** What exactly is in each language's run list — the brief warns the four rows are at least four
different problems, and forbids treating them as one "expand every abbreviation" job.

**Raw finding.** The probe in the brief reads only the `hard` block of each mined artifact. `review.ts` scans
`hard` + `sample`, which is the gate's own line set, and the counts are higher. Re-measured over the gate's
set:

| lang | hits | runs |
| --- | --- | --- |
| ig | 31 | `th:8 st:4 pp:4 ft:3 nd:2 wdg:1 ll:1 hg:1 gb:1 kp:1 pm:1 fm:1 dwt:1 mw:1 pg:1` |
| mg | 19 | `sns:7 km:3 st:1 ts:1 dz:1 kg:1 fmg:1 snm:1 ff:1 www:1 mg:1` |
| so | 18 | `sq:7 ft:3 km:3 th:2 mph:1 ps:1 pm:1` |
| nan | 16 | `cm:3 cn:2 tw:2 mg:2 jptw:1 ssp:1 kg:1 ml:1 kjj:1 gfgvbbvvfrhf:1 gg:1` |

All four gates read `[FAIL] artifact scan` on RAW-LATIN and nothing else new.

**Implication.** The per-run contexts (Run 2) are the unit of decision, not the run counts. Every subsequent
run in this log is scoped to one language.

## Run 2 — 2026-08-13 07:35 — ig, every hit read

**Command.** A scratch probe (`probe-grp1.scratch.mts`, gitignored) that prints the ±70-character context of
every non-phonotactic run over `hard` + `sample`.

**Question.** Which of the four shapes in the brief is each ig run, and how many are the same shape?

**Raw finding.** Four populations, and only one of them is a defect this layer can fix.

1. **English ordinal tails — 13 hits** (`th ×8`, `st ×3` of 4, `nd ×2`). `200th anniversary`, `7th Annual
   Leadership Awards`, `37th n'uwa`, `mba 8th nke`, `4th Quarter 2005`, `5th Fazaa International`, `69th
   Primetime Emmy Awards`, `64th`, `mba 32nd kachasị`, `1st millenium BC rue 2nd millenium AD`, `March 21st`,
   `1st Baronet`, `1ST`. The digits were ALREADY being read as Igbo cardinals; only the suffix leaked, and
   `igbo.ts` pronounces it — `32nd` read `iri atọ na abụọ nd`. Frames are mixed: three sit in Igbo prose,
   the rest inside English titles inside Igbo articles.
2. **Bibliographic / foreign residue — 8 hits.** `pp ×4` (`Grants, 26pp.`), `pg` (`Home on Sunday, pg. 8`),
   `hg` (German *Hrsg.*, `na Therese Fuhrer (hg)`), `ll` (English `I'll`), `mw` (HTML `rel="mw:WikiLink"`
   that survived extraction), `st ×1` — which is **`St.` the saint title**, ×4 in one hagiography line, not
   an ordinal at all.
3. **Units with no sourced word — 6 hits.** `ft ×3`, `dwt` (deadweight tonnage), `pm` (`elekere 2.30pm`),
   `fm` (`na 100.9fm`).
4. **The detector's own known false positive — 2 hits.** `gb`, `kp`, in the sentence that LISTS the Igbo
   digraphs. Recorded as left-reported in the detector's own commit message.

⚠ **A fifth thing, and it is what the fix had to be anchored on.** Igbo's dotted vowels ⟨ị ọ ụ⟩ are not
ASCII, so a plain-ASCII run falls out of the *middle* of an ordinary word: `ndị` yields `nd` and `Kraịst`
yields `st`. Both survive into the IPA. A rule keyed on the LETTERS would rewrite the language.

**Implication.** One rule, anchored on a digit, takes 13 of 31. Nothing else here has a word to read it with.

## Run 3 — 2026-08-13 07:37 — ig, is `nke` + cardinal really the ordinal?

**Command.** `grep -oE "nke (otu|abụọ|…|iri…)" tools/corpus/mined/ig.jsonc | sort | uniq -c`, then the same
with 70 characters of context on each side.

**Question.** `nke` is polysemous — relative particle, genitive particle, ordinal marker. A count cannot
tell them apart, so: in the numeral-adjacent instances, which sense is it?

**Raw finding.** 48 instances of `nke` + numeral in the artifact. Ordinal in every checkable one:
*ụbọchị nke iri na isii n'ọnwa Nọvemba* (16th day), *ọnwa nke atọ n'afọ, Machị* (third month, March),
*narị afọ nke iri na itoolu* (19th century), *ọgbọ nke atọ, MediaWiki* (third generation), *nke abụọ kachasị*
(second-most). ⚠ And the best one is inside a sentence the new rule fires on: *"Nigeria bụ mba 8th nke kacha
emepụta mmanụ, na nke iri kachasị nwee mmanụ"* — English ordinal and Igbo ordinal in the same breath.

**Implication.** Substitute in place, `nke` + the ORIGINAL DIGITS, and let the existing compositor read them
— no word coined, one source of truth for the numeral. Word order: Igbo's ordinal follows its noun and the
Igbo-frame instances here are postnominal, so in-place is the attested shape; the English-frame ones stay
prenominal, which is the minority order and the stated cost.

## Run 4 — 2026-08-13 07:41 — ig, `ft` and `wdg` sourcing

**Command.** `npx tsx tools/normalization/attest.ts --lang ig --words "wdg,fiiti,ụkwụ"` (default `--limit`),
then `grep -oE ".{45}ụkwụ.{45}" tools/corpus/mined/ig.jsonc`.

**Question.** The header claims `ft` appears ONLY as a parenthetical gloss, which the scan contradicts
(`ọ nwere ike iru 6 ft`, bare). Is there a sourced Igbo foot? And is `wdg` sourceable?

**Raw finding.**

```
  wdg     78 token / 19 arts  attested     …à á ā a̍ à, à á wdg.…   …Ochie mkpuchi (Ụlọ ọrụ, wdg)…
  fiiti    0 token /  0 arts  absent
  ụkwụ   197 token / 20 arts  attested     …olu bọọdụ dị otu ụkwụ (305 mm) n'ogologo…
```

⚠ `ụkwụ`'s unit sense is REAL but lives in **one article** (*Ụkwụ bọọdụ*, the board foot). In the artifact
all SEVEN instances are something else: the foot of an escarpment, `nzọụkwụ` (footstep), and the idioms
`gbara ụkwụ` ("came second") and `gbadoro ụkwụ` ("is based on"). Zero unit uses in 460 lines.

⚠ `wdg` is a genuine Igbo abbreviation for *etc.* — the examples are unambiguous — but **no source spells
out what the three letters stand for**, and this project does not coin the phrase (the Fula `tere` failure).

**Implication.** Both refused. `ft` stays reported, and the header's factual claim about it is corrected
rather than restated. `wdg` stays reported WITH its count, so the next reader starts from 78/19 and the
missing expansion, not from zero. Negative results, both kept.

## Run 5 — 2026-08-13 07:44 — ig, the corpus diff

**Command.** `corpus-diff.ts emit --lang ig --corpus mined:ig` from a detached read-only worktree pinned at
`ec1f48d`, then again in this tree, then `compare`.

**Question.** What did rule 1b actually change at corpus scale, and did it break anything else?

**Raw finding.** `changed 14/459 (3.1%)`; `DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 43, THROW 0` both sides.
Every changed utterance is the ordinal shape. RAW-LATIN over the gate's line set: **31 → 18**.

One reading worth naming: *"Ọnụ ego nke 4th Quarter"* → *"…nke nke anọ kuarter…"*. The source's own genitive
`nke` now abuts the ordinal `nke`. That is grammatical Igbo ("the money OF THE fourth"), not a defect, but it
is the one place the rule's output looks doubled and it is recorded so nobody 'fixes' it later.

**Implication.** Ship it. The remaining 18 are Run 2's populations 2–4, all documented in normalize.ts.

## Run 6 — 2026-08-13 07:44 — mg, what is `sns`?

**Command.** `npx tsx tools/normalization/attest.ts --lang mg --words "sy ny sisa,sisa,sy ny maro,sy ny
manaraka,isaky ny"` (default `--limit`).

**Question.** The brief says establish `sns:7` before anything else. What is it?

**Raw finding.** The wiki glosses its own abbreviation, in the article on the ellipsis:

> *"Mahasolo ny andian-teny malagasy **sy ny sisa (hafohezina hoe sns)** ny teboka telo."*
> — "the ellipsis replaces the Malagasy phrase *sy ny sisa* (abbreviated *sns*)."

`sy ny sisa` 11 tokens / 9 articles, every use the *etc.* slot after a list. This is the strongest kind of
evidence this tier can produce: the abbreviation and its expansion in one sentence, from the corpus.

Two more, unasked for and both useful:

* `sy ny manaraka` 3/3, and all three are a SCRIPTURE CITATION — `(Eks. 12 sy ny manaraka)`, `(Asa. 2.6 sy ny
  manaraka)`, `(Gen. 10.6 sy ny manaraka)`. Both artifact `snm` are the same frame (`(Sal.Sal. 2.34 snm.)`).
  No gloss anywhere; the argument is the slot plus the initialism scheme `sns` already demonstrates.
* `isaky ny` 44/19, and the examples are the rate slot and nothing else — including the population-density
  definition, which is *literally* what the artifact's `mp/km²` says: *"ny salan'isan'ny mponina isaky ny
  velaran-tany voafaritra (isaky ny kilaometatra tsy mivadi-mandry)"*.

**Implication.** `sns` and `snm` are read (7 + 2 hits). `isaky ny` unlocks the next run — see Run 7.

## Run 7 — 2026-08-13 07:45 — mg, why did DECLARED units leak?

**Command.** `normalizeMalagasy` on `1429 kg/m³`, `1429 kg/m`, `1429 kg/s`, `1429 kg.`, `2 m³`, `isaky ny km²`.

**Question.** mg declares `km`, `m`, `kg`. So why are `km ×3` and `kg ×1` in the leak list at all?

**Raw finding.** A **RATE**, and the tier declines it whole.

```
1429 kg/s   → 1429 kilao/s          the denominator is UNDECLARED, so there is no rate to read
1429 kg/m   → 1429 kg/m             both declared → rate branch → no `unitPer` → returns the text UNTOUCHED
1429 kg.    → 1429 kilao.
isaky ny km → isaky ny kilaometatra  the bare-unit rewrite works …
isaky ny km²→ isaky ny km²           … but refuses an exponent, by design
mp/km²      → mp/km²                 and refuses a `/`, by design
```

⚠ **The failure is worse the more the language declares.** `kg/s` reads its head unit because `s` is
undeclared; `kg/m` reads NEITHER because both are. `normalizeSymbols.ts` says why in the code — "a rate needs
both nouns and the connective; without any of them leave the text alone rather than emit half a reading" —
and the bare-unit pass refuses `/` and `²` for the same reason. Both refusals are right in themselves; their
intersection is a hole that only a language declaring the numerator AND the denominator can fall into.

The other three are `mp/km²`, whose numerator `mp` is not a unit at all. Measured: **3 of 3** `mp` in the
artifact are `<digit> mp/km²`, and **2 of 3 gloss themselves** — *"Ny hakitroky ny **mponina** dia 8,5
mp/km²"*, *"firenena misy **mponina** kely hakitroka indrindra aty Afrika (3 mp/km²)"*. The sentence says the
word next to the symbol, which is the discrimination ig's `mm`/rainfall case turned on.

**Implication.** Declare `unitPer: "isaky ny"` and `mp: ["mponina"]`. ⚠ The stated exposure of the second:
the tier folds case for a multi-letter key, so a hypothetical `5 MP` (megapixel) would read *mponina*. There
is no `MP` in the artifact and no bare `<digit> mp` outside the density frame, so the cost is a shape that
does not occur against a defect that does — recorded here rather than left for someone to rediscover.

## Run 8 — 2026-08-13 07:46 — mg, the corpus diff, and a golden that a tidy-up nearly broke

**Command.** `corpus-diff.ts emit/compare --corpus mined:mg`; `npx vitest run test/malagasy.test.ts`.

**Raw finding.** `changed 12/439 (2.7%)`; `DIGIT 0, SLOT-GAP 0, RAWMARK 0, THROW 0` both sides, **DROP 41 →
40** — the rate's `/` is now consumed by a reading instead of vanishing. RAW-LATIN **19 → 7**.

⚠ NEGATIVE RESULT WORTH KEEPING. The first version of the abbreviation rule emitted ` sy ny sisa ` with
padding spaces and cleaned up afterwards with a global `/ +([,.;:)\]])/ → "$1"`. That collapsed a space the
CORPUS puts there and a golden pins — `taonjato faha 17° ; dia` — and `test/malagasy.test.ts` caught it
immediately. The fix restores the separator only where one is missing, with a lookbehind that cannot reach
outside the match: `(?<=\p{Nd})(?=sy ny )`. A tidy-up with a wider reach than the rule it tidies is a rule of
its own.

**Implication.** Ship. The 7 left are the orthography-article citations (`ts`, `dz`), one English ordinal in
an English parenthetical, the demonetised franc `fmg`, Latin `ff`, and a URL — all itemised in the header.

## Run 9 — 2026-08-13 07:50 — so, five populations and four mechanisms

**Command.** `probe2.scratch.mts so`, then `normalizeSomali` over every shape it printed.

**Question.** The brief guesses `sq:7` is `sq mi` and asks whether the layer already reads `mi`. Both halves.

**Raw finding.** ⚠ **It does read `mi`** — `mi: ["mayl"]` has been declared all along. That makes the defect
worse than the brief supposed, not milder: `sq` stands BETWEEN the number and the unit, so it breaks the
digit adjacency the tier's unit path requires, and `mayl` went unread in all six of those parentheticals. One
raw run, two lost readings.

The `km` row is four different shapes over three lines, and probing each separately is the only way this
came out:

```
91 km 2         → "91 kiiloomitir 2"     ⚠ NOT A LEAK — a MIS-READING. A stray "two" the source never said.
26,800/km 2     → unchanged              a bare rate: unit after the slash, none before it
1,200 qof halkii km2  → unchanged        the corpus SPELLS THE CONNECTIVE OUT and still leaks the unit
750-km          → unchanged              hyphen-attached; the bare-unit pass excludes `-` by design
5.9km / 77,041 km² / 926 km  → already correct
```

And `th ×2` is the ig shape again — with a better witness. One of the two sentences writes both conventions:
*"longitudes **33aad** meridian bari iyo **48th** meridian bari"*. The corpus settles its own ordinal.

**Implication.** Seven small rules in one step, not one big one. `sq`/`cu` → the measure words; the ordinal
tail → `-aad`; `mph` → `mi/h` out of words already sourced; and four separate `km` shapes.

## Run 10 — 2026-08-13 07:52 — so, the superscript that would have hidden the leak

**Command.** `normalizeSomali("610 deggane/sq mi")`, then the corpus diff.

**Question.** The obvious way to spend `sq` is to rewrite `sq mi` → `mi²` and let the tier's exponent path
read it. Does that hold everywhere?

**Raw finding.** ⚠ **NO, AND THE FAILURE IS THE WORST KIND.** Where a digit precedes, `mi²` reads correctly.
Where one does not — `610 deggane/sq mi`, `(22 degane / sq mi)`, `69,000/sq mi`, four of the eight — the
tier's digit-adjacent path declines and the `²` this layer INVENTED reaches the phoneme sink as a RAWMARK.
That trades a REPORTED leak for an UNREPORTED one, which is the single move this whole class must not make.

The rule now emits the measure words directly. Somali's units take no count agreement, so nothing the tier
would have done differently is lost.

**Implication.** Kept as a negative result because the wrong version passed every test I had written at that
point; what caught it was reading the output of the one input shape I had not tried.

## Run 11 — 2026-08-13 07:53 — so, the corpus diff, read line by line

**Command.** `corpus-diff.ts compare`, plus a scratch differ that prints the first DIVERGING region of each
changed row (the tool's 92-character prefix is identical on rows that differ further in).

**Raw finding.** `changed 13/447 (2.9%)`; `DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 2, THROW 0` — every counter
identical on both sides, which is what says the `²` mistake above is really gone. RAW-LATIN **18 → 6**.

Every changed row read individually:

```
kiːloːmitir laba          → kiːloːmitir laba d͡ʒibaːran      the stray "2" is now the measure word
sq mi                     → majl laba d͡ʒibaːran ×5          the unit and its modifier, both read
deɡane sq mi              → deɡane halkiː majl laba d͡ʒibaːran
mph                       → majl halkiː saːʕad
mitir sadːeħ              → mitir ʕubo                       `m3` was "metre three"
halkiː km laba            → halkiː kiːloːmitir laba d͡ʒibaːran
km afar boqol             → kiːloːmitir afar boqol           the hyphen-attached 750-km
```

⚠ ONE ROW IS NOW REDUNDANT AND IS RIGHT TO BE: `sentimitir ʕubo ʕm` → `sentimitir ʕubo sentimitir ʕubo`. The
source is *"11.548 Sentimitir cubo cm³"* — the corpus writing the word AND the symbol, the sentence quoted in
this file's own `cubo` note. Saying it twice is what the text says; the previous reading said it once and
then pronounced a stray /ʕm/.

**Implication.** Ship. Six left: `ft ×3` + the `sq` bound to one of them, `pm`, and `ps` — the last of which
is Greek `ōps` and a detector false positive of the Igbo `ndị` kind.

## Run 12 — 2026-08-13 07:56 — nan, the unit words, and the count that said yes

**Command.** `grep -oc` for the POJ candidates over the mined artifact; `grep -P` over the shipped
`src/languages/minnan/dict.tsv`; then `normalizeMinNan` on every digit-adjacent shape.

**Question.** `cm ×3`, `mg ×2`, `kg ×1`, `ml ×1` are genuine units in a layer that declares `km m kg`. Can
the missing three be sourced the way the declared three were — POJ prose, Han output?

**Raw finding.** ⚠ **NO. The first leg is simply absent, and the obvious substitute is a trap.**

```
kong-hun (cm)  kong-chhoat  hô-khek  hô-seng      ×0 in the artifact — every one
kong-si                                            ×5  ← looks like 公絲, the milligram
dict.tsv       公分 kong-hun · 毫克 hô-khik · 毫升 hô-sing · 公斤 kong-kin · 公里 kong-lí
```

`kong-si`'s five hits are **公司, the COMPANY** — *"khek-poâⁿ kong-si soan-thoân"*, a record company. Taking
that for an attestation would have made this layer read every milligram as "company". The count said yes and
the examples said no; this is the `bar`/`Komma` and `ti`/`ናቕፋ` shape a third time.

So the three are declared on the SECOND LEG ALONE — the shipped MOE dictionary — and the header says so in
those words rather than letting them look like `kong-lí`. The corpus writes only the abbreviation, ×13
digit-adjacent instances.

`ml` also had to become a **rate denominator**: the blood-sugar article writes `120mg/100ml`, `200mg/ml`,
`180mg/100ml`, and without the denominator the tier declines the whole match — the same mechanism as mg's
`kg/m³` in Run 7, in a second language, one hour apart.

**Implication.** 16 → 9. `misread.ts --langs nan`: core mis-read cells **5 → 4**, overall **29 → 26**, and
**0 collisions** — 公分 ≠ 公里, 毫克 ≠ 公斤, and `l` stays undeclared so ml/l cannot collide.

## Run 13 — 2026-08-13 07:58 — the gates, and three things that moved which are not the leak counter

**Command.** `npx tsc --noEmit`; `npx vitest run`; `review.ts --lang` ×4; `sources.ts --lang` ×4, diffed
against the same four from the pinned baseline worktree.

**Raw finding.** `tsc` clean. **242 test files, 3,929 passed, 5 skipped** — including `onnx-optional`, which
the brief warns can time out under load and did not here.

⚠ ONE GOLDEN'S EXPECTED VALUE CHANGED, `test/minnan.test.ts`: the test that pins the TILDE as a range
asserted `32~64 mg/kg` → `32 到 64 mg/kg`, quoting the raw units incidentally. With `mg` declared it is now
`32 到 64 毫克 每 公斤`. The range assertion the test exists for is untouched — `到` sits exactly where it
did — and the change is annotated in place.

⚠ AND `review.ts --lang mg` STARTED CLAIMING `test/minnan.test.ts` AS ONE OF ITS TESTS. The discovery rule is
a quoted language code plus a symbol-carrying string literal, and a COMMENT of mine in the Min Nan test wrote
`` `mg` `` in backticks. A prose choice, silently mis-attributing another language's coverage. Reworded to
"the milligram key"; mg's test list is back to three files.

`sources.ts` moved in exactly three places, all expected and none a regression:

```
ig   fraction-series  [NONE] → [part]   the ordinal series rule 1b introduces is now visible to the gate.
                                        ⚠ A PROMPT, NOT A PASS — "verify each form". No fraction rule was
                                        written and none is claimed; an Igbo fraction denominator would
                                        need its own sourcing.
mg   unit-word        6 → 7 words, all attested   (`mponina`)
nan  unit-word        0/3 → 0/6 UNATTESTED: 公里 公尺 公斤 公分 毫克 毫升
```

⚠ THE nan ROW IS THE SAME NEGATIVE IT ALWAYS WAS, WIDENED. A Han spelling scores zero against a POJ corpus
BY CONSTRUCTION — the reason this layer already carries a CITED note for 百分之 — and the gate's own text says
it: "a unit borrowing is legitimately absent from every source in ~30 languages, so this is a prompt to READ
them, not a defect". They were read: dict.tsv, entry by entry, with `kong-si` rejected.

**Implication.** Everything that moved is accounted for. Final RAW-LATIN, over the gate's own line set:

| lang | before | after | what remains |
| --- | --- | --- | --- |
| ig | 31 | 18 | English/German bibliography, `St.`, `ft`, `wdg`, the digraph-list false positive |
| mg | 19 | 7 | the orthography article's own letters, an English gloss, `fmg`, `ff`, a URL |
| so | 18 | 6 | the imperial foot and the `sq` bound to it, a clock, Greek `ōps` |
| nan | 16 | 9 | EasyTimeline template code, a Latin binomial, one line of vandalism |
| **total** | **84** | **40** | |
