/**
 * Min Dong / Eastern Min (cdo) — Fuzhou dialect, Sinitic, tonal (~9M speakers). A Bàng-uâ-cê (BUC /
 * Foochow Romanized) → IPA converter: strip the tone diacritic (which identifies the tone) →
 * [initial] + rime (TIGHT or LOOSE per the 韻變 register) → IPA + Chao tone letters.
 * Ported from src/languages/mindong/mindong.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.MinDong;

public sealed class MinDongDef
{
    public IReadOnlyDictionary<string, string> Initials { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Rimes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> RimesLoose { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> IoFamily { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToneMark { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> LooseMarks { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ToneChao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class MinDongPhonemizer
{
    public static readonly MinDongDef DEF = LoadManifest.Load<MinDongDef>("languages/mindong", "mindong.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    // Onset consonants tried longest-first so ⟨ng⟩ beats ⟨n⟩+⟨g⟩. LINQ's OrderByDescending is stable, as
    // JS's sort is, so equal-length keys keep manifest order.
    private static readonly IReadOnlyList<string> INITIALS = DEF.Initials.Keys
        .OrderByDescending(k => k.Length)
        .ToList();
    private static readonly HashSet<string> LOOSE_MARK = new(DEF.LooseMarks, StringComparer.Ordinal);
    // The ⟨io⟩-family medial is [y] after a velar/laryngeal/zero onset, [u] after a coronal/labial.
    private static readonly HashSet<string> VELAR_LARYNGEAL = new(StringComparer.Ordinal) { "g", "k", "h", "ng", "" };
    private static readonly HashSet<string> IO_RIMES = new(StringComparer.Ordinal) { "io", "iong", "iok", "ioh" };

    // A bare initial with no rime is a SYLLABIC NASAL (唔 ng → ŋ̍, m → m̩, n → n̩).
    private static readonly Dictionary<string, string> SYLLABIC_NASAL = new(StringComparer.Ordinal)
    {
        ["m"] = "m̩", ["n"] = "n̩", ["ng"] = "ŋ̍",
    };

    /** A toneless BUC base syllable → segmental IPA: [initial] + rime, the 韻變 register ("L"/"T") selecting
     *  the rime variant. */
    private static string BaseToIpa(string b, string register)
    {
        if (SYLLABIC_NASAL.TryGetValue(b, out var nasal)) return nasal;
        var ini = "";
        foreach (var k in INITIALS)
            if (b.StartsWith(k, StringComparison.Ordinal))
            {
                ini = k;
                break;
            }
        bool ValidRime(string r) =>
            DEF.Rimes.ContainsKey(r) || DEF.RimesLoose.ContainsKey(r) || IO_RIMES.Contains(r);
        // A zero-initial syllable begins with a vowel — no onset consumed (take the whole base as the rime).
        var rest = ini != "" && ValidRime(b[ini.Length..]) ? b[ini.Length..] : b;
        var iniIpa = rest == b ? "" : DEF.Initials.GetValueOrDefault(ini) ?? "";
        // The ⟨io⟩-family: medial [y]/[u] by the initial place × the 韻變 register.
        if (IO_RIMES.Contains(rest))
        {
            var med = VELAR_LARYNGEAL.Contains(rest == b ? "" : ini) ? "y" : "u";
            return DEF.IoFamily.TryGetValue($"{rest}|{med}|{register}", out var io) ? iniIpa + io : b;
        }
        // register L → loose form; else tight. A rime that exists ONLY in the loose map still falls back to
        // its loose form rather than the raw base.
        string? rimeIpa = null;
        if (register == "L" && DEF.RimesLoose.TryGetValue(rest, out var loose)) rimeIpa = loose;
        rimeIpa ??= DEF.Rimes.GetValueOrDefault(rest);
        rimeIpa ??= DEF.RimesLoose.GetValueOrDefault(rest);
        if (rimeIpa is null) return b; // truly unknown rime → leave visible for the residual report
        return iniIpa + rimeIpa;
    }

    /** One BUC syllable → (segmental IPA, tone number), or null for an empty base. */
    private static (string Seg, string Tone)? SyllableParts(string syl)
    {
        var nfd = Js.Normalize(syl, NormalizationForm.FormD);
        var tone = "";
        var register = "T";
        var kept = new List<string>();
        foreach (var ch in Js.CodePoints(nfd))
        {
            if (DEF.ToneMark.TryGetValue(ch, out var t))
            {
                tone = t;
                if (LOOSE_MARK.Contains(ch)) register = "L";
            }
            else kept.Add(ch);
        }
        var b = Js.ToLowerCase(Js.Normalize(string.Join("", kept), NormalizationForm.FormC));
        if (b == "") return null;
        var seg = BaseToIpa(b, register);
        if (tone == "") tone = "1";
        if (seg.EndsWith("ʔ", StringComparison.Ordinal)) tone = tone == "1" ? "7" : tone == "4" ? "6" : tone;
        return (seg, tone);
    }

    private static readonly JsRe SYL_SPLIT = JsRegex.Compile("[-\\s·]+", "gu");

    /** A BUC word (hyphen/space-joined syllables) → IPA; each syllable keeps its CITATION tone and the
     *  syllables join with a space. */
    public static string BucToIpa(string word)
    {
        var last0 = 0;
        var pieces = new List<string>();
        foreach (var m in JsRegex.MatchAll(SYL_SPLIT, word))
        {
            pieces.Add(word[last0..m.Index]);
            last0 = m.Index + m.Length;
        }
        pieces.Add(word[last0..]);
        var outp = new List<string>();
        foreach (var p in pieces)
        {
            if (p == "") continue; // .filter(Boolean)
            if (SyllableParts(p) is { } parts)
                outp.Add(parts.Seg + (DEF.ToneChao.GetValueOrDefault(parts.Tone) ?? ""));
        }
        return string.Join(" ", outp);
    }

    // ── Numbers ──────────────────────────────────────────────────────────────────────────────────
    // The compositor emits BÀNG-UÂ-CÊ words, the engine's own orthography, and the ordinary BUC→IPA
    // converter reads them — no IPA is authored here. See the TS for the Fuzhou specifics (蜀/兩
    // multipliers, the vernacular 百 ⟨báh⟩).
    private static readonly IReadOnlyList<string> BUC_DIGITS =
        new[] { "lìng", "ék", "nê", "săng", "sé", "ngô", "lĕ̤k", "chék", "báik", "gāu" };
    private static readonly string[] BUC_SMALL = { "", "sék", "báh", "chiĕng" };
    private const string BUC_MYRIAD = "uâng"; // 萬 10⁴
    private const string BUC_YI = "é"; // 億 10⁸

    /** The multiplier form of a digit before the magnitude at power `p`: 1 → 蜀 siŏh, 2 → 兩 lâng
     *  (but 二 nê before 十). */
    private static string BucMultiplier(double unit, double p)
    {
        if (p == 0) return BUC_DIGITS[(int)unit];
        if (unit == 1) return "siŏh";
        if (unit == 2 && p >= 2) return "lâng";
        return BUC_DIGITS[(int)unit];
    }

    /** 1…9999 → BUC syllables (an internal zero becomes 零 lìng; a leading 一十 is the bare sék). */
    private static List<string> BucUnder10000(double n)
    {
        var outp = new List<string>();
        var zero = false;
        for (var p = 3; p >= 0; p--)
        {
            var unit = Math.Floor(n / Math.Pow(10, p)) % 10;
            if (unit == 0)
            {
                if (outp.Count > 0) zero = true;
                continue;
            }
            if (zero) outp.Add(BUC_DIGITS[0]);
            zero = false;
            if (p == 1 && unit == 1 && outp.Count == 0) outp.Add(BUC_SMALL[1]); // leading 一十 → 十 sék
            else
            {
                outp.Add(BucMultiplier(unit, p));
                if (p > 0) outp.Add(BUC_SMALL[p]);
            }
        }
        return outp;
    }

    /** An integer → the ordered Bàng-uâ-cê number words that speak it (myriad grouping 萬/億). */
    public static IReadOnlyList<string> NumberToBucWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
        {
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            var digits = new List<string>();
            foreach (var c in Js.CodePoints(src))
                if (c.Length == 1 && c[0] is >= '0' and <= '9') digits.Add(BUC_DIGITS[c[0] - '0']);
            return digits;
        }
        if (n == 0) return new[] { BUC_DIGITS[0] };
        var yi = Math.Floor(n / 1_0000_0000.0);
        var wan = Math.Floor(n % 1_0000_0000.0 / 10000.0);
        var rest = n % 10000.0;
        var outp = new List<string>();
        // A bare 1 / 2 multiplying 萬 or 億 takes the same 蜀 siŏh / 兩 lâng forms as before 百/千.
        List<string> Group(double q) => q == 1 || q == 2 ? new List<string> { BucMultiplier(q, 2) } : BucUnder10000(q);
        if (yi != 0)
        {
            outp.AddRange(yi < 10000 ? Group(yi) : NumberToBucWords(yi));
            outp.Add(BUC_YI);
        }
        if (wan != 0)
        {
            outp.AddRange(Group(wan));
            outp.Add(BUC_MYRIAD);
        }
        if (rest != 0)
        {
            if ((yi != 0 || wan != 0) && rest < 1000) outp.Add(BUC_DIGITS[0]);
            outp.AddRange(BucUnder10000(rest));
        }
        return outp;
    }

    /** A BUC word (base letters + combining marks, hyphen-joined) · a digit run · a clause mark. */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "([a-zŋ][a-zŋ\\u0300-\\u036f\\u207f]*(?:[-·][a-zŋ\\u0300-\\u036f\\u207f]*)*)|(\\d+)|([。，、？！；：.,?!;:])",
        "giu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NFD so a syllable is a base letter + trailing combining marks — robust to NFC input, where
            // precomposed vowels (ā, and esp. ṳ = U+1E73) are single codepoints a literal class would miss.
            // ⚠ NORMALIZATION RUNS FIRST AND THE NFD FOLD AFTER IT: the layer inserts BUC words written NFC,
            // and folding first would leave them NFC inside an otherwise-NFD string and truncate them.
            var nfd = Renormalize(Normalize.NormalizeMinDong(input), NormalizationForm.FormD);
            return Clauses.AssembleClauses(nfd, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success) sink.Emit(BucToIpa(m.Groups[1].Value));
                else if (m.Groups[2].Success)
                {
                    var n = Js.Number(m.Groups[2].Value);
                    sink.Emit(BucToIpa(string.Join("-", NumberToBucWords(n, m.Groups[2].Value))));
                }
                else if (m.Groups[3].Success)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Min Dong (Fuzhou) phonemizer — BUC → IPA (segmental + citation tone). */
    public static ILanguage CreateMinDong() => new Engine();

    /** Bare BUC word → IPA (tests / referee eval). */
    public static string PhonemizeWord(string word) => BucToIpa(word);

    internal static void RegisterSelf() => Registry.Register("mindong", () => CreateMinDong());
}
