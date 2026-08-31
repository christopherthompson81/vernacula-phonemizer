/**
 * Scottish Gaelic / Gàidhlig (gd) phonemizer — Goidelic Celtic (sibling of Irish), canonical IPA.
 * A rule-based grapheme scan on the BROAD/SLENDER axis ("caol le caol": a consonant is velarized
 * [Cˠ]/dental next to a/o/u, palatalized [Cʲ] next to e/i), with the Scottish hallmarks: PRE-ASPIRATION
 * (medial/final fortis ⟨p t c⟩ → [hp ht̪ xk]; word-initial → the aspirated [pʰ t̪ʰ kʰ]) and the
 * UNASPIRATED lenis ⟨b d g⟩ → [p t̪ k]. First-syllable stress (native default); unstressed short vowels
 * reduce to [ə]. The data (broad/slender maps, lenition digraphs, vowel clusters) lives in
 * scottishgaelic.jsonc.
 * Ported from src/languages/scottishgaelic/scottishgaelic.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.ScottishGaelic;

/** One scanned segment. Mutable: the pre-aspiration and unstressed-reduction passes rewrite `Ph` in place. */
public sealed class Seg
{
    public required string Ph { get; set; }
    /** Is a vowel nucleus (for stress placement). */
    public required bool Nucleus { get; set; }
}

public sealed class ScottishGaelicPhonemizer : ILanguage
{
    private static readonly ScottishGaelicDef DEF = Manifest.MANIFEST;
    private static readonly string SLENDER_V = DEF.SlenderVowels;
    private static readonly string VOWELS = DEF.SlenderVowels + DEF.BroadVowels;
    private static readonly IReadOnlyDictionary<string, string> BROAD = DEF.Broad;
    private static readonly IReadOnlyDictionary<string, string> SLENDER = DEF.Slender;
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> LENITION = DEF.Lenition;

    /** Longest-first. ⚠ `OrderByDescending` is a STABLE sort, matching JS's `Array.prototype.sort` — equal
     *  lengths keep the manifest's insertion order, which is what decides ⟨aoi⟩ before ⟨ao⟩ and so on. */
    private static readonly IReadOnlyList<string> VOWEL_CLUSTERS =
        DEF.Vowels.Keys.OrderByDescending(k => k.Length).ToList();

    private static bool IsVowel(string c) => c.Length != 0 && VOWELS.Contains(c, StringComparison.Ordinal);
    private static bool IsSlenderV(string c) => c.Length != 0 && SLENDER_V.Contains(c, StringComparison.Ordinal);

    /** `w[i]` with JS's out-of-range answer: `undefined`, which every use here compares as `""`. */
    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /** `w.slice(i, i + len)` — JS clamps; `Substring` throws, so clamp here. */
    private static string Slice(string w, int i, int len) =>
        i >= w.Length ? "" : w.Substring(i, Math.Min(len, w.Length - i));

    /** `w.startsWith(k, i)`. */
    private static bool StartsWithAt(string w, string k, int i) =>
        i + k.Length <= w.Length && string.CompareOrdinal(w, i, k, 0, k.Length) == 0;

    /** Is the consonant at index i SLENDER? Its quality comes from the immediately adjacent vowel letter — the
     *  one right after (onset) else right before (coda); ⟨s⟩ is broad before another consonant; a coda
     *  cluster with no following vowel is broad. */
    private static bool ConsonantSlender(string w, int i)
    {
        if (At(w, i) == "r" && i == 0) return false; // word-initial r → broad
        var nx = At(w, i + 1);
        var pv = At(w, i - 1);
        if (IsVowel(nx)) return IsSlenderV(nx);
        if (IsVowel(pv)) return IsSlenderV(pv);
        if (At(w, i) == "s") return false;
        for (var j = i + 1; j < w.Length; j++)
            if (IsVowel(At(w, j))) return IsSlenderV(At(w, j));
        return false;
    }

