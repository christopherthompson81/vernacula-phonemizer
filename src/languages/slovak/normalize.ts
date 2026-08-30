/**
 * Slovak (sk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the sk_sk FLEURS corpus (1,719 unique cased utterances, column 3). Every count below was
 * taken from that column and every rule exists because the engine produced something wrong on it — the
 * wrong reading is named with each rule below.
 *
 *   `N.` ordinals ×66 (see steps 7–8) — read as a CARDINAL plus a spurious phrase break:
 *       `V 16. storočí` → [v ʃˈestnaːsc . stˈɔrɔt͡ʃiː], `na 190. mieste` → [nˈa stˈɔ ɟˈevæɟɟˌesɪ̯at . mˈɪ̯esce].
 *   space-grouped thousands ×42 — the number token cannot span a space, so `11 000 $` read
 *       [jˈeɟenaːsc nˈula] ("eleven zero") and `4 800 km` [ʃtˈiri ˈɔsemstɔ].
 *   clocks ×16 colon + ×1 period — the colon is clause punctuation here, so `8:46` read
 *       [sˈeɟem , ʃtˈiritsˌacʃesc] with a phrase break inside the time, and `1:15` used the MASCULINE
 *       numeral against the feminine *hodina*.
 *   comma decimals ×17 — the comma was a phrase break: `2,4 GHz` → [dvˈa , ʃtˈiri kxs].
 *   percent ×4 — the sign was DROPPED outright ([ˈɔsemɟˌesɪ̯atˌɔsem t͡ʃˈistiːx] for `88 % čistých`).
 *   currency ×2 (`11 000 $`, `22 500 $`) — DROPPED.
 *   degree ×1 (`+30°C`) — both `+` and `°` DROPPED, `C` read as a bare letter [t͡s].
 *   `&` ×1 (`B&B`) — DROPPED, leaving two unlinked letters.
 *   `x`/`×` between digits ×5 (`4x4`, `56x56`, `36x24`) — read as the LETTER x, [ks].
 *   dash ranges ×6 — the dash was DROPPED, fusing the endpoints (`160 – 320 km/h`).
 *   era markers ×7 (`pred n.l.`, `n. l.`, `p.n.l.`) — every interior dot a phrase break and the letters a
 *       bogus word: [n . ˈl̩ .]. Plus `n. m.` ×1 (nad morom), the same shape.
 *   dotted abbreviations ×22 (tzv. ×6, atď. ×6, napr. ×3, Jr. ×3, t.j. ×2, Dr. ×2, č. ×1).
 *   units ×41 + rate/exponent ×8 — `km` reached the sink as raw letters, `/h` read as [x], `²` dropped.
 *   version dots ×5 (`802.11a/b/g/n`) — the interior dot was a phrase break.
 *
 * THE `N.` DISAMBIGUATION, and why it is NOT Croatian's. Tabulating what follows all 106 `N.` in the
 * corpus: 65 lowercase word, 1 comma, 31 END OF UTTERANCE, 2 uppercase word, 1
 * closing quote, 6 immediately-following digit. Fourteen of the 31 utterance-final ones sit right after a
 * YEAR (`v roku 1835.`, `sezóny 2009.`, `za rok 2010.`) — and they are SENTENCE PERIODS, because Slovak
 * reads a year as a CARDINAL and writes it with no ordinal period at all. Croatian's year-ordinal
 * rule (`1683. dinastija`, feminine genitive with *godine* elided) has no Slovak counterpart; applied
 * here it would destroy fourteen sentence-final pauses. So the discriminator is the plain German/Czech
 * one — lowercase word or comma → ordinal, uppercase / quote / end → sentence period — and the check that
 * matters is that **zero sentence-final pauses are lost** (34 preserved, pinned by a test).
 *
 * CASE. Slovak ordinals are adjectives and must agree. In all 66 claimable instances the licensing noun is
 * WRITTEN (storočia/storočí/storočím, the month genitives, rokoch/rokov, mieste, kategórie, gólom,
 * najväčším/najväčšou, svetovej, typu), so step 7 reads it and inflects. Step 8 emits the masculine
 * nominative for anything the licensor list does not know; it claims 0 corpus instances and exists because
 * ⚠ A CLOSED LIST IS CORRECT EXACTLY WHERE YOU LOOKED, and silent everywhere else.
 *
 * COUNT AGREEMENT is three-way and is NOT `slavicCountForm`: a Slovak compound ending in 1 takes the
 * genitive plural (*dvadsaťjeden hodín*, *dvadsaťjeden percent*), never the Russian singular. `skCountForm`
 * below is that selector, and slovak.ts passes it to the shared symbol tier so the two agree everywhere.
 *
 * NOTE on boundaries: every one here is an explicit lookaround, never `\b` (`\b` is ASCII-defined and matches nothing here).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { SYMBOLS, skCountForm } from "./slovak.ts";
import { numberToWords } from "./numbers.ts";
import { rewrite } from "../../core/provenance.ts";

/**
 * SLOVAK LETTER NAMES, for the initialism pass.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "á", á: "dlhé á", ä: "á prehlasované", b: "bé", c: "cé", č: "čé", d: "dé", ď: "ďé",
    e: "é", é: "dlhé é", f: "ef", g: "gé", h: "há", i: "í", í: "dlhé í", j: "jé", k: "ká",
    l: "el", ĺ: "dlhé el", ľ: "eľ", m: "em", n: "en", ň: "eň", o: "ó", ó: "dlhé ó",
    ô: "ó so vokáňom", p: "pé", q: "kvé", r: "er", ŕ: "dlhé er", s: "es", š: "eš", t: "té",
    ť: "ťé", u: "ú", ú: "dlhé ú", v: "vé", w: "dvojité vé", x: "iks", y: "ypsilon",
    ý: "dlhé ypsilon", z: "zet", ž: "žet",
};

/** Slovak phonotactics, for the OOV rule in core/initialisms.ts. West Slavic like Czech and tolerant of
 *  heavy clusters, so the onset/coda sets are generous on purpose: the work is done by the no-vowel test
 *  (HDP, DVD, GMT, TB, XDR, VPN, PTWC, NHK) and the run/onset tests, not by cluster policing.
 *  `r`/`l` are SYLLABIC in Slovak (`vlk`, `prst`, and the corpus's own `ZSSR` → [zsːˈr̩]), which the shared
 *  test already accommodates: its consonant-run signal exempts a run containing a liquid. */
