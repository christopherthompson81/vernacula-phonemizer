/**
 * A sign whose reading FOLLOWS both its operands — the rule shape a verb-final or postpositional language
 * needs.
 * Ported from src/core/postposedSign.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

public static class PostposedSignPass
{
    /** Trailing marks that belong to the SENTENCE, not the operand — Latin, Devanagari and CJK forms. */
    private static readonly JsRe TRAILING = JsRegex.Compile("^(.*?)([,;।॥!?)\\]\"'’、。]*)$", "su");

    /** Rewrite `A <sign> B` as `A B <words>`, with the sign's reading after both operands. */
    public static string PostposedSign(string s, string sign, string words)
    {
        var outp = JsRegex.Compile($"(\\S+)\\s*{sign}\\s*(\\S+)", "gu").Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            var split = TRAILING.Match(b);
            var operand = split.Success ? split.Groups[1].Value : b;
            var marks = split.Success ? split.Groups[2].Value : "";
            return $"{a} {operand} {words}{marks}";
        });
        return JsRegex.Compile($"\\s?{sign}\\s?", "gu").Replace(outp, $" {words} ");
    }
}
