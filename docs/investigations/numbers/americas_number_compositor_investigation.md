# Cardinal number compositors for five languages of the Americas (qu, quc, nci, mto, chr)

Scope: five engines that spoke no numbers at all (the digit branch passed digits through). Three are
VIGESIMAL (quc, nci, mto), two decimal (qu, chr). All five ended up **Pattern B** (bespoke `numbers.ts`),
data inline + cited, because none of them fits `NumbersDef` — see Run 1.

Verification harness used throughout: the fanout probe (0–100, 101, 111, 555, 999, 1000, 1001, 12345, 10⁶,
10⁹; flags EMPTY / DIGIT-LEAK / SENTINEL / SLOT-GAP / duplicate outputs).

---

## Run 1 — 2026-07-28 — can any of these use Pattern A?

Question: does the declarative `NumbersDef` + `westernNumberWords` path cover any of the five?

Read `src/core/numbers.ts`, `welsh/numbers.ts`, `irish/numbers.ts`, `somali/numbers.ts`, and all five target
engines. Finding: **no.**

- `renderNumber` maps each composed *word* through the language G2P individually. Quechua's tens are TWO
  words (`iskay chunka`), so they cannot be a `tens[]` entry — `phonemizeWord("iskay chunka")` does not split
  on space.
- Quechua also needs the linking suffix `-yuq ~ -niyuq`, which is not expressible as `compound{}` without
  enumerating 21–99 by hand.
- quc / nci / mto are base-20: there is no decimal tens series to put in `tens{}` at all.
- chr clips its tens before a unit (`ᏔᎵᏍᎪᎯ` → `ᏔᎵᏍᎪ ᏌᏊ`) and builds hundreds off the TENS word.

Implication: five bespoke `numbers.ts` files. kiche / nahuatl / totontepecmixe / cherokee have no `.jsonc`
manifest at all, so data goes inline; quechua has one, but inline was kept for consistency (and to avoid a
second `loadManifest` call or a circular import with `quechua.ts`).

---

## Run 2 — 2026-07-28 — Quechua (qu): Wiktionary lemmatises the whole system

Command: Wiktionary API, `Category:Quechua numerals`.

Raw finding: 70+ entries, including every compound below 100 as its own lemma (`chunka hukniyuq`,
`iskay chunka isqunniyuq`, …) and the magnitudes `pachak` 100, `waranqa` 1000, `hunu` 10⁶, `lluna` 10⁹. The
`cardinalbox` predecessor/successor chains give the composition verbatim:

- `pachak` → successor `pachak hukniyuq` (101)
- `waranqa` → predecessor `isqun pachak isqun chunka isqunniyuq` (999), successor `waranqa hukniyuq` (1001)
- `hunu` → predecessor `isqun pachak isqun chunka isqunniyuq waranqa isqun pachak isqun chunka isqunniyuq`
- `lluna` → predecessor `… hunu … waranqa …`

Three rules fall straight out: (a) the leading "one" is dropped on a bare magnitude, (b) only the FINAL unit
word takes the `-yuq` linker, (c) groups are largest-first with no conjunction. Allomorphy is mechanical:
`-niyuq` after a consonant, `-yuq` after a vowel — all nine lemmas match.

Implication: full clean coverage 0 … 999,999,999,999; fall back at 10¹² (no attested magnitude above
`lluna`). Probe CLEAN on the first run.

---

## Run 3 — 2026-07-28 — Cherokee (chr): the syllabary is the hard constraint

The engine tokenizes `[Ꭰ-Ᏽꭰ-ꮿ]` only, so a romanized numeral phonemizes to the empty string. Romanized
word lists are therefore useless unless the syllabary spelling is unambiguous — and Cherokee numeral
spellings genuinely vary between sources.

`languagesandnumbers.com` was **unreachable** from this environment for the whole investigation (repeated
`socket hang up` via WebFetch; curl with browser UA also failed). Its content was only ever obtainable
second-hand through search-result summaries — noted because it is normally the fallback source.

Breakthrough: the Cherokee Nation Language Department publishes **"Numbers 1 – 100 written in the Cherokee
syllabary"** as a PDF (`language.cherokee.org/media/nvafexqb/numbers.pdf`). Downloaded it; `pdftotext -layout`
interleaved the grid columns and produced garbage pairings, but `pdftotext -raw` gave clean reading order.