export const isUnreadableSlovak = makeUnreadableTest({
    vowels: /[aeiouyáäéíóôúý]/u,
    legalOnsets: new Set([
        "bl", "br", "bz", "čl", "čm", "čn", "čr", "čv", "dl", "dr", "dv", "dž", "gl", "gn", "gr",
        "hl", "hm", "hn", "hr", "hv", "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr",
        "ps", "pt", "sk", "sl", "sm", "sn", "sp", "st", "sv", "sw", "šk", "šl", "šm", "šn", "šp", "št",
        "šv", "tl", "tr", "tv", "vl", "vn", "vr", "vz", "zl", "zn", "zv", "žl", "žn",
    ]),
    legalCodas: new Set([
        "ck", "ct", "čt", "dn", "lm", "rb", "rd", "rk", "rl", "rm", "rn", "rs", "rt", "rv", "rž",
        "sk", "st", "šť", "št", "tn", "zd", "zl", "zm", "zn",
    ]),
});

/**
 * INITIALISM PASS — 119 instances over 74 distinct acronyms in `sk_sk`, the second-largest shape in this
 * corpus after `N.` ×106, and every one of them was read as a raw letter cluster: `HDP` → [xtp], `DVD` →
 * [tft], `GMT` → [ɡmt], `PTWC` → [ptft͡s], `NHK` → [nxk], `USGS` → [ˈusks], `USA` → [ˈusa].
 *
 * This wires the SHARED seam (`core/initialisms.ts`), which ~30 languages already use — including Czech,
 * whose implementation this follows and whose acronym inventory is the same one (FLEURS translates the
 * same sentences). Slovak has no pronunciation dictionary — the g2p is rule-based — so `isRecorded` is
 * always false, exactly as in Czech and Russian.
 *
 * ORDERING, and the seam's header states it as a hard constraint: this MUST run after the Roman-numeral
 * and regnal rules (`Alžbeta II.` must not become EM-EM; `II` occurs twice in this corpus) and after the
 * abbreviation expansions. Running it last in `normalizeSlovak` satisfies both.
 */
export function normalizeSlovakInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: new Set(MANIFEST.acronymLetters),
        isRecorded: () => false,
        isUnreadable: isUnreadableSlovak,
    })(text);
}

/** Regular, NBSP and narrow-NBSP. The corpus uses NBSP BOTH as a thousands separator (`11 000`) and as an
 *  ordinary inter-word space (28 instances, `s vlastnením`), so it is folded to a plain space after the
 *  de-grouping pass has had its look. */
const GROUP_SPACE = " \\u00a0\\u202f\\u2009";  // NBSP, NNBSP, thin space

/** Pick the count form of a counted noun written [sg, paucal (2–4), gen-pl]. */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(skCountForm(n), 2)]!;
}

const HODINA: readonly [string, string, string] = ["hodina", "hodiny", "hodín"];
const MINUTA: readonly [string, string, string] = ["minúta", "minúty", "minút"];
const STUPEN: readonly [string, string, string] = ["stupeň", "stupne", "stupňov"];
const MILA: readonly [string, string, string] = ["míľa", "míle", "míľ"];

/**
 * A numeral agreeing with a FEMININE counted noun. Slovak marks gender on 1 and 2 only — jeden/jedna,
 * dva/dve — and both clock nouns are feminine, so the composer's masculine citation form is wrong on every
 * such hour (`1:15` read *jeden … pätnásť*). Only the suffix changes, so a compound is handled by the same
 * replacement: dvadsaťjeden → dvadsaťjedna, dvadsaťdva → dvadsaťdve.
 */
const feminine = (words: string): string => rewrite(words.replace(/jeden$/u, "jedna"), /dva$/u, "dve");

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Masculine-nominative ordinals 1–19 — the citation forms the paradigm inflects. Note that 5–19 end in
 *  SHORT -y: Slovak's rhythmic law forbids a long ending after a long syllable (piaty, šiesty, siedmy,
 *  ôsmy, deviaty, desiaty, jedenásty …), and `inflectWord` keys the ending set off exactly that. */
