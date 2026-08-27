/**
 * Eastern Armenian (hy) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Evidence: `tools/corpus/mined/hy.jsonc` (hy.wikipedia dump, 2,517,219 segments; 260 hard + 200 sample
 * retained, and because it is dump-sourced the sample tier IS the language's real distribution). Counts
 * below are dump-wide unless marked. Full working: `docs/investigations/hy_normalization_investigation.md`.
 *
 * ⚠ THE BOUND CASE SUFFIX IS THIS LANGUAGE'S DEFINING FORM — trap 14, and denser here than in any language
 * that has met it so far. Armenian glues its case/article morphology straight onto the DIGITS with a hyphen:
 * `5-ին`, `2020-ի`, `1991-ից`, `250 000-ը`, `42-րդ`, `1950-ական`. 185 instances in the hard set and **66 in
 * 200 uniform sample paragraphs**. A digit cannot take a suffix — the digit becomes words in the TOKENIZER,
 * downstream of everything here — so before this pass:
 *
 *     5-ին      → hinɡ in       two words where Armenian has ONE (հինգին)
 *     42-րդ     → kʰɑrɑsun jeɾku ɾdə    the ordinal suffix as a bare consonant cluster
 *     1950-ական → … hisun ɑkɑn          the decade suffix as a free word
 *
 * The fix is trap 14's: convert the operand to WORDS inside the rule, attach the suffix there.
 *
 * ⚠ ARMENIAN SCRIPT — `\b` IS ASCII AND USELESS HERE (trap 1), and every "not inside a word" guard carries
 * `\p{M}` beside `\p{L}` (trap 23). Written as explicit lookarounds throughout.
 *
 * THE DEFECTS THIS CLOSES, with what the engine produced before (`phonemize(x, "hy")`, run before any edit):
 *
 *   decimals 143,700  35,6  → jeɾesun hinɡ , vet͡sʰ   the separator read as a CLAUSE PAUSE
 *   grouped   59,563  1 500 000 → mek hinɡhɑɾjuɾ zəɾo  three numbers, and `000` read as "ZERO"
 *   percent   46,637  5%    → hinɡ                    the sign silently gone
 *   exponent  49,398  5 կմ² → hinɡ kmə                unit AND power gone
 *   abbrev   143,379  մ.թ.ա. 550 → mə . tʰə . ɑ . …   letter-by-letter with three false pauses
 *   degrees   13,805  20 °C → kʰəsɑn sˈiː             ° gone, ⟨C⟩ read as the ENGLISH letter name
 *   ordinals   7,393  see above
 *   ranges   200,448  1915-1923 → the two years run together as one utterance, no break at all
 *   units        163  36 կմ → jeɾesun vet͡sʰ kmə       the abbreviation leaks as a consonant cluster
 *
 * SOURCING — §5c is CLOSED for this language (`sources.ts`: "espeak does not ship hy at all"), so every word
 * below comes from the corpus itself or from `attest.ts` against hy.wikipedia with the example prose READ:
 *
 *   տոկոս      corpus ×11, EVERY one postposed after a figure (`95 տոկոսը`, `83 տոկոս`, `100 տոկոսով`)
 *   դոլար      corpus ×10 (`599 դոլարով`; `34 910 ամերիկյան դոլար (NZ$47,836)` — sign and word in one line)
 *   եվրո       wiki ×64/11 — "Եվրո (տարադրամի կոդը՝ EUR)", "5 եվրո արժողությամբ". ⚠ the bare CORPUS count
 *              of 8 is a trap-37 false lead: seven of the eight are եվրոպական, "European".
 *   քառակուսի  wiki ×35/19 — "Քառակուսի կիլոմետր (կմ², km², քառ. կմ), մակերեսի չափման միավոր" defines the
 *              measure word AND both abbreviations. ⚠ the corpus's single bare instance is the SHAPE
 *              ("4 սյուներով քառակուսի դահլիճ", a square hall) — trap 37 again, and the collocation is the
 *              evidence.
 *   խորանարդ   corpus ×2, both `խորանարդ ԿԻԼՈՄԵՏՐ`; wiki ×8/7. Position: BEFORE the noun, in both sources.
 *   Ցելսիուսի աստիճան  wiki ×4/3 — an SI-naming article stating "քանզի գրվում է «Ցելսիուսի աստիճան»", and
 *              "ջերմաստիճանը 25-40 ցելսիուսի աստիճան է" in the slot. ⚠ bare `աստիճան` in the corpus is ×6
 *              and every one is the ACADEMIC degree or աստիճանաբար "gradually" — trap 37, a third time.
 *   ամբողջ     THE DECIMAL WORD, and the highest-traffic slot here. Settled by a probe aimed elsewhere:
 *              `տասնորդական կոտորակ` returned «զրո ամբողջ ինը պարբերական» — 0.(9) READ OUT LOUD in
 *              Armenian, "zero WHOLE nine repeating". The fractional digits are a plain cardinal, not an
 *              ordinal denominator. Corroborated by `ամբողջ մասը` ×13/4 ("2,7 թվի ամբողջ մասը հավասար է 2").
 *   մեր թվարկությունից առաջ  wiki ×139/15, and the first example is the definition itself:
 *              "Մ.թ.ա.-ն հապավվում է «Մեր թվարկությունից առաջ»".
 *   կիլոմետր/մետր/միլիմետր/հեկտար  corpus; սանտիմետր and կիլոգրամ from the wiki's own definitional
 *              articles, which name the abbreviations: "Սանտիմետր (հայերեն հապավումը. սմ)", "Կիլոգրամ
 *              (նշանակումը՝ կգ, kg)".
 *   ordinals   the -երորդ series, attested individually: տասներորդ, տասնմեկերորդ, քսաներորդ,
 *              քսաներկուերորդ, քառասուներորդ, քառասուներեքերորդ, հիսուներորդ, վաթսուներորդ,
 *              հարյուրերորդ, հազարերորդ, and the SPACED compounds "Հարյուր հիսուներորդ",
 *              "Երկու հարյուրերորդ" — which is what fixes the suffix to the LAST word.
 *   երկուս-    the suppletive oblique stem: `երկուսի` ×4/2, `երկուսը` ×19/7. `տասին` ×3/2 gives the other
 *              half — a final `ը` DROPS before a case suffix, while the ORDINAL takes -ն- (իններորդ,
 *              տասներորդ). Two different rules, both attested, both encoded below.
 *
 * WHAT IS REFUSED, and what each refusal costs (trap 53 — a refusal is not neutral):
 *
 *   · THE BARE-COLON CLOCK. `clock` is 23,711 dump-wide, which looks mandatory. All 13 retained instances
 *     read: ONE clock (`ժամը 21:00-ին`, and it carries `ժամը`), one hadith reference, one date-time, and
 *     NINE FILM DURATIONS in H:MM:SS. A ceb-shaped rule would fix 1 and break 12 — trap 55's ilo lesson
 *     arrived at independently. Cost: the colon keeps reading as a comma-level pause, which for a duration
 *     is defensible and for the one clock is not.
 *   · A RANGE JOINER WORD. The corpus attests `N-ից մինչև M` ×6 (`2100-ից մինչև 2400-2500 մետր`,
 *     `0-ից մինչև 161 կմ/ժ`) but only where the WRITER chose to write it; imposing it on 200,448 bare
 *     dashes over-claims, and `1915-ից մինչև 1923 թվականներին` fights the noun's own case. Step 9 emits a
 *     PAUSE instead — the dash is currently silent, so the two operands run together as one utterance, and
 *     a pause is the minimal repair that invents no vocabulary.
 *   · THE PLUS. All 11 instances are temperatures (`+15.2°С`, `+8-9 °C`, `+ 30 … + 40 °C`) — no `UTC+1`, no
 *     arithmetic. Omitting a measurement plus is LOSSLESS where omitting a minus INVERTS, so this costs
 *     nothing and saves authoring an unsourced word. The minus, which does invert, IS read (step 12).
 *   · `& = × ÷ < >`. All 9 ampersands sit inside English phrases (`AT&T`, `R&B`, `Gerry & The Pacemakers`)
 *     and reach the engine through the Latin-run router, so the reading is English's, not hy's. `×` is
 *     contentful in exactly 4 instances (scientific notation) and `=` has no single reading across its ten.
 *   · INITIALISMS — the largest untreated class. 25 distinct Armenian acronyms retained (ԱՄՆ ×17, ՀՆԱ ×12,
 *     ԽՍՀՄ ×7 …), cell 373,760 dump-wide. The seam EXISTS (`core/initialisms.ts`, ~30 languages wired —
 *     checked, per trap 16) and is a NO-OP without a `letterName` table; `sources.ts` reports
 *     "[NONE] letter-names — espeak does not ship this language at all", so the blocker is SOURCING the 38
 *     Armenian letter names, not code. Cost, read out: `ԽՍՀՄ → [χshmə]`, `ԲՀՊՏ → [bhptə]`,
 *     `ՀԽՍՀ → [hχshə]`, `ՓԲԸ → [pʰəbə]` — vowel-less clusters, exactly what that seam exists to prevent.
 *     (`ՄԱԿ → [mɑk]` and `ՆԱՏՕ → [nɑto]` are already right.)
 *   · `NOT_VERSION` (traps 28/46). Deliberately ABSENT, which is the inverse of trap 28's 444-against-4.
 *     Every `\d+\.\d+`-glued-to-letters in the retained corpus is a DECIMAL — `3.2կմ`, `1.2Gbps`, `3.6Tbps`,
 *     `19.2Tbps`, `3.2մլրդ`, `0.5g`, `0.53կմ/կմ2`, `41.8կմ2`, `16.8կմ2` — ten instances, zero versions. A
 *     version guard here would reject ten true readings to protect a shape hy does not write.
 *   · `՛` (U+055B) ×9, every one an arc-minute in a coordinate; it is otherwise Armenian's emphasis mark,
 *     where silence is right. Left dropped.
 */
