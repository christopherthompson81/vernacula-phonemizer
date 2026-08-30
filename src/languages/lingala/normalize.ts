/**
 * Lingala / Lingála (ln) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR LINGALA.
 * ⚠ AND THAT SENTENCE IS NOW FALSE (#1102): `ln_cd` landed later, 1,920 unique transcript texts, and it is a
 * genuinely INDEPENDENT read-aloud corpus rather than a second sample of the wiki. ⚠ AND THE RE-MEASUREMENT HAS NOW BEEN
 * DONE FOR THE CLOCK, which is the class it changed — see the clock note below. Every OTHER "only N
 * times" in this file is still a count over the mined artifact alone: the sweep was per CLASS, not per
 * file, and the rest of #1102's expensive half is still open.
 * The evidence is `tools/corpus/mined/ln.jsonc` (dump-sourced, so its
 * `sample` tier IS the real distribution) plus a fresh ln.wikipedia dump — 23,678 paragraphs after
 * `wikidump-to-text.py` + `filter-markup.py`. Every count below is over that dump unless it says
 * otherwise. Full log: `docs/investigations/ln_normalization_investigation.md`.
 *
 * ⚠ AND THE CORPUS IS HEAVILY CODE-MIXED. A Lingala wiki carries whole French bibliographies, French
 * sentences and Portuguese quotations, so a raw count is a lead about the FILE, not about the language;
 * every number quoted here was read back to its instances before it was used. Where a class is French-only
 * the comment says so.
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — this is the defect list, not an
 * assumption about it:
 *
 *     21%            → túku míbalé na mǒkó                    the sign is SILENT (×274)
 *     5,500 bato     → mítáno , kámá mítáno bato               grouping comma → a PAUSE and a wrong number
 *     300.000 km2    → kámá mísáto . libungutúlu km míbalé     grouping dot → a SENTENCE BREAK; `2` a number
 *     1 000 000      → mǒkó libungutúlu libungutúlu            space grouping → three separate numbers
 *     4,20           → mínei , túku míbalé                     "four, twenty"
 *     0,44 km²       → libungutúlu , túku mínei na mínei km    unit raw, exponent gone
 *     -22°C          → túku míbalé na míbalé k                 sign gone, C read as a bare [k]
 *     1965-1975      → two cardinals, no connective            (×~1100 hyphen pairs, see RANGE)
 *     2/3            → míbalé mísáto                           no fraction reading
 *     b.n.b.         → b . n . b .                             three spurious clause breaks
 *     16ème          → zómi na motóbá e˩me˩                    raw suffix letters in the IPA
 *     $ £ € &        → nothing at all
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO DECIMAL-POINT WORD. `virgule` is attested on ln.wikipedia ×2 and BOTH hits are an album title
 *   ("Virgule" (2005), Extra Musica); `sources.ts` finds no `_dpt`, no `_.`, no manifest word, and espeak
 *   does not ship Lingala at all. So the fractional digits are read one at a time with NO separator word —
 *   which is what `sources.ts` itself prescribes for this case. A dropped point beats an invented one, and
 *   the defect being fixed is the spurious PAUSE and the mis-read tail, not the missing word.
 *
 * ⚠ NO MINUS WORD, AND THIS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE. Omitting a plus is lossless;
 *   omitting a minus INVERTS. The corpus's only candidate is `molongola` ×1, in "Eléktron ezalí na mokúmba
 *   ya molongola (negative "-")" — an ADJECTIVE describing a charge in a physics article, i.e. trap 37's
 *   register failure with a citation that looks right. The mined artifact's whole residual is SIX true
 *   negatives — two negative latitudes (`-4.2667`, `-4.800`), the electron charge (`-1,602 189`), absolute
 *   zero (`-273,15 °C`) and two BCE years (`mobú -753`, `mobú -3300`) — and there is no word to read them
 *   with. ⚠ SO THEY ARE NOT IN `ACCEPTED_SILENT` EITHER, and `review.ts --lang ln` stays red on them: an
 *   accepted silence claims the drop is correct, and this one is not. The gate comes green the day a
 *   Lingala negative-number word is attested, not before.
 *
 * ⚠ NO DEGREE WORD. `Celsius` ×3 and `kelvin` ×4 are attested; nothing means *degree* (`degré` ×1 is
 *   French). So `°C` reads as the scale name alone (see step 6) and the bare `°` of coordinates and angles
 *   (`4°16′S`, `90°`) is left unread rather than guessed at.
 *
 * ⚠ NO INITIALISMS. `core/initialisms.ts` exists and ~30 languages wire it, but it is a NO-OP without a
 *   `letterName` table and espeak ships no Lingala — the fleet-wide 94-language sourcing block, not a
 *   coding one (trap 16 checked: the seam exists, the DATA does not). `RDC` → [ɾdk] stands.
 *
 * ⚠ NO CLOCK. 62 colon-numerals, and the MAJORITY are scripture references (`Mt 3:16`, `Malako 16:15-18`,
 *   `Kol 1:26`); only a handful are true clocks (`ngonga ya 10:43`, `kobanda 19:00 ti 19:30`). Claiming the
 *   colon claims the references, and no Lingala reading for a digital time is attested.
 *
 * ⚠ NO `=` `×` `<` `>`. `=` counts 89 but the wiki's `==` heading markers are inside that number, and the
 *   corpus writes its own equalities in words ("Falánga ya Swisi mókó ezalí 100 centimes"). A reading built
 *   on a contaminated count is worse than silence.
 *
 * ── AND ONE FINDING THAT IS NOT THIS LAYER'S TO FIX ───────────────────────────────────────────────────
 *
 * The manifest's cardinal words `kámá` (100), `kóto` (1000) and `túkú` (tens) occur 0, 0 and 1 times in
 * 23,678 paragraphs. The corpus writes the nasal-prefixed forms — `nkámá` 237 / `nkama` 190, `nkóto` 43 /
 * `nkoto` 314, `ntúkú` 627 / `ntuku` 341 — as in "nkóto na nkámá libwá na ntúkú mísáto". Both forms are
 * real (the bare series does occur, ×~8), but the manifest ships the minority one as the only one. NOT
 * changed here: it is authored from Meeuwis (2020) on prestige Kinshasa, it rewrites every number in the
 * language, and it needs its own diff and its own sourcing argument. This layer emits DIGITS, so nothing
 * below is built on top of it. Recorded so the measurement is re-runnable in one grep.
 */
