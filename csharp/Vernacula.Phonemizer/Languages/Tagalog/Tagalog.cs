/**
 * Native Tagalog / Filipino (tl) text phonemizer — canonical IPA. Rule g2p (digraphs, single letters,
 * glottal stops) + penultimate-by-default stress, with a stress lexicon, a word-final-glottal set and a
 * loanword override on the shipped path.
 * Ported from src/languages/tagalog/tagalog.ts — see that file for the corpus evidence.
 */
using System.Text;
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tagalog;

public sealed class TagalogPhonemizer : ILanguage
{
    // The TS loads tagalog.jsonc twice (manifest.ts for normalize's sake, tagalog.ts for the engine); one
    // load serves both here, same object either way.
    internal static TagalogDef DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static TagalogNumbersDef NUM => DEF.Numbers;

    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal);
    private const string VOWEL_PH = "aeiou";

    /** Scan a lowercased Tagalog word → IPA (digraphs, single letters, glottal stops). */
    private static List<string> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var outp = new List<string>();
        for (var i = 0; i < s.Count;)
        {
            var c = s[i];
            if (c == "-" || c == "‑")
            {
                outp.Add("ʔ");
                i++;
                continue;
            }
            var dg = c + (i + 1 < s.Count ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(dg, out var dgp) && dgp.Length > 0)
            {
                outp.Add(dgp);
                i += 2;
                continue;
            }
            if (IsVowelLetter(c))
            {
                var prev = outp.Count > 0 ? outp[^1] : null;
                // TS `prev && VOWEL_PH.includes(prev[0]!)` — an EMPTY previous unit is falsy there, so it is
                // NOT a nucleus here. The test in Stressed below is the other way round; see its note.
                if (outp.Count == 0 || (prev is { Length: > 0 } && VOWEL_PH.Contains(prev[0]))) outp.Add("ʔ");
                outp.Add(DEF.Vowels[c]);
                i++;
            }
            else if (DEF.Consonants.TryGetValue(c, out var cp) && cp.Length > 0)
            {
                outp.Add(cp);
                i++;
            }
            else i++; // unknown → skip
        }
        return outp;
    }

    /** TS `VOWEL_PH.includes(u[0] ?? "")`: an EMPTY unit yields `""` and `String.includes("")` is TRUE, so an
     *  empty unit COUNTS as a nucleus. No mapping in tagalog.jsonc is empty, so this is unreachable today —
     *  reproduced rather than "fixed" because the two engines must agree if one ever is. */
    private static bool IsNucleus(string u) => u.Length == 0 || VOWEL_PH.Contains(u[0]);

    /** Stress the given vowel-nucleus (0-based `overrideVowelIdx`, from the stress lexicon) or the
     *  penultimate nucleus (default). */
    private static string Stressed(IReadOnlyList<string> units, double? overrideVowelIdx)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < units.Count; i++)
            if (IsNucleus(units[i])) nuclei.Add(i);
        if (nuclei.Count == 0) return string.Concat(units);
        var vni = overrideVowelIdx is { } o && o >= 0 && o < nuclei.Count
            ? o
            : nuclei.Count >= 2 ? nuclei.Count - 2 : 0;
        // ⚠ A FRACTIONAL index is `undefined` in JS (`nuclei[2.5]`) and would TRUNCATE if cast here, so the
        // non-integral case is mapped to "no nucleus" — the reading JS gives, which emits no stress mark.
        // Both producers (the Number.isInteger-filtered stress lexicon, NumberStressIdx's vowel count) are
        // integral, so this is a guard rather than a live path.
        var idx = double.IsInteger(vni) ? nuclei[(int)vni] : -1;
        var outSb = new StringBuilder();
        for (var i = 0; i < units.Count; i++)
        {
            if (i == idx) outSb.Append('ˈ');
            outSb.Append(units[i]);
        }
        return outSb.ToString();
    }

    /** Scan + stress one word (shared core). */
    private static string PhonemizeCore(string word, double? overrideVowelIdx = null)
    {
        var lw = Js.ToLowerCase(word);
        var units = Scan(DEF.SpecialWords.TryGetValue(lw, out var special) ? special : lw);
        if (units.Count == 0) return "";
        return Stressed(units, overrideVowelIdx).Normalize(NormalizationForm.FormC);
    }

    /** One Tagalog word → canonical IPA, RULE-ENGINE ONLY — the non-circular signal the referee eval uses. */
    public static string PhonemizeWordRules(string word) => PhonemizeCore(word);

    private static readonly Lazy<HashSet<string>> FinalGlottal = new(() =>
        new HashSet<string>(LoadTsv.LoadLines("languages/tagalog", "final-glottal.txt"), StringComparer.Ordinal));

    private static readonly Lazy<Dictionary<string, double>> StressLex = new(() =>
        LoadTsv.LoadTsvMapV<double>("languages/tagalog", "stress-lexicon.tsv", (v, _) =>
        {
            var n = Js.Number(v);
            // reject empty/whitespace (Number("")===0 would else silently pin the first vowel) and non-integers
            return v.Trim().Length != 0 && double.IsInteger(n) && n >= 0 ? n : null;
        }));

    private static readonly Lazy<Dictionary<string, string>> LoanwordLex = new(() =>
        LoadTsv.LoadTsvMap("languages/tagalog", "loanword-lexicon.tsv"));

    /** The shipped path WITHOUT the loanword override: rule engine + stress lexicon + word-final-glottal pin. */
    public static string PhonemizeShippedNoLoan(string word)
    {
        var lw = Js.ToLowerCase(word);
        var ipa = PhonemizeCore(word, StressLex.Value.TryGetValue(lw, out var v) ? v : null);
        if (ipa.Length > 0 && !ipa.EndsWith("ʔ", StringComparison.Ordinal) && FinalGlottal.Value.Contains(lw))
            return ipa + "ʔ";
        return ipa;
    }

    /** One Tagalog word → canonical IPA (shipped): the loanword override, else the rule/stress/final-ʔ path. */
    public static string PhonemizeWord(string word) =>
        LoanwordLex.Value.TryGetValue(Js.ToLowerCase(word), out var pin) ? pin : PhonemizeShippedNoLoan(word);

    // ── Numbers (native Tagalog; explicit irregular teens/tens + productive ligature sandhi) ──────────────

    /** TS `"aeiou".includes(s[s.length - 1] ?? "")` — an EMPTY phrase yields `includes("")`, which is TRUE.
     *  Unreachable (every caller passes a non-empty phrase); reproduced for the same reason as `IsNucleus`. */
    private static bool EndsInVowel(string s) => s.Length == 0 || "aeiou".Contains(s[^1]);

    /** The multiplier ligature before daan/libo/milyon: vowel-final → +ng, /n/-final → +g, other consonant
     *  → + " na". */
    private static string Ligate(string phrase) =>
        EndsInVowel(phrase) ? phrase + "ng"
        : phrase.EndsWith("n", StringComparison.Ordinal) ? phrase + "g"
        : phrase + " na";

    /** Attach a remainder r to a higher group: a sub-100 tail joins with "at" → "'t" after a vowel; a ≥100
     *  tail is space-juxtaposed. */
    private static string JoinRemainder(string high, double r)
    {
        if (r == 0) return high;
        var low = NumberWords(r);
        if (r >= 100) return $"{high} {low}";
        return EndsInVowel(high) ? $"{high}'t {low}" : $"{high} {NUM.And} {low}";
    }

    /** Native Tagalog cardinal for a non-negative integer. */
    public static string NumberWords(double n)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20) return NUM.Teens[(int)n - 10]; // 10–19 explicit
        if (n < 100)
        {
            var t = Math.Floor(n / 10);
            return JoinRemainder(NUM.Tens[(int)t], n % 10);
        }
        if (n < 1000)
        {
            var h = Math.Floor(n / 100);
            var lig = Ligate(NUM.Units[(int)h]);
            var daan = lig.EndsWith("na", StringComparison.Ordinal) ? NUM.HundredAfterNa : NUM.Hundred;
            var hundreds = h == 1 ? NUM.Hundred1 : $"{lig} {daan}";
            return JoinRemainder(hundreds, n % 100);
        }
        if (n < 1000000)
        {
            var th = Math.Floor(n / 1000);
            var thousands = th == 1 ? NUM.Thousand1 : $"{Ligate(NumberWords(th))} {NUM.Thousand}";
            return JoinRemainder(thousands, n % 1000);
        }
        var m = Math.Floor(n / 1000000);
        return JoinRemainder($"{Ligate(NumberWords(m))} {NUM.Million}", n % 1000000);
    }

    private static readonly HashSet<string> NUM_PENULT = new(NUM.StressPenult, StringComparer.Ordinal);

    /** The stressed vowel-nucleus index for one emitted number token — FINAL by default, PENULT for the
     *  kaikki-mined exceptions. */
    private static double? NumberStressIdx(string token)
    {
        // ⚠ The ligature is `-ng` after a vowel but bare `-g` after /n/, and the surface cannot tell them
        // apart (`bata`+`ng` and `sandaan`+`g` both end `-ang`). Resolved by MEMBERSHIP, not by length —
        // see the TS for why, and for why it is behaviour-identical today.
        var root = token.EndsWith("'t", StringComparison.Ordinal) ? token[..^2]
            : token.EndsWith("ng", StringComparison.Ordinal) && NUM_PENULT.Contains(token[..^2]) ? token[..^2]
            : token.EndsWith("g", StringComparison.Ordinal) && token[..^1].EndsWith("n", StringComparison.Ordinal)
                && NUM_PENULT.Contains(token[..^1]) ? token[..^1]
            : token.EndsWith("ng", StringComparison.Ordinal) ? token[..^2]
            : token;
        var nuclei = 0;
        foreach (var c in token)
            if ("aeiou".Contains(c)) nuclei++;
        if (nuclei == 0) return null;
        return NUM_PENULT.Contains(root) && nuclei >= 2 ? nuclei - 2 : nuclei - 1;
    }

    /** The shared symbol tier — every word corpus-attested; see the TS for the counts and the refusals. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porsiyento" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dolyar" }, ["$"] = new[] { "dolyar" }, ["₱"] = new[] { "piso" },
            ["¥"] = new[] { "yen" }, ["€"] = new[] { "euro" },
        },
        Magnitudes = new[]
        {
            "milyon", "bilyon", "trilyon", "libo", "milyong", "bilyong", "trilyong", "libong",
            "Milyon", "Bilyon", "Trilyon",
        },
        Ampersand = "at",
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometro" }, ["kilometro"] = new[] { "kilometro" }, ["m"] = new[] { "metro" },
            ["cm"] = new[] { "sentimetro" }, ["mm"] = new[] { "milimetro" }, ["kg"] = new[] { "kilogramo" },
            ["mg"] = new[] { "miligramo" }, ["nm"] = new[] { "nanometro" }, ["lb"] = new[] { "libra" },
            ["lbs"] = new[] { "libra" }, ["l"] = new[] { "litro" }, ["L"] = new[] { "litro" },
            ["ha"] = new[] { "ektarya" }, ["katao"] = new[] { "katao" },
            ["naninirahan"] = new[] { "naninirahan" },
        },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["s"] = "segundo", ["h"] = "oras" }, // `h` → oras (#1257)
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kuwadrado" }, Cubed = new[] { "kubiko" }, Position = "after",
        },
        UnitPer = "bawat",
    });

    private const string ORDINAL_ONE = "una";
    private const string ORDINAL_PREFIX = "ika";
    /** ⟨ika⟩'s own vowel count — the prefix fuses onto the cardinal, so the penult lookup happens on the BARE
     *  cardinal and the resulting index is shifted past the prefix. See the TS for the defect this closes. */
    private static readonly int ORDINAL_PREFIX_NUCLEI = ORDINAL_PREFIX.Count(c => IsVowelLetter(c.ToString()));
    private static IReadOnlyDictionary<string, string> ORDINAL_CONTRACTED => Manifest.MANIFEST.ContractedOrdinals;

    // Order is load-bearing: times before the number class, ika- ordinals before LATIN_RUN, and the number
    // class swallows its own thousands-commas and decimal dot.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(?<![\\d:])(\\d{1,2}):([0-5]\\d)(?::([0-5]\\d))?(?![\\d:])"
        + "|[Ii]ka-?(\\d+)(?![\\p{L}\\d])"
        + "|(" + HostWord.LATIN_RUN + "(?:[-‑]" + HostWord.LATIN_RUN + ")*)"
        + "|([1-9]\\d{0,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)"
        + "|([.?!,;:])",
        "gu");

    /** Tagalog's OWN inventory. ⚠ `Ñ`/`ñ` IS NATIVE, which is why the nativising fold is CONDITIONAL. */
    private const string NATIVE_CLASS = "[A-Za-zÑñ‑-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");

    public string Text(string input)
    {
        // Normalization BEFORE tokenizing (entities, digit ranges), then the symbol tier — that order is
        // load-bearing; see normalize.ts.
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeTagalog(input)), TOKEN, (m, sink) =>
        {
            void EmitNumber(string digits)
            {
                var n = Js.Number(digits);
                // Above 2^53 the reading is a digit string, not a quantity — but it is still READ, reusing
                // the same number words and the same NUMBER-sense stress.
                if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
                {
                    foreach (var d in digits)
                        foreach (var wd in NumberWords(Js.Number(d.ToString())).Split(' '))
                            sink.Emit(PhonemizeCore(wd, NumberStressIdx(wd)));
                    return;
                }
                foreach (var wd in NumberWords(n).Split(' '))
                    sink.Emit(PhonemizeCore(wd, NumberStressIdx(wd)));
            }

            if (m.Groups[1].Success)
            {
                // TIME, hh:mm(:ss) — each field as a cardinal, zero minutes silent.
                EmitNumber(m.Groups[1].Value);
                if (m.Groups[2].Value != "00") EmitNumber(Js.NumberToString(Js.Number(m.Groups[2].Value)));
                if (m.Groups[3].Success) EmitNumber(Js.NumberToString(Js.Number(m.Groups[3].Value)));
            }
            else if (m.Groups[4].Success)
            {
                var n = Js.Number(m.Groups[4].Value);
                // ⚠ ⟨una⟩ goes through the PROSE path: penult stress, ʔˈuna.
                if (n == 1) { sink.Emit(PhonemizeWord(ORDINAL_ONE)); return; }
                // TS indexes a string-keyed record with a NUMBER, which coerces through Number→String.
                if (ORDINAL_CONTRACTED.TryGetValue(Js.NumberToString(n), out var contracted))
                {
                    foreach (var wd in contracted.Split(' ')) sink.Emit(PhonemizeCore(wd, NumberStressIdx(wd)));
                    return;
                }
                var card = NumberWords(n).Split(' ');
                for (var i = 0; i < card.Length; i++)
                {
                    var idx = NumberStressIdx(card[i]);
                    if (i != 0) { sink.Emit(PhonemizeCore(card[i], idx)); continue; }
                    sink.Emit(PhonemizeCore(ORDINAL_PREFIX + card[i],
                        idx is null ? null : idx + ORDINAL_PREFIX_NUCLEI));
                }
            }
            else if (m.Groups[5].Success)
            {
                sink.Emit(PhonemizeWord(Nat(m.Groups[5].Value)));
            }
            else if (m.Groups[6].Success)
            {
                // De-group thousands, then read a surviving dot's fraction DIGIT-BY-DIGIT, the dot silent.
                var parts = COMMAS.Replace(m.Groups[6].Value, "").Split('.');
                EmitNumber(parts[0]);
                if (parts.Length > 1)
                    foreach (var d in parts[1])
                        EmitNumber(d.ToString());
            }
            else if (m.Groups[7].Success)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[7].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Tagalog phonemizer. */
    public static ILanguage CreateTagalog() => new TagalogPhonemizer();

    internal static void RegisterSelf() => Registry.Register("tagalog", CreateTagalog);
}
