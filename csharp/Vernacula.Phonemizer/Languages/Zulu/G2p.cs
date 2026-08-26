/**
 * Zulu (zu, isiZulu) grapheme→phoneme engine — Nguni Bantu, Latin script, AUTHORED. A longest-match scan
 * over the manifest's rule table, so clicks and affricates resolve as single phonemes.
 * Ported from src/languages/zulu/g2p.ts — see that file for the inventory and its referees.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zulu;

/** One scanned unit: its IPA, and whether it is a vowel nucleus. */
public readonly record struct Seg(string Ph, bool V);

public static class G2p
{
    /** Scan Nguni orthography into IPA segments (longest-match). `rules` defaults to the Zulu table; the
     *  sibling Xhosa engine passes its own (near-identical) table — the scan logic is shared. */
    public static List<Seg> ToSegments(string word, IReadOnlyList<Rule>? rules = null)
    {
        var table = rules ?? Manifest.RULES;
        var w = Js.ToLowerCase(word);
        var segs = new List<Seg>();
        var i = 0;
        while (i < w.Length)
        {
            // Word-initial ntsh keeps a plain n (Ntshonalanga→nt͡ʃʼ); the n→ɲ palatalization only fires medially.
            if (i == 0 && w.StartsWith("ntsh", StringComparison.Ordinal))
            {
                segs.Add(new Seg("n", false));
                segs.Add(new Seg("t͡ʃʼ", false));
                i += 4;
                continue;
            }
            var matched = false;
            foreach (var r in table)
            {
                if (w.AsSpan(i).StartsWith(r.Orth, StringComparison.Ordinal))
                {
                    segs.Add(new Seg(r.Ipa, r.V));
                    i += r.Orth.Length;
                    matched = true;
                    break;
                }
            }
            if (!matched) i++; // unknown char (skip)
        }
        return segs;
    }
}
