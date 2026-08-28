/**
 * Javanese (jv) text normalization — the pre-tokenizer pass that rewrites what is not yet a pronounceable
 * word into words the Latin/Aksara → IPA pipeline already speaks. Pure text→text, no IPA.
 *
 * ⚠ THE ORDERING PROBLEM THIS LAYER IS BUILT AROUND: THE DOT IS CONTESTED BY THREE RULES. Javanese follows
 * the Indonesian/Dutch convention — **a dot GROUPS THOUSANDS and a comma is the DECIMAL** (`200.000`,
 * `1,4 triliun`) — jv.wikipedia ALSO carries imported English-format numbers (`32,548.20`, `16.46 km`), and
 * the dot ALSO writes the clock (`jam 09.00`, `00.00-03.00`). Three readings, one character. The steps below
 * are ordered so each shape is claimed by the rule that can actually identify it, and the coupling is stated
 * at every step; a future reader cannot recover it from the code.
 *
 * ⚠ `\b` IS NEVER USED — it is ASCII-defined and Javanese writes ⟨è é ê⟩, so a boundary test against them
 * silently fails. Every boundary here is an explicit lookaround over `[\p{L}\p{M}]`.
 *
 * ⚠ A YEAR NEEDS NO RULE, and that is worth saying because `year: 77647` is the artifact's largest cell:
 * `taun 2009` already reads *t̪ˈaʊn rˈɔŋ ˈəwu sˈɔŋɔ*, the CARDINAL, which is what Javanese says. Chinese
 * reads a year digit-by-digit and this language does not; the biggest count in the corpus is already right.
 * Two more large cells are mostly noise and were read before being believed: `abbrev: 41200` is a regex that
 * matches every short sentence-final word (*Jawa.* ×9, *jiwa.* ×6), and `ordinal-latin: 15802` is largely
 * NUMBERED LIST ITEMS. Javanese forms its ordinal with ⟨kaping⟩ (`abad kaping 15`, ×22), which already reads.
 *
 * Deliberately left alone, each with its measurement:
 *   · THE COLON. Every colon in the corpus is something a clock rule must NOT claim: 3-field timestamps
 *     (`jam 00:02:32 WIB`, `jam 7:58:53 WIB`, `17:16:10 WIB`), SPORTS TIMES (`(1:54.58)`, `waktu 2:07:35`)
 *     and a QUR'AN VERSE REFERENCE (`QS 3:83`). A rule here would claim only the shapes it must not.
 *   · THE GENERAL FRACTION `a/b`. Javanese uses SUPPLETIVE forms and the corpus glosses two of them itself
 *     — `1/3 (sapratelon)`, `saprapat saka gunggung` — but no general "per" fraction is attested, and the
 *     slash in this corpus is mostly a DOI (`10.1016/0301-0104`) or a YEAR PAIR (`taun 1985/1986`). The
 *     three attested suppletives are claimed by literal and nothing else is.
 *
 * ⚠ TWO THINGS ARE SHIPPED WITHOUT AN ATTESTED SENSE, and both are flagged where they are declared rather
 * than buried here. They rest on the SAME argument — a written corpus is the weakest evidence there is about
 * how a SYMBOL is spoken, because writers type `1,4` and `PBB` and never spell out how they say them.
 *
 *   1. THE DECIMAL ⟨koma⟩. It scores 38 token hits on jv.wikipedia and **every recorded one is "Teater
 *      Koma"**, a theatre company; `nol koma`/`siji koma`/`loro koma` all return zero. jv's whole
 *      numeric-technical vocabulary is the same Indonesian/Dutch stratum and every other member of it IS
 *      attested here (persèn, persegi, kubik, milyar, triliun, juta), and the alternative is 15,961 corpus
 *      decimals whose separator is read as a CLAUSE PAUSE — destroying the value, not merely leaving it
 *      unread.
 *   2. THE LATIN LETTER NAMES, at `LETTER_NAME` below, where the full refutation trail is recorded. That
 *      one carries a split this one does not: only the INVENTORY is inferred, because the names are emitted
 *      as ORTHOGRAPHY and this language's own g2p supplies the phonology.
 *
 * Neither is an attestation, and a Javanese speaker reviewing this layer should start with these two.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { tr } from "../../core/provenance.ts";

/** Not-a-letter, on both sides. `\b` cannot be used — see the header. */
const L = "[\\p{L}\\p{M}]";