Wrote `chrverify.mts` to parse the PDF text and diff all 100 forms against the compositor. First run: 9
mismatches, all in the teens — off-by-one (`TEENS[n - 10]` should be `TEENS[n - 11]`, since 10 lives in
`UNITS`). Exactly the "table written as an array with holes" signature the spec warns about, caught only
because the check was mechanical rather than eyeballed. After the fix: **all 100 forms match byte-for-byte.**

Cross-check: Montgomery-Anderson, *A Reference Grammar of Oklahoma Cherokee* pp. 517–519 (ex. 52–55, citing
Pulte & Feeling 1975:228–229) — the repo's existing chr citation. Full PDF found and grepped. Agrees on every
romanization, and states the compound rule outright: *"The number words above twenty consist of the base ten
numeral followed by the single number."*

Two source disagreements recorded rather than resolved silently:

- The grammar's ex. 54 writes 21 UNCLIPPED (`thalskohi saakwuu`); the Nation's poster clips it (`ᏔᎵᏍᎪ ᏌᏊ`).
  The poster wins — it is syllabary-native and spells out all 79 compounds.
- 8 is `ᏣᏁᎳ` (poster) / `chaneela` (grammar), **not** the `ᏧᏁᎳ`/`tsunela` that Wiktionary and Omniglot give.
  Two independent sources beat one; the poster's 15 (`ᏍᎩᎦᏚ`) and 80 (`ᏁᎳᏍᎪᎯ`) likewise beat Omniglot's.

Neither the poster nor the grammar goes above 100. Hundreds/thousand came from Wiktionary (`ᏍᎪᎯᏥᏆ` 100,
`ᎢᏯᎦᏴᎵ` 1000) + Omniglot's 200–900 series. Noticed that Omniglot's hundreds are exactly ⟨tens word for N×10⟩
+ `ᏥᏆ` for 100–700, which also derives 100 correctly — so hundreds are generated that way, which additionally
resolves Omniglot's odd 800/900 roots in favour of the poster's. Disclosed as derived, not attested.

Negative result: no trustworthy modern word for 10⁶. The 1828 *Cherokee Phoenix* offers `ᎠᎦᏴᎵᏯ` but says it
"is not universally known", so ≥10⁶ falls back. The same *Phoenix* article documents an additive particle
`ᏫᏚᎾᏢᏗ` for readings like "one thousand and two hundred"; not emitted, since nothing modern corroborates
where it is obligatory.

---

## Run 4 — 2026-07-29 — K'iche' (quc): three corrections that would have been silent errors

Research handed over from a sub-agent (`KICHE_RESEARCH.md`) against ALMG, *Gramática Normativa del Idioma
K'iche'* §1.7.4, pp. 42–44. Three findings that contradict the obvious guesses:

1. **`much'` is 80, not 400.** `jumuch'` = 80; 400 is `juq'o`. Guessing would have put 400 in the 80 slot.
2. **The score series is not uniform** — `winaq` for 20/40, `k'al` for 60 and again for 100–380, `much'` for
   80, `q'o` for 400. A single `PREFIX + base` rule cannot generate it; it has to be tabled.
3. **100 is native** `jok'al` (5×20), not a Spanish loan.

On overcounting: Classical K'iche' had the Mayan "counting toward the next score" construction, but it applied
**from 41 up, not from 21** (21–39 were already additive; Dékány 2025:132, Yasugi 1995:104–105). Decisive for
the implementation: ALMG explicitly norms the additive form because its consulted elders did not recognise the
subtractive one — §1.7.4: *"ellos no lo conocen tampoco el conteo en forma sustractiva, por eso se norma que el
conteo es sumativa"*. So additive-only is not a simplification of convenience, it is the normative form, with a
quotable warrant. Classical overcounting is not generated; that is stated in the file header.

Also negative: **8000 is not attested in K'iche'** (`juchuy` 8000 is Kaqchikel; Christenson's `chuy` = 1000 is
a modern decimal reanalysis), and **zero has no ALMG attestation** (`majb'al` is a school/popular neologism).
Ceiling therefore 3999, with only the 1× and 2× `q'o` multipliers attested (`juq'o` 400, `kaq'o'` 800, and
1000 = `kaq'o' lajk'al` = 800+200). Multipliers 3–9 are extrapolated from the `k'al`/`much'` prefix pattern —
disclosed. Probe CLEAN.

