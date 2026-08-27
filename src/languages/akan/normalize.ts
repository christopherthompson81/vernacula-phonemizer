/**
 * Akan / Twi (ak) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR AKAN, AND ak.wikipedia IS LOCKED. Its whole extract is one paragraph, and that
 * paragraph is the lock notice ("To contribute, please go to Twi Wikipedia or Fante Wikipedia"). So the
 * evidence is the two VARIETY wikis, both of them Akan and both served by this engine under `ak`:
 *
 *     tw.wikipedia   Asante/Akuapem TWI — 27,415 paragraphs / 9.4 MB after filter-by-language.py
 *     fat.wikipedia  FANTE             —  9,029 paragraphs / 3.0 MB after the same filter
 *
 * plus `tools/corpus/mined/ak.jsonc`, mined from both. Every count below says which variety it is from,
 * because the two differ in orthography, in vocabulary and — as the terms file records — in every single
 * month name. Where a rule rests on TWI evidence alone the comment says so. `akan.jsonc`'s numerals are
 * the Asante series, so Twi is the variety this engine actually implements.
 * Full log: `docs/investigations/ak_normalization_investigation.md`.
 *
 * ⚠ AND THE CORPUS IS CODE-MIXED. Both wikis carry English organisation names, English citation furniture
 * and whole English passages (4.3% / 7.9% of paragraphs, dropped before mining), so a raw count is a lead
 * about the FILE and every number quoted here was read back to its instances. Where a class is
 * English-text-only the comment says so.
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — this is the defect list, measured:
 *
 *     n'awofoɔ / w'ate → n awʊfwɔ  /  w ate            a BARE CONSONANT as a word (×4930 tw + 2664 fat)
 *     49.6%            → adwanan ŋkron . nsia          the sign is SILENT; the point is a PAUSE
 *     16,083           → du nsia , adwɔwɔt͡ɕʷɪ mmiɛnsa   grouping comma → a PAUSE and a wrong number
 *     3.038.217        → …a SENTENCE BREAK per group   dot grouping (×28 tw)
 *     3 500 nnipa      → mmiɛnsa ahanum nnipa          space grouping → two separate numbers
 *     1.8              → baako . ŋʷɔt͡ɕʷɪ                decimal dot → a SENTENCE BREAK
 *     1989-1997        → two cardinals, no connective   (×1125 tw + 264 fat bare pairs)
 *     12 km  /  5 kg   → du mmienu km  /  nnum kɡ      the abbreviation reaches the IPA raw
 *     $10,000 / GH₵50  → …  /  ɡh adwonum              the currency sign is silent
 *     U.S.A. / A.Y.B.  → u . s . a .  /  a . j . b .   three spurious clause breaks each
 *     24th February    → adwonu nnan th febrwarj       the ordinal suffix letters reach the IPA
 *     S&P              → s p                           the ampersand is silent
 *
 * ⚠ THERE IS NO ENGLISH FOREIGN-WORD READER, and every rule below is written for that fact. `registry.ts`
 * used to build this language as `createAkan((latin) => getPhonemizer("en").text(latin))` while
 * `createAkan`'s body never referenced the argument; the wiring has since been removed rather than
 * connected, because Akan is Latin-script — `TOKEN` claims every Latin run and `phonemizeWord` always
 * answers, so there is no unclaimed run for a reader to take. An unrecognised run is therefore read as
 * AKAN-ish gibberish (`February` → *febrwarj*), NOT as a plausible English word, which is the better
 * failure for this layer: a defect that sounds English hides, and one that sounds like gibberish gets
 * reported. Probed before writing any rule here, because it decides what a defect looks like when it hides.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO MINUS WORD, AND THIS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE. Omitting a plus is lossless;
 *   omitting a minus INVERTS. All 39 leading minuses in tw read back as EN-DASH RANGES (`1862 –1961`,
 *   `35 –40 m`, `14 – 28 mm`), which step 8 claims, plus the coordinate pair
 *   `6.28ɛ°N 1.850°W / 6.28ɛ; -1.850`. That coordinate is a genuine negative and no Akan word for one is
 *   attested anywhere. ⚠ SO IT IS NOT IN `ACCEPTED_SILENT` EITHER, and `review.ts --lang ak` stays red on
 *   it: an accepted silence claims the drop is correct, and this one is not. The gate comes green the day
 *   an Akan negative-number word is attested, not before. (The ln and bm precedent.)
 *
 * ⚠ NO DEGREE WORD AND NO SCALE NAMES, so `°C` (×103 tw + 24 fat) still loses its sign and reads its C as
 *   a bare [k]. `Celsius` ×1 and `Fahrenheit` ×2 are leads, not findings. The 354 tw + 353 fat hits for
 *   *degree* are the ACADEMIC degree — "Master's degree", "bakyela degree wɔ Law" — which is trap 37 with
 *   a count healthy enough to be convincing. `sources.ts` agrees: `[NONE] scale-names`.
 *
 * ⚠ NO SQUARE/CUBE WORD, so step 4 REFUSES a unit key followed by `2 3 ² ³`. `km²`/`km2` (×26 tw + 25 fat)
 *   therefore reads exactly as it did before rather than becoming a confidently wrong LENGTH — reading
 *   `km²` as *kilomita* would state an area as a distance, which is worse than the raw letters.
 *
 * ⚠ NO INITIALISMS AS LETTER NAMES. `core/initialisms.ts` exists and ~30 languages wire it, but it is a
 *   NO-OP without a `letterName` table and `sources.ts` reports `[NONE] letter-names — espeak does not
 *   ship this language at all`. That is the fleet-wide sourcing block, not a coding one (trap 16 checked:
 *   the seam exists, the DATA does not). Step 7 therefore only removes the DOTS from `U.S.A.`, which is a
 *   pause defect, and leaves the reading of the letters exactly where it was.
 *
 * ⚠ NO ERA EXPANSION. `A.Y.B.` (BC) ×155 tw + 25 fat and `Y.B.` (AD) ×43 + 13 are Akan's own era markers
 *   ("wɔ mfirihyia apem a ɛto so abien A.Y.B.", "afeha a ɛto so 3 Y.B."), but the expansion is not in the
 *   corpus: `ansa na Yesu mmae` occurs ONCE and not beside the abbreviation. Trap 37 — the bare phrase is
 *   never the attestation. Step 7 removes their interior dots and nothing more.
 *
 * ⚠ NO CLOCK. 68 tw + 9 fat colon-numerals and the majority are not clocks: sports times (`1:30.00`,
 *   `1: 43.55`), a UTC offset (`UTC+14:00`), map scales (`1:50,0000`), scripture (`1 Petro 4:16`). Two or
 *   three are real (`wui wɔ 13:38`, `awia 5:30`), and no Akan reading of a digital time is attested.
 *
 * ⚠ NO FRACTIONS. `n/n` ×119 tw + 47 fat, and reading them shows UN resolution numbers (`60/147`,
 *   `64/292`), slash DATES (`12/01/2008`, `29/02/1952`) and disability-sport classes (`LW 10/11`) —
 *   one genuine fraction in the sample. `sources.ts`: `[NONE] fraction-series`.
 *
 * ⚠ NO `= × +`. `=` ×108 tw is mostly `==` heading residue that survived extraction plus linguistic
 *   glosses; `×` ×19 is a botanical hybrid (`Citrus × latifolia`) or a relay dimension (`mita 4 × 100`),
 *   which is "by" and not "times"; `+` ×18 is `Senegal + Liberia`, `pseudo + epistaxis`, `UTC +14:00`.
 *   Never arithmetic, in any of the three.
 *
 * ⚠ NO `€` OR `£` READING, and this is trap 37 with a very healthy count. `euro`/`yuro` scores 784 in tw
 *   — and the overwhelming majority are the FOOTBALL tournament (`UEFA Mmea Euro 2017`, `2009 U-17 Euro`)
 *   or the continent (*Europa*); exactly two sit in a money slot. `pound` ×12 is mostly `Ghana Pound`, the
 *   historical currency, and the loan *paunch*. So `€` (24 tw) and `£` (31 tw) stay unread while `$` and
 *   `₵` are spoken at step 6 — a split verdict from one probe run is a real verdict.
 *
 * ⚠ NO `No.` RULE, and this one was a near miss. `\bNo\.\s?\d` counts 51 in tw; reading them shows almost
 *   every one is the Akan definite article `no` ENDING A SENTENCE before a numbered list item ("… mu no.
 *   2. Akanfoɔ yɛ nhwehwɛmu…"). Claiming it would delete a real pause. Trap 2, caught by reading.
 *
 * ⚠ NO CHANGE TO THE NUMBER PATH, on a measurement rather than an omission. This corpus GLOSSES its own
 *   figures ("afe apem ahankron ne aduokron nsia (1996)"), which yields 2,533 glosses over 459 distinct
 *   numbers — an accidental referee for `numberWords`. Of the 179 comparable, 43 match exactly and 62
 *   differ ONLY by the connective `ne` before the final sub-hundred group. `ne` is the majority
 *   (hundreds+ne+tens 1441 vs hundreds+tens 565) but not the only attested form, and for several years the
 *   no-`ne` gloss is the plurality (1958 ×7 vs ×4, 1978 ×8 vs ×4, 1991 ×11 vs ×7, 1943 ×3 with none). The
 *   engine's output is therefore an attested VARIANT, not a defect, and this layer does not churn a
 *   committed golden to swap one for the other.
 */
