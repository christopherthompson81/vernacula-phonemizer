/**
 * Turkish (tr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED OVER THE 1,876 UNIQUE tr_tr FLEURS UTTERANCES (column 3, the cased one):
 *   apostrophe suffix on a numeral   ×115 in 107 utterances (1985'te, 1970'lerin, 36'sı, %80'ini)
 *   all-caps initialisms             ×161 in 138 utterances (ABD ×31, BM ×5, MÖ ×5, MS ×4, FBI ×3, GMT ×3 …)
 *   bare `N.` ordinals               ×42  in  36 utterances (18. yüzyıl, 1. Dünya Savaşı, 247. Maddesine)
 *   dot-grouped thousands            ×29  (already correct — 1.234 → bin iki yüz otuz dört)
 *   apostrophe suffix on an acronym  ×40  (FBI'ın, ABD'ye, TBMM'nin)
 *   clock                            ×9 colon-form + ×4 dot-form (11:35'te, 12.00 GMT)
 *   compound `/` units               ×5  (83 km/s, 64 km/saat, 133m/s)
 *   comma decimals ×13, percent ×4, `vb.` ×7, `Dr.` ×5, `¥` ×2, `°` ×2, `M.Ö.` ×1, `+` ×1
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `18. yüzyıl`   → `ˈon secˈiz . jyzjˈɯɫ`     cardinal + a spurious PHRASE BREAK
 *   `ABD'ye`       → `ˈabd jˈe`                 a vowelless cluster; Turkish says *a be de*
 *   `11:35'te`     → `ˈon bˈiɾ , otˈuz bˈeʃ tˈe` the colon became a COMMA PAUSE
 *   `1985'te`      → `… bˈeʃ tˈe`               the suffix split off as its own stressed word
 *   `MÖ 10.`       → `mˈø ˈon .`                read as the word *mö*
 *   `30°C`         → `otˈuz d͡ʒ`                 ° dropped, C read as Turkish c
 *   `83 km/s`      → `… ciɫometɾˈe s`           a bare consonant left over from the slash
 *
 * THE ORDINAL DETECTOR IS BUILT FROM THE CORPUS, not from intuition — Turkish writes the ordinal as a numeral
 * plus a bare period (`18. yüzyıl`) exactly as German does, and a regex cannot tell that from a sentence-final
 * digit. Tabulating all 42 bare `N.` (a period that is neither thousands-grouping nor a decimal):
 *   AFTER  yüzyıl* ×15, Dünya ×4, sırada/sıradaki/sırasındaydı ×4, asırda/yüzyıllar ×2, and 16 further
 *          ordinary head nouns (Maddesine, Süvari, Elizabeth'in, Kategoride, gününde, adası, goldü, pulu …)
 *          — 41 of the 42 are followed by whitespace and another token, and ALL 41 read as ordinals.
 *   NOTHING AFTER ×1 — `rekoru 7-2.`, a score at the end of the utterance. That is the sentence-final period
 *          that must NOT be claimed.
 * So the rule is: a bare `N.` followed by whitespace and another token is an ordinal; at end of input it is
 * left alone. ZERO SENTENCE-FINAL PAUSES ARE LOST — the single sentence-final instance in the corpus fails the
 * lookahead. Unlike German, Turkish needed no licenser word: the corpus has no counter-example to claim
 * against, and requiring one would have cost the 16 ordinals whose head noun is an ordinary word.
 *
 * WHY TWO OF THESE RULES ARE NOT text→text. `ordinalWords` and `attachSuffix` are exported for the TOKENIZER
 * rather than applied here, because number words must reach `phonemizeWord(w, /*finalStress*\/ true)`. The
 * word path's pre-accenting-suffix morphology mis-stresses exactly the cardinals ending in -Iz: sekiz →
 * *sˈeciz* (correct secˈiz), dokuz → *dˈokuz* (correct dokˈuz), otuz → *ˈotuz* (correct otˈuz). Emitting
 * `bin dokuz yüz seksen beşte` as plain text would therefore have REGRESSED the ~60 corpus years in the
 * 1900s. Every ordinal word itself (birinci … bininci) and every suffixed form (beşte, yirmiye, yetmişlerin)
 * is identical under both paths, so only the cardinal prefix is at stake — and the tokenizer seam keeps it.
 *
 * DELIBERATELY LEFT (see the commit message):
 *   ranges/scores ×17 — `1995-96`, `(1469–1539)`, `21-20`. The dash is currently dropped, which is harmless;
 *     Turkish reads a score as two bare numerals but a year range with `ila`/`-den …-e`, and nothing in the
 *     corpus distinguishes them. A wrong connective is worse than no connective.
 *   fractions ×1 — `(1/5`. The construction (locative of the denominator + numerator, *beşte bir*) is certain
 *     but the machinery is not worth one instance, and `1/2` also spells dates and scores.
 *   readable-but-letter-spelled acronyms — AOL ×3, CEO ×2, USOC ×2, IOC, IP, CET. The phonotactic OOV test
 *     lets them through as words because they ARE syllabifiable; whether Turkish spells each of them out is a
 *     lexical fact I could not source per token, and `acronymLetters` is where it would go if I could.
 *   `q`/`w`/`x` are not in the Turkish alphabet and TDK gives them no letter name, so they are absent from
 *     LETTER_NAME; `spellOut` then returns undefined and the token (QVC, XDR, SWAPO, UW, WNED, QC) is left
 *     exactly as it was rather than spelled with an invented name.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { trLower } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

const VOWEL = /[aeıioöuü]/u;

/** Four-way vowel harmony: the high vowel a suffix takes after each possible last stem vowel. */
const HIGH: Readonly<Record<string, string>> = { a: "ı", "ı": "ı", e: "i", i: "i", o: "u", u: "u", "ö": "ü", "ü": "ü" };

