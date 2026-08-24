/**
 * Native Italian (it) text phonemizer — canonical IPA. Italian's Latin orthography is shallow
 * and near-phonemic, so this is a rule-based g2p: c/g soften to t͡ʃ/d͡ʒ before e/i (⟨ci⟩/⟨gi⟩+V drop a silent i),
 * ⟨sc⟩→ʃ, ⟨gl⟩i→ʎ, ⟨gn⟩→ɲ, ⟨ch⟩/⟨gh⟩→k/ɡ, ⟨qu⟩→kw; GEMINATION is written as doubled consonants (gatto→ɡatto —
 * the referee's own convention, and a real Italian contrast the shared backbone would strip if we used ː);
 * intervocalic ʎ/ɲ/ʃ geminate; i/u become glides j/w before a vowel; penultimate stress (written accent overrides).
 * The 7-vowel system a e ɛ i o ɔ u: unstressed mids are close, but STRESSED ⟨e⟩/⟨o⟩ openness (/e/~/ɛ/, /o/~/ɔ/)
 * is LEXICAL and unrecoverable from spelling — as are intervocalic ⟨s⟩ voicing and ⟨z⟩ voicing — so we take a
 * documented default and fold those axes against the referee.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Italian;

public sealed class ItalianNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class ItalianDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Accented { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public ItalianNumbersDef Numbers { get; init; } = new();
}

public static class ItalianPhonemizer
{
    public static readonly ItalianDef DEF = LoadManifest.Load<ItalianDef>("languages/italian", "italian.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static ItalianNumbersDef NUM => DEF.Numbers;

    private const string VOWEL_LETTERS = "aeiouàèéìíîòóùú";
    private const string FRONT = "eièéìí"; // c/g soften and ⟨sc⟩→ʃ before these
    private const string VOWEL_PH = "aeɛioɔu";
    // ⚠ NO `c != ""` GUARD, AND THE GOLDEN PROVES IT. The TS is `VOWEL_LETTERS.includes(c)`, and JS
    // `String.includes("")` is TRUE — so every caller that passes `next ?? ""` at end of word gets `true`.
    // That is load-bearing for the ⟨s⟩ voicing rule: word-final ⟨s⟩ after a vowel VOICES, so `james` is
    // *jˈamez*. Adding the bounds guard here looks defensive and silently devoiced it — 18 golden rows.
    // .NET's `Contains("")` is true as well, so the bare call reproduces the JS exactly. Third instance of
    // this shape in the port (German, Swahili, here).
    private static bool IsVowelLetter(string c) => VOWEL_LETTERS.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string? c) => c is not null && FRONT.Contains(c, StringComparison.Ordinal);
    private static readonly JsRe ASCII_LOWER = JsRegex.Compile("[a-z]", "u");
    private static bool IsConsLetter(string c) => ASCII_LOWER.IsMatch(c) && !IsVowelLetter(c);

    private sealed class Seg
    {
        public required string Ph { get; init; }
        public required bool Accent { get; init; } // came from a written-accent vowel (à è é ì …) → bears stress
    }

    /** Resolve a vowel letter to its IPA, recording whether it was written with a stress accent. */
    private static Seg VowelSeg(string c)
    {
        if (DEF.Accented.TryGetValue(c, out var acc)) return new Seg { Ph = acc, Accent = true };
        return new Seg { Ph = DEF.Vowels.GetValueOrDefault(c) ?? c, Accent = false };
    }

    /** Scan a lowercased Italian word into phoneme segments (contextual c/g/s/z, digraphs, gemination, glides). */
    private static List<Seg> Scan(string word)
    {
        var s = Js.CodePoints(word);
        var n = s.Count;
        var segs = new List<Seg>();
        string? At(int k) => k >= 0 && k < n ? s[k] : null;
        bool PrevIsVowel() =>
            segs.Count > 0 && VOWEL_PH.Contains(Js.CodePoints(segs[^1].Ph) is var cp && cp.Count > 0 ? cp[0] : "", StringComparison.Ordinal);
        void Push(string ph) => segs.Add(new Seg { Ph = ph, Accent = false });
        /** Push a consonant that geminates (emits twice) when it sits between vowels. */
        void PushGem(string ph, bool nextVowel)
        {
            if (PrevIsVowel() && nextVowel)
            {
                Push(ph);
                Push(ph);
            }
            else Push(ph);
        }

        var i = 0;
        while (i < n)
        {
            var c = s[i];
            var nx = At(i + 1);
            var nn = At(i + 2);

            // ── digraphs / contextual clusters (longest first) ──
            // ⟨gli⟩ → ʎ (intervocalic geminate); ⟨gli⟩+V drops the silent i (figlio→fiʎʎo), else keep i (figli→fiʎi).
            if (c == "g" && nx == "l" && nn == "i")
            {
                var after = At(i + 3);
                PushGem("ʎ", true);
                if (after is not null && IsVowelLetter(after)) i += 3; // i silent
                else i += 2; // leave the i as a nucleus
                continue;
            }
            // ⟨gn⟩ → ɲ (intervocalic geminate).
            if (c == "g" && nx == "n")
            {
                PushGem("ɲ", IsVowelLetter(nn ?? ""));
                i += 2;
                continue;
            }
            // ⟨sc⟩ before e/i → ʃ (geminate intervocalic); ⟨sci⟩+V drops the silent i (sciare→ʃare, scienza→ʃɛntsa).
            if (c == "s" && nx == "c" && IsFront(nn))
            {
                var iDot = nn == "i" || nn == "ì";
                var after = At(i + 3);
                PushGem("ʃ", true);
                if (iDot && after is not null && IsVowelLetter(after)) i += 3;
                else i += 2;
                continue;
            }
            // ⟨c⟩: ch→k; before e/i → t͡ʃ (⟨ci⟩+V silent i); else k. Doubled ⟨cc⟩ geminates.
            if (c == "c")
            {
                var doubled = nx == "c";
                var follow = doubled ? nn : nx; // the letter that decides hard/soft
                var rest = doubled ? At(i + 3) : nn;
                if (follow == "h")
                {
                    // ch → k
                    if (doubled) Push("k");
                    Push("k");
                    i += doubled ? 3 : 2;
                    continue;
                }
                if (IsFront(follow))
                {
                    if (doubled) Push("t͡ʃ");
                    Push("t͡ʃ");
                    var iDot = follow == "i" || follow == "ì";
                    if (iDot && rest is not null && IsVowelLetter(rest))
                        i += doubled ? 3 : 2; // ⟨ci⟩+V: silent i (ciao, faccia) — leave the following vowel
                    else i += doubled ? 2 : 1; // else the triggering e/i is a pronounced nucleus — leave it
                    continue;
                }
                // hard c → k
                if (doubled) Push("k");
                Push("k");
                i += doubled ? 2 : 1;
                continue;
            }
            // ⟨g⟩: gh→ɡ; before e/i → d͡ʒ (⟨gi⟩+V silent i); else ɡ. Doubled ⟨gg⟩ geminates. (gl/gn already handled.)
            if (c == "g")
            {
                var doubled = nx == "g";
                var follow = doubled ? nn : nx;
                var rest = doubled ? At(i + 3) : nn;
                if (follow == "h")
                {
                    if (doubled) Push("ɡ");
                    Push("ɡ");
                    i += doubled ? 3 : 2;
                    continue;
                }
                if (IsFront(follow))
                {
                    if (doubled) Push("d͡ʒ");
                    Push("d͡ʒ");
                    var iDot = follow == "i" || follow == "ì";
                    if (iDot && rest is not null && IsVowelLetter(rest))
                        i += doubled ? 3 : 2; // ⟨gi⟩+V: silent i (giorno, oggi) — leave the following vowel
                    else i += doubled ? 2 : 1; // else the triggering e/i is a pronounced nucleus — leave it
                    continue;
                }
                if (doubled) Push("ɡ");
                Push("ɡ");
                i += doubled ? 2 : 1;
                continue;
            }
            // ⟨qu⟩ → kw; ⟨q⟩ alone → k.
            if (c == "q")
            {
                Push("k");
                if (nx == "u" && IsVowelLetter(nn ?? ""))
                {
                    Push("w");
                    i += 2;
                }
                else i += 1;
                continue;
            }
            // ⟨s⟩: ss → geminate s; single ⟨s⟩ voices to z between vowels or before a voiced consonant (default —
            // lexical, folded); else s.
            if (c == "s")
            {
                if (nx == "s")
                {
                    // ⟨ss⟩ is always a long, voiceless geminate.
                    Push("s");
                    Push("s");
                    i += 2;
                    continue;
                }
                var nextVoiced = nx is not null && "bdglmnrvz".Contains(nx, StringComparison.Ordinal);
                var voiced = (PrevIsVowel() && IsVowelLetter(nx ?? "")) || nextVoiced;
                Push(voiced ? "z" : "s");
                i += 1;
                continue;
            }
            // ⟨z⟩ → t͡s (default; /t͡s/~/d͡z/ is lexical, folded). ⟨zz⟩ geminates.
            if (c == "z")
            {
                var doubled = nx == "z";
                Push("t͡s");
                if (doubled) Push("t͡s");
                i += doubled ? 2 : 1;
                continue;
            }

            // ── doubled simple consonant (bb dd ff ll mm nn pp rr tt vv) → geminate ──
            if (IsConsLetter(c) && nx == c && DEF.Consonants.TryGetValue(c, out var dblPh) && dblPh != "")
            {
                Push(dblPh);
                Push(dblPh);
                i += 2;
                continue;
            }
            // ── single simple consonant ──
            if (DEF.Consonants.TryGetValue(c, out var ph1))
            {
                if (ph1 != "") Push(ph1); // ⟨h⟩ maps to "" (silent)
                i += 1;
                continue;
            }

            // ── vowels & glides ──
            if (IsVowelLetter(c))
            {
                // Unaccented i/u are semivowels next to another vowel: ONGLIDE before a vowel (piano→pjano,
                // uomo→wɔmo, buono→bwɔno) or OFFGLIDE after one (aura→awra, mai→maj). Stressed hiatus (via, bugia)
                // is lexical and lost — a documented tail.
                var semivowel = (c == "i" || c == "u") &&
                                ((nx is not null && IsVowelLetter(nx)) || PrevIsVowel());
                if (semivowel)
                {
                    Push(c == "i" ? "j" : "w");
                    i += 1;
                    continue;
                }
                segs.Add(VowelSeg(c));
                i += 1;
                continue;
            }
            i += 1; // unknown → skip
        }
        return segs;
    }

    /** Stressed nucleus index: the written accent if any, else penultimate vowel (or the only/last nucleus). */
    private static int StressIndex(IReadOnlyList<Seg> segs)
    {
        var nuclei = segs
            .Select((sg, i) => VOWEL_PH.Contains(Js.CodePoints(sg.Ph) is var cp && cp.Count > 0 ? cp[0] : "", StringComparison.Ordinal) ? i : -1)
            .Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return -1;
        foreach (var i in nuclei) if (segs[i].Accent) return i;
        if (nuclei.Count == 1) return nuclei[0];
        return nuclei[^2]; // default penultimate (antepenult is lexical/unmarked)
    }

    /** One Italian word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var segs = Scan(word.ToLowerInvariant());
        if (segs.Count == 0) return "";
        var stress = StressIndex(segs);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    // ── Numbers (compositional, with the tens+unit fusion) ────────────────────────
    /** Build the fused Italian word for 0 ≤ n < 1000 (ventuno, duecentotrentaquattro). */
    private static string Under1000(double n)
    {
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20) return NUM.Teens[(int)n - 10];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            var tens = NUM.Tens[(int)t];
            if (u == 1 || u == 8) tens = tens[..^1]; // ventuno, ventotto (drop final vowel)
            var unit = u == 3 ? "tré" : u != 0 ? NUM.Units[(int)u] : ""; // ventitré carries the accent
            return tens + unit;
        }
        double h = Math.Floor(n / 100), r = n % 100;
        var hundreds = (h > 1 ? NUM.Units[(int)h] : "") + NUM.Hundred;
        return hundreds + (r != 0 ? Under1000(r) : "");
    }

    /** Spoken Italian for a non-negative integer → space-separated magnitude words (thousands fused, millions split).
     *  Exported so `romanOrdinals.ts` can derive the ORDINAL from it (`-esimo` on the cardinal) instead of
     *  re-authoring the numeral data. */
    public static string NumberWords(double n)
    {
        if (n == 0) return NUM.Units[0];
        var parts = new List<string>();
        var millions = Math.Floor(n / 1000000);
        var rest = n % 1000000;
        if (millions != 0)
        {
            parts.Add(millions == 1
                ? $"un {NUM.Million}" // un milione (uno apocopates before milione)
                : $"{NumberWords(millions)} {NUM.Millions}");
        }
        if (rest != 0 || millions == 0)
        {
            var thousands = Math.Floor(rest / 1000);
            var under = rest % 1000;
            var group = "";
            if (thousands == 1) group += NUM.Thousand; // mille
            else if (thousands > 1) group += Under1000(thousands) + NUM.Thousands; // duemila
            if (under != 0 || thousands == 0) group += Under1000(under);
            if (group != "") parts.Add(group);
        }
        return string.Join(" ", parts);
    }

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides where the
     * SCRIPT boundary falls, while this one decides whether the g2p has rules for these letters. A token this class
     * REJECTS carries a letter the language does not use — i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zA-ZàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]";
    /**
     * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
     * above is the inventory — a word it rejects carries a letter this language does not use. See
     * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
     */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
    // out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
    // rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
    // every gate: no digit or raw mark survives and nothing VANISHES.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:])", "gu");

    /**
     * symbol normalization — Italian. Percent is *per cento*, invariable, so a one-element form list.
     * Currency and unit names are the standard Italian ones; the corpus writes the currency sign AFTER the
     * amount ("banconote da 5 $"), which the shared tier already handles.
     *
     * `ha` (hectare) is deliberately ABSENT. It is a valid SI-adjacent abbreviation, but in Italian running
     * text `<number> ha` is overwhelmingly the verb *avere* — all four occurrences in the it_it corpus are
     * ("Chandrayaan-1 ha sganciato la sonda"), and admitting it would read them as *ettari*. Likewise `g`,
     * `l` and `t` are omitted: none is attested here, `802.11g` shows the letter-after-digit collision is
     * real, and `l'` before a vowel would be claimed as *litri* since an apostrophe is not a letter.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ `multiply` IS STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
        // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it — this
        // language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "per" },
        // Unread, `&` is DROPPED outright and `B&B` loses the sign entirely.
        // `e` ×1067 in this corpus. The tier spaces it on both sides, because `B&B` is two
        // initialisms and joining them would make one token.
        Ampersand = "e",
        Percent = new[] { "per cento" },
        // Only the POSTPOSED sign reaches here — normalize.ts step 10 has already claimed the preposed form,
        // which needs the partitive *di* the shared magnitude hop cannot insert.
        Currency = Normalize.CURRENCY.ToDictionary(
            kv => kv.Key, kv => (IReadOnlyList<string>)new[] { kv.Value.Singular, kv.Value.Plural }, StringComparer.Ordinal),
        // DECLARED FOR THE UNIT PATH, and the reason it was withheld no longer applies. This list was
        // deliberately absent so the CURRENCY magnitude hop could not emit `5 milioni dollari` without the
        // partitive. But `magnitudes` also gates `magAltU`, the UNIT path's connective hop — so withholding it to
        // protect currency left the tier unable to cross `milioni di` to reach a unit, and
        // `2,2 milioni di km²` read as *due virgola due milioni di KM*: the exponent dropped AND the unit noun
        // left raw in the IPA. One field, two consumers, and only one of them had a problem.
        //
        // Safe because step 10 runs FIRST and consumes the whole preposed shape — sign, amount, magnitude and
        // partitive together — so the currency path here never sees a magnitude to hop. Measured: the corpus has
        // exactly ONE currency-sign sentence (`tra 2.500 ¥ e 130.000 ¥`), postposed, with no magnitude word
        // anywhere near it, and ZERO sentences carrying both a currency sign and *milioni*/*miliardi*.
        Magnitudes = new[] { "miliardi", "miliardo", "milioni", "milione", "mila" },
        MagnitudeConnective = "di", // due virgola due milioni DI chilometri quadrati
        // Longest keys match first (the builder sorts by length), so km² beats km and km/h beats km.
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km/h"] = new[] { "chilometro orario", "chilometri orari" },
            ["km/s"] = new[] { "chilometro al secondo", "chilometri al secondo" },
            ["m/s"] = new[] { "metro al secondo", "metri al secondo" },
            ["mph"] = new[] { "miglio orario", "miglia orarie" },
            ["km"] = new[] { "chilometro", "chilometri" }, ["cm"] = new[] { "centimetro", "centimetri" },
            ["mm"] = new[] { "millimetro", "millimetri" }, ["m"] = new[] { "metro", "metri" },
            ["kg"] = new[] { "chilogrammo", "chilogrammi" }, ["mg"] = new[] { "milligrammo", "milligrammi" },
            ["gb"] = new[] { "gigabyte" }, ["mb"] = new[] { "megabyte" }, ["tb"] = new[] { "terabyte" },
            ["kw"] = new[] { "chilowatt" }, ["mw"] = new[] { "megawatt" }, ["hz"] = new[] { "hertz" },
        },
        // MIGRATION TEST: the composite km²/m² keys are gone, composed by the shared tier instead.
        ExponentWords = new ExponentWordsDef { Squared = new[] { "quadrato", "quadrati" }, Cubed = new[] { "cubo", "cubi" } },
        // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
        // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
        // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
        // they are different words (chilometri quadrati but venti al quadrato).
        // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
        // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
        // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
        // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
        // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
        // The cardinal is used for the generic power, never the ordinal — see core for that argument.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} al quadrato", Cubed = "{n} al cubo", Power = "{n} elevato a {e}", Negative = "meno",
        },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NORMALIZATION ORDER: general text normalization (de-grouping, era markers, abbreviations,
            // degrees, ordinals, clock, signs, fractions) → INITIALISMS (after abbreviation expansion, so
            // `a.C.` is already words) → SYMBOLS (%, currency, units) → the DECIMAL COMMA last of all, because
            // the symbol tier matches a unit only against an ADJACENT number and "1,5 km/s" must reach it
            // intact. Roman numerals need no ordering care: `it` is not in the registry's ROMAN_NATIVE set, so
            // the shared pass converted them before text() was called.
            var normalized = Normalize.NormalizeItalianDecimals(
                SYMBOLS(Normalize.NormalizeItalianInitialisms(Normalize.NormalizeItalian(input))));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO BE EMITTED STRAIGHT INTO THE IPA. Refusing to
                    // COMPOSE is right — the float has already lost the low digits — but the else emitted the
                    // token itself, which is not a reading. Digit-at-a-time through the same number words
                    // instead; see core/numbers.ts `spellDigits` for the account and the cost.
                    var num = Js.Number(m.Groups[2].Value);
                    if (double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d)
                        foreach (var wd in NumberWords(num).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    else
                        foreach (var d in Js.CodePoints(m.Groups[2].Value))
                            foreach (var wd in NumberWords(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Italian phonemizer (no data files beyond the manifest — the engine is rule-based). */
    public static ILanguage CreateItalian() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("italian", CreateItalian);
        Registry.RegisterRomanPolicy("it", RomanOrdinals.ROMAN_POLICY);
    }
}
