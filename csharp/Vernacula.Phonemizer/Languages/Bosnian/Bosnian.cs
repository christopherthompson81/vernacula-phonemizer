/**
 * Bosnian (bs) phonemizer — the third Serbo-Croatian standard. The SEGMENTAL g2p is Serbian's
 * (`SerbianPhonemizer.PhonemizeWord`, one phonological system across sr/hr/bs); the only Bosnian delta is the
 * cardinal number table. Written in BOTH Gaj's Latin and Cyrillic, so the tokenizer admits both scripts.
 * Ported from src/languages/bosnian/bosnian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Serbian;

namespace Vernacula.Phonemizer.Languages.Bosnian;

public sealed class BosnianPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // A Bosnian word — both scripts (Cyrillic + Gaj's Latin incl. č ć š ž đ) / number / punctuation token.
    // ⚠ THE EXTRA CLASS CARRIES RANGES (`а-шђјљњћџ`) AND `HostWordRun` DELIBERATELY DOES NOT REWRITE IT —
    // relocating the hyphens would collapse the ranges and silently drop twenty-two letters.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "а-шђјљњћџ")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this rejects carries a letter the language does not use.
     *  ⚠ `й` is excluded deliberately (it is Russian, not Serbo-Croatian); see the TS. */
    private const string NATIVE_CLASS = "[а-ик-шђјљњћџa-zčćšžđ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeBosnian(input), TOKEN, (m, sink) =>
        {
            // `ForeignLetters` BEFORE `Nat`: the fold is spelled in Gaj's Latin, so what reaches the script
            // normaliser is already native spelling. Without it ⟨q w x y⟩ are DELETED.
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(SerbianPhonemizer.PhonemizeWord(Nat(SerbianPhonemizer.ForeignLetters(m.Groups[1].Value))));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ⚠ THE TOKEN STRING IS PASSED AS `raw` (#1059) — the digit-by-digit fallback cannot recover
                // the digits from the double.
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(SerbianPhonemizer.PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Bosnian phonemizer (shared Serbo-Croatian g2p + Bosnian cardinal numbers). */
    public static ILanguage CreateBosnian() => new BosnianPhonemizer();

    internal static void RegisterSelf() => Registry.Register("bosnian", CreateBosnian);
}
