/**
 * French (fr) ORDINALS — formation from any integer, plus the two written forms that reach the engine:
 * digit notation (`1er`, `1re`, `37e`, `2ème`) and the Roman-numeral century (`XVIIe siècle`).
 *
 * Formation is regular and needs no table beyond the cardinals: an ordinal is the cardinal plus `-ième`,
 * with four adjustments, all of which are the standard statements (Grevisse, *Le Bon Usage* §581–583):
 *   1. a final ⟨e⟩ is dropped before the suffix — quatre → quatrième, onze → onzième, mille → millième;
 *   2. cinq takes an epenthetic ⟨u⟩ — cinquième (keeps [k] before the front vowel);
 *   3. neuf voices its final — neuvième;
 *   4. the plural ⟨s⟩ of vingts / cents / millions is dropped — quatre-vingts → quatre-vingtième.
 * Only the FINAL element of a compound inflects (cent trente-sept → cent trente-septième), and 1 is
 * suppletive: premier / première standalone, but unième inside a compound (vingt-et-unième).
 *
 * ⚠ A FUNCTION AND NOT A TABLE, because ordinal contexts are not bounded by the century range. A hardcoded
 * 2–20 map reachable only from the Roman rule lets `le 37e` and `le 190e` fall through, and the bare suffix is
 * then spoken as a stray word ([tʁɑ̃t sɛt ø], "thirty-seven uh").
 *
 * ⚠ HOMOGRAPHS ARE THE HARD PART OF THE ROMAN FORM, not decoding. The naive pattern "Roman letters + ordinal
 * suffix" matches `de`, `les`, `le`, `des`, `ce`, `vie`, `dire`, `lire`, `mer`, `ville`, `livre` — thousands of
 * instances of real words that decode as a numeral (DE = 500+…, LE = 50+…, DI = 501, LI = 51). The filter is
 * the Lexique
 * pronunciation lexicon itself: if the whole token is an attested French word, it is not a numeral. That
 * blocks every case above while leaving `XVIIe`, `XIe`, `Ve`, `LVIIIe` free, and it stays correct as the
 * lexicon grows. Three abbreviations/rare verbs are absent from Lexique and stoplisted explicitly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class Ordinals
{
    /** Magnitude words that carry a plural ⟨s⟩ in the cardinal but lose it before -ième. NOT a general
     *  "strip final s" rule — trois/six/dix keep theirs (troisième, sixième, dixième). */
    private static readonly IReadOnlySet<string> PLURAL_MAGNITUDES = new HashSet<string>(new[]
    {
        "vingts", "cents", "milliers", "millions", "milliards",
    }, StringComparer.Ordinal);

    /** Cardinal element → its -ième form (rules 1–4 above). */
    private static string ToIeme(string word)
    {
        var w = PLURAL_MAGNITUDES.Contains(word) ? word[..^1] : word;
        if (w == "un") return "unième"; // suppletive inside compounds: vingt-et-unième
        if (w == "cinq") return "cinquième";
        if (w == "neuf") return "neuvième";
        return (w.EndsWith("e", StringComparison.Ordinal) ? w[..^1] : w) + "ième";
    }

    private static readonly JsRe MILLION_IEME = JsRegex.Compile("^(million|milliard)ième$", "");

    /**
     * Integer ≥ 1 → the French ordinal, in this language's own orthography, for the engine to phonemize.
     * `undefined` for 0 and for non-integers — French has no ordinal for zero.
     *
     * The sub-100 group arrives from `numberToWords` already hyphenated as one orthographic word, which is
     * what lets the Lexique compounds resolve (dix-septième → [disɛtjɛm], with the single [s] that the
     * space-separated form got wrong); see numbers.ts.
     */
    public static string? Ordinal(double n, bool feminine = false, bool plural = false)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        var s = plural ? "s" : "";
        if (n == 1) return (feminine ? "première" : "premier") + s;
        var words = Numbers.NumberToWords(n).Split(' ').ToList();
        // Inflect the last element of the last group; the rest of the numeral stays cardinal.
        var lastGroup = words[^1];
        words.RemoveAt(words.Count - 1);
        var parts = lastGroup.Split('-');
        parts[^1] = ToIeme(parts[^1]);
        var last = string.Join("-", parts);
        // 10⁶ / 10⁹ exactly: "un million" → millionième. Keeping the "un" would make it a FRACTION
        // (un millionième = one millionth part), which is a different reading.
        if (words.Count == 1 && words[0] == "un" && MILLION_IEME.IsMatch(last)) words.RemoveAt(words.Count - 1);
        return string.Join(" ", words.Append(last)) + s;
    }

    /** Feminine ordinal indicators: 1re / 1ère (and the common misspelling 1ere). */
    private static readonly JsRe FEMININE_SUFFIX = JsRegex.Compile("^(res?|ères?|eres?)$", "");

    /**
     * Suffix alternatives, LONGEST FIRST — JS alternation is leftmost-first, so `ers` must precede `er` or
     * `1ers` would read as `1er` followed by a stray s.
     */
    private const string SUFFIXES = "ers|er|res|re|ères|ère|eres|ere|èmes|ème|emes|eme|es|e|des|de|ds|d";

    /**
     * French letters. `\b` is NOT usable in these patterns: it is defined on ASCII word characters, so it
     * finds a boundary in the middle of an accented word — in `siècle` it split `siè` | `cle` and read CL as
     * 150. Adding the `u` flag does not change that, so the boundaries are explicit lookarounds instead.
     */
    private const string L = "a-zà-ÿœæ";

    /**
     * Digit ordinal notation → the spoken word. No space is permitted between the digits and the suffix:
     * French writes it attached, and allowing a gap would swallow "3 euros" / "5 ans".
     */
    private static readonly JsRe DIGIT_NOTATION = JsRegex.Compile($"(?<![{L}\\d])(\\d+)({SUFFIXES})(?![{L}\\d])", "gi");
    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "");
    private static readonly JsRe SECOND_SUFFIX = JsRegex.Compile("^(d|ds|de|des)$", "");

    public static string NormalizeFrenchOrdinalDigits(string text)
    {
        if (!HAS_DIGIT.IsMatch(text)) return text;
        return DIGIT_NOTATION.Replace(text, m =>
        {
            var digits = m.Groups[1].Value;
            var n = Js.Number(digits);
            var suf = m.Groups[2].Value.ToLowerInvariant();
            var plural = suf.EndsWith("s", StringComparison.Ordinal);
            // second / seconde — licensed ONLY at 2. Unrestricted, this would read "3d" (3-D) as an ordinal.
            if (SECOND_SUFFIX.IsMatch(suf))
            {
                if (n != 2) return m.Value;
                return (suf.StartsWith("de", StringComparison.Ordinal) ? "seconde" : "second") + (plural ? "s" : "");
            }
            return Ordinal(n, feminine: FEMININE_SUFFIX.IsMatch(suf), plural: plural) ?? m.Value;
        });
    }

    /** Roman ordinals absent from Lexique, so the lexicon filter cannot catch them: the abbreviation Cie
     *  (compagnie) and two rare verb forms that decode as numerals (cive/CIV, clive/CLIV). */
    private static readonly IReadOnlySet<string> ROMAN_WORD_STOPLIST =
        new HashSet<string>(new[] { "cie", "cies", "cive", "cives", "clive", "clives" }, StringComparer.Ordinal);

    /** Roman numeral + an ordinal suffix: XVIIe, XVIIème, IIe, Ve. Same explicit boundaries as above — this
     *  is the pattern that `siècle` tripped, since `cle` parses as CL + the -e suffix. */
    private static readonly JsRe ROMAN_NOTATION = JsRegex.Compile($"(?<![{L}\\d])([ivxlcdm]+)({SUFFIXES})(?![{L}\\d])", "gi");
    private static readonly JsRe HAS_ROMAN = JsRegex.Compile("[ivxlcdm]", "i");

    /**
     * Roman-numeral ordinals → the spoken ordinal word. `isWord` is the French lexicon membership test; the
     * whole token being an attested word is the homograph veto described in the file header.
     */
    public static string NormalizeFrenchOrdinalRomans(string text, Func<string, bool> isWord)
    {
        if (!HAS_ROMAN.IsMatch(text)) return text;
        return ROMAN_NOTATION.Replace(text, m =>
        {
            var lower = m.Value.ToLowerInvariant();
            if (isWord(lower) || ROMAN_WORD_STOPLIST.Contains(lower)) return m.Value;
            var n = Roman.RomanToInt(m.Groups[1].Value);
            if (n is null) return m.Value;
            var suf = m.Groups[2].Value.ToLowerInvariant();
            return Ordinal(n.Value, feminine: FEMININE_SUFFIX.IsMatch(suf),
                plural: suf.EndsWith("s", StringComparison.Ordinal)) ?? m.Value;
        });
    }
}
