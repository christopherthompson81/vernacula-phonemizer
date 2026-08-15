/**
 * Italian (it) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Structurally a close relative of `es` and `pt` — same ordinal indicators, same dot-thousands /
 * comma-decimal conventions, same era markers — but ⚠ TWO RULES COME OUT DIFFERENT and must not be ported:
 *   · Italian writes its masculine ordinal with the DEGREE SIGN (`1° gennaio`, `60° gol`), which es and pt
 *     explicitly exclude as a temperature.
 *   · `ha` is NOT admissible as the hectare abbreviation, because after a number it is the verb *avere*
 *     (`Chandrayaan-1 ha sganciato`).
 *
 * ⚠ `º`/`ª` (U+00BA/U+00AA) LEAK RAW into the phoneme string if unclaimed, because they are Script=Latin and
 * so reach core/clauses.ts's foreign fallback verbatim — `11º` comes out [undˈit͡ʃi º].
 *
 * NOT DONE, deliberately: numeric RANGES (`1894-1895`) keep the bare juxtaposition the tokenizer already
 * produces — the hyphen is silent either way and both numbers are audible; and space-grouped thousands are
 * not an Italian convention, so no rule exists for a form the language does not write.
 *
 * ORDERING — the two couplings that bite:
 *   · digit de-grouping runs FIRST, or the grouping period is read as clause punctuation.
 *   · ⚠ the decimal comma is rewritten LAST, AFTER the shared unit/percent tier — see
 *     `normalizeItalianDecimals`, which italian.ts calls after SYMBOLS for exactly that reason.
 * Roman numerals need no ordering care: `it` is not in the registry's ROMAN_NATIVE set, so the shared
 * core/roman.ts pass (with this language's ordinal policy, romanOrdinals.ts) has already turned `XIX secolo`
 * into digits before text() runs.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { romanToInt } from "../../core/roman.ts";
import { ROMAN_POLICY } from "./romanOrdinals.ts";

/** Word boundaries as explicit lookarounds. `\b` is ASCII-defined and matches INSIDE `città`/`perché` at
 *  the accent, which is precisely how the French rule came to fire in the middle of `siècle`. */
const L = "(?<![\\p{L}\\p{M}])";
const R = "(?![\\p{L}\\p{M}])";

/**
 * Dotted abbreviations → the spoken words, restricted to what the corpus attests plus the standard
 * courtesy titles. Every candidate was counted WITH a boundary before being admitted: a naive
 * `grep -o '(ca|n|on|es)\.'` reports `ca.` ×47, `n.` ×26 and `on.` ×9, and all but two of those are the
 * last letters of an ordinary word before a sentence period (`storica.`, `non.`, `regione.`). With the
 * boundary the real counts are `ecc.` ×4, `n.` ×2, `es.` ×2, `dott.` ×1 — so `ca.` is absent from this
 * table, and `n.` is handled separately below because it only means *numero* before a digit.
 */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    sig: "signor", sigg: "signori", sigra: "signora", signa: "signorina",
    dott: "dottor", dr: "dottor", prof: "professor", ing: "ingegner", avv: "avvocato",
    on: "onorevole", ecc: "eccetera", es: "esempio",
    pag: "pagina", pagg: "pagine", art: "articolo", artt: "articoli",
    cap: "capitolo", vol: "volume", fig: "figura", tel: "telefono",
};
/** Longest key first, so `pagg` is not matched as `pag` plus a stray g. */
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/**
 * Italian letter names, each verified through this engine's own g2p:
 * a=[ˈa], bi=[bˈi], ci=[t͡ʃˈi], di=[dˈi], effe=[ˈeffe], gi=[d͡ʒˈi], acca=[ˈakka], cappa=[kˈappa],
 * elle=[ˈelle], emme=[ˈemme], enne=[ˈenne], cu=[kˈu], erre=[ˈerre], esse=[ˈesse], vu=[vˈu],
 * ics=[ˈiks], ipsilon=[ipsˈilon], zeta=[t͡sˈeta]. The five letters outside the native 21 take their
 * conventional Italian names (Treccani, *alfabeto*): j *i lunga*, k *cappa*, w *doppia vu*, x *ics*,
 * y *ipsilon*.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "bi", c: "ci", d: "di", e: "e", f: "effe", g: "gi", h: "acca", i: "i",
    j: "i lunga", k: "cappa", l: "elle", m: "emme", n: "enne", o: "o", p: "pi", q: "cu",
    r: "erre", s: "esse", t: "ti", u: "u", v: "vu", w: "doppia vu", x: "ics", y: "ipsilon", z: "zeta",
};

/**
 * Italian phonotactics, for the OOV rule in core/initialisms.ts. Italian syllable structure is strict and
 * native words end in a vowel, so a two-consonant tail is the strongest single signal that a letter run
 * cannot be read as a word — it is what correctly separates `USB` (→ *u esse bi*) from `ISIS`, `OPEC`,
 * `COVID` and `NASA`, all of which end in a vowel or a vowel+consonant and are read as words in Italian.
 * The codas listed are the ones Italian tolerates in the established loanwords it actually pronounces as
 * words (film, sport, test, record, trend, camp, rock), so those are not spelled out.
 */
