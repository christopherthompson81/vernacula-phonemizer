/**
 * Modern Greek (el) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Twenty-second language. MEASURED over the el_gr FLEURS corpus (1,969 unique utterances, column 3 —
 * the cased one):
 *
 *   embedded Latin        291 utterances (14.8%) — the HIGHEST rate of any language measured
 *                         · all-caps initialisms  78 instances / 58 distinct in 68 utterances
 *                         · single Latin letters   9 after the unit/rate rules take theirs
 *                         · Latin↔Greek HOMOGLYPHS 12 (see step 1) — a corpus defect, not a loanword
 *                         · mixed-case names      the rest (Apple, Xinhua, Northern Rock) — LEFT ALONE
 *   ordinal notation       55  (15ο, 1η, 18ου, 9ης — the ending is the CASE, see step 7)
 *   grouped numbers        50  (1.000, 783.562 — Greek groups with a PERIOD)
 *   times                  21  (8:30, 07:19, 11:00) + 3 SPORTS times that must NOT be claimed
 *   ranges                 23  (3-5, 35-40) — deliberately NOT touched, see the footnote
 *   percent                12
 *   decimal comma          12  (2,3 — Greek's decimal mark is the COMMA)
 *   dotted abbreviations   27  (π.Χ. ×7, π.μ. ×7, π.χ. ×4, κ.λπ. ×4, μ.Χ. ×3, μ.μ. ×2, βλ. ×1)
 *   χλμ                     8  (3 of them dotted, 2 of them as a rate `χλμ / ώρα`)
 *   units after a number   ~20 (mm ×6, km ×3, km/h ×3, mi² ×2, km² ×1, m/s ×1, m, cm, g, °C ×1)
 *   Greek ALPHABETIC numerals 6 (Α΄ Β΄ ΙΣΤ΄ — with U+0384, not the keraia; see step 2)
 *   currency $              2  · vulgar fractions ½ ¾ 2 · `+` sign 1
 *
 * WHAT THE ENGINE PRODUCED BEFORE (each probed through `phonemize(form, "el")`):
 *   "το FBI και το GPS"  → to ˈɛfbˈiːʲˈaᶦ ce to d͡ʒˈiː pʰˈiː ˈɛs   ENGLISH phonemes (core/foreign.ts)
 *   "η UNESCO"           → i juːnˈɛskoᶷ                            in a Greek stream: ɪ ʊ ɹ ʃ d͡ʒ æ ɫ
 *   "τον 15ο αιώνα"      → ton ðeka pende o eona                   cardinal + a stray vowel
 *   "1.000 άτομα"        → ena . miðen atoma                       the grouping dot became a PAUSE
 *   "στις 8:30 μ.μ."     → stis oxto , tɾʝanda m . m .             the colon became a pause; μ.μ. spelled
 *   "300 π.Χ."           → tɾiakosia p . x .                       three phrase breaks out of one word
 *   "Β΄ Παγκόσμιο"       → v paŋɡozmio                             the numeral read as the LETTER beta
 *   "Το 3-5% των"        → to tɾia pende ton                       % dropped outright
 *   "783.562 km²"        → eftakosia oɣðonda tɾia . pendakosça …ˈʊkm   grouping dot + the [ˈʊkm] cluster
 *   "30 °C"              → tɾʝanda sˈiː                            the English letter C
 *   "35-40 km/h"         → … saɾanda ˈʊkm ˈeᶦt͡ʃ                    and the English letter H
 *   "το 2,3 τοις"        → to ðio , tɾia tis                       the decimal comma became a pause
 *   "και o αγριόκουρκος" → ce ˈoᶷ aɣɾʝokuɾkos                      a LATIN o typed for the article ο
 *
 * NEVER `\b` in this file: it is ASCII-defined and finds no boundary against Greek script, so a rule
 * written with it silently matches nothing (the trap that made core/initialisms.ts a no-op for Cyrillic).
 * Every boundary here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * NOT DONE, deliberately:
 *   • NUMERIC RANGES (23) — `3-5%`, `35-40 μίλια`. A Greek reader supplies a connective (έως / με), but
 *     which one is a register choice the transcript cannot settle, and the dash also occurs in `COVID-19`,
 *     `Super-G`, `1984-1985` and `Il-76`. Left alone rather than guessed at.
 *   • MIXED-CASE Latin (the bulk of the 291) — brand and place names. Same call Japanese and Thai made:
 *     letter-spelling is not an available reading for `Xinhua`, and transliterating a name is invention.
 *   • `53χρονης` (1) — an age compound whose reading is one fused word (πενηντατριάχρονης). One instance;
 *     a wrong compound is worse than the space it currently gets.
 *   • `m;esa` (1) — a Greek word typed entirely in Latin, with a stray `;`. A corpus typo, not a class.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

// ── data ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Latin→Greek HOMOGLYPHS. Only ever applied where a Latin letter TOUCHES Greek script, i.e. inside a
 * token that is already broken — see step 1 for why the corpus contains these at all.
 */
