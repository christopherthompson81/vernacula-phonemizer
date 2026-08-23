// Astral (non-BMP) ranges per Unicode general category, for JS \p{...} under the u flag.
//
// ⚠ WHY THIS EXISTS. .NET's \p{L} is a CODE-UNIT test: given "𠀁" (U+20001) it sees two surrogates,
// both category Cs, and matches neither. JS's /\p{L}/u sees one letter and matches it. The gap hits
// every category shorthand in the codebase, so \p{L} is translated to "(?:\p{L}|<astral letters>)"
// with the astral half built here.
//
// The ranges are MEASURED FROM .NET ITSELF at first use, not transcribed: CharUnicodeInfo is the same
// table the BMP half of the class will consult, so the two halves can never drift apart across a
// runtime upgrade the way a hardcoded table would.
using System.Globalization;

namespace Vernacula.Phonemizer.Core;

public static class UnicodeCategories
{
    private static readonly Dictionary<string, string?> Cache = new();
    private static readonly object Gate = new();

    private static readonly Dictionary<string, UnicodeCategory[]> Groups = new()
    {
        ["L"] = new[] { UnicodeCategory.UppercaseLetter, UnicodeCategory.LowercaseLetter, UnicodeCategory.TitlecaseLetter, UnicodeCategory.ModifierLetter, UnicodeCategory.OtherLetter },
        ["M"] = new[] { UnicodeCategory.NonSpacingMark, UnicodeCategory.SpacingCombiningMark, UnicodeCategory.EnclosingMark },
        ["N"] = new[] { UnicodeCategory.DecimalDigitNumber, UnicodeCategory.LetterNumber, UnicodeCategory.OtherNumber },
        ["P"] = new[] { UnicodeCategory.ConnectorPunctuation, UnicodeCategory.DashPunctuation, UnicodeCategory.OpenPunctuation, UnicodeCategory.ClosePunctuation, UnicodeCategory.InitialQuotePunctuation, UnicodeCategory.FinalQuotePunctuation, UnicodeCategory.OtherPunctuation },
        ["S"] = new[] { UnicodeCategory.MathSymbol, UnicodeCategory.CurrencySymbol, UnicodeCategory.ModifierSymbol, UnicodeCategory.OtherSymbol },
        ["Z"] = new[] { UnicodeCategory.SpaceSeparator, UnicodeCategory.LineSeparator, UnicodeCategory.ParagraphSeparator },
        ["C"] = new[] { UnicodeCategory.Control, UnicodeCategory.Format, UnicodeCategory.Surrogate, UnicodeCategory.PrivateUse, UnicodeCategory.OtherNotAssigned },
        ["Lu"] = new[] { UnicodeCategory.UppercaseLetter },
        ["Ll"] = new[] { UnicodeCategory.LowercaseLetter },
        ["Lt"] = new[] { UnicodeCategory.TitlecaseLetter },
        ["Lm"] = new[] { UnicodeCategory.ModifierLetter },
        ["Lo"] = new[] { UnicodeCategory.OtherLetter },
        ["Mn"] = new[] { UnicodeCategory.NonSpacingMark },
        ["Mc"] = new[] { UnicodeCategory.SpacingCombiningMark },
        ["Me"] = new[] { UnicodeCategory.EnclosingMark },
        ["Nd"] = new[] { UnicodeCategory.DecimalDigitNumber },
        ["Nl"] = new[] { UnicodeCategory.LetterNumber },
        ["No"] = new[] { UnicodeCategory.OtherNumber },
        ["Pc"] = new[] { UnicodeCategory.ConnectorPunctuation },
        ["Pd"] = new[] { UnicodeCategory.DashPunctuation },
        ["Ps"] = new[] { UnicodeCategory.OpenPunctuation },
        ["Pe"] = new[] { UnicodeCategory.ClosePunctuation },
        ["Pi"] = new[] { UnicodeCategory.InitialQuotePunctuation },
        ["Pf"] = new[] { UnicodeCategory.FinalQuotePunctuation },
        ["Po"] = new[] { UnicodeCategory.OtherPunctuation },
        ["Sm"] = new[] { UnicodeCategory.MathSymbol },
        ["Sc"] = new[] { UnicodeCategory.CurrencySymbol },
        ["Sk"] = new[] { UnicodeCategory.ModifierSymbol },
        ["So"] = new[] { UnicodeCategory.OtherSymbol },
        ["Zs"] = new[] { UnicodeCategory.SpaceSeparator },
        ["Zl"] = new[] { UnicodeCategory.LineSeparator },
        ["Zp"] = new[] { UnicodeCategory.ParagraphSeparator },
        ["Cc"] = new[] { UnicodeCategory.Control },
        ["Cf"] = new[] { UnicodeCategory.Format },
        ["Co"] = new[] { UnicodeCategory.PrivateUse },
        ["Cn"] = new[] { UnicodeCategory.OtherNotAssigned },
    };

    /// <summary>The astral portion of a general category as a surrogate-pair alternation, or null
    /// when the category has none above the BMP.</summary>
    public static string? AstralAlt(string name)
    {
        lock (Gate)
        {
            if (Cache.TryGetValue(name, out var hit)) return hit;
            var result = Build(name);
            Cache[name] = result;
            return result;
        }
    }

    private static string? Build(string name)
    {
        if (!Groups.TryGetValue(name, out var cats)) return null;
        var wanted = new HashSet<UnicodeCategory>(cats);
        var alts = new List<string>();
        var runStart = -1;
        for (var cp = 0x10000; cp <= 0x10FFFF; cp++)
        {
            var inSet = wanted.Contains(CharUnicodeInfo.GetUnicodeCategory(cp));
            if (inSet && runStart < 0) runStart = cp;
            else if (!inSet && runStart >= 0) { alts.Add(UnicodeScripts.RangeAlt(runStart, cp - 1)); runStart = -1; }
        }
        if (runStart >= 0) alts.Add(UnicodeScripts.RangeAlt(runStart, 0x10FFFF));
        return alts.Count == 0 ? null : string.Join("|", alts);
    }
}
