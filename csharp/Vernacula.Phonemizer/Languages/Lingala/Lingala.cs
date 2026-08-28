/**
 * Lingala / Lingála (ln) phonemizer — Bantu (C30B), Latin orthography, canonical IPA.
 * Ported from src/languages/lingala/lingala.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Lingala;

public sealed class LingalaPhonemizer : ILanguage
{
    private static LingalaDef DEF => Manifest.DEF;

    // ⚠ ORDER IS LOAD-BEARING: longest grapheme first, so the prenasalised digraphs ⟨mb nd ng nz ny⟩ are
    // claimed as single onset units before the single letters can split them.
    private static readonly IReadOnlyList<string> CKEYS =
        DEF.Consonants.Keys.OrderByDescending(k => k.Length).ToList();
    private const string ACUTE = "́", GRAVE = "̀", CIRC = "̂", CARON = "̌";
    private static readonly IReadOnlyDictionary<string, string> TONE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        [ACUTE] = "˥", [GRAVE] = "˩", [CIRC] = "˥˩", [CARON] = "˩˥",
    };

    /** One Lingala word → canonical IPA (segmental + per-nucleus tone). */
    public static string PhonemizeWord(string word)
    {
        var s = word.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var outp = "";
        var i = 0;
        while (i < s.Length)
        {
            var matched = false;
            foreach (var k in CKEYS)
            {
                if (s.AsSpan(i).StartsWith(k, StringComparison.Ordinal))
                {
                    outp += DEF.Consonants[k];
                    i += k.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            var c = s[i].ToString();
            if (DEF.Vowels.TryGetValue(c, out var v))
            {
                outp += v;
                var mark = i + 1 < s.Length ? s[i + 1].ToString() : "";
                outp += TONE.TryGetValue(mark, out var t) ? t : "˩"; // tone from the combining accent; unmarked → L
                i += TONE.ContainsKey(mark) ? 2 : 1;
                continue;
            }
            // Fall-through, consulted only after every digraph and single-letter rule has declined: a letter
            // with no rule still denotes a sound, so read it generically rather than dropping it.
            outp += LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 }) ?? "";
            i += 1;
        }
        return outp.Normalize(NormalizationForm.FormC);
    }

    private static LingalaNumbersDef NUM => DEF.Numbers;

    private static string CardinalWords(double n)
    {
        if (n < 0) return "";
        if (n == 0) return NUM.Zero; // libungutúlu
        if (n <= 10) return NUM.Ordinals[(int)n - 1];
        if (n < 20) return $"{NUM.Ten} {NUM.And} {NUM.Ordinals[(int)(n % 10) - 1]}";
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            var tens = $"{NUM.Tens} {NUM.Ordinals[(int)t - 1]}";
            return u == 0 ? tens : $"{tens} {NUM.And} {NUM.Ordinals[(int)u - 1]}";
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            var hun = $"{NUM.Hundred} {NUM.Ordinals[(int)h - 1]}";
            return r == 0 ? hun : $"{hun} {NUM.And} {CardinalWords(r)}";
        }
        var SCALES = new (double Value, string Sg, string? Pl)[]
        {
            (1_000_000_000, NUM.Billion, NUM.Billions),
            (1_000_000, NUM.Million, NUM.Millions),
            (100_000, NUM.HundredThousand, NUM.HundredThousands),
            (10_000, NUM.TenThousand, NUM.TenThousands),
            (1000, NUM.Thousand, null), // invariant → always "kóto <multiplier>"
        };
        foreach (var (value, sg, pl) in SCALES)
        {
            if (n < value) continue;
            double q = Math.Floor(n / value), r = n % value;
            var head = pl is null
                ? $"{sg} {CardinalWords(q)}"
                : q == 1 ? sg : $"{pl} {CardinalWords(q)}";
            return r == 0 ? head : $"{head} {NUM.And} {CardinalWords(r)}";
        }
        return "";
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([a-zɛɔ̀-ͯ]+)|(\\d+)|([.?!,;:])", "giu");

    public string Text(string input)
    {
        // ⚠ ORDER: normalization runs FIRST, on NFC text — its literals (`bôngó`, `T.B.`) only exist as such
        // before the NFD below splits the accents off. Then NFD, so precomposed accented vowels become
        // base+combining and are captured by TOKEN's combining-mark range instead of splitting the word.
        var normalized = Renormalize(Normalize.NormalizeLingala(input), NormalizationForm.FormD);
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var num = Js.Number(m.Groups[2].Value);
                if (double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d && num >= 0 && num < 1e12)
                    foreach (var w in CardinalWords(num).Split(' ')) sink.Emit(PhonemizeWord(w));
                else
                    foreach (var c in m.Groups[2].Value)
                        foreach (var w in CardinalWords(Js.Number(c.ToString())).Split(' ')) sink.Emit(PhonemizeWord(w));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (DEF.ClausePunctuation.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Lingala phonemizer. */
    public static ILanguage CreateLingala() => new LingalaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("lingala", CreateLingala);
}