/**
 * ⚠ `unitPer` + `rateDenominators` are the corpus's own construction: `mèter kubik per detik` writes the
 * rate word and the denominator together, and `5 km/jam` is the shape that needs them.
 *
 * ⚠ ⟨m⟩ IS DECLARED, AND THE COMMENT THAT USED TO SIT HERE WAS WRONG. It said the corpus "writes the metre
 * as a WORD and never as a bare `m` after a digit", and used that to decline the key on trap-9 grounds. The
 * corpus refutes it: `dipunukur nganggé mèter kubik per detik (1 m³/s = 35.51 ft³/s)` — the abbreviation, in
 * a unit slot, after a digit. jv.wikipedia states the convention outright too ("Mèter asring dicekak nganggo
 * aksara m."). Left undeclared, that whole conversion aside dropped its units. Kept as a note rather than
 * deleted, because a refusal that the evidence overturns is worth seeing once.
 *
 * ⚠ THE EXPONENT WORDS ARE POSTPOSED AND BOTH ARE SOURCED SEPARATELY: `kubik` from this corpus
 * (`kilomèter kubik`, `mèter kubik per detik`) and `persegi` from jv.wikipedia, where one article writes
 * `43.500 mèter persegi` · `7.115 mèter persegi` · `10.235 mèter persegi` · `8.185 mèter persegi` — the exact
 * unit-modifier slot, five times over. ⚠ `pesagi` is NOT used here although it too is attested: its article
 * defines it as the geometric SHAPE ("wangun dhatar rong dhimènsi kang ... papat pojok siku-siku"), which is
 * a different sense from the unit modifier.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    unitPer: MANIFEST.symbolTier.unitPer,
    rateDenominators: MANIFEST.symbolTier.rateDenominators,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    multiply: MANIFEST.symbolTier.multiply,
    ampersand: MANIFEST.symbolTier.ampersand,
});

/** Javanese phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableJavanese = makeUnreadableTest({
    vowels: new RegExp(`[${MANIFEST.phonotactics.vowels}]`, "u"),
    legalOnsets: new Set(MANIFEST.phonotactics.onsets),
    legalCodas: new Set(MANIFEST.phonotactics.codas),
});
/**
 * LEXICAL, not derivable from spelling: acronyms READ AS LETTERS although their lowercase form is a
 * perfectly readable Javanese-looking word, so the OOV test alone would leave them. Every one is attested
 * in the mined corpus: `AS` (Amérika Sarékat) and `US`, `SA` (satuan astronomi), `RI` (Republik Indonésia),
 * `LU` (lintang utara) beside the already-unreadable `LS`/`BT`, and `PC`.
 */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(["as", "us", "sa", "ri", "lu", "pc", "kb", "md", "pip"]);

/**
 * …and the converse: readable runs that ARE words and must not be spelled even if listed elsewhere. The
 * Indonesian time-zone abbreviations are read as words in running text (`WIB`, `WITA`, `WIT`), and the
 * corpus's international acronyms are already phonotactically readable, so they need no entry.
 */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["wib", "wita", "wit", "unesco", "nasa", "asean"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => MANIFEST.letterNames[l.toLowerCase()],
    acronymLetters: ACRONYM_LETTERS,
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableJavanese,
});

/**
 * Normalize one Javanese string.
 *
 * The steps are ORDER-DEPENDENT. Each states what breaks if it moves.
 */
