/**
 * Oromo / Afaan Oromoo (om) TEXT NORMALIZATION (#562) — the pre-tokenizer pass that rewrites everything
 * which is not already a pronounceable word into words the existing pipeline speaks. Pure text→text, no IPA.
 *
 * MEASURED over the 1,218 unique cased om_et FLEURS utterances (column 3):
 *   digit + GLUED ENCLITIC ×35   1994tti · 2010’tti · 5’tti · 500tti · 30tu · 15tu · 2020f · 10if · 7ttan
 *                                · 2,243n · 3n · 27tiin          ← the language's defining shape (trap 14 (agreement cannot be applied to digits))
 *   digit + `-ffaa` ORDINAL ×24  16ffaa ×4 · 18ffaa ×3 · 1ffaa ×2 · 15ffaatti ×2 · 190ffaa · 60ffaadha
 *                                · 11ffaan · 17ffaaf · 8ffaadhaa · 2ffaa’ti
 *   comma-grouped ×28            783,562 · 24,000 · US$11,000 · 2,243n · 10,000
 *   dot-decimal ×14              2.3 · 6.34 · 3.7 · 1.5 · 12.8 · 1.1. (+ 12.00 GMT · 15.00 UTC · 802.11n)
 *   range ×11 / score ×3         1644-1912 · 1995-96 · 100-200 · km 2-3 · 35-40 | 26-00 · 5-3 · 7-2
 *   clock ×8                     11:00 · 07:19 · 09:19 GMT · 8:46 a.m. · 8:30 tti · 1:15 a.m tti · 10:00
 *   currency ×5                  Biliyoona $2.3 · US$11,000 · haga $22,500 · $ 1000 · miiliyoona £27tiin
 *   units ×8                     mm 5 · mm 36 · mm 24n · km 6,387 · km 2-3 · 165km/h · 300,948 sq mi ×3
 *   percent ×3 · degrees ×1 (35°W) · math sign ×1 (=) · era ×1 (D.K.D) · fraction ×1 (1/5) · &amp; ×1
 *   dotted abbrev ×8             Dr. · Jr. ×4 · N. Wayne · kkf. · fkn. ×2   — beside ~40 SENTENCE-FINAL
 *                                periods, which must NOT be claimed (trap 4 (ambiguity is resolved by evidence))
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `88% galche`     → `sadːeːtːamˈiː sadːˈeːt ɡˈalt͡ʃe`             the % dropped
 *   `US$11,000`      → `ˈus kˈuᶑa tˈokːo , zeːrˈoː`                 $ dropped, grouping comma → PAUSE
 *   `Biliyoona $2.3` → `bilijˈoːna lˈama . sadˈiː`                  $ dropped, decimal dot → SENTENCE pause
 *   `783,562`        → `… sadˈiː , ᶑˈibːa ʃˈan d͡ʒaːtamˈiː lˈama`   one number read as two
 *   `jaarraa 16ffaa` → `d͡ʒaːrːˈaː kˈuᶑa d͡ʒˈaha fːˈaː`             the ordinal suffix as a standalone
 *                                                                   [fːaː] — a word-initial geminate
 *   `1994tti`        → `… saɡaltamˈiː afˈur tːˈi`                   the enclitic as a standalone [tːi]
 *   `2020f`          → `… diɡdˈama f`                               a bare [f]
 *   `11:00 booda`    → `kˈuᶑa tˈokːo , zeːrˈoː bˈoːda`              colon → clause pause, 00 → *zeeroo*
 *   `8:46 a.m.`      → `sadːˈeːt , afurtamˈiː d͡ʒˈaha ˈa . m .`     pause + a.m. letter-spelled
 *   `(1644-1912)`    → two cardinals, no joiner                     the range hyphen dropped
 *   `35°W`           → `sodːomˈiː ʃˈan w`                           ° dropped, W as [w]
 *   `mm 5` / `sq mi` → `mː ʃˈan` / `skʼ mˈi`                        unit letters read as Qubee (GEMINATE m)
 *   `165km/h`        → `… ʃˈan km h`                                the rate raw
 *   `D.K.D 5000`     → `d . k . d kˈuma ʃˈan`                       era marker letter-spelled, two pauses
 *   `inchii 1/5`     → `int͡ʃˈiː tˈokːo ʃˈan`                       fraction as two bare cardinals
 *   `-5 +5 A&B x = y 5 < 6 6 × 6`                                   every sign class silently dropped
 *
 * TWO ORTHOGRAPHIC FACTS THAT SHAPE EVERY RULE.
 *
 * 1. **Oromo is head-initial for measure phrases**: the corpus writes the NOUN BEFORE the number —
 *    `paawundii 200`, `mm 5`, `km 6,387`, `iskuweer kiloometiiri 783,562`, `daqiiqaa 3`, `sa’aatii 24`,
 *    `parsantii 3 hanga 5`, `doolaara US biiliyoonotaan`, `miliyoona 2.3`. Hence `percentPrefix` and
 *    `currencyPrefix` on the tier (oromo.ts), and hence units are emitted BEFORE their number here rather
 *    than declared to the tier, which can only postpose them.
 * 2. **Enclitics are written glued to the DIGITS** (`1994tti`, `16ffaa`, `2,243n`). The digit becomes words
 *    in the TOKENIZER, downstream of this whole layer, so the suffix cannot be left on the digits — it has
 *    to be attached to the WORD, with the linking vowel the word's shape demands. That is trap 14 (agreement cannot be applied to digits), and it
 *    is the biggest defect class in this corpus.
 *
 * WHY THERE ARE TWO PASSES, and what runs between them. `oromo.ts` composes
 *     normalizeOromoNumerals( SYMBOLS( normalizeOromo(input) ) )
 * The shared symbol tier matches DIGITS next to a sign, so anything that turns digits into words must run
 * AFTER it (trap 14 (agreement cannot be applied to digits)'s "expand anything the shared tier can no longer see", taken from the other end). Both
 * of the rules that words-ify — the enclitic/ordinal rule and the decimal rule — therefore live in the
 * SECOND pass, and the tier gets `£27tiin` and `$2.3` intact. This is what lets the currency and percent
 * WORDS live in exactly one place (the tier's declaration) instead of being duplicated here.
 *
 * SOURCING. Every word below is traceable; see docs/investigations/om_normalization_investigation.md,
 * Run 4, for the evidence table. The one word with a single source is `ida’uu` (+), from espeak's
 * `om_list` alone — and `+` has zero corpus instances. The temperature SCALE names (Celsius/Fahrenheit)
 * could not be sourced in any repo source, so `°C` reads *digirii N* and the scale letter is left unread
 * rather than guessed.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA — every literal here is corpus- or espeak-attested; the evidence is in the investigation log.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The decimal point, from the manifest so there is ONE source of truth (`"decimalWord": "tuqaa"`).
 *  espeak `om_list` `_dpt`/`_.` → *tuqaa*; the corpus writes *sirna tuqaalee* (the system of dots =
 *  punctuation) and *tuqaa 76* (points). */
