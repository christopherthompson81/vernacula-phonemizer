/**
 * Afrikaans (af) phonemizer — Indo-European (West Germanic), Latin script, Standard Afrikaans.
 * Ported from src/languages/afrikaans/afrikaans.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

/** A per-word OOV reading supplied by the async neural path; null for "no opinion". */
public delegate string? OovResolver(string word);

public sealed class AfrikaansPhonemizer : ILanguage
{
    private static AfrikaansManifest MANIFEST => Afrikaans.Manifest.MANIFEST;
    private static List<string> FIXED_KEYS => Afrikaans.Manifest.FIXED_KEYS;

    private static IReadOnlyDictionary<string, string>? LEXICON;
    private static IReadOnlyDictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/afrikaans", "af-lexicon.tsv");
    private static IReadOnlyDictionary<string, string>? RCRL;
    private static IReadOnlyDictionary<string, string> Rcrl() =>
        RCRL ??= LoadTsv.LoadTsvMap("languages/afrikaans", "af-rcrl-lexicon.tsv", optional: true);

    private static IReadOnlyDictionary<string, string> FIXED => MANIFEST.Fixed;
    private static IReadOnlyDictionary<string, string> LONG => MANIFEST.VowelsLong;
    private static IReadOnlyDictionary<string, string> SHORT => MANIFEST.VowelsShort;
    private static IReadOnlyDictionary<string, string> DIA => MANIFEST.DiacriticVowels;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => MANIFEST.ClausePunctuation;

    private static IReadOnlyDictionary<string, string> DEVOICE => MANIFEST.VoicedFinal; // word-final devoicing (g→χ, v→f already fixed)

