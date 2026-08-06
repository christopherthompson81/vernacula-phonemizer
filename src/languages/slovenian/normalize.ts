/**
 * Slovenian (sl) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the sl_si FLEURS corpus (1,903 unique cased utterances, column 3 — the CASED original;
 * column 4 is lowercased and stripped of exactly the punctuation this layer exists to read). Every count
 * below was taken from that column and every rule exists because the engine produced something wrong on it;
 * the verbatim before-readings are in, Run 3.
 *
 *   `N.` ordinals ×95 (steps 6a–6c) — read as a CARDINAL plus a spurious phrase break:
 *       `V 16. stoletju` → [ʋ ʃɛstnajst . stɔlɛtju], `na 190. mesto` → [na stɔ dɛʋɛddɛsɛt . mɛstɔ].
 *   PERIOD-grouped thousands ×28 — the grouping period was clause punctuation AND split the number, so
 *       `19.500 km²` read [dɛʋɛtnajst . pɛtstɔ km] ("nineteen · five hundred") and `400.000` [ʃtiristɔ . nit͡ʃ].
 *   clocks ×16 (13 period-form `23.35`, 3 colon-form `07:19`) — both marks are clause punctuation here, so
 *       every time was split by a phrase break and read as two bare cardinals ([ɔp triindʋajsɛt . pɛtintridɛsɛt]).
 *   comma decimals ×17 — the comma was a phrase break: `2,4 GHz` → [dʋa , ʃtiri ɡxs].
 *   units ×40 + rate ×8 + exponent ×3 — there was NO symbol tier for Slovenian at all, so `km` reached
 *       the sink as the raw letters [km], `km²` dropped its ², `/h` read as [x], `mm2` read the ASCII 2 as
 *       the number *dva*.
 *   percent ×4 — the sign was DROPPED outright ([triindɛʋɛddɛsɛt prɛbiʋalstʋa] for `93 % prebivalstva`).
 *   degree ×2 (`35°`, `+30 °C`) — `°` and `+` DROPPED, `C` read as a bare letter [t͡s].
 *   dash ranges ×11 — the dash was DROPPED, fusing the endpoints (`1418–1450` → one 8-word run).
 *   era markers ×10 (`pr. n. š.` ×7 incl. one `pr. n. št.`, `n. š.` ×3) — every interior dot a phrase break
 *       and the letters a bogus word: [pər . n . ʃ .].
 *   dotted abbreviations ×25 (dr./Dr. ×5, g./G./Ga. ×5, itd. ×4, npr. ×2, oz. ×1, št. ×1, ml. ×2, idr. ×2,
 *       St. ×1, Inc. ×1, et al. ×1) — the dot became a phrase break and the stump a cluster: [npər .], [itt .].
 *   initialisms ×132 over 85 acronyms (step 20) — every one a raw letter cluster: `BDP` → [ptp],
 *       `DVD` → [dʋt], `GMT` → [ɡmt], `USGS` → [usks], `NHK` → [nxk], `DNK` → [dnk], `UTC` → [utt͡s],
 *       `DSLR` → [tslər], `ZN` → [zn].
 *   version dots ×6 (`802.11a/b/g/n`, `Sliko 1.1.`) — the interior dot was a phrase break.
 *   fractions ×3 (`29 3/4 palca`, `24 1/2 palca`, `1/5 palca`) — read as two bare cardinals.
 *   `x` between digits ×2 (`36 x 24 mm`, `4 x 4`) — read as the LETTER x, [ks].
 *   `&` ×1 (`B&B-ji`) — DROPPED, leaving [p p].
 *   hyphen + case suffix ×2 (`1830-ih`, `ob 5-ih`) — the suffix read as its own junk token, [ix].
 *   hyphen before a unit ×2 (`35-mm`, `360-km`) — the hyphen broke the number–unit adjacency the tier needs.
 *
 * THE ORDINAL PERIOD, and why Slovenian is Slovak and not Croatian. Tabulating what follows all 124 `N.`
 * in the corpus: **95 lowercase word, 26 END OF UTTERANCE, 2 uppercase word, 1 comma**.
 * All 26 utterance-final ones are SENTENCE PERIODS and 18 of them sit right after a YEAR (`leta 2009.`,
 * `do leta 1945.`, `sezone 2009.`) — because Slovene reads a year as a CARDINAL and writes it with NO
 * ordinal period (144 corpus years, not one of them dotted mid-sentence). Croatian #599's year-ordinal rule
 * has no Slovenian counterpart; applied here it would have destroyed **26 utterance-final sentence pauses**.
 * Both uppercase-followed instances are sentence periods too (`severno od 1770. Občasno …` — 1770 is the
 * Queensland town; `5. septembrom 2021. Nekaj …`). So the discriminator is the plain one — a LOWERCASE
 * follower is an ordinal, an UPPERCASE word / a quote / the end of the utterance is a sentence period — and
 * the invariant that matters is that **zero utterance-final pauses are lost** (26 preserved, pinned by a
 * test and re-counted in the corpus diff).
 *
 * COUNT AGREEMENT IS FOUR-WAY, and `slavicCountForm` is wrong for Slovene twice over. Slovene has a living
 * DUAL, so 1 / 2 / 3–4 / 5+ are four distinct forms (en odstotek · dva odstotka · trije odstotki · pet
 * odstotkov) where the shared selector has three; and the selector is keyed on the WHOLE numeral, not its
 * final digits, because a Slovene compound takes the genitive plural whatever it ends in (dvaindvajset
 * odstotkov, never *dvaindvajset odstotek*). A fifth slot carries the genitive SINGULAR that a decimal
 * governs (2,4 gigaherca). `slCountForm` in slovenian.ts is that selector and the tier is built on it —
 * sourced from this engine's OWN data, not from a sibling: `numbers.ts` has selected the magnitude form
 * with `count === 1 ? sg : count === 2 ? dual : count <= 4 ? paucal : plural` since bringup, and all four
 * `odstotek` forms are attested in the corpus (odstotek ×1, odstotka ×1, odstotki ×1, odstotkov ×11).
 * CORE WAS NOT TOUCHED: `makeSymbolNormalizer` already takes `countForm`.
 *
 * AGREEMENT CANNOT BE APPLIED TO DIGITS (trap 14 (agreement cannot be applied to digits)), and Slovene needs the fix in the GENDER of the numeral,
 * not the noun: the tokenizer reads a bare `1` as *ena* and a bare `3`/`4` as *tri* and *štiri*, which are the
 * FEMININE forms, so a masculine counted noun came out as *ena odstotek* / *tri kilometri*. Step 15 is the
 * post-tier pass that repairs exactly the four affected cells, keyed on the noun forms the tier itself
 * declares. `en odstotek` and `trije`/`štirje`/`dve` are all corpus-attested.
 *
 * NOTE on boundaries: every one here is an explicit lookaround, never `\b` (trap 1 (`\b` is ASCII-defined)).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { COUNTED, SYMBOLS, slCountForm } from "./slovenian.ts";
import { numberToWords } from "./numbers.ts";

const N = MANIFEST.numbers;

/**
 * SLOVENE LETTER NAMES, for the initialism pass and for the `&`/glued-letter rules.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ce", č: "če", d: "de", e: "e", f: "fe", g: "ge", h: "he", i: "i",
    j: "je", k: "ke", l: "le", m: "me", n: "ne", o: "o", p: "pe", r: "re", s: "se", š: "še",
    t: "te", u: "u", v: "ve", z: "ze", ž: "že",
    q: "ku", w: "dvojni ve", x: "iks", y: "ipsilon", ć: "mehki če", đ: "dže",
};

/** Slovene phonotactics, for the OOV rule in core/initialisms.ts. Generous on purpose, exactly as in
 *  Slovak: the work is done by the no-vowel test (BDP, DVD, GMT, ZN, GPS, DNK, TV, GP) and the illegal
 *  onset/coda tests (FBI, NBA, UTC, ABC, USD), not by cluster policing. ⟨r⟩ is SYLLABIC in Slovene
 *  (prst → [pərst]), which the shared test already accommodates — its consonant-run signal exempts a run
 *  containing a liquid, which is why `DSLR` needs the coda test rather than the run test. */