const HOMOGLYPH: Readonly<Record<string, string>> = {
    A: "Α", B: "Β", E: "Ε", H: "Η", I: "Ι", K: "Κ", M: "Μ", N: "Ν", O: "Ο", P: "Ρ", T: "Τ",
    X: "Χ", Y: "Υ", Z: "Ζ",
    a: "α", e: "ε", i: "ι", k: "κ", o: "ο", p: "ρ", t: "τ", u: "υ", v: "ν", x: "χ", y: "υ",
};

/**
 * LATIN letter → its GREEK letter name. Greek reads a Latin-script initialism with the ENGLISH letter
 * names written in Greek orthography — ΝΤΙ ΒΙ ΝΤΙ for DVD, ΕΦ ΜΠΙ ΑΪ for FBI — which is exactly the
 * lexical-vs-OOV split Japanese (katakana names) and Thai (Thai names) settled on. It is always an
 * available reading for an initialism, so an unlisted all-caps run is safe to spell.
 *
 * The names are emitted SPACED, not joined: μπ is [b] word-initially but prenasalised [mb] medially, so
 * joining «εφ»+«μπι» would read the B of FBI as [mb]. Greek writes them spaced too.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "έι", b: "μπι", c: "σι", d: "ντι", e: "ι", f: "εφ", g: "τζι", h: "έιτς", i: "άι",
    j: "τζέι", k: "κέι", l: "ελ", m: "εμ", n: "εν", o: "όου", p: "πι", q: "κιου", r: "αρ",
    s: "ες", t: "τι", u: "γιου", v: "βι", w: "ντάμπλιου", x: "εξ", y: "γουάι", z: "ζετ",
};

/**
 * Acronyms Greek reads as a WORD rather than as letters. A LEXICAL fact, so this holds only established
 * ones — anything absent falls through to letter-spelling, which is always legitimate.
 */
const WORD_ACRONYM: Readonly<Record<string, string>> = {
    UNESCO: "Ουνέσκο", NATO: "ΝΑΤΟ", NASA: "Νάσα", ISIS: "Ίσις", COVID: "Κόβιντ", ASUS: "Άσους",
};

/**
 * MIXED-CASE Latin is otherwise left to the foreign fallback (see the header), with one exception: `pH`
 * (×3) is an initialism that merely happens to carry a lowercase letter, so the all-caps rule cannot
 * reach it. Japanese made the same single exception for the same token.
 */
const MIXED_CASE_INITIALISM: Readonly<Record<string, string>> = { pH: "πι έιτς" };

/** Ordinals 1–12, masculine nominative — the citation form the inflector works from. */
const ORD_UNITS = [
    "", "πρώτος", "δεύτερος", "τρίτος", "τέταρτος", "πέμπτος", "έκτος", "έβδομος", "όγδοος",
    "ένατος", "δέκατος", "ενδέκατος", "δωδέκατος",
];
/** Ordinal tens, masculine nominative. All OXYTONE (…ός), which changes the endings — see `inflect`. */
const ORD_TENS = [
    "", "", "εικοστός", "τριακοστός", "τεσσαρακοστός", "πεντηκοστός", "εξηκοστός", "εβδομηκοστός",
    "ογδοηκοστός", "ενενηκοστός",
];

/**
 * Written ending → the ordinal's ending, for a BARYTONE stem (πρώτος, δέκατος, όγδοος) and for an
 * OXYTONE one (εικοστός, τριακοστός), which carries the accent on the ending itself.
 *
 * Only the endings the corpus attests, plus the masculine-nominative citation form: -ο (masc.acc /
 * neut) ×34, -η (fem.nom) ×15, -ου (gen.masc/neut) ×8, -ης (gen.fem) ×5. Plural and accusative-plural
 * endings inflect the same way but do not occur, so they are not claimed.
 */
