/**
 * German (de) phonemizer — Standard German, canonical IPA. Rule-based g2p (g2p.ts) with
 * mostly-Germanic stress: the first syllable, or the first syllable after an unstressed prefix (be-/ge-/ver-…);
 * a stress lexicon (stress.tsv, from kaikki) overrides loanwords/exceptions. text() tokenizes words / numbers /
 * punctuation.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public static class GermanPhonemizer
{
    // Stress dictionary: word → 0-based ordinal of the stressed syllable nucleus (loanwords / exceptions).
    private static Dictionary<string, double>? STRESS;
    private static Dictionary<string, double> StressDict() =>
        STRESS ??= LoadTsv.LoadTsvMapV<double>("languages/german", "stress.tsv", (v, _) => Js.Number(v), optional: true);

    /** Rule stress for a word the morphology kept WHOLE (a single root) — the first syllable. Real prefixes are
     *  extracted by decompose() upstream, so no prefix guessing is needed here. */
    private static int RuleStress() => 0;

    // Stressed-vowel length corrections (word → L long / S short) where the spelling rule mispredicts. From kaikki.
    private static Dictionary<string, string>? LENGTH;
    private static Dictionary<string, string> LengthDict() =>
        LENGTH ??= LoadTsv.LoadTsvMap("languages/german", "length.tsv", optional: true);

    // Unstressed vowel QUALITY corrections (word → ordinal+target,…) — lexical (native reduces/keeps-lax vs loanword
    // keeps-tense), from kaikki. Subsumes the earlier e→ə reduction lexicon with lax→tense targets (ɪ→i, ɔ→o, …).
    private static Dictionary<string, string>? QUALITY;
    private static Dictionary<string, string> QualityDict() =>
        QUALITY ??= LoadTsv.LoadTsvMap("languages/german", "quality.tsv", optional: true);

    // Loanword CONSONANT corrections (word → cons-ordinal+target,…) — lexical native-vs-loan splits (v→f/f→v,
    // s→z/z→s, x→ç/k, ŋ→n), from kaikki. Companion to the vowel quality lexicon.
    private static Dictionary<string, string>? CONSONANT;
    private static Dictionary<string, string> ConsonantDict() =>
        CONSONANT ??= LoadTsv.LoadTsvMap("languages/german", "consonant.tsv", optional: true);

    // Ɛ = the g2p's internal marker for short ⟨ä⟩ (see g2p.ts): it lengthens to ɛː (not the eː that ⟨e⟩'s ɛ gives),
    // and applyLength normalises any surviving Ɛ back to plain ɛ. It must count as a vowel nucleus everywhere upstream.
    // Loanword -er RESTORATION (word → nucleus-ordinal,…) — the unstressed ⟨er⟩ that stays the full ɛʁ in loans
    // (universal → univɛʁzaːl) instead of our native reduction ɐ; from kaikki. Can't live in the vowel/consonant
    // lexicons — it INSERTS a consonant (ɐ → ɛ + ʁ). Applied as a post-pass (after applyConsonant, so ordinals hold).
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
     *  IPA, counting syllable nuclei (a vowel not followed by an offglide ̯), applying the flag at each ordinal. */
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
            // a TRUE diphthong (vowel + ɪ̯/ʊ̯/ʏ̯ glide) has no length axis; a vowel + ɐ̯ (vocalized r) still can (eːɐ̯).
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

    /** Set the flagged UNSTRESSED nuclei to their kaikki quality ("1ə,2i" = nucleus 1 → ə, nucleus 2 → i). German
     *  unstressed vowel quality is LEXICAL (native reduce/lax vs loanword tense), so the targets come from a
     *  kaikki-derived lexicon, not a rule. Never touches the stressed nucleus (guarded by the preceding ˈ). Runs
     *  after applyLength (the target quality drops any length). */
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
        // ⚠ THE TARGET IS NOT ONE CHARACTER. `c.slice(-1)` cannot express an affricate, and `k → t͡s` is a real
        // correction this table carries (Celsius, circa, Calcium — the ⟨c⟩-before-a-front-vowel loans). Ordinal,
        // then everything after it. Single-character entries parse identically, so no existing row moves.
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
            // a vocalised coda-r ɐ̯ holds ONE consonant slot (matches the build's counting) but is never corrected.
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

    /** German has no stressed schwa: a ˈə/ˌə is the g2p weak-schwa rule ("final-syllable e → ə") mis-firing on what
     *  turned out to be the STRESSED root syllable (gesetz → the setz e; the g2p runs before stress and can't see it).
     *  Restore it to short ɛ — applyLength then lengthens to eː where the length lexicon flags that nucleus long
     *  (Problem → …bleːm, System → …teːm). Must run BEFORE applyLength. */
    private static string FixStressedSchwa(string ipa) => STRESSED_SCHWA.Replace(ipa, "$1ɛ");

    /** A -ie/-ien suffix the g2p rendered i̯ə but that turned out to carry primary stress is a final-stressed loan
     *  (Melodie → melodˈiː, not …di̯ˈə): restore the stressed glide+schwa back to iː. Runs last (after stress). */
    private static string RestoreStressedIe(string ipa) =>
        // the schwa is already ɛ here (fixStressedSchwa ran first on the stressed nucleus), so match either.
        STRESSED_IE.Replace(ipa, "$1iː");

    /** Restore an UNSTRESSED reduced -er (bare ɐ) to the full loanword ɛʁ at the kaikki-flagged nuclei (universal →
     *  univɛʁzaːl). Post-pass — runs after applyConsonant so the inserted ʁ doesn't shift consonant ordinals. The
     *  stressed case is the restoreStressedEr rule; this is the lexical unstressed native(ɐ)-vs-loan(ɛʁ) split. */
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
     *  ending, Wasser → vasɐ), but that nucleus can never legitimately carry stress — a stressed -er is the full ɛʁ
     *  (Laterne → latɛʁnə, Inferno → ɪnfɛʁno, modern → modɛʁn). Restore ˈɐ/ˌɐ (not the ɐ̯ offglide) to ɛʁ. Runs last. */
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

    /** Compose an OOV compound morpheme-by-morpheme, each stem corrected by its OWN morpheme-keyed dict entry with LOCAL
     *  ordinals — so the length/quality/consonant/er corrections generalize to compounds ABSENT from the whole-word dicts
     *  (Kanzler, Haus, freundlich… are standalone kaikki entries even when the whole compound is not). Re-normalised to a
     *  single primary stress at the stress-part morpheme. Holdout-measured +7.7pp vs the no-correction fallback on OOV
     *  compounds. */
    private static string ComposeMorphemeKeyed(List<Morph> merged, int stressPart)
    {
        var pieces = merged.Select(m =>
        {
            if (m.Kind == Kind.Prefix && Morphology.PREFIX_IPA.TryGetValue(m.Text, out var pi) && pi.Length > 0) return pi;
            if (m.Kind == Kind.Suffix && Morphology.SUFFIX_IPA.TryGetValue(m.Text, out var si) && si.Length > 0) return si;
            return PhonemizeWord(m.Text); // recurse: each stem gets the FULL pipeline (its own dicts + prefix reduction)
        }).ToList();
        // Collapse the per-morpheme stress marks to ONE primary at the stress-part morpheme (German emits a single ˈ).
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
     *  so each stem is element-initial (sp/st→ʃ), devoices at its own boundary, and doesn't assimilate across it. */
    public static string PhonemizeWord(string word)
    {
        var w = word.ToLowerInvariant();
        var d = Morphology.Decompose(w);
        // Vowel-initial suffixes resyllabify onto the stem (lieb+en → lie-ben, häus+er → häu-ser): NO boundary, NO
        // devoicing. Merge them back into the preceding stem so it is g2p'd together; consonant-initial suffixes
        // (lich, keit, chen…) keep their boundary (freund+lich → freunt-lich).
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
            // HYBRID: a word with ANY whole-word correction (in-kaikki) uses its exact whole-word entry (unchanged); an
            // OOV compound — absent from every dict — falls back to MORPHEME-KEYED corrections that compose per stem.
            // Known words are byte-identical; only novel compounds change.
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
            // stress: the kaikki lexicon ordinal if known, else the morphology stress part's first vowel.
            var dictOrd0 = StressDict().TryGetValue(w, out var so0) ? (int?)(int)so0 : null;
            var ord0 = dictOrd0 ?? CountNuclei(string.Concat(pieces.Take(d.StressPart)));
            return RestoreStressedEr(RestoreStressedIe(ApplyConsonant(ApplyErRestore(ApplyQuality(ApplyLength(FixStressedSchwa(PlaceStress(full, ord0)), LengthDict().GetValueOrDefault(w)), QualityDict().GetValueOrDefault(w)), ErDict().GetValueOrDefault(w)), ConsonantDict().GetValueOrDefault(w))));
        }

        var segs = G2p.ToSegments(w);
        var vowelIdx = segs.Select((s, i) => s.Vowel ? i : -1).Where(i => i >= 0).ToList();
        if (vowelIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        // Dict stress, extended to INFLECTED forms: the 68k dict stores lemmas, so bedeutet/genutzten/behörden
        // missed while bedeuten/genutzt/behörde carry the answer. Suffix stripping cannot shift the ordinal —
        // an inflectional ending never adds a nucleus BEFORE the stress. This also protects roots: beiden finds
        // beide (ord 0) and stays unreduced.
        var dictOrd = StressDict().TryGetValue(w, out var so) ? (int?)(int)so : InflectedStressOrd(w);
        // Dict-missing prefix fallback (gegangen, gebracht — ablaut participles have no lemma the stripper can
        // reach): a word STARTING with an unstressed prefix whose remainder looks like a stem (legal onset,
        // its own vowel) is read as prefix + stem. Safe because any common ROOT is in the 68k dict and roots
        // resolve above; this only fires on derived forms the dict has never seen.
        var prefixGuess = dictOrd is null && GuessUnstressedPrefix(w);
        var ord = dictOrd ?? (prefixGuess ? 1 : RuleStress());
        var stressPos = vowelIdx[Math.Min(ord, vowelIdx.Count - 1)];

        // An undecomposed be-/ge-/ver-… word whose stress isn't on the first syllable has a real unstressed
        // prefix (bestimmt ord 1 → bə), whereas a be-/ge- ROOT is dict-stressed on the first (beiden ord 0 → no ə).
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

    // German inflectional endings, longest first. Stripping (and the -et→-en / -t→-en swaps) reaches the lemma
    // the stress dict stores. The base must keep ≥3 letters so short roots don't dissolve.
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

    // The single-nucleus unstressed prefixes (their reduction targets are set in the caller). ver/zer/ent/emp
    // before er, so er never shadows them. The remainder must be ≥4 letters, start with a LEGAL German onset
    // (≤3 consonants then a vowel — rejects be+rlin-style accidents), and contain a vowel of its own.
    private static readonly JsRe PREFIX_GUESS = JsRegex.Compile("^(?:be|ge|ver|zer|ent|emp|er)(?=([a-zäöüß]{4,})$)", "");
    private static readonly JsRe LEGAL_ONSET = JsRegex.Compile("^[bcdfghjklmnpqrstvwxzß]{0,3}[aeiouäöüy]", "");

    private static bool GuessUnstressedPrefix(string w)
    {
        var m = PREFIX_GUESS.Match(w);
        return m.Success && LEGAL_ONSET.IsMatch(m.Groups[1].Value);
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // German groups thousands with a PERIOD and takes a COMMA decimal. The old class accepted either as a
    // decimal, so "1.000" read as *eins komma null null null*. Times are claimed by normalize.ts first, so a
    // dot reaching here is grouping.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d{{1,3}}(?:\\.\\d{{3}})+|\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
     * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
     * core/hostWord.ts.
     */
    private const string NATIVE_CLASS = "[a-zäöüßA-ZÄÖÜ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe GROUPING_DOT = JsRegex.Compile("\\.", "gu");

    // German measure and currency words are INVARIANT plurals (Prozent, Euro, Kilometer).
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ The tier spaces `und` on both sides, because `B&B` is two initialisms and joining them would make one
        // token.
        // ⚠ `multiply` is STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the
        // operator returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it —
        // German does not split dimension from product.
        Multiply = new MultiplyDef { Times = "mal" },
        Ampersand = "und",
        Percent = new[] { "Prozent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "Euro" }, ["$"] = new[] { "Dollar" }, ["£"] = new[] { "Pfund" }, ["¥"] = new[] { "Yen" },
        },
        // `m` is declared because a digit-adjacent bare `m` in German is a metre (`4892 m Höhe`, `133 m/s`).
        // ⚠ Without it `Kubik`/`Quadrat` below cannot reach a bare metre, so `5 m³` reads as the raw letter while
        // `5 km³` reads correctly.
        // ⚠ ⟨g⟩ ⟨ha⟩ ⟨l⟩ ⟨L⟩ WERE NOT LEAKING, THEY WERE MIS-READING — the class `tools/normalization/misread.ts`
        // exists to see. `10 ha` read *t͡seːn haː*, which is a German interjection; `10 g` read as the letter.
        // Nothing in the tree could flag either, because neither the ASCII nor a DROP survives into the IPA.
        // Each word is definitional on de.wikipedia and each names its own symbol:
        //   Gramm  176/17  "Ein Gramm ist eine physikalische Einheit für die Masse, sein EINHEITENZEICHEN IST G"
        //   Hektar 356/20  "Das oder der Hektar … ist eine Maßeinheit der Fläche … in Deutschland, Österreich
        //                   und der Schweiz eine gesetzliche Einheit"
        //   Liter  468/18  "Der … Liter ist eine Einheit für das Volumen … mit \mathrm{L} symbolisiert"
        // ⚠ ⟨l⟩ AND ⟨L⟩ BOTH, the litre's documented exception to the one-letter rule (`resolveUnitSymbol`).
        // ⚠ THE ONE-LETTER KEYS MEASURED, not assumed (trap 46), and measured against the shape the tier will
        // actually build — a number, an optional MAGNITUDE, then the key. Over the artifact `<digit> g` is ×1
        // and it is `802.11g`, a Wi-Fi standard, which `NOT_VERSION` already rejects; `<digit> l` and
        // `<digit> L` are ×0. German's magnitudes are `Million(en)`/`Milliarde(n)` and none of them ends in a
        // unit letter, so the ligature trap that refused Tagalog's ⟨g⟩ does not arise here.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "Kilometer" }, ["cm"] = new[] { "Zentimeter" }, ["mm"] = new[] { "Millimeter" },
            ["kg"] = new[] { "Kilogramm" }, ["mg"] = new[] { "Milligramm" },
            ["m"] = new[] { "Meter" }, ["g"] = new[] { "Gramm" }, ["ha"] = new[] { "Hektar" },
            ["l"] = new[] { "Liter" }, ["L"] = new[] { "Liter" },
        },
        // ⚠ AN UNDECLARED MEASURE WORD MAKES THE TIER ABANDON THE WHOLE MATCH, so `5 km²` reads as *fʏnf km* —
        // the abbreviation reaching the phoneme sink verbatim and the QUANTITY lost, not merely its power.
        // German FUSES the measure word onto the front, which is `compound`: *Quadratkilometer*, *Kubikmeter*.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "Quadrat" }, Cubed = new[] { "Kubik" }, Position = "compound",
        },
        // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`).
        // ⚠ THIS CANNOT REUSE `exponentWords` ABOVE: that is the unit MODIFIER and this is the PREDICATE, and in
        // most languages they are different words — Quadratkilometer, but zwanzig zum Quadrat.
        // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
        // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
        // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
        // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
        // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
        // The cardinal is used for the generic power, never the ordinal — see core for that argument.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} zum Quadrat", Cubed = "{n} hoch drei", Power = "{n} hoch {e}", Negative = "minus",
        },
        Magnitudes = new[] { "Millionen", "Million", "Milliarden", "Milliarde" },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ORDER: German rewrites (era, abbreviations, ORDINALS, clock, units) → INITIALISMS →
            // the shared symbol tier → YEARS. The clock and the ordinals must precede the number tokenizer.
            // ⚠ YEARS RUN LAST, after every symbol rule. Those rules are keyed on a digit beside the symbol,
            // so rewriting a year's digits to words first leaves `%`, `°`, `€`, `$` and `×` with nothing to
            // attach to and they vanish from the output — `1500 €` read as *fünfzehnhundert*.
            var normalized = Normalize.NormalizeGermanYears(
                SYMBOLS(Normalize.NormalizeGermanInitialisms(Normalize.NormalizeGerman(input))));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // The PERIOD is thousands grouping in German and the COMMA is the decimal point. Splitting
                    // on either made "1.000" a decimal — *eins komma null null null*.
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