import { makeBareUnitNormalizer } from "../../core/normalizeSymbols.ts";

/** ⚠ TWI-SOURCED, and the Fante form differs. `akyiri pɔ` is the decimal point ×1,137 in tw and ×1 in fat;
 *  Fante writes `ekyir pɔw` ("nyaa ɔha nkyekyɛmu esia na n'ekyir pɔw eduowɔtwe"). Every instance sits
 *  between the integer and fractional words of a figure the same sentence also writes in digits, which is
 *  attestation in exactly the slot — the source document glossing itself. Spelling variants in tw:
 *  `akyiri pɔ` 355, `akyirepɔ` 347, `akyiripɔ` 243, `akyire pɔ` 60, `akyire po` 46, `akyirepɔn` 24; the
 *  ⟨i⟩ family (631) outnumbers the ⟨e⟩ family (477) and `akyiri pɔ` is the single commonest form. */
const POINT = "akyiri pɔ";

/** PERCENT, and it is PREPOSED — every one of the instances read puts the word before the figure
 *  ("ɔha mu nkyekyɛmu 49.6%", "ɔha nkyekyɛmu 44.6%", "ɔha mu nkyekyɛmu 75.3%"). The family counts 1,387 in
 *  tw and 215 in fat, so unlike the decimal word this one is attested in BOTH varieties; `ɔha mu
 *  nkyekyɛmu` is the plurality spelling across the two (437). ⚠ The 24 tw hits of a percent-shaped word
 *  AFTER the sign are `25% ɔhaw` — *ɔhaw* is "chance/risk", a different word (trap 2). */
const PERCENT = "ɔha mu nkyekyɛmu";

/**
 * The percent word AS THE CORPUS ALREADY WRITES IT, for the redundancy test below — every spelling of the
 * family counted in Run 4, folded into one pattern (`ɔha`/`ɔhamu`/`ɔha mu` + `nkyekyɛmu`/`nkyekyɛm`/
 * `nkyekyemu`/`nkyekyem`/`nkyekyɛ`).
 */