const ORD_ENDING: Readonly<Record<string, readonly [string, string]>> = {
    //  written    barytone  oxytone
    "ος": ["ος", "ός"],
    "ου": ["ου", "ού"],
    "ης": ["ης", "ής"],
    "ο": ["ο", "ό"],
    "η": ["η", "ή"],
    // The ACCENTED spellings of the same endings. An oxytone ordinal is properly written with its tonos
    // on the ending (60ό, 21ή); this corpus writes all 55 of them bare, but both spellings occur in Greek
    // text and both mark the same case.
    "ός": ["ος", "ός"],
    "ού": ["ου", "ού"],
    "ής": ["ης", "ής"],
    "ό": ["ο", "ό"],
    "ή": ["η", "ή"],
};
/** LONGEST FIRST, so `ου` is not matched as the shorter `ο` and `ης` not as `η`. */
const ORD_ALT = Object.keys(ORD_ENDING).sort((a, b) => b.length - a.length).join("|");

/** Greek ALPHABETIC numerals, for the regnal/era numbers of step 2. ΣΤ (6) is a two-letter sign. */
const GREEK_NUMERAL: Readonly<Record<string, number>> = {
    Α: 1, Β: 2, Γ: 3, Δ: 4, Ε: 5, ΣΤ: 6, Ϛ: 6, Ζ: 7, Η: 8, Θ: 9,
    Ι: 10, Κ: 20, Λ: 30, Μ: 40, Ν: 50, Ξ: 60, Ο: 70, Π: 80,
};

/**
 * FEMININE hour cardinals. Greek numerals 1/3/4 agree in gender and the clock counts ώρες (feminine):
 * «στις τρεις», never «στις τρία». The manifest's `numbers.units` are NEUTER, so a clock built on them
 * would be wrong for exactly those three.
 */
const HOUR_FEM = [
    "μηδέν", "μία", "δύο", "τρεις", "τέσσερις", "πέντε", "έξι", "εφτά", "οχτώ", "εννιά", "δέκα",
    "έντεκα", "δώδεκα", "δεκατρείς", "δεκατέσσερις", "δεκαπέντε", "δεκαέξι", "δεκαεφτά", "δεκαοχτώ",
    "δεκαεννιά", "είκοσι", "είκοσι μία", "είκοσι δύο", "είκοσι τρεις",
];

/** Minutes count λεπτά (neuter), so the plain neuter cardinals are right here. */
const MIN_UNITS = ["", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", "έξι", "εφτά", "οχτώ", "εννιά"];
const MIN_TEENS = [
    "δέκα", "έντεκα", "δώδεκα", "δεκατρία", "δεκατέσσερα", "δεκαπέντε", "δεκαέξι", "δεκαεφτά",
    "δεκαοχτώ", "δεκαεννιά",
];
const MIN_TENS = ["", "", "είκοσι", "τριάντα", "σαράντα", "πενήντα"];

/** 1–59 as neuter cardinals, for the minutes of a clock time. */
function minuteWords(m: number): string {
    if (m < 10) return MIN_UNITS[m]!;
    if (m < 20) return MIN_TEENS[m - 10]!;
    const t = MIN_TENS[Math.floor(m / 10)]!;
    const u = m % 10;
    return u === 0 ? t : `${t} ${MIN_UNITS[u]}`;
}

/**
 * Multi-dot and single-dot abbreviations. π.Χ. and π.χ. differ ONLY in the case of the χ and mean
 * entirely different things — «προ Χριστού» vs «παραδείγματος χάριν» — so this table is matched
 * CASE-SENSITIVELY on the second letter. Every corpus instance confirms the split: the four π.χ. sit
 * before an example, the seven π.Χ. after a year.
 */
const DOTTED: Readonly<Record<string, string>> = {
    "π.Χ.": "προ Χριστού",
    "μ.Χ.": "μετά Χριστόν",
    "π.χ.": "παραδείγματος χάριν",
    "π.μ.": "προ μεσημβρίας",
    "μ.μ.": "μετά μεσημβρίας",
    "κ.λπ.": "και λοιπά",
    "κ.ά.": "και άλλα",
};
const DOTTED_ALT = Object.keys(DOTTED)
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/\./gu, "\\."))
    .join("|");

// ── the shared symbol tier ──────────────────────────────────────────────────────────────────────────

