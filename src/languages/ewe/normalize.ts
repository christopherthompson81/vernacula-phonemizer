/**
 * Ewe (ee) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR EWE. The evidence is `tools/corpus/mined/ee.jsonc` (ee.wikipedia dump,
 * 5,921 paragraphs, 398 retained) plus `tools/normalization/attest.ts` against ee.wikipedia, whose findings
 * are cached in `tools/corpus/attest/ee.jsonc`. Every count below says which. Full log:
 * `docs/investigations/ee_normalization_investigation.md`.
 *
 * ⚠ AND THE CORPUS IS CODE-MIXED THREE WAYS. Ghana and Togo are multilingual, so ee.wikipedia carries
 * ENGLISH (whole passages, citation furniture, Sotheby's price lists), FRENCH names and Twi/Akan material.
 * A raw count is a lead about the FILE; every word this layer emits was read back to instances that are
 * EWE sentences, and the ones that were not are recorded as refusals below.
 *
 * ── THE HOMOGLYPH FINDING, WHICH IS WHY THIS FILE OPENS WITH A FOLD ───────────────────────────────────
 *
 * Ewe's alphabet is ⟨Ɖ ɖ Ɛ ɛ Ƒ ƒ Ɣ ɣ Ŋ ŋ Ɔ ɔ Ʋ ʋ⟩. A census of every non-ASCII code point in the artifact
 * (59,150 characters) against that inventory found FOUR characters standing in for an Ewe one — and, just
 * as importantly, several lookalikes that are NOT:
 *
 *     Ð  U+00D0  ×11 (×19 corpus-wide, f269a4b)   for Ɖ U+0189    Ðasefowo, Ðeɖefia, Ðokuisiʋa, Ðeka
 *     Đ  U+0110  ×2                               for Ɖ U+0189    Đoɖo, Đɔkita
 *     Ƞ  U+0220  ×1                               for Ŋ U+014A    Ƞkɔ nyanyɛ (= Ŋkɔ, "name")
 *     ◌͂  U+0342  ×6   COMBINING GREEK PERISPOMENI for U+0303      ha͂, kata͂, ŋɔ͂tsɛ, nusrɔ͂la
 *
 * All three LETTERS are capitals and all are word-initial, which is the keyboard story exactly: the writer
 * has ⟨ɖ ŋ⟩ on the lowercase layer and reaches for a Latin-1 lookalike for the capital. What they cost:
 *
 *     Ðasefowo   → dˈiː asefowo   ⟨Ð⟩ is outside `TOKEN`, so the WORD ENDS and the fragment goes to the
 *                                 English fallback as the LETTER NAME "dee"
 *     Ƞkɔ        → ƞ kɔ           the same break, and the raw ⟨ƞ⟩ additionally REACHES THE IPA
 *     ha͂ / kata͂ → ha / kata      the nasalization is SILENTLY DELETED — /hã/ and /ha/ are two words, and
 *                                 nothing about the output looks wrong (trap 56)
 *
 * ⚠ THE FOLD IS LOCAL AND CANNOT GO TO `core/unicode.ts`. A generic compatibility fold maps Ð→D, and Ewe
 * needs Ð→Ɖ (a different phoneme, /ɖ/ not /d/); U+0342→U+0303 is meaningless outside a language that
 * writes nasalization with a tilde. This is the bm precedent (ε→ɛ could not go to core because core folds
 * ε→e and /e/ vs /ɛ/ are two phonemes, `304f41d`).
 *
 * ⚠ CAPITALS ONLY, AND ONLY THE FOUR THAT ARE ATTESTED — trap 9, because an unattested guard alternative is
 * a misfire generator, and here it would be an ACTIVE one. The lowercase lookalikes are ×0 in this corpus
 * AND are live characters in the text that is here: ð appears in English IPA, ƞ U+019E is an IPA symbol,
 * and ⟨ʊ⟩ U+028A ×4 — which looks exactly like ⟨ʋ⟩ — is NOT a ʋ homoglyph at all: all four sit inside
 * `/boʊnˈfoʊ ɑːbˈæs/` and `/ˈɑːkəʊˌwəʊ/`, English pronunciation glosses this wiki writes in parentheses,
 * beside ɑ ə ˈ ː ˌ. Folding it would corrupt them. Likewise ⟨Ε⟩ U+0395 ×1 is Greek (`Ελλάδα`), and the one
 * ⟨˜⟩ U+02DC is the tilde MENTIONED rather than used ("Wotsɔ dzesi sia ( ˜ ) fia be…").
 *
 * ⚠ NO LOWERCASE HOMOGLYPH EXISTS HERE, which is the negative result that sizes the class: ð, đ, ε U+03B5,
 * ԑ U+0511, ᴐ, ɳ are ×0. Ewe's lowercase specials are on every African-Latin layout, so the Bambara shape
 * (ε ×179, ԑ ×26 for ɛ) does not repeat — the damage is confined to the capitals and to one combining mark.
 *
 * ── WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes ──────────────────────────────────────
 *
 *     90% / 44.4%          → blaasieke / …                the sign is SILENT (× 80 in the corpus)
 *     $400 / £3 / €200     → alafa ene / …                the currency sign is SILENT
 *     GH¢&nbsp;1           → ɡh …                         the entity is spoken and the ISO prefix read raw
 *     51,446,201           → …, alafa ene… ,              grouping commas → CLAUSE PAUSES, three numbers
 *     0.5 / 44.4           → naneke o . atɔ̃              the decimal point → a SENTENCE BREAK
 *     1648-1654            → two bare cardinals           no connective (×459 ranges)
 *     100,210 km2          → …km eve                      raw ⟨km⟩ PLUS an invented number "two" (trap 53)
 *     56.52m / 5 kg        → …m / …kɡ                     the abbreviation reaches the IPA raw
 *     U.S. / D.M.Ŋ. / H.W. → u . s .                      spurious clause breaks (dotted ×356)
 *     Duncker & Humblot    → …                            the ampersand is silent
 *     3rd edition          → etɔ̃ rd edition              the English ordinal suffix reaches the IPA
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO DECIMAL-POINT WORD. `sources.ts` reports `[NONE] decimal-point`, espeak does not ship Ewe at all,
 *   `attest.ts` finds `point` ×1 on ee.wikipedia and it is *Darling Point*, a Sydney suburb; `kɔma`, `koma`,
 *   `pɔint` are ×0; and a dictionary/web check for an Ewe decimal term found nothing (the trap-25/ig rule:
 *   a refusal resting on SILENCE needs a dictionary check first, and it got one). So step 9 removes the
 *   separator and spaces the fractional digits — the ln and bm treatment — which fixes the spurious PAUSE
 *   and the mis-read tail and does NOT claim to read the point. The word stays unauthored.
 *
 * ⚠ NO CLOCK RULE, AND THIS IS THE TRAP-55 FINDING FOR EWE. The `clock` cell counts 62, and every colon
 *   numeral in the retained text is a SCRIPTURE REFERENCE — `Mateo 21:1-11`, `Luka 19:28-44`, `Psalmo 83:19`,
 *   `Yohanes 18:37`, `Dɔwɔwɔwo 17:11`, `Mose I ta 20:12`. Zero clocks, in a corpus with a large Jehovah's
 *   Witnesses stratum. A ceb-shaped bare `\d{1,2}:\d{2}` rule (the ilo lesson, `10589b5`) would have
 *   rewritten every one of them.
 *
 * ⚠ NO DEGREE WORD AND NO SCALE NAMES. `°C` ×3, `sources.ts` says `[NONE] scale-names — nothing follows °
 *   in the corpus but the bare letter`, and `Selsius`/`selsius` are ×0 on ee.wikipedia. ⚠ THE COST IS
 *   STATED RATHER THAN HIDDEN (trap 53): the ⟨C⟩ still reads through Ewe's own ⟨c⟩ = /t͡s/, so `22 °C` is
 *   *blaeve vɔ eve t͡s* — a phantom syllable, not merely a dropped sign. Removing the letter would delete
 *   the unit outright, which is worse; a word would be an invention. Recorded in `defects.ts`.
 *
 * ⚠ NO SQUARE OR CUBE WORD — and unlike ak this does NOT lead to a refusal, because ee's corpus writes the
 *   ASCII form `km2` (8 of 8 instances) rather than `km²`, so a refusal leaves the trap-53 reading `790 km2`
 *   → "…kilometres TWO" that Igbo shipped (`fa16868`). `attest.ts --after kilometa,meta,milimeta` returns
 *   only `ɖeka` and `miliɔn` — no modifier exists to find. What this wiki DOES is write an area with the
 *   bare unit noun: `eƒe lolome nye kilometa 20,271 sq`, `tsi si ƒe lolome nye kilometa 19,022 (7,344 mi2)`,
 *   and Africa's area as `kilometa miliɔn 30`. Step 4 therefore reads `km2` as `kilometa`, which is this
 *   corpus's own convention for exactly this slot, and loses the "square" the corpus also loses — instead of
 *   inventing a quantity. Stated as the trade it is.
 *
 * ⚠ NO `kg`. `kilogram`/`kilogaram`/`kilo` are ×0 on ee.wikipedia and ×0 in the corpus. Its one
 *   digit-adjacent instance is `−63 kg`, a judo WEIGHT CLASS ("under 63 kg"). It stays raw and reports as
 *   `LEAK RAW-LATIN kg ×1`; sourcing it would be an invention.
 *
 * ⚠ NO MINUS, PLUS OR TIMES WORD, AND THE MINUS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE. Omitting a plus
 *   is lossless; omitting a minus INVERTS. Read: the corpus's 7 leading minuses are `24 September 1844 –1938`
 *   (a lifespan dash), `−63 kg` (the weight class above), `Nigeria -7` and four `[ -1]`…`[ -4]` REFERENCE
 *   markers. Not one is a negative quantity, and no Ewe word for one is attested. `×` is `meta 4 × 100`, a
 *   relay DIMENSION — "by", never "times" (the ak finding, reproduced). ⚠ SO NONE OF THEM IS IN
 *   `ACCEPTED_SILENT` EITHER: `review.ts --lang ee` stays red on the minus, because an accepted silence
 *   claims the drop is correct and this one is not (the ak/ln/bm precedent, trap 24).
 *
 * ⚠ NO INITIALISMS AS LETTER NAMES. `core/initialisms.ts` is a NO-OP without a `letterName` table and
 *   `sources.ts` reports `[NONE] letter-names — espeak does not ship this language at all`. Trap 16 checked:
 *   the seam exists, the DATA does not. Step 7 removes only the interior DOTS (a pause defect) and leaves
 *   the letters exactly where they were — including the era markers, for which see below.
 *
 * ⚠ NO ERA EXPANSION. `D.M.Ŋ.` (BC) and `M.Ŋ.` (AD) are Ewe's own era markers and are well attested in the
 *   slot — `ƒe 9000 D.M.Ŋ.`, `ƒe alafa 4 lia D.M.Ŋ.`, `ƒe alafa 12 lia M.Ŋ.` — but the EXPANSION appears
 *   nowhere beside them, which is trap 37: the bare phrase is never the attestation. Step 7 removes their
 *   interior dots and nothing more.
 *
 * ⚠ NO FRACTION RULE. The `fractions` cell counts 9 and reading them shows slash DATES (`29/30 June`), a
 *   review SCORE (`7.30/10`), a UN resolution number (`60/147`), an anniversary (`9/11`) and a rhythm
 *   (`12/8`) — one arguable fraction in the lot. `sources.ts`: `[NONE] fraction-series`.
 *
 * ⚠ NO EWE ORDINAL RULE IS NEEDED. Ewe postposes `lia` to a figure already written in digits — `ƒe alafa 19
 *   lia`, `Ɔktoba 22 lia`, `Yesaya ta 43 lia` (×25 in the retained text) — so the ordinal is already words
 *   and already in the right order. Step 10 only strips the ENGLISH suffix this wiki's citations carry.
 *
 * ⚠ NO RULE FOR THE LEGACY DIGIT ORTHOGRAPHY, and it is recorded because it is real. One paragraph of the
 *   398 is written in the pre-Unicode typing convention where digits stand in for the special letters —
 *   "Ampetulawo tia kpo zi 2eka sia akpe he2ea wo5e af4 2eka 2e `g4" (= ɖeka, heɖea, woƒe, afɔ, ɖe ŋgɔ:
 *   2=ɖ, 4=ɔ, 5=ƒ, 1=ɛ, `g=ŋ). It is the same FAMILY as the homoglyphs above and it gets no rule, because
 *   the substitution characters are DIGITS: the same paragraph would have its real numerals destroyed, and
 *   nothing distinguishes the two without a paragraph-level detector built on one attested instance.
 */
