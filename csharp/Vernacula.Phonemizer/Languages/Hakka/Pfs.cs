/**
 * Pha̍k-fa-sṳ → IPA: the romanization front end hak.wikipedia is actually written in (93.5% Latin). A Latin
 * run resolves as a whole-word key, then per-syllable keys, then composition from an attested sibling; a run
 * that resolves nowhere is handed back to the foreign reader.
 * Ported from src/languages/hakka/pfs.ts — see that file for the derivation, the measurements and the refusals.
 */
using System.Runtime.CompilerServices;
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hakka;

public class PfsDef
{
    /** PFS onset → its Meixian IPA; a second entry is the PALATAL alternant before a front-high nucleus. */
    public IReadOnlyDictionary<string, IReadOnlyList<string>> PfsOnsets { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();

    /** PFS tone diacritic (plus the pseudo-key `checked`) → Meixian pitch digits. */
    public IReadOnlyDictionary<string, string> PfsTones { get; init; } = new Dictionary<string, string>();
}

/** One piece of a Latin run: either a Hakka reading (dict.tsv format) or text for the foreign reader. */
public readonly struct PfsSegment
{
    public string? Reading { get; init; }
    public string? Foreign { get; init; }
}

public static class Pfs
{
    /** The PFS tone marks as combining characters. ⚠ U+0324 (⟨ṳ⟩) is a VOWEL letter and is deliberately absent. */
    private const string TONE_MARKS = "̂̀́̍";
    private static readonly JsRe TONE_RE = JsRegex.Compile($"[{TONE_MARKS}]", "gu");
    /** The diacritics that mark a string as PFS rather than possibly-English — the two vowel letters included. */
    private static readonly JsRe PFS_DIACRITIC = JsRegex.Compile($"[{TONE_MARKS}̤͘]", "u");

    /** A syllable stripped to its bare letters, plus whichever tone mark it carried. */
    private static (string Base, string Mark) StripTone(string syl)
    {
        var d = syl.Normalize(NormalizationForm.FormD);
        var mark = Js.CodePoints(d).FirstOrDefault(c => c.Length == 1 && TONE_MARKS.IndexOf(c[0]) >= 0) ?? "";
        return (TONE_RE.Replace(d, ""), mark);
    }

    private static readonly JsRe TSH = JsRegex.Compile("tsh", "gu");
    private static readonly JsRe TS = JsRegex.Compile("ts", "gu");

    /** ⟨ts⟩/⟨tsh⟩ → ⟨ch⟩/⟨chh⟩ — the other affricate spelling this wiki uses. ⚠ Order: the digraph first. */
    private static string FoldVariants(string s) => TS.Replace(TSH.Replace(s, "chh"), "ch");

    /** The lookup key for a PFS string: lower-cased, variant-folded, and NFD so the marks compare. */
    private static string Key(string s) => FoldVariants(Js.ToLowerCase(s)).Normalize(NormalizationForm.FormD);

    private sealed class Index
    {
        internal required IReadOnlyDictionary<string, string> Table { get; init; }
        /** onset+" "+rime → the attested IPA of a sibling syllable, tone stripped. */
        internal required IReadOnlyDictionary<string, string> Pair { get; init; }
        /** rime → the attested IPA RIME of any sibling, tone stripped. */
        internal required IReadOnlyDictionary<string, string> Rime { get; init; }
        internal required IReadOnlyList<string> Onsets { get; init; }
    }

    /** ⚠ CACHED ON THE TABLE, NOT THE MANIFEST — see the TS: a def-keyed cache would score every held-out
     *  validation table against the index built from the first one. */
    private static readonly ConditionalWeakTable<object, Index> INDEX = new();

    private static readonly JsRe TONE_DIGITS_END = JsRegex.Compile("[⁰-₟¹²³]+$", "u");

    /** Split a bare (toneless) PFS syllable into onset + rime. Longest-first, and never the whole syllable. */
    private static (string Onset, string Rime) Split(string bas, IReadOnlyList<string> onsets)
    {
        foreach (var o in onsets)
            if (bas.StartsWith(o, StringComparison.Ordinal) && bas.Length > o.Length) return (o, bas[o.Length..]);
        return ("", bas);
    }

    private static Index BuildIndex(PfsDef def, IReadOnlyDictionary<string, string> raw) =>
        INDEX.TryGetValue(raw, out var cached) ? cached : INDEX.GetValue(raw, _ => Build(def, raw));