import { makeBareUnitNormalizer } from "../../core/normalizeSymbols.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { renormalize, rewrite } from "../../core/provenance.ts";

/** The ONE number word this layer emits — the suppletive first ordinal, for the French `1er`/`1ère` shape in
 *  step 12. ⚠ READ FROM THE MANIFEST RATHER THAN SPELLED HERE: the step's own comment already said the word
 *  "the manifest already declares as `firstCard`", and it did — while the code carried its own literal copy,
 *  so the key was DEAD. Sabotaging `firstCard` to nonsense changed no reading at all. A mapped key is not a
 *  read one (#901, tg's `numbers.and`), and the next person to correct this ordinal would have edited a
 *  string nothing consulted. */
const FIRST_ORDINAL = loadManifest<{ numbers: { firstCard: string } }>(
    import.meta.url,
    "lingala.jsonc",
).numbers.firstCard;

/** ⚠ THE UNIT NOUN COMES BEFORE THE NUMBER IN LINGALA, which is why units are local and not the shared
 *  tier's — `normalizeSymbols` can only POSTPOSE (playbook §47 reason 2, the Oromo case). The corpus is
 *  unambiguous: `ntaka ya kilomɛtrɛ 15`, `mɛtrɛ 1 372`, `milimɛtɛlɛ 1 174`, `dolare 1 500 kino dolare
 *  50 000`. Digit-first `15 km` is nevertheless how the SYMBOL is written (`km` after a number ×94, before
 *  ×30, and most of the 30 are `km2`), so the rewrite reorders.
 *
 *  THE SPELLINGS ARE THE CORPUS'S OWN, and there are two competing series. Running prose prefers `-mɛtrɛ`
 *  (kilomɛtrɛ ×57, mɛtrɛ ×24, milimɛtrɛ ×6); an explicit metric-definition line prefers `-mɛtɛlɛ` and is
 *  the only source that keys a word to its ABBREVIATION, which is the question here:
 *
 *      1 mɛtɛlɛ (m) = 10 desimɛtɛlɛ (dm) = 100 sɛntimɛtɛlɛ (cm) = 1000 millimɛtɛlɛ (mm)
 *      1000 mɛtɛlɛ = 1 kilómɛtɛlɛ (km)
 *
 *  So the frequent spelling is used where prose attests it and the table's where prose has none (`cm`,
 *  ×35 as a symbol and ×1 as a word — the table is exactly the slot it is authoritative for).
 *
 *  ⚠ ONLY MULTI-LETTER KEYS. `m` ×45, `s` ×26, `g` ×13, `h` ×5 and `l` ×3 all occur digit-adjacent and all
 *  the instances read are genuine, but a one-letter key is the trap-28/46 shape and this corpus's `m`/`s`
 *  hits are nearly all inside FRENCH athletics prose ("du 100 m en 11 s 07"), which is not evidence about
 *  how Lingala reads them. `ha`, `MW`, `kW`, `t` have no attested Lingala word at all. Left unread.
 *
 *  ⚠ AND THE SQUARED WORD IS A SUFFIX, NOT A MODIFIER. `kare` ×11, every instance welded to the unit noun
 *  with a hyphen and preceding the figure: `kilomɛtrɛ-kare 79 906`, `mɛtrɛ-kare 17 000`, and once glossed
 *  against the imperial form — `kilomɛtrɛ-kare 600 (230 pieds carrés)`. That fixes both the word and its
 *  position, so no `exponentWords` declaration could express it and it is spelled into the key. */