function lastVowelOf(w: string): string | undefined {
    for (let i = w.length - 1; i >= 0; i--) if (VOWEL.test(w[i]!)) return w[i]!;
    return undefined;
}

/**
 * Integer → the Turkish ORDINAL, i.e. the cardinal with the ordinal suffix on its LAST word: 18 → `on
 * sekizinci`, 247 → `iki yüz kırk yedinci`, 1000 → `bininci`. The suffix is -(I)ncI under four-way harmony —
 * -ncI after a vowel-final stem (iki → ikinci, altı → altıncı), -IncI after a consonant (beş → beşinci, on →
 * onuncu, yüz → yüzüncü, doksan → doksanıncı). `dört` is the sole irregular stem (dörd- → dördüncü).
 */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0) return undefined;
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ");
    let stem = words[words.length - 1]!;
    if (stem === "dört") stem = "dörd";
    const v = lastVowelOf(stem);
    if (v === undefined) return undefined;
    const h = HIGH[v]!;
    words[words.length - 1] = VOWEL.test(stem[stem.length - 1]!) ? `${stem}nc${h}` : `${stem}${h}nc${h}`;
    return words.join(" ");
}

/**
 * Glue an apostrophe-attached case/possessive/plural suffix onto the LAST word of a spoken numeral:
 * `1985'te` → bin dokuz yüz seksen **beşte**, `1970'lerin` → … **yetmişlerin**, `36'sı` → otuz **altısı**.
 * Turkish orthography already writes the suffix in the form the SPOKEN numeral demands, so plain
 * concatenation is correct and no harmony computation is needed here.
 *
 * The one thing concatenation does NOT get for free is final-stop voicing before a vowel-initial suffix,
 * and among the cardinals exactly one word is affected: `dört` → *dörd*- (34'ü → otuz **dördü**, not
 * *dörtü*). `üç` and `kırk` end in ç/k but do not soften, and every other cardinal ends in a vowel or in
 * r/n/z/ş. This is the same irregular stem `ordinalWords` needs for *dördüncü*.
 */
