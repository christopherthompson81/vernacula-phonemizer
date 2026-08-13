# SI unit words for bal, sn, tl, yo — the units the normalization layers never declared

Four layers that already normalize text leak raw ASCII into the IPA for units they never declared.
Measured with a digit adjacent (`10 <unit>`), before any change:

| lang | leaking |
|------|---------|
| bal  | km m mm ha l (and cm, kg) — the widest gap; no length unit at all, and no symbol tier |
| sn   | mm ha l |
| tl   | m mm l (and ha) |
| yo   | m mm l |

The standing rule for this batch: a low token count in a mined artifact is evidence about the CORPUS,
not about the language. Kilometre, metre, millimetre, litre and hectare have a settled form or borrowing
in essentially every written language, so frequency is not grounds to leave raw ASCII in the phoneme
string. But nothing is coined either — every word below is a token somebody else wrote, in a sense that
was read.

---

## Run 1 — 2026-08-12 20:45

**Command.** A scratch probe over the four engines:

    <probe> <lang> "10 km" "10 m" "10 mm" "10 ha" "10 l" "10 cm" "10 kg"

**Question.** Reproduce the defect exactly, and find out whether anything else leaks beside the five
units named in the brief.

**Raw finding.**

    bal   10 km → d̪ah km      10 m → d̪ah m     10 mm → d̪ah mm    10 ha → d̪ah ha
          10 l  → d̪ah l       10 cm → d̪ah t͡ʃm  10 kg → d̪ah kɡ
    sn    10 km → makiromita ɡumi   10 m → mamita ɡumi   10 mm → ɡumi mm
          10 ha → ɡumi ha           10 l → ɡumi l
    tl    10 km → sampˈu kilomˈetɾo 10 m → sampˈu m      10 mm → sampˈu mm
          10 ha → sampˈu hˈa        10 l → sampˈu l      10 cm → sampˈu km
    yo    10 km → mɛ˥wa˩a˥ ki˩lo˥mi˥ta˩  10 m → … m   10 mm → … mm   10 l → … l

**Implication.** The brief's table reproduces exactly. Two extras worth recording: `tl` has an
undeclared `ha` that leaks the same way, and `tl`'s `cm` does not leak — it is *mis-read*, because the
Tagalog g2p gives ⟨c⟩ the value /k/ and `10 cm` comes out as though it said `km`. The `cm` case is a
different defect class (a wrong reading, not a raw leak) and is out of scope here; recorded so the next
reader does not think it was missed. `bal`'s `cm`/`kg` are genuine leaks of the same class as its five.

---

## Run 2 — 2026-08-12 20:52

**Command.** Grep each mined artifact for a digit followed by a candidate unit abbreviation.

**Question.** How often does each corpus actually write these units — i.e. how much local evidence is
there before any external source is needed?

**Raw finding.** Counted with `[0-9]+ ?<u>` and no trailing guard:

    sn    mm 0   ha 0   l 0    m 33
    tl    mm 1   ha 0   l 0    m 2
    yo    mm 1   ha 0   l 13   m 10
    bal   — no Latin unit abbreviation anywhere in the corpus at all

**Implication.** Exactly the situation the brief predicted: the tokens are rare in the artifacts. Note
the shape of the noise, though — `sn`'s 33 and `yo`'s 10 `m` hits are mostly *not* metres, and `yo`'s 13
`l` hits are not litres; see Run 3. The counts above are therefore an upper bound on the evidence, and
the number that matters is the count under the tier's own guard.

---

## Run 3 — 2026-08-12 20:58

**Command.** A scratch probe that rebuilds the shared tier's own unit pattern — `NOT_VERSION`, the
number, the key, and the trailing `(?![\p{L}\p{M}'’ʼ])` guard — and prints every match in context.

**Question.** Trap 46: `m` and `l` are single-letter keys, and the question is not "does the letter
occur" but "what would the tier claim, with the digit-adjacent guard it already applies". Read the sense
of every hit.