const UNITS: readonly (readonly [string, string])[] = [
    // longest key first — `km²`/`km2` must be tried before `km`, or the exponent is orphaned as a number.
    ["km²", "kilomɛtrɛ-kare"], ["km2", "kilomɛtrɛ-kare"],
    ["m²", "mɛtrɛ-kare"], ["m2", "mɛtrɛ-kare"],
    ["km", "kilomɛtrɛ"], ["cm", "sɛntimɛtɛlɛ"], ["mm", "milimɛtrɛ"], ["kg", "kilogálame"],
];

/** THE SAME SYMBOLS STANDING ALONE. Every arm of the unit step needs a numeral, so a bare `km` — a caption,
 *  a table header, or a figure whose numeral a bracket or an `&nbsp;` put out of reach — went to the phoneme
 *  sink as raw ASCII, which in a Latin-script language no leak gate can see. The guards are the shared ones
 *  (core/normalizeSymbols.ts): multi-letter vowel-free keys only, so the exponent keys and any one-letter
 *  hazard are excluded automatically; exact case; and never beside a numeral, a rate slash or an exponent. */
const BARE_UNITS = makeBareUnitNormalizer(UNITS);

/** ⚠ ASCENDING PAIRS ONLY, and the guards are what make this rule survivable at all. `\d+ ?[-–] ?\d+`
 *  matches 1,141 times in this corpus and the great majority are NOT ranges: ISBNs (`1-59427-034-1`),
 *  ISO codes (`639-3`), scripture spans (`16:15-18`), scores (`0 - 3`) and telephone codes.
 *
 *  · a hyphen-digit on EITHER side rejects the ISBN/telephone chains — the pair must be the whole thing;
 *  · a preceding `:` rejects the scripture spans, which the colon rule deliberately does not claim;
 *  · NON-ASCENDING is left as the bare juxtaposition it already was (the Swahili precedent): a score reads
 *    with a different connective, so claiming it would be confidently wrong. ⚠ That test alone is what
 *    rejects this corpus's commonest hyphen shape, the BIRTH–DEATH pair — `(6 mársi 1475 - 18 febwáli
 *    1564)` offers the regex `1475 - 18`, and it is descending, so it falls out for free.
 *  · A SPACED dash additionally needs a 2+ DIGIT operand, and this arm is measured rather than assumed.
 *    Of the 185 spaced pairs, the only ASCENDING single-digit ones are 7 retellings of one football score
 *    (`na score ya 0 - 3 pona ba Italiens`) — a shape the ascending test cannot catch because 0 < 3. There
 *    is no genuine `d - d` range in the corpus at all, so the guard costs nothing and removes 4 misreads.
 *    Unspaced `2-3%` and `7-9 T.B.` are unaffected, which is where the real short ranges live.
 *
 *  The connective is `kino`, ×248 between two numbers and a genuine span in every instance read:
 *  `na mibu 1600 kino 1850`, `mikolo 30 kino 180`, `10 kino 30% ya batu`, `kilomɛtɛlɛ 1 kino 4`.
 *  (`na` ×82, `mpe` ×73 and `tii` ×43 also occur; `kino` is the plurality and the least ambiguous — `na`
 *  and `mpe` are the ordinary conjunctions and already carry the numeral compounds.)
 *
 *  ⚠ THE TRAILING GUARD EXCLUDES A DOT THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK — the same correction
 *  this file already spells out for the de-grouping arms, and this rule did not follow it. A plain `.` in
 *  the class declines the whole match at exactly a sentence end, so `1876-1900.` came back untouched and
 *  read as two cardinals with nothing between them (trap 58, `review.ts`'s `clause-final` check). `\.\d`
 *  keeps every reason the dot was there: a decimal right operand and the bibliography's DOIs, whose inner
 *  pairs are ascending and digit-dash-digit, are still declined.
 *  ⚠ THE COMMA STAYS IN THE CLASS: this corpus writes the DECIMAL COMMA, so `5–13,7` must not be claimed
 *  with its fraction left behind. */
const RANGE = /(?<![\d.,:\p{L}\p{M}-])(\d+)(\s?)[-–—]\s?(\d+)(?![\d\p{L}\p{M}-]|[.,]\d)/gu;

