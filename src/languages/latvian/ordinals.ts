/**
 * Latvian (lv) ORDINAL compositor — the piece the dotted-number rule in `normalize.ts` needs.
 *
 * ⚠ WHY THIS IS A SEPARATE PROBLEM FROM `numbers.ts`. Latvian writes its ordinal as a PERIOD after the
 * figure — `1885. gada`, `22. jūnijā`, `5. gadsimtā` — and the ordinal is a DEFINITE ADJECTIVE, so it
 * agrees in case with the noun it modifies. A cardinal has one form per number; an ordinal has ten.
 *
 * ⚠ THE CASE IS NOT GUESSED. It is read off the FOLLOWING NOUN, which the writer has already inflected:
 * `gada` is genitive, `gadā` locative, `gadam` dative. That is the whole reason this rule is safe to write
 * at all — the Basque lesson (the writer already chose the ending) arriving on the other word. Where the
 * follower is NOT one of the nouns whose paradigm is tabulated below, `normalize.ts` does not compose an
 * ordinal at all; see its dotted-number step for what it does instead.
 *
 * ⚠ EVERY HEAD NOUN HERE IS MASCULINE, and that is a scope decision rather than an accident. The definite
 * adjective's NOMINATIVE and GENITIVE differ by gender (masc *otrais/otrā* vs fem *otrā/otrās*) while the
 * dative/locative do not, so admitting a feminine head noun would need a gender column this table does not
 * have. `gads`, `gadsimts` and all twelve months are masculine, which is what makes the closed set closed.
 */
import { numberToWords } from "./numbers.ts";

/** The grammatical slots the definite adjective distinguishes, as far as this table needs them. */
type Case = "nomSg" | "genSg" | "datSg" | "accSg" | "locSg" | "nomPl" | "datPl" | "accPl" | "locPl";

/**
 * The masculine DEFINITE adjective endings. Sourced as a paradigm, and spot-attested on lv.wikipedia:
 * `piektais` 3 tok / 2 arts, `piektā` 3/2, `piektajā` 2/1, `astotais` 2/2, `astotā` 4/2, `astotajā` 1/1,
 * `septītais` 3/2, `otrajā` 2/1, `ceturtais` 2/2 — the three cases the corpus actually needs (nom/gen/loc)
 * are each attested on more than one stem, so this is not one word generalised into a paradigm.
 *
 * ⚠ GENITIVE PLURAL AND ACCUSATIVE SINGULAR SHARE `-o`, which is why `gadu` — ambiguous between the two —
 * needs no disambiguation below. It is a real syncretism, not a shortcut.
 */
const ENDING: Record<Case, string> = {
    nomSg: "ais",
    genSg: "ā",
    datSg: "ajam",
    accSg: "o",
    locSg: "ajā",
    nomPl: "ie",
    datPl: "ajiem",
    accPl: "os",
    locPl: "ajos",
};

/**
 * The ordinal STEMS for 1–9. Irregular against the cardinals (*trīs* → *treš-*, *septiņi* → *septīt-*,
 * *astoņi* → *astot-*, *deviņi* → *devīt-*), so they are listed rather than derived from `numbers.ts`.
 * Index 0 is unused — there is no zeroth.
 */
const STEM = ["", "pirm", "otr", "treš", "ceturt", "piekt", "sest", "septīt", "astot", "devīt"];

/** 10–19 and the round tens take the CARDINAL as their stem: desmit→desmitais, divdesmit→divdesmitajos. */
const TEEN = [
    "desmit",
    "vienpadsmit",
    "divpadsmit",
    "trīspadsmit",
    "četrpadsmit",
    "piecpadsmit",
    "sešpadsmit",
    "septiņpadsmit",
    "astoņpadsmit",
    "deviņpadsmit",
];
const TEN = ["", "", "divdesmit", "trīsdesmit", "četrdesmit", "piecdesmit", "sešdesmit", "septiņdesmit", "astoņdesmit", "deviņdesmit"];

/**
 * The noun forms whose case this rule can read, and the case each one names. Generated from a stem plus its
 * declension so the twelve months cost one line each rather than five.
 *
 * ⚠ THE TWO DECLENSIONS ARE NOT INTERCHANGEABLE. First-declension `-s` nouns (marts, maijs, jūnijs, jūlijs,
 * augusts, gads, gadsimts) take dat `-am` / acc `-u` / loc `-ā`; second-declension `-is` nouns (janvāris,
 * februāris, aprīlis, septembris, oktobris, novembris, decembris) take `-im` / `-i` / `-ī`. Collapsing them
 * would accept `*janvāram` and miss the `janvārī` that the corpus actually writes.
 */