**Raw finding.**

    yo   m  → 3   · `2419 m (7936 ft)` — a genuine metre (Chappal Waddi's elevation)
                  · `9h 50m 30.0s` and `9h 55m 40.6s` — MINUTES, in Jupiter's rotation period
         mm → 1   · `(1,524 — 2,032 mm)` — genuine, rainfall
         l  → 0
         ha → 0
    tl   m  → 2   · `c = 299,792,458m/s` — genuine (and a RATE, so `s` matters)
                  · `Rio (23 m)` — genuine, a statue's height
         mm → 1   · `taunang pag-ulan ng 1962.7mm` — genuine, annual rainfall
         l  → 1   · `bilang 91 L / kopyang elektroniko` — a CATALOGUE NUMBER, not a litre
         ha → 0
    sn   mm 0   ha 0   l 0

**Implication, and it splits three ways.**

* `yo`'s 13 raw `l` hits collapse to **0** under the guard, and reading them says why: every one is the
  Yoruba proclitic `l-` written glued to the next word after a number — `1975 lẹ́yìn`, `1829 látàrí`,
  `2.8 làti`, `30,000 lábẹ́`, `2015 lọ`, `1985 lóri`, `2012 láti`. That is trap 46's shape exactly (the
  `mad`/`rn` case), and the tier's existing trailing guard already rejects every instance because a
  Yoruba letter follows the `l`. So `l` is measured SAFE for yo: 0 counter-examples, not 13.
* `yo`'s `m` is the one real hazard in the batch: 1 genuine metre against 2 minutes-in-a-time. Both
  counter-examples are the `Nh Nm Ns` shape in one astronomy article. See Run 8.
* `tl`'s `m` is 2-for-2 genuine with no counter-example; `tl`'s `l` is 0-for-1 — its only hit is a
  bibliographic record number. See Run 7.

---

## Run 4 — 2026-08-12 21:05

**Command.** `attest.ts --lang sn --words mamirimita,mamilimita,milimita,mirimita,mahekita,hekita,mahekitare,marita,rita,malita,lita`

**Question.** Shona has no /l/ and spells its SI loans with ⟨r⟩ (`makiromita`, `masendimita`), so the
millimetre, hectare and litre candidates all have to be probed in both spellings. Which exist, and in
what sense?

**Raw finding.**

    mamirimita   3 tokens / 1 article   attested
    milimita     1 / 1                  attested
    mamilimita   0                      absent
    hekita       1 / 1                  attested
    mahekita     0                      absent
    mahekitare   0                      absent
    rita        10 / 10                 attested
    marita       1 / 1                  attested
    malita       0                      absent
    lita         3 / 2                  attested

Senses, read:

* `mamirimita` — a geology article on sediment grades, three times in the measure slot against digits:
  *"mheu yakakura zvinosvika 4 kusvika 64 mamirimita"*, *"2 kusvika 4 mamirimita dhayamita"*,
  *"64 kusvika 256 mamirimita dhayamita"*. The right sense, the right slot.
* `milimita` — a SECOND article, on the SI prefixes, and it names the abbreviation:
  *"masikati (mm) - haakwanise kushandiswa nekuti zvinopokana ne milimita"*. So the millimetre stem is
  carried by two independent articles and one of them glosses it against ⟨mm⟩ itself.
* `hekita` — *"Minda yeIrigesheni iyi pamwechete inema hekita anodarika 44 (44.4 ha)"*. GLOSSED AGAINST
  THE SIGN, in the same clause. ⚠ And note the typography: `inema hekita` is `ine` + `ma` + a stray
  space + `hekita`, and the verb `anodarika` carries the class-6 subject prefix `a-`. The writer wrote
  the `ma-` plural; the space is a typo.
* `rita` — 9 of the 10 hits are the personal name **Rita**. The tenth is the litre, and it is the
  corpus's own already-quoted sentence: *"tarakita yangu inofamba 10km pa Rita repeturu"* ("my tractor
  does 10 km per litre of petrol"). One hit, right sense, right slot.
* ⚠ `marita` — attested, and it is **Malta**: *"Maruta (kureva Malta …) kana Marita"*. The obvious
  class-6 plural of the litre word is a homograph of a country name on this wiki, so it cannot be
  attested as the litre. This is `sn`'s own `churu`-was-an-anthill shape caught before shipping.
* ⚠ `lita` — attested ×3 and every hit is **Swedish** (*"Du kan lita på mig"*, *"Vem kan man lita på?"*)
  inside discography lists. A pure substring-of-another-language false positive; the ⟨l⟩ spelling is
  absent from Shona as expected.