import { makeBareUnitNormalizer } from "../../core/normalizeSymbols.ts";
import { renormalize, rewrite } from "../../core/provenance.ts";

/**
 * PERCENT, and it is POSTPOSED — `le alafa me`, literally "in a hundred". Both of ee.wikipedia's instances
 * are the percent slot and are read: "xexlẽme si woɖo ɖi la to vovo tso 25 va ɖo 33 **le alafa me**" (varies
 * from 25 to 33 percent) and "Exɔ ame 50.11 **le alafa me** le tiatia la ƒe akpa evelia me" (took 50.11
 * percent in the second round). Corroborated independently off-wiki by a published Ewe word list, which
 * gives `le alafa me` for "percent"; `alafa` = 100 is the engine's own number data (ewe.jsonc → numbers.ts).
 * That is sourced arithmetic in the trap-53/Fula sense, not an invention.
 *
 * ⚠ NO REDUNDANCY GUARD, because this corpus never writes both. Measured: `%` co-occurring with any
 * `alafa` within 40 characters is ×0 in the retained text, where Akan's same corpus shape was 17.3%.
 */
const PERCENT = "le alafa me";

/**
 * RANGE CONNECTIVE, and the part of speech was checked — the Fula `hakkunde` lesson, which is the failure
 * this slot produces when it is got wrong.
 *
 * Two candidates, both attested on ee.wikipedia: `va ɖo` (×63 / 20 articles) and `vaseɖe` (×34 / 20). Both
 * are ordinarily framed by `tso` ("from X to Y"): "tso ƒe 1988 va ɖo ƒe 1992", "tso ƒe 1958 vaseɖe ƒe 1961".
 * What decides it is the BARE INFIX, i.e. the frame this rule actually emits, and only `va ɖo` has it on
 * NUMBERS: the corpus's own "dzoxɔxɔ adzi ɖe edzi **0.5 va ɖo 2** °C" and the wiki's "anɔ ƒe **6000 va ɖo
 * ƒe 2690** D.M.Ŋ.". `vaseɖe` bare is attested as "until" with a single endpoint ("ŋudɔ vaseɖe Dzome 2007"),
 * which is a different construction.
 */
