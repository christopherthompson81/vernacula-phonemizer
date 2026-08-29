/**
 * Ewe (ee) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA. Ported from
 * src/languages/ewe/normalize.ts, whose header carries the corpus counts behind every word chosen and the
 * check that refused every class deliberately declined. Nothing is re-derived here.
 *
 * ⚠ THERE IS NO FLEURS FOR EWE — the evidence is ee.wikipedia (tools/corpus/mined/ee.jsonc, 5,921
 * paragraphs, 398 retained) plus the attest cache, and the corpus is code-mixed three ways (English, French
 * names, Twi/Akan). See the TS for which count says which.
 *
 * ⚠ THE HOMOGLYPH FOLD IS WHY THIS FILE OPENS THE WAY IT DOES. A census of the artifact's 59,150 non-ASCII
 * characters found four standing in for an Ewe one — ⟨Ð⟩ U+00D0 and ⟨Đ⟩ U+0110 for ⟨Ɖ⟩, ⟨Ƞ⟩ U+0220 for
 * ⟨Ŋ⟩, and U+0342 COMBINING GREEK PERISPOMENI for the nasalization tilde U+0303. The three LETTERS are all
 * capitals and all word-initial (the keyboard story: the writer has ⟨ɖ ŋ⟩ on the lowercase layer and reaches
 * for a Latin-1 lookalike for the capital), and each ended the WORD, sending the fragment to the English
 * fallback as a letter name — `Ðasefowo` → *dˈiː asefowo*. The combining mark is the quiet one: it was
 * simply dropped, so /hã/ read as /ha/ and nothing about the output looked wrong (trap 56).
 *
 * ⚠ CAPITALS ONLY, AND ONLY THE FOUR THAT ARE ATTESTED (trap 9). The lowercase lookalikes are ×0 here AND
 * are live characters in the text that IS here: ⟨ð⟩ and ⟨ƞ⟩ appear in English IPA, and ⟨ʊ⟩ U+028A — which
 * looks exactly like ⟨ʋ⟩ — sits inside this wiki's parenthesised English pronunciation glosses. Folding it
 * would corrupt them. The fold is also LOCAL and cannot go to Core: a generic compatibility fold maps Ð→D
 * and Ewe needs Ð→Ɖ, a different phoneme.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Ewe;

public static class Normalize
{
    /**
     * PERCENT, and it is POSTPOSED — `le alafa me`, literally "in a hundred". Both of ee.wikipedia's
     * instances are the percent slot and are read; corroborated off-wiki by a published Ewe word list, and
     * `alafa` = 100 is the engine's own number data. Sourced arithmetic, not an invention.
     * ⚠ NO REDUNDANCY GUARD, because this corpus never writes both: `%` co-occurring with any `alafa`
     * within 40 characters is ×0, where Akan's same corpus shape was 17.3%.
     */
    private const string PERCENT = "le alafa me";

    /**
     * RANGE CONNECTIVE, and the part of speech was checked (the Fula `hakkunde` lesson). Two candidates are
     * attested; what decides it is the BARE INFIX this rule actually emits, and only `va ɖo` has it on
     * NUMBERS — the corpus's own "0.5 va ɖo 2 °C". `vaseɖe` bare is "until" with a single endpoint, a
     * different construction.
     */
    private const string TO = "va ɖo";

    /**
     * UNITS — a missing KEY, not a missing word (trap 38), and the unit noun is written BEFORE the figure.
     *
     * ⚠ THE ORDER IS THE FINDING, and it is Ewe's own: the shared tier can only POSTPOSE, so this has to be
     * local. Every attested instance puts the noun first — `kilometa 240`, `meta 100`, `milimeta 1,439`,
     * `sentimeta 156` — so the rule REORDERS: `56.52m` → `meta 56.52`.
     * ⚠ THE METRE IS `meta`, NOT `mita`, AND ONLY THE CORPUS SAYS SO. `mita` is ×1 and that one is inside an
     * English athletics line; `meta` is ×33 in Ewe sentences, and `kilomita` — the Akan spelling, the
     * obvious thing to copy from the nearest treated neighbour — is ×0 here (trap 55: the sibling is a
     * hypothesis). ⚠ NO `kg`: `kilogram`/`kilo` are ×0, and its one digit-adjacent instance is a judo
     * weight class. It stays raw rather than being sourced out of nowhere.
     */
    private static readonly (string Sym, string Word)[] UNITS =
    [
        // Longest key first, so `mm`/`cm` are tried before the bare `m`.
        ("km", "kilometa"), ("cm", "sentimeta"), ("mm", "milimeta"), ("m", "meta"),
    ];

    /** The same abbreviations with no numeral in reach — a caption or a table header. Shared guards
     *  (Core/NormalizeSymbols.cs): multi-letter vowel-free keys only, so the bare `m` is untouched. */
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        UNITS.Select(u => new KeyValuePair<string, string>(u.Sym, u.Word)));

    /**
     * CURRENCY, PREPOSED — the corpus and the wiki both write the money noun in front of the amount:
     * `dɔlar 500`, `cedi 1,000`, `euro miliɔn 45`, `pound biliɔn 16.5`.
     *
     * ⚠ `dɔla` IS NOT THE DOLLAR, AND IT IS THE TRAP THIS TABLE EXISTS TO AVOID. It looks like the obvious
     * spelling and it is ×3 on ee.wikipedia as a completely different word — the SERVANT ("kluvi kple
     * dɔla", slaves and servants). The money word is `dɔlar`, ×48 over 11 articles, every hit in a money
     * slot. Trap 37, with the loser one letter away from the winner.
     * ⚠ THE CEDI IS `cedi` HERE, AND THAT IS A DECISION WITH A COST. Ewe's engine maps ⟨c⟩ → /t͡s/, so this
     * reads [t͡sedi] where the currency is [sedi] — one segment off. `sedi`/`sedzi` are ×0 both on the wiki
     * and in the corpus, so writing either would be authoring a spelling for the language; `cedi` is what
     * Ewe text actually writes. (Akan went the other way for its own reason — ⟨c⟩ is not an Akan letter at
     * all and read [kedi].)
     * ⚠ `GH¢` / `GH₵` / `GHS` MUST BE TRIED BEFORE THE BARE `¢`/`₵`, or the `GH` is stranded and read as a
     * two-letter word. The corpus writes `GH¢` with U+00A2, not the cedi sign U+20B5.
     */
    private static readonly (string Sym, string Word)[] CURRENCY =
    [
        ("GH¢", "cedi"), ("GH₵", "cedi"), ("GHS", "cedi"), ("GHC", "cedi"), ("¢", "cedi"), ("₵", "cedi"),
        ("US\\$", "dɔlar"), ("\\$", "dɔlar"), ("€", "euro"), ("£", "pound"),
    ];

    /** A NUMBER OPERAND that ends in a digit. ⚠ The trailing `\d` is not decoration: a class like `[\d.,]*`
     *  also swallows a following CLAUSE comma or sentence period, which is harmless while a rule writes `$1`
     *  back out and silent data loss the moment it writes words around it (trap 14's Welsh hazard). */
    private const string NUM = @"\d+(?:[.,]\d+)*";

    /** Not inside a word — `\p{M}` beside `\p{L}` (trap 23), and never `\b`, which is ASCII-defined
     *  (trap 1). */
    private const string NLB = @"(?<![\p{L}\p{M}])";

    /** A currency sign a few characters to the left, which is what makes a following `m`/`mm` a MAGNITUDE
     *  and not a unit: the corpus's `$400mm` is four hundred MILLION dollars, and the unit table would
     *  otherwise read it as 400 millimetres (trap 46's shape). The guard works because step 6 has not spent
     *  the sign yet, which is the second reason units run before currency. */
    private const string NOT_MAGNITUDE = @"(?<![$€£¢₵][^\d]{0,3}[\d.,]{0,12})";

    // ── The compiled tables. Hoisted rather than built per call; the TS builds them inline in the loop. ──

    /** Step 1, the homoglyph fold. Three rewrites in sequence, then a re-NFC (see NormalizeEwe). */
    private static readonly JsRe HOMO_D = JsRegex.Compile("[ÐĐ]", "gu");   // Ð Đ → Ɖ
    private static readonly JsRe HOMO_ENG = JsRegex.Compile("Ƞ", "gu");         // Ƞ  → Ŋ
    private static readonly JsRe HOMO_TILDE = JsRegex.Compile(@"\u0342", "gu");       // ◌͂  → ◌̃
    private const string ED = "Ɖ";     // Ɖ LATIN CAPITAL LETTER AFRICAN D
    private const string ENG = "Ŋ";    // Ŋ LATIN CAPITAL LETTER ENG
    private const string TILDE = "\u0303";  // ◌̃ COMBINING TILDE

    // Step 2: HTML entities and zero-width marks.
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;?", "giu");
    private static readonly JsRe NDASH_ENTITY = JsRegex.Compile("&ndash;", "giu");
    private static readonly JsRe NUMERIC_ENTITY = JsRegex.Compile(@"&#(?:x[0-9a-f]+|\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile(@"[\u200b\u200c\u200d\ufeff]", "gu");

    // Step 3: digit de-grouping. ⚠ NO DOT ARM — there is no dot-grouped number in this corpus at all, so
    // the shape that forced Akan's two-group asymmetry is absent.
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu");
    private static readonly JsRe COMMA_ALL = JsRegex.Compile(",", "gu");
    // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        @"(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)", "gu");
    private static readonly JsRe SPACE_ALL = JsRegex.Compile(@"[ \u00a0\u202f\u2009]", "gu");

    // Step 4: units. The squared arm for every key, then the plain arm for every key.
    private static readonly JsRe[] UNIT_SQUARED = UNITS.Select(u => JsRegex.Compile(
        $@"{NOT_MAGNITUDE}(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{u.Sym}(?:²|2)(?![\p{{L}}\p{{M}}\d²³/])", "gu")).ToArray();
    private static readonly JsRe[] UNIT_PLAIN = UNITS.Select(u => JsRegex.Compile(
        $@"{NOT_MAGNITUDE}(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{u.Sym}(?![\p{{L}}\p{{M}}\d²³/])", "gu")).ToArray();

    // Step 5: percent.
    private static readonly JsRe PERCENT_RANGE = JsRegex.Compile(
        $@"(?<![\d.,:\-–—])({NUM})\s?%?\s?[-–—]\s?({NUM})\s?%", "gu");
    private static readonly JsRe PERCENT_ONE = JsRegex.Compile($@"(?<![\d.,])({NUM})\s?%", "gu");

    // Step 6: currency.
    private static readonly JsRe[] CURRENCY_RE = CURRENCY.Select(c => JsRegex.Compile(
        $@"{NLB}{c.Sym}\s?({NUM})", "gu")).ToArray();

    /** Step 7. ⚠ `\p{L}` AND NOT THE FLEET'S USUAL `[^\W\d_]`, which is trap 1 wearing a different mask:
     *  `\w` is ASCII-defined even under the `u` flag, so `[^\W\d_]` does not contain ⟨Ŋ⟩ — and Ewe's own era
     *  marker is `D.M.Ŋ.`, whose SECOND dot the ASCII class therefore left in place (`dm . ŋ .`). */
    private static readonly JsRe INTERIOR_DOT = JsRegex.Compile(@"(?<=\p{L})\.(?=\p{L}\.)", "gu");

    // Step 8: ranges.
    private static readonly JsRe RANGE = JsRegex.Compile(
        @"(?<![\d.,:\p{L}\p{M}\-–—])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}\-–—])", "gu");

    // Step 9: the decimal point.
    private static readonly JsRe DECIMAL_DOT =
        JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d+)(?![\d.\p{L}\p{M}])", "gu");

    // Steps 10 and 11.
    private static readonly JsRe ENGLISH_ORDINAL =
        JsRegex.Compile(@"(?<=\d)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile(@"\s?&\s?", "gu");

    /** Normalize one Ewe string. The steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeEwe(string input)
    {
        // 0) NFC at the entry, so a literal in this file matches whichever normalization the wiki used.
        //    Ewe's ⟨ɖ ƒ ʋ ɣ ŋ ɔ ɛ⟩ do not precompose, but its NASAL vowels do (ã ẽ ĩ õ ũ) and a dump carries
        //    both forms — trap 11 in a Latin script.
        var s = Renormalize(input, NormalizationForm.FormC);

        // 1) THE HOMOGLYPH FOLD, FIRST, because every later rule and the tokenizer itself are downstream of
        //    it. ⚠ THE COMBINING MARK IS FOLDED BEFORE THE RE-NFC, so `a` + U+0342 becomes a real ⟨ã⟩ rather
        //    than a base letter with an orphaned mark the scan drops. TOKEN admits U+0342 (it is inside the
        //    U+0300–U+036F range), so the word never broke on it — the mark simply reached the scan and was
        //    dropped as unmapped, which is why this one is silent where ⟨Ð⟩ is loud.
        s = Rewrite(Rewrite(Rewrite(s, HOMO_D, ED), HOMO_ENG, ENG), HOMO_TILDE, TILDE)
            .Normalize(NormalizationForm.FormC);

        // 2) HTML ENTITIES AND ZERO-WIDTH MARKS, before the ampersand rule at step 11 — else `&nbsp;` is
        //    read as the word "and" followed by the letters n-b-s-p. This wiki writes 9 of its 16 ampersands
        //    as entities and TWO OF THEM ARE UNTERMINATED (`meter 3&nbsp (afɔ 10&nbsp)`), so the `;` is
        //    optional here. ⚠ AND THE ENTITY SITS IN EXACTLY THE GAP THE UNIT AND MAGNITUDE RULES NEED
        //    (`GH¢&nbsp;1`): folding it to a space is what lets step 6 reach across it.
        s = Rewrite(Rewrite(Rewrite(s, NBSP_ENTITY, " "), NDASH_ENTITY, "–"), NUMERIC_ENTITY, " ");
        s = Rewrite(s, ZERO_WIDTH, "");

        // 3) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as
        //    clause punctuation and the tail as a separate number (`51,446,201` → three numbers, two
        //    pauses). Two separators occur and the split is clean, unlike Akan's: the COMMA is the thousands
        //    separator and the DOT is the decimal point.
        //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain
        //    `(?![\d.,])` refuses to de-group a number followed by its own sentence comma, so `24,000, na …`
        //    would split off `000` and speak it as zero (the ln finding).
        s = Rewrite(s, GROUP_COMMA, w => COMMA_ALL.Replace(w.Value, ""));
        //    The SPACE form is ×1 in the retained text (`10 955 000`). Requiring every group to be exactly
        //    three digits is what stops it claiming two adjacent numbers.
        s = Rewrite(s, GROUP_SPACE, w => SPACE_ALL.Replace(w.Value, ""));

        // 4) UNITS, BEFORE DECIMALS — the number-unit adjacency this rule matches on is destroyed the moment
        //    a decimal is rewritten, and after de-grouping so `1,904,569 km2` is already one token. The rule
        //    REORDERS to the noun-first order this language writes (see UNITS).
        //    ⚠ THE SQUARED ARM RUNS FIRST and consumes the `2`/`²`, because the plain arm below refuses them
        //      — with the two in the other order `100,210 km2` would be rejected outright and never retried.
        //      It reads as the bare unit noun, which is this corpus's own way of writing an area (`kilometa
        //      20,271 sq`, `kilometa miliɔn 30`); a refusal here would leave the trap-53 "kilometres TWO".
        //    ⚠ THE OPERAND IS ANCHORED ON BOTH EDGES (trap 52): a lookbehind rejects one STARTING POSITION,
        //      it does not reject the string, so `(?<![\d.,])` alone would let the engine retry from a
        //      fractional part.
        //    ⚠ `NOT_MAGNITUDE` keeps the table off `$400mm`. See its definition.
        for (var i = 0; i < UNITS.Length; i++)
            s = Rewrite(s, UNIT_SQUARED[i], m => $"{UNITS[i].Word} {m.Groups[1].Value}");
        for (var i = 0; i < UNITS.Length; i++)
            s = Rewrite(s, UNIT_PLAIN[i], m => $"{UNITS[i].Word} {m.Groups[1].Value}");
        //    …and the ones with no numeral at all. Last, so the counted arms keep every match they can make.
        s = BARE_UNITS(s);

        // 5) PERCENT, before the range rule, because a span takes the word ONCE and a range rule that ran
        //    first would have split the operands. ⚠ THE WORD IS POSTPOSED, so on a span it lands after the
        //    SECOND operand. ⚠ ASCENDING AND CHAIN-GUARDED, the same tests step 8 uses.
        s = Rewrite(s, PERCENT_RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(COMMA_ALL.Replace(a, "")) < Js.Number(COMMA_ALL.Replace(b, ""))
                ? $"{a} {TO} {b} {PERCENT}"
                : m.Value;
        });
        s = Rewrite(s, PERCENT_ONE, m => $"{m.Groups[1].Value} {PERCENT}");

        // 6) CURRENCY, PREPOSED, and before decimals for the same reason percent is. Longest key first, so
        //    `GH¢` is claimed before the bare `¢`.
        //    ⚠ THE FIGURE IS REQUIRED. A bare sign with no amount does not occur in this corpus, so a stray
        //    one is left exactly as silent as it was rather than emitting a currency noun out of nowhere.
        for (var i = 0; i < CURRENCY.Length; i++)
            s = Rewrite(s, CURRENCY_RE[i], m => $"{CURRENCY[i].Word} {m.Groups[1].Value}");

        // 7) DOTTED ABBREVIATIONS — the INTERIOR dots only (`dotted` ×356). `H.W.`, `B.C.` and the era
        //    markers `D.M.Ŋ.` / `M.Ŋ.` read as a spurious clause break per dot today; the letters are left
        //    where they were, because no letter-name table exists and no era expansion is attested — the
        //    bare phrase is never the attestation (trap 37).
        //    ⚠ THE FINAL DOT IS KEPT — an abbreviation's own trailing dot is ambiguous with the sentence
        //    period (`D.M.Ŋ.` ends sentences here) and deleting it would silently delete the pause (trap 17).
        s = Rewrite(s, INTERIOR_DOT, "");

        // 8) RANGES — `ranges` ×459, read today as two juxtaposed cardinals with no connective. Three
        //    guards, each measured over the retained text's 54 hyphen pairs:
        //    · a hyphen-digit or separator-digit on either side rejects the ISBN chains, and the scripture
        //      spans are additionally rejected by the preceding `:` (`Mateo 21:1-11`) — the shapes the clock
        //      refusal leaves in place, and there IS no clock rule: all 62 colon numerals in this corpus are
        //      scripture references, zero clocks;
        //    · NON-ASCENDING is left as the bare juxtaposition it already was: the BCE spans run downwards
        //      (`7000–3300 D.M.Ŋ.`) and so do the football scores and the truncated second endpoints;
        //    · BOTH OPERANDS SINGLE-DIGIT is rejected outright, and this arm is Ewe's own. The ascending
        //      test alone leaves the tennis set scores — `7–6, 4–6, 7–6, 2–6, 6–2` contains two ASCENDING
        //      pairs — and a score is not a span. It costs nothing measurable: all 17 ascending pairs in the
        //      retained text have a two-or-more-digit operand.
        //    ⚠ AND THE TRAILING GUARD REJECTS NEITHER `.` NOR `,`, WHILE THE LEADING ONE STILL REJECTS BOTH.
        //    A sentence period is not part of a number, so the symmetric guard declined every range that
        //    ENDS A CLAUSE. The comma goes too, on Ewe's own evidence: Ewe writes the decimal POINT (step 9),
        //    so a following comma is a CLAUSE comma, and the two guards above — not the comma — are what
        //    decline the tennis scores.
        s = Rewrite(s, RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) && (a.Length > 1 || b.Length > 1) ? $"{a} {TO} {b}" : m.Value;
        });

        // 9) THE DECIMAL POINT, after every rule that needed to see a dot (3, 4, 7) and after every rule that
        //    had to claim the whole figure (5, 6). The separator becomes NOTHING and the fractional digits
        //    are spaced so the number path speaks them one at a time.
        //    ⚠ NO DECIMAL-POINT WORD, and the refusal rests on a dictionary check rather than on silence:
        //    espeak does not ship Ewe at all, `point` is ×1 on ee.wikipedia and it is *Darling Point*, and
        //    `kɔma`/`koma`/`pɔint` are ×0. What this fixes is the spurious CLAUSE BREAK and the mis-read
        //    tail, not the missing word — which stays unauthored.
        //    ⚠ THE TRAILING LETTER GUARD keeps a dotted designation out; ×0 in this corpus, robustness only.
        s = Rewrite(s, DECIMAL_DOT, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 10) THE ENGLISH ORDINAL SUFFIX — `3rd edition`, inside the English citation furniture this wiki
        //     carries. DROPPED rather than translated, because Ewe's own ordinal POSTPOSES `lia` to a figure
        //     already written in digits (`ƒe alafa 19 lia`, ×25 here) and the cardinal that remains is what
        //     the sentence already reads.
        s = Rewrite(s, ENGLISH_ORDINAL, "");

        // 11) THE AMPERSAND — silent today, and every surviving instance after step 2 is inside an English
        //     or French name. `kple` is Ewe's ordinary coordinator and needs no sourcing beyond the corpus
        //     it saturates (×357 tokens in the retained text).
        //     ⚠ SPACES ON BOTH SIDES, because deleting the sign merges its operands and `A&B` would become
        //     one initialism where the text has two (traps 18/26).
        s = Rewrite(s, AMPERSAND, " kple ");

        return s;
    }
}
