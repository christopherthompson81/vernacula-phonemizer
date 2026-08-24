/**
 * Cantonese / Yue (yue) phonemizer — canonical IPA. Written in Han characters; the front-end maps Han → Jyutping
 * via the rime-cantonese dictionary (dict.tsv, word→jyutping) with greedy longest-match segmentation (so
 * polyphones resolve by word: 銀行 ngan4hong4 vs 行路 haang4lou6). The back-end (cantonese.jsonc) maps each
 * Jyutping syllable → IPA: initial + final (the aː/ɐ long/short split, checked -p̚/-t̚/-k̚ codas) + one of the SIX
 * Cantonese tones as Chao contour letters. Direct Jyutping input (with tone digits) is also accepted.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cantonese;

public sealed class CantoneseDef
{
    public IReadOnlyDictionary<string, string> Initials { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Finals { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string MeasureWords { get; init; } = "";
}

public static class CantonesePhonemizer
{
    public static readonly CantoneseDef DEF = LoadManifest.Load<CantoneseDef>("languages/cantonese", "cantonese.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    // Initials tried longest-first so ng/gw/kw win over n/g/k.
    private static readonly IReadOnlyList<string> INITIALS = DEF.Initials.Keys.OrderByDescending(a => a.Length).ToList();

    private static Dictionary<string, string>? DICT;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Dict()
    {
        lock (GATE) return DICT ??= LoadTsv.LoadTsvMap("languages/cantonese", "dict.tsv");
    }
    private const int MAX_WORD = 6; // greedy segmentation window

    private static readonly JsRe HAN = JsRegex.Compile("\\p{Script=Han}", "u");
    // ⚠ CASE-SENSITIVE. Jyutping is written lowercase; with the `i` flag an ALL-CAPS alphanumeric token like
    // `MP3` matched, found no rime, and came back VERBATIM through the "leave the jyutping visible" fallback.
    private static readonly JsRe JYUTPING = JsRegex.Compile("^[a-z]+[1-6](?:\\s+[a-z]+[1-6])*$", "u");
    private static readonly JsRe SYLLABLE = JsRegex.Compile("^([a-z]+?)([1-6])$", "i");
    private static readonly JsRe WHITESPACE = JsRegex.Compile("\\s+", "u");

    /** One Jyutping syllable (e.g. "hoeng1") → IPA. */
    private static string SyllableToIpa(string syl)
    {
        var m = SYLLABLE.Match(syl);
        if (!m.Success) return syl;
        var body = m.Groups[1].Value.ToLowerInvariant();
        var tone = DEF.Tones.GetValueOrDefault(m.Groups[2].Value) ?? "";
        // Syllabic nasal (m / ng stand alone, no initial).
        if (body == "m" || body == "ng")
            return (DEF.Finals.GetValueOrDefault(body) ?? body) + tone;
        // Parse initial (longest match) + final.
        var initial = "";
        var rest = body;
        foreach (var ini in INITIALS)
            if (body.StartsWith(ini, StringComparison.Ordinal) &&
                DEF.Finals.TryGetValue(body[ini.Length..], out var f) && f != "")
            {
                initial = DEF.Initials[ini];
                rest = body[ini.Length..];
                break;
            }
        if (!DEF.Finals.TryGetValue(rest, out var final)) return syl; // unknown rime → leave the jyutping visible
        return initial + final + tone;
    }

    /** A space-separated Jyutping string → IPA. */
    private static string JyutpingToIpa(string jp) =>
        string.Join(" ", SplitWs(jp.Trim()).Select(SyllableToIpa));

    /** JS `s.split(/\s+/u)` — a leading empty piece is possible and is preserved, as there. */
    private static List<string> SplitWs(string s)
    {
        var parts = new List<string>();
        var last = 0;
        foreach (var m in JsRegex.MatchAll(WHITESPACE, s))
        {
            parts.Add(s[last..m.Index]);
            last = m.Index + m.Length;
        }
        parts.Add(s[last..]);
        return parts;
    }

    /** A Han run → IPA (greedy longest-match over the dictionary; unknown chars are skipped). */
    private static string HanRun(string run)
    {
        var chars = Js.CodePoints(run);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count;)
        {
            var matched = "";
            var jp = "";
            for (var len = Math.Min(MAX_WORD, chars.Count - i); len >= 1; len--)
            {
                var word = string.Concat(chars.Skip(i).Take(len));
                if (Dict().TryGetValue(word, out var hit) && hit != "")
                {
                    matched = word;
                    jp = hit;
                    break;
                }
            }
            if (jp != "")
            {
                outp.Add(JyutpingToIpa(jp));
                i += Js.CodePoints(matched).Count;
            }
            else i++; // no reading for this char → skip
        }
        return string.Join(" ", outp);
    }

    /**
     * A SYNTHESIZED numeral string → IPA, read one character at a time.
     *
     * ⚠ A COMPOSED NUMERAL MUST NOT GO THROUGH `hanRun()`. Greedy longest-match segmentation looks up whole WORDS,
     * and the rime-cantonese dict carries a colloquial lexical entry 十九 = "sap1 gau1" — so a composed number
     * containing 十九 is mis-toned: 29 → 二十九 segments as 二 + 十九 and comes out ji6 sap1 gau1 instead of
     * ji6 sap6 gau2, which hits every cardinal year ending in 9 with a non-zero tens digit (1469, 1759, 1989 …).
     * A number the ENGINE composed has no lexical word boundaries to discover — its characters are digits — so
     * per-character lookup is both the fix and the honest model. Text the AUTHOR wrote in Han numerals still goes
     * through `hanRun` and keeps whatever lexical reading the dict has for it.
     */
    private static string NumeralRun(string han) =>
        string.Join(" ", Js.CodePoints(han).Select(HanRun).Where(s => s != ""));

    // Han numeral composition (shared Chinese system): 零一二三四五六七八九 + 十百千萬億. The Han string is then
    // phonemized through the same dict→jyutping→IPA path, so no separate number IPA is authored. ⚠ DIGITS is owned
    // by normalize.ts, so the digit-string reading (years, decimals) and this cardinal reading cannot drift apart.
    private static readonly string[] SMALL = { "", "十", "百", "千" };
    private static IReadOnlyList<string> DIGITS => Normalize.DIGITS;

    private static string Under10000(double n)
    {
        if (n == 0) return "";
        var outp = "";
        var zero = false;
        for (var p = 3; p >= 0; p--)
        {
            var unit = Math.Floor(n / Math.Pow(10, p)) % 10;
            if (unit == 0)
            {
                if (outp != "") zero = true;
            }
            else
            {
                if (zero) outp += DIGITS[0];
                zero = false;
                outp += (p == 1 && unit == 1 && outp == "" ? "" : DIGITS[(int)unit]) + SMALL[p];
            }
        }
        return outp;
    }

    private static string IntegerToHan(double n)
    {
        if (n == 0) return DIGITS[0];
        if (n < 0) return "";
        var yi = Math.Floor(n / 1_0000_0000);
        var wan = Math.Floor(n % 1_0000_0000 / 10000);
        var rest = n % 10000;
        var outp = "";
        if (yi != 0) outp += IntegerToHan(yi) + "億";
        if (wan != 0) outp += Under10000(wan) + "萬";
        if (rest != 0)
        {
            if ((yi != 0 || wan != 0) && rest < 1000) outp += DIGITS[0];
            outp += Under10000(rest);
        }
        return outp;
    }

    /**
     * LATIN LETTER NAMES IN JYUTPING — MINED FROM `dict.tsv`, NOT AUTHORED.
     *
     * An initialism embedded in Cantonese prose routed straight to the ENGLISH phonemizer: `中國GDP總量` read
     * …ɡˈiːdˈiːpʰˈiː…, English [iː], English stress, NO TONE, inside a tonal utterance. The header of
     * `normalize.ts` used to defer this for want of a letter table — while the shipped dict carried **541 Latin
     * keys** that this engine never consulted, including 69 whole acronyms with their readings (`DVD di1 wi1 di1`,
     * `ATM ei1 ti1 em1`, `GPS zi1 pi1 e1 si4`). The data was already here.
     *
     * ⚠ EVERY VALUE BELOW IS THE DICTIONARY'S OWN, recovered two ways and cross-checked:
     *   · the 13 SINGLE-LETTER keys — D di1, J zei1, K kei1, L eu1, M em1, N en1, P pi1, Q kiu1, R aau1,
     *     T ti1, X ik1 si4, Y waai1, Z ji6 set1;
     *   · per-letter alignment of the all-caps acronym entries, which supplies the other 11 with vote counts:
     *     B bi1 ×14, C si1 ×11, O ou1 ×11, A ei1 ×10, I aai1 ×9, V wi1 ×6, E ji1 ×4, G zi1 ×4, U ju1 ×2,
     *     and the two-syllable F e1 fu4 (`FF`) and S e1 si4 (`GPS`, `USB` — two independent entries).
     *
     * ⚠ TWO VOTES ARE REJECTED, and reading the source entry is what rejects them:
     *   · `CLS ci1 lan2 sin3` is 黐撚線, a PROFANITY spelled with letters — not letter names, so its C/L/S
     *     readings are not evidence. Left in, it would have shipped `S = sin3`.
     *   · `WP win1 pei1` and `LM lau4 ming4` are NAMES, not initialisms.
     * The former is why S is taken from GPS/USB instead, and it is playbook trap 2 in miniature: the count was
     * there, the sense was not.
     *
     * ⚠ H AND W ARE ABSENT FROM EVERY SOURCE — no single-letter key, no acronym, and espeak ships no Cantonese
     * letter table at all (its `yue_list` has zero Latin entries). Rather than invent them, a run containing an
     * unsourced letter is left WHOLE on the English reader: a half-Cantonese, half-English token would be worse
     * than either. Measured cost in the mined artifact: 3 of 13 all-caps tokens (`HK`, `NSW`, `NPWS`).
     */
    private static readonly IReadOnlyDictionary<string, string> LETTERS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "ei1", ["B"] = "bi1", ["C"] = "si1", ["D"] = "di1", ["E"] = "ji1", ["F"] = "e1 fu4",
        ["G"] = "zi1", ["I"] = "aai1", ["J"] = "zei1", ["K"] = "kei1", ["L"] = "eu1", ["M"] = "em1",
        ["N"] = "en1", ["O"] = "ou1", ["P"] = "pi1", ["Q"] = "kiu1", ["R"] = "aau1", ["S"] = "e1 si4",
        ["T"] = "ti1", ["U"] = "ju1", ["V"] = "wi1", ["X"] = "ik1 si4", ["Y"] = "waai1", ["Z"] = "ji6 set1",
    };

    private static readonly JsRe ALL_CAPS = JsRegex.Compile("^[A-Z]{2,}$", "u");
    private static readonly JsRe ROMAN = JsRegex.Compile("^[IVX]{2,3}$", "u");

    /**
     * A Latin run → IPA, preferring what the language records over what English would say.
     *
     * ⚠ NO SINGLE-LETTER ARM, unlike wuu and cmn, which claim a lone uppercase letter that TOUCHES HAN (`X光`,
     * `地铁B线`). Counted before deciding: the yue artifact has ZERO Han-adjacent single uppercase letters, against
     * 9 in cmn's and 6 in wuu's. Widening a guard for a shape the corpus does not contain is how misfires get
     * invented (playbook trap 9), so this stays until yue has an instance to measure.
     *
     * ⚠ ONLY ALL-CAPS RUNS ARE CLAIMED. The dict's other Latin keys are lowercase ENGLISH LOANS (`bar baa1`,
     * `account aa6 kaan1`) whose Cantonese reading is right for a loan and wrong for the quoted English the
     * corpus also contains, and nothing in the surface form separates the two. Initialisms have no such
     * ambiguity, so they are the whole of the claim.
     *
     * ⚠ `[IVX]{2,3}` is excluded because Roman numerals belong to `core/roman.ts`, which runs in the registry
     * WRAPPING `text()` — what reaches here is what it declined. Not flanked by a Latin letter or digit, so an
     * alphanumeric code is not an acronym. The SPELLING length cap is stated at the guard below; the DICT lookup
     * deliberately has none. `wu/normalize.ts` step 14 records the shared reasoning at length.
     */
    private static string LatinRun(string run, Func<string, string>? foreign)
    {
        string English() => foreign is not null ? foreign(run) : "";
        if (!ALL_CAPS.IsMatch(run) || ROMAN.IsMatch(run)) return English();
        // A RECORDED acronym outranks spelling it out: the reading is a lexical fact and the dict has it
        // (`DVD`, `ATM`, `USB`, `ID`, `IT`, `BBQ`…), tones and all. This is `core/initialisms.ts`'s own
        // architecture — a known acronym resolves through the lexicon; only an OOV one is spelled.
        if (Dict().TryGetValue(run, out var recorded)) return JyutpingToIpa(recorded);
        // ⚠ SPELLING is capped at 3 letters while the DICT LOOKUP above is not, and the asymmetry is the point:
        // a recorded reading is a LEXICAL fact and needs no guard, whereas spelling an unrecorded 4-letter run
        // is where English WORDS start being mistaken for acronyms — measured on the cmn corpus, 9 of 16
        // four-letter tokens are words (FIFA ×7, BANK, SEAL). yue's own corpus is too small to show it (13
        // all-caps tokens), so this follows the sibling's measurement rather than pretending to its own.
        if (run.Length > 3) return English();
        var cps = Js.CodePoints(run);
        if (!cps.All(c => LETTERS.ContainsKey(c))) return English(); // H/W — see above
        return string.Join(" ", cps.Select(c => JyutpingToIpa(LETTERS[c])));
    }

    private static readonly JsRe MARK_ESC = JsRegex.Compile("[.*+?^${}()|[\\]\\\\-]", "gu");

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input)
        {
            // Whole-string Jyutping input (tone digits present) → direct path.
            if (JYUTPING.IsMatch(input.Trim())) return JyutpingToIpa(input);
            // The normalization pass runs FIRST, so what reaches the tokenizer is either a word the dict speaks or
            // a number whose CARDINAL reading is the correct one.
            input = Normalize.NormalizeCantonese(input, DEF.MeasureWords);
            // ⚠ `assembleClauses`, NOT a private exec loop. A hand-rolled clauseSink + token loop is the same shape
            // but gets no GAP PASS, so a run in a script the engine does not own is dropped. This engine claims
            // Latin itself; the gap pass covers everything else via the script router (core/scripts.ts).
            // The clause-mark alternation is built from the manifest's keys, so adding a mark to the data is enough.
            // ⚠ The Latin run is `\p{Script=Latin}` + combining marks, NOT `[A-Za-z]`: the ASCII class splits every
            // accented name into fragments — Müslüm Gürses reaches the English phonemizer as M / sl / m / G / rses
            // ("ˈɛm sɫ ˈɛm …") instead of two words.
            var marks = string.Concat(CLAUSE_MARK.Keys.Select(k => JsRegex.Replace(k, MARK_ESC, mm => "\\" + mm.Value)));
            var tok = JsRegex.Compile(
                $"(\\p{{Script=Han}}+)|(\\d+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{marks}])", "gu");

            return Clauses.AssembleClauses(input, tok, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(HanRun(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ ABOVE 2^53 THIS USED TO EMIT NOTHING — see hanDictIpa.ts for the full account. The guard
                    // is right and stays; what was missing is the else, so the numeral was deleted rather than
                    // degraded. Digit-at-a-time is what yue already gives a year.
                    var n = Js.Number(m.Groups[2].Value);
                    sink.Emit(NumeralRun(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
                        ? IntegerToHan(n)
                        : Sinitic.SpellHanDigits(m.Groups[2].Value, DIGITS)));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(LatinRun(m.Groups[3].Value, _foreign));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Cantonese phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateCantonese(Func<string, string>? foreign = null) => new Engine(foreign);

    /** Bare word→IPA (tests / eval): Han → IPA, or direct Jyutping. */
    public static string PhonemizeWord(string word) => HAN.IsMatch(word) ? HanRun(word) : JyutpingToIpa(word);

    internal static void RegisterSelf() =>
        Registry.Register("cantonese", () => CreateCantonese(Registry.ReadAsEnglish));
}