const TO = "va ɖo";

/**
 * UNITS — a missing KEY, not a missing word (trap 38), and the unit noun is written BEFORE the figure.
 *
 * ⚠ THE ORDER IS THE FINDING, and it is Ewe's own (trap 47 reason 2 / trap 54's `ha` row — the shared tier
 * can only POSTPOSE, so this has to be local). Every attested instance puts the noun first:
 * `kilometa 1,600`, `kilometa 240`, `kilometa 40`, `kilometa 12` (×29 / 20 articles); `meta 100`,
 * `meta 200`, `meta 170 (afɔ 560)` (×33 / 20); `milimeta 1,439`, `milimeta 226`, `milimeta 13`,
 * `milimeta 565 (inch 22.2)` (×6 / 3, and ×3 in the corpus itself); `sentimeta 156`, `sentimeta 48-55`,
 * `sentimeta 10 (3.9 in)` (×3 / 3). The rule therefore REORDERS: `56.52m` → `meta 56.52`.
 *
 * ⚠ THE METRE IS `meta`, NOT `mita`, AND ONLY THE CORPUS SAYS SO. `mita` is ×1 on ee.wikipedia and that one
 * is inside an English athletics line ("400 mita junior record"); `meta` is ×33 in Ewe sentences. `kilomita`
 * — the Akan spelling, which is the obvious thing to copy from the nearest treated neighbour — is ×0 here.
 * Trap 55: the sibling is a hypothesis.
 */
