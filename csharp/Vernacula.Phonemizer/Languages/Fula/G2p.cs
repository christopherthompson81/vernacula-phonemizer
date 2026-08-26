/**
 * Fula (ff) grapheme→phoneme engine — Fulfulde. A longest-match scan over the rule table (prenasalized
 * digraphs and geminates resolve before the bare letter), then penultimate stress.
 * Ported from src/languages/fula/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Fula;

public static class G2p
{
    private static IReadOnlyList<FulaRule> RULES => Manifest.RULES;

    private sealed class Seg
    {
        public required string Ph { get; init; }
        public required bool Nuc { get; init; }
    }

    /** Scan Fula orthography into IPA segments (longest-match). */
    private static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var segs = new List<Seg>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var r in RULES)
            {
                if (!w.AsSpan(i).StartsWith(r.Orth, StringComparison.Ordinal)) continue;
                segs.Add(new Seg { Ph = r.Ipa, Nuc = r.Nuc });
                i += r.Orth.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            // ⚠ A letter with no rule here still denotes a sound; the language's own reading wins. Reached
            // only when every grapheme (digraphs included) has declined. `w[i]` is ONE UTF-16 CODE UNIT in
            // both engines, so an astral pass-through presents a lone surrogate — which has no phone.
            var p = LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (p is not null) segs.Add(new Seg { Ph = p, Nuc = false });
            i++;
        }
        return segs;
    }

    /** One Fula word → canonical IPA with penultimate stress. */
    public static string PhonemizeWord(string word)
    {
        var segs = ToSegments(word);
        var nucIdx = segs.Select((s, i) => s.Nuc ? i : -1).Where(i => i >= 0).ToList();
        if (nucIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var stressIdx = nucIdx.Count >= 2 ? nucIdx[^2] : nucIdx[0]; // penultimate nucleus
        var outp = new System.Text.StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }
}
