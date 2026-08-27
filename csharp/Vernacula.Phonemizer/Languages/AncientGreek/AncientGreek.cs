/**
 * Ancient Greek (grc) phonemizer — a grapheme scan over NFD-decomposed polytonic text targeting 5th-BCE
 * Classical Attic. This file owns the combining-mark grammar (breathings, accents, iota subscript,
 * diaeresis, macron/breve), the context rules (γ-agma, σ-voicing, voiceless ρ, aspirate assimilation) and
 * the rough-breathing [h] prefix; the letter values live in ancientgreek.jsonc.
 * Ported from src/languages/ancientgreek/ancientgreek.ts.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.AncientGreek;

public static class AncientGreekPhonemizer
{
    // Combining marks (NFD): breathings, accents, iota subscript, diaeresis, length.
    private const string ROUGH = "̔";
    private const string SMOOTH = "̓";
    private const string ACUTE = "́";
    private const string GRAVE = "̀";
    private const string CIRCUM = "͂";
    private const string SUBSCRIPT = "ͅ";
    private const string DIAERESIS = "̈";
    private const string MACRON = "̄";
    private const string BREVE = "̆";

    private static readonly HashSet<string> MARKS =
        [ROUGH, SMOOTH, ACUTE, GRAVE, CIRCUM, SUBSCRIPT, DIAERESIS, MACRON, BREVE];

    private static AncientGreekDef DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string[]> VOWEL => DEF.Vowels;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> DIPHTHONG => DEF.Diphthongs;

    /** γ → [ŋ] before one of these PHONES (the ⟨γγ γκ γχ γξ⟩ nasal). */
    private static readonly HashSet<string> VELAR = new(DEF.Velars);

    /** ⟨σ ς⟩ → [z] before one of these LETTERS. */
    private static readonly HashSet<string> VOICED_AFTER_S = new(DEF.VoicedAfterSigma);

    private sealed class Unit
    {
        public string Base = "";
        public HashSet<string> Marks = [];
    }

    private static bool HasAcc(HashSet<string>? m) =>
        m is not null && (m.Contains(ACUTE) || m.Contains(GRAVE) || m.Contains(CIRCUM));

    /** One Ancient Greek (polytonic) word → canonical IPA (5th-BCE Attic). */
    public static string PhonemizeWord(string word)
    {
        // ⚠ NFD FIRST, THEN LOWERCASE, and `Js.ToLowerCase` rather than .NET's: JS lowercases Σ to the FINAL
        // ς in final position and .NET returns σ in every culture. ⟨ς⟩ is a grapheme key here.
        var s = Js.CodePoints(Js.ToLowerCase(word.Normalize(NormalizationForm.FormD)));
        // Group base letters with their following combining marks.
        var units = new List<Unit>();
        for (var i = 0; i < s.Count; i++)
        {
            var c = s[i];
            if (MARKS.Contains(c)) continue; // stray mark (shouldn't lead)
            var marks = new HashSet<string>();
            while (i + 1 < s.Count && MARKS.Contains(s[i + 1])) marks.Add(s[++i]);
            units.Add(new Unit { Base = c, Marks = marks });
        }
        // Rough breathing on a word-INITIAL vowel → a prefixed [h].
        var hPrefix = "";
        if (units.Count > 0 && VOWEL.ContainsKey(units[0].Base) && units[0].Marks.Contains(ROUGH)) hPrefix = "h";
        // (A rough breathing may also sit on the 2nd vowel of an initial diphthong — αὑ, εὑ.)
        if (units.Count >= 2 && VOWEL.ContainsKey(units[0].Base) && units[1].Marks.Contains(ROUGH)) hPrefix = "h";

        var phs = new List<string>();
        var accents = new List<string>();
        for (var i = 0; i < units.Count; i++)
        {
            var u = units[i];
            var bas = u.Base;
            if (VOWEL.TryGetValue(bas, out var pair))
            {
                var next = i + 1 < units.Count ? units[i + 1] : null;
                var ownAccent = HasAcc(u.Marks) ? "́" : "";
                // DIPHTHONG: base + ⟨ι υ⟩ offglide (unless the offglide has a DIAERESIS) — the diphthong
                // carries an accent from EITHER element (μοῦσα: circumflex on the ⟨υ⟩).
                if (next is not null && (next.Base == "ι" || next.Base == "υ") && !next.Marks.Contains(DIAERESIS)
                    && DIPHTHONG.TryGetValue(bas + next.Base, out var dip))
                {
                    phs.Add(dip);
                    accents.Add(ownAccent != "" ? ownAccent : HasAcc(next.Marks) ? "́" : "");
                    i++;
                    continue;
                }
                // IOTA SUBSCRIPT → long vowel + [i̯]; MACRON → long; else the base [short/long]. A plain vowel
                // keeps only ITS OWN accent, not the next vowel's — θεός→tʰeós, the acute stays on the ⟨ο⟩.
                var lng = u.Marks.Contains(MACRON) || u.Marks.Contains(SUBSCRIPT);
                var ph = pair[lng && !u.Marks.Contains(BREVE) ? 1 : 0];
                if (u.Marks.Contains(SUBSCRIPT)) ph += "i̯";
                phs.Add(ph);
                accents.Add(ownAccent);
                continue;
            }
            // γ → [ŋ] before a velar (γ κ χ ξ) OR ⟨μ⟩ (the agma: δεδεγμένος→dedeŋménos), else [ɡ].
            if (bas == "γ")
            {
                var nx = i + 1 < units.Count ? units[i + 1].Base : "";
                var nph = CONS.TryGetValue(nx, out var c2) ? c2 : nx == "γ" ? "ɡ" : "";
                phs.Add(VELAR.Contains(nph) || nx == "γ" || nx == "μ" ? "ŋ" : "ɡ");
                accents.Add("");
                continue;
            }
            // ⟨σ ς⟩ → [z] before a voiced consonant.
            if ((bas == "σ" || bas == "ς")
                && VOICED_AFTER_S.Contains(i + 1 < units.Count ? units[i + 1].Base : ""))
            {
                phs.Add("z");
                accents.Add("");
                continue;
            }
            // ⟨ρ⟩ → the VOICELESS [r̥] word-initially (an initial ρ always carries the rough breathing ῥ),
            // when it carries the rough mark, or in a ⟨ρρ⟩ cluster; a plain intervocalic ⟨ρ⟩ is [r].
            if (bas == "ρ")
            {
                var voiceless = i == 0 || u.Marks.Contains(ROUGH)
                    || (i - 1 >= 0 && units[i - 1].Base == "ρ")
                    || (i + 1 < units.Count && units[i + 1].Base == "ρ");
                phs.Add(voiceless ? "r̥" : "r");
                accents.Add("");
                continue;
            }
            if (CONS.TryGetValue(bas, out var cph)) { phs.Add(cph); accents.Add(""); }
            // else: punctuation/unknown → skip
        }
        // ASPIRATE ASSIMILATION: a plain stop before its aspirate counterpart aspirates too (πφ→[pʰpʰ],
        // τθ→[tʰtʰ], κχ→[kʰkʰ]: Σαπφώ→sapʰpʰɔ́ː, Βάκχε→bákʰkʰe).
        for (var k = 0; k < phs.Count - 1; k++)
        {
            var a = phs[k];
            var b = phs[k + 1];
            if ((a == "p" && b == "pʰ") || (a == "t" && b == "tʰ") || (a == "k" && b == "kʰ")) phs[k] = b;
        }
        // Place the pitch accent (combining acute) on the vowel that carries it, then join.
        var body = new StringBuilder();
        for (var k = 0; k < phs.Count; k++) body.Append(phs[k]).Append(accents[k]);
        return (hPrefix + body).Normalize(NormalizationForm.FormC);
    }

    // Polytonic Greek letters + all the combining diacritics + the precomposed range. Word / number / punct.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "([\\u0370-\\u03ff\\u1f00-\\u1fff\\u0300-\\u036f]+)|(\\d+)|([.\\u0387\\u037e!?;\\u00b7,:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            Clauses.AssembleClauses(Normalize.NormalizeAncientGreek(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                // Numbers: compose the Greek numeral phrase (καὶ-linked, myriad-grouped), then phonemize each.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var p = m.Groups[3].Value;
                    sink.Pause(p == "." || p == ";" || p == ";" ? "." : ",");
                }
            });
    }

    /** Build the Ancient Greek phonemizer (polytonic → 5th-BCE Attic reconstructed IPA). */
    public static ILanguage CreateAncientGreek() => new Engine();

    internal static void RegisterSelf() => Registry.Register("ancientgreek", () => CreateAncientGreek());
}