export const isUnreadableSlovenian = makeUnreadableTest({
    vowels: /[aeiouy]/u,
    legalOnsets: new Set([
        "bl", "br", "cv", "čl", "čr", "čv", "dl", "dr", "dv", "dž", "gl", "gn", "gr", "hl", "hm",
        "hr", "hv", "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps", "pt", "sk",
        "sl", "sm", "sn", "sp", "sr", "st", "sv", "sw", "šk", "šl", "šm", "šp", "št", "šv", "tl",
        "tr", "tv", "vl", "vn", "vr", "vz", "zb", "zd", "zg", "zl", "zm", "zn", "zr", "zv", "žl", "žr",
    ]),
    legalCodas: new Set([
        "ck", "čn", "dn", "jn", "jt", "lc", "lk", "lm", "ln", "ls", "lt", "mp", "nc", "nd", "nk", "nt",
        "rd", "rk", "rn", "rs", "rt", "rž", "sk", "sm", "sn", "st", "šk", "št", "zd", "zm", "zn",
    ]),
});

/**
 * INITIALISM PASS — 132 instances over 85 distinct acronyms in `sl_si`, the largest untreated shape in this
 * corpus after `N.` ×124, and the readings being shipped were `BDP` → [ptp], `DVD` → [dʋt], `GMT` → [ɡmt],
 * `USGS` → [usks], `NHK` → [nxk], `DNK` → [dnk], `UTC` → [utt͡s], `DSLR` → [tslər], `ZN` → [zn].
 *
 * ORDERING, which the seam's own header states as a hard constraint: this MUST run after the Roman-numeral
 * and regnal rules and after the abbreviation expansions, because an all-caps run is what a Roman numeral
 * and an unexpanded abbreviation both look like. Running it LAST in `normalizeSlovenian` satisfies both.
 * Slovenian is NOT in `ROMAN_NATIVE`, so `core/roman.ts` has already turned `II`/`III` into `2`/`3` in
 * `registry.ts` before this engine's `text()` is called — pinned end-to-end by a test on `XV`, a vowel-less
 * numeral that would break loudly if the order were ever wrong.
 */
export function normalizeSlovenianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: new Set(MANIFEST.acronymLetters),
        isRecorded: () => false,
        isUnreadable: isUnreadableSlovenian,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// COUNTED NOUNS — the four-way dual agreement
// ---------------------------------------------------------------------------------------------------

/** *stopinja* — the degree noun, claimed locally in step 9 rather than by the tier (the scale letter sits
 *  between the number and the noun), but declared with every other counted noun so the agreement and the
 *  gender repair are one code path. A FUNCTION, not a const: slovenian.ts imports this module, so a
 *  top-level read of COUNTED here would run before that module's own initialisation. */
const STOPINJA = (): readonly string[] => COUNTED.deg!.forms;

/** Pick the form of a five-slot counted noun for `n`: [sg, dual, paucal (3–4), gen.pl (5+), gen.sg]. */
function counted(n: number, forms: readonly string[]): string {
    return forms[Math.min(slCountForm(n), forms.length - 1)]!;
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Masculine-nominative ordinals 1–19 — the citation forms the paradigm inflects. `sedmi`/`osmi` syncopate
 *  the cardinal's stem vowel (sedem → sedmi, osem → osmi); everything else is the cardinal + -i. */
const ORD_1_19: readonly string[] = [
    "", "prvi", "drugi", "tretji", "četrti", "peti", "šesti", "sedmi", "osmi", "deveti",
    "deseti", "enajsti", "dvanajsti", "trinajsti", "štirinajsti", "petnajsti", "šestnajsti",
    "sedemnajsti", "osemnajsti", "devetnajsti",
];
const ORD_TENS: readonly string[] = [
    "", "deseti", "dvajseti", "trideseti", "štirideseti", "petdeseti", "šestdeseti",
    "sedemdeseti", "osemdeseti", "devetdeseti",
];
const ORD_HUNDREDS: readonly string[] = [
    "", "stoti", "dvestoti", "tristoti", "štiristoti", "petstoti", "šeststoti", "sedemstoti",
    "osemstoti", "devetstoti",
];

/** The case slots this layer can distinguish. Syncretisms are folded into one key rather than duplicated:
 *  `f.dat` also serves the feminine LOCATIVE (both -i: *ob deseti uri*, *v drugi svetovni vojni*), `f.acc`
 *  the feminine INSTRUMENTAL (both -o: *med triindvajseto uro*), and `pl.gen` the LOCATIVE plural (both
 *  -ih: *v osemdesetih letih*), which is what the decade rule wants. */
type Slot =
    | "m.nom" | "m.gen" | "m.dat" | "m.loc" | "m.instr"
    | "f.nom" | "f.gen" | "f.dat" | "f.acc"
    | "n.nom" | "n.gen" | "n.loc" | "n.instr"
    | "pl.nom" | "pl.gen";

/**
 * Definite-adjective endings, [after a HARD stem, after a PALATAL one]. Slovene ordinals all end in -i, so
 * the stem is the base minus that -i; the two columns differ in exactly ONE slot, the neuter nominative,
 * where a palatal stem takes -e instead of -o (tretje mesto, tisoče, not *tretjo). The feminine accusative
 * keeps its -o after a palatal (tretjo knjigo), which is why this is a per-slot pair and not a blanket
 * o → e substitution.
 */
const ENDINGS: Readonly<Record<Slot, readonly [string, string]>> = {
    "m.nom": ["i", "i"], "m.gen": ["ega", "ega"], "m.dat": ["emu", "emu"],
    "m.loc": ["em", "em"], "m.instr": ["im", "im"],
    "f.nom": ["a", "a"], "f.gen": ["e", "e"], "f.dat": ["i", "i"], "f.acc": ["o", "o"],
    "n.nom": ["o", "e"], "n.gen": ["ega", "ega"], "n.loc": ["em", "em"], "n.instr": ["im", "im"],
    "pl.nom": ["i", "i"], "pl.gen": ["ih", "ih"],
};

/**
 * Integer → the masculine-nominative ordinal, composed the same way `numbers.ts` composes the cardinal so
 * the two can never disagree: the tens+units compound is ONE word with the "in" infix and the ORDINAL
 * suffix on the ten (24 → štiriindvajseti), while hundreds and thousands are space-separated and stay
 * plain cardinals (190 → *sto devetdeseti*, 247 → *dvesto sedeminštirideseti*, 1830 → *tisoč osemsto
 * trideseti*). Only the LAST word ever inflects, which is what `inflect` relies on.
 */
export function ordinalBase(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 1_000_000) return undefined;
    if (n < 20) return ORD_1_19[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? ORD_TENS[t] : `${N.units[u]}${N.and}${ORD_TENS[t]}`;
    }
    if (n < 1000) {
        const r = n % 100;
        return r === 0 ? ORD_HUNDREDS[n / 100] : `${N.hundreds[Math.floor(n / 100)]} ${ordinalBase(r)!}`;
    }
    const r = n % 1000;
    // An exact thousand: *tisoči* (1000), *dva tisoči* (2000). The thousands word is invariant in the
    // cardinal (`tisoč`) and takes the ordinal suffix here, exactly as `sto` → `stoti` does above.
    if (r === 0) {
        const th = n / 1000;
        return th === 1 ? "tisoči" : `${numberToWords(th)} tisoči`;
    }
    return `${numberToWords(n - r)} ${ordinalBase(r)!}`;
}

/** One ordinal (possibly a multi-word composition) → the requested slot; only the last word inflects. */
export function inflect(base: string, slot: Slot): string {
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const stem = last.slice(0, -1);
    words[words.length - 1] = stem + ENDINGS[slot][/[jčžšc]$/u.test(stem) ? 1 : 0];
    return words.join(" ");
}

/** Integer → the ordinal in one case slot, or undefined out of range. */
export function ordinalWords(n: number, slot: Slot): string | undefined {
    const base = ordinalBase(n);
    return base === undefined ? undefined : inflect(base, slot);
}

