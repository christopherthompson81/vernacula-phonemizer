/**
 * French (fr) phonemizer — canonical IPA (standard/Parisian).
 * Ported from src/languages/french/french.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class FrenchPhonemizer
{
    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/french", "lexicon.tsv");

    /**
     * SUPPLEMENT — our own cleanroom pronunciations for words Lexique 3.83 does not contain and the rule g2p
     * gets wrong.
     */
    private static Dictionary<string, string>? SUPPLEMENT;
    private static Dictionary<string, string> Supplement() =>
        SUPPLEMENT ??= LoadTsv.LoadTsvMap("languages/french", "supplement.tsv");

    /** The Lexique pronunciation lexicon (lowercased word → IPA). Exposed so the async neural path (frNeural.ts) can skip
     *  lexicon-covered words — they are served authoritatively by the sync lexicon path. */
    public static IReadOnlyDictionary<string, string> FrenchLexicon() => Lexicon();

    private static readonly JsRe VOWEL_IPA = JsRegex.Compile("[aeiouyɛɔøœəɑ]", "");

    /** One French word → IPA: lexicon lookup first, then the neural tagger (oovOverride, async path only), then the g2p
     *  engine for out-of-vocabulary words. */
    public static string PhonemizeWord(string word, Func<string, string?>? oovOverride = null)
    {
        var lower = word.ToLowerInvariant();
        var direct = Lexicon().GetValueOrDefault(lower)
                     ?? Supplement().GetValueOrDefault(lower)
                     ?? oovOverride?.Invoke(lower);
        if (direct is not null) return direct;
        if (lower.Contains('-'))
        {
            var parts = lower.Split('-').Where(p => p != "").ToList();
            if (parts.Count > 1) return string.Concat(parts.Select(p => PhonemizeWord(p, oovOverride)));
        }
        return G2p.ToIpa(word);
    }

    /** One spelling with two readings, selected by the NEIGHBOURING words. */
    private static IReadOnlyDictionary<string, HeteronymEntry> HETERONYMS => Manifest.MANIFEST.Heteronyms;

    /** Clitics that can sit between a subject pronoun and its verb ("ils NE content pas", "ils SE couvent"),
     *  so the pronoun test looks one word further back when it finds one. Without this, the -ent verb rule
     *  would miss every negated or reflexive clause. */
    private static readonly IReadOnlySet<string> CLITIC = new HashSet<string>(new[]
    {
        "ne", "se", "me", "te", "nous", "vous", "le", "la", "les", "lui", "leur", "y", "en",
    }, StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> NUMBER_WORD = new HashSet<string>(new[]
    {
        "zéro", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
        "onze", "douze", "treize", "quatorze", "quinze", "seize", "vingt", "trente", "quarante",
        "cinquante", "soixante", "cent", "mille", "million", "milliard",
    }, StringComparer.Ordinal);

    /** The heteronym reading for `word` given its neighbours, or undefined to fall through to the lexicon. */
    private static string? HeteronymIpa(string word, string? prev, string? prev2, string? next)
    {
        if (!HETERONYMS.TryGetValue(word, out var entry)) return null;
        foreach (var c in entry.Cases)
        {
            if (c.NextIsNumber == true && next is not null && NUMBER_WORD.Contains(next)) return c.Ipa;
            if (c.Next is not null && next is not null && c.Next.Contains(next)) return c.Ipa;
            if (c.Prev is not null && prev is not null)
            {
                if (c.Prev.Contains(prev)) return c.Ipa;
                if (CLITIC.Contains(prev) && prev2 is not null && c.Prev.Contains(prev2)) return c.Ipa;
            }
        }
        return null;
    }

    private static readonly JsRe VOWEL_ALL = JsRegex.Compile("[aeiouyɛɔøœəɑ]", "g");

    /** Add a phrase-final accent: ˈ before the last vowel of the last IPA token (rhythmic-group stress). */
    private static void AccentFinal(List<string> tokens)
    {
        for (var k = tokens.Count - 1; k >= 0; k--)
        {
            var t = tokens[k];
            if (!VOWEL_IPA.IsMatch(t)) continue;
            var m = VOWEL_ALL.Matches(t);
            var last = m[^1];
            tokens[k] = t[..last.Index] + "ˈ" + t[last.Index..];
            return;
        }
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([a-zà-ÿœæ]+(?:[-'’][a-zà-ÿœæ]+)*)|(\\d+(?:[.,]\\d+)?)|([.!?…,;:])", "giu");

    private static IReadOnlyDictionary<string, string> LIAISON => Manifest.MANIFEST.Liaison;
    private static readonly IReadOnlySet<string> H_ASPIRE =
        new HashSet<string>(Manifest.MANIFEST.HAspire, StringComparer.Ordinal);
    private static readonly JsRe STARTS_VOWEL = JsRegex.Compile("^[aeiouyàâäéèêëîïôöûüùœæh]", "i"); // h → treat as mute unless the word is in H_ASPIRE
    private static readonly JsRe FINAL_S = JsRegex.Compile("s$", "");

    private static string LiaisonOnto(string prev, string next)
    {
        var c = LIAISON.GetValueOrDefault(prev.ToLowerInvariant());
        if (string.IsNullOrEmpty(c)) return "";
        var nx = next.ToLowerInvariant();
        var aspire = H_ASPIRE.Contains(nx) || H_ASPIRE.Contains(FINAL_S.Replace(nx, "")); // plural: homards, haricots
        return STARTS_VOWEL.IsMatch(nx) && !aspire ? c : "";
    }

    private static readonly IReadOnlyDictionary<string, JsRe> LATENT = new Dictionary<string, JsRe>(StringComparer.Ordinal)
    {
        ["z"] = JsRegex.Compile("[sz]$", ""),
        ["t"] = JsRegex.Compile("[td]$", ""),
        ["n"] = JsRegex.Compile("n$", ""),
    };

    private static string StripLatent(string ipa, string c) =>
        LATENT.TryGetValue(c, out var re) && re.IsMatch(ipa) ? ipa[..^1] : ipa;

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "et",
        Multiply = new MultiplyDef { Times = "fois" },
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        BareExponent = Manifest.MANIFEST.SymbolTier.BareExponent,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
        MagnitudeConnective = Manifest.MANIFEST.SymbolTier.MagnitudeConnective,
    });

    /** numeral normalization, run before tokenization. */
    private static string NormalizeFrenchNumerals(string text)
    {
        var s = Ordinals.NormalizeFrenchOrdinalRomans(text, w => Lexicon().ContainsKey(w));
        return Roman.NormalizeRomans(Ordinals.NormalizeFrenchOrdinalDigits(s));
    }

    private abstract record Item;
    private sealed record WordItem(string Word) : Item;
    private sealed record PauseItem(string Pause) : Item;
    private sealed record IpaItem(string Ipa) : Item;

    private static readonly JsRe DECIMAL_SPLIT = JsRegex.Compile("[.,]", "");

    /** The engine. */
    public sealed class FrenchEngine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal FrenchEngine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input) => Text(input, null);

        public string Text(string input, Func<string, string?>? oovOverride)
        {
            bool IsWord(string w) => Lexicon().ContainsKey(w);
            input = SYMBOLS(Normalize.NormalizeFrenchInitialisms(
                NormalizeFrenchNumerals(Normalize.NormalizeFrench(input, IsWord)), IsWord));
            var items = new List<Item>();
            var gapCursor = 0;
            void ClaimGap(int upto)
            {
                if (upto > gapCursor)
                    foreach (Match g in JsRegex.MatchAll(Clauses.FOREIGN_RUN, input[gapCursor..upto]))
                    {
                        var ipa = Foreign.ReadForeignRun(g.Value);
                        if (ipa is not null && ipa != "") items.Add(new IpaItem(ipa));
                    }
                gapCursor = upto;
            }

            foreach (Match m in JsRegex.MatchAll(TOKEN, input))
            {
                ClaimGap(m.Index);
                gapCursor = m.Index + m.Value.Length;
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) items.Add(new WordItem(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var split = DECIMAL_SPLIT.Re.Split(m.Groups[2].Value);
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    foreach (var w in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' '))
                        items.Add(new WordItem(w));
                    if (frac is not null)
                    {
                        items.Add(new WordItem(Manifest.MANIFEST.Numbers.DecimalSeparator));
                        var asNumber = frac.Length <= 3 && !frac.StartsWith("0", StringComparison.Ordinal);
                        var parts = asNumber
                            ? Numbers.NumberToWords(Js.Number(frac), frac).Split(' ').AsEnumerable()
                            : frac.SelectMany(d => Numbers.NumberToWords(Js.Number(d.ToString()), d.ToString()).Split(' '));
                        foreach (var w in parts) items.Add(new WordItem(w));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) items.Add(new PauseItem(mk));
                }
            }
            ClaimGap(input.Length);

            var group = new List<string>(); // IPA tokens of the current rhythmic group (until a pause)
            var @out = "";
            var carry = ""; // liaison consonant to prepend to the next word (its new onset)
            void Flush(string? pause)
            {
                if (group.Count > 0)
                {
                    AccentFinal(group);
                    @out += (@out != "" ? " " : "") + string.Join(" ", group);
                    group = new List<string>();
                }
                if (!string.IsNullOrEmpty(pause)) @out += $" {pause}";
            }

            for (var k = 0; k < items.Count; k++)
            {
                var it = items[k];
                if (it is PauseItem p)
                {
                    carry = "";
                    if (group.Count > 0 || @out != "") Flush(p.Pause);
                    continue;
                } // liaison never crosses a pause
                if (it is IpaItem ip)
                {
                    carry = "";
                    group.Add(ip.Ipa);
                    continue;
                }
                var wi = (WordItem)it;
                var wLower = wi.Word.ToLowerInvariant();
                string? Neighbour(int j) =>
                    j >= 0 && j < items.Count && items[j] is WordItem n ? n.Word.ToLowerInvariant() : null;
                var het = HeteronymIpa(wLower, Neighbour(k - 1), Neighbour(k - 2), Neighbour(k + 1));
                var ipa = carry + (het ?? PhonemizeWord(wi.Word, oovOverride));
                carry = "";
                var next = k + 1 < items.Count ? items[k + 1] : null; // liaison only onto an immediately adjacent word
                if (next is WordItem nw && het is null)
                {
                    carry = LiaisonOnto(wi.Word, nw.Word);
                    if (carry != "") ipa = StripLatent(ipa, carry); // avoid doubling a citation-realised final consonant
                }
                if (ipa != "") group.Add(ipa);
            }
            Flush(null);
            return @out;
        }
    }

    /** Build the French phonemizer. `foreign` handles embedded non-French (unused for now). No data files. The returned
     *  `text` takes an optional per-call `oovOverride` (neural path only) injecting tagger readings for OOV
     *  words (lexicon → oovOverride → rule g2p); still assignable to Phonemizer. */
    public static FrenchEngine CreateFrench(Func<string, string>? foreign = null) => new(foreign);

    internal static void RegisterSelf() => Registry.Register("french", () => CreateFrench());
}
