/**
 * Shan (shn) phonemizer — a per-syllable abugida scan (the Burmese template), canonical IPA. Owns the
 * syllable machinery: onset → medials → the RIME resolver → the explicit lexical tone, plus the ႉ-tone
 * glottalisation, the ⟨ꧦ⟩ repetition mark and the number compositor; every table it reads is data in
 * shan.jsonc.
 * Ported from src/languages/shan/shan.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Shan;

public static class ShanPhonemizer
{
    private static ShanDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> ONSET => DEF.Onsets;
    private static IReadOnlyDictionary<string, string> CODA => DEF.Codas;
    private static IReadOnlyDictionary<string, string> TONE => DEF.Tones;
    private static string UNMARKED_TONE => DEF.UnmarkedTone;
    private static IReadOnlyDictionary<string, string> PALATAL => DEF.Palatal;
    private static IReadOnlyDictionary<string, string> VSIGN => DEF.VowelSigns;

    private const string ASAT = "်"; // U+103A — kills a consonant → coda
    private const string MED_Y = "ျ", MED_R = "ြ", MED_W1 = "ွ", MED_W2 = "ႂ";
    private static readonly HashSet<string> MEDIALS = new(new[] { MED_Y, MED_R, MED_W1, MED_W2 }, StringComparer.Ordinal);

    /** JS `s[i]` on a code-point array — `undefined` past either end. */
    private static string? At(IReadOnlyList<string> s, int i) => i >= 0 && i < s.Count ? s[i] : null;

    private static bool IsVSign(string? c) => c != null && VSIGN.ContainsKey(c);
    private static bool IsOnset(string? c) => c != null && ONSET.ContainsKey(c);

    /**
     * Resolve the rime → { nucleus, glide } from the vowel-sign keys, the medial -w-, whether there is a
     * coda, and the offglide letter.
     */
    private static (string Nucleus, string Glide) Rime(List<string> keys, bool medialW, bool closed, string offglide)
    {
        bool Has(string k) => keys.Contains(k, StringComparer.Ordinal);
        var noSign = keys.Count == 0;
        if (medialW && noSign) return (closed || offglide != "" ? "ɔ" : "ɔː", offglide);
        if (Has("uu") && !Has("i"))
        {
            if (offglide == "w") return ("oː", "");
            return (closed || offglide != "" ? "o" : "uː", offglide);
        }
        if (Has("i") && Has("uu"))
            return (closed && offglide != "w" ? "ɤ" : "ɤː", offglide == "w" ? "" : offglide);
        if (Has("i") && Has("u"))
            return (offglide == "w" ? "ɯː" : closed ? "ɯ" : "ɯː", offglide == "w" ? "" : offglide);
        if (Has("ee") && Has("aa")) return ("ɔː", offglide);
        string nucleus;
        if (Has("aa")) nucleus = "aː";
        else if (Has("ii")) nucleus = "iː";
        else if (Has("u")) nucleus = closed || offglide != "" ? "u" : "uː";
        else if (Has("ee")) nucleus = "eː";
        else if (Has("ee_open")) nucleus = "ɛː";
        else if (Has("i")) nucleus = closed || offglide != "" ? "i" : "iː";
        else if (Has("e_short")) nucleus = "e";
        else if (Has("ee_short")) nucleus = "ɛ";
        else nucleus = closed || offglide != "" ? "a" : "aː";
        return (nucleus, offglide);
    }

    /** ⟨ꧦ⟩ U+A9E6 MYANMAR MODIFIER LETTER SHAN REDUPLICATION — "say the preceding syllable again". */
    private const string REDUPLICATION = "ꧦ";

    /** Phonemize one Shan word → canonical IPA: per-syllable abugida scan + explicit tone. */
    public static string PhonemizeWord(string word)
    {
        var s = Js.CodePoints(Js.Normalize(word, NormalizationForm.FormC));
        var n = s.Count;
        var @out = new StringBuilder();
        var last = ""; // the syllable just emitted, for ⟨ꧦ⟩ to repeat
        var i = 0;
        while (i < n)
        {
            // ⚠ BEFORE the onset test, because ⟨ꧦ⟩ is not an onset and the `continue` below would step over it.
            if (s[i] == REDUPLICATION) { @out.Append(last); i++; continue; }
            if (!IsOnset(s[i])) { i++; continue; }
            var onset = ONSET[s[i]];
            i++;
            var glide = "";
            bool palatal = false, roundW = false, plainW = false;
            while (i < n && MEDIALS.Contains(s[i]))
            {
                if ((s[i] == MED_W1 || s[i] == MED_W2) && At(s, i + 1) == ASAT) break; // ⟨ွ/ႂ⟩+asat is a CODA offglide
                if (s[i] == MED_Y) palatal = true;
                else if (s[i] == MED_R) glide = "r";
                else if (s[i] == MED_W1) roundW = true;
                else plainW = true;
                i++;
            }
            var medialW = roundW;
            if (palatal) onset = PALATAL.TryGetValue(onset, out var pj) ? pj : onset + "j";
            var keys = new List<string>();
            while (i < n && IsVSign(s[i])) { keys.Add(VSIGN[s[i]]); i++; }
            string coda = "", offglide = "";
            if (keys.Contains("FINAL_Y", StringComparer.Ordinal)) offglide = "j";
            if (At(s, i + 1) == ASAT && (IsOnset(At(s, i)) || At(s, i) == MED_W2 || At(s, i) == MED_W1))
            {
                var cd = At(s, i) == MED_W2 ? "ɰ"
                    : At(s, i) == MED_W1 ? "w"
                    : CODA.TryGetValue(s[i], out var c) ? c : "";
                if (cd == "w" || cd == "j" || cd == "ɰ") offglide = cd;
                else coda = cd;
                i += 2;
            }
            var tone = UNMARKED_TONE;
            while (i < n && TONE.TryGetValue(s[i], out var t)) { tone = t; i++; }
            // Tone 5 (ႉ, ˦˨) GLOTTALISES on a NON-word-final syllable.
            if (tone == "˦˨")
            {
                for (var k = i; k < n; k++) if (IsOnset(s[k])) { tone += "ˀ"; break; }
            }
            var realKeys = keys.Where(k => k != "FINAL_Y").ToList();
            var (nucleus, og) = Rime(realKeys, medialW, coda != "" || offglide != "", offglide);
            var medialGlide = glide == "r" ? "r" : plainW || (roundW && realKeys.Count != 0) ? "w" : "";
            last = onset + medialGlide + nucleus + og + coda + tone;
            @out.Append(last);
        }
        return Js.Normalize(@out.ToString(), NormalizationForm.FormC);
    }

    // ── Numbers ──────────────────────────────────────────────────────────────────────────────────────
    private static ShanNumbers NUM => DEF.Numbers;
    private static string[] SHN_UNITS => NUM.Units;

    /** `numbers.magnitudes` projected out of its `[number, string][]` JSON shape once. */
    private static readonly (double V, string W)[] MAGNITUDES =
        Manifest.DEF.Numbers.Magnitudes.Select(p => (p[0].GetDouble(), p[1].GetString() ?? "")).ToArray();

    public static List<string> NumberToShanWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
        {
            return Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => SHN_UNITS[(int)Js.Number(d)])
                .ToList();
        }
        if (n == 0) return new List<string> { SHN_UNITS[0] };
        var @out = new List<string>();
        var r = n;
        foreach (var (v, w) in MAGNITUDES)
        {
            if (r >= v)
            {
                var q = Math.Floor(r / v);
                @out.AddRange(NumberToShanWords(q));
                @out.Add(w);
                r %= v;
            }
        }
        if (r >= 10)
        {
            var t = Math.Floor(r / 10);
            if (t == 2) @out.Add(NUM.Twenty); // 20 = သၢဝ်း alone (သၢဝ်းသွင် = 22)
            else if (t == 1) @out.Add(NUM.Ten);
            else { @out.Add(SHN_UNITS[(int)t]); @out.Add(NUM.Ten); }
            r %= 10;
        }
        if (r == 1 && n >= 11) @out.Add(NUM.FinalOne); // final 1 in a compound → ဢဵတ်း
        else if (r > 0) @out.Add(SHN_UNITS[(int)r]);
        return @out;
    }

    /** The shared SYMBOL tier — DELIBERATELY SMALL; see the TS for what is refused and why. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "တေႃႇလႃႇ" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "ၵီႇလူဝ်ႇမီႇတႃႇ" },
            ["m"] = new[] { "မီႇတႃႇ" },
        },
        Ampersand = "လႄႈ",
    });

    // ⚠ THE DECIMAL DOT IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `.` claims it as a FULL
    // STOP and `4.54` reads as "four ⟨sentence break⟩ fifty-four".
    private static readonly JsRe TOKEN =
        JsRegex.Compile(@"([က-၉၌-ႏႚ-႟ꧠ-꧿ꩠ-ꩿ]+)|(\d+(?:\.\d+)?|[႐-႙]+)|([၊။.!?…,;:])", "gu");

    /** BURMESE-ONLY CONSONANTS — the COMPLEMENT of the Shan inventory, so a Shan word can never match. */
    private static readonly JsRe BURMESE_ONLY = JsRegex.Compile("[က-ဃစ-ဏဒ-နဖ-ဘဟ-အ]", "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // normalize FIRST — it folds the native digits itself and its clock, degree and era steps need
            // the figures still adjacent to their marks — then the shared symbol tier.
            Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeShan(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    // ⚠ THE ROUTER FIRST, THE OLD BEHAVIOUR AS THE FALLBACK. `ReadForeignRun` declines when
                    // no router is registered, and declining must not delete the text.
                    var foreign = BURMESE_ONLY.IsMatch(m.Groups[1].Value) ? Foreign.ReadForeignRun(m.Groups[1].Value) : null;
                    if (foreign != null) { if (foreign != "") sink.Emit(foreign); return; }
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                }
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var parts = m.Groups[2].Value.Split('.');
                    var intPart = parts[0];
                    foreach (var wd in NumberToShanWords(Js.Number(intPart), intPart)) sink.Emit(PhonemizeWord(wd));
                    // ⚠ NO SEPARATOR WORD, AND THAT IS A MEASURED REFUSAL — the fractional digits are read
                    // one at a time.
                    if (parts.Length > 1)
                        foreach (var dg in parts[1])
                            foreach (var wd in NumberToShanWords(Js.Number(dg.ToString()), dg.ToString()))
                                sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var p = m.Groups[3].Value;
                    sink.Pause(p == "။" || p == "." || p == "!" || p == "?" ? "." : ",");
                }
            });
    }

    /** Build the Shan phonemizer (abugida syllable scan + explicit lexical tone). */
    public static ILanguage CreateShan() => new Engine();

    internal static void RegisterSelf() => Registry.Register("shan", CreateShan);
}