    private static readonly IReadOnlySet<string> VOICELESS =
        new HashSet<string>(MANIFEST.VoicelessPhones, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOICELESS_NEXT = new HashSet<string>(
        new[] { "c" }.Concat(MANIFEST.Fixed
            .Where(kv => kv.Key.Length == 1 && VOICELESS.Contains(Js.CodePoints(kv.Value)[0]))
            .Select(kv => kv.Key)),
        StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> BARE_VOWELS =
        new HashSet<string>(MANIFEST.BareVowels, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOWEL_LETTER =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);

    /** Every single character the scan below has a rule for: the grapheme table, the diacritic vowels, the bare
     *  vowels, and the two letters handled by code rules (⟨c⟩ soft/hard, the apostrophe of 'n). */
    private static readonly IReadOnlySet<string> KNOWN_LETTERS = new HashSet<string>(
        FIXED.Keys.Where(k => Js.CodePoints(k).Count == 1)
            .Concat(DIA.Keys)
            .Concat(MANIFEST.BareVowels)
            .Concat(new[] { "c", "'" }),
        StringComparer.Ordinal);

    private static readonly JsRe MARKS = JsRegex.Compile("\\p{M}+", "gu");

    /** ⚠ AN ACCENT AFRIKAANS DOES NOT WRITE IS READ AS THE LETTER UNDER IT, NOT DELETED. */
    internal static string FoldForeignLetters(string w)
    {
        var cps = Js.CodePoints(w);
        if (cps.All(c => KNOWN_LETTERS.Contains(c))) return w; // the common case, and it allocates nothing
        var sb = new StringBuilder(w.Length);
        foreach (var c in cps)
        {
            if (KNOWN_LETTERS.Contains(c)) { sb.Append(c); continue; }
            var b = MARKS.Replace(c.Normalize(NormalizationForm.FormD), "");
            sb.Append(b.Length == 1 && KNOWN_LETTERS.Contains(b) ? b : c);
        }
        return sb.ToString();
    }

    /** Is the bare vowel at index `i` in an OPEN syllable (→ long/tense)? */
    private static bool IsOpen(string w, int i)
    {
        var j = i + 1;
        while (j < w.Length && !VOWEL_LETTER.Contains(w[j].ToString())) j++;
        var cons = j - (i + 1);
        if (cons == 0) return true; // vowel at word end, or a following vowel (hiatus)
        return cons == 1 && j < w.Length; // exactly one consonant before another vowel → open
    }

    private static IReadOnlyDictionary<string, string> REDUCE => MANIFEST.UnstressedReduction; // unstressed bare vowels
    private static IReadOnlyDictionary<string, string?> REDUCE_OPEN => MANIFEST.UnstressedOpen;
    private static readonly IReadOnlySet<string> C_SOFT =
        new HashSet<string>(MANIFEST.CSoftBefore, StringComparer.Ordinal); // ⟨c⟩ → [s] before one of these, else [k]
    private static readonly IReadOnlySet<string> W_GLIDE_AFTER =
        new HashSet<string>(MANIFEST.WGlideAfter, StringComparer.Ordinal); // morpheme-initial ⟨Cw⟩ → the glide [w]

    private static readonly string V = string.Concat(MANIFEST.VowelLetters);

    private static string ByLen(IReadOnlyList<string> xs) =>
        string.Join("|", xs.OrderByDescending(x => x.Length));

    private static IReadOnlyDictionary<string, double> STRESS_FROM_END => MANIFEST.StressFromEnd; // derived suffix → syllables-from-end
    private static readonly List<string> STRESS_FROM_END_KEYS =
        MANIFEST.StressFromEnd.Keys.OrderByDescending(k => k.Length).ToList();
    private static readonly JsRe STRESS_FINAL = JsRegex.Compile($"({ByLen(MANIFEST.StressFinalSuffixes)})$", "u");
    private static readonly JsRe STRESS_PENULT = JsRegex.Compile($"({ByLen(MANIFEST.StressPenultSuffixes)})$", "u");
    private static readonly JsRe UNSTRESSED_PREFIX = JsRegex.Compile(
        $"^({string.Join("|", MANIFEST.Morphology.PrefixUnstressed)})[^{V}]*[{V}]", "u");

    /**
     * How many NUCLEI the grapheme scan will emit for `w` — walked with the SAME decisions phonemizeMorpheme
     * makes.
     */
    private static int CountNuclei(string w)
    {
        var n = 0;
        for (var i = 0; i < w.Length;)
        {
            var c = w[i].ToString();
            if (DIA.ContainsKey(c)) { n += 1; i += 1; continue; }
            if (!VOWEL_LETTER.Contains(c) && i + 1 < w.Length && w[i + 1] == w[i] && c != "'") { i += 1; continue; } // doubled consonant
            if (c == "c" && (i + 1 >= w.Length || w[i + 1] != 'h')) { i += 1; continue; } // the ⟨c⟩ code rule, never a nucleus
            var key = FIXED_KEYS.FirstOrDefault(k => StartsWithAt(w, k, i));
            if (key is not null) { if (VOWEL_LETTER.Contains(key[0].ToString())) n += 1; i += key.Length; continue; }
            if (BARE_VOWELS.Contains(c)) { n += 1; i += 1; continue; }
            i += 1;
        }
        return n;
    }

    /** JS `w.startsWith(key, i)`. */
    private static bool StartsWithAt(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    /** The (0-based) nucleus that carries primary stress. Native default = the first syllable (past an unstressed
     *  prefix); loan suffixes shift it: -ie/-sie/-asie → penultimate (aborsie→a·BOR·sie), -eer/-eur/-teit →
     * final. */
    private static int StressedNucleus(string w)
    {
        var n = CountNuclei(w); // ⚠ NOT a vowel-letter-group count — see countNuclei
        if (n <= 1) return 0;
        foreach (var s in STRESS_FROM_END_KEYS)
        {
            if (!w.EndsWith(s, StringComparison.Ordinal)) continue;
            var fromEnd = STRESS_FROM_END[s];
            if (fromEnd < n) return n - 1 - (int)fromEnd;
            break; // longest match wins; a shorter one is not a better guess for the same word
        }
        if (STRESS_FINAL.IsMatch(w)) return n - 1; // stress-final loan suffixes (afrikaans.jsonc)
        if (STRESS_PENULT.IsMatch(w)) return n - 2; // -ie / -sie / -asie / -osie → penultimate
        return UNSTRESSED_PREFIX.IsMatch(w) ? 1 : 0;
    }

    /**
     * Phonemize a single MORPHEME (a whole non-compound word, or one element of a compound) — its own first-
     * syllable stress, open/closed length, and word-/morpheme-final devoicing.
     */
    private static string PhonemizeMorpheme(string word, bool finalDevoice = true, bool emitStress = true)
    {
        var w = FoldForeignLetters(Js.ToLowerCase(word.Normalize(NormalizationForm.FormC)));
        var stressNucleus = StressedNucleus(w); // primary-stress nucleus (native first-syllable + loan-suffix overrides)
        var outSb = new StringBuilder();
        var i = 0;
        var nucleus = 0; // count of vowel nuclei emitted so far
        var stressAt = -1;
        while (i < w.Length)
        {
            var c = w[i].ToString();
            if (DIA.TryGetValue(c, out var dia))
            {
                if (nucleus == stressNucleus && stressAt < 0) stressAt = outSb.Length;
                outSb.Append(dia); i += 1; nucleus += 1; continue; // diacritic vowel (single char)
            }
            if (!VOWEL_LETTER.Contains(c) && i + 1 < w.Length && w[i + 1] == w[i] && c != "'") { i += 1; continue; } // doubled consonant = single phoneme (appel→ˈapəl)
            if (c == "c")
            {
                // ⚠ This code rule runs BEFORE the fixed grapheme table so it can beat the single-letter
                // entries — which means it must YIELD on a following ⟨h⟩, or it shadows the ⟨ch⟩/⟨chr⟩ digraphs.
                if (i + 1 >= w.Length || w[i + 1] != 'h')
                {
                    outSb.Append(i + 1 < w.Length && C_SOFT.Contains(w[i + 1].ToString()) ? "s" : "k");
                    i += 1;
                    continue;
                }
            }
            if (c == "w" && i == 1 && W_GLIDE_AFTER.Contains(w[0].ToString())) { outSb.Append("w"); i += 1; continue; }
            var matched = false;
            foreach (var key in FIXED_KEYS)
            {
                if (!StartsWithAt(w, key, i)) continue;
                var nextIdx = i + key.Length;
                string? next = nextIdx < w.Length ? w[nextIdx].ToString() : null;
                var devoiceHere = next is null ? finalDevoice : VOICELESS_NEXT.Contains(next);
                if (VOWEL_LETTER.Contains(key[0].ToString()) && nucleus == stressNucleus && stressAt < 0) stressAt = outSb.Length;
                outSb.Append(devoiceHere && DEVOICE.TryGetValue(key, out var dv) ? dv : FIXED[key]);
                if (VOWEL_LETTER.Contains(key[0].ToString())) nucleus += 1; // a vowel digraph is a nucleus
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            if (BARE_VOWELS.Contains(c))
            {
                var stressed = nucleus == stressNucleus;
                if (stressed && stressAt < 0) stressAt = outSb.Length;
                if (c == "e" && i == w.Length - 1) outSb.Append('ə'); // final unstressed ⟨e⟩ → schwa
                else if (c == "i") outSb.Append(IsOpen(w, i) ? "i" : "ə");
                else if (stressed) outSb.Append(IsOpen(w, i) ? LONG[c] : SHORT[c]); // length rule in the stressed syllable
                else outSb.Append((IsOpen(w, i) && REDUCE_OPEN.TryGetValue(c, out var ro) ? ro : null) ?? REDUCE[c]);
                i += 1;
                nucleus += 1;
                continue;
            }
            i += 1; // unknown char → skip
        }
        var res = outSb.ToString();
        return emitStress && stressAt >= 0 ? res[..stressAt] + "ˈ" + res[stressAt..] : res;
    }

    private static IReadOnlyDictionary<string, string> PREFIX_IPA => MANIFEST.PrefixIpa;
    private static readonly IReadOnlySet<string> RESYLLABIFY =
        new HashSet<string>(MANIFEST.Morphology.ResyllabifyingSuffixes, StringComparer.Ordinal); // block final devoicing

    private static readonly JsRe CORONAL_STOP = JsRegex.Compile("[td]", "u");

    /** Join the phonemized morphemes, resolving what happens AT the seam. `src` is each part's SPELLING — the
     *  degemination rule keys on the coda's underlying voicing, which only the spelling still shows. */
    private static string JoinSeams(IReadOnlyList<(string Ipa, string Src)> parts)
    {
        var outStr = "";
        var prevSrc = "";
        foreach (var (ipa, src) in parts)
        {
            var last = outStr.Length > 0 ? outStr[^1].ToString() : null;
            if (last is not null && prevSrc.EndsWith("d", StringComparison.Ordinal)
                && CORONAL_STOP.IsMatch(last) && CORONAL_STOP.IsMatch(ipa.Length > 0 ? ipa[0].ToString() : ""))
                outStr = outStr[..^1];
            outStr += ipa;
            prevSrc = src;
        }
        return outStr;
    }

    private static IReadOnlyDictionary<string, string> LETTER_NAME => MANIFEST.LetterNames; // a bare single letter is SPELLED

    /** Is this word served by either shipped lexicon? Read by the async neural path (afrikaansNeural.ts) so a
     *  lexicon-covered word is served by the exact dictionary reading rather than by the tagger. */
    public static bool AfrikaansLexiconHas(string word)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        return Lexicon().ContainsKey(w) || Rcrl().ContainsKey(w);
    }

    /**
     * Words `phonemizeWordRules` handles with a SPECIAL CASE, which no outside tier may claim: the indefinite
     * article ⟨'n⟩ = [ə], and a bare single letter, which is SPELLED as its name rather than sounded.
     */
    public static bool AfrikaansRuleReserved(string word)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        return w == "'n" || w == "’n" || Js.CodePoints(w).Count == 1;
    }

    /** Vowel symbols the Afrikaans engine emits — the nucleus test for `withStress`. */
    private static readonly JsRe IPA_NUCLEUS = JsRegex.Compile("[aeiouyɑɛɔœəøæɪʊ]", "u");

    /** ⚠ EVERY TIER MUST CARRY THE MARK, OR THE TIERS DISAGREE WITH EACH OTHER. */
    private static string WithStress(string ipa, string word)
    {
        if (ipa == "" || ipa.Contains('ˈ')) return ipa;
        var target = StressedNucleus(FoldForeignLetters(Js.ToLowerCase(word.Normalize(NormalizationForm.FormC))));
        var seen = -1;
        for (var i = 0; i < ipa.Length; i += 1)
        {
            var isVowel = IPA_NUCLEUS.IsMatch(ipa[i].ToString());
            if (!isVowel) continue;
            seen += 1;
            if (seen == target) return ipa[..i] + "ˈ" + ipa[i..];
            while (i + 1 < ipa.Length && IPA_NUCLEUS.IsMatch(ipa[i + 1].ToString())) i += 1; // one nucleus, not per letter
        }
        return ipa;
    }

    public static string PhonemizeWord(string word, OovResolver? oovOverride = null)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        if (Lexicon().TryGetValue(w, out var pinned)) return WithStress(pinned, w);
        if (Rcrl().TryGetValue(w, out var dict)) return WithStress(dict, w);
        var oov = AfrikaansRuleReserved(w) ? null : oovOverride?.Invoke(w);
        if (oov is not null && oov != "") return WithStress(oov, w);
        return PhonemizeWordRules(w);
    }

    /** The RULE ENGINE ALONE — no proper-noun lexicon. */
    public static string PhonemizeWordRules(string word)
    {
        var w = Js.ToLowerCase(word.Normalize(NormalizationForm.FormC));
        if (w == "'n" || w == "’n") return "ə"; // the indefinite article ⟨'n⟩ = [ə]
        string? spelled = Js.CodePoints(w).Count == 1 && LETTER_NAME.TryGetValue(w, out var ln) ? ln : null;
        if (spelled is not null) return PhonemizeMorpheme(spelled);
        var d = Morphology.Decompose(w);
        if (d.Parts.Count <= 1) return PhonemizeMorpheme(w);
        var parts = d.Parts.Select((p, idx) => (
            Ipa: d.Kinds[idx] == Kind.Prefix && idx < d.StressPart
                ? (PREFIX_IPA.TryGetValue(p, out var pi) ? pi : PhonemizeMorpheme(p, true, false))
                : PhonemizeMorpheme(p, !RESYLLABIFY.Contains(idx + 1 < d.Parts.Count ? d.Parts[idx + 1] : ""), idx == d.StressPart),
            Src: p)).ToList();
        return JoinSeams(parts);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(['’]?\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*(?:['’]\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)*)|(\\d+\\.\\d+|[1-9]\\d{0,2}(?:,\\d{3})+|\\d+)|([.!?…,;:])",
        "gu");

    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ Declaring `Multiply` HERE is what makes ASCII `x` read like `×`: otherwise `6x6 cm` reads the x as
        // a LETTER NAME, and `NxN` is the commoner written form. ⚠ ONE SOURCE with SignWords.Times — `6 × 6`
        // goes through Normalize.cs and `6x6 cm` through this tier, and they must read the same word.
        Multiply = new MultiplyDef { Times = Manifest.MANIFEST.SignWords.Times },
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        RateDenominators = Manifest.MANIFEST.SymbolTier.RateDenominators,
        UnitPer = Manifest.MANIFEST.SymbolTier.UnitPer,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
    });

    public string Text(string input) => Text(input, null);

    public string Text(string input, OovResolver? oovOverride)
    {
        return Clauses.AssembleClauses(
            Normalize.NormalizeAfrikaansInitialisms(SYMBOLS(Normalize.NormalizeAfrikaans(input))), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value, oovOverride));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = COMMAS.Replace(m.Groups[2].Value, "").Split('.');
                    var intPart = bits[0];
                    string? frac = bits.Length > 1 ? bits[1] : null;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' ')) sink.Emit(PhonemizeWord(wd));
                    if (frac is not null)
                    {
                        sink.Emit(PhonemizeWord(Manifest.MANIFEST.DecimalWord));
                        foreach (var d in frac)
                            foreach (var wd in Numbers.NumberToWords(Js.Number(d.ToString())).Split(' ')) sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
    }

    /** Build the Afrikaans phonemizer (greedy g2p + open/closed vowel length + final devoicing). */
    public static AfrikaansPhonemizer CreateAfrikaans() => new();

    internal static void RegisterSelf() => Registry.Register("afrikaans", () => CreateAfrikaans());
}
