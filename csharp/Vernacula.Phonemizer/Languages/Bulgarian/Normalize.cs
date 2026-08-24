/**
 * Bulgarian (bg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the
 * Bulgarian g2p cannot already read into Bulgarian words the existing pipeline speaks. Pure text→text, no
 * IPA. Runs inside bulgarian.ts's `text()`, before the tokenizer.
 *
 * ⚠ `N г.` IS THE DOMINANT PATTERN, and it is specific to this language. `1767 г.` is the ordinary way
 * Bulgarian writes a year, and unhandled it reads as the numeral, then the LETTER `г` as [k], then a SENTENCE
 * BREAK from the abbreviation dot. It expands to `година`.
 *
 * ⚠ NO ORDINAL-DOT RULE. Bulgarian does not write the Germanic ordinal dot at all — no `N.` is followed by a
 * lowercase word — so the rule that is largest in Norwegian and Danish must not exist here. Porting a
 * neighbour's biggest rule would fire on sentence boundaries.
 *
 * ⚠ UNITS ARE WRITTEN IN BOTH SCRIPTS, mostly Cyrillic — `км`, `кг`, `см`, `м` — where Norwegian, Danish and
 * Romanian all use Latin `km`. A Latin-only unit table therefore misses the bulk of them, and `км2` reaches the
 * output as the Latin letters "km" plus the numeral "две". Both key sets are declared; see `UNIT`.
 *
 * ⚠ THE COUNT FORM IS THE COUNTING PLURAL. Bulgarian says `18 процента`, `50 километра`, `20 градуса` — the
 * form after a numeral, not the citation singular (`процент`, `километър`, `градус`).
 *
 * ⚠ NO PERIOD RULES AT ALL. Bulgarian has no period-grouped thousands form, unlike Danish and Romanian, and
 * the `HH.MM` shapes that do occur are `802.11a/b/g/n` plus sports times (`4:41.30`).
 *
 * ORDERING, each constraint a bug that happened:
 *   · THE YEAR ABBREVIATION consumes its dot BEFORE the dot can become a sentence end.
 *   · DE-GROUPING FIRST, before anything reads a bare number.
 *   · DEGREES BEFORE the unit rules — the C of `20 °C` was read as the English letter name [sˈiː].
 *   · km² BEFORE the plain unit rule, or `км` is consumed and the exponent left stranded.
 */