const PERCENT_WRITTEN = String.raw`[ɔoO][hH]a\s?(?:mu\s?)?nkyeky[ɛeɔ][ɛem]?u?`;

/**
 * A REDUNDANT SIGN IS A PERMISSIBLE DROP — say it once, in the position the language puts it (trap 12).
 *
 * This corpus writes the percent word AND the sign in the same breath, because the sentence spells the
 * figure out and then gives it in digits: "ɛgyina hɔ ma ɔha mu nkyekyɛmu aduasa mmienu akyiripɔn aduasa
 * (32.30%)", "a ɔkyerɛ ɔha mu nkyekyɛmu 58.99%". Measured over the two dumps, **893 of the 5,154 percent
 * signs (17.3%) already have the word in front of them** — 170 of those immediately adjacent, the rest
 * with the spelled numeral in between. Without this test the reading says *ɔha mu nkyekyɛmu* twice.
 *
 * The window is 60 characters and the intervening text may contain no other `%` and no sentence break, so
 * the word being tested is the one belonging to THIS figure rather than a previous sentence's.
 */
function alreadyPercented(before: string): boolean {
    return new RegExp(`${PERCENT_WRITTEN}[^%.!?]{0,60}$`, "u").test(before);
}

/** RANGE CONNECTIVE. `N kosi M` ×569 in tw (`kosi` 423, `kɔsi` 127, `kɔpem` 30, `kosii` 15) and ×150 in
 *  fat (`kesi` 88, `kɛpem` 42, `kosi` 43). PART OF SPEECH CHECKED, which is the Fula `hakkunde` lesson: it
 *  is used as an INFIX between the two operands — "fi afe 2017 kosi 2022", "fri afe 2005 kosi 2007" — and
 *  316 of the 569 follow an explicit *fi/firi* ("from"), leaving **253 bare**, so the infix does not
 *  depend on the preposition being present. `kosi` is also the form both varieties share. */
const TO = "kosi";

/** UNITS — a missing KEY, not a missing word (trap 38). One tw sentence glosses the abbreviation against
 *  the word: "Park no yɛ 24 kilomita fi Damongo, ɔma ntam ahenkurow no, 146 km wɔ Tamale". `kilomita` ×178
 *  tw + 59 fat, `mita` ×358 + 94. The unit is POSTPOSED after a figure written in digits ("ɛbɛyɛ 10
 *  kilomita", "24 kilomita fi Damongo"), which is the order this rule emits; the corpus also writes the
 *  noun-first order with a spelled figure ("yɛ mita 14.94"), and that shape needs no rewriting.
 *
 *  ⚠ EVERY WORD HERE WAS CHECKED IN THE CORPUS BEFORE IT WAS WRITTEN, and one of the five was wrong on the
 *  first pass: the Twi form is `sɛntimita` (×91 tw), not the `sentimita` an outsider would compose (×2).
 *  `milimita` ×10, `kilogram` ×14 — and `kg`'s attestation is the strongest of the lot, because one
 *  sentence glosses the abbreviation against the word: "ne mu duru nso bɛyɛ sɛ kilogram no aduosia num
 *  (65kg)". Digit-adjacent counts: km 76 tw + 8 fat, m 81 + 21, cm 54 + 3, mm 29 + 3, kg 9 + 0.
 *
 *  ⚠ NO `s`, `g`, `h`, `t`. They are not attested as units after a numeral here, and `10.42s`/`21.45s` are
 *  athletics SECONDS in a corpus with no seconds word — declaring a bare `s` would additionally make every
 *  English plural after a number a measurement (the `Il-76s` failure). `cm`/`mm`/`kg` are in despite their
 *  small counts because their raw readings are impossible clusters ([kɡ], [km]) rather than merely wrong. */
const UNITS: readonly (readonly [string, string])[] = [
    // Longest key first, so `km` cannot be claimed by a hypothetical shorter one and `mm`/`cm` are tried
    // before the bare `m`.
    ["km", "kilomita"], ["cm", "sɛntimita"], ["mm", "milimita"], ["kg", "kilogram"], ["m", "mita"],
];

/**
 * THE SQUARE-MEASURE WORD — and it is written here because the refusal the header used to record was a
 * SOURCING gap that has since closed, not a permanent one.
 *
 * ⚠ THIS IS THE WHOLE OF ak's RAW-LATIN LEAK. The `RAW-LATIN` scan reports `km ×7` over ak's artifact
 * even though `km` is declared and read correctly everywhere else, and every one of those hits is
 * `km²`/`km2`: the artifact writes the abbreviation 19 times, 8 of them squared, and the 11 bare ones all
 * read *kilomita* already. So the leak was never a missing KEY — it was step 4's deliberate refusal to
 * read a unit before an exponent, standing in for a word nobody had found. Worth stating for the fleet:
 * a declared unit that still reports is a signal to look at the exponent, not at the table.
 *
 * ⚠ AND THE WORD IS GLOSSED AGAINST THE SYMBOL BY tw.wikipedia'S OWN km² ARTICLE, which is the strongest
 * shape of evidence this repo recognises: *"Kilomita ahinanan, agyiraehyɛde km2, yɛ beae a wɔsusuw"* —
 * "square kilometre, symbol km2, is an area that is measured" — and, two sentences on, *"ahinanan a
 * n'afa horow tenten yɛ 1 no kɛse km yɛ kilomita ahinanan biako"*. `attest.ts --lang ak --wiki tw` puts
 * it at 20 tokens / 6 articles; the fat wiki uses it in running text in the measure slot — *"kilomita
 * ahinanan 77,360 (akwansin ahinanan 29,870)"*, *"kilomita 9,130 ahinanan"*, *"akwansin 2,000 ahinanan
 * (5,200 km2)"*, *"kilomita asia ahinanan"*.
 *
 * ⚠ THE WORD FOLLOWS THE UNIT NOUN, which is what those instances agree on even though they disagree
 * about where the FIGURE goes (`kilomita ahinanan 77,360` against `kilomita 9,130 ahinanan`). This layer
 * already emits the figure first on its own attested grounds (see UNITS), so the arm below appends the
 * modifier to the unit word and leaves the numeral where this file's own evidence puts it.
 *
 * ⚠ NO CUBE WORD STILL. `km³`/`m³` is ×0 in this artifact and nothing attests a cubed modifier, so step 4
 * keeps refusing `3`/`³` exactly as before. The header's refusal is narrowed, not deleted.
 */
