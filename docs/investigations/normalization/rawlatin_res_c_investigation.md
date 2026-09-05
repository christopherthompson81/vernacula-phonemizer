# Raw-ASCII-Latin residuals — group C (pcm, bm, is, rw, za, cdo, pnb, tl)

The brief: eight languages that already HAVE a normalization layer still echo a vowelless ASCII run
verbatim into their IPA. The task is to READ every hit and classify it, not to expand every abbreviation.

## Run 1 — 2026-08-13

**Command.** `npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/<L>.jsonc --lang <L>`
for each of the eight. (The scratch probe reads only the artifact's `hard` tier and therefore
UNDER-reports; every count in this document is the `mine.ts scan` count over `hard` + `sample`.)

**Question.** What is the real residual count per language, and how does it differ from the brief's
probe figures?

**Raw finding — `mine.ts scan`, `LEAK RAW-LATIN` rows only:**

| lang | scan hits | runs | brief's probe |
|---|---|---|---|
| pcm | 11 | ft:3 kg:1 nm:1 nd:1 bn:1 bsp:1 wdg:1 gb:1 hw:1 kp:1 | 7 |
| bm  | 13 | mln:2 nw:2 bm:1 prs:1 www:1 st:1 pp:1 fn:1 slm:1 kg:1 nt:1 th:1 | 6 |
| is  |  6 | frv:3 mph:2 fl:1 | 6 |
| rw  |  7 | hp:1 nd:1 gm:1 zh:1 kh:1 ts:1 ppm:1 | 6 |
| za  |  7 | mm:4 pp:3 | 6 |
| cdo |  6 | ts:2 km:1 pdf:1 px:1 html:1 | 5 |
| pnb |  5 | kg:2 mp:1 nbsp:1 ft:1 | 5 |
| tl  |  7 | pp:2 km:1 fm:1 nm:1 vs:1 lbs:1 st:1 | 5 |

**Implication.** The `sample` tier adds 7 hits the probe could not see (pcm +4, bm +7, rw +1, za +1,
cdo +1, tl +2). Every one of those extra runs has to be read too. Next step: dump the FULL source
window for all 62 hits before touching any layer.

## Run 2 — 2026-08-13

**Command.** A scratch dumper that re-runs `rawLatinIn` over every artifact line and prints the SOURCE
window around each reported run plus the surrounding IPA tokens, so each hit is read in context rather
than classified from the run alone.

**Question.** What is each of the 62 hits actually made of?

**Raw finding.** The classification splits four ways, and only one of them is a missing unit word:

* **Genuine units in the language's own prose** — bm `kg` (`be se ka kg 1500 walima 2000 dii`, a yield),
  rw `gm` (`agafuniko 1 kagira gm 6`, fertiliser dosing), pnb `kg` ×2, za `mm` (`doekfwn noix gvaq 50mm`),
  cdo `km` (`5720 nè̤ng/km`), tl `nm`/`fm`/`lbs`, is `mph`, pcm `ft`/`kg`/`nm`.
* **A LANGUAGE-SPECIFIC ABBREVIATION** — is `frv` and `fl` are the tails of `o.s.frv.` (*og svo
  framvegis*) and `o.fl.` (*og fleira*), split at every dot.
* **Foreign-language or citation spans inside the artifact** — za's `mm` ×3 sit in wholly GERMAN
  sentences about Panzer armour; pcm's `wdg`/`gb`/`hw`/`kp` sit in wholly IGBO sentences (a digraph
  list); `pp`/`st`/`th`/`mln`/`www`/`html`/`pdf`/`px`/`vs` are English citation and markup furniture.
* **CORPUS DAMAGE that is not about units at all** — the finding of the run.

**The finding: bm's engine was amputating letters, not mis-reading them.** A census of every non-ASCII
character in the bm artifact:

