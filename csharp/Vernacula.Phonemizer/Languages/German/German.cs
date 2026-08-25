/**
 * German (de) phonemizer — Standard German, canonical IPA.
 * Ported from src/languages/german/german.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public static class GermanPhonemizer
{
    private static Dictionary<string, double>? STRESS;
    private static Dictionary<string, double> StressDict() =>
        STRESS ??= LoadTsv.LoadTsvMapV<double>("languages/german", "stress.tsv", (v, _) => Js.Number(v), optional: true);

    /** Rule stress for a word the morphology kept WHOLE (a single root) — the first syllable. Real prefixes are
     *  extracted by decompose() upstream, so no prefix guessing is needed here. */
    private static int RuleStress() => 0;

    private static Dictionary<string, string>? LENGTH;
    private static Dictionary<string, string> LengthDict() =>
        LENGTH ??= LoadTsv.LoadTsvMap("languages/german", "length.tsv", optional: true);

    private static Dictionary<string, string>? QUALITY;
    private static Dictionary<string, string> QualityDict() =>
        QUALITY ??= LoadTsv.LoadTsvMap("languages/german", "quality.tsv", optional: true);

    private static Dictionary<string, string>? CONSONANT;
    private static Dictionary<string, string> ConsonantDict() =>
        CONSONANT ??= LoadTsv.LoadTsvMap("languages/german", "consonant.tsv", optional: true);

    private static Dictionary<string, string>? ER;
    private static Dictionary<string, string> ErDict() =>
        ER ??= LoadTsv.LoadTsvMap("languages/german", "er.tsv", optional: true);

    private static readonly IReadOnlyDictionary<string, string> LONG_OF =
        Manifest.MANIFEST.Vowels.LongOf.Concat(new[] { new KeyValuePair<string, string>("Ɛ", "ɛː") })
            .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> SHORT_OF => Manifest.MANIFEST.Vowels.ShortOf;
    private static readonly string VOWEL_CHARS = Manifest.MANIFEST.VowelChars + "Ɛ";

    private static readonly JsRe SHORT_AE = JsRegex.Compile("Ɛ", "gu");
    private static readonly JsRe STRESS_MARK_END = JsRegex.Compile("[ˈˌ]$", "");

    /** Fix vowel length+quality per a positional correction spec ("0S,2L" = nucleus 0 short, 2 long). Walks the
     *  IPA, counting syllable nuclei (a vowel not followed by an offglide ̯), applying the flag at each
     *  ordinal. */
    private static string ApplyLength(string ipa, string? spec)
    {
        if (string.IsNullOrEmpty(spec)) return SHORT_AE.Replace(ipa, "ɛ"); // no length flag: a short-ä marker just normalises to ɛ (hätte)
        var corr = new Dictionary<int, string>();
        foreach (var c in spec.Split(','))
            if (c.Length > 0)
                corr[(int)Js.Number(c[..^1])] = c[^1..];
        var @out = "";
        int ord = 0, i = 0;
        while (i < ipa.Length)
        {
            var ch = ipa[i].ToString();
            if (!VOWEL_CHARS.Contains(ch, StringComparison.Ordinal)) { @out += ch; i++; continue; }
            if (At(ipa, i + 1) == "̯") { @out += ch; i++; continue; } // offglide, not a nucleus
            var @long = At(ipa, i + 1) == "ː";
            var diphthong = "ɪʊʏ".Contains(At(ipa, i + 1), StringComparison.Ordinal) && At(ipa, i + 2) == "̯";
            var flag = corr.GetValueOrDefault(ord);
            if (!diphthong && flag == "L" && !@long)
            {
                @out += LONG_OF.GetValueOrDefault(ch) ?? ch;
                i++;
            }
            else if (!diphthong && flag == "S" && @long)
            {
                @out += SHORT_OF.GetValueOrDefault(ch) ?? ch;
                i += 2;
            }
            else
            {
                @out += @long ? ch + "ː" : ch;
                i += @long ? 2 : 1;
            }
            ord++;
        }
        return SHORT_AE.Replace(@out, "ɛ"); // normalise any short-ä marker that wasn't lengthened (ɛː done above)
    }

    private static string At(string s, int k) => k >= 0 && k < s.Length ? s[k].ToString() : "";

    /** Set the flagged UNSTRESSED nuclei to their kaikki quality ("1ə,2i" = nucleus 1 → ə, nucleus 2 → i). */
    private static string ApplyQuality(string ipa, string? spec)
    {
        if (string.IsNullOrEmpty(spec)) return ipa;
        var corr = new Dictionary<int, string>();
        foreach (var c in spec.Split(','))
            if (c.Length > 0)
                corr[(int)Js.Number(c[..^1])] = c[^1..];
        var @out = "";
        int ord = 0, i = 0;
        while (i < ipa.Length)
        {
            var ch = ipa[i].ToString();
            if (!VOWEL_CHARS.Contains(ch, StringComparison.Ordinal)) { @out += ch; i++; continue; }
            if (At(ipa, i + 1) == "̯") { @out += ch; i++; continue; } // offglide, not a nucleus
            var @long = At(ipa, i + 1) == "ː";
            var t = corr.GetValueOrDefault(ord);
            if (t is not null && !STRESS_MARK_END.IsMatch(@out))
            {
                @out += t; // set the kaikki quality (drops length); never the stressed vowel
                i += @long ? 2 : 1;
            }
            else
            {
                @out += @long ? ch + "ː" : ch;
                i += @long ? 2 : 1;
            }
            ord++;
        }
        return @out;
    }

    private static readonly JsRe CONS_SPEC = JsRegex.Compile("^(\\d+)(.+)$", "u");

    /** Set flagged CONSONANT positions to their kaikki (loanword) value ("0v,3s"). A "consonant" is a char that is
     *  not a vowel / stress-boundary / length / combining mark (must match the build's counting). Lexical
     *  native-vs-loan splits (November → …v…, Safe → s…), from a kaikki-derived lexicon. */
    private static string ApplyConsonant(string ipa, string? spec)
    {
        if (string.IsNullOrEmpty(spec)) return ipa;
        var corr = new Dictionary<int, string>();
        foreach (var c in spec.Split(','))
        {
            var m = CONS_SPEC.Match(c);
            if (m.Success) corr[(int)Js.Number(m.Groups[1].Value)] = m.Groups[2].Value;
        }
        var @out = "";
        var ci = 0;
        for (var i = 0; i < ipa.Length; i++)
        {
            var ch = ipa[i].ToString();
            if (ch == "ɐ" && At(ipa, i + 1) == "̯")
            {
                @out += corr.GetValueOrDefault(ci) ?? "ɐ̯";
                ci++;
                i++; // consume the ̯
                continue;
            }
            if (!VOWEL_CHARS.Contains(ch, StringComparison.Ordinal) && !"ˈˌʔ()ː̯̩̥͡".Contains(ch, StringComparison.Ordinal))
            {
                @out += corr.GetValueOrDefault(ci) ?? ch;
                ci++;
            }
            else @out += ch;
        }
        return @out;
    }

    private static readonly JsRe STRESSED_SCHWA = JsRegex.Compile("([ˈˌ])ə", "gu");
    private static readonly JsRe STRESSED_IE = JsRegex.Compile("i̯([ˈˌ])[əɛ]", "gu");
    private static readonly JsRe STRESSED_ER = JsRegex.Compile("([ˈˌ])ɐ(?!̯)", "gu");

    /**
     * German has no stressed schwa: a ˈə/ˌə is the g2p weak-schwa rule ("final-syllable e → ə") mis-firing on
     * the STRESSED root syllable — the g2p runs before stress and cannot see it. Restored to short ɛ; ⚠ must
     * run BEFORE ApplyLength, which then lengthens it where the length lexicon flags that nucleus long.
     */
    private static string FixStressedSchwa(string ipa) => STRESSED_SCHWA.Replace(ipa, "$1ɛ");

    /** A -ie/-ien suffix the g2p rendered i̯ə but that turned out to carry primary stress is a final-stressed loan
     *  (Melodie → melodˈiː, not …di̯ˈə): restore the stressed glide+schwa back to iː. ⚠ Runs last, after
     *  stress; the schwa is already ɛ by then (FixStressedSchwa ran first), so the pattern matches either. */
    private static string RestoreStressedIe(string ipa) =>
        STRESSED_IE.Replace(ipa, "$1iː");

    /** Restore an UNSTRESSED reduced -er (bare ɐ) to the full loanword ɛʁ at the kaikki-flagged nuclei (universal →
     *  univɛʁzaːl). ⚠ Post-pass — runs after ApplyConsonant so the inserted ʁ does not shift consonant
     *  ordinals. The stressed case is RestoreStressedEr; this is the unstressed native(ɐ)-vs-loan(ɛʁ) split. */
    private static string ApplyErRestore(string ipa, string? spec)
    {
        if (string.IsNullOrEmpty(spec)) return ipa;
        var corr = new HashSet<int>(spec.Split(',').Select(x => (int)Js.Number(x)));
        var @out = "";
        int ord = 0, i = 0;
        while (i < ipa.Length)
        {
            var ch = ipa[i].ToString();
            if (!VOWEL_CHARS.Contains(ch, StringComparison.Ordinal) || At(ipa, i + 1) == "̯")
            {
                @out += ch; // consonant, or an offglide (incl. ɐ̯) which is not a nucleus
                i++;
                continue;
            }
            if (corr.Contains(ord) && ch == "ɐ")
            {
                @out += "ɛʁ";
                i++;
            }
            else
            {
                var @long = At(ipa, i + 1) == "ː";
                @out += @long ? ch + "ː" : ch;
                i += @long ? 2 : 1;
            }
            ord++;
        }
        return @out;
    }

    /** A STRESSED bare ɐ is always a wrongly-reduced -er: our g2p reduces ⟨er⟩+C to ɐ (correct for the unstressed
     *  ending, Wasser → vasɐ), but that nucleus can never legitimately carry stress — a stressed -er is the
     *  full ɛʁ (Laterne → latɛʁnə, modern → modɛʁn). Restore ˈɐ/ˌɐ (not the ɐ̯ offglide) to ɛʁ. Runs last. */
    private static string RestoreStressedEr(string ipa) => STRESSED_ER.Replace(ipa, "$1ɛʁ");

    private static readonly JsRe VOWEL_G = JsRegex.Compile("[aɐeɛiɪoɔuʊøœyʏəƐ]", "g"); // includes the short-ä marker Ɛ so stress/nucleus counts see it

    /** Count syllable nuclei (vowels, skipping non-syllabic offglides ̯) in an IPA string. */
    private static int CountNuclei(string ipa)
    {
        var n = 0;
        foreach (Match m in VOWEL_G.Matches(ipa))
            if (At(ipa, m.Index + 1) != "̯")
                n++;
        return n;
    }

    /** Insert ˈ before the ordinal-th nucleus of an IPA string (skipping non-syllabic offglides ̯). */
    private static string PlaceStress(string ipa, int ordinal)
    {
        var n = 0;
        foreach (Match m in VOWEL_G.Matches(ipa))
        {
            if (At(ipa, m.Index + 1) == "̯") continue; // offglide, not a nucleus
            if (n == ordinal) return ipa[..m.Index] + "ˈ" + ipa[m.Index..];
            n++;
        }
        return ipa;
    }

    private sealed class Morph
    {
        public required string Text;
        public required Kind Kind;
    }

    private static readonly JsRe STRESS_MARKS = JsRegex.Compile("[ˈˌ]", "gu");
    private static readonly JsRe STRESS_MARK_ONE = JsRegex.Compile("[ˈˌ]", "u");

    /**
     * Compose an OOV compound morpheme-by-morpheme, each stem corrected by its OWN morpheme-keyed dict entry
     * with LOCAL ordinals, so the corrections generalize to compounds absent from the whole-word dicts.
     * Re-normalised to a single primary stress at the stress-part morpheme.
     */
    private static string ComposeMorphemeKeyed(List<Morph> merged, int stressPart)
    {
        var pieces = merged.Select(m =>
        {
            if (m.Kind == Kind.Prefix && Morphology.PREFIX_IPA.TryGetValue(m.Text, out var pi) && pi.Length > 0) return pi;
            if (m.Kind == Kind.Suffix && Morphology.SUFFIX_IPA.TryGetValue(m.Text, out var si) && si.Length > 0) return si;
            return PhonemizeWord(m.Text); // recurse: each stem gets the FULL pipeline (its own dicts + prefix reduction)
        }).ToList();
        var sp = Math.Min(stressPart, pieces.Count - 1);
        var before = STRESS_MARKS.Replace(string.Concat(pieces.Take(sp)), "");
        var spPiece = sp >= 0 && sp < pieces.Count ? pieces[sp] : "";
        var mk = STRESS_MARK_ONE.Match(spPiece);
        var markIdx = mk.Success ? mk.Index : -1;
        var localOrd = markIdx < 0 ? 0 : CountNuclei(spPiece[..markIdx]);
        return PlaceStress(STRESS_MARKS.Replace(string.Concat(pieces), ""), CountNuclei(before) + localOrd);
    }

    private static readonly IReadOnlySet<string> VINIT_SUFFIX =
        new HashSet<string>(Manifest.MANIFEST.Morphology.VowelInitialSuffixes, StringComparer.Ordinal);
    private static readonly JsRe PREFIX_REDUCE_E = JsRegex.Compile("^(ver|zer|ent|emp|er)", "");

    /** One German word → canonical IPA. Words that decompose into ≥2 morphemes are composed morpheme-by-morpheme,
     *  so each stem is element-initial (sp/st→ʃ), devoices at its own boundary, and does not assimilate
     *  across it. */
    public static string PhonemizeWord(string word)
    {
        var w = word.ToLowerInvariant();
        var d = Morphology.Decompose(w);
        var merged = new List<Morph>();
        for (var i = 0; i < d.Parts.Count; i++)
        {
            var p = d.Parts[i];
            var k = d.Kinds[i];
            var last = merged.Count > 0 ? merged[^1] : null;
            if (k == Kind.Suffix && VINIT_SUFFIX.Contains(p) && last is not null && last.Kind == Kind.Stem)
                last.Text += p;
            else merged.Add(new Morph { Text = p, Kind = k });
        }
        if (merged.Count > 1)
        {
            var known = StressDict().ContainsKey(w) || LengthDict().ContainsKey(w) || QualityDict().ContainsKey(w)
                        || ConsonantDict().ContainsKey(w) || ErDict().ContainsKey(w);
            if (!known) return ComposeMorphemeKeyed(merged, d.StressPart);
            var pieces = merged.Select(m =>
            {
                if (m.Kind == Kind.Prefix && Morphology.PREFIX_IPA.TryGetValue(m.Text, out var pi) && pi.Length > 0) return pi;
                if (m.Kind == Kind.Suffix && Morphology.SUFFIX_IPA.TryGetValue(m.Text, out var si) && si.Length > 0) return si;
                return string.Concat(G2p.ToSegments(m.Text).Select(s => s.Ph)); // stem: element-initial g2p (i===0 inside)
            }).ToList();
            var full = string.Concat(pieces);
            var dictOrd0 = StressDict().TryGetValue(w, out var so0) ? (int?)(int)so0 : null;
            var ord0 = dictOrd0 ?? CountNuclei(string.Concat(pieces.Take(d.StressPart)));
            return RestoreStressedEr(RestoreStressedIe(ApplyConsonant(ApplyErRestore(ApplyQuality(ApplyLength(FixStressedSchwa(PlaceStress(full, ord0)), LengthDict().GetValueOrDefault(w)), QualityDict().GetValueOrDefault(w)), ErDict().GetValueOrDefault(w)), ConsonantDict().GetValueOrDefault(w))));
        }

        var segs = G2p.ToSegments(w);
        var vowelIdx = segs.Select((s, i) => s.Vowel ? i : -1).Where(i => i >= 0).ToList();
        if (vowelIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var dictOrd = StressDict().TryGetValue(w, out var so) ? (int?)(int)so : InflectedStressOrd(w);
        var prefixGuess = dictOrd is null && GuessUnstressedPrefix(w);
        var ord = dictOrd ?? (prefixGuess ? 1 : RuleStress());
        var stressPos = vowelIdx[Math.Min(ord, vowelIdx.Count - 1)];

        if ((dictOrd is not null || prefixGuess) && ord > 0)
        {
            var first = segs[vowelIdx[0]];
            if (w.StartsWith("be", StringComparison.Ordinal) || w.StartsWith("ge", StringComparison.Ordinal)) first.Ph = "ə";
            else if (PREFIX_REDUCE_E.IsMatch(w)) first.Ph = "ɛ";
        }

        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressPos && vowelIdx.Count > 1) @out += "ˈ";
            @out += segs[i].Ph;
        }
        return RestoreStressedEr(RestoreStressedIe(ApplyConsonant(ApplyErRestore(ApplyQuality(ApplyLength(FixStressedSchwa(@out), LengthDict().GetValueOrDefault(w)), QualityDict().GetValueOrDefault(w)), ErDict().GetValueOrDefault(w)), ConsonantDict().GetValueOrDefault(w))));
    }

    private static readonly string[] INFLECT =
        { "esten", "sten", "eten", "ten", "est", "en", "et", "em", "es", "er", "e", "n", "st", "t", "s" };

    private static int? InflectedStressOrd(string w)
    {
        var dict = StressDict();
        foreach (var suf in INFLECT)
        {
            if (!w.EndsWith(suf, StringComparison.Ordinal) || w.Length - suf.Length < 3) continue;
            var b = w[..^suf.Length];
            if (dict.TryGetValue(b, out var h1)) return (int)h1;
            if (dict.TryGetValue(b + "e", out var h2)) return (int)h2;
            if (dict.TryGetValue(b + "en", out var h3)) return (int)h3;
        }
        return null;
    }

    private static readonly JsRe PREFIX_GUESS = JsRegex.Compile("^(?:be|ge|ver|zer|ent|emp|er)(?=([a-zäöüß]{4,})$)", "");
    private static readonly JsRe LEGAL_ONSET = JsRegex.Compile("^[bcdfghjklmnpqrstvwxzß]{0,3}[aeiouäöüy]", "");

    private static bool GuessUnstressedPrefix(string w)
    {
        var m = PREFIX_GUESS.Match(w);
        return m.Success && LEGAL_ONSET.IsMatch(m.Groups[1].Value);
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d{{1,3}}(?:\\.\\d{{3}})+|\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zäöüßA-ZÄÖÜ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe GROUPING_DOT = JsRegex.Compile("\\.", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "mal" },
        Ampersand = "und",
        Percent = Manifest.MANIFEST.Symbols.Percent,
        Currency = Manifest.MANIFEST.Symbols.Currency,
        Units = Manifest.MANIFEST.Symbols.Units,
        ExponentWords = Manifest.MANIFEST.Symbols.ExponentWords,
        BareExponent = Manifest.MANIFEST.Symbols.BareExponent,
        Magnitudes = Manifest.MANIFEST.Symbols.Magnitudes,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            var normalized = Normalize.NormalizeGermanYears(
                SYMBOLS(Normalize.NormalizeGermanInitialisms(Normalize.NormalizeGerman(input))));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var split = GROUPING_DOT.Replace(m.Groups[2].Value, "").Split(',');
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(intPart)).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                    if (frac is not null)
                    {
                        sink.Emit(PhonemizeWord("Komma"));
                        foreach (var dch in frac)
                            foreach (var wd in Numbers.NumberToWords(Js.Number(dch.ToString())).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the German phonemizer (rule g2p + stress rules + a loanword stress lexicon). */
    public static ILanguage CreateGerman() => new Engine();

    internal static void RegisterSelf() => Registry.Register("german", () => CreateGerman());
}