/** Era markers, sourced from the corpus text that spells them out BESIDE the abbreviation — the strongest
 *  form of attestation there is, because the source document glosses itself:
 *
 *      Na mobu 1792 liboso ya ntango na biso. T.B., Hammurabi, mokonzi moko ya Ba-Amor …
 *      … kati na mobu 1100 mpe 800 liboso ya ntango na biso. L.T.B., Babilone ekómaki …
 *
 *  All 7 `T.B.` and both `L.T.B.` sit immediately after that phrase, so `T.B.` = *tango na biso* ("our
 *  time") and `L.T.B.` = *liboso ya tango na biso* ("before our time") = BCE. The Christian pair is
 *  independent: `1979 ezalí mobú ya 1979 n. Y.K.` and `útá 311 tíí 385 yambo Y.K.` give `Y.K.` = *Yézu
 *  Klísto* with `n.` = nsima ya (AD) and `yambo` = before (BC).
 *
 *  ⚠ LONGEST BODY FIRST. `L.T.B.` must be claimed before `T.B.` can bite into its tail, and `n. Y.K.`
 *  before bare `Y.K.` — the multi-dot-before-single-dot coupling, applied to overlapping bodies. */
const DOTTED: readonly (readonly [string, string])[] = [
    ["L\\.T\\.B", "liboso ya tango na biso"],
    ["T\\.B", "tango na biso"],
    ["n\\.\\s?Y\\.K", "nsima ya Yézu Klísto"],
    ["Y\\.K", "Yézu Klísto"],
    // `b.n.b.` ×31, always closing a list; the expansion `bôngó na bôngó` ×18, always in that same "and so
    // on" slot ("… mabé, libóta mpé bôngó na bôngó"). Lingala's `etc.`.
    ["b\\.n\\.b", "bôngó na bôngó"],
];

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period.
 *
 * Taken from the Swahili layer, and it earns its keep here too: `b.n.b.` closes a LIST and therefore ends
 * a sentence most of the time, so a naive expansion deletes that pause. The dot is consumed only when the
 * sentence visibly continues; when what follows is the end of the input or a capital, the period is kept.
 * `body` is the abbreviation WITHOUT its final dot.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[ \u00a0]*(?:$|\\p{Lu}))`, "gu");  // space, NBSP
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return rewrite(rewrite(s, atEnd, `${word}.`), inline, word);
}

/** Every rule here emits DIGITS wherever a number is involved and lets the engine's own number path speak
 *  them, so this layer spells no number word of its own — which is also why the `kámá`/`nkámá` question
 *  in the header is orthogonal to it. ⚠ THE ONE EXCEPTION IS THE SUPPLETIVE FIRST ORDINAL of step 12, and it
 *  is READ FROM THE MANIFEST (`FIRST_ORDINAL`) rather than spelled here, so the exception cannot drift from
 *  the language's own data. */
/**
 * A CLOCK'S COLON LOSES ITS PAUSE BEHIND A DAY-PART OR TIMEZONE MARKER — and nothing else (#1102).
 *
 * ⚠ THE REFUSAL ABOVE IS RIGHT ABOUT THE MINED TEXT, where most `N:NN` are SCRIPTURE REFERENCES
 * (`Kol 1:26`) and "only a handful are true clocks". Over FLEURS `ln_cd` the mix is the other way — but the
 * conclusion is unchanged, because the rule is keyed on the MARKER rather than on the shape: `10:08 ya
 * butu`, `1:15 na ntongo`, `8:46 na ntongo`, `11:35 ya butu`, `15.00 UTC`, `10:00-11:00 ya butu MDT`.
 * ⚠ NO VERSE REFERENCE CARRIES ONE, and neither do the FLEURS sports times `4:41.30` / `2:11.60` /
 * `1:09.02`. The bare clocks (`Na 11:20`, `Pene ya 11:29`) keep their pause; a shape-keyed rule that
 * reached them would reach `Kol 1:26` too.
 * ⚠ NO WORD IS EMITTED — the day-part is already written.
 * ⚠ THE TRAILING GUARD REJECTS A DIGIT OR A SEPARATOR THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK. Written
 * as `(?![\d.,:])` it declined every clock that ENDS A CLAUSE — `kusaawa 11:29,` and `ssaawa 11:00,` came
 * back untouched, which is trap 58 and is how half the marked instances were being missed.
 */
const CLOCK_MARKED =
    /(?<![\d.,:])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)(?=\s*(?:na\s+ntongo|ya\s+butu|UTC|GMT|MDT)\b)/giu;

export function normalizeLingala(input: string): string {
    // 0) THE MARKED CLOCK loses the colon's pause — see CLOCK_MARKED. First, so every numeric step below
    //    sees one digit run rather than two.
    input = rewrite(input, CLOCK_MARKED, "$1 $2");
    // 0) NFC at the entry, so a literal in this file matches whichever normalization the corpus used.
    //    Lingala writes `é á ó ô ǒ` (which precompose) beside `ɛ́ ɔ́` (which cannot), so its text is
    //    inherently mixed-normalization and a rule keyed on `bôngó` would otherwise match about half its
    //    instances — trap 11, in a Latin script. The engine NFDs again downstream, so this costs nothing.
    let s = renormalize(input, "NFC");

    // 1) HTML ENTITIES AND ZERO-WIDTH MARKS, first — a dump carries `&nbsp;` and `&#xFEFF;` (×21 zero-width
    //    in the corpus) and both must go BEFORE the ampersand rule at step 13, or `&nbsp;` is read as the
    //    word "and" followed by the letters n-b-s-p. `&#xFEFF;` is a rendering hint, not speech.
    s = rewrite(rewrite(s, /&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " "), /[​‌‍﻿]/gu, "");

    // 2) ERA MARKERS AND DOTTED ABBREVIATIONS, before anything can read an interior dot as a phrase break.
    //    ⚠ This must also precede step 4: `L.T.B.` and the grouping-dot rule are both looking at dots, and
    //    a de-grouping pass that ran first would leave nothing recognisable. In practice they cannot
    //    collide (the bodies are letters), but the ordering is the one that stays correct if either widens.
    for (const [body, word] of DOTTED) s = expandDotted(s, body, word);

    // 3) ISBN, before every numeric rule — an identifier is read DIGIT BY DIGIT, not as a quantity, and it
    //    is the one place in this corpus where a raw digit reaches the IPA. ×285, in a dozen hyphenation
    //    shapes (`ISBN 2873863412` ×75, `ISBN 978-2-8111-0716-6` ×19, …). Two distinct defects:
    //      · a 13-digit run exceeds the engine's `n < 1e12` number guard, so it LEAKS: `ISBN 9780829703962`
    //        reached the phoneme string as those literal digits — the corpus's only DIGIT leak;
    //      · a hyphenated one read as four separate CARDINALS (`kóto mwambe na kámá mǒkó …`), which is a
    //        catalogue number spoken as arithmetic.
    //    ⚠ MUST PRECEDE THE RANGE RULE AS WELL AS DE-GROUPING. RANGE already rejects a hyphen CHAIN, but
    //    `ISBN 2-84586-494-9`'s inner pairs are exactly the shape it looks for, and one fewer group would
    //    hand it a bare ascending pair. Claiming the identifier whole removes the question.
    s = rewrite(s, /(?<![\p{L}\p{M}])(ISBN(?:[- ]1[03])?)\s*:?\s*([\d][\d– -]*[\dXx])/gu,
        (_m, tag: string, body: string) => `${tag} ${[...body.replace(/[– -]/gu, "")].join(" ")}`);

    // 4) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number (`5,500` → *mítáno , kámá mítáno*; `300.000` → a
    //    SENTENCE BREAK). Lingala's wiki uses all three separators, so all three are claimed:
    //
    //        space  1 800 / 87 009 / 1 000 000     ×235   the dominant native form
    //        dot    1.180 / 24.383.301             ×136
    //        comma  5,500 / 295,658                ×93
    //
    //    ⚠ EXACTLY THREE DIGITS PER GROUP is the whole discriminator, because the same two marks are also
    //    this corpus's decimal separators (comma-decimal ×149, dot-decimal ×133 on a 1–2 digit tail). Every
    //    `\d{1,3}[.,]\d{3}` instance was read: the dot is grouping 136/136 (Portuguese-text years `em
    //    1.492` de-group correctly), the comma 91/93. ⚠ THE COST IS THE OTHER 2 — the atomic masses
    //    `masi ya atomi ma yango ezalí 6,941` (lithium) and `10,811` (boron) are decimals and will now read
    //    as 6941 and 10811. 91 against 2 is the trap-28 shape: state both numbers.
    //
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    refuses to de-group a number followed by its own sentence comma, so `24,000, na wengine` would
    //    split off `000` and speak it as zero.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)/gu, (w) => w.replace(/,/gu, ""));
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?![\d]|\.\d)/gu, (w) => w.replace(/\./gu, ""));
    //    The SPACE form additionally has to reject a bare adjacency that is really two numbers in a list.
    //    Requiring every group to be exactly three digits does that: `mibu 1600 kino 1850` has no 3-digit
    //    group, and `sanza 9 1946` is not `\d{1,3}( \d{3})+` because 1946 is four.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 5) UNITS, before decimals — the number-unit adjacency a unit rule matches on is destroyed the moment
    //    a decimal is rewritten into spaced digits (playbook step 4's standing coupling), and after
    //    de-grouping so `1 800 km` and `87 009 km2` are already one token. The rewrite REORDERS, because
    //    Lingala puts the unit noun first; see UNITS for the sourcing and for why `m`/`s`/`g`/`h` are out.
    //
    //    ⚠ THE TRAILING GUARD IS `(?![\p{L}\p{M}\d])` AND THE LEADING ONE REJECTS A DOT. Neither is
    //    decorative: without the first, `km` bites into `kmɛ…`-shaped words and `m2` into a longer token;
    //    without the second, a dotted designation (`802.11n`) can start a match inside the fractional part
    //    — trap 28's lookbehind, which a lookahead alone cannot supply. This corpus contains ZERO dotted
    //    designations, so the guard is robustness for plausible input rather than a measured repair, and
    //    it costs nothing to keep. It also matters that step 3 has already spent every GROUPING dot but not
    //    the decimal one, so the character the guard inspects still exists here (trap 39).
    //    ⚠ THE OPERAND MUST INCLUDE ITS OWN DECIMAL TAIL, `(\d+(?:[.,]\d+)?)`, or this rule matches the
    //    FRACTIONAL part and splits the number in half. Measured on the corpus's own `0,44 km²`: a bare
    //    `\d+` matched `44 km²` and emitted `0,kilomɛtrɛ-kare 44` — the comma then survived as a clause
    //    PAUSE and the quantity read as forty-four. The decimal is left written here and step 10 speaks it.
    //    ⚠ A SPAN TAKES ITS UNIT ONCE, IN FRONT, and this arm is why the unit rule has to know about ranges
    //    at all. `75 - 90 cm` and `13-19 cm` (×8, the zoology infoboxes' length/weight rows and one rainfall
    //    figure) are ONE measurement with two endpoints. Without the arm the single-operand rule below
    //    reached the SECOND operand on its own — its lookbehind excludes a letter, a digit and a dot, but
    //    not a dash — and emitted `75 - sɛntimɛtɛlɛ 90`, stranding the unit inside the span and leaving the
    //    dash silent. The corpus's own shape for this is unit-once-in-front (`kilomɛtɛlɛ 1 kino 4`), so the
    //    arm reads it as `sɛntimɛtɛlɛ 75 kino 90`. Ascending-only and chain-guarded, exactly like RANGE —
    //    and it must run HERE rather than after step 7, because step 7 would already have spent the dash.
    for (const [sym, word] of UNITS) {
        const key = sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        s = rewrite(s,
            new RegExp(`(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)\\s?[-–—]\\s?(\\d+)\\s?${key}(?![\\p{L}\\p{M}\\d²³/])`, "gu"),
            (whole: string, a: string, b: string) => (Number(a) < Number(b) ? `${word} ${a} kino ${b}` : whole),
        );
        // ⚠ AND THE SINGLE-OPERAND ARM MUST REFUSE A SPAN'S SECOND HALF, which is the defect above stated as
        // a guard: a descending or chained span the arm just declined must reach RANGE whole, not with its
        // tail already rewritten. `(?<!\d\s?[-–—]\s?)` is narrower than putting the dash in the main
        // lookbehind, which would also have blocked a genuine negative measurement.
        s = rewrite(s,
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,])(?<!\\d\\s?[-–—]\\s?)(\\d+(?:[.,]\\d+)?)\\s?${key}(?![\\p{L}\\p{M}\\d²³/])`,
                "gu",
            ),
            `${word} $1`,
        );
    }
    // …and the ones with NO numeral at all — see BARE_UNITS. Last, so the counted arms above keep every
    // match they can make and only what they could not reach is left for this.
    s = BARE_UNITS(s);

    // 6) DEGREES — the scale name only, because no Lingala word for *degree* is attested (`Celsius` ×3,
    //    `kelvin` ×4, and `degré` ×1 is French). `25 °C` → *Celsius 25*, unit-first like every other
    //    measure in step 5, so the two rules read the same way round.
    //    ⚠ THE BARE `°` IS LEFT ALONE. Its 123 instances are coordinates and angles (`4°16′S`, `77° 02’
    //    12’’ W`, `kofungwama ya 90°`) and there is no word for either the degree or the primes. Reading
    //    the scale letter but not the sign is a PARTIAL fix, and the alternative was `C` → a bare [k].
    //    ⚠ SAME DECIMAL-TAIL COUPLING AS STEP 5, and the corpus proves it: `-273,15 °C` matched on `15 °C`
    //    alone and read *… kámá míbalé na túku sambo na mísáto , CELSIUS zómi na mítáno* — the number cut
    //    in two at the comma, which is precisely the defect this layer exists to remove.
    s = rewrite(s, /(?<![\d.,])(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])/gui, "Celsius $1");

    // 7) RANGES, before percent — `20%-40%` and `2-3% ya batu` are ranges OF percents, so the range must be
    //    claimed while both operands are still bare digits; once step 8 has inserted `likolo ya mokama`
    //    between them there is no pair left to match. After de-grouping, so a grouped endpoint is one
    //    token. See RANGE for the guards and for why non-ascending pairs are left alone.
    //    ⚠ A PERCENT-TO-PERCENT SPAN NEEDS ITS OWN ARM, and it is the one place a dash may sit between two
    //    non-bare operands. `20%-40%` and `7.5%-10%` (×2, one sentence) are not reachable by RANGE at all:
    //    it wants the dash to follow the DIGITS, and here a `%` stands between them. (`7.5%` is doubly out
    //    of reach — RANGE's lookbehind refuses a `.`-preceded digit, so it cannot start at the `5`.) The
    //    `%…-…%` shape cannot be arithmetic — a difference of two percentages is not written this way — so
    //    the arm needs no ascending-vs-descending judgement beyond the one it shares with RANGE, and it
    //    costs NO NEW WORD: `kino` is the same connective, and each operand keeps its `%` for step 8.
    s = rewrite(s,
        /(?<![\d.,])(\d+(?:[.,]\d+)?)\s?%\s?[-–—]\s?(\d+(?:[.,]\d+)?)\s?%/gu,
        (whole, a: string, b: string) =>
            Number(a.replace(",", ".")) < Number(b.replace(",", ".")) ? `${a}% kino ${b}%` : whole,
    );
    s = rewrite(s, RANGE, (whole, a: string, gap: string, b: string) => {
        if (Number(a) >= Number(b)) return whole;
        if (gap !== "" && a.length < 2 && b.length < 2) return whole; // the spaced-score arm, see RANGE
        return `${a} kino ${b}`;
    });

    // 8) PERCENT — ×274, and the layer's THINNEST SOURCING, stated here rather than buried. The corpus
    //    never spells the symbol out, with exactly one exception: a Lingala constitutional text writes both
    //    arms of a pair with the figure in parentheses beside the words —
    //
    //        … zambi ya eteni ntuku minei LIKOLO YA MOKAMA (40%) mpo ya bingumba, mpé eteni ntuku motoba
    //        LIKOLO YA MOKAMA (60%) mpo ya Mbula Matari.
    //
    //    "forty over the hundred (40%)", "sixty over the hundred (60%)": the reading of the symbol,
    //    postposed after the number, arithmetically right in both arms, in native prose. `attest.ts` finds
    //    the phrase ×2 in 1 article and `pursa` / `pourcent` ABSENT; `concept.ts` has no ln label for
    //    "percent" at all; the corpus's 5 `pourcentage` are French code-switches, never a reading of `N%`.
    //    ⚠ ONE SENTENCE IS ONE SENTENCE. It is also the whole of the in-language evidence, and the
    //    alternative is 274 silent instances, so it ships — with the limit written down so the next reader
    //    re-checks it rather than inheriting it.
    s = rewrite(s, /(\d+)\s?%/gu, "$1 likolo ya mokama");

    // 9) CURRENCY. `dolare` ×16, sense-checked (`dolare ya Amerika`, `dolare milio 1,8`, `dolare 1 500`),
    //    and unit-first like every other measure noun — the corpus writes `badollar 45$` and
    //    `dolare 1 500 kino dolare 50 000`.
    //    ⚠ `US$` AND `$ USA` ARE THE SAME CURRENCY NAMED TWICE (trap 12). The corpus writes `US$200.000`,
    //    `12 $ USA` and `75 millions $ U.S.`, so the sign is consumed and the code left to be read as it
    //    was before — saying "dolare" beside a spoken "USA" would double it.
    //    ⚠ ONLY `$`. `£` ×1 and `€` ×1 are each a single parenthetical gloss beside their spelled-out name
    //    ("Bozitó Sterling (lingɛlɛ́sa: Pound Sterling, £)"), i.e. exactly the redundant position trap 12
    //    says to drop; and neither has a Lingala word attested anywhere. Left silent.
    //    ⚠ AND THE SIGN IS DROPPED, NOT READ, WHEN THE CURRENCY IS ALREADY NAMED — trap 12 again, from the
    //    other side. The corpus writes `kongwa na badollar 45$ tii na badollar 10$`, so a rule that always
    //    emits the word says it twice; the guard checks for a currency noun immediately to the left.
    const NAMED = /(?:dolare|dolar|badollar|dollars?|falánga|falanga)\s*$/iu;
    s = rewrite(s, /(?<![\p{L}\p{M}])US\s?\$\s?(\d)/giu, "dolare $1");
    s = rewrite(s, /\$\s?(\d[\d ,.]*)/gu, (whole, n: string, off: number, all: string) =>
        NAMED.test(all.slice(0, off)) ? n : `dolare ${n}`);
    s = rewrite(s, /(\d[\d ,.]*?)\s?\$/gu, (whole, n: string, off: number, all: string) =>
        NAMED.test(all.slice(0, off)) ? n : `dolare ${n}`);

    // 10) DECIMALS, after every rule that needs the number intact. The separator becomes NOTHING and the
    //    fractional digits are spaced apart so the number path speaks them one at a time — see the header
    //    for why there is no point word to insert. What this fixes is the spurious CLAUSE BREAK and the
    //    mis-read tail: `4,20` was *mínei , túku míbalé* ("four, twenty") and is now *mínei míbalé
    //    libungutúlu*.
    //    ⚠ THE TRAILING LETTER GUARD keeps a dotted designation (`802.11a`) out — zero in this corpus, and
    //    the same robustness argument as step 5.
    s = rewrite(s, /(?<![\d.,])(\d+)[.,](\d+)(?![\d\p{L}\p{M}])/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].join(" ")}`);

    // 11) FRACTIONS → the ordinal-denominator idiom, which is the language's own and needs no new word:
    //     Lingala forms an ordinal as `ya` + the cardinal, and that construction is everywhere in the
    //     corpus (`ya liboso` ×560, `ya mibale` ×285, `ya misato` ×169). So `2/3` reads *míbalé ya mísáto*
    //     — "two of the third". ×79, the commonest being 2/3, 1/3 and 1/4.
    //     ⚠ THE DENOMINATOR IS CAPPED AT TEN, AND THAT CAP IS THE WHOLE RULE. `\d{1,3}/\d{1,3}` matches 79
    //     times here and only TEN of those are fractions (`1/3` ×6, `2/3` ×4). Everything else is a slash
    //     used for something else entirely: legal-instrument numbers (`Mobéko n°011/2002`, `87/002`,
    //     `20/032`), chronology and page spans (`50/51`, `56/57`, `169/171`), vision ratios (`20/60`),
    //     dates (`22/07`, `12/04/2014`) and `24/7`. Requiring numerator < denominator ≤ 10 admits all ten
    //     real fractions and NONE of the others — verified against the full list, not assumed. A third
    //     `/digit` field additionally rejects the dates before the cap has to.
    //     ⚠ AND THE CAP IS A RANGE, NOT A TABLE (trap 8): the rule COMPOSES from the ordinal idiom, so
    //     `3/4` and `1/2` read correctly although the corpus writes neither in ASCII.
    s = rewrite(s, /(?<![\d\p{L}\p{M}/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (whole, a: string, b: string) =>
        Number(a) < Number(b) && Number(b) <= 10 ? `${a} ya ${b}` : whole);
    // ¼ and ½ occur once each; both are the same idiom with the numerator spelled out.
    s = rewrite(rewrite(s, /¼/gu, " mǒkó ya mínei "), /½/gu, " mǒkó ya míbalé ");

    // 12) ORDINAL SUFFIXES. `16ème` was reaching the phoneme stream with its French suffix as raw letters
    //     (`zómi na motóbá e˩me˩`). ⚠ ALL 235 INSTANCES ARE INSIDE FRENCH TEXT — "du 16ème au 18ème
    //     siècle", "1er décembre 2012", "2e éd." — so this is not a Lingala orthographic convention and
    //     the rule exists to remove RAW LETTERS, not to read an idiom. The Lingala ordinal is `ya` +
    //     cardinal (attested ×1000+ as above), and `1er`/`1ère` take the suppletive `libosó` the manifest
    //     already declares as `firstCard`.
    //     ⚠ THE BARE `e` ARM TAKES NO SPACE, and that is measured rather than tidy. The multi-letter
    //     suffixes are unambiguous, so they tolerate the optional gap the French typography sometimes leaves
    //     (`2 ème`). A lone `e` after a space is a DIFFERENT THING: all three `\d+ e` instances in the corpus
    //     are the PORTUGUESE CONJUNCTION in quoted Portuguese text ("em 1.533 e com a invasão espanhola"),
    //     zero are ordinals, and the spaced arm was deleting that "and" — `em ya 1533 com a invasão`. Trap 9
    //     with the evidence pointing the other way: the alternative is not merely unattested, it is attested
    //     WRONG. Tight `2e`/`16e` (×184, all French ordinals) is what the rule is for and is unaffected.
    s = rewrite(s, /(?<![\d\p{L}\p{M}])1\s?(?:er|ère|re)(?![\p{L}\p{M}])/gu, `ya ${FIRST_ORDINAL}`);
    s = rewrite(s, /(?<![\d\p{L}\p{M}])(\d+)\s?(?:ème|nd)(?![\p{L}\p{M}])/gu, "ya $1");
    s = rewrite(s, /(?<![\d\p{L}\p{M}])(\d+)e(?![\p{L}\p{M}])/gu, "ya $1");

    // 13) THE AMPERSAND — ×254, and every instance read is a bibliographic "and" between two names
    //     ("De Moor & JP Jacquemin", "M. Vences & F. Glaw", "Bd 1&2"). `mpé` is the language's ordinary
    //     conjunction, attested throughout, so this needs no sourcing argument at all.
    //     ⚠ SPACED ON BOTH SIDES DELIBERATELY. `A&B` deletes to `AB`, which is ONE token instead of two —
    //     trap 18/26 — so the replacement must insert the boundary the sign was supplying.
    s = rewrite(s, /\s?&\s?/gu, " mpé ");

    return s;
}