const ORD_1_19: readonly string[] = [
    "", "prvý", "druhý", "tretí", "štvrtý", "piaty", "šiesty", "siedmy", "ôsmy", "deviaty",
    "desiaty", "jedenásty", "dvanásty", "trinásty", "štrnásty", "pätnásty", "šestnásty",
    "sedemnásty", "osemnásty", "devätnásty",
];
const ORD_TENS: readonly string[] = [
    "", "desiaty", "dvadsiaty", "tridsiaty", "štyridsiaty", "päťdesiaty", "šesťdesiaty",
    "sedemdesiaty", "osemdesiaty", "deväťdesiaty",
];
const ORD_HUNDREDS: readonly string[] = [
    "", "stý", "dvojstý", "trojstý", "štvorstý", "päťstý", "šesťstý", "sedemstý", "osemstý", "deväťstý",
];

/** The case slots this layer can distinguish. `f.gen` also serves the feminine dative and locative, which
 *  are syncretic in -ej; `pl.gen` also serves the locative plural (-ých), which is what the decade rule
 *  wants (v 60. rokoch → v šesťdesiatych rokoch). */
type Slot =
    | "m.nom" | "m.gen" | "m.dat" | "m.loc" | "m.instr"
    | "f.nom" | "f.gen" | "f.acc" | "f.instr"
    | "n.nom" | "n.gen" | "n.loc" | "n.instr"
    | "pl.nom" | "pl.gen";

/** Hard adjectival endings, [LONG after a short stem-final syllable, SHORT after a long one]. The pair is
 *  Slovak's rhythmic law: prvý → prvého but siedmy → siedmeho, dvadsiaty → dvadsiateho. Slots whose ending
 *  carries no length (-om, -ej, -ou) are the same in both columns. */
const HARD: Readonly<Record<Slot, readonly [string, string]>> = {
    "m.nom": ["ý", "y"], "m.gen": ["ého", "eho"], "m.dat": ["ému", "emu"],
    "m.loc": ["om", "om"], "m.instr": ["ým", "ym"],
    "f.nom": ["á", "a"], "f.gen": ["ej", "ej"], "f.acc": ["ú", "u"], "f.instr": ["ou", "ou"],
    "n.nom": ["é", "e"], "n.gen": ["ého", "eho"], "n.loc": ["om", "om"], "n.instr": ["ým", "ym"],
    "pl.nom": ["é", "e"], "pl.gen": ["ých", "ych"],
};

/** `tretí` is the ONLY soft ordinal in 1–999 and its locative/feminine-instrumental palatalise the stem
 *  (treťom, treťou), so the forms are listed rather than derived. Reached inside compounds too (23rd =
 *  dvadsiaty tretí → dvadsiateho tretieho), which is the branch the corpus never exercises. */
const TRETI: Readonly<Record<Slot, string>> = {
    "m.nom": "tretí", "m.gen": "tretieho", "m.dat": "tretiemu", "m.loc": "treťom", "m.instr": "tretím",
    "f.nom": "tretia", "f.gen": "tretej", "f.acc": "tretiu", "f.instr": "treťou",
    "n.nom": "tretie", "n.gen": "tretieho", "n.loc": "treťom", "n.instr": "tretím",
    "pl.nom": "tretie", "pl.gen": "tretích",
};

/** One ordinal word → the requested slot. */
function inflectWord(w: string, slot: Slot): string {
    if (w === "tretí") return TRETI[slot];
    const long = w.endsWith("ý"); // ý ⇒ the long ending set; y ⇒ the rhythmically shortened one
    return w.slice(0, -1) + HARD[slot][long ? 0 : 1];
}

/**
 * An ordinal split into the CARDINAL prefix (which does not inflect) and the ordinal words (which all do).
 * Slovak inflects every element of a tens+units compound — 24. augusta is *dvadsiateho štvrtého augusta* —
 * but leaves a hundreds or thousands prefix as a plain cardinal: 190th is *sto deväťdesiaty*, 1918th
 * *tisíc deväťsto osemnásty*. Hundreds are space-separated from the remainder, matching numbers.ts's own
 * cardinal composition ("sto deväťdesiat"), so the two stay consistent.
 *
 * Returns undefined for an exact thousand (1000, 2000 …): that needs *tisíci*, a soft paradigm whose
 * locative/instrumental this repo has no source for, and leaving the text alone is the pre-change
 * behaviour rather than a guess. Zero corpus instances.
 */
export function ordinalParts(n: number): { pre: string; ord: readonly string[] } | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 1_000_000) return undefined;
    if (n < 20) return { pre: "", ord: [ORD_1_19[n]!] };
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? { pre: "", ord: [ORD_TENS[t]!] } : { pre: "", ord: [ORD_TENS[t]!, ORD_1_19[u]!] };
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        if (r === 0) return { pre: "", ord: [ORD_HUNDREDS[h]!] };
        return { pre: numberToWords(h * 100), ord: ordinalParts(r)!.ord };
    }
    const r = n % 1000;
    if (r === 0) return undefined; // an exact thousand needs *tisíci* — see the note above
    const tail = ordinalParts(r)!;
    return { pre: `${numberToWords(n - r)}${tail.pre === "" ? "" : ` ${tail.pre}`}`, ord: tail.ord };
}