/**
 * #562 symbol normalization — Greek.
 *
 * NO `unitPer`. Greek does not say "A per B" for a rate; it takes the DEFINITE ARTICLE agreeing with the
 * denominator — «χιλιόμετρα ΤΗΝ ώρα» (fem), «μέτρα ΤΟ δευτερόλεπτο» (neut). The corpus itself writes the
 * long form twice, «149 μίλια την ώρα» and «μιλίων την ώρα», which is the evidence. `unitPer` is one
 * invariant word and cannot express an agreeing article, so rates are kept LOCAL (step 5) — the same
 * call Italian and Polish made in the migration experiment, for the same reason.
 *
 * The exponent measure word IS expressible: Greek puts an agreeing adjective BEFORE the noun, exactly
 * like Russian — «783.562 τετραγωνικά χιλιόμετρα» — so `position: "before"`.
 */
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
    // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
    // και is ×2717 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
    //
    // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
    // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "και",
    // #586 `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "επί" },
    percent: ["τοις εκατό"], // invariant
    currency: {
        "$": ["δολάριο", "δολάρια"],
        "€": ["ευρώ"], // indeclinable in Greek
        "£": ["λίρα", "λίρες"],
    },
    units: {
        km: ["χιλιόμετρο", "χιλιόμετρα"],
        m: ["μέτρο", "μέτρα"],
        cm: ["εκατοστό", "εκατοστά"],
        mm: ["χιλιοστό", "χιλιοστά"],
        kg: ["κιλό", "κιλά"],
        g: ["γραμμάριο", "γραμμάρια"],
        mi: ["μίλι", "μίλια"],
    },
    // Greek writes the magnitude before the currency noun and takes no connective:
    // «14,7 δισεκατομμύρια δολάρια», which is how the corpus spells it out.
    magnitudes: ["χιλιάδες", "εκατομμύρια", "εκατομμύριο", "δισεκατομμύρια", "δισεκατομμύριο"],
    exponentWords: {
        squared: ["τετραγωνικό", "τετραγωνικά"],
        cubed: ["κυβικό", "κυβικά"],
        position: "before",
    },
});

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

/** Inflect one masculine-nominative ordinal to the case/gender the written ending marks. */
function inflect(base: string, written: string): string {
    const forms = ORD_ENDING[written]!;
    // An OXYTONE ordinal (εικοστός) carries the accent on the ending, so the ending itself is accented:
    // εικοστ+ός/ό/ού/ή/ής. A barytone one (πρώτος, όγδοος) keeps its stem accent: πρώτ+ος/ο/ου/η/ης.
    const oxytone = base.endsWith("ός");
    return base.slice(0, -2) + forms[oxytone ? 1 : 0]!;
}

/**
 * n → the ordinal's masculine-nominative WORDS. Greek inflects EVERY member of a compound ordinal
 * (δέκατος πέμπτος, εικοστός πρώτος), so this returns the parts and the caller inflects each.
 * Returns `undefined` past the range the corpus attests (1–100), so an out-of-range number is left alone.
 */
function ordinalParts(n: number): string[] | undefined {
    if (n < 1 || n > 100 || !Number.isInteger(n)) return undefined;
    if (n === 100) return ["εκατοστός"];
    if (n <= 12) return [ORD_UNITS[n]!];
    if (n < 20) return ["δέκατος", ORD_UNITS[n - 10]!];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? [ORD_TENS[t]!] : [ORD_TENS[t]!, ORD_UNITS[u]!];
}

/** n → the ordinal inflected to `written` ("15","ο" → «δέκατο πέμπτο"), or undefined if out of range. */
function ordinal(n: number, written: string): string | undefined {
    const parts = ordinalParts(n);
    return parts?.map((p) => inflect(p, written)).join(" ");
}

/** A run of Greek alphabetic-numeral signs → its value, or undefined if any sign is unknown. */
function greekNumeralValue(run: string): number | undefined {
    let total = 0;
    let i = 0;
    while (i < run.length) {
        const two = run.slice(i, i + 2);
        if (GREEK_NUMERAL[two] !== undefined) {
            total += GREEK_NUMERAL[two]!;
            i += 2;
            continue;
        }
        const v = GREEK_NUMERAL[run[i]!];
        if (v === undefined) return undefined;
        total += v;
        i++;
    }
    return total === 0 ? undefined : total;
}

/** One all-caps Latin run → its word reading if it has one, else its Greek letter names, spaced. */
function spellLatin(run: string): string {
    const word = WORD_ACRONYM[run];
    if (word !== undefined) return word;
    const names: string[] = [];
    for (const ch of run) {
        const n = LETTER_NAME[ch.toLowerCase()];
        if (n === undefined) return run; // not spellable ⇒ leave it for the foreign fallback
        names.push(n);
    }
    return names.join(" ");
}

// ── the ordered rules ───────────────────────────────────────────────────────────────────────────────

