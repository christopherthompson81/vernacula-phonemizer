/**
 * Lingala / Lingála (ln) phonemizer — Bantu (C30B), Latin orthography, canonical IPA. A major lingua franca of
 * the Congo basin (~20M native + ~20–25M L2). Authored from Meeuwis (2020), "A Grammatical Overview of
 * Lingála" (Revised & Extended Edition), which describes the prestige KINSHASA variety.
 *
 * A greedy longest-match g2p plus accent-based tone:
 *   · prenasalised obstruents are SINGLE onset units — ⟨mb nd ng nz⟩ → ᵐb ⁿd ᵑɡ ⁿz (homorganic ᵐ/ⁿ/ᵑ; §2.2);
 *     ⟨ny⟩ → ɲ, semi-vowels ⟨w y⟩ → w j. Only 13 consonant phonemes; no native /r/ or /h/ (loan graphemes).
 *   · 7 vowel graphemes a e ɛ i o ɔ u rendered as written. ⚠ Kinshasa is phonemically 5-vowel (ɛ/ɔ merged into
 *     e/o; §2.1.1), so the ⟨e⟩=/e/~/ɛ/ collapse of casual spelling is an unrecoverable gap — ɛ/ɔ are rendered
 *     only where the (careful/northwestern) orthography writes them. NO diphthongs: vowel sequences are
 *     HIATUS, each vowel its own tone-bearing nucleus (mái = ma.i; §2.1.5). No vowel harmony, length, or
 *     phonemic nasalisation.
 *   · TONE (H/L, meaning-distinctive; §2.4) is marked only in careful writing: acute → H (˥), háček → rising
 *     (˩˥), circumflex → falling (˥˩), unmarked → L (˩). Applied per nucleus; casual toneless input → all L.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lingala;

public sealed class LingalaPhonemizer : ILanguage
{
    private static LingalaDef DEF => Manifest.DEF;

    // Consonant grapheme keys, longest first (digraphs mb/nd/ny before singles).
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
            // consonant graphemes (prenasalised digraphs before singles)
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
            // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it deletes
            // content the writer typed. `latinPhone` is consulted HERE, after every digraph and single-letter rule
            // has been tried, so it can never override a reading this language has an opinion about.
            outp += LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 }) ?? "";
            i += 1;
        }
        return outp.Normalize(NormalizationForm.FormC);
    }

    // ── Numbers (Meeuwis §3.6: cardinal = the connective ya + the ordinal; compounds joined by na) ──────────────
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
        // The scale ladder above kámá. ⚠ THE SCALES DO NOT SHARE ONE SHAPE: kóto is INVARIANT and always carries an
        // explicit multiplier (kóto mǒkó = 1 000), while the higher scales are class-alternating nouns whose
        // SINGULAR stands alone for a multiplier of 1 and whose PLURAL takes the multiplier (efúku = 10⁶,
        // bifúku míbalé = 2×10⁶). Driving them all off one multiplier list collapses 100 000, 10⁶ and 10⁹ together.
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
        // NORMALIZATION runs first (normalize.ts), on NFC text — it matches literals like `bôngó` and
        // `T.B.`, which only exist as such before the NFD below splits their accents off. It is pure
        // text→text, so everything it emits is then read by the ordinary word and number paths.
        // NFD so precomposed accented vowels (á í ǒ …) become base+combining and are captured by TOKEN's
        // combining-mark range (else the accent splits the word and the vowel is dropped).
        var normalized = Normalize.NormalizeLingala(input).Normalize(NormalizationForm.FormD);
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var num = Js.Number(m.Groups[2].Value);
                if (double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d && num >= 0 && num < 1e12)
                    foreach (var w in CardinalWords(num).Split(' ')) sink.Emit(PhonemizeWord(w));
                // ⚠ THE ELSE USED TO EMIT THE RAW DIGIT STRING, i.e. ASCII inside the IPA. Above the
                // authored 10¹² range the digits are read one at a time instead — see amharic.ts.
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