export const isUnreadableItalian = makeUnreadableTest({
    vowels: /[aeiouàèéìíîòóùú]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr",
        "ch", "gh", "gn", "qu", "ps", "pn", "sc", "sp", "st", "sf", "sb", "sd", "sg",
        "sl", "sm", "sn", "sq", "sv", "sr", "sk", "tl",
    ]),
    legalCodas: new Set([
        "lm", "rt", "rd", "rn", "rm", "rs", "rk", "st", "nt", "nd", "nk", "ng", "mp",
        "ck", "sh", "ss", "ll", "tt", "nn", "rc", "lt",
    ]),
});

/**
 * A canonical Roman numeral must never be letter-spelled. The registry's shared pass converts the ones it
 * can identify BEFORE text() runs, but it deliberately leaves its collision list alone (`XI`, `VI`, `CD`,
 * `MM`, `XL` …), and `XI` occurs twice in this corpus as a century. Routed through `isRecorded` — the
 * "some other layer owns this token" hook — so such a leftover keeps the cardinal-ish reading it has today
 * instead of becoming *ics i*.
 */
const isRomanNumeral = (lower: string): boolean => lower.length >= 2 && romanToInt(lower) !== null;

/**
 * LEXICAL: readable letter runs that Italian nevertheless spells out. Kept deliberately short — the OOV
 * rule above already catches every unpronounceable run, and a wrong entry here is a confidently wrong
 * reading. `ia` (intelligenza artificiale, ×3 in this corpus), `ip` and `hiv` are the three where Italian
 * usage is not in doubt; `USA`, `NASA`, `PIL`, `REM`, `COVID` are deliberately absent because Italian reads
 * them as words and the g2p already does.
 */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(["ia", "ip", "hiv"]);

/** Italian has no pronunciation dictionary — the g2p is fully rule-based — so nothing is "recorded" in the
 *  sense core/initialisms.ts means except the Roman-numeral guard above. */
export function normalizeItalianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: isRomanNumeral,
        isUnreadable: isUnreadableItalian,
    })(text);
}

/** Masculine ordinal for n, from the language's own Roman-numeral policy (cardinal − final vowel + -esimo,
 *  with the 1–10 irregulars), so the ordinal data is authored once. */
const ordinal = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

/** Feminine ordinal: the final -o becomes -a (decimo → decima). */
const feminine = (masc: string): string => masc.replace(/o$/u, "a");

/** Fraction denominators with a suppletive name; the rest take the ordinal (1/5 = un quinto). Plural is the
 *  regular masculine -o → -i (tre quarti). */
const DENOMINATOR: Readonly<Record<number, string>> = { 2: "mezzo" };

function fractionWords(num: number, den: number): string | undefined {
    if (den < 2 || num < 1) return undefined;
    const base = DENOMINATOR[den] ?? ordinal(den);
    if (base === undefined) return undefined;
    // The numerator apocopates before the fraction noun: "un quinto", not "uno quinto".
    return `${num === 1 ? "un" : String(num)} ${num > 1 ? base.replace(/o$/u, "i") : base}`;
}

/** The currency noun already spelled out right after the amount — see step 10. */
const CURRENCY_WORD = /^\s*(?:di\s+)?(?:dollar|euro|sterlin|yen|franch)/iu;

/** Compass letters after a degree sign — a geographic coordinate, not a temperature and not an ordinal. */
const COMPASS: Readonly<Record<string, string>> = { n: "nord", s: "sud", e: "est", w: "ovest" };

