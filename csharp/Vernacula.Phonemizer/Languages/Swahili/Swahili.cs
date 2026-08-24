/**
 * Native Swahili / Kiswahili (sw) text phonemizer — canonical IPA. Bantu, but with a highly
 * PHONEMIC shallow Latin orthography and (unusually) NO tone — just regular penultimate stress. A rule-based g2p
 * (the id/tl pattern) with Swahili's distinctive segments: the plain voiced stops are IMPLOSIVES (b→ɓ d→ɗ j→ʄ
 * g→ɠ), PRENASALIZED stops are one segment with a homorganic superscript nasal (mb→ᵐb, nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ),
 * ⟨ng'⟩→ŋ is DISTINCT from ⟨ng⟩→ᵑɡ, a nasal before another consonant is SYLLABIC (mtu→m̩tu, nchi→n̩t͡ʃi), and the
 * Arabic-loan fricatives dh/th/gh/kh→ð/θ/ɣ/x. Vowels [a e i o u].
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swahili;

public sealed class SwahiliNumbersDef
{
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class SwahiliDef
{
    public string VelarNasal { get; init; } = "";
    public IReadOnlyDictionary<string, string> Prenasal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SwahiliNumbersDef Numbers { get; init; } = new();
}

public static class SwahiliPhonemizer
{
    public static readonly SwahiliDef DEF = LoadManifest.Load<SwahiliDef>("languages/swahili", "swahili.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static SwahiliNumbersDef NUM => DEF.Numbers;
    private static readonly IReadOnlyDictionary<string, string> TWO = // all 2-letter graphemes
        DEF.Prenasal.Concat(DEF.Digraphs).ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);
    private const string VOWEL_LETTER = "aeiou";
    private static readonly JsRe ASCII_LOWER = JsRegex.Compile("[a-z]", "u");
    private static bool IsConsonantLetter(string c) =>
        ASCII_LOWER.IsMatch(c) && !VOWEL_LETTER.Contains(c, StringComparison.Ordinal);

    private sealed class Seg
    {
        public required string Ph { get; set; }
        public required bool Nucleus { get; init; } // a vowel or a syllabic nasal — bears stress
    }

    /** Scan a lowercased Swahili word into segments (ng' → prenasal digraphs → consonant digraphs → singles). */
    private static List<Seg> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var n = s.Count;
        var segs = new List<Seg>();
        // ⚠ THE TS MIXES INDEX SPACES HERE: `w.startsWith(velarNasal, i)` takes a UTF-16 offset while `i`
        // walks the CODE-POINT array `s`. Swahili orthography is ASCII plus the apostrophe, so the two
        // coincide for every input this scan sees; mirrored rather than corrected so the shapes match.
        for (var i = 0; i < n;)
        {
            // ⟨ng'⟩ → ŋ (velar nasal) — before ⟨ng⟩ (prenasalized ᵑɡ).
            if (i <= w.Length - DEF.VelarNasal.Length &&
                string.CompareOrdinal(w, i, DEF.VelarNasal, 0, DEF.VelarNasal.Length) == 0)
            {
                segs.Add(new Seg { Ph = "ŋ", Nucleus = false });
                i += DEF.VelarNasal.Length;
                continue;
            }
            var two = s[i] + (i + 1 < n ? s[i + 1] : "");
            if (TWO.TryGetValue(two, out var twoPh) && twoPh != "")
            {
                segs.Add(new Seg { Ph = twoPh, Nucleus = false });
                i += 2;
                continue;
            }
            var c = s[i];
            if (VOWEL_LETTER.Contains(c, StringComparison.Ordinal))
            {
                // Two identical adjacent vowels (⟨aa⟩ ⟨ee⟩ …) are one LONG vowel (kuu→kuː, taa→taː).
                var isLong = i + 1 < n && s[i + 1] == c;
                segs.Add(new Seg { Ph = DEF.Vowels[c] + (isLong ? "ː" : ""), Nucleus = true });
                i += isLong ? 2 : 1;
            }
            else if (c == "w" &&
                     segs.Count > 0 &&
                     !segs[^1].Nucleus &&
                     VOWEL_LETTER.Contains(i + 1 < n ? s[i + 1] : "", StringComparison.Ordinal))
            {
                // ⚠ NO `i + 1 < n` GUARD, AND THAT IS THE POINT. The TS tests
                // `VOWEL_LETTER.includes(s[i + 1] ?? "")`, and `"aeiou".includes("")` is TRUE — so a
                // word-FINAL ⟨w⟩ after a consonant onset labializes that consonant. .NET's
                // `Contains("")` is true as well, so the empty string reproduces it. Adding the
                // bounds check here would look defensive and silently drop the final-w case; German
                // lost four rules to exactly this shape, which is why it is called out here.
                // ⟨w⟩ after a consonant onset, before a vowel → labialization on that consonant (kweli→kʷeli, mwezi→mʷezi).
                segs[^1].Ph += "ʷ";
                i++;
            }
            else if (c == "m" || c == "n")
            {
                // A nasal before another (non-glide) consonant is SYLLABIC; before a vowel/glide it is a plain onset.
                var nx = i + 1 < n ? s[i + 1] : null;
                var syllabic = nx is null || (IsConsonantLetter(nx) && nx != "w" && nx != "y");
                segs.Add(new Seg { Ph = syllabic ? c + "̩" : c, Nucleus = syllabic });
                i++;
            }
            else if (DEF.Consonants.TryGetValue(c, out var consPh))
            {
                segs.Add(new Seg { Ph = consPh, Nucleus = false });
                i++;
            }
            else i++; // unknown → skip
        }
        return segs;
    }

    /** One Swahili word → canonical IPA (penultimate stress). */
    public static string PhonemizeWord(string word)
    {
        var segs = Scan(word.ToLowerInvariant());
        if (segs.Count == 0) return "";
        var nuclei = segs.Select((sg, i) => sg.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        // Penultimate stress (regular); a monosyllable is stressed on its only nucleus.
        var stress = nuclei.Count >= 2 ? nuclei[^2] : (nuclei.Count > 0 ? nuclei[0] : -1);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    // ── Numbers (standard Swahili, joined by "na") ────────────────────────────────
    private static string BelowHundred(double n)
    {
        if (n == 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n == 10) return NUM.Ten;
        if (n < 20) return $"{NUM.Ten} {NUM.And} {NUM.Units[(int)n - 10]}";
        double t = Math.Floor(n / 10), u = n % 10;
        return NUM.Tens[Js.NumberToString(t)] + (u != 0 ? $" {NUM.And} {NUM.Units[(int)u]}" : "");
    }

    private static string BelowThousand(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return BelowHundred(n);
        var hw = $"{NUM.Hundred} {(h == 1 ? NUM.Units[1] : NUM.Units[(int)h])}";
        return r != 0 ? $"{hw} {NUM.And} {BelowHundred(r)}" : hw;
    }

    /**
     * Non-negative integer → standard Swahili numeral spelling, or "" when the authored scale cannot express it.
     *
     * ⚠ THE LADDER STOPS AT `milioni` AND ABOVE 10⁹ IT USED TO EMIT THE ENGLISH WORD "undefined" INTO THE IPA.
     * `belowThousand(mil)` indexes `NUM.units[Math.floor(mil / 100)]`, and for n ≥ 10⁹ the count of millions is
     * itself ≥ 1000, so that index is 10 or more — off the end of a ten-element array. JavaScript yields
     * `undefined`, the template literal interpolates it as the six-letter string, and the g2p then reads it as
     * an ordinary Swahili word: `1000000000` came out *miliˈoni mˈia uⁿdefˈineɗ*. C# throws on the same index,
     * which is how the port's off-golden probe found it. Fixed TS-first in #910; the composition REFUSES here
     * too and the caller's digit-at-a-time fallback speaks the numeral.
     */
    private static string NumberToText(double n)
    {
        if (n == 0) return NUM.Units[0];
        var groups = new List<string>();
        var mil = Math.Floor(n / 1_000_000);
        if (mil >= 1000) return ""; // beyond `milioni` — see the note above
        if (mil != 0)
        {
            groups.Add($"{NUM.Million} {BelowThousand(mil)}");
            n %= 1_000_000;
        }
        var th = Math.Floor(n / 1000);
        if (th != 0)
        {
            groups.Add($"{NUM.Thousand} {BelowThousand(th)}");
            n %= 1000;
        }
        if (n != 0) groups.Add(BelowThousand(n));
        return string.Join($" {NUM.And} ", groups);
    }

    /**
     * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
     * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
     * use, i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zA-Z']";
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
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'")})|(\\d+)|([.?!,;:])", "gu");

    /**
     * Shared symbol tier — PERCENT ONLY, and that is a measured decision, not an omission.
     *
     * · `percentPrefix` is exactly the Swahili order: the corpus writes *asilimia 31*, *asilimia 93*,
     *   *asilimia 3 hadi 5* (×16 spelled out), so `80%` → `asilimia 80` needs no local rule at all.
     *   `percent` is a ONE-element `CountForms` because *asilimia* is a class 9/10 N-class noun, which is
     *   invariant in both number and numeral agreement.
     * · `units` is NOT declared: there is not a single abbreviated unit symbol in the 1,938-utterance corpus.
     *   Swahili spells the measure noun out and puts it BEFORE the numeral (*kilomita 70 kwa saa*), so there
     *   is nothing for a "number then symbol" matcher to find, and declaring short keys like `m` would only
     *   create the `Il-76s` class of false positive the tier's own comment warns about.
     * · `currency` is NOT declared either, for a different reason — the tier always emits the currency word
     *   AFTER the number and offers no `currencyPrefix` to mirror `percentPrefix`, while the corpus writes
     *   *dola 30*. Swahili therefore handles currency locally in normalize.ts. Recorded as a core limitation
     *   rather than worked around in core.
     */
    // MIGRATION: currency moved off the local rule onto the shared tier, now that `currencyPrefix`
    // exists. Swahili puts the measure noun BEFORE the number for every measure it writes out — "dola 30 za
    // Kimarekani", "kilomita 70 kwa saa" — which is why the local rule existed. Verified byte-identical over
    // the whole sw_ke corpus.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
        // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
        // na is ×3577 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
        //
        // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
        // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
        // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
        // see the tier, where the spacing exists because `B&B` is two initialisms.
        Ampersand = "na",
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
        // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
        // One word, so `by` defaults to it; this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "mara" },
        Percent = new[] { "asilimia" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dola" }, ["€"] = new[] { "euro" }, ["£"] = new[] { "pauni" }, ["¥"] = new[] { "yeni" },
            ["KSh"] = new[] { "shilingi" }, ["TSh"] = new[] { "shilingi" },
        },
        CurrencyPrefix = true,
        // `5 km` read as *tˈano kˈm̩*: no unit was declared, and until now none COULD be, because Swahili
        // puts the measure noun FIRST and the tier only emitted it after. Counted over sw_ke's four attested unit
        // words: 82 unit-before to 0 unit-after — "Mbuga hiyo inachukua kilomita 19,500 mraba", "mtindo huru wa
        // mita 100 na mita 200". Hence `unitPrefix`, the mirror of the `currencyPrefix` already set above.
        // Verified: kilomita ×59, mita ×23, kilogramu ×6, sentimita ×2.
        UnitPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomita" }, ["m"] = new[] { "mita" }, ["cm"] = new[] { "sentimita" },
            ["kg"] = new[] { "kilogramu" },
        },
        // THE RATE, because declaring the unit alone left a stray letter. sw_ke writes `160 Km/h` ×2 — with a
        // CAPITAL K, which a case-sensitive grep misses and the tier's `giu` pattern does not — and once `Km` read
        // as kilomita the `/h` was stranded as a bare *h*. "kwa saa" is attested ×34 and "kwa sekunde" ×5.
        UnitPer = "kwa",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["h"] = "saa", ["s"] = "sekunde",
        },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // ORDER: the shared symbol tier runs FIRST, then normalize.ts. The tier matches on a raw
            // `<number> %` adjacency, and normalize.ts's decimal rewrite (`1.5` → `1 nukta 5`) destroys
            // exactly that adjacency — the reverse order would have left a percent sign stranded on any
            // decimal. Nothing normalize.ts emits can create a new percent sign, so the order is safe.
            Clauses.AssembleClauses(Normalize.NormalizeSwahili(SYMBOLS(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO BE EMITTED STRAIGHT INTO THE IPA. Refusing to
                    // COMPOSE is right — the float has already lost the low digits — but the else emitted the
                    // token itself, which is not a reading. Digit-at-a-time through the same number words
                    // instead; see core/numbers.ts `spellDigits` for the account and the cost.
                    // ⚠ THE FALLBACK ALSO COVERS A REFUSED COMPOSITION, not only an unsafe integer. `NumberToText`
                    // returns "" above 10⁹ because the authored ladder stops at `milioni`; before that guard the
                    // composer fabricated the word "undefined" and this branch happily spoke it.
                    var num = Js.Number(m.Groups[2].Value);
                    var composed = double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d ? NumberToText(num) : "";
                    if (composed != "")
                        foreach (var wd in composed.Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    else
                        foreach (var d in Js.CodePoints(m.Groups[2].Value))
                            foreach (var wd in NumberToText(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Swahili phonemizer (no data files beyond the manifest — the engine is rule-based). */
    /**
     * NO FOREIGN PHONEMIZER IS WIRED, and that is deliberate rather than an oversight.
     *
     * Languages in a non-Latin script (gu, ps, kn, ml, ak …) take `(latin) => english.text(latin)` because
     * embedded Latin there really is foreign text. Swahili is Latin-script, so `GPS` is not foreign — it is an
     * acronym IN Swahili, and routing it to English would put English phonemes in a Swahili stream, which is
     * the exact defect the Japanese, Thai and Greek runs each worked to remove.
     *
     * The correct reading is Swahili letter names, which `core/initialisms.ts` would supply given an
     * `acronymLetters` table — but the Swahili run found no source for them, so none is authored. Until one
     * exists an unreadable acronym stays a cluster (GPS → [ɠps]). That is a MISSING reading rather than a
     * confidently wrong one, which is the trade an unsourced substitute always loses.
     */
    public static ILanguage CreateSwahili() => new Engine();

    internal static void RegisterSelf() => Registry.Register("swahili", CreateSwahili);
}
