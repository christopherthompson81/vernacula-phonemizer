/**
 * Arabic (ar) phonemizer — canonical IPA (Modern Standard Arabic, broad phonemic).
 * Ported from src/languages/arabic/arabic.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Arabic
{
    private static readonly JsRe LONG_RE = JsRegex.Compile("ː", "");
    private static readonly JsRe SHORT_TANWIN_RE = JsRegex.Compile("[aiu]n$", "");

    private static bool IsLongNucleus(string ph) =>
        LONG_RE.IsMatch(ph) || ph == "aj" || ph == "aw" || SHORT_TANWIN_RE.IsMatch(ph);

    /** MSA quantity-sensitive stress. */
    private static int StressedNucleus(List<Seg> segs)
    {
        var nuclei = segs.Select((s, i) => s.Vowel ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count <= 1) return nuclei.Count == 1 ? nuclei[0] : -1;

        var heavy = new bool[nuclei.Count];
        var superheavy = new bool[nuclei.Count];
        var longV = new bool[nuclei.Count];
        for (var k = 0; k < nuclei.Count; k++)
        {
            var vi = nuclei[k];
            var @long = IsLongNucleus(segs[vi].Ph);
            var end = k == nuclei.Count - 1 ? segs.Count : nuclei[k + 1];
            var consAfter = 0;
            for (var j = vi + 1; j < end; j++)
                if (!segs[j].Vowel) consAfter += Geminated(segs, j) ? 2 : 1;
            var coda = k == nuclei.Count - 1 ? consAfter >= 1 : consAfter >= 2;
            longV[k] = @long;
            heavy[k] = @long || coda;
            superheavy[k] = (@long && coda) || consAfter >= 2;
        }

        var last = nuclei.Count - 1;
        if (superheavy[last]) return nuclei[last]; // ultima superheavy (CVːC/CVCC) → ultima
        if (heavy[last]) return nuclei[last - 1]; // ultima heavy (CVV/CVC) → penult
        if (heavy[last - 1]) return nuclei[last - 1]; // ultima light, penult heavy → penult
        var ap = last - 2; // all-light ultima+penult → antepenult, UNLESS the
        if (ap >= 0 && heavy[ap] && !longV[ap]) return nuclei[last - 1]; // antepenult is heavy by CODA only (madrasa → penult)
        return nuclei[Math.Max(0, ap)]; // else antepenult (light, or heavy by long vowel: ṭaːlib)
    }

    /** Is the consonant seg at index j a geminate (rendered Cː) — it fills both coda and following onset. */
    private static bool Geminated(List<Seg> segs, int j) => segs[j].Ph.EndsWith("ː", StringComparison.Ordinal);

    public sealed class VarietyDef
    {
        public string Variety { get; init; } = "";
        public string Iso { get; init; } = "";
        public IReadOnlyList<string[]> ConsonantShifts { get; init; } = Array.Empty<string[]>();
        public IReadOnlyDictionary<string, string> DiphthongShifts { get; init; } = new Dictionary<string, string>();
        public string? ArticleVowel { get; init; } // raise the definite-article nucleus (arz "i" → il-); omitted = keep MSA [a]
        public ArabicNumberData? Numbers { get; init; } // per-variety numeral tables (arz 80 is tamaniːn, not MSA θamaːnuːn)
    }

    private sealed class VarietyRules
    {
        public required IReadOnlyList<string[]> ConsonantShifts { get; init; } // literal string rewrites (consonants are unambiguous)
        public required List<(JsRe Re, string To)> DiphthongShifts { get; init; } // guarded: aj/aw only when NOT an onset of the next syllable
        public string? ArticleVowel { get; init; } // per-variety definite-article vowel (applied to the tagged article seg, pre-join)
        public ArabicNumberData? Numbers { get; init; } // per-variety numerals; absent → the MSA compositor tables
    }

    /** A diphthong [aj]/[aw] monophthongizes only when its glide is a CODA — i.e. NOT followed by (an
     *  optional stress mark and) a vowel, which keeps the hiatus طويل tˤawiːl intact. */
    private static VarietyRules CompileVariety(VarietyDef d)
    {
        return new VarietyRules
        {
            ConsonantShifts = d.ConsonantShifts,
            DiphthongShifts = d.DiphthongShifts
                .Select(kv => (JsRegex.Compile(kv.Key + "(?!ˈ?[aiueoæ])", "gu"), kv.Value))
                .ToList(),
            ArticleVowel = d.ArticleVowel,
            Numbers = d.Numbers,
        };
    }

    private static VarietyRules LoadVariety(string file) =>
        CompileVariety(LoadManifest.Load<VarietyDef>("languages/arabic", file));

    private static readonly Dictionary<string, VarietyRules> VARIETIES = new(StringComparer.Ordinal)
    {
        ["egyptian"] = LoadVariety("egyptian.jsonc"),
        ["levantine"] = LoadVariety("levantine.jsonc"),
        ["sudanese"] = LoadVariety("sudanese.jsonc"),
        ["iraqi"] = LoadVariety("iraqi.jsonc"),
        ["gulf"] = LoadVariety("gulf.jsonc"),
        ["moroccan"] = LoadVariety("moroccan.jsonc"),
        ["libyan"] = LoadVariety("libyan.jsonc"),
        ["southlevantine"] = LoadVariety("southlevantine.jsonc"),
        ["hijazi"] = LoadVariety("hijazi.jsonc"),
    };

    private static readonly JsRe DOUBLE_LENGTH = JsRegex.Compile("ːː", "gu");

    /** Phonemize a single diacritized Arabic word to canonical IPA (with a stress mark). `variety` (e.g. "egyptian")
     *  applies its dialectal shifts on top of the MSA output; undefined/"msa" = Modern Standard Arabic. */
    public static string PhonemizeWord(string word, string? variety = null)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        var stress = StressedNucleus(segs);
        var vdef = variety is not null ? VARIETIES.GetValueOrDefault(variety) : null;
        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) @out += "ˈ";
            @out += vdef?.ArticleVowel is not null && segs[i].Article ? vdef.ArticleVowel : segs[i].Ph;
        }
        if (vdef is not null)
        {
            foreach (var shift in vdef.ConsonantShifts) @out = @out.Replace(shift[0], shift[1], StringComparison.Ordinal);
            foreach (var (re, to) in vdef.DiphthongShifts) @out = re.Replace(@out, to);
            @out = DOUBLE_LENGTH.Replace(@out, "ː");
        }
        return @out;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // ⚠ DERIVED FROM `consonants`, so adding a letter to arabic.jsonc reaches the tokenizer. Every consonant
    // OUTSIDE the ء-ي range the class already covers — currently پ چ ژ ڤ ڭ گ ݣ. Escaped rather than inlined
    // because the block between them holds the Arabic-Indic digits and the percent/decimal signs. Order
    // inside a character class is free, so the manifest's key order is fine.
    private static readonly string EXTENDED = string.Concat(
        Manifest.MANIFEST.Consonants.Keys
            .Where(c => char.ConvertToUtf32(c, 0) > 0x064a)
            .Select(c => $"\\u{char.ConvertToUtf32(c, 0):X4}"));
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([ء-يٰٱً-ْـ{EXTENDED}]+)|(\\d+(?:(?<!(?<!\\d)0),\\d{{3}})*(?:\\.\\d+)?)|([۔.!؟?،,؛;:…])",
        "gu");

    private static readonly JsRe ARABIC_INDIC = JsRegex.Compile("[٠-٩]", "g");

    /** Arabic-Indic digits ٠..٩ → ASCII. */
    private static string ToAscii(string d) =>
        ARABIC_INDIC.Replace(d, c => Js.NumberToString(c.Value[0] - 0x0660));

    private static Dictionary<string, string>? egyptianLex;
    private static Dictionary<string, string> EgyptianLexicon() =>
        egyptianLex ??= LoadTsv.LoadTsvMap<string>("languages/arabic", "egyptian-lexicon.tsv",
            (v, _) => IpaOnly(v), optional: true);

    private static readonly JsRe HARAKAT = JsRegex.Compile("[ً-ْٰـ]", "gu"); // short-vowel diacritics + dagger-alif + tatweel → bare lexicon key

    private static readonly JsRe VARIANT_SPLIT = JsRegex.Compile("\\/~\\/|\\/\\/|\\/\\[", "u");
    private static readonly JsRe NOT_IPA = JsRegex.Compile("[/[\\]~()|\\\\]", "u");

    /** Exported for tests: the load-time repair rule for a mined lexicon value (see the note above). */
    public static string? IpaOnly(string value)
    {
        if (!NOT_IPA.IsMatch(value)) return value;
        var parts = SplitKeepNonEmpty(value);
        var stressed = parts.Where(p => p.Contains('ˈ')).ToList();
        var pick = stressed.Count == 1 ? stressed[0] : (parts.Count > 0 ? parts[0] : null);
        return pick is not null && !NOT_IPA.IsMatch(pick) ? pick : null;
    }

    /** TS `value.split(VARIANT_SPLIT).filter(Boolean)`. */
    private static List<string> SplitKeepNonEmpty(string value)
    {
        var parts = new List<string>();
        var cursor = 0;
        foreach (var m in VARIANT_SPLIT.Re.Matches(value).Cast<Match>())
        {
            parts.Add(value[cursor..m.Index]);
            cursor = m.Index + m.Length;
        }
        parts.Add(value[cursor..]);
        return parts.Where(p => p.Length > 0).ToList();
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Ampersand = Manifest.MANIFEST.SymbolTier.Ampersand,
    });

    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(",", "gu");

    private sealed class ArabicPhonemizer : ILanguage
    {
        private readonly string? _variety;
        private readonly bool _useLexicon;

        public ArabicPhonemizer(string? variety = null, bool useLexicon = false)
        {
            _variety = variety;
            _useLexicon = useLexicon;
        }

        public string Text(string input)
        {
            input = SYMBOLS(Normalize.NormalizeArabic(input));
            var lex = _variety == "egyptian" && _useLexicon ? EgyptianLexicon() : null;
            return Clauses.AssembleClauses(input, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(
                        (lex is not null ? lex.GetValueOrDefault(HARAKAT.Replace(m.Groups[1].Value, "")) : null)
                            ?? PhonemizeWord(m.Groups[1].Value, _variety));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var nums = _variety is not null ? VARIETIES.GetValueOrDefault(_variety)?.Numbers : null;
                    var split = GROUPING_COMMA.Replace(ToAscii(m.Groups[2].Value), "").Split('.');
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    var parts = new List<string> { Numbers.NumberToIpa(Js.Number(intPart), nums) };
                    if (frac is not null)
                    {
                        parts.Add(PhonemizeWord("فَاصِلَة", _variety));
                        foreach (var d in frac) parts.Add(Numbers.NumberToIpa(Js.Number(d.ToString()), nums));
                    }
                    sink.Emit(string.Join(" ", parts));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Arabic phonemizer for `variety` (undefined/"msa" = Modern Standard Arabic; "egyptian" =
     *  arz, …). Expects diacritized input; the async pre-pass restores short vowels for bare text. */
    public static ILanguage CreateArabic(string? variety = null, bool useLexicon = false) =>
        new ArabicPhonemizer(variety, useLexicon);

    private static readonly Dictionary<string, Task<Diacritizer.IArabicDiacritizer?>> diacritizers = new(StringComparer.Ordinal);
    private static readonly Dictionary<string, ILanguage> phonemizers = new(StringComparer.Ordinal);
    private static Dictionary<string, string>? restoreLexicon;
    private static Dictionary<string, string> RestoreLex() =>
        restoreLexicon ??= LoadTsv.LoadTsvMap("languages/arabic", "diacritization.tsv", optional: true);

    /** Foreign-cluster repair: mater lectionis re-reading, then epenthesis inside a residual 3+ run. */
    private static readonly IReadOnlySet<string> REPAIR_VOWELS = Ipa.IPA_VOWEL;
    private static readonly HashSet<string> REPAIR_SKIP = new(Js.CodePoints("ˈˌːˤّـ"), StringComparer.Ordinal);

    private static readonly JsRe COMBINING_MARK = JsRegex.Compile("\\p{M}", "u");

    private sealed class RUnit
    {
        public required string Text;
        public required bool Vowel;
    }

    private static List<RUnit> RepairUnits(string word)
    {
        var @out = new List<RUnit>();
        foreach (var ch in Js.CodePoints(word.Normalize(System.Text.NormalizationForm.FormD)))
        {
            if (COMBINING_MARK.IsMatch(ch) || REPAIR_SKIP.Contains(ch) || ch == "͡")
            {
                if (@out.Count > 0) @out[^1].Text += ch;
                else @out.Add(new RUnit { Text = ch, Vowel = false });
                continue;
            }
            @out.Add(new RUnit { Text = ch, Vowel = REPAIR_VOWELS.Contains(ch) });
        }
        return @out;
    }

    /** One word of final IPA → repaired IPA. `epenthetic` is the variety's cluster-repair vowel. */
    public static string RepairForeignClusters(string word, string epenthetic = "i")
    {
        var units = RepairUnits(word);
        int RunAt(int i)
        {
            var n = 0;
            while (i + n < units.Count && !units[i + n].Vowel) n++;
            return n;
        }
        var changed = false;
        for (var guard = 0; guard < 8; guard++)
        {
            var acted = false;
            for (var i = 0; i < units.Count; i++)
            {
                if (units[i].Vowel) continue;
                var n = RunAt(i);
                if (n < 3) { i += n; continue; }
                for (var k = i; k < i + n; k++)
                {
                    var @base = units[k].Text[..1];
                    if (@base == "w" || @base == "j")
                    {
                        units[k] = new RUnit { Text = (@base == "w" ? "u" : "i") + units[k].Text[1..], Vowel = true };
                        acted = changed = true;
                        break;
                    }
                }
                if (acted) break;
                i += n;
            }
            if (!acted) break;
        }
        for (var guard = 0; guard < 8; guard++)
        {
            var acted = false;
            for (var i = 0; i < units.Count; i++)
            {
                if (units[i].Vowel) continue;
                var n = RunAt(i);
                if (n >= 3)
                {
                    units.Insert(i + 1, new RUnit { Text = epenthetic, Vowel = true });
                    acted = changed = true;
                    break;
                }
                i += n;
            }
            if (!acted) break;
        }
        return changed
            ? string.Concat(units.Select(u => u.Text)).Normalize(System.Text.NormalizationForm.FormC)
            : word;
    }

    private static readonly JsRe PAUSE_TOKEN = JsRegex.Compile("^[.,!?;:…]+$", "");

    /** Sentence-level wrapper: repair each word token, leave pause marks alone. */
    private static string RepairSentence(string ipa, string epenthetic = "i")
    {
        return string.Join(" ", ipa
            .Split(' ')
            .Select(t => PAUSE_TOKEN.IsMatch(t) ? t : RepairForeignClusters(t, epenthetic)));
    }

    public static async Task<string> PhonemizeArabic(string text, string? variety = null, bool? lexicon = null, string? host = null)
    {
        var dkey = variety == "egyptian" ? "egyptian" : "msa";
        Task<Diacritizer.IArabicDiacritizer?>? diacP;
        lock (diacritizers)
        {
            if (!diacritizers.TryGetValue(dkey, out diacP))
                diacritizers[dkey] = diacP = Diacritizer.CreateArabicDiacritizer(variety);
        }
        var diac = await diacP.ConfigureAwait(false);
        text = SYMBOLS(Normalize.FoldLetterforms(text));
        var vocalized = diac is not null ? await diac.Diacritize(text).ConfigureAwait(false) : text;
        var restored = diac is not null ? Restore.LexiconPrimary(vocalized, RestoreLex()) : vocalized;
        var useLexicon = lexicon ?? true;
        var key = $"{variety ?? "msa"}{(useLexicon ? "" : ":nolex")}";
        ILanguage? phon;
        lock (phonemizers)
        {
            if (!phonemizers.TryGetValue(key, out phon))
                phonemizers[key] = phon = CreateArabic(variety, useLexicon);
        }
        var engine = phon;
        var read = host is null ? engine.Text(restored) : Foreign.WithHost(host, () => engine.Text(restored));
        return RepairSentence(read);
    }

    /** Registry bootstrap: the one Arabic module registers MSA plus every variety key. */
    internal static void RegisterSelf()
    {
        Registry.Register("arabic", () => CreateArabic());
        foreach (var v in new[] { "egyptian", "levantine", "sudanese", "iraqi", "gulf", "moroccan", "libyan", "southlevantine", "hijazi" })
        {
            var variety = v;
            Registry.Register($"arabic:{variety}", () => CreateArabic(variety));
        }
    }
}