import { MANIFEST } from "./manifest.ts";
import { westernNumberWords } from "../../core/numbers.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import type { ArmenianDef } from "./armenian.ts";

const NUMBERS = loadManifest<ArmenianDef>(import.meta.url, "armenian.jsonc").numbers;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** An Armenian letter or a combining mark — the "inside a word" test. Never `\b` (trap 1), and `\p{M}` is
 *  present beside `\p{L}` because a guard that means "not inside a word" needs both (trap 23). */
/** Armenian lowercase letters, for a bound suffix. `և` (U+0587) sits outside the ա–ֆ range. */
const ARM_LOWER = "[\\u0561-\\u0586\\u0587]";

/**
 * The MAGNITUDE words, spelled and abbreviated. Both forms are needed and for different reasons: the
 * abbreviations are what the corpus writes (`159,681 մլրդ $`, `$2.81 տրլն`) and reach the IPA as
 * consonant clusters unless expanded (step 4), and the spelled forms are what the shared tier's currency
 * hop matches on afterwards. `տրիլիոն` is attested in the corpus spelled out (`$ 75 տրիլիոն`); `միլիոն`
 * and `միլիարդ` are already in the engine's own number data.
 */
const MAGNITUDE_ABBREV: readonly (readonly [string, string])[] = [
    ["մլրդ", "միլիարդ"],
    ["մլդ", "միլիարդ"], // a corpus spelling variant, ×1 (`1,3 մլդ կմ³`)
    ["տրլն", "տրիլիոն"],
    ["մլն", "միլիոն"],
    ["հզր", "հազար"],
];
/** The spelled magnitudes, used as the DECIMAL discriminator in step 1c. */
const MAGNITUDE_WORDS = ["միլիոն", "միլիարդ", "տրիլիոն", "հազար", "մլն", "մլրդ", "մլդ", "տրլն", "հզր"];

