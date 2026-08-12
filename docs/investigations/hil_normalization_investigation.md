# Hiligaynon / Ilonggo (hil) text-normalization investigation

## Run 0 — 2026-08-12 15:00 — the baseline, and the discovery that hil has no Wikipedia

**Commands**

```
npx tsx tools/normalization/review.ts --lang hil
npx tsx tools/normalization/sources.ts --lang hil
npx tsx tools/referee-eval/eval.ts hil
```

**Question.** What state is the language in, and where does its corpus come from?

**Raw finding.**

```
review    [FAIL] normalizer  src/languages/hiligaynon/normalize.ts missing        (expected — nothing written yet)
sources   [NONE] letter-names   espeak does not ship this language at all
          [NONE] decimal-point  no _dpt, no _., no manifest word
          every other class:  "no X in the corpus" / "the sign does not occur in the evidence"
          espeak: NOT SHIPPED · referee: 943 lines · corpus: NONE
referee   wikipron hil_latn broad (human, primary)   folded backbone 439/465 (94.4%)  symbol acc 99.0%
          kaikki hil (Wiktionary, human, secondary)  folded backbone 449/477 (94.1%)  symbol acc 98.8%
```

**⚠ THE CORPUS PROBLEM. There is no `hil.wikipedia`.** `dumps.wikimedia.org/hilwiki/` is 404 and
`hil.wikipedia.org` does not resolve at all. Confirmed against the authoritative list rather than inferred
from the 404 — `meta.wikimedia.org` `action=sitematrix` lists Wikipedias for **bcl, ceb, ilo, pag, pam, tl,
war** and **no `hil` site of any kind**. A 9-million-speaker language with six smaller Philippine neighbours
on the list and itself absent. There is no FLEURS `hil` either (`$FLEURS` unset here, and hil is not in the
FLEURS 102).

**Implication.** hil is a `cjy`/`hsn`-shaped language: its only running text is the **Wikimedia Incubator**,
which holds every incubating project in one wiki namespaced by title. The tooling already supports this —
`wikidump-to-text.py --title-prefix "Wp/hil/"` over the `incubatorwiki` dump, the route added on the hsn run
(and whose docstring, coincidentally, already uses `Wp/hil` nowhere — hsn is its worked example).

**And hil is far larger there than hsn was**: an incubator search for `prefix:Wp/hil/` reports **1,929
mainspace pages**, against hsn's 153. So unlike hsn this should yield a real artifact, not a token one.
Downloading `incubatorwiki-latest-pages-articles.xml.bz2` (191,749,395 bytes, dated 2026-08-04).

The two referees (wikipron 465, kaikki 477) are the real meter here, per the brief. Both baselines recorded
above; normalization must not move them, and any movement is a finding.

## Run 1 — 2026-08-12 15:10 — the corpus: Incubator `Wp/hil`, and the filter that had to be written first

**Commands**

```
python3 tools/normalization/wikidump-to-text.py incubatorwiki.xml.bz2 hil_paras.txt --title-prefix "Wp/hil/" --jobs 4
python3 tools/normalization/filter-by-language.py --lang hil --in hil_paras.txt --out hil_paras.hil.txt
npx tsx tools/normalization/mine.ts mine --in hil_paras.hil.txt --out tools/corpus/mined/hil.jsonc --lang hil \
    --segment paragraph --per-cell 6 --sample 40 --source "…"
```

**Question.** Is there enough Hiligaynon to write rules from, and is it Hiligaynon?

**Raw finding.** `pages seen 527854, paragraphs written 2343` → 3,799 unique segments. Wp/hil is a real
project (1,929 mainspace pages), two orders of magnitude bigger than hsn's 153.

`filter-by-language.py` needed a new `hil` row, and a new `CONTRAST` row — **hil's contaminant is not
English, it is TAGALOG and CEBUANO**, which share no function word with the stock English list. Result:

```
short 3904 (49.7%) · kept 3804 (48.4%) · dropped: contrast 77 (1.0%) · dropped: undecidable 78 (1.0%)
```

