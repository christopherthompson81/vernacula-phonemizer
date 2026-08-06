/**
 * Croatian (hr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Croatian and Serbian are the pluricentric standards of ONE phonological system (Serbo-Croatian), so this
 * file is the Serbian normalize.ts (src/languages/serbian/normalize.ts) adapted to the CROATIAN corpus's
 * forms — the period-thousands/ordinal disambiguation, the hyphen+case-suffix decades, the three-way count
 * agreement, the dot-clock — with the differences that the hr_hr corpus actually shows:
 *   · DECIMAL COMMA, not period — `2,4 Ghz`, `5,0 Ghz`, `802,11 n` (the Serbian corpus writes the comma
 *     too, but Croatian's dot-thousands make the comma the unambiguous decimal).
 *   · the CROATIAN `h` CLOCK SUFFIX — `23:35 h`, `22:00 i 23:00 h` (h = sat).
 *   · the `n. e.` (nove ere) / `p.n.e.` (prije nove ere) era markers.
 *   · the CROATIAN licensors for the `N.` ordinal — month GENITIVES (kolovoza, rujna, listopada, srpnja),
 *     stoljeća, marka, najvećim (locative), godine.
 *   · prenominal ROMAN ordinals — `I. i II. svjetski rat` (the roman-vs-ordinal seam).
 *
 * MEASURED over the hr_hr FLEURS corpus.
 *
 * NOTE on boundaries: every one here is an explicit lookaround, never `\b` (trap 1 (`\b` is ASCII-defined)).
 */
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { SYMBOLS } from "./croatian.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Masculine-nominative ordinals 1–19 (the citation form the paradigm inflects). */
const ORD_1_19: readonly string[] = [
    "", "prvi", "drugi", "treći", "četvrti", "peti", "šesti", "sedmi", "osmi", "deveti",
    "deseti", "jedanaesti", "dvanaesti", "trinaesti", "četrnaesti", "petnaesti", "šesnaesti",
    "sedamnaesti", "osamnaesti", "devetnaesti",
];
const ORD_TENS: readonly string[] = [
    "", "deseti", "dvadeseti", "trideseti", "četrdeseti", "pedeseti", "šezdeseti", "sedamdeseti",
    "osamdeseti", "devedeseti",
];
const ORD_HUNDREDS: readonly string[] = [
    "", "stoti", "dvjestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
    "osamstoti", "devetstoti",
];

/** Integer → the masculine-nominative ordinal; only the LAST element inflects. */
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
    if (n === 1000) return "tisućiti";
    const r = n % 1000;
    if (r === 0) return undefined;
    return `${numberToWords(n - r)} ${ordinalBase(r)!}`;
}

/** Definite-adjective endings for an ordinal, [HARD stem, SOFT stem] (treći is the only soft). */
const ENDINGS: Readonly<Record<string, readonly [string, string]>> = {
    "m.nom": ["i", "i"], "m.gen": ["og", "eg"], "m.loc": ["om", "em"], "n.nom": ["o", "e"],
    "n.gen": ["og", "eg"], "n.loc": ["om", "em"],
    "f.nom": ["a", "a"], "f.gen": ["e", "e"], "f.dat": ["oj", "oj"], "f.acc": ["u", "u"],
    "pl.gen": ["ih", "ih"],
};
function inflect(base: string, slot: string): string | undefined {
    const e = ENDINGS[slot];
    if (e === undefined) return undefined;
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const soft = last.endsWith("ći");
    words[words.length - 1] = `${last.slice(0, -1)}${soft ? e[1] : e[0]}`;
    return words.join(" ");
}
function ordinalForms(n: number): string[] {
    const base = ordinalBase(n);
    if (base === undefined) return [];
    return Object.keys(ENDINGS).map((k) => inflect(base, k)!);
}

/** The closed list of licensing words that make a bare `N.` an ordinal, each → the case slot it governs.
 *  Croatian month names are GENITIVE after a day number (15. kolovoza = the 15th of August). */
