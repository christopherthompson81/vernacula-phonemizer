/**
 * Native Sundanese / Basa Sunda (su) text phonemizer — canonical IPA. Austronesian (West Java), modern LATIN
 * orthography plus the revived Aksara Sunda abugida (transliterated to Latin by SundaAksara — identical IPA).
 * Shallow and near-phonemic, so a flat left-to-right scan, glottal insertion, and penultimate stress.
 * Ported from src/languages/sundanese/sundanese.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sundanese;

public static class SundanesePhonemizer
{
    private static SundaneseDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static SundaneseNumbersDef NUM => DEF.Numbers;

    private const string VOWEL_PH = "aeiouəɨ";
    private static bool IsVowelPh(string s) => VOWEL_PH.Contains(s, StringComparison.Ordinal);

    /**
     * One Sundanese word → canonical IPA. Accepts BOTH scripts: the Latin orthography and Aksara Sunda,
     * which is transliterated to Latin first, then the shared g2p + glottal + stress runs.
     */
    public static string PhonemizeWord(string word)
    {
        var latin = SundaAksara.IsAksaraSunda(word) ? SundaAksara.AksaraToLatin(word) : word;
        var s = Js.CodePoints(Js.Normalize(Js.ToLowerCase(latin), NormalizationForm.FormC));
        var segs = new List<string>();
        for (var i = 0; i < s.Count;)
        {
            var two = s[i] + (i + 1 < s.Count ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(two, out var dg))
            {
                segs.Add(dg);
                i += 2;
                continue;
            }
            var c = s[i];
            if (DEF.Vowels.TryGetValue(c, out var v)) segs.Add(v);
            else if (DEF.Consonants.TryGetValue(c, out var k)) segs.Add(k);
            // else: unknown char → skip
            i++;
        }
        // Glottal stop: word-initial vowel (ʔawi), and between two IDENTICAL adjacent vowels (naam→naʔam).
        if (segs.Count > 0 && IsVowelPh(segs[0])) segs.Insert(0, DEF.Glottal);
        for (var i = segs.Count - 1; i > 0; i--)
            if (IsVowelPh(segs[i]) && segs[i] == segs[i - 1]) segs.Insert(i, DEF.Glottal);
        // Penultimate (weak) stress, shifted to the final vowel when the penult nucleus is a schwa.
        var vidx = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (IsVowelPh(segs[i])) vidx.Add(i);
        if (vidx.Count >= 2)
        {
            var penult = vidx[^2];
            var at = segs[penult] == "ə" ? vidx[^1] : penult;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /** Austronesian decimal composition: units + -belas teens + -puluh tens + ratus/rebu/yuta, sa- for a leading 1. */
    private static string ToWords(double n)
    {
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20)
            return n == 10 ? NUM.Seprefix + NUM.Puluh
                : n == 11 ? NUM.Seprefix + NUM.Belas
                : NUM.Units[(int)n - 10] + " " + NUM.Belas;
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return NUM.Units[(int)t] + " " + NUM.Puluh + (u != 0 ? " " + NUM.Units[(int)u] : "");
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            return (h == 1 ? NUM.Seprefix + NUM.Ratus : NUM.Units[(int)h] + " " + NUM.Ratus)
                + (r != 0 ? " " + ToWords(r) : "");
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            return (th == 1 ? NUM.Seprefix + NUM.Rebu : ToWords(th) + " " + NUM.Rebu)
                + (r != 0 ? " " + ToWords(r) : "");
        }
        double m = Math.Floor(n / 1_000_000), rm = n % 1_000_000;
        return (m == 1 ? NUM.Seprefix + NUM.Yuta : ToWords(m) + " " + NUM.Yuta)
            + (rm != 0 ? " " + ToWords(rm) : "");
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // Above 2^53 the float has already lost the low digits, so the numeral would be confidently wrong;
        // read it out digit-at-a-time THROUGH THE SAME COMPOSER. See core/numbers.ts `spellDigits`.
        var words = double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
            ? ToWords(n)
            : string.Join(" ", Js.CodePoints(digits).Select(d => ToWords(Js.Number(d))));
        return string.Join(" ", words.Split(' ').Select(PhonemizeWord));
    }

    // A word — Latin (incl. é) OR Aksara Sunda (letters + signs U+1B80–1BAF, 1BBA–1BBF).
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin", "Sundanese" })})|(\\d+)|([.?!,;:…])", "giu");

    /** This language's OWN inventory — the INVENTORY question, not the script-boundary one. */
    private const string NATIVE_CLASS = "[a-zéÉ\\u{1B80}-\\u{1BAF}\\u{1BBA}-\\u{1BBF}]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NORMALIZATION runs first, and AFTER NormalizeSundaDigits so the number rules see one digit set.
            return Clauses.AssembleClauses(
                Normalize.NormalizeSundanese(SundaAksara.NormalizeSundaDigits(input)), TOKEN, (m, sink) =>
                {
                    if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                    else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
                    else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    {
                        var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                        if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
                    }
                });
        }
    }

    /** Build the Sundanese phonemizer. */
    public static ILanguage CreateSundanese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("sundanese", () => CreateSundanese());
}