```
ɛ U+025B 2910 (correct)   ε U+03B5 GREEK SMALL LETTER EPSILON            179
ɔ U+0254 2461 (correct)   ԑ U+0511 CYRILLIC SMALL LETTER REVERSED ZE      26
ɲ U+0272  265 (correct)   ᴐ U+1D10 LATIN LETTER SMALL CAPITAL OPEN O       9
                          ɳ U+0273 LATIN SMALL LETTER N WITH HOOK          8
```

None of the four is in the Bambara grapheme table and none is ASCII, so the tokenizer ends the word at
the character and DELETES it:

```
Ntεnεndon ne bε Taa      → nt n ndõ ne b taa          (three fragments)
sԑbԑn sᴐrᴐ ka baara kԑ   → s b n sr ka baara k
A boɳa bɛ …              → a boa bɛ …                 (silent — no gate can see this one)
```

Three of the fragments are vowelless ASCII runs, which is the only reason this reached the raw-Latin
brief at all. The readings were checked instance by instance and every one is unambiguous (`bε`=bɛ,
`fᴐ`=fɔ, `boɳa`=boɲa "size"); ԑ and ᴐ co-occur in the same articles and words, i.e. one author's
substitution set. ⟨ʃ⟩ ×3 is NOT folded — its target (⟨s⟩ or the digraph ⟨sh⟩) is genuinely unsettled.

**Implication.** The fold belongs in `bambara/normalize.ts`, not in `core/unicode.ts`'s
`foldLatinConfusables`: that function folds toward the ASCII letter any Latin reader would see, i.e.
ε→`e`, and /e/ and /ɛ/ are two different Bambara phonemes. The right target is knowable only from THIS
language's alphabet. Shipped as step 2b, after NFC and the entity strip and before every rule that
inspects a letter. bm 13 → 10 on the gate; the 222 repaired characters are the actual win.

## Run 3 — 2026-08-13

**Command.** `attest.ts --lang is --words framvegis,fleira,mílur,mílna,klukkustund`, and the same for
pa/bm/pcm/tl.

**Question.** For each unit or abbreviation that looks declarable, is the WORD attested, in the SLOT?

**Raw finding — the positives.**

* **is.** is.wikipedia's units-of-speed list glosses the abbreviation outright: *"kílómetrar á
  klukkustund, (tákn km/h) MÍLUR Á KLUKKUSTUND, (TÁKN MPH) hnútar…"* — word, symbol and frame in one
  sentence. Its abbreviations article does the same for the other two: *„og fleira“ sem er skammstafað
  sem „o.fl.“*. `framvegis` 24 tokens / 17 arts, `fleira` 27/20, `mílur`/`mílna` both in the measure
  slot (`68 kílómetra (42 mílur) suður af`).
* **pa** (the engine pnb shares). `ਕਿਲੋਗਰਾਮ` 5 tokens / 3 arts, and both read examples are Olympic
  weight classes (`ਫ੍ਰੀਸਟਾਇਲ 60 ਕਿਲੋਗਰਾਮ ਮੁਕਾਬਲਾ`) — the kilogram sense, unambiguous.
* **tl.** `nanometro` 25/15, EVERY example digit-adjacent in the length slot. `libra` 71/20, and the
  wiki names the abbreviation: *"libra (o pound sa Ingles at dinadaglat bilang lb)"*.

**Raw finding — the negatives, which are the more useful half.**

* **pcm `ft` IS REFUSED, and the candidate word is a trap.** `fut` comes back *attested*, 4 tokens / 2
  articles — and all four are `fut-bola` / `fut-bol`, FOOTBALL. `fit` ×116 is the modal verb "can".
  This is the Fula `tere` shape exactly, and a grep would have shipped it.
* **pcm `kg`/`nm`.** `kilogram` 0, `kilo` 0, `nanomita` 0 — the refusal already in naija.ts, re-measured.
* **bm `kg` IS REFUSED ON A SPLIT SENSE.** `kilogaramu` 0, `kilogram` 0; `kilo` is attested 5/3 and
  READING IT SPLITS IT: `a kilo be daminɛ binani ni saba la` (cotton priced per kilo) is the weight,
  but `Bamakɔ ni Dakar … tiɛ kilo ba kɛlɛ (1 000)` and `Bamako-Sénou kilo tan ni duru` are DISTANCES —
  kilometres clipped to `kilo`. Three of five hits are the wrong unit, so the word can be keyed to
  neither `kg` nor `km`.