/**
 * Unit abbreviations → the COUNTING form of the word. Longest first.
 *
 * ⚠ BOTH SCRIPTS. Cyrillic is the bulk of it, but Bulgarian also writes LATIN abbreviations after a numeral
 * ("Стандартният 35 mm филм (негатив 36 на 24 mm)"), and those reach the output as the raw letters. The Latin
 * keys map to the identical words, so this is an alias list rather than new data.
 *
 * ⚠ `м` AND `г` GET NO LATIN ALIAS, on purpose. A one-letter Latin key would collide with `m`/`g` inside
 * ordinary Bulgarian-transliterated text; the Cyrillic one-letter keys are safe because a Latin `m` cannot
 * appear inside a Cyrillic word.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bulgarian;

public static class Normalize
{
    private static readonly (string Abbr, string Word)[] UNITS =
    {
        ("км", "километра"), ("кг", "килограма"), ("см", "сантиметра"), ("мм", "милиметра"),
        ("km", "километра"), ("kg", "килограма"), ("cm", "сантиметра"), ("mm", "милиметра"),
        ("м", "метра"), ("г", "грама"),
    };

    /** Squared / cubed units. Bulgarian PREPOSES the modifier as a separate adjective — `квадратни
     *  километра`, unlike Romanian's postposed `kilometri pătrați` and the Germanic single-word compound. */
    private static readonly (JsRe Re, string Word)[] SQUARED =
    {
        // ⚠ BOTH boundaries are `\p{L}` lookarounds, never `\b`. `\b` is defined on ASCII word characters, so
        // it finds no boundary next to a CYRILLIC letter and the rule silently never fires.
        // ⚠ THE LATIN KEY AND ITS EXPONENT MUST MOVE TOGETHER. Give the plain unit a Latin alias without this
        // one and `50 km2` reads "километра ДВЕ".
        // Bulgarian's own one-letter `м` keeps no Latin alias, so `m2` is deliberately not matched.
        (JsRegex.Compile("(?<!\\p{L})(?:км|km)\\s*[²2](?!\\d)", "giu"), "квадратни километра"),
        (JsRegex.Compile("(?<!\\p{L})м\\s*[²2](?!\\d)", "giu"), "квадратни метра"),
        (JsRegex.Compile("(?<!\\p{L})(?:км|km)\\s*[³3](?!\\d)", "giu"), "кубични километра"),
        (JsRegex.Compile("(?<!\\p{L})м\\s*[³3](?!\\d)", "giu"), "кубични метра"),
    };

    /** Currency sign → the counting form. */
    private static readonly (string Sign, string Word)[] CURRENCY =
    {
        ("$", "долара"), ("€", "евро"), ("£", "паунда"), ("¥", "йени"),
    };

    /** Relational and operator signs, read in every position — a dropped sign is inaudible. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("±", "gu"), " плюс минус "),
        (JsRegex.Compile("≈", "gu"), " приблизително равно на "),
        (JsRegex.Compile("≤", "gu"), " по-малко или равно на "),
        (JsRegex.Compile("≥", "gu"), " по-голямо или равно на "),
        (JsRegex.Compile("=", "gu"), " равно на "),
        (JsRegex.Compile("<", "gu"), " по-малко от "),
        (JsRegex.Compile(">", "gu"), " по-голямо от "),
        // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and
        // the bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded.
        (JsRegex.Compile("×|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " по "),
        (JsRegex.Compile("÷", "gu"), " делено на "),
    };

    private static readonly JsRe YEAR_G = JsRegex.Compile("(\\d)\\s*г\\.", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("пр\\.\\s*н\\.\\s*е\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("сл\\.\\s*н\\.\\s*е\\.", "giu");
    private static readonly JsRe RATE_KM_H = JsRegex.Compile("(?<!\\p{L})км\\s*\\/\\s*ч(?!\\p{L})", "giu");
    private static readonly JsRe RATE_PER_HOUR = JsRegex.Compile("(\\p{L}+)\\s*\\/\\s*час(?!\\p{L})", "giu");
    private static readonly JsRe RATE_M_S = JsRegex.Compile("(?<!\\p{L})м\\s*\\/\\s*(?:сек|с)(?!\\p{L})", "giu");
    private static readonly JsRe RATE_KM_H_LAT = JsRegex.Compile("(?<!\\p{L})km\\s*\\/\\s*h(?!\\p{L})", "giu");
    private static readonly JsRe RATE_M_S_LAT = JsRegex.Compile("(?<!\\p{L})m\\s*\\/\\s*s(?!\\p{L})", "giu");
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile("(\\d)[ \u00a0\u202f\u2009](\\d{3})(?!\\d)", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d+),(\\d+)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?!\\p{L})", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?!\\p{L})", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-−+])(\\d+)", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[ \\t]{2,}", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    private static readonly List<(JsRe Re, string Word)> UNIT_RES = UNITS
        .Select(u => (JsRegex.Compile($"(\\d)\\s*{u.Abbr}(?!\\p{{L}})", "gu"), $"$1 {u.Word}"))
        .ToList();
    private static readonly List<(JsRe Before, JsRe After, string Word)> CURRENCY_RES = CURRENCY
        .Select(c =>
        {
            var esc = ESCAPE.Replace(c.Sign, "\\$&");
            return (JsRegex.Compile($"{esc}\\s*(\\d+)", "gu"), JsRegex.Compile($"(\\d+)\\s*{esc}", "gu"), c.Word);
        })
        .ToList();

    public static string NormalizeBulgarian(string input)
    {
        var t = input;

        // 1) THE YEAR ABBREVIATION `N г.` — FIRST, so the abbreviation dot never reaches clausePunctuation as
        //    a sentence end. The bare `г` is otherwise read as a LETTER, [k].
        //    ⚠ REQUIRES A PRECEDING NUMBER, because `г.` elsewhere is `господин` and not a year.
        t = YEAR_G.Replace(t, "$1 година");

        // 2) ERA MARKER `пр.н.е.` — "преди новата ера". Must run with the year rule and before anything else
        //    claims a dot: it carries THREE abbreviation dots, each becoming a sentence break.
        t = ERA_BC.Replace(t, "преди новата ера");
        t = ERA_AD.Replace(t, "след новата ера");

        // 3) RATES — spoken with `в` ("per"). Before the unit rule, or the numerator is consumed and the
        //    slash left bare.
        t = RATE_KM_H.Replace(t, "километра в час");
        t = RATE_PER_HOUR.Replace(t, "$1 в час");
        //    The SECOND-based rate is the same construction with `в секунда`; without it `133 м/сек` reads the
        //    denominator as the bare syllable [sɛk] and `м/с` as [s].
        t = RATE_M_S.Replace(t, "метра в секунда");
        //    AND THE LATIN ABBREVIATIONS: a foreign-sourced `120 km/h` reaches the g2p with the denominator as
        //    the ENGLISH LETTER NAME [ˈeᶦt͡ʃ].
        t = RATE_KM_H_LAT.Replace(t, "километра в час");
        t = RATE_M_S_LAT.Replace(t, "метра в секунда");

        // 4) SPACE-GROUPED THOUSANDS. ⚠ A space is a token boundary, so `5 000` reads as "пет нула".
        string prev;
        do
        {
            prev = t;
            t = SPACE_GROUP.Replace(t, "$1$2");
        } while (t != prev);

        // 5) DECIMAL COMMA. The comma is clause punctuation, so `12,5` reads as "дванайсет , пет" — a PAUSE
        //    inside a number. ⚠ Bulgarian reads the separator as `цяло и` ("whole and"), not a bare "comma";
        //    the fractional part follows digit by digit.
        t = DECIMAL.Replace(t, m =>
            $"{m.Groups[1].Value} цяло и {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 6) CLOCK, COLON FORM ONLY. The colon reaches clausePunctuation as a COMMA PAUSE.
        t = CLOCK.Replace(t, "$1 $2");

        // 6b) НОМЕР. The NUMERO SIGN is dropped outright. ⚠ THIS CHARACTER IS DELIBERATELY EXCLUDED FROM THE
        //     ℃ FOLD: NFKC maps № to the Latin "No", which a Bulgarian g2p reads as an English word.
        t = NUMERO.Replace(t, "номер ");

        // 7) PERCENT → the counting plural `процента`.
        t = PERCENT.Replace(t, "$1 процента");

        // 8) DEGREES, BEFORE the unit rules — the C of `20 °C` is otherwise read as the English letter name.
        t = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(t, "°C"), "°F");
        t = DEG_C.Replace(t, "$1 градуса по Целзий");
        t = DEG_F.Replace(t, "$1 градуса по Фаренхайт");
        t = DEG.Replace(t, "$1 градуса");

        // 9) SQUARED / CUBED UNITS, ⚠ BEFORE the plain unit rule — otherwise `км` is consumed first and the
        //    exponent left stranded. Accepts both the superscript and the ASCII digit (`км2`).
        foreach (var (re, word) in SQUARED) t = re.Replace(t, word);

        // 10) CYRILLIC UNIT ABBREVIATIONS after a number. ⚠ The trailing guard is `(?!\p{L})` and NOT `\b`.
        foreach (var (re, replacement) in UNIT_RES) t = re.Replace(t, replacement);

        // 11) RANGES, spoken `до`.
        t = RANGE.Replace(t, "$1 до $2");

        // 12) CURRENCY, both placements.
        foreach (var (before, after, word) in CURRENCY_RES)
        {
            t = before.Replace(t, $"$1 {word}");
            t = after.Replace(t, $"$1 {word}");
        }

        // 13) SIGNED NUMBERS — a sign PREFIXED to a number. After ranges so a range's dash is already gone.
        t = SIGNED.Replace(t, m => $"{(m.Groups[1].Value == "+" ? "плюс" : "минус")} {m.Groups[2].Value}");

        // 14) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
        //     relational signs are read in every position.
        t = PLUS_INFIX.Replace(t, "$1 плюс $2");
        foreach (var (re, word) in RELATIONAL) t = re.Replace(t, word);

        // 15) AMPERSAND → и.
        t = AMP.Replace(t, " и ");

        // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
        return MULTI_SPACE.Replace(t, " ");
    }
}
