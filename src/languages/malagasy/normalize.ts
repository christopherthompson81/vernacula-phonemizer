/**
 * Malagasy (mg) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Corpus: `tools/corpus/mined/mg.jsonc`, an mg.wikipedia dump of **282,192 paragraphs** (440 mined
 * segments, 240 hard + 200 sample). No FLEURS corpus; espeak does not ship Malagasy.
 *
 * ⚠⚠ THIS WIKI IS 37.5% BOT, AND THE TWO TIERS DISAGREE ABOUT IT — which is the first thing to know before
 * reading any count here. Measured over the SAMPLE tier (a uniform stride, so the real distribution):
 * **75 of 200 segments are template stubs** — French-commune boilerplate (`Ny INSEE dia mampiasa…` ×14,
 * `I Biermont dia kaominina ao amin'ny fivondronan'i Compiègne…`), Malagasy-commune stubs, coordinate
 * fillers (`Ny laharam-pehintaniny ary ny…` ×10) and year-list entries.
 *
 * ⚠ BUT THE HARD SET IS CLEAN — 1 template line in ~240 — and that is not luck: `mine.ts` selects
 * ADVERSARIALLY, and the stubs are formulaic, so the selector prefers the messier human prose. This is the
 * OPPOSITE of the Sundanese case, where the contamination was pattern-rich and dominated the hard set
 * (playbook, §0b). So the rules below are written from human Malagasy, and the corpus diff is read knowing
 * that a third of its lines are boilerplate.
 *
 * ⚠ CONSEQUENCE FOR THE DUMP-WIDE COUNTS: they are inflated by the templates and are quoted only where the
 * shape is not template-specific. `degrees` 23,806 and `decimals` 48,778 are overwhelmingly the commune
 * coordinate stubs; `quote-letter` 150,822 is not a defect at all but Malagasy orthography (`amin'ny`,
 * `ao amin'`); and `ampersand` 30,267 is measured below to be something else entirely.
 *
 * ⚠⚠ MALAGASY GROUPS THOUSANDS WITH A SPACE, and that had no symptom any gate could see. It is the French
 * convention throughout (`1 540 metatra`, `830 900 ny teraka`, `384 403 km`, `1 000 000 $`, `299 792,458
 * km/s`) — **×33 in the mined segments with no counter-example** — and a space is the ordinary word
 * separator, so `1 540` simply read as TWO NUMBERS, *ˈiraj dimaⁿdzˈatu* ("one, five hundred"). No leaked
 * character, no dropped symbol, no stray pause: nothing for `mine.ts scan` or the leak classes to report.
 * The same silent-value-destruction as Lao's grouping comma, in a different disguise.
 *
 * ⚠ AND THE COMMA IS THE DECIMAL AT EVERY WIDTH, which is why the group-size rule the last three languages
 * used does NOT apply here. Measured over the mined segments:
 *
 *     space + 3 digits   ×33   THOUSANDS  1 540 · 830 900 · 384 403 · 100 000 · 1 000 000
 *     comma + 1–2 digits ×54   decimal    7,6 · 83,61 · 2,50 · 11,6
 *     comma + 3 digits    ×7   decimal STILL — 6 of the 7: 1,429 kg/m³ · 299 792,458 km/s ·
 *                               247,941 / 141,508 / 757,461 kilometatra toradroa. Only `$ 30,000` is a
 *                               thousands group, imported with the dollar sign.
 *     period + 3 digits   ×8   MIXED — populations and money are thousands (25.000fmg, 30.000 eo ho eo,
 *                               isam-ponina 5.196) and the rest are coordinates, which all carry a `°`.
 *     period + other      ×53  decimal — the bot coordinate stubs (44.8358333333, 48.8239°)
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The shared symbol tier. Every word is attested IN ITS SLOT (playbook 5e).
 *
 *   ariary / dolara / eorô — `ariary` ×69 and `dolara` ×58 across 20 wiki articles each, and the corpus
 *            puts the noun AFTER the magnitude (`iray tapitrisa dolara`, "one million dollars"), which is
 *            the tier's default order. `25.000fmg(5000ar)` shows the old franc beside the ariary.
 *   milimetatra / litatra — the two SI words this layer was missing, and both are glossed by the corpus or
 *            the wiki AGAINST THE SYMBOL being declared. mg.wikipedia's MILIMETATRA article opens
 *            *"Ny milimetatra, izay hafohezina amin' ny hoe mm, dia ventin-kalava…"* — "the millimetre,
 *            which is abbreviated **mm**, is a unit of length" — and goes on to place it on the ladder
 *            (*"misy arivo milimetatra ny iray metatra"*, a thousand millimetres to the metre). ×30 hits in
 *            20 articles. The MINED CORPUS writes the abbreviation in the slot twice, both rainfall:
 *            `mahery ny 50 mm isam-bolana ny latsak' orana` and `latsaky ny 50 mm ny latsak' orana`.
 *            `litatra` ×25/20 is defined by the wiki as the volume unit (*"ny litatra, dia nofaritana ho
 *            mitovy amin' ny iray desimetatra toratelo"*) and the corpus writes it POSTPOSED after a
 *            magnitude chain — `1.33 hetsy tapitrisa (133.000.000.000) litatra ny labiera`, litres of beer.
 *            It is already quoted in this file's `toratelo` note (`1 000 litatra ny 1 metatra toratelo`).
 *            ⚠ BOTH CASES OF THE LITRE KEY, because BIPM makes ⟨l⟩ and ⟨L⟩ equally official and the module's
 *            exact branch is the only one that can resolve a one-letter symbol.
 *            ⚠ TRAP 46, MEASURED: digit-adjacent bare `l` in the mined artifact is **×0**. Malagasy's
 *            apostrophes are the thing to fear here — `amin'ny`, `latsak' orana`, `n'` — but every one of
 *            them binds a LETTER run, never a digit, so nothing collides with the key. The unit path only
 *            fires with a number adjacent, and there is no `<digit> l` in the corpus to be wrong about.
 *            ⚠ ⟨ha⟩ IS DELIBERATELY NOT DECLARED although `hektara` probes ×28/20 and the corpus writes the
 *            WORD (`7,6 tapitrisa hektara no tany ampiasaina amin' ny fambolena voaloboka`). The corpus has
 *            no `<digit> ha` anywhere, so the key would be a rule with no instance — trap 9, the same test
 *            this file's `kilao` note applies. The word being real is not the question; the ABBREVIATION
 *            being written is.
 *   metatra / kilaometatra / santimetatra / kilao — ×50, ×24, ×32 and ×32 on the wiki. ⚠ `kilao` is the
 *            kilogram and `kilograma` probes ×0, so the French-style clipping is the word, not the Latinate
 *            one — checked because `units` is the class the sourcing gate deliberately excludes (playbook
 *            5e), so nothing else would have caught a guess here.
 *   toradroa — squared, and the corpus gives it in the slot three times over: `247,941 kilometatra
 *            toradroa`, `141,508 kilometatra toradroa`, `757,461 kilometatra toradroa` (commune areas).
 *            POSTPOSED after the unit noun, which is the tier's default position.
 *   sy      — the ordinary Malagasy noun conjunction, on nearly every line of the corpus.
 *
 *   toratelo — cubed, and BOTH POWERS ARE GLOSSED AGAINST THEIR SYMBOLS IN ONE SENTENCE by the wiki's own
 *            units article: *"ampiasaina ny metatra toradroa (m2) sy ny metatra toratelo (m3)"* — "the
 *            square metre (m2) and the cubic metre (m3) are used". Confirmed in the slot four more times
 *            (`kilômetatra toratelo`, `desimetatra toratelo`, `1 000 litatra ny 1 metatra toratelo`).
 *            ⚠ It was very nearly declined as an invention — `toratelo` is transparently "three-fold" and
 *            looks like the kind of word a composer would make up from `toradroa`. Probing it first is the
 *            whole difference between reading a word and inventing one, and unread the cube was worse than
 *            silent: the tier claimed the unit and left the superscript glued to it (`kilaometatra³`), so
 *            `0,93 km³` read as plain kilometres.
 *
 * ⚠ ONE SPELLING HAD TO BE PICKED for the metre: the corpus and wiki carry `kilaometatra`, `kilometatra`
 * and `kilômetatra`. The declared key is the first; the other two occur as ordinary words in running text
 * and are unaffected, since the tier only rewrites the ABBREVIATION.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["isan-jato"],
    currency: { $: ["dolara"], "US$": ["dolara amerikana"], "€": ["eorô"], Ar: ["ariary"] },
    magnitudes: ["arivo", "tapitrisa", "lavitrisa"],
    units: {
        km: ["kilaometatra"], m: ["metatra"], cm: ["santimetatra"], kg: ["kilao"],
        mm: ["milimetatra"], l: ["litatra"], L: ["litatra"],
    },
    exponentWords: { squared: ["toradroa"], cubed: ["toratelo"], position: "after" },
    ampersand: "sy",
});

/** Every rule emits Malagasy WORDS or ASCII digits; nothing reaches the phoneme sink as a spelling. */
export function normalizeMalagasy(input: string): string {
    let s = input;

    // 1) `&nbsp;` — and it is not a footnote here. ⚠ THE `ampersand` CELL IS MEASURING AN HTML ENTITY: of
    //    the 83 `&` in the mined segments **68 are `&nbsp;`** and only 15 are a real ampersand, so the
    //    dump's `ampersand` 30,267 is very largely this. It is French typography — the thin space before
    //    `%` and inside numbers (`45&nbsp;%n' ny vahoaka`, `6&nbsp;% ny PIB`) — and it must become a real
    //    space or every guard below sees a LETTER run where it expects a boundary. Trap 2, in a cell name.
    s = s.replace(/&nbsp;/gu, " ");

    // 2) THOUSANDS GROUPED WITH A SPACE — the defect with no symptom (see the file header). `\d{1,3}` plus
    //    the digit lookbehind is what keeps a YEAR out: in `1947 250` the first run is four digits, so the
    //    lookbehind rejects it. Measured 33/33 genuine, counter-examples none.
    //    ⚠ The trailing guard rejects a following DIGIT only, not a following mark, because the French
    //    convention combines both in one number: `299 792,458 km/s` (the speed of light) is space-grouped
    //    AND comma-decimal, and a `(?![\p{Nd}.,])` guard left its integer part as two separate numbers.
    s = s.replace(/(?<![\p{Nd}.,])(\p{Nd}{1,3}(?: \p{Nd}{3})+)(?!\p{Nd})/gu, (m) => m.replaceAll(" ", ""));

    // 3) THOUSANDS GROUPED WITH A PERIOD — only at exactly three digits, and only when no `°` follows.
    //    ⚠ THE DEGREE IS THE DISCRIMINATOR, and it is the corpus's own: every period-decimal that is not a
    //    thousands group is a coordinate and carries its degree sign (`4.175°`, `1.609°`, `47.536°`,
    //    `44.872°`), while the thousands are populations and money (`25.000fmg`, `30.000 eo ho eo`,
    //    `isam-ponina dia 5.196`). 3 of 3 thousands right, 4 of 5 decimals right; the miss is `~1.666 km`,
    //    a miles-to-kilometres factor, ×1.
    s = s.replace(/(?<![\p{Nd}.,])(\p{Nd}{1,3}(?:\.\p{Nd}{3})+)(?![\p{Nd}.,°])/gu, (m) => m.replaceAll(".", ""));

    // 4) DEGREES — `degre`, POSTPOSED, which is how the corpus writes it (`4.27471 degre`, `3.10228 degre`).
    //    `degrees` is 23,806 in the dump but that is overwhelmingly the commune coordinate stubs; the human
    //    instances are temperatures (`35°C`, `0°C`) and angles (`15°`, `4°40' atsimo`).
    //    ⚠ The scale LETTER is consumed rather than left behind: no Malagasy Celsius word is attested in
    //    either haystack, and unread the ⟨C⟩ was reaching the IPA as a bare [k] (`20 °C` → *ruapˈulu k*).
    //    Dropping the scale loses information; leaving a stray consonant in the phoneme stream is worse.
    //    ⚠ CASE-INSENSITIVE, which is trap 7 and cost the Kurmanji pass the same bug: with a case-sensitive
    //    `[CF]` the scale letter in `35°c` was not consumed and reached the IPA as a bare letter. The
    //    corpus writes it uppercase, so nothing here would have caught it — the probe did.
    s = s.replace(/(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°\s*[CF](?![\p{L}])/giu, "$1 degre ");
    //    ⚠ ONE GUARD, AND THE CORPUS SUPPLIES IT: `taonjato faha 17°` is "the 17TH century", not seventeen
    //    degrees — ⟨faha-⟩ is the Malagasy ordinal prefix, and the writer has used `°` the way French uses
    //    a raised ordinal marker. It is U+00B0, the real degree sign, so no character test separates them;
    //    the preceding `faha` does. ×1 of the 51 degree signs in the mined segments.
    s = s.replace(/(?<!faha\s{0,3}\p{Nd}{0,4})(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°/gu, "$1 degre ");

    // 5) PERCENT — `isan-jato`, POSTPOSED, corpus-attested five times in exactly that position
    //    (`Mitombo roa isan-jato isan-taona`, `ny 15 isan-jato ny vola`, `53,41 isanjato`,
    //    `latsaky ny iray isan-jato`).
    //
    //    ⚠ THE BOUND GENITIVE IS WRITTEN ON THE SIGN, and it has to move onto the WORD — trap 14's shape
    //    with the suffix attached to a symbol rather than to digits. The corpus writes `45 %n' ny vahoaka`
    //    and `90%n'ny solosaina`; the reading has to be `isan-jaton'`, which is exactly what the corpus
    //    itself writes when it spells the word out: `Ny 81 isan-jaton'ny mponina`. `%n'` ×7 and `%n'ny` ×2
    //    against 8 with nothing following and ~40 with an ordinary space and word.
    s = s.replace(/%\s*n['’]/gu, " isan-jaton'");
    //    Steps 4 and 5 emit a trailing/leading space so an expansion cannot glue itself to what follows
    //    (`4°40'` was becoming `4 degre40'`); where the source already had one, collapse the pair.
    s = s.replace(/ {2,}/gu, " ").replace(/ +$/u, "");

    // 6) THE SHARED TIER — percent, currency, units, the squared modifier and `&`. Runs ABOVE step 7,
    //    because the tier matches a unit only when a NUMBER is adjacent and the decimal rewrite destroys
    //    that adjacency (the playbook's "units before decimals" coupling).
    s = SYMBOLS(s);

    // 7) THE DECIMAL SEPARATOR — `faingo`, and this is the best-sourced decimal word in the sweep so far:
    //    mg.wikipedia's article on the comma defines it AND gives the numeric use with an example —
    //    *"Ny faingo (,) dia mari-piatoana…"* ("the faingo (,) is a punctuation mark…") and
    //    *"Ampiasaina koa ny faingo mba hanasarahana tarehimarika roa (ohatra: 2,3)"* ("the faingo is also
    //    used to separate two figures, example: 2,3"). `faingo mihevaheva` glosses French *virgule
    //    flottante*, "floating point". The fractional digits are emitted one at a time, as they are said.
    //
    //    ⚠ BOTH MARKS FEED IT, because this corpus writes decimals with both — the comma throughout human
    //    text and the period in the bot coordinate stubs. Steps 2–3 have already taken the thousands
    //    groups, so what reaches here is a decimal point whichever character carries it.
    s = s.replace(/(?<![\p{Nd}.,])(\p{Nd}+)[.,](\p{Nd}+)(?![\p{Nd}.,])/gu,
        (_m, whole: string, frac: string) => `${whole} faingo ${[...frac].join(" ")}`);

    // 8) FOUR CLASSES DECLINED, each with the count that justifies it:
    //    · THE MINUS (`signed-number` ×15,177 in the dump). Every mined instance is a BOT-TEMPLATE BCE YEAR
    //      (`teraka ny 1 Janoary -596 ary maty ny 1 Janoary -546`, the ancient-biography stub) or a negative
    //      COORDINATE (`-97.0602777778`). Neither wants "minus": the first means 596 BC and the second is a
    //      longitude. And the only candidate word fails on part of speech — `latsaka` ×24 is a comparative
    //      verb taking a whole clause (`tsy latsaka ny 8,5 %`, "not less than 8.5%"; `latsaka 40 kilometatra
    //      atsimon'ny`, "40 km south of"), the Fula `hakkunde` shape.
    //    · `=` and `×` (`arithmetic` ×489). The mined instances are orthography glosses in the article on
    //      Malagasy spelling (`ny n̂ ilazana ny feo n`) and dimension crosses; no Malagasy reading of either
    //      is attested.
    //    · RANGES (`ranges` ×5,175). Malagasy writes `hatramin'ny … ka hatramin'ny` ("from … to") when it
    //      means one, and the bare dashes in the mined set are date spans and page ranges.
    //    · THE CLOCK (`clock` ×11,406, and the count is a template artifact — the commune stubs write
    //      coordinates as `4°40'`). `:` already emits a comma pause, which is right for the citations that
    //      dominate the shape here, and no `HH:MM` time survives in the mined segments to argue otherwise.
    return s;
}
