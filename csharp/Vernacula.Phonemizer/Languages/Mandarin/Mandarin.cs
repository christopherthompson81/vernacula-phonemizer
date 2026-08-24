/**
 * Mandarin Chinese (cmn) phonemizer — canonical IPA. Two input paths, one converter:
 *   · HANZI → pinyin via the pypinyin char + phrase dicts (polyphone-aware), then pinyin → IPA;
 *   · direct tokenized pinyin with tone digits → IPA.
 * The converter emits Chao tone letters and applies third-tone sandhi within a Han run, plus 一/不 sandhi.
 * Numbers and text normalization run ahead of it. The data (syllable→IPA table, tone system, sandhi) lives
 * beside this file; this module wires it into the Phonemizer interface.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

/** Embedded Latin → foreign (en) phonemizer, injected by the registry (lazy, like Hindi). */
public delegate string ForeignPhonemizer(string latin);

public sealed class MandarinPhonemizer : ILanguage
{
    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");
    // ⚠ `\p{Script=Latin}`, NOT `[A-Za-z]`. The ASCII class split an accented Latin word into pieces at every
    // diacritic and handed each fragment to the English reader separately: `Haldarsvík` became `Haldarsv` + `k`.
    private static readonly JsRe LATIN = JsRegex.Compile("\\p{Script=Latin}", "u");
    /** Continuation of a Latin run: the script plus combining marks, so a decomposed accent stays attached. */
    private static readonly JsRe LATIN_RUN = JsRegex.Compile("[\\p{Script=Latin}\\p{M}]", "u");
    /** A letter or combining mark that is neither Han nor Latin — the run the script router should read.
     *  `\p{M}` is included so an abugida's matras stay inside their own run instead of splitting it. */
    private static readonly JsRe FOREIGN_CHAR = JsRegex.Compile("[\\p{L}\\p{M}]", "u");
    // Clause punctuation + the measure-word set are DATA (cmn.jsonc). A standalone 2 before a measure word
    // reads colloquial 两 (两个, 两天), not 二.
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static string MEASURE_WORDS => Manifest.MANIFEST.MeasureWords;
    // A whitespace-separated pinyin string with at least one tone digit takes the direct pinyin path.
    // ⚠ CASE-SENSITIVE: with the `i` flag this used to match `MP3`, which was returned VERBATIM into the
    // phoneme stream. An all-caps run is a designation.
    private static readonly JsRe PINYIN_INPUT = JsRegex.Compile("^[a-zü:]+[1-5]?(?:\\s+[a-zü:]+[1-5]?)*$", "u");
    private static readonly JsRe TONE_DIGIT_ANY = JsRegex.Compile("[1-5]");
    private static readonly JsRe FOUR_DIGITS = JsRegex.Compile("^\\d{4}$");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe NUMBER_RE = JsRegex.Compile("\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?", "g");
    private static readonly JsRe AFTER_WS = JsRegex.Compile("^\\s*(\\S)", "u");

