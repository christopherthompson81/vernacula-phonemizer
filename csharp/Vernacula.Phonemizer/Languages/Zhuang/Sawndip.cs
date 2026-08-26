/**
 * Sawndip (古壮字) → Standard-Zhuang reading front-end: one Han-derived glyph = one syllable, looked up in a
 * glyph→Latin-reading dictionary and routed through the za g2p. Covered subset, default readings only.
 * Ported from src/languages/zhuang/sawndip.ts — see that file for the scope and the polyphony note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zhuang;

public static class Sawndip
{
    private static Dictionary<string, string>? readings;

    /** Lazy: the glyph→reading dict is only read on first Sawndip use. */
    private static Dictionary<string, string> Readings() =>
        readings ??= LoadTsv.LoadTsvMap("languages/zhuang", "sawndip-readings.tsv");

    /** Is `cp` a Sawndip-capable code point (the blocks the shipped dictionary draws on)? */
    // ⚠ THE SAME SET IS SPELLED TWICE MORE — Normalize.cs's HAN and Zhuang.cs's TOKEN. Keep the three in
    // step; when the bounds lagged the dictionary it was 24 unreachable readings (see the TS).
    private static bool IsIdeograph(int cp) =>
        cp == 0x3007 ||
        (cp >= 0x3400 && cp <= 0x4dbf) ||
        (cp >= 0x4e00 && cp <= 0x9fff) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0x20000 && cp <= 0x2ee5f) ||
        (cp >= 0x2f800 && cp <= 0x2fa1f) ||
        (cp >= 0x30000 && cp <= 0x3347f);

    /** Does `s` contain any Sawndip (CJK ideograph) character? */
    public static bool IsSawndip(string s)
    {
        // `for (const ch of s)` iterates CODE POINTS, so an astral glyph is tested whole.
        foreach (var ch in Js.CodePoints(s))
            if (IsIdeograph(Js.CodePointAt0(ch))) return true;
        return false;
    }

    /** A run of Sawndip characters → one reading per glyph; an OOV glyph is dropped. */
    public static List<string> SawndipToReadings(string run)
    {
        var dict = Readings();
        var @out = new List<string>();
        foreach (var ch in Js.CodePoints(run))
            if (dict.TryGetValue(ch, out var r) && r.Length > 0) @out.Add(r);
        return @out;
    }
}