const SQUARED = "ahinanan";

/** THE SAME SYMBOLS STANDING ALONE. Every arm of step 4 needs a numeral, so a bare `km` — a caption, a
 *  table header, or a figure whose numeral a bracket or an `&nbsp;` put out of reach — went to the phoneme
 *  sink as raw ASCII, which in a Latin-script language no leak gate can see. The guards are the shared
 *  ones (core/normalizeSymbols.ts): multi-letter vowel-free keys only, so `m` is untouched and the trap-46
 *  hazards above are unaffected; exact case; and never beside a numeral, a rate slash or an exponent. */
const BARE_UNITS = makeBareUnitNormalizer(UNITS);

/** CURRENCY, PREPOSED — the corpus writes the currency noun in front of the amount: "dɔla 10,000",
 *  "U.S. dɔla ɔpepem 2.3", "Canada dɔla ɔpepem 481", "sika a ɔkɔr mu no bɛyɛ sidi 51,000". `dɔla` ×125 tw,
 *  every hit read a genuine money slot. `€` and `£` are declined — see the header.
 *
 *  ⚠ THE CEDI IS SPELLED `sidi`, NOT `cedi`, AND THE ENGINE IS WHAT DECIDES THAT. Both spellings are in
 *  the corpus — `cedi` ×25 tw + 1 fat, `sidi` ×6 + 5 — and `cedi` is the commoner of the two, but ⟨c⟩ is
 *  NOT AN AKAN LETTER: `phonemizeWord("cedi")` falls through every rule to `latinPhone` and comes out
 *  **[kedi]**, a word this layer would have put in the speaker's mouth. A/B'd through the engine, which is
 *  the xh/zu `plas`-vs-`plus` method: `sidi` → [sidi], which is the currency's actual name. And `sidi` is
 *  attested in exactly this slot and sense, not merely available — "Ghana sika sidi ebien", and a list of
 *  the banknote denominations, "sidi ahodoɔ 50, 200, 100, 500, ne 5000 a Ghana Sikakorabea …". (Some
 *  `sidi` hits are the personal name Sidi/Sidik; the money-slot ones are what this rests on.)
 *
 *  ⚠ `GH₵`/`GHC`/`GHS` is the same sign with its ISO prefix and must be tried BEFORE the bare `₵`, or the
 *  `GH` is left stranded to be read as a two-letter word ([ɡh] today). */
const CURRENCY: readonly (readonly [string, string])[] = [
    ["GH₵", "sidi"], ["GHC", "sidi"], ["GHc", "sidi"], ["GHS", "sidi"], ["₵", "sidi"],
    ["US\\$", "dɔla"], ["\\$", "dɔla"],
];

/** A NUMBER OPERAND that ends in a digit. ⚠ The trailing `\d` is not decoration: a class like `[\d.,]*`
 *  also swallows a following CLAUSE comma or sentence period, which is harmless while a rule writes `$1`
 *  back out and silent data loss the moment it writes words around it (trap 14's Welsh hazard). */
const NUM = String.raw`\d+(?:[.,]\d+)*`;

/** Not inside a word — `\p{M}` beside `\p{L}` because a guard written for an alphabet is blind elsewhere
 *  (trap 23), and never `\b`, which is ASCII-defined (trap 1). */
const NL = String.raw`(?![\p{L}\p{M}])`;
const NLB = String.raw`(?<![\p{L}\p{M}])`;