/**
 * Unit abbreviations handled LOCALLY, and only for the two shapes the shared tier cannot reach: a bound
 * suffix on the unit (`10 կմ-ից`, `2500 մ-ի`), and the same with an exponent in between (`մ²-ը`). The
 * plain `36 կմ` case goes through the tier in `armenian.ts`, which owns the guards.
 *
 * ⚠ `գ` IS DELIBERATELY ABSENT although "gram" is the obvious key: this corpus writes `գ.` for ԳՅՈՒՂ,
 * "village" (`գ. Աշխալա (Վրաստան…)`, `գ. Վաղուհաս`), so declaring it would read a village name as a mass.
 * Same class as fa's `کم`/`سم` (trap 38) — the graphemes are real elsewhere and are ordinary words here.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "կմ": "կիլոմետր",
    "սմ": "սանտիմետր",
    "մմ": "միլիմետր",
    "կգ": "կիլոգրամ",
    "հա": "հեկտար",
    // `դմ` — hy.wikipedia's քառակուսի կիլոմետր article writes "100 քառակուսի ԴԵՑԻՄԵՏՐ", and the corpus's
    // one instance is the concentration unit `մոլ/դմ³`, which was leaking as the cluster *dmə*.
    "դմ": "դեցիմետր",
    "մ": "մետր",
};
/** Longest-first, so `կմ` is tried before `մ` — the same ordering the shared tier's `unitAlt` uses. */
const UNIT_KEYS = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length);

/** The exponent measure words, in the position both sources put them: BEFORE the unit noun. */
const EXPONENT_WORD: Readonly<Record<string, string>> = { "²": "քառակուսի", "³": "խորանարդ" };

/**
 * The month names in the GENITIVE, which is the form the date frame takes — this corpus writes
 * `2020 թվականի ՆՈՅԵՄԲԵՐԻ 9-ին`, `1995 թվականի ՀՈՒԼԻՍԻ 5-ին`, `1998 թվականի ՀՈՒՆՎԱՐԻ 1-ից`. All twelve
 * are attested in it, and the genitive is the commonest form of every one of them (հունվարի ×5,
 * փետրվարի ×3, մարտի ×4, ապրիլի ×2, մայիսի ×1, հունիսի ×5, հուլիսի ×9, օգոստոսի ×4, սեպտեմբերի ×4,
 * հոկտեմբերի ×3, նոյեմբերի ×3, դեկտեմբերի ×7).
 */
const MONTH_GENITIVE: readonly string[] = [
    "հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
    "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի",
];

/** Read from the manifest — see the jsonc, where the evidence lives. */
const IRREGULAR_ORDINAL = MANIFEST.irregularOrdinals;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// NUMBER WORDS + ARMENIAN SUFFIX MORPHOPHONOLOGY
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Integer → the Armenian cardinal as SPACE-SEPARATED WORDS (the engine's own composer and spellings, so
 *  this pass and the tokenizer can never disagree about a numeral). `undefined` when it cannot compose. */
function cardinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0 || n > 999_999_999_999) return undefined;
    const parts = westernNumberWords(n, NUMBERS);
    if (parts.some((p) => p === null || p === "")) return undefined;
    return (parts as string[]).join(" ");
}

/**
 * Attach a CASE/ARTICLE suffix to a cardinal's last word, with the two stem changes the sources establish:
 *
 *   · `երկու` → `երկուս-`, a suppletive oblique stem — `երկուսի` ×4/2, `երկուսը` ×19/7 on hy.wikipedia.
 *   · a final `ը` DROPS (ինը → ին-, տասը → տաս-) — `տասին` ×3/2. ⚠ NOT the same change the ORDINAL makes,
 *     where the same stems take -ն- (իններորդ, տասներորդ). Two attested rules, kept separate on purpose.
 *
 * Everything else is consonant-final and glues directly: հինգ+ին → հինգին, քսան+ի → քսանի,
 * հազար+ին → հազարին (the last two attested).
 */
function attachSuffix(cardinal: string, suffix: string): string {
    const words = cardinal.split(" ");
    let stem = words[words.length - 1]!;
    if (stem.endsWith("երկու")) stem = `${stem}ս`;
    else if (stem.endsWith("ը")) stem = stem.slice(0, -1);
    words[words.length - 1] = `${stem}${suffix}`;
    return words.join(" ");
}

