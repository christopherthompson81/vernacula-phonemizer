/**
 * Serbian (sr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the sr_rs FLEURS corpus (1,923 unique utterances, column 3 — the CASED one):
 *
 *   ORDINAL NOTATION `N.` ×211 — by far the dominant defect, and the reason this file exists. Serbian
 *     writes an ordinal as the numeral plus a PERIOD, so the engine read the digits as a CARDINAL and then
 *     took the period as a sentence break: `1624. године` came out *hiljadu šeststo dvadeset ČETIRI .
 *     godine* — the wrong form of the numeral plus a spurious clause boundary in the middle of a phrase.
 *     The tabulation of what FOLLOWS the period (the German method) is what makes the rule safe:
 *         године ×102 · веку ×10 · века ×11 · години ×4 · годину ×1 · month genitive ×34   → 162 licensed
 *         <end of utterance> ×22 · a capitalised word ×2 (`21. Кудебек`, `1770. Некад`)    → 24 sentence ends
 *         everything else ×25 — scores (`5:3.`), model numbers (`типа 1.`, `Формуле 1.`), `4x4.`,
 *         `COVID-19.`, mid-list years (`од 1959.`) — genuinely ambiguous, so NOT claimed.
 *     The rule fires only on a LOWERCASE licensing word from a closed list, which is exactly the guard the
 *     two capitalised cases need: **zero sentence-final pauses are lost** (verified as 0 over the corpus
 *     diff — no `.`-pause disappears anywhere).
 *   numeral + HYPHEN + case suffix ×14 (`1970-их` ×9 decades, `15-ог`, `11-ом`, `12-ом`, `13-ом`, `13-то`)
 *     — the suffix is the last letters of the inflected ordinal, and every one reached the g2p as bare
 *     letters: `15-ог` → *petnaest OG*, `1970-их` → *…sedamdeset IH*.
 *   period-grouped thousands ×27 (`1.300`, `19.500`, `800.000`) — the grouping period was a sentence
 *     break AND split the number: `1.300 људи` → *jedan . trista ljudi*.
 *   comma decimals ×16 — the decimal comma was a phrase break: `1,5 километара` → *jedan , pet*.
 *   clock times ×15 — the colon is clause punctuation, so `11:00` was *jedanaest , nula*.
 *   unit abbreviations ×~45, all written in LATIN even in Cyrillic prose (km ×24, mm ×7, m ×4, h, s, cm,
 *     mi, Ghz ×2, Mbit) — every one reached the g2p raw: `km` → [km], `Ghz` → [ɡxz], `km/h` → [km x].
 *   numeric ranges ×12 — the dash was dropped outright, fusing the endpoints (`1644-1912`).
 *   percent ×3 (dropped outright), degree sign ×3, `×`/`x` between digits ×2, `+` ×1.
 *   dotted abbreviations: `итд.` ×5, `нпр.` ×3, `п. н. е.` ×3 (a multi-dot era marker).
 *
 * SERBIAN IS DIGRAPHIC, and the corpus settles what that means here rather than in the abstract. sr_rs is
 * written in CYRILLIC (198,266 Cyrillic letters against 792 Latin ones over 145 utterances), and every
 * Latin run in it is FOREIGN or symbolic: unit abbreviations (km, mm, Ghz), acronyms (FBI, UNESCO, GPS)
 * and foreign names/binomials (Cirque du Soleil, Geospiza conirostris). There is no Serbian-Latin prose in
 * this corpus — but Serbian-Latin prose is perfectly ordinary Serbian, and `serbian.ts`'s TOKEN already
 * claims both scripts (so nothing here ever reaches `core/foreign.ts`; the Latin is read with Serbian
 * letter values). The rules below therefore accept BOTH spellings of every word they match on, via a
 * Cyrillic→Latin transliteration of the captured text — `1624. године` and `1624. godine` behave alike.
 * Output words are emitted in LATIN, matching what `numbers.ts` already emits for cardinals; the g2p maps
 * the two scripts to the same IPA, so the choice is cosmetic.
 *
 * THREE-WAY COUNT AGREEMENT — Serbian takes RUSSIAN's selector, not Polish's, and the corpus proves both
 * slots rather than the grammar being assumed:
 *     2–4 → GENITIVE SINGULAR: `83 метра`, `24 сата`, `32 процента`   (not the nominative plural)
 *     5+  → GENITIVE PLURAL:   `48 сати`, `5 сати`, `30 степени`, `50 километара`, `90 процената`
 * so the shared `slavicCountForm` is reused unchanged. A DECIMAL needs no fourth `CountForms` entry here,
 * which is the divergence from Polish/Ukrainian: the corpus writes `1,5 сати` and `1,5 километара` — the
 * GENITIVE PLURAL — and `numValue` already maps a fraction onto that slot (1.5 → index 2). Both
 * attestations agree, so nothing is added. `2,3 <noun>` is unattested and left to fall where the selector
 * puts it (index 1, genitive singular).
 *
 * NOT claimed here, established by tabulation rather than assumption — see the commit message:
 *   · INITIALISMS. ~60 Latin acronym tokens occur (FBI, GPS, CCTV, NPWS, …) and ~30 of them have no vowel,
 *     so they reach the g2p as unreadable clusters ([fbi], [ɡps]). `core/initialisms.ts` would handle them
 *     given letter NAMES — but whether Serbian reads a foreign Latin acronym with Serbian letter names or
 *     English ones is a LEXICAL fact this corpus cannot settle, and inventing it would be confidently
 *     wrong rather than merely raw. No `acronymLetters`/`letterName` data is added.
 *   · CURRENCY: zero currency signs occur in sr_rs, so none is declared.
 *   · `Св.` ×3 is a saint's name in three different CASES (`Св. Џејмс` gen, `Св. Луису` dat, `Св. Петра`
 *     gen); one expansion cannot serve all three, so it is left alone.
 *   · Roman numerals arrive already converted to digits at the registry seam (sr is not in `ROMAN_NATIVE`),
 *     so `XVI` was already *šesnaest* and the roman-vs-initialism ordering hazard cannot arise.
 *   · `35°W` (a longitude) is deliberately outside the degree rule, which requires C or F.
 *
 * NOTE on boundaries: every one in this file is an explicit lookaround, never `\b`. `\b` is defined on
 * ASCII word characters and finds none against Cyrillic — the trap that made `core/initialisms.ts` a total
 * no-op for Russian (США → [sʂa]).
 */
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