const UNITS: readonly (readonly [string, string])[] = [
    // Longest key first, so `mm`/`cm` are tried before the bare `m`.
    ["km", "kilometa"], ["cm", "sentimeta"], ["mm", "milimeta"], ["m", "meta"],
];

/** The same abbreviations with no numeral in reach — a caption or a table header. Shared guards
 *  (core/normalizeSymbols.ts): multi-letter vowel-free keys only, so the bare `m` is untouched. */
const BARE_UNITS = makeBareUnitNormalizer(UNITS);

/**
 * CURRENCY, PREPOSED — the corpus and the wiki both write the money noun in front of the amount:
 * `dɔlar 500`, `dɔlar 20,000`, `dɔlar miliɔn 1`, `dɔlar triliɔn 100`; `cedi 1,000`, `cedi biliɔn 7`;
 * `euro miliɔn 45`, `euro 50`; `pound miliɔn 20`, `pound biliɔn 16.5`, `pound biliɔn 72.5`.
 *
 * ⚠ `dɔla` IS NOT THE DOLLAR, AND IT IS THE TRAP THIS TABLE EXISTS TO AVOID. It looks like the obvious
 * spelling and it is ×3 on ee.wikipedia as a completely different word — "nye ɖasefowo kple nye **dɔla**"
 * (my witnesses and my SERVANT), "kluvi kple **dɔla**" (slaves and servants). The money word is `dɔlar`,
 * ×48 over 11 articles, every hit in a money slot. Trap 37, with the loser one letter away from the winner.
 *
 * ⚠ THE CEDI IS SPELLED `cedi` HERE, AND THAT IS A DECISION WITH A COST. Akan chose `sidi` over `cedi`
 * because ⟨c⟩ is not an Akan letter and the engine read it [kedi]. Ewe's engine maps ⟨c⟩ → /t͡s/, so
 * `cedi` reads [t͡sedi] where the currency is [sedi] — one segment off. The alternatives were checked and
 * are worse: `sedi` and `sedzi` are ×0 on ee.wikipedia and ×0 in the corpus, so writing either would be
 * authoring a spelling for the language. `cedi` is what Ewe text actually writes (×4 / 3 articles, incl.
 * `cedi biliɔn 7` and `Wogbaa GH¢ 1 yeyea na 10,000 cedi xoxoawo`), so this emits the corpus's own word and
 * the engine's own reading of it, rather than a silence or an invention.
 *
 * ⚠ `GH¢` / `GH₵` / `GHS` MUST BE TRIED BEFORE THE BARE `¢`/`₵`, or the `GH` is stranded and read as a
 * two-letter word ([ɡh] today). The corpus writes `GH¢` with U+00A2, not the cedi sign U+20B5.
 */
