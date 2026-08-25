/**
 * Sinhala (si) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Corpus: `tools/corpus/mined/si.jsonc`, a si.wikipedia dump of **191,335 paragraphs** (448 mined segments,
 * 248 hard + 200 sample). There is no FLEURS corpus for Sinhala, so the artifact IS the corpus, its `counts`
 * are DUMP-WIDE frequencies, and — the artifact's own header says so — its `sample` tier is a real uniform
 * stride over a dump and therefore representative. Every count below says which of the two it is.
 *
 * ⚠⚠ THE BIGGEST DEFECT IN SINHALA IS NOT IN ANY DEFECT CLASS: THE JOINER SPLIT EVERY CONJUNCT.
 * `zero-width` is the artifact's largest cell at **144,214** — twice `digit-run` — and it is not markup. Of
 * the 1,978 ZWJ in the mined segments, **1,841 immediately follow a virama ්**, i.e. they are the ordinary
 * Sinhala conjunct: rakaransaya `්‍ර`, yansaya `්‍ය`, repaya `ර්‍`. `sinhala.ts`'s word token is `[඀-෿]+`
 * and U+200D is outside that range, so every one of them was TWO tokens:
 *
 *     ක්‍රි → k rˈi        ශ්‍රී → s rˈiː  ← the country's own name
 *     ප්‍රතිශතය → p rˈat̪isˌət̪əjə        මිශ්‍ර → mˈis rˈə
 *
 * With the joiner gone the same words read correctly (krˈi, prˈat̪isˌət̪əjə), because in Sinhala **ZWJ only
 * selects the ligature glyph — it never reorders the letters**, so removing it is phonemically lossless and
 * re-joins the token. No gate in this tree could see it: the leak classes hunt a character that SURVIVES
 * into the IPA and the DROP test hunts a symbol that says nothing — a joiner says nothing and *should*.
 * What it does is split a word, which nothing measures.
 *
 * ⚠ CONSEQUENCE FOR THIS FILE: step 1 strips the joiners, so every literal MATCHED below is written without
 * them (`ක්රි.පූ.`, not `ක්‍රි.පූ.`), which looks like a misspelling and is not. Literals EMITTED are written
 * the ordinary way, and step 12 re-runs the same strip so they reach the tokenizer as one word each.
 *
 * ⚠ SINHALA PUTS THE MEASURE WORD BEFORE THE NUMBER, without exception in this corpus — so `percentPrefix`,
 * `currencyPrefix` and `unitPrefix` are all set, and the rate is LOCAL because its denominator takes a
 * DATIVE suffix and leads the phrase (trap 47, case 1):
 *
 *     වර්ග කිලෝමීටර් 1,001,450   මිලිමීටර් 2,400 ක්   කිලෝග්‍රෑම් 300 (රාත්තල් 650)   ග්‍රෑම් 75   මීටර් 400
 *     සියයට 4.8 ක · සියයට 88කට · සියයට 95 කට · සියයට 7 ක්      (percent, 4/4 in corpus, 4/4 on the wiki)
 *     wiki: පැයට කිලෝමීටර 250 · තත්පරයට මීටර                    (the rate: "to-the-hour kilometres")
 *
 * ⚠ `ප්‍රතිශතය` ×11 IS NOT THE PERCENT WORD, and the corpus proves it by writing both at once —
 * `88.8% ක ප්‍රතිශතයක්`, `49.2% ක ප්‍රතිශතයක්`, "a proportion of 88.8%". It is the abstract noun
 * *proportion*; `සියයට` ×4 is the reading. Picking by raw count picks the loser (trap 37).
 *
 * ⚠ THE PUNCTUATION THIS LAYER RECLAIMS WAS ALL BEING SPOKEN AS PAUSES. Sinhala writes the English
 * convention — comma groups thousands, period marks the decimal — and both were `clausePunctuation`:
 * `12.5` read *d̪ˈoləhə . pˈahə* ("twelve. five") and `1,001,450` read as three numbers and two pauses.
 * `decimals` is 12,231 in the dump and `grouped` 6,913.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The shared symbol tier. Every word is corpus- or wiki-attested IN ITS SLOT (playbook 5e); the sourcing
 * notes are at the top of the file and in `docs/investigations/si_normalization_investigation.md`.
 *
 *   සියයට     percent  — corpus ×4, wiki ×4, prefix in all eight
 *   ඩොලර්/යූරෝ/පවුම්/රුපියල්  — `ඩොලර් 38,100ක්`, `යූරෝ මිලියන 152 ක`, `පවුම් 300,000ක මුදල්`,
 *                        `රුපියල් මිලියන 50 ක`, and the corpus glosses the abbreviation itself:
 *                        *"රුපියල යන්න කෙටියෙන් දක්වන්නේ රු. (Rs)"*
 *   කිලෝමීටර්/මීටර්/සෙන්ටිමීටර්/මිලිමීටර්/ලීටර්/හෙක්ටයාර්  — all attested whole-word on the wiki
 *   කිලෝග්‍රෑම්/ග්‍රෑම්  — from the corpus itself (`කිලෝග්‍රෑම් 300 (රාත්තල් 650)`, `ග්‍රෑම් 75`)
 *   වර්ග / ඝන  — attested as the COLLOCATION, which is the only evidence that counts for a modifier
 *                (trap 37): `වර්ග කිලෝමීටර් 1,001,450`, `වර්ග සැතපුම් 386,660`, `ඝන සෙන්ටිමීටර 200`
 *   සහ        — the ordinary Sinhala conjunction, everywhere in the corpus
 *
 * ⚠ `mg` IS DELIBERATELY NOT DECLARED, AND IT WAS DECLARED FIRST — this is trap 46's "withdraw the key
 * where it buys nothing", found by reading the reading rather than the count. `mg` is ×9 in the mined
 * segments, which looks worth having, and **all nine are inside a RATE whose denominator has no sourced
 * Sinhala reading**: `126 mg/dl` ×4, `14.6 mg• L⁻¹` ×2, `1.9mg/cm3`. With the key declared, `unitPrefix`
 * moves the number in front of a denominator it cannot claim and `126 mg/dl` reads *මිලිග්‍රෑම් 126/dl* —
 * the operands split around an orphaned unit. Undeclared it stays merely silent, which is the better of
 * the two. (The word would also have had to be composed rather than found: `මිලිග්‍රෑම`/`මිලිග්‍රෑම්` probe
 * absent / substring-only on si.wikipedia.)
 *
 * ⚠ BARE `m` IS DECLARED, AND THE MEASUREMENT IS IN STEP 8 RATHER THAN HERE, because the interesting part
 * turned out to be what the tier's `NOT_VERSION` guard REFUSES rather than what the key claims. Digit-
 * adjacent `m` is ×12 in the mined segments: **10 are metres and 2 are the English million-suffix**
 * (`SDR69.5m (US$100m)`, one English-language citation fragment) — and the guard rejects the two along with
 * eight of the ten, because both are a one-letter key glued to a dotted number. Step 8 pays for both sides.
 * `g`, `s` and `l` are NOT declared: their only digit-adjacent hits are `h2g2` (a website), `the 1800s`
 * (English) and `mmol/l`.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["සියයට"],
    percentPrefix: true,
    currency: {
        "US$": ["ඇමෙරිකානු ඩොලර්"], $: ["ඩොලර්"], "€": ["යූරෝ"], "£": ["පවුම්"],
        // `රු.` is spent at step 2 rather than declared as a key here: bare `රු` is an ordinary Sinhala
        // syllable, and only the DOT plus a following numeral makes it the currency abbreviation.
        "Rs": ["රුපියල්"], "₨": ["රුපියල්"],
    },
    currencyPrefix: true,
    // The magnitudes that hop with a currency sign, in the order the corpus writes them — the noun leads,
    // then the magnitude, then the number: `රුපියල් මිලියන 50 ක`, `යූරෝ මිලියන 152 ක`, `ඩොලර් කෝටි 50ක්`.
    // `කෝටි` ×179 and `ලක්ෂ` ×17 on the wiki are the South Asian crore/lakh, both in monetary amounts.
    // `ට්‍රිලියන` is NOT declared: it probes substring-only, i.e. it is not attested as a Sinhala token.
    magnitudes: ["දහස", "ලක්ෂ", "කෝටි", "මිලියන", "බිලියන"],
    units: {
        km: ["කිලෝමීටර්"], m: ["මීටර්"], cm: ["සෙන්ටිමීටර්"], mm: ["මිලිමීටර්"],
        kg: ["කිලෝග්‍රෑම්"], ml: ["මිලිලීටර්"], ha: ["හෙක්ටයාර්"],  // ZWJ
    },
    unitPrefix: true,
    // `position: "before"` — a spaced word ahead of the unit noun, the Russian shape, which is exactly what
    // the corpus writes (`වර්ග කිලෝමීටර්`, never a fused *වර්ගකිලෝමීටර්*).
    exponentWords: { squared: ["වර්ග"], cubed: ["ඝන"], position: "before" },
    ampersand: "සහ",
});

/**
 * Zero-width joiners and the HTML no-break space. Run FIRST (step 1) and again LAST (step 12) — see the
 * file header. U+200D/U+200C select a Sinhala conjunct's glyph and never reorder letters; U+200B/U+FEFF and
 * the soft hyphen are dump noise. `&nbsp;` is ×26 in the mined segments (`20&nbsp;°C`, `2.8&nbsp;සෙ.මී.`)
 * and must become a real space, or the degree and unit rules see a letter where they expect a boundary.
 */