// ---------------------------------------------------------------------------------------------------
// SCRIPT
// ---------------------------------------------------------------------------------------------------

/** Serbian Cyrillic → Gaj's Latin. A strict bijection (Vuk's alphabets were designed as one), used to read
 *  a captured word/suffix in EITHER script against a single Latin key set. Digraph outputs (lj/nj/dž) are
 *  irrelevant to the endings and licensors matched here but are included for correctness. */
const CYR2LAT: Readonly<Record<string, string>> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i", ј: "j",
    к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t",
    ћ: "ć", у: "u", ф: "f", х: "h", ц: "c", ч: "č", џ: "dž", ш: "š",
};

/** Lowercase and transliterate to Latin, so one key set serves both scripts. */
function lat(word: string): string {
    let out = "";
    for (const ch of word.toLowerCase()) out += CYR2LAT[ch] ?? ch;
    return out;
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/**
 * Masculine-nominative ordinals — the citation form the paradigm below inflects. Every form here is
 * ATTESTED in the sr_rs corpus itself or is the regular derivation of one: првог/прва, другог/другом,
 * трећем, четвртог/четврта, петог/петом/пети/пета, шестом, девети/девета, десете/десета, дванаестог,
 * петнаести, деветнаестог, двадесетог/двадесетом, хиљадита. `treći` is the one SOFT stem (see ENDINGS).
 */
const ORD_1_19: readonly string[] = [
    "", "prvi", "drugi", "treći", "četvrti", "peti", "šesti", "sedmi", "osmi", "deveti",
    "deseti", "jedanaesti", "dvanaesti", "trinaesti", "četrnaesti", "petnaesti", "šesnaesti",
    "sedamnaesti", "osamnaesti", "devetnaesti",
];
const ORD_TENS: readonly string[] = [
    "", "deseti", "dvadeseti", "trideseti", "četrdeseti", "pedeseti", "šezdeseti", "sedamdeseti",
    "osamdeseti", "devedeseti",
];
/** The hundreds ordinal is built on the (irregular) hundreds cardinal: sto→stoti, dvesta→dvestoti. */
const ORD_HUNDREDS: readonly string[] = [
    "", "stoti", "dvestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
    "osamstoti", "devetstoti",
];

/**
 * Integer → the masculine-nominative ordinal. Only the LAST element inflects in Serbian, so a compound is
 * its CARDINAL head plus the ordinal of the final non-zero part — 1624 → *hiljadu šeststo dvadeset* +
 * četvrti, 2010 → *dve hiljade* + deseti, 1500 → *hiljadu* + petstoti. The head goes through the engine's
 * own cardinal composer so it reads exactly as the bare numeral would.
 *
 * `undefined` for a round thousand other than 1000 (2000., 5000. — two corpus instances): those need the
 * FUSED form *dvehiljaditi*, which is a different word-formation and is not attempted here. Returning
 * undefined leaves the text untouched rather than emitting a guess.
 */
function ordinalBase(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 1_000_000) return undefined;
    if (n < 20) return ORD_1_19[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? ORD_TENS[t] : `${N.tens[t]!} ${ORD_1_19[u]!}`;
    }
    if (n < 1000) {
        const r = n % 100;
        return r === 0 ? ORD_HUNDREDS[n / 100] : `${numberToWords(n - r)} ${ordinalBase(r)!}`;
    }
    if (n === 1000) return "hiljaditi"; // attested in the corpus as хиљадита
    const r = n % 1000;
    if (r === 0) return undefined; // dvehiljaditi & co. — not attempted, see above
    return `${numberToWords(n - r)} ${ordinalBase(r)!}`;
}