const POINT = loadManifest<{ decimalWord: string }>(import.meta.url, "oromo.jsonc").decimalWord;

/**
 * OROMO LETTER NAMES — the Qubee alphabet's own CV names, read straight off espeak-ng `dictsource/om_list`
 * lines 42–67, which carries all 26: `b  ba:`, `c  tS\`a:`, `q  k\`a:`, `x  t\`a:`, `n  na` (short, the one
 * exception). Transcribed back into Qubee orthography, so the g2p produces espeak's own phonemes — verified
 * by round-trip: baa→[bˈaː], caa→[t͡ʃʼˈaː], qaa→[kʼˈaː], xaa→[tʼˈaː].
 *
 * This was #602's largest deferral (64 instances, `PTWC` → [ptʼwt͡ʃʼ]), left with the note that om_list
 * "carries the full Oromo letter-name inventory, so an initialism pass is sourceable". `sources.ts` now
 * reports it as WIREABLE-not-wired, which is what brought it back.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "aa", b: "baa", c: "caa", d: "daa", e: "ee", f: "faa", g: "gaa", h: "haa", i: "ii",
    j: "jaa", k: "kaa", l: "laa", m: "maa", n: "na", o: "oo", p: "paa", q: "qaa", r: "raa",
    s: "saa", t: "taa", u: "uu", v: "vaa", w: "waa", x: "xaa", y: "yaa", z: "zaa",
};

/** Oromo phonotactics for the OOV rule. Oromo is strongly CV: it permits essentially NO complex onset, so
 *  the onset test alone spells DNA, FBI, MRI, GPS, GMT and TV without any of them needing a data entry.
 *  The few clusters listed are the ones the corpus's own words actually begin with. */
export const isUnreadableOromo = makeUnreadableTest({
    vowels: /[aeiou]/u,
    legalOnsets: new Set(["dh", "ch", "ny", "ph", "sh"]),
    legalCodas: new Set(["rk", "rt", "rs", "nt", "nd", "mb", "lt", "st"]),
});

/**
 * INITIALISM PASS. ORDERING: `core/roman.ts` is applied in `registry.ts`, wrapping `engine.text()`, so a
 * Roman numeral is already digits before this file runs — which also means the vowel letter name `ii` this
 * table emits is never seen by the Roman pass. That matters: a standalone `ii` DOES read as *lama* (two)
 * through the registry, and if the ordering were reversed every `MRI` would end in "two". Pinned by a test.
 * Oromo has no pronunciation dictionary — its g2p is rule-based — so `isRecorded` is always false.
 */
export function normalizeOromoInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: new Set(loadManifest<{ acronymLetters: string[] }>(import.meta.url, "oromo.jsonc").acronymLetters),
        isRecorded: () => false,
        isUnreadable: isUnreadableOromo,
    })(text);
}

