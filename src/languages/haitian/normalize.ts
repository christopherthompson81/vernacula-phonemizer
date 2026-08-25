/**
 * Haitian Creole / kreyòl ayisyen (ht) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything
 * which is not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR HAITIAN CREOLE. The evidence is `tools/corpus/mined/ht.jsonc` (dump-sourced, so
 * its `sample` tier IS the real distribution) plus a fresh ht.wikipedia dump — 800,158 paragraphs after
 * `wikidump-to-text.py` + `filter-markup.py`. Full log: `docs/investigations/ht_normalization_investigation.md`.
 *
 * ⚠ AND 15.1% OF THAT DUMP IS FRENCH, WHICH IS THE HAZARD THIS PARTICULAR LANGUAGE INVITES. Haitian Creole
 * is French-LEXIFIED and orthographically INDEPENDENT: its spelling is phonemic and deliberately unlike
 * French. But its wiki carries French bibliographies, French sentences and French typography, so a raw count
 * is a lead about the FILE and not about the language. Every count below is quoted over the CREOLE-ONLY
 * 154,110 paragraphs (a function-word classifier scoring `yon nan ki li se te ak pou yo ap` against French
 * and English markers; measurement-only, not a committed tool — `filter-by-language.py` has no `ht` row and
 * its only adversary is English, which is the wrong adversary here). Where the whole-dump number differs it
 * is given too, because the gap IS the finding: `n°` is 506 in the dump and 45 in Creole text, `=` is 93,254
 * and 304, ranges 15,665 and 2,717.
 *
 * ⚠ AND NO WORD BELOW COMES FROM FRENCH. Every one was read back to its Creole instances. The trap is not
 * hypothetical: `pwen` is the obvious French-first guess for the decimal point, is attested ×441, and every
 * single instance is a SPORTS POINT (`250 pwen`, `48 nan 50 pwen posib`). The decimal word is `vigil`.
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — the defect list, not an assumption about it:
 *
 *     90 pousan / 21%  → the sign is SILENT                               (×1,449 Creole)
 *     2 470 762 moun   → three separate numbers                           (space grouping ×577)
 *     26,338 km2       → *vennsis , twa san trantuit* + a bare `km` `2`   (comma grouping ×3,861)
 *     10.4 milyon km 2 → a SENTENCE BREAK inside the number
 *     365,256 jou      → "three hundred sixty-five, two hundred fifty-six"
 *     20yèm syèk       → *ven* + a separate *jɛm* — the [t] of ventyèm gone (×1,259)
 *     25 °C            → *vennsenk* + a bare [k]; the sign silent          (×57)
 *     $ 120 milyon     → the sign silent                                   (×148)
 *     1965-1975        → two cardinals, no connective                      (×2,717)
 *     1/5 lè atmosferik→ *en senk*, no fraction reading
 *     ISBN 1-58432-005-2 → four cardinals; a 13-digit ISBN LEAKS raw digits
 *     p. 157-177       → a spurious clause break at the dot
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ THE MINUS: U+2212 IS NOW READ, THE ASCII HYPHEN IS STILL NOT — and this entry used to say NO MINUS
 *   WORD at all. What changed is which CHARACTER is claimed, not the evidence for the word.
 *
 *   The refusal stands where it was argued. The maths-article self-gloss — `2+ (-2) = 0 i.e de plis (mwen
 *   de) fè zewo … (-2) se mwen de ou byen zewo mwen de` — offers `mwen`, which is Haitian for **"I / me"**,
 *   the commonest word in the language. One sentence in one article, proposing a reading homographic with
 *   the 1SG pronoun, still does not put *mwen de* in a speaker's mouth. And the hyphen's own population here
 *   is ~36 BCE years (`etabli nan -509`, `ant -451 ak -429`) and ISBNs, so claiming it would read a year as
 *   a negative ~36 times to fix 6 temperatures.
 *
 *   What ships is `mwens` — the language's actual comparative, ×569, the direct reflex of French *moins*,
 *   which IS the minus word in the parent language — in front of U+2212 alone. ⚠ THE WEAKNESS IS STATED,
 *   NOT HIDDEN: `mwens` is never once digit-adjacent in those 569 instances, so the concept is sourced and
 *   the construction inferred. That is the kurmanji `negatîf` shape, taken for the kurmanji reason — omitting
 *   a minus INVERTS, and `mwens ven degre` is at worst an odd register where the alternative is a temperature
 *   wrong by forty degrees. U+2212 can only ever be the arithmetic operator and no keyboard types it, which
 *   is what makes a caveated word defensible on that character and on no other.
 *
 * ⚠ NO PLUS WORD, and here the corpus DISQUALIFIES the reading rather than merely failing to supply one.
 *   55 leading pluses in Creole text and the largest class is `(+ 1987)` / `(† 1867)` — the DEATH marker,
 *   partner of the `(° )` birth marker in this wiki's anniversary lists (step 6). Next is binary arithmetic
 *   tables (`0 + 0 = 0 0 + 1 = 1`). Reading a death marker as *plis* is worse than silence.
 *
 * ⚠ NO CLOCK. 58 colon-numerals in Creole text and the majority are SCRIPTURE references (`Travay 11:25-26`,
 *   `Levitik 25:10`, `Matye 16:18`, `Mak 9:45`), then song durations (`2:14`, `3:10`); exactly TWO are true
 *   clocks (`nan 4:53 pm`, `apeprè 8:15`). Claiming the colon claims the references.
 *
 * ⚠ NO BARE `è` ORDINAL, on an ambiguity the other three suffixes do not have. `\d+\s?è` ×129 is BOTH the
 *   ordinal (`16è ak 17è sièk`, `Li se 27è moun`) and the HOUR (`bò 4è aprè midi`, `23 è 56 minit 4 segonn`).
 *   `yèm` / `èm` / `em` carry no such collision and are what step 12 claims.
 *
 * ⚠ NO `€` OR `£`, for want of a settled spelling. The euro word is written `ero` (×22) and `ewo`, and `ewo`
 *   ×145 is overwhelmingly **"hero"** (`ewo endepandans Ayiti`) — the bare-token trap. No pound word is
 *   attested at all. `$`→`dola` ships (step 9); the other two are listed by instance in `defects.ts`.
 *
 * ⚠ NO INITIALISMS. `core/initialisms.ts` exists and ~30 languages wire it, but it is a NO-OP without a
 *   `letterName` table and espeak does not ship Haitian Creole at all (`sources.ts`: `letter-names NONE`).
 *   That is the fleet-wide sourcing block, not a coding one.
 *
 * ⚠ NO `=` `×` `<` `>`. `=` counts 93,254 in the dump and 304 in Creole text, and those 304 are template
 *   residue (`|alt=Foto`, `langue=es`), a rhetorical `lang=bon, kreyòl=pa bon`, and algebra (`R = 4S`).
 *   A reading built on that count would be a reading of wikitext.
 *
 * ⚠ NO ROMAN NUMERAL RULE — and this one is checked rather than assumed. `ht` is not in `registry.ts`'s
 *   `ROMAN_NATIVE` (only en/fr are), so `core/roman.ts` has already turned `XIX` into digits before `text()`
 *   runs. The 2,180 romans the artifact counts are handled upstream.
 */
import { makeBareUnitNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";

/**
 * ⚠ THE UNIT NOUN COMES AFTER THE NUMBER in Haitian, like French and unlike Lingala — `45 kilomèt`,
 *  `2,680 mèt`, `15 kilogram`, `239,567 kilomèt kare`. So the rewrite does NOT reorder.
 *
 *  ⚠ AND THE SQUARED/CUBED WORD IS A POSTPOSED MODIFIER ON THE UNIT NOUN, `kare` / `kib`, spelled into the
 *  key rather than declared: `kilomèt kare` ×24 (`Gana gen yon sifas anviwon 239,567 kilomèt kare`),
 *  `mèt kare` ×11, `mèt kib` ×3 (`100 milyon mèt kib bwa`). Bare `kare` ×127 is mostly the SHAPE and bare
 *  `kib` ×17 is mostly an ICE CUBE (`plato kib glas`) — the collocation is the attestation, never the
 *  modifier alone.
 *
 *  ⚠ ONLY MULTI-LETTER KEYS, AND `m` IS THE ONE THAT COSTS SOMETHING TO LEAVE OUT. Digit-adjacent `m` is
 *  ×465 in Creole text and a large share are genuine metres, but this corpus writes `107 m jou lane`
 *  (an abbreviation of *myèm*, the ordinal!) and `329 m nan lane bisektil` in its date articles — a
 *  one-letter key would read the day-of-year ordinal as a length. That is trap 28/46's shape with the
 *  language supplying its own counter-example, so `m` stays out and `mèt` is reached only through `m²`/`m2`.
 *
 *  ⚠ THE SLASHED UNIT IS NOW CLAIMED, AND THIS PARAGRAPH USED TO SAY THE OPPOSITE. It read: *"`km/h` ×9 has
 *  no attested Haitian reading (`kilomèt` is attested, the per-hour idiom is not)"*, and the trailing guard
 *  still rejects a `/` for exactly the reason given then — `9 km/h` must never read `9 kilomèt` with a
 *  stranded `/h`. What changed is the evidence, not the reasoning: the refusal was measured on the MINED
 *  ARTIFACT, and ht.wikipedia writes the idiom out in full, in the same meteorological register as every
 *  leaking line (tools/corpus/attest/ht.jsonc):
 *
 *      pa èdtan   2 tokens / 2 articles   `van ki ap soufle omwen a 120 KILOMÈT PA ÈDTAN`
 *                                         `ki sikile a 185 KILOMÈT PA ÈDTAN`
 *      èdtan     70 / 20                  `8 èdtan PA jou` — the same connective, a different denominator
 *
 *  Two hits is thin and is stated as thin; what makes it usable is that both are the WHOLE PHRASE this rule
 *  emits, number-first and postposed, next to the very noun already declared. ⚠ `alè` (×28) also occurs in a
 *  rate — `premye tren a vapè Ozetazini ki depase vitès 100 mil ALÈ` — but the other 27 are "on time" / "at
 *  the moment" (`yon objè nan yon pwen alè`), so `pa èdtan` is the form taken and `alè` is not claimed.
 *  See RATE below. */
const UNITS: readonly (readonly [string, string])[] = [
    // longest key first — `km²`/`km2` must be tried before `km`, or the exponent is orphaned as a number.
    ["km²", "kilomèt kare"], ["km2", "kilomèt kare"],
    ["m²", "mèt kare"], ["m2", "mèt kare"],
    ["m³", "mèt kib"], ["m3", "mèt kib"],
    ["km", "kilomèt"], ["cm", "santimèt"], ["mm", "milimèt"], ["kg", "kilogram"],
];

/** THE SAME SYMBOLS STANDING ALONE. Every arm of the unit step needs a numeral, so a bare `km` — a caption,
 *  a table header, or a figure whose numeral a bracket or an `&nbsp;` put out of reach — went to the phoneme
 *  sink as raw ASCII, which in a Latin-script language no leak gate can see. The guards are the shared ones
 *  (core/normalizeSymbols.ts): multi-letter vowel-free keys only, so the exponent keys and any one-letter
 *  hazard are excluded automatically; exact case; and never beside a numeral, a rate slash or an exponent. */
const BARE_UNITS = makeBareUnitNormalizer(UNITS);

/**
 * ⚠ AND THE SAME THING WITH AN EXPONENT ON IT, WHICH THE SHARED PASS CANNOT REACH BY CONSTRUCTION. Its
 * trailing guard excludes `²³` outright and `isBareUnitKey` rejects a key that is not all letters, so
 * `km²` standing alone is invisible to it — and this corpus has exactly that line, twice in one sentence:
 * `yon sifas tè km² ( mil kare) e donk yon dansite de abitan pou chak km² ( pou chak mil kare)`, where the
 * template lost EVERY figure and left the unit with nothing to attach to. That is the same "a figure a
 * bracket put out of reach" case `BARE_UNITS` was written for, one superscript further on.
 *
 * ⚠ THE GUARDS ARE THE STRICT ONES AND ONE OF THEM IS NOT OPTIONAL: no digit before, because a counted
 * `605 km ²` belongs to the counted arm above and running this first would strand the number. The reading
 * itself claims nothing new — `kilomèt kare` ×24, `mèt kare` ×11, `mèt kib` ×3, all in `UNITS` already.
 */
const BARE_EXPONENT_UNITS: readonly (readonly [RegExp, string])[] = UNITS
    .filter(([sym]) => /[²³]$/u.test(sym))
    .map(([sym, word]) =>
        [
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,/-])${sym.slice(0, -1)}\\s?${sym.slice(-1)}(?![\\p{L}\\p{M}\\d/])`,
                "gu",
            ),
            word,
        ] as const
    );

/**
 * ⚠ ASCENDING PAIRS ONLY, and the guards are what make this rule survivable. `\d+ ?[-–] ?\d+` matches
 *  15,665 times in the dump and 2,717 in Creole text, and a large share are not spans at all: ISBNs
 *  (`1-58432-005-2`), page ranges inside French citations (`p. 157-177`), scores, and Quran/Bible verse
 *  spans (`Travay 11:25-26`).
 *
 *  · a hyphen-digit on EITHER side rejects the ISBN and telephone chains — the pair must be the whole thing;
 *  · a preceding `:` rejects the scripture spans the clock refusal deliberately leaves alone;
 *  · NON-ASCENDING is left as the bare juxtaposition it already was: `1403-04` (a truncated year span) and
 *    `90 -00` read with a different connective, so claiming them would be confidently wrong.
 *
 *  The connective is `a`, ×398 between two numbers in Creole text and a genuine span in every instance read:
 *  `soti nan 1942 a 1945`, `Prezidan an Ayiti soti 1957 a 1964`, `Li kapab grandi 1 a 1,5m`, `long de 50cm a
 *  1,80m`, `ant tanperati ki sòti nan 15 ° C a 35 ° C`. (`rive`/`rive nan` ×460 and `jiska` ×26 also occur;
 *  `a` is the one that appears with no framing preposition, which is the slot a bare `1965-1975` is in.
 *  `ant X ak Y` ×3,938 is the FRAMED form and needs the `ant` this rule cannot supply.)
 *
 *  ⚠ THE TRAILING GUARD EXCLUDES A DOT THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK — the same correction
 *  this file already spells out for the de-grouping arms below, and this rule did not follow it. A plain
 *  `.` in the class declines the whole match at exactly a sentence end, so `1950-1960.` came back untouched
 *  and read as two cardinals with nothing between them (trap 58, `review.ts`'s `clause-final` check).
 *  `\.\d` keeps every reason the dot was there: a decimal right operand and this corpus's DOIs
 *  (`10.1111/1469-8219.00039`, whose inner pair is ascending and digit-dash-digit) are still declined.
 *  ⚠ THE COMMA STAYS IN THE CLASS. This corpus writes the DECIMAL COMMA — its own attestations are
 *  `1 a 1,5m` and `50cm a 1,80m` — so `5–13,7` must not be claimed with its fraction left behind. */
const RANGE = /(?<![\d.,:\p{L}\p{M}-])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}-]|[.,]\d)/gu;

/**
 * ⚠ THE ORDINAL IS A TAIL REWRITE OF THE CARDINAL WORD, and every pair here is attested in the corpus's own
 *  Creole prose (counts are whole-word, Creole-only). `20yèm` reads today as *ven* plus a separate *yèm* —
 *  the [t] of *ventyèm* simply missing — so the rule must build the WORD, which is trap 14's fix shape:
 *  convert the operand to words inside the rule and apply the morphology there.
 *
 *      de→dezyèm 10983 · twa→twazyèm 515 · kat→katriyèm 200 · senk→senkyèm 151 · sis→sizyèm 94 ·
 *      sèt→setyèm 76 · uit→wityèm 34 · nèf→nevyèm 53 · dis→dizyèm 86 · onz→onzyèm 8 · douz→douzyèm 31 ·
 *      trèz→trèzyèm 13 · katòz→katòzyèm 8 · kenz→kenzyèm 14 · sèz→sèzyèm 18 · ven→ventyèm 40 ·
 *      trant→trantyèm 5 · karant→karantyèm 3 · senkant→senkantyèm 1 · swasant→swasantyèm 2 ·
 *      san→santyèm 6 · mil→milyèm 1
 *
 *  ⚠ MATCHED AS A LONGEST SUFFIX, WHICH IS WHAT MAKES IT COMPOSE RATHER THAN TABULATE (trap 8, trap 13).
 *  The corpus's own compound ordinals ARE these tails: `disèt`→`disetyèm` ✓×9, `dizuit`→`dizwityèm` ✓×23,
 *  `diznèf`→`diznevyèm` ✓×35, `katrevendis`→`katrevendizyèm` ✓×1 — four attested forms that the tail rule
 *  reproduces exactly. It then derives `swasanndis`→swasanndizyèm, `swasannonz`→swasannonzyèm and
 *  `katreven`→katreventyèm the same way, none of which the corpus writes.
 *
 *  ⚠ AND THE REFUSAL FALLS OUT OF THE SAME MECHANISM. `venteyen` (21) and `katrevenen` (81) end in `-en`,
 *  which is not a key, so no tail matches and the rule returns the input untouched — `21yèm` ×22, `31yèm`
 *  ×6, and ~8 more. Nothing in 800,158 paragraphs writes any of those out, and the one external description
 *  found (howtocreole.com: "numbers ending in 1 … end in -eyinyèm, except 71st and 91st which end in
 *  -onzyèm") names exactly that set as irregular. Its other two claims — multiples of ten in `-tyèm` except
 *  70th/90th in `-dizyèm` — are what the composition already produces, which is why the composition is
 *  trusted and the one gap is left unread rather than filled from a single blog. */
const ORDINAL_TAIL: readonly (readonly [string, string])[] = [
    ["senkant", "senkantyèm"], ["swasant", "swasantyèm"], ["karant", "karantyèm"], ["katòz", "katòzyèm"],
    ["trant", "trantyèm"], ["douz", "douzyèm"], ["trèz", "trèzyèm"], ["kenz", "kenzyèm"], ["senk", "senkyèm"],
    ["onz", "onzyèm"], ["sèz", "sèzyèm"], ["ven", "ventyèm"], ["nèf", "nevyèm"], ["sis", "sizyèm"],
    ["sèt", "setyèm"], ["uit", "wityèm"], ["dis", "dizyèm"], ["san", "santyèm"], ["mil", "milyèm"],
    ["kat", "katriyèm"], ["twa", "twazyèm"], ["de", "dezyèm"],
];

/** The Haitian ordinal for `n`, or `undefined` when the composition has no attested tail (the `-en` band). */
function ordinalWord(n: number): string | undefined {
    if (n === 1) return "premye"; // suppletive, ×6,723 — never *enyèm
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    const words = numberToWords(n).split(" ");
    const last = words[words.length - 1]!;
    // Longest tail first, so `katòz` is not decided by `kat` and `senkant` is not decided by `senk`.
    let best: readonly [string, string] | undefined;
    for (const pair of ORDINAL_TAIL)
        if (last.endsWith(pair[0]) && (best === undefined || pair[0].length > best[0].length)) best = pair;
    if (best === undefined) return undefined;
    words[words.length - 1] = last.slice(0, last.length - best[0].length) + best[1];
    return words.join(" ");
}

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period. Taken from the
 * Swahili and Lingala layers. `body` is the abbreviation WITHOUT its final dot; the dot is consumed only
 * when the sentence visibly continues.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[ \u00a0]*(?:$|\\p{Lu}))`, "gu");  // space, NBSP
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return s.replace(atEnd, `${word}.`).replace(inline, word);
}