**Implication.** `mm` → `mamirimita` (with the one-article caveat recorded, mitigated by `milimita`'s
second article). `ha` → `hekita`, the exact attested string. `l` → the attested string is `rita`, and
the `ma-` plural is blocked by Malta, so `rita` it is — see Run 6 for what that costs.

---

## Run 5 — 2026-08-12 21:10

**Command.** `attest.ts --lang tl --words metro,milimetro,litro,ektarya,ektarea,…` and
`attest.ts --lang yo --words mítà,mita,míta,mílímítà,milimita,lítà,lita,líta`, then
`attest.ts --lang tl --words segundo,"bawat segundo"`.

**Question.** Source the Tagalog and Yoruba words, and read the sense of every hit.

**Raw finding.** Tagalog is the best-evidenced language in the batch, because tl.wikipedia names the
SYMBOL beside the word in each unit's own article:

    metro       119 / 20   "Ang metro (simbolo: m) ay ang sukat ng haba … Ang simbolo para sa metro ay m."
    milimetro    38 / 20   "ang kahabaa'y higit-kumulang sa dalawang milimetro (2mm)"
    litro        36 / 20   "L o l ang daglat ng litro" · "1000 mL = 1 L"
    ektarya      45 / 20   "Ang ektarya, simbolo: ha, (mula sa Espanyol na hectárea …)"
    ektarea       0        absent — the ⟨-ea⟩ spelling is not the Tagalog one
    segundo     135 / 20   "Ang segundo ay ang batayang yunit ng panahon" · "metro BAWAT SEGUNDO para sa
                           belosidad" · "(metro bawat segundo na kuwadrado)"

Yoruba:

    mítà         69 / 20   "Mítà je eyo tìpìlẹ̀ ìwọ̀n ìgùn ninu Sistemu Kakiriaye fun awon Eyo (SI)" —
                           definitional; running text "500 mítà (1,600 ẹsẹ̀ bàtà)", "8.62 mítà (28.3 ft)"
    mílímítà      1 / 1    "ó sì mú kí òjò tó ju mílímítà 250 rọ̀" — a flood article
    milimita     12 / 9    the untoned spelling of the SAME word, all rainfall or botanical measurement:
                           "1189.7 milimita gbogbo òjò", "òjò tí ó ju milimita 150 (5.9 in) lọ"
    lítà         10 / 5    all volume: "tó lítà 298", "ẹ̀rọ Ford OHC lítà 2.0", "(35,000 lítà)", and a
                           style note glossing the English: "wọ́n lè kọ \"one litre\" (lítà kan)"
    lita          9 / 4    ⚠ mostly the footballer Leroy Lita and a Ford engine displacement — the toned
                           form is the one to take
    líta          0        absent

**Implication.** Every Tagalog word is settled by a definitional article that names its own symbol, which
is as strong as this kind of evidence gets — and `segundo` makes the artifact's own `299,792,458m/s`
compose as `metro bawat segundo` rather than stranding `/s`. Yoruba's `mílímítà` is one article, but its
untoned twin carries 9 more, so the millimetre stands on 10 articles for one word written two ways.
⚠ NOTHING WAS TAKEN FROM CEBUANO OR HILIGAYNON, which ship `metro`/`milimetro`/`sentimetro` three files
away and would have made the Tagalog probes look unnecessary. A Philippine-language loan that looks
identical to its neighbour's is exactly how a wrong-language word gets laundered into a layer.

---

## Run 6 — 2026-08-12 21:18

**Command.** Count, over each mined artifact, how often the unit noun is written BEFORE its number and
how often after (`<noun>\s*\d` vs `\d\s*<noun>`), then read the instances.

**Question.** The `hil`/`rw` question: does the tier need `unitPrefix` for any of these?

**Raw finding.**

    tl   kilometro 0 before / 4 after  · metro 0 / 7        → 0:11, POSTPOSED, no change needed
    sn   makiromita 4 before / 0 after                      → 4:0, PREPOSED, `unitPrefix: true` already set
    yo   6 before / 4 after                                 → MIXED, and it needed reading

⚠ Yoruba's mixed count resolves once the instances are read. All SIX preposed hits are athletics EVENT
NAMES — `mita 5000`, `mita 3000`, `mita 5000`, `kilomita 10` ("the 5000 metres", "the 10 km") — naming a
race rather than measuring anything. Every genuine MEASUREMENT is digit-first: `4,180 kìlómítà (2,600
miles)`, `500 mítà (1,600 ẹsẹ̀ bàtà)`, `8.62 mítà (28.3 ft)`, `10,000 mita`.

