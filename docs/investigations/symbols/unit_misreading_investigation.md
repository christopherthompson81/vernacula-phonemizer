# Unit MIS-READING — the defect class that produces a word instead of garbage

The class: an undeclared unit abbreviation whose letters happen to be pronounceable in the language does
not leak and does not vanish. It is READ. `10 ha` in Javanese came out `səpˈulʊh hˈɔ`; Chichewa's `150cm`
came out as centimetres pronounced like kilometres; Tagalog's `10 cm` comes out `sampˈu km`.

Every gate in `tools/normalization/` asks "did the input SURVIVE into the IPA?" — `audit.ts` for a raw
digit or native mark, `coverage.ts` and `mine.ts` for a LEAK or a differential DROP. All three are blind
here by construction. So the fleet's "97 engines leaking" is a LOWER BOUND, and this document is the
attempt to put a number on the part it could not see.

---

## Run 1 — 2026-08-13, first probe design

**Question.** Can "was this converted into something, and is that something the right thing?" be asked
mechanically, without a per-language lexicon?

**Command.** Exploratory, over `tl jv nya ig en`:

    phonemize("10"), phonemize("cm"), phonemize("10 cm"), phonemize("10 xq"), phonemize("xq")

**Raw finding.**

    tl   "10 cm"    "sampˈu km"          "cm"  "km"        ⟵ the named open case
    tl   "10 km"    "sampˈu kilomˈetɾo"
    jv   "10 ha"    "səpˈulʊh hˈɛkt̪ar"   (already fixed in b96621d)
    nya  "10 ha"    "kʰumi ha"
    ig   "10 m"     "iɾi m"
    en   "10 ha"    "tʰˈɛn hˈɑː"         ⟵ English mis-reads the hectare too
    *    "10 xq"    → "sampˈu ksk" / "səpˈulʊh ksʔ" / "kʰumi zk" / "iɾi zk"

**Implication.** Three things fall out at once.

1. The control token `xq` — undeclarable in any language — comes back PHONEMIZED, not raw, in every engine
   tried. That is the disposition that makes this class silent, and it is measurable, so the probe can
   classify each engine as RAW / READS / DROPS and say which engines can hide a missing unit.
2. The unit segment can be recovered without knowing word order: take the token multiset of `10 <abbr>`
   and subtract the tokens of `10`. ig and nya PREPOSE the unit noun, so a prefix-strip would have failed
   on exactly the two languages the class was first found in.
3. A first discriminator suggests itself — compare the segment against the reading of the abbreviation
   standing alone. Written up as `tools/normalization/misread.ts`.

---

## Run 2 — 2026-08-13, the first discriminator is WRONG

**Command.** `npx tsx tools/normalization/misread.ts`