/**
 * The licensing word after a bare `N.`, and the case it governs. EVERY key with a comment count follows an
 * `N.` somewhere in the corpus; the other slots of the same lexemes are filled in
 * from the same paradigm so the rule is not correct only where I happened to look (trap 8 (zero corpus instances is not evidence of…)).
 *
 *   stoletje is NEUTER — 19. stoletja = *devetnajstega stoletja* (gen), v 16. stoletju = *v šestnajstem
 *   stoletju* (loc), s 15. stoletjem = *s petnajstim stoletjem* (instr), 17. stoletje = *sedemnajsto*.
 *   A day before a month GENITIVE is masculine genitive: 9. julija = *devetega julija*.
 *   letih / let are the DECADE, locative / genitive PLURAL: v 80. letih = *v osemdesetih letih*.
 *   ura takes -i after *ob* or *po* (locative) and -o after *med* (instrumental): *med 23. uro*.
 */
const LICENSOR: Readonly<Record<string, Slot>> = {
    // century (neuter) — 33 corpus instances, the largest single context
    stoletja: "n.gen", stoletju: "n.loc", stoletje: "n.nom", stoletjem: "n.instr", stoletij: "pl.gen",
    // the decade — 11 corpus instances
    letih: "pl.gen", let: "pl.gen", leta: "pl.nom", leti: "pl.gen",
    // month genitives after a day number — 28 corpus instances (januarja, februarja, marca, junija,
    // julija, avgusta, septembra, oktobra, novembra attested; the rest complete the calendar)
    januarja: "m.gen", februarja: "m.gen", marca: "m.gen", aprila: "m.gen", maja: "m.gen",
    junija: "m.gen", julija: "m.gen", avgusta: "m.gen", septembra: "m.gen", oktobra: "m.gen",
    novembra: "m.gen", decembra: "m.gen",
    // …the same months in the other slots the corpus shows (avgustom / septembrom instrumental after
    // *med*, avgust nominative, septembru locative after *po*)
    januar: "m.nom", februar: "m.nom", marec: "m.nom", april: "m.nom", maj: "m.nom", junij: "m.nom",
    julij: "m.nom", avgust: "m.nom", september: "m.nom", oktober: "m.nom", november: "m.nom",
    december: "m.nom",
    januarjem: "m.instr", februarjem: "m.instr", marcem: "m.instr", aprilom: "m.instr",
    majem: "m.instr", junijem: "m.instr", julijem: "m.instr", avgustom: "m.instr",
    septembrom: "m.instr", oktobrom: "m.instr", novembrom: "m.instr", decembrom: "m.instr",
    januarju: "m.loc", februarju: "m.loc", marcu: "m.loc", aprilu: "m.loc", maju: "m.loc",
    juniju: "m.loc", juliju: "m.loc", avgustu: "m.loc", septembru: "m.loc", oktobru: "m.loc",
    novembru: "m.loc", decembru: "m.loc",
    // the clock hour written as an ordinal + the noun (`Malo po 11. uri`, `Med 22. in 23. uro`) — 3
    uri: "f.dat", uro: "f.acc", ure: "f.gen", ura: "f.nom",
    // rank / place (neuter) — 1
    mesto: "n.nom", mestu: "n.loc", mesta: "n.gen", mestom: "n.instr",
    // the remaining attested heads
    kategorije: "f.gen", kategorija: "f.nom", kategoriji: "f.dat", kategorijo: "f.acc",
    členom: "m.instr", člen: "m.nom", člena: "m.gen", členu: "m.loc",
    svetovno: "f.acc", svetovni: "f.dat", svetovna: "f.nom", svetovne: "f.gen",
    največja: "f.nom", največji: "m.nom", največje: "n.nom", največjega: "m.gen",
    znamka: "f.nom", znamke: "f.gen", znamko: "f.acc",
    dne: "m.gen", dan: "m.nom", dneva: "m.gen", dnevu: "m.loc",
    vojske: "f.gen", vojska: "f.nom", vojski: "f.dat", vojsko: "f.acc",
    polk: "m.nom", polka: "m.gen", polku: "m.loc",
};
const LICENSOR_ALT = Object.keys(LICENSOR).sort((a, b) => b.length - a.length).join("|");

/**
 * The case slot a following word governs when it is NOT in the closed list — read off the ENDING, and
 * deliberately restricted to the two endings that can only ever be an inflected adjectival form in
 * Slovene: `-ega` (masculine/neuter genitive singular) and `-ih` (genitive/locative plural). Slovene nouns
 * take neither, so neither can misfire on a head noun. Everything else falls through to the masculine
 * nominative, which is the citation form and what the pre-change reading's cardinal was standing in for.
 *
 * `-e`, `-em`, `-a` and `-u` were considered and REJECTED (trap 9 — a guard alternative with no attested
 * instance is a misfire generator): `-em` is both the locative adjective and the ordinary noun *sistem*,
 * and `-a` is masculine genitive (avgusta), neuter genitive (stoletja) and feminine nominative (znamka)
 * all at once. The one corpus instance that suffers for it is `10. italijanske vojske`, which the closed
 * list reaches instead through its head noun *vojske* and the interpolated-adjective slot in step 6b.
 */
function slotFromEnding(word: string): Slot {
    if (word.endsWith("ega")) return "m.gen";
    if (word.endsWith("ih")) return "pl.gen";
    return "m.nom";
}

// ---------------------------------------------------------------------------------------------------
// ABBREVIATIONS
// ---------------------------------------------------------------------------------------------------

/**
 * Re-attach a sentence period that an abbreviation's dot was doing double duty for. Two cases count as a
 * sentence end: the utterance simply ends (`…okoli leta 10.000 pr. n. š.`, `…in trajal vse do 1100 n. š.`,
 * and `(1000–1300 n. š.)` where a closing bracket ends it), or the utterance RUNS ON into a new sentence
 * with a capital (none in this corpus, but `356 pred n.l. Išlo …` is why Slovak needed it). A following
 * lowercase word (`323 pr. n. š. obnovili`) or an explicit mark (`5000 pr. n. št.!`) is NOT a sentence end
 * — the mark already carries the pause, and appending a period there would give two marks where the
 * sentence has one.
 */
