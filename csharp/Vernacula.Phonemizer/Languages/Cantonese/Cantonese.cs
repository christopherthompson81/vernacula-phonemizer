/**
 * Cantonese / Yue (yue) phonemizer — canonical IPA.
 * Ported from src/languages/cantonese/cantonese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cantonese;

public sealed class CantoneseDef
{
    public IReadOnlyDictionary<string, string> Initials { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Finals { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string MeasureWords { get; init; } = "";
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public CantoneseSymbolTier SymbolTier { get; init; } = new();
}

public static class CantonesePhonemizer
{
    public static readonly CantoneseDef DEF = LoadManifest.Load<CantoneseDef>("languages/cantonese", "cantonese.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly IReadOnlyList<string> INITIALS = DEF.Initials.Keys.OrderByDescending(a => a.Length).ToList();

    private static Dictionary<string, string>? DICT;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Dict()
    {
        lock (GATE) return DICT ??= LoadTsv.LoadTsvMap("languages/cantonese", "dict.tsv");
    }
    private const int MAX_WORD = 6; // greedy segmentation window

    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");
    private static readonly JsRe JYUTPING = JsRegex.Compile("^[a-z]+[1-6](?:\\s+[a-z]+[1-6])*$", "u");
    private static readonly JsRe SYLLABLE = JsRegex.Compile("^([a-z]+?)([1-6])$", "i");
    private static readonly JsRe WHITESPACE = JsRegex.Compile("\\s+", "u");

    /** One Jyutping syllable (e.g. "hoeng1") → IPA. */
    private static string SyllableToIpa(string syl)
    {
        var m = SYLLABLE.Match(syl);
        if (!m.Success) return syl;
        var body = m.Groups[1].Value.ToLowerInvariant();
        var tone = DEF.Tones.GetValueOrDefault(m.Groups[2].Value) ?? "";
        if (body == "m" || body == "ng")
            return (DEF.Finals.GetValueOrDefault(body) ?? body) + tone;
        var initial = "";
        var rest = body;
        foreach (var ini in INITIALS)
            if (body.StartsWith(ini, StringComparison.Ordinal) &&
                DEF.Finals.TryGetValue(body[ini.Length..], out var f) && f != "")
            {
                initial = DEF.Initials[ini];
                rest = body[ini.Length..];
                break;
            }
        if (!DEF.Finals.TryGetValue(rest, out var final)) return syl; // unknown rime → leave the jyutping visible
        return initial + final + tone;
    }

    /** A space-separated Jyutping string → IPA. */
    private static string JyutpingToIpa(string jp) =>
        string.Join(" ", SplitWs(Js.Trim(jp)).Select(SyllableToIpa));

    /** JS `s.split(/\s+/u)` — a leading empty piece is possible and is preserved, as there. */
    private static List<string> SplitWs(string s)
    {
        var parts = new List<string>();
        var last = 0;
        foreach (var m in JsRegex.MatchAll(WHITESPACE, s))
        {
            parts.Add(s[last..m.Index]);
            last = m.Index + m.Length;
        }
        parts.Add(s[last..]);
        return parts;
    }

    /** A Han run → IPA (greedy longest-match over the dictionary; unknown chars are skipped). */
    private static string HanRun(string run)
    {
        var chars = Js.CodePoints(run);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count;)
        {
            var matched = "";
            var jp = "";
            for (var len = Math.Min(MAX_WORD, chars.Count - i); len >= 1; len--)
            {
                var word = string.Concat(chars.Skip(i).Take(len));
                if (Dict().TryGetValue(word, out var hit) && hit != "")
                {
                    matched = word;
                    jp = hit;
                    break;
                }
            }
            if (jp != "")
            {
                outp.Add(JyutpingToIpa(jp));
                i += Js.CodePoints(matched).Count;
            }
            else i++; // no reading for this char → skip
        }
        return string.Join(" ", outp);
    }

    /** A SYNTHESIZED numeral string → IPA, read one character at a time. */
    private static string NumeralRun(string han) =>
        string.Join(" ", Js.CodePoints(han).Select(HanRun).Where(s => s != ""));

    private static readonly string[] SMALL = { "", "十", "百", "千" };
    private static IReadOnlyList<string> DIGITS => Normalize.DIGITS;

    private static string Under10000(double n)
    {
        if (n == 0) return "";
        var outp = "";
        var zero = false;
        for (var p = 3; p >= 0; p--)
        {
            var unit = Math.Floor(n / Math.Pow(10, p)) % 10;
            if (unit == 0)
            {
                if (outp != "") zero = true;
            }
            else
            {
                if (zero) outp += DIGITS[0];
                zero = false;
                outp += (p == 1 && unit == 1 && outp == "" ? "" : DIGITS[(int)unit]) + SMALL[p];
            }
        }
        return outp;
    }

    private static string IntegerToHan(double n)
    {
        if (n == 0) return DIGITS[0];
        if (n < 0) return "";
        var yi = Math.Floor(n / 1_0000_0000);
        var wan = Math.Floor(n % 1_0000_0000 / 10000);
        var rest = n % 10000;
        var outp = "";
        if (yi != 0) outp += IntegerToHan(yi) + "億";
        if (wan != 0) outp += Under10000(wan) + "萬";
        if (rest != 0)
        {
            if ((yi != 0 || wan != 0) && rest < 1000) outp += DIGITS[0];
            outp += Under10000(rest);
        }
        return outp;
    }

    /** Latin letter names in Jyutping. ⚠ H and W have no reading here; a run containing one is left whole
     *  on the English reader rather than half-spelled. */
    private static readonly IReadOnlyDictionary<string, string> LETTERS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "ei1", ["B"] = "bi1", ["C"] = "si1", ["D"] = "di1", ["E"] = "ji1", ["F"] = "e1 fu4",
        ["G"] = "zi1", ["I"] = "aai1", ["J"] = "zei1", ["K"] = "kei1", ["L"] = "eu1", ["M"] = "em1",
        ["N"] = "en1", ["O"] = "ou1", ["P"] = "pi1", ["Q"] = "kiu1", ["R"] = "aau1", ["S"] = "e1 si4",
        ["T"] = "ti1", ["U"] = "ju1", ["V"] = "wi1", ["X"] = "ik1 si4", ["Y"] = "waai1", ["Z"] = "ji6 set1",
    };

    private static readonly JsRe ALL_CAPS = JsRegex.Compile("^[A-Z]{2,}$", "u");
    private static readonly JsRe ROMAN = JsRegex.Compile("^[IVX]{2,3}$", "u");

    /** A Latin run → IPA, preferring what the language records over what English would say. */
    private static string LatinRun(string run, Func<string, string>? foreign)
    {
        string English() => foreign is not null ? foreign(run) : "";
        if (!ALL_CAPS.IsMatch(run) || ROMAN.IsMatch(run)) return English();
        if (Dict().TryGetValue(run, out var recorded)) return JyutpingToIpa(recorded);
        if (run.Length > 3) return English();
        var cps = Js.CodePoints(run);
        if (!cps.All(c => LETTERS.ContainsKey(c))) return English(); // H/W have no Jyutping letter name
        return string.Join(" ", cps.Select(c => JyutpingToIpa(LETTERS[c])));
    }

    private static readonly JsRe MARK_ESC = JsRegex.Compile("[.*+?^${}()|[\\]\\\\-]", "gu");

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input)
        {
            if (JYUTPING.IsMatch(Js.Trim(input))) return JyutpingToIpa(input);
            input = Normalize.NormalizeCantonese(input, DEF.MeasureWords);
            var marks = string.Concat(CLAUSE_MARK.Keys.Select(k => JsRegex.Replace(k, MARK_ESC, mm => "\\" + mm.Value)));
            var tok = JsRegex.Compile(
                $"(\\p{{Script=Han}}+)|(\\d+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{marks}])", "gu");

            return Clauses.AssembleClauses(input, tok, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(HanRun(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var n = Js.Number(m.Groups[2].Value);
                    sink.Emit(NumeralRun(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
                        ? IntegerToHan(n)
                        : Sinitic.SpellHanDigits(m.Groups[2].Value, DIGITS)));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(LatinRun(m.Groups[3].Value, _foreign));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Cantonese phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateCantonese(Func<string, string>? foreign = null) => new Engine(foreign);

    /** Bare word→IPA (tests / eval): Han → IPA, or direct Jyutping. */
    public static string PhonemizeWord(string word) => HAN.IsMatch(word) ? HanRun(word) : JyutpingToIpa(word);

    internal static void RegisterSelf() =>
        Registry.Register("cantonese", () => CreateCantonese(Registry.ReadAsEnglish));
}

public sealed class CantoneseSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
    public bool PercentPrefix { get; init; } = false;
    public bool UnspacedScript { get; init; } = false;
}