    /** Scan a lowercased Scottish Gaelic word into segments (lenition digraphs → broad/slender consonants →
     *  vowel clusters). */
    private static List<Seg> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var n = w.Length;
        var segs = new List<Seg>();
        void Cons(string ph) { if (ph.Length != 0) segs.Add(new Seg { Ph = ph, Nucleus = false }); }
        var i = 0;
        while (i < n)
        {
            var c = At(w, i);
            var two = Slice(w, i, 2);
            // word-final ⟨dh⟩/⟨gh⟩ → silent (the -idh/-adh endings): the exposed nucleus reduces to schwa.
            // ⚠ `segs.Count > 0` is load-bearing: a BARE word-initial digraph must fall through to the
            // lenition branch below (and be resolved there), not be dropped here.
            if ((two == "dh" || two == "gh") && i + 2 == n && segs.Count > 0) { i += 2; continue; }
            // lenition digraphs (séimhichte): bh ch dh fh gh mh ph sh th.
            if (LENITION.TryGetValue(two, out var pair))
            {
                Cons(pair[ConsonantSlender(w, i) ? 1 : 0]);
                i += 2;
                continue;
            }
            // doubled consonant (ll/nn/rr) → a single quality-determined consonant.
            if (c == At(w, i + 1) && !IsVowel(c) && !LENITION.ContainsKey(two))
            {
                var dmap = ConsonantSlender(w, i) ? SLENDER : BROAD;
                if (dmap.TryGetValue(c, out var dbl)) Cons(dbl);
                i += 2;
                continue;
            }
            // vowel clusters (longest-match) → the pronounced nucleus.
            if (IsVowel(c))
            {
                // TS `VOWEL_CLUSTERS.find(...)` — a plain loop over the already longest-first list, so the
                // per-position closure `FirstOrDefault` would allocate on every vowel of every word is gone.
                string? key = null;
                foreach (var k in VOWEL_CLUSTERS) if (StartsWithAt(w, k, i)) { key = k; break; }
                if (key is not null)
                {
                    segs.Add(new Seg { Ph = DEF.Vowels[key], Nucleus = true });
                    i += key.Length;
                    continue;
                }
                segs.Add(new Seg { Ph = c, Nucleus = true });
                i++;
                continue;
            }
            // single consonants: broad or slender.
            var map = ConsonantSlender(w, i) ? SLENDER : BROAD;
            if (map.TryGetValue(c, out var single) && single.Length != 0) Cons(single);
            else if (ASCII_LETTER.IsMatch(c)) Cons(c);
            i++;
        }
        return segs;
    }

    /** TS `/[a-z]/` — no flags, verbatim. */
    private static readonly JsRe ASCII_LETTER = JsRegex.Compile("[a-z]", "");

    /** TS `word.replace(/['’\-]/gu, "")`. ⚠ `JsRe.Replace`, NOT the `Rewrite` seam — the subject is a WORD
     *  the tokenizer handed over, never the pipeline string, so declaring it to the provenance tracker would
     *  report a span against a string it has never seen. */
    private static readonly JsRe ELISION = JsRegex.Compile("['’\\-]", "gu");

    // Fortis stops carry the aspiration mark ʰ from the manifest. Word-INITIALLY they stay aspirated
    // [pʰ t̪ʰ kʰ]; after a vowel/sonorant they PRE-ASPIRATE — the velar to [xk], the SLENDER (palatal) to
    // [ç]+stop, the others to [h]+stop (mac→maxk, cat→kʰaht̪, aice→açkʲ, bhite→viçtʲ); after an obstruent
    // (s) they DE-aspirate (asta→as̪t̪).
    private static readonly IReadOnlyDictionary<string, string> PREASP =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["pʰ"] = "hp", ["t̪ʰ"] = "ht̪", ["tʲʰ"] = "htʲ", ["kʰ"] = "xk", ["kʲʰ"] = "çkʲ",
        };
    private static readonly IReadOnlyDictionary<string, string> DEASP =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["pʰ"] = "p", ["t̪ʰ"] = "t̪", ["tʲʰ"] = "tʲ", ["kʰ"] = "k", ["kʲʰ"] = "kʲ",
        };
    // Sonorant phones after which pre-aspiration is a valid site (plus any vowel nucleus): the LIQUIDS l/r
    // only — NOT the nasals (post-nasal fortis stays plain: annta→an̪t̪ə, cainnt→kaɲtʲ — the fortis
    // de-aspirates there).
    private static readonly IReadOnlySet<string> SONORANT =
        new HashSet<string>(DEF.Sonorants, StringComparer.Ordinal);

    /** PRE-ASPIRATION: a non-initial fortis stop pre-aspirates after a vowel/liquid, else de-aspirates. */
    private static void Preaspirate(List<Seg> segs)
    {
        for (var i = 1; i < segs.Count; i++)
        {
            var ph = segs[i].Ph;
            if (!PREASP.TryGetValue(ph, out var pre)) continue;
            var prev = segs[i - 1];
            var site = prev.Nucleus || SONORANT.Contains(prev.Ph);
            segs[i].Ph = site ? pre : DEASP[ph];
        }
    }

    /** ⟨chd⟩ / ⟨cht⟩ cluster → [xk]: a dental stop right after [x]/[ç] surfaces as [k] (bochd→pɔxk,
     *  luchd→l̪ˠuxk) — the SG ⟨-chd⟩ ending. */
    private static void ChdCluster(List<Seg> segs)
    {
        for (var i = 1; i < segs.Count; i++)
        {
            var prev = segs[i - 1].Ph;
            if ((prev == "x" || prev == "ç") && (segs[i].Ph == "t̪" || segs[i].Ph == "tʲ")) segs[i].Ph = "k";
        }
    }

    private static readonly IReadOnlySet<string> SHORT =
        new HashSet<string>(new[] { "a", "e", "ɛ", "i", "ɪ", "ɔ", "o", "u", "ʊ" }, StringComparer.Ordinal);

    /** One Scottish Gaelic word → canonical IPA. Stress the first nucleus; other short-vowel nuclei reduce
     *  to [ə]. */
    public static string PhonemizeWord(string word)
    {
        var segs = Scan(ELISION.Replace(word, ""));
        if (segs.Count == 0) return "";
        Preaspirate(segs);
        ChdCluster(segs);
        var nucleiIdx = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nucleiIdx.Add(i);
        if (nucleiIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var stress = nucleiIdx[0];
        foreach (var idx in nucleiIdx)
            if (idx != stress && SHORT.Contains(segs[idx].Ph)) segs[idx].Ph = "ə";
        var sb = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) sb.Append('ˈ');
            sb.Append(segs[i].Ph);
        }
        return sb.ToString();
    }

    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = DEF.ClausePunctuation;

    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(" + HostWord.HostWordRun(new[] { "Latin" }, "", "'’-") + ")|(\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     * See core/hostWord.ts.
     */
    private const string NATIVE_CLASS = "[a-zàèìòùáéíóúA-ZÀÈÌÒÙÁÉÍÓÚ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * SYMBOL NORMALIZATION — every reading is a gd.wikipedia TOKEN attestation (see the TS header for the
     * counts and quotations). ⚠ GAELIC HAS NO NUMBER AGREEMENT ON A COUNTED NOUN — it stays singular after
     * any numeral — so every entry is a ONE-element `CountForms` array. `ceum` IS NOT DECLARED FOR DEGREES:
     * all 43 of its attestations are the ACADEMIC degree, and the 358 degrees stay unread and visible to the
     * RAWMARK gate rather than acquiring a reading that means "university degree Celsius".
     */
    private static readonly Func<string, string> SYMBOLS =
        NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
        {
            Percent = new[] { "sa cheud" },
            // ⚠ `Euro` IS THE CORPUS'S OWN SPELLING, not an invented Gaelicisation: `eòro` scores 0
            // everywhere and the corpus's currency list writes it in the English form.
            Currency = new Dictionary<string, IReadOnlyList<string>>
            {
                ["£"] = new[] { "not" }, ["$"] = new[] { "dolar" }, ["€"] = new[] { "Euro" },
            },
            Units = new Dictionary<string, IReadOnlyList<string>>
            {
                ["km"] = new[] { "cilemeatair" }, ["cm"] = new[] { "ceudameatair" }, ["mm"] = new[] { "milemeatair" },
                ["kg"] = new[] { "cileagram" }, ["m"] = new[] { "meatair" }, ["g"] = new[] { "gram" },
            },
            // Gaelic puts the measure adjective AFTER the noun — *cilemeatair ceàrnagach* — the corpus's own gloss.
            ExponentWords = new ExponentWordsDef
            {
                Squared = new[] { "ceàrnagach" },
                Cubed = new[] { "ciùbach" },
                Position = ExponentPosition.After,
            },
            UnitPer = "san",
            RateDenominators = new Dictionary<string, string>
            {
                ["h"] = "uair", ["u"] = "uair", ["s"] = "diog",
            },
            Ampersand = "agus",
            Magnitudes = new[] { "muillean", "billean" },
        });

    public string Text(string input)
    {
        // Normalize FIRST — its de-grouping, ordinal and decimal steps need the figure and its written
        // suffix still adjacent, which the tier would break — then the shared symbol tier, which matches a
        // unit only when a NUMBER is adjacent.
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeScottishGaelic(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            // Numbers: compose the Gaelic numeral phrase, then phonemize each word through the same g2p.
            // ⚠ THE TOKEN IS PASSED AS `raw` (#1095) — the fallback cannot recover the digits from the
            // double it exists to bypass.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
        });
    }

    /** Build the Scottish Gaelic phonemizer (broad/slender rule engine + pre-aspiration). */
    public static ILanguage CreateScottishGaelic() => new ScottishGaelicPhonemizer();

    internal static void RegisterSelf() => Registry.Register("scottishgaelic", CreateScottishGaelic);
}
