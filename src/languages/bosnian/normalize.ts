/**
 * Bosnian (bs) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS LANGUAGE HAS TWO TREATED SIBLINGS AND BELONGS TO NEITHER OF THEM. `serbian/normalize.ts` (12 rules)
 * and `croatian/normalize.ts` (14 rules) are both this file's obvious template, and `bosnian.ts` already
 * borrows Serbian's `phonemizeWord` outright — which is exactly what makes copying either one dangerous
 * (playbook trap 55). Every rule of both files was re-measured against the 1,976 deduplicated utterances of
 * FLEURS `bs_ba` before anything was written here; **18 of 38 arms held, 47 %**. The table is in
 * `docs/investigations/bs_normalization_investigation.md`. What follows is what SURVIVED that measurement,
 * and the ⚠ notes are the places where it did not.
 *
 * ⚠ THE CLEANEST STATEMENT OF THE TRAP IS IN THE ORDINAL TABLE BELOW, BEFORE ANY RULE RUNS. Bosnian takes
 * Serbian's LEXEMES (hiljada, milion, the international month names, stepen) and Croatian's IJEKAVIAN
 * reflexes (prije, dvjesta, stoljeće). So:
 *
 *     Serbian  ORD_HUNDREDS[2] = "dvestoti"    ✗ ekavian
 *     Croatian ORD_HUNDREDS[2] = "dvjestoti"   ✓
 *     Serbian  ordinalBase(1000) = "hiljaditi" ✓
 *     Croatian ordinalBase(1000) = "tisućiti"  ✗ wrong lexeme
 *
 * Neither table is correct for Bosnian and the correct one is ONE CELL FROM EACH. No counter surfaces this;
 * it is visible only by reading both files side by side.
 *
 * ⚠ AN ORDINAL IS THE NUMERAL PLUS A PERIOD, which collides with the sentence break — the defect this file
 * mostly exists for. `2017. godine` read naively is a CARDINAL plus a spurious clause boundary, and the
 * shape is ×222 in this corpus, larger than every symbol class put together. Two rules claim it: a closed
 * LICENSOR list (step 9) and, for the 13 instances where the licensing *godine* is ELIDED, the bare-year
 * rule (step 10, ported from Croatian, which is the single most valuable import of the round).
 *
 * COUNT AGREEMENT follows RUSSIAN, not Polish: 2–4 → genitive singular (`83 metra`, corpus), 5+ → genitive
 * plural (`378 metara`, corpus), so the shared `slavicCountForm` is reused unchanged.
 *
 * ⚠ BOSNIAN IS DIGRAPHIC and `bosnian.ts`'s TOKEN claims BOTH scripts, so every rule keyed on a word accepts
 * both spellings via the Cyrillic→Latin fold below. The bs_ba corpus is Latin-only, so this arm is
 * SISTER-SOURCED from Serbian's own measurement of the same defect ("a rule that looks right matches
 * nothing"); it costs one lookup and its absence would make this file a no-op on Cyrillic prose.
 *
 * Deliberately absent, each with the count that decided it:
 *   · `=` `<` `>` `÷` `±` `×` — **×0 each** in the corpus. Registered in `ACCEPTED_SIGN_SILENCE` (defects.ts)
 *     rather than ported from Croatian, which declares all six. ASCII `x` between digits IS ×4 and IS read.
 *   · `n. e.` alone, `pr. Kr.`, `g. n. e.` — ×0. Only `p.n.e.` occurs (×2) and only it is claimed.
 *   · PRENOMINAL ROMAN ORDINALS (`I. svjetski rat`) — ×0; no `[IVXL]+\.` before a lowercase word at all.
 *   · The DOTTED CAPITAL RUN (`A. B.`) — ×0. The LONE initial (`George W. Bush`) is ×3 and is claimed.
 *   · ZERO-WIDTH characters — ×0 (Croatian's corpus had ×5).
 *   · A CUBED word — `³` is ×0, and the corpus's one cubic quantity is already spelled (`120-160 kubnih
 *     metara`), so a declared word would be a SECOND naming of what the writer already said.
 *   · Bare `SAD` (×5–6) — the instances are locative (`u SAD živi`), accusative (`pretekla je SAD`) and a
 *     bare apposition (`savezna država SAD`); one expansion cannot serve three cases. This is Serbian's own
 *     `Св.` refusal. Only `SAD-a`, whose written suffix NAMES the case, is claimed (step 4).
 *   · INITIALISMS and letter names — no `acronymLetters` data is declared, as in both siblings.
 *   · `tzv.` — Serbian declares it; ×0 here.
 *
 * ⚠ Every boundary in this file is an explicit lookaround, never `\b`. `\b` is ASCII-defined and finds none
 * against `č ć š ž đ` or against Cyrillic — the trap that made `core/initialisms.ts` a no-op for Russian.
 */
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

// ---------------------------------------------------------------------------------------------------
// SCRIPT
// ---------------------------------------------------------------------------------------------------

/** Bosnian Cyrillic → Gaj's Latin, a strict bijection (Vuk's two alphabets were designed as one). Lets a
 *  captured word or suffix in either script be read against a single Latin key set. */
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
/** Latin → Cyrillic, written as the inverse of the SINGLE-character entries only: the digraph values
 *  (lj/nj/dž) do not invert character-by-character, and none of them occurs in the keys this file builds
 *  alternations from. */
