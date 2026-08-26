/**
 * Wu Chinese / Shanghainese (wuu) phonemizer — canonical IPA. Han → Wugniu (zaonhe romanization) via
 * dict.tsv with greedy longest-match segmentation, then Wugniu → [initial] + final + Chao tone letters.
 * Ported from src/languages/wu/wu.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Wu;

public sealed class WuDef
{
    public IReadOnlyDictionary<string, string> Initials { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Finals { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string MeasureWords { get; init; } = "";
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
}

public static class WuPhonemizer
{
    public static readonly WuDef DEF = LoadManifest.Load<WuDef>("languages/wu", "wu.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    // Initials tried longest-first so digraphs win (tsh>ts>t, ngh>ng>n>g, gh>g, sh>s …). LINQ's
    // OrderByDescending is stable, as JS `Array.prototype.sort` is, so equal-length keys keep manifest order.
    private static readonly IReadOnlyList<string> INITIALS = DEF.Initials.Keys.OrderByDescending(k => k.Length).ToList();
    private const string VOWEL = "aeiouy";

    private static readonly IReadOnlyDictionary<string, string> SYLLABIC = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m"] = "m̩", ["n"] = "n̩", ["ng"] = "ŋ̍", ["mh"] = "ʔm̩", ["nh"] = "ʔn̩", ["ngh"] = "ʔŋ̍",
    };

    private static Dictionary<string, string>? DICT;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Dict()
    {
        lock (GATE) return DICT ??= LoadTsv.LoadTsvMap("languages/wu", "dict.tsv");
    }
    private const int MAX_WORD = 8; // greedy segmentation window

    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");
    private static readonly JsRe WUGNIU = JsRegex.Compile("^[a-z]+[0-9](?:\\s+[a-z]+[0-9])*$", "u");
    private static readonly JsRe SYLLABLE = JsRegex.Compile("^([a-z]+?)([0-9])?$", "i");
    private static readonly JsRe WHITESPACE = JsRegex.Compile("\\s+", "u");

    /** One Wugniu syllable (e.g. "zaon2", "koq7") → IPA (initial + final + Chao tone). */
    private static string SyllableToIpa(string syl)
    {
        var m = SYLLABLE.Match(syl);
        if (!m.Success) return syl;
        var body = m.Groups[1].Value.ToLowerInvariant();
        var tone = m.Groups[2].Success ? DEF.Tones.GetValueOrDefault(m.Groups[2].Value) ?? "" : "";
        foreach (var ini in INITIALS)
        {
            if (!body.StartsWith(ini, StringComparison.Ordinal)) continue;
            if (DEF.Finals.TryGetValue(body[ini.Length..], out var final)) return DEF.Initials[ini] + final + tone;
        }
        if (DEF.Finals.TryGetValue(body, out var whole)) return whole + tone;
        // ⚠ JS `VOWEL.includes(body[1] ?? "")` is TRUE for a one-letter body — `"".includes` of the empty
        // string. Reproduced: the branch is then harmless because `finals[""]` is undefined either way.
        var second = body.Length > 1 ? body[1].ToString() : "";
        if ((body.Length > 0 && (body[0] == 'y' || body[0] == 'w')) && VOWEL.Contains(second, StringComparison.Ordinal))
            if (DEF.Finals.TryGetValue(body[1..], out var rest))
                return (body[0] == 'y' ? "j" : "w") + rest + tone;
        if (SYLLABIC.TryGetValue(body, out var syllabic)) return syllabic + tone;
        return syl; // unknown rime → leave the romanization visible
    }

    /** A space-separated Wugniu reading → IPA. */
    private static string WugniuToIpa(string reading) =>
        string.Join(" ", SplitWs(Js.Trim(reading)).Select(SyllableToIpa));

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
        // UTF-16 offset of each code point, so slicing the window is O(1) rather than rebuilding a
        // code-point list per candidate. Indices are code points, exactly as the TS `[...run]` array is.
        var offs = new List<int>();
        for (var k = 0; k < run.Length; k += char.IsHighSurrogate(run[k]) && k + 1 < run.Length && char.IsLowSurrogate(run[k + 1]) ? 2 : 1)
            offs.Add(k);
        offs.Add(run.Length);
        var count = offs.Count - 1;

        var outp = new List<string>();
        for (var i = 0; i < count;)
        {
            var matchedLen = 0;
            var reading = "";
            for (var len = Math.Min(MAX_WORD, count - i); len >= 1; len--)
            {
                var word = run[offs[i]..offs[i + len]];
                if (Dict().TryGetValue(word, out var hit) && hit != "")
                {
                    matchedLen = len;
                    reading = hit;
                    break;
                }
            }
            if (reading != "")
            {
                outp.Add(WugniuToIpa(reading));
                i += matchedLen;
            }
            else i++; // no reading for this char → skip
        }
        return string.Join(" ", outp);
    }

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

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"(\\p{{Script=Han}}+)|(\\d+)|({HostWord.LATIN_RUN})|([。，、？！；：.,?!;:])", "gu");

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input)
        {
            // Whole-string Wugniu input (tone digits present) → direct path, BEFORE normalization.
            if (WUGNIU.IsMatch(Js.Trim(input))) return WugniuToIpa(input);
            input = Normalize.NormalizeWu(input, DEF.MeasureWords, DEF.LetterNames);

            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(HanRun(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var n = Js.Number(m.Groups[2].Value);
                    sink.Emit(HanRun(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
                        ? IntegerToHan(n)
                        : Sinitic.SpellHanDigits(m.Groups[2].Value, DIGITS)));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Emit(_foreign is not null ? _foreign(m.Groups[3].Value) : "");
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Wu Chinese phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateWu(Func<string, string>? foreign = null) => new Engine(foreign);

    /** Bare word→IPA (tests / eval): Han → IPA, or a direct Wugniu reading. */
    public static string PhonemizeWord(string word) => HAN.IsMatch(word) ? HanRun(word) : WugniuToIpa(word);

    internal static void RegisterSelf() =>
        Registry.Register("wu", () => CreateWu(Registry.ReadAsEnglish));
}
