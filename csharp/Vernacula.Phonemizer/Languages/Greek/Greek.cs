/**
 * Modern Greek (el) phonemizer — Hellenic, the Greek script, canonical IPA.
 * Ported from src/languages/greek/greek.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Greek;

public sealed class GreekPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> V => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> VD => Manifest.MANIFEST.VowelDigraphs;
    private static IReadOnlyDictionary<string, string> C => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly IReadOnlyDictionary<string, string> TONOS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ά"] = "α", ["έ"] = "ε", ["ή"] = "η", ["ί"] = "ι", ["ό"] = "ο", ["ύ"] = "υ", ["ώ"] = "ω", ["ΐ"] = "ϊ", ["ΰ"] = "ϋ",
    };
    private static readonly IReadOnlySet<string> STRESSED = new HashSet<string>(Js.CodePoints("άέήίόύώΐΰ"), StringComparer.Ordinal);

    private static bool IsCons(string ch) => C.ContainsKey(ch) && ch != "ς";

    private static readonly IReadOnlySet<string> VOICELESS = new HashSet<string>(Manifest.MANIFEST.Voiceless, StringComparer.Ordinal);

    private static readonly IReadOnlyDictionary<string, string> SYN_PAL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["λ"] = "ʎ", ["ν"] = "ɲ", ["κ"] = "c", ["γ"] = "ʝ", ["χ"] = "ç",
    };

    private static readonly IReadOnlySet<string> AU_VOICED = new HashSet<string>(Manifest.MANIFEST.AuVoiced, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> SIGMA_VOICED = new HashSet<string>(Manifest.MANIFEST.SigmaVoiced, StringComparer.Ordinal);

    /** JS `w.slice(a, b)` — a clamped substring rather than an exception. */
    private static string Slice(string w, int a, int b)
    {
        if (a >= w.Length) return "";
        b = Math.Min(b, w.Length);
        return a >= b ? "" : w[a..b];
    }

    /** JS `w[i]` — the one-character string, or null past the end. */
    private static string? CharAt(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : null;

    /** Match a vowel grapheme (digraph first) at position i → (orthLen, sound) or null. */
    private static (int Len, string Sound)? MatchVowel(string w, int i)
    {
        var two = Slice(w, i, i + 2);
        if (VD.TryGetValue(two, out var vd)) return (2, vd);
        var one = CharAt(w, i);
        if (one is not null && V.TryGetValue(one, out var v)) return (1, v);
        return null;
    }

    /** The rule engine. */
    private static string Scan(string word, bool forceSyn)
    {
        var raw = word.ToLowerInvariant();
        var chars = Js.CodePoints(raw);
        var stressedArr = chars.Select(ch => STRESSED.Contains(ch)).ToArray();
        var w = string.Concat(chars.Select(ch => TONOS.TryGetValue(ch, out var t) ? t : ch));
        bool Stressed(int p) => p >= 0 && p < stressedArr.Length && stressedArr[p];
        var outSb = new StringBuilder();
        var i = 0;
        var n = w.Length;

        (int Len, string Sound)? MatchV(int p)
        {
            var m = MatchVowel(w, p);
            if (m is not null && m.Value.Len == 2 && Stressed(p))
            {
                var one = CharAt(w, p);
                if (one is not null && V.TryGetValue(one, out var v)) return (1, v);
            }
            return m;
        }
        bool Front(int p)
        {
            var m = MatchV(p);
            return m is not null && (m.Value.Sound == "e" || m.Value.Sound == "i");
        }
        (int Len, string Sound)? UnstressedI(int p)
        {
            var m = MatchV(p);
            if (m is null || m.Value.Sound != "i") return null;
            for (var k = 0; k < m.Value.Len; k++) if (Stressed(p + k)) return null;
            return m;
        }

        while (i < n)
        {
            var ch = w[i].ToString();
            var two = Slice(w, i, i + 2);
            if (two == "γγ" || two == "γκ" || two == "γχ" || two == "γξ")
            {
                var fr = Front(i + 2);
                var nasal = two == "γκ" && i == 0 ? "" : "ŋ";
                outSb.Append(nasal).Append(two == "γξ" ? "ks" : two == "γχ" ? (fr ? "ç" : "x") : fr ? "ɟ" : "ɡ");
                i += 2;
                continue;
            }
            var afterMpNt = CharAt(w, i + 2);
            if ((two == "μπ" || two == "ντ")
                && (MatchVowel(w, i + 2) is not null || afterMpNt == "ρ" || afterMpNt == "λ"))
            {
                var voiced = two == "μπ" ? "b" : "d";
                outSb.Append(i == 0 ? voiced : (two == "μπ" ? "m" : "n") + voiced);
                i += 2;
                continue;
            }
            if (two == "τσ" || two == "τζ")
            {
                outSb.Append(two == "τσ" ? "t͡s" : "d͡z");
                i += 2;
                continue;
            }
            if (ch == CharAt(w, i + 1) && IsCons(ch))
            {
                i++;
                continue;
            }
            if ((two == "αυ" || two == "ευ") && !Stressed(i))
            {
                var nx2 = Slice(w, i + 2, i + 4);
                var nx1 = CharAt(w, i + 2);
                var voiced = i + 2 >= n
                    || AU_VOICED.Contains(nx2)
                    || (nx1 is not null && (AU_VOICED.Contains(nx1) || MatchVowel(w, i + 2) is not null));
                outSb.Append(two == "αυ" ? "a" : "e").Append(voiced ? "v" : "f");
                i += 2;
                continue;
            }
            var vm = MatchV(i);
            if (vm is not null && vm.Value.Len == 2)
            {
                outSb.Append(vm.Value.Sound);
                i += 2;
                continue;
            }
            if (C.TryGetValue(ch, out var cph))
            {
                var iv = UnstressedI(i + 1);
                if (iv is not null)
                {
                    var nv = MatchV(i + 1 + iv.Value.Len);
                    if (nv is not null)
                    {
                        var nvStressed = false;
                        for (var k = 0; k < nv.Value.Len; k++) if (Stressed(i + 1 + iv.Value.Len + k)) nvStressed = true;
                        if (nvStressed || forceSyn)
                        {
                            if (SYN_PAL.TryGetValue(ch, out var pal)) outSb.Append(pal); // λ ν κ γ χ → palatal, [i] absorbed
                            else outSb.Append(cph).Append(VOICELESS.Contains(ch) ? "ç" : "ʝ"); // other C → C + glide
                            i += 1 + iv.Value.Len;
                            continue;
                        }
                    }
                }
                if ((ch == "κ" || ch == "γ" || ch == "χ") && Front(i + 1))
                {
                    outSb.Append(ch == "κ" ? "c" : ch == "γ" ? "ʝ" : "ç");
                    i++;
                    continue;
                }
                if (ch == "σ")
                {
                    var n1 = CharAt(w, i + 1);
                    outSb.Append(SIGMA_VOICED.Contains(Slice(w, i + 1, i + 3)) || (n1 is not null && SIGMA_VOICED.Contains(n1)) ? "z" : "s");
                    i++;
                    continue;
                }
                outSb.Append(cph);
                i++;
                continue;
            }
            if (vm is not null)
            {
                outSb.Append(vm.Value.Sound);
                i++;
                continue;
            }
            i++; // unknown → skip
        }
        return outSb.ToString();
    }

    private static HashSet<string>? LEXICON;
    private static HashSet<string> Lexicon()
    {
        if (LEXICON is null)
        {
            LEXICON = new HashSet<string>(StringComparer.Ordinal);
            foreach (var k in LoadTsv.LoadTsvMap("languages/greek", "greek-synizesis.tsv", optional: true).Keys)
                LEXICON.Add(k);
        }
        return LEXICON;
    }

    /** Bare word→IPA, SHIPPED path (synizesis lexicon → rule engine). For real text. */
    public static string PhonemizeWord(string word) => Scan(word, Lexicon().Contains(word.ToLowerInvariant()));

    /**
     * Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval.
     */
    public static string PhonemizeWordRules(string word) => Scan(word, false);

    /** Word→IPA with synizesis FORCED at every site — used only by the lexicon builder. */
    public static string PhonemizeWordForced(string word) => Scan(word, true);

    private static readonly JsRe TOKEN = JsRegex.Compile("([Ͱ-Ͽἀ-῿]+)|(\\d+)|([.!;?…,:·])", "gu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeGreek(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Modern Greek phonemizer (context-sensitive rule g2p; stress not emitted). */
    public static ILanguage CreateGreek() => new GreekPhonemizer();

    internal static void RegisterSelf() => Registry.Register("greek", CreateGreek);
}
