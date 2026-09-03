/**
 * Nigerian Pidgin / Naija (pcm) phonemizer — an English-lexified creole, canonical IPA. A lexicon of
 * irregular media spellings, a nativiser from CMUdict English IPA into Naija phonology, and a Naija-value
 * rule g2p for everything else.
 * Ported from src/languages/naija/naija.ts — see that file for the corpus evidence behind the symbol tier,
 * the initialism gate, the ordinal marker and the provisional clock reading.
 */
using System.Text;
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Naija;

/// <summary>Dict-only English lookup: the CMUdict-derived citation IPA if the word is known English, else
/// null (TS `string | undefined`) — an OOV word the rule g2p reads phonemically instead.</summary>
public delegate string? ForeignPhonemizer(string latin);

public sealed class NaijaPhonemizer : ILanguage
{
    private static NaijaManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static NaijaNumbersDef NUM => DEF.Numbers;
    private static NaijaOrdinalsDef ORD => DEF.Ordinals;
    private static IReadOnlyDictionary<string, string> LETTER => DEF.LetterNames;

    // English vowels (for the onset-/r/ lookahead), before nativisation collapses them. Stress and length are
    // stripped by the first rule, so no mark class is needed here.
    // ⚠ `ᵻ` WAS MISSING AND THAT DELETED ONSET /r/ (#1250) — `reports` read *ipɔts*. Audited over the
    // 117,479-word dict: `ᵻ` (×828) is the only vowel that can follow an `ɹ`/`r` here and was absent; every
    // other character that can is a consonant or the word end. See the TS.
    private const string V = "iɪeɛæaɑɔoʊuʌəɐᵻ";
    // The same vowels ONE STEP EARLIER, for the two NURSE/lettER rules — one step earlier `ɚ`/`ɝ` are still
    // in the string, and they are VOWELS: an `ɚ` before another one is pre-vocalic (#1250, review). Looking
    // ahead for V alone ate the onset /r/ of `ɚɚ` — `caterer` read *ketaa* — in 96 dict words.
    private const string PRE_V = V + "ɚɝ";

    private static readonly JsRe N_STRESS = JsRegex.Compile("[ˈˌː]", "gu");
    private static readonly JsRe N_PRICE = JsRegex.Compile("aᶦ", "gu");
    private static readonly JsRe N_MOUTH = JsRegex.Compile("aᶷ", "gu");
    private static readonly JsRe N_CHOICE = JsRegex.Compile("[ɔo]ᶦ", "gu");
    private static readonly JsRe N_FACE = JsRegex.Compile("eᶦ", "gu");
    private static readonly JsRe N_GOAT = JsRegex.Compile("[oə]ᶷ", "gu");
    // NURSE/lettER. ⚠ THE r IS ABSORBED ONLY IN CODA (#1250): these ran unconditionally and mapped the
    // r-coloured vowel to a plain one before the onset rule could see it, so a PRE-VOCALIC ɚ/ɝ lost its /r/
    // — `around` read *aaund*, `correct` *kaɛkt*. 3,776 of them are pre-vocalic over the dict (ɚ ×3,457,
    // ɝ ×319). Same split en-GB makes for its linking /ɹ/.
    private static readonly JsRe N_NURSE_PREVOCALIC = JsRegex.Compile($"ɝ(?=[{PRE_V}])", "gu");
    private static readonly JsRe N_NURSE = JsRegex.Compile("ɝ", "gu");
    private static readonly JsRe N_LETTER_PREVOCALIC = JsRegex.Compile($"ɚ(?=[{PRE_V}])", "gu");
    private static readonly JsRe N_LETTER = JsRegex.Compile("ɚ", "gu");
    private static readonly JsRe N_ASPIRATION = JsRegex.Compile("ʰ", "gu");
    private static readonly JsRe N_FLAP = JsRegex.Compile("̬", "gu");
    private static readonly JsRe N_THETA = JsRegex.Compile("θ", "gu");
    private static readonly JsRe N_ETH = JsRegex.Compile("ð", "gu");
    private static readonly JsRe N_DARKL = JsRegex.Compile("ɫ", "gu");
    private static readonly JsRe N_PALATAL = JsRegex.Compile("ʲ", "gu");
    private static readonly JsRe N_ONSET_R = JsRegex.Compile($"[ɹr](?=[{V}])", "gu");
    // ⚠ THE CODA CONDITION IS WRITTEN OUT (#1250) though N_ONSET_R above has already consumed every onset:
    // as a blanket delete this was correct only for as long as that rule stayed exhaustive, and it was not.
    // Spelled out, anything that ever reaches here before a vowel LEAKS as `ɹ` instead of vanishing.
    private static readonly JsRe N_CODA_R = JsRegex.Compile($"[ɹr](?![{V}])", "gu");
    private static readonly JsRe N_FLEECE = JsRegex.Compile("[iɪᵻ]", "gu");
    private static readonly JsRe N_GOOSE = JsRegex.Compile("[uʊ]", "gu");
    private static readonly JsRe N_STRUT = JsRegex.Compile("[ʌɐ]", "gu");
    private static readonly JsRe N_SCHWA = JsRegex.Compile("ə", "gu");
    private static readonly JsRe N_THOUGHT = JsRegex.Compile("[ɔɒ]", "gu");
    private static readonly JsRe N_TRAP = JsRegex.Compile("[æɑ]", "gu");