**Implication.** 4:0 postposed for Yoruba once the event-name idiom is set aside, so the tier's default
order stands for tl and yo and Shona's existing `unitPrefix` stands. No word-order declaration changed in
any of the four, which also means no existing golden moved.

---

## Run 7 — 2026-08-12 21:22

**Command.** The Wikimedia Incubator search API (`action=query&list=search&srsearch=insource:"<w>"
prefix:Wp/bcc`), because `attest.ts` probes `<lang>.wikipedia.org` and Balochi has no Wikipedia at any
code. Same probe against `Wp/bgn` as the labelled Western second opinion.

**Question.** Balochi is the priority and has no length unit at all. What does Southern Balochi actually
write — and can the Persian and Urdu that makes up 37.4% of this body be told apart in a search index,
which does not run `filter-by-language.py`?

**Raw finding.** Pages in `Wp/bcc`, with every hit read for whether its SENTENCE is Balochi:

    کیلومتر    16  ✓ "بلوچستانی مساحت بیء پاکستانی تا ۴۷۳۱۹۰ کیلومتر مربع … ایرانی تا ۱۸۱۷۵۸ کیلومتر مربع اینت"
                   ✓ "مزنی= ۲۲۳۵ چارسریکی کیلومتر"   ✓ "۲۱٫۴ نپر مہ یک کیلومترے"
                   ✗ Wp/bcc/کابل is Persian ("مساحتی حدود ۲۷۵ کیلومتر مربع است")
    متر         5  ✓ "بُرزی=۱۳۸۵ متر چہ زرءِ آپءِ ھَددا" (زائدان) ✓ "بُرزی= ۷ متر چہ زرءِ آپءِ ھَددا" (چھبار)
                   ✗ کابل and سینګ are Persian
    میلی‌متر    4  ✓ "گوارگءِ میان= ۷۲ میلی‌متر" (زائدان) ✓ "گوارگءِ میان= ۲۳ میلی متر" (چھبار)
                   ✗ آک and اوگانی are Persian
    ملیمتر      0
    هکتار       1  ✗ and its ONE page is a Persian-template infobox (تاریخ تشکیل / رتبه مساحت / درصد آبها)
    لیتر        0     لٹر 0
    سانتی‌متر   0     کیلوگرم 1, and that page is Persian ("۱۵۰ کیلوگرم بر سانتی متر مربع")

`Wp/bgn` (Western), for contrast: `کیلومتر` 54 pages, `هکتار` 4 — one of them an unambiguously Balochi
sentence, *"ولایتی ٨٠ هزار هکتار دگارا آپ دنت"* — and `لیتر` **0**.

⚠ AND THE FINDING THAT MADE THE WHOLE RULE WORTH WRITING: `Wp/bcc/زائدان` writes its area field as
`|مزنی= ۱۱۰Km` — a Latin, CAPITALISED, unspaced abbreviation glued to Extended Arabic-Indic digits inside
an otherwise Balochi infobox. The mined artifact has ZERO Latin unit abbreviations, which had read as
"Balochi does not write them"; it actually means "383 paragraphs is not many paragraphs".

**Implication.** `km`, `m`, `mm` are declared. `ha` is refused as the `فیصد` case exactly — a word the
WESTERN variety writes and the Southern one does not — and `l` is refused harder still, being ×0 in both
varieties. `cm` and `kg` are refused on the same evidence. Negative result kept: webonary.org's
dialect-labelled Balochi dictionary, which would have settled the litre, still returns HTTP 403 to a
fetch — the same wall the percent refusal hit when this layer was first written. Web searches for a
Balochi litre/hectare surfaced only a University of Balochistan paper on TRADITIONAL Balochi and Brahui
measures (`tir`, `waal`, `nahun`), which is the wrong system entirely.

---

## Run 8 — 2026-08-12 21:30

**Question.** Where does each new reading get made — the shared tier or the language's own layer — and
what does that decision cost?

**Raw finding / decisions.**