**Raw finding.** 193 engines, 190 with at least one mis-read, 2161 mis-read cells. And in the table,
`hi` and `de` reported as mis-reading `km`, `cm`, `mm`, `kg` — all four of which they DECLARE:

    src/languages/hindi/hindi.ts:254   units: { km: [...], cm: [...], mm: [...], kg: [...], m: [...] }
    src/languages/german/german.ts:413 units: { km: [...], cm: [...], mm: [...], kg: [...], mg: [...], ...

Checked directly:

    hi   "km"      "kɪloːmˈiːʈəɾ"
    hi   "10 km"   "d̪ˈəs kɪloːmˈiːʈəɾ"

**Implication.** The tier ALSO expands a bare unit symbol — `makeBareUnitNormalizer`, for table headers and
captions — so "the reading with no number beside it" is the SAME expansion, and the comparison proves
nothing. A correctly declared unit and a mis-read one are indistinguishable under this test. The 2161
figure is mostly artefact. Negative result, and the useful kind: it says the control has to remove the
UNIT RULE while leaving the LETTERS alone, not remove the number.

---

## Run 3 — 2026-08-13, defeating the guard instead of removing the number

**Question.** Is there a way to make the unit rule decline without changing the letters the fallback sees?

**Finding, from the tier itself** (`src/core/normalizeSymbols.ts`, `unitRe`):

    …(?![${wordCont}\p{M}'’ʼ])

Every unit rule in the fleet ends with that guard, and the local copies of the idiom (tagalog, yoruba,
balochi) use the same class. So an ASCII apostrophe glued to the key makes the rule decline while the
letters stay put. Two candidate controls measured side by side — `<abbr>q` (append a letter) and
`<abbr>'` (append the guard-breaker):

    hi   km: /kɪloːmiːʈəɾ/   q=/ʊkmk/   ap=/ʊkm/
    de   cm: /t͡sɛntimeːtɐ/   q=/km/     ap=/km/
    tl   cm: /km/            q=/kmk/    ap=/km/
    jv   ha: /hɛkt̪ar/        q=/haʔ/    ap=/hɔ/
    nya  ha: /ha/            q=/hak/    ap=/ha/
    en   ha: /hɑː/           q=/hæk/    ap=/hæ/     ⟵ NOT INERT

**Implication.** The apostrophe control is right in every engine but one, and the exception is instructive:
English reads `ha'` as a CLOSED syllable /hæ/, so the fallback differs from the segment for a purely
phonological reason and the cell would clear while the defect is real. The `q` control has the same problem
worse, everywhere. So inertness is MEASURED rather than assumed: each cell first probes a shadow token of
the same shape whose first letter begins no unit key (`ha`→`ba`, `cm`→`bm`, `l`→`b`), and a cell whose
shadow moves under the apostrophe is reported `?` UNJUDGEABLE instead of being silently cleared.

---

## Run 4 — 2026-08-13, the fleet distribution

**Command.** `npx tsx tools/normalization/misread.ts --all`

**Raw finding.**

    193 engines · 153 mis-read at least one CORE unit · 584 core mis-read cells
                · 1461 mis-read cells overall · 660 leaked cells
    routing: READS 180 · MIXED 9 · RAW 3 · DROPS 1
    symbol tier present: 131 · of those, 98 still mis-read a core unit (354 cells)
    collisions: 24 engines · 27 pairs

CORE is the eight units with a settled written form in essentially every written language and a
wrong-by-a-power-of-ten failure mode: km m cm mm kg g l ha. The other nine probed keys (`t s h min kW MB
mg ml L`) are reported but kept out of the headline — `h` is as often an hour as anything else and `MB`
wants a letter-name table, so ranking on them buries the decidable cases.

**Validation against ground truth.** The verdicts now reproduce the declarations:

    hi   km · m · cm · mm · kg ·   g M  l M  ha M     exactly its five declared keys
    tl   km · m · mm · l · L · ha ·   cm M  kg M  g M  matches 81796dd, INCLUDING the named open cm
    jv   km · m · cm · mm · kg · g ·  l · L · ha ·     matches b96621d
    nya  km · m · cm · mm ·           kg M  g M  l M   matches 9860e68
    de   km · m · cm · mm · kg · mg ·  g M  ha M
    en   4 core M, 7 cells `?`                          the apostrophe is not inert in English

**Implication — three, and the routing line is the one that sizes the class.** 180 of 193 engines
PHONEMIZE unknown Latin rather than leaking it. On those engines an undeclared unit is silent by
construction, which is why one language at a time is how this was being found. Only 3 engines leak the
control, and those are the ones where the existing probes were ever going to see it.

The 131/98 split is the actionable one. An engine with no symbol tier mis-reads every unit for a
structural reason — that is a whole normalization job, not this defect. An engine WITH a tier that still
mis-reads a core unit has the machinery present and one `units` key missing, and there are **98 of them,
354 cells**.

All 27 collisions sit in tier-less engines and all but three are the same shape: `cm=km /km/`, where ⟨km⟩
leaked as raw ASCII and ⟨cm⟩ was pronounced [k][m], so the two arrive at the same string. `mm=m /m/` in
fo/gd/mt/pap is the same story one prefix down. That is the nya defect, and it is sitting in 24 engines.

**Fixable population (tier present, ≥1 core mis-read), 98 engines:**

    ab bg fa mr pbt ps sd ak cjy da gan hak hsn kn ln nb or pa pnb ro wuu yue za bm ht is ml nan pcm
    bar ckb en en-GB en-IN he ko my syl ug awa az bgc bho ca cdo cs gu hi hne hr km mag mai ne nya rkt
    rn sk sr te tl uk vi yo am as bn bpy cmn cy de fr fr-CA ga hmn hu it mi pl sl sv sw th ti ur xh zu
    af ff ig lb lo mg mk nl om sn tr

---

## Run 5 — 2026-08-13, tl: the named open case

**Question.** `81796dd` left tl's ⟨cm⟩ open with the note that it "does not LEAK, it MIS-READS", and
`sentimetro` "is not sourced here". Source it, and take the rest of what the probe reports for tl
(`cm kg g mg`).

**Command.** `npx tsx tools/normalization/attest.ts --lang tl --words "sentimetro,kilogramo,gramo"`
then `--words miligramo`.

**Raw finding.**

    sentimetro  39 / 20   "humahaba hanggang 60 sentimetro", "5–15 sentimetro at luwang na 2–8
                          sentimetro", "Ini-angat ito nang 70 sentimetro"  — all genuine LENGTHS
    kilogramo   44 / 20   "Ang kilogramo ay isang metrikong yunit … ang kilo na may SAGISAG NA KG o kgs"
                          — the kilogram article names the symbol, definitional
    gramo       49 / 20   "500 mga gramo ng halayang petrolyo", "pitong gramo ng proteina"
    miligramo    4 / 4    "200 miligramo ng calcio"; "sistemang milimetro-miligramo-segundo"

⚠ One dead end worth keeping: `--context "sentimetro sagisag cm yunit sukat haba"` returned 0/0 for all
three words AND OVERWROTE the two existing `attested` findings in `tools/corpus/attest/tl.jsonc` with
`absent`. Re-probed without `--context` to restore them. The register tier narrows the SEARCH, so a word
that is everywhere in the wiki can come back absent under it, and the artifact is written either way.

**Corpus frequency, measured over the mined artifact:** `cm` ×0, `g` ×0, `mg` ×0, `kg` ×1. Declared all
four anyway — a 400-line artifact not writing a centimetre is evidence about the artifact.

**Implication.** Declared, then diffed — and the diff refused one of them.

---

## Run 6 — 2026-08-13, the ligated magnitude, and why the standard one-letter measurement missed it

**Command.**

    corpus-diff.ts emit --lang tl --corpus mined:tl   (baseline from a detached worktree at 3531e8d)
    corpus-diff.ts compare --before … --after …

**Raw finding — 22/458 changed, and one of them was a REGRESSION:**

    SRC  May mahigit 11 milyong mga Pilipino sa labas ng Pilipinas.
      -  … labiŋʔisˈa mˈiljoŋ maŋˈa pilipˈino …
      +  … labiŋʔisˈa mˈiljon ɡɾˈamo maŋˈa pilipˈino …      eleven million GRAMS of Filipinos

**Why the measurement that should have caught this did not.** The standard one-letter check (trap 46) is
to rebuild the tier's own shape over the artifact — a digit, an optional space, the key, the trailing
guard. Run for `g` that gives **0 matches, and 0 with the guard removed as well**. It is the wrong shape:
`unitRe` admits a MAGNITUDE between the number and the unit, and Tagalog declares its magnitudes in their
LIGATED forms — `milyong`, `bilyong`, `trilyong`, `libong` — every one of which ends in ⟨g⟩. Re-measured
against `<digit> <ligated magnitude>`:

    21 instances   109 milyong katao · 28 bilyong dolyar · 3.9 milyong tao · 14.06 milyong pasahero …
     0 genuine grams

`g` REFUSED on 21:0. `cm`, `kg`, `mg` kept.

**Implication.** A one-letter key has to be measured against the pattern the tier will actually build,
not against the bare `<digit><key>` shape — and in any language whose magnitudes carry a fused linker,
the two differ. Worth checking wherever a one-letter unit meets a ligating language.

**Gates, after refusing `g`:** corpus diff 7/458 (1.5%), every one `kg` → *kiloɡɾˈamo* and every one a
genuine kilogram (`40 kg (90 lbs)`, and five `× 10⁻³¹ kg` particle masses); DROP 49 → 49, DIGIT/RAWMARK/
SLOT-GAP/THROW all 0 → 0. `review.ts --lang tl` checklist clean 10/10. `misread.ts --langs tl`: core
mis-read cells 3 → 0.

---

## Run 7 — 2026-08-13, de and hi: the fixable population, worked

**Question.** The probe says 98 tier-carrying engines still mis-read a core unit. Two well-resourced ones
with existing attest artifacts: de is missing `g` and `ha`, hi is missing `g`, `l`, `L`, `ha`. Are the
words there?

**Command.** `attest.ts --lang de --words "Gramm,Hektar,Liter"` · `attest.ts --lang hi --words
"ग्राम,लीटर,हेक्टेयर,हेक्टर"`

**Raw finding.**

    de  Gramm     176/17  "Ein Gramm ist eine physikalische Einheit für die Masse, sein
                          EINHEITENZEICHEN IST G"                    — definitional, names the symbol
        Hektar    356/20  "Das oder der Hektar … ist eine Maßeinheit der Fläche"
        Liter     468/18  "Der … Liter ist eine Einheit für das Volumen … mit \mathrm{L} symbolisiert"
    hi  लीटर       85/20  "लीटर आयतन की मात्रक है। इसके दो आधिकारिक चिह्न (ℓ) और (L) हैं"
                          — the litre article names BOTH symbols, and uses them: "1 L ≡ 1 dm3"
        हेक्टेयर    74/14  "1,281.67 हेक्टेयर (3,167.1 एकड़)" ×6 — every example a digit-adjacent area
        ग्राम      130/10  the gram article, definitional
        हेक्टर      56/12  ⚠ HECTOR, the Trojan prince — "यूनानी मिथों के अनुसार 'हेक्टर' एक ट्रोजन सेनापति"

**Two traps, both caught by reading rather than counting.**
· `हेक्टर` probes at 56/12 and `हेक्टेयर` at 74/14, so a count-first choice was available and would have
  put a mythological name in the hectare slot. Every one of हेक्टर's examples is the Iliad.
· `ग्राम` is a homograph and MOST of its 130 tokens are the other sense, ग्राम पंचायत "village council".
  Kept anyway, and the reason is the slot: this key emits the word only after a NUMBER, where the village
  is not a possible reading, and the unit sense is what the gram article itself defines. The count is not
  the evidence here; the definitional hit is.

**One-letter keys measured (trap 46), and against the shape the tier actually builds:** over the artifacts
`<digit> l` and `<digit> L` are ×0 in both; `<digit> g` is ×0 in hi and ×1 in de — `802.11g`, a Wi-Fi
standard, which `NOT_VERSION` already rejects (verified: `802.11g` → *ˈaxthʊndɐtt͡svaɪ̯ . ɛlf k*, no
Gramm). German's magnitudes are `Million(en)`/`Milliarde(n)` and Hindi declares none, so the ligature trap
that refused Tagalog's ⟨g⟩ cannot arise in either.

**Gates.** corpus diff de 0/117, hi 0/135 — no change and no regression; DROP/DIGIT/RAWMARK/SLOT-GAP/THROW
all identical. `misread.ts` core cells: de 2 → 0, hi 3 → 0. `review.ts` checklists clean; the one `??` on
each (de `Yen`, hi `डॉलर`) is pre-existing and unrelated — and note that `sources.ts` EXCLUDES `units` by
design, which is why none of the words declared in this batch appears in that gate at all. That exclusion
is the reason this whole class survived review cycles. Full suite 3874 passed, no golden changed.

**Implication.** Both artifacts changing by ZERO utterances is the point restated: the corpus never writes
these units, so no corpus-scale gate was ever going to find the defect, and no corpus-scale gate confirms
the fix either. The evidence for the fix is the wiki attestation and the probe, and the artifact's silence
is a fact about a 120-line artifact.

---

## Run 8 — 2026-08-13, one guard-breaker is not enough (mr)

**Question.** `mr` reports 8/8 core cells MISREAD despite `marathi.ts` declaring km/cm/mm/kg. Which is
wrong, the declaration or the probe?

**Command.** `phonemize("10 km'", "mr")`

**Raw finding.**

    "10 km"   "d̪ˈəɦaː kɪloːmˈiːʈəɾ"
    "10 km'"  "d̪ˈəɦaː kɪloːmˈiːʈəɾ"      ⟵ the apostrophe did NOT break the guard

`src/languages/marathi/normalize.ts:304` resolves Marathi's units with a LOCAL rule:

    new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu")

— no apostrophe in the guard. So the probe's fallback WAS the unit reading, segment matched it, and every
cell reported MISREAD for a language that gets four of them right.

**Second finding, from testing U+0301 COMBINING ACUTE as an alternative breaker across a panel:** a
combining mark is in BOTH guard shapes (`\p{M}` appears in the local form and in the shared tier's), so it
breaks both — `10 km` + U+0301 in mr gives /ʊkm/. And the two breakers are inert in DIFFERENT places:
English reads `ha'` as a closed syllable /hæ/ but `ha`+U+0301 as /hɑː/, while Igbo ignores the apostrophe
and reads a combining acute as a TONE mark (`ha˥`).

**Implication.** Use both, measure each one's inertness separately against the shadow, and let `ok` win a
disagreement — a breaker that failed to break reports a spurious MISREAD, a breaker that broke reports the
truth, and a genuinely undeclared unit reads as its letters under every working breaker. Cells with no
usable breaker stay `?`.

**Effect on the fleet numbers** (`misread.ts --all`, and these supersede Run 4):

    193 engines · 170 mis-read at least one CORE unit · 658 core cells · 1739 cells overall
    routing: READS 180 · MIXED 9 · RAW 3 · DROPS 1
    symbol tier present: 131 · of those, 110 still mis-read a core unit (358 cells)
    collisions: 24 engines · 27 pairs

The core count went UP (584 → 658) because the apostrophe-only version was clearing cells it could not
judge, and mr's own count went DOWN (8 → 4). Spot-checks now match every declaration read by hand: en
mis-reads only `ha`, tl only the `g` this branch deliberately refused, ja and pt clean across the core.

---

## Run 9 — 2026-08-13, mr, and a hole in NOT_VERSION

**Question.** With the probe corrected, mr shows 4 core mis-reads (`m g l ha`) against 4 correct
declarations. Which of the four can be sourced?

**Command.** `attest.ts --lang mr --words "किलोमीटर,मीटर,सेंटीमीटर,मिलीमीटर,किलोग्रॅम,किलोग्राम,ग्रॅम,लिटर,हेक्टर,हेक्टेअर"`

**Raw finding.**

    हेक्टर   52/13  "हेक्टर हे क्षेत्रफळ मोजण्याचे एकक आहे … १०० मीटर X १०० मीटर = १ हेक्टर = १०००० वर्ग मीटर"
    ग्रॅम     88/20  "किलोग्रॅम हे वजनाचे एकक आहे … याचे एस. आय. संक्षिप्त नाम kg आहे"; "१० ग्रॅम शुद्ध सोन्याचा"
    लिटर     26/12  "…आकारमान हे लिटर होय. तसेच, १००० मिली लिटर = १ लिटर"
    हेक्टेअर   0/0   absent

⚠ **हेक्टर IS THE HECTARE IN MARATHI AND HECTOR IN HINDI.** The same string, opposite verdicts, two runs
apart. mr's हेक्टर heads the hectare article and its personal-name hits (हेक्टर मोरेनो the footballer) are
the minority sense; hi's हेक्टर is 56 tokens of the Trojan prince and its hectare is हेक्टेयर. Neither
language's answer could have been borrowed from the other, and a count-first choice would have got hi
wrong in one direction and mr wrong in the other.

**And then the artifact refused ⟨g⟩ for a reason worth its own note.** mr's only `<digit> g` is

    "यामुळे 802.11 a, 802.11 b आणि 802.11 g सोबत तुल्यक्षम"

— a Wi-Fi standard, written **with a space**. The shared tier's `NOT_VERSION` guard rejects a dotted
designation only when the letter is GLUED to the number (`\d+[.,]\d+[a-zA-Z]`), and that is deliberate:
`12.5 g` is a real measurement of exactly the spaced shape. Tested against languages that DO declare ⟨g⟩:

    de   "802.11g"    ˈaxthʊndɐtt͡svaɪ̯ . ɛlf k        guard fires
    de   "802.11 g"   ˈaxthʊndɐtt͡svaɪ̯ . ɛlf ɡʁam     ⟵ reads as GRAMS
    en   "802.11 g"   … wˈʌn ɡɹˈæmz                  ⟵ same, and pre-existing

**Implication.** This is a fleet-wide hole, not an mr one, and it is NOT fixed here: `802.11 g` and
`12.5 g` are the same shape — number, dot, digits, space, one letter — so separating them needs a lexicon
of designations, not a guard, and widening `NOT_VERSION` to allow the space would delete genuine decimal
measurements in every language that declares a one-letter unit. Recorded, and mr declines ⟨g⟩ because its
local rule has no version guard at all and would be worse than the tier. ⟨m⟩ stays refused for the reason
already in the file — `100m`/`200m` are swim events.

**One more thing the diff taught.** Declared ONLY in the shared tier, `100 ha` read *ˈeːk ʃˈeː ɦˈeːkʈəɾ* —
शे is the COMBINING hundred, and the bare-hundred rewrite that produces शंभर for `100 km` never ran,
because `normalize.ts` owns the Latin unit keys for exactly that ordering reason. Adding ha/l/L to the
local map too gives शंभर हेक्टर. Declaring in one place only was audibly wrong, not merely redundant.

**Gates.** corpus diff 0/106, every counter identical · `misread.ts` core 4 → 2 (the two remaining are
`m` and `g`, both deliberate refusals) · review.ts clean, its three `??` pre-existing currency words ·
tests pass.

---

## Run 10 — 2026-08-13, en: the one unit English got wrong

**Command.** `misread.ts --langs en,en-GB,en-IN` then the artifact.

**Raw finding.** en and en-IN report exactly one core mis-read, `ha`; en-GB reports none. Checked directly,
all three are wrong the same way:

    en     "10 ha"   tʰˈɛn hˈɑː        en-GB  "10 ha"  tʰˈɛn hˈɑː        en-IN  "10 ha"  ʈˈɛn hˈɑː

and English's own mined artifact writes the unit, glossed against acres in the same clause:

    6 million farms in 2010 (−32% since 2000) covering 12,700,000 ha or 31,382,383 acres

⚠ **en-GB's `·` was a probe FALSE NEGATIVE, and worth recording as a known residual.** Its shadow token
`ba`/`bá` is inert under the combining acute while `ha`/`há` is not (/hˈɑː/ vs /hˈɒ/) — a lexicon-lookup
idiosyncrasy the shadow cannot predict — so the breaker looked usable and reported a conversion that never
happened. The shadow test catches the systematic cases; it cannot catch a per-word lexicon entry. Direct
reading is still required, and the probe is a finder, not a verdict.

**Fix.** `ha: ["hectare", "hectares"]` in the English UNITS map. `hectare`/`hectares` are already in
`g2p-dict.tsv` and `accent-lexicon.tsv`, so nothing new is asserted about the word.

**Gates.** corpus diff 1/140 in each of the three varieties, and it is that sentence; count agreement
follows the map's existing `[sg, pl]` convention (`1 ha` → hectare). All counters identical.

---

## Run 11 — 2026-08-13, nya: four units, and ny.wikipedia is barren for all of them

**Question.** `9860e68` fixed nya's ⟨cm⟩ and named the class. The probe says four more remain: kg, g, l, ha.
The artifact writes one of them for real — `25.5 g (0,60 mpaka 0,90 oz)`, read *…zisanu ɡ*.

**Command.** `attest.ts --lang nya --wiki ny --words "kilogalamu,kilogramu,galamu,gramu,malita,lita,
malitala,hekitala,mahekitala,ekala,maekala,magalamu,makilogalamu"` (several passes), then a web search
outside the wiki.

**Raw finding — the wiki is a dead end for this whole class:**

    makilogalamu 0 · kilogalamu 0 · kilogiramu 0 · malita 0 · lita 0 · magalamu 0 · galamu 0 · hekitala 0
    gramu        1  ⟵ and it is INSTAGRAM: "(yomwe nthawi zambiri imasindikizidwa ndi IG, Insta kapena gramu)"
    mahekitala   1  glossed against the sign — "Ndi mahekitala makumi asanu ndi atatu (89 hectares)"
    ekala 1 / maekala 2  ⟵ ACRE, not hectare

So the corpus that settled `peresenti`, `madola` and `mamita` has nothing at all here, and stopping at the
wiki would have produced four refusals that are facts about a 4,080-paragraph dump rather than about
Chichewa. Off-wiki, in Chichewa prose, every one of the four is written:

    makilogalamu  Chichewa Chalero NT — Rev 6:6 gives BOTH numbers in one verse, "Kilogalamu imodzi ya
                  tirigu … makilogalamu atatu a barele"; John 19:39 "wolemera pafupifupi makilogalamu 32";
                  Rev 6:6 corroborated in the independent JW Chichewa rendering, so not one translator's
                  coinage. A Malawian agricultural-extension corpus writes it as a rate: "makilogalamu
                  2000 pa hekitala imodzi", "makilogalamu 80 pa ekala limodzi".
    mahekitala    MBC, the state broadcaster, in Chichewa news — "chimanga chomwe analima pa mahekitala
                  240". The extension corpus uses `pa hekitala` as the per-hectare idiom throughout.
    malita        Chichewa Chalero NT, John 2:6 — "Uliwonse unali ndi malita 100 kapena kupitirirapo";
                  and a Malawian newspaper quoting a dairy farmer, "patsiku ndimagulitsa malita 18".
    magalamu      ⚠ ONE sentence, from the extension corpus — "Ikani magalamu 15 pa phando" (apply 15 g
                  per planting station). No dictionary entry anywhere.

**Two homograph traps, both settled against the monolingual Mtanthauziramawu wa Chinyanja rather than by
counting.** `lita` is a VERB (to bend without snapping) and `litala` a class-5 noun for the grass hut put
over a termite mound, so only the `ma-` form carries the litre — which is the sn `marita`/`lita` trap met
from the other side: there the plural was unavailable, here the singular is. And `ekala` is confirmed as
the ACRE, defined in yards by the dictionary and contrasted with the hectare at the correct 2.47 ratio in
one extension sentence ("18500 pa hekitala kapena 7400 pa ekala") — so the hectare could not be taken from
the word this corpus writes most.

**The one that is declared thin, and why it is declared at all.** `magalamu` rests on a single sentence.
It is declared rather than refused because the corpus DOES write the key — the artifact's `25.5 g` is a
genuine gram glossed against ounces — so refusing protects a word that has been read and leaves a live
defect in its place. The thinness is recorded in the file and pinned in the test, which is the difference
between a thin finding and an invented one.

**Word order.** Every sourced sentence puts the noun BEFORE its number (`mahekitala 240`, `makilogalamu
32`, `malita 100`, `magalamu 15`), which is what `unitPrefix: true` already does.

**Gates.** corpus diff 1/416 — the `25.5 g` sentence, *…zisanu ɡ* → *maɡaɽamu …*, and nothing else moved;
DROP 23 → 23, every other counter identical. review.ts clean 10/10. `misread.ts` core 3 → 0. Full suite
3879 passed, no golden changed.

---

## Run 12 — 2026-08-13, the branch measured end to end, under ONE instrument

The figures in Runs 4 and 8 were taken with two different versions of the probe, so they cannot be
subtracted. To get an honest before/after, the CORRECTED probe was copied into the detached baseline
worktree pinned at the branch point and run there.

**Command.** `misread.ts --all` in the baseline worktree, and again in the working tree.

    BEFORE   193 engines · 179 mis-read a CORE unit · 686 core cells · 1777 cells overall
             symbol tier 131 · 119 of those mis-read a core unit (386 cells)
    AFTER    193 engines · 167 mis-read a CORE unit · 651 core cells · 1730 cells overall
             symbol tier 131 · 107 of those mis-read a core unit (351 cells)

    14 engines changed · 35 core cells closed

      awa 3→0   bgc 3→0   bho 3→0   hi 3→0   hne 3→0   mag 3→0   mai 3→0   rkt 3→0
      nya 3→0   de 2→0    en 1→0    en-IN 1→0
      mr  4→2   tl 3→1                        ⟵ the two remainders are DELIBERATE refusals

**⚠ THE MULTIPLIER IS AN ARCHITECTURAL FACT AND HAS TO BE STATED.** Seven of the fourteen engines were
never touched. `makeNativeHindi` resolves `overrides.symbols ?? SYMBOLS`, and awa, bgc, bho, hne, mag, mai
and rkt pass no override — so declaring `g`/`l`/`L`/`ha` in `hindi.ts` declared them for Awadhi, Haryanvi,
Bhojpuri, Chhattisgarhi, Magahi, Maithili and Rangpuri as well, off hi.wikipedia's evidence alone. Those
seven were NOT separately attested. That is exactly the footing the pre-existing km/cm/mm/kg have stood on
since they were declared, and the alternative is eight tiers differing only in which SI units they omit —
but it is a real weakness and it is now written into `hindi.ts` where a rider maintainer will see it.
`mr` is the one rider that overrides, which is why it needed its own sourcing and got its own answer.

**The two remainders are refusals, not misses.** tl's ⟨g⟩ is refused 21:0 on the ligated magnitude
(Run 6); mr's ⟨g⟩ on the spaced version designation and ⟨m⟩ on swim events (Run 9). Both are recorded in
their files and pinned in their tests, so the probe reporting `M` there is the correct state of the world.

**What is left, and it is most of the class.** 107 tier-carrying engines still mis-read 351 core cells,
and 60 tier-less engines mis-read the rest. Nothing about that residue is mechanical: every one needs a
word sourced and its sense read, which is what Runs 5–11 each cost. The probe now makes them findable and
countable, which they were not before — the fleet's leak census could not see any of this, and its "97
engines leaking" figure remains a lower bound for the same reason it always was.