/** Normalize one Modern Greek input string. Pure text→text. */
export function normalizeGreek(input: string): string {
    let s = input;

    // 0) ANO TELEIA. Greek's semicolon is canonically U+0387, but that codepoint sits INSIDE the Greek
    //    letter range the engine's TOKEN uses for words, so it would be swallowed into the preceding word
    //    run and never reach the clause-mark alternation. Folded to U+00B7 MIDDLE DOT, which is what the
    //    corpus actually types (all 10 instances) and what greek.jsonc maps. Cheaper and safer than
    //    widening the letter class, which is shared with every other Greek rule.
    s = s.replace(/\u0387/gu, "\u00b7");

    // 1) LATIN↔GREEK HOMOGLYPHS. FIRST, because every rule after this one assumes that a Latin run is
    //    genuinely foreign text, and these are not — they are Greek words with a lookalike Latin letter
    //    typed into them: `oι`, `στo`, `τo`, `άγνωστo`, `ζωoτροφές`, `διάφορoυς`, `λογοκρiσίας`,
    //    `Bουλή`, `Yπό` (9), plus a bare Latin `o` typed for the article ο (3). The English fallback was
    //    splitting each of these into a Greek fragment plus an English letter name.
    //    Only fires where the Latin letter TOUCHES Greek script, so the token is already broken and a
    //    false positive is not reachable; the bare article is handled separately below.
    s = s.replace(
        /(?<=\p{Script=Greek})[A-Za-z]+|[A-Za-z]+(?=\p{Script=Greek})/gu,
        (run) => [...run].map((c) => HOMOGLYPH[c] ?? c).join(""),
    );
    //    A standalone lowercase Latin `o` is the article ο. Every letter the corpus genuinely DISCUSSES
    //    as a letter is a different one (c, g, r, n, v, V, H, O, A), so this claims nothing real.
    s = s.replace(/(?<![\p{L}\p{M}\d'’-])o(?![\p{L}\p{M}\d'’-])/gu, "ο");
    //    The SENTENCE-INITIAL capitals are the same defect one case up: `H` and `O` are the only Latin
    //    letters that are also whole Greek articles (Η, Ο), and the corpus has three — «H γεωργία»,
    //    «H Μεγάλη», «O Κάρολος». Restricted to sentence-initial position and a following Greek word,
    //    which is exactly what separates them from the genuine letter mentions: every one of those is
    //    mid-sentence and preceded by its own Greek article («το H στο pH», «το «O» ώστε»). Without this
    //    the initialism rule of step 14 would read the article as «έιτς».
    s = s.replace(/(^|[.!;·…»]\s+)([HO])(?=\s+\p{Script=Greek})/gu,
        (_m, lead: string, ch: string) => lead + HOMOGLYPH[ch]!);

    // 2) GREEK ALPHABETIC NUMERALS. Before every other rule that reads Greek capitals. The corpus writes
    //    the sign as U+0384 GREEK TONOS rather than the canonical U+0374 keraia, so both are accepted
    //    (and U+02B9, the modifier prime it is sometimes typed as). `Β΄` was reading as the LETTER beta.
    //    THE FORM EMITTED IS -ο (masculine accusative / neuter): five of the six corpus instances are
    //    exactly that («τον Β΄ Παγκόσμιο Πόλεμο», «τον Λουδοβίκο ΙΣΤ΄»); the sixth is a queen's regnal
    //    number and wants -η. Gender is not recoverable from the two tokens around the numeral, so the
    //    majority reading is taken rather than guessed at per-instance.
    s = s.replace(/(?<![\p{L}\p{M}])([Α-ΩϚ]{1,4})[΄ʹʹ](?![\p{L}\p{M}])/gu, (whole, run: string) => {
        const v = greekNumeralValue(run);
        if (v === undefined) return whole;
        return ordinal(v, "ο") ?? whole;
    });

    // 3) DOTTED ABBREVIATIONS, multi-dot ones only, and BEFORE any single-dot rule so their interior dots
    //    cannot survive as phrase breaks — `300 π.Χ.` was three pauses out of one word. Matched
    //    CASE-SENSITIVELY: π.Χ. is «προ Χριστού» and π.χ. is «παραδείγματος χάριν».
    //    The FINAL dot is consumed when a lowercase word or another punctuation mark follows (the
    //    abbreviation is mid-sentence) and KEPT otherwise, so a sentence-final `π.Χ.` does not lose its
    //    pause. All three polarities occur in the corpus, and the punctuation arm is not optional: `1000
    //    π.Χ., οι Ασσύριοι` would otherwise emit «προ Χριστού.,» — a full stop AND a comma, two clause
    //    marks where the text has one. That is the same double-gap the padded-clausePunctuation bug made
    //    in three earlier languages.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})(\\s*[,;:!?)\\]»·]|\\s+\\p{Ll}|)`, "gu"),
        (_m, ab: string, after: string) => `${DOTTED[ab]!}${after === "" ? "." : after}`);

    // 4) SINGLE-DOT ABBREVIATION `βλ.` → βλέπε. After step 3 so it cannot bite into a multi-dot form.
    s = s.replace(/(?<![\p{L}\p{M}])βλ\.(?=\s+\p{Ll})/gu, "βλέπε");

    // 5) RATES, kept LOCAL because Greek takes an agreeing definite article, not an invariant "per" —
    //    see the SYMBOLS comment. BEFORE the shared tier: the tier would otherwise claim `240 km` and
    //    strand `/h`, which then read as the English letter H.
    //    The corpus writes the slash spaced in two of the five (`165 χλμ / ώρα`, `83 χλμ/ ώρα`).
    s = s.replace(/(\d)\s?(?:km|χλμ)\s?\/\s?(?:h|ώρα)(?![\p{L}\p{M}])/giu, "$1 χιλιόμετρα την ώρα");
    s = s.replace(/(\d)\s?(?:mi|μίλια)\s?\/\s?(?:h|ώρα)(?![\p{L}\p{M}])/giu, "$1 μίλια την ώρα");
    s = s.replace(/(\d)\s?mph(?![\p{L}\p{M}])/giu, "$1 μίλια την ώρα");
    s = s.replace(/(\d)\s?m\s?\/\s?s(?![\p{L}\p{M}])/gu, "$1 μέτρα το δευτερόλεπτο");

    // 6) χλμ, after the rate rule has taken `χλμ / ώρα`. The dot is consumed only mid-sentence, for the
    //    same reason as step 3 — `70 χλμ. στην` must not keep a break, a sentence-final one must.
    s = s.replace(/(?<![\p{L}\p{M}])χλμ\.(?=\s+\p{Ll})/gu, "χιλιόμετρα");
    s = s.replace(/(?<![\p{L}\p{M}])χλμ(?![\p{L}\p{M}.])/gu, "χιλιόμετρα");

    // 7) DIGIT DE-GROUPING. FIRST among the number rules: Greek groups thousands with a PERIOD, so
    //    `1.000` was read as «ένα» + a phrase break + «μηδέν». Run twice for `5.000.000`. Only a block of
    //    EXACTLY three digits is grouping — `4:41.30` (a sports time) and `802,11` are left intact.
    for (let k = 0; k < 2; k++) s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");

    // 8) ORDINAL NOTATION. The Greek ending is the CASE and GENDER, not an ordinal marker: `15ο` is
    //    δέκατο πέμπτο, `9ης` ένατης, `18ου` δέκατου όγδοου — and BOTH members of a compound inflect, so
    //    the ordinal is composed and each part inflected rather than a suffix appended. After step 7 so a
    //    grouped number reaches it as digits. Bounded by explicit lookarounds (`\b` finds nothing here),
    //    and the trailing one is what stops `53χρονης` — the corpus's one digit+Greek non-ordinal — from
    //    being claimed.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d{1,3})(${ORD_ALT})(?![\\p{L}\\p{M}])`, "gu"),
        (whole, digits: string, written: string) => ordinal(Number(digits), written) ?? whole);

    // 9) CLOCK. The colon was a clause mark, so `11:00` read as «έντεκα , μηδέν». Hours are FEMININE
    //    (they count ώρες); minutes are neuter. A whole hour drops the minutes entirely, which is the
    //    ordinary Greek reading: «στις 11:00» = «στις έντεκα».
    //    GUARDED against a SPORTS time — the corpus has three (`4:41.30`, `2:11.60`, `1:09.02`), which are
    //    minutes and decimal seconds, not clock times. A dot-or-comma plus a digit after the minutes is
    //    the marker; the same trap claimed a Russian and an Indonesian time before it was written down.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?![.,]\d)/gu, (_m, h: string, mi: string) => {
        const hv = Number(h);
        const mv = Number(mi);
        return mv === 0 ? HOUR_FEM[hv]! : `${HOUR_FEM[hv]} και ${minuteWords(mv)}`;
    });

    // 10) DEGREES. `°C` was reading as the English letter C. Nominative plural is used; the case Greek
    //     would actually give it depends on the governing preposition and is not recoverable here.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 βαθμοί Κελσίου");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gu, "$1 βαθμοί Φαρενάιτ");
    s = s.replace(/(\d)\s?°/gu, "$1 βαθμοί");

    // 11) SIGNS and VULGAR FRACTIONS. `(UTC +1)`; and `29¾ επί 24½ ίντσες`, where the elided noun is
    //     feminine (ίντσα) — «είκοσι εννιά και τρία τέταρτα».
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing. Both halves are lifted from
    //    the plus and minus rules already in this file, so nothing is invented. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv all juxtapose with no conjunction; English is the
    //    outlier that needs "or", and it already has its own rule). Runs BEFORE the + rule: ± is a single
    //    character, so the + rule cannot see it, and putting it first keeps the sign audible either way.
    s = s.replace(/±/gu, " συν μείον ");
    s = s.replace(/(?<![\p{L}\p{M}\d])\+\s?(?=\d)/gu, "συν ");
    s = s.replace(/(\d)\s?½/gu, "$1 και μισή");
    s = s.replace(/(\d)\s?¼/gu, "$1 και ένα τέταρτο");
    s = s.replace(/(\d)\s?¾/gu, "$1 και τρία τέταρτα");

    // 11c) RELATIONAL AND DIVISION SIGNS. ⚠ SOURCED ENTIRELY AT TIER 4 — the corpus has nothing to give
    //      here, and says so in the two ways this issue has learned to distinguish:
    //
    //        `ίσον`  ×0 token / ×0 substring — ABSENT
    //        `διά`   ×0 token / ×338 SUBSTRING — every one inside `διάφορες`, `διαδικασία`, `διάρκεια`; the
    //                substring trap, and the largest count it has produced anywhere in the fleet
    //
    //      el.wikipedia's arithmetic articles then read the notation out, which is exactly the article class
    //      tier 4 wants — one that has to explain the signs to a reader:
    //
    //        "Το αποτέλεσμα εκφράζεται με ένα ίσον. Για παράδειγμα: 2 × 3 = 6"   (it NAMES the sign)
    //        "9 + 4 ίσον 1 modulo 12"      ·   "Το x πράγμα συν ένα ίσον δύο"
    //        "διαιρετός διά δύο (2)"       ·   "στη διαίρεση των πολυωνύμων Q(x) διά P(x)"
    //        "το μεγαλύτερο δυνατό πολλαπλάσιο των 365, το οποίο είναι μικρότερο από 3200"
    //
    //      `ίσον` is emitted bare, and here that is not a policy choice but the attested form: the source reads
    //      `9 + 4 ίσον 1` with no copula, and separately calls the sign "ένα ίσον". `διά` likewise sits directly
    //      between its operands.
    s = s.replace(/\s?=\s?/gu, " ίσον ");
    s = s.replace(/\s?<\s?/gu, " μικρότερο από ");
    s = s.replace(/\s?>\s?/gu, " μεγαλύτερο από ");
    s = s.replace(/\s?÷\s?/gu, " διά ");

    // 11b) THE PARENTHETICAL DASH → A PAUSE. This was reported for a whole sweep as a `signed-number` DROP,
    //      and the classification was wrong: it is not a minus, not a designation, and not ambiguous. Greek
    //      writes an APPOSITION between dashes where English would use commas or brackets —
    //      `Ο ναός Πνομ Κρομ –12 χιλιόμετρα νοτιοδυτικά του Σιέμ Ριπ– που βρίσκεται …` — and both dashes were
    //      dropped SILENTLY, so the aside ran into its host clause with no break at all:
    //        was  `… pnom kɾom ðeka ðio çiʎometɾa … sçem ɾip pu vɾiscete …`
    //        now  `… pnom kɾom , ðeka ðio çiʎometɾa … sçem ɾip , pu vɾiscete …`
    //      The missing thing is a PHRASE BREAK, not a word, which is why no amount of looking for a minus
    //      vocabulary was ever going to close it.
    //
    //      THE CORPUS SEPARATES THE TWO USES BY CHARACTER, exactly and with no overlap. Counted across el_gr:
    //        · ASCII hyphen before a digit ×29 — EVERY one a range or a designation (`3-5%`, `1469-1539`,
    //          `56-64 χιλιόμετρα/ώρα`, `7:00-8:00`, `26 - 00`, `COVID-19`, `Chandrayaan-1`)
    //        · EN DASH before a digit ×1 — the parenthetical above.  EM DASH before a digit ×0.
    //      So there are ZERO true negatives in this corpus and the en/em dash is never arithmetic. That is
    //      what makes this safe to key on the dash CHARACTER: ranges are written with `-` and are untouched.
    //
    //      ⚠ WHITESPACE IS THE DISCRIMINATOR, and one instance proves it is needed. Of the 21 en/em dashes,
    //      20 are appositional and have a space on at least one side; the twenty-first is `Apollo–Soyuz`
    //      (which this corpus leaves in LATIN script), a COMPOUND joining two proper nouns, with no space on
    //      either side — the "en dash as a joiner" convention. A pause there would be wrong,
    //      so the rule requires adjacent whitespace and the compound is left alone. 20/20 against 1/1.
    //      The `(?<=\S)` guard keeps a sentence-initial dash from producing a leading comma (a SLOT-GAP).
    s = s.replace(/(?<=\S)(?:\s+[–—]\s*|[–—]\s+)/gu, ", ");

    // 11c) THE MINUS → μείον, and this one is ROBUSTNESS, not a measured repair — said plainly because the
    //      file's other sign rules are corpus-attested and this one cannot be. el_gr contains ZERO true
    //      negatives (all 30 dash-before-digit instances are ranges, designations or the apposition above),
    //      so no gate can see this and the corpus diff for it is empty BY CONSTRUCTION.
    //      It is worth having anyway because the asymmetry is indefensible on its own terms: step 11 already
    //      voices `+` as συν from a single `(UTC +1)`, and a `-5` that reads exactly like `5` is silent
    //      content loss of the kind #586 exists to remove.
    //      THE GUARD IS THE ONE `tools/normalization/defects.ts` arrived at after resolving all 66 artifacts
    //      by hand, reused rather than reinvented: no letter, mark or digit before (which excludes the
    //      designations `COVID-19` and `Chandrayaan-1`), and not a RANGE — the second lookbehind spans a
    //      digit plus at most an ordinal suffix, an abbreviating dot and one space, which is what rejects
    //      `35-40`, `(1469-1539)`, `7:00-8:00` and the spaced `26 - 00`.
    //      The en/em dashes are gone by step 11b, so this only ever sees ASCII `-` and U+2212.
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−](?=\p{Nd})/gu, "μείον ");

    // 12) SHARED SYMBOL TIER: %, currency, plain units, squared/cubed. AFTER the rate and degree rules,
    //     which need the raw `km/h` and `°C`, and BEFORE the decimal rewrite of step 13 — the tier only
    //     matches a unit when a NUMBER is adjacent, and inserting «κόμμα» destroys that adjacency.
    s = SYMBOLS(s);

    // 13) DECIMAL COMMA. Greek's decimal mark is the comma and the tokenizer read it as a clause break:
    //     `2,3` was «δύο , τρία». Read as «κόμμα». AFTER step 12 (see above) and after step 7, so a
    //     grouping period can never reach here.
    s = s.replace(/(\d),(?=\d)/gu, "$1 κόμμα ");

    // 14) LATIN INITIALISMS → Greek letter names. LAST of all, so every rule above still sees the ASCII
    //     it matches on — the unit, rate and degree rules are keyed on lowercase letters that an
    //     all-caps rule cannot reach, and `mi`/`km` must have been consumed before `MI` could be spelled.
    //     Bounded by Latin-script lookarounds on both sides (`\p{Script=Latin}`, not `[A-Za-z]`, so
    //     `Haldarsvík` is not split at its í) and by a digit guard, which excludes `H5N1` and `4x4`. A
    //     HYPHEN is deliberately NOT a boundary: `COVID-19`, `XDR-TB` and `Super-G` each carry a real
    //     initialism on one side of it. An apostrophe IS one, or the `s` of `People's` reads as a letter.
    for (const [k, v] of Object.entries(MIXED_CASE_INITIALISM))
        s = s.replace(new RegExp(`(?<![\\p{Script=Latin}\\d])${k}(?![\\p{Script=Latin}\\d])`, "gu"), v);
    s = s.replace(/(?<![\p{Script=Latin}\d'’])[A-Z]{2,}(?![\p{Script=Latin}\d'’])/gu, spellLatin);
    //     Single letters, same boundaries: the corpus's 9 remaining ones are genuine letter mentions
    //     («το c και το g», «το H στο pH», «μοιάζει με V») or an initial (`A(H5N1)`).
    s = s.replace(/(?<![\p{Script=Latin}\d'’&])[A-Za-z](?![\p{Script=Latin}\d'’&])/gu, spellLatin);

    return s;
}
