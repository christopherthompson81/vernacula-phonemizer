/**
 * Commonwealth spelling → the lexicon's (American) spelling, for OOV words only.
 * Ported from src/languages/english/spellingVariants.ts — see that file for the rule-by-rule
 * evidence, the measured false positives, and why each guard exists.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class SpellingVariants
{
    private static readonly (string Gb, string Us)[] DIGRAPH_STEMS =
    [
        ("anae", "ane"),
        ("aemia", "emia"),
        ("aemic", "emic"),
        ("archaeo", "archeo"),
        ("judaeo", "judeo"),
        ("caesar", "cesar"),
        ("rrhoea", "rrhea"),
        ("rrhoid", "rrhoid"),
        ("paedi", "pedi"),
        ("paedia", "pedia"),
        ("faec", "fec"),
        ("foet", "fet"),
        ("gynaec", "gynec"),
        ("haem", "hem"),
        ("homoeo", "homeo"),
        ("oedema", "edema"),
        ("oesophag", "esophag"),
        ("oestr", "estr"),
        ("orthopaed", "orthoped"),
        ("palaeo", "paleo"),
        ("mediaeval", "medieval"),
        ("primaeval", "primeval"),
        ("aeon", "eon"),
        ("aetiolog", "etiolog"),
        ("caesium", "cesium"),
        ("chimaera", "chimera"),
        ("daemon", "demon"),
        ("hyaena", "hyena"),
        ("onomatopoeia", "onomatopeia"),
        ("manoeuvr", "maneuvr"),
        ("amoeb", "ameb"),
        ("coeliac", "celiac"),
        ("oenolog", "enolog"),
        ("praes", "pres"),
    ];

    private static readonly HashSet<string> NOT_OUR =
    [
        "our", "hour", "four", "your", "sour", "pour", "tour", "dour", "flour", "scour",
        "amour", "velour", "detour", "contour", "devour", "paramour",
    ];

    private static readonly JsRe OUR_SUFFIX = JsRegex.Compile(
        "^(s|'s|d|ed|eds|ing|ings|er|ers|ies|y|ly|al|ally|ation|ations|less|ful|fully|ness|ite|ites|itism|able|ably|ist|ists|ism|hood|hoods)$");
    private static readonly JsRe RE_ER = JsRegex.Compile("([bcdfgkmnpstvz])re$");
    private static readonly JsRe CE_SE = JsRegex.Compile("ce$");
    private static readonly JsRe ISE_IZE = JsRegex.Compile("is(e|ed|es|ing|ation|ations|able|er|ers)$");
    private static readonly JsRe YSE_YZE = JsRegex.Compile("ys(e|ed|es|ing|is)$");
    private static readonly JsRe LL_SUFFIX = JsRegex.Compile("ll(ed|ing|er|ers|or|ors|ery|ist|ists|ous|ously)$");
    private static readonly JsRe L_SUFFIX = JsRegex.Compile("l(ment|ments|ful|fully)$");
    private static readonly JsRe PREFIX = JsRegex.Compile("^(un|re|dis|mis|over|under|non)");
    private static readonly JsRe OGUE_OG = JsRegex.Compile("ogue$");
    private static readonly JsRe MME_M = JsRegex.Compile("mme$");
    private static readonly JsRe XION_CTION = JsRegex.Compile("xion$");

    private static List<string> Step(string word, Func<string, bool> known)
    {
        var outp = new List<string>();
        void Push(string w) { if (w != word) outp.Add(w); }

        for (var at = word.IndexOf("our", StringComparison.Ordinal); at > 1;
             at = word.IndexOf("our", at + 1, StringComparison.Ordinal))
        {
            var rest = word[(at + 3)..];
            if (rest.Length != 0 && !OUR_SUFFIX.IsMatch(rest) && !(rest.Length > 2 && known(rest)))
                continue;
            if (NOT_OUR.Contains(word[..(at + 3)])) continue;
            Push(word[..at] + "or" + rest);
        }

        Push(RE_ER.Replace(word, "$1er"));
        Push(CE_SE.Replace(word, "se"));
        Push(ISE_IZE.Replace(word, "iz$1"));
        Push(YSE_YZE.Replace(word, "yz$1"));

        var ll = LL_SUFFIX.Match(word);
        if (ll.Success)
        {
            var stem = word[..ll.Index] + "l";
            var bas = PREFIX.Replace(stem, "");
            if (stem.Length > 3 && (known(stem) || (bas != stem && known(bas))))
                Push(stem + ll.Groups[1].Value);
        }

        Push(L_SUFFIX.Replace(word, "ll$1"));

        foreach (var (gb, us) in DIGRAPH_STEMS)
            if (word.Contains(gb, StringComparison.Ordinal))
                Push(word.Replace(gb, us, StringComparison.Ordinal));

        Push(OGUE_OG.Replace(word, "og"));
        Push(MME_M.Replace(word, "m"));
        Push(word.Replace("sulph", "sulf", StringComparison.Ordinal));
        Push(XION_CTION.Replace(word, "ction"));

        return outp;
    }

    /** The first American spelling of `word` that `known` accepts, or null. */
    public static string? AmericanSpelling(string word, Func<string, bool> known)
    {
        const int depth = 3;
        var frontier = new List<string> { word };
        var seen = new HashSet<string> { word };
        for (var d = 0; d < depth && frontier.Count > 0; d++)
        {
            var next = new List<string>();
            foreach (var w in frontier)
                foreach (var cand in Step(w, known))
                {
                    if (!seen.Add(cand)) continue;
                    if (known(cand)) return cand;
                    next.Add(cand);
                }
            frontier = next;
        }
        return null;
    }
}