    // symbol normalization — Mandarin: 百分之 PRECEDES the number (百分之九十三); units follow.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language's OWN word, harvested from its existing `×` rule. Declaring it here is
        // what makes ASCII `x` read like `×`.
        Multiply = new MultiplyDef { Times = "乘以" },
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        // Currency: the sign was DROPPED outright ($50 read as 五十, losing 美元). Mandarin says the unit
        // after the number, which is what the shared tier emits.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "美元" }, ["€"] = new[] { "欧元" }, ["£"] = new[] { "英镑" },
            ["¥"] = new[] { "元" }, ["₤"] = new[] { "英镑" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["mm"] = new[] { "毫米" }, ["cm"] = new[] { "厘米" }, ["km"] = new[] { "公里" },
            ["m"] = new[] { "米" }, ["kg"] = new[] { "千克" }, ["g"] = new[] { "克" },
            ["km/h"] = new[] { "公里每小时" }, ["°c"] = new[] { "摄氏度" }, ["°f"] = new[] { "华氏度" },
            ["°"] = new[] { "度" },
            // ℃ and ℉ are SINGLE CODE POINTS (U+2103, U+2109), not `°`+letter, so the two keys above could
            // not reach them and `20℃` read as bare 二十 — the whole unit gone, not merely the degree sign.
            ["℃"] = new[] { "摄氏度" }, ["℉"] = new[] { "华氏度" },
        },
        // `km²` → 平方公里. The measure word PRECEDES the unit and fuses to it with no space — the `compound`
        // position. `before` would emit "平方 公里", splitting one Han run into two and losing the segmenter's
        // chance to see the compound.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "平方" },
            Cubed = new[] { "立方" },
            Position = ExponentPosition.Compound,
        },
        // BARE EXPONENT — STANDARD MATHEMATICAL REGISTER, not corpus attestations.
        BareExponent = new BareExponentDef
        {
            Squared = "{n}的平方", Cubed = "{n}的立方", Power = "{n}的{e}次方", Negative = "负",
        },
        // Chinese groups by MYRIADS, so the magnitude word between a number and its unit is 万 (10⁴) or 亿
        // (10⁸). Undeclared, the tier's number–unit adjacency broke on it and the unit fell through to the
        // English letter reading.
        Magnitudes = new[] { "万", "亿", "兆" },
        // Chinese has NO SPACES between words, so a unit or a currency sign is normally flanked by Han —
        // which is exactly what the tier's letter-boundary guards were rejecting. Only punctuation-adjacent
        // instances worked.
        UnspacedScript = true,
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

    /** A Han run (with a per-char sandhi-exempt mask): segment → 一/不 sandhi → pinyin → IPA (3-3 within run). */
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

    /** Substitute Arabic numbers with Chinese numeral characters, tracking which code points are sandhi-exempt. */
    private static (List<string> Cp, List<bool> Exempt) SubstituteNumbers(string input)
    {
        var cp = new List<string>();
        var exempt = new List<bool>();
        var last = 0;
        // Comma grouping is part of the number, not a clause boundary: "783,562" was read as two numbers
        // with a PAUSE between them. 61 occurrences in the corpus.
        foreach (Match m in NUMBER_RE.Matches(input))
        {
            if (m.Index > last)
                foreach (var c in Js.CodePoints(input[last..m.Index]))
                {
                    cp.Add(c);
                    exempt.Add(false);
                }
            // The following character must be found ACROSS WHITESPACE. The corpus writes "2009 年" with a
            // space — 272 years and every 两 case — and taking the literal next character saw the space, so
            // the year rule and the 两 rule both silently failed.
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
        // the Mandarin-specific rewrite (fraction order) before the shared symbol tier.
        // ⚠ `spellInitialisms` LAST: the symbol tier reads a temperature's SCALE LETTER, so spelling the ⟨C⟩
        // of `20°C` before it runs destroys the unit.
        input = Normalize.SpellInitialisms(SYMBOLS(Normalize.NormalizeMandarin(input)));
        // Tone-marked pinyin input (letters + a tone digit, no Han) keeps the direct path (e.g. "ni3 hao3").
        if (!HAN.IsMatch(input) && TONE_DIGIT_ANY.IsMatch(input) && PINYIN_INPUT.IsMatch(input))
            return _pinyinToIpa(input);

        var (cp, exempt) = SubstituteNumbers(input);
        // Code-point run scanner (Han / Latin / punctuation), not a single regex — so it drives clauseSink()
        // directly rather than going through assembleClauses, but reuses the shared emit/pause/flush assembly.
        var (sink, finish) = Clauses.ClauseSink();
        var i = 0;
        while (i < cp.Count)
        {
            var ch = cp[i];
            if (HAN.IsMatch(ch))
            {
                // Han run (may include synthesized numerals)
                var j = i;
                while (j < cp.Count && HAN.IsMatch(cp[j])) j++;
                sink.Emit(HanRun(cp.GetRange(i, j - i), exempt.GetRange(i, j - i)));
                i = j;
            }
            else if (LATIN.IsMatch(ch))
            {
                // Latin run → foreign (en)
                var j = i;
                while (j < cp.Count && LATIN_RUN.IsMatch(cp[j])) j++;
                sink.Emit(_foreign is not null ? _foreign(string.Concat(cp.GetRange(i, j - i))) : "");
                i = j;
            }
            else if (FOREIGN_CHAR.IsMatch(ch))
            {
                // A LETTER RUN THAT IS NEITHER HAN NOR LATIN → the script router (core/scripts.ts). Without
                // this branch such a run was SKIPPED, so Mandarin silently deleted every non-Latin foreign
                // script. ⚠ THE RUN SPANS A SINGLE INTERIOR SPACE — Thai separates a reduplication mark
                // (`คนอ้วน ๆ`), and split at the space, `ๆ` reaches Thai with no antecedent. Only ONE space,
                // and only between two foreign letters.
                var j = i;
                while (j < cp.Count)
                {
                    if (FOREIGN_CHAR.IsMatch(cp[j]) && !HAN.IsMatch(cp[j]) && !LATIN.IsMatch(cp[j])) { j++; continue; }
                    string? next = j + 1 < cp.Count ? cp[j + 1] : null;
                    if (cp[j] == " " && next is not null
                        && FOREIGN_CHAR.IsMatch(next) && !HAN.IsMatch(next) && !LATIN.IsMatch(next)) { j += 2; continue; }
                    break;
                }
                var routed = Foreign.ReadForeignRun(string.Concat(cp.GetRange(i, j - i)));
                if (routed is not null && routed != "") sink.Emit(routed);
                i = j;
            }
            else
            {
                // punctuation → pending pause; other → skip
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
        // Longest phrase key (code points) — the scan bound; ≥2 so a single-char run always has room.
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