const LAT2CYR: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(CYR2LAT).filter(([, l]) => l.length === 1).map(([c, l]) => [l, c]),
);
function cyr(word: string): string {
    let out = "";
    for (const ch of word) out += LAT2CYR[ch] ?? ch;
    return out;
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Masculine-nominative ordinals — the citation form the paradigm below inflects. `treći` is the one SOFT
 *  stem (see ENDINGS). Identical in all three standards. */
const ORD_1_19: readonly string[] = [
    "", "prvi", "drugi", "treći", "četvrti", "peti", "šesti", "sedmi", "osmi", "deveti",
    "deseti", "jedanaesti", "dvanaesti", "trinaesti", "četrnaesti", "petnaesti", "šesnaesti",
    "sedamnaesti", "osamnaesti", "devetnaesti",
];
const ORD_TENS: readonly string[] = [
    "", "deseti", "dvadeseti", "trideseti", "četrdeseti", "pedeseti", "šezdeseti", "sedamdeseti",
    "osamdeseti", "devedeseti",
];
/** ⚠ THE ONE CELL THAT IS CROATIAN'S AND NOT SERBIAN'S — `dvjestoti`, built on the IJEKAVIAN hundreds
 *  cardinal `dvjesta` that `bosnian.jsonc` already declares. Serbian's table says `dvestoti` (ekavian). */
const ORD_HUNDREDS: readonly string[] = [
    "", "stoti", "dvjestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
    "osamstoti", "devetstoti",
];

/**
 * Integer → the masculine-nominative ordinal. Only the LAST element inflects, so a compound is its CARDINAL
 * head plus the ordinal of the final non-zero part — 2017 → *dvije hiljade* + sedamnaesti, 1500 → *hiljadu*
 * + petstoti. The head goes through the engine's own cardinal composer so it reads exactly as the bare
 * numeral would.
 *
 * ⚠ THE OTHER CELL THAT IS SERBIAN'S AND NOT CROATIAN'S — `hiljaditi`, not Croatian's `tisućiti`. Bosnian
 * keeps the hiljada/milion lexemes (see bosnian.jsonc).
 *
 * `undefined` for a round thousand other than 1000 (2000., 5000.): those need the FUSED *dvijehiljaditi*, a
 * different word-formation, not attempted here. Returning undefined leaves the text untouched rather than
 * emitting a guess — the corpus has `2000. godine` ×1 and `5000. godine` ×1, both left as cardinals.
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
    if (n === 1000) return "hiljaditi";
    const r = n % 1000;
    if (r === 0) return undefined; // dvijehiljaditi & co. — not attempted, see above
    return `${numberToWords(n - r)} ${ordinalBase(r)!}`;
}

/**
 * Definite-adjective endings for an ordinal, [HARD stem, SOFT stem]. `treći` is the only soft ordinal and it
 * differs exactly where the ending starts with a back vowel: trećEg / trećEm / trećE, not *trećog. Keys name
 * the slot a licensing word governs; the values replace the citation form's final `-i`.
 *
 * ⚠ `m.ins` IS THIS FILE'S OWN, AND IT IS A CORRECTION TO CROATIAN. Croatian maps its `najvećim` licensor to
 * `m.loc`, which yields *sedmom najvećim otokom*; the corpus sentence `što Japan čini 7. najvećim otokom na
 * svijetu` is INSTRUMENTAL and wants *sedmim*. One instance, and it is the an→ast lesson: a ported slot that
 * matches nothing wrong loudly is still wrong.
 */
const ENDINGS: Readonly<Record<string, readonly [string, string]>> = {
    "m.nom": ["i", "i"], "m.gen": ["og", "eg"], "m.loc": ["om", "em"], "m.ins": ["im", "im"],
    "n.nom": ["o", "e"], "n.gen": ["og", "eg"], "n.loc": ["om", "em"],
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
 * governs. Nothing outside this list is claimed, which is what keeps every sentence-final period intact.
 *
 * ⚠ THIS LIST IS NEITHER SIBLING'S, AND THE MEASUREMENT IS THE ARGUMENT. Over the 208 `N.`+lowercase
 * instances the followers tally as (top of 32 distinct):
 *
 *     godine 125 · stoljeća 11 · septembra 7 · jula 7 · vijeku 6 · avgusta 6 · vijeka 4 · januara 4
 *     marta 4 · stoljeću 3 · godini 3 · godinu 2 · novembra 2 · oktobra 2 · mjesto/dana/kategorije/
 *     godina/februara/juna/husarska/najvećim/gol/pukovniju/zemlja 1 each
 *
 *   · CROATIAN'S MONTHS LICENSE ZERO OF THE 39 MONTH INSTANCES. Its list is the Croatian-national set
 *     (srpnja, rujna, kolovoza, listopada, siječnja…) and NOT ONE of those words occurs anywhere in the
 *     Bosnian corpus. Bosnian writes the international set, which is Serbian's.
 *   · SERBIAN'S LIST LICENSES ZERO OF THE 14 `stoljeć-` INSTANCES. Serbian carries vek/vijek only. Bosnian
 *     uses BOTH century words, side by side in one sentence — `vrhunac između 10. i 11. stoljeća i 14.
 *     stoljeća` beside `iz 17. vijeka` — at ×14 against ×10. That near-parity is a fact about Bosnian.
 *   · CROATIAN'S NON-MONTH ADDITIONS RECUR VERBATIM (`190. mjesto`, `4. kategorije`, `7. najvećim`,
 *     `11. husarska pukovnija`) — because FLEURS is a PARALLEL corpus and hr_hr/bs_ba are translations of
 *     the same source sentences. A sibling tabulation over FLEURS transfers unusually well; one over a WIKI
 *     dump (Serbian's) does not. That asymmetry is the mechanism behind which sibling held.
 *   · `marka`/`marku`, which Croatian licenses, are ×0 here and are dropped rather than carried.
 *   · The 12 months are declared in full even though 9 occur: a month set is a closed paradigm and partial
 *     coverage of it would be arbitrary. Everything else in this list is a MEASURED follower.
 *   · `stoljeće` is `n.nom` — a NEUTER noun. ⚠ Croatian maps it to `m.nom`, which reads *deseti stoljeće*;
 *     the form is ×0 in this corpus so nothing is lost there, but the cell is not copyable.
 */
const LICENSOR: Readonly<Record<string, string>> = {
    godine: "f.gen", godini: "f.dat", godinu: "f.acc", godina: "f.nom",
    stoljeća: "n.gen", stoljeću: "n.loc", stoljeće: "n.nom",
    vijeka: "m.gen", vijeku: "m.loc", vijek: "m.nom",
    januara: "m.gen", februara: "m.gen", marta: "m.gen", aprila: "m.gen", maja: "m.gen",
    juna: "m.gen", jula: "m.gen", avgusta: "m.gen", septembra: "m.gen", oktobra: "m.gen",
    novembra: "m.gen", decembra: "m.gen",
    // Measured non-calendar followers: `190. mjesto`, `1. dana mjeseca`, `oluja 4. kategorije`,
    // `7. najvećim otokom`, `britanska 11. husarska pukovnija`, `1. i 3. pukovniju`, `37. zemlja po
    // veličini`, `njegov 60. gol u sezoni`.
    mjesto: "n.nom", mjestu: "n.loc", dana: "m.gen", kategorije: "f.gen", najvećim: "m.ins",
    husarska: "f.nom", pukovnija: "f.nom", pukovniju: "f.acc", zemlja: "f.nom", gol: "m.nom",
};

// ---------------------------------------------------------------------------------------------------
// COUNTED NOUNS
// ---------------------------------------------------------------------------------------------------

/** Pick a three-form Slavic count noun for `n`: [nom.sg, gen.sg (2–4), gen.pl]. */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(slavicCountForm(n), 2)]!;
}
// Every one of these is attested in the bs_ba corpus itself: `u 10:00 sati`, `83 metra u visinu`,
// `dugi su 378 metara`, `(10-60 minuta)`, `temperaturi od 90 stepeni`, `1,5 kilometara u sekundi`.
const SAT = ["sat", "sata", "sati"] as const;
const MINUT = ["minut", "minuta", "minuta"] as const;
const STEPEN = ["stepen", "stepena", "stepeni"] as const;
const METAR = ["metar", "metra", "metara"] as const;
const MILJA = ["milja", "milje", "milja"] as const;
const MEGABIT = ["megabit", "megabita", "megabita"] as const;

