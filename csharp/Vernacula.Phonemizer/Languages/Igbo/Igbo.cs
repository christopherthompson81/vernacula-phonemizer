/**
 * Native Igbo / Asụsụ Igbo (ig) text phonemizer — canonical IPA. A phonemic Latin orthography → rule-based
 * g2p: labial-velars ⟨gb⟩/⟨kp⟩, the labialised series, the 8-vowel harmony with dotted ị/ọ/ụ, syllabic m̩/n̩,
 * and TWO tones read ONLY when the diacritic is written (standard orthography usually omits them).
 * Ported from src/languages/igbo/igbo.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Igbo;

public sealed class IgboPhonemizer : ILanguage
{
    private static IgboDef DEF => Manifest.MANIFEST;

    private const string DOT_BELOW = "̣", ACUTE = "́", GRAVE = "̀", MACRON = "̄";
    private const string DOT_ABOVE = "̇";
    private static readonly IReadOnlySet<string> TONE_MARK =
        new HashSet<string>(new[] { ACUTE, GRAVE, MACRON }, StringComparer.Ordinal);

    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal);

    private static string ToneOf(string mark) =>
        mark == ACUTE ? DEF.Tones.High : mark == GRAVE ? DEF.Tones.Low : DEF.Tones.Down;

    /** One Igbo word → canonical IPA (segments + tone-when-marked). */
    public static string PhonemizeWord(string word)
    {
        var s = Js.CodePoints(Js.Normalize(Js.ToLowerCase(word), NormalizationForm.FormD));
        var n = s.Count;
        var outp = new StringBuilder();

        for (var i = 0; i < n;)
        {
            var c = s[i];
            // Base vowel + combining marks: dot-below → the [-ATR] ị/ọ/ụ; tone accent → Chao letter.
            if (IsVowelLetter(c))
            {
                var ipa = DEF.Vowels[c];
                var tone = "";
                var dot = false;
                i++;
                while (i < n && (s[i] == DOT_BELOW || TONE_MARK.Contains(s[i])))
                {
                    if (s[i] == DOT_BELOW) dot = true;
                    else tone = ToneOf(s[i]);
                    i++;
                }
                if (dot) ipa = c == "i" ? "ɪ" : c == "o" ? "ɔ" : c == "u" ? "ʊ" : ipa;
                outp.Append(ipa).Append(tone);
                continue;
            }
            // Syllabic nasal: m/n directly before a tone mark (ḿ, ǹ) → m̩/n̩ carrying that tone.
            if ((c == "m" || c == "n") && TONE_MARK.Contains(i + 1 < n ? s[i + 1] : ""))
            {
                outp.Append(c == "m" ? "m̩" : "n̩").Append(ToneOf(s[i + 1]));
                i += 2;
                continue;
            }
            // ⟨ṅ⟩ (n with dot ABOVE, U+0307) → ŋ.
            if (c == "n" && i + 1 < n && s[i + 1] == DOT_ABOVE)
            {
                outp.Append('ŋ');
                i += 2;
                continue;
            }
            // Digraphs (longest-first): ch/gb/gh/gw/kp/kw/nw/ny/sh.
            var dg = c + (i + 1 < n ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(dg, out var d) && d.Length > 0)
            {
                outp.Append(d);
                i += 2;
                continue;
            }
            if (DEF.Consonants.TryGetValue(c, out var k))
            {
                outp.Append(k);
                i++;
                continue;
            }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            outp.Append(LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
            i++;
        }
        return outp.ToString().Normalize(NormalizationForm.FormC);
    }

    // A word = Latin letters (incl. accented/dotted) plus combining marks.
    private static readonly JsRe TOKEN = JsRegex.Compile("([A-Za-zÀ-ɏḀ-ỿ̀-ͯ]+)|(\\d+)|([.?!,;:])", "gu");

    private IgboPhonemizer() { }

    public string Text(string input)
    {
        // Normalization BEFORE tokenizing: TOKEN is a three-way split that skips every symbol it does not
        // name, so a symbol has to become an Igbo word before it gets here.
        return Clauses.AssembleClauses(Normalize.NormalizeIgbo(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            // ⚠ DIGITS GO TO THE IGBO COMPOSITOR, NEVER TO A FOREIGN READER. And this engine takes no
            // `foreign` parameter: it never read the one it used to declare, and an unclaimed Latin run
            // reaches English through Clauses' FLEET DEFAULT instead.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (DEF.ClausePunctuation.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Igbo phonemizer. */
    public static ILanguage CreateIgbo() => new IgboPhonemizer();

    internal static void RegisterSelf() =>
        Registry.Register("igbo", CreateIgbo);
}
