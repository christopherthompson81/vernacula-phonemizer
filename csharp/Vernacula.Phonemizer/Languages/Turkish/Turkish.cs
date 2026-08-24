/**
 * Turkish (tr) phonemizer — canonical IPA. Rule-based g2p (g2p.ts) + final-syllable stress
 * (Turkish default) with a lexicon (stress.tsv, mostly place names / loanwords) for the exceptions. text()
 * tokenizes words / numbers / punctuation.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public static class TurkishPhonemizer
{
    // Stress exceptions: word → 1-based stressed syllable (default is the final syllable).
    private static Dictionary<string, double>? STRESS;
    private static readonly object GATE = new();
    private static Dictionary<string, double> StressDict()
    {
        lock (GATE) return STRESS ??= LoadTsv.LoadTsvMapV<double>("languages/turkish", "stress.tsv",
            (v, _) => Js.Number(v) is var d && double.IsNaN(d) ? null : d, optional: true);
    }

    private static readonly JsRe VOWEL_LETTER = JsRegex.Compile("[aeıioöuüâîû]", "");
    private static int NVowels(string s)
    {
        var n = 0;
        foreach (var c in Js.CodePoints(s)) if (VOWEL_LETTER.IsMatch(c)) n++;
        return n;
    }

    // PRE-ACCENTING (pre-stressing) suffixes: Turkish stress falls on the syllable immediately before the LEFTMOST
    // pre-accenting suffix (Kabak & Vogel). The set — progressive -Iyor, -ken, instrumental -(y)lA, negation /
    // verbal-noun -mA, conditional -sA, generalizing copula -DIr, predicative person endings -Im/-Iz/-sInIz — plus
    // one optional trailing suffix (person / case / plural), anchored to the word end. NB the bare 2sg -sIn is
    // deliberately EXCLUDED: it collides with the imperative -sIn (olsun) and possessive+case -sInDA (arasında),
    // costing more than it fixes.
    private const string PRE_ACCENT =
        "(?:(?:r)?ken|(?:y)?l[ae]|m[ae]|s[ae]|[dt][ıiuü]r|(?:y)?(?:[ıiuü]m|[ıiuü]z|s[ıiuü]n[ıiuü]z))";
    private const string TAIL = "(?:l[ae]r|[ıiuü][mnz]|n[ıiuü]z|[ae]|y[ae]|d[ae]n?|n[ıiuü]n|)";
    private static readonly JsRe PRE_ACCENT_RE = JsRegex.Compile(PRE_ACCENT + TAIL + "$", "u");
    private static readonly JsRe IYOR_RE = JsRegex.Compile("([ıiuü])yor(?:um|sun|uz|sunuz|lar)?$", "u");

    /** A pre-accenting suffix's 1-based stressed syllable, or undefined (→ default final stress). */
    private static int? MorphStress(string wl)
    {
        var iyor = IYOR_RE.Match(wl); // progressive: stress the I of Iyor (geliyor→ɟelˈijoɾ)
        if (iyor.Success) return NVowels(wl[..(iyor.Index + 1)]);
        var m = PRE_ACCENT_RE.Match(wl); // leftmost pre-accenting suffix → stress the syllable before it
        if (m.Success)
        {
            var syl = NVowels(wl[..m.Index]);
            if (syl >= 1) return syl;
        }
        return null;
    }

    /** Phonemize a single Turkish word to canonical IPA (with a stress mark before the stressed vowel). `finalStress`
     *  forces plain final-syllable stress, bypassing the lexicon + pre-accenting rules (used for number words, which
     *  are lexically final-stressed — the -Iz person-ending rule would otherwise mis-stress dokuz→dˈokuz). */
    public static string PhonemizeWord(string word, bool finalStress = false)
    {
        var segs = G2p.ToSegments(word);
        var nuclei = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        // Stress: the exception lexicon's 1-based syllable if known, else a pre-stressing suffix rule, else final.
        var wl = G2p.TrLower(word);
        double? syl = finalStress
            ? null
            : (StressDict().TryGetValue(wl, out var lex) ? lex : MorphStress(wl));
        var stressIdx =
            syl is not null && syl >= 1 && syl <= nuclei.Count
                ? nuclei[(int)syl.Value - 1]
                : nuclei[^1];
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // A word (Turkish letters), an ORDINAL numeral, a number with an optional apostrophe-attached suffix, or
    // clause punctuation. Turkish uses . as thousands sep and , as decimal.
    //
    // the two numeral-attached forms are matched HERE rather than rewritten in normalize.ts because their
    // spoken words must go through phonemizeWord(w, /*finalStress*/ true) — the word path mis-stresses sekiz /
    // dokuz / otuz via the -Iz person-ending rule (see normalize.ts's header). Ordering inside the alternation
    // matters: the ordinal branch precedes the number branch, and its lookahead (whitespace + another token) is
    // exactly the corpus-derived detector — it declines inside `1.234` and `802.11a`, where no space follows the
    // dot, and at end of input, which is the one sentence-final `N.` the corpus contains (`rekoru 7-2.`).
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|(\\d+)\\.(?=[^\\S\\n]+\\S)|(\\d+(?:\\.\\d{{3}})*(?:,\\d+)?)(?:['’]([a-zçğıiöşüâîû]+))?|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
     * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
     * core/hostWord.ts.
     *
     * ⚠ `İ` IS ADDED, and it is the one letter here that is not a straight lift. Capital İ (U+0130) has no Unicode
     * simple case-fold to `i` — it folds to `i` + COMBINING DOT ABOVE — so the /i/ flag does not make the old class
     * accept it. The class was therefore already incomplete, and the fold turned that latent gap into a wrong vowel:
     * `İ` fell outside the inventory, folded to bare `I`, and `I` is Turkish's DOTLESS capital, so `İtalya` read
     * *ɯtaɫja* and `İzmir` *ɯzmˈiɾ*. `g2p.ts` already maps İ→i and I→ı with the right locale rule; it just has to be
     * given the letter. (Azerbaijani hit the same trap and solved it the other way, normalising İ→i before
     * tokenizing — see azerbaijani.ts.)
     */
    private const string NATIVE_CLASS = "[a-zçğıiöşüâîûİ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /** A number token (Turkish thousands-dots / decimal-comma) → spoken words. */
    private static readonly JsRe THOUSANDS_DOT = JsRegex.Compile("\\.", "g");
    private static string NumberTokenToWords(string tok)
    {
        var bits = tok.Split(',');
        var intRaw = bits[0];
        var frac = bits.Length > 1 ? bits[1] : null;
        var words = TurkishNumbers.NumberToWords(Js.Number(JsRegex.Replace(intRaw, THOUSANDS_DOT, _ => "")));
        if (frac is not null)
            words +=
                $" {Manifest.MANIFEST.Numbers.DecimalConnector} " +
                string.Join(" ", Js.CodePoints(frac).Select(d => TurkishNumbers.NumberToWords(Js.Number(d))));
        return words;
    }

    // symbol normalization — Turkish: the percent word PRECEDES the number (yüzde kırk, written %40); both
    // %40 and 40% occur in the wild and both rewrite to prefix order. `m` → metre is claimed here rather than in
    // normalize.ts so the shared tier's "only after a number" guard applies (4892 m, 100m); the `m/s` compound is
    // consumed earlier, in normalize.ts step 4, before this tier can break the adjacency.
    /** The unit table, named so the apostrophe-suffix rule below can derive its alternation from the SAME object
     *  the tier is given — a second hand-written list would drift the moment a unit is added. */
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> UNITS =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometre" }, ["cm"] = new[] { "santimetre" }, ["mm"] = new[] { "milimetre" },
            ["kg"] = new[] { "kilogram" }, ["m"] = new[] { "metre" },
        };

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
        // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
        // One word, so `by` defaults to it; this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "çarpı" },
        Percent = new[] { "yüzde" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "avro" }, ["$"] = new[] { "dolar" }, ["£"] = new[] { "sterlin" },
            ["₺"] = new[] { "lira" }, ["¥"] = new[] { "yen" },
        },
        Units = UNITS,
        // THE MEASURE WORD FUSES ONTO THE END, which is the `suffix` position and the reason it exists. This
        // corpus writes `783.562 kilometrekare` ×4 and `120-160 metreküp` ×2 — one word each. Neither of the
        // other three positions produces that: `after` gives *kilometre kare*, `compound` gives *karekilometre*.
        // ⚠ Bare `kare` ×6 is the SHAPE ("küçük kare veya toplardan"), plus one `mil kare` for the imperial
        // gloss — the fused unit form is the attestation, not the bare word.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kare" },
            Cubed = new[] { "küp" },
            Position = ExponentPosition.Suffix,
        },
    });

    /**
     * ⚠ THE APOSTROPHE SUFFIX DEFEATS THE UNIT TIER ENTIRELY, and an audit that counts only visible damage sees
     * the smallest part of it.
     * Turkish attaches case/possessive suffixes to an abbreviation with an apostrophe, and the tier's trailing
     * guard — which exists so a key cannot bite into a word — rejects the letter that follows. Measured over
     * tr_tr, fourteen instances, and every one of them was misread:
     *
     *     19.500 km²'lik  →  *kilometre lik*     the ² DROPPED, area lost           (×2, the audit's `exponent DROP`)
     *     360 km'lik      →  *km lik*            THE UNIT SURVIVED AS RAW LETTERS   (×2, +1600 km'lik ×2, 70 km'ye)
     *     35 mm'dir       →  *mm dir*            same                               (×3)
     *     6 cm'ye, 4892 m'lik, 6,387 km'dir      same
     *     5 km2'lik       →  *kilometre ikilik*  the ASCII 2 read as the NUMBER two — confidently wrong
     *
     * ⚠ AND A RAW UNIT IS NOT MUTE IN THIS LANGUAGE, IT IS MISPRONOUNCED. `6 cm'ye` read [aɫtˈɯ d͡ʒm jˈe]: the
     * letters `cm` went through the g2p as an ordinary word, and Turkish `c` is [d͡ʒ]. So the alternative to
     * reading the unit was not silence but a confident wrong word — the same argument the Zulu click rules rest
     * on, and the reason this is worth fixing at fourteen instances.
     *
     * ⚠ ONLY THE EXPONENT CASE WAS VISIBLE TO THE GATE. A raw `km` in the IPA is not a digit and not a symbol, so
     * the LEAK check cannot see it and the differential DROP check cannot either — the reading changes when the
     * letters are deleted, so nothing "vanished". Most of the damage was invisible for that reason.
     * ⚠ A DEFECT IS ONLY FOUND BY A CHECK THAT WAS BUILT TO LOOK FOR IT.
     *
     * PROTECT AND RESTORE, rather than a local unit table. The suffix is moved out of the way behind a sentinel so
     * the tier sees an ordinary boundary, then glued back onto whatever word the tier produced. That way the unit
     * words stay owned by the tier — `kilometrekare` + `lik` → *kilometrekarelik*, `kilometre` + `lik` →
     * *kilometrelik* — and nothing here needs to know them. Plain concatenation is correct for the same reason
     * `attachSuffix` gives in normalize.ts: Turkish orthography already writes the suffix in the harmonised form
     * the spoken word demands.
     *
     * ⚠ KEYED ON THE DECLARED UNITS, NOT ON `\p{L}+`, and that is load-bearing. The same shape sits on words this
     * must not touch, all of them in this corpus: `7 Ekim'de`, `20 Mart'ta` (month names after a day number),
     * `12.00 GMT'de`, `802.11n'nin`, `2. Elizabeth'in`, `29, Cincinnati'nin`. A letter-run rule would read every
     * one of them as a measurement. The requirement that an apostrophe follow the unit IMMEDIATELY is what keeps
     * `5 Mart'ta` safe even though `m` is a unit key: after `m` comes `a`, not `'`.
     */
    private static readonly string UNIT_ALT = string.Join("|", UNITS.Keys.OrderByDescending(a => a.Length));
    private const string SUFFIX_MARK = "\u0001"; // never occurs in input; the glue step below removes it again
    private static readonly JsRe SUFFIXED_UNIT = JsRegex.Compile($"(\\d[\\d.,]*\\s?(?:{UNIT_ALT})(?:\\s?[²³23])?)['’](\\p{{L}}+)", "gu");
    private static readonly JsRe MARKED_SUFFIX = JsRegex.Compile($"(\\S+)\\s{SUFFIX_MARK}(\\p{{L}}+)", "gu");

    /** Read a unit carrying an apostrophe suffix: park the suffix, let the tier speak the unit, glue it back. */
    private static string ReadSuffixedUnits(string text)
    {
        var parked = JsRegex.Replace(text, SUFFIXED_UNIT, m => $"{m.Groups[1].Value} {SUFFIX_MARK}{m.Groups[2].Value}");
        // The final strip is belt and braces: the glue step only fires when the tier left a word before the mark,
        // so an input where the tier declined to speak the unit would otherwise carry a CONTROL CHARACTER into the
        // IPA. No probed input does that — 5,5 km'lik, 0,5 m'lik, 12 kg'dan, %80'ini, 1.600 km'lik and the
        // malformed 5 km' were all checked clean — but a stray U+0001 in the phoneme string is a bad enough
        // failure mode to spend one line on rather than argue about.
        var spoken = JsRegex.Replace(SYMBOLS(parked), MARKED_SUFFIX, m => m.Groups[1].Value + m.Groups[2].Value);
        return string.Join("", spoken.Split(SUFFIX_MARK));
    }

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // normalize.ts FIRST, then the shared symbol tier — normalize's `/`-unit step needs the number and
            // the unit still adjacent, which the symbol tier would break (83 km/s → 83 kilometre/s).
            Clauses.AssembleClauses(ReadSuffixedUnits(Normalize.NormalizeTurkish(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success)
                {
                    var ord = Normalize.OrdinalWords(Js.Number(m.Groups[2].Value));
                    if (ord is not null)
                        foreach (var wd in ord.Split(' ')) sink.Emit(PhonemizeWord(wd, true));
                    else
                    {
                        // Not expressible as an ordinal — fall back to the previous reading (cardinal + pause).
                        foreach (var wd in NumberTokenToWords(m.Groups[2].Value).Split(' '))
                            sink.Emit(PhonemizeWord(wd, true));
                        var mk0 = CLAUSE_MARK.GetValueOrDefault(".");
                        if (mk0 is not null) sink.Pause(mk0);
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var words = NumberTokenToWords(m.Groups[3].Value).Split(' ').ToList();
                    foreach (var wd in m.Groups[4].Success && m.Groups[4].Value.Length > 0
                                 ? Normalize.AttachSuffix(words, m.Groups[4].Value)
                                 : words)
                        sink.Emit(PhonemizeWord(wd, true));
                }
                else if (m.Groups[5].Success && m.Groups[5].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[5].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Turkish phonemizer (rule g2p + final-syllable stress + an exception lexicon). */
    public static ILanguage CreateTurkish() => new Engine();

    internal static void RegisterSelf() => Registry.Register("turkish", CreateTurkish);
}