/**
 * Dotted abbreviations whose dot is NOT a sentence end. ⚠ MEASURED, NOT PORTED: Serbian declares
 * `itd/npr/tzv` and Croatian only `itd`. Here `itd.` is ×7 and `npr.` ×3 (both hold), `tzv.` is ×0 (dropped),
 * and three the siblings do not carry are present — `tj.` ×1, `str. 109` ×1, `br. 11` ×1.
 *
 * ⚠ `npr.` EXPANDS TO ONE WORD. Serbian's ekavian *na primer* is doubly wrong here: the reflex is ijekavian
 * AND Bosnian writes it solid. The corpus attests the target directly, ×8 — `Naprimjer, „učenje“ i
 * „socijalizacija“ smatraju se važnim motivima`.
 */
const DOTTED: Readonly<Record<string, string>> = {
    itd: "i tako dalje",
    npr: "naprimjer",
    tj: "to jest",
    str: "strana",
    br: "broj",
};
/** ⚠ BOTH SCRIPTS in the alternation. Latin keys alone make the rule a no-op on Cyrillic prose — `итд.`
 *  still reads as [itd] plus a phrase break. Digraphia bites the same way `\b` does: a rule that looks
 *  right matches nothing. Longest-first so `str` cannot be pre-empted by a shorter key. */
const DOTTED_ALT = Object.keys(DOTTED)
    .flatMap((k) => [k, cyr(k)])
    .sort((a, b) => b.length - a.length)
    .join("|");

const NOT_LETTER = "(?![\\p{L}\\p{M}])";