const LICENSOR: Readonly<Record<string, string>> = {
    godine: "f.gen", godini: "f.dat", godinu: "f.acc", godina: "f.nom",
    stoljeća: "n.gen", stoljeću: "m.loc", stoljeće: "m.nom", vijeka: "m.gen", vijeku: "m.loc",
    marka: "f.gen", marku: "f.acc", najvećim: "m.loc",
    // Added from the review's tabulation of what the list was LEAVING BEHIND — every one of these follows
    // an `N.` somewhere in the corpus and governs a slot the paradigm already has: `190. mjesto` (rank),
    // `37. najveća zemlja`, `4. kategorije` (a storm category), `članku 247. pakistanskog Ustava`,
    // `11. husarska pukovnija`.
    mjesto: "n.nom", mjestu: "n.loc", najveća: "f.nom", najveći: "m.nom", najveće: "n.nom",
    kategorije: "f.gen", pakistanskog: "m.gen", pukovnija: "f.nom", husarska: "f.nom",
    kolovoza: "m.gen", rujna: "m.gen", listopada: "m.gen", srpnja: "m.gen", travnja: "m.gen",
    svibnja: "m.gen", lipnja: "m.gen", siječnja: "m.gen", veljače: "m.gen", ožujka: "m.gen",
    studenoga: "m.gen", prosinca: "m.gen",
    // World War ordinals (the roman "I."/"II." arrive as digits 1/2 — see step 4b).
    svjetskog: "m.gen", svjetskom: "m.loc", svjetski: "m.nom", svjetskoga: "m.gen",
    reda: "m.gen", redu: "m.loc",
};

// ---------------------------------------------------------------------------------------------------
// COUNTED NOUNS
// ---------------------------------------------------------------------------------------------------

/** Pick a three-form Slavic count noun for `n`: [nom.sg, gen.sg (2–4), gen.pl]. */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(slavicCountForm(n), 2)]!;
}
const SAT = ["sat", "sata", "sati"] as const; // 22 sata · 23 sata · 15 sati
const MINUT = ["minut", "minuta", "minuta"] as const;
const METAR = ["metar", "metra", "metara"] as const;
const MILJA = ["milja", "milje", "milja"] as const;

/** Integer part of a Croatian-written number ("2,4" → 2), for the local count-agreement calls. */
function intOf(n: string): number {
    return Math.trunc(Number(n.replace(/\./gu, "").replace(",", ".")));
}

// ---------------------------------------------------------------------------------------------------
// THE RULES
// ---------------------------------------------------------------------------------------------------

