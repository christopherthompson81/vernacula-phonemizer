/**
 * Lao (lo) phonemizer — canonical IPA (authored). Owns the ALGORITHMS: the leading-vowel reorder pass, the
 * ຫ-led cluster handling, the syllable scanner, the ordered first-match walk over the vowel patterns and
 * the number compositor; every table it reads is data in lao.jsonc.
 * Ported from src/languages/lao/lao.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lao;

public static class LaoPhonemizer
{
    private static IReadOnlyDictionary<string, string[]> CONS => Manifest.MANIFEST.Onsets;
    private static IReadOnlyDictionary<string, string> CODA => Manifest.MANIFEST.Codas;

    private static readonly HashSet<string> LEAD = new(Manifest.MANIFEST.LeadingVowels, StringComparer.Ordinal);
    private static readonly HashSet<string> HSON = new(Manifest.MANIFEST.HLedSonorants, StringComparer.Ordinal);
    private static readonly HashSet<string> TONEMARK = new(Manifest.MANIFEST.ToneMarks, StringComparer.Ordinal);
    private static IReadOnlyList<VowelPattern> VOWELS => Manifest.MANIFEST.VowelPatterns;
    private static LaoToneTable TONE => Manifest.MANIFEST.Tone;
    private static readonly string CANCEL = Manifest.MANIFEST.CancellationMark;

    /** Code-point lengths of each pattern's `signs`, precomputed — the TS recomputes `[...p.signs].length`
     *  on every walk. Same values; the walk is hot. */
    private static readonly int[] SIGN_LEN = VOWELS.Select(p => Js.CodePoints(p.Signs).Count).ToArray();

    private static bool IsCons(string c) => CONS.ContainsKey(c);

    /** JS `CONS[c]?.[k]` — undefined for an absent key AND for a short row. ⚠ THE SECOND HALF IS NOT
     *  DECORATION: a one-element onset row in lao.jsonc reads as `mid` in the TS and would throw here. */
    private static string? ConsAt(string c, int k) =>
        CONS.TryGetValue(c, out var v) && k < v.Length ? v[k] : null;

    /** JS `s[i] ?? ""` on a code-point array. */
    private static string At(IReadOnlyList<string> s, int i) => i >= 0 && i < s.Count ? s[i] : "";

    /** Reorder a leading vowel (ເ ແ ໂ ໃ ໄ) to AFTER its consonant (cluster): ເມ → ມເ, so the scanner reads L→R. */
    private static string Reorder(string w)
    {
        var s = Js.CodePoints(Js.Normalize(w, System.Text.NormalizationForm.FormC));
        var @out = new System.Text.StringBuilder();
        for (var i = 0; i < s.Count; i++)
        {
            if (LEAD.Contains(s[i]) && IsCons(At(s, i + 1)))
            {
                var j = i + 1;
                var cons = s[j++];
                if (At(s, j) == "ຼ" || (cons == "ຫ" && HSON.Contains(At(s, j)))) cons += s[j++];
                @out.Append(cons).Append(s[i]);
                i = j - 1;
            }
            else @out.Append(s[i]);
        }
        return @out.ToString();
    }

    /** Apply the CANCELLATION MARK ໌ (karan): delete the consonant it sits on, and the mark — stripping the
     *  final cluster down to exactly one coda. */
    private static string CancelSilent(string w)
    {
        if (!w.Contains(CANCEL, StringComparison.Ordinal)) return w;
        var s = Js.CodePoints(w);
        var drop = new HashSet<int>();
        for (var i = 0; i < s.Count; i++)
        {
            if (s[i] != CANCEL) continue;
            drop.Add(i);
            var j = i - 1;
            while (j >= 0 && drop.Contains(j)) j--;
            if (j < 0 || !IsCons(s[j])) continue;
            drop.Add(j);
            for (var k = j - 1; k >= 1 && IsCons(s[k]) && IsCons(s[k - 1]); k--) drop.Add(k);
        }
        var @out = new System.Text.StringBuilder();
        for (var i = 0; i < s.Count; i++) if (!drop.Contains(i)) @out.Append(s[i]);
        return @out.ToString();
    }

    private readonly struct Resolved
    {
        public required string Q { get; init; }
        public required bool Long { get; init; }
        public required string Glide { get; init; }
        public required int Used { get; init; }
    }

    /**
     * Resolve the vowel at this position: walk the pattern table in order and take the FIRST whose leading
     * vowel and following signs both match. Null when nothing matches — the caller supplies the inherent vowel.
     */
    private static Resolved? ResolveVowel(string pre, IReadOnlyList<string> after)
    {
        for (var pi = 0; pi < VOWELS.Count; pi++)
        {
            var p = VOWELS[pi];
            if ((p.Pre ?? "") != pre) continue;
            var n = SIGN_LEN[pi];
            if (n > 0)
            {
                // JS `after.slice(0, n).join("")` — slice CLAMPS, so a short tail simply cannot match.
                if (after.Count < n) continue;
                var head = string.Concat(after.Take(n));
                if (head != p.Signs) continue;
            }
            return new Resolved { Q = p.Q, Long = p.Long ?? false, Glide = p.Glide ?? "", Used = n };
        }
        return null;
    }

    /** Tone = a written MARK if there is one, else (live | dead-long | dead-short) × the onset's CLASS. */
    private static string Tone(string cls, bool live, bool @long, string mark)
    {
        var row = TONE.Marks.GetValueOrDefault(mark) ?? (live ? TONE.Live : @long ? TONE.DeadLong : TONE.DeadShort);
        return row.For(cls) ?? row.Default ?? "";
    }

    /** Pull the tone marks out of the character stream so vowel-pattern matching sees contiguous vowel signs.
     *  Each mark attaches to the most recent base consonant. */
    private static (List<string> Clean, Dictionary<int, string> ToneAt) ExtractTones(IReadOnlyList<string> chars)
    {
        var clean = new List<string>();
        var toneAt = new Dictionary<int, string>();
        var lastCons = -1;
        foreach (var c in chars)
        {
            if (TONEMARK.Contains(c))
            {
                if (lastCons >= 0 && !toneAt.ContainsKey(lastCons)) toneAt[lastCons] = c;
            }
            else
            {
                if (IsCons(c)) lastCons = clean.Count;
                clean.Add(c);
            }
        }
        return (clean, toneAt);
    }

    /** One syllable's features — enough to RENDER it and to derive its tone. A STRUCT, so the ໆ repetition
     *  mark's `{...last}` spread is a plain value copy. */
    private readonly struct SylF
    {
        public required string Onset { get; init; }
        public required string Cls { get; init; }
        public required string Quality { get; init; }
        public required bool Long { get; init; }
        public required string CodaOut { get; init; }
        public required string Mark { get; init; }
        public required bool Live { get; init; }
        /** ⚠ NOT `Long`: a centring diphthong carries its ː inside `Quality` and sets Long=false so Scan does
         *  not append a second one, but still counts as heavy for tone. */
        public required bool Heavy { get; init; }
    }

    private static readonly JsRe SONORANT_CODA = JsRegex.Compile("[ŋnmjw]", "");

    /** The vowel signs the coda lookahead treats as "a vowel follows" (see lao.ts). */
    private static readonly string[] VSIGNS =
        { "ະ", "າ", "ິ", "ີ", "ຸ", "ູ", "ຶ", "ື", "ັ", "ົ", "ຳ", "ໍ", "ຽ" };

    /** Scan a reordered Lao word into per-syllable feature records (for rendering AND tone derivation). */
    private static List<SylF> ScanFeatures(string word)
    {
        var (s, toneAt) = ExtractTones(Js.CodePoints(word));
        var @out = new List<SylF>();
        var i = 0;
        while (i < s.Count)
        {
            var leadHigh = false;
            var onsetIdx = i;
            var c = s[i];
            // ໆ (mai kan / repetition mark) repeats the preceding syllable (ຊ້າໆ → saː.saː).
            if (c == "ໆ") { if (@out.Count > 0) @out.Add(@out[^1]); i++; continue; }
            if (!IsCons(c)) { i++; continue; }
            var onsetCs = new List<string> { c };
            i++;
            if (c == "ຫ" && (At(s, i) == "ຼ" || HSON.Contains(At(s, i))))
            {
                leadHigh = true;
                onsetCs = new List<string> { At(s, i) == "ຼ" ? "ລ" : s[i] };
                i++;
            }
            var cluster = "";
            if (At(s, i) == "ຼ") { cluster = "l"; i++; }
            var pre = "";
            if (LEAD.Contains(At(s, i))) { pre = s[i]; i++; }
            var rest = s.GetRange(i, s.Count - i);
            var rv = ResolveVowel(pre, rest);
            string quality = "a", glide = "";
            var @long = false;
            var used = 0;
            if (rv is { } r) { quality = r.Q; @long = r.Long; glide = r.Glide; used = r.Used; }
            i += used;
            var mark = toneAt.GetValueOrDefault(onsetIdx) ?? toneAt.GetValueOrDefault(onsetIdx + 1) ?? "";
            var coda = "";
            var nx = At(s, i);
            if (glide == "" && CODA.ContainsKey(nx))
            {
                var after = At(s, i + 1);
                var after2 = At(s, i + 2);
                var oIsOwnVowel = (after == "ອ" || after == "ວ")
                    && !(VSIGNS.Contains(after2) || LEAD.Contains(after2) || after2 == "ອ" || after2 == "ວ");
                var followsVowel = VSIGNS.Contains(after) || LEAD.Contains(after) || after == "ຼ" || oIsOwnVowel;
                if (!(IsCons(nx) && followsVowel)) { coda = CODA.GetValueOrDefault(nx) ?? ""; i++; }
            }
            if (coda == "" && glide == "" && At(s, i) == "ຽ" && (used > 0 || pre != "")) { coda = "j"; i++; }
            var onset = string.Concat(onsetCs.Select(g => ConsAt(g, 0) ?? "")) + cluster;
            var cls = leadHigh ? "high" : ConsAt(onsetCs[0], 1) ?? "mid";
            var codaOut = coda != "" ? coda : glide;
            var heavy = @long || quality.Contains("ː", StringComparison.Ordinal);
            var live = codaOut == "" ? heavy : SONORANT_CODA.IsMatch(codaOut);
            @out.Add(new SylF
            {
                Onset = onset, Quality = quality, Long = @long, CodaOut = codaOut,
                Cls = cls, Live = live, Mark = mark, Heavy = heavy,
            });
        }
        return @out;
    }

    /** Render the scanned syllables to IPA (onset + nucleus + tone + coda). */
    private static string Scan(string word) =>
        string.Join(".", ScanFeatures(word).Select(
            s => s.Onset + s.Quality + (s.Long ? "ː" : "") + Tone(s.Cls, s.Live, s.Heavy, s.Mark) + s.CodaOut));

    private static readonly JsRe TOKEN = JsRegex.Compile("([຀-໿]+)|(\\d+)|([.!?…,;:])", "gu");

    // ── Numbers ──────────────────────────────────────────────────────────────────────────────────────
    private static LaoNumbers NUM => Manifest.MANIFEST.Numbers;
    private static string[] LO_UNITS => NUM.Units;
    private static readonly (double V, string W)[] MAGNITUDES =
        NUM.Magnitudes.Select(r => (r[0].GetDouble(), r[1].GetString() ?? "")).ToArray();

    private static List<string> NumberToLaoWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
        {
            return Js.CodePoints((raw ?? Js.NumberToString(Math.Abs(n))))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => (Core.Numbers.DigitWord(LO_UNITS, d) ?? d))
                .ToList();
        }
        if (n == 0) return new List<string> { LO_UNITS[0] };
        var @out = new List<string>();
        var r = n;
        foreach (var (v, w) in MAGNITUDES)
        {
            if (r >= v)
            {
                var q = Math.Floor(r / v);
                @out.AddRange(NumberToLaoWords(q));
                @out.Add(w);
                r %= v;
            }
        }
        if (r >= 10)
        {
            var t = Math.Floor(r / 10);
            if (t == 2) @out.Add(NUM.Twenty);
            else if (t == 1) @out.Add(NUM.Ten);
            else { @out.Add(LO_UNITS[(int)t]); @out.Add(NUM.Ten); }
            r %= 10;
        }
        if (r == 1 && n >= 11) @out.Add(NUM.FinalOne);
        else if (r > 0) @out.Add(LO_UNITS[(int)r]);
        return @out;
    }

    /** Per-syllable tone-determining features (class × live/dead × length × mark) — for tone-table
     *  derivation/tests, mirroring the TS export. */
    public static List<(string Cls, bool Live, bool Long, string Mark)> WordFeatures(string word) =>
        ScanFeatures(Reorder(word)).Select(s => (s.Cls, s.Live, s.Heavy, s.Mark)).ToList();

    /** One Lao word → canonical IPA. */
    public static string PhonemizeWord(string word) => Scan(CancelSilent(Reorder(word)));

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // ⚠ FOLD THIS SCRIPT'S OWN DIGITS TO ASCII FIRST — the number token is `\d+`, ASCII-only.
            Clauses.AssembleClauses(Unicode.FoldNativeDigits(Normalize.NormalizeLao(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in NumberToLaoWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value)) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value == "?") sink.Pause("?");
                else if (m.Groups[3].Success && m.Groups[3].Value == "!") sink.Pause("!");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0
                         && ".…".Contains(m.Groups[3].Value, StringComparison.Ordinal)) sink.Pause(".");
            });
    }

    public static ILanguage CreateLao() => new Engine();

    internal static void RegisterSelf() => Registry.Register("lao", CreateLao);
}