---

## Run 5 — 2026-07-29 — Nahuatl (nci): a machine-checkable base-20 table, and the source has two bugs

Question: does Andrews (the g2p's source, §2) tabulate numerals? Answer: no — §2 is the orthography chapter,
and no numeral section was locatable. So the numeral data cannot honestly be cited to Andrews and isn't.

Found instead Wiktionary's `Module:number_list/data/nci`, which declares
`number_system = {id = "base20", power_base = 20}` and lemmatises 214 cardinal values: 1–50 individually plus
every round value on the 20 / 400 / 8000 / 160 000 / 3 200 000 / 64 000 000 grid, plus several long composites
verbatim. Fetched the raw Lua (1030 lines) and kept it as the check fixture.

Reading the table rather than guessing paid off twice:

- The joiner **changes at 400**. Below 400 the next word takes the prefixed linker `on-` (→ `om-` before a
  vowel or `m`): `cempōhualli oncē`, `cempōhualli ommahtlāctli`. From 400 up, groups are joined by the
  relational word `īpan`: `centzontli īpan cempōhualli oncē`. A single joiner would have been wrong for half
  the range.
- An 11–19 **multiplier** is expressed additively too: 220 is `mahtlāctli oncempōhualli` (10 scores + 1
  score), 4400 `mahtlāctli oncentzontli`, 104 000 `mahtlāctli omēxiquipilli`.

The powers turned out to be pure powers of twenty with compound magnitude nouns —
20¹ `pōhualli`, 20² `tzontli`, 20³ `xiquipilli`, 20⁴ `pōhualxiquipilli`, 20⁵ `tzonxiquipilli`,
20⁶ `pōhualtzonxiquipilli` — with the multiplier prefix series selected phonologically (labial `cem-, ōm-,
nāp-, chicuacem-…` before `p`-initial `pōhual`, plain `cen-, ōn-, nāuh-, chicuacen-…` before `t`/`x`). That
collapses the whole system to one positional loop.

Then wrote `nciverify.mts` to diff the compositor against **all 214** attested cardinals.

Result: **212 exact, 2 divergent — and both divergences are errors in the source, not in the compositor.**

- 580: source has `chiucnāppohualli`, a dropped macron; every other occurrence in the same file has
  `chiucnāppōhualli`.
- 60 000: source has `chicōnxiquipilli īpan mācuīltzontli`, which sums to 56 000 + 2 000 = **58 000**. 60 000
  needs `mahtlāctzontli` (4 000), which is what we emit.

That is the strongest corroboration of the five languages, and it only exists because the check was
exhaustive against a machine-readable source rather than spot-checked. Coverage runs to 20⁷ − 1 =
1,279,999,999; the round anchors 160 000 / 200 000 / 1 000 000 / 3 200 000 / 64 000 000 are all reproduced
verbatim, including 1 000 000 = `chicuacempōhualxiquipilli īpan mācuīlxiquipilli`. Above 160 000 the values
*between* the anchors are generated by the same rule — disclosed as generated. No attested zero; `ahtle`
'nothing' is a flagged stopgap.

---

## Run 6 — 2026-07-29 — Totontepec Mixe (mto): the thin one, and where it stops

First question: does Crawford 1963 — this engine's g2p source — document numerals? **No.** It is a phonology,
and `docs/investigations/mto/mto_native_bringup_investigation.md` already lists "numbers" among the deferred items in three separate
run entries. So Crawford cannot be cited here, and isn't. (Worth recording, since the brief hoped it would.)

Wiktionary has no `Totontepec Mixe numerals` or `Mixe numerals` category at all — empty. Schoenhals &
Schoenhals, *Vocabulario Mixe de Totontepec* (ILV, 1965) exists but no full text was reachable.

`languagesandnumbers.com` does have a **variety-specific mto page**, but as in Run 3 the host was unreachable
(WebFetch `socket hang up` on both the `/en/` and `/es/` URLs; curl with browser UA and HTTP/1.1 failed three
times). Its content was recovered only through search-result summaries — four separate targeted queries, each
returning a different slice of the page. Recorded as a real limitation: the table below was never read from the
page directly.

What came back, and it is enough for 1–999:

- scores alternate 20 / 20+10: `majc` 10, `ii'px` 20, `ii'pxmajc` 30, `vu̱jxtcupx` 40, `vu̱jxtcupxu̱cmajc` 50,
  `toogupx` 60, `toogupxu̱cmajc` 70, `majctupx` 80, `majctupxu̱cmajc` 90
- teens `mac-` + unit: `macto'c` 11 … `mactaxtojt` 19
- hundreds: multiplier + space + `mó̱cupx`, bare for 100
- composition, quoted: *"…the ten directly followed with the unit when the ten is a multiple of twenty (e.g.:
  ii'pxto'c [21], toogupxme̱jtsc [62]), and … where the word for ten (majc) is replaced by the number from
  eleven to nineteen when the ten is not a multiple of [twenty] (e.g.: ii'pxmacmó̱cx [35],
  majctupxu̱cmactojt [96])"*