* **tl, sn**: the shared tier, one `units` entry each. Nothing special.
* **yo `mm`/`l`**: the shared tier. `l` is safe because the guard already rejects all 13 proclitic hits.
* **yo `m`**: NOT the tier. The tier has no way to decline `9h 50m 30.0s`, and that shape is 2 of the 3
  matches a bare `m` key would take. Read locally in `normalize.ts` step 4b with a `(?<!\p{Nd}h[ ])`
  left guard: 1 of 1 genuine claimed, 2 of 2 counter-examples declined. ⚠ Verified that nothing is lost
  by staying out of the tier — `m/s` is ×0 in this corpus and a bare `m²` is ×0 (all 24 of its
  `m`-superscripts are `km²`, which the existing paths already read).
* **bal**: NOT the tier, and the reason is structural rather than tactical. `SymbolData.percent` is a
  REQUIRED field, so adopting `makeSymbolNormalizer` would mean naming a Balochi percent word — and this
  layer's header spends a paragraph explaining that there isn't one to name. A layer does not get to
  invent a word as the price of admission to a seam. What the tier would have added on top (a rate path,
  an exponent path) this corpus does not exercise: it writes `چارسریکی کیلومتر` as WORDS, and `km/h` is
  ×0 in both Balochi corpora. So the rule is local, uses the file's own `[0-9۰-۹٠-٩]` digit class, and
  runs BEFORE the decimal step (which replaces the point with a space and would otherwise leave the unit
  attached to the fractional part alone).
  ⚠ It also admits a DECIMAL operand, which the tier's `NOT_VERSION` guard would have refused: measured
  over the 383 Southern paragraphs, `\d+[.٫]\d+` + 1–3 Latin letters occurs 4 times and all four are
  `37.4 per` inside the artifact's own English provenance note. 0 version designations, so the guard is
  pure cost here — the same finding Shona's step 7 records for `1.5m`.

**Implication.** Two of the four readings live outside the shared tier, each for a reason that is a
property of the language rather than a convenience.

---

## Run 9 — 2026-08-12 21:35

**Command.** `npx tsc --noEmit`; `npx vitest run`.

**Question.** Does anything already pinned move?

**Raw finding.** `tsc` clean. `vitest`: 3844 passed, 1 failed — `test/onnx-optional.test.ts`, the 5-second
timeout the brief says to discount, and it fails for concurrency rather than for content. **No existing
golden changed its expected value in any of the four languages**, which the word-order finding in Run 6
predicts: nothing that was already declared was redeclared, and every new key was previously a leak.