/**
 * Definite-adjective endings for an ordinal, [HARD stem, SOFT stem]. `treći` is the only soft ordinal, and
 * it differs exactly where the ending starts with a back vowel: trećEg / trećEm / trećE, not *trećog.
 * Keys name the slot a licensing word governs; the values replace the citation form's final `-i`.
 */
const ENDINGS: Readonly<Record<string, readonly [string, string]>> = {
    "m.nom": ["i", "i"], "m.gen": ["og", "eg"], "m.loc": ["om", "em"], "n.nom": ["o", "e"],
    "f.nom": ["a", "a"], "f.gen": ["e", "e"], "f.dat": ["oj", "oj"], "f.acc": ["u", "u"],
    "pl.gen": ["ih", "ih"],
};

/** Inflect a citation-form ordinal into one slot. Only the final word carries the ending. */
function inflect(base: string, slot: string): string | undefined {
    const e = ENDINGS[slot];
    if (e === undefined) return undefined;
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const soft = last.endsWith("ći"); // treći
    words[words.length - 1] = `${last.slice(0, -1)}${soft ? e[1] : e[0]}`;
    return words.join(" ");
}

/** Every slot's form for `n`, for the suffix-matching rule (step 5). */
function ordinalForms(n: number): string[] {
    const base = ordinalBase(n);
    if (base === undefined) return [];
    return Object.keys(ENDINGS).map((k) => inflect(base, k)!);
}

/**
 * The closed list of LICENSING words that make a bare `N.` an ordinal, each mapped to the case slot it
 * governs. Derived by tabulating what follows `N.` across all 1,923 utterances (see the header); nothing
 * outside this list is claimed, which is what keeps every sentence-final period intact.
 *   · godina is FEMININE — `1624. godine` gen, `u 1988. godini` loc, `za 2016. godinu` acc
 *   · vek is MASCULINE — `16. veka` gen (corpus: двадесетог века), `u 20. veku` loc (двадесетом веку)
 *   · a month name after a day number is the GENITIVE of a masculine noun — `21. jula` → dvadeset prvog
 */
