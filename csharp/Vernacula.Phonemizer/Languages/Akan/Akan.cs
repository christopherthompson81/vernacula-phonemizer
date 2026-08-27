/**
 * Native Akan / Akan kasa (ak) text phonemizer — canonical IPA. Ported from src/languages/akan/akan.ts,
 * whose header carries the sources (Dolphyne 1988; Paster 2010) and the reasoning for every rule below.
 *
 * The orthography is shallow, so the letter maps in akan.jsonc carry most of the g2p and only five things
 * are contextual: the digraph series, glide formation, the two nasal rules, ATR harmony, and the lexical
 * tone overlay.
 *
 * ⚠ SINGLE-SOURCE: the only referee is a small kaikki human-gold set — there is no wikipron and no epitran
 * Akan — so nothing here is cross-checked against an independent transcription.
 */
using System.Text;

using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Akan;

public static class AkanPhonemizer
{
    private static readonly AkanDef DEF = Manifest.MANIFEST;

    /** Tone + vowel-nasality lexicon (word → comma-joined per-nucleus tokens: H/L, `~` if nasal). Akan tone
     *  is LEXICAL — unpredictable from the toneless orthography — so a lexicon carries it and the rules
     *  apply on top. Small coverage (OOV = no tone); consumed by the SHIPPED path only, never by
     *  `PhonemizeWordRules`, which stays tone-free so the referee signal is non-circular. */
    private static Dictionary<string, string>? _toneLex;
    private static Dictionary<string, string> ToneLex() =>
        _toneLex ??= LoadTsv.LoadTsvMap("languages/akan", "akan-tone.tsv", optional: true);

    private const string TILDE = "̃"; // combining nasalisation

    private static bool IsVowel(string? c) => c is not null && DEF.Vowels.ContainsKey(c);

    /**
     * ATR HARMONY (Paster 2010 rule 4/5, Dolphyne 1988): the orthography merges the [+ATR]/[−ATR] mid pairs
     * — ⟨e⟩ is [e] or [ɪ], ⟨o⟩ is [o] or [ʊ] — and the value is fixed by the word's harmony. The unambiguous
     * triggers are ⟨i u⟩ (+ATR) and ⟨ɛ ɔ⟩ (−ATR); ⟨a⟩ is neutral and ⟨e o⟩ are the ambiguous targets, which
     * take the ATR of their nearest trigger, defaulting to +ATR when the word has none.
     * ⚠ SPREAD FORWARDS THEN BACKWARDS, in that order — the second pass must not overwrite what the first
     * settled, which is why each pass only fills a slot still holding no value.
     */
    internal static Dictionary<int, bool> AtrByIndex(IReadOnlyList<string> s)
    {
        var idx = new List<int>();
        var val = new List<bool?>();
        for (var k = 0; k < s.Count; k++)
        {
            var c = s[k];
            if (!DEF.Vowels.ContainsKey(c)) continue;
            idx.Add(k);
            val.Add(c == "i" || c == "u" ? true : c == "ɛ" || c == "ɔ" ? false : null);
        }
        bool? last = null;
        for (var k = 0; k < val.Count; k++) { if (val[k] is not null) last = val[k]; else if (last is not null) val[k] = last; }
        last = null;
        for (var k = val.Count - 1; k >= 0; k--) { if (val[k] is not null) last = val[k]; else if (last is not null) val[k] = last; }
        var m = new Dictionary<int, bool>();
        for (var k = 0; k < idx.Count; k++) m[idx[k]] = val[k] ?? true;
        return m;
    }

    private static readonly JsRe NASAL_TAIL = JsRegex.Compile("[mnɲŋ]$", "u");

