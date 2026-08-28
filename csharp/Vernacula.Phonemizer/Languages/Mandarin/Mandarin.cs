/**
 * Mandarin Chinese (cmn) phonemizer — canonical IPA. Two input paths, one converter: hanzi → pinyin →
 * IPA, and directly tokenized pinyin with tone digits → IPA.
 * Ported from src/languages/mandarin/mandarin.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

/** Embedded Latin → foreign (en) phonemizer, injected by the registry (lazy, like Hindi). */
public delegate string ForeignPhonemizer(string latin);

public sealed class MandarinPhonemizer : ILanguage
{
    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");
    // \p{Script=Latin}, NOT [A-Za-z]: the ASCII class splits an accented Latin word at every diacritic and
    // hands each fragment to the English reader separately.
    private static readonly JsRe LATIN = JsRegex.Compile("\\p{Script=Latin}", "u");
    /**
     * Continuation of a Latin run: the script plus combining marks, so a decomposed accent stays attached.
     */
    private static readonly JsRe LATIN_RUN = JsRegex.Compile("[\\p{Script=Latin}\\p{M}]", "u");
    /** A letter or combining mark that is neither Han nor Latin — the run the script router should read.
     *  `\p{M}` is included so an abugida's matras stay inside their own run instead of splitting it. */
    private static readonly JsRe FOREIGN_CHAR = JsRegex.Compile("[\\p{L}\\p{M}]", "u");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static string MEASURE_WORDS => Manifest.MANIFEST.MeasureWords;
    // A whitespace-separated pinyin string with at least one tone digit takes the direct pinyin path.
    // ⚠ CASE-SENSITIVE on purpose — with an ignore-case flag this matches `MP3`, which then reaches the
    // phoneme stream verbatim. An all-caps run is a designation, not pinyin.
    private static readonly JsRe PINYIN_INPUT = JsRegex.Compile("^[a-zü:]+[1-5]?(?:\\s+[a-zü:]+[1-5]?)*$", "u");
    private static readonly JsRe TONE_DIGIT_ANY = JsRegex.Compile("[1-5]");
    private static readonly JsRe FOUR_DIGITS = JsRegex.Compile("^\\d{4}$");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe NUMBER_RE = JsRegex.Compile("[1-9]\\d{0,2}(?:,\\d{3})+|\\d+(?:\\.\\d+)?", "g");
    private static readonly JsRe AFTER_WS = JsRegex.Compile("^\\s*(\\S)", "u");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        BareExponent = Manifest.MANIFEST.SymbolTier.BareExponent,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
        Multiply = Manifest.MANIFEST.SymbolTier.Multiply,
        PercentPrefix = Manifest.MANIFEST.SymbolTier.PercentPrefix,
        UnspacedScript = Manifest.MANIFEST.SymbolTier.UnspacedScript,
    });

    private readonly Func<string, string> _pinyinToIpa;
    private readonly PinyinTables _pinyin;
    private readonly ForeignPhonemizer? _foreign;

    public MandarinPhonemizer(MandarinTables tables, PinyinTables pinyin, ForeignPhonemizer? foreign = null)
    {
        _pinyinToIpa = PinyinToIpa.MakePinyinToIpa(tables);
        _pinyin = pinyin;
        _foreign = foreign;
    }

    /**
     * A Han run (with a per-char sandhi-exempt mask): segment → 一/不 sandhi → pinyin → IPA (3-3 within run).
     */
    private string HanRun(IReadOnlyList<string> chars, IReadOnlyList<bool> exempt)
    {
        var tokens = Segmenter.Segment(chars, _pinyin, exempt);
        YiBuSandhi.ApplyYiBuSandhi(tokens);
        return _pinyinToIpa(string.Join(" ", tokens.Select(t => t.Py)));
    }

    /** Append a number's Chinese-numeral reading, marking each code point sandhi-exempt or not. Digit-string
     *  readings (year, decimal fraction, oversized) are exempt; a quantity reading is NOT exempt, so its 一
     *  sandhis normally (一千 → yì qiān), matching typed 一千. */
    private static void AppendNumber(List<string> cp, List<bool> exempt, string num, string? after)
    {
        void Push(string text, bool ex)
        {
            foreach (var c in Js.CodePoints(text))
            {
                cp.Add(c);
                exempt.Add(ex);
            }
        }
        if (FOUR_DIGITS.IsMatch(num) && after == "年") { Push(Numbers.DigitsToChinese(num), true); return; } // year
        if (num == "2" && after is not null && MEASURE_WORDS.Contains(after, StringComparison.Ordinal))
        {
            Push(Manifest.MANIFEST.Numbers.Two, false);
            return;
        } // 2个 → 两个
        num = COMMAS.Replace(num, ""); // grouping commas are not part of the value
        var dot = num.IndexOf('.');
        var intStr = dot < 0 ? num : num[..dot];
        var intN = Js.Number(intStr.Length > 0 ? intStr : "0");
        if (double.IsInteger(intN) && Math.Abs(intN) <= 9007199254740991d)
            Push(Numbers.IntegerToChinese(intN), false); // quantity → sandhi-eligible
        else Push(Numbers.DigitsToChinese(intStr), true); // oversized → digit-by-digit, exempt
        if (dot >= 0 && dot < num.Length - 1)
        {
            Push(Manifest.MANIFEST.Numbers.DecimalPoint, true);
            Push(Numbers.DigitsToChinese(num[(dot + 1)..]), true);
        }
    }

    /** Substitute Arabic numbers with Chinese numerals, tracking which code points are sandhi-exempt. */
    private static (List<string> Cp, List<bool> Exempt) SubstituteNumbers(string input)
    {
        var cp = new List<string>();
        var exempt = new List<bool>();
        var last = 0;
        // Comma grouping is part of the number, not a clause boundary ("783,562" is one number, no pause).
        foreach (Match m in NUMBER_RE.Matches(input))
        {
            if (m.Index > last)
                foreach (var c in Js.CodePoints(input[last..m.Index]))
                {
                    cp.Add(c);
                    exempt.Add(false);
                }
            // The following character must be found ACROSS WHITESPACE: the corpus writes "2009 年" with a
            // space, and the literal next character is the space, so the year and 两 rules would never fire.
            var rest = input[(m.Index + m.Value.Length)..];
            var afterM = AFTER_WS.Match(rest);
            AppendNumber(cp, exempt, m.Value, afterM.Success ? afterM.Groups[1].Value : null);
            last = m.Index + m.Value.Length;
        }
        if (last < input.Length)
            foreach (var c in Js.CodePoints(input[last..]))
            {
                cp.Add(c);
                exempt.Add(false);
            }
        return (cp, exempt);
    }

    public string Text(string input)
    {
        // Order: the Mandarin rewrite (fraction order) → the shared symbol tier → SpellInitialisms LAST,
        // because the tier reads a temperature's scale letter and spelling the ⟨C⟩ of `20°C` destroys it.
        input = Normalize.SpellInitialisms(SYMBOLS(Normalize.NormalizeMandarin(input)));
        if (!HAN.IsMatch(input) && TONE_DIGIT_ANY.IsMatch(input) && PINYIN_INPUT.IsMatch(input))
            return _pinyinToIpa(input);

        var (cp, exempt) = SubstituteNumbers(input);
        // A code-point run scanner (Han / Latin / other), deliberately not a single regex: it drives the
        // clause sink directly instead of going through AssembleClauses, but reuses the same assembly.
        var (sink, finish) = Clauses.ClauseSink();
        // ⚠ REPORTS ITS OWN SPANS (#1150): this scans CODE POINTS, so the recorder has no loop to derive them
        // from, and a code-point index is not a string offset once a supplementary character appears (Han has
        // plenty). `off` maps one to the other so a span indexes `Normalized` exactly.
        var traceText = string.Concat(cp);
        var off = new int[cp.Count + 1];
        for (var k = 0; k < cp.Count; k++) off[k + 1] = off[k] + cp[k].Length;
        Core.Trace.EnterEngine(traceText);
        var i = 0;
        while (i < cp.Count)
        {
            var ch = cp[i];
            if (HAN.IsMatch(ch))
            {
                var j = i;
                while (j < cp.Count && HAN.IsMatch(cp[j])) j++;
                Core.Trace.BeginToken(off[i], off[j], string.Concat(cp.GetRange(i, j - i)));
                sink.Emit(HanRun(cp.GetRange(i, j - i), exempt.GetRange(i, j - i)));
                Core.Trace.EndToken();
                i = j;
            }
            else if (LATIN.IsMatch(ch))
            {
                var j = i;
                while (j < cp.Count && LATIN_RUN.IsMatch(cp[j])) j++;
                Core.Trace.BeginToken(off[i], off[j], string.Concat(cp.GetRange(i, j - i)));
                sink.Emit(_foreign is not null ? _foreign(string.Concat(cp.GetRange(i, j - i))) : "");
                Core.Trace.EndToken();
                i = j;
            }
            else if (FOREIGN_CHAR.IsMatch(ch))
            {
                // A letter run that is neither Han nor Latin goes to the script router. ⚠ The run spans a
                // SINGLE interior space, and only between two foreign letters — Thai separates a
                // reduplication mark (`คนอ้วน ๆ`), which split at the space reaches Thai with no antecedent.
                var j = i;
                while (j < cp.Count)
                {
                    if (FOREIGN_CHAR.IsMatch(cp[j]) && !HAN.IsMatch(cp[j]) && !LATIN.IsMatch(cp[j])) { j++; continue; }
                    string? next = j + 1 < cp.Count ? cp[j + 1] : null;
                    if (cp[j] == " " && next is not null
                        && FOREIGN_CHAR.IsMatch(next) && !HAN.IsMatch(next) && !LATIN.IsMatch(next)) { j += 2; continue; }
                    break;
                }
                Core.Trace.BeginToken(off[i], off[j], string.Concat(cp.GetRange(i, j - i)));
                var routed = Foreign.ReadForeignRun(string.Concat(cp.GetRange(i, j - i)));
                if (routed is not null && routed != "") sink.Emit(routed);
                Core.Trace.EndToken();
                i = j;
            }
            else
            {
                if (CLAUSE_MARK.TryGetValue(ch, out var mk) && mk.Length > 0) sink.Pause(mk);
                i++;
            }
        }
        return finish();
    }

    /** A bare pinyin-syllable → segmental IPA converter (no Hanzi / number / clause front-end). Used by the
     *  referee eval. */
    public static Func<string, string> CreatePinyinPhonemizer()
    {
        var st = Manifest.MANIFEST.Sandhi.ThirdThird;
        return PinyinToIpa.MakePinyinToIpa(new MandarinTables
        {
            SyllableIpa = LoadTsv.LoadTsvMap("languages/mandarin", "syllable-ipa.tsv"),
            Tones = Manifest.MANIFEST.Tones,
            ThirdToneSandhi = ((int)Js.Number(st.From), (int)Js.Number(st.Before), (int)Js.Number(st.To)),
        });
    }

    /** Load the Mandarin data and build the phonemizer. `foreign` handles embedded Latin. */
    public static ILanguage CreateMandarin(ForeignPhonemizer? foreign = null)
    {
        var syllableIpa = LoadTsv.LoadTsvMap("languages/mandarin", "syllable-ipa.tsv");
        var chars = LoadTsv.LoadTsvMap<List<string>>("languages/mandarin", "chars.tsv", (v, _) => v.Split(',').ToList());
        var phrases = LoadTsv.LoadTsvMap("languages/mandarin", "phrases.tsv");
        // Longest phrase key in code points — the scan bound; seeded at 2 so a single-char run has room.
        var maxPhrase = phrases.Keys.Aggregate(2, (m, k) => Math.Max(m, Js.CodePoints(k).Count));

        var st = Manifest.MANIFEST.Sandhi.ThirdThird;
        var tables = new MandarinTables
        {
            SyllableIpa = syllableIpa,
            Tones = Manifest.MANIFEST.Tones,
            ThirdToneSandhi = ((int)Js.Number(st.From), (int)Js.Number(st.Before), (int)Js.Number(st.To)),
        };
        return new MandarinPhonemizer(tables, new PinyinTables { Chars = chars, Phrases = phrases, MaxPhrase = maxPhrase }, foreign);
    }

    internal static void RegisterSelf() =>
        Registry.Register("mandarin", () => CreateMandarin(latin => Registry.ReadAsEnglish(latin)));
}