/** Measure nouns, in the corpus's own spellings. Emitted BEFORE the number (fact 1 above). */
const UNIT: Readonly<Record<string, string>> = {
    km: "kiiloomeetira",     // corpus ×2 (also kiilomeetira, kiiloo meetira)
    m: "meetira",            // corpus ×3
    mm: "miiliimeetira",     // corpus: miiliimeetirii 35
    cm: "seentiimeetira",    // NOT corpus-attested; the regular Qubee compound of the above (0 instances)
    kg: "kiiloo giraama",    // corpus ×1 (kiiloo giraama 90)
    mi: "maayilii",          // corpus ×16
};
/** Rate denominators, already in the LOCATIVE — the corpus's own way of saying "per": *sekoondiitti
 *  meeggaabiitii 600* ("600 megabits per second"), *sa’aatii tokkotti kiilomeetira 56-64*. The denominator
 *  leads the phrase, so this is not the tier's "A per B" idiom and cannot be expressed with `unitPer`. */
const PER: Readonly<Record<string, string>> = { h: "sa’aatiitti", s: "sekoondiitti" };

/** Compass points for a bearing — all four corpus-attested. */
const COMPASS: Readonly<Record<string, string>> = { N: "kaaba", S: "kibba", E: "bahaa", W: "dhihaa" };