/**
 * Normalize one Italian input string. Pure text→text. Runs BEFORE the shared symbol tier; the decimal comma
 * is deliberately NOT handled here (see `normalizeItalianDecimals`).
 */
export function normalizeItalian(input: string): string {
    let s = input;

    // 1) DIGIT DE-GROUPING — FIRST, and it is the largest single defect in the language (×52). Italian
    //    groups thousands with a period, and `.` is clause punctuation, so `19.500 km²` read as
    //    "diciannove [PAUSE] cinquecento". Applied twice so a two-separator number (5.000.000) collapses
    //    fully; the `(?!\d)` tail keeps it to real 3-digit blocks. Every later step then sees one unbroken
    //    digit run — the clock, the ordinal and the unit tier all depend on that.
    s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");
    s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");

    // 2) ERA MARKERS, before the generic dotted-abbreviation rule (multi-dot before single-dot: otherwise
    //    the interior dot of `a.C.` survives as a phrase break). Both spacings occur in the wild; the
    //    corpus writes them closed (a.C. ×7, d.C. ×3).
    s = s.replace(new RegExp(`${L}a\\.\\s?C\\.`, "gu"), "avanti Cristo");
    s = s.replace(new RegExp(`${L}d\\.\\s?C\\.`, "gu"), "dopo Cristo");

    // 3) NUMERO — only before a digit. Both corpus occurrences are `n. 1` / `n. 11`; a bare `n.` at the end
    //    of a sentence is an ordinary word's last letter far more often than it is an abbreviation.
    s = s.replace(new RegExp(`${L}(?:n\\.º|n\\.|nr\\.|nº)\\s?(?=\\d)`, "giu"), "numero ");

    // 4) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues, so it cannot become a
    //    phrase break; at a phrase end it is kept, because there it really is the sentence end. What
    //    follows may be a DIGIT as well as a letter — `art. 5` and `pag. 12` are the normal shapes for
    //    half this table, and a letter-only lookahead left both unexpanded with the dot still a pause.
    s = s.replace(new RegExp(`${L}(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\p{N}])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`${L}(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)\\]]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) DEGREE SIGN, in three senses, and they must be separated in this order because the ordinal rule
    //    below claims every remaining `\d°`. Temperature (`30°C`, `90 °F`) and coordinate (`35°W`) are
    //    identified by the LETTER glued to the sign; the ordinal never has one (`1° gennaio` has a space).
    //    This also has to run before the shared unit tier, which would otherwise leave the bare sign behind.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 gradi Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gu, "$1 gradi Fahrenheit");
    s = s.replace(/(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])/gu,
        (_m, d: string, dir: string) => `${d} gradi ${COMPASS[dir.toLowerCase()]!}`);

    // 6) ORDINAL INDICATORS. Three characters, all attested. `º`/`ª` (U+00BA/U+00AA) were reaching the
    //    phoneme string RAW — they are Script=Latin, so core/clauses.ts hands them to the foreign fallback
    //    and `dell'11º` came out as [dˈell undˈit͡ʃi º]. `°` is the ordinary Italian masculine ordinal
    //    (`il 1° gennaio`, `il suo 60° gol`, ×8) — this is where Italian parts company with es/pt, which
    //    exclude `°` because in those corpora it is only ever a temperature. The temperature and
    //    coordinate senses were already consumed in step 5, so what reaches here is the ordinal.
    s = s.replace(/(\d+)\.?(?:º|ª|°)/gu, (whole, digits: string) => {
        const masc = ordinal(Number(digits));
        if (masc === undefined) return whole;
        return /ª/u.test(whole) ? feminine(masc) : masc;
    });

    // 7) CLOCK, before the unit tier so nothing claims the hour, and after de-grouping so the hour is a
    //    clean digit run. The colon is clause punctuation in this engine, so `alle 11:20` read as
    //    "undici [PAUSE] venti" and `alle 11:00` added a spurious "zero". Emitted as DIGITS joined by *e*
    //    so the existing cardinal compositor still does the pronouncing. Minutes must be two digits, which
    //    is what keeps the grade `2:2` ("classe di voto 2:2", the one non-clock colon-digit in the corpus)
    //    out of this rule.
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} e ${min}`));
    //    Italian also writes the clock with a PERIOD (`alle 12.00 GMT`, ×1 here). Unlike the colon, a period
    //    between two short digit runs is NOT self-identifying — `802.11a` in this same corpus offers
    //    `02.11`, and an English-style decimal would offer `6.34` — so this form is claimed only after an
    //    explicit hour preposition. That cue is what carries the rule, not the digit shape.
    s = s.replace(/((?:all[e'’]|alle ore|ore|dalle|verso le|le)\s?)([01]?\d|2[0-3])\.([0-5]\d)(?![\d.])/giu,
        (_m, cue: string, h: string, min: string) => `${cue}${Number(min) === 0 ? h : `${h} e ${min}`}`);

    // 8) SIGNS. `+` occurs once (`UTC+1`); `-` does not occur in this corpus, but a dropped minus is silent
    //    content loss that inverts a temperature, and the guards keep it off the ranges that DO occur —
    //    `1894-1895` has a digit before the hyphen, and the football score `26 - 00` has a space after it.
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    immediately below.
    s = s.replace(/±/gu, " più meno ");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 più $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1più $2");
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1meno $2");

    // 8b) RELATIONAL AND DIVISION SIGNS. ⚠ TIER 2 LOOKED SUFFICIENT AND WAS THE WRONG SENSE TWICE —
    //     this language is the clearest case in the issue for why the examples get read rather than the counts.
    //     Both comparatives are attested in it_it as phrases, and neither hit is a comparison:
    //
    //       `minore di`   ×2 phrase — "l'italia era essenzialmente la sorella minore di germania e giappone"
    //                                 (the YOUNGER SISTER of; `minore` as an age adjective)
    //       `maggiore di`  ×4 phrase — "hanno il numero maggiore di basi" (the GREATEST number OF bases;
    //                                 a superlative followed by a partitive, not a comparison at all)
    //       `uguale`       ×0 token / ×0 substring — absent entirely
    //       `diviso`       ×0 token / ×1 substring — inside `condiviso` (shared)
    //
    //     A count-only reading of that table would have shipped two attested phrases whose corpus evidence
    //     argues for a different construction than the one the sign needs.
    //
    //     The register tier settles all four (`attest.ts --context "matematica aritmetica divisione"`), on
    //     numeric operands, in the arithmetic sense:
    //
    //       "ogni numero dispari maggiore di 5 è somma di tre primi"     "39 non può essere diviso per 15"
    //       "tre volte un quarto è uguale a un quarto di tre"            "ogni a minore di zero (negativo)"
    //
    //     ⚠ THE COPULA IS KEPT, as for `fr` and for the same reason: `sette uguale a tre` is not a construction
    //     Italian admits — the adjective needs its verb — so the bare form de/es/en use has nothing to drop to
    //     here. `diviso per` is a participle and stands without one. `lb` (`ass gläich`) and `nb` (`er lik`)
    //     already ship the copular shape, so both are in the fleet.
    s = s.replace(/\s?=\s?/gu, " è uguale a ");
    s = s.replace(/\s?<\s?/gu, " è minore di ");
    s = s.replace(/\s?>\s?/gu, " è maggiore di ");
    s = s.replace(/\s?÷\s?/gu, " diviso per ");

    // 9) FRACTIONS, guarded against a date and a unit ratio by requiring digits on both sides and nothing
    //    numeric after.
    s = s.replace(/(?<!\d)(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 9b) THE PLUS AS A WORD-JOINER — a shape the whole signed-number sweep never met. Every other `+` resolved
    //     sat against a DIGIT (a UTC offset, a temperature, an arithmetic operand), and the guards were
    //     written accordingly. Italian's only `+` joins two NOUNS: `pacchetti combinati volo+hotel`, a package
    //     deal. Nothing numeric anywhere near it, so a digit-keyed rule could never have found it, and the sign
    //     was DROPPED — `volo hotel`, two nouns collided into an asyndeton.
    //
    //     ATTESTED, and directly rather than by inference. MMS-1b-all (`ita`) on the it_it speaker of this
    //     sentence: `… pacchetti combinati vol o più hotel`. The reader says *più*, the ordinary arithmetic
    //     word, for a `+` that is not arithmetic at all — so Italian treats the glyph as a word here and does
    //     not silently coordinate the nouns.
    //
    //     LETTER-KEYED ON BOTH SIDES, which is what keeps it away from every numeric plus: a signed number or a
    //     UTC offset has a digit on at least one side and is left for a later rule to claim. Spaced on output
    //     because the inputs are closed up (`volo+hotel` is one token to the tokenizer, and *volopiùhotel* is
    //     not a word).
    s = s.replace(/(?<=[\p{L}\p{M}])\+(?=[\p{L}\p{M}])/gu, " più ");

    // 10) CURRENCY WRITTEN BEFORE THE AMOUNT. The corpus only ever postposes the sign ("banconote da 5 $",
    //     "2.500 ¥"), which the shared symbol tier handles correctly, so this rule exists for the preposed
    //     form the tier gets subtly wrong in Italian: its magnitude hop emits `5 milioni dollari`, and
    //     Italian needs the partitive *di* between a magnitude and the currency noun ("5 milioni DI
    //     dollari"). Claiming the sign here leaves the tier nothing to do. Only ordering requirement: after
    //     the de-grouping in step 1, so the amount is one digit run.
    s = s.replace(
        /([€$£¥])\s?(\d[\d.,]*)(\s+(?:miliardi|miliardo|milioni|milione|mila))?/gu,
        (m0, sign: string, num: string, mag: string | undefined, offset: number, whole: string) => {
            // The currency NOUN may already be written out beside the sign ("$5 milioni di dollari" is a
            // real, if redundant, shape). Checked on the remaining text rather than as a lookahead in the
            // pattern, because a lookahead after an OPTIONAL group is defeated by backtracking: the engine
            // simply drops the magnitude and matches anyway, which is worse than either outcome.
            if (CURRENCY_WORD.test(whole.slice(offset + m0.length))) return `${num}${mag ?? ""}`;
            const forms = CURRENCY[sign]!;
            const word = mag !== undefined || Number(num.replace(/[.,]/gu, "")) !== 1 ? forms[1]! : forms[0]!;
            // ⚠ THE NOUN MUST NOT FUSE WITH WHAT FOLLOWS, the same repair `core/normalizeSymbols.ts` carries
            // for the shared arm. The match ends at the digits (or the magnitude), so an ABBREVIATED
            // magnitude glued to the number left the noun abutting it and the tokenizer read one word:
            // `$110m` → *dollˈarim*, a plausible Italian-looking word that no leak class can see (trap 56).
            // Separating keeps *110 dollari* and leaves the `m` visible to RAW-LATIN; refusing would drop the
            // sign as well. Reading an abbreviated magnitude is a job for step 10's spelled-out list, which
            // is what `mag` already matches — this only stops the two tokens welding together.
            const tail = /^[\p{L}\p{M}]/u.test(whole.slice(offset + m0.length)) ? " " : "";
            return `${num}${mag ?? ""} ${mag === undefined ? "" : "di "}${word}${tail}`;
        },
    );

    return s;
}

/** Currency names, singular and plural. *euro* and *yen* are invariable in Italian (Accademia della Crusca:
 *  «euro» is unchanged in the plural), so both forms are the same word. Kept here rather than only in
 *  italian.ts because step 10 above needs them for the preposed form. */
export const CURRENCY: Readonly<Record<string, readonly [string, string]>> = {
    "€": ["euro", "euro"],
    $: ["dollaro", "dollari"],
    "£": ["sterlina", "sterline"],
    "¥": ["yen", "yen"],
};

/**
 * The DECIMAL COMMA, split out because of an ordering coupling: the shared
 * unit/percent/currency tier matches a unit only when a NUMBER is adjacent, and rewriting `1,5 km/s` to
 * "1 virgola 5 km/s" first would leave the tier looking at `5 km/s` — the number-unit association is
 * destroyed by the very rewrite. So italian.ts calls this AFTER the symbol tier has run.
 *
 * Before: `14,7 miliardi` → [kwattordˈit͡ʃi , sˈette miljˈardi], a clause pause standing in for *virgola*.
 * Requiring a DIGIT immediately on both sides of the comma is what keeps it off an enumeration
 * (`nel 1990, 1995`), which always carries the space a decimal never does.
 */
export function normalizeItalianDecimals(input: string): string {
    return input.replace(/(\d),(\d)/gu, "$1 virgola $2");
}