    private static Index Build(PfsDef def, IReadOnlyDictionary<string, string> raw)
    {
        // ⚠ STABLE longest-first: JS `sort` is stable, .NET's `List.Sort` is not.
        var onsets = def.PfsOnsets.Keys.OrderByDescending(k => k.Length).ToList();
        // ⚠ THE TABLE IS RE-KEYED TO NFD — `pfs.tsv` is written NFC and a lookup key must be NFD for the
        // tone mark to be a separate character the splitter can see. See the TS for what omitting it broke.
        var table = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var kv in raw) table[kv.Key.Normalize(NormalizationForm.FormD)] = kv.Value;
        var pair = new Dictionary<string, string>(StringComparer.Ordinal);
        var rime = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (k, reading) in table)
        {
            if (k.Contains('-') || reading.Contains(' ')) continue; // word keys donate nothing to composition
            var (bas, _) = StripTone(k);
            var (o, r) = Split(bas, onsets);
            var seg = TONE_DIGITS_END.Replace(reading, "");
            if (r.Length == 0) continue;
            if (!pair.ContainsKey($"{o} {r}")) pair[$"{o} {r}"] = seg;
            // The rime alone, with this onset's IPA removed — used when no sibling shares the onset.
            var alts = def.PfsOnsets.TryGetValue(o, out var a) ? a : new[] { "" };
            var hit = alts.Where(x => x != "" && seg.StartsWith(x, StringComparison.Ordinal))
                .OrderByDescending(x => x.Length).FirstOrDefault();
            var bare = hit is null ? seg : seg[hit.Length..];
            if (!rime.ContainsKey(r)) rime[r] = bare;
        }
        return new Index { Table = table, Pair = pair, Rime = rime, Onsets = onsets };
    }

    private static readonly JsRe CHECKED = JsRegex.Compile("[ptk]$", "u");

    /** The pitch digits a PFS syllable's diacritic and coda call for. */
    private static string Tone(PfsDef def, string bas, string mark)
    {
        if (CHECKED.IsMatch(bas) && mark == "") return def.PfsTones.GetValueOrDefault("checked", "");
        return def.PfsTones.GetValueOrDefault(mark, "");
    }

    private static readonly JsRe FRONT_HIGH = JsRegex.Compile("^[iy]", "u");

    /** One PFS syllable → its Meixian reading in dict.tsv's format, or null if it resolves nowhere. */
    private static string? Syllable(PfsDef def, Index ix, string raw)
    {
        var k = Key(raw);
        if (ix.Table.TryGetValue(k, out var direct)) return direct;
        var (bas, mark) = StripTone(k);
        var (o, r) = Split(bas, ix.Onsets);
        var t = Tone(def, bas, mark);
        if (t == "") return null;
        // ⚠ THE SIBLING SHARING THE ONSET IS TRIED FIRST — it settles the medial glide AND palatalization.
        if (ix.Pair.TryGetValue($"{o} {r}", out var samePair)) return samePair + t;
        if (!ix.Rime.TryGetValue(r, out var bare)) return null;
        // ⚠ THE ZERO ONSET IS `[""]`, NOT absent: a missing row is not "unreadable". See the TS.
        var alts = def.PfsOnsets.TryGetValue(o, out var a) ? a : new[] { "" };
        // No sibling shares the onset, so the palatal alternant is chosen by the rime's own nucleus.
        var palatal = alts.Count > 1 && FRONT_HIGH.IsMatch(r);
        return (palatal ? alts[1] : alts[0]) + bare + t;
    }

    private static readonly JsRe EDGE_HYPHENS = JsRegex.Compile("^-+|-+$", "gu");

    /**
     * Read one Latin run as Pha̍k-fa-sṳ: the run split into Hakka readings (in `dict.tsv`'s format) and any
     * fragments that are not Hakka; or null, meaning "none of this is Hakka, give the whole run to `foreign`".
     */
    public static List<PfsSegment>? ReadPfs(PfsDef def, IReadOnlyDictionary<string, string> table, string run)
    {
        var ix = BuildIndex(def, table);
        var trimmed = EDGE_HYPHENS.Replace(run, "");
        if (trimmed == "") return null;
        if (ix.Table.TryGetValue(Key(trimmed), out var whole)) return new List<PfsSegment> { new() { Reading = whole } };
        var parts = trimmed.Split('-').Where(p => p.Length > 0).ToList();
        // ⚠ THE ≤2-LETTER REFUSAL: a lone bare pair of letters is where PFS stops discriminating, and the
        // class is `me a tu g u na en km` — including the UNIT `km`.
        if (parts.Count == 1)
        {
            var k = Key(trimmed);
            if (!ix.Table.ContainsKey(k) && !PFS_DIACRITIC.IsMatch(k) && StripTone(k).Base.Length <= 2) return null;
        }
        // A hyphenated run resolves syllable by syllable; a single one is all-or-nothing. See the TS.
        var outp = parts.Select(p => Syllable(def, ix, p)).ToList();
        if (outp.All(r => r is null)) return null; // nothing here is Hakka — it is a foreign word
        var segs = new List<PfsSegment>();
        for (var i = 0; i < parts.Count; i++)
        {
            var r = outp[i];
            if (r is not null) segs.Add(new PfsSegment { Reading = r });
            else if (segs.Count > 0 && segs[^1].Foreign is not null)
                segs[^1] = new PfsSegment { Foreign = segs[^1].Foreign + "-" + parts[i] };
            else segs.Add(new PfsSegment { Foreign = parts[i] });
        }
        return segs;
    }

    private static IReadOnlyDictionary<string, string>? TABLE;
    private static readonly object TABLE_LOCK = new();

    /** The shipped table, loaded once. */
    public static IReadOnlyDictionary<string, string> PfsTable()
    {
        lock (TABLE_LOCK) return TABLE ??= LoadTsv.LoadTsvMap("languages/hakka", "pfs.tsv");
    }
}