const VOWELS = "aeiou";
const isVowel = (c: string): boolean => VOWELS.includes(c);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// MORPHOLOGY — attaching an enclitic to a NUMERAL WORD (trap 14 (agreement cannot be applied to digits))
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The ORDINAL stem. Composed, not tabulated (trap 13 (pin the rule's BRANCHES)'s constructive half): the corpus's own spelled-out
 * ordinals are *tokkoffaa · lamaffaa · sadaffaa · afuraffaa · shanaffaa · jahaffaa · torbaffaa ·
 * saglaffaa · saddeetaffa[a] · digdammaffaa*, and one rule fits all of them —
 *   final `ii` → `a`      sadii → sadaffaa
 *   other vowel → as-is   tokko → tokkoffaa, lama → lamaffaa, jaha → jahaffaa, digdama → digdamaffaa
 *   consonant → link `a`  afur → afuraffaa, shan → shanaffaa, sagal → sagalaffaa, saddeet → saddeetaffaa
 * (The corpus's *lammaffaa · afraffaa · saglaffaa · digdammaffaa* are the syncopated/geminated variants;
 * the unsyncopated form of each is attested too, so the rule emits the regular one.) Because it composes
 * from the CARDINAL, it is right at 8, 10 and 190 — values the corpus never writes as digits+ffaa.
 */
function ordinalStem(word: string): string {
    if (word.endsWith("ii")) return `${word.slice(0, -2)}a`;
    return isVowel(word.at(-1)!) ? word : `${word}a`;
}

/**
 * Attach a case enclitic to a numeral word. Two classes, both read off the corpus (Run 5):
 *   -n and -f take a LONG link — *tokkoon* ×7, *lamaan* ×9, *sadiin* ×2, *shaniin*, *saddeetiin*,
 *     *tokkoof* ×6, *jahaaf*, *sadiif* ×3, *saddeetiif* — i.e. a short final vowel is lengthened and a
 *     consonant-final stem takes `ii`.
 *   -tti/-ti/-tu/-tiin/-ttan take a SHORT link — *tokkotti* ×7, *lamatti* ×2, *tokkotu*, and a
 *     consonant-final stem takes `i` (*afuri*, *kudhanii* attest the linking vowel).
 */
function attachEnclitic(word: string, suffix: string): string {
    const last = word.at(-1)!;
    const long = suffix === "n" || suffix === "f";
    if (!isVowel(last)) return `${word}${long ? "ii" : "i"}${suffix}`;
    if (!long) return `${word}${suffix}`;
    return word.at(-2) === last ? `${word}${suffix}` : `${word}${last}${suffix}`; // lengthen a short vowel
}

/** A number (possibly decimal) → Oromo words, with `POINT` between the parts and the fraction read
 *  digit by digit — the reading the decimal rule below produces for the un-suffixed case. */
function numeralWords(num: string): string {
    const [int, frac] = num.split(".");
    const head = numberToWords(Number(int));
    if (frac === undefined) return head;
    return `${head} ${POINT} ${[...frac].map((d) => numberToWords(Number(d))).join(" ")}`;
}

/** The written enclitics, longest-first. ONLY the shapes the corpus glues to digits (trap 9 (a guard alternative with no attested…)): a guard
 *  alternative with no attested instance is a misfire generator.
 *  DELIBERATELY EXCLUDED — `ni` and `fi` are Oromo WORDS (`1fi2` is a missing space, not a suffix);
 *  `moota`/`ootaa` are the decade plural (`1850moota`, `1980’ootaa`, ×4) for which no attachment to a
 *  numeral stem is attested, so they keep the current separate-word reading; `dha` occurs only as an
 *  `-ffaa` trailer, where it is handled by concatenation. */
const ENCLITIC = "ttan|tiin|tti|ti|tu|if|f|n";

/** The same enclitics WRITTEN WITH A SPACE — `bara 1945 tti`, `sa’aatii 24 f`, `qabxii 2,207 n`. The
 *  corpus detaches them in 24 unique utterances, against ~35 glued ones, and the reading is the same
 *  impossibility either way: a standalone `tti` is the word-initial geminate [tːi], a standalone `f`/`n` a
 *  bare consonant. Detaching a bound postposition is an orthographic slip, not a word boundary.
 *  A NARROWER ALTERNATION than `ENCLITIC`, and deliberately so (trap 9 (a guard alternative with no attested…) — pin what was counted): spaced,
 *  the corpus writes only `tti` ×19, `ti` ×2, `tiin` ×1, `f` ×1, `n` ×1. Leaving `tu` out is not
 *  bookkeeping — `tu` IS an Oromo word, the focus marker (`Caribe tu jiraata`), and only the absence of a
 *  space distinguishes the two. `fi` is safe by construction: the trailing letter guard rejects `f` + `i`. */
const ENCLITIC_SPACED = "tiin|tti|ti|f|n";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// PASS 1 — everything that leaves the digits alone, so the shared symbol tier can still see them
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Oromo input string, BEFORE the shared symbol tier. Steps are ORDER-DEPENDENT; each
 *  states its evidence and its coupling. */
export function normalizeOromo(input: string): string {
    let s = input;

    // 1) AMPERSAND — the corpus's one instance is the HTML entity (`B&amp;B’ootaan`). *fi* = "and":
    //    espeak `om_list` `_&` → fi, and the corpus writes it several hundred times. FIRST, so the bare
    //    `&` rule below cannot see a half-decoded entity.
    s = s.replace(/&amp;/giu, " fi ");
    s = s.replace(/&/gu, " fi ");

    // 2) DIGIT DE-GROUPING — `783,562`, `24,000`, `US$11,000`, `2,243n` (×28). The playbook's standing
    //    first coupling: otherwise the grouping comma is read as clause punctuation, which is exactly
    //    what the corpus produced (`ᶑˈibːa tˈorba … sadˈiː , ᶑˈibːa ʃˈan …` — one number as two).
    //    THREE-digit blocks only; a 1–2 digit block after a comma is a decimal, and the corpus has none
    //    (`\d,\d{1,2}(?!\d)` → 0 instances), but the decimal rule in pass 2 still covers it.
    s = s.replace(/(?<=\d),(?=\d{3}(?![\d]))/gu, "");

    // 3) ERA MARKER — `D.K.D 5000` (×1). *dhaloota Kiristoos dura* ("before the birth of Christ") is the
    //    corpus's own spelled-out form, ×3. BEFORE the dotted-abbreviation step (playbook coupling:
    //    era markers before generic abbreviations), else the interior dots become phrase breaks.
    s = s.replace(/(?<![\p{L}\p{M}])D\.?K\.?D\.?(?![\p{L}\p{M}])/gu, "dhaloota Kiristoos dura");

    // 4) DOTTED ABBREVIATIONS. The corpus writes 8 of them beside ~40 SENTENCE-FINAL periods, so each
    //    shape is claimed by name (trap 4 (ambiguity is resolved by evidence) — the German bare-ordinal method) and nothing generic runs:
    //    zero sentence-final pauses may be lost.
    //      `fkn.` ×2 → fakkeenyaaf         (corpus ×7, "for example")
    //      `kkf.` ×1 → kan kana fakkaatan  (corpus ×2, "and the like")
    //      `Dr.` `Jr.` ×4 `N. Wayne` — foreign name abbreviations with NO sourced Oromo expansion: drop
    //      only the DOT, which removes the spurious mid-sentence break and changes nothing else.
    s = s.replace(/(?<![\p{L}\p{M}])fkn\.(?![\p{L}\p{M}])/giu, "fakkeenyaaf");
    s = s.replace(/(?<![\p{L}\p{M}])kkf\.(?![\p{L}\p{M}])/giu, "kan kana fakkaatan");
    s = s.replace(/(?<![\p{L}\p{M}])(Dr|Jr|Sr|Mr|Mrs|Prof)\.(?![\p{L}\p{M}])/gu, "$1");
    // A single capital INITIAL before a capitalized name (`N. Wayne Hale`). The lookbehind keeps a
    // sentence-final period safe: in `… hidhee ture. I`, the `e` before the period is a letter.
    s = s.replace(/(?<![\p{L}\p{M}.])(\p{Lu})\.(?=\s+\p{Lu})/gu, "$1");

    // 5) CLOCK, colon form (×8) — `11:00`, `07:19`, `8:46 a.m.`, `1:15 a.m tti`. Read as
    //    `H fi daqiiqaa M`: *daqiiqaa* ("minute") is corpus-attested before its number (`daqiiqaa 3 dura`)
    //    and *fi* is the ordinary conjunction; the hour noun *sa’aatii* is NOT added, because the corpus
    //    already writes it before 5 of the 8 (`sa’aatii 10:00`, `sa’a 1:15`) and saying it twice is
    //    trap 12 (a REDUNDANT symbol is a permissible drop). `:00` reads as the bare hour, never *zeeroo*.
    //    NOT a clock: `qabxii 2:2` (a British degree classification, ×1) — the minutes must be TWO digits,
    //    which is what keeps that instance out. A third `.dd` field would be a sports time; none occur.
    //    a.m./p.m. → *ganama* / *galgala*, the corpus's own half-day words (`ganama keessaa 07:19`).
    s = s.replace(
        /(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)(?![\p{L}\p{M}]))?/gu,
        (m0, h: string, min: string, ap: string | undefined) => {
            const head = Number(min) === 0 ? String(Number(h)) : `${Number(h)} fi daqiiqaa ${Number(min)}`;
            const half = ap === undefined ? "" : ap.toLowerCase().startsWith("p") ? " galgala" : " ganama";
            return `${head}${half}`;
        },
    );

    // 6) CLOCK, dot form before a TIMEZONE — `12.00 GMT`, `15.00 UTC` (×2). The dot is otherwise a
    //    decimal; the timezone after two-digit minutes is what marks it. BEFORE any decimal handling
    //    (playbook: times before the rules that claim a bare number).
    s = s.replace(/(?<![\d.,])(\d{1,2})\.([0-5]\d)(?![\d.])(?=\s*(?:UTC|GMT)(?![\p{L}\p{M}]))/gu,
        (_m, h: string, min: string) =>
            Number(min) === 0 ? String(Number(h)) : `${Number(h)} fi daqiiqaa ${Number(min)}`);

    // 7) a.m./p.m. NOT attached to a clock — the corpus has none, but the marker is only ever readable as
    //    the half-day word, and leaving it spells `ˈa . m .` with two pauses.
    s = s.replace(/(?<![\p{L}\p{M}])([Aa]\.[Mm]|[Pp]\.[Mm])\.?(?![\p{L}\p{M}])/gu,
        (m0) => (m0.toLowerCase().startsWith("p") ? "galgala" : "ganama"));

    // 8) VERSION DOT — `802.11n` (×1). A single letter glued after a dotted number is a designation, not
    //    a decimal with an enclitic; spacing the letter off keeps the sentence pause out. BEFORE the
    //    enclitic rule in pass 2, which would otherwise read `802.11n` as a number with an `-n` suffix.
    //    The single-letter guard is what keeps `1.5tti` (3 letters) for the enclitic rule.
    //    THE LETTER IS SET OFF BY A HYPHEN, not a space, and the corpus diff is why: with a space,
    //    `802.11n` became `802 tuqaa 1 1 n` — a digit, a space and an `n`, which is indistinguishable from
    //    the corpus's detached enclitic (`2,207 n`), so rule 14b read the Wi-Fi standard's letter as a case
    //    suffix and said *tokkoon*. The tokenizer skips a hyphen (it matches only letters, digits and
    //    clause marks), so the reading is unchanged and the shape is no longer ambiguous.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?=[a-z](?![\p{L}\p{M}]))/gu,
        (_m, i: string, f: string) => `${i} ${POINT} ${[...f].join(" ")}-`);

    // 9) RANGES — 11 in the corpus, against 3 SCORES that must not be claimed. *hanga* ("up to") is
    //    attested ×6 as an INFIX between two numbers (`8 hanga 100`, `340 hanga 500tti`, `100 hanga 250`,
    //    `US$11,000 haga $22,500`) — the Fula part-of-speech check, passed.
    //    THE DISCRIMINATOR IS DIRECTION, and it is measured: all ELEVEN ranges ascend (2-3, 2-5, 35-40,
    //    56-64, 100-200, 120-160, 328-820, 1644-1912, 1894-1895, 1418-1450, 1995-96) and all THREE scores
    //    descend (26-00, 5-3, 7-2 — a winning score is written winner-first). A descending range or an
    //    ascending score would be misread; that is the known limit, and it is preferable to a list of
    //    measure nouns, which would be silent on every noun the corpus happens not to contain (trap 8 (zero corpus instances is not evidence of…)).
    //    A year span is claimed first, because `1995-96` is ascending only as a year (96 < 1995).
    //     An ORDINAL range first of all — `jaarraa 10ffaa - 11ffaa` ("the 10th–11th century", ×1). The
    //     mined artifact's `ordinal-range` cell reports 0 for om and this instance is why that count is
    //     not evidence (trap 8 (zero corpus instances is not evidence of…)): without the rule the corpus diff caught the hyphen being read as a MINUS.
    s = s.replace(/(?<![\d.,-])(\d+)ffaa\s*[-–]\s*(\d+)ffaa(?![\d.,-])/gu, "$1ffaa hanga $2ffaa");
    s = s.replace(/(?<![\d.,-])(\d{4})\s?[-–]\s?(\d{2,4})(?![\d.,-])/gu, "$1 hanga $2");
    s = s.replace(/(?<![\d.,-])(\d+)\s?[-–]\s?(\d+)(?![\d.,-])/gu,
        (m0, a: string, b: string) => (Number(b) > Number(a) ? `${a} hanga ${b}` : m0));

    // 10) FRACTION — `inchii 1/5` (×1). Oromo puts the DENOMINATOR first with *keessaa* ("out of"),
    //     which the corpus writes ×106 in exactly that slot (`filannoof dhihaatan 17,000 keessaa`).
    //     Composed rather than tabulated on the one attested numerator, which is the Uzbek `3/4` defect
    //     (trap 8 (zero corpus instances is not evidence of…)): every numerator and denominator reads the same way here.
    s = s.replace(/(?<![\d/.,])(\d{1,3})\/(\d{1,3})(?![\d/.,])/gu, "$2 keessaa $1");

    // 11) DEGREES — `35°W` (×1), a longitude. *digirii* is corpus-attested (×2, as the academic degree —
    //     Oromo borrows the one word) and is in the epitran referee. The compass words are all in the
    //     corpus. °C/°F have ZERO corpus instances and are probed anyway (trap 8 (zero corpus instances is not evidence of…)): the SCALE NAMES are in
    //     no source this repo has — not the corpus, not either referee, not espeak's `om_list` — so the
    //     reading stops at *digirii N*. Note what that costs: the `[CF]?` CONSUMES the letter, so the
    //     scale is dropped, not merely left unnamed. Deliberate, and the lesser of two wrongs — unconsumed,
    //     a bare `C` reads as the Qubee ejective [t͡ʃʼ], a phoneme rather than a word — but it is a drop,
    //     and it stays a drop until Celsius/Fahrenheit can be sourced.
    s = s.replace(/(\d+)\s?[°º]\s?([NSEW])(?![\p{L}\p{M}])/gu,
        (_m, n: string, c: string) => `digirii ${n} ${COMPASS[c]!}`);
    s = s.replace(/(\d+)\s?[°º]\s?[CF]?(?![\p{L}\p{M}])/gu, "digirii $1");

    // 12) UNITS — emitted BEFORE the number (fact 1), which is why they are not declared to the shared
    //     tier: it can only postpose them. The corpus writes the abbreviation on either side
    //     (`mm 5`, `km 6,387`, `165km/h`, `300,948 sq mi`) and the noun-first spelled form always
    //     (`iskuweer kiloometiiri 783,562`, `paawundii 200`). AFTER the range step, so `km 2-3` has
    //     already become `km 2 hanga 3` and the unit still leads it.
    //     (a) RATE first — `(165km/h)`. The `(?![\p{L}])` guard on the plain-unit rules is satisfied by
    //         the `/`, so a later rate would have already lost its numerator.
    //     ⚠ THE MULTIPLICATION SIGN RUNS BEFORE THE UNIT BLOCK, and it is the ONLY sign that has to. Oromo's
    //     unit rules honour `unitPrefix` and MOVE the noun ahead of its number, so `6 × 6 cm` became
    //     `6 × seentiimeetira 6` — the sign's `(\d+)…(\d+)` no longer had a digit after it and *si’a* was
    //     DROPPED. `6x6 cm` failed the mirror way: the `x` broke the unit rule's adjacency, so the sign read
    //     but `cm` LEAKED. Running first fixes both — the reordering has not happened, and the unit rule then
    //     still finds `6 cm` adjacent.
    //     The same ordering the shared tier needs for `multiply` (core/normalizeSymbols.ts), for the same
    //     reason and discovered the same way: by probing a `unitPrefix` language.
    //     ASCII `x` alongside `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and a bare
    //     `x` was reaching the phoneme stream as its own letter name.
    s = s.replace(/(\d+)\s*(?:×|x)\s*(\d+)/gu, "$1 si’a $2");

    const units = Object.keys(UNIT).sort((a, b) => b.length - a.length).join("|");
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d[\\d.]*)\\s?(${units})\\s?/\\s?([hs])(?![\\p{L}\\p{M}])`, "giu"),
        (_m, n: string, u: string, d: string) => `${PER[d.toLowerCase()]!} ${UNIT[u.toLowerCase()]!} ${n}`);
    //     (b) `sq mi` ×3 — *iskuweer* is the corpus's own transliteration (`iskuweer kiloometiiri`).
    s = s.replace(/(?<![\p{L}\p{M}\d])(\d[\d.]*)\s?sq\s?mi(?![\p{L}\p{M}])/giu, "iskuweer maayilii $1");
    //     (b2) …and the SAME reading for `km²`, which is what the corpus's `iskuweer kiloometiiri 783,562`
    //         actually is: *iskuweer* leads, the unit noun follows, the number comes last. The shared tier
    //         now honours `unitPrefix` in its exponent branch, but Oromo's units are local precisely
    //         because the tier can only postpose them, so the power belongs here beside (b). No cube word:
    //         `kuubik` is ×0 in this corpus, so `m³` is left alone rather than invented.
    //         `(?:\s?²|2)` copies the tier's own asymmetry rather than accepting `\s?[²2]`: a SPACED
    //         superscript is an exponent (Hindi's wiki writes `km ²`) but a spaced ASCII `2` is the next
    //         NUMBER — `km 6,387` and `km 2-3` are both real forms in this corpus, so `km 2` must not
    //         become a square kilometre.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d[\\d.]*)\\s?(${units})(?:\\s?²|2)(?![\\p{L}\\p{M}\\d])`, "giu"),
        (_m, n: string, u: string) => `iskuweer ${UNIT[u.toLowerCase()]!} ${n}`);
    //     (b3) …and CUBED. An earlier pass recorded `kuubik` as ×0 and left `m³` alone; the corpus does have
    //         the word, spelled `kubiik` and in this language's own noun-first order — "iibame boba'aa
    //         kubiik metirii 120-160 of irraa qaba ture". Same shape as (b2).
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d[\\d.]*)\\s?(${units})(?:\\s?³|3)(?![\\p{L}\\p{M}\\d])`, "giu"),
        (_m, n: string, u: string) => `kubiik ${UNIT[u.toLowerCase()]!} ${n}`);
    //     (c) the abbreviation BEFORE its number (`mm 5`, `km 6,387`) — and this must come BEFORE (d),
    //         which was found by the corpus's `mm 36 mm 24n` (a 36×24 mm negative): with (d) first, the
    //         SECOND `mm` was eaten as the postposed unit of `36`, and the first was left as the raw
    //         letters — i.e. read as the geminate [mː].
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(${units})\\s?(?=\\d)`, "giu"),
        (_m, u: string) => `${UNIT[u.toLowerCase()]!} `);
    //     (d) the abbreviation AFTER its number (`35 mm`) — zero corpus instances in this order, but it
    //         is the adversarial neighbour of (c) and of the review's `1 km`/`5 km` probes (trap 8 (zero corpus instances is not evidence of…)).
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d[\\d.]*)\\s?(${units})(?![\\p{L}\\p{M}’'ʼ])`, "giu"),
        (_m, n: string, u: string) => `${UNIT[u.toLowerCase()]!} ${n}`);

    // 13) MATH SIGNS. Every class was dropped outright. AFTER the range step, so a range hyphen is never
    //     read as a minus, and after the units step, so `km/h` is not seen as a fraction.
    //     `=` ×1 — the corpus's instance (`tajaajilu =kan wantoota…`) is a stray typographic dash used as
    //       a copula; *wal qixa* ("equal", corpus ×1, espeak `=` → *qixedha*) is a tolerable reading of it
    //       and the only one the sign has.
    //     `<` `>` — espeak inserts the finite verbs *ni xiqqata* / *ni caala* between the operands, which
    //       is not how Oromo compares: it is `A B caalaa xiqqaa/guddaa`. The PIECES are what is sourced
    //       (*caalaa* ×46, *xiqqaa* ×27, *guddaa* ×many), so they are composed into the language's own
    //       word order rather than espeak's copied (the Fula part-of-speech lesson).
    //     `×` — *si’a* ("times"), corpus: `gati warqee si’a kuudhanii ol` = "ten TIMES the gold price",
    //       and it precedes its number there, which is the slot used here.
    //     `-` and `+` — *hir’isuu* (corpus ×1 `taarifa hir’isuu irratti`; espeak `_-`) and *ida’uu*
    //       (espeak `+` ONLY — the layer's single-sourced word; `+` has zero corpus instances).
    //       The minus is claimed only where nothing precedes it, so a compound (`Il-76s`, `HJR-3n`) and a
    //       score (`5-3`) are both excluded.
    s = s.replace(/(\d+)\s*<\s*(\d+)/gu, "$1 $2 caalaa xiqqaa");
    s = s.replace(/(\d+)\s*>\s*(\d+)/gu, "$1 $2 caalaa guddaa");
    // ⚠ ASCII `x` TOO: `NxN` outnumbers `×` roughly 85 to 20 in the corpora and the bare `x` was read as its
    // own LETTER NAME. Digit-bounded on both sides so it cannot claim a letter.
    //     (`×` is handled EARLIER, before the unit block — see the note there. It has to be, because Oromo's
    //     unit rules honour `unitPrefix` and move the noun between the sign's two operands.)
    s = s.replace(/\s*=\s*/gu, " wal qixa ");
    s = s.replace(/(?<![\p{L}\p{M}\d])\+\s?(?=\d)/gu, "ida’uu ");
    //       The second lookbehind is variable-length and was added by the corpus diff: `10ffaa - 11ffaa`
    //       put a SPACE between the digits and the hyphen, so the plain "nothing precedes" guard let a
    //       range be read as a subtraction. A hyphen with a number anywhere before it is never a minus.
    s = s.replace(/(?<![\p{L}\p{M}\d])(?<!\d\s{0,2})[-−]\s?(?=\d)/gu, "hir’isuu ");

    return tidy(s);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// PASS 2 — the rules that turn digits into WORDS, and therefore must run AFTER the symbol tier
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The number rules that cannot leave digits behind, run AFTER the shared symbol tier (see the header):
 * the glued ordinal/enclitic, and the decimal point. Anything the tier needed to see next to a sign has
 * already been claimed by the time this runs, so `£27tiin` arrives here as `paawundii 27tiin`.
 */
export function normalizeOromoNumerals(input: string): string {
    let s = input;

    // 14) GLUED ORDINAL AND ENCLITIC (trap 14 (agreement cannot be applied to digits)) — 24 + ~35 instances, the language's defining shape.
    //     `16ffaa` → *kudha jahaffaa*, `1994tti` → *kuma dhibba sagal sagaltamii afuritti*. The suffix
    //     attaches to the LAST word of the numeral, with the linking vowel its shape demands
    //     (attachEnclitic/ordinalStem above, both read off the corpus's spelled-out forms).
    //     The apostrophe variants ’ ʼ ' all occur (`2010’tti`, `5’tti`) and are dropped: they are a
    //     hyphen-like separator here, not the glottal stop the g2p reads word-internally.
    //     A DECIMAL operand is handled too (`1.5tti` ×1) — it is why this runs before step 15.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d+(?:\\.\\d+)?)[’'ʼ]?(ffaa[’'ʼ]?[a-z]{0,8}|${ENCLITIC})(?![\\p{L}\\p{M}\\d])`, "gu"),
        (m0, num: string, suf: string) => {
            const words = numeralWords(num).split(" ");
            const last = words.pop();
            if (last === undefined) return m0;
            if (suf.startsWith("ffaa")) {
                const trailer = suf.slice(4).replace(/[’'ʼ]/gu, "");
                return [...words, `${ordinalStem(last)}ffaa${trailer}`].join(" ");
            }
            // The written linking vowel of `10if` is the same one the morphology supplies; normalise it
            // away so the stem decides (`10if` → *kudhaniif*, not *kudhanif*).
            return [...words, attachEnclitic(last, suf === "if" ? "f" : suf)].join(" ");
        },
    );

    // 14b) THE SAME ENCLITIC, WRITTEN WITH A SPACE — `bara 1945 tti`, `hanga 100 tti`, `sa’aatii 24 f`,
    //      `qabxii 2,207 n`, `$22,500 tiin`, `miliyyoona 2.8 tti`. TWENTY-FOUR unique utterances, against
    //      the ~35 glued ones above, and the same impossible reading: `tti` alone is the word-initial
    //      geminate [tːi], `f`/`n` alone a bare consonant. Detaching a bound postposition is a slip of the
    //      orthography, not a word boundary, so the space is not evidence of anything.
    //      ONE space, and no punctuation across it: a clause break really would end the numeral phrase.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d+(?:\\.\\d+)?)[’'ʼ]? (${ENCLITIC_SPACED})(?![\\p{L}\\p{M}\\d])`, "gu"),
        (m0, num: string, suf: string) => {
            const words = numeralWords(num).split(" ");
            const last = words.pop();
            if (last === undefined) return m0;
            return [...words, attachEnclitic(last, suf)].join(" ");
        },
    );
    //      …and after a HALF-DAY WORD, which is where step 5 leaves the corpus's `sa’a 1:15 a.m tti`: the
    //      clock rule consumed the meridiem and emitted *ganama*, so the enclitic no longer has digits in
    //      front of it and the rule above cannot see it. Same regular morphology as every numeral above
    //      (vowel-final stem, short link) — the MORPHOLOGY is corpus-attested, this particular output form
    //      is not, which is the honest statement of what is claimed here.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(ganama|galgala) (${ENCLITIC_SPACED})(?![\\p{L}\\p{M}\\d])`, "gu"),
        (_m, w: string, suf: string) => attachEnclitic(w, suf));

    // 15) DECIMAL POINT — 14 instances (`miliyoona 2.3`, `inchii 6.34`, `sa’aatii 1.5`). The fraction is
    //     read DIGIT BY DIGIT after *tuqaa*, which is what the digits already do downstream, so this rule
    //     leaves them as digits and only inserts the word. AFTER the clock and version steps in pass 1
    //     (both consume a dot that is not a decimal) and after step 14 (which claims a suffixed decimal).
    //     A comma-decimal has ZERO corpus instances — Oromo follows the English convention here — but is
    //     claimed too, so that a stray one cannot leak the comma as a clause pause.
    s = s.replace(/(?<![\d.,])(\d+)[.,](\d+)(?!\d)/gu,
        (_m, i: string, f: string) => `${i} ${POINT} ${[...f].join(" ")}`);

    return tidy(s);
}

/** A padded replacement doubles a space that was already there and can leave one at an edge; SLOT-GAP is
 *  a defect class, and this pass must not feed it. */
function tidy(s: string): string {
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