    /** JS `Number.isSafeInteger`. Above 2^53 the double has already lost its low digits. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** One Akan word → canonical IPA. `useTone` overlays the lexical tone + vowel-nasality (shipped path). */
    private static string PhonemizeCore(string word, bool useTone)
    {
        var lw = Js.ToLowerCase(word);
        var s = Js.CodePoints(lw).ToList();
        var n = s.Count;
        var atr = AtrByIndex(s);
        var outp = new List<string>();
        var i = 0;
        while (i < n)
        {
            var c = s[i];
            var nx = i + 1 < n ? s[i + 1] : null;
            var two = c + (nx ?? "");
            // Consonant digraphs first (ky gy hy ny tw dw kw gw hw nw ng).
            if (DEF.Digraphs.TryGetValue(two, out var dg)) { outp.Add(dg); i += 2; continue; }
            if (DEF.Vowels.TryGetValue(c, out var v))
            {
                // GLIDE FORMATION (Paster 2010): a round vowel o/ɔ/u before a DIFFERENT vowel becomes [w]
                // (boa→bwa, uafɔn→wafɔ̃) — the round vowel's mora deletes. Not before the SAME vowel, where
                // ⟨uu oo⟩ are length rather than a glide.
                if ("oɔu".Contains(c, StringComparison.Ordinal) && IsVowel(nx) && nx != c) { outp.Add("w"); i += 1; continue; }
                // ATR harmony resolves the ambiguous mid letters: ⟨e⟩ → [e]/[ɪ], ⟨o⟩ → [o]/[ʊ].
                if (c == "e") { outp.Add(atr.TryGetValue(i, out var a1) && a1 ? "e" : "ɪ"); i += 1; continue; }
                if (c == "o") { outp.Add(atr.TryGetValue(i, out var a2) && a2 ? "o" : "ʊ"); i += 1; continue; }
                outp.Add(v); i += 1; continue;
            }
            // ⟨n⟩: an onset before a vowel stays n; before a consonant it assimilates to that consonant's
            // PLACE (velar k/g → ŋ, labial p/b/f/m → m, else n; word-final stays n).
            if (c == "n")
            {
                var p = IsVowel(nx) ? "n"
                    : nx == "k" || nx == "g" ? "ŋ"
                    : nx == "p" || nx == "b" || nx == "f" || nx == "m" ? "m"
                    : "n";
                outp.Add(p); i += 1; continue;
            }
            if (c == "ŋ") { outp.Add("ŋ"); i += 1; continue; }
            // LABIAL NASALIZATION (Paster 2010 rule 8): /b/ → [m] after a nasal (mb → mm, n-bisa → mmisa).
            if (c == "b")
            {
                outp.Add(NASAL_TAIL.IsMatch(outp.Count > 0 ? outp[^1] : "") ? "m" : "b");
                i += 1; continue;
            }
            if (DEF.Consonants.TryGetValue(c, out var cn)) { outp.Add(cn); i += 1; continue; }
            if (c == TILDE) { if (outp.Count > 0) outp[^1] += TILDE; i += 1; continue; }
            // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it
            // deletes content the writer typed. Consulted HERE, after every digraph and single-letter rule,
            // so it can never override a reading this language has an opinion about.
            {
                var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
                if (p is not null) outp.Add(p);
            }
            i += 1;
        }
        // TONE + vowel-nasality overlay (shipped path): Chao letters (H→˥, L→˩) and ◌̃ on each nucleus.
        if (useTone && ToneLex().TryGetValue(lw, out var pat))
        {
            var toks = pat.Split(',');
            var nuc = new List<int>();
            for (var k = 0; k < outp.Count; k++) if (Ipa.IPA_VOWEL.Contains(outp[k])) nuc.Add(k);
            // ⚠ ONLY WHEN THE COUNTS AGREE. A lexicon row written against a different segmentation would
            // otherwise attach tones to the wrong nuclei, which is worse than emitting none.
            if (toks.Length == nuc.Count)
                for (var k = 0; k < nuc.Count; k++)
                {
                    var t = toks[k];
                    outp[nuc[k]] += (t.Contains('~', StringComparison.Ordinal) ? TILDE : "")
                                  + (t.Length > 0 && t[0] == 'H' ? "˥" : "˩");
                }
        }
        return string.Concat(outp).Normalize(NormalizationForm.FormC);
    }

    /** One Akan word → canonical IPA (segmental + ATR harmony + lexical tone/nasality where known). */
    public static string PhonemizeWord(string word) => PhonemizeCore(word, true);