New goldens added: `test/tagalog.test.ts` (units + the m/s rate), `test/shona.test.ts` (units, including
the class-6 concord on the new millimetre and the `km/l` rate that reproduces the corpus's own sentence),
`test/yorubaNormalize.test.ts` (units, the proclitic non-match, and the `9h 50m` refusal),
`test/balochi.test.ts` (units, the `۱۱۰Km` shape, and the hectare/litre refusals pinned so they stay
visible).

---

## Run 10 — 2026-08-12 21:45

**Command.** `git archive a320462 | tar -x -C <baseline>` for a pristine tree at the starting commit
(no `git worktree add`, so no shared `.git` state is mutated and no sibling's checkout is touched), then
`corpus-diff.ts emit` on both sides and `compare` for each language over `mined:<lang>`.

**Question.** At corpus scale, does anything change that was not meant to — and do the intended changes
actually appear?

**Raw finding.**

    bal   changed   0/85  (0.0%)   before/after both { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 3,  THROW 0 }
    sn    changed   0/439 (0.0%)   both { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 44, THROW 0 }
    tl    changed   5/458 (1.1%)   both { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 49, THROW 0 }
    yo    changed   3/452 (0.7%)   both { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 34, THROW 0 }

Every one of the 8 changed utterances read, in full:

    tl  `c = 299,792,458m/s`            `… walˈo m s` → `… walˈo mˈetɾo bˈawat seɡˈundo`
    tl  `dalawang daan m paruparo`      `… m` → `… mˈetɾo`   (the 200 m butterfly)
    tl  `taunang pag-ulan ng 1962.7mm`  `… mm` → `… milimˈetɾo`
    tl  `Kristo … ng Rio (23 m)`        `… m` → `… mˈetɾo`
    tl  `bilang 91 L / kopyang …`       `… l` → `… lˈitɾo`   ⚠ THE KNOWN COUNTER-EXAMPLE, and now visible
    yo  `Chappal Waddi ní 2419 m`       `… m` → `… mi˥ta˩`
    yo  `(1,524 — 2,032 mm) lọ́dún`      `… mm` → `… mi˥li˥mi˥ta˩`
    yo  `ìfò 7.12 m ní ìgbìyànjú …`     `… m` → `… mi˥ta˩`   (Chioma Ajunwa's long jump, Atlanta 1996)

**Implication.** No new defect in any class, in any of the four. Two things the probe in Run 3 had not
shown:

* Yoruba's local metre rule takes THREE genuine metres, not one — `7.12 m` was invisible to the probe
  because the probe reproduces the tier's `NOT_VERSION` guard, which rejects a dotted number glued to a
  one-letter key. The local rule has no such guard (measured ×0 version designations in this corpus), so
  it reads a long-jump distance the tier would have declined. 3 genuine claimed, 2 minutes declined.
* `bilang 91 L` reads as "91 litro" in the after, exactly as predicted and argued at the declaration.
  Recorded here in the diff as well so the cost is a measured line rather than a footnote.

⚠ bal and sn changed 0 utterances, which is the expected shape and not a null result: bal's artifact
contains no Latin unit abbreviation at all and sn's contains no `mm`/`ha`/`l`. The corpus diff cannot see
this change for those two, and says so by reporting nothing.

---

## Run 11 — 2026-08-12 21:52

**Command.** `referee-eval` (`tools/referee-eval/eval.ts <lang>`), `mine.ts scan`, `sources.ts --lang`,
`review.ts --lang`, each run on both trees and diffed.

**Question.** Do the standing gates move, and CAN they move — i.e. is each one able to measure this
change at all?

**Raw finding.**

* **referee-eval — CANNOT MEASURE THIS.** `bal` is not in the tool's accepted language list at all
  (its normalize.ts header already says so). For the other three the numbers are byte-identical before
  and after, which is the correct outcome: these referees are word→IPA lists and a unit reading is a
  SYMBOL reading, which no word list contains.

      sn   raw exact 263/443 (59.4%)    folded backbone 440/443 (99.3%)   — identical
      tl   raw exact 2/25188 (0.0%)     folded backbone 21903/25188 (87.0%) — identical
      yo   raw exact 34/4937 (0.7%)     folded backbone 4447/4937 (90.1%) — identical

* **mine.ts scan** — byte-identical for all four. No DROP or defect class moved.
* **sources.ts** — byte-identical for all four. It reports SIGN-word classes (percent, currency, the
  math signs), and units are not one of them, so like referee-eval it cannot see this change.
* **review.ts** — the only gate that moved, and every move is an improvement or an artefact:

      bal   `exponent  5 km²` INTENT `pant͡ʃ km`  →  `pant͡ʃ kiːluːmt̪r`
            `1/2/5 km`        `jak km` …          →  `jak kiːluːmt̪r` …
      yo    `[ ?? ] sourcing  onígun — in NO source`  →  `[ ok ] all 12 high-traffic words attested`
      sn    3 FAILING → 2 · tl 1 → clean · bal 1 → clean

  ⚠ TWO OF THOSE ARE NOT MINE AND ARE LABELLED AS SUCH. The `artifact tracked … is UNTRACKED` FAIL that
  disappears in every language is an artefact of the BASELINE tree: `git archive` produces a plain
  directory with no `.git`, so the tracked-ness probe fails there and passes in the real worktree. And
  yo's `onígun` flipping to attested is an incidental side effect of Run 5: `attest.ts` caches its
  EXAMPLES, and the sentence it stored for `lítà` — *"tó lítà 298 (ẹsẹ̀ ONÍGUN mẹ́ta 10.5)"* — happens to
  contain the squared word review.ts was asking about. A real attestation, found by accident.
  Discounting both, the real failing items are unchanged: sn keeps its 2 (the intentional `minus`
  silence and the artifact scan's pre-existing DROPs), tl and bal keep 0, yo keeps 1.

* **`npx vitest run`** — 3844 passed, 1 failed: `test/onnx-optional.test.ts` timing out at 5 s under
  concurrent load, which the brief says to discount and which is unrelated to any of these files.
* **`npx tsc --noEmit`** — clean.

**Implication.** Of the six gates, three (referee-eval, sources.ts, mine.ts scan) structurally cannot
see a unit declaration; one (corpus-diff) sees it for tl and yo and is silent for bal and sn because
their artifacts do not contain the shapes; one (review.ts) shows it directly for bal; and the goldens
are where the four languages are actually pinned. That is worth saying plainly rather than reporting six
green ticks as six confirmations.

---

## Run 12 — 2026-08-12 21:56

**Summary of what shipped, and what did not.**

| lang | declared | word | source, sense read |
|------|----------|------|--------------------|
| bal | `km` | `کیلومتر` | Wp/bcc ×16 pages; *"۴۷۳۱۹۰ کیلومتر مربع"*, and the mined corpus's own *"۹/۸ ملیون چارسریکی کیلومتر"* |
| bal | `m` | `متر` | Wp/bcc ×2 Balochi pages, both *"بُرزی=N متر چہ زرءِ آپءِ ھَددا"* (elevation) |
| bal | `mm` | `میلی‌متر` | Wp/bcc ×2 Balochi pages, both *"گوارگءِ میان= N میلی‌متر"* (mean rainfall) |
| bal | `ha` | **REFUSED** | ×0 Southern (its one page is a Persian infobox); ×4 pages WESTERN — the `فیصد` split |
| bal | `l` | **REFUSED** | `لیتر` ×0 in Wp/bcc AND Wp/bgn; `لٹر` ×0 in both; webonary 403 |
| bal | `cm`,`kg` | **REFUSED** | `سانتی‌متر` ×0; the one `کیلوگرم` page is Persian |
| sn | `mm` | `mamirimita` | sn.wikipedia ×3/1 (sediment grades) + `milimita` in a 2nd article naming ⟨mm⟩ |
| sn | `ha` | `hekita` | ×1/1, glossed against the sign: *"hekita anodarika 44 (44.4 ha)"* |
| sn | `l` | `rita` | ×1 of 10 hits in the litre sense (9 are the name Rita): *"10km pa Rita repeturu"* |
| tl | `m` | `metro` | ×119/20, *"Ang metro (simbolo: m)"* — definitional |
| tl | `mm` | `milimetro` | ×38/20, *"dalawang milimetro (2mm)"* |
| tl | `l`,`L` | `litro` | ×36/20, *"L o l ang daglat ng litro"* |
| tl | `ha` | `ektarya` | ×45/20, *"Ang ektarya, simbolo: ha"* |
| tl | `s` (rate) | `segundo` | ×135/20, *"metro bawat segundo para sa belosidad"* |
| yo | `mm` | `mílímítà` | ×1/1 toned + `milimita` ×12/9 untoned, all rainfall/botanical |
| yo | `l`,`L` | `lítà` | ×10/5, all volume; *"one litre (lítà kan)"* |
| yo | `m` | `mítà` | ×69/20, definitional; read LOCALLY with an `Nh Nm` guard |

Single-letter-key decisions, measured with the tier's own digit-adjacent guard over each artifact:

    tl  m   2 matches, 2 genuine, 0 counter-examples          → DECLARED
    tl  l   1 match,   0 genuine, 1 counter-example (`bilang 91 L`, an English bibliographic
                                   citation in a references list — not a Tagalog construction) → DECLARED, cost recorded
    yo  l   0 matches (13 raw hits, all the proclitic `l-`, all rejected by the existing guard) → DECLARED
    yo  m   3 matches, 1 genuine + 2 minutes-in-a-time        → DECLARED LOCALLY with a guard
    sn  mm/ha/l  0 matches of any kind                        → DECLARED on wiki evidence
    bal m/mm/km  0 Latin unit abbreviations in the artifact; the only digit-adjacent Latin run of any
                 kind is `04 via` ×4                          → DECLARED on Incubator evidence

**Still open, recorded rather than fixed.** `tl`'s `cm` MIS-READS rather than leaks (⟨c⟩ → /k/, so
`10 cm` sounds like `10 km`) — a g2p reading bug in a different class, and `sentimetro` is not sourced
here. `bal` has no rate or exponent path, which its corpus does not exercise. Shona's `hekita` and
`rita` are the exact attested strings rather than the `ma-` plurals the rest of that file uses, so they
are deliberately absent from `MA_NOUNS` and take no class-6 concord.
