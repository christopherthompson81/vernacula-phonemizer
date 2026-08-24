/**
 * Bengali (bn) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ BENGALI TEXT MIXES DIGIT SYSTEMS — ASCII and Bengali ০-৯ both occur, including inside times (১১:২০),
 * decimals (২.৩) and fractions (১/৫). Step 0 folds Bengali digits to ASCII so there is ONE representation
 * downstream, which also repairs the shared symbol tier: its number pattern is ASCII-only, so without the fold
 * it drops the percent sign of "৮%".
 *
 * ⚠ EVERY BOUNDARY IS AN EXPLICIT LOOKAROUND, NEVER `\b`. `\b` is defined on ASCII word characters and finds no
 * boundary at all against Bengali script, so a rule written with it matches NOTHING and leaves output that is
 * wrong but plausible.
 *
 * ⚠ THE LARGEST BENGALI DEFECTS ARE NOT IN THIS LAYER, and looking for them here wastes a pass: the numbers data
 * needs its fused 21–99 forms, and `clausePunctuation` must not map a mark to ITSELF padded with spaces, or every
 * danda and comma reaches the output as a raw non-IPA character. Both live in bengali.jsonc. What belongs here is
 * ordinal suffixes, the clock, Bengali unit abbreviations, signs and fractions.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public static class Normalize
{
    private static readonly string BN_DIGIT = string.Concat(Unicode.BENGALI_DIGITS.Keys);
    /** Either digit system. */
    private static readonly string D = $"0-9{BN_DIGIT}";

    /** Fold Bengali digits to ASCII so a value can be computed from either script. */
    private static string ToAscii(string s) =>
        string.Concat(Js.CodePoints(s).Select(c => Unicode.BENGALI_DIGITS.GetValueOrDefault(c, c)));

    /**
     * DATE ordinal suffixes, which is what the corpus actually contains — শে ×10 (২৬শে নভেম্বর) and ই ×8
     * (৮ই জুলাই) — plus the general তম ×11 (১৭তম শতকের). Bengali writes the suffix attached to the numeral and
     * the suffix itself is what marks the form, so it is read off the text rather than inferred.
     *
     * 1–4 are suppletive in the DATE series (পহেলা, দোসরা, তেসরা, চৌঠা); everything else is the cardinal with
     * the suffix JOINED to its final word, exactly as in Hindi — emitting them apart is what made the suffix a
     * stray syllable ([aʈ i] for ৮ই instead of আটই).
     */
    private static readonly IReadOnlyDictionary<int, string> DATE_SUPPLETIVE = new Dictionary<int, string>
    {
        [1] = "পহেলা", [2] = "দোসরা", [3] = "তেসরা", [4] = "চৌঠা",
    };

    /**
     * The CLASSICAL ordinal series, 1–10, which is suppletive and not the cardinal plus a suffix: ৮ম is অষ্টম,
     * not *আটম. From 11 up the regular তম form takes over (১৭তম → সতেরোতম), so the table stops at ten.
     */
    private static readonly IReadOnlyDictionary<int, string> ORDINAL_SUPPLETIVE = new Dictionary<int, string>
    {
        [1] = "প্রথম", [2] = "দ্বিতীয়", [3] = "তৃতীয়", [4] = "চতুর্থ", [5] = "পঞ্চম",
        [6] = "ষষ্ঠ", [7] = "সপ্তম", [8] = "অষ্টম", [9] = "নবম", [10] = "দশম",
    };
    /** Suffixes that mark the classical series rather than the date series. */
    private static readonly IReadOnlySet<string> CLASSICAL_SUFFIX =
        new HashSet<string>(new[] { "ম", "য়", "র্থ", "ষ্ঠ", "তম" }, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> DATE_SUFFIX =
        new HashSet<string>(new[] { "শে", "ই", "লা", "রা", "ঠা" }, StringComparer.Ordinal);
    /** The suffixes, longest first so তম is not matched as ম. */
    private static readonly string[] ORDINAL_SUFFIX = { "তম", "শে", "ই", "ম", "য়", "র্থ", "ষ্ঠ", "লা", "রা", "ঠা" };

    /** Bengali unit abbreviations → the full word. The shared symbol tier is keyed on the Latin forms. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["কিমি"] = "কিলোমিটার", ["কিমি/ঘন্টা"] = "কিলোমিটার প্রতি ঘন্টা", ["সেমি"] = "সেন্টিমিটার",
        ["মিমি"] = "মিলিমিটার", ["কেজি"] = "কিলোগ্রাম", ["গ্রা"] = "গ্রাম", ["মি"] = "মিটার",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    /** Abbreviations. Only a handful occur (ডঃ / ড. ×2, অধ্যাপক is already a word), but ডঃ was reading its
     *  visarga as a syllable ([ɖɔh]) and ড. was leaving a phrase break. */
    private static readonly IReadOnlyDictionary<string, string> ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ড"] = "ডক্টর", ["অধ্যা"] = "অধ্যায়", ["পৃ"] = "পৃষ্ঠা", ["সং"] = "সংখ্যা",
    };
    private static readonly string ABBREV_ALT = string.Join("|", ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe ABBREV_RE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})[ঃ.]\\s*(?=[\\p{{L}}])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![{D}.,])([{D}]+)\\s?({string.Join("|", ORDINAL_SUFFIX)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"([{D}])\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile($"([{D}])\\s?°\\s?C(?![\\p{{L}}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile($"([{D}])\\s?°\\s?F(?![\\p{{L}}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile($"([{D}])\\s?°", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile($"(?<![{D}:])([{D}]{{1,2}}):([{D}]{{2}})(?![{D}:])(\\s*টা)?", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile($"(^|[\\s(])[-−–]([{D}])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile($"(\\S)\\+\\s?([{D}])", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile($"(^|\\s)\\+\\s?([{D}])", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile($"(?<![{D}.,/])([{D}]{{1,3}})/([{D}]{{1,3}})(?![{D}/])", "gu");

    /** Build the Bengali normalizer. Takes the numbers definition so ordinals and fractions can compose the
     *  same cardinal words the engine's own number path uses. */
    public static Func<string, string> MakeBengaliNormalizer(NumbersDef numbers)
    {
        string Cardinal(double n) =>
            string.Join(" ", Numbers.indicNumberWords(n, numbers).Select(w => w ?? ""));

        string? Ordinal(double n, string suffix)
        {
            var key = (int)n;
            if (DATE_SUFFIX.Contains(suffix) && DATE_SUPPLETIVE.TryGetValue(key, out var dateForm)) return dateForm;
            // The classical series is suppletive through ten; above that the regular তম form composes.
            if (CLASSICAL_SUFFIX.Contains(suffix) && ORDINAL_SUPPLETIVE.TryGetValue(key, out var classical)) return classical;
            var words = Cardinal(n).Split(' ');
            if (words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            // 0) FOLD Bengali digits to ASCII. The engine reads either script identically (৫ and 5 both give
            //    [pãt͡ʃ]), but the SHARED symbol tier's number pattern is ASCII-only, so "৮%" had its percent
            //    sign DROPPED and Bengali-digit amounts lost their currency and units. Folding here makes one
            //    uniform representation for every downstream rule, this file's included.
            var s = string.Concat(Js.CodePoints(input).Select(c => Unicode.BENGALI_DIGITS.GetValueOrDefault(c, c)));

            // 1) ABBREVIATIONS. ডঃ uses a VISARGA rather than a dot, which is not punctuation and so was read
            //    as a syllable; the dotted form left a phrase break instead.
            s = ABBREV_RE.Replace(s, m => $"{ABBREV[m.Groups[1].Value]} ");

            // 2) ORDINAL SUFFIXES, attached or with an intervening space (both occur).
            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(ToAscii(m.Groups[1].Value)), m.Groups[2].Value) ?? m.Value);

            // 3) BENGALI UNIT ABBREVIATIONS, after a number. Longest first so কিমি/ঘন্টা beats কিমি.
            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            // 4) DEGREES, case-insensitively — the corpus lowercases, and a case-sensitive rule would leave the
            //    scale letter behind as a stray syllable.
            s = DEG_C.Replace(s, "$1 ডিগ্রি সেলসিয়াস");
            s = DEG_F.Replace(s, "$1 ডিগ্রি ফারেনহাইট");
            s = DEG.Replace(s, "$1 ডিগ্রি");

            // 5) CLOCK. The colon was reaching the output RAW (padded, so it also produced a double space), and
            //    a :00 was read as শূন্য. Bengali says "দশটা ত্রিশ মিনিট"; at :00 the minutes drop out and a
            //    following টা is exactly right.
            s = CLOCK.Replace(s, m =>
            {
                var hv = Js.Number(ToAscii(m.Groups[1].Value));
                var mv = Js.Number(ToAscii(m.Groups[2].Value));
                if (hv > 23 || mv > 59) return m.Value;
                var ta = m.Groups[3].Success ? m.Groups[3].Value : null;
                if (mv == 0) return $"{Cardinal(hv)}{ta ?? "টা"}";
                return $"{Cardinal(hv)}টা {Cardinal(mv)} মিনিট";
            });

            // 6) SIGNS. Both directions occur in this corpus (-1 ×3, +3/+1 ×4), unlike Hindi where the only
            //    hyphen-before-digit was a spacecraft name, so both are claimed here.
            s = MINUS.Replace(s, "$1ঋণাত্মক $2");
            s = PLUS_ATTACHED.Replace(s, "$1 যোগ $2");
            s = PLUS_LEADING.Replace(s, "$1যোগ $2");

            // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from bn_in:
            //
            //   `সমান`       ×14 token   "রেসিওর সমান বা কাছাকাছি" — EQUAL TO the ratio
            //   `থেকে কম`     ×2 phrase   ·  `থেকে বেশি` ×14 phrase — both postposed, with real operands
            //   `ভাগ`        ×12 token   the division word (cognate of hi's भाग, which hi cites from its own wiki)
            //
            // ⚠ `ভাগ` IS ALSO A SUBSTRING TRAP: ×12 token but ×202 SUBSTRING, most of them inside বেশিরভাগ ("most"),
            // which has no arithmetic sense. The token count is the evidence; the raw count is 17× larger and lying.
            //
            // The comparatives are POSTPOSITIONAL (থেকে follows the standard), so they use core/postposedSign.ts;
            // an infix rule would read the comparison backwards. This normalizer serves as/bpy as well as bn.
            s = PostposedSignPass.PostposedSign(s, "<", "থেকে কম");
            s = PostposedSignPass.PostposedSign(s, ">", "থেকে বেশি");
            s = EQUALS_RE.Replace(s, " সমান ");
            s = DIVIDE.Replace(s, " ভাগ ");

            // 7) FRACTIONS. Bengali states them as "denominator ভাগের numerator", the spoken form; ½ is অর্ধেক.
            s = FRACTION.Replace(s, m =>
            {
                var num = Js.Number(ToAscii(m.Groups[1].Value));
                var den = Js.Number(ToAscii(m.Groups[2].Value));
                if (num == 1 && den == 2) return "অর্ধেক";
                var nw = Cardinal(num);
                var dw = Cardinal(den);
                return nw == "" || dw == "" ? m.Value : $"{dw} ভাগের {nw}";
            });

            return s;
        };
    }
}
