/**
 * Lithuanian / lietuvių (lt) phonemizer — Baltic (Indo-European), Latin script, ~3M. A RULE-based g2p
 * (G2p.cs): a left-to-right scan + the hard/soft PALATALIZATION contrast (consonants → Cʲ before front
 * vowels / the softening ⟨i⟩, spreading through clusters) + regressive VOICING assimilation + n→ŋ before
 * velars. STRESS is lexical and pitch-accented (unpredictable from spelling) → not marked, which is where
 * this engine parts company with its sibling Latvian. Numbers are composed by Numbers.cs (the Baltic
 * three-way counted-noun concord).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lithuanian;

public sealed class LithuanianPhonemizer : ILanguage
{
    /** One Lithuanian word → canonical IPA (segmental; stress not marked). */
    public static string PhonemizeWord(string word) =>
        string.Concat(G2p.ToSegments(word).Select(s => s.Ph));

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name,
     * which `Nat` then folds to a base the g2p does have a rule for. See Core/HostWord.cs.
     */
    private const string NATIVE_CLASS = "[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
     * out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and
     * the rest of the word started over: `São Paulo` fragmented into three pieces, none of them right.
     * Invisible to every gate: no digit or raw mark survives and nothing VANISHES.
     */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    public string Text(string input)
    {
        // NORMALIZATION FIRST — see Normalize.cs. Every unit, sign and currency reading lives there rather
        // than in `Core/NormalizeSymbols.cs`, because every Lithuanian counted noun takes the Baltic
        // three-way concord (`1 procentas` / `2 procentai` / `10 procentų`) and the shared tier holds one
        // invariant string per unit. The rules words-ify their own operands and call `Agree`.
        // ⚠ THE INITIALISM PASS RUNS SECOND, and the order is load-bearing: it must see abbreviation dots
        // that are already spent, or `1802 m.` reads as the letter EM. Romans are digits before either
        // runs — lt is not in the registry's ROMAN_NATIVE, so the shared Roman pass wraps `Text`.
        var text = Normalize.NormalizeLithuanianInitialisms(Normalize.NormalizeLithuanian(input));
        return Clauses.AssembleClauses(text, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var tok = m.Groups[2].Value;
                foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Lithuanian phonemizer (rule g2p; stress not marked). */
    public static ILanguage CreateLithuanian() => new LithuanianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("lithuanian", CreateLithuanian);
}
