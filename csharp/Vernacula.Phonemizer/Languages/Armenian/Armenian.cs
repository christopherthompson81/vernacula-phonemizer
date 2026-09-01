/**
 * Native Armenian text phonemizer — canonical IPA. A left-to-right greedy scan over a grapheme table with
 * digraphs, word-initial glides and schwa epenthesis, PARAMETERIZED by a dialect manifest so Eastern (hy)
 * and Western (hyw) can share it.
 * Ported from src/languages/armenian/armenian.ts — see that file for the referee evidence and for the
 * per-key attestation behind every symbol-tier declaration.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Armenian;

public sealed class ArmenianDef
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string>? PostConsonantDigraphs { get; init; }
    public NumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** Irregular ordinals; the regular suffix rule stays in Normalize.cs. Shared with hyw. */
    public IReadOnlyDictionary<string, string> IrregularOrdinals { get; init; } = new Dictionary<string, string>();
}

/** A dialect's engine: the word g2p plus its phonemizer factory (TS `makeArmenianEngine`'s return). */
public sealed class ArmenianEngine
{
    private static readonly JsRe VOWEL_PH = JsRegex.Compile("[ɑeiouəʏœ]", "u");
    private static readonly JsRe SONORANT_PH = JsRegex.Compile("^[lmnɾrj]", "u");

    private static bool IsVowelPh(string p) => VOWEL_PH.IsMatch(p);
    private static bool IsSonorant(string p) => SONORANT_PH.IsMatch(p);

    private readonly ArmenianDef def;
    private readonly Func<string, string> pre;
    private readonly IReadOnlyDictionary<string, string> map;
    private readonly IReadOnlyList<Digraph> digraphs;
    private readonly IReadOnlyList<Digraph> postCDigraphs;
    private readonly HashSet<string> onsetStop;

