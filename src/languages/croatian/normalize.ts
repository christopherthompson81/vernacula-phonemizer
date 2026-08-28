/**
 * Croatian (hr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Croatian and Serbian are the pluricentric standards of ONE phonological system, so this file shares
 * `serbian/normalize.ts`'s shape — the period-thousands/ordinal disambiguation, the hyphen+case-suffix
 * decades, the three-way count agreement, the dot-clock. ⚠ WHAT DIFFERS IS DATA, NOT STRUCTURE:
 *   · DECIMAL COMMA, not period — Croatian's dot-thousands make the comma the unambiguous decimal.
 *   · the CROATIAN `h` CLOCK SUFFIX — `23:35 h`, `22:00 i 23:00 h` (h = sat).
 *   · the `n. e.` (nove ere) / `p.n.e.` (prije nove ere) era markers.
 *   · the CROATIAN licensors for the `N.` ordinal — month GENITIVES (kolovoza, rujna, listopada, srpnja),
 *     stoljeća, godine.
 *   · prenominal ROMAN ordinals — `I. i II. svjetski rat`, the roman-vs-ordinal seam.
 *
 * ⚠ Every boundary here is an explicit lookaround, never `\b`, which is ASCII-defined and finds none against
 * the Croatian diacritics.
 */
import { NOT_LETTER_AFTER } from "../../core/boundaries.ts";
import { normalizeSerbianInitialisms, readDecimalComma } from "../serbian/normalize.ts";
import { slavicCountForm } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { SYMBOLS } from "./croatian.ts";
import { MANIFEST } from "./manifest.ts";
import { tr } from "../../core/provenance.ts";

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
const MILJA = ["milja", "milje", "milja"] as const;
const STUPANJ = ["stupanj", "stupnja", "stupnjeva"] as const; // 1 stupanj · 2 stupnja · 5 stupnjeva

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
    s = tr(s, /[\u200B\u200C\u200D\uFEFF]/gu, "");

    // 1) DIGIT DE-GROUPING, FIRST — Croatian groups thousands with a PERIOD, and until it is removed the
    //    period is read as clause punctuation. EXACTLY three digits, no space (keeps `802.11` and the
    //    `N.` ordinals out). The comma-decimal and the en-dash range are handled separately.
    for (let i = 0; i < 2; i++) s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))/gu, "");
    // The EN-DASH RANGE between two dotted numbers (`1000. – 1300. n. e.`) must be claimed before the
    //    era-ordinal rule (step 2) consumes the second dotted number.
    s = tr(s, /(\d{1,4})\.\s*[-–—]\s*(\d{1,4})\.(?=\s*(?:n\.\s?e\.|p\.\s?n\.\s?e\.))/gu, "$1 do $2");

    // 2) MULTI-DOT ERA MARKER — `n. e.` (nove ere), `p.n.e.` (prije nove ere), `g. n. e.`, `g. pr. Kr.`
    //    (godine prije Krista), and the `400. g. n. e.` form. BEFORE the dotted-abbreviation and N.
    //    ordinal rules. The leading `N.` of `400. g. n. e.` / `1000. g. pr. Kr.` is an ORDINAL (godine
    //    elided).
    //    The `g.` (godine) is BETWEEN the year-ordinal and the era marker, so the year-ordinal claim
    //    looks past it.
    //    ⚠ LOWERCASE-ONLY (`gu`, not `giu`), AND THIS ARRIVED IN serbian/normalize.ts CITING *THIS*
    //    CORPUS WITHOUT EVER BEING APPLIED HERE. `n.e.` is also two INITIALS with stops, and this block
    //    runs BEFORE the dotted-capital-run rule that would otherwise claim them, so the case-insensitive
    //    version read `N. E. Kovač je došao` as *nove ere Kovač* — a name replaced by a date. All six era
    //    instances in FLEURS hr_hr are lowercase (`n. e.` ×4, `p.n.e.` ×2) and initials are capitals, so
    //    nothing real is lost. `pr. Kr.` keeps its written capital in the pattern itself.
    s = tr(s, /(?<![\d.,])(\d{1,4})\.\s+(?:g\.\s+)?(?=(?:n\.\s?e|p\.\s?n\.\s?e|pr\.\s?Kr\.)(?![\p{L}\p{M}]))/gu,
        (whole, digits: string) => {
            const base = ordinalBase(Number(digits));
            return base === undefined ? whole : `${inflect(base, "f.gen")!} `;
        });
    s = tr(s, /(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(?=[.!?]|$)/gu, "prije nove ere.");
    s = tr(s, /(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(\s)/gu, "prije nove ere$1");
    s = tr(s, /(?<![\p{L}\p{M}])n\.\s?e\.(?=[.!?]|$)/gu, "nove ere.");
    s = tr(s, /(?<![\p{L}\p{M}])n\.\s?e\.(\s)/gu, "nove ere$1");
    s = tr(s, /(?<![\p{L}\p{M}])pr\.\s?Kr\.(?=[.!?]|$)/gu, "prije Krista.");
    s = tr(s, /(?<![\p{L}\p{M}])pr\.\s?Kr\.(\s)/gu, "prije Krista$1");
    // The `g.` in `400. g. n. e.` / `1000. g. pr. Kr.` is "godine" (elided); drop it after the claim.
    s = tr(s, /(?<=\d)\s+g\.\s+(?=(?:n\.\s?e\.|pr\.\s?Kr\.))/gu, " ");

    // 3) DOTTED ABBREVIATIONS. `itd.` → "i tako dalje". The dot is consumed before a following word.
    s = tr(s, /(?<![\p{L}\p{M}])itd\.(\s+)(?=[\p{L}\d(])/giu, "i tako dalje$1");
    s = tr(s, /(?<![\p{L}\p{M}])itd\.(?=\s*[,;:])/giu, "i tako dalje");
    s = tr(s, /(?<![\p{L}\p{M}])itd\.(?=\s*(?:[.!?”"»)\]])|$)/giu, "i tako dalje.");

    // 4) DOTTED CAPITAL RUNS — `George W. Bush`. The W. suffix dot is a break. The single-initial form
    //    (W. Bush) needs the lone-initial rule too.
    s = tr(s, /(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));  // space, NBSP
    s = tr(s, /(?<=\p{Lu}\p{L}*\s)(\p{Lu})\.(?=\s+\p{Lu}\p{Ll})/gu, "$1");
    // `Dr.` → "doktor"; `SAD` (USA) → the expansion.
    s = tr(s, /(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])/giu, "Doktor$1");
    s = tr(s, /(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))/giu, "Doktor.");
    s = tr(s, /(?<![-\p{L}\p{M}])SAD(?=-)/gu, "Sjedinjene Američke Države");

    // 4b) PRENOMINAL ROMAN ORDINALS — `I. svjetskog rata`, `II. svjetskom ratu`, `I. i II. reda`
    //     (World War I/II, first/second order). The shared roman pass skips single-letter I (below its
    //     two-character minimum), and Croatian writes these as a numeral + the ordinal period before a
    //     lowercase noun. The registry's roman→digit conversion also cannot see the dotted form here,
    //     so the ordinal is claimed directly, inflected for the slot the following word governs.
    const ROMAN_ORD: Readonly<Record<string, string>> = { I: "prvi", II: "drugi", III: "treći", IV: "četvrti", V: "peti" };
    s = tr(s, /(?<![\p{L}\p{M}])([IVXL]+)\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
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
    s = tr(s, /(\d+)\s?°\s?([CFcf])(?![\p{L}\p{M}])/gui, (_m, n: string, u: string) =>
        `${n} ${/[Ff]/u.test(u) ? "stupnjeva Farenhajta" : "stupnjeva Celzija"}`);
    // ⚠ ATTACHMENT IS REQUIRED OF LOWERCASE ⟨s⟩ AND ONLY OF IT. `S` is *južno* and `s` is the preposition "with",
    //   so spaced off the degree the bearing arm was deleting a common word and inventing a bearing:
    //   `35° s padavinama` read as *trideset pet stupnjeva JUŽNO padavinama`. N, E and W are letters no
    //   Croatian sentence uses alone, so `35° w` — the form this corpus actually writes — still reads.
    //   ⚠ AND THE GUARD IS CASE-SENSITIVE: only the LOWERCASE letter is the word. A spaced uppercase `35° S`
    //   is an ordinary way to write a latitude and must keep reading as *južno*.
    s = tr(s, /(\d+)\s?°(?:\s?([NEWSnew])|([s]))(?![\p{L}\p{M}])/gu, (_m, n: string, spaced: string | undefined, tight: string | undefined) =>
        `${n} stupnjeva ${({ N: "sjeverno", S: "južno", E: "istočno", W: "zapadno" } as Record<string, string>)[(spaced ?? tight)!.toUpperCase()]!}`);

    // 5b) THE BARE DEGREE. ⚠ ADDED BECAUSE THE ARM ABOVE STOPPED CLAIMING EVERYTHING. While the compass
    //     arm swallowed a spaced ⟨s⟩ there was no such thing as an unclaimed bare degree in this corpus, so
    //     none was needed; requiring attachment for ⟨s⟩ creates one — `35° s padavinama` now reaches here,
    //     and without this arm the degree noun disappears entirely. It also consumes ⟨q x y⟩, which Gaj's
    //     Latin has no bearing word for and which `foreignLetters` would otherwise make audible.
    //     ⚠ COUNT AGREEMENT, like every other counted noun in this file — `1 stupanj`, `2 stupnja`,
    //     `5 stupnjeva`. The genitive plural is only right from five up.
    //     ⚠ AND A TRAILING SPACE, which is what stops the next character gluing onto the noun. Any letter
    //     this arm does not consume — `300°K` — would otherwise land inside the word, and the stress
    //     lookup then runs on `stupnjevak`, misses the dictionary and loses the pitch accent. Consuming a
    //     letter class cannot cover this: the class is finite and the alphabet is not.
    s = tr(s, /(\d+)\s?°(?:\s?[QXYqxy](?![\p{L}\p{M}]))?/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), STUPANJ)} `);

    // 6) NUMERAL + HYPHEN + CASE SUFFIX (`1970-ih`, `15-og`). The suffix is the LAST LETTERS of the
    //    inflected ordinal. Runs before the range rule.
    //    ⚠ THE TRAILING GUARD WAS `(?![^\p{L}\p{M}]|.)`, WHICH IS "END OF INPUT", NOT "END OF WORD". The
    //    `|.` arm rejects EVERY following character, so the whole rule only ever fired on an input that was
    //    nothing but the numeral — the unit tests, in other words. In running text it never fired: the 50
    //    corpus lines of this shape (`1480-ih, kada`, `tijekom 1990-ih bilo je`) read the CARDINAL plus a
    //    stray *ih*, the accusative clitic "them". Serbian and Bosnian write the same rule with the shared
    //    NOT_LETTER_AFTER and are unaffected; Croatian is the copy that lost it.
    s = tr(s, new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{Ll}{1,2})${NOT_LETTER_AFTER}`, "gu"),
        (whole, digits: string, rawSuffix: string) =>
            ordinalForms(Number(digits)).find((f) => f.endsWith(rawSuffix.toLowerCase())) ?? whole);

    // 7) THE `N.` ORDINAL — claimed when a licensing word from the closed list follows, LOWERCASE.
    s = tr(s, /(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
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
    s = tr(s, /(?<![\d.,\-])(1\d{3}|20\d{2}|2100)\.(?!\d)/gu, (whole, digits: string, at: number, all: string) => {
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
    s = tr(s, /(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*h)?/giu,
        (_m, h: string, min: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return _m;
            const head = `${numberToWords(hv)} ${counted(hv, SAT)}`;
            return mv === 0 ? head : `${head} i ${numberToWords(mv)} ${counted(mv, MINUT)}`;
        });

    // 9) NUMERIC RANGES — `10 – 60`, `2-3`, `120-160`. Croatian "do" (to).
    s = tr(s, /(\d)\s?[-–—]\s?(?=\d)/gu, "$1 do ");

    // 9b) MILJA RATE — the corpus writes "milja/h" and "milja/sat" (miles per hour). "milja" is already
    //     the Croatian word; only the /sat or /h denominator needs reading. The tier's `mi` key does not
    //     match the spelled "milja", so the rate is composed here.
    s = tr(s, /(\d+(?:,\d+)?)\s?milja\s*\/\s*(?:sat|h)(?![\p{L}\p{M}])/giu,
        (_m, n: string) => `${n} ${counted(intOf(n), MILJA)} na sat`);

    // 10) THE SHARED SYMBOL TIER — %, units, rates. The number must be ADJACENT to its unit and still
    //     carry its decimal comma (`2,4 Ghz`), so it runs before step 11 folds the comma into a word.
    s = SYMBOLS(s);

    // 11) DECIMAL COMMA → the word, from the SHARED core. Croatian reads it as "zarez", identically to sr
    //     and bs — and the line used to be copied here, which is how `0,001 grama` read *nula zarez jedan*
    //     (a 100× error: `Number("001")` is 1) in all three at once. See `readDecimalComma`.
    s = readDecimalComma(s);

    // 12) FRACTIONS. `29¾ sa 24½ inča`, `1/5 inča`. The vulgar fractions read "i tri četvrtine"/"i pola";
    //     the ratio reads "jedan peti" (one fifth).
    s = tr(s, /(\d+)¾/gu, "$1 i tri četvrtine");
    s = tr(s, /(\d+)½/gu, "$1 i pol");
    s = tr(s, /(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const ord = ordinalBase(Number(b));
        return ord === undefined ? m0 : `${numberToWords(Number(a))} ${ord}`;
    });

    // 13) SIGNS. `&` → "i" (and). `×`/`x` between digits → "puta"; `+` → "plus". A TRUE minus (`-5`)
    //     reads "minus" (the corpus's `–` en-dashes are punctuation, and the minus rule requires a
    //     hyphen/U+2212 directly before a digit with no en-dash — measured like Serbian). `=` →
    //     "jednako", `<` → "manje od", `>` → "veće od".
    s = tr(s, /(?<!\p{L}\p{M})(\p{Lu})&(\p{Lu})(?![^\p{L}\p{M}])/gu, "$1 i $2");
    s = tr(s, /\s&\s/gu, " i ");
    s = tr(s, /(?<=\d)\s?[x×]\s?(?=\d)/gu, " puta ");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = tr(s, /±/gu, " plus minus ");
    s = tr(s, /(^|[\s(])\+\s?(\d)/gu, "$1plus $2");
    s = tr(s, /(?<=[A-Z])\+(\d)/gu, " plus $1");
    s = tr(s, /(?<![\p{L}\p{Nd}])[−-](\d+)(?!\s*[-–—\d])/gu, "minus $1");
    s = tr(s, /(\S)\s*=\s*(\S)/gu, "$1 jednako $2");
    s = tr(s, /(\d)\s*<\s*(\d)/gu, "$1 manje od $2");
    s = tr(s, /(\d)\s*>\s*(\d)/gu, "$1 veće od $2");
    // 13b) THE DIVISION SIGN, the one sign this file still dropped — `6 ÷ 3` read as two bare numbers.
    //      ⚠ THE SOURCE READS THE SIGN ITSELF, which is as direct as this issue's tier 4 gets: hr.wikipedia's
    //      Dijeljenje article writes "a podijeljeno s b jednako c: a ÷ b = c" — the ÷ glyph, its reading, and
    //      the very equals word this file already emits, in one sentence. Corroboration in both directions.
    //      FLEURS's parallel aspect-ratio sentence, which performs a division aloud in 57 of its 67 languages,
    //      independently gives the same verb here ("omjer … dijeli se s dvanaest").
    s = tr(s, /(\S)\s*÷\s*(\S)/gu, "$1 podijeljeno s $2");

    // ⚠ INITIALISMS, LAST, AND SHARED WITH SERBIAN. hr/bs run serbian.ts's g2p, so they must run its
    //   letter-name table too or the same `DVD` → *dʋd* cluster survives here — which it did: the pass was
    //   added to serbian/normalize.ts and `hr` was unaffected until this line, because each variety has its
    //   own normalizer. One table, three engines; see the attestation in serbian/normalize.ts's header.
    return normalizeSerbianInitialisms(s);
}