The `u̱c` element is the interesting bit: it appears in 50/70/90 and in 96, i.e. between the 40/60/80 bases and
a following `majc`/`mac-` element, but **not** after `ii'px` (30 is `ii'pxmajc`, 35 `ii'pxmacmó̱cx`) and **not**
before a bare unit (62 is `toogupxme̱jtsc`). Encoded exactly that way; `mtocheck.mts` reproduces all five cited
composition examples plus the round table — 19 attested forms, all matching.

Three gaps recorded rather than papered over:

1. **The source's standalone units list is corrupt at 8** — it prints 9's form `taxtojtu̱c` for both 8 and 9
   (and repeats it for 800/900). Confirmed across four independent search retrievals, so it is on the page, not
   a summarizer artifact. Its TEENS *do* distinguish them (18 `mactodojt` vs 19 `mactaxtojt`), so standalone 8
   is **reconstructed** as `todojtu̱c` from the attested compound, by the same unit→teen relation that holds for
   6 (`tojtu̱c`/`mactojt`) and 7 (`vuxtojtu̱c`/`macvuxtojt`). Flagged in the header.
2. How a hundred joins a remainder (101, 555) is not stated; a space is used, matching the documented
   multiplier–hundred join. Not attested.
3. No attested zero. `sero` (Spanish *cero*, spelled with `s` because `c` is /k/ in this orthography) is a
   flagged loan stopgap, needed for "0" and for the digit-by-digit fallback.

Orthography note: the source uses the SIL practical orthography with `c` = /k/ and the UNDERLINE diacritic
(`u̱ o̱ e̱`), not the `ä ë ü ö` convention the engine header describes. Omniglot's mto alphabet corroborates that
this is current for Totontepec ("the letters b, f, k, l, ll, r, and z are used mainly or solely in Spanish
loanwords" — so native /k/ is `c`). The engine reads it, but it **strips the underline** (a disclosed residual,
absent from Crawford), so the central/back vowel quality those letters mark is not recovered — e.g.
`mó̱cupx` → /mokupʃ/. Transliterating to `ö/ü/ë` was rejected: the repo's own investigation says the underline's
value is unresolved, so that would be inventing phonology. Verified separately that all 101 distinct number
words phonemize to non-empty IPA (no silently dropped graphemes).

Attested range 1–999 — the source states outright that only 1–999 can be counted accurately. ≥1000 falls back.

---

## Result

| lang | system | attested range implemented | fallback begins | probe |
|---|---|---|---|---|
| qu | decimal | 0 … 999,999,999,999 | 10¹² | CLEAN |
| chr | decimal | 0 … 999,999 (1–100 verified against the source PDF) | 10⁶ | CLEAN |
| quc | vigesimal | 0 … 3,999 (0–399 high confidence) | 4,000 | CLEAN |
| nci | vigesimal | 0 … 1,279,999,999 (212/214 attested values exact) | 20⁷ | CLEAN |
| mto | vigesimal | 0 … 999 | 1,000 | CLEAN |

153 tests green across the five suites; `tsc --noEmit` clean.

Method note worth keeping: for chr and nci the mechanical diff against a machine-readable source (poster PDF /
Wiktionary Lua module) caught things reading would not have — an off-by-one in the chr teens, and two
arithmetic/typographic bugs in the nci source. Where no such fixture existed (mto), the honest outcome was a
much smaller range plus three explicit disclosures.