/**
 * Integer → the Armenian ORDINAL: the cardinal with `-երորդ` on its LAST word, and a final `ը` becoming
 * `ն` (ինը → իններորդ, տասը → տասներորդ). 1–4 are suppletive standalone only.
 *
 * The branch structure is what trap 13 says to pin: an irregular TABLE (1–4), a composition (everything
 * else), and the boundary between them — 4 vs 5 and 22, which is the case that proves the table does not
 * reach inside a compound. Attested at every branch: առաջին/երկրորդ/երրորդ/չորրորդ (corpus),
 * հինգերորդ/վեցերորդ/իններորդ/տասներորդ/տասնմեկերորդ/քսաներորդ/քսաներկուերորդ/քառասուներեքերորդ/
 * հիսուներորդ/վաթսուներորդ/հարյուրերորդ/հազարերորդ and the spaced "Հարյուր հիսուներորդ" (wiki).
 */
export function ordinalWords(n: number): string | undefined {
    const irregular = IRREGULAR_ORDINAL[n];
    if (irregular !== undefined) return irregular;
    const cardinal = cardinalWords(n);
    if (cardinal === undefined) return undefined;
    const words = cardinal.split(" ");
    let stem = words[words.length - 1]!;
    if (stem.endsWith("ը")) stem = `${stem.slice(0, -1)}ն`;
    words[words.length - 1] = `${stem}երորդ`;
    return words.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS — a numbered, order-dependent sequence. Each step states its coupling.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

const DIGITS_ONLY = /^\d+$/u;

/**
 * A WORD WITH ONE OF THE THREE MARKS WRITTEN INSIDE IT. Armenian does not put ՛ (շեշտ, emphasis),
 * ՜ (բացականչական, exclamation) or ՞ (հարցական, question) AFTER the word the way Latin punctuation does —
 * it writes them over the word's last vowel, i.e. in the middle of the letters. The tokenizer's word class
 * is Armenian letters, so every one of them SPLITS the word it belongs to, and the fragments are then
 * phonemized as separate words — schwa epenthesis and all:
 *
 *     կա՛մ     → kɑ mə        two words, and a schwa that is not in the language
 *     ո՛չ      → vo t͡ʃʰə      the ⟨ո⟩→[vo] initial glide fires on a one-letter fragment
 *     Տե՛ս     → te sə
 *     Ինչո՞ւ   → int͡ʃʰo ? və  the mark splits the ⟨ու⟩ DIGRAPH as well, so [u] becomes [o]+[v]+schwa,
 *                             and the question pause lands in the middle of the word
 *     Ինչպե՞ս  → int͡ʃʰpe ? sə
 *
 * Measured over FLEURS `hy_am` + `tools/corpus/mined/hy.jsonc` (4,465 unique lines): ՛ on 54 lines
 * (32 of them inside a word — կա՛մ, Խառնի՛ր, սեղմի՛ր, ո՛չ, լսե՛ք, ուշադի՛ր, ստուգե՛ք, Տե՛ս, Հիշի՛ր),
 * ՞ on 11 (15 inside a word, every one an interrogative — Ինչո՞ւ, Ինչպե՞ս, Արդյո՞ք, Գո՞ւցե, Որտեղի՞ց).
 * ⚠ NONE OF IT IS IN THE PARITY GOLDEN, which carries zero of all three marks — this is a defect only a
 * corpus-wide differential can see.
 *
 * ՛ and ՜ stay SILENT, which is the reading `clausePunctuation` already gives them (neither has an entry);
 * all this does is stop them breaking the word. ՞ is a real clause mark and MOVES to the end of the word,
 * where the tokenizer reads it as the question pause it is.
 *
 * ⚠ LETTERS ON BOTH SIDES, which is what keeps the ARC-MINUTE out: `41°24՛` is the other job ՛ does in this
 * corpus (×9, every one a coordinate) and it is digit-adjacent, so it never matches here and stays dropped.
 * ⚠ ՝ (U+055D) IS NOT IN THE CLASS. It is Armenian's own inter-word pause (1,096 instances, none inside a
 * word) and belongs exactly where it is written.
 * ⚠ ՜ IS UNATTESTED IN THIS CORPUS (×0) and is in the class anyway: it is the same mark — the third member
 * of the over-the-last-vowel series that Unicode and Armenian orthography both define together — and
 * leaving it out would keep one third of one defect alive for no measurement's sake.
 */
const INTRA_WORD_MARK = /[Ա-Ֆա-ևև]+(?:[՛՜՞][Ա-Ֆա-ևև]+)+/gu;
const MARK_CHARS = /[՛՜՞]/gu;

/** Eastern Armenian text normalization. Runs inside `text()`, before the shared symbol tier. */
export function normalizeArmenian(input: string): string {
    let s = input;

    // ── 0. THE MARKS WRITTEN INSIDE THE WORD — first, because every later rule that reaches for an
    //       Armenian letter (the bound suffixes, the era markers, the unit nouns) sees a broken word until
    //       this has run. See INTRA_WORD_MARK above for the measurement.
    s = s.replace(INTRA_WORD_MARK, (w) => {
        const bare = w.replace(MARK_CHARS, "");
        return w.includes("՞") ? `${bare}՞` : bare;
    });

    // ── 1. DE-GROUPING — FIRST, because a grouping mark is otherwise read as clause punctuation, which is
    //       precisely what `1 500 000 → mek hinɡhɑɾjuɾ zəɾo` was: three numbers and a spoken "zero".
    //
    //       ⚠ hy WRITES ALL FOUR CONVENTIONS AT ONCE — space, period and comma group; period and comma also
    //       mark the decimal. Reading every `\d{1,3}[.,]\d{3}` one way is wrong either way round
    //       (`1.380 կմ²` is 1,380 km²; `0,624 կմ²` is 0.624 km²). Every instance in the retained corpus was
    //       read by hand — 21 groupings against 13 decimals — and three signals separate them with no
    //       misclassification in either direction:
    //         (a) two or more groups             → grouping, unambiguously (3.018.854, 212,346,064)
    //         (b) integer part is `0`            → decimal (0,012 կգ · 0,624 կմ² · 0.951)
    //         (c) a MAGNITUDE word, `×`/`x` or `%` follows → decimal (159,681 մլրդ · 1,858 միլիարդ ·
    //             2.095 մլրդ · 6,022 × 10²³ · 0,022 %)
    //       and 1–2 digits after the separator is always a decimal (72 instances: 35,6 · 10.7 · 76.5%).

    // 1a. SPACE-grouped (36 hard / 5 sample): `29 743`, `36 260 130`, `1 500 000`, `250 000-ը`.
    s = s.replace(
        /(?<!\d)(?<!\d[.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)(?![.,]\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""),  // space, NBSP, NNBSP, thin space
    );
    // 1b. TWO OR MORE `.`/`,` groups — grouping with no ambiguity left to resolve.
    s = s.replace(
        /(?<!\d)(?<!\d[.,])([1-9]\d{0,2})((?:([.,])\d{3}){2,})(?!\d)(?![.,]\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[.,]/gu, ""),
    );
    // 1c. ONE `.`/`,` group. Grouping unless (b) or (c) fires. ⚠ A DOTTED DATE cannot reach this rule:
    //     `30.08.1918` and `8.11.1953` have TWO-digit groups, and the `[.,]`-excluding lookarounds on both
    //     edges stop the engine restarting inside the number (trap 52 — a lookbehind rejects a POSITION).
    const magAlt = MAGNITUDE_WORDS.join("|");
    s = s.replace(
        new RegExp(`(?<!\\d)(?<!\\d[.,])([1-9]\\d{0,2})[.,](\\d{3})(?!\\d)(?![.,]\\d)(\\s*(?:${magAlt})${NOT_LETTER_AFTER}|\\s*[×x%])?`, "gu"),
        (m, head: string, group: string, trailer: string | undefined) =>
            head === "0" || trailer !== undefined ? m : `${head}${group}`,
    );

    // ── 2. DOTTED D.M.YYYY DATES — before every other dot rule, because those dots are neither decimal
    //       points nor sentence ends and were being read as FULL STOPS: `28.11.1953` → *utʰ . tɑsnmek .
    //       hɑzɑɾ innhɑɾjuɾ hisun jeɾekʰ*, three numbers and two spurious clause breaks.
    //       11 instances in the retained corpus (nine of them in one biographical career list:
    //       `05.06.1914-19.07.1916`, `30.08.1918-1.1919`).
    //       The frame is the corpus's own: `<year> թվականի <month-GEN> <day>` — `2020 թվականի նոյեմբերի 9`.
    //       ⚠ The day/month ranges are checked, not assumed, so a three-part number that is not a date
    //       (a version, a dotted thousands survivor) cannot match; and the case ending is deliberately NOT
    //       added, because which case the day takes depends on the sentence and the corpus writes several
    //       (`9-ին`, `1-ից`, `27-ի`).
    s = s.replace(/(?<!\d)(?<!\d[.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)(?![.,]\d)/gu, (m, d: string, mo: string, y: string) => {
        const day = Number(d), month = Number(mo);
        if (day < 1 || day > 31 || month < 1 || month > 12) return m;
        return `${y} թվականի ${MONTH_GENITIVE[month - 1]!} ${day}`;
    });

    // ── 3. ERA MARKERS — before the generic abbreviation step, or its `թ.` arm would eat the marker's own
    //       dots. Both dot characters occur: ASCII `.` and U+2024 ONE DOT LEADER `․`, mixed inside one
    //       marker in this corpus (`մ.թ․ա․`), and U+2024 is DROPPED outright by the tokenizer.
    //       `Մ.թ.ա.-ն հապավվում է «Մեր թվարկությունից առաջ»` — hy.wikipedia, defining it.
    //       Longest first: `մ.թ.ա.` before `մ.թ.`
    const DOT = "[.\\u2024]";
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}[Մմ]${DOT}\\s?թ${DOT}\\s?ա${DOT}?`, "gu"), "մեր թվարկությունից առաջ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}[Քք]${DOT}\\s?ա${DOT}?`, "gu"), "Քրիստոսից առաջ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}[Մմ]${DOT}\\s?թ${DOT}`, "gu"), "մեր թվարկության");

    // ── 4. COORDINATE ABBREVIATION PAIRS — as PAIRS, never as single letters. `հս․ լ․` is north latitude
    //       and `արլ․ ե․` east longitude (7 instances), but a bare `լ.`/`ե.` is indistinguishable from a
    //       personal initial, of which this corpus has 40+ (`Ա.`, `Ս.`, `Գ.`, `Ի.`, `Ն.`). Widening to the
    //       single letter would be trap 9 exactly — a guard alternative with no attested instance.
    //       Both halves are spelled out elsewhere in the same corpus: "հյուսիսային լայնության 42-րդ …",
    //       "արևելյան երկայնության 21-րդ …".
    for (const [abbr, full] of [
        ["հս", "հյուսիսային"], ["հվ", "հարավային"], ["արլ", "արևելյան"], ["արմ", "արևմտյան"],
    ] as const) {
        s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${abbr}${DOT}\\s?լ${DOT}`, "gu"), `${full} լայնություն`);
        s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${abbr}${DOT}\\s?ե${DOT}`, "gu"), `${full} երկայնություն`);
    }

    // ── 5. SINGLE-DOT ABBREVIATIONS and the MAGNITUDE abbreviations. After step 3 (multi-dot first, or an
    //       interior dot survives as a phrase break) and after step 3.
    //       `թ.` = թվական ×313 in the corpus; `թթ.` its plural; `քառ.` = քառակուսի, named as an
    //       abbreviation of it by hy.wikipedia's own քառակուսի կիլոմետր article; `Սբ.` = Սուրբ.
    //       ⚠ `թ`/`թթ` REQUIRE A PRECEDING NUMERAL-OR-SUFFIX. Every corpus instance has one (`2005 թ.`,
    //       `1990-ական թթ.`), and `թ` alone is an ordinary Armenian letter.
    s = s.replace(new RegExp(`(\\d|${ARM_LOWER})\\s?թթ${DOT}`, "gu"), "$1 թվականներ");
    s = s.replace(new RegExp(`(\\d|${ARM_LOWER})\\s?թ${DOT}`, "gu"), "$1 թվական");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}քառ${DOT}`, "gu"), "քառակուսի");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}Սբ${DOT}`, "gu"), "Սուրբ");
    //       The magnitude abbreviations reach the IPA as consonant clusters otherwise ([mlɾd] + schwa), and
    //       the shared tier's currency hop can only match a SPELLED magnitude. Longest first.
    for (const [abbr, full] of MAGNITUDE_ABBREV)
        s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${abbr}${NOT_LETTER_AFTER}`, "gu"), full);

    // ── 6. ASCII EXPONENT ON A UNIT — `41.8կմ2`, `16.8կմ2-ը`, `0.53կմ/կմ2`. hy writes the power with a
    //       plain `2`/`3` as often as with `²`/`³` in this corpus (4 instances against 29). Folded to the
    //       superscript so ONE rule handles both; left alone it is trap 53's shape exactly — the tier
    //       re-emits the digit and `41.8կմ2` reads "…kilometres TWO", a quantity invented out of a power.
    //       Runs before steps 7–7b so the unit rules sees a single shape.
    s = s.replace(
        new RegExp(`([\\d/\\s])(${UNIT_KEYS.join("|")})([23])(?![\\d])${NOT_LETTER_AFTER}`, "gu"),
        (_m, lead: string, unit: string, p: string) => `${lead}${unit}${p === "2" ? "²" : "³"}`,
    );

    // ── 7. A UNIT (optionally with its power) CARRYING A BOUND SUFFIX — `10 կմ-ից`, `2500 մ-ի`,
    //       `1,6 միլիարդ մ²-ը`, `16.8կմ²-ը`. The shared tier matches the unit and leaves the suffix behind
    //       as a free word, so this claims the whole thing locally and glues the suffix to the unit NOUN
    //       (կիլոմետր+ից → կիլոմետրից, մետր+ի → մետրի; every unit word here is consonant-final).
    //       ⚠ BEFORE step 8, or the digit-suffix rule below would not see a unit at all — and before the
    //       tier, for the reason trap 39 gives: a guard's evidence has a lifetime.
    s = s.replace(
        new RegExp(`(\\d\\s?)(${UNIT_KEYS.join("|")})([²³]?)[-\\u2010\\u2011\\u2013\\u2014](${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"),
        (_m, lead: string, unit: string, power: string, suffix: string) => {
            const noun = UNIT_WORD[unit]!;
            const measure = power === "" ? "" : `${EXPONENT_WORD[power]!} `;
            return `${lead}${measure}${noun}${suffix}`;
        },
    );

    // ── 7b. A UNIT AFTER A SLASH — `13.3 մարդ/կմ²`, `65 հազար հա`, `մոլ/դմ³`. This is trap 54's `bar`
    //        case: the numerator is a COMMON NOUN (մարդ, "person") or an undeclared one, so the shared
    //        tier's rate branch has nothing to name and its digit-adjacency guard declines the whole
    //        match — leaving `կմ` to reach the IPA as the cluster *kmə*. 19 instances (կմ ×11, հա ×7,
    //        դմ ×1).
    //        ⚠ THE MEASURE WORDS ARE EMITTED DIRECTLY and no `per` word is invented — that relation is
    //        unsourced here, and trap 54's `sq mi` lesson is that the tidy-looking repair (rewrite into a
    //        shape the tier likes) is the one move this class must not make. The slash stays in the text
    //        and the tokenizer drops it, exactly as it did before; what changes is that the unit is read.
    //        ⚠ AND A UNIT AFTER A MEASURE WORD, for the same reason and one this pass CREATES: step 5
    //        expands `քառ. կմ` to `քառակուսի կմ`, at which point the unit is no longer digit-adjacent and
    //        the tier declines it — the fix has to close the leak it just made visible.
    s = s.replace(
        new RegExp(`((?:քառակուսի|խորանարդ)\\s)(${UNIT_KEYS.join("|")})(?![\\d])${NOT_LETTER_AFTER}`, "gu"),
        (_m, lead: string, unit: string) => `${lead}${UNIT_WORD[unit]!}`,
    );
    s = s.replace(
        new RegExp(`(/\\s?)(${UNIT_KEYS.join("|")})([²³]?)(?![\\d])${NOT_LETTER_AFTER}`, "gu"),
        (_m, lead: string, unit: string, power: string) =>
            `${lead}${power === "" ? "" : `${EXPONENT_WORD[power]!} `}${UNIT_WORD[unit]!}`,
    );

    // ── 8. THE BOUND SUFFIX ON DIGITS — trap 14, and this language's defining rule (66 per 200 uniform
    //       sample paragraphs). The operand becomes WORDS here because a digit cannot take a suffix: the
    //       digit becomes words in the TOKENIZER, downstream of every rule in this layer.
    //
    //       ⚠ THE DIGIT CLASS ENDS IN A DIGIT. Once a rule stops re-emitting its operand verbatim, a loose
    //       class starts eating punctuation — Welsh lost a clause comma exactly this way — so `\d[\d ]*\d`
    //       can never swallow the separator that follows it.
    //
    //       Three arms, ordered longest-key-first so `-րդ` is never read as the bare `-ր`:
    //         (a) ORDINAL `-րդ` ×78, plus whatever case follows it (`-րդն`, `-րդը`, `-րդի`, `-րդին`)
    //         (b) DECADE `-ական…` ×41 — `1950-ական` is "…հիսունական", the suffix on the last word
    //         (c) any other case/article suffix ×66 — `-ին -ի -ից -ը -ն -ով -ամյա -անոց -յակի`
    //       An unresolvable numeral (too large to compose) is left exactly as it was.

    // 7a. `19-20-րդ դարերի`, `6-5-րդ դարերի` — a RANGE whose ordinal suffix is written once, at the end.
    //     Claimed before the single ordinal so the first operand is not left as a bare cardinal with a
    //     dangling hyphen.
    s = s.replace(/(?<!\d)(?<!\d[.,])(\d{1,4})[-–](\d{1,4})-րդ(?![\p{L}\p{M}])/gu, (m, a: string, b: string) => {
        const first = ordinalWords(Number(a));
        const second = ordinalWords(Number(b));
        return first === undefined || second === undefined ? m : `${first}, ${second}`;
    });
    // 7b. ORDINAL.
    s = s.replace(
        new RegExp(`(?<!\\d)(?<!\\d[.,])(\\d[\\d ]*\\d|\\d)[-\\u2010\\u2011\\u2013\\u2014]րդ(${ARM_LOWER}*)${NOT_LETTER_AFTER}`, "gu"),
        (m, digits: string, tail: string) => {
            const bare = digits.replace(/ /gu, "");
            if (!DIGITS_ONLY.test(bare)) return m;
            const ord = ordinalWords(Number(bare));
            return ord === undefined ? m : tail === "" ? ord : attachSuffix(ord, tail);
        },
    );
    // 7c. DECADE and every other bound suffix, in one rule — they differ only in the suffix string.
    s = s.replace(
        new RegExp(`(?<!\\d)(?<!\\d[.,])(\\d[\\d ]*\\d|\\d)[-\\u2010\\u2011\\u2013\\u2014](${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"),
        (m, digits: string, suffix: string) => {
            const bare = digits.replace(/ /gu, "");
            if (!DIGITS_ONLY.test(bare)) return m;
            const card = cardinalWords(Number(bare));
            return card === undefined ? m : attachSuffix(card, suffix);
        },
    );

    // ── 9. RANGES — a PAUSE, not a joiner. AFTER step 8, which has already consumed `19-20-րդ` and
    //       `2100-ից`, so what is left here is a bare digit–dash–digit span (200,448 dump-wide).
    //       ⚠ BOTH EDGES exclude `-` as well as `[\d.,]`, which is what keeps `ISBN 0-521-27698-5` and the
    //       bibliographic `1480-1630. - 1. - Cambridge` out, and what stops the engine restarting INSIDE a
    //       dotted date (`30.08.1918-1.1919`) — trap 52: a lookbehind rejects a starting POSITION, not a
    //       string, so the operand itself has to be anchored on both sides.
    s = s.replace(/(?<!\d)(?<!\d[.,])(?<![-‐‑–—])(\d+(?:[.,]\d+)?)\s?[-‐‑–—]\s?(\d+(?:[.,]\d+)?)(?!\d)(?![.,]\d)(?![-‐‑–—])/gu, "$1, $2");

    // ── 10. PERCENT WITH A BOUND SUFFIX — `76.5%-ը`, `20%-ով`, `36,7 %-ը`, `70 %–ը`, `0.21% -ով`. The
    //       shared tier stops at the sign and would leave the suffix to be read as a bare vowel (`20%-ով`
    //       → *kʰəsɑn ov*), so the suffixed form is claimed here and the plain `5 %` is left to the tier.
    //       `տոկոս` is consonant-final, so the suffix glues: տոկոսը, տոկոսով, տոկոսի, տոկոսից.
    s = s.replace(new RegExp(`\\s?%\\s?[-\\u2013\\u2014]\\s?(${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"), " տոկոս$1");

    // ── 11. DEGREES. `°C` is a temperature and a bare `°` is a coordinate or an unscaled temperature; both
    //        occur here (13 and 10). ⚠ THE SCALE LETTER MAY BE CYRILLIC — this corpus writes `+15.2°С` and
    //        `+26-28°С` with U+0421, which is not folded for a non-Cyrillic host, and the Latin `C` was
    //        reaching the IPA as the ENGLISH letter name (`20 °C` → *kʰəsɑn sˈiː*).
    //        `°F` is ×0 here and is deliberately left untouched rather than given an unsourced scale name.
    //        A bound suffix on the degree is handled first (`35,6°-ից`), same reason as step 9.
    s = s.replace(
        new RegExp(`(\\d)\\s?°\\s?[CСc]?\\s?[-\\u2013](${ARM_LOWER}+)${NOT_LETTER_AFTER}`, "gu"),
        "$1 աստիճան$2",
    );
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}\p{M}])/gui, "$1 Ցելսիուսի աստիճան");
    s = s.replace(/(\d)\s?°(?![\p{L}\p{M}])/gu, "$1 աստիճան");

    // ── 12. MINUS — narrow, and the narrowness is the whole argument (trap 24). Every minus-shaped
    //        instance in the retained corpus was read: 4 true negatives (`-4.9 %`, `-0,018 %`, `-20 °C`,
    //        `−15 °C`), 6 ranges, 4 bibliographic separators, 2 identifiers, 5 markup. **All four true
    //        negatives are followed by a percent or a degree word**, which is hi's discriminator reached
    //        from this corpus rather than borrowed: when the left context is exhausted, the right one
    //        decides. Runs AFTER step 11, so the degree is already a WORD to look for.
    //        `մինուս`: hy.wikipedia ×28/2, in the article defining the + and − signs.
    s = s.replace(
        /(^|[\s(«՝])[-−–]\s?(\d[\d ]*(?:[.,]\d+)?)(?=\s?(?:%|աստիճան|Ցելսիուսի))/gmu,
        "$1մինուս $2",
    );

    // ── 13. DECIMALS — LAST among the number rules, because this step SPENDS the `.`/`,` that steps 1c, 2 and
    //        9 need to make their decisions (trap 39: a guard's evidence has a lifetime).
    //        `ամբողջ` is the word hy.wikipedia reads aloud between the halves — «զրո ամբողջ ինը պարբերական»
    //        for 0.(9) — and the fractional part is a plain cardinal, so it is left as DIGITS for the
    //        engine's own number path (trap 20's default: emit digits, then check what the numeral rules
    //        do to them — here nothing, hy has no counting-two).
    //        ⚠ Both lookarounds exclude `[.,]`, which is what keeps a dotted date (`30.08.1918`,
    //        `8.11.1953`, `22.9.1992`) and a de-grouping survivor out of this rule entirely.
    //
    //        ⚠ A LEADING ZERO IN THE FRACTION IS A SILENT 10× ERROR OTHERWISE, which is trap 56's worst
    //        shape: `0,012 կգ` left as digits reads *զրո ամբողջ ՏԱՍՆԵՐԿՈՒ*, i.e. 0.12 — a well-formed
    //        Armenian numeral, ten times too big, and invisible to DIGIT, RAWMARK, DROP and the referee
    //        alike. Five of the ~200 retained decimals have one (`0,012`, `0,018`, `0,022`, `0,023`,
    //        `2.095`). Each leading zero is spelled with the engine's own units[0] and the REST STAYS
    //        DIGITS — deliberately, because words here would destroy the number-unit adjacency the shared
    //        tier matches on (the playbook's "units before decimals" coupling) and `0,012 կգ` would lose
    //        its kilogram. The alternative reading, a denominator ordinal (*…հազարերորդ*), is composable
    //        from the attested series but costs exactly that adjacency, so it is not taken.
    s = s.replace(/(?<!\d)(?<!\d[.,])(\d+)[.,](\d+)(?!\d)(?![.,]\d)/gu, (_m, int: string, frac: string) => {
        const zeros = /^0*/u.exec(frac)![0].length;
        const rest = frac.slice(zeros);
        const spelledZeros = Array.from({ length: zeros }, () => NUMBERS.units[0]!).join(" ");
        return [`${int} ամբողջ`, spelledZeros, rest].filter((p) => p !== "").join(" ");
    });

    // ── 14. FRACTIONS — `3/4`, `4/4`, `2/4`. The construction is attested in the corpus itself:
    //        `մեկ վեցերորդը`, "one sixth" — numerator as a cardinal, denominator as an ORDINAL.
    //        ⚠ THE DENOMINATOR CAP IS THE GUARD, and it is measured. Of the 13 slash-shapes retained,
    //        exactly three are fractions; the rest are `538/537` and `1877/78` and `1997/98` (year
    //        alternatives), `18.7/1000` (a rate), `3/14` and `3/14/15` (US-format DATES) and `կմ/կմ²`.
    //        Requiring a denominator of 10 or less, a numerator no larger than it, whole digits on both
    //        sides and no second slash admits the three and refuses all ten — including `3/14`, which a
    //        looser cap would have read as "երեք տասնչորսերորդ".
    //        Runs after step 13 so a decimal numerator has already become words and cannot match.
    s = s.replace(/(?<!\d)(?<!\d[.,])(?<!\/)(\d{1,2})\/(\d{1,2})(?!\d)(?![.,]\d)(?!\/)/gu, (m, nRaw: string, dRaw: string) => {
        const n = Number(nRaw), d = Number(dRaw);
        if (d < 2 || d > 10 || n > d) return m;
        const num = cardinalWords(n), den = ordinalWords(d);
        return num === undefined || den === undefined ? m : `${num} ${den}`;
    });

    return s;
}