* **tl `fm` IS REFUSED**, and not for want of a word: `femtometro` is attested 2/1, both in the corpus's
  own nuclear-radius slot. The counter-shape is the collision — the tier folds case for multi-character
  keys, so a Philippine radio frequency `101.1 FM` would read *101.1 femtometro*. 3 physics instances
  against a station-name shape that a tl wiki is full of.

**Implication.** Declare is `mph` + the two dotted abbreviations, pnb `kg`, tl `nm` and `lb`/`lbs`.
Refuse pcm `ft`/`kg`/`nm`, bm `kg`, tl `fm` — each with its measurement recorded in the layer's own
header so it is not re-derived.

## Run 4 — 2026-08-13

**Commands.** The declarations and refusals from Runs 2–3, then `mine.ts scan` again on all eight,
`corpus-diff.ts emit` from a detached baseline worktree at the branch point + `compare`,
`review.ts --lang`, `sources.ts --lang`, `npx tsc --noEmit`, `npx vitest run`.

**Question.** What did each change actually do to the corpus, and did anything else move?

**Raw finding — `mine.ts scan`, LEAK RAW-LATIN rows, before → after:**

| lang | before | after | what closed |
|---|---|---|---|
| is  |  6 | **0** | `o.s.frv.` ×3, `o.fl.`, `mph` ×2 |
| pnb |  5 | **2** | `kg` ×2, the Arabic-semicolon `&nbsp؛` |
| rw  |  7 | **4** | `nd'` (phonotactic), `gm` |
| bm  | 13 | **10** | `nt`, `nw` ×2 (the homoglyph fold) |
| tl  |  7 | **5** | `nm`, `lbs` |
| pcm | 11 | **10** | `bn` |
| za  |  7 |   7   | refusal confirmed — see below |
| cdo |  6 |   6   | refusal argued — see below |
| **total** | **62** | **44** | |

**corpus-diff, mined tier, every language (before/after defect columns are IDENTICAL in all eight —
DIGIT 0, SLOT-GAP 0, RAWMARK 0, THROW 0, and DROP unchanged):**

```
pcm  changed 2/429 (0.5%)     bm  changed 21/343 (6.1%)     is  changed 6/90 (6.7%)
rw   changed 1/442 (0.2%)     za  changed 0/361 (0.0%)      cdo changed 0/393 (0.0%)
pnb  changed 9/449 (2.0%)     tl  changed 2/458 (0.4%)
```

**TWO CHANGES THE RAW-LATIN GATE COULD NOT HAVE FOUND, both surfaced by the diff:**

* **pcm `$2bn` was losing its MAGNITUDE, not its letters.** `projects of abaut $2bn` read *…abaut tu
  DOLA* — two dollars. The `bn` was dropped rather than echoed, so no leak class saw it; the expansion
  makes it *tu biljan dola*, byte-identical to what the same corpus's written-out `$2 billion` reads.
* **pnb `&lrm;` ×7 was being VOICED.** `&lrm;` is not in `core/markup.ts`'s NAMED table, so it stayed
  literal and the symbol tier's ampersand rule read it: *…əlˈoːl ˈət̪eː lˈɝm , nˈeː…* — "and l-r-m".
  Invisible to the raw-Latin differential, because the IPA token `lˈɝm` is not byte-identical to the
  source run `lrm`. Same for rw's `gr`: this engine reads ASCII ⟨r⟩ as ɾ, so `gr` echoed as *ɡɾ* and
  never reported, one clause away from the `gm` that did.
  ⚠ The general `&lrm;` fix belongs in `core/markup.ts` beside `nbsp` and is NOT made here — that file
  is outside this branch's scope. It is handled locally in `punjabi/normalize.ts`, where the corpus
  that proves it lives, and the note says so.