The 77 are real and worth naming: a whole **Tagalog** Che Guevara article ("naging kasapi si Guevara …
nag-aaral ng medisina … upang maharap niya"), English reference lists, and English lede sentences. So the
brief's warning is confirmed empirically — this wiki does carry Tagalog. ⚠ The marker list was pruned twice
after reading its own drops: `duha`, `tatlo`, `nila`, `didto`, `karon`, `lamang`, `gamay`, `tanang`, `usab`
were in the first CONTRAST draft and are ordinary **Hiligaynon**, not Cebuano-only. A contrast list built by
listing "Cebuano words" rather than "words Cebuano has and Hiligaynon does not" would have deleted the
corpus.

**⚠ THE CEBUANO WARNING APPLIES HERE IN A WEAKER FORM, AND IT IS STATED RATHER THAN IGNORED.** Wp/hil is
not bot-built, but it is heavily TEMPLATED: ~1,300 municipality stubs of one mould —
*"Ang X <ordinal> nga klase sang munisipalidad nga makita sa probinsya sang Y, Pilipinas. May N.NN kilometro
kwadrado ini nga kalaparon … Base sa 2024 census, ini may populasyon nga N,NNN."* That single template is
where most of the `decimals` and `grouped` counts come from, and every count below says so.

`covered 20/35 cells`. The 15 empty ones cannot be filled: `fetch --fill` needs a wiki and there is none.

## Run 2 — 2026-08-12 15:20 — what the engine does to those forms

**Command.** `phonemize` over the corpus's own strings.

| corpus form | count | current reading | verdict |
|---|---:|---|---|
| `populasyon nga 14,473` | **1,872** | *…napulo kag apat **,** apat ka gatos kag kapituan kag tatlo* | value destroyed by a clause PAUSE |
| `May 302.18 kilometro kwadrado` | **1,643** | *…tatlo ka gatos kag duha **.** napulo kag walo…* | pause mid-number |
| `2016 hasta 2022` | 20 | *…hasta…* ✓ | already correct — the word is WRITTEN OUT |
| `1910-1912`, `911–949`, `3.5–3.8` | 10 | two cardinals abutting, dash silent | no connective |
| `alas-5:00 sang aga` | 1 | *ʔalas lima **,** sero* | pause + a spurious "sero" |
| `4.4 porsiyento` | 2 | *ʔapat **.** ʔapat porsiyento* | pause mid-decimal |
| `12,706 km² (4,905 m²)` | 3 | *…**km**…**m*** | unit letters RAW in the IPA, `²` gone |
| `911–949 km2` | 1 | *…**km duha**…* | the ASCII exponent read as the NUMBER two (trap 37's `mm2`) |
| `59%`, `88%` | 2 | sign silent | DROP percent |
| `simbolo sang kurensiya: ₱` | 1 | sign silent | DROP currency |
| `ika-19 nga siglo` | 20 | *ʔika napulo kag siyam* ✓ | **the seam already works** (trap 16; ceb's `ika-20` note) |
| `ika-5ng Gobernador` | 2 | *ʔika lima **ŋ*** | a bare consonant emitted as its own word |
| `11° 09’ hasta 11° 09’ 42"` | 1 | degree + primes gone | a COORDINATE |
| `duha ka katatlo (2/3)` | 2 | *…duha tatlo* | two bare cardinals (the Uzbek `3/4` shape) |
| `ISO 20715:2023` | 2 | pause where the colon is | ⚠ **NOT a clock** — the adversary any clock rule must not claim |

**Implication.** Two rules carry 3,515 of the ~3,600 instances this layer will touch: de-grouping and the
decimal point. Everything else is single digits, which is honest for a 3,799-paragraph corpus and is quoted
as such.

## Run 3 — 2026-08-12 15:25 — sourcing, and why `attest.ts` cannot run here

**⚠ `attest.ts` IS UNAVAILABLE FOR THIS LANGUAGE.** It probes `<lang>.wikipedia.org`; hil has none. The
substitute is the Incubator's own CirrusSearch scoped with `prefix:Wp/hil/`, which was run for 12 words
before the API rate-limited (the hsn lesson: *a rate limit is a "wait", never an answer*). Its counts —
`hasta` 20 articles, `tubtob` 12, `punto` 1, `katatlo` 1, `porsiyento` 1, `porsyento` 1, `tuldok` 0,
`kapihak` 0 — **reproduce the dump exactly**, which is the useful result: the dump IS the whole of the
evidence, so nothing was gained by continuing and the probing stopped there.

**The second source is `HiligaynonDictionary[Kaufmann].pdf`** — Kaufmann's *Visayan-English Dictionary*
(Iloilo, 1934), 23,557 entries, 191,698 Hiligaynon words; the standard reference for this language and
independent of both the corpus and the referees. `pdftotext -layout`, then grepped. It settles the words the
corpus cannot:

```
púnto, (Sp. punto) Point, full stop, period; tone, tune, pitch, key, clef.
hásta, Until, etc. See ásta, túbtub.
túbtub, Until, till, up to, to, unto, as far
káda, (Sp. cada) Each. Káda isá. Each …
óras, (Sp. hora) Hour; time. (cf. táknà)
métro, (Sp. metro) Metre, (39.37 inches)
grádo, (Sp. grado) Grade, class, degree
katungâ, Half, one half, moiety          kapíhak, Half, one half, moiety
ikaduhá, (H) Second.                     ikagatús — hundredth
gatús, Hundred; century. … Napúlò sa gatús. Ten per cent.
kúbo, (Sp. cubo) THE HANDLE OF A CHISEL        ← not the cube
ónse, (Sp. once) Eleven. Sa las ónse. At eleven.
```

**Findings that change rules.**

- **The decimal word is `punto`, and it is DICTIONARY-SOURCED here, not inferred.** Kaufmann glosses it
  "Point, full stop, period" — the punctuation sense, in Hiligaynon, from the standard reference. Cebuano
  shipped the same word on the weaker "a written corpus cannot say how a symbol is spoken" argument; hil
  does not have to. The corpus's single `punto` is *"pinakamataas nga punto"* (the highest POINT of Negros),
  the same sense, different application — consistent, and not a counter-example.
- **The range word is `hasta`, and it is written out 20 times BETWEEN DIGITS** (`2016 hasta 2022`,
  `6,000 hasta 7,000`, `395 asta 1453`, `2 hasta 3`), with `tubtob` ×13 and `asta` ×7 beside it. This is the
  strongest form of attestation there is — the corpus spells the reading next to the digits. ⚠ **Cebuano's
  `ngadto sa` is ×0 in hil.** First ceb rule that does not survive re-measurement.
- **⚠ `tunga` DOES NOT MEAN "HALF" IN HILIGAYNON — trap 37, caught before it shipped.** Cebuano reads `1/2`
  as `tunga`. hil's 21 `tunga` instances are ALL the preposition *"sa tunga sang X kag Y"*, "in the middle
  of/between" (`sa tunga sang Puławy kag Lublin`, `sa tunga sang mga atomo`). The half word is **`katungâ`**
  (Kaufmann), whose 2 corpus hits are the place-name element *Katunga-anang Sidlakan*. Copying ceb's rule
  would have read every `1/2` as "in the middle".
- **⚠ THERE IS NO CUBE WORD, and the plausible one is a chisel handle.** `kubiko` ×0 in the corpus;
  Kaufmann's `kúbo` is *"(Sp. cubo) The handle of a chisel"*. Trap 37 in its cleanest form — a healthy-looking
  Spanish loan that is a different word. `cubed` is left undeclared, exactly as ceb left it.
- **The squared word is `kwadrado` ×1,661** (`kuadrado` ×67, `kuwadrado` ×1), always AFTER the noun
  (`kilometro kwadrado`). The best-attested content word in the corpus.
- **The percent word is attested TWICE, digit-adjacent, and the spellings TIE** — `4.4 porsiyento` ×1 and
  `23 porsyento` ×1, both in unambiguously Hiligaynon sentences (*ginasakup sang Panay*, *kun sa diin …
  naghalin*). Kaufmann predates the loan and has neither; it gives the native frame instead
  (`Napúlò sa gatús`, "ten per cent"). ⚠ The web search for this word returned **Tagalog** dictionaries
  almost exclusively — precisely the substitution the brief warns about — so the choice rests on the two
  Hiligaynon corpus instances, not on those.
- **The currency word is `piso`** — corpus ×6 including a monetary use (*ang suplay sang piso sa Pilipinas
  nag-abot 569.2 bilyon*), Kaufmann `písos`. ⚠ **`$` is DECLINED**: `$` is ×0 in the corpus and `dolyar` /
  `dolar` are ×0 in the corpus, ×0 in Kaufmann and ×0 in both referees. ceb declares `$`→`dolyar` on ×4
  corpus hits; hil has none, so it does not. Second ceb rule that does not survive.
- **The referees cannot source vocabulary.** Every candidate word above scores 0 in both
  `hil.wikipron-hil-broad.tsv` and `hil.kaikki-hil.tsv` except `libo` and `dugang` (×1 each). They are
  proper-noun-heavy word→IPA lists; they are the meter, not the dictionary.

## Run 4 — 2026-08-12 15:28 — the layer, and the before/after on every gate

**Commands**

```
npx tsx tools/normalization/corpus-diff.ts emit --lang hil --corpus mined:hil --out hil.before   # BEFORE editing
…write src/languages/hiligaynon/normalize.ts, wire it into hiligaynon.ts…
npx tsx tools/normalization/corpus-diff.ts emit --lang hil --corpus mined:hil --out hil.after
npx tsx tools/normalization/corpus-diff.ts compare --before hil.before --after hil.after --corpus mined:hil
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/hil.jsonc --lang hil
npx tsx tools/referee-eval/eval.ts hil    ·    npx tsx tools/normalization/review.ts --lang hil
python3 tools/language-catalogue/derive-normalization.py && python3 tools/language-catalogue/build.py
```

**Question.** Do the rules fire, and does anything else move?

**Raw finding.**

```
corpus-diff   changed 87/132 (65.9%)
              before  { DIGIT:0, SLOT-GAP:0, RAWMARK:0, DROP:8, THROW:0 }
              after   { DIGIT:0, SLOT-GAP:0, RAWMARK:0, DROP:3, THROW:0 }
scan          before  DROP math-sign ×3 · ampersand ×2 · degree ×1 · percent ×1 · currency ×1 · exponent ×1
              after   no defects   (ACCEPTED-CLASS math-sign ×3, degree ×1; REDUNDANT currency ×1)
referee       wikipron 439/465 (94.4%) 99.0% → 439/465 (94.4%) 99.0%   IDENTICAL
              kaikki   449/477 (94.1%) 98.8% → 449/477 (94.1%) 98.8%   IDENTICAL
review        4 FAILING → 0 FAILING (all ten checks ok)
vitest        3739 passed / 1 failed → all pass after regenerating the catalogue
tsc           clean
```

**All 87 changes were read individually, and every one is a repair.** The classes:

- 44 × de-grouping (`14,473` → *…apat ka libo kag apat ka gatos…*, was *…apat , apat ka gatos…*)
- 38 × decimal (`302.18` → *…duha punto isa walo*, was *…duha . napulo kag walo*)
- 8 × range → `hasta`, including three inside one sentence (`(1853 - 3 Nobyembre 1913)`, `ika-5ng`, `(1910-1912)`)
- 2 × ampersand → `kag`, 2 × percent → `porsiyento`, 1 × `Dr.` → `Doktor`, 1 × `ika-5ng` → `ika-5 nga`
- 4 × unit/exponent: `km`/`m` raw letters → `kilometro`/`metro`, and `km²`/`km2` → `… kwadrado`
- `11,000,000` was reading *isa isa , sero , sero*; it now reads *napulo kag isa ka milyon*

**Nothing regressed.** The 45 unchanged utterances are unchanged, and no change in the 87 introduced a
defect class. ⚠ The referee being byte-identical is the expected result and is recorded as a NEGATIVE
control, not as a success: this layer touches digits and signs, and the referees are word→IPA lists with no
digits in them. A referee that MOVED here would have meant the layer was rewriting ordinary words.

**⚠ Two rules were deliberately narrowed after measuring their adversary, and both would have been net
negative otherwise.**

- **The clock is guarded on `alas`.** The corpus has three `\d{1,2}:\d{2}` matches: ONE clock
  (`alas-5:00 sang aga`) and TWO copies of `ISO 20715:2023`, inside which an unguarded rule matches
  `15:20`. A ceb-shaped bare-colon rule would have fixed 1 and broken 2. Trap 9 also says not to widen a
  guard for a shape you have not counted, so the "part of day follows" alternative that ceb licenses is NOT
  admitted here: `9:30 sang aga` is ×0 in this corpus.
- **The decimal rule caps the fractional part at two digits.** Measured: 398 one-digit, 1,244 two-digit,
  and exactly ONE three-digit — which is `populasyon nga 17.865 ka pumuluyo`, a GERMAN town's population
  written with the German thousands convention. The cap admits every real decimal and refuses the one
  number that is not one. Pinned as a test.

**Ordering that is load-bearing, and why.**

1. de-group → 2. clock → 3. shared tier → 4. ranges → 5. decimals → 6. dotted abbrevs → 7. `ika-Nng`.

- **The tier must be ABOVE the decimal rule**, twice over: the "units before decimals" coupling (rewriting
  `4.4` destroys the number-unit adjacency the tier matches on), and — the sharper one — bare `m` is a
  declared one-letter unit key, so `NOT_VERSION` has to still be able to SEE the dot in `802.11m`. That is
  traps 39/46, and it is pinned as a test the corpus does not contain (`version-dot` is ×0 here).
- **Ranges must be ABOVE the decimal rule**, which is where this file departs from ceb's order. The corpus
  writes `3.5–3.8 bilyon ka tinúig`. With decimals first the text reads `3 punto 5–3 punto 8` and the range
  rule claims `5–3`, emitting *lima hasta tatlo* — a backwards span inside a number. Ordered this way the
  operands are still whole.

## Run 5 — 2026-08-12 15:30 — what was declined, with counts

Every refusal below is a measurement over the same 3,799 paragraphs, recorded in `ACCEPTED_SIGN_SILENCE`
so it is re-runnable rather than remembered:

| class | count | why |
|---|---:|---|
| minus | **0** | the shape has no instances at all; all 10 digit-flanked dashes are ranges and ARE read |
| plus | 1 | a Greek etymology gloss (`arkhi-, lider + tekton`) — and that paragraph is part Tagalog |
| equals | 1 | `buttonlabel=…`, MediaWiki `<inputbox>` markup residue |
| ± < > × ÷ | **0** each | absent from the corpus entirely |
| degrees | 4, one sentence | a geographic COORDINATE (`11° 09’ hasta 11° 09’ 42"`). ⚠ refused on SENSE, not absence: Kaufmann HAS `grádo` |
| `$` `€` `£` `¥` | **0** | and `dolyar`/`dolar` are ×0 in corpus, ×0 in Kaufmann, ×0 in both referees |
| fractions | 2 | both in ONE sentence by one writer; no denominator series exists to compose from |
| cubed | 0 | `kubiko` ×0, and Kaufmann's `kúbo` is "the handle of a chisel" |
| `Rev.` / `Inc.` | 3 / 5 | `reberendo` ×0 everywhere; both already read as pronounceable tokens, so only the pause is lost |
| the clock's REGISTER | 1 | Kaufmann's `Sa las ónse` shows the hour takes the SPANISH numeral (*alas singko*, not *alas lima*), and no Spanish 1–12 paradigm is sourceable for hil |

**Negative results worth keeping.**

- **`beses` is not the multiplication word.** ×2, and both are "three times he SERVED as President" — the
  iteration sense. Trap 37's shape: a real word with a healthy-looking count in the wrong sense.
- **`dugang` is not the plus word for hil**, though it is Cebuano's. ×3, all the adjective "additional"
  (`ang dugang nga sugpon`), never digit-adjacent as an operator.
- **`katumbas` is not the equals word.** ×1, the adjective "equivalent".
- **`menos` is not a minus.** ×1, inside the Spanish adverbial `mas o menos 23.9 ka milyon`.
- **`punto` in the corpus is a geographic peak**, not a decimal separator — which is why the ruling word
  came from Kaufmann and not from a corpus count.

**The tally against the sibling: four of Cebuano's rules did not survive re-measurement** (the range word,
the `1/2` word, `$`→`dolyar`, and `dugang` for `+`), and a fifth — the clock's disambiguator — had to be
inverted from "a part-of-day follows" to "`alas` precedes". What did survive: the English-convention
grouping/decimal split, `punto`, `kada`, `porsyento`-family, `kwadrado`, the closed dotted-abbreviation
list, and the observation that the `ika-` ordinal seam already works and must be left alone.

**⚠ ONE THING THAT COULD NOT BE DONE, STATED AS A LIMIT.** `attest.ts` has no wiki to probe for hil, and
the Incubator API rate-limits after ~12 queries. So there is no independent second corpus behind any
finding here — only the dump and Kaufmann. Where those two disagree the dictionary was preferred for a
SYMBOL's reading (`punto`) and the corpus for a modern loan (`porsiyento`), and each choice says which and
why at the point of use.