const CURRENCY: readonly (readonly [string, string])[] = [
    ["GH¢", "cedi"], ["GH₵", "cedi"], ["GHS", "cedi"], ["GHC", "cedi"], ["¢", "cedi"], ["₵", "cedi"],
    ["US\\$", "dɔlar"], ["\\$", "dɔlar"], ["€", "euro"], ["£", "pound"],
];

/** A NUMBER OPERAND that ends in a digit. ⚠ The trailing `\d` is not decoration: a class like `[\d.,]*`
 *  also swallows a following CLAUSE comma or sentence period, which is harmless while a rule writes `$1`
 *  back out and silent data loss the moment it writes words around it (trap 14's Welsh hazard). */
const NUM = String.raw`\d+(?:[.,]\d+)*`;

/** Not inside a word — `\p{M}` beside `\p{L}` (trap 23), and never `\b`, which is ASCII-defined (trap 1). */
const NLB = String.raw`(?<![\p{L}\p{M}])`;

/** A currency sign a few characters to the left, which is what makes a following `m`/`mm` a MAGNITUDE and
 *  not a unit: the corpus's `$400mm` is four hundred MILLION dollars, and the unit table would otherwise
 *  read it as 400 millimetres (trap 46's shape — a one-letter key claiming something that is not a quantity
 *  of that unit). The guard works because step 6 has not spent the sign yet, which is the second reason
 *  units run before currency. */
const NOT_MAGNITUDE = String.raw`(?<![$€£¢₵][^\d]{0,3}[\d.,]{0,12})`;