function keepFinal(expansion: string, matched: string, rest: readonly unknown[]): string {
    const whole = rest[rest.length - 1];
    const offset = rest[rest.length - 2];
    if (typeof whole !== "string" || typeof offset !== "number") return expansion;
    const after = whole.slice(offset + matched.length);
    if (/^[\s»)”"'\]]*$/u.test(after)) return `${expansion}.`;
    return /^\s+\p{Lu}/u.test(after) ? `${expansion}.` : expansion;
}

/**
 * MULTI-DOT abbreviations — the ERA MARKERS, ×10. Claimed FIRST (playbook coupling) or their interior dots
 * survive as phrase breaks and the letters as a bogus word ([pər . n . ʃ .]). `pr. n. š.` is matched before
 * the bare `n. š.` so the *pr-* is read into the instrumental. The final dot is optional (`pr. n. št.!`
 * writes the exclamation instead) and restored by `keepFinal` where it was the sentence period.
 *
 * `štetje` ("counting", hence "era") is the one word in this file with no in-repo attestation. It is kept
 * because the expansion of an abbreviation is an ORTHOGRAPHIC fact rather than a lexical guess: `n. š.`
 * stands for *našega štetja* and `pr. n. š.` for *pred našim štetjem* per Slovenski pravopis, the same
 * footing on which Slovak sourced `tzv. = takzvaný`. `pred`, `našega` and the lemma *naš* are all in the
 * corpus.
 */
const MULTI_DOT: ReadonlyArray<readonly [RegExp, string]> = [
    [/(?<![\p{L}\p{M}])pr\.\s?n\.\s?(?:št|š)\.?(?![\p{L}\p{M}])/giu, "pred našim štetjem"],
    [/(?<![\p{L}\p{M}])n\.\s?(?:št|š)\.?(?![\p{L}\p{M}])/giu, "našega štetja"],
];

/** SINGLE-DOT abbreviations → their expansion, sourced word by word: `itd.` = *in tako dalje* (in ×986,
 *  tako ×107, dalje ×1 in the corpus), `npr.` = *na primer* (na ×687, primer ×29), `oz.` = *oziroma* (×21),
 *  `idr.` = *in drugo* (drugo ×9), `št.` = *številka* (×2), `ml.` = *mlajši* (×2). */
const DOTTED: Readonly<Record<string, string>> = {
    itd: "in tako dalje", npr: "na primer", oz: "oziroma", idr: "in drugo", št: "številka",
    ml: "mlajši",
};
const DOTTED_ALT = Object.keys(DOTTED).sort((a, b) => b.length - a.length).join("|");

/**
 * HONORIFICS — expanded ONLY before a capitalised word, and that guard is not cosmetic. `ga.` is a
 * homograph of *ga*, the Slovene accusative pronoun "him/it", which ends 23 of the corpus's 24 sentences
 * containing that string; expanding it unconditionally would have turned every one of them into *gospa*.
 * All five real instances (`Ga. Kirchner`, `G. Costello`, `G. Reidu`, `g. Reida` ×2, `g. Rudda`) and all
 * five of `Dr.`/`dr.` are followed by a capitalised name, so the guard costs nothing and the count decides
 * it (trap 2 (loose patterns over-count) — print the matches before writing the rule from a count).
 * `gospod` and `gospa` are both in the wikipron slv referee; `doktor` is in the corpus.
 */
const HONORIFIC: Readonly<Record<string, string>> = { dr: "doktor", g: "gospod", ga: "gospa" };

// ---------------------------------------------------------------------------------------------------
// FRACTIONS
// ---------------------------------------------------------------------------------------------------

/** Fraction denominator nouns 2–10 — feminine -ina derivatives of the cardinal stem, in the same five
 *  count slots as every other counted noun here. *polovica*, *četrtina* and *tretjine* are corpus-attested;
 *  the rest are the regular paradigm of the same suffix. Denominators above 10 are left untouched rather
 *  than derived. */
const DENOMINATOR: Readonly<Record<number, readonly string[]>> = {
    2: ["polovica", "polovici", "polovice", "polovic", "polovice"],
    3: ["tretjina", "tretjini", "tretjine", "tretjin", "tretjine"],
    4: ["četrtina", "četrtini", "četrtine", "četrtin", "četrtine"],
    5: ["petina", "petini", "petine", "petin", "petine"],
    6: ["šestina", "šestini", "šestine", "šestin", "šestine"],
    7: ["sedmina", "sedmini", "sedmine", "sedmin", "sedmine"],
    8: ["osmina", "osmini", "osmine", "osmin", "osmine"],
    9: ["devetina", "devetini", "devetine", "devetin", "devetine"],
    10: ["desetina", "desetini", "desetine", "desetin", "desetine"],
};

/** A numeral agreeing with a FEMININE head — the fraction denominators and *ura* are all feminine, and
 *  Slovene marks gender on 2/3/4 only (dva/dve, trije/tri, štirje/štiri). The manifest already carries
 *  both genders' forms; a compound (22, 34 …) is invariant and falls through. */
function feminineNumeral(n: number): string {
    return N.countForms.f[String(n)] ?? numberToWords(n);
}

// ---------------------------------------------------------------------------------------------------
// THE CLOCK
// ---------------------------------------------------------------------------------------------------

/** *ura* in the case each slot needs, so the noun and the ordinal agree. */
const URA: Readonly<Partial<Record<Slot, string>>> = {
    "f.nom": "ura", "f.gen": "ure", "f.dat": "uri", "f.acc": "uro",
};

/**
 * One clock → words: the hour as the ORDINAL that agrees with *ura*, the noun itself, and the minutes as a
 * bare cardinal. That shape is what the corpus writes when it writes a time out — `Malo po 11. uri`,
 * `ob približno 12. uri po GMT`, `Med 22. in 23. uro po MDT`, and once fully spelled, **`okoli desete ure
 * po lokalnem času`** — so neither the construction nor the case is being guessed at.
 *
 * The CASE comes from the GOVERNING PREPOSITION, which 15 of the corpus's 16 clocks carry: *ob* and *po* take
 * the locative (-i, syncretic with the dative), *okoli*, *od* and *do* the genitive (-e), *med* and *pred* the
 * instrumental (-o, syncretic with the accusative). With no preposition the nominative is emitted, which is
 * the citation form and the corpus's one such instance (`(15.00 po UTC)`).
 *
 * Hour 0 falls back to the plain cardinal pair: *nulta ura* is not idiomatic Slovene.
 */
function clock(hv: number, mv: number, slot: Slot): string {
    const noun = URA[slot];
    const ord = hv === 0 ? undefined : ordinalWords(hv, slot);
    if (ord === undefined || noun === undefined)
        return mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} ${numberToWords(mv)}`;
    return mv === 0 ? `${ord} ${noun}` : `${ord} ${noun} ${numberToWords(mv)}`;
}

/** HH:MM or HH.MM with the corpus's guards: hours ≤ 23 and minutes ≤ 59, which is what keeps the rule off
 *  the volleyball score `zmagala 26:00 proti` and off the ratio `je torej 3:2` (a one-digit second field).
 *  The trailing guard rejects a further digit or colon and a `.dd`/`,dd` third field (a sports time or a
 *  decimal) — but NOT a bare period, which is the SENTENCE end: writing it as `(?![\d:.])` would silently
 *  refuse every clock at the end of an utterance (`pa od 6.30 do 7.30.`), i.e. some of the instances the
 *  rule exists for. */
const CLOCK_BODY = "([01]?\\d|2[0-3])[:.]([0-5]\\d)";
const CLOCK_TAIL = "(?![\\d:])(?!\\.\\d)(?!,\\d)";
/** The preposition that governs the clock's case, allowing ONE intervening adverb — the corpus writes
 *  `Ob natanko 8.46` and `ob približno 12. uri`. */
const CLOCK_GOV =
    /(?<![\p{L}\p{M}])(ob|po|okoli|okrog|od|do|med|pred)\s+(?:[\p{Ll}\p{M}]+\s+)?$/iu;
const GOV_SLOT: Readonly<Record<string, Slot>> = {
    ob: "f.dat", po: "f.dat", okoli: "f.gen", okrog: "f.gen", od: "f.gen", do: "f.gen",
    med: "f.acc", pred: "f.acc",
};

// ---------------------------------------------------------------------------------------------------
// THE RULES
// ---------------------------------------------------------------------------------------------------

/**
 * Normalize one Slovenian input string. Pure text→text, a numbered sequence of order-dependent steps; each
 * ordering coupling is stated at its own step. The shared symbol tier runs at step 14, in the middle,
 * because it must see the number still ADJACENT to its unit and still carrying its decimal comma.
 */
export function normalizeSlovenian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST (playbook coupling: a grouping separator is otherwise read as clause
    //    punctuation, and here it also SPLIT the number in two — `400.000` read [ʃtiristɔ . nit͡ʃ]).
    //    Slovene groups thousands with a PERIOD (28 corpus instances) and marks the decimal with a COMMA
    //    (17), which is the Croatian convention and the opposite of Slovak's. EXACTLY three digits and no
    //    space, which is what keeps this rule off the clock (`23.35`, two digits), off `802.11` and off
    //    every `N.` ordinal. Two passes, because groups overlap on the shared digit (`5.000.000`).
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");
    //    …and the SPACE-grouped form, which the corpus does not use (0 instances of `\d[ ]\d{3}`) but which
    //    Slovene orthography also permits, and which read as two separate numbers: `5 000` → *pet nič*.
    //    Reported by the review tool's ordinary-text probe, not by the corpus — trap 8 (zero corpus instances is not evidence of…), zero corpus
    //    instances is not evidence of correctness. Exactly three digits, so `100 in 200 m` cannot fuse.
    //    NBSP is folded to a plain space AFTERWARDS, never before: this corpus uses it 22 times and always
    //    as an ORDINARY inter-word space (`Umrl je v torek`), never as a separator.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)[  ](\d{3})(?!\d)/gu, "$1$2");
    s = s.replace(/[  ]/gu, " ");

    // 1) MULTI-DOT ERA MARKERS, before the single-dot rule (playbook coupling) — otherwise the interior
    //    dots survive as breaks. Each expansion CONSUMES the final dot, so keepFinal puts back the sentence
    //    period where that dot was doing double duty.
    for (const [re, w] of MULTI_DOT)
        s = s.replace(re, (m0: string, ...rest: unknown[]) => keepFinal(w, m0, rest));

    // 2) SINGLE-DOT ABBREVIATIONS. The dot is consumed so it cannot become a phrase break. Three shapes in
    //    this order: followed by a word (`npr. vizo`, `št. 11`), at the very end of the utterance (or
    //    before closing brackets that end it — `restavracije itd.`), where the sentence period is put back,
    //    and anything else (`idr., ki se` — a following comma already carries the pause, so appending a
    //    period there would give `in drugo.,`).
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(\\s+)(?=[\\p{L}\\d(„"»])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(?=\\s*(?:[»)”\\]]\\s*)*$)`, "giu"),
        (_m, ab: string) => `${DOTTED[ab.toLowerCase()]!}.`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}.])(${DOTTED_ALT})\\.(?![\\p{L}\\p{M}])`, "giu"),
        (_m, ab: string) => DOTTED[ab.toLowerCase()]!);
    //    HONORIFICS, gated on a following CAPITAL — see the HONORIFIC comment: `ga.` is the pronoun *ga*
    //    in 23 of its 24 corpus sentences, and only the capital tells them apart.
    s = s.replace(/(?<![\p{L}\p{M}.])(dr|ga|g)\.(\s+)(?=\p{Lu})/giu,
        (_m, ab: string, sp: string) => `${HONORIFIC[ab.toLowerCase()]!}${sp}`);
    //    DOT-ONLY abbreviations — the dot is a separate defect from the word, and removing it needs no
    //    vocabulary at all. `St. Louis` ×1 (a break inside `Six Flags St. Louis`), `HK Management Inc.
    //    sprva` ×1 (mid-sentence), `(James et al., 1995)` ×1. There is no source for any of the three
    //    words: the corpus's only `Saint` is the composer Saint-Saëns, and `Inc.`/`al.` are not Slovene.
    //    Claimed BY NAME (trap 4 (ambiguity is resolved by evidence)) and only where the dot cannot be a sentence period.
    s = s.replace(/(?<![\p{L}\p{M}.])(St)\.(?=\s+\p{Lu})/gu, "$1");
    s = s.replace(/(?<![\p{L}\p{M}.])(Inc)\.(?=\s+\p{Ll})/gu, "$1");
    s = s.replace(/(?<=(?:et|Et)\s)(al)\.(?![\p{L}\p{M}])/gu, "$1");

    // 3) CLOCK. Before the version-dot rule, which would otherwise eat the interior dot of the PERIOD form
    //    (`ob 12.00 po GMT`, 13 of the corpus's 16 clocks), and before any rule that looks for a bare
    //    number (playbook coupling). Both `.` and `:` are clause punctuation in slovenian.jsonc, so every
    //    clock in the corpus was split by a phrase break. A trailing `ure`/`uri`/`uro`/`ura` is CONSUMED
    //    (`okoli 9.30 ure`, ×1): the hour noun is already in the reading and saying it twice is trap 12 (a REDUNDANT symbol is a permissible drop).
    s = s.replace(
        new RegExp(`(?<![\\d.,])${CLOCK_BODY}${CLOCK_TAIL}(?:\\s+(?:ure|uri|uro|ura)(?![\\p{L}\\p{M}]))?`, "gu"),
        (_m: string, h: string, min: string, offset: number, whole: string) => {
            const gov = CLOCK_GOV.exec(whole.slice(0, offset))?.[1]?.toLowerCase();
            return clock(Number(h), Number(min), (gov && GOV_SLOT[gov]) || "f.nom");
        });

    //    …and the FOUR-DIGIT MILITARY TIME licensed by a zone label — `(0230 UTC)`, ×1. This was first
    //    reported as a core seam, on the grounds that the tokenizer's `\d+` → `Number()` path loses the
    //    leading zero (`Number("0230")` is 230, so it read *dvesto trideset*, "two hundred thirty"). That is
    //    true of the tokenizer and beside the point: the layer never has to let the digits reach it. This is
    //    the same shape Oromo and Luxembourgish both claim in their own layers (`12.00 GMT`, `15.00 UTC`),
    //    and the machinery is already here — `clock()` and the governing-preposition slot. Trap 17: the
    //    deferral was a framing, not a count.
    //    The ZONE LABEL is the whole licence. A bare 4-digit run is a year far more often than a time, and
    //    this corpus writes 116 of them; requiring UTC/GMT/CET/CEST after is what separates the one instance
    //    from all of those. Hours ≤ 23 and minutes ≤ 59, as in CLOCK_BODY.
    s = s.replace(
        new RegExp(`(?<![\\d.,:])([01]\\d|2[0-3])([0-5]\\d)(?![\\d.,:])(?=\\s*\\)?\\s*(?:po\\s+)?(?:UTC|GMT|CET|CEST)(?![\\p{L}\\p{M}]))`, "gu"),
        (_m: string, h: string, min: string, offset: number, whole: string) => {
            const gov = CLOCK_GOV.exec(whole.slice(0, offset))?.[1]?.toLowerCase();
            return clock(Number(h), Number(min), (gov && GOV_SLOT[gov]) || "f.nom");
        });

    // 4) VERSION / FIGURE DOTS between digits — `802.11a`, `802.11b`, `802.11g`, `802.11n` ×3 and
    //    `Sliko 1.1.` ×1 all broke the sentence at the interior dot. AFTER the clock (which owns `12.00`)
    //    and BEFORE the ordinal rules, so those never see a digit-dot-digit.
    s = s.replace(/(\d)\.(?=\d)/gu, "$1 pika ");

    // 5a) SCORES AND RATIOS, before the range rule — the discriminator is DIRECTION, and it is what the
    //     corpus's own written-out forms give: `zmaga za eno točko, 21 proti 20` and `razmerje ena proti
    //     štirideset` both spell the joiner as *proti*, ×39 in the corpus overall. A pair that does not
    //     ASCEND is not a range (a range runs upward; a score does not), and all five non-clock colon pairs
    //     are scores or ratios because the clock rule above has already taken every real time.
    //     Corpus: `zmagala 26:00 proti peti nosilki`, `s 5:3 proti Atlanta Thrashersom`, `razmerje … je
    //     torej 3:2`, `prislužil 2:2 (diplomo…)`, `po rezultatu 6-6`, `rekord v dvoboju proti Kanadčanu je
    //     7–2` — seven instances, every one of which read with a spurious phrase break (the colon is clause
    //     punctuation) or, for the dash pair, as the RANGE *sedem do dva*.
    //     BOTH ENDPOINTS MUST BE INTEGERS for the direction test to mean anything: the corpus's `izpred
    //     4,2–3,9 milijona let` is a genuine descending range ("4.2 to 3.9 million years AGO"), so a bare
    //     "does not ascend" test would have refused it. Measured: 2 of 2 dashed scores refused, 10 of 10
    //     dashed ranges still claimed.
    //     THE JOINER IS SUPPRESSED WHEN THE TEXT ALREADY WRITES IT (trap 12 (a REDUNDANT symbol is a permissible drop)) — `26:00 proti peti nosilki`
    //     states it once, so the mark is simply dropped and the reading is *šestindvajset nič proti peti*.
    //     BOTH FIELDS ARE AT MOST TWO DIGITS AND THE MARK CARRIES NO SPACE, and both bounds were forced by
    //     misfires the corpus diff caught after the first version of this rule (trap 9 (a guard alternative with no attested…) — widening a guard is
    //     the same discipline as writing one): `(Larson in LaFasto, 1989: 109)` is a PAGE CITATION, which
    //     the first version read as *tisoč devetsto devetinosemdeset proti sto devet*, and `od leta 1995–96`
    //     is a SEASON, read as *… petindevetdeset proti šestindevetdeset*. A score field is never three
    //     digits and a score's mark is never spaced, so both shapes are excluded by construction.
    //     `prislužil 2:2 (diplomo nižje druge stopnje)` is the one instance this cannot tell from a score —
    //     it is a British degree classification — and *dva proti dva* is no worse than the phrase break it
    //     replaces.
    //     The trailing guard rejects a further digit, a colon and a `.dd`/`,dd` decimal — but NOT a bare
    //     period, which is the SENTENCE end: `(?![\d.,:])` silently refused `je torej 3:2.` and
    //     `rekord … je 7–2.`, i.e. two of the seven instances the rule exists for. Same trap as the clock.
    const ascends = (a: string, b: string): boolean => Number(b) > Number(a);
    s = s.replace(/(?<![\d.,:–—-])(\d{1,2})([:–—-])(\d{1,2})(?![\d:])(?!\.\d)(?!,\d)/gu,
        (m0, a: string, mark: string, b: string, offset: number, whole: string) => {
            if (mark !== ":" && ascends(a, b)) return m0; // a real range — step 5 owns it
            const said = /^\s*proti(?![\p{L}\p{M}])/u.test(whole.slice(offset + m0.length));
            return said ? `${a} ${b}` : `${a} proti ${b}`;
        });

    // 5) NUMERIC RANGES ×11. The dash was DROPPED, fusing the endpoints into one uninterrupted run of
    //    words (`1418–1450` → eight words with no break). Read as "do" (×134 in the corpus). Digits are
    //    required on BOTH sides so that `COVID-19`, `Il-76s`, `21-letni` and `8-krat` are untouched, and
    //    the class is anchored to END in a digit so a trailing clause comma cannot be eaten (trap 14 (agreement cannot be applied to digits)'s
    //    second hazard). BEFORE the ordinal rules so a dashed pair is never mistaken for a licensed
    //    ordinal, BEFORE the minus rule (which would otherwise claim the spaced dash of `160 – 320`), and
    //    before the tier so `2–3 km` keeps its unit adjacency on the second operand.
    //    NON-ASCENDING SHORT PAIRS ARE ALREADY GONE, claimed as scores by step 5a (`6-6`, `7–2`).
    //    A SEASON IS NOT A RANGE either: `od leta 1995–96` abbreviates the second year to two digits and
    //    Slovene reads it as the bare pair (*petindevetdeset šestindevetdeset*), not *do*. One corpus
    //    instance, refused explicitly rather than by accident — the rule survived it at first only because
    //    that instance happens to be followed by a comma, which the trailing guard rejected.
    //    10 of the corpus's 13 dashed pairs are true ranges and are claimed here; the other three are the
    //    two scores above and this season.
    s = s.replace(/(?<![\d.,])(\d+(?:,\d+)*)\s?[–—-]\s?(\d+(?:,\d+)*)(?![\d.,])/gu,
        (m0, a: string, b: string) => (a.length === 4 && b.length <= 2 ? m0 : `${a} do ${b}`));

    // 6a) REGNAL ORDINALS ×3 — the one context where the word BEFORE the numeral discloses the agreement
    //     instead of the word after it. Slovenian has no `ROMAN_NATIVE` entry, so `core/roman.ts` has
    //     already rewritten `Elizabeta II` to `Elizabeta 2` and `Lealofija III.` to `Lealofija 3.` before
    //     this engine runs, and the cardinal *dva* or *tri* is the wrong register for a monarch.
    //     Gender and case come from the TITLE, not from the name: the corpus's `kraljica Elizabeta 2`
    //     wants the feminine nominative, `kraljice Elizabete 2` the feminine genitive, and
    //     `poglavarja Tupue Tamaseseja Lealofija 3.` the masculine genitive. Keying on the NAME's ending
    //     was tried and rejected — Slovene *Elizabeta* (f.nom) and *Lealofija* (m.gen) both end in -a, and
    //     every feminine name in -ija (Marija, Sofija, Lucija) would have been read as a masculine
    //     genitive. The title list is closed and the intervening words must all be capitalised, so the
    //     shape matches 3 times in 1,903 utterances and cannot match anything else (trap 9 (a guard alternative with no attested…)).
    s = s.replace(
        /(?<![\p{L}\p{M}])(kralj[\p{L}\p{M}]*|cesar[\p{L}\p{M}]*|papež[\p{L}\p{M}]*|poglavar[\p{L}\p{M}]*)(\s+(?:\p{Lu}[\p{L}\p{M}]*\s+){1,3})(\d{1,2})(\.?)(?![\p{L}\p{M}\d,])/giu,
        (m0, title: string, names: string, digits: string, dot: string, ...rest: unknown[]) => {
            const t = title.toLowerCase();
            const slot: Slot = t.endsWith("ica") ? "f.nom"
                : t.endsWith("ice") ? "f.gen"
                    : t.endsWith("ico") ? "f.acc"
                        : t.endsWith("ici") ? "f.dat"
                            : t.endsWith("a") ? "m.gen"
                                : t.endsWith("u") ? "m.loc" : "m.nom";
            //     The title and the names are CONSUMED by the match and must be put back (trap 10 (a rule that CONSUMES a word must put it back)) — and
            //     so is the PERIOD, which here is doing double duty as the ordinal marker AND the sentence
            //     end. `…poglavarja Tupue Tamaseseja Lealofija III.` is the corpus's one instance and it is
            //     utterance-final; consuming its dot silently cost one sentence pause, which the corpus
            //     diff caught and no unit probe could. keepFinal restores it exactly where it was a
            //     sentence end.
            const ord = ordinalWords(Number(digits), slot);
            if (ord === undefined) return m0;
            const body = `${title}${names}${ord}`;
            return dot === "" ? body : keepFinal(body, m0, rest);
        });

    // 6b) LICENSED ORDINALS — the corpus's `N.` inflected by the noun that follows, which is where 90 of
    //     the 95 claimable instances are. The LIST prefix handles `v 11., 12. in 13. stoletju` (all three
    //     locative), `1. in 2. svetovni vojni`, `Med 22. in 23. uro` and `1. in 3. newhampshirski polk`:
    //     every item in a list takes the HEAD noun's case, which is what Slovene agreement requires and
    //     what a per-item rule could not produce. The optional interpolated lowercase word handles
    //     `10. italijanske vojske` — an adjective between the ordinal and its head — and is re-emitted
    //     verbatim (trap 10 (a rule that CONSUMES a word must put it back)).
    s = s.replace(
        new RegExp(
            `(?<![\\p{L}\\p{M}\\d.,])((?:\\d{1,4}\\.,?\\s+(?:in\\s+)?)*)`
            + `(\\d{1,4})\\.\\s+((?:[\\p{Ll}\\p{M}]+\\s+)?)(${LICENSOR_ALT})(?![\\p{L}\\p{M}])`,
            "gu",
        ),
        (m0: string, list: string, digits: string, mid: string, head: string) => {
            const slot = LICENSOR[head]!;
            const tail = ordinalWords(Number(digits), slot);
            if (tail === undefined) return m0;
            //     The item's own COMMA is re-emitted: `v 11., 12. in 13. stoletju` is spoken with that
            //     pause, and swallowing it together with the ordinal period lost it.
            const pre = list.replace(/(\d{1,4})\.(,?)/gu,
                (w, n: string, comma: string) => `${ordinalWords(Number(n), slot) ?? w}${comma}`);
            return `${pre}${tail} ${mid}${head}`;
        },
    );

    // 6c) GENERAL ORDINAL — the discriminator from the Run 2 tabulation, and the whole reason this file
    //     does not carry Croatian's year rule: a `N.` followed by a LOWERCASE word or a COMMA is an
    //     ordinal; one followed by an UPPERCASE word, a closing quote, or the END OF THE UTTERANCE is a
    //     SENTENCE PERIOD and must not be claimed. That leaves all 26 utterance-final periods and both
    //     uppercase-followed ones intact — the invariant this rule is measured by — and claims the 5
    //     lowercase followers step 6b's closed list does not know (`60. v sezoni`, `1. dne v mesecu`).
    //     The case comes from the follower's ENDING where that is unambiguous, else the masculine
    //     nominative; see slotFromEnding for why `-e`/`-em`/`-a`/`-u` are deliberately excluded.
    s = s.replace(/(?<![\p{L}\p{M}\d.,])(\d{1,4})\.(?=\s*[,]|\s+[\p{Ll}\p{M}])/gu,
        (m0, digits: string, offset: number, whole: string) => {
            const word = /^\s+([\p{Ll}\p{M}]+)/u.exec(whole.slice(offset + m0.length))?.[1];
            return ordinalWords(Number(digits), word === undefined ? "m.nom" : slotFromEnding(word)) ?? m0;
        });

    // 7) NUMERAL + HYPHEN + `-ih` ×2 (`v 1830-ih`, `ob 5-ih (ET)`), where the suffix reached the sink as
    //    its own junk token [ix]. Both are the same morphology and neither is an ordinal: `-ih` is added
    //    to the numeral's LAST WORD — the decade is the ordinal's genitive plural (*tisoč osemsto
    //    tridesetih*) and the clock hour is the cardinal's locative plural (*ob petih*), and both are
    //    spelled stem + ih because the ordinal's stem IS the cardinal here (trideset → tridesetih).
    //    Guarded on the last word ending in a CONSONANT, so `ena`/`dva`/`tri`/`štiri` — whose -ih forms
    //    are irregular (*dveh*, not *dvaih*) and which the corpus never writes this way — are declined
    //    rather than guessed.
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d{1,4})\s?-\s?ih(?![\p{L}\p{M}])/gu, (m0, digits: string) => {
        const words = numberToWords(Number(digits));
        return /[aeiou]$/u.test(words) ? m0 : `${words}ih`;
    });

    // 8) HYPHEN BEFORE A UNIT ABBREVIATION ×2 (`od 35-mm negativa`, `360-km gorska veriga`) — the tier
    //    matches a unit only when a NUMBER is adjacent, and the hyphen broke that adjacency, so both units
    //    reached the sink as raw letters. Folded to a space. The unit must be followed by a non-letter, so
    //    `35-milimetrski` (a real compound adjective, ×1) is untouched.
    s = s.replace(/(\d)-(?=(?:km|mm|cm|kg|m)(?![\p{L}\p{M}]))/gu, "$1 ");

    // 9) DEGREES ×2, before the shared tier (the sign sits between the number and the scale letter) and
    //    before the `+` rule. `stopinj` is corpus-attested (`s temperaturami nad 90 stopinj`) and takes the
    //    four-way agreement. `Celzija`/`Fahrenheita` have no in-repo attestation and are kept for the same
    //    reason as `štetje`: they are what the abbreviation stands for, and merging the two scales into a
    //    bare *stopinj* would make `90 °F` and `90 °C` read identically — confidently wrong, which is the
    //    one outcome that cannot be right.
    s = s.replace(/(\d+(?:,\d+)?)\s?°\s?C(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), STOPINJA())} Celzija`);
    s = s.replace(/(\d+(?:,\d+)?)\s?°\s?F(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), STOPINJA())} Fahrenheita`);
    s = s.replace(/(\d+(?:,\d+)?)\s?°/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), STOPINJA())}`);

    // 10) `x`/`×` between digits → *krat* ×2 (`36 x 24 mm`, `avtomobila 4 x 4`), where the ASCII letter was
    //     read as [ks]. The corpus writes the word itself in the very sentence the sign appears in
    //     (`meri 29 3/4 palca krat 24 1/2 palca`). Both the sign and the letter, because the corpus writes
    //     only the letter.
    s = s.replace(/(?<=\d)\s?[x×]\s?(?=\d)/gu, " krat ");

    // 11) A LEADING `+`/`−` on a number. The corpus's one instance is `presežejo +30 °C`; the minus is its
    //     counterpart, and a dropped sign turns a negative into a positive — the one outcome that cannot be
    //     right. 
    s = s.replace(/±/gu, " plus minus ");
    s = s.replace(/(^|[\s(])\+\s?(?=\d)/gu, "$1plus ");
    s = s.replace(/(^|[\s(])[-−]\s?(?=\d)/gu, "$1minus ");
    //     …and a `+` glued to a TIMEZONE CODE, `(UTC+1)` ×1 — the corpus's only other sign, and the one the
    //     artifact scan reported as `DROP math-sign`. Gated on an upper-case letter before the sign, so it
    //     cannot claim a hyphenated compound; it runs before step 20 spells the code out, which is why the
    //     reading is *u te ce plus ena* and not a dropped offset.
    s = s.replace(/(?<=\p{Lu})\+(?=\d)/gu, " plus ");

    // 12) THE SPELLED-OUT MILE RATE ×2 (`pogosto 100–200 milj/uro`, `3000 milj/uro`). `milj` is already the
    //     Slovene genitive plural of *milja*, so only the `/uro` denominator needs reading, and the corpus
    //     spells the idiom out five times (`105 milj na uro`, `240 kilometrov na uro`). The tier's unit
    //     keys cannot match a spelled-out noun. NOT a general `/` reading: the corpus's other three slashes
    //     are `100 jardov/metrov` ×2 and `Džakarju/Bumthangu`, where the slash means "or" and *poševnica*
    //     would be worse than the silence.
    s = s.replace(/(?<![\p{L}\p{M}])milj\s?\/\s?(?:uro|h)(?![\p{L}\p{M}])/giu, "milj na uro");

    // 13) PERCENT AND UNITS WHOSE NUMERAL NEEDS A GENDER — nothing here; see step 15. The digits are left
    //     as digits through step 14 precisely so the tier can still see the number–unit adjacency.

    // 14) THE SHARED SYMBOL TIER — %, currency, units, rates, exponents. It must see the number still
    //     ADJACENT to its unit and still carrying its decimal comma (`2,4 GHz` → *dva vejica štiri
    //     gigaherca*, the genitive singular a decimal governs), so it runs here: after every rule that
    //     moves digits around, and before step 16 folds the comma into a word.
    s = SYMBOLS(s);

    // 15) THE COUNT NUMERAL'S GENDER (trap 14 (agreement cannot be applied to digits)) — the one repair that can only be done AFTER the tier,
    //     because the noun it agrees with does not exist until the tier has emitted it. A digit becomes
    //     words in the TOKENIZER, downstream of everything here, and the tokenizer reads a bare `1` as
    //     *ena* and a bare `3`/`4` as *tri* and *štiri* — the FEMININE forms — so a masculine counted noun
    //     came out as *ena odstotek* and *tri kilometri*. Slovene marks gender on 1/2/3/4 only, so exactly
    //     four cells need fixing and they are keyed on the noun forms the tier itself declared:
    //       masculine  1 → en (corpus: `zaposlen samo en odstotek`), 3 → trije, 4 → štirje
    //       feminine   2 → dve   (2/3/4 masculine and 3/4 feminine already match the tokenizer's forms)
    //     Corpus instances: `2–3 km ledu` → *tri kilometre* → **trije kilometre**… no: *trije kilometri*,
    //     and `obsega 3 % države` → **trije odstotki**. Two instances, plus every adversarial neighbour
    //     the corpus does not happen to write (trap 8 (zero corpus instances is not evidence of…)).
    for (const c of Object.values(COUNTED)) {
        const [sg, dual, paucal] = c.forms;
        if (c.g === "m") {
            s = s.replace(new RegExp(`(?<![\\d.,])1 (?=${esc(sg!)}(?![\\p{L}\\p{M}]))`, "gu"), "en ");
            //     …but NOT the SECOND OPERAND OF A RANGE. `prekriva 2–3 km ledu` became `2 do 3 km` at
            //     step 5, and the count phrase there is headed by the whole range, which the verb puts in
            //     the accusative (*prekriva dva do tri kilometre*) — so the nominative *trije* is the one
            //     form that is certainly wrong. 1 corpus instance; the case-neutral *tri* is left alone.
            s = s.replace(new RegExp(`(?<![\\d.,])(?<!do )3 (?=${esc(paucal!)}(?![\\p{L}\\p{M}]))`, "gu"), "trije ");
            s = s.replace(new RegExp(`(?<![\\d.,])(?<!do )4 (?=${esc(paucal!)}(?![\\p{L}\\p{M}]))`, "gu"), "štirje ");
        } else {
            s = s.replace(new RegExp(`(?<![\\d.,])2 (?=${esc(dual!)}(?![\\p{L}\\p{M}]))`, "gu"), "dve ");
        }
    }

    // 16) DECIMAL COMMA
    s = s.replace(/(?<=\d),(?=\d)/gu, ` ${N.decimalWord} `);

    // 17) FRACTIONS ×3, all of them MIXED numbers or a bare ratio: `meri 29 3/4 palca krat 24 1/2 palca`
    //     and `5 mm (1/5 palca)`. The rule COMPOSES from the denominator noun and a FEMININE numerator
    //     (the -ina nouns are all feminine) rather than tabulating the numerators that happen to be
    //     attested, which is the defect Uzbek shipped (trap 8 (zero corpus instances is not evidence of…)): 1/5 = *ena petina*, 3/4 = *tri četrtine*,
    //     2/3 = *dve tretjini*. The mixed form is claimed first, because `29 3/4` is one quantity and the
    //     bare-ratio rule would otherwise leave the integer stranded. Denominators above 10 are left
    //     untouched. `1995/96` (a season) cannot reach either rule — a 4-digit numerator is excluded.
    const frac = (a: string, b: string, whole: string): string => {
        const forms = DENOMINATOR[Number(b)];
        if (forms === undefined) return whole;
        //     A HALF is *pol*, not *ena polovica*: the noun exists (polovica ×1 in the corpus) but Slovene
        //     says *pol* in a measurement, and the corpus writes it that way twice — `žrtvovati pol ure`,
        //     `teka na pol milje`. Only the numerator 1 takes it; 3/2 would be *tri polovice*.
        if (Number(a) === 1 && Number(b) === 2) return "pol";
        return `${feminineNumeral(Number(a))} ${counted(Number(a), forms)}`;
    };
    s = s.replace(/(?<![\d.,\/])(\d+)\s+(\d{1,3})\/(\d{1,2})(?![\d.,\/])/gu,
        (m0, int: string, a: string, b: string) => {
            const f = frac(a, b, "");
            return f === "" ? m0 : `${int} in ${f}`;
        });
    s = s.replace(/(?<![\d.,\/])(\d{1,3})\/(\d{1,2})(?![\d.,\/])/gu,
        (m0, a: string, b: string) => frac(a, b, m0));
    //     The precomposed vulgar fractions. Zero corpus instances in sl_si — Croatian's translation of the
    //     same FLEURS sentence writes `29¾ sa 24½ inča` where Slovenian writes `29 3/4` — so this is the
    //     adversarial neighbour, kept because the characters would otherwise be dropped silently.
    s = s.replace(/(\d+)¾/gu, "$1 in tri četrtine");
    s = s.replace(/(\d+)½/gu, "$1 in pol");
    s = s.replace(/(\d+)¼/gu, "$1 in ena četrtina");

    // 18) RELATIONAL SIGNS and the AMPERSAND.
    s = s.replace(/\s*=\s*/gu, " enako ");
    s = s.replace(/(\d)\s*<\s*(?=\d)/gu, "$1 je manjše od ");
    s = s.replace(/(\d)\s*>\s*(?=\d)/gu, "$1 je večje od ");
    //     `&` → *in*. THE FLANKING LETTERS ARE SPELLED when both are lone capitals, which is what
    //     `B&B` is: joining them alone still left `B in B`, read [p in p] — two bare devoiced stops, not
    //     the letter *be*. Step 20 cannot rescue them, because its all-caps run requires two ADJACENT
    //     capitals. Gating it on the ampersand is what keeps it safe: a general "lone capital → letter
    //     name" rule is impossible in Slovene, where `V`, `A`, `S`, `Z`, `K`, `O`, `I` are all real words
    //     (`V 16. stoletju` opens with one, and `V` alone accounts for 118 of the 132 all-caps matches a
    //     naive Roman-numeral grep finds).
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})\s*[&＆]\s*(\p{Lu})(?![\p{L}\p{M}])/gu,
        (m0, a: string, b: string) => {
            const [x, y] = [LETTER_NAME[a.toLowerCase()], LETTER_NAME[b.toLowerCase()]];
            return x === undefined || y === undefined ? m0 : `${x} in ${y}`;
        });
    // THE DIVISION SIGN (#654), and ⚠ IT WAS THE REGISTER RESTRICTION THAT HID IT — the third time in this issue,
    // after pl and ml. `deljeno z` and `delimo z` were both measured ×0 with
    // `attest.ts --context "matematika aritmetika deljenje"` and sl was recorded as unsourceable. Probing the
    // same word with NO restriction returns ×20 token / 10 articles for `deljeno` and ×6 / 4 for `deljeno z`,
    // with the sense in plain view and one hit on a numeric operand:
    //
    //   "Pozitivno deljeno z negativnim je negativno"   ·   "nič deljeno z nič je nič"
    //   "zatem korenjeno in nato povečano za 8 ter končno še deljeno z 10"        ← divided BY 10
    //
    // ⚠ THE PREPOSITION ALTERNATES z/s BY VOICING, which the same examples show directly — "deljeno z
    // negativnim" but "deljeno s pozitivnih". Slovene writes `s` before a voiceless obstruent and `z`
    // elsewhere, so the rule spells its operand and picks: s tri, s štiri, s pet, s šest, s sedem, s sto —
    // z ena, z dva, z osem, z devet, z deset, z dvajset. Emitting a fixed `z` would misvoice half the numerals,
    // which is a wrong word rather than an accent.
    const SL_VOICELESS = /^[ptksšcčfh]/u;
    s = s.replace(/(\d+)\s?÷\s?(\d+)/gu, (_m, a: string, b: string) => {
        const y = numberToWords(Number(b));
        return `${numberToWords(Number(a))} deljeno ${SL_VOICELESS.test(y) ? "s" : "z"} ${y}`;
    });

    s = s.replace(/\s*[&＆]\s*/gu, " in ");

    // 19) A LONE LETTER GLUED TO A DIGIT RUN → its LETTER NAME. Eight instances: the Wi-Fi standards
    //     `802.11a/b/g/n` (×6, whose letter step 4 leaves stranded on the digits), `Il-76s` (the aircraft
    //     plural) and `JAS 39C`. All eight reached the sink as a bare consonant. This is also the reason
    //     `g` is NOT declared as a gram in the tier: the corpus's only number-adjacent `g` is
    //     `802.11g`, so declaring it would have read the Wi-Fi standard's letter as *gram* — trap 15 (the same bound suffix is also written with…)'s
    //     third hazard, measured rather than assumed. Runs BEFORE the initialism pass, whose all-caps rule
    //     needs two letters and so cannot claim any of these.
    s = s.replace(/(?<=\d)(\p{L})(?![\p{L}\p{M}])/gu,
        (m0, l: string) => {
            const name = LETTER_NAME[l.toLowerCase()];
            return name === undefined ? m0 : ` ${name}`;
        });

    // 20) INITIALISMS, LAST — the seam's ordering constraint is that it must follow the Roman-numeral and
    //     regnal rules (step 6a) and the abbreviation expansions (steps 1–2), because an all-caps run is
    //     what a Roman numeral and an unexpanded abbreviation both look like. Running last satisfies both.
    s = normalizeSlovenianInitialisms(s);

    return s;
}

/** Integer part of a Slovene-written number ("2,4" → 2), for the local agreement calls. */
function intOf(n: string): number {
    return Math.trunc(Number(n.replace(",", ".")));
}

/** Escape a literal for embedding in a RegExp source. */
function esc(t: string): string {
    return t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
