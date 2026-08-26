/**
 * Somali (so) phonemizer — Af-Soomaali (1972 Latin orthography), canonical IPA, rule g2p. Somali prominence
 * is an unwritten grammatical pitch-accent, so no stress/tone mark is emitted (segmental output only).
 * Ported from src/languages/somali/somali.ts — see that file for the convention and its referees.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Somali;

public static class SomaliPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Phonemize a single Somali word to canonical IPA (no tone/stress mark — Somali tone is unwritten). */
    public static string PhonemizeWord(string word) =>
        string.Concat(G2p.ToSegments(word).Select(s => s.Ph));

    // A word (Somali letters + apostrophe for the glottal stop, incl. the typographic ’) / number /
    // punctuation. g2p normalizes ’→', but the tokenizer must accept ’ or it would split su’aal.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "'ʼ’")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class rejects carries a letter Somali does not use. */
    private const string NATIVE_CLASS = "[a-z'ʼ’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // NORMALIZATION runs first — it must see the text BEFORE tokenization, because most of what it
            // repairs (a grouping `,`, a decimal `.`, a clock `:`) is a character TOKEN would hand to
            // `clausePunctuation` as a pause.
            Clauses.AssembleClauses(Normalize.NormalizeSomali(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
                }
            });
    }

    /** Build the Somali phonemizer (rule g2p; tone deferred). */
    public static ILanguage CreateSomali() => new Engine();

    internal static void RegisterSelf() => Registry.Register("somali", CreateSomali);
}