const stripJoiners = (s: string): string =>
    s.replace(/&nbsp;/gu, " ").replace(/[​-‍⁠﻿­]/gu, "");

/**
 * Dotted abbreviations, as a CLOSED LIST — because the shape-based count is a lie in this corpus. A pattern
 * for "short Sinhala segment + dot" reports thousands, and reading them shows the bulk are a SENTENCE
 * PERIOD WITH NO SPACE AFTER IT (`ය.කොරල්පර`, `වේ.තව`, `රටකි.විවිධ`), which must stay a pause. `abbrev` is
 * 29,394 in the dump and that is mostly what it is counting (trap 2).
 *
 * The era pair is glossed by si.wikipedia in one sentence — *"ක්‍රිස්තු වර්ෂ (ක්‍රි.ව.) සහ ක්‍රිස්තු පූර්ව
 * (ක්‍රි.පූ)"* — and the corpus writes the era BEFORE the year exactly as the expansion does
 * (`ක්‍රි.ව. 1660 දී`, `ක්‍රි.පූ. 500දී`, wiki `ක්‍රිස්තු පූර්ව 1000 සිට`). ×11 in the mined segments, 162
 * in the dump. `ක්‍රි.පු.` is a real corpus spelling with a short u.
 */
/**
 * ⚠⚠ EVERY KEY IS BOUNDED ON BOTH SIDES, and that is not defensive tidiness — an unbounded key eats a
 * SENTENCE BOUNDARY in this corpus, because the missing space after a full stop is the corpus's commonest
 * dot (see above) and Sinhala has ordinary words starting with each of these second syllables. Measured on
 * the unguarded version:
 *
 *     ලංකාවේ නගරයකි.මීගමුව   →  ලංකාවේ නගරයකිලෝමීටර් ගමුව     ← `මීගමුව` is a CITY, and it is in this corpus
 *     මෙය හැකි.මීටර් 400     →  මෙය හැකිලෝමීටර් ටර් 400
 *     තරු. 500 ක්            →  තරුපියල් 500 ක්                ← `තරු` = stars
 *     ශක්‍රි.වචන             →  ශක්රිස්තු වර්ෂ චන
 *
 * Two clause breaks destroyed and four words corrupted, none of it visible in the 448 mined segments — the
 * hazard is a fact about the 191,335-paragraph dump the artifact samples. `(?<![඀-෿])` … `(?![඀-෿])` is the
 * fix, and the trailing space is emitted by the REPLACEMENT rather than absorbed by the pattern, because a
 * pattern that swallows the space cannot then look past it (`සෙ.මී. ඝන වානේ` would reject on the ඝ).
 */