/**
 * HOMOGLYPHS FOR AKAN'S TWO NON-ASCII VOWELS — a DELETION, and the same defect Bambara's layer names, in a
 * language nobody had read for it. Found by `silentCharsIn` (⟨ε⟩), then by a full non-ASCII census of the
 * artifact (⟨כ⟩, which the detector cannot see — see the last warning below).
 *
 * Akan needs ⟨ɛ⟩ U+025B and ⟨ɔ⟩ U+0254, neither of which is on an ordinary keyboard. A census of every
 * letter in the mined artifact that is neither ASCII nor Akan's own says which look-alikes the wiki's
 * writers reached for instead:
 *
 *     ɛ U+025B  2771  ← correct        ε U+03B5 GREEK SMALL LETTER EPSILON   164
 *     ɔ U+0254  3088  ← correct        כ U+05DB HEBREW LETTER KAF             70
 *
 * ⚠ THE READING IS UNAMBIGUOUS IN EVERY INSTANCE, checked against the corpus rather than inferred from the
 * code chart. For ⟨ε⟩: `yε` `sε` `deε` `kεseε` `mmerε` `εkwan` `εnti` `εfiri` are yɛ, sɛ, deɛ, kɛseɛ,
 * mmerɛ, ɛkwan, ɛnti, ɛfiri — every one an ordinary Twi word whose ⟨ɛ⟩ spelling occurs in the SAME
 * artifact (`ɛmmerɛ` ×2 beside `mmerε` ×2). For ⟨כ⟩: `כhene` `כyɛ` `כbεfa` `כbaa` `כdwene` `כtan` `wכn`
 * `awoכ` `soכ` `wɔnbכ` `כbofoכ` `ɔkככ` are ɔhene, ɔyɛ, ɔbɛfa, ɔbaa, ɔdwene, ɔtan, wɔn, awoɔ, soɔ, wɔnbɔ,
 * ɔbofoɔ, ɔkɔɔ. ⚠ `ɔkככ` and `כbofoכ` SETTLE IT ON THEIR OWN: the correct ⟨ɔ⟩ and the substitute stand in
 * the same word, so the substitution is one writer's input method and not a different letter.
 *
 * ⚠ THE DAMAGE IS AN AMPUTATION, NOT A MIS-READING. Neither character is in this g2p's grapheme table, so
 * the letter is dropped and the word is read without it — `εwɔ` → *wɔ*, `Neε` → *ne*, `εmaa` → *maa*,
 * `כhene` → *hene*. ⟨ɛ⟩/⟨e⟩ and ⟨ɔ⟩/⟨o⟩ are four distinct Akan vowels, and the +ATR/−ATR harmony in
 * `akan.ts` is DRIVEN by ⟨ɛ ɔ⟩ as its unambiguous −ATR triggers — so a deleted ⟨ε⟩ does not merely lose a
 * vowel, it removes the evidence the rest of the word's vowels are resolved from.
 *
 * ⚠ NOT DONE GLOBALLY, AND THAT IS THE CORRECT LAYER — the same argument Bambara's table records.
 * `core/unicode.ts`'s `foldLatinConfusables` folds toward the ASCII letter a reader of ANY Latin
 * orthography would see, i.e. ⟨ε⟩→`e`, and `e` and `ɛ` are two different Akan phonemes. The right target
 * is knowable only from THIS language's alphabet.
 *
 * ⚠ AND ⟨כ⟩ IS THE ONE THE INSTRUMENT COULD NOT REPORT, which is worth recording where the fix is. Its
 * probe words are `כyɛ`, `wכn`, `כhene` — one Hebrew character against one or two Latin ones — and
 * `silentCharsIn`'s `majorityScript` filter admits a probe word only when the corpus's own script is in
 * the MAJORITY of it. That filter is what removes the IPA-gloss false positives, so it is not wrong; but a
 * homoglyph inside a SHORT word is exactly the shape it cannot see, and the census remains the instrument
 * that finds those. ×164 of ⟨ε⟩ in the artifact reached the detector as ×85 for the same reason.
 */