export function normalizeJavanese(input: string): string {
    let s = input;

    // ── 1. the clock, FIRST ──────────────────────────────────────────────────────────────────────
    // ⚠ BEFORE EVERY DOT RULE, because a clock's dot is neither a thousands separator nor a decimal and
    // only the surrounding context says so. The corpus writes whole hours: `saka jam 09.00-12.00 bengi`,
    // `saka 00.00-03.00 ésuk`, `saka 03.00-06.00 ésuk` — MM is `00` in every instance.
    // ⚠ ONLY `.00` IS CLAIMED. A minute word is NOT attested anywhere (`menit` scores zero in the corpus),
    // so a clock with real minutes is left alone rather than read with a guessed word — the same refusal
    // shape as the general fraction below. `jam 09.00` → `jam 9`; the hour is then read by the cardinal path.
    // ⚠ ⟨pukul⟩ IS NOT GUARDED, DELIBERATELY: it is the Indonesian formal clock word and scores ZERO in this
    // corpus, where all 10 clock instances use ⟨jam⟩. Adding it would be a guard with no attested instance
    // (trap 9) — so `pukul 13.30` still reads as a decimal, and that is recorded rather than papered over.
    s = tr(s,
        /(\d{1,2})\.00\s*([-–])\s*(\d{1,2})\.00(?!\d)/gu,
        (_m, a: string, _d: string, b: string) => `${Number(a)} nganti ${Number(b)}`,
    );
    s = tr(s,
        new RegExp(`(?<=jam\\s)(\\d{1,2})\\.00(?!\\d)`, "gu"),
        (_m, h: string) => String(Number(h)),
    );

    // ── 1b. the rupiah's abbreviating dot ────────────────────────────────────────────────────────
    // The corpus writes both `Rp` and `Rp.`, and the tier's key is the letters — so the dotted form reached
    // it as `Rp` + a sentence period and read *rp . limang èwu*, the letters bare and a spurious pause.
    // ⚠ ONLY WHEN AN AMOUNT FOLLOWS, so the corpus's bare `1$ = Rp.` (a gloss, no number) keeps its period.
    s = tr(s, /(?<![\p{L}\p{M}])Rp\.(?=\s*\d)/gu, "Rp");

    // ── 2. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ AFTER the clock and BEFORE every decimal rule. Both separators are attested as GROUPERS in this
    // corpus — the native dot (`200.000`, `31.820.000`, `1.500`, ×47) and the imported comma (`32,548`,
    // `132,000`, ×20) — and left alone each is read as a CLAUSE PAUSE, which destroys the value: `1.500`
    // read *sˈid͡ʒi . lˈimaŋ ˈat̪ʊs*, "one, five hundred".
    // ⚠ EXACTLY-3-DIGIT GROUPS ARE WHAT MAKES THIS SAFE, and it is doing three jobs at once: it separates a
    // grouper from a decimal (which this corpus writes with 1–2 digits: `43,34`, `3,5`, `1,4`), it cannot
    // touch a clock (`09.00` is 2 digits), and it cannot touch a DOI (`10.1016` is 4).
    // ⚠ The comma arm's lookahead ALLOWS a following dot, so `32,548.20` de-groups to `32548.20` and hands
    // the remainder to step 3 — the English-format number the corpus also carries.
    // ⚠ THE DOT ARM'S LOOKAHEAD ALLOWS A FOLLOWING COMMA, and it has to: the native format writes a number
    // that is BOTH grouped and decimal — `± 1.485,36 km²` — and with `(?![\d,])` the group refused to match
    // at all, leaving BOTH separators as clause pauses. It still refuses a following DOT, which is what
    // keeps the two conventions apart.
    s = tr(s, /(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?![\d.])/gu, (m) => m.replace(/\./gu, ""));
    s = tr(s, /(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

    // ── 3. decimals ──────────────────────────────────────────────────────────────────────────────
    // AFTER de-grouping, so what is left of a mixed number is only its fractional tail.
    // ⚠ THE FRACTIONAL PART IS READ DIGIT BY DIGIT, which is the Indonesian convention this language shares
    // and what `indonesian.ts` already does (`43,34` → *… koma telu papat*, never "thirty-four"). Emitted as
    // SPACED DIGITS so the engine's own cardinal path reads each one — the layer's job (playbook trap 6).
    // ⚠ `\d{1,2}` ON THE FRACTION, not `\d+`: it keeps a DOI (`10.1016`, four digits) out, and every decimal
    // this corpus writes has one or two.
    // ⚠ AND `.00` IS EXCLUDED — that is the clock signature (step 1 claims the ones it can identify), and a
    // decimal `.00` says nothing anyway. Without this, a bare `03.00` outside a `jam` context would read
    // "telu koma nol".
    const decimal = (int: string, frac: string): string => `${int} koma ${[...frac].join(" ")}`;
    s = tr(s, /(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => decimal(i, f));
    // ⚠ AND A `jam` CONTEXT IS EXCLUDED OUTRIGHT, not just `.00`. Step 1 claims the whole hours it can
    // identify; what it leaves behind is a clock with REAL MINUTES, and this rule read `jam 08.45` as
    // *jam 08 koma 4 5* — a decimal inside a time. Found by a test, not by the corpus, whose clocks all
    // happen to be whole hours. Left alone, the minutes stay unread, which is the refusal step 1 states.
    // ⚠ AND `(?!\.\d)` KEEPS A VERSION/SECTION TRIPLE OUT — `nomer 1.2.3` read *siji koma loro . telu*, a
    // decimal followed by a stray pause. Refusing only when ANOTHER DOT-PLUS-DIGIT follows is what lets a
    // decimal at the end of a sentence through (`Ana 3.5.` is still a decimal); the `version-dot` cell is
    // 103 corpus-wide against 15,961 decimals, so the guard has to be this narrow.
    s = tr(s,
        /(?<![\d.,])(\d+)\.(\d{1,2})(?![\d,])(?!\.\d)/gu,
        (m, i: string, f: string, off: number, full: string) =>
            f === "00" || /(?<![\p{L}\p{M}])jam\s*$/u.test(full.slice(0, off)) ? m : decimal(i, f),
    );

    // ── 4. the three attested fractions ──────────────────────────────────────────────────────────
    // ⚠ BY LITERAL, NOT BY PATTERN, and that is the whole design. Javanese fractions are SUPPLETIVE and this
    // corpus glosses two of them for us — `kurang luwih 1/3 (sapratelon) saka`, `kurang luwih saprapat saka
    // gunggung` — while `setengah` is sense-checked on jv.wikipedia (`setengah daging babi lan setengah
    // daging sapi`). No general `a/b` reading is attested, and a pattern rule would immediately claim the
    // corpus's DOIs (`10.1016/0301-0104`) and its YEAR PAIRS (`taun 1985/1986`), neither of which is a
    // fraction. Three literals, nothing else.
    // ⚠ The vulgar characters arrive already folded — `foldVulgarFractions` in the registry turns `½` into
    // `1/2` before any engine sees it — so these literals catch both spellings at once. That fold is why
    // `½ kilogram` read *sˈid͡ʒi lˈoro kilˈɔɡram*, "one two kilogram".
    s = tr(s, new RegExp(`(?<!${L}|[\\d/])1/2(?!${L}|[\\d/])`, "gu"), "setengah");
    s = tr(s, new RegExp(`(?<!${L}|[\\d/])1/3(?!${L}|[\\d/])`, "gu"), "sapratelon");
    s = tr(s, new RegExp(`(?<!${L}|[\\d/])1/4(?!${L}|[\\d/])`, "gu"), "saprapat");

    // ── 4b. the two ranges whose endpoints are not bare digits ───────────────────────────────────
    // ⚠ BEFORE the symbol tier and the degree rules, because both destroy the adjacency step 7 needs.
    //   · A PERCENT RANGE (`72%-83%`, `antara 73–94 persèn`): once the tier has turned `72%` into
    //     `72 persèn`, the dash no longer sits between two numbers and step 7 can never see it. The sign is
    //     captured and PUT BACK (playbook trap 10) so the tier still reads both halves.
    //   · A COORDINATE RANGE (`110°30'-110°45'`, `7°32'17"-7°49'32"`, `109° 08’-109° 10’`): the left
    //     endpoint ends in a minute or second mark, not a digit — the same shape that hid the coordinate
    //     ranges in Wu. 10 of the artifact's dropped minus signs are these two classes.
    s = tr(s, /(\d+)\s*%\s*[-–]\s*(?=\d)/gu, "$1% nganti ");
    s = tr(s, /(['’"”′″°])\s*[-–]\s*(?=\d)/gu, "$1 nganti ");

    // ── 5. temperature, then the bare degree ─────────────────────────────────────────────────────
    // ⚠ °C BEFORE the bare ° — otherwise the bare rule eats the sign and leaves a lone ⟨C⟩, which is exactly
    // what `20°C` did: it read *rˈɔŋ pˈulʊh t͡ʃ*, the scale letter as a bare consonant.
    // The reading is POSTPOSED and corpus-attested four times over: `antara 18–28 drajat celsius`,
    // `nganti 33 drajat Celcius`, `sautara 29 drajat celcius`. ℃ arrives already folded to `°C`.
    // ⚠ The bare arm covers the COORDINATE, which is what most of `degrees: 456` is: `6°LU-11°LS`,
    // `95°BT-141°BT`. The compass letters are left for the Latin path; only the sign is read.
    s = tr(s, /(\d+)\s*°\s*C(?![\p{L}])/gui, "$1 drajat celsius");
    // ⚠ THE TRAILING SPACE IS LOAD-BEARING. Without it `6°LU` became `6 drajatLU` — one token, read
    // *d̪rad͡ʒˈat̪lu* — because a coordinate glues its compass letters straight onto the sign. The
    // duplicate-space case is harmless (the clause sink trims; the corpus diff reports SLOT-GAP 0).
    s = tr(s, /(\d+)\s*°\s*/gu, "$1 drajat ");

    // ── 5b. the approximation marker ─────────────────────────────────────────────────────────────
    // ⚠ ± IN THIS CORPUS IS NOT A TOLERANCE, IT IS "ABOUT" — `± 1.485,36 km²`, `+/- 327.866 (2003)`, four
    // instances, every one a rounded population or area. Javanese writes that sense out as ⟨kurang luwih⟩,
    // which the corpus uses 17 times in exactly this slot (`kurang luwih 1/3`, `kurang luwih saprapat saka
    // gunggung`). Both spellings of the sign are claimed, since the corpus writes both.
    s = tr(s, /(?<![\p{L}\p{M}])(?:±|\+\/-)\s*(?=\d)/gu, "kurang luwih ");

    // ── 5c. population density ───────────────────────────────────────────────────────────────────
    // `475 jiwa/km²`, `1.868 jiwa/km²` — the shared tier cannot compose this one because the NUMERATOR is a
    // Javanese noun (⟨jiwa⟩, "souls") rather than a unit symbol, so its rate path never engages and the
    // whole `/km²` was dropped. ⟨per⟩ is the corpus's own rate word (`mèter kubik per detik`, `per kapita`).
    s = tr(s,
        /(\d[\d.,]*)\s*jiwa\s*\/\s*km\s*(?:²|2)(?![\p{L}\d])/gu,
        "$1 jiwa per kilomèter persegi",
    );

    // ── 6. percent, currency, units and the ampersand, via the shared tier ───────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and AFTER the decimal rule, which has already
    // turned `1,4` into words — the tier matches a number next to its sign, and a decimal that still had its
    // comma would present two numbers to it.
    // ⚠ AND AFTER the degree rules: the tier's `units` alternation would otherwise have to compete with the
    // scale letter for the same `C`.
    s = SYMBOLS(s);

    // ── 7. ranges ────────────────────────────────────────────────────────────────────────────────
    // ⚠ LAST OF THE NUMBER RULES. Every earlier rule has already consumed the dashes it owns — the clock
    // range in step 1 and the coordinate pair in step 5 — so what reaches here is a bare numeric range.
    // ⟨nganti⟩ is the corpus's own connective, ×27, and used in exactly this slot: `antara taun 750 nganti
    // 925`, `nganti umur 3 wulan`.
    // ⚠ THE `doi` GUARD IS NOT OPTIONAL. This wiki is full of bibliographic debris and the dash inside it is
    // never a range to read: `157-167 doi:`, `2400-2410 doi:`, `1545-1557 doi:`, and the DOI's own internal
    // `0301-0104`. A page range is not spoken as "157 nganti 167" in running prose, and the DOI is not
    // spoken at all. Both arms of the guard are needed: one for the citation that FOLLOWS the range, one for
    // the identifier the range sits INSIDE.
    // ⚠ THE TRAILING GUARD EXCLUDES A DOT THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK. A plain `.` in the
    // class declines the whole match at exactly a sentence end, so `2004-2005.` came back untouched and read
    // as two cardinals with nothing between them (trap 58, `review.ts`'s `clause-final` check). `\.\d` keeps
    // the one job the dot still has HERE — the identifier, e.g. a DOI's inner `0301-0104`. A dotted decimal
    // or a period-grouped operand never reaches this rule at all: steps 3 and 4 have already turned
    // `900 - 1.200` into `900 - 1200` and `5-13.7` into `5-13 koma 7` before the range runs.
    // ⚠ THE COMMA STAYS IN THE CLASS on the same reasoning, though it is worth recording that in THIS layer
    // neither separator is reachable as a DECIMAL at all — steps 3 and 4 own both marks and run first, so
    // the guard's live job here is the identifier, not the number.
    s = tr(s,
        /(?<![\d.,/-])(\d+)\s*[-–]\s*(\d+)(?![\d,/-]|\.\d)(?!\s*doi)/giu,
        (m, a: string, b: string, off: number, full: string) =>
            /doi:?\s*\S*$/iu.test(full.slice(Math.max(0, off - 40), off)) ? m : `${a} nganti ${b}`,
    );

    // ── 8. initialisms and personal initials ─────────────────────────────────────────────────────
    // ⚠ LAST, and two ordering constraints make that mandatory. `core/initialisms.ts` claims ALL-CAPS runs,
    // and (a) Roman numerals are all-caps runs too — they are already digits by now, since `core/roman.ts`
    // runs in the REGISTRY wrapping text() (`Louis XIV` → patbelas); (b) the currency prefixes `AS$`/`US$`
    // have already been consumed by the tier in step 6, so their letters are gone before this can spell them.
    // The compass letters of a coordinate (`6 drajat LU`) reach it intact, which is what we want.
    //
    // It also fixes the PERSONAL INITIALS the corpus is full of in its citations: `R. J. Speedy and C. A.
    // Angell` read *r . d͡ʒ . … t͡ʃ . ˈɔ .* — bare consonants plus four spurious phrase breaks.
    s = normalizeInitialisms(s);

    return s;
}