const B = String.raw`(?<![඀-෿])`, E = String.raw`(?![඀-෿])`;
const abbrev = (body: string, word: string): readonly [RegExp, string] =>
    [new RegExp(B + body + E, "gu"), word + " "] as const;

const DOTTED_ABBREV: readonly (readonly [RegExp, string])[] = [
    // Era markers first (playbook step 4: era before generic abbreviations), longest key first.
    abbrev(String.raw`ක්රි\.\s?පූ\.?`, "ක්‍රිස්තු පූර්ව"),  // ZWJ
    abbrev(String.raw`ක්රි\.\s?පු\.?`, "ක්‍රිස්තු පූර්ව"),  // ZWJ
    abbrev(String.raw`ක්රි\.\s?ව\.?`, "ක්‍රිස්තු වර්ෂ"),  // ZWJ
    // Measure and currency abbreviations. `කි.මී` ×2 (`වර්ග කි.මී 65,610`, wiki `පැයට කි.මී. 250`),
    // `සෙ.මී.` ×2, `ඇ.ඩො.` from the wiki's own `(ඇ.ඩො. මිලියන 7.4)`. The trailing dot is optional
    // because the corpus writes it both ways.
    abbrev(String.raw`ඇ\.\s?ඩො\.\s?මි\.?`, "ඇමෙරිකානු ඩොලර් මිලියන"),
    abbrev(String.raw`ඇ\.\s?ඩො\.?`, "ඇමෙරිකානු ඩොලර්"),
    abbrev(String.raw`කි\.\s?මී\.?`, "කිලෝමීටර්"),
    abbrev(String.raw`සෙ\.\s?මී\.?`, "සෙන්ටිමීටර්"),
    abbrev(String.raw`මි\.\s?මී\.?`, "මිලිමීටර්"),
    // `රු.` only before a number — the bare word රු is not an abbreviation. `රු. (Rs)` is glossed in the
    // corpus; unhandled, `රු. 500` read *rˈu . pˈahə sˈijəjə*, a syllable and a full stop.
    [/(?<![඀-෿])රු\.\s*(?=\p{Nd})/gu, "රුපියල් "],
];