/** Haitian Creole text normalization: symbols, numbers and ordinals → words the g2p already speaks. */
export function normalizeHaitian(input: string): string {
    // 0) NFC at the entry, so a literal in this file matches whichever normalization the corpus used.
    //    Haitian writes `è ò é à` and all four precompose, so a rule keyed on `kilomèt` or `sèt` would
    //    otherwise match only the composed half of its instances — trap 11, in a Latin script. The g2p
    //    NFCs again downstream, so this costs nothing.
    let s = input.normalize("NFC");

    // 1) ZERO-WIDTH MARKS AND HTML ENTITIES, first. 333 zero-width characters in the Creole subset — the
    //    corpus writes `lèt ​​​​,` and `Larisi ​​ak` with runs of U+200B — and `&nbsp;` must go BEFORE the
    //    ampersand rule at step 13, or it is read as "and" plus the letters n-b-s-p. This corpus has the
    //    entity in a SPACED form too (`[ ref. & nbsp; nesesè ]`), which is why the entity arm allows a gap.
    s = s.replace(/&\s?nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/[​‌‍﻿]/gu, "");

    // 2) ERA MARKERS AND DOTTED ABBREVIATIONS, before anything can read an interior dot as a phrase break,
    //    and before the de-grouping at step 4 for the reason the Lingala layer gives: both look at dots.
    //    ⚠ LONGEST BODY FIRST — `av. J.-C.` must be claimed before a bare `J.-C.` can bite into its tail.
    //    ⚠ THE ERA PHRASE IS THE CORPUS'S OWN GLOSS OF ITS OWN ABBREVIATION, which is the strongest form of
    //    attestation there is: `anviwon ane 12 800 anvan Jezi Kris (av. J.-K.)`. The spelled-out Creole
    //    phrases are independently frequent — `anvan epòk nou an` and `anvan Jezikri` ×87 between them.
    for (const [body, word] of [
        ["av\\.\\s?J\\.-?[CK]", "anvan Jezi Kris"],
        ["ap\\.\\s?J\\.-?[CK]", "apre Jezi Kris"],
        ["J\\.-[CK]", "Jezi Kris"],
    ] as const) s = expandDotted(s, body, word);
    //    `p.` / `pp.` before a page number → `paj`. ×68 in Creole text (×564 in the dump, i.e. mostly inside
    //    French bibliographies), and the defect is the spurious CLAUSE BREAK at the dot, not a missing word:
    //    `1976, p. 157-177` broke into two sentences. `paj` is the ordinary Creole word and the corpus uses
    //    it in this exact slot (`242 paj`, `20 paj`). Guarded on a following digit so an initial (`A. p.`)
    //    is untouched.
    s = s.replace(/(?<![\p{L}\p{M}])pp?\.\s?(?=\d)/gu, "paj ");

    // 3) ISBN, before every numeric rule — an identifier is read DIGIT BY DIGIT, not as a quantity. ×70 in
    //    Creole text, ×593 in the dump, and it is the one place a raw digit reaches the IPA: a 13-digit run
    //    exceeds the engine's `n < 1e12` guard and LEAKS (44 such runs in the dump). The hyphenated form
    //    otherwise read as four separate cardinals — a catalogue number spoken as arithmetic.
    //    ⚠ MUST PRECEDE THE RANGE RULE. `ISBN 1-58432-005-2`'s inner pairs are exactly the shape RANGE looks
    //    for; claiming the identifier whole removes the question.
    s = s.replace(/(?<![\p{L}\p{M}])(ISBN(?:[- ]1[03])?)#?\s*:?\s*([\d][\d– -]*[\dXx])/gu,
        (_m, tag: string, body: string) => `${tag} ${[...body.replace(/[– -]/gu, "")].join(" ")}`);

    // 4) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number. All three separators are in use in Creole text:
    //
    //        comma   26,338 km2 / 2 470 762 → ×3,861      the dominant form (American convention)
    //        space   1 250 257,6 / 100 000  → ×577        the French convention
    //        dot     10.005 / 1.180         → ×321
    //
    //    ⚠ EXACTLY THREE DIGITS PER GROUP is the whole discriminator, because BOTH marks are also this
    //    corpus's decimal separators — comma-decimal ×585, dot-decimal ×1,443 on a 1–2 digit tail. The two
    //    conventions coexist inside one wiki and even inside one sentence: `10.005 divize an de ap bay
    //    5.002,50` uses the dot for thousands and the comma for the decimal, while `mayitid-7.0` and
    //    `0.03 pousan` use the dot for the decimal. Requiring three digits separates them.
    //    ⚠ THE COST IS REAL AND IS STATED RATHER THAN HIDDEN: a decimal whose tail happens to be exactly
    //    three digits is de-grouped and read as an integer. `365,256 jou solè` (the sidereal year) is this
    //    corpus's clearest instance. That is the trap-28 shape — say both numbers, 3,861 against a handful.
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    refuses to de-group a number followed by its own sentence comma.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d]|,\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:\.\d{3})+)(?![\d]|\.\d)/gu, (w) => w.replace(/\./gu, ""));
    //    The SPACE form must additionally reject a bare adjacency that is really two numbers in a list;
    //    requiring every group to be exactly three digits does that (`ant 1854 ak 1889` has no 3-digit
    //    group). The corpus uses both U+0020 and U+00A0 here.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]|[ \u00a0\u202f\u2009]\d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));

    // 4b) THE MINUS — U+2212 ONLY. ⚠ THIS REVERSES THIS FILE'S OWN EARLIER REFUSAL (see the header), and
    //    the reversal is about WHICH CHARACTER is claimed, not about new evidence for the word.
    //    The refusal stands for the ASCII hyphen and stands for `mwen`: the maths-article self-gloss
    //    (`(-2) se mwen de`) proposes a word homographic with the 1SG pronoun — the commonest word in the
    //    language — and the hyphen's own population here is ~36 BCE years (`etabli nan -509`) and ISBNs.
    //    Reading either would be worse than silence.
    //    What is claimed instead is `mwens` — the language's actual comparative, ×569, and the direct
    //    reflex of French *moins*, which is the standard minus word in the parent language — in front of
    //    U+2212 only. ⚠ THE WEAKNESS, STATED: `mwens` is never once digit-adjacent in 569 instances, so
    //    this is the CONCEPT sourced and the construction inferred, the kurmanji `negatîf` shape. It is
    //    read rather than dropped because omitting a minus INVERTS the value, and `mwens ven degre` is at
    //    worst an odd register for a reading that is otherwise the wrong temperature by forty degrees.
    //    Corpus instance claimed: `−20°C`. The 6 temperatures written with a hyphen stay silent.
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)\u2212(?=\p{Nd})/gu, "mwens ");

    // 5) UNITS, before decimals — the number-unit adjacency this rule matches on is destroyed the moment a
    //    decimal is rewritten (the playbook's standing coupling), and after de-grouping so `1 250 257,6 km²`
    //    and `26,338 km2` are already one token. The unit is POSTPOSED, as Haitian writes it.
    //    ⚠ THE OPERAND MUST INCLUDE ITS OWN DECIMAL TAIL, or the rule matches the FRACTIONAL part and splits
    //    the number in half — `10.4 milyon km 2` would leave `10.` behind as a sentence break.
    //    ⚠ THE LEADING GUARD REJECTS A DOT so a dotted designation (`802.11n`) cannot start a match inside
    //    its fractional part — trap 28's lookbehind, which a lookahead alone cannot supply. There are 10
    //    version-dots in this corpus, so the guard is cheap robustness rather than a measured repair; it
    //    matters that step 4 has spent every GROUPING dot but not the decimal one, so the character the
    //    guard inspects still exists at this point (trap 39).
    //    ⚠ THE TRAILING GUARD ALSO REJECTS `/`, which is what leaves `km/h` alone — see UNITS.
    //    ⚠ AND A SPAN TAKES ITS UNIT ONCE, AT THE END: `1 a 1,5m`, `long de 50cm a 1,80m`, `50-53 °`. The
    //    single-operand arm below would otherwise reach the SECOND operand of a hyphen span on its own and
    //    strand the unit inside it, so the span arm runs first and re-emits both endpoints — and it has to
    //    run HERE rather than after step 7, because step 7 would already have spent the dash.
    // ⚠ THE RATE FIRST, BEFORE ANY ARM THAT TAKES A UNIT ON ITS OWN. `63 km/h` has a number adjacent to
    //    `km`, so the single-operand arm below would claim it, emit `63 kilomèt` and leave `/h` stranded —
    //    which is exactly the new defect the old refusal was protecting against. Claiming the whole phrase
    //    first is what makes it safe to claim at all. Word order is the ordinary one for this language:
    //    number, unit noun, connective, denominator — `120 kilomèt pa èdtan`, the corpus's own sentence.
    for (const [sym, word] of UNITS) {
        if (/[²³23]$/u.test(sym)) continue; // a rate never carries an exponent on its NUMERATOR here
        s = s.replace(
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,])(\\d+(?:[.,]\\d+)?)\\s?${sym}\\s?/\\s?(h|èdtan)(?![\\p{L}\\p{M}\\d])`,
                "gu",
            ),
            `$1 ${word} pa èdtan`,
        );
    }
    for (const [sym, word] of UNITS) {
        // ⚠ THE EXPONENT MAY BE SET OFF BY A SPACE, and this corpus does it often enough to matter:
        // `10.4 milyon km 2`, `2.7 milyon km 2`, `yon zòn sèlman 605 km ²`. So a key whose last character
        // is the power admits one optional gap before it — the same shape the Hindi run found as `km ²`.
        const key = sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/([²³23])$/u, "\\s?$1");
        // ⚠ A MAGNITUDE WORD MAY STAND BETWEEN THE NUMBER AND ITS UNIT, which destroys the adjacency every
        // arm below matches on: `Ak yon sifas tè 30 milyon km2`, `8.6 milyon km²`. Claimed first, because
        // the single-operand arm cannot see past the word and would leave the unit raw (this is the shared
        // tier's `magAltU` hop, done locally for the same reason the rest of this step is local).
        s = s.replace(
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,])(\\d+(?:[.,]\\d+)?)\\s?(milyon|milya|mil)\\s?${key}(?![\\p{L}\\p{M}\\d/])`,
                "gu",
            ),
            `$1 $2 ${word}`,
        );
        s = s.replace(
            new RegExp(`(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)\\s?[-–—]\\s?(\\d+)\\s?${key}(?![\\p{L}\\p{M}\\d/])`, "gu"),
            (whole: string, a: string, b: string) => (Number(a) < Number(b) ? `${a} a ${b} ${word}` : whole),
        );
        s = s.replace(
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,])(?<!\\d\\s?[-–—]\\s?)(\\d+(?:[.,]\\d+)?)\\s?${key}(?![\\p{L}\\p{M}\\d/])`,
                "gu",
            ),
            `$1 ${word}`,
        );
    }
    // …and the ones with NO numeral at all — see BARE_UNITS. Last, so the counted arms above keep every
    // match they can make and only what they could not reach is left for this.
    s = BARE_UNITS(s);
    for (const [re, word] of BARE_EXPONENT_UNITS) s = s.replace(re, word);

    // 6) THE DEGREE SIGN, WHICH DOES FIVE DIFFERENT JOBS ON THIS WIKI — and only two of them are a degree.
    //    Measured over the 276 `°` in Creole text (the Lingala layer records the same hazard with four jobs;
    //    Haitian adds the birth marker):
    //
    //        coordinate            80   17°29′57″ S · 52°21′ S · (37°21' N)
    //        number + ° (angle)    59   23° · 180 ° · yon ang 50-53 ° · meridyen 53° O
    //        scale °C / °F         57   15 ° C a 35 ° C · −20°C · 26 °C
    //        numero n° / N °       45   Symphonie n°1 · wout nasyonal N ° 1
    //        birth marker (° )     28   Maurice Chevalier, aktè ak chantè fransè (° ) · (° 1657)
    //
    //    ⚠ THE NUMERO ARM RUNS FIRST because it is the one that must not reach the degree arm, and it needs
    //    no new vocabulary: `nimewo` ×381 is the ordinary Creole word and the corpus uses it in exactly this
    //    slot (`li te rive nan nimewo 117 sou Billboard 200 la ak nimewo 50`). Reading `n°1` as a degree —
    //    Lingala's stated worry — is avoided by reading it correctly instead.
    s = s.replace(/(?<![\p{L}\p{M}])[Nn]\s?°\s?(?=\d)/gu, "nimewo ");
    //    ⚠ THE SCALE ARM NEXT, and `degre Sèlsiyis` is the layer's best-sourced phrase: the corpus GLOSSES
    //    the symbol with it — `yon tanperati mwayèn 25 °C (25 degre Sèlsiyis)` — and writes the collocation
    //    ×16 more (`ki pi piti pase 10 degre Sèlsiyis`, `ant 9 degre Sèlsiyis ak 12 degre Sèlsiyis`).
    //    ⚠ `°F` IS NOT CLAIMED: its scale name is written `Farenheit` ×1 and `Farennayt` ×1, two spellings
    //    with one instance each, which is not a source. 6 instances, left as they were.
    //    ⚠ SAME DECIMAL-TAIL COUPLING AS STEP 5 — `-272.5 ° C` must match whole or the number is cut in two.
    s = s.replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 degre Sèlsiyis");
    //    ⚠ AND ONLY THEN THE BARE `°`, as `degre` — attested in exactly this measure slot (`kiltive ant 60
    //    degre latitid nò ak 40 degre latitid sid`, `40 a 50 degre Farenheit`). ⚠ Bare `degre` ×180 is
    //    mostly the abstract "degree/extent" (`yon gwo degre nan pouvwa politik`), so it is the COLLOCATION
    //    that licenses this and not the count — trap 37.
    //    ⚠ A DIGIT MUST PRECEDE IT. That single requirement disposes of the birth marker, whose 28 instances
    //    are `(° )` and `(° 1657)` — a `°` with nothing before it but a bracket. The primes of a coordinate
    //    (`17°29′57″`) have no attested reading and are left as they were; reading the degree and not the
    //    minutes is a partial fix, and the alternative was silence on all 139 angles and coordinates.
    //    ⚠ AND IT RE-SPACES WHEN A DIGIT FOLLOWS, because a coordinate glues the arc-minutes straight onto
    //    the sign (`52°21′`): without that, `degre` and `21` would fuse into one unreadable token.
    s = s.replace(/(?<=\d)\s?°(?![\p{L}\p{M}])/gu, (m: string, off: number, all: string) =>
        /^\s?\d/u.test(all.slice(off + m.length)) ? " degre " : " degre");

    // 7) RANGES, before percent — `70-80%` and `20-25%` are ranges OF percents (this corpus's own sentence:
    //    `Moun Ayiti se 70-80% Afriken epi 20-25% se Blan`), so the pair must be claimed while both operands
    //    are still bare digits. After de-grouping, so a grouped endpoint is one token. See RANGE for the
    //    guards and for why non-ascending pairs are left alone.
    //    ⚠ A PERCENT-TO-PERCENT SPAN NEEDS ITS OWN ARM: RANGE wants the dash to follow the DIGITS, and in
    //    `10%-15%` a `%` stands between them. It costs no new word — the connective is the same `a`.
    s = s.replace(
        /(?<![\d.,])(\d+(?:[.,]\d+)?)\s?%\s?[-–—]\s?(\d+(?:[.,]\d+)?)\s?%/gu,
        (whole, a: string, b: string) =>
            Number(a.replace(",", ".")) < Number(b.replace(",", ".")) ? `${a}% a ${b}%` : whole,
    );
    s = s.replace(RANGE, (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} a ${b}` : whole));

    // 8) PERCENT → `pousan`, POSTPOSED. ×1,449 in Creole text, the layer's largest class by a wide margin,
    //    and the best-attested word in it: `pousan` ×82 in exactly this position — `Plis pase 90 pousan nan
    //    bidjè gouvènman an`, `avèk tou 78 pousan nitwojèn, 21 pousan oksijèn ak 0.03 pousan diyoksid
    //    kabòn`, `li mande yo envesti ant 10 pousan ak 15 pousan nan salè yo`.
    //    ⚠ `pousantaj` ×138 IS A DIFFERENT WORD, not an inflection of this one — it is the noun
    //    "percentage" (`youn nan pi gwo pousantaj inegalite nan mond lan`) and never the reading of `N%`.
    s = s.replace(/(\d)\s?%/gu, "$1 pousan");

    // 9) CURRENCY. `dola` ×493, sense-checked (`90 milyon dola nan 1838`, `$19,97 milya dola`, `40 milya
    //    dola`), and POSTPOSED as the corpus writes it.
    //    ⚠ THE REDUNDANCY GUARD LOOKS RIGHT, NOT LEFT, which is the mirror image of Lingala's — because
    //    Haitian puts the currency noun AFTER the figure. The corpus writes `Ayiti te resevwa èd … nan
    //    anviwon $ 120 milyon dola` and `yon € 382 milyon dola achte nan mask`: the sign and the word state
    //    one currency twice (trap 12), so the sign is dropped and the spoken word left where the language
    //    puts it. The window spans a magnitude word, since that is what stands between them.
    //    ⚠ `US$` IS THE SAME CURRENCY NAMED TWICE TOO — the code is read as letters, so the SIGN is consumed
    //    and the CODE re-emitted. ⚠ Re-emitting it is not decoration: the first version of this line spent
    //    the whole `US$` and `US$200.000` came out as a bare *de san mil*, i.e. the rule deleted a spoken
    //    word in order to remove a symbol. Trap 10 — a rule that consumes a word must put it back.
    //    ⚠ AND THE MAGNITUDE WORD IS PART OF THE QUANTITY, WHICH DECIDES WHERE THE NOUN GOES. Both defects
    //    below were found by the corpus diff and by nothing else, which is the playbook's standing claim
    //    about this gate:
    //      · `$ 630 millions` read as *630 DOLA millions* — the currency audible in the WRONG SLOT, the
    //        Indonesian `US$` defect exactly. The magnitude has to be carried over BEFORE the noun is
    //        appended. The French plurals are in the list because this wiki's French half writes them and
    //        the same sentence mixes the two (`6,6 milliards ak $ 630 millions`).
    //      · `($1,00) dola ameriken` read as *…dola DOLA ameriken* — the redundancy guard was looking at
    //        the character after the figure and found a CLOSING BRACKET, so it never saw the word the
    //        sentence had already said. Punctuation is skipped now.
    //    ⚠ LONGEST ALTERNATIVE FIRST. A regex alternation is leftmost-first, not longest-first, so `mil`
    //    listed ahead of `millions` matched the first three letters of `630 millions` and the rule emitted
    //    *630 mil dolalions* — a word cut in half. Caught on the re-probe of the fix above.
    const MAG = "(?:milliards?|millions?|milyon|milya|mil)";
    const NAMED = new RegExp(`^[\\s)\\]]*(?:${MAG}\\s+)?(?:dola|dolar|dollars?)(?![\\p{L}\\p{M}])`, "iu");
    s = s.replace(/(?<![\p{L}\p{M}])(US)\s?\$\s?(?=\d)/giu, "$1 ");
    s = s.replace(new RegExp(`\\$\\s?(\\d(?:[\\d \u00a0,.]*\\d)?)(\\s?${MAG})?`, "giu"),  // NBSP
        (whole: string, n: string, mag: string | undefined, off: number, all: string) => {
            const quantity = `${n}${mag ?? ""}`;
            return NAMED.test(all.slice(off + whole.length)) ? quantity : `${quantity} dola`;
        });

    // 10) DECIMALS, after every rule that needs the number intact. The separator becomes `vigil`, which is
    //     the Haitian name of the mark and is attested IN THE DECIMAL SENSE four times, in four different
    //     articles: `yon rezilta ki gen senkant (,50) apre yon vigil`, `awondi yo volontèman a twa chif apre
    //     vigil la`, `nan katriyèm chif apre vigil la`, `san siy ak san vigil`. The first of those also
    //     settles HOW THE TAIL IS READ — it calls the `,50` *senkant*, i.e. the fraction is spoken as a
    //     NUMBER and not digit by digit, which is the French-lexifier convention this orthography inherits.
    //     ⚠ SO A SHORT TAIL IS LEFT AS A NUMBER AND A LONG ONE IS SPACED OUT. Two digits is what the
    //     citation covers (`,50` → *senkant*); at three or more, reading `365,256` as "two hundred fifty-six"
    //     is a claim nothing supports, so those digits go one at a time.
    //     ⚠ THE TRAILING LETTER GUARD keeps a dotted designation (`802.11a`) out, the same robustness
    //     argument as step 5.
    s = s.replace(/(?<![\d.,])(\d+)[.,](\d+)(?![\d\p{L}\p{M}])/gu, (_m, int: string, frac: string) =>
        frac.length <= 2 && !frac.startsWith("0") ? `${int} vigil ${frac}` : `${int} vigil ${[...frac].join(" ")}`);

    // 11) FRACTIONS → the ordinal-denominator idiom, which is the language's own: `prèske yon senkyèm se
    //     mizilman` ("nearly a fifth are Muslim"), `yon dizyèm milimèt`, and for numerators above one
    //     `de tyè` and `twa ka`. So `1/5` reads *yon senkyèm* and `2/3` *2 twazyèm* — the numerator is left
    //     as a digit for the number path, and `1` becomes the ARTICLE `yon` rather than the numeral `en`,
    //     because `yon senkyèm` is what the corpus writes.
    //     ⚠ THE DENOMINATOR IS CAPPED AT TEN, AND THAT CAP IS THE WHOLE RULE. `\d{1,3}/\d{1,3}` matches 69
    //     times in Creole text and only about ten are fractions. The rest are a chess score (`14/16`), a
    //     publisher's collection (`Paris, 10/18`), a year span (`-470/469`) and dates. Numerator <
    //     denominator ≤ 10 admits the real ones and none of the others.
    //     ⚠ AND THE CAP IS A RANGE, NOT A TABLE (trap 8): the rule composes through `ordinalWord`, so `3/4`
    //     reads correctly although the corpus writes it only in words.
    s = s.replace(/(?<![\d\p{L}\p{M}/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (whole, a: string, b: string) => {
        const den = ordinalWord(Number(b));
        if (den === undefined || !(Number(a) < Number(b) && Number(b) <= 10)) return whole;
        return Number(a) === 1 ? `yon ${den}` : `${a} ${den}`;
    });

    // 12) ORDINALS — this language's own suffix, not a French import, and the layer's second-largest class
    //     at ×1,259 in Creole text. `20yèm syèk` was reading as *ven* plus a bare *jɛm*; it is *ventyèm*.
    //     Three spellings occur and all three are claimed: `yèm` ×1,259, `èm` ×73 (`16èm sièk`, `329 èm
    //     jou`, `50èm anivèsè`) and `em` ×52 (`klas 4em`, `3em divizyon`). The French `ème` of the wiki's
    //     French half falls under the `èm` arm, which is the same removal-of-raw-letters the Lingala layer
    //     does; here the Creole form is the majority rather than the exception.
    //     ⚠ THE RULE DECLINES RATHER THAN GUESSES when `ordinalWord` has no attested tail — see its comment.
    //     ⚠ AND IT MUST NOT EAT A FOLLOWING WORD. The suffix may be spaced (`329 èm jou`), so the arm allows
    //     one optional space, and the trailing guard rejects a letter so `4emisyon` cannot match.
    s = s.replace(/(?<![\d\p{L}\p{M}])(\d+)\s?(?:yèm|ème|èm|em)(?![\p{L}\p{M}])/gu, (whole, n: string) =>
        ordinalWord(Number(n)) ?? whole);

    // 13) THE AMPERSAND → `ak`, the ordinary Creole conjunction, which needs no sourcing argument. ×339 in
    //     Creole text and every instance read is a bibliographic or corporate "and" — `Arends, Muysken &
    //     Smith (1995)`, `Kool & the Gang`, `Funk & Wagnalls`, `Young & Rubicam`.
    //     ⚠ SPACED ON BOTH SIDES DELIBERATELY: `A&B` deletes to `AB`, which is ONE token instead of two
    //     (traps 18 and 26), so the replacement must insert the boundary the sign was supplying.
    s = s.replace(/\s?&\s?/gu, " ak ");

    return s;
}