    internal ArmenianEngine(ArmenianDef def, Func<string, string> pre)
    {
        this.def = def;
        this.pre = pre;
        // ⚠ VOWELS SECOND, like the TS object spread: they win the shared ⟨ո⟩ key (→ o bare).
        var m = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var kv in def.Consonants) m[kv.Key] = kv.Value;
        foreach (var kv in def.Vowels) m[kv.Key] = kv.Value;
        map = m;
        // Longest-first so a 3-char sequence is tried before a 2-char one. ⚠ STABLE, like JS's sort:
        // same-length keys keep the manifest's declaration order.
        digraphs = def.Digraphs.OrderByDescending(kv => kv.Key.Length)
            .Select(kv => new Digraph(Js.CodePoints(kv.Key), kv.Value)).ToList();
        postCDigraphs = (def.PostConsonantDigraphs ?? new Dictionary<string, string>())
            .OrderByDescending(kv => kv.Key.Length)
            .Select(kv => new Digraph(Js.CodePoints(kv.Key), kv.Value)).ToList();
        onsetStop = new HashSet<string>(
            new[] { "պ", "տ", "կ", "փ", "թ", "ք" }.Select(g => map[g]), StringComparer.Ordinal);
    }

    /** A valid 2-consonant onset: ⟨ս/շ⟩+stop, or any consonant + the glide ⟨յ⟩→[j]. */
    private bool ValidOnset2(string a, string b) => ((a == "s" || a == "ʃ") && onsetStop.Contains(b)) || b == "j";

    /** Armenian schwa epenthesis (Vaux 1998, simplified) — see the TS for the account. */
    private void Epenthesize(List<string> outp)
    {
        if (outp.Count == 0) return; // TS: every arm below no-ops on an empty array
        if (!outp.Any(IsVowelPh)) { outp.Add("ə"); return; }
        var lv = -1;
        for (var i = outp.Count - 1; i >= 0; i--)
            if (IsVowelPh(outp[i])) { lv = i; break; }
        var last = outp[^1];
        if (outp.Count - 1 - lv >= 2 && !IsSonorant(outp[^2]) && IsSonorant(last) && last != "m")
            outp.Insert(outp.Count - 1, "ə");
        var fv = outp.Count;
        for (var i = 0; i < outp.Count; i++)
            if (IsVowelPh(outp[i])) { fv = i; break; }
        if (fv >= 2)
        {
            if (ValidOnset2(outp[0], outp[1]))
            {
                if (fv > 2) outp.Insert(2, "ə");
            }
            else outp.Insert(1, "ə");
        }
    }

    /** One digraph entry, its key already split into code points (TS re-splits `[...k]` per candidate). */
    private sealed record Digraph(List<string> Key, string Phone);

    /** Does `chars` carry `key` starting at `i`? TS `chars.slice(i, i + [...k].length).join("") === k`. */
    private static bool MatchesAt(List<string> chars, int i, List<string> key)
    {
        if (i + key.Count > chars.Count) return false;
        for (var j = 0; j < key.Count; j++)
            if (!string.Equals(chars[i + j], key[j], StringComparison.Ordinal)) return false;
        return true;
    }

    /** One Armenian word → canonical IPA. */
    public string PhonemizeWord(string word)
    {
        var chars = Js.CodePoints(Js.ToLowerCase(word));
        var outp = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var prevPh = outp.Count > 0 ? outp[^1] : null;
            if (prevPh != null && !IsVowelPh(prevPh))
            {
                var pc = postCDigraphs.FirstOrDefault(d => MatchesAt(chars, i, d.Key));
                if (pc != null) { outp.Add(pc.Phone); i += pc.Key.Count - 1; continue; }
            }
            var dg = digraphs.FirstOrDefault(d => MatchesAt(chars, i, d.Key));
            if (dg != null)
            {
                outp.Add(dg.Phone);
                i += dg.Key.Count - 1;
                continue;
            }
            if (i == 0)
            {
                if (c == "ե") { outp.Add("je"); continue; }
                if (c == "ո") { outp.Add(i + 1 < chars.Count && chars[i + 1] == "վ" ? "o" : "vo"); continue; }
                if (c == "և") { outp.Add("jev"); continue; }
            }
            if (c == "և") { outp.Add("ev"); continue; }
            if (map.TryGetValue(c, out var ph)) outp.Add(ph);
            // else: unknown char (skip)
        }
        Epenthesize(outp);
        return string.Concat(outp);
    }

    private string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return Numbers.SpellDigits(digits, def.Numbers, PhonemizeWord);
        return Numbers.RenderNumber(n, def.Numbers, PhonemizeWord, Core.Numbers.westernNumberWords);
    }

    // Armenian letters (U+0530–058F) + the ligature և; number; Armenian + ASCII punctuation.
    /** The three marks Armenian writes INSIDE a word (՛ շեշտ, ՜ բացականչական, ՞ հարցական) sit over the
     *  last vowel, so TOKEN's letter class splits the word at each one. Undone here, in the engine, rather
     *  than in a dialect's normalizer — the tokenizer is shared, so the defect was too. ՞ moves to the end
     *  of the word, where it reads as the question pause it is; ՛ and ՜ stay silent. See the TS docstring
     *  for the corpus measurement and for Western's ⟨կ՛⟩ proclitic, which wants the same treatment. */
    private static readonly JsRe INTRA_WORD_MARK = JsRegex.Compile(@"[Ա-Ֆա-ևև]+(?:[՛՜՞][Ա-Ֆա-ևև]+)+", "gu");
    private static readonly JsRe MARK_CHARS = JsRegex.Compile(@"[՛՜՞]", "gu");

    private static string UnbreakMarks(string s) => Rewrite(s, INTRA_WORD_MARK, m =>
    {
        var bare = MARK_CHARS.Replace(m.Value, "");
        return m.Value.Contains('՞') ? $"{bare}՞" : bare;
    });

    private static readonly JsRe TOKEN = JsRegex.Compile(@"([Ա-Ֆա-ևև]+)|(\d+)|([.?!,;:…՝՞։])", "gu");

    private sealed class ArmenianPhonemizer : ILanguage
    {
        private readonly ArmenianEngine e;
        internal ArmenianPhonemizer(ArmenianEngine e) => this.e = e;

        public string Text(string input) =>
            Clauses.AssembleClauses(e.pre(UnbreakMarks(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(e.PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(e.Number(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = e.def.ClausePunctuation.GetValueOrDefault(m.Groups[3].Value);
                    if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
                }
            });
    }

    public ILanguage Create() => new ArmenianPhonemizer(this);
}

public static class Armenian
{
    /** Build a full Armenian engine (phonemizer + word g2p) from one dialect manifest. `pre` is the
     *  dialect's own text-normalization pass — an omitted one is the identity. ⚠ The orthographic facts
     *  about the SCRIPT (the ՛ ՜ ՞ marks that TOKEN would otherwise split a word on) live in the ENGINE,
     *  not in a `pre`: written into one dialect's pass, the other dialect keeps the defect. */
    public static ArmenianEngine MakeArmenianEngine(ArmenianDef def, Func<string, string>? pre = null) =>
        new(def, pre ?? (s => s));

    /**
     * The shared SYMBOL tier for EASTERN Armenian only. Every word is sourced in the header of the TS
     * `normalize.ts`; `գ`, `֏` and Latin `m` are withheld there with the measurement that withholds them.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "տոկոս" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "դոլար" }, ["€"] = new[] { "եվրո" },
        },
        Magnitudes = new[] { "միլիոն", "միլիարդ", "տրիլիոն", "հազար" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["կմ"] = new[] { "կիլոմետր" }, ["սմ"] = new[] { "սանտիմետր" }, ["մմ"] = new[] { "միլիմետր" },
            ["կգ"] = new[] { "կիլոգրամ" }, ["հա"] = new[] { "հեկտար" }, ["դմ"] = new[] { "դեցիմետր" },
            ["մ"] = new[] { "մետր" },
            ["km"] = new[] { "կիլոմետր" }, ["cm"] = new[] { "սանտիմետր" }, ["mm"] = new[] { "միլիմետր" },
            ["kg"] = new[] { "կիլոգրամ" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "քառակուսի" },
            Cubed = new[] { "խորանարդ" },
            Position = ExponentPosition.Before,
        },
    });

    // ⚠ normalize FIRST, then the tier — the ordinal, suffix, era and unit+suffix steps need the number and
    // its written suffix still adjacent, which the tier would break.
    private static readonly ArmenianEngine Eastern =
        MakeArmenianEngine(Manifest.MANIFEST, s => SYMBOLS(Normalize.NormalizeArmenian(s)));

    /** One Eastern Armenian word → canonical IPA. */
    public static string PhonemizeWord(string word) => Eastern.PhonemizeWord(word);

    /** Build the Eastern Armenian phonemizer. */
    public static ILanguage CreateArmenian() => Eastern.Create();

    internal static void RegisterSelf() => Registry.Register("armenian", CreateArmenian);
}