/** Integer → the ordinal in one case slot, or undefined out of range. */
export function ordinalWords(n: number, slot: Slot): string | undefined {
    const p = ordinalParts(n);
    if (p === undefined) return undefined;
    const words = p.ord.map((w) => inflectWord(w, slot));
    return p.pre === "" ? words.join(" ") : `${p.pre} ${words.join(" ")}`;
}

/**
 * The licensing word after a bare `N.`, and the case it governs. EVERY key follows a `N.` somewhere in the
 * corpus except where marked: the paradigm's other slots are filled in from the same
 * lexemes so the rule is not correct only where the corpus happened to look.
 *
 *   storočie is NEUTER — 18. storočia = *osemnásteho storočia* (gen), v 16. storočí = *v šestnástom
 *   storočí* (loc), 11. storočím = *jedenástym storočím* (instr).
 *   A day before a month GENITIVE is masculine genitive: 15. augusta = *pätnásteho augusta*.
 *   rokoch/rokov are the DECADE, locative/genitive PLURAL: v 60. rokoch = *v šesťdesiatych rokoch*.
 */
const LICENSOR: Readonly<Record<string, Slot>> = {
    // century (neuter) — 27 corpus instances, the largest single context
    storočia: "n.gen", storočí: "n.loc", storočím: "n.instr", storočie: "n.nom", storočiu: "n.loc",
    // month genitives after a day number — 22 corpus instances (januára, februára, marca, júna, júla,
    // augusta, septembra, októbra attested; apríla, mája, novembra, decembra added for completeness)
    januára: "m.gen", februára: "m.gen", marca: "m.gen", apríla: "m.gen", mája: "m.gen", júna: "m.gen",
    júla: "m.gen", augusta: "m.gen", septembra: "m.gen", októbra: "m.gen", novembra: "m.gen",
    decembra: "m.gen",
    // decades
    rokoch: "pl.gen", rokov: "pl.gen", roky: "pl.nom",
    // rank / place (neuter)
    mieste: "n.loc", miesto: "n.nom", miesta: "n.gen",
    // the remaining attested heads
    kategórie: "f.gen", kategória: "f.nom", kategórii: "f.gen",
    gólom: "m.instr", gól: "m.nom", gólu: "m.gen",
    najväčším: "m.instr", najväčšou: "f.instr", najväčšia: "f.nom", najväčší: "m.nom", najväčšie: "n.nom",
    svetovej: "f.gen", svetová: "f.nom", svetovú: "f.acc", svetovou: "f.instr",
    typu: "m.gen", typ: "m.nom", typom: "m.instr",
};
const LICENSOR_ALT = Object.keys(LICENSOR).sort((a, b) => b.length - a.length).join("|");

// ---------------------------------------------------------------------------------------------------
// ABBREVIATIONS
// ---------------------------------------------------------------------------------------------------

/**
 * Re-attach a sentence period that an abbreviation's dot was doing double duty for. Two cases count as a
 * sentence end, and the SECOND is the one Czech's version misses: the utterance may run on into a NEW
 * sentence, as in `…356 pred n.l. Išlo o akt podpaľačstva…` and `…v roku 1000 p.n.l. Asýrčania…`, where
 * eating the dot loses the break. A following lowercase word (`400 n. l. a trvala`) or an explicit mark
 * (`323 pred n. l., bola`) is NOT a sentence end, and neither is a closing bracket that already has its
 * own period after it (`(1000–1300 n.l.).`).
 */