    /** Rule-only path (segmental + ATR, NO tone lexicon) — the non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string word) => PhonemizeCore(word, false);

    // ── Numbers (compositional; standard Asante Twi cardinals, space-joined counting form) ──────────────
    private static AkanNumbers NUM => DEF.Numbers;

    private static string Under100(int n)
    {
        if (n < 10) return NUM.Units[n - 1];
        if (n == 10) return NUM.Ten;
        if (n < 20) return $"{NUM.Ten} {NUM.Units[n - 11]}";
        int t = n / 10, u = n % 10;
        return u == 0 ? NUM.Tens[t - 2] : $"{NUM.Tens[t - 2]} {NUM.Units[u - 1]}";
    }

    private static string Under1000(int n)
    {
        if (n < 100) return Under100(n);
        int h = n / 100, r = n % 100;
        return r == 0 ? NUM.Hundreds[h - 1] : $"{NUM.Hundreds[h - 1]} {Under100(r)}";
    }

    /**
     * Twi cardinal for a non-negative integer (big-to-small). Each magnitude is the singular noun alone
     * (apem, ɔpepem) or the plural + multiplier (mpem mmienu). Every multiplier goes through `Under1000`,
     * so the top magnitude bounds what can be said: ≥10¹² would need a multiplier ≥1000 and has no word.
     * ⚠ `n` IS A SAFE INTEGER HERE BY CONSTRUCTION — the caller refuses to compose above 2^53 — so the
     * digit-by-digit arm below never sees an exponent-form string.
     */
    private static string NumberWords(double n)
    {
        if (n == 0) return NUM.Zero;
        if (n >= 1e12)
            return string.Join(" ", Js.NumberToString(n).Select(d => d == '0' ? NUM.Zero : NUM.Units[d - '0' - 1]));
        var parts = new List<string>();
        var bil = (long)Math.Floor(n / 1e9);
        var mil = (long)Math.Floor(n % 1e9 / 1e6);
        var th = (long)Math.Floor(n % 1e6 / 1000);
        var r = (long)(n % 1000);
        if (bil > 0) parts.Add(bil == 1 ? NUM.Billion : $"{NUM.Billions} {Under1000((int)bil)}");
        if (mil > 0) parts.Add(mil == 1 ? NUM.Million : $"{NUM.Millions} {Under1000((int)mil)}");
        if (th > 0) parts.Add(th == 1 ? NUM.Thousand : $"{NUM.Thousands} {Under1000((int)th)}");
        if (r > 0) parts.Add(Under1000((int)r));
        return string.Join(" ", parts);
    }

    /**
     * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted
     * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter
     * the language does not use, i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[A-Za-zɛɔƐƆ̃]";

    /** ⚠ EXPORTED FOR the reachability guard, which asserts every lexicon key survives its own fold. */
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
    // out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and
    // the rest of the word started over: `São Paulo` fragmented into three pieces, none of them right.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:])", "gu");

    private sealed class AkanEngine : ILanguage
    {
        public string Text(string input) =>
            // TEXT NORMALIZATION first — the pre-tokenizer pass that rewrites what is not already a
            // pronounceable word into words this tokenizer speaks. See Normalize.cs for the corpus counts.
            Clauses.AssembleClauses(Normalize.NormalizeAkan(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO BE EMITTED STRAIGHT INTO THE IPA. Refusing
                    // to COMPOSE is right — the float has already lost the low digits — but the else
                    // emitted the token itself, which is not a reading. Digit-at-a-time through the same
                    // number words instead. ⚠ Over the TOKEN, not over a re-stringified double: the double
                    // is precisely what cannot be trusted here.
                    var tok = m.Groups[2].Value;
                    var num = double.Parse(tok, System.Globalization.CultureInfo.InvariantCulture);
                    if (IsSafeInteger(num))
                        foreach (var w in NumberWords(num).Split(' ')) sink.Emit(PhonemizeWord(w));
                    else
                        foreach (var d in tok)
                            foreach (var w in NumberWords(d - '0').Split(' ')) sink.Emit(PhonemizeWord(w));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (DEF.ClausePunctuation.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
                }
            });
    }

    /**
     * Build the Akan phonemizer.
     *
     * ⚠ NO `foreign` PARAMETER, AND THAT IS A DECISION RATHER THAN AN OMISSION — see the TS. Akan is a
     * Latin-script language, TOKEN claims every Latin run, `Nat` folds any out-of-inventory letter to one
     * this g2p has a rule for, and `PhonemizeWord` always answers. Routing to English would require
     * deciding which Latin words are NOT Akan, a lexicon this repo does not have for this language.
     */
    public static ILanguage CreateAkan() => new AkanEngine();

    internal static void RegisterSelf() => Registry.Register("akan", () => CreateAkan());
}
