/**
 * Modern Greek (el) phonemizer — Hellenic, the Greek script, canonical IPA. A CONTEXT-SENSITIVE
 * left-to-right scan (not a table map). The historical spellings collapse to /a e i o u/; the interesting rules:
 *   • VELAR PALATALISATION before a front vowel [e i]: κ→c, γ→ʝ, χ→ç; the γ-nasal digraphs ⟨γγ γκ⟩→ŋɡ (→ŋɟ before
 *     front; word-initial ⟨γκ⟩ has no [ŋ]).
 *   • VOICED STOPS: ⟨μπ ντ⟩ word-initial → [b d], MEDIAL (before a vowel) → prenasalised [mb nd]; before a
 *     consonant they are the separate letters μ+π / ν+τ. ⟨τσ τζ⟩→t͡s d͡z.
 *   • SYNIZESIS: an UNSTRESSED [i] (ι/η/υ/ει/οι) before another vowel is not syllabic — after λ/ν it palatalises
 *     the consonant (→ʎ ɲ, the [i] absorbed), after κ/γ/χ likewise (→c ʝ ç), after any other consonant it becomes
 *     a glide [ç] (voiceless C) / [ʝ] (voiced C). A STRESSED [í] stays a full vowel (needs the tonos, tracked below).
 *   • ⟨αυ ευ⟩ → a/e + [v]/[f] and ⟨σ⟩ → [z] by the following consonant's voicing; double consonants simplify.
 * Stress itself is not emitted (the referees don't mark it).
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

    // Stress tonos → base vowel (stress is tracked separately, then stripped from the output).
    private static readonly IReadOnlyDictionary<string, string> TONOS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ά"] = "α", ["έ"] = "ε", ["ή"] = "η", ["ί"] = "ι", ["ό"] = "ο", ["ύ"] = "υ", ["ώ"] = "ω", ["ΐ"] = "ϊ", ["ΰ"] = "ϋ",
    };
    private static readonly IReadOnlySet<string> STRESSED = new HashSet<string>(Js.CodePoints("άέήίόύώΐΰ"), StringComparer.Ordinal);

    private static bool IsCons(string ch) => C.ContainsKey(ch) && ch != "ς";

    private static readonly IReadOnlySet<string> VOICELESS = new HashSet<string>(Manifest.MANIFEST.Voiceless, StringComparer.Ordinal);

    // Palatal replacement of a consonant that swallows a following synizesis [i].
    private static readonly IReadOnlyDictionary<string, string> SYN_PAL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["λ"] = "ʎ", ["ν"] = "ɲ", ["κ"] = "c", ["γ"] = "ʝ", ["χ"] = "ç",
    };

    // Voiced sounds that turn ⟨αυ ευ⟩ → [av ev] (else [af ef]), and the shorter class that voices ⟨σ⟩ → [z]
    // (before a voiced obstruent/nasal). Both include the voiced-stop DIGRAPHS — see greek.jsonc.
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

    /**
     * The rule engine. `forceSyn` applies synizesis at EVERY unstressed-[i]-before-vowel site (not just before a
     * stressed vowel) — used for the lexicon words that fully synize. Otherwise the reliable stressed-vowel subset only.
     */
    private static string Scan(string word, bool forceSyn)
    {
        var raw = word.ToLowerInvariant();
        // Which orthographic positions carry the stress tonos — needed for synizesis (unstressed i only).
        var chars = Js.CodePoints(raw);
        var stressedArr = chars.Select(ch => STRESSED.Contains(ch)).ToArray();
        var w = string.Concat(chars.Select(ch => TONOS.TryGetValue(ch, out var t) ? t : ch));
        bool Stressed(int p) => p >= 0 && p < stressedArr.Length && stressedArr[p];
        var outSb = new StringBuilder();
        var i = 0;
        var n = w.Length;

        // Stress-aware vowel match: a tonos on the FIRST element of a would-be digraph marks HIATUS (τσάι = t͡s+a+i,
        // ρολόι = ɾo.lo.i), so the digraph must NOT merge — take just the single vowel there.
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
        // Is the vowel grapheme at p an UNSTRESSED [i]? (a synizesis trigger)
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
            // γ-nasal digraphs ⟨γγ γκ γχ γξ⟩ → [ŋ] + stop/fricative (palatalised before a front vowel). Word-initial
            // ⟨γκ⟩ has no [ŋ]. Before the double-consonant rule so ⟨γγ⟩ isn't taken for a geminate.
            if (two == "γγ" || two == "γκ" || two == "γχ" || two == "γξ")
            {
                var fr = Front(i + 2);
                var nasal = two == "γκ" && i == 0 ? "" : "ŋ";
                outSb.Append(nasal).Append(two == "γξ" ? "ks" : two == "γχ" ? (fr ? "ç" : "x") : fr ? "ɟ" : "ɡ");
                i += 2;
                continue;
            }
            // ⟨μπ ντ⟩ before a VOWEL or a LIQUID (ρ λ) → voiced stop: word-initial [b d] / medial prenasalised [mb nd]
            // (μπλε→ble, άντρας→andras). Before an OBSTRUENT they fall through to the separate letters μ+π / ν+τ
            // (Πέμπτη → …mpti).
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
            // Double consonant → simplify.
            if (ch == CharAt(w, i + 1) && IsCons(ch))
            {
                i++;
                continue;
            }
            // ⟨αυ ευ⟩ → a/e + [v]/[f] by the following sound. A tonos on the α/ε is HIATUS (άυλος = a.i…), not this digraph.
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
            // Vowel digraph (stress-aware: a tonos on the first element = hiatus, no merge).
            var vm = MatchV(i);
            if (vm is not null && vm.Value.Len == 2)
            {
                outSb.Append(vm.Value.Sound);
                i += 2;
                continue;
            }
            // Single consonant.
            if (C.TryGetValue(ch, out var cph))
            {
                // SYNIZESIS — only the RELIABLE subset: an unstressed [i] immediately before a STRESSED vowel (the
                // productive -ιά/-ιό pattern: κοιλιά→[ciˈʎa], Λειβαδιά→[livaˈðʝa]). Here the [i] is a glide/palatalisation,
                // not syllabic. (The broader unstressed-i-before-ANY-vowel synizesis is lexical/register — the careful
                // referees mostly keep the [i], e.g. Κύριος→[ˈciɾios] — so we do NOT apply it; a lexicon is the path.)
                var iv = UnstressedI(i + 1);
                if (iv is not null)
                {
                    var nv = MatchV(i + 1 + iv.Value.Len);
                    if (nv is not null)
                    {
                        var nvStressed = false;
                        for (var k = 0; k < nv.Value.Len; k++) if (Stressed(i + 1 + iv.Value.Len + k)) nvStressed = true;
                        // Only the RELIABLE subset: before a STRESSED vowel (the productive -ιά/-ιό ending). A data
                        // study of the 19k referee showed synizesis is otherwise genuinely LEXICAL — no consonant
                        // reliably triggers it — so a consonant-conditioned rule can't help; the middle is left to a
                        // synizesis lexicon.
                        if (nvStressed || forceSyn)
                        {
                            if (SYN_PAL.TryGetValue(ch, out var pal)) outSb.Append(pal); // λ ν κ γ χ → palatal, [i] absorbed
                            else outSb.Append(cph).Append(VOICELESS.Contains(ch) ? "ç" : "ʝ"); // other C → C + glide
                            i += 1 + iv.Value.Len;
                            continue;
                        }
                    }
                }
                // Velar palatalisation before a front vowel (the [i] is kept: γίδα → ʝiða).
                if ((ch == "κ" || ch == "γ" || ch == "χ") && Front(i + 1))
                {
                    outSb.Append(ch == "κ" ? "c" : ch == "γ" ? "ʝ" : "ç");
                    i++;
                    continue;
                }
                // ⟨σ⟩ → [z] before a voiced consonant.
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
            // Single vowel.
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

    // SYNIZESIS LEXICON — words that FULLY synize (an unstressed [i] before any vowel → glide/palatal), which the rule
    // can't predict (it's lexical: Κύριος keeps the [i] but κατοικία synizes). Built from the CROSS-SOURCE CONSENSUS of
    // wikipron∩kaikki (greek-synizesis.tsv). Applied on the SHIPPED path only, never in the rule engine — so the
    // referee eval (phonemizeWordRules) stays non-circular.
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

    /** Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string word) => Scan(word, false);

    /** Word→IPA with synizesis FORCED at every site — used only by the lexicon builder. */
    public static string PhonemizeWordForced(string word) => Scan(word, true);

    // Greek uses `;` as the question mark and the ANO TELEIA as a semicolon. The corpus writes the latter as
    // U+00B7 MIDDLE DOT (all 10 instances); U+0387 GREEK ANO TELEIA is the canonical codepoint but sits INSIDE
    // the Greek letter range of the first group, so it could never reach this alternation — normalize.ts step 0
    // folds it to U+00B7 instead of widening the class here.
    private static readonly JsRe TOKEN = JsRegex.Compile("([Ͱ-Ͽἀ-῿]+)|(\\d+)|([.!;?…,:·])", "gu");

    public string Text(string input)
    {
        // ORDER: normalizeGreek owns the whole ordered sequence, including the shared symbol tier at
        // its step 12 — the rate and degree rules have to run before it and the decimal comma after it, so
        // the tier cannot simply be wrapped around the outside. See normalize.ts for the couplings.
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
