/**
 * Hausa grapheme→phoneme engine (Kano standard, Boko orthography)  (authored)
 * Boko spelling is shallow and near-1:1, so a longest-match scan —
 * digraphs/trigraphs (ƙw, 'y, aa, ai, sh, ts, kw, ky…) resolve before the bare letter. Fills the census gaps:
 * implosives ɓ ɗ, ejectives kʼ t͡sʼ, labialization kʷ ɡʷ, glottalized ʔʲ, palatals c ɟ, and ɸ.
 * Tone is NOT written in Boko — it is a lexical FACT overlaid from a Wiktionary-derived lexicon (tone.tsv);
 * out-of-lexicon words are left untoned. Stress is penultimate.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public static class G2p
{
    // Longest-match orthography→IPA rules + tone-code→Chao map — authored DATA in hausa.jsonc.
    private static IReadOnlyList<HausaRule> RULES => Manifest.RULES;
    private static IReadOnlyDictionary<string, string> TONE_CHAO => Manifest.MANIFEST.ToneChao;

    // Tone lexicon: word → per-nucleus tone codes (H/L/F/R). All-Low words are omitted; out-of-lexicon → untoned.
    private static Dictionary<string, string>? TONE;
    private static readonly object GATE = new();
    private static Dictionary<string, string> ToneLexicon()
    {
        lock (GATE) return TONE ??= LoadTsv.LoadTsvMap<string>("languages/hausa", "tone.tsv", (v, _) => v.Trim(), optional: true);
    }

    private sealed class Seg
    {
        public required string Ph { get; init; }
        public required bool Nuc { get; init; }
    }

    private static readonly JsRe VELAR = JsRegex.Compile("[kgƙ]", "");

    /** Scan Boko orthography into IPA segments (longest-match); n → ŋ before a velar. */
    private static List<Seg> ToSegments(string word)
    {
        var w = word.ToLowerInvariant();
        var segs = new List<Seg>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var r in RULES)
            {
                if (string.CompareOrdinal(w, i, r.Orth, 0, r.Orth.Length) != 0 || i + r.Orth.Length > w.Length) continue;
                // n → ŋ before a velar (k / g / ƙ), incl. their digraphs.
                if (r.Orth == "n" && VELAR.IsMatch(i + 1 < w.Length ? w[i + 1].ToString() : ""))
                    segs.Add(new Seg { Ph = "ŋ", Nuc = false });
                else segs.Add(new Seg { Ph = r.Ipa, Nuc = r.Nuc });
                i += r.Orth.Length;
                matched = true;
                break;
            }
            if (!matched) i++; // unknown char (skip)
        }
        return segs;
    }

    /** One Hausa word → canonical IPA: segments + penultimate stress + lexical tone overlay. */
    public static string PhonemizeWord(string word)
    {
        var segs = ToSegments(word);
        var nucIdx = segs.Select((s, i) => s.Nuc ? i : -1).Where(i => i >= 0).ToList();
        if (nucIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        // Stress: the penultimate nucleus (the only one if monosyllabic).
        var stressIdx = nucIdx.Count >= 2 ? nucIdx[^2] : nucIdx[0];
        // Tone: per-nucleus codes from the lexicon (in nucleus order); untoned if absent.
        var lex = ToneLexicon();
        var codes = lex.GetValueOrDefault(word) ?? lex.GetValueOrDefault(word.ToLowerInvariant()) ?? "";
        var outp = "";
        var n = 0;
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp += "ˈ";
            outp += segs[i].Ph;
            if (segs[i].Nuc)
            {
                // ⚠ `codes[n]` IS AN OUT-OF-RANGE READ when the word has more nuclei than the lexicon row has
                // codes. JS yields `undefined`, the `?? ""` lookup then misses and appends nothing; C# would
                // throw, so the bound is explicit. Same branch, same outcome.
                var code = n < codes.Length ? codes[n].ToString() : "";
                outp += TONE_CHAO.GetValueOrDefault(code) ?? "";
                n++;
            }
        }
        return outp;
    }
}
