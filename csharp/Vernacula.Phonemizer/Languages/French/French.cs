/**
 * French (fr) phonemizer — canonical IPA (standard/Parisian). Primary path is a
 * pronunciation LEXICON (Lexique 3.83, ~125k forms) that carries every irregular as data; the rule-based
 * g2p (g2p.ts) is the out-of-vocabulary fallback for unseen words. text() tokenizes words / numbers /
 * punctuation; French has no lexical stress, so a single phrase-final accent marks each rhythmic group.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class FrenchPhonemizer
{
    // Lexique 3.83 pronunciation lexicon: word → IPA for ~125k attested forms, loaded once (lazily).
    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/french", "lexicon.tsv");

    /**
     * SUPPLEMENT — our own cleanroom pronunciations for words Lexique 3.83 does not contain and the rule g2p
     * gets wrong. Kept as a SEPARATE file from lexicon.tsv on purpose: that file is provenanced Lexique data,
     * and editing it would muddy both its provenance and any future re-import. This one is additive only —
     * every key here is absent from Lexique, so the two can never disagree and Lexique stays authoritative
     * for everything it covers.
     *
     * ⚠ THE ENTRIES EXIST BECAUSE normalize.ts EMITS WORDS ORDINARY TEXT NEVER CONTAINS, so a word that was
     * previously unreachable is suddenly on the hot path: `20 °C` → "degrés celsius", where the g2p drops the
     * final ⟨s⟩ that French sounds in this Latin loan ([sɛlsjys], not [sɛlsjy]).
     *
     * Audited rather than guessed: every word the normalizer can emit was checked against Lexique, and only the
     * ones actually wrong are listed — which is why this is three lines and not twenty-two.
     *
     * ⚠ DELIBERATE NON-ENTRY: `Jésus-Christ`. The g2p gives [ʒezykʁist] and the traditional dictionary form is
     * [ʒezykʁi], but both are current in speech, so the existing reading is a legitimate variant rather than a
     * defect and is left alone.
     */
    private static Dictionary<string, string>? SUPPLEMENT;
    private static Dictionary<string, string> Supplement() =>
        SUPPLEMENT ??= LoadTsv.LoadTsvMap("languages/french", "supplement.tsv");

    /** The Lexique pronunciation lexicon (lowercased word → IPA). Exposed so the async neural path (frNeural.ts) can skip
     *  lexicon-covered words — they are served authoritatively by the sync lexicon path. */
    public static IReadOnlyDictionary<string, string> FrenchLexicon() => Lexicon();

    private static readonly JsRe VOWEL_IPA = JsRegex.Compile("[aeiouyɛɔøœəɑ]", "");

    /** One French word → IPA: lexicon lookup first, then the neural tagger (oovOverride, async path only), then the g2p
     *  engine for out-of-vocabulary words. */
    public static string PhonemizeWord(string word, Func<string, string?>? oovOverride = null)
    {
        var lower = word.ToLowerInvariant();
        var direct = Lexicon().GetValueOrDefault(lower)
                     ?? Supplement().GetValueOrDefault(lower)
                     ?? oovOverride?.Invoke(lower);
        if (direct is not null) return direct;
        // Hyphenated compound that Lexique does not attest: resolve each element and join WITHOUT a space.
        // A French hyphen is not a word boundary for pronunciation — quarante-et-un is [kaʁɑ̃teœ̃], one
        // phonological word — so concatenating the parts is right where a space would insert a break and
        // suppress the join. Parts contain no hyphen, so the recursion is one level deep.
        if (lower.Contains('-'))
        {
            var parts = lower.Split('-').Where(p => p != "").ToList();
            if (parts.Count > 1) return string.Concat(parts.Select(p => PhonemizeWord(p, oovOverride)));
        }
        return G2p.ToIpa(word);
    }

    // ── Heteronyms ──────────────────────────────────────────────────────────────────────────────────────
    /**
     * One spelling with two readings, selected by the NEIGHBOURING words. French has no POS tagger, and
     * Lexique carries a single reading per spelling, so the alternate lives in french.jsonc together with the
     * context that picks it. Resolution runs in text(), which is the only place with neighbours — a bare
     * phonemizeWord() call has no context and keeps returning the Lexique reading.
     */
    private static IReadOnlyDictionary<string, HeteronymEntry> HETERONYMS => Manifest.MANIFEST.Heteronyms;

    /** Clitics that can sit between a subject pronoun and its verb ("ils NE content pas", "ils SE couvent"),
     *  so the pronoun test looks one word further back when it finds one. Without this, the -ent verb rule
     *  would miss every negated or reflexive clause. */
    private static readonly IReadOnlySet<string> CLITIC = new HashSet<string>(new[]
    {
        "ne", "se", "me", "te", "nous", "vous", "le", "la", "les", "lui", "leur", "y", "en",
    }, StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> NUMBER_WORD = new HashSet<string>(new[]
    {
        "zéro", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
        "onze", "douze", "treize", "quatorze", "quinze", "seize", "vingt", "trente", "quarante",
        "cinquante", "soixante", "cent", "mille", "million", "milliard",
    }, StringComparer.Ordinal);

    /** The heteronym reading for `word` given its neighbours, or undefined to fall through to the lexicon. */
    private static string? HeteronymIpa(string word, string? prev, string? prev2, string? next)
    {
        if (!HETERONYMS.TryGetValue(word, out var entry)) return null;
        foreach (var c in entry.Cases)
        {
            if (c.NextIsNumber == true && next is not null && NUMBER_WORD.Contains(next)) return c.Ipa;
            if (c.Next is not null && next is not null && c.Next.Contains(next)) return c.Ipa;
            if (c.Prev is not null && prev is not null)
            {
                // Look past one clitic so a negated or reflexive 3rd-person-plural clause still matches.
                if (c.Prev.Contains(prev)) return c.Ipa;
                if (CLITIC.Contains(prev) && prev2 is not null && c.Prev.Contains(prev2)) return c.Ipa;
            }
        }
        // No case matched: fall through so the LEXICON supplies the reading. `default` is recorded in the
        // data as documentation of what that reading is, and is deliberately not re-asserted here.
        return null;
    }

    private static readonly JsRe VOWEL_ALL = JsRegex.Compile("[aeiouyɛɔøœəɑ]", "g");

    /** Add a phrase-final accent: ˈ before the last vowel of the last IPA token (rhythmic-group stress). */
    private static void AccentFinal(List<string> tokens)
    {
        for (var k = tokens.Count - 1; k >= 0; k--)
        {
            var t = tokens[k];
            if (!VOWEL_IPA.IsMatch(t)) continue;
            var m = VOWEL_ALL.Matches(t);
            var last = m[^1];
            tokens[k] = t[..last.Index] + "ˈ" + t[last.Index..];
            return;
        }
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // ⚠ THE WORD CLASS ADMITS AN INTERNAL HYPHEN as well as an apostrophe, so a hyphenated compound arrives as
    // ONE token and resolves against Lexique's attested compounds (dix-septième → [disɛtjɛm], peut-être →
    // [pøtɛtʁ]). Splitting at the hyphen phonemizes each half in isolation and loses exactly the
    // compound-internal liaison the hyphen marks. The hyphen must sit BETWEEN letters, so a dash between words
    // ("Paris — Lyon") and a digit range ("1918-1939") are unaffected.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([a-zà-ÿœæ]+(?:[-'’][a-zà-ÿœæ]+)*)|(\\d+(?:[.,]\\d+)?)|([.!?…,;:])", "giu");

    // Obligatory liaison: a normally-silent final consonant of a function word / number is pronounced as the
    // onset of a following vowel-initial word. z after plural determiners/pronouns & the -x/-s numbers; n after
    // nasal monosyllables; t after est/sont/tout/petit… (grand/quand: d→t). Attached to the next word (re-syllabified).
    private static IReadOnlyDictionary<string, string> LIAISON => Manifest.MANIFEST.Liaison;
    // h aspiré (and vowel-initial words that block liaison, e.g. huit/onze/y-): the following word looks
    // vowel-initial but forbids liaison — les héros → le eʁo, not le zeʁo.
    private static readonly IReadOnlySet<string> H_ASPIRE =
        new HashSet<string>(Manifest.MANIFEST.HAspire, StringComparer.Ordinal);
    private static readonly JsRe STARTS_VOWEL = JsRegex.Compile("^[aeiouyàâäéèêëîïôöûüùœæh]", "i"); // h → treat as mute unless the word is in H_ASPIRE
    private static readonly JsRe FINAL_S = JsRegex.Compile("s$", "");

    private static string LiaisonOnto(string prev, string next)
    {
        var c = LIAISON.GetValueOrDefault(prev.ToLowerInvariant());
        if (string.IsNullOrEmpty(c)) return "";
        var nx = next.ToLowerInvariant();
        var aspire = H_ASPIRE.Contains(nx) || H_ASPIRE.Contains(FINAL_S.Replace(nx, "")); // plural: homards, haricots
        return STARTS_VOWEL.IsMatch(nx) && !aspire ? c : "";
    }

    // The liaison consonant re-syllabifies as the next word's onset; if the citation form already realises that
    // latent consonant (cet→sɛt, six→sis, dix→dis), strip it here so it isn't doubled. z↔final s/z, t↔t/d, n↔n.
    private static readonly IReadOnlyDictionary<string, JsRe> LATENT = new Dictionary<string, JsRe>(StringComparer.Ordinal)
    {
        ["z"] = JsRegex.Compile("[sz]$", ""),
        ["t"] = JsRegex.Compile("[td]$", ""),
        ["n"] = JsRegex.Compile("n$", ""),
    };

    private static string StripLatent(string ipa, string c) =>
        LATENT.TryGetValue(c, out var re) && re.IsMatch(ipa) ? ipa[..^1] : ipa;

    // French words for %, currency signs, and unit abbreviations.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND IS A LATIN-SCRIPT PRINTING LIGATURE, so what it takes is a READING and not a
        // translation. For a language written in Latin script that is its own conjunction; for one that is not,
        // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
        // see the tier, where the spacing exists because `B&B` is two initialisms.
        Ampersand = "et",
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
        // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
        // One word, so `by` defaults to it; this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "fois" },
        Percent = new[] { "pour cent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro", "euros" }, ["$"] = new[] { "dollar", "dollars" },
            ["£"] = new[] { "livre", "livres" }, ["¥"] = new[] { "yen", "yens" },
        },
        // Longest keys match first (the builder sorts by length), so km/h beats km and °c beats c.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilomètre", "kilomètres" }, ["cm"] = new[] { "centimètre", "centimètres" },
            ["mm"] = new[] { "millimètre", "millimètres" }, ["kg"] = new[] { "kilogramme", "kilogrammes" },
            ["mg"] = new[] { "milligramme", "milligrammes" }, ["g"] = new[] { "gramme", "grammes" },
            ["t"] = new[] { "tonne", "tonnes" }, ["m"] = new[] { "mètre", "mètres" },
            // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
            // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
            // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
            ["l"] = new[] { "litre", "litres" }, ["L"] = new[] { "litre", "litres" },
            ["ml"] = new[] { "millilitre", "millilitres" }, ["cl"] = new[] { "centilitre", "centilitres" },
            ["dl"] = new[] { "décilitre", "décilitres" }, ["ha"] = new[] { "hectare", "hectares" },
            ["km/h"] = new[] { "kilomètre par heure", "kilomètres par heure" },
            ["m/s"] = new[] { "mètre par seconde", "mètres par seconde" },
            ["°c"] = new[] { "degré Celsius", "degrés Celsius" }, ["°f"] = new[] { "degré Fahrenheit", "degrés Fahrenheit" },
            // ⚠ ⟨W⟩ capital (named after Watt) — a one-letter symbol resolves case-SENSITIVELY since #763. The
            // multi-letter kw/hz/khz/mhz still fold, so their sloppy spellings keep reading.
            ["kw"] = new[] { "kilowatt", "kilowatts" }, ["W"] = new[] { "watt", "watts" }, ["hz"] = new[] { "hertz" },
            ["khz"] = new[] { "kilohertz" }, ["mhz"] = new[] { "mégahertz" },
            ["go"] = new[] { "gigaoctet", "gigaoctets" }, ["mo"] = new[] { "mégaoctet", "mégaoctets" },
            ["ko"] = new[] { "kilooctet", "kilooctets" }, ["min"] = new[] { "minute", "minutes" },
        },
        // `kilomètres carrés` ×9 and `mètres cubes` ×2. The adjective agrees, so both numbers are listed; only
        // the PLURAL is corpus-attested (no `1 km²` occurs) and the singular is regular agreement, stated here
        // rather than left to look like an attested form.
        // ⚠ Bare `carré` ×2 is the SHAPE ("un carré dont le côté inférieur est manquant") — the collocation
        // with the unit noun is the attestation, never the bare word.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "carré", "carrés" }, Cubed = new[] { "cube", "cubes" }, Position = "after",
        },
        // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
        // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
        // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
        // they are different words (kilomètres carrés but vingt au carré).
        // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
        // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
        // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
        // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
        // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
        // The cardinal is used for the generic power, never the ordinal — see core for that argument.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} au carré", Cubed = "{n} au cube", Power = "{n} puissance {e}", Negative = "moins",
        },
        Magnitudes = new[] { "millions", "million", "milliards", "milliard" },
        MagnitudeConnective = "de", // cinq millions DE dollars
    });

    /**
     * numeral normalization, run before tokenization. Three passes, in this order:
     *   1. ROMAN ORDINALS (XVIIe siècle → dix-septième siècle). Must precede pass 3, or the bare-Roman pass
     *      would rewrite XVII to digits and leave a stranded "e" to be spoken as a word.
     *   2. DIGIT ORDINALS (1er → premier, 37e → trente-septième). This is what the corpus actually contains:
     *      no Roman ordinal occurs in fr FLEURS at all, while 1er/37e/190e/60e/5e/3e/11e/15e occur 48 times.
     *   3. BARE ROMANS → digits (louis XIV → louis 14), spoken by the cardinal path. French reads a
     *      name-attached numeral as a CARDINAL (louis quatorze), so no context wordlist is needed here,
     *      unlike English. Delegated to the shared pass, which supplies the case discipline and the
     *      cross-language homograph stoplist (dix, mi, di, ci, li, vi, xi, mm/cm/ml …).
     * Ordinal formation itself lives in ordinals.ts; it is unbounded, replacing a hardcoded 2–20 table.
     */
    private static string NormalizeFrenchNumerals(string text)
    {
        var s = Ordinals.NormalizeFrenchOrdinalRomans(text, w => Lexicon().ContainsKey(w));
        return Roman.NormalizeRomans(Ordinals.NormalizeFrenchOrdinalDigits(s));
    }

    private abstract record Item;
    private sealed record WordItem(string Word) : Item;
    private sealed record PauseItem(string Pause) : Item;
    private sealed record IpaItem(string Ipa) : Item;

    private static readonly JsRe DECIMAL_SPLIT = JsRegex.Compile("[.,]", "");

    /** The engine. `text` is two-arity as in the TS (`createFrench()` returns `{ text(input, oovOverride?) }`),
     *  and the one-arity overload is what the registry's `ILanguage` calls. */
    public sealed class FrenchEngine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal FrenchEngine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input) => Text(input, null);

        // `oovOverride` (neural path only, frNeural.ts) resolves OOV words between the lexicon and the rule g2p; the sync
        // path omits it, so tokenizer / numbers / liaison / accentuation are byte-identical to phonemize(text, "fr").
        public string Text(string input, Func<string, string?>? oovOverride)
        {
            bool IsWord(string w) => Lexicon().ContainsKey(w);
            // NORMALIZATION ORDER: general text normalization (abbreviations, era markers, numéro,
            // digit degrouping) → NUMERALS (roman ordinals, digit ordinals, bare romans) → INITIALISMS, which
            // must see the all-caps runs the numeral pass declined → SYMBOLS (%, currency, units) last, since
            // the time rule upstream has already claimed the hour marker.
            input = SYMBOLS(Normalize.NormalizeFrenchInitialisms(
                NormalizeFrenchNumerals(Normalize.NormalizeFrench(input, IsWord)), IsWord));
            // Flatten to a sequence of word strings / pause marks (numbers expand to their spelled words), so liaison
            // can look one word ahead across the whole stream (incl. spelled numbers: "2 ans" → deux → dø zˈɑ̃).
            // An `ipa` item is a run in a script French does not own, ALREADY resolved by whichever engine
            // owns that script (core/scripts.ts). It carries phonemes, not text, because there is no French
            // pronunciation of Владимир to look up — and critically it must stay OUT of the liaison
            // machinery, which is why it is a third variant rather than a `word` holding IPA.
            var items = new List<Item>();
            // GAPS between tokens carry embedded foreign text. French's word class is Latin-1 only, so a
            // Greek or Cyrillic run matched nothing and was dropped outright. French cannot use
            // `assembleClauses` — liaison needs to look one word AHEAD across the whole flattened stream, so
            // the items list must exist before any phonemes are produced — but the gap pass is separable from
            // the clause model, as it is in english.ts and burmese.ts.
            var gapCursor = 0;
            void ClaimGap(int upto)
            {
                if (upto > gapCursor)
                    foreach (Match g in JsRegex.MatchAll(Clauses.FOREIGN_RUN, input[gapCursor..upto]))
                    {
                        var ipa = Foreign.ReadForeignRun(g.Value);
                        if (ipa is not null && ipa != "") items.Add(new IpaItem(ipa));
                    }
                gapCursor = upto;
            }

            foreach (Match m in JsRegex.MatchAll(TOKEN, input))
            {
                ClaimGap(m.Index);
                gapCursor = m.Index + m.Value.Length;
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) items.Add(new WordItem(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var split = DECIMAL_SPLIT.Re.Split(m.Groups[2].Value);
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    foreach (var w in Numbers.NumberToWords(Js.Number(intPart)).Split(' '))
                        items.Add(new WordItem(w));
                    if (frac is not null)
                    {
                        // Decimal: "virgule" + the fractional part. French reads that part as a NUMBER
                        // (1,75 → un virgule soixante-quinze), not digit by digit, so long as doing so is
                        // unambiguous. A LEADING ZERO makes it ambiguous — reading "05" as a number would
                        // say 1,5 for 1,05 — and past three digits the number reading stops being useful,
                        // so both of those fall back to digit-by-digit.
                        items.Add(new WordItem(Manifest.MANIFEST.Numbers.DecimalSeparator));
                        var asNumber = frac.Length <= 3 && !frac.StartsWith("0", StringComparison.Ordinal);
                        var parts = asNumber
                            ? Numbers.NumberToWords(Js.Number(frac)).Split(' ').AsEnumerable()
                            : frac.SelectMany(d => Numbers.NumberToWords(Js.Number(d.ToString())).Split(' '));
                        foreach (var w in parts) items.Add(new WordItem(w));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) items.Add(new PauseItem(mk));
                }
            }
            ClaimGap(input.Length);

            var group = new List<string>(); // IPA tokens of the current rhythmic group (until a pause)
            var @out = "";
            var carry = ""; // liaison consonant to prepend to the next word (its new onset)
            void Flush(string? pause)
            {
                if (group.Count > 0)
                {
                    AccentFinal(group);
                    @out += (@out != "" ? " " : "") + string.Join(" ", group);
                    group = new List<string>();
                }
                if (!string.IsNullOrEmpty(pause)) @out += $" {pause}";
            }

            for (var k = 0; k < items.Count; k++)
            {
                var it = items[k];
                if (it is PauseItem p)
                {
                    carry = "";
                    if (group.Count > 0 || @out != "") Flush(p.Pause);
                    continue;
                } // liaison never crosses a pause
                if (it is IpaItem ip)
                {
                    // A foreign run neither RECEIVES a liaison consonant nor DONATES one: it is not a French
                    // word, so `liaisonOnto` has no lexicon entry to reason about and any carry would be
                    // spliced onto foreign phonemes. The `"word" in next` guard below already prevents the
                    // PREVIOUS word from setting a carry onto this item, so nothing is lost by clearing here.
                    carry = "";
                    group.Add(ip.Ipa);
                    continue;
                }
                var wi = (WordItem)it;
                // Heteronym first: it is the only reading that depends on context, so it must pre-empt the
                // lexicon (which has exactly one reading per spelling).
                var wLower = wi.Word.ToLowerInvariant();
                string? Neighbour(int j) =>
                    j >= 0 && j < items.Count && items[j] is WordItem n ? n.Word.ToLowerInvariant() : null;
                var het = HeteronymIpa(wLower, Neighbour(k - 1), Neighbour(k - 2), Neighbour(k + 1));
                var ipa = carry + (het ?? PhonemizeWord(wi.Word, oovOverride));
                carry = "";
                var next = k + 1 < items.Count ? items[k + 1] : null; // liaison only onto an immediately adjacent word
                // A context-selected HETERONYM reading does not participate in liaison as the left member. Its
                // final consonant is SOUNDED, not latent, so the liaison machinery would both move it onto the
                // next word and strip it here: the operator reading of "plus" ([plys]) came out as
                // "utc ply zœ̃" instead of "utc plys œ̃", which is the ordinary [ply] "more" reading plus a
                // liaison that arithmetic "plus un" does not have.
                if (next is WordItem nw && het is null)
                {
                    carry = LiaisonOnto(wi.Word, nw.Word);
                    if (carry != "") ipa = StripLatent(ipa, carry); // avoid doubling a citation-realised final consonant
                }
                if (ipa != "") group.Add(ipa);
            }
            Flush(null);
            return @out;
        }
    }

    /** Build the French phonemizer. `foreign` handles embedded non-French (unused for now). No data files. The returned
     *  `text` takes an optional per-call `oovOverride` (neural path only) injecting tagger readings for OOV words
     *  (lexicon → oovOverride → rule g2p); still assignable to Phonemizer. */
    public static FrenchEngine CreateFrench(Func<string, string>? foreign = null) => new(foreign);

    internal static void RegisterSelf() => Registry.Register("french", () => CreateFrench());
}