/**
 * The shared symbol tier. Unit abbreviations are written in LATIN even in Cyrillic prose, so the keys are
 * Latin only; the tier lowercases before lookup, which is what lets `Ghz` match `ghz`.
 *
 * `unitPer` is "na" + ACCUSATIVE, and the corpus says so in its own words: `(3000 milja NA SAT)`. The
 * SECOND-based rate takes a different preposition — the same corpus writes `brzinom od 1,5 kilometara U
 * SEKUNDI` — which one `unitPer` cannot express, so `/s` is composed locally in step 6.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "i",
    /**
     * ⚠ TWO WORDS, AND THE SECOND IS THIS FILE'S OWN FINDING. Both siblings declare only `times` (*puta*)
     * and let `by` default to it. The Bosnian corpus writes the DIMENSION out longhand in the same
     * sentences that write it with an `x`, and the word it uses is `sa`:
     *     `Format od 35 mm … 36 mm širine SA 24 mm visine`   ·   `(29¾ inča SA 24½ inča)`
     * against `format od 6x6 cm, odnosno negativ od 56x56 mm`. The tier's own rule picks `by` when a UNIT
     * follows or when the ASCII form is unspaced between digits, which is exactly these two instances.
     * `puta` is separately attested for the PRODUCT sense (`uspio je sedam puta preći most`).
     * ⚠ `×` (U+00D7) is ×0 in this corpus; the ASCII `x` is ×4. Declaring `multiply` is what makes the
     * ASCII form read at all — without it `6x6 cm` loses the `x` outright (measured).
     */
    multiply: { times: "puta", by: "sa" },
    /** `posto` is INVARIANT and corpus-attested three times over: `29 posto anketiranih`, `46 posto
     *  glasova`, `reflektira oko 90 posto sunčeve svjetlosti`. */
    percent: ["posto"],
    /**
     * Currency words DECLINE, so all three count forms are declared: 1 dolar · 2–4 dolara · 5+ dolara.
     * `dolara` is corpus-attested (`novčanice od 5 i 100 dolara`, `2,3 milijarde dolara`).
     *
     * ⚠ `AUD$` NEEDS ITS OWN KEY. The tier is letter-bounded on the left so a bare `$` cannot match inside
     * `AUD$`, and the corpus's third currency instance is `dodatnih 45 miliona AUD$`. `australijski` is
     * corpus-attested (`Peter Costello, australijski ministar finansija`).
     *
     * ⚠ `€`, `£` AND `¥` ARE DELIBERATELY ABSENT — ×0 as signs, and the apparent pound stem is a trap
     * Serbian already documented and this corpus reproduces verbatim: `funti` ×2 is the WEIGHT pound
     * (`Osoba koja na Zemlji teži 200 funti (90kg)`), not the currency.
     *
     * ⚠ THE KEYS ARE QUOTED AND THE ENTRIES ARE UNINTERRUPTED, and neither is cosmetic. `review.ts`'s
     * sourcing gate reads currency needles by splitting this block on `,(?=\s*"[^"]*"\s*:)` and then
     * matching `/"([^"]+)"\s*:/` — so an object-shorthand `$:` key is invisible to it, AND a comment
     * sitting BETWEEN two entries defeats the split, collapsing the block into one entry keyed on `AUD$`
     * (which a folded haystack can never contain). Either mistake makes the gate report "all 1
     * high-traffic words attested" while checking no currency name at all — the silent-blindness mode the
     * gate's own header documents for helper-declared data, arriving through a third door. Both were made
     * here first and the line only went from 1 needle to 3 once both were undone.
     */
    currency: {
        "AUD$": ["australijski dolar", "australijska dolara", "australijskih dolara"],
        "$": ["dolar", "dolara", "dolara"],
    },
    /** ⚠ DECLARED BECAUSE THE ONLY COMPOUND CURRENCY INSTANCE IN THE CORPUS PUTS A MAGNITUDE BETWEEN THE
     *  FIGURE AND THE SIGN — `dodatnih 45 miliona AUD$ služi`. Without the hop the tier's currency arm
     *  cannot see the sign at all and it stays raw. Spellings are the ones running Bosnian text uses
     *  (`2,3 milijarde dolara`, `45 miliona`), not citation forms. */
    magnitudes: ["hiljada", "miliona", "milion", "milijarde", "milijardi", "milijarda", "biliona"],
    units: {
        km: ["kilometar", "kilometra", "kilometara"],
        m: ["metar", "metra", "metara"],
        mm: ["milimetar", "milimetra", "milimetara"],
        cm: ["centimetar", "centimetra", "centimetara"],
        kg: ["kilogram", "kilograma", "kilograma"],
        mi: ["milja", "milje", "milja"],
        ghz: ["gigaherc", "gigaherca", "gigaherca"],
    },
    unitPer: "na",
    rateDenominators: { h: "sat" }, // `s` is NOT declared: its Bosnian rate is "u sekundi", not "na …"
    // Bosnian puts the measure adjective BEFORE the noun as a separate agreeing word, Russian-style —
    // *kvadratnih kilometara*. No CUBED word: `³` is ×0 and the one cubic quantity is already spelled out.
    exponentWords: {
        squared: ["kvadratni", "kvadratna", "kvadratnih"],
        position: "before",
    },
    countForm: slavicCountForm,
});

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** Normalize one Bosnian input string. Pure text→text. */
export function normalizeBosnian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — Bosnian groups thousands with a PERIOD (×47), and until it is removed
    //    the period reads as clause punctuation and the number splits in two: `6.387 km` read *šest .
    //    trista osamdeset sedam*. Two passes, because adjacent groups share a digit (`10.000`). EXACTLY
    //    three digits and no space, and every exclusion that guard buys is LIVE in this corpus:
    //    `802.11a/b/g/n` (a Wi-Fi standard, ×2), `12.00 GMT` (step 8's note) and all 222 `N.` ordinals.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");

    // 1) THE ERA MARKER, before the dotted-abbreviation rule (step 2) and the `N.` ordinal rule (step 9) —
    //    its interior dots would otherwise become phrase breaks and its `e.` would look like a licensor.
    //    ⚠ THE EXPANSION IS CORPUS-ATTESTED, WHICH IS AS DIRECT AS SOURCING GETS: the same corpus that
    //    writes `srušen 21. jula 356. godine p.n.e.` writes the words OUT in three other utterances —
    //    `hram je ponovo izgrađen 323. godine PRIJE NOVE ERE`, `u 10. stoljeću PRIJE NOVE ERE`, `oko
    //    10.000 godina PRIJE NOVE ERE`. Serbian's ekavian *pre nove ere* would be wrong on all three.
    //    ⚠ NO YEAR-ORDINAL ARM. Both siblings claim a bare `NNNN.` immediately before the marker (the
    //    elided *godine*). Here that shape is ×0: BOTH era instances write `godine` explicitly, so step 9
    //    handles the year and this rule only has to handle the marker.
    //    ⚠ THE FINAL DOT IS TWO DIFFERENT THINGS. `p.n.e. u požaru` runs on and the dot must be consumed;
    //    at a sentence end it must be kept. The discriminator is CASE and the test must run in the
    //    CALLBACK — `\p{Lu}` inside an `i`-flagged pattern matches lowercase too.
    s = s.replace(/(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(\s*)(\S?)/giu, replaceEra("prije nove ere"));
    //    THE FINAL DOT IS SOMETIMES ABSENT (`p.n.e,`), so a second pass claims the dotless form. Guarded
    //    against a following letter so it cannot bite into a real word.
    s = s.replace(/(?<![\p{L}\p{M}])p\.\s?n\.\s?e(?![\p{L}\p{M}.])/giu, "prije nove ere");

    // 2) DOTTED ABBREVIATIONS, three arms. The dot is consumed before a following word so it cannot become
    //    a phrase break; at a real sentence end it is kept.
    //    ⚠ THE FOLLOWER MUST BE LOWERCASE, AND THAT IS A DIVERGENCE FROM SERBIAN. Serbian's first arm
    //    accepts `[\p{L}\d(]`, i.e. any letter — so an abbreviation that ENDS the sentence loses the
    //    boundary. The Bosnian corpus has exactly that: `…prijevoz kopnom, itd. Za sva mjesta izvan
    //    Afrike.` (×1, against `itd. u određenoj mjeri` ×1 mid-sentence). The discriminator is the same one
    //    steps 1, 10 and 11 use — Bosnian capitalises every sentence start — so a capital follower falls
    //    through to the third arm and keeps its dot.
    //    ⚠ AND THE CASE TEST MUST RUN IN THE CALLBACK, not in the lookahead: `\p{Ll}` inside an `i`-flagged
    //    pattern matches UPPERCASE too, so a `(?=\p{Ll})` guard here would be a no-op — the same trap
    //    Serbian's era rule documents from the other direction. The `i` flag itself is needed so a
    //    sentence-initial `Itd.` still matches its lowercase key.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(\\s+)(?=[\\p{L}\\d(])`, "giu"),
        (_m, ab: string, sp: string, off: number, all: string) => {
            const next = all.slice(off + _m.length, off + _m.length + 1);
            return `${DOTTED[lat(ab)]!}${/\p{Lu}/u.test(next) ? "." : ""}${sp}`;
        });
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(?=\\s*[,;:])`, "giu"),
        (_m, ab: string) => DOTTED[lat(ab)]!);
    //    ⚠ A CLOSING BRACKET OR QUOTE IS NOT A PAUSE — bosnian.jsonc maps only `.!?…,;:` — so the dot must
    //    be KEPT before one, not consumed the way it is before a comma. This arm EARNS ITSELF here: the
    //    corpus has `… uređivanje priča, pripovijedanje priča itd.)`, where grouping `)` with the comma
    //    would silently lose the sentence-final pause.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(?=\\s*(?:[.!?”"»)\\]]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED[lat(ab)]!}.`);

    // 3) LONE INITIAL IN A NAME — `George W. Bush` ×2, `Johna F. Kennedyja`, `Lyndona B. Johnsona`. The dot
    //    is a phrase break in a name that has none. Only the dot is dropped; the letter is left to the g2p.
    //    ⚠ `Dr.` IS CASE-SENSITIVE, AND THAT ONE FLAG IS A DIVERGENCE FROM CROATIAN. Croatian's rule is
    //    `giu`, so it also matches a LOWERCASE `dr.` — and the Bosnian corpus has `(James i dr. 1995)`, the
    //    academic *et al.*, which the ported rule would read as *doktor hiljadu devetsto devedeset pet*.
    //    `Dr.` proper is ×4 (`Dr. Damadian`, `Dr. Lee`, `Dr. Moll`, `Dr. Tony Moll`) and is claimed; the
    //    lowercase *et al.* is left alone.
    //    ⚠ THE DOTTED CAPITAL RUN (`A. B.`) THAT CROATIAN ALSO CARRIES IS ×0 HERE and is not ported.
    s = s.replace(/(?<=\p{Lu}\p{L}*\s)(\p{Lu})\.(?=\s+\p{Lu}\p{Ll})/gu, "$1");
    s = s.replace(/(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])/gu, "doktor$1");
    s = s.replace(/(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))/gu, "doktor.");

    // 4) `SAD-a` — the GENITIVE of the USA, ×10, and it is trap 56 rather than a leak: the tokenizer splits
    //    on the hyphen and the g2p reads `SAD` as the ordinary Bosnian ADVERB *sad* ("now"), so `trupe
    //    SAD-a napustiti Siriju` came out as *trupe SAD a napustiti…* — a plausible sentence with the
    //    wrong word in it. Nothing counts that.
    //    ⚠ ONLY THE CASE-MARKED FORM IS CLAIMED. The written `-a` NAMES the genitive, which is the same
    //    principle step 5 uses for `1970-ih`. Bare `SAD` (×5–6) is left alone because its instances are
    //    locative, accusative and a bare apposition and one expansion cannot serve three cases — Serbian's
    //    `Св.` refusal, which is why Croatian's nominative `SAD(?=-)` rule is NOT what ships here.
    s = s.replace(/(?<![-\p{L}\p{M}])SAD-a(?![\p{L}\p{M}])/gu, "Sjedinjenih Američkih Država");

    // 5) DEGREES, three arms, and the middle one is the round's an→ast moment.
    //    5a) `°C` / `°F` supplies both the degree noun and the scale name; the count agrees with the
    //        numeral (30 → gen.pl stepeni). Corpus: `temperature iznad + 30 °C su uobičajene`.
    s = s.replace(/(\d+)\s?°\s?([CFСcf])(?![\p{L}\p{M}])/gui, (_m, n: string, unit: string) =>
        `${n} ${counted(Number(n), STEPEN)} ${/[Ff]/u.test(unit) ? "Farenhajta" : "Celzijusa"}`);
    //    5b) ⚠ THE COMPASS LETTERS ARE `S J I Z`, NOT `N S E W`. Croatian allow-lists `[NSEWnsew]` and that
    //        matches NOTHING in Bosnian: the corpus's one bare degree is `tek treći veliki uragan
    //        zabilježen istočno od 35°Z` — `Z` for *zapad*, west. A ported `W` misses every western
    //        longitude, exactly as ast's `W` did for Aragonese *ueste*. Only `Z` is measured (×1); the
    //        other three complete the same four-way closed system and are declared with it.
    //        The bearing noun is corpus-attested in the same frame: `tek nekoliko stepeni SJEVERNO od
    //        ekvatora`.
    //        ⚠ ATTACHMENT IS REQUIRED ONLY OF THE AMBIGUOUS BEARINGS. `i` "and" and `s` "with" are two of
    //        the commonest words in Bosnian as well as bearings, so spaced off the degree they must not be
    //        claimed — `temperatura 35° i padavine` was reading the conjunction as *istočno* and deleting
    //        it. J and Z are letters no Bosnian sentence uses alone, so a space is safe there.
    //        ⚠ N AND E ARE READ, NOT DROPPED. The imported English-convention bearings are unambiguous in
    //        either system and their words are already in this table, so reading them beats deleting them.
    s = s.replace(/(\d+)\s?°(?:\s?([JZNEjzne])|([SIsi]))(?![\p{L}\p{M}])/gu, (_m, n: string, spaced: string | undefined, tight: string | undefined) =>
        `${n} ${counted(Number(n), STEPEN)} ${({ S: "sjeverno", J: "južno", I: "istočno", Z: "zapadno", N: "sjeverno", E: "istočno" } as Record<string, string>)[(spaced ?? tight)!.toUpperCase()]!}`);
    //    5c) THE BARE DEGREE emits the degree noun only. Safe unguarded because 5a/5b have already consumed
    //        the qualified forms.
    //        ⚠ IT ALSO CONSUMES A FOREIGN BEARING LETTER, and it must. `W X Y Q` are outside Gaj's Latin,
    //        so 5b's `[SJIZsjiz]` cannot claim them and they used to be harmless only because the g2p had
    //        no rule for the letter and silently dropped it. The shared `foreignLetters` fold now maps
    //        them, so an unconsumed `W` glues onto the noun as *stepeniʋ* — and the stress lookup then
    //        runs on the nonexistent word `stepeniv`, misses stress.tsv and loses the pitch accent. The
    //        imported `35°W` form is what this catches; `35°Z` is still read as *zapadno* by 5b above.
    //        ⚠ IT ALSO CONSUMES THE LETTERS 5b HAS NO WORD FOR — W X Y Q, outside Gaj's Latin and so
    //        unclaimable by the bearing table above. They used to be harmless only because the g2p had no
    //        rule for them; the shared `foreignLetters` fold now maps them, so an unconsumed one glues
    //        onto the noun and the stress lookup then runs on a nonexistent word and loses the accent.
    //        None is a BCS word on its own, so a space before them is safe.
    //        ⚠ AND THE WHITESPACE IS INSIDE THE OPTIONAL GROUP: outside it, `\s?` is consumed even when the
    //        group matches empty, and `35° od ekvatora` glues to *stepeniod*.
    s = s.replace(/(\d+)\s?°(?:\s?[WXYQwxyq](?![\p{L}\p{M}]))?/gu,
        (_m, n: string) => `${n} ${counted(Number(n), STEPEN)}`);

    // 6) NUMERAL + HYPHEN + CASE SUFFIX (`1970-ih` ×13, all decades). As in Russian, the written suffix is
    //    the LAST LETTERS of the inflected ordinal, not an appendable marker, so the rule generates every
    //    case form and keeps the one that actually ends with those letters — a guard that makes the
    //    paradigm safe and rejects anything it does not cover.
    //    MUST run before the range rule (step 9), which would otherwise eat the hyphen.
    //    ⚠ SERBIAN'S TRAILING GUARD, NOT CROATIAN'S. Croatian writes `(?![^\p{L}\p{M}]|.)`, which declines
    //    whenever ANY character follows; the corpus writes `krajem 1970-ih;` and `1850-ih i predstavlja`,
    //    so the plain not-a-letter guard is the one that claims them. The 2-letter cap also excludes
    //    COMPOUND ADJECTIVES (`24-časovnom`), which need a combining stem this file does not model.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{Ll}{1,2})${NOT_LETTER}`, "gu"),
        (whole, digits: string, rawSuffix: string) => {
            const suffix = lat(rawSuffix);
            return ordinalForms(Number(digits)).find((f) => f.endsWith(suffix)) ?? whole;
        });

    // 7) RATES THE SHARED TIER CANNOT EXPRESS, before the tier itself and before every rule that destroys
    //    number-to-unit adjacency. The `/s` rate takes "u sekundi", not `unitPer`'s "na" + accusative, and
    //    one `unitPer` cannot carry both — the corpus writes the second-based rate out longhand in exactly
    //    those words: `udarila u površinu Mjeseca brzinom od 1,5 kilometara U SEKUNDI`.
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), MEGABIT)} u sekundi`);
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), METAR)} u sekundi`);
    // 7b) THE SPELLED-OUT MILE RATE — `vjetrovi brzine (često 100-200 milja/sat)`. `milja` is already the
    //     Bosnian word, so the tier's `mi` key cannot match it and only the denominator needs reading.
    s = s.replace(/(\d+(?:,\d+)?)\s?milja\s*\/\s*(?:sat|h)(?![\p{L}\p{M}])/giu,
        (_m, n: string) => `${n} ${counted(intOf(n), MILJA)} na sat`);

    // 7c) A SPAN BETWEEN TWO CLOCKS, and it has to be claimed HERE rather than by the general range rule
    //     (step 9) — a hole BOTH siblings have. The general rule needs a digit on each side of the dash;
    //     once step 8 has rewritten the two clocks into words there is none, so the dash is dropped
    //     outright and the span reads as two consecutive times with nothing between them. Measured ×1:
    //     `Između 10:00 - 11:00 sati uveče prema MDT vremenskoj zoni`, which read *između deset sati
    //     jedanaest sati*. Claiming it before the clock rule is the whole fix.
    s = s.replace(/(\d{1,2}:\d{2})\s?[-–—]\s?(?=\d{1,2}:\d{2})/gu, "$1 do ");

    // 8) THE CLOCK, IN THE COLON FORM. The colon is clause punctuation in bosnian.jsonc, so `06:30` read as
    //    *šest , trideset*. Bosnian says a CARDINAL hour with the counted noun — `u 11 sati`.
    //    ⚠ COLON ×19 AGAINST DOT ×1, AND SERBIAN'S DOT RULE FIRES ZERO TIMES. Serbian claims `12.00 sati`
    //    and gates on a WRITTEN hour noun; the single dot-written clock in this corpus is `predstavila svoj
    //    izvještaj u 12.00 GMT`, which has no such noun. So the shape that ports is Croatian's, not
    //    Serbian's, and the dot form is left unclaimed (×1, and no guard separates it from a decimal).
    //    ⚠ AND THE WRITTEN HOUR NOUN IS CONSUMED, WHICH NEITHER SIBLING DOES. 10 of the 19 clocks are
    //    followed by `sati`/`časova` (`u 10:00 sati ujutru`, `posle 11:00 časova`, `u 22:08 sati.`), and
    //    since the reading already emits the hour noun, leaving it produces *dvadeset dva sata i osam
    //    minuta SATI*. Croatian consumes an optional `h` instead — which is ×0 in Bosnian.
    //    TWO-DIGIT minutes and a 0–23 hour keep the SCORES out, and the corpus has one that needs it:
    //    `ostvarila ugodnu pobjedu od 26:00 protiv petoplasirane Zambije` (26 is not an hour), plus the
    //    utterance-final `rezultat bio 6:6.` (one-digit minute).
    //    RUNS BEFORE the range rule (step 9), which would otherwise eat `Između 10:00 - 11:00 sati`.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])(\s*(?:sati|sata|časova|sahati|sahata))?/giu,
        (_m, h: string, min: string, _noun: string | undefined) => {
            const hv = Number(h), mv = Number(min);
            const head = `${numberToWords(hv)} ${counted(hv, SAT)}`;
            return mv === 0 ? head : `${head} i ${numberToWords(mv)} ${counted(mv, MINUT)}`;
        });

    // 9) A YEAR–YEAR SPAN WHOSE SECOND ENDPOINT CARRIES THE ORDINAL PERIOD, claimed as a UNIT and BEFORE
    //    everything else that touches a range. This is trap 58's Bosnian shape, and it is a LANGUAGE
    //    question that the corpus answers twice.
    //
    //    ⚠ WHAT THE CORPUS SAYS. There are 5 year–year dash spans in the 1,976 utterances, and FOUR of them
    //    carry NO ordinal period at all — `(1894-1895)`, `(1644-1912)`, `(1469–1539)`, `(AD 1000–1300)`.
    //    The fifth is `Ta abeceda je osmišljena 1444. godine … (1418-1450. godine)`, where the period IS
    //    written on the second endpoint and the licensing noun is written after it. So the ordinal reading
    //    of a span endpoint is licensed by WHAT FOLLOWS THE DOT, never by the dot alone — the same
    //    discipline steps 10 and 11 already use, and the same discipline steps 4 and 6 use for `SAD-a` and
    //    `1970-ih` (the written mark names the reading).
    //    ⚠ AND WHEN IT IS LICENSED, BOTH ENDPOINTS ARE ORDINAL. The corpus writes the connective out
    //    longhand twice and marks both endpoints each time: `u sezoni od 1995. do 1996. godine` and
    //    `u 2015. ili 2016. godini`. A span is *of* those years and the elision governs the pair, so
    //    `1418-1450. godine` is *hiljadu četiristo osamnaeste DO hiljadu četiristo pedesete godine*.
    //    ⚠ THE READING THIS REPLACES WAS INDEFENSIBLE UNDER EITHER ANALYSIS, and it was live in the corpus
    //    rather than only in a probe: the general range rule ran first, so step 11 saw a bare `1450.` and
    //    produced CARDINAL-then-ORDINAL — *hiljadu četiristo osamnaest do hiljadu četiristo pedesete*.
    //    Neither "both cardinal" nor "both ordinal", and no counter sees a mixed reading (trap 56).
    s = s.replace(/(?<![\d.,])(1\d{3}|20\d{2}|2100)\s?[-–—]\s?(1\d{3}|20\d{2}|2100)\.(?=\s+\p{Ll})/gu,
        (whole, from: string, to: string) => {
            const a = ordinalBase(Number(from)), b = ordinalBase(Number(to));
            if (a === undefined || b === undefined) return whole; // round thousands — see ordinalBase
            return `${inflect(a, "f.gen")!} do ${inflect(b, "f.gen")!}`;
        });

    // 10) THE `N.` ORDINAL — the rule this file mostly exists for (see the header and LICENSOR). Claimed
    //     ONLY when a licensing word from the closed list follows, and only when that word is LOWERCASE.
    //     The case guard is what preserves the sentence boundary: Bosnian capitalises every sentence start,
    //     so requiring lowercase excludes genuine sentence ends by construction.
    //     Runs AFTER step 0 (de-grouping) so `10.000` is already whole, and AFTER step 1 so `p.n.e.` is
    //     gone and its `e.` cannot be mistaken for a licensor.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
        (whole, digits: string, word: string) => {
            const slot = LICENSOR[lat(word)];
            if (slot === undefined) return whole;
            const base = ordinalBase(Number(digits));
            if (base === undefined) return whole; // round thousands — see ordinalBase
            return `${inflect(base, slot)!} ${word}`;
        });

    // 11) A YEAR WITH `godine` ELIDED — Croatian's step 7b, and the single most valuable import of the
    //     round. The closed list above cannot see these because the licensing noun is NOT WRITTEN.
    //     Tabulated: of the 222 `N.` instances, the licensor list claims 197; the remainder is **11
    //     mid-sentence years** (`Godine 1990. dodan je na spisak`, `Tokom izbora 1976. savjetovao je
    //     Cartera`, `od 1995. do 1996. godine`, `u 2015. ili 2016. godini`), **1 before a capital**
    //     (`sjeverno od grada 1770. S vremena na vrijeme…`) and **1 at an utterance end** (`zvaničnu
    //     prijestolnicu Samoe od 1959.`).
    //     A four-digit number in 1000–2100 followed by a period is a year, and a Bosnian year is an ORDINAL
    //     in the feminine genitive agreeing with the elided *godine* — the same slot the written `1940.
    //     godine` takes, so no case is being guessed. The PERIOD is kept only where it is ALSO a sentence
    //     end (utterance end, or a capitalised word after it); mid-sentence it is the ordinal marker.
    //     ⚠ THE EXCLUSIONS EARN THEMSELVES IN THIS CORPUS. The 12 utterance-final `N.` include
    //     `zbog zabrinutosti vezane za COVID-19.`, `prizemljila Il-76.`, `savršen dan za ragbi 7.`,
    //     `osobe koje već imaju dijabetesa tipa 1.` and `rezultat bio 6:6.` — the lookbehind rejects the
    //     first two and the 1000–2100 range rejects the rest.
    //     ⚠ THE LOOKBEHIND REJECTS ALL THREE DASHES, NOT ONLY THE ASCII HYPHEN, and that is trap 58's
    //     canonical shape stated for a rule whose trailing context is an ordinal arm rather than a
    //     lookahead class. The class was `[\d.,\-]`, which is right for `COVID-19.` and blind to
    //     `1990–1995.`; the en dash and the em dash join the same corpus's range shapes (`7–2`, `1469–1539`,
    //     `AD 1000–1300`) and had to join this guard with them.
    s = s.replace(/(?<![\d.,\-–—])(1\d{3}|20\d{2}|2100)\.(?!\d)/gu, (whole, digits: string, at: number, all: string) => {
        const base = ordinalBase(Number(digits));
        if (base === undefined) return whole;
        const year = inflect(base, "f.gen");
        if (year === undefined) return whole;
        const rest = all.slice(at + whole.length).replace(/^[\s)»"'\]]+/u, "");
        const sentenceEnd = rest === "" || /^[\p{Lu}]/u.test(rest);
        return `${year}${sentenceEnd ? "." : ""}`;
    });

    // 11b) THE GENERAL NUMERIC RANGE — ×13. The dash was dropped outright, fusing the endpoints into one
    //      run of words (`120-160` read *sto dvadeset sto šezdeset*). Digits on BOTH sides keeps
    //      `COVID-19`, `XDR-TB`, `Il-76` and `A1GP` out. Runs AFTER step 6, which needs the hyphen.
    //      ⚠ AND AFTER THE TWO ORDINAL RULES, WHICH IS THE ORDERING TRAP 58 TURNS ON HERE. Serbian and
    //      Croatian both run the range rule BEFORE the ordinal rules, so that `1000-1300. godine` still
    //      has a digit on its right when the ordinal fires. The cost of that order is that by the time
    //      step 11 runs the dash its own lookbehind was written to reject is GONE — the text already says
    //      `1990 do 1995.` — so a clause-final `1990-1995.` had its SECOND endpoint silently promoted to
    //      an ordinal while the first stayed cardinal. Step 9 claims the LICENSED year span as a unit,
    //      which is what lets this rule move below the ordinals and lets step 11's dash guard do the job
    //      it was written for. The residual is a NON-year range whose right endpoint is a licensed
    //      ordinal (`4-5. kategorije`): ×0 in this corpus, so step 10's lookbehind is left alone rather
    //      than widened on nothing.
    //      Known false positives: SCORES (`7–2`, `5-3`) where *do* is the wrong connective — but the
    //      endpoints were fusing there too, so no reading is lost, only a wrong-ish connective gained.
    s = s.replace(/(\d)\s?[-–—]\s?(?=\d)/gu, "$1 do ");

    // 12) THE SHARED SYMBOL TIER — %, currency, units, rates, `&`, `×`/`x`, the exponent. It must see the
    //     number still ADJACENT to its unit and still carrying its decimal comma (`3,50 m`, `2,4 GHz`), so
    //     it runs before step 13 folds the comma into a word, and after step 0 has made the integer whole.
    s = SYMBOLS(s);

    // 13) DECIMAL COMMA → *zarez*. LAST among the numeric rules, because it destroys the number: every rule
    //     above that needs the value (units, the clock, the tier's count agreement) has already run.
    s = s.replace(/(?<=\d),(?=\d)/gu, " zarez ");

    // 14) VULGAR FRACTIONS — `taj veliki dokument na pergamentu (29¾ inča sa 24½ inča)`, the corpus's one
    //     parchment sentence and the only place either glyph occurs. Both were dropped outright, so the
    //     document measured a whole number of inches.
    //     ⚠ `i po`, NOT CROATIAN'S `i pol`. The half word is the one place bs and hr genuinely part company
    //     in this file's vocabulary, and `po` is the bs/sr form.
    s = s.replace(/(\d+)¾/gu, "$1 i tri četvrtine");
    s = s.replace(/(\d+)½/gu, "$1 i po");

    // 15) THE SIGNS THAT REMAIN. `+` is ×2 and BOTH are positive rather than arithmetic — `temperature
    //     iznad + 30 °C su uobičajene` (spaced) and `po lokalnom vremenu (UTC+1)` (after capitals).
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1plus $2");
    s = s.replace(/(?<=\p{Lu})\+(?=\d)/gu, " plus ");
    //     THE MINUS, with Serbian's three guards, each of which rejects a real shape:
    //       · a digit IMMEDIATELY AFTER the sign — rejects the spaced `- 36 mm širine` form
    //       · a letter or digit IMMEDIATELY BEFORE — rejects `Il-76`, `COVID-19`, `SAD-a`, `120-160`
    //       · a digit ANYWHERE to the left — rejects the SPACED range, where the character before the
    //         hyphen is a SPACE and the usual guard misses it (`Između 10:00 - 11:00 sati`)
    //     ⚠ MEASURED TO FIRE ZERO TIMES: the whole guarded shape has **×0 candidates** in bs_ba — not one
    //     `[-−–]\d` in the corpus survives the lookbehind. So this rule is retained rather than refused,
    //     and the reason is the asymmetry the playbook states for mos: a dropped PLUS is lossless and a
    //     dropped MINUS INVERTS its operand, so a class with no instances to argue from is claimed rather
    //     than silenced. It is Serbian's residual risk (`word -1`) bought for nothing, on a corpus that
    //     contains neither the risk nor the reward.
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "minus ");

    return s;
}

/** Integer part of a Bosnian-written number ("3,50" → 3), for the local count-agreement calls. */
function intOf(n: string): number {
    return Math.trunc(Number(n.replace(/\./gu, "").replace(",", ".")));
}

/**
 * The era-marker replacer (step 1). Keeps the final dot only when it was ALSO the sentence end: end of
 * input, or a following capital. A following punctuation mark already carries the break, so the dot is
 * consumed there rather than doubled — which is what the corpus's `datiraju još iz 5000. godine p.n.e.!`
 * needs, and what Croatian's `(?=[.!?]|$)` arm would get wrong by emitting *prije nove ere.!*
 */
function replaceEra(words: string): (m: string, sp: string, next: string) => string {
    return (_m: string, sp: string, next: string): string => {
        if (next === "") return `${words}.`;
        if (/[,;:!?)»”"]/u.test(next)) return `${words}${sp}${next}`;
        if (/\p{Lu}/u.test(next)) return `${words}.${sp}${next}`;
        return `${words}${sp}${next}`;
    };
}