export function attachSuffix(words: string[], suffix: string): string[] {
    if (words.length === 0) return [suffix];
    const out = words.slice();
    const last = out[out.length - 1]!;
    const stem = last === "dört" && VOWEL.test(suffix[0] ?? "") ? "dörd" : last;
    out[out.length - 1] = stem + suffix;
    return out;
}

/** Dotted abbreviations → the spoken words. Counts are corpus counts; `vb.` and `Dr.` are the frequent ones
 *  and both previously left the interior dot behind as a phrase break (`vb.` → `vb .`). */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    vb: "ve benzeri", // ×7
    vs: "ve saire", // ×1
    dr: "Doktor", // ×5
    no: "numara", // ×1
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Turkish letter names (TDK alphabet, 29 letters). q/w/x are NOT Turkish letters and are deliberately
 *  absent — see the file header. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ce", "ç": "çe", d: "de", e: "e", f: "fe", g: "ge", "ğ": "yumuşak ge",
    h: "he", "ı": "ı", i: "i", j: "je", k: "ke", l: "le", m: "me", n: "ne", o: "o", "ö": "ö",
    p: "pe", r: "re", s: "se", "ş": "şe", t: "te", u: "u", "ü": "ü", v: "ve", y: "ye", z: "ze",
};

/** Turkish phonotactics, for the OOV rule in core/initialisms.ts. Native Turkish words admit NO initial
 *  cluster at all; the onsets listed are the obstruent+liquid and s+stop clusters loanwords brought in. */
export const isUnreadableTurkish = makeUnreadableTest({
    vowels: /[aeıioöuüâîû]/u,
    legalOnsets: new Set([
        "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "ps", "sk", "sl", "sm",
        "sn", "sp", "st", "tr",
        "ch", "yl", "sf",
    ]),
    legalCodas: new Set([
        "ft", "kt", "ks", "lç", "lf", "lk", "lm", "lp", "ls", "lt", "nç", "nk", "ns", "nt", "nz",
        "pt", "rç", "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rz", "sk", "st", "şt",
        "zm", "ng", "lg", "ht", "ny", "nc",
    ]),
});

/** Turkish has no pronunciation dictionary here (the g2p is rule-based), so nothing is "recorded" and the
 *  decision rests on the phonotactic OOV test alone. `acronymLetters` is empty on purpose — see the header. */
const normalizeInitialisms = makeInitialismNormalizer({
    // ⚠ `trLower`, NOT the shared default `toLowerCase`, which is locale-blind and gets the dotted-I pair
    // wrong in both directions: `I` (DOTLESS capital) lowercased to `i` was spelled with the wrong letter
    // name — `IMF` → *i me fe* where Turkish says *ı me fe* — and `İ` lowercases to `i` + U+0307, a name
    // `LETTER_NAME` cannot have, so `spellOut` declined and `İETT` was read as the WORD /iˈetː/. The g2p
    // already owns this function; the pass now borrows it rather than keeping a second, wrong copy.
    lower: trLower,
    letterName: (l) => LETTER_NAME[l],
    acronymLetters: new Set<string>(),
    isRecorded: () => false,
    isUnreadable: isUnreadableTurkish,
});

/**
 * Normalize one Turkish input string. Pure text→text; the numbered steps are ORDER-DEPENDENT and each
 * coupling is stated where it applies.
 *
 * The whole pass runs BEFORE the shared symbol tier (`makeSymbolNormalizer`) — see turkish.ts. That is the
 * coupling step 4 depends on: the shared tier matches a unit only when a NUMBER is adjacent, and it would
 * turn `83 km/s` into `83 kilometre/s`, leaving the slash and a bare `s` behind.
 */