/** Sinhala numerals are not used in running text, but the engine folds native digits anyway; every rule
 *  here therefore emits ASCII digits and lets the engine's own number path speak them. */
export function normalizeSinhala(input: string): string {
    let s = input;

    // 1) JOINERS AND ENTITIES — before everything, because every Sinhala literal matched below and every
    //    letter-count guard is written against joiner-free text. See the file header for why this is the
    //    largest single win in the language.
    s = stripJoiners(s);

    // 2) DOTTED ABBREVIATIONS, closed list — era markers first (see DOTTED_ABBREV).
    //    ⚠ EACH REPLACEMENT RE-EMITS A SPACE, because the corpus writes the era GLUED to its year
    //    (`ක්‍රි.ව.1940 දී පමණ`, ×1). Without it the expansion came out `ක්‍රිස්තු වර්ෂ1940`; the tokenizer
    //    would still split letters from digits, but the text is what the next rules match on and a rule
    //    that leaves its output unspaced is one edit away from a real bug (trap 10's neighbourhood).
    for (const [rx, word] of DOTTED_ABBREV) s = s.replace(rx, word);

    // 3) SINHALA-LETTER INITIALS — `එෆ්.ආර්.ප්‍රනාන්දු`, `ජේ.ආර්.ජයවර්ධන`, `ටී.ආර්.එන්.සී`, `බී.එම්.ඩබ්ලිව්`.
    //    Each initial is already a pronounceable Sinhala syllable; the only defect is the dot becoming a
    //    clause pause. The dot becomes a SPACE, not nothing, so the initials stay separate words and their
    //    schwa/stress is unchanged.
    //
    //    ⚠ MEASURED BEFORE SHIPPING, because this is the shape trap 2 keeps punishing: over the 448 mined
    //    segments `(?:[඀-෿]{1,7}\.){2,}` matches **20 times with zero false positives** — the 10 era
    //    markers (already spent at step 2), `සෙ.මී.`, and eight genuine initial runs. Requiring TWO dots is
    //    what excludes the missing-space sentence period, which never has a second dot before the space.
    s = s.replace(/(?<![඀-෿.])(?:[඀-෿]{1,7}\.){2,}/gu, (m) => m.replaceAll(".", " ").trimEnd() + " ");
    //    Steps 2 and 3 both emit a trailing space so an expansion cannot glue itself to what follows; where
    //    the source already had one, collapse the pair.
    s = s.replace(/  +/gu, " ");

    // 4) THOUSANDS SEPARATOR — before anything that reads a dot or a digit run, or the comma is clause
    //    punctuation: `1,001,450` read *ˈekə , ˈekə , hˈat̪ərə sˈijəjə pˈanəhə*. `grouped` ×6,913 in the dump.
    //    Only 3-digit groups, so a genuine clause comma between numbers (`ලකුණු 156ක්, තරග 90කදී`) is safe.
    s = s.replace(/(?<![\p{Nd}.,])(\p{Nd}{1,3}(?:,\p{Nd}{3})+)(?![\p{Nd}])/gu, (m) => m.replaceAll(",", ""));

    //    A TRUNCATED DECIMAL — `ස්කන්ධයෙන් .9% ක්` writes `0.9%` without its zero, and the leading dot then
    //    survived the percent rule and became a sentence break (*…ස්කන්ධයෙන් . සියයට 9…*). Restoring the zero
    //    is the whole fix. ⚠ THE SPACE GUARD IS THE ENTIRE RULE: the other twelve dot-before-digit hits in
    //    the mined segments are the corpus's missing-space-after-a-full-stop (`ඇත.2011`, `තිබේ.1930`,
    //    `ය.1958`) plus the abbreviation `අවු.18` — all GLUED to a letter, all correctly left as pauses.
    s = s.replace(/(?<=[\s(\[])\.(?=\p{Nd})/gu, "0.");

    // 5) DEGREES — before units and before the decimal rule, because `20.5 °C` needs both of those still
    //    intact. `සෙල්සියස් අංශක 38 (ෆැරන්හයිට් අංශක 100.4)` is si.wikipedia's own frame, four times over in
    //    one article, and it settles the word AND the order in one quotation. `අංශක` ×52 whole-word.
    //
    //    ⚠ U+2070 SUPERSCRIPT ZERO IS A DEGREE SIGN IN THIS CORPUS — `133 ⁰C`, `27⁰c`, `360⁰`, `79⁰ 51"`,
    //    `6⁰03`, `36.0437268⁰`: 6 of 6 instances, and zero instances of a real zero exponent. Same substitution
    //    class as the Italian `dell'11º` and the Hindi `º` (trap 25). It is claimed HERE, above the tier, so
    //    the shared exponent path never sees it.
    // ⚠ THE SIGN IS CLAIMED HERE, WHICH IS WHY DEGREES RUN ABOVE STEP 6 AND NOT BELOW IT. Every corpus
    // negative is a temperature, so letting the general minus rule fire first gave *ඍණ සෙල්සියස් අංශක
    // 182.95* — "negative Celsius degrees 182.95", the sign attached to the scale instead of the value.
    const SIGN = "(\\u2212?)";
    const NUM = "(\\p{Nd}+(?:\\.\\p{Nd}+)?)";
    const DEG = "\\s*[°º\\u2070]\\s*";
    const neg = (sg: string): string => (sg ? "ඍණ " : "");
    s = s.replace(new RegExp(SIGN + NUM + DEG + "C(?![\\p{L}\\p{M}])", "giu"),
        (_m, sg: string, n: string) => `සෙල්සියස් අංශක ${neg(sg)}${n}`);
    s = s.replace(new RegExp(SIGN + NUM + DEG + "F(?![\\p{L}\\p{M}])", "giu"),
        (_m, sg: string, n: string) => `ෆැරන්හයිට් අංශක ${neg(sg)}${n}`);
    // Coordinates. The direction words are the ordinary corpus ones — `උතුරු අක්ෂාංශ 29°-39°`,
    // `නැගෙනහිර දේශාංශ 60°-75°` — so nothing is invented, only moved to the letter's position.
    const COMPASS: Record<string, string> = { N: "උතුරු", S: "දකුණු", E: "නැගෙනහිර", W: "බටහිර" };
    s = s.replace(new RegExp(NUM + DEG + "([NSEW])(?![\\p{L}\\p{M}])", "gu"),
        (_m, n: string, d: string) => `අංශක ${n} ${COMPASS[d]}`);
    s = s.replace(new RegExp(SIGN + NUM + "\\s*[°º\\u2070]", "gu"),
        (_m, sg: string, n: string) => `අංශක ${neg(sg)}${n}`);
    // KELVIN, and it takes NO degree word — the scale is the noun. `කෙල්වින්` ×37 whole-word on the wiki,
    // in the right sense (*කෙල්වින් යනු උෂ්නත්වය මිනුමකි*, "Kelvin is a temperature measure", and
    // *කෙල්වින් මගින් ඇති ද්‍රවාංකයයි*, a melting point stated in kelvin). ⚠ A BARE ONE-LETTER UPPERCASE KEY
    // IS THE trap-46 SHAPE, so it is claimed only when SPACE-SEPARATED, which is what the corpus's two
    // instances are — `90.20 K (−182.95 °C…)` and `54.36 K (−218.79 °C…)`, 2/2 kelvin — and what excludes
    // the glued `5K` designation the corpus does not contain but arbitrary input will. A following DOT
    // is excluded too, so an initial (`1990 K.M. Silva`) cannot be read as a temperature.
    s = s.replace(new RegExp(NUM + " K(?![\\p{L}\\p{M}.])", "gu"), "කෙල්වින් $1");

    // 6) NEGATIVE NUMBERS — and the discriminator is the CHARACTER, measured rather than guessed. U+2212 is
    //    ×5 in the mined segments and **all five are genuine negatives** (`−1 °C`, `−182.95`, `−297.31`,
    //    `−218.79`, `−361.82`, every one a temperature). An ASCII hyphen before a digit is ×9 and **none of
    //    them is a negative**: `උපන්දිනය - 1975/12/17`, `BP 300,000 - 500,000`, `වයස 0 -5`, `-12 වැනි
    //    උපකුළපති`, `(United Nations -1967)`, `උපත -1918 ජූලි`. So only U+2212 is read.
    //
    //    ⚠ THE WORD IS THE REGISTER CAVEAT IN THIS FILE. si.wikipedia's plus/minus article says
    //    *"ධන යන්නට ඉංග්‍රීසි වචනය වන ප්ලස් යන්න සහ සෘණ යන්නට වන මයිනස් යන්න…"* — ධන/සෘණ are what the SIGNS
    //    ARE CALLED, which is the same citation shape that shipped Hindi a wrong plus until its FLEURS audio
    //    refuted it. Sinhala has no FLEURS corpus and therefore no audio tier, so that check cannot be run
    //    here. `ඍණ` is used because it is the spelling the CORPUS carries, in the mathematical sense, in the
    //    sign's own slot: *"(නැගෙනහිර දේශාංශ: ධන, බටහිර දේශාංශ: ඍණ)"*. Omitting a minus INVERTS the value,
    //    which is why this is read at all while `+` is left alone (playbook: the audio tier, rule 3).
    //
    //    ⚠ AND THE ASCII SIGN GETS A NARROWER ARM, not none — the Hindi trap-24 shape. Widening the
    //    space-flanked guard to `[-–]` would match FIVE of those nine and every one would be wrong
    //    (`වයස 0 -5`, `සමරසේකර -12 වැනි`, `-1967`, `-1918`, `අඩි 200 -250ක්`). Restricted to a sign that
    //    OPENS the string or a bracket, it has zero corpus counter-examples — the corpus never writes
    //    `(-5`, only `( -1967` — and a bare `-5` handed to the engine as input still reads.
    s = s.replace(/(^|[(\[])[-–−](?=\p{Nd})/gu, "$1ඍණ ");
    s = s.replace(/(?<=[\s(\[])−(?=\p{Nd})/gu, "ඍණ ");

    // 7) RATES — LOCAL, because Sinhala's denominator takes a DATIVE suffix and LEADS the phrase, which the
    //    tier's one-invariant-string `unitPer` cannot express (trap 47, case 1). si.wikipedia writes it
    //    three ways in one article and they agree: `පැයට කිලෝමීටර, පැයට සැතපුම්`, `අන්තර්ජාතික ඒකකය වන්නේ
    //    තත්පරයට මීටර`, `සුළගේ වේගය පැයට කි.මී. 250 ක්`. Must run BEFORE the tier or the tier claims the `km`.
    //
    //    ⚠ THIS IS ROBUSTNESS, NOT A MEASURED REPAIR, and says so (trap 22): the mined segments contain NO
    //    `km/h` or `m/s` at all — their slashed units are `mg/dl`, `mmol/l`, `kg/m3`, `kg/kW`, none of which
    //    has a sourced Sinhala reading, so none is claimed here.
    //
    //    ⚠ THE RULE MUST MOVE THE NUMBER, not merely translate the unit — the whole point of the idiom is
    //    that the number comes LAST (`සුළගේ වේගය පැයට කි.මී. 250 ක්`). Rewriting only the unit left
    //    `120 km/h` reading *120 පැයට කිලෝමීටර්*, the operands in the wrong order, and the tier could not
    //    have repaired it afterwards because the unit is no longer number-adjacent (trap 14's fix shape).
    //    ⚠ AND IT MUST CLAIM A WHOLE RANGE, not the last operand of one. The first version captured
    //    `(\p{Nd}[\p{Nd}.,]*)` and turned `35-40 km/h` into *35-පැයට කිලෝමීටර් 40*, tearing the range in
    //    half. Korean's 시속 rule is prefixed for the same reason and the tier's own notes record it.
    const RATE_OPERAND = "(?:((?<![\\p{Nd}.,\\-–—])\\p{Nd}[\\p{Nd}.,]*(?:\\s?[-–—]\\s?\\p{Nd}[\\p{Nd}.,]*)?)\\s*)?";
    for (const [unit, word] of [["km\\s?\\/\\s?h", "පැයට කිලෝමීටර්"], ["m\\s?\\/\\s?s", "තත්පරයට මීටර්"]] as const)
        s = s.replace(
            new RegExp(`${RATE_OPERAND}(?<![\\p{L}\\p{M}\\p{Nd}])${unit}(?![\\p{L}\\p{M}])`, "gu"),
            (_m, n: string | undefined) => (n ? `${word} ${n}` : word),
        );

    // 8) THE SHARED TIER — percent, currency, units, the squared/cubed modifier and `&`. Units run here,
    //    ABOVE the decimal rule, because the tier matches a unit only when a NUMBER is adjacent and step 9
    //    destroys that adjacency (the playbook's "units before decimals" coupling).
    //
    //    ⚠ ONE GUARD RUNS FIRST, AND IT IS THE PRICE OF THE BARE `m` KEY (trap 46). `US$100m` is the English
    //    million-suffix, not a hundred metres, and with `m` declared it read *ඇමෙරිකානු ඩොලර් මීටර් 100* —
    //    confidently wrong, which this tree ranks below silence. A one-letter `m` glued to a number that is
    //    itself glued to a CURRENCY SIGN is spent here as the magnitude instead, which then rides the tier's
    //    own magnitude hop: `ඇමෙරිකානු ඩොලර් මිලියන 100`. ×1 in the mined segments.
    //    ⚠ The residue is stated rather than chased: the same sentence writes `SDR69.5m`, where the code is
    //    not a sign, so that one still reads as metres. One instance, inside an English citation fragment.
    s = s.replace(/((?:US\$|[$€£₨])\s?\p{Nd}[\p{Nd}.,]*)m(?![\p{L}\p{M}])/gu, "$1 මිලියන");
    //    ⚠ AND THE OTHER SIDE OF THE SAME GUARD HAS TO BE PAID FOR LOCALLY. `NOT_VERSION` refuses a
    //    one-letter key glued to a dotted number, which is what stops `US$100m` and `SDR69.5m` — and it also
    //    refuses the EIGHT genuine metre readings this corpus writes that way: `2.5m දිගින්`, `1.397m හා
    //    0.508m පළලින්`, `3.29m වේ`, `9.75m කි`, `2.5m X 2.5m`. Only ×2 (`6100 m ක්`, `0.4572 m උසකින්`)
    //    survive the tier, so the glued form is claimed here instead, with the discriminator the corpus
    //    itself supplies: a LATIN LETTER before the number means it is a code, not a measurement
    //    (`SDR69.5m`). Exactly one dot, so a version string cannot enter from either end.
    s = s.replace(/(?<![\p{L}\p{Nd}.,])(\p{Nd}+\.\p{Nd}+)m(?![\p{L}\p{M}])/gu, "මීටර් $1");
    s = SYMBOLS(s);

    // 9) THE DECIMAL POINT — `දශම`, attested definitionally on si.wikipedia (*"…හෝ දශම තිතකින් ඇරඹී…"*,
    //    "or beginning with a decimal point") and in `දශම වර්ගීකරණය` (Dewey **Decimal** Classification) and
    //    `දශම රූපාකාරයෙන්` ("in decimal form"). The fractional digits are emitted ONE AT A TIME, as they are
    //    said: `99.8632` → *අනූනවය දශම අට හය තුන දෙක*, not "…eight thousand six hundred and thirty-two".
    //
    //    ⚠ THE GUARD IS "EXACTLY ONE DOT", and it is what keeps a dotted DATE and a version string out:
    //    `(2007.04.25)` ×1 and `1.613.5291.0` ×1 both fail it from either end, so neither is read as a
    //    decimal and neither loses a digit. `decimals` is 12,231 in the dump — the largest repair here.
    s = s.replace(/(?<![\p{Nd}.])(\p{Nd}+)\.(\p{Nd}+)(?![\p{Nd}.])/gu,
        (_m, whole: string, frac: string) => `${whole} දශම ${[...frac].join(" ")}`);

    // 10) THE COLON IS LEFT AS A PAUSE, DELIBERATELY, and this is a measured refusal rather than an
    //     omission (trap 24). `clock` is 2,921 in the dump, but the mined segments show the `NN:NN` shape is
    //     mostly NOT a clock: `1 කොරි 15:14` (a Bible verse), `(පීරිස් රැල්ෆ, 1964:189/193/197)` (a
    //     citation), against three genuine times (`UTC පැය 00:58:53ට`, `1900-1-1 12:30:00`,
    //     `2009-1-11 00:00:00`) which are themselves inside an astronomy worked example. A comma pause is
    //     right for the citation and the verse and merely flat for the timestamp; a clock rule would be
    //     confidently wrong for the majority. Sinhala also writes the time with a PERIOD (`8.30 AM` ×1),
    //     which is character-identical to a decimal, so there is no cheap discriminator either.

    // 11) FOUR MORE CLASSES DECLINED, each with the count that justifies it:
    //     · RANGES (`ranges` ×6,900). Sinhala already writes its own connective — `9.1–9.3 අතර`,
    //       `115 –135 අතර`, `60°-75° අතර`, `15,000-10,000 අතර` — so a `සිට … දක්වා` rewrite would say it
    //       twice, and the dash's other uses in the mined segments are a date (`2017-02-12`), a page range
    //       (`pp. 117-125`), a score (`2-0ක්`), a season (`1995-96`) and a song title (`1-2-3`). Silent is
    //       the redundant-symbol case (trap 12) where අතර is present and merely flat where it is not.
    //     · `=` (`arithmetic` ×700). Every mined instance is a GLOSSARY or table separator, not an
    //       equation: `අබ්බඩා=.....`, `මාමා = මාමා`, `Detective Comics = රහස් පරික්ෂක චිත්‍ර කථා`. Reading
    //       it as "equals" would be wrong for all of them.
    //     · `×` (`arithmetic`). All three mined instances are a DIMENSION CROSS after `මිලිමීටර්` —
    //       `8.2×6.3×0.6`, `13.7×15.3×1.5`, `40×26` — which is "by", not "times", and no Sinhala reading of
    //       the dimension cross is attested anywhere this repo can reach. th reached the same conclusion.
    //     · FRACTIONS (`fractions` ×1,078, diluted the same way `abbrev` is). Genuine ones are `1/4 කි`,
    //       `1/50 කි`, `1/530`, `¼ කි`; the rest of the mined `N/M` are a cricket score (`443/9`), a season
    //       (`1990/1`, `2006/2007`), a date (`1975/12/17`), an aperture (`f/2.8`) and a shutter speed
    //       (`1/125 S`). Sinhala's own denominator series (`හතරෙන් එක`) is not attested in either source,
    //       so the reading would have to be invented as well as the guard.

    // 12) RE-STRIP — the words emitted above are written with their ordinary joiners (`ක්‍රිස්තු`,
    //     `කිලෝග්‍රෑම්`, `ට්‍රිලියන`), which is what a Sinhala reader expects to see in this file. Without
    //     this pass the tokenizer would split each of them exactly as it split the input at step 1.
    return stripJoiners(s);
}
