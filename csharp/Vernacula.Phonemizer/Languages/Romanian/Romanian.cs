/**
 * Native Romanian (ro) text phonemizer — canonical IPA.
 *
 * Romanian is Eastern Romance with a shallow, near-phonemic Latin orthography (diacritics ă â î ș ț). The letter
 * maps live in romanian.jsonc; the CONTEXTUAL phonology lives here:
 *
 *   • c/g softening — ⟨ce ci⟩→t͡ʃ, ⟨ge gi⟩→d͡ʒ (⟨ci/gi⟩+V drops the silent softener i: ciorbă→t͡ʃorbə); the hard
 *     digraphs ⟨ch gh⟩→k/ɡ (chem→kem, ghem→ɡem).
 *   • rising diphthongs — ⟨ea⟩→e̯a, ⟨oa⟩→o̯a (the mid vowel is the non-syllabic on-glide: seară→se̯arə, floare→flo̯are).
 *   • i/u glides — prevocalic or postvocalic ⟨i⟩→j, ⟨u⟩→w (iarnă→jarnə, ziua→ziwa, mai→maj, eu→ew).
 *   • final-i desyllabification — an unstressed word-final ⟨i⟩ after a consonant PALATALISES it (lupi→lupʲ),
 *     ⟨ii⟩→iʲ (copii→kopiʲ); it stays syllabic after an obstruent+liquid cluster (membri) and in monosyllables (și).
 *   • word-initial ⟨e⟩→je in the copula/pronoun class (este→jeste, el→jel).
 *
 * Stress is UNWRITTEN and lexically unpredictable in Romanian; the broad referee marks none, so it is DEFERRED (no
 * ˈ emitted). Referee: wikipron ron_latn broad (HUMAN, 9285).
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Romanian;

public sealed class RomanianPhonemizer : ILanguage
{
    private const string Dir = "languages/romanian";

    /** Load the optional stress lexicon (word → stressed-nucleus position from the end). Absent → rules only. */
    private static Dictionary<string, double> LoadStressLex()
    {
        var raw = LoadTsv.LoadTsvMap(Dir, "romanian-stress.tsv", optional: true);
        var m = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var (k, v) in raw)
        {
            var n = Js.Number(v);
            if (double.IsInteger(n) && n >= 1) m[k] = n;
        }
        return m;
    }

    private static RomanianDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string VOWEL_LETTERS = "aeiouăâî";
    private const string FRONT = "ei"; // c/g soften before these
    private const string VOWEL_PH = "aeiouəɨ";
    private static readonly IReadOnlySet<string> OBSTRUENT = new HashSet<string>(DEF.Obstruents, StringComparer.Ordinal);
    // ⚠ `undefined` IS THE ONLY THING THESE REFUSE. The TS guards `c !== undefined` and then calls
    // `String.includes`, so an EMPTY string would test TRUE — and `.NET Contains("")` is true as well. Both
    // predicates are only ever handed a real code point or the end-of-word `null`, and the port keeps that
    // shape rather than adding a length guard the TS does not have.
    private static bool IsVowelLetter(string? c) => c is not null && VOWEL_LETTERS.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string? c) => c is not null && FRONT.Contains(c, StringComparison.Ordinal);

    // The copula (a fi) + 3rd-person pronoun forms whose word-initial ⟨e⟩ is pronounced [je] (este→jeste). NB: ⟨eu⟩ is
    // [ew] not [jew] in the broad referee, so it is excluded.
    private static readonly IReadOnlySet<string> INITIAL_JE = new HashSet<string>(new[]
    {
        "este", "ești", "e", "el", "ea", "ei", "ele",
        "eram", "erai", "era", "erați", "erau", "esti",
    }, StringComparer.Ordinal);

    /** Scan a lowercased Romanian word into phoneme strings (contextual c/g, digraphs, diphthongs, glides). */
    private static List<string> Scan(string word)
    {
        var s = Js.CodePoints(word);
        var n = s.Count;
        var outp = new List<string>();
        bool PrevIsVowel() => outp.Count > 0 && VOWEL_PH.Contains(Last1(outp[^1]), StringComparison.Ordinal);
        // muta cum liquida: a branching onset obstruent+liquid (Cr/Cl) can't take a following glide, so an ⟨i⟩ after
        // it stays a syllabic nucleus (Alexandria→…dria, Austria→awstria, Abaclia→abaklia), NOT a glide.
        bool AfterMutaLiquida() =>
            outp.Count >= 2 && "lr".Contains(outp[^1], StringComparison.Ordinal) && OBSTRUENT.Contains(outp[^2]);

        var i = 0;
        while (i < n)
        {
            var c = s[i];
            var nx = i + 1 < n ? s[i + 1] : null;
            var nn = i + 2 < n ? s[i + 2] : null;

            // ⟨c⟩: ch→k; before e/i → t͡ʃ (⟨ci⟩+V silent softener i); else k.
            if (c == "c")
            {
                if (nx == "h") { outp.Add("k"); i += 2; continue; } // ch → k (chem→kem, chiar→kjar via i-glide)
                if (IsFront(nx))
                {
                    outp.Add("t͡ʃ");
                    if (nx == "i" && IsVowelLetter(nn)) i += 2; // ⟨ci⟩+V: silent i, leave the vowel (ciorbă)
                    else i += 1; // else the e/i is a pronounced nucleus (ce, ci, cea via ea-rule)
                    continue;
                }
                outp.Add("k"); i += 1; continue;
            }
            // ⟨g⟩: gh→ɡ; before e/i → d͡ʒ (⟨gi⟩+V silent i); else ɡ.
            if (c == "g")
            {
                if (nx == "h") { outp.Add("ɡ"); i += 2; continue; } // gh → ɡ
                if (IsFront(nx))
                {
                    outp.Add("d͡ʒ");
                    if (nx == "i" && IsVowelLetter(nn)) i += 2; // ⟨gi⟩+V: silent i
                    else i += 1;
                    continue;
                }
                outp.Add("ɡ"); i += 1; continue;
            }
            // ⟨qu⟩ → kw (loanwords); ⟨q⟩ alone → k.
            if (c == "q")
            {
                outp.Add("k");
                if (nx == "u" && IsVowelLetter(nn)) { outp.Add("w"); i += 2; } else i += 1;
                continue;
            }

            // ── vowels, diphthongs & glides ──
            if (IsVowelLetter(c))
            {
                // Rising diphthongs: the mid vowel ⟨e⟩/⟨o⟩ before ⟨a⟩ is the non-syllabic on-glide (ea→e̯a, oa→o̯a).
                if ((c == "e" || c == "o") && nx == "a")
                {
                    outp.Add(c == "e" ? "e̯" : "o̯");
                    i += 1;
                    continue;
                }
                // Word-final ⟨ie⟩ after a CONSONANT is a HIATUS [i.e] (geografie→…fi.e, istorie) — keep i syllabic.
                // (After a vowel it is an off-glide: cheie→keje, so require a consonant before it.)
                if (c == "i" && nx == "e" && i + 2 == n && !PrevIsVowel())
                {
                    outp.Add("i");
                    i += 1;
                    continue;
                }
                // ⟨i⟩/⟨u⟩ are semivowels, but only ONE vowel in a sequence glides (the other is the nucleus):
                //   • OFF-glide — a high vowel AFTER a nucleus (ai→aj, eu→ew, ui→uj, iu→iw, -ei→ej).
                //   • ON-glide — a high vowel starting the syllable BEFORE a NON-high vowel (ia→ja, ua→wa, ie→je).
                // Not before another high vowel (that keeps ⟨ui iu⟩ from double-gliding to a nucleus-less wj/jw).
                static bool IsHigh(string? x) => x == "i" || x == "u";
                var onglide = IsVowelLetter(nx) && !IsHigh(nx) && !AfterMutaLiquida();
                if (IsHigh(c) && (PrevIsVowel() || onglide))
                {
                    outp.Add(c == "i" ? "j" : "w");
                    i += 1;
                    continue;
                }
                outp.Add(DEF.Vowels.TryGetValue(c, out var v) ? v : c);
                i += 1;
                continue;
            }

            // ⟨x⟩ → [ɡz] in the word-initial prefix ⟨ex⟩+V (examen→eɡzamen, exact→eɡzakt); [ks] everywhere else,
            // including medial names (Alexandru→aleksandru, taxi, text) where the intervocalic gz rule over-fires.
            if (c == "x")
            {
                outp.Add(i == 1 && s[0] == "e" && IsVowelLetter(nx) ? "ɡz" : "ks");
                i += 1;
                continue;
            }
            // ── consonants ──
            if (DEF.Consonants.TryGetValue(c, out var ph))
            {
                if (ph.Length > 0) outp.Add(ph);
                i += 1;
                continue;
            }
            i += 1; // unknown → skip
        }
        return outp;
    }

    /** JS `p.slice(-1)` — the LAST code unit, which is what the vowel tests compare. */
    private static string Last1(string p) => p.Length == 0 ? "" : p[^1..];

    private static bool IsVowelPh(string? p) => p is not null && VOWEL_PH.Contains(Last1(p), StringComparison.Ordinal);

    /**
     * Final unstressed ⟨i⟩ after a consonant desyllabifies to palatalisation on that consonant (lupi→lupʲ). It stays
     * syllabic in a monosyllable (și) and after an obstruent+liquid cluster (membri). ⟨ii⟩ → iʲ (copii→kopiʲ).
     */
    private static List<string> FinalI(List<string> segs)
    {
        if (segs.Count < 2 || segs[^1] != "i") return segs;
        var nuclei = segs.Count(IsVowelPh);
        if (nuclei < 2) return segs; // monosyllable → keep syllabic i
        var prev = segs[^2];
        // obstruent + liquid cluster before the i → syllabic (…bri, …tru-like): keep i
        var beforePrev = segs.Count >= 3 ? segs[^3] : null;
        if ((prev == "r" || prev == "l") && beforePrev is not null && !IsVowelPh(beforePrev)) return segs;
        // palatalise the preceding segment (a consonant, or the ⟨ii⟩ nucleus i→iʲ)
        var outp = segs.GetRange(0, segs.Count - 2);
        outp.Add(prev + "ʲ");
        return outp;
    }

    /**
     * Predict the stressed nucleus, as a position FROM THE END (1 = final nucleus, 2 = penult, …). Stress is UNWRITTEN
     * and lexically unpredictable in Romanian, but strongly conditioned on the ending (derived from the kaikki
     * distribution, 7.4k words): consonant-final → FINAL (69%, up to 94% for a final stop); vowel-final → PENULT (61%;
     * -e/-ă/-o 78-85%). One nucleus → final. The rule-unpredictable residual is closed by the lexicon (STRESS_LEX).
     */
    private static double StressFromEnd(string word, int nucleiCount)
    {
        if (nucleiCount <= 1) return 1;
        var chars = Js.CodePoints(word);
        // ⚠ `word[word.length - 1] ?? ""` AND `VOWEL_LETTERS.includes("")` IS TRUE — in JS and in .NET alike.
        // An empty word therefore takes the VOWEL arm, not the consonant one. Unreachable (a word with two
        // nuclei is not empty), and the port keeps the JS shape rather than guarding a case the TS does not.
        var last = chars.Count > 0 ? chars[^1] : "";
        // consonant-final → final (69%; -t/-s/-r 85-94%), EXCEPT ⟨-c⟩ → penult (the -ic adjective suffix dominates:
        // politic→poˈlitik, istoric→isˈtorik; 80% penult).
        if (!VOWEL_LETTERS.Contains(last, StringComparison.Ordinal)) return last == "c" ? 2 : 1;
        // ⟨-i⟩: after a VOWEL (glide, -ei/-ai genitives casei→ˈkasej) → PENULT; after a consonant (desyllabified
        // plural lupi→ˈlupʲ, elevi→eˈlevʲ) → FINAL of the remaining nuclei.
        if (last == "i")
            return VOWEL_LETTERS.Contains(chars.Count > 1 ? chars[^2] : "", StringComparison.Ordinal) ? 2 : 1;
        // other vowel-final: ⟨-a⟩ leans FINAL (feminines/verbs, 54%); -e/-ă/-o/-u lean PENULT (67-85%).
        return last == "a" ? 1 : 2;
    }

    /** Word → stressed-nucleus position from the END (1=final, 2=penult…), mined from kaikki for the rule-miss tail. */
    private static Dictionary<string, double>? STRESS_LEX;
    private static readonly object GATE = new();
    private static Dictionary<string, double> StressLex()
    {
        lock (GATE) return STRESS_LEX ??= LoadStressLex();
    }

    private static string PhonemizeCore(string word, bool useLex)
    {
        var lw = word.ToLowerInvariant();
        var segs = FinalI(Scan(lw));
        if (segs.Count == 0) return "";
        if (INITIAL_JE.Contains(lw)) segs.Insert(0, "j"); // copula/pronoun word-initial e → je (onset of syllable 1)
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++)
            if (VOWEL_PH.Contains(segs[i], StringComparison.Ordinal) && segs[i].Length == 1) nuclei.Add(i);
        var outp = "";
        if (nuclei.Count > 0)
        {
            var fromEnd = (useLex && StressLex().TryGetValue(lw, out var lex) ? lex : (double?)null)
                ?? StressFromEnd(lw, nuclei.Count);
            var idx = nuclei[(int)Math.Max(0, nuclei.Count - fromEnd)];
            // place ˈ before the syllable ONSET (walk back over onset consonants + any glide to the previous
            // nucleus), the standard convention: america→aˈmerika, floare→ˈflo̯are — not before the bare vowel.
            static bool IsNucleus(string? p) => p is not null && p.Length == 1 && VOWEL_PH.Contains(p, StringComparison.Ordinal);
            var onset = idx;
            while (onset > 0 && !IsNucleus(segs[onset - 1])) onset--;
            for (var i = 0; i < segs.Count; i++)
            {
                if (i == onset) outp += "ˈ";
                outp += segs[i];
            }
        }
        else outp = string.Concat(segs);
        return outp.Normalize(NormalizationForm.FormC);
    }

    /** One Romanian word → canonical IPA (with primary stress ˈ); shipped path (stress rule + kaikki lexicon). */
    public static string PhonemizeWord(string word) => PhonemizeCore(word, true);

    /** Rule-only path (no stress lexicon) — the non-circular stress signal (~74.5% vs kaikki). Segments are identical. */
    public static string PhonemizeWordRules(string word) => PhonemizeCore(word, false);

    // ── Numbers (compositional) ───────────────────────────────────────────────────
    private static RomanianNumbersDef NUM => DEF.Numbers;
    private static GenderedDef G => NUM.Gendered;

    /**
     * The GENDER a multiplier has to agree with. Romanian marks gender on the numerals whose unit figure is 1 or 2
     * only, and the magnitude words are NOUNS with their own gender: sută and mie are FEMININE, milion is NEUTER.
     * A neuter noun is masculine in the singular but FEMININE in the plural, so a neuter magnitude takes the
     * masculine form when the count ends in 1 and the feminine when it ends in 2. `"m"` is the un-agreeing case —
     * a bare number with no magnitude noun after it, which keeps the masculine counting forms (unu, doi).
     * Source: en.wikipedia.org/wiki/Romanian_numbers (quoted in romanian.jsonc).
     */
    private const string F = "f", N = "n", M = "m";

    /** One numeral WORD, in the form the following magnitude noun requires. 2 and 12 feminise for a feminine or a
     *  neuter-plural noun; 1 only for a feminine one (douăzeci și una de mii vs douăzeci și unu de milioane). */
    private static string Gendered(string word, string g)
    {
        if (g == M) return word;
        if (word == NUM.Units[2]) return G.TwoFeminine;
        if (word == NUM.Teens[2]) return G.TwelveFeminine;
        if (word == NUM.Units[1] && g == F) return G.OneFeminineFinal;
        return word;
    }

    /** `de` links a numeral to the noun it modifies once the count reaches 20: "for integer numbers from 20 to 100,
     *  preposition *de* is placed between the number name and the modified noun … For numbers from 0 to 19 *de* is
     *  not used" — which keys off the final two digits, so a round hundred/thousand count takes it too (o sută de
     *  mii). Source: en.wikipedia.org/wiki/Romanian_numbers. */
    private static bool NeedsDe(double count) => count % 100 == 0 || count % 100 >= 20;

    /** Romanian words for 0 ≤ n < 100, with the trailing unit agreeing with `g`. */
    private static string Under100(double n, string g)
    {
        if (n < 10) return Gendered(NUM.Units[(int)n], g);
        if (n < 20) return Gendered(NUM.Teens[(int)n - 10], g);
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? NUM.Tens[(int)t] : $"{NUM.Tens[(int)t]} {NUM.And} {Gendered(NUM.Units[(int)u], g)}";
    }

    /** Romanian words for 0 ≤ n < 1000. The HUNDREDS multiplier always agrees with sută/sute, which are feminine
     *  regardless of what follows (o sută, două sute); `g` governs only the trailing sub-hundred remainder.
     *  `stem` drops the feminine article on a bare hundred, for the ordinal (al sutălea, not *al o sutălea). */
    private static string Under1000(double n, string g, bool stem = false)
    {
        if (n < 100) return Under100(n, g);
        double h = Math.Floor(n / 100), rest = n % 100;
        var head =
            h == 1
                ? stem ? NUM.Hundred : $"{G.OneFeminine} {NUM.Hundred}"
                : $"{Gendered(NUM.Units[(int)h], F)} {NUM.Hundreds}";
        return rest == 0 ? head : $"{head} {Under100(rest, g)}";
    }

    /** A magnitude group: the agreeing multiplier + `de` where required + the magnitude noun. A count of exactly 1
     *  takes the ARTICLE, not the numeral — o mie, un milion (never *una mie / *unu milion). In `stem` mode (the
     *  ordinal path) the article and the `de` linker are dropped, since an ordinal is built on the bare numeral
     *  stem: al sutălea, al două miilea. */
    private static string MagnitudeGroup(double count, string g, string sg, string pl, bool stem)
    {
        if (count == 1) return stem ? sg : $"{(g == F ? G.OneFeminine : G.OneMasculine)} {sg}";
        var head = Under1000(count, g, stem);
        return NeedsDe(count) && !stem ? $"{head} {NUM.Of} {pl}" : $"{head} {pl}";
    }

    /** Romanian cardinal for a non-negative integer (up to the millions), with the magnitude nouns and their
     *  multipliers in agreement (două mii, o sută de mii, un milion, două milioane).
     *
     *  Exported so `romanOrdinals.ts` can wrap it in the `al …-lea` ordinal construction rather than
     *  re-authoring the numeral data — it passes `stem: true`, which strips the phrasal article and `de` linker
     *  that an ordinal does not take (al sutălea, not *al o sutălea). */
    public static string NumberWords(double n, bool stem = false)
    {
        if (n == 0) return NUM.Units[0];
        // Above the miliard tier the billions multiplier would need its own thousands grouping → read the digits
        // instead of indexing past the tables (which used to leak "undefined" into the IPA at 10⁹ itself).
        if (n >= 1e12)
            return string.Join(" ", Js.CodePoints(Js.NumberToString(n)).Select(d => NUM.Units[(int)Js.Number(d)]));
        var parts = new List<string>();
        double bil = Math.Floor(n / 1_000_000_000),
            mil = Math.Floor(n % 1_000_000_000 / 1_000_000),
            th = Math.Floor(n % 1_000_000 / 1000),
            rest = n % 1000;
        // milion and miliard are NEUTER (două milioane, două miliarde); mie is FEMININE (o mie, două mii); a bare
        // remainder agrees with nothing and keeps the masculine counting forms.
        if (bil > 0) parts.Add(MagnitudeGroup(bil, N, NUM.Billion, NUM.Billions, stem));
        if (mil > 0) parts.Add(MagnitudeGroup(mil, N, NUM.Million, NUM.Millions, stem));
        if (th > 0) parts.Add(MagnitudeGroup(th, F, NUM.Thousand, NUM.Thousands, stem));
        if (rest > 0) parts.Add(Under1000(rest, M, stem));
        return string.Join(" ", parts);
    }

    /**
     * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
     * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
     * use, i.e. a foreign name.
     *
     * ⚠ á é í ó ú à ARE DELIBERATELY ABSENT: the g2p has no rule for them, and drops them outright —
     * listing them here would promise a reading that does not exist. NATIVE_CLASS is a claim ABOUT
     * THE G2P, and `test/native-inventory.test.ts` measures it character by character rather than
     * trusting it.
     */
    private const string NATIVE_CLASS = "[a-zA-ZăâîșțA-ZĂÂÎȘȚ]";
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

    public string Text(string rawInput)
    {
        // everything the g2p cannot read is rewritten to Romanian words FIRST — see
        // normalize.ts, in particular why there is NO ordinal-dot rule here despite it being the
        // largest rule in the Germanic languages.
        return Clauses.AssembleClauses(Normalize.NormalizeRomanian(rawInput), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ⚠ ABOVE 2^53 THIS USED TO EMIT NOTHING AT ALL — the guard is right (the float has
                // already lost the low digits, so a composed numeral would be confidently WRONG) but it
                // had no else, so the NUMBER was deleted from the reading and the sentence still
                // scanned. Digit-at-a-time is what normalize.ts already gives a decimal tail; above 2^53
                // the reading is a digit string, not a quantity.
                var num = Js.Number(m.Groups[2].Value);
                if (double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d)
                {
                    foreach (var w in NumberWords(num).Split(' ')) sink.Emit(PhonemizeWord(w));
                }
                else
                {
                    foreach (var d in m.Groups[2].Value)
                        foreach (var w in NumberWords(Js.Number(d.ToString())).Split(' ')) sink.Emit(PhonemizeWord(w));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Romanian phonemizer. */
    public static ILanguage CreateRomanian() => new RomanianPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("romanian", CreateRomanian);
        Registry.RegisterRomanPolicy("ro", RomanOrdinals.ROMAN_POLICY);
    }
}