const LICENSOR: Readonly<Record<string, string>> = {
    godine: "f.gen", godini: "f.dat", godinu: "f.acc", godina: "f.nom",
    veka: "m.gen", veku: "m.loc", vek: "m.nom", vijeka: "m.gen", vijeku: "m.loc",
    januara: "m.gen", februara: "m.gen", marta: "m.gen", aprila: "m.gen", maja: "m.gen",
    juna: "m.gen", jula: "m.gen", avgusta: "m.gen", septembra: "m.gen", oktobra: "m.gen",
    novembra: "m.gen", decembra: "m.gen",
};

// ---------------------------------------------------------------------------------------------------
// COUNTED NOUNS
// ---------------------------------------------------------------------------------------------------

/** Pick a three-form Slavic count noun for `n`: [nom.sg, gen.sg (2–4), gen.pl]. */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(slavicCountForm(n), 2)]!;
}
const SAT = ["sat", "sata", "sati"] as const; // corpus: 24 сата · 48 сати · 5 сати
const MINUT = ["minut", "minuta", "minuta"] as const; // corpus: минут · минута
const STEPEN = ["stepen", "stepena", "stepeni"] as const; // corpus: 30 степени · степена
const METAR = ["metar", "metra", "metara"] as const; // corpus: 83 метра · 250 метара
const MEGABIT = ["megabit", "megabita", "megabita"] as const;

/** Dotted abbreviations whose dot is NOT a sentence end. */
const DOTTED: Readonly<Record<string, string>> = {
    itd: "i tako dalje", // ×5
    npr: "na primer", // ×3
    tzv: "takozvani",
};
/** Latin → Serbian Cyrillic, the inverse of CYR2LAT — so a rule keyed on Latin also matches the Cyrillic
 *  spelling the corpus actually writes. Written out rather than inverted at runtime because the digraph
 *  values (lj/nj/dž) do not invert character-by-character; none of them occurs in the keys above. */
const LAT2CYR: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(CYR2LAT).filter(([, l]) => l.length === 1).map(([c, l]) => [l, c]),
);
function cyr(word: string): string {
    let out = "";
    for (const ch of word) out += LAT2CYR[ch] ?? ch;
    return out;
}
/** BOTH SCRIPTS in the alternation. The first version listed the Latin keys only, and since sr_rs writes
 *  Cyrillic the rule was a total no-op on its own corpus — `итд.` still read as [itd] plus a phrase
 *  break. Digraphia bites the same way `\b` does: a rule that looks right matches nothing. */
const DOTTED_ALT = Object.keys(DOTTED)
    .flatMap((k) => [k, cyr(k)])
    .sort((a, b) => b.length - a.length)
    .join("|");

const NOT_LETTER = "(?![\\p{L}\\p{M}])";

