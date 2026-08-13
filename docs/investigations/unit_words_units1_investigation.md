# Missing SI unit words — jv, mg, mi, za

Four normalization layers already declare a kilometre word, so the symbol tier is wired in each. Each
leaks raw ASCII into the IPA for a unit it never declared. Measured with a digit adjacent (`10 <unit>`):

    jv   mm  l
    mg   mm  l
    mi   mm  ha
    za   mm  l

The task is the WORD: source it, read the sense, declare it, and read the phonemization. A sibling branch
adds the bare-token path in the shared tier so a standalone `mm` reads; that half is not visible here.

## Run 1 — 2026-08-12 (baseline)

Command: a four-language probe of `phonemize("10 <unit>", lang)` for
`mm l ha cm km m kg g t ml L`.
Question: reproduce the reported leak and see what else is adjacent to it.

Raw finding (only the interesting rows):

    jv   10 mm -> səpˈulʊh mm      10 l -> səpˈulʊh l     10 ha -> səpˈulʊh hˈɔ
    mg   10 mm -> fˈulu mm         10 l -> fˈulu l        10 ha -> fˈulu hˈa
    mi   10 mm -> tekau mm         10 l -> tekau ˈɛɫ      10 ha -> tekau ha
    za   10 mm -> ɕiːp˥ mm         10 l -> ɕiːp˥ l        10 ha -> ɕiːp˥ haː˨˦

Implication: the reported table is right, and there is a second class beside it. `jv 10 ha` and
`mi 10 l` are not raw ASCII, so no leak class names them — the g2p reads the abbreviation as a WORD
(`hˈɔ`) or, in Māori, routes it to the English letter name (`ˈɛɫ`). Those are worse than a leak, not
better, because nothing downstream can see them. Both are the same defect and both are in scope.

## Run 2 — 2026-08-12 (corpus counts, and the trap-46 measurement)

Command: count digit-adjacent `l`, `mm` and `ha` in each mined artifact
(`[\d] ?[lL](?![\p{L}\p{M}\d])` and friends).
Question: is a bare one-letter `l` key safe here, and does each key have an instance at all?

    lang   digit+l   digit+mm   digit+ha
    jv       0          1          5
    mg       0          2          0
    mi       0          1          0
    za       0          1          0

The instances, read:

    jv   2000 mm/taun (regency rainfall) · 105 x 45 x 18 mm (phone dimensions)
         198.000 Ha · 183.000 Ha · 2000 Ha · 13.000 Ha (tobacco acreage) · 5 Ha (an island)
    mg   mahery ny 50 mm isam-bolana ny latsak' orana · latsaky ny 50 mm ny latsak' orana (rainfall)
    mi   Me rawaka te hōhonu o te tauira, 5 mm (1/5 inihi)  (a required sample depth)
    za   Bi bingzyinz doekfwn noix gvaq 50mm  (mean annual rainfall)

Implication (trap 46): **zero counter-examples in all four**, so nothing in these corpora can be eaten by
a bare `l`. Zero is also zero positives, but the brief's rule applies — a rare token is evidence about the
corpus. jv's `Ha` ×5 promotes the hectare from "not in the brief" to "the corpus writes it"; mg's `ha` ×0
demotes it to trap 9 and it stays undeclared there. Note `jv`'s only `mm` is a RATE (`mm/taun`), which
matters later.

## Run 3 — 2026-08-12 (attestation: jv)

Command: `attest.ts --lang jv --words milimèter,milimeter,liter,lliter,hektar,hèktar,héktar`
Question: does jv have these words, in the unit sense?

    milimèter  49/20   liter 77/20   hektar 30/20   hèktar 21/20   héktar 34/20   (token/articles)

Senses read: jv.wikipedia has a **Milimèter article** whose first line disambiguates from the symbol —
"Milimèter utawi millimèter punika salah satunggalipun unit SI ingkang…" — and five separate articles
write the ladder `milimèter << sèntimèter << dhèsimèter << mèter`. The **Liter article** defines the unit
("Liter yaiku unit ukur saka volume") and then states the symbol convention outright: "Simbol liter yaiku
huruf l cilik, utawa hurup kapitale, L". The km² article glosses "100 ha (hèktar)" and "1 hèktar = 0.01
(10−2) km2".

Implication: all three declarable, and the Liter sentence is the attestation for the KEYS as well as the
word — it is the wiki saying both cases are the symbol. Spelling picked with ⟨è⟩ to match this file's
existing `mèter`/`sèntimèter` register and the gloss line's own `hèktar`.