export function normalizeEwe(input: string): string {
    // 0) NFC at the entry, so a literal in this file matches whichever normalization the wiki used. Ewe's
    //    ⟨ɖ ƒ ʋ ɣ ŋ ɔ ɛ⟩ do not precompose, but its NASAL vowels do (ã ẽ ĩ õ ũ) and a dump carries both
    //    forms — trap 11 in a Latin script.
    let s = renormalize(input, "NFC");

    // 1) THE HOMOGLYPH FOLD, FIRST, because every later rule and the tokenizer itself are downstream of it.
    //    See the header for the census, the counts and why each of these four and none of the lookalikes.
    //    ⚠ THE COMBINING MARK IS FOLDED BEFORE THE RE-NFC, so `a` + U+0342 becomes a real ⟨ã⟩ rather than a
    //    base letter with an orphaned mark the scan drops. `TOKEN` admits U+0342 (it is inside the
    //    ̀-ͯ range), so the word never broke on it — the mark simply reached `phonemizeWord` and was
    //    dropped as unmapped, which is why this one is silent where ⟨Ð⟩ is loud.
    s = rewrite(rewrite(rewrite(s, /[ÐĐ]/gu, "Ɖ"), /Ƞ/gu, "Ŋ"), /͂/gu, "̃").normalize("NFC");

    // 2) HTML ENTITIES AND ZERO-WIDTH MARKS, before the ampersand rule at step 11 — else `&nbsp;` is read as
    //    the word "and" followed by the letters n-b-s-p. This wiki writes 9 of its 16 ampersands as entities
    //    and TWO OF THEM ARE UNTERMINATED (`meter 3&nbsp (afɔ 10&nbsp)`), so the `;` is optional here.
    //    ⚠ AND THE ENTITY SITS IN EXACTLY THE GAP THE UNIT AND MAGNITUDE RULES NEED: `million&nbsp;925`,
    //    `miliɔn 1.4&nbsp;`, `GH¢&nbsp;1`. Folding it to a space is what lets step 6 reach across it.
    //    U+200B is ×20 in the retained text (`zero-width` cell 48) and is a rendering hint, not speech.
    s = rewrite(rewrite(rewrite(rewrite(s, /&nbsp;?/giu, " "), /&ndash;/giu, "–"), /&#(?:x[0-9a-f]+|\d+);/giu, " ")
        , /[​‌‍﻿]/gu, "");

    // 3) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number (`51,446,201` → three numbers and two pauses).
    //    Two separators occur and the split is clean, unlike Akan's: the COMMA is the thousands separator
    //    (×183 `grouped`; `1,439`, `10,000`, `51,446,201`, `1,904,569`) and the DOT is the decimal point
    //    (×248 `decimals`; `0.5`, `44.4%`, `56.52m`, `miliɔn 6.1`). There is no dot-grouped number in this
    //    corpus at all, so no dot arm is written — the shape that forced Akan's two-group asymmetry is absent.
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    refuses to de-group a number followed by its own sentence comma, so `24,000, na …` would split off
    //    `000` and speak it as zero (the ln finding).
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)/gu, (w) => w.replace(/,/gu, ""));
    //    The SPACE form is ×1 in the retained text (`10 955 000`, Greece's population). Requiring every group
    //    to be exactly three digits is what stops it claiming two adjacent numbers — `ƒe 1961 – 25` has no
    //    three-digit group and `Ɔktoba 22 lia le ƒe 1899` is four digits.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)/gu, (w) => rewrite(w, /[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 4) UNITS, BEFORE DECIMALS — the number-unit adjacency this rule matches on is destroyed the moment a
    //    decimal is rewritten (the playbook's standing coupling), and after de-grouping so `1,904,569 km2`
    //    is already one token. The rule REORDERS to the noun-first order this language writes (see UNITS).
    //
    //    ⚠ THE SQUARED ARM RUNS FIRST and consumes the `2`/`²`, because the plain arm below refuses them —
    //      with the two in the other order `100,210 km2` would be rejected outright and never retried. It
    //      reads as the bare unit noun, which is this corpus's own way of writing an area; see the header
    //      for the three citations and for why a refusal here would be the trap-53 "kilometres two".
    //    ⚠ THE OPERAND IS ANCHORED ON BOTH EDGES (trap 52): a lookbehind rejects one STARTING POSITION, it
    //      does not reject the string, so `(?<![\d.,])` alone would let the engine retry from a fractional
    //      part. The digit run must begin where the match begins. This corpus contains no dotted VERSION at
    //      all (its `version-dot` cell is `7.30pm`, `103.5 FM`, `56.52m` — decimals glued to a letter, which
    //      must READ), so the anchor here is robustness rather than a measured repair.
    //    ⚠ `NOT_MAGNITUDE` keeps the table off `$400mm`. See its definition.
    for (const [sym, word] of UNITS) {
        s = rewrite(s, new RegExp(`${NOT_MAGNITUDE}(?<![\\d.,\\p{L}\\p{M}])(${NUM})\\s?${sym}(?:²|2)(?![\\p{L}\\p{M}\\d²³/])`, "gu"), `${word} $1`);
    }
    for (const [sym, word] of UNITS) {
        s = rewrite(s, new RegExp(`${NOT_MAGNITUDE}(?<![\\d.,\\p{L}\\p{M}])(${NUM})\\s?${sym}(?![\\p{L}\\p{M}\\d²³/])`, "gu"), `${word} $1`);
    }
    //    …and the ones with no numeral at all. Last, so the counted arms keep every match they can make.
    s = BARE_UNITS(s);

    // 5) PERCENT, before the range rule, because a span takes the word ONCE and a range rule that ran first
    //    would have split the operands. `25–33%` and `10–15%` are both in the corpus.
    //    ⚠ THE WORD IS POSTPOSED (see PERCENT), so on a span it lands after the SECOND operand.
    //    ⚠ ASCENDING AND CHAIN-GUARDED, the same tests step 8 uses — see there for why.
    s = rewrite(s, new RegExp(`(?<![\\d.,:\\-–—])(${NUM})\\s?%?\\s?[-–—]\\s?(${NUM})\\s?%`, "gu"),
        (whole: string, a: string, b: string) =>
            (Number(rewrite(a, /,/gu, "")) < Number(rewrite(b, /,/gu, "")) ? `${a} ${TO} ${b} ${PERCENT}` : whole));
    s = rewrite(s, new RegExp(`(?<![\\d.,])(${NUM})\\s?%`, "gu"), `$1 ${PERCENT}`);

    // 6) CURRENCY, PREPOSED, and before decimals for the same reason percent is. Longest key first (see
    //    CURRENCY), so `GH¢` is claimed before the bare `¢`.
    //    ⚠ THE FIGURE IS REQUIRED. A bare sign with no amount does not occur in this corpus, so a stray one
    //    is left exactly as silent as it was rather than emitting a currency noun out of nowhere.
    for (const [sym, word] of CURRENCY) {
        s = rewrite(s, new RegExp(`${NLB}${sym}\\s?(${NUM})`, "gu"), `${word} $1`);
    }

    // 7) DOTTED ABBREVIATIONS — the INTERIOR dots only (`dotted` ×356). `H.W.`, `B.C.`, `E.P.`, `J.N.D.`,
    //    `B.P.`, `H.R.40` and the era markers `D.M.Ŋ.` / `M.Ŋ.` read as a spurious clause break per dot
    //    today, which is the whole defect being fixed; the letters are left where they were, because no
    //    letter-name table exists and no era expansion is attested (header).
    //    ⚠ THE FINAL DOT IS KEPT — an abbreviation's own trailing dot is ambiguous with the sentence period
    //    (`D.M.Ŋ.` ends sentences here) and deleting it would silently delete the pause (trap 17).
    //    ⚠ AFTER DE-GROUPING AND UNITS, BEFORE THE DECIMAL RULE: letter-dot-letter cannot collide with a
    //    numeric shape, but stating the position keeps that true if either widens.
    //    ⚠ `\p{L}` AND NOT THE FLEET'S USUAL `[^\W\d_]`, which is trap 1 wearing a different mask: `\w` is
    //    ASCII-defined even under the `u` flag, so `[^\W\d_]` does not contain ⟨Ŋ⟩ — and Ewe's own era
    //    marker is `D.M.Ŋ.`, whose SECOND dot the ASCII class therefore left in place (`dm . ŋ .`). Measured
    //    on the real string before and after.
    s = rewrite(s, /(?<=\p{L})\.(?=\p{L}\.)/gu, "");

    // 8) RANGES — `ranges` ×459, read today as two juxtaposed cardinals with no connective. `va ɖo` is the
    //    infix (see TO). Three guards, each measured over the retained text's 54 hyphen pairs:
    //
    //    · a hyphen-digit or a separator-digit on either side rejects the ISBN chains (`0-582-49219-X`,
    //      `0-901787-60-4`) and the scripture spans, which are additionally rejected by the preceding `:`
    //      (`Mateo 21:1-11`, `Luka 19:28-44`) — the shapes the clock refusal above leaves in place;
    //    · NON-ASCENDING is left as the bare juxtaposition it already was: the BCE spans run downwards
    //      (`7000–3300 D.M.Ŋ.`, `9000–3300`) and so do the football scores (`1–0`, `2–1`) and the truncated
    //      second endpoints (`1951-53`, `2006-07`, `1957-61`);
    //    · BOTH OPERANDS SINGLE-DIGIT is rejected outright, and this arm is Ewe's own. The ascending test
    //      alone leaves the tennis set scores — `Roger Federer ɖu Rafael Nadal dzi 7–6, 4–6, 7–6, 2–6, 6–2`
    //      contains two ASCENDING pairs — and a score is not a span. It costs nothing measurable: all 17
    //      ascending pairs in the retained text have a two-or-more-digit operand (`207-213`, `25–33`,
    //      `10–15`, `15-49`, `48-55`, and eleven year spans).
    //
    //    ⚠ AND THE TRAILING GUARD REJECTS NEITHER `.` NOR `,`, WHILE THE LEADING ONE STILL REJECTS BOTH. A
    //    sentence period is not part of a number, so the symmetric guard declined every range that ENDS A
    //    CLAUSE — `207-213.`, `1-11.` — and each came back as the bare juxtaposition this rule exists to
    //    replace. Reported by `review.ts`'s `clause-final` check. The dot is not protecting an ordinal: a
    //    fleet-wide comparison of the numeral WORD for `5` against `5.` over the 47 languages whose range
    //    rule declined a clause-final dot found ZERO ordinal readings.
    //    ⚠ THE COMMA GOES TOO, on Ewe's own evidence. Ewe writes the DECIMAL POINT (step 9), so a following
    //    comma is a CLAUSE comma, never a decimal tail; the grouping commas are already spent upstream; and
    //    the two guards above are what decline the shapes a comma would otherwise be catching by accident —
    //    the tennis scores `7–6, 4–6, 7–6, 2–6, 6–2` are rejected as non-ascending or as both-single-digit,
    //    and the scripture spans `Mateo 21:1-11,` by the leading `:`. +1 segment (`le May 10-11, …`).
    s = rewrite(s, new RegExp(`(?<![\\d.,:\\p{L}\\p{M}\\-–—])(\\d+)\\s?[-–—]\\s?(\\d+)(?![\\d\\p{L}\\p{M}\\-–—])`, "gu"),
        (whole: string, a: string, b: string) =>
            (Number(a) < Number(b) && (a.length > 1 || b.length > 1) ? `${a} ${TO} ${b}` : whole));

    // 9) THE DECIMAL POINT, after every rule that needed to see a dot (3, 4, 7) and after every rule that had
    //    to claim the whole figure (5, 6). `0.5` reads as a SENTENCE BREAK today and `44.4` as "forty-four,
    //    four". The separator becomes NOTHING and the fractional digits are spaced so the number path speaks
    //    them one at a time — see the header for why there is no point word to insert. What this fixes is the
    //    spurious CLAUSE BREAK and the mis-read tail, not the missing word.
    //    ⚠ THE TRAILING LETTER GUARD keeps a dotted designation out; ×0 in this corpus, robustness only.
    s = rewrite(s, /(?<![\d.,])(\d+)\.(\d+)(?![\d.\p{L}\p{M}])/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].join(" ")}`);

    // 10) THE ENGLISH ORDINAL SUFFIX — `3rd edition`, inside the English citation furniture this wiki
    //     carries; the letters reach the IPA as a fragment today. DROPPED rather than translated, because
    //     Ewe's own ordinal POSTPOSES `lia` to the figure (`ƒe alafa 19 lia`) and the cardinal that remains
    //     is what the sentence already reads.
    s = rewrite(s, /(?<=\d)(?:st|nd|rd|th)(?![\p{L}\p{M}])/gu, "");

    // 11) THE AMPERSAND — silent today, and every surviving instance after step 2 is inside an English or
    //     French name (`Duncker & Humblot`, `Prempeh & Co`, `St. Vincent & the Grenadines`, `Foris
    //     Publications & Garome`). `kple` is Ewe's ordinary coordinator and needs no sourcing beyond the
    //     corpus it saturates (×357 tokens in the retained text).
    //     ⚠ SPACES ON BOTH SIDES, because deleting the sign merges its operands and `A&B` would become one
    //     initialism where the text has two (traps 18/26).
    s = rewrite(s, /\s?&\s?/gu, " kple ");

    return s;
}