/**
 * #562 symbol normalization — Serbian. The abbreviations are LATIN even in Cyrillic prose (every one of
 * the ~45 unit tokens in sr_rs is), so the keys are Latin only; the tier lowercases before lookup, which
 * is what lets `Ghz` match `ghz`.
 *
 * `unitPer` is "na" + ACCUSATIVE, corpus-attested three times in spelled-out form (`240 километара НА
 * сат`, `300 миља на сат`, `149 миља на сат`). The SECOND-based rate takes a different preposition — the
 * corpus writes `1,5 километара У СЕКУНДИ` — which one `unitPer` cannot express, so `/s` is composed
 * locally in step 6 instead. Reported as a limitation rather than worked around in core.
 *
 * No currency (zero signs in sr_rs) and no `exponentWords` (zero ² / ³ / `km2`; the corpus spells
 * *квадратних километара* out).
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["posto"], // INDECLINABLE — corpus посто ×57 against процената ×8 / одсто ×3; espeak's
    // shared hbs table gives `%` → posto too. One form, so the count selector never has to choose.
    /**
     * CURRENCY (#584). `$5` read as bare *pet*. sr_rs contains ZERO `$` against 24 `%`, so the corpus-driven
     * gate could not see it — but the words are in that corpus, and they DECLINE, which is why a token test
     * for the bare nominative found nothing and the stem had to be searched instead:
     *
     *   долара ×17 · долари ×2   "милијарде америчких долара ради избегавања пореза"
     *   јена   ×2               "од 2500 и 130.000 јапанских јена"
     *
     * Three forms through `slavicCountForm`, as the units above take: 1 долар · 2–4 долара · 5+ долара.
     * `долар` itself is the citation form of the attested долара rather than a separate finding.
     *
     * WRITTEN IN LATIN to match `posto` and the unit table, though the corpus attests Cyrillic. Serbian is
     * digraphic and this engine reads both — measured, not assumed: `dolar`/`долар`, `dolara`/`долара`,
     * `jen`/`јен` and `posto`/`посто` each phonemize IDENTICALLY.
     *
     * `€` AND `£` ARE DELIBERATELY ABSENT, and both are traps this sourcing walked into:
     *   · `евр` returns 28 corpus hits of which 27 are **Европа/Европи/Европе/Европу** — the stem of Europe.
     *     One remaining `евра` is a lead, not a finding.
     *   · `фунти` ×12 looks like a solid pound until the sentence is read: "Особа која на Земљи тежи
     *     200 фунти (90 кг)" — the WEIGHT pound, not the currency. The Malay `paun` trap exactly.
     */
    currency: { $: ["dolar", "dolara", "dolara"], "¥": ["jen", "jena", "jena"] },
    units: {
        km: ["kilometar", "kilometra", "kilometara"],
        m: ["metar", "metra", "metara"],
        mm: ["milimetar", "milimetra", "milimetara"],
        cm: ["centimetar", "centimetra", "centimetara"],
        mi: ["milja", "milje", "milja"],
        ghz: ["gigaherc", "gigaherca", "gigaherca"],
    },
    unitPer: "na",
    rateDenominators: { h: "sat" }, // `s` is NOT declared: its Serbian rate is "u sekundi", not "na …"
    // `km²` ×2 (`19.500 km²`, `3850 km²`) — the ² was left behind as an unreadable character. Serbian puts
    // the measure adjective BEFORE the noun as a separate agreeing word, Russian-style, and BOTH count
    // forms it needs are attested in this corpus spelled out: `783.562 КВАДРАТНА километра` (2–4) and
    // `23.764 КВАДРАТНИХ километара` (5+). `кубних метара` is attested too, so cubed is declared with it.
    exponentWords: {
        squared: ["kvadratni", "kvadratna", "kvadratnih"],
        cubed: ["kubni", "kubna", "kubnih"],
        position: "before",
    },
    countForm: slavicCountForm,
});

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** Normalize one Serbian input string. Pure text→text. */
export function normalizeSerbian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — Serbian groups thousands with a PERIOD, and until it is removed the
    //    period is read as clause punctuation and the number is split in two (`1.300` → *jedan . trista*).
    //    Two passes, because adjacent groups share a digit (`800.000`). EXACTLY three digits are required
    //    and no space is allowed, which is what keeps the corpus's `802.11` (a Wi-Fi standard, ×5), its
    //    `12.00 сати` (step 2) and every sentence-final `N.` out of this rule.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");

    // 1) MULTI-DOT ERA MARKER, before the single-dot abbreviation rule (step 3) and before the `N.`
    //    ordinal rule (step 7) — `1000. п. н. е.` contains both, and its interior dots were becoming
    //    phrase breaks (`hiljadu . p . n . e .`).
    //    THE FINAL DOT IS TWO DIFFERENT THINGS: in `Око 1000. п. н. е. Асирци су…` it is also the sentence
    //    end, and consuming it unconditionally loses the boundary — the bug the Russian and Ukrainian runs
    //    both hit. The discriminator is CASE, which a cased script gives for free, and the test must run in
    //    the CALLBACK: `\p{Lu}` inside an `i`-flagged pattern matches lowercase too.
    //    A YEAR immediately before the era marker is an ORDINAL with *godina* ELIDED (`Око 1000. п. н. е.`
    //    = *oko hiljadite pre nove ere*), and step 7's licensor list cannot see it because step 1 will have
    //    rewritten the marker by then. Claimed here, in the feminine genitive the elided noun governs.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(?=(?:п\.\s?н\.\s?е|p\.\s?n\.\s?e)(?![\p{L}\p{M}]))/giu,
        (whole, digits: string) => {
            const base = ordinalBase(Number(digits));
            return base === undefined ? whole : `${inflect(base, "f.gen")!} `;
        });
    for (const [pat, words] of [["п\\.\\s?н\\.\\s?е", "pre nove ere"], ["p\\.\\s?n\\.\\s?e", "pre nove ere"],
        ["н\\.\\s?е", "nove ere"], ["n\\.\\s?e", "nove ere"]] as const) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${pat}\\.(\\s*)(\\S?)`, "giu"), replaceEra(words));
        //    The FINAL DOT IS SOMETIMES ABSENT — the corpus writes `п.н.е,` once — so a second pass claims
        //    the dotless form. Guarded against a following letter so it cannot bite into a real word.
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${pat}(?![\\p{L}\\p{M}.])`, "giu"), words);
    }

    // 2) DOT-WRITTEN CLOCK — `12.00 сати` (×1). Claimed only when the hour noun is already WRITTEN, which
    //    is what separates it from a decimal; the trailing noun is left in place and the dot pair dropped.
    //    Must run after step 0 (which would otherwise not touch it — 2 digits, not 3) and before step 8.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{2})(?=\s*(?:сати|часова|sati|časova))/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} i ${Number(min)}`));

    // 3) DOTTED ABBREVIATIONS. The dot is consumed before a following word so it cannot become a phrase
    //    break; at a real sentence end it is kept.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(\\s+)(?=[\\p{L}\\d(])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED[lat(ab)]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(?=\\s*[,;:])`, "giu"),
        (_m, ab: string) => DOTTED[lat(ab)]!);
    //    A CLOSING BRACKET OR QUOTE IS NOT A PAUSE — serbian.jsonc maps only `.!?…,;:` — so the dot must be
    //    KEPT before one, not consumed the way it is before a comma. The first version grouped `)` with the
    //    comma and the corpus's `…, итд.)` at end of utterance lost its sentence-final pause outright: one
    //    utterance, caught by the corpus diff and invisible to every probe.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(?=\\s*(?:[.!?”"»)\\]]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED[lat(ab)]!}.`);

    // 4) DEGREES. Only `°C` / `°F` are claimed: the third corpus instance is `35°W`, a LONGITUDE, and a
    //    bare-degree rule would read it as a temperature. The written degree noun is CONSUMED when it is
    //    present — the corpus writes `32 °C степена`, and emitting the word again gave *…stepeni …
    //    stepena*. The count agrees with the numeral (32 → gen.sg stepena), not with what was written.
    s = s.replace(/(\d+)\s?°\s?([CFСcf])(?![\p{L}\p{M}])(\s*(?:степен[аи]|stepen[ai]))?/gu,
        (_m, n: string, unit: string, _written: string | undefined) =>
            `${n} ${counted(Number(n), STEPEN)} ${/[Ff]/u.test(unit) ? "Farenhajta" : "Celzijusa"}`);
    //    4b) THE BARE DEGREE, which this rule used to decline on purpose — "a bare-degree rule would read
    //    `35°W` as a temperature". That reasoning protects the SCALE word, and it over-corrected: the arm
    //    above supplies both the degree noun and Celsius/Fahrenheit, so declining the whole shape threw away
    //    the degree noun too. The corpus's `источно од 35°W.` read *…istočno od trideset pet .* — the `°` and
    //    the `W` both silent, so a longitude lost the word that makes it a longitude.
    //    This arm emits the DEGREE NOUN ONLY, with the same numeral agreement (35 → *stepeni*), and no scale
    //    word — which is exactly right for a longitude and harmless for a bare temperature. It is safe to
    //    write unguarded because the C/F arm above has already consumed those forms.
    //    ⚠ THE COMPASS LETTER IS STILL NOT READ, and that is a stated limit rather than an oversight. The full
    //    form is *35 степени западне географске дужине*, but a four-way table cannot be sourced here: `западно`
    //    ×9, `западне` ×7, `северне` ×5, `источне` ×2 — and `јужне` is ×0. Inventing the missing quarter to
    //    complete a table is the failure this repo keeps records to avoid, so the `W` keeps the silence it has
    //    today and only the recoverable half is fixed.
    s = s.replace(/(\d+)\s?°/gu, (_m, n: string) => `${n} ${counted(Number(n), STEPEN)}`);

    // 5) NUMERAL + HYPHEN + CASE SUFFIX (`1970-их`, `15-ог`, `11-ом`, `13-то`). As in Russian, the written
    //    suffix is the LAST LETTERS of the inflected ordinal, not an appendable marker, so the rule
    //    generates every case form and keeps the one that actually ends with those letters — a guard that
    //    makes the paradigm safe and rejects anything it does not cover.
    //    MUST run before the range rule (step 6b), which would otherwise eat the hyphen. The suffix is
    //    capped at 2 letters and may not be followed by a letter, which excludes the two COMPOUND
    //    ADJECTIVES in the corpus (`24-часовном`, `11-годишња`): reading those needs the combining stem
    //    (dvadesetčetvoro-, jedanaesto-), a different word-formation, and they are deliberately left as
    //    the cardinal plus the word — the right words in the right order.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{Ll}{1,2})${NOT_LETTER}`, "gu"),
        (whole, digits: string, rawSuffix: string) => {
            const suffix = lat(rawSuffix);
            return ordinalForms(Number(digits)).find((f) => f.endsWith(suffix)) ?? whole;
        });

    // 6) UNITS THE SHARED TIER CANNOT EXPRESS, before the tier itself and before every rule that destroys
    //    number-to-unit adjacency (the decimal fold, step 9).
    //    The `/s` rate takes "u sekundi", not `unitPer`'s "na" + accusative — the corpus writes both
    //    (`240 километара НА сат` vs `1,5 километара У СЕКУНДИ`) and one `unitPer` cannot carry both.
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), MEGABIT)} u sekundi`);
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), METAR)} u sekundi`);

    // 6b) NUMERIC RANGES. The dash was dropped outright, fusing the endpoints into one run of words.
    //     Digits are required on BOTH sides, which keeps `COVID-19`, `XDR-TB` and `A1GP` out. Runs AFTER
    //     step 5 (which needs the hyphen) and BEFORE step 7, so that `1000-1300. године` still has a digit
    //     on the right when this fires.
    //     KNOWN false positives, counted rather than assumed: 3 of the 12 are SCORES or a season (`6-6`,
    //     `7-2`, `1995-96`) where "do" is the wrong connective — but the endpoints were fusing there too,
    //     so no reading is lost, only a wrong-ish connective gained.
    s = s.replace(/(\d)\s?[-–—]\s?(?=\d)/gu, "$1 do ");

    // 7) THE `N.` ORDINAL — the rule this file exists for (see the header for the full tabulation).
    //    Claimed ONLY when a licensing word from the closed list follows, and only when that word is
    //    LOWERCASE. The case guard is what preserves the sentence boundary: the corpus's `21. Кудебек је…`
    //    and `…града 1770. Некад се могу…` are sentence ends whose next word happens to be capitalised,
    //    and Serbian starts every sentence with a capital, so requiring lowercase excludes them by
    //    construction. Nothing outside the list is touched at all, so all 22 utterance-final `N.` and all
    //    25 ambiguous ones keep their period — zero sentence-final pauses lost.
    //    Runs AFTER step 0 (de-grouping) so `1.300` is already whole, and AFTER step 1 so `п. н. е.` is
    //    gone and cannot be mistaken for a licensor.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
        (whole, digits: string, word: string) => {
            const slot = LICENSOR[lat(word)];
            if (slot === undefined) return whole;
            const base = ordinalBase(Number(digits));
            if (base === undefined) return whole; // round thousands — see ordinalBase
            return `${inflect(base, slot)!} ${word}`;
        });

    // 8) CLOCK. The colon is clause punctuation in serbian.jsonc, so `11:00` read as *jedanaest , nula*.
    //    Serbian says a CARDINAL hour with the counted noun — `u 11 sati`, `devet sati i trideset minuta` —
    //    unlike Ukrainian's feminine ordinal. TWO-DIGIT minutes are required, which is what keeps the
    //    corpus's scores (`5:3`, `26 : 0`) out of this rule. Runs before the decimal fold (step 9).
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu, (_m, h: string, min: string) => {
        const hv = Number(h), mv = Number(min);
        const head = `${numberToWords(hv)} ${counted(hv, SAT)}`;
        return mv === 0 ? head : `${head} i ${numberToWords(mv)} ${counted(mv, MINUT)}`;
    });

    // 9) THE SHARED SYMBOL TIER — %, units, rates. It must see the number still ADJACENT to its unit and
    //    still carrying its decimal comma (`3,50 m`, `2,4 Ghz`), so it runs before step 10 folds the comma
    //    into a word, and after step 0 has made the integer whole.
    s = SYMBOLS(s);

    // 10) DECIMAL COMMA → the word. Serbian reads the decimal separator as *zarez*; espeak-ng's shared hbs
    //     table gives `_dpt` (decimal point) → z'a*Ez for all three standards, and the corpus offers no
    //     counter-example (it spells no decimal out). Until now the comma was clause punctuation, so
    //     `1,5 километара` was a PHRASE BREAK between "jedan" and "pet".
    //     LAST among the numeric rules, because it destroys the number: every rule above that needs the
    //     value (units, the clock, the tier's count agreement) has already run.
    s = s.replace(/(?<=\d),(?=\d)/gu, " zarez ");

    // 11) SIGNS. `×`/`x` between digits was dropped outright, fusing `4x4`, `6×2` and `36 x 24 mm` into
    //     two bare numerals; `+` (×1, in `UTC+1`) lost its sign. espeak's shared hbs table gives × → puta
    //     and + → plus.
    //     NO MINUS RULE, and that is a measured decision rather than an omission. The first version read a
    //     leading `–`/`−` before a number as a minus sign, the way ru and uk do — and the corpus contains
    //     ZERO negative numbers but eleven `–` used as a PUNCTUATION dash, one of which sits before a
    //     numeral: `…изгледа низак – 6000 од укупно…` became *…nizak MINUS šest hiljada…*. Confidently
    //     wrong, which is worse than the dropped dash it replaced, so the rule was withdrawn.
    s = s.replace(/(?<=\d)\s?[x×]\s?(?=\d)/gu, " puta ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1plus $2");

    return s;
}

/** Integer part of a Serbian-written number ("3,50" → 3), for the local count-agreement calls. */
function intOf(n: string): number {
    return Math.trunc(Number(n.replace(/\./gu, "").replace(",", ".")));
}

/**
 * The era-marker replacer (step 1). Keeps the final dot only when it was ALSO the sentence end: end of
 * input, or a following capital. A following punctuation mark already carries the break, so the dot is
 * consumed there rather than doubled.
 */
function replaceEra(words: string): (m: string, sp: string, next: string) => string {
    return (_m: string, sp: string, next: string): string => {
        if (next === "") return `${words}.`;
        if (/[,;:!?)»”"]/u.test(next)) return `${words}${sp}${next}`;
        if (/\p{Lu}/u.test(next)) return `${words}.${sp}${next}`;
        return `${words}${sp}${next}`;
    };
}