export function normalizeTurkish(input: string): string {
    let s = input;

    // 1) ERA markers, before the single-dot abbreviation rule so `M.Ö.`'s interior dot cannot survive as a
    //    phrase break, and before the initialism pass (step 7) which would otherwise spell MÖ as *me ö*.
    //    MÖ/MS are only claimed before a NUMBER: `MS` alone is multiple sclerosis in 2 of its 3 corpus
    //    occurrences ("MS olmaya", "MS; beyin …"), and only "MS 400" is the era.
    s = s.replace(/(?<![\p{L}\p{M}])M\.\s?Ö\./gu, "milattan önce");
    s = s.replace(/(?<![\p{L}\p{M}])M\.\s?S\./gu, "milattan sonra");
    s = s.replace(/(?<![\p{L}\p{M}])MÖ(?=\s+\d)/gu, "milattan önce");
    s = s.replace(/(?<![\p{L}\p{M}])MS(?=\s+\d)/gu, "milattan sonra");

    // 2) DOTTED ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a phrase
    //    break; at a phrase end it stays, because there it really is the sentence end. Boundaries are
    //    explicit lookarounds, never `\b` — `\b` is ASCII-defined and finds no boundary against ı/ö/ü/ş/ç/ğ.
    s = s.replace(/(?<![\p{L}\p{M}])No\.['’]lu(?![\p{L}\p{M}])/gu, "numaralı"); // 11 No.'lu → 11 numaralı
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 3) CLOCK, before anything else can read the separator: the colon is clause punctuation (it became a
    //    COMMA PAUSE inside `11:35`) and the dot is the thousands separator. Both written forms occur.
    //    Output stays DIGITS so the number path — not the word path — expands them; see the header on
    //    finalStress. Zero minutes are dropped, as Turkish says "saat on bir", not "on bir sıfır sıfır".
    //    The dot form declines when an apostrophe follows (`11.00'dan` ×1): collapsing it to `11'dan` would
    //    glue a suffix chosen for *sıfır sıfır* onto *bir*, breaking vowel harmony.
    const clock = (_m: string, h: string, min: string): string => (Number(min) === 0 ? h : `${h} ${min}`);
    s = s.replace(/(?<![\d.,:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu, clock);
    s = s.replace(/(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d'’])/gu, clock);

    // 4) COMPOUND `/` UNITS, before the shared symbol tier (see the function header). Turkish states the
    //    rate first — "saatte 83 kilometre" — so this reorders rather than substituting in place. It
    //    declines when the unit itself carries a suffix (`km/saate` ×1), where the reorder would strand it.
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?km\s?\/\s?(?:saat|sa|s)(?![\p{L}\p{M}])/gu, "saatte $1 kilometre");
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?mil\s?\/\s?(?:saat|sa|s)(?![\p{L}\p{M}])/gu, "saatte $1 mil");
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])/gu, "saniyede $1 metre");

    // 5) DEGREE. `°` was dropped outright and a trailing C was read as Turkish c → d͡ʒ.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 derece");
    s = s.replace(/(\d)\s?°/gu, "$1 derece");

    // 6) SIGNS. `UTC+1` ×1 — the sign vanished entirely.
    // ⚠ ± AND THE MINUS ARE HERE ON THE STRENGTH OF THE SAME SOURCE AS THE RELATIONAL RULES BELOW:
    //    tr.wikipedia's arithmetic article names the subtraction sign outright — «Çıkarma sembolü "eksi" (-) ile
    //    ifade edilir» — naming the word against the SIGN. With `artı` already in this file, ± is then the
    //    two juxtaposed, at no further sourcing cost.
    //    ⚠ ± NEEDS ITS OWN RULE: it is a single character (U+00B1), not a `+`, so no `+` rule can match
    //    inside it and the sign would otherwise be dropped in silence.
    s = s.replace(/±/gu, " artı eksi ");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 artı $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1artı $2");
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1eksi $2");

    // 6b) RELATIONAL AND DIVISION SIGNS. ⚠ TURKISH IS THE FIRST LANGUAGE WHERE THE READING REQUIRES CASE
    //     MORPHOLOGY ON AN OPERAND, and the source states every reading in full. tr.wikipedia's arithmetic
    //     article writes the sentence and the notation side by side:
    //
    //       "beş artı üç sekize eşittir"        5 + 3 = 8     — sekiz → sekizE, the DATIVE
    //       "bir artı bir eşittir iki"          1 + 1 = 2     ⚠ AND THE SAME ARTICLE, INFIX AND CASE-FREE
    //       "iki artı iki eşittir dört"         2 + 2 = 4     ⚠ likewise
    //       "yirmi bölü beş dört eder"          20 / 5 = 4    — `bölü` is INFIX, no case
    //       "6 bölü 3 kaçtır?"                                — and again with digits
    //       "∣b∣'den kesinlikle küçüktür"                      ⚠ the comparative takes the ABLATIVE
    //
    //     ⚠ SO THE EQUALITY HAS TWO ATTESTED READINGS AND THE SIMPLER ONE WINS. `sekize eşittir` is dative and
    //     postposed; `eşittir iki` is infix with no case at all, and both come from the same article. The infix
    //     form is shipped because it does not require inflecting an operand — which matters beyond tidiness: a
    //     case-marked reading can only be built for an operand the rule can SPELL, so the dative version would
    //     have left `x = y` unread while the infix version handles any operand. Choosing between two attested
    //     forms on what the rule can actually construct is a criterion the earlier languages never needed.
    //
    //     The comparatives have no such alternative — the ablative is the construction — so `<` and `>` are
    //     postposed and fire only between two numbers, leaving the sign as it was where they cannot.
    //
    //     ⚠ WHICH MEANS THE RULE MUST INFLECT A NUMBER IT SPELLS ITSELF. The suffix's vowel is chosen by
    //     harmony from the stem's LAST vowel and its consonant assimilates to a voiceless stem final — both
    //     properties of the WORD — so the digits are spelled here and the suffix built from the result. The
    //     harmony classes come from this file's existing `VOWEL` data rather than a second hand-written table.
    //     Verified across the whole numeral vocabulary (bir…milyar): üçten, dörtten, altıdan, kırktan, yüzden.
    const lowVowel = (stem: string): string => {
        const v = lastVowelOf(stem);
        return v !== undefined && "aıou".includes(v) ? "a" : "e";
    };
    /** Ablative -DEn: the consonant assimilates to a voiceless stem final (üç → üçten, dört → dörtten). */
    const ablative = (w: string): string => {
        const head = w.slice(0, w.lastIndexOf(" ") + 1), stem = w.slice(w.lastIndexOf(" ") + 1);
        const d = "pçtkfhsş".includes(stem[stem.length - 1]!) ? "t" : "d";
        return `${head}${stem}${d}${lowVowel(stem)}n`;
    };
    const trWord = (t: string): string => numberToWords(Number(t)) || t;
    const OPERAND = String.raw`\d+`;
    const postposed = (sign: string, inflect: (w: string) => string, verb: string): void => {
        s = s.replace(new RegExp(`(${OPERAND})\\s?${sign}\\s?(${OPERAND})`, "gu"),
            (_m, a: string, b: string) => `${trWord(a)} ${inflect(trWord(b))} ${verb}`);
    };
    postposed("<", ablative, "küçüktür");
    postposed(">", ablative, "büyüktür");
    s = s.replace(/\s?=\s?/gu, " eşittir ");
    s = s.replace(/\s?÷\s?/gu, " bölü ");

    //     THE AMPERSAND, dropped before, is a Latin-script printing ligature rather than an arithmetic sign —
    //     but Turkish IS a Latin-script language, so unlike `ko`/`ja` (where the symbol arrives inside a Latin
    //     run and takes a LOAN reading, 앤드 / アンド) the natural reading here is the language's own conjunction.
    //     `nl` already reads `&` as its native `en` on the same grounds.
    s = s.replace(/\s?&\s?/gu, " ve ");

    // 7) INITIALISMS, LAST of the letter rules: it must run after step 1 (else MÖ → *me ö*) and after step 2
    //    (else an abbreviation's letters are spelled). Roman numerals need no sequencing here — `tr` is not
    //    in registry.ts's ROMAN_NATIVE, so `II. Dünya Savaşı` has already become `2. Dünya Savaşı` before
    //    text() is called, and the ordinal rule then reads it correctly.
    s = normalizeInitialisms(s);

    return s;
}
