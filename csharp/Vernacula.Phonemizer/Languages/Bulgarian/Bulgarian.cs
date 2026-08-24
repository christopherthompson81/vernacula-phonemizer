/**
 * Native Bulgarian / български (bg) text phonemizer — canonical IPA. South Slavic, Cyrillic.
 * Bulgarian is highly phonemic, so a left-to-right grapheme scan + a small set of well-defined post-rules recovers
 * the pronunciation: PALATALISATION (only before ь я ю — not и/е, unlike Russian), DARK-L (л→[l] before a front
 * vowel, [lʲ] before ь/я/ю, [ɫ] elsewhere), the velar nasal (н→ŋ before к/ɡ), FINAL DEVOICING, REGRESSIVE VOICING
 * assimilation (with /v/ voicing-transparent as [v]), SIBILANT assimilation (с/з→ʃ before ʃ/t͡ʃ), and cluster
 * simplification (стк→ск, stop-geminate collapse). STRESS is unwritten (lexical) and Bulgarian vowel reduction is
 * stress-conditioned, so we emit the FULL phonemic vowels and the reduction is folded in the referee eval.
 * Validated against two independent human referees.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bulgarian;

public sealed class BgNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Hundreds { get; init; } = new Dictionary<string, string>();
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Billions { get; init; } = "";
    public IReadOnlyDictionary<string, string> Masculine { get; init; } = new Dictionary<string, string>();
    public string And { get; init; } = "";
}

public sealed class BulgarianDef
{
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> PalatalizingLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> FrontVowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public BgNumbersDef Numbers { get; init; } = new();
}

public sealed class BulgarianPhonemizer : ILanguage
{
    private static readonly BulgarianDef DEF = LoadManifest.Load<BulgarianDef>("languages/bulgarian", "bulgarian.jsonc");
    private static IReadOnlyDictionary<string, string> L => DEF.Letters;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static BgNumbersDef NUM => DEF.Numbers;

    private static IReadOnlySet<string> VOWELS => Ipa.IPA_VOWEL;
    // The ⟨л⟩ environments (bulgarian.jsonc): [lʲ] before a palatalizer, [l] before a front vowel, else [ɫ].
    private static readonly IReadOnlySet<string> FRONT = new HashSet<string>(DEF.FrontVowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> PAL = new HashSet<string>(DEF.PalatalizingLetters, StringComparer.Ordinal);
    // Voiced obstruent → voiceless (final devoicing + regressive assimilation before a voiceless obstruent).
    private static readonly IReadOnlyDictionary<string, string> DEVOICE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["b"] = "p", ["v"] = "f", ["ɡ"] = "k", ["d"] = "t", ["ʒ"] = "ʃ", ["z"] = "s", ["d͡ʒ"] = "t͡ʃ", ["d͡z"] = "t͡s",
    };
    private static readonly IReadOnlyDictionary<string, string> VOICE =
        DEVOICE.ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOICELESS =
        new HashSet<string>(DEVOICE.Values.Concat(new[] { "x", "ʃt" }), StringComparer.Ordinal);

    private static string Base(string t) => t.Replace("ʲ", "", StringComparison.Ordinal);
    private static bool IsCons(string t) => t != "" && !VOWELS.Contains(Js.CodePoints(Base(t))[0]);

    private static readonly JsRe STRESS_MARKS = JsRegex.Compile("['́̀]", "gu");

    /** Phonemize a single Bulgarian word to canonical IPA (full phonemic vowels; stress/reduction not emitted). */
    public static string PhonemizeWord(string word)
    {
        var w = STRESS_MARKS.Replace(word.ToLowerInvariant(), "");
        var chars = Js.CodePoints(w);
        var toks = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var nxt = i + 1 < chars.Count ? chars[i + 1] : "";
            if (c == "л")
            {
                toks.Add(PAL.Contains(nxt) ? "lʲ" : FRONT.Contains(nxt) ? "l" : "ɫ");
            }
            else if (c == "я" || c == "ю")
            {
                var v = c == "я" ? "a" : "u";
                string? last = toks.Count > 0 ? toks[^1] : null;
                if (last is not null && IsCons(last) && last != "j")
                {
                    if (!last.EndsWith("ʲ", StringComparison.Ordinal)) toks[^1] = last + "ʲ";
                    toks.Add(v);
                }
                else
                {
                    toks.Add("j");
                    toks.Add(v);
                }
            }
            else if (c == "ь")
            {
                string? last = toks.Count > 0 ? toks[^1] : null;
                if (last is not null && IsCons(last) && !last.EndsWith("ʲ", StringComparison.Ordinal)) toks[^1] = last + "ʲ";
            }
            else
            {
                if (L.TryGetValue(c, out var ph)) toks.Add(ph);
            }
        }
        return ApplyPhonotactics(toks);
    }

    /** The ordered consonant post-rules (each keyed on the token's base, preserving any ʲ). */
    private static string ApplyPhonotactics(List<string> toks)
    {
        static string Suf(string t) => t.EndsWith("ʲ", StringComparison.Ordinal) ? "ʲ" : "";
        // н → ŋ before a velar stop к/ɡ (not before the fricative х).
        for (var k = 0; k < toks.Count - 1; k++)
            if (Base(toks[k]) == "n" && (Base(toks[k + 1]) == "k" || Base(toks[k + 1]) == "ɡ")) toks[k] = "ŋ" + Suf(toks[k]);
        // Word-final devoicing.
        var last = toks.Count - 1;
        if (last >= 0 && DEVOICE.TryGetValue(Base(toks[last]), out var dv)) toks[last] = dv + Suf(toks[last]);
        // Regressive voicing assimilation (right-to-left). /v/ is voicing-transparent AS [v] (it does not trigger),
        // but once /v/ itself devoices to [f] before a voiceless obstruent, that [f] does trigger the preceding one.
        for (var k = toks.Count - 2; k >= 0; k--)
        {
            string b = Base(toks[k]), nb = Base(toks[k + 1]);
            if (nb == "v") continue;
            if (DEVOICE.TryGetValue(b, out var d) && VOICELESS.Contains(nb)) toks[k] = d + Suf(toks[k]);
            else if (VOICE.TryGetValue(b, out var vo) && DEVOICE.ContainsKey(nb)) toks[k] = vo + Suf(toks[k]);
        }
        // т-elision in the -стк- cluster (s·t·k → s·k): аболиционистка → …iska.
        var outp = new List<string>();
        for (var k = 0; k < toks.Count; k++)
        {
            if (toks[k] == "t" && k > 0 && Base(toks[k - 1]) == "s" && k + 1 < toks.Count && Base(toks[k + 1]) == "k") continue;
            outp.Add(toks[k]);
        }
        toks = outp;
        // Stop-geminate collapse (тт/дд/кк/пп/бб/гг → single); fricative/sonorant geminates (ss, nn) are KEPT.
        outp = new List<string>();
        foreach (var t in toks)
        {
            if (outp.Count > 0 && outp[^1] == t && new[] { "t", "d", "k", "p", "b", "ɡ" }.Contains(Base(t))) continue;
            outp.Add(t);
        }
        toks = outp;
        // Sibilant assimilation: с/з → ʃ before a postalveolar ʃ or t͡ʃ (сч→ʃt͡ʃ, сш→ʃʃ).
        for (var k = 0; k < toks.Count - 1; k++)
            if ((Base(toks[k]) == "s" || Base(toks[k]) == "z") && (Base(toks[k + 1]) == "ʃ" || Base(toks[k + 1]) == "t͡ʃ"))
                toks[k] = "ʃ";
        return string.Concat(toks);
    }

    // ── Numbers (decimal; Bulgarian) ──────────────────────────────────────────────
    /** Build the Bulgarian words for n; "и" precedes the final component (сто двайсет и три; сто и три). */
    private static string NumberToText(double n)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n == 10) return NUM.Ten;
        if (n < 20) return NUM.Teens[(int)n - 11];
        if (n < 100)
        {
            var t = NUM.Tens[Js.NumberToString(Math.Floor(n / 10) * 10)];
            var u = (int)(n % 10);
            return u != 0 ? $"{t} {NUM.And} {NUM.Units[u]}" : t;
        }
        if (n < 1000)
        {
            var h = NUM.Hundreds[Js.NumberToString(Math.Floor(n / 100))];
            var r = n % 100;
            if (r == 0) return h;
            return $"{h} {(r < 20 || r % 10 == 0 ? NUM.And + " " : "")}{NumberToText(r)}";
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var thWord = th == 1 ? NUM.Thousand : $"{NumberToText(th)} {NUM.Thousands}";
            if (r == 0) return thWord;
            return $"{thWord} {(r < 100 || r % 100 == 0 ? NUM.And + " " : "")}{NumberToText(r)}";
        }
        // ⚠ милион / милиард (10⁶ / 10⁹) ARE MASCULINE, so unlike the feminine хиляда they take a masculine
        // multiplier and the COUNT plural -а above one (един милион, два милиона, пет милиарда).
        // ⚠ Without a composer for them, 10⁶+ falls through to the digit string and the g2p emits EMPTY IPA.
        foreach (var (value, sg, pl) in new (double, string, string)[]
                 {
                     (1_000_000_000d, NUM.Billion, NUM.Billions), (1_000_000d, NUM.Million, NUM.Millions),
                 })
        {
            if (n >= value)
            {
                double q = Math.Floor(n / value), r = n % value;
                // The count plural is used for every multiplier except one ending in 1 (…и един милион).
                var qWord = MasculineText(q);
                var mWord = $"{qWord} {(q % 10 == 1 ? sg : pl)}";
                if (r == 0) return mWord;
                return $"{mWord} {(r < 100 || r % 100 == 0 ? NUM.And + " " : "")}{NumberToText(r)}";
            }
        }
        return Js.NumberToString(n);
    }

    private static readonly JsRe LAST_WORD = JsRegex.Compile("\\S+$", "u");

    /** Like `numberToText` but with the MASCULINE 1/2 (един/два, not едно/две) that милион/милиард require. */
    private static string MasculineText(double n)
    {
        var key = Js.NumberToString(n % 10);
        if (!NUM.Masculine.TryGetValue(key, out var m) || (n > 10 && n < 20)) return NumberToText(n); // teens have no masculine alternation
        if (n < 10) return m;
        return LAST_WORD.Replace(NumberToText(n), m); // …двайсет и ЕДИН, сто и ДВА
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
        // refuse to COMPOSE — the float has already lost the low digits — but the refusal returned the digit
        // string, which no g2p in this fleet reads. Read it out digit-at-a-time instead, THROUGH THE SAME
        // COMPOSER: a one-digit number is a call this engine already answers.
        var words = double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
            ? NumberToText(n)
            : string.Join(" ", Js.CodePoints(digits).Select(d => NumberToText(Js.Number(d))));
        return string.Join(" ", words.Split(' ').Where(w => w.Length > 0).Select(w => PhonemizeWord(w)));
    }

    // A word (Bulgarian Cyrillic) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile("([а-яёА-ЯЁ']+)|(\\d+)|([.!?…,;:—])", "gu");

    public string Text(string rawInput)
    {
        // everything the g2p cannot read is rewritten to Bulgarian words FIRST — see normalize.ts,
        // in particular the `N г.` year abbreviation (265 instances, the largest defect) and why there is
        // no ordinal-dot rule here despite it being the largest rule in the Germanic languages.
        return Clauses.AssembleClauses(Normalize.NormalizeBulgarian(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Bulgarian phonemizer (phonemic g2p + phonotactics; stress/reduction not emitted). */
    public static ILanguage CreateBulgarian() => new BulgarianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("bulgarian", CreateBulgarian);
}