    /** Standard-English CMUdict IPA → Naija phonology (7 vowels, TH-stopping, non-rhotic codas). */
    private static string Nativise(string en)
    {
        var s = en.Normalize(NormalizationForm.FormC);
        s = N_STRESS.Replace(s, "");
        s = N_PRICE.Replace(s, "ai");
        s = N_MOUTH.Replace(s, "au");
        s = N_CHOICE.Replace(s, "ɔi");
        s = N_FACE.Replace(s, "e");
        s = N_GOAT.Replace(s, "o");
        s = N_NURSE_PREVOCALIC.Replace(s, "ɔɾ");
        s = N_NURSE.Replace(s, "ɔ");
        s = N_LETTER_PREVOCALIC.Replace(s, "aɾ");
        s = N_LETTER.Replace(s, "a");
        s = N_ASPIRATION.Replace(s, "");
        s = N_FLAP.Replace(s, "");
        s = N_THETA.Replace(s, "t");
        s = N_ETH.Replace(s, "d");
        s = N_DARKL.Replace(s, "l");
        s = N_PALATAL.Replace(s, "j");
        s = N_ONSET_R.Replace(s, "ɾ");
        s = N_CODA_R.Replace(s, "");
        s = N_FLEECE.Replace(s, "i");
        s = N_GOOSE.Replace(s, "u");
        s = N_STRUT.Replace(s, "ɔ");
        s = N_SCHWA.Replace(s, "a");
        s = N_THOUGHT.Replace(s, "ɔ");
        s = N_TRAP.Replace(s, "a");
        return s;
    }

    private static readonly JsRe SOFT_C = JsRegex.Compile("c(?=[eiy])", "gu");
    private static readonly JsRe GEMINATE = JsRegex.Compile(@"(.)\1+", "gu");

    /** Scan a lowercased Naija word with the rule g2p: degeminate, soft-⟨c⟩, then digraphs before letters. */
    private static string Scan(string w)
    {
        var s = Js.CodePoints(GEMINATE.Replace(SOFT_C.Replace(w, "s"), "$1"));
        var outp = new StringBuilder();
        for (var i = 0; i < s.Count; )
        {
            // TS `(s[i] ?? "") + (s[i + 1] ?? "")` — a past-the-end index is the empty string, not a throw.
            var dg = s[i] + (i + 1 < s.Count ? s[i + 1] : "");
            if (DEF.Digraphs.TryGetValue(dg, out var d) && d != "")
            {
                outp.Append(d);
                i += 2;
                continue;
            }
            var c = s[i];
            if (DEF.Consonants.TryGetValue(c, out var cv)) outp.Append(cv);
            else if (DEF.Vowels.TryGetValue(c, out var vv)) outp.Append(vv);
            // else: unknown → skip
            i++;
        }
        return outp.ToString();
    }