function keepFinal(expansion: string, matched: string, rest: readonly unknown[]): string {
    const whole = rest[rest.length - 1];
    const offset = rest[rest.length - 2];
    if (typeof whole !== "string" || typeof offset !== "number") return expansion;
    const after = whole.slice(offset + matched.length);
    if (/^[\s»)”"'\]]*$/u.test(after)) return `${expansion}.`;
    return /^\s+\p{Lu}/u.test(after) ? `${expansion}.` : expansion;
}

/** MULTI-DOT abbreviations — the ERA markers and `n. m.`. ⚠ Claimed FIRST, or their
 *  interior dots survive as breaks. `pred n. l.` is matched before the bare `n. l.` so the preposition is
 *  read into the instrumental *naším letopočtom*; the corpus itself spells that phrase out ("Egypťania v
 *  treťom storočí pred naším letopočtom"), which is where the wording comes from. The final dot is
 *  optional (`p.n.l` appears bare) and is restored by keepFinal when it was the sentence period. */
const MULTI_DOT: ReadonlyArray<readonly [RegExp, string]> = [
    [/(?<![\p{L}\p{M}])p\.\s?n\.\s?l\.?(?![\p{L}\p{M}])/giu, "pred naším letopočtom"],
    [/(?<![\p{L}\p{M}])pred\s+n\.\s?l\.?(?![\p{L}\p{M}])/giu, "pred naším letopočtom"],
    [/(?<![\p{L}\p{M}])n\.\s?l\.?(?![\p{L}\p{M}])/giu, "nášho letopočtu"],
    [/(?<![\p{L}\p{M}])n\.\s?m\.?(?![\p{L}\p{M}])/giu, "nad morom"],
    [/(?<![\p{L}\p{M}])t\.\s?j\.?(?![\p{L}\p{M}])/giu, "to jest"],
];

/** SINGLE-DOT abbreviations → their expansion. Sourced from the standard Slovak inventory (Pravidlá
 *  slovenského pravopisu): tzv. = takzvaný, atď. = a tak ďalej, napr. = napríklad, č. = číslo,
 *  Dr. = doktor, Jr. = junior. `tzv.` is an adjective emitted in its masculine-nominative citation form;
 *  agreeing with its head ("tzv. spamu" wants *takzvaného*) needs case the number cannot disclose. */
const DOTTED: Readonly<Record<string, string>> = {
    tzv: "takzvaný", atď: "a tak ďalej", napr: "napríklad", č: "číslo", dr: "doktor", jr: "junior",
};
const DOTTED_ALT = Object.keys(DOTTED).sort((a, b) => b.length - a.length).join("|");

/** Fraction denominator nouns 2–10, feminine. Slovak derives them from the CARDINAL stem with -ina
 *  (päť → pätina, šesť → šestina), and the three count forms are then the regular -ina / -iny / -ín
 *  paradigm. */
const DENOMINATOR: Readonly<Record<number, readonly [string, string, string]>> = {
    2: ["polovica", "polovice", "polovíc"],
    3: ["tretina", "tretiny", "tretín"],
    4: ["štvrtina", "štvrtiny", "štvrtín"],
    5: ["pätina", "pätiny", "pätín"],
    6: ["šestina", "šestiny", "šestín"],
    7: ["sedmina", "sedminy", "sedmín"],
    8: ["osmina", "osminy", "osmín"],
    9: ["devätina", "devätiny", "devätín"],
    10: ["desatina", "desatiny", "desatín"],
};

/** A clock's hour, as the FEMININE ordinal that agrees with the elided *hodina*, or undefined for hour 0
 *  (*nultá* is not idiomatic; the caller falls back to the neutral cardinal reading). */
function clockHour(h: number, slot: Slot): string | undefined {
    return h === 0 ? undefined : ordinalWords(h, slot);
}

/** The neutral, ungoverned clock reading: cardinal + counted noun (`15:00` → pätnásť hodín). */
function neutralClock(hv: number, mv: number): string {
    const head = `${feminine(numberToWords(hv))} ${counted(hv, HODINA)}`;
    return mv === 0 ? head : `${head} ${feminine(numberToWords(mv))} ${counted(mv, MINUTA)}`;
}

/**
 * One clock → words. `slot` is chosen by the GOVERNING PREPOSITION, which 14 of the corpus's 15 real
 * clocks carry: o / do / po / od / pred / okolo take loc or gen, syncretic in -ej
 * (*o ôsmej štyridsaťšesť*); medzi takes the instrumental -ou (*medzi šiestou tridsať a siedmou tridsať*).
 * The minutes are a bare cardinal after an ordinal hour, which is the spoken idiom — saying *minút* as
 * well would be the written-out form the corpus never uses in that position.
 */
function clock(hv: number, mv: number, slot: Slot | undefined): string {
    if (slot === undefined) return neutralClock(hv, mv);
    const head = clockHour(hv, slot);
    if (head === undefined) return neutralClock(hv, mv);
    return mv === 0 ? head : `${head} ${numberToWords(mv)}`;
}

/** HH:MM with the corpus's guards: hours ≤ 23 and minutes ≤ 59 (which is what keeps the rule off the
 *  football score `zvíťazila 26:00 nad Zambiou`), no third field (a sports time), no decimal comma.
 *  The trailing guard rejects a further digit or colon and a `.dd` third field — but NOT a bare period,
 *  which is the SENTENCE end: writing it as `(?![\d:.])` silently refused every clock at the end of an
 *  utterance (`medzi 06:30 a 07:30.`), i.e. exactly the instances the rule exists for. */
const CLOCK_BODY = "([01]?\\d|2[0-3])[:.]([0-5]\\d)";
const CLOCK_TAIL = "(?![\\d:])(?!\\.\\d)(?!,\\d)";

/**
 * Normalize one Slovak input string. Pure text→text, a numbered sequence of order-dependent steps; each
 * ordering coupling is stated at its step. Runs BEFORE the shared symbol tier for everything except the
 * decimal comma — see step 12.
 */
export function normalizeSlovak(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST (⚠ a grouping separator is otherwise read as clause
    //    punctuation, and the number token cannot span a space). Slovak groups thousands with a SPACE
    //    (42 corpus instances) and marks the decimal with a COMMA (17); there are ZERO period-grouped
    //    thousands, which is the opposite of Croatian and is why no period/ordinal thousands
    //    disambiguation is needed here. Two passes, because groups overlap on the shared digit
    //    (19 500 000). NBSP is folded to a plain space AFTERWARDS, never before — the corpus uses it both
    //    as the separator (`11 000 $`) and as an ordinary inter-word space (28 instances).
    for (let i = 0; i < 2; i++)
        s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");
    s = rewrite(s, new RegExp(`[${GROUP_SPACE}]`, "gu"), " ");

    // 1) MULTI-DOT ABBREVIATIONS (era markers, `n. m.`, `t. j.`), before the single-dot rule (⚠
    //    coupling) — otherwise the interior dots survive as breaks and the letters read as a bogus word
    //    ([n . ˈl̩ .]). Each expansion CONSUMES the final dot, so keepFinal puts back the sentence period
    //    where that dot was doing double duty (`356 pred n.l. Išlo …`).
    for (const [re, w] of MULTI_DOT)
        s = rewrite(s, re, (m0: string, ...rest: unknown[]) => keepFinal(w, m0, rest));

    // 2) SINGLE-DOT ABBREVIATIONS. The dot is consumed so it cannot become a phrase break. Two shapes:
    //    followed by a word (`tzv. spamu`, `č. 11`), and followed by a mark or the clause end
    //    (`jedlá atď., obetovaných`, `tuniak atď.`), where the sentence period is kept.
    //    Three shapes, in this order, and the THIRD is the one Czech's two-shape version gets wrong: a
    //    following comma already carries the pause, so appending a period there produced `a tak ďalej.,`
    //    — two marks where the sentence has one. Only an abbreviation at the very end of the utterance
    //    (or before closing brackets that end it) gets the period back.
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(\\s+)(?=[\\p{L}\\d(„"])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED[ab.toLowerCase()]!}${sp}`);
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(?=\\s*(?:[»)”\\]]\\s*)*$)`, "giu"),
        (_m, ab: string) => `${DOTTED[ab.toLowerCase()]!}.`);
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(?![\\p{L}\\p{M}])`, "giu"),
        (_m, ab: string) => DOTTED[ab.toLowerCase()]!);
    //    `St. Louis` ×1 — the DOT ONLY, with no expansion. There is no source for the word: the corpus's
    //    single `Saint` is the composer SAINT-SAËNS, a French surname, not this abbreviation's reading,
    //    and Czech's `St. = svatý` is the hagionym sense, wrong for an American city. But the dot is a
    //    separate defect from the word — it put a full phrase break in the middle of `do Six Flags v St.
    //    Louis v štáte Missouri` — and removing it needs no vocabulary at all. Claimed BY NAME,
    //    and only before a capitalised word, so a sentence-final `st.` cannot lose its pause.
    s = rewrite(s, /(?<![\p{L}\p{M}.])(St)\.(?=\s+\p{Lu})/gu, "$1");

    // 3) CLOCK RANGE, before the single clock (⚠ order by who needs WORDS
    //    first). `medzi 22:00 - 23:00` governs the INSTRUMENTAL on BOTH clocks, and the second one's form
    //    does not exist until it has been read, so the pair is claimed here and the dash becomes the `a`
    //    the corpus's other instance writes ("medzi 06:30 a 07:30"). Without this step the dash would
    //    survive between two already-worded clocks and be dropped by the tokenizer.
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(medzi\\s+)${CLOCK_BODY}\\s*(?:[-–—]|a)\\s*${CLOCK_BODY}${CLOCK_TAIL}`, "giu"),
        (m0, pre: string, h1: string, m1: string, h2: string, m2: string) =>
            `${pre}${clock(Number(h1), Number(m1), "f.instr")} a ${clock(Number(h2), Number(m2), "f.instr")}`);

    // 4) CLOCK. ⚠ Before any rule that looks for a bare number, and before the version-dot
    //    rule, which would otherwise eat the interior dot of the period form `o 12.00 GMT`. The colon is
    //    clause punctuation in slovak.jsonc, so every time in the corpus was split by a phrase break.
    //    The GOVERNING PREPOSITION picks the case: o/do/po/od/pred/okolo → -ej, medzi → -ou (the
    //    step above), nothing → the neutral cardinal + counted *hodín*. A trailing `hod`/`h` is CONSUMED
    //    (`do 23:35 hod`): the hour noun is already in the reading and saying it twice is redundant.
    s = rewrite(s, new RegExp(`(?<![\\d:.,])${CLOCK_BODY}${CLOCK_TAIL}(?:\\s+(?:hod|h)(?![\\p{L}\\p{M}]))?`, "gu"),
        (m0: string, h: string, min: string, offset: number, whole: string) => {
            const before = whole.slice(0, offset);
            const governed = /(?<![\p{L}\p{M}])(?:o|do|po|od|pred|okolo)\s+$/iu.test(before);
            return clock(Number(h), Number(min), governed ? "f.gen" : undefined);
        });

    // 5) VERSION / FIGURE DOTS between digits — `802.11a`, `802.11b`, `802.11g`, `802.11n` (×5) broke the
    //    sentence at the interior dot. AFTER the clock (which owns `12.00`) and before the ordinal rules,
    //    so those never see a digit-dot-digit.
    s = rewrite(s, /(\d)\.(?=\d)/gu, "$1 bodka ");

    // 6) NUMERIC RANGES. The dash between two numbers was DROPPED, fusing "1418" and "1450" into one
    //    uninterrupted run of words. Read as "do". Digits are required on BOTH sides so that `Il-76` and
    //    `COVID-19` are untouched — the corpus contains both, and both currently read correctly.
    //    BEFORE the ordinal rules so a dashed pair is never mistaken for a licensed ordinal, and before
    //    the shared tier so `160 – 320 km/h` keeps its unit adjacency on the second operand.
    //    EQUAL ENDPOINTS ARE NOT A RANGE. The corpus's `za stavu 6-6 vyžiadalo tajbrejk` is a tennis
    //    score, and "šesť do šesť" is not Slovak; a range whose endpoints coincide never is one, so the
    //    rule declines it rather than needing a score-vs-range judgement. 5 of the corpus's 6 dashed
    //    pairs are true ranges and are claimed; this is the sixth.
    s = rewrite(s, /(?<![\d.,])(\d+)\s?[–—-]\s?(\d+)(?![\d.,])/gu,
        (m0, a: string, b: string) => (a === b ? m0 : `${a} do ${b}`));

    // 7) LICENSED ORDINALS — the corpus's 66 claimable `N.`, inflected by the noun that follows. The LIST
    //    prefix handles `11., 12. a 13. storočí` (all three locative), `1. a 2. svetovej vojny` and
    //    `medzi 10. a 11. storočím`; the optional word after `a` handles `19. a začiatku 20. storočia`,
    //    the corpus's one interpolated head. Every item in the list takes the head noun's case, which is
    //    what Slovak agreement requires and what a per-item rule could not produce.
    s = rewrite(s,
        new RegExp(
            `(?<![\\p{L}\\p{M}\\d.,])((?:\\d{1,4}\\.,?\\s+(?:a\\s+(?:[\\p{Ll}\\p{M}]+\\s+)?)?)*)`
            + `(\\d{1,4})\\.\\s+(${LICENSOR_ALT})(?![\\p{L}\\p{M}])`,
            "gu",
        ),
        (m0: string, list: string, digits: string, head: string) => {
            const slot = LICENSOR[head]!;
            const tail = ordinalWords(Number(digits), slot);
            if (tail === undefined) return m0;
            //    The item's own COMMA is re-emitted: `v 11., 12. a 13. storočí` is spoken with that pause,
            //    and swallowing it with the ordinal period lost it (⚠ once you
            //    stop writing an operand back verbatim, its character class starts eating punctuation).
            const pre = list.replace(/(\d{1,4})\.(,?)/gu,
                (w, n: string, comma: string) => `${ordinalWords(Number(n), slot) ?? w}${comma}`);
            return `${pre}${tail} ${head}`;
        },
    );

    // 8) GENERAL ORDINAL — the discriminator from the corpus tabulation: a `N.` followed by a
    //    LOWERCASE word or a COMMA is an ordinal; one followed by an UPPERCASE word, a closing quote or
    //    the end of the utterance is a SENTENCE PERIOD and must not be claimed. Emits the masculine
    //    nominative, because a word outside the licensor list does not disclose the case.
    //    Two corpus instances, both REGNAL (see below); the licensor list takes the other 64.
    //
    //    REGNAL NAMES are the one case where the preceding word discloses the agreement instead of the
    //    following one. Slovak has no ROMAN_NATIVE entry, so the shared pass has already rewritten
    //    `Alžbeta II.` to `Alžbeta 2.` before this engine runs, and the masculine `druhý` is wrong for a
    //    queen. Gender and case come from the NAME's own ending — -a is the feminine nominative
    //    (Alžbeta → druhá), -y its genitive (Alžbety → druhej), -ho the masculine genitive of a
    //    vowel-final name (Lealofiho → tretieho) — and anything else falls back to the masculine
    //    nominative, which is what this step would have emitted anyway. Bounded to ≤ 39, the practical
    //    monarch range, so `Standard 802` and a page number cannot reach it. The lowercase-follower guard
    //    is shared with the general rule and is what keeps `stanice Fort Greely 9.` (an utterance end) out
    //    — that instance therefore keeps its sentence period and its cardinal reading, deliberately.
    s = rewrite(s, /(?<![\p{L}\p{M}\d.,])(\d{1,4})\.(?=\s*[,\p{Ll}])/gu,
        (m0, digits: string, offset: number, whole: string) => {
            const n = Number(digits);
            const name = /(?<![\p{L}\p{M}])(\p{Lu}[\p{L}\p{M}]+)\s+$/u.exec(whole.slice(0, offset))?.[1];
            const slot: Slot = name === undefined || n > 39 ? "m.nom"
                : name.endsWith("ho") ? "m.gen"
                    : name.endsWith("a") ? "f.nom"
                        : name.endsWith("y") ? "f.gen" : "m.nom";
            return ordinalWords(n, slot) ?? m0;
        });

    // 9) MÍĽ RATE — `40 míľ/h`. `míľ` is already the written Slovak genitive plural of *míľa*, so only the
    //    denominator needs reading, and the corpus spells the idiom out two sentences away: "rýchlosť 105
    //    míľ za hodinu (165 km/h)". The shared tier's `mi` key cannot match the spelled form.
    s = rewrite(s, /(\d+)\s?míľ\s?\/\s?h(?![\p{L}\p{M}])/giu, (_m, n: string) => `${n} míľ za hodinu`);
    //    …and the bare abbreviation, which the corpus does not write but the neighbouring form implies.
    s = rewrite(s, /(\d+)\s?mi\s?\/\s?h(?![\p{L}\p{M}])/giu,
        (_m, n: string) => `${n} ${counted(Number(n), MILA)} za hodinu`);

    // 10) SIGNS that must be read BEFORE the shared tier, because they sit between the number and its
    //     unit or change what the number is. Degrees take the three-way agreement (30 → stupňov).
    s = rewrite(s, /(\d+)\s?°\s?C(?![\p{L}\p{M}])/gui,
        (_m, n: string) => `${n} ${counted(Number(n), STUPEN)} Celzia`);
    s = rewrite(s, /(\d+)\s?°\s?F(?![\p{L}\p{M}])/gui,
        (_m, n: string) => `${n} ${counted(Number(n), STUPEN)} Fahrenheita`);
    s = rewrite(s, /(\d+)\s?°/gu, (_m, n: string) => `${n} ${counted(Number(n), STUPEN)}`);
    s = rewrite(s, /(?<=\d)\s?[x×]\s?(?=\d)/gu, " krát ");
    //     A leading `+`/`−` on a number. The corpus's one instance is `+30°C`; the minus is its
    //     counterpart, and a sign that is dropped turns a negative into a positive — the one outcome that
    //     cannot be right. U+2212 as well as the hyphen; the boundary keeps a hyphenated compound and a
    //     range (already rewritten in step 6) untouched.
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = rewrite(s, /±/gu, " plus mínus ");
    s = rewrite(s, /(^|[\s(])\+\s?(?=\d)/gu, "$1plus ");
    s = rewrite(s, /(^|[\s(])[-−]\s?(?=\d)/gu, "$1mínus ");

    // 11) THE SHARED SYMBOL TIER — %, currency, units, rates, exponents. It must see the number still
    //     ADJACENT to its unit and still carrying its decimal comma (`2,4 GHz`), so it runs here: after
    //     every rule that moves digits around, and before step 12 folds the comma into a word.
    s = SYMBOLS(s);

    // 12) DECIMAL COMMA → the word. Slovak name for the comma, and the same choice Czech made
    //     for the same separator. Inserted as TEXT so the tokenizer phonemises it.
    s = rewrite(s, /(?<=\d),(?=\d)/gu, " čiarka ");

    // 13) FRACTIONS. Zero corpus instances — the only slash it writes is the SEASON `1995/96`, which the
    //     ≤3-digit numerator guard excludes — so the rule
    //     COMPOSES from the denominator noun and a feminine numerator (1/5 = jedna pätina, 3/4 = tri
    //     štvrtiny, 2/3 = dve tretiny) instead of tabulating the numerator that happens to be attested,
    //     which is exactly the defect Uzbek shipped. Denominators above 10 are left untouched.
    s = rewrite(s, /(\d+)¾/gu, "$1 a tri štvrtiny");
    s = rewrite(s, /(\d+)½/gu, "$1 a pol");
    s = rewrite(s, /(\d+)¼/gu, "$1 a štvrtina");
    s = rewrite(s, /(?<![\d/.,])(\d{1,3})\/(\d{1,2})(?![\d/.,])/gu, (m0, a: string, b: string) => {
        const forms = DENOMINATOR[Number(b)];
        if (forms === undefined) return m0;
        return `${feminine(numberToWords(Number(a), a))} ${counted(Number(a), forms)}`;
    });

    // 14) RELATIONAL SIGNS and the ampersand. None of the relational signs occurs in this corpus, but a
    //     phonemizer is handed arbitrary text and a dropped sign is inaudible — the one outcome that
    //     cannot be right.
    s = rewrite(s, /\s*≈\s*/gu, " približne sa rovná ");
    s = rewrite(s, /\s*=\s*/gu, " rovná sa ");
    s = rewrite(s, /\s*<\s*/gu, " menší ako ");
    s = rewrite(s, /\s*>\s*/gu, " väčší ako ");
    s = rewrite(s, /\s*÷\s*/gu, " delené ");
    //     `&` → "a" (1 corpus instance, `B&B`, where it was dropped and left two unlinked letters).
    //     THE FLANKING LETTERS ARE SPELLED when both are lone capitals, which is what `B&B` is: joining
    //     them alone still left `B a B`, read [p ˈa p] — two bare devoiced stops, not the letter *bé*.
    //     Step 15 cannot rescue them, because its run requires two adjacent capitals. Doing it here, gated
    //     on the ampersand, is what keeps it safe: a general "lone capital → letter name" rule is
    //     impossible in Slovak, where `v`, `a`, `i`, `s`, `k`, `o`, `u`, `z` are all real words (`V 16.
    //     storočí` opens with one).
    s = rewrite(s, /(?<![\p{L}\p{M}])(\p{Lu})\s*[&＆]\s*(\p{Lu})(?![\p{L}\p{M}])/gu,
        (m0, a: string, b: string) => {
            const [x, y] = [LETTER_NAME[a.toLowerCase()], LETTER_NAME[b.toLowerCase()]];
            return x === undefined || y === undefined ? m0 : `${x} a ${y}`;
        });
    s = rewrite(s, /\s*[&＆]\s*/gu, " a ");

    // 15) INITIALISMS, LAST. The seam's ordering constraint is that it must follow the Roman-numeral and
    //     regnal rules (step 8) and the abbreviation expansions (steps 1–2) — an all-caps run is what a
    //     Roman numeral and an unexpanded abbreviation both look like. Running last satisfies both.
    s = normalizeSlovakInitialisms(s);

    return s;
}
