/**
 * Ukrainian Roman-numeral reading. A century is read as an ORDINAL: `XIX століття` is *дев'ятнадцяте
 * століття*; the cardinal (*дев'ятнадцять століття*) would mean "nineteen centuries". Sources: Ukrainian
 * orthography (centuries written in Roman numerals, read as ordinal adjectives); the spelled form
 * "дев'ятнадцяте століття" is attested in running Ukrainian text (history teaching material, reference sites).
 *
 * FORM: **neuter** nominative singular — the Ukrainian century noun is neuter (століття, сторіччя), not
 * masculine as in Russian and Polish. So this table is *-е*, not *-ий*: дев'ятнадцяте, двадцяте, сорокове.
 * This is the one place in this group where the agreement form differs, and it follows directly from which
 * noun the language actually uses for "century".
 *
 * DOCUMENTED LIMITATIONS (one word per integer, no access to the matched context word):
 *  - CASE. "у XIX столітті" wants the locative *дев'ятнадцятому*. The nominative is emitted; oblique context
 *    forms are still matched, since the right lexeme with the wrong ending beats the wrong lexeme.
 *  - GENDER. Because the table is neuter, a masculine context reads wrong — which is why **вік / віку** is
 *    deliberately EXCLUDED from the context regex: `XX вік` stays a cardinal rather than producing the neuter
 *    *двадцяте вік*. Ukrainian standardly uses століття for a century anyway (вік more often means
 *    age/lifetime), so the excluded case is both rarer and the one the table cannot serve.
 *  - REGNAL context is NOT triggered (needs a proper-name list; and a masculine regnal name would want *-ий*).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public static class RomanOrdinals
{
    /** Cardinal tens, read from the language's own number data (ukrainian.jsonc): двадцять, тридцять, сорок, … */
    private static IReadOnlyDictionary<string, string> TENS_CARDINAL => Manifest.DEF.Numbers.Tens;

    /** 1–19, NEUTER nominative. Irregular stems (перше, друге, третє, четверте) → table. Apostrophe is U+0027,
     *  matching the orthography used in ukrainian.jsonc (дев'ять, п'ять). */
    private static readonly string[] ORD_1_19 =
    {
        "", "перше", "друге", "третє", "четверте", "п'яте", "шосте", "сьоме", "восьме", "дев'яте",
        "десяте", "одинадцяте", "дванадцяте", "тринадцяте", "чотирнадцяте", "п'ятнадцяте", "шістнадцяте",
        "сімнадцяте", "вісімнадцяте", "дев'ятнадцяте",
    };

    /** Whole tens, NEUTER nominative — own stems (сорокове, дев'яносте). */
    private static readonly string[] ORD_TENS =
    {
        "", "десяте", "двадцяте", "тридцяте", "сорокове", "п'ятдесяте", "шістдесяте", "сімдесяте",
        "вісімдесяте", "дев'яносте",
    };

    /**
     * Integer → Ukrainian ordinal, neuter nominative. Like Russian (and unlike Polish) only the LAST element
     * inflects above 20: 21 → *двадцять перше*. `undefined` above 100 falls back to the cardinal.
     */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return "соте";
        if (n < 20) return ORD_1_19[n];
        int t = n / 10, u = n % 10;
        if (u == 0) return ORD_TENS[t];
        // ⚠ A MISSING TENS KEY IS `undefined` IN JS, not a throw: the TS reads `TENS_CARDINAL[String(t * 10)]`
        // and returns `undefined` when the table has no such key, so the caller falls back to the cardinal.
        // `Dictionary`'s indexer would throw instead, which is a different behaviour at the same input.
        return TENS_CARDINAL.TryGetValue(Js.NumberToString(t * 10), out var tens) ? $"{tens} {ORD_1_19[u]}" : null;
    }

    /**
     * століття / сторіччя in the cases that occur (nom-gen-acc -я, dat -ю, loc -і, instr -ям, loc pl -ях, instr pl
     * -ями, gen pl століть / сторіч), plus річниця ("L річниця") and з'їзд, the ordinal contexts that reach past
     * XXX. вік is excluded on purpose — see the header note on gender.
     */
    private static readonly JsRe CONTEXT = JsRegex.Compile(
        "^(століт(тя|тю|ті|тям|тях|тями|ь)|сторіч(чя|чю|чі|чям|чях|чями|)|річниц(я|і|ю|ею|ям|ях)|з'їзд(у|і|ом|и|ів|ам|ах)?)$",
        "iu");

    /** This policy always supplies `ordinal`, which is optional on `RomanPolicy`. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