    /** One Naija word → canonical IPA: the lexicon, then a nativised English dict hit, then the rule g2p. */
    public static string PhonemizeWord(string word, ForeignPhonemizer? known = null)
    {
        var lw = Js.ToLowerCase(word);
        if (DEF.Lexicon.TryGetValue(lw, out var lex)) return lex;
        var en = known?.Invoke(lw);
        if (en is not null) return Nativise(en).Normalize(NormalizationForm.FormC);
        return Scan(lw).Normalize(NormalizationForm.FormC);
    }

    // ── Numbers (nativised English, simple compositor) ────────────────────────
    private static string NumberWords(double n)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20) return NUM.Teens[(int)n - 10];
        if (n < 100)
        {
            var t = Math.Floor(n / 10);
            var u = n % 10;
            return NUM.Tens[(int)t] + (u != 0 ? " " + NUM.Units[(int)u] : "");
        }
        if (n < 1000)
        {
            var h = Math.Floor(n / 100);
            var r = n % 100;
            return $"{NUM.Units[(int)h]} {NUM.Hundred}{(r != 0 ? " " + NUM.And + " " + NumberWords(r) : "")}";
        }
        if (n < 1000000)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            return $"{NumberWords(th)} {NUM.Thousand}{(r != 0 ? " " + NumberWords(r) : "")}";
        }
        foreach (var (value, scale) in new[] { (1_000_000_000d, NUM.Billion), (1_000_000d, NUM.Million) })
        {
            if (n >= value)
            {
                var q = Math.Floor(n / value);
                var r = n % value;
                return $"{NumberWords(q)} {scale}{(r != 0 ? " " + NumberWords(r) : "")}";
            }
        }
        return Js.NumberToString(n); // beyond the compositor → leave as digits
    }

    /** ORDINALS: the productive rule is `nɔmba` + the CARDINAL, with suppletive forms for 1-3. */
    private static string OrdinalWords(double n)
    {
        if (n == 1) return ORD.First;
        if (n == 2) return ORD.Second;
        if (n == 3) return ORD.Third;
        return $"{ORD.Marker} {NumberWords(n)}";
    }

    private static readonly JsRe UPPER_RUN = JsRegex.Compile(@"^\p{Lu}{2,6}$", "u");
    private static readonly JsRe ASCII_VOWEL = JsRegex.Compile("[AEIOU]", "u");

    /** An all-caps run is an initialism only if it has NO vowel letter — a run with one could be a word. */
    private static bool IsInitialism(string w) => UPPER_RUN.IsMatch(w) && !ASCII_VOWEL.IsMatch(w);

    private static List<string> SpellOut(string w)
    {
        var outp = new List<string>();
        foreach (var c in Js.CodePoints(Js.ToLowerCase(w)))
            if (LETTER.TryGetValue(c, out var ph)) outp.Add(ph);
        return outp;
    }

    /** TIMES: hour then minutes, with a minute under ten keeping its zero (⚠ PROVISIONAL — see the TS). */
    private static List<string> TimeWords(double h, double mm)
    {
        var outp = NumberWords(h).Split(' ').ToList();
        if (mm == 0) return outp;
        if (mm < 10) return outp.Concat(new[] { NUM.Units[0], NUM.Units[(int)mm] }).ToList();
        return outp.Concat(NumberWords(mm).Split(' ')).ToList();
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        @"(?<![\d:])(\d{1,2}):([0-5]\d)(?![\d:])"
        + @"|(\d+)(?:st|nd|rd|th|ST|ND|RD|TH)(?![\p{L}])"
        + @"|((?:\p{L}\.){2,})"
        + "|(" + HostWord.LATIN_RUN + ")"
        + @"|([1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+)"
        + @"|([.?!,;:])",
        "gu");

    /** The symbol tier. Every word here is attested in the mined pcm corpus — see the TS for each count. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "percent" },
        // ⚠ INSERTION ORDER IS THE TIE-BREAK: `US$` is declared before `$` so the compound key wins, which
        // is what gives the left-boundary match after a letter.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "dolla" },
            ["$"] = new[] { "dolla" },
            ["₦"] = new[] { "naira" },
        },
        Magnitudes = new[] { "million", "billion", "Million", "Billion", "thousand", "Thousand" },
        Ampersand = "an",
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilomita" },
            ["m"] = new[] { "mita" },
        },
    });

    private static readonly JsRe DOTS = JsRegex.Compile(@"\.", "gu");
    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(",", "gu");

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    // `foreign` = the English DICT lookup (knownWord): a known-English word is nativised, an OOV one
    // (substrate loan) falls through to the rule g2p. Wired in the registry from the English module.
    private readonly ForeignPhonemizer? _foreign;

    private NaijaPhonemizer(ForeignPhonemizer? foreign) => _foreign = foreign;

    public string Text(string input) =>
        Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeNaija(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[2].Success)
            {
                foreach (var wd in TimeWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)))
                    sink.Emit(wd);
            }
            else if (Truthy(m, 3))
            {
                // Above 2^53 the quantity is already lost, so the ORDINAL fallback keeps the marker and
                // reads the digits after it rather than emitting the raw token.
                var n = Js.Number(m.Groups[3].Value);
                if (IsSafeInteger(n))
                {
                    foreach (var wd in OrdinalWords(n).Split(' ')) if (wd != "") sink.Emit(wd);
                }
                else
                {
                    sink.Emit(ORD.Marker);
                    foreach (var d in Js.CodePoints(m.Groups[3].Value)) sink.Emit((Core.Numbers.DigitWord(NUM.Units, d) ?? d));
                }
            }
            else if (Truthy(m, 4))
            {
                // dotted initialism — the dots ARE the instruction to spell it out
                foreach (var ph in SpellOut(DOTS.Replace(m.Groups[4].Value, ""))) sink.Emit(ph);
            }
            else if (Truthy(m, 5))
            {
                var w = HostWord.FoldLatinToBase(m.Groups[5].Value);
                var lw = Js.ToLowerCase(w);
                // A bare ALL-CAPS run is an initialism unless the dict lexifies it.
                if (IsInitialism(w) && !DEF.Lexicon.ContainsKey(lw) && (_foreign is null || _foreign(lw) is null))
                    foreach (var ph in SpellOut(w)) sink.Emit(ph);
                else sink.Emit(PhonemizeWord(w, _foreign));
            }
            else if (Truthy(m, 6))
            {
                var bare = GROUPING_COMMA.Replace(m.Groups[6].Value, "");
                var parts = bare.Split('.');
                var intPart = parts[0];
                var frac = parts.Length > 1 ? parts[1] : null;
                var n = Js.Number(intPart);
                // numberWords already yields canonical IPA — emit it, don't re-run the g2p.
                if (IsSafeInteger(n))
                {
                    foreach (var wd in NumberWords(n).Split(' ')) if (wd != "") sink.Emit(wd);
                    // A decimal tail is read DIGIT BY DIGIT after the separator word (the house convention).
                    if (frac is not null && frac != "")
                    {
                        sink.Emit(NUM.Point);
                        foreach (var d in Js.CodePoints(frac)) sink.Emit((Core.Numbers.DigitWord(NUM.Units, d) ?? d));
                    }
                }
                else
                {
                    foreach (var d in Js.CodePoints(bare))
                    {
                        if (d == ".") sink.Emit(NUM.Point);
                        else sink.Emit((Core.Numbers.DigitWord(NUM.Units, d) ?? d));
                    }
                }
            }
            else if (Truthy(m, 7))
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[7].Value);
                if (mk is not null && mk != "") sink.Pause(mk);
            }
        });

    /** TS truthiness on a capture: an unmatched group is `undefined` and an empty one is falsy. */
    private static bool Truthy(Match m, int i) => m.Groups[i].Success && m.Groups[i].Value.Length > 0;

    /** Build the Nigerian Pidgin phonemizer. `foreign` is the English dict lookup (`knownWord`). */
    public static ILanguage CreateNaija(ForeignPhonemizer? foreign = null) => new NaijaPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("naija", () => CreateNaija(Registry.EnglishKnownWord));
}