## Run 4 — 2026-08-12 (attestation: mg)

Command: `attest.ts --lang mg --words milimetatra,litatra,hektara`
Question: same, for Malagasy.

    milimetatra 30/20   litatra 25/20   hektara 28/20

Senses read: "**Ny milimetatra, izay hafohezina amin' ny hoe mm**, dia ventin-kalava…" — the word glossed
against the very symbol being declared — plus "misy arivo milimetatra ny iray metatra". `litatra` is
defined as the volume unit ("ny litatra, dia nofaritana ho mitovy amin' ny iray desimetatra toratelo") and
the corpus writes it postposed after a magnitude chain: "1.33 hetsy tapitrisa (133.000.000.000) litatra ny
labiera". `hektara` sits after numbers throughout ("7,6 tapitrisa hektara", "6.000 hektara").

Implication: `mm` and `l`/`L` declared. `ha` **refused** despite the word being the best-attested of the
three — the corpus has no `<digit> ha`, so the key would be a rule with no instance. Word order confirmed
postposed (the tier's default), consistent with this layer's existing `toradroa`/`isan-jato` notes.

## Run 5 — 2026-08-12 (attestation: mi, and the register split)

Commands: `attest.ts --lang mi --words mirimita,manomita,mirimitakau,heketea,hēkitea,hekitea,rita,ritaa`
then `--words mitamano,mitarau,manomita,kiromita,henimita`; plus Te Aka and Paekupu (Te Ine).

    mirimita 2/1    heketea 5/5    rita 2/2
    mitamano 0/0    mitarau 0/0    manomita 0/0    kiromita 38/20    henimita 1/1

Senses read. `mirimita`: both wiki hits are the unit slot in one climate table — "E 688 mirimita te
toharite o te ua o te tau", "E 194.3 mirimita te ua nui rawa i te rā kotahi". Te Aka: *mirimita, noun,
(loan) millimetre*. `heketea`: five areas after numbers, one glossed against the symbols — "200 heketea
(2.0 km2; 490 eka)"; Te Aka: *(loan) hectare — a metric unit of square measure equal to 2.471 acres or
10,000 square metres*; Paekupu pairs it with ⟨ha⟩. **`rita`: both wiki hits are Rita Lee, the singer** —
the `bar`/`ti`/`ht` proper-noun trap — but Te Aka gives *rita, noun, (loan) litre*, "the main unit for
measuring capacity", and Paekupu pairs it with ⟨l⟩.

Implication, and the negative result worth keeping: **Paekupu's coined series is absent from running
Māori.** The terminology bank gives `mitamano` (mm), `mitarau` (cm), `manomita` (km); the wiki writes the
TRANSLITERATIONS `kiromita` ×38, `mirimita` ×2, `henimita` ×1, and all three coined forms probe 0/0. This
layer already reads ⟨km⟩ as `kiromita`, so taking Paekupu wholesale would mean re-reading ⟨km⟩ against 38
counter-instances. Declared: `mirimita`, `heketea`, `rita`. Paekupu's contribution is that it confirms the
concept has a settled Māori form and pairs each with its symbol — it is not the source of the spelling.

`l` in Māori is a special case of trap 46 running the OTHER way: ⟨l⟩ is not a letter of the Māori alphabet,
so a digit-adjacent `l` cannot be the tail of a native word or a bound clitic.

## Run 6 — 2026-08-12 (za: the search that ended in a refusal)

Commands, in order:
1. `attest.ts --lang za --words hauzmeix,hauzmij,mauzmeix,gunghswng,goengswng,swngj,swng,leizmeix,goengleix`
2. za.wikipedia API `list=search` with `insource:"hauzmij"`, `"lizmij"`, `"cenhmij"`, `"gunghlij"`,
   `"bingzmij"`, `"hauzswng"`, `"hauz"`, `"mij"`
3. en.wiktionary descendants of 釐米 and 毫米; the 1,291-lemma Zhuang–English Wiktionary lemma set
4. Glosbe zyb ← millimetre
5. a 13,619-entry Chinese→Zhuang and 16,029-entry Zhuang→Chinese dictionary, plus a 4,944-sentence
   Zhuang–Chinese parallel corpus (ZhuangBench, sourced from a published Zhuang–Chinese dictionary)

Question: is there ANY Zhuang word for the millimetre or the litre?

Raw findings:

    hauzmeix / hauzmij / mauzmeix / gunghswng / goengswng   0 token, 0 substring   (wiki)
    insource:"hauzmij" 0 · "lizmij" 0 · "cenhmij" 0 · "gunghlij" 0 · "hauz" 0 · "hauzswng" 0
    insource:"bingzmij" 1  — "ciemq dieg aiq miz 500 bingzmij" (500 m²)
    Nazmij — the wiki HAS a nanometre article; "daj 630 namij daengz 750 namij" for a wavelength
    en.wiktionary 釐米 → Descendants → Zhuang: leizmeix, lizmij      (毫米: no Zhuang descendant)
    Zhuang lemma set (1291): goengleix = kilometre; nothing below the centimetre; no litre
    Glosbe zyb millimetre: "we have no translations"
    zh→za dict: 毫 → hauz ·  釐米 → leizmeix ·  升 → aengaen, swng ·  吨 → dun ·  亩 → moux
                毫米, 公里, 公升, 公顷, 平方米, 千米, 立方米, 公斤 → NO ROW
    za→zh dict: swng → "升; 提高" (to rise / promote); 【方言】aengaen "量米筒 [比mbaek大, 能装一斤左右]";
                "(一) 升"          — i.e. the traditional rice-measuring tube, not the litre
                mij  → 不 (not) / 锅烟子 / 焦黑
    parallel corpus (4,944 sentences): every `swng` is 升级 / 提升 / 上升, the verb. No 毫米. No 公升.

Implication — **both refused, and for two different reasons.**
`mm`: the head noun is attested in two shapes (`-meix` and `-mij`, both in Wiktionary's 釐米 descendants,
both on the wiki) and the modifier 毫 → `hauz` is in the dictionary, but the COMPOUND is absent from every
source checked. That is the Fula `tere` shape exactly, and trap 37 says a bare modifier is never the
attestation. `l`: `swng` is attested and the sense is wrong — a rice tube and a verb, in a dictionary that
has no 公升 row and a parallel corpus where all 48 hits are 升级/提升/上升. Declaring it would read "ten
litres" as "ten rice-tubes", which is the `bar`-`Komma` / `ti`-`ናቕፋ` / `ht`-`pwen` failure.

The refusal and its evidence are written into `src/languages/zhuang/normalize.ts` beside the `UNITS`
table, because the corpus DOES write `50mm` — the key has an instance and only the word is missing, so a
future reader will reach for it again.

Also recorded there: `mij` as a free word is the NEGATOR "not", which is why no one-letter guess is
available as a fallback either.

## Run 7 — 2026-08-12 (the jv rate that the new key exposed)

Command: `phonemize("2000 mm/taun", "jv")` after declaring `mm`.
Question: does the corpus's own `mm` instance read correctly now?

Raw finding: `rˈɔŋ ˈəwu milimˈɛt̪ər t̪ˈaʊn` — "two thousand millimetre year". The tier matched the
numerator, the denominator `taun` was not declared, so the optional rate group did not match, and the
tokenizer then dropped the slash silently.

Implication: declaring a numerator can EXPOSE a missing denominator. `taun` added to `rateDenominators`
(`unitPer` already supplies the corpus's own rate word "per", from `mèter kubik per detik`). Denominator
keys are not matchable standalone, so this cannot turn a bare `taun` into a unit. Now reads
`milimˈɛt̪ər pˈər t̪ˈaʊn`.

## Run 8 — 2026-08-12 (gates, before vs after)

Baseline for every before/after below is a **read-only extract of the branch-point commit**
(`git archive <commit> | tar -x` into a scratch directory with `node_modules` symlinked) — not a stash and
not a second git worktree, so nothing mutable is shared with any sibling branch.

`npx tsc --noEmit` — clean, before and after.

`npx vitest run` — 242/242 files, 3,848 passing. One flake under concurrent load,
`test/onnx-optional.test.ts` timing out at 5 s; it passes in isolation in 3.1 s. **No golden's expected
value changed** — the only test-file edits are NEW cases appended to `javanese`, `malagasy`, `maori` and
`za`.

`mine.ts scan` — for each of the four, byte-identical class counts before and after. jv still reports its
one Javanese-script `LEAK SLOT-GAP` and za its two `DROP minus` (both inside imported ENGLISH paragraphs);
both are pre-existing, confirmed against the baseline extract, and untouched by a unit declaration.

`review.ts --lang` — same verdicts before and after: mg and mi clean, jv failing only on the pre-existing
script slot-gap, za failing only on the pre-existing dropped minus. Both jv's and za's failures were
reproduced on the baseline extract line-for-line.

`sources.ts --lang` for all four — output **identical**, which is expected and worth stating: `units` is
the one class the sourcing gate deliberately excludes, so it cannot see this work at all. That exclusion is
exactly why a missing unit word can sit in a layer for a whole review cycle.

`corpus-diff.ts emit` / `compare`, per language:

    jv   changed 6/448 (1.3%)   defect classes IDENTICAL { DIGIT 0, SLOT-GAP 1, RAWMARK 0, DROP 30, THROW 0 }
    mg   changed 1/439 (0.2%)   identical { …, DROP 43, … }
    mi   changed 1/109 (0.9%)   identical { all zero }
    za   changed 0/361 (0.0%)   identical — nothing declared, nothing moved

Every changed line read:

    jv  …sanga puluh MM karo…            → …sanga puluh MILIMÈTER karo…       (annual rainfall)
    jv  …rong èwu MM taun…               → …rong èwu MILIMÈTER PER taun…      (the rate, Run 7)
    jv  …wolu èwu HƆ…                    → …wolu èwu HÈKTAR…                  (198.000 Ha)
    jv  …limɔ HƆ…                        → …limɔ HÈKTAR…                      (5 Ha, an island)
    jv  …suket GRAM L…                   → …suket GRAM PER LITER…             (⚠ see below)
    jv  …wolulas MM déné bobot…          → …wolulas MILIMÈTER déné bobot…     (phone dimensions)
    mg  …dimampulu MM isam-bolana…       → …dimampulu MILIMETATRA isam-bolana… (monthly rainfall)
    mi  …rima MM tahi rima inihi…        → …rima MIRIMITA tahi rima inihi…    (5 mm (1/5 inihi))

⚠ THE FIFTH jv LINE IS A GAIN NOBODY ASKED FOR AND IT IS THE MOST INSTRUCTIVE ONE. `30 nganti 50 gram/l`
(blood albumin concentration) was reading *gram l* — the numerator spoken, the relation deleted, the
denominator leaked as a letter. `g` was already declared; only `l` was missing, and a rate needs BOTH
halves or the tier abandons the whole match. So the litre key repaired a line that contains no litre
symbol anyone would have gone looking for.

`referee-eval.ts` for all four — **byte-identical before and after, and it cannot be otherwise.** Every
referee for these four is a headword list (kaikki jav Latin 1362 / Aksara Jawa 1268; wikipron mlg 187 +
kaikki mg 201; wikipron mri_latn_broad 1005; wikipron zha 1682 + kaikki za 1709). A symbol layer only fires
with a digit adjacent, and a word list has no digits, so this gate cannot measure this class of change for
any of the four. Recorded for completeness, not as evidence:

    jv  folded backbone 86.2% / 84.5%, symbol accuracy 96.5% / 96.3%   — unchanged
    mg  folded backbone 78.6% / 73.1%, symbol accuracy 94.0% / 90.6%   — unchanged
    mi  folded backbone 99.8%,          symbol accuracy 100.0%          — unchanged
    za  folded backbone 99.5% / 99.5%, symbol accuracy 99.8% / 99.8%   — unchanged

## Run 9 — 2026-08-12 (final readings, read rather than asserted)

    jv   10 mm → səpˈulʊh milimˈɛt̪ər      10 l/L → səpˈulʊh lˈit̪ər     10 ha / 10 Ha → səpˈulʊh hˈɛkt̪ar
         2000 mm/taun → rˈɔŋ ˈəwu milimˈɛt̪ər pˈər t̪ˈaʊn
    mg   10 mm → fˈulu milimetˈaʈʂa       10 l/L → fˈulu litˈaʈʂa       10 ha → fˈulu hˈa (refused, unchanged)
    mi   10 mm → tekau miɾimita           10 ha → tekau heketea         10 l/L → tekau ɾita
    za   10 mm → ɕiːp˥ mm (refused)       10 l → ɕiːp˥ l (refused)

Diacritics and digraphs checked, since the brief warns the engine may treat them unexpectedly: jv's ⟨è⟩
reads [ɛ] in both `milimèter` and `hèktar` and does NOT trigger the pepet; mg's ⟨tr⟩ gives the retroflex
affricate [ʈʂ] in `milimetatra`/`litatra`, matching the existing `kilometatra`; mi's macronless `mirimita`,
`heketea` and `rita` all take the ⟨r⟩ → [ɾ] flap, and `heketea` is not re-syllabified across ⟨ea⟩.