**review.ts.** is is now **checklist clean**. Every other FAIL is pre-existing and is a `sign classes`
or `artifact scan` row for a refusal already argued in that language's own header (each was compared
against the same run in the baseline worktree; pnb's `[??] sourcing` row names ਪ੍ਰਤੀਸ਼ਤ and ਡਾਲਰ, both
pre-existing, and the newly-declared ਕਿਲੋਗਰਾਮ does NOT appear — the attest cache sources it).
**sources.ts.** No row changed in any of the eight; every `[chk?]` is a sign-word gap unrelated to
this class. **tsc** clean, **vitest** 242 files / 3950 passed, 5 skipped. **No pre-existing golden's
expected value changed anywhere in the tree** — the only golden edits are the eight new tests added.

**The two languages where changing nothing is the answer, and why:**

* **za.** The refusal stands, and re-reading the hits also SHRINKS what it costs: of the four `mm`,
  THREE are in wholly GERMAN sentences that reached this artifact as tank-article dump debris
  (`Frontpanzerung von 80 mm`, `die bis zu 80 mm starke Panzerung des … Matilda`, `der 75-mm-Kanone
  des Sherman`) with no Zhuang word in any of them. The genuine Zhuang instance is the ONE the
  existing refusal is already argued against (`doekfwn noix gvaq 50mm`). No new evidence for
  `hauzmij`; the search is unchanged. `pp` ×3 is English bibliography.
* **cdo.** `km` leaks once and the missing thing is a WORD ORDER, not a word. `5720 nè̤ng/km` is a
  rate; cdo declares no `unitPer`. The candidate `mūi` 每 IS attested (12 tokens / 9 arts, every
  example read: `mūi bĭk dê-ciĕ`, `mūi nièng`, `mūi gĕ̤ng cā-tàu`) — and that is exactly why it cannot
  be declared: in this family 每 is PRENOMINAL and precedes the DENOMINATOR (每平方公里5720人), while
  `unitPer` emits `<number> <head> per <denom>`. Declaring it would put the distributive where the
  language never puts it, and would additionally require the head noun `nè̤ng` ("person") to be a unit
  key — the shape bar's `Eihwohna/km²` refusal already names. The other four cdo hits are not language
  data at all: `ts` ×2 is the wiki's own IPA inside slashes (`聲母/ts/, /tsʰ/`), `px` is the `2px` of a
  LaTeX parabola, `pdf` a Commons filename, `html` a mailing-list URL.

**What is left reported across the eight, by class.** English/Latin citation and markup furniture:
`pp` ×3 (bm, tl, za), `st` ×2, `th`, `vs`, `mln` ×2, `www`, `html`, `pdf`, `px`, `mp` (mp3),
`bsp` (a `&nbsp;` corrupted to `&n bsp;` with a space inside — one instance, not worth a rule).
Foreign-language spans inside an artifact: za's German `mm` ×3, pcm's Igbo `wdg`/`gb`/`hw`/`kp` (a
digraph LIST, i.e. a citation of letters). Codes and notation: rw's `zh`/`kh`/`ts` are one Cyrillic
transliteration table, cdo's `ts` is IPA, bm's `slm` is the Arabic root س-ل-م cited as a root,
bm's `prs` a French abbreviation in a bracket, bm's `bm` and `fn` corpus typos. Specialist units with
no attested word: rw `hp` and `ppm` (both English parentheticals), pcm `ft`/`kg`/`nm`, bm `kg`,
tl `fm`, za `mm`, pnb `ft` (`9.7 sq ft`, the modifier-between-number-and-unit shape).

**Implication.** 18 of 62 closed, and the two that closed the most (bm's homoglyphs, pnb's entities)
were not unit declarations at all. The remaining 44 are classified; none is a missing key that this
brief's evidence could supply.