/** Normalize one Croatian input string. Pure text→text. */
export function normalizeCroatian(input: string): string {
    let s = input;

    // 0) ZERO-WIDTH — the corpus has U+200B ×5.
    s = s.replace(/[\u200B\u200C\u200D\uFEFF]/gu, "");

    // 1) DIGIT DE-GROUPING, FIRST — Croatian groups thousands with a PERIOD, and until it is removed the
    //    period is read as clause punctuation. EXACTLY three digits, no space (keeps `802.11` and the
    //    `N.` ordinals out). The comma-decimal and the en-dash range are handled separately.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");
    // The EN-DASH RANGE between two dotted numbers (`1000. – 1300. n. e.`) must be claimed before the
    //    era-ordinal rule (step 2) consumes the second dotted number.
    s = s.replace(/(\d{1,4})\.\s*[-–—]\s*(\d{1,4})\.(?=\s*(?:n\.\s?e\.|p\.\s?n\.\s?e\.))/gu, "$1 do $2");

    // 2) MULTI-DOT ERA MARKER — `n. e.` (nove ere), `p.n.e.` (prije nove ere), `g. n. e.`, `g. pr. Kr.`
    //    (godine prije Krista), and the `400. g. n. e.` form. BEFORE the dotted-abbreviation and N.
    //    ordinal rules. The leading `N.` of `400. g. n. e.` / `1000. g. pr. Kr.` is an ORDINAL (godine
    //    elided).
    //    The `g.` (godine) is BETWEEN the year-ordinal and the era marker, so the year-ordinal claim
    //    looks past it.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(?:g\.\s+)?(?=(?:n\.\s?e|p\.\s?n\.\s?e|pr\.\s?Kr\.)(?![\p{L}\p{M}]))/giu,
        (whole, digits: string) => {
            const base = ordinalBase(Number(digits));
            return base === undefined ? whole : `${inflect(base, "f.gen")!} `;
        });
    s = s.replace(/(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(?=[.!?]|$)/giu, "prije nove ere.");
    s = s.replace(/(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(\s)/giu, "prije nove ere$1");
    s = s.replace(/(?<![\p{L}\p{M}])n\.\s?e\.(?=[.!?]|$)/giu, "nove ere.");
    s = s.replace(/(?<![\p{L}\p{M}])n\.\s?e\.(\s)/giu, "nove ere$1");
    s = s.replace(/(?<![\p{L}\p{M}])pr\.\s?Kr\.(?=[.!?]|$)/giu, "prije Krista.");
    s = s.replace(/(?<![\p{L}\p{M}])pr\.\s?Kr\.(\s)/giu, "prije Krista$1");
    // The `g.` in `400. g. n. e.` / `1000. g. pr. Kr.` is "godine" (elided); drop it after the claim.
    s = s.replace(/(?<=\d)\s+g\.\s+(?=(?:n\.\s?e\.|pr\.\s?Kr\.))/giu, " ");

    // 3) DOTTED ABBREVIATIONS. `itd.` → "i tako dalje". The dot is consumed before a following word.
    s = s.replace(/(?<![\p{L}\p{M}])itd\.(\s+)(?=[\p{L}\d(])/giu, "i tako dalje$1");
    s = s.replace(/(?<![\p{L}\p{M}])itd\.(?=\s*[,;:])/giu, "i tako dalje");
    s = s.replace(/(?<![\p{L}\p{M}])itd\.(?=\s*(?:[.!?”"»)\]])|$)/giu, "i tako dalje.");

    // 4) DOTTED CAPITAL RUNS — `George W. Bush`. The W. suffix dot is a break. The single-initial form
    //    (W. Bush) needs the lone-initial rule too.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=\p{Lu}\p{L}*\s)(\p{Lu})\.(?=\s+\p{Lu}\p{Ll})/gu, "$1");
    // `Dr.` → "doktor"; `SAD` (USA) → the expansion.
    s = s.replace(/(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])/giu, "Doktor$1");
    s = s.replace(/(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))/giu, "Doktor.");
    s = s.replace(/(?<![-\p{L}\p{M}])SAD(?=-)/gu, "Sjedinjene Američke Države");

    // 4b) PRENOMINAL ROMAN ORDINALS — `I. svjetskog rata`, `II. svjetskom ratu`, `I. i II. reda`
    //     (World War I/II, first/second order). The shared roman pass skips single-letter I (below its
    //     two-character minimum), and Croatian writes these as a numeral + the ordinal period before a
    //     lowercase noun. The registry's roman→digit conversion also cannot see the dotted form here,
    //     so the ordinal is claimed directly, inflected for the slot the following word governs.
    const ROMAN_ORD: Readonly<Record<string, string>> = { I: "prvi", II: "drugi", III: "treći", IV: "četvrti", V: "peti" };
    s = s.replace(/(?<![\p{L}\p{M}])([IVXL]+)\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
        (whole, rom: string, word: string) => {
            const base = ROMAN_ORD[rom.toUpperCase()];
            if (base === undefined) return whole;
            // The slot from the licensing word's ending: svjetskog/svjetskom/reda → the matching case.
            const slot = word.endsWith("og") ? "m.gen" : word.endsWith("om") ? "m.loc"
                : word.endsWith("e") || word.endsWith("a") ? "m.gen" : "m.nom";
            const ord = inflect(base, slot);
            return ord === undefined ? whole : `${ord} ${word}`;
        });

    // 5) DEGREES. `90 °F`, `+30°C`, `35° W` (a LONGITUDE — the bare-degree rule must not claim it).
    s = s.replace(/(\d+)\s?°\s?([CFcf])(?![\p{L}\p{M}])/gu, (_m, n: string, u: string) =>
        `${n} ${/[Ff]/u.test(u) ? "stupnjeva Farenhajta" : "stupnjeva Celzija"}`);
    s = s.replace(/(\d+)\s?°\s?([NSEWnsew])(?![\p{L}\p{M}])/gu, (_m, n: string, c: string) =>
        `${n} stupnjeva ${({ N: "sjeverno", S: "južno", E: "istočno", W: "zapadno" } as Record<string, string>)[c.toUpperCase()]!}`);

    // 6) NUMERAL + HYPHEN + CASE SUFFIX (`1970-ih`, `15-og`). The suffix is the LAST LETTERS of the
    //    inflected ordinal. Runs before the range rule.
    s = s.replace(/(?<![\d.,])(\d+)\s?-\s?(\p{Ll}{1,2})(?![^\p{L}\p{M}]|.)/gu,
        (whole, digits: string, rawSuffix: string) =>
            ordinalForms(Number(digits)).find((f) => f.endsWith(rawSuffix.toLowerCase())) ?? whole);

    // 7) THE `N.` ORDINAL — claimed when a licensing word from the closed list follows, LOWERCASE.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
        (whole, digits: string, word: string) => {
            const slot = LICENSOR[word];
            if (slot === undefined) return whole;
            const base = ordinalBase(Number(digits));
            if (base === undefined) return whole;
            return `${inflect(base, slot)!} ${word}`;
        });

    // 7b) A YEAR WITH `godine` ELIDED — the other half of the corpus's ordinals, and the licensor list
    //     cannot see them because the licensing noun is not written. Tabulating what the closed list left
    //     behind: **76 mid-sentence years** (`1683. dinastija Qing`, `1965. bio je prvi čovjek`), **22 at
    //     an utterance end** (`vladao do 1945.`), **4 before a capital** (`15. kolovoza 1940. Saveznici`),
    //     against 12 sentence-final scores/clocks (`6:6.`, `07:30.`) and ~15 one-off ranks. So the closed
    //     list claimed 108 of 216 `N.` instances and the rest read as CARDINALS with a spurious break.
    //
    //     A four-digit number in 1000–2100 followed by a period is a year, and a Croatian year is an
    //     ORDINAL in the feminine genitive that agrees with the elided *godine* — the same slot the
    //     written `1940. godine` takes, so no case is being guessed. The PERIOD is kept only where it is
    //     also a sentence end (an utterance end, or a capitalised word after it); mid-sentence it is the
    //     ordinal marker and must not become a pause.
    //     A SENTENCE END is a capital or the end of the utterance — NOT merely "no letter follows".
    //     Closing punctuation counts as neither: the corpus writes the year range `(1644. - 1912.)`, where
    //     both periods are ordinal markers and the text runs on after the bracket.
    s = s.replace(/(?<![\d.,\-])(1\d{3}|20\d{2}|2100)\.(?!\d)/gu, (whole, digits: string, at: number, all: string) => {
        const base = ordinalBase(Number(digits));
        if (base === undefined) return whole;
        const year = inflect(base, "f.gen");
        if (year === undefined) return whole;
        const rest = all.slice(at + whole.length).replace(/^[\s)»"'\]]+/u, "");
        const sentenceEnd = rest === "" || /^[\p{Lu}]/u.test(rest);
        return `${year}${sentenceEnd ? "." : ""}`;
    });

    // 8) CLOCK, in the COLON form, with the CROATIAN `h` (sat) suffix. `22:00 i 23:00 h` → dvadeset dva
    //    sata i dvadeset tri sata; `23:35 h` → dvadeset tri sata i trideset pet minuta. NOT a sports
    //    time: a THIRD `\d.\d\d` field (4:41.30) means a pace. The optional `h` is consumed WITHOUT
    //    eating the space before a following word (the clock-glue trap): a bare `\s*` glued "22:00 i
    //    23:00" → "satai" and "12:00 GMT" → "satiGMT".
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*h)?/giu,
        (_m, h: string, min: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return _m;
            const head = `${numberToWords(hv)} ${counted(hv, SAT)}`;
            return mv === 0 ? head : `${head} i ${numberToWords(mv)} ${counted(mv, MINUT)}`;
        });

    // 9) NUMERIC RANGES — `10 – 60`, `2-3`, `120-160`. Croatian "do" (to).
    s = s.replace(/(\d)\s?[-–—]\s?(?=\d)/gu, "$1 do ");

    // 9b) MILJA RATE — the corpus writes "milja/h" and "milja/sat" (miles per hour). "milja" is already
    //     the Croatian word; only the /sat or /h denominator needs reading. The tier's `mi` key does not
    //     match the spelled "milja", so the rate is composed here.
    s = s.replace(/(\d+(?:,\d+)?)\s?milja\s*\/\s*(?:sat|h)(?![\p{L}\p{M}])/giu,
        (_m, n: string) => `${n} ${counted(intOf(n), MILJA)} na sat`);

    // 10) THE SHARED SYMBOL TIER — %, units, rates. The number must be ADJACENT to its unit and still
    //     carry its decimal comma (`2,4 Ghz`), so it runs before step 11 folds the comma into a word.
    s = SYMBOLS(s);

    // 11) DECIMAL COMMA → the word. Croatian reads the decimal comma as "zarez".
    s = s.replace(/(?<=\d),(?=\d)/gu, " zarez ");

    // 12) FRACTIONS. `29¾ sa 24½ inča`, `1/5 inča`. The vulgar fractions read "i tri četvrtine"/"i pola";
    //     the ratio reads "jedan peti" (one fifth).
    s = s.replace(/(\d+)¾/gu, "$1 i tri četvrtine");
    s = s.replace(/(\d+)½/gu, "$1 i pol");
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const ord = ordinalBase(Number(b));
        return ord === undefined ? m0 : `${numberToWords(Number(a))} ${ord}`;
    });

    // 13) SIGNS. `&` → "i" (and). `×`/`x` between digits → "puta"; `+` → "plus". A TRUE minus (`-5`)
    //     reads "minus" (the corpus's `–` en-dashes are punctuation, and the minus rule requires a
    //     hyphen/U+2212 directly before a digit with no en-dash — measured like Serbian). `=` →
    //     "jednako", `<` → "manje od", `>` → "veće od".
    s = s.replace(/(?<!\p{L}\p{M})(\p{Lu})&(\p{Lu})(?![^\p{L}\p{M}])/gu, "$1 i $2");
    s = s.replace(/\s&\s/gu, " i ");
    s = s.replace(/(?<=\d)\s?[x×]\s?(?=\d)/gu, " puta ");
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing. Both halves are lifted from
    //    the plus and minus rules already in this file, so nothing is invented. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv all juxtapose with no conjunction; English is the
    //    outlier that needs "or", and it already has its own rule). Runs BEFORE the + rule: ± is a single
    //    character, so the + rule cannot see it, and putting it first keeps the sign audible either way.
    s = s.replace(/±/gu, " plus minus ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1plus $2");
    s = s.replace(/(?<=[A-Z])\+(\d)/gu, " plus $1");
    s = s.replace(/(?<![\p{L}\p{Nd}])[−-](\d+)(?!\s*[-–—\d])/gu, "minus $1");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 jednako $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 manje od $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 veće od $2");
    // 13b) THE DIVISION SIGN, the one sign this file still dropped — `6 ÷ 3` read as two bare numbers.
    //      ⚠ THE SOURCE READS THE SIGN ITSELF, which is as direct as this issue's tier 4 gets: hr.wikipedia's
    //      Dijeljenje article writes "a podijeljeno s b jednako c: a ÷ b = c" — the ÷ glyph, its reading, and
    //      the very equals word this file already emits, in one sentence. Corroboration in both directions.
    //      FLEURS's parallel aspect-ratio sentence, which performs a division aloud in 57 of its 67 languages,
    //      independently gives the same verb here ("omjer … dijeli se s dvanaest").
    s = s.replace(/(\S)\s*÷\s*(\S)/gu, "$1 podijeljeno s $2");

    return s;
}