function decline(stem: string, second: boolean, genitive = `${stem}a`): Record<string, Case> {
    const forms: Record<string, Case> = {
        [second ? `${stem}is` : `${stem}s`]: "nomSg",
        [genitive]: "genSg",
        [second ? `${stem}im` : `${stem}am`]: "datSg",
        [second ? `${stem}i` : `${stem}u`]: "accSg",
        [second ? `${stem}ī` : `${stem}ā`]: "locSg",
    };
    return forms;
}

/** `gads` and `gadsimts` also occur in the PLURAL after an ordinal — *20. gados*, *5. gadsimtos*. */
function declineWithPlural(stem: string): Record<string, Case> {
    return {
        ...decline(stem, false),
        [`${stem}i`]: "nomPl",
        [`${stem}iem`]: "datPl",
        [`${stem}us`]: "accPl",
        [`${stem}os`]: "locPl",
    };
}

/**
 * ⚠ `aprīlis` PALATALISES IN THE GENITIVE — *aprīļa*, not *aprīla* — so its genitive is passed explicitly.
 * The corpus has it 11 times in one article; the regular form is not Latvian.
 */
export const HEAD_NOUN: Readonly<Record<string, Case>> = {
    ...declineWithPlural("gad"),
    ...declineWithPlural("gadsimt"),
    ...decline("janvār", true),
    ...decline("februār", true),
    ...decline("mart", false),
    ...decline("aprīl", true, "aprīļa"),
    ...decline("maij", false),
    ...decline("jūnij", false),
    ...decline("jūlij", false),
    ...decline("august", false),
    ...decline("septembr", true),
    ...decline("oktobr", true),
    ...decline("novembr", true),
    ...decline("decembr", true),
};

/**
 * The number as a Latvian ORDINAL in the given case, or `undefined` when the composition is not one this
 * file is willing to claim.
 *
 * ⚠ ROUND HUNDREDS AND THOUSANDS ARE REFUSED, and refusing is the point. `200.` is *divsimtais* and `2000.`
 * *divtūkstošais* — fused forms, not the space-separated *divi simti* the cardinal compositor emits — and
 * `attest.ts` found `divsimtais`, `tūkstošais` and `divtūkstošais` at ZERO tokens each. Composing them would
 * be inventing a word to fill a slot; they are 8 of 262 dotted sites in the corpus, so the cost of declining
 * is measured and small. `numbers.ts` keeps its own counsel about cardinals; this refuses only the ordinal.
 */
export function ordinalWords(n: number, c: Case): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 9999) return undefined;
    const end = ENDING[c];

    // Which trailing piece carries the ordinal ending. Only the LAST element of a Latvian compound numeral is
    // ordinal — *tūkstoš astoņi simti astoņdesmit PIEKTAIS* — so the head is read as an ordinary cardinal.
    const within100 = n % 100;
    let atom: string;
    let head: number;
    if (within100 >= 11 && within100 <= 19) {
        atom = TEEN[within100 - 10]!;
        head = n - within100;
    } else if (n % 10 !== 0) {
        atom = STEM[n % 10]!;
        head = n - (n % 10);
    } else if (within100 !== 0) {
        atom = TEN[within100 / 10]!;
        head = n - within100;
    } else {
        return undefined; // round hundred or thousand — see the note above
    }

    if (head === 0) return atom + end;
    /**
     * ⚠ THE YEAR'S THOUSAND IS `tūkstoš`, NOT `tūkstotis`. `numbers.ts` emits the noun *tūkstotis* because a
     * counted thousand IS a noun; in a year the same digit is the indeclinable numeral prefix — *tūkstoš
     * deviņi simti*, never *tūkstotis deviņi simti*. `tūkstoš` is attested 16 tok / 2 arts. Only the
     * one-thousand case differs: `2024` is *divi tūkstoši divdesmit ceturtajā*, which the compositor already
     * writes correctly.
     */
    const headWords = numberToWords(head).replace(/^tūkstotis\b/u, "tūkstoš");
    return `${headWords} ${atom}${end}`;
}
