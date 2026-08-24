/**
 * Dutch (nl) phonemizer — Northern Standard Dutch, canonical IPA. Rule-based g2p (g2p.ts)
 * with Germanic initial stress (the first full syllable, or the first after an unstressed prefix be-/ge-/ver-/
 * ont-/her-/te-). text() tokenizes words / numbers / punctuation.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public sealed class DutchPhonemizer : ILanguage
{
    // Unstressed prefixes that shift stress off the first syllable (verkópen, gelóven, begín, ontslág, herhálen).
    private static readonly JsRe UNSTRESSED_PREFIX = JsRegex.Compile("^(ver|ge|be|ont|her|te)", "u");
    // The subset whose vowel additionally REDUCES to schwa when the prefix is treated as unstressed (ge-/be-/ver-/te-
    // → ɣə/bə/vər/tə). ont-/her- shift stress but KEEP their full vowel (ɔnt-/hɛr-), so they are excluded here.
    private static readonly JsRe SCHWA_PREFIX = JsRegex.Compile("^(ver|ge|be|te)", "u");

    // High-frequency function words / clitics whose vowel is reduced to schwa (unstressed by default) — the g2p's
    // first-syllable rule would give them a full vowel (de → deː). The numeral/article "een" is left to the g2p
    // (eːn) so the number path is unaffected. Apostrophe clitics ('t, 'n, 'k, …) are the reduced forms.
    private static readonly IReadOnlyDictionary<string, string> FUNCTION_WORDS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["de"] = "də", ["je"] = "jə", ["ze"] = "zə", ["we"] = "ʋə", ["me"] = "mə", ["te"] = "tə", ["ge"] = "ɣə",
        ["het"] = "ɦət", ["'t"] = "ət", ["'n"] = "ən", ["'k"] = "ək", ["'m"] = "əm", ["'s"] = "əs",
    };

    /** Place primary stress and reduce an unstressed prefix's vowel. Returns the stressed-nucleus seg index. The
     *  prefix is treated as unstressed ONLY when a later nucleus exists AND it isn't a schwa — this distinguishes a
     *  real prefix (ge·maakt, nucleus1 = aː → shift + reduce ge→ɣə) from a ⟨ge⟩-root (geven, nucleus1 = ə → no shift,
     *  ɣˈeːvən, no stressed schwa). When the shift fires, a ge-/be-/ver-/te- prefix vowel (segs[nuclei0]) also
     *  reduces to ə (ont-/her- keep their full vowel). Offglides (vowel:false) are skipped — only true nuclei count. */
    private static int PlaceStress(List<Seg> segs, string word)
    {
        var nuclei = new List<int>();
        for (var k = 0; k < segs.Count; k++) if (segs[k].Vowel) nuclei.Add(k);
        if (nuclei.Count == 0) return -1;
        var lower = word.ToLowerInvariant();
        if (nuclei.Count > 1 && UNSTRESSED_PREFIX.IsMatch(lower) && segs[nuclei[1]].Ph != "ə")
        {
            if (SCHWA_PREFIX.IsMatch(lower)) segs[nuclei[0]].Ph = "ə"; // ge-/be-/ver-/te- vowel → schwa
            return nuclei[1];
        }
        // First non-schwa nucleus (a schwa-initial root like the reduced prefix be- pushes stress right).
        foreach (var k in nuclei) if (segs[k].Ph != "ə") return k;
        return nuclei[0];
    }

    /** Phonemize a single stress group (a stem plus its own prefixes/suffixes) — the existing g2p handles its internal
     *  prefix reduction (ge-/be-/ver-/te-) and suffix schwa (-ig/-lijk/-isch). */
    private static string PhonemizeChunk(string word)
    {
        var segs = G2p.ToSegments(word);
        if (segs.Count == 0) return "";
        var stress = PlaceStress(segs, word);
        var outp = "";
        for (var k = 0; k < segs.Count; k++)
        {
            if (k == stress) outp += "ˈ";
            outp += segs[k].Ph;
        }
        return outp;
    }

    /** Merge a decomposition into stem-headed STRESS GROUPS: a prefix attaches to the following element, a suffix to
     *  the preceding, and a second stem starts a new group. So only COMPOUND (stem·stem) boundaries survive — the g2p
     *  already reduces each group's own prefix/suffix internally, and an over-stripped affix simply rejoins its stem. */
    private static List<string> StressGroups(List<string> parts, List<Kind> kinds)
    {
        var groups = new List<string>();
        var cur = "";
        var hasStem = false;
        for (var i = 0; i < parts.Count; i++)
        {
            if (kinds[i] == Kind.Stem && hasStem) { groups.Add(cur); cur = ""; hasStem = false; }
            cur += parts[i];
            if (kinds[i] == Kind.Stem) hasStem = true;
        }
        if (cur.Length > 0) groups.Add(cur);
        return groups;
    }

    /** Phonemize a single Dutch word to canonical IPA (with a stress mark). A compound is split at its stem·stem
     *  boundaries and each element phonemized independently, so each keeps its own stressed vowel and devoices at its
     *  own boundary (stad·huis → ˈstɑtˈɦœys); a non-compound (or a prefix/suffix-only word) takes the direct path. */
    public static string PhonemizeWord(string word)
    {
        if (FUNCTION_WORDS.TryGetValue(word.ToLowerInvariant(), out var reduced)) return reduced;
        var w = word.ToLowerInvariant();
        // A word that is itself a dictionary entry is monomorphemic-or-lexicalised → phonemize whole (skip splitting).
        // Guards minister→mini·ster, spelling→spel·ling, drinken→drin·ken (no constituent flags to reject those tails).
        if (Morphology.IsLexicalWord(w)) return PhonemizeChunk(word);
        var d = Morphology.Decompose(w);
        if (d.Parts.Count > 1)
        {
            var groups = StressGroups(d.Parts, d.Kinds);
            if (groups.Count > 1) return JoinChunks(groups.Select(PhonemizeChunk).ToList());
        }
        return PhonemizeChunk(word);
    }

    // IPA consonant symbols a Dutch chunk can end/start with (for seam degemination). Vowels/offglides excluded.
    private static readonly IReadOnlySet<string> CONS_IPA =
        new HashSet<string>(Manifest.MANIFEST.ConsonantPhones, StringComparer.Ordinal);

    /** Join compound chunks, DEGEMINATING at each seam: Dutch collapses a doubled consonant across a compound boundary
     *  (voedings+stof → vudɪŋstɔf, knoop+punt → knoːpʏnt, gras+spriet → ɣraspriːt). The next chunk's leading stress mark
     *  is skipped when comparing the seam consonant. */
    private static string JoinChunks(List<string> chunks)
    {
        var outp = chunks.Count > 0 ? chunks[0] : "";
        for (var i = 1; i < chunks.Count; i++)
        {
            var g = chunks[i];
            // JS indexes a string out of range as `undefined`; both reads below can do that on an empty chunk.
            var onset = g.StartsWith("ˈ", StringComparison.Ordinal)
                ? (g.Length > 1 ? g[1].ToString() : null)
                : (g.Length > 0 ? g[0].ToString() : null); // first phoneme (skip a leading stress mark)
            var coda = outp.Length > 0 ? outp[^1].ToString() : null;
            if (coda is not null && onset == coda && CONS_IPA.Contains(coda)) outp = outp[..^1]; // drop the duplicated coda
            outp += g;
        }
        return outp;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // A word (Latin letters incl. Dutch diacritics) / number / punctuation token. An optional LEADING apostrophe
    // captures the reduced clitics 't 'n 'k 'm 's (informal Dutch); medial apostrophes handle zo'n, auto's.
    //
    // ⚠ DUTCH GROUPS THOUSANDS WITH A PERIOD AND TAKES A COMMA DECIMAL, so a bare `(\d+)` number group lets BOTH
    // separators fall through to clausePunctuation: "400.000" reads *vierhonderd . nul* — a phrase break plus a
    // lost magnitude — and "6,5" reads *zes , vijf*. Clocks are claimed by normalize.ts first, so a period reaching
    // here is grouping and a comma is the decimal point.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(['’]?[a-zà-ÿ]+(?:['’][a-zà-ÿ]+)*)|(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:,\\d+)?)|([.!?…,;:])", "giu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");

    // Dutch measure and currency nouns are INVARIANT after a numeral ("vijf euro", "83 kilometer", "27 miljoen
    // pond"), so each entry is a single form and no count agreement is needed.
    // ⚠ `g` IS DELIBERATELY NOT A UNIT: the Wi-Fi standards are written "802.11a/b/g", and "11g" is not 11 grams.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ `multiply` IS STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
        // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it — Dutch does
        // not split dimension from product.
        Multiply = new MultiplyDef { Times = "keer" },
        Percent = new[] { "procent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "euro" }, ["$"] = new[] { "dollar" }, ["£"] = new[] { "pond" }, ["¥"] = new[] { "yen" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometer" }, ["cm"] = new[] { "centimeter" }, ["mm"] = new[] { "millimeter" },
            ["m"] = new[] { "meter" },
            ["kg"] = new[] { "kilogram" }, ["mg"] = new[] { "milligram" }, ["ha"] = new[] { "hectare" },
            ["mi"] = new[] { "mijl" },
            ["mph"] = new[] { "mijl per uur" },
        },
        // ⚠ Denominators ONLY. `s` as a standalone unit makes `Il-76s` read *zesenzeventig seconde*.
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["u"] = "uur", ["h"] = "uur", ["s"] = "seconde",
        },
        UnitPer = "per",
        // Dutch puts the measure word BEFORE the unit, spaced, and measure nouns stay singular after a numeral.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "vierkante" }, Cubed = new[] { "kubieke" }, Position = ExponentPosition.Before,
        },
        Magnitudes = new[] { "miljoen", "miljard", "biljoen" },
    });

    public string Text(string input)
    {
        // ⚠ THE ORDER IS FORCED: Dutch rewrites (era/abbreviations, dotted capital runs, ORDINALS, clock,
        // units, signs) → INITIALISMS → the shared symbol tier. The initialism pass must follow the
        // abbreviation rewrites, or `V.S.` never becomes the caps run it spells out; and the symbol tier must
        // follow the local unit rules, which own the ratio and squared forms it cannot express.
        var normalized = SYMBOLS(Normalize.NormalizeDutchInitialisms(Normalize.NormalizeDutch(input)));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // The PERIOD is thousands grouping and the COMMA is the decimal point (see TOKEN).
                var bits = DOTS.Replace(m.Groups[2].Value, "").Split(',');
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                foreach (var wd in Numbers.NumberToWords(Js.Number(intPart)).Split(' ')) sink.Emit(PhonemizeWord(wd));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord("komma"));
                    foreach (var d in frac)
                        foreach (var wd in Numbers.NumberToWords(Js.Number(d.ToString())).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Dutch phonemizer. */
    public static ILanguage CreateDutch() => new DutchPhonemizer();

    internal static void RegisterSelf() => Registry.Register("dutch", CreateDutch);
}