const HOMOGLYPH: Readonly<Record<string, string>> = { "ε": "ɛ", "כ": "ɔ" };
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPH).join("")}]`, "gu");

/**
 * Read a decimal's FRACTIONAL part the way this corpus reads it.
 *
 * ⚠ TWO BRANCHES, PINNED SEPARATELY (trap 13), because the corpus only exercises one of them. Akan reads
 * the tail as a CARDINAL: 55.77 → *akyiri pɔ aduɔson nson* (77), 32.30 → *akyiripɔn aduasa* (30), 0.53 →
 * *akyiripo aduonum mmiensa* (53), 64.20 → *akyiripɔ aduonu* (20), 51.0 → *akyire pɔ hwee* (0). Tail
 * lengths in the corpus are 1 digit ×2,638 and 2 digits ×2,969, against 3 digits ×81 and 4+ ×13 — so the
 * attested convention covers one and two digits and NOTHING attests a cardinal reading of a longer tail.
 * A leading zero cannot be expressed by a cardinal at all (`1.05` is not "point five"), and the corpus
 * offers one digit-by-digit instance for the two-digit case (52.75 → *nson ne nnum*). So: cardinal for a
 * 1–2 digit tail with no leading zero, spaced digits — which the engine's number path then speaks one at
 * a time — otherwise.
 */
function fraction(tail: string): string {
    return tail.length <= 2 && !tail.startsWith("0") ? tail : [...tail].join(" ");
}

/**
 * Every rule here emits DIGITS wherever a quantity is involved and lets the engine's own number path speak
 * them, so this layer carries no numeral words of its own — which is why the `ne`-connector question in
 * the header is orthogonal to it.
 */
export function normalizeAkan(input: string): string {
    // 0) NFC at the entry, so a literal in this file matches whichever normalization the corpus used.
    //    Akan writes ⟨ɛ ɔ⟩, which do not precompose, beside ordinary Latin — but a wiki dump also carries
    //    decomposed ⟨ɛ́⟩-style sequences from imported text, and the g2p NFCs downstream anyway, so this
    //    costs nothing and closes trap 11 in a Latin script.
    let s = input.normalize("NFC");

    // 1) HTML ENTITIES AND ZERO-WIDTH MARKS, first — a dump carries `&nbsp;` and `&#xFEFF;` (the
    //    `zero-width` cell holds 258 instances) and both must go BEFORE the ampersand rule at step 10, or
    //    `&nbsp;` is read as the word "and" followed by the letters n-b-s-p. `&#xFEFF;` is a rendering
    //    hint, not speech.
    s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/[​‌‍﻿]/gu, "");
    //    ⚠ AND A WIKITEXT TABLE PIPE BETWEEN A FIGURE AND ITS UNIT, for the same reason `&nbsp;` is here:
    //    it is not speech, it is already silent, and it sits in exactly the gap step 4's number-unit
    //    adjacency needs. `asaase bɛyɛ 973.78|km² so` is the artifact's ONE instance (`|` occurs once in
    //    the whole artifact) and it is an infobox field that lost its markup, not a Twi sentence. Folding
    //    it to a space cannot change any reading — the sink drops the character today — it can only let a
    //    rule reach across it. ⚠ NARROW ON PURPOSE: digit on the left, letter on the right. A bare `|` is
    //    left alone, so nothing that might be a genuine table column separator is touched.
    s = s.replace(/(?<=\d)\|(?=\p{L})/gu, " ");

    // 1b) HOMOGLYPHS FOR ⟨ɛ ɔ⟩ — see HOMOGLYPH. Immediately after NFC and the entity strip, and before ANY
    //     rule that inspects a letter: step 2's elision rule carries ⟨ɛ ɔ⟩ in its vowel class, step 5's
    //     `PERCENT_WRITTEN` is spelled with them, and the unit and range guards read letter boundaries — so
    //     a word still carrying a Greek epsilon or a Hebrew kaf is invisible to all of them in exactly the
    //     way it is invisible to the tokenizer.
    s = s.replace(HOMOGLYPH_RE, (c) => HOMOGLYPH[c]!);

    // 2) THE ELISION APOSTROPHE — the largest class in the language, ×4,930 tw + ×2,664 fat.
    //    `n'` (3sg possessive *ne*), `w'` (2sg *wo*) and `m'` (1sg *me*) are CLITICS whose vowel elides
    //    before a vowel-initial noun: `n'awofoɔ` is one phonological word, [nawofʊɔ]. The engine's TOKEN
    //    splits on the apostrophe, so today the clitic reaches the g2p as a standalone BARE CONSONANT —
    //    `n awʊfwɔ`, `w ate` — which is not a possible Akan word. Joining the two halves is the reading.
    //
    //    ⚠ THE GUARDS ARE WHAT KEEP THIS OFF THE ENGLISH POSSESSIVE, which both wikis carry in quantity
    //    (`People's` ×690 tw, `Master's` ×126, `Women's` ×163, `Lincoln's`, `King's`). Two conditions, and
    //    each one alone is insufficient: the clitic must be the WHOLE preceding token (so `Women's` and
    //    `Lincoln's` are out on their `n` being word-internal), and what follows must be a VOWEL (so
    //    `People's`, `Master's` and every `'s` are out regardless). Measured: the 4,930 tw matches of this
    //    pattern are the single-letter clitics, and the 690+163+126 English possessives are not among
    //    them.
    s = s.replace(new RegExp(`${NLB}([nwmNWM])['’ʼ]([aeɛioɔuAEIƐOƆU])`, "gu"), "$1$2");

    // 3) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number (`16,083` → *du nsia , adwɔwɔt͡ɕʷɪ mmiɛnsa*). Three
    //    separators occur; each arm is measured, and they are NOT symmetrical:
    //
    //        comma  16,083 / 50,879 / 202,834   ×3128 tw + 2171 fat   the dominant form
    //        dot    3.038.217 / 48.168.996      ×28 tw   + 0 fat      CHAINS ONLY — see below
    //        space  3 500 / 145 000             ×29 tw   + 2 fat
    //
    //    ⚠ THE DOT ARM REQUIRES TWO OR MORE GROUPS AND THE COMMA ARM DOES NOT, and that asymmetry is the
    //    whole discriminator. In this corpus `\d{1,3}\.\d{3}` is genuinely ambiguous — 28 tw instances are
    //    population figures with two or more groups, and 35 are three-decimal DECIMALS (`0.206 km`,
    //    `1.132B`, `4.568`, `1.850°W`). A single dot group is therefore left to step 9. The comma has no
    //    such conflict: this corpus's comma-decimal is ×39 tw / ×13 fat and is always a 1–2 digit tail.
    //
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    refuses to de-group a number followed by its own sentence comma, so `24,000, na …` would split
    //    off `000` and speak it as zero (the ln finding, reproduced here).
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3}){2,})(?![\d]|\.\d)/gu, (w) => w.replace(/\./gu, ""));
    //    The SPACE form additionally has to reject a bare adjacency that is really two numbers in a row.
    //    Requiring every group to be exactly three digits does that: `afe 1961 – 25` has no 3-digit group,
    //    and `bosome 9 1946` is not `\d{1,3}( \d{3})+` because 1946 is four digits.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 4) UNITS, BEFORE DECIMALS — the number-unit adjacency this rule matches on is destroyed the moment a
    //    decimal is rewritten into a word plus spaced digits (the playbook's standing coupling), and after
    //    de-grouping so `1,500 m` is already one token. Two guards, neither decorative:
    //
    //    ⚠ THE LOOKAHEAD REFUSES `2 3 ² ³`, because Akan has no square or cube word (header). `km²`/`km2`
    //      (×26 tw + 25 fat) therefore reads exactly as it did before this layer existed, rather than
    //      becoming *kilomita* — an AREA stated as a distance, which is confidently wrong where the old
    //      reading was merely raw.
    //    ⚠ THE LOOKBEHIND REFUSES A DOT, so a match cannot begin inside the fractional part of a dotted
    //      designation (`802.11m` → "…eleven METRES", traps 28 and 46). A lookahead alone does not do it:
    //      rejected at `802`, the engine retries from the fractional part and matches `11m` on its own.
    //      ⚠ AND THE GUARD ONLY WORKS HERE. Step 9 spends the decimal dot; by then there is no dot to
    //      reject, which is trap 39 and is exactly why this step is numbered before it. This corpus's
    //      dotted-designation cell is `1.78m`, `€2.5m`, `10.42s` — decimals glued to a one-letter unit
    //      rather than versions — and those must still read, which the arm below handles by taking the
    //      operand WITH its decimal tail.
    //    ⚠ AND A ONE-LETTER `m` AFTER A MONEY AMOUNT IS THE MAGNITUDE, NOT THE METRE. `US$ 1m`, `€2.5m`,
    //      `£2.19m`, `US$100m` — 5 instances across the two dumps, and the rule as first written read all
    //      five as *mita*, which is the trap-46 shape: a one-letter key claiming something that is not a
    //      quantity of that unit. A currency sign in front is the discriminator, and it is still THERE at
    //      this point because step 6 has not run yet (which is the second reason units come first). The
    //      capital forms need no guard: `615M` and `1.132B` are magnitudes too, and this table is
    //      case-sensitive, so they were never at risk.
    //    ⚠ THE SQUARED ARM RUNS FIRST, and it has to: the plain arm's lookahead refuses `2`/`²`, so with
    //      the two in the other order `240 km2` would be rejected outright and never retried. Same
    //      lookbehinds, same operand; the only differences are that it CONSUMES the exponent and that its
    //      own lookahead still refuses a `3`/`³` (`km2` yes, `km23` no, `km3` no — there is no cube word).
    //      See SQUARED for the citation and for why this is where ak's raw-Latin leak lived.
    for (const [sym, word] of UNITS) {
        s = s.replace(new RegExp(`(?<![$€£₵][^\\d]{0,3}[\\d.,]{0,12})(?<![\\d.,\\p{L}\\p{M}])(${NUM})\\s?${sym}(?:²|2)(?![\\p{L}\\p{M}\\d²³/])`, "gu"), `$1 ${word} ${SQUARED}`);
    }
    for (const [sym, word] of UNITS) {
        s = s.replace(new RegExp(`(?<![$€£₵][^\\d]{0,3}[\\d.,]{0,12})(?<![\\d.,\\p{L}\\p{M}])(${NUM})\\s?${sym}(?![\\p{L}\\p{M}\\d²³/])`, "gu"), `$1 ${word}`);
    }
    // …and the ones with no numeral at all — see BARE_UNITS. Last, so the counted arm above keeps every
    // match it can make and only what it could not reach is left for this.
    s = BARE_UNITS(s);

    // 5) PERCENT, before the range rule and before decimals. The word is PREPOSED (see PERCENT), so it
    //    cannot be emitted by a rule that runs after the range rule has already split the operands.
    //    ⚠ A SPAN TAKES THE WORD ONCE, IN FRONT — `10-15%` (×44 tw + 2 fat) is one quantity with two
    //    endpoints, and a percent rule that only knew about a single operand would emit
    //    `10 kosi ɔha mu nkyekyɛmu 15`, stranding the word inside the span. The ascending test and the
    //    chain guard are the same ones step 8 uses, and this arm is why percent must run first.
    //    ⚠ AND THE SPAN IS ALSO WRITTEN WITH THE SIGN ON BOTH ENDS (`40%-50%`, ×2 tw). The optional first
    //    `%` is what stops that shape falling to the single-operand arm, which would emit the word twice
    //    with a bare hyphen stranded between the two halves.
    s = s.replace(new RegExp(`(?<![\\d.,:\\-–—])(${NUM})\\s?%?\\s?[-–—]\\s?(${NUM})\\s?%`, "gu"),
        (whole: string, a: string, b: string, at: number, str: string) => {
            if (Number(a.replace(/,/gu, "")) >= Number(b.replace(/,/gu, ""))) return whole;
            const word = alreadyPercented(str.slice(0, at)) ? "" : `${PERCENT} `;
            return `${word}${a} ${TO} ${b}`;
        });
    s = s.replace(new RegExp(`(?<![\\d.,])(${NUM})\\s?%`, "gu"),
        (_m: string, a: string, at: number, str: string) => (alreadyPercented(str.slice(0, at)) ? a : `${PERCENT} ${a}`));

    // 6) CURRENCY, also PREPOSED, and before decimals for the same reason. Longest key first (see
    //    CURRENCY), so `GH₵` is claimed before the bare `₵`.
    //    ⚠ THE AMOUNT IS OPTIONAL ON THE ISO-PREFIXED FORM ONLY. `GHS20,000` and `$1,862` are the shapes
    //    the corpus writes; a bare `$` with no figure after it does not occur in either wiki, so the rule
    //    requires a figure and a stray sign is left exactly as silent as it was.
    for (const [sym, word] of CURRENCY) {
        s = s.replace(new RegExp(`${NLB}${sym}\\s?(${NUM})`, "gu"), `${word} $1`);
    }

    // 7) DOTTED ABBREVIATIONS — the INTERIOR dots only (×940 tw + 222 fat). `U.S.A.` reads as three
    //    spurious clause breaks today, and so do the era markers `A.Y.B.` and `Y.B.`, which is the whole
    //    defect being fixed here; the letters themselves are left where they were, because no letter-name
    //    table exists (header).
    //    ⚠ THE FINAL DOT IS KEPT, which is why this rule is written as "a dot BETWEEN two letters" rather
    //    than as an expansion with an end-of-sentence special case. An abbreviation's own trailing dot is
    //    ambiguous with the sentence period — `U.S.A.` ends sentences in this corpus — and deleting it
    //    would silently delete the pause (trap 17's "a mark that should be a pause and instead vanishes").
    //    ⚠ AND IT RUNS AFTER DE-GROUPING BUT BEFORE THE DECIMAL RULE: its own pattern is letter-dot-letter
    //    so it cannot collide with either, but stating the position keeps that true if either widens.
    //    ⚠ `\p{L}` AND NOT THE FLEET'S OLD `[^\W\d_]`, which is trap 1 wearing a different mask: `\w` — and
    //    so its negation `\W` — is ASCII-defined EVEN UNDER THE `u` FLAG, so `[^\W\d_]` is "an ASCII letter"
    //    and contains none of ⟨Ɔ ɛ Ŋ Ɲ⟩ — which is to say, none of the letters that make this Akan. The
    //    class was measured before it was replaced: `A.B.C.`→`ABC.` and `U.S.A.`→`USA.` were already
    //    correct, but `Ɔ.K.` and `Ɛ.Ɔ.A.` came back UNCHANGED and `D.M.Ŋ.` came back HALF-APPLIED as
    //    `DM.Ŋ.` — a rule that quietly stops working at the language's own alphabet. `\p{M}` rides along
    //    on both sides so a marked letter is still a letter (trap 23). The ee run hit the identical bug.
    s = s.replace(/(?<=[\p{L}\p{M}])\.(?=\p{L}\p{M}*\.)/gu, "");

    // 8) RANGES — ×1,125 bare pairs in tw and ×264 in fat, read today as two juxtaposed cardinals with no
    //    connective at all. `kosi` is the infix (see TO). ⚠ ASCENDING PAIRS ONLY, AND CHAIN-GUARDED:
    //
    //    · a hyphen-digit on EITHER side rejects the ISBN and telephone chains — `ISBN 978-9988-…` (×18 tw
    //      + 5 fat) offers this rule exactly the pair it looks for, and one group fewer would hand it a
    //      bare ascending pair. Claiming the identifier whole is unnecessary once the chain is rejected,
    //      which is why this language needs no ISBN rule of its own;
    //    · NON-ASCENDING is left as the bare juxtaposition it already was. 807 of tw's 1,125 pairs ascend
    //      and 264 of fat's… 190 do; the rest are scores, sport classes (`LW10-12`) and the BIRTH–DEATH
    //      pairs whose second operand is a DAY (`21 Ɔbɛnem 1961 – 25 Ɔbɛnem 2012` offers `1961 – 25`),
    //      which fall out for free on the descending test;
    //    · a preceding `:` rejects the scripture and sports-time spans the clock rule deliberately does
    //      not claim.
    //
    //    ⚠ THE TRAILING GUARD REJECTS A COMMA AND NOT A DOT, AND THE TWO MARKS ARE NOT THE SAME QUESTION HERE.
    //    Rejecting a following `.` declined every span that ENDS A CLAUSE — `1990-1995.` came back untouched
    //    and read as two juxtaposed cardinals with `kosi` gone at exactly a sentence end (playbook trap 58,
    //    reported by `review.ts`'s `clause-final` check, the same one-character guard as lt/mn/et/su/mos).
    //    It costs nothing even where the dot IS a decimal, because step 9 runs after this one: `10-15.5` is
    //    claimed as `10 kosi 15` and `15.5` still reaches the decimal rule whole. THE COMMA STAYS, because
    //    this language writes a comma decimal too (×39 tw + 13 fat, step 9's second arm) and because a comma
    //    is also its grouping mark — so a trailing `,` can open the right operand's own tail, which a dot at
    //    a sentence end never does.
    //    ⚠ THIS CORPUS GAINS NOTHING FROM IT, and that is stated rather than hidden: its one clause-final
    //    span is `1964-1967, Belfast` — a COMMA — so the artifact diff is 0/237 and the repair is pinned as a
    //    branch in `test/akan.test.ts` instead of counted as corpus movement.
    s = s.replace(new RegExp(`(?<![\\d.,:\\p{L}\\p{M}\\-–—])(\\d+)\\s?[-–—]\\s?(\\d+)(?![\\d\\p{L}\\p{M}\\-–—]|,\\d)`, "gu"),
        (whole: string, a: string, b: string) => (Number(a) < Number(b) ? `${a} ${TO} ${b}` : whole));

    // 9) THE DECIMAL POINT, after every rule that needed to see a dot (steps 3, 4 and 7) and after every
    //    rule that had to claim the whole figure (5, 6). `1.8` reads as a SENTENCE BREAK today. The word
    //    and the fractional-part convention are both the corpus's own — see POINT and `fraction`.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.])`, "gu"),
        (_m: string, head: string, tail: string) => `${head} ${POINT} ${fraction(tail)}`);
    //    The COMMA decimal is ×39 tw + 13 fat — a minority spelling, but the same defect (a PAUSE where a
    //    point belongs) and the same reading. It runs after the comma de-grouping above, which has already
    //    claimed every 3-digit group, so what reaches here is a 1–2 digit tail.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d.,])`, "gu"),
        (_m: string, head: string, tail: string) => `${head} ${POINT} ${fraction(tail)}`);

    // 10) THE ENGLISH ORDINAL SUFFIX — ×528 tw + 254 fat, all of it inside English text these wikis carry
    //     (`24th February`, `4th Republic`, `3rd century BC`). The letters reach the IPA as a fragment
    //     today. The suffix is DROPPED rather than translated: Akan's ordinal is a POSTPOSED relative
    //     clause, `bosome no da a ɛtɔ so aduonu nan` = "the day of the month that FALLS ON 24" (`ɛtɔ so`
    //     ×4,904 tw, `ɔtɔ do` ×1,742 fat), so there is no prefixable ordinal word to substitute and
    //     preposing the clause before `Republic` would be ungrammatical. Dropping leaves the CARDINAL,
    //     which is what the corpus's own glosses of these very dates read.
    s = s.replace(/(?<=\d)(?:st|nd|rd|th)(?![\p{L}\p{M}])/gu, "");

    // 11) THE AMPERSAND — ×230 tw + 91 fat, silent today, and every instance read is inside an English
    //     organisation name (`Trade & Industry`, `Michael & Susan Dell Foundation`, `GCE O & A level`).
    //     `ne` is Akan's ordinary noun coordinator and needs no sourcing beyond the corpus it saturates.
    //     ⚠ SPACES ON BOTH SIDES OF THE REPLACEMENT, because deleting the sign merges its operands and
    //     `A&B` would otherwise become one initialism where the text has two (trap 18/26 — the reason the
    //     differential probe substitutes a space rather than deleting).
    s = s.replace(/\s?&\s?/gu, " ne ");

    return s;
}
