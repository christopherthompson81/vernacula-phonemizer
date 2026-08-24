/**
 * Native Bengali (bn) text phonemizer — canonical IPA. Uses the generic abugida G2P
 * engine (core/abugida.ts) for the systematic akshara→IPA mapping, then layers the Bengali-specific
 * phonology that Hindi's assembly does NOT share:
 *
 *   1. Orthographic normalization: ং (velar-nasal sign) → ঙ্ (full [ŋ], not vowel nasalization); ৎ
 *      (khanda ta) → ত্ (vowelless dental [t̪]).
 *   2. geminate → length (fleet Indic convention) + aspiration-before-length reorder.
 *   3. VOWEL HARMONY: the inherent/independent /ɔ/ raises to [o] when a high or mid vowel (i u e o) follows
 *      in the next syllable (kɔr → kɔɾ, but kɔri → koɾi). Bengali's signature height harmony.
 *   4. INHERENT-VOWEL DELETION: unlike Hindi schwa deletion, Bengali drops the word-final inherent vowel
 *      after a single consonant (bɔl not bɔlɔ) but RETAINS it (as [o]) after a consonant CLUSTER
 *      (ɔŋʃo). Medial inherent vowels are kept.
 *
 * Stress is word-initial and weak in Bengali; the broad referee does not mark it, so we leave it unmarked.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public class BengaliDef : AbugidaDef
{
    public NumbersDef Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
    public Dictionary<string, string>? Symbols { get; set; }
    public string? StripSymbols { get; set; }
    /** Bengali height harmony (ɔ→o before a high vowel). Set false for Assamese, which lacks it. Default true. */
    public bool? HeightHarmony { get; set; }
    /** Hindi/Bengali-style medial inherent-vowel deletion. Set false for Assamese, which retains it. Default true. */
    public bool? MedialSchwaDeletion { get; set; }
    /** Skip the (Bengali-specific) whole-word lexicon override — set true for a reusing language (Assamese). */
    public bool? SkipLexicon { get; set; }
    /**
     * UNIT ABBREVIATION → the reusing language's OWN unit nouns, replacing the Bengali table below wholesale.
     *
     * ⚠ THE SHARED TIER'S UNIT WORDS ARE BENGALI VOCABULARY, and a reusing language inherits the SPELLING as
     * well as the word. For Assamese most of that is invisible — র and ৰ both read [ɹ], so `মিলিমিটার` and
     * `মিলিমিটাৰ` give byte-identical IPA — but `cm` is not: Bengali's `সেন্টিমিটার` runs through the Assamese
     * sibilant merger (স → [x], the signature of the language) and reads *xentimitaɹ*, where Assamese's own
     * `চেণ্টিমিটাৰ` reads *sentimitaɹ*. One declared word, one wrong phoneme, and nothing in the tier could
     * have known — so the words are language data, not engine data, and a reuser may bring its own.
     */
    public Dictionary<string, IReadOnlyList<string>>? UnitWords { get; set; }
}

/** The four entry points `makeNativeBengali` returns — the shape Assamese wraps. */
public sealed class NativeBengaliEngine
{
    public required Func<string, Func<string, string?>?, string> Word;
    public required Func<string, string> WordRules;
    public required Func<string, Func<string, string?>?, string> Number;
    public required Func<string, Func<string, string?>?, string> Text;
}

public static class Bengali
{
    // Whole-word pronunciation lexicon for the lexical vowel tail (closed-syllable ɔ→o, final-[o] retention) that no
    // rule can derive; provenance in bengali-lexicon.tsv. ⚠ The override applies only on the SHIPPED path
    // (phonemizeWord / text), never in the rule engine — which is what keeps the referee signal non-circular.
    private static Dictionary<string, string>? LEXICON;

    private static Dictionary<string, string> Lexicon()
    {
        if (LEXICON is null)
        {
            // NFC-normalize keys on load: Bengali nukta letters (ড় ঢ় য়) have composed/decomposed forms, and the
            // lookup normalizes the query to NFC — so the stored keys must be NFC too or a decomposed entry would
            // silently never match.
            LEXICON = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (k, v) in LoadTsv.LoadTsvMap("languages/bengali", "bengali-lexicon.tsv", optional: true))
                LEXICON[k.Normalize(System.Text.NormalizationForm.FormC)] = v;
        }
        return LEXICON;
    }

    /** The symbol tier's unit nouns, in BENGALI — the default a reusing language overrides with `unitWords`. */
    private static readonly Dictionary<string, IReadOnlyList<string>> BENGALI_UNITS = new(StringComparer.Ordinal)
    {
        ["km"] = new[] { "কিলোমিটার" }, ["cm"] = new[] { "সেন্টিমিটার" }, ["mm"] = new[] { "মিলিমিটার" },
        ["kg"] = new[] { "কিলোগ্রাম" }, ["m"] = new[] { "মিটার" }, ["g"] = new[] { "গ্রাম" },
        ["km/h"] = new[] { "কিলোমিটার প্রতি ঘন্টা" },
    };

    private static readonly JsRe VOWEL_G = JsRegex.Compile($"[{Unicode.IPA_VOWELS}]", "g");
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(Unicode.BENGALI_DIGITS.Keys);

    // A geminate consonant (doubled base, possibly aspirated) → single + length ː. Same fleet convention as hi/si.
    private static readonly JsRe GEMINATE =
        JsRegex.Compile("(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃɾɽŋjɦ])\\1(?!͡)", "gu");
    // A vowel nucleus (for the harmony look-ahead and syllable count). Bengali vowels + diphthong heads.
    // Bengali height harmony is triggered by a [+HIGH] vowel (i, u) in the next syllable — /ɔ/ raises to [o]
    // before it (Ferguson & Chowdhury 1960). A following MID vowel (o, e) does NOT raise /ɔ/ (ঘরে→ɡʱɔre stays,
    // অকলুষ→ɔkoluʃ stays), so the trigger is i/u only — not [iueo].
    private static readonly JsRe HIGH = JsRegex.Compile("[iu]", ""); // vowels that trigger ɔ→o raising in the preceding syllable

    private static readonly JsRe LENGTH_AFTER_ASPIRATION = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe HARMONY_STRIP = JsRegex.Compile("[ʰʱ̪̃͡ːʲ]", "gu");
    private static readonly JsRe AFFRICATE_ONE = JsRegex.Compile("t͡ʃ|d͡ʒ", "gu");
    private static readonly JsRe CODA_MODIFIERS = JsRegex.Compile("[ʰʱ̪͡ː̃]", "gu");
    private static readonly JsRe ANUSVARA = JsRegex.Compile("ং", "gu");
    private static readonly JsRe KHANDA_TA = JsRegex.Compile("ৎ", "gu");
    private static readonly JsRe OYA = JsRegex.Compile("ওয়া", "gu");
    private static readonly JsRe INITIAL_OYAA = JsRegex.Compile("^অ্যা", "u");
    private static readonly JsRe INITIAL_YAPHALA_AA = JsRegex.Compile("^(\\S)্যা", "u");
    private static readonly JsRe KSHA = JsRegex.Compile("ক্ষ", "gu");
    private static readonly JsRe GYA = JsRegex.Compile("জ্ঞ", "gu");
    private static readonly JsRe PHALA = JsRegex.Compile("([ক-হড়-য়])্([যবম])", "gu");

    public static NativeBengaliEngine MakeNativeBengali(
        BengaliDef def,
        Phonology? phon = null,
        Func<string, string>? foreign = null)
    {
        phon ??= PhonologyLoader.LoadSharedPhonology();
        // ্যা (ya-phôla + aa-matra) and word-initial অ্যা spell the vowel [æ] in Bengali (mostly loanwords:
        // ক্যান্ডি→kænɖi, গ্যাস→ɡæʃ, ব্যাগ→bæɡ). There is no [æ] matra, so we rewrite the sequence to a private-use
        // SENTINEL and register it as both a matra (after a consonant) and an independent vowel (word-initial অ্যা).
        var AE = char.ConvertFromUtf32(0xe001);
        def.VowelSigns[AE] = new AbugidaPhone { Ipa = "æ" };
        def.IndependentVowels[AE] = new AbugidaPhone { Ipa = "æ" };
        var g2p = Abugida.MakeAbugidaG2P(def, phon);
        // Without a symbol tier, % and every currency sign are DROPPED outright ("3%" reads as just "তিন") and the
        // Latin unit abbreviations go unexpanded. শতাংশ FOLLOWS the number.
        var SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
        {
            // ⚠ THE AMPERSAND IS A LATIN-SCRIPT PRINTING LIGATURE, so what it takes is a READING and not a translation.
            // In a non-Latin script it only ever arrives inside a Latin run, and the tier substitutes the language's own
            // conjunction either way — SPACED, because `B&B` is two initialisms.
            Ampersand = "এবং",
            // ⚠ `multiply` IS STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
            // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it — Bengali does
            // not split dimension from product.
            Multiply = new MultiplyDef { Times = "গুণ" },
            Percent = new[] { "শতাংশ" },
            // ⚠ `¥` IS VOICED EVEN THOUGH READERS OMIT IT. Recordings of a Bengali price list read the amounts and
            // no currency at all, straight on to the next number. That is a deliberate policy call, not an
            // oversight: for TTS an explicitly typed character is CONTENT, and a speaker's omission is evidence
            // about reading habit rather than licence to delete.
            //
            // So the audio bounds what it can: it proves no *other* word is there to compete with this one. `ইয়েন`
            // is the standard Bengali form of the currency name — ordinary lexis, not an audio finding, and marked
            // as such so a later pass does not credit the corpus with attesting it.
            Currency = new Dictionary<string, IReadOnlyList<string>>
            {
                ["৳"] = new[] { "টাকা" }, ["₹"] = new[] { "রুপি" }, ["$"] = new[] { "ডলার" },
                ["€"] = new[] { "ইউরো" }, ["£"] = new[] { "পাউন্ড" }, ["¥"] = new[] { "ইয়েন" },
            },
            // ⚠ THE DEFAULT IS BENGALI VOCABULARY — a reusing language declares `unitWords` in its manifest and
            // gets its own spellings; see the field's note for the Assamese `cm` that made the override necessary.
            // ⚠ THE DEFAULT IS A NAMED CONSTANT, NOT AN INLINE OBJECT, so the sourcing tools can still read the
            // words. `sources.ts` reads a tier's `units` value as a literal or through ONE named identifier;
            // `def.unitWords ?? { … }` was neither, and bn's seven declared words went from readable to
            // `[??] the words are computed, not written`.
            Units = def.UnitWords ?? BENGALI_UNITS,
            // `বর্গকিলোমিটার` ×8. SPACED rather than fused, because this tier is shared with ASSAMESE and the
            // two corpora disagree about the space — bn fuses it onto কিলোমিটার but writes `বর্গ মাইল` spaced in
            // the very same sentence, and as writes `বৰ্গ কিলোমিটাৰ` (×7) spaced throughout. `before` is
            // therefore attested in both, where `compound` would have been wrong for one of them.
            // The cube word is the LOAN `কিউবিক`, word-first: `120-160 কিউবিক মিটার জ্বালানি তেল`.
            // ⚠ PROBING THE NATIVE WORD REPORTS IT ABSENT AND IS MISLEADING: ঘন occurs, but as the REDUPLICATED
            // ADVERB `ঘন ঘন` ("frequently") — a count that says nothing about the unit sense — while
            // `ঘন মিটার` and `ঘনমিটার` are both zero. The corpus uses none of them.
            // ⚠ ASSAMESE SHARES THIS TIER and attests no cube word at all: its translation of that same sentence
            // writes `বর্গমিটাৰ`, the SQUARE word, for cubic metres.
            ExponentWords = new ExponentWordsDef
            {
                Squared = new[] { "বর্গ" }, Cubed = new[] { "কিউবিক" }, Position = "before",
            },
        });
        var normalize = Normalize.MakeBengaliNormalizer(def.Numbers);

        var CLAUSE_MARK = def.ClausePunctuation;
        var symbols = def.Symbols ?? new Dictionary<string, string>();
        var strip = def.StripSymbols ?? "";
        var symbolClass = string.Concat(symbols.Keys) + strip;
        // The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
        // diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
        // engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
        var tokenRe = JsRegex.Compile(
            $"([{Unicode.BENGALI_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+(?:,[{DIGIT_CLASS}]+)*(?:\\.[{DIGIT_CLASS}]+)?)"
                + $"|([।॥.?!,;:]){(symbolClass.Length > 0 ? $"|([{symbolClass}])" : "")}",
            "gu");

        /** Bengali vowel HEIGHT HARMONY: /ɔ/ raises to [o] when the immediately following syllable is OPEN
         *  (exactly one consonant between it and the next vowel) and that vowel is HIGH [i u] — kɔ.ri→ko.ri,
         *  but a CODA blocks it (kɔɾ.ʃit stays ɔ). Right-to-left so a chain can propagate (ɔ.ɡu.ni→o.ɡu.ni). */
        string Harmony(string ipa)
        {
            var vowels = VOWEL_G.Matches(ipa);
            if (vowels.Count < 2) return ipa;
            var @out = ipa;
            for (var k = vowels.Count - 2; k >= 0; k--)
            {
                var idx = vowels[k].Index;
                var cur = @out[idx].ToString();
                if (cur != "ɔ" && cur != "e") continue;
                var nextIdx = vowels[k + 1].Index;
                var nextV = @out[nextIdx].ToString();
                // Between this vowel and the next: count base consonants (strip ties/modifiers). Height harmony
                // fires in an OPEN syllable — exactly one onset consonant (কর.ি→koɾi); a coda cluster (≥2) or
                // hiatus (0, the referee is inconsistent) blocks it.
                var between = HARMONY_STRIP.Replace(@out[(idx + 1)..nextIdx], "");
                var nBetween = Js.CodePoints(between).Count;
                // HIATUS (no consonant between): /ɔ/ still raises to [o] before a CLOSE vowel [i u] (বই→boi,
                // অই→oi) — but not before a mid [o e] (অওসৎ→ɔosɔt̪ keeps ɔ, referee-confirmed).
                if (nBetween == 0)
                {
                    if (cur == "ɔ" && (nextV == "i" || nextV == "u"))
                        @out = @out[..idx] + "o" + @out[(idx + 1)..];
                    continue;
                }
                if (nBetween != 1) continue;
                // /ɔ/ raises to [o] before a HIGH vowel [i u] (kɔ.ri→ko.ri); /e/ lowers to [æ] before low [a]
                // (de.kʰa→dæ.kʰa) — the mid vowel agrees in height with the following nucleus.
                var to =
                    cur == "ɔ" && HIGH.IsMatch(nextV)
                        ? "o"
                        : cur == "e" && nextV == "a"
                          ? "æ"
                          : "";
                if (to != "") @out = @out[..idx] + to + @out[(idx + 1)..];
            }
            return @out;
        }

        /** Delete the word-final inherent /ɔ/ after a SINGLE consonant; keep it (raised to [o]) after a cluster. */
        string DeleteFinalInherent(string ipa)
        {
            // …VC ɔ$  → …VC   (single coda consonant before the final ɔ, with a vowel before that consonant)
            // …CC ɔ$  → …CCo  (cluster: retain, realized [o])
            if (!ipa.EndsWith("ɔ", StringComparison.Ordinal)) return ipa;
            var body = ipa[..^1];
            // Is there a vowel before the final consonant sequence? Find the last vowel in the body.
            var bodyVowels = VOWEL_G.Matches(body);
            if (bodyVowels.Count == 0) return body; // no vowel → drop (unusual)
            var lastV = bodyVowels[^1];
            var coda = body[(lastV.Index + 1)..];
            // A heavy coda RETAINS the final vowel (realized [o]): a geminate (…ː, pɔd̪ːo) or a true cluster
            // (two+ base consonants, ɔŋʃo). A single light coda consonant DELETES it (bɔl, d͡ʒɔl) — an affricate
            // t͡ʃ/d͡ʒ counts as ONE (মাছ→mat͡ʃʰ, not mat͡ʃʰo).
            var codaBases = CODA_MODIFIERS.Replace(AFFRICATE_ONE.Replace(coda, "C"), "");
            return coda.Contains('ː') || codaBases.Length >= 2 ? body + "o" : body;
        }

        /** Pure RULE-ENGINE word→IPA (no lexicon): the honest signal used by the referee eval. */
        string WordRules(string w)
        {
            // 1. orthographic normalization (before the generic engine sees it).
            var norm = w.Normalize(System.Text.NormalizationForm.FormC);
            norm = ANUSVARA.Replace(norm, "ঙ্"); // velar-nasal sign → full [ŋ]
            norm = KHANDA_TA.Replace(norm, "ত্"); // khanda ta → vowelless dental [t̪]
            // ওয়া (o + antasthya-ya য় + aa) spells the glide sequence [oa]/[wa], NOT [oja] — the য় is not a
            // full [j] here (খাওয়া→kʰaoa, দেওয়া→d̪eoa, যাওয়া→d͡ʒaoa). Rewrite to ও + independent আ so the engine
            // emits o·a with no glide. (Elsewhere য় IS [j]: মেয়ে→meje is untouched.)
            norm = OYA.Replace(norm, "ওআ");
            // WORD-INITIAL ্যা → [æ] (ক্যা→kæ, গ্যাস→ɡæʃ, ন্যায়→næj) and অ্যা → [æ] (অ্যাসিড→æʃiɖ).
            // Only word-initial: MEDIAL ্যা geminates instead (বিদ্যা→bid̪d̪a) via the phôla rule below.
            norm = INITIAL_OYAA.Replace(norm, AE);
            norm = INITIAL_YAPHALA_AA.Replace(norm, "$1" + AE);
            norm = KSHA.Replace(norm, "ক্খ"); // ক্ষ conjunct → [kkʰ] (অক্ষর→ɔkkʰɔr), not [kʃ]
            norm = GYA.Replace(norm, "গ্গ"); // জ্ঞ conjunct → [ɡɡ] ('gyô': জ্ঞান→ɡɡæn), not [d͡ʒn]
            // Phôla gemination — য/ব/ম as the 2nd member of a conjunct GEMINATE the preceding consonant
            // medially (jôphôla বিদ্যা→bid̪d̪a, অকাট্য→ɔkaʈːo; bôphôla মহত্ব→mɔhɔt̪t̪o; môphôla পদ্ম→pɔd̪d̪o), and
            // word-INITIALLY just drop (the phôla member is silent: ব্যথা→bæt̪ʰa, দ্বিতীয়→d̪it̪io).
            norm = PHALA.Replace(norm, m =>
            {
                var c = m.Groups[1].Value;
                var p2 = m.Groups[2].Value;
                return c == "র" || (p2 == "ব" && "ঙঞণনম".Contains(c, StringComparison.Ordinal))
                    ? m.Value
                    : m.Index == 0 ? c : c + "্" + c;
            });
            // 2. akshara → IPA (inherent ɔ intact).
            var x = g2p(norm);
            // 3. geminate → length + aspiration-before-length reorder (युद्ध-type conjuncts).
            x = LENGTH_AFTER_ASPIRATION.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
            // 4. HEIGHT HARMONY (ɔ→o, e→æ) — BEFORE deletion, so it keys on the ORIGINAL inherent /ɔ/. An inherent
            //    ɔ is not itself a high/mid trigger, so a later-retained final [o] can't spuriously raise the vowel
            //    before it (পদ্ম→pɔd̪ːo, not pod̪ːo); the real matra vowels still trigger (করি→koɾi, দেখা→d̪ækʰa).
            if (def.HeightHarmony != false) x = Harmony(x); // Assamese (heightHarmony:false) lacks Bengali's ɔ→o raising
            // 5. WORD-FINAL inherent-vowel deletion / retention — BEFORE medial (like Hindi) so a final inherent
            //    ɔ does not create a false V·C·ɔ·C·V context for the preceding vowel (জীবন→d͡ʒibɔn, শহর→ʃɔɦɔɾ).
            var syls = VOWEL_G.Matches(x).Count;
            if (syls >= 2) x = DeleteFinalInherent(x);
            // 6. MEDIAL inherent-vowel deletion — the Ohala V·C·ɔ·C·V rule (আপনার→apnaɾ, আকবর→akbɔɾ), same shared
            //    algorithm as Hindi's schwa deletion but on /ɔ/; a geminate coda keeps the syllable heavy (no delete).
            if (def.MedialSchwaDeletion != false) x = Schwa.DeleteMedialSchwa(x, "ɔ"); // Assamese retains medial inherent ɔ (চকৰি→sɔkɔɹi)
            return x.Normalize(System.Text.NormalizationForm.FormC);
        }

        /** SHIPPED word→IPA: a whole-word lexicon override (for the proven-lexical tail) then the rule engine. The
         *  lexicon is Bengali-specific (bengali-lexicon.tsv), so a reusing language (Assamese) sets skipLexicon:true
         *  to avoid Bengali overrides (এক→æk) leaking onto its shared spellings. */
        string Word(string w, Func<string, string?>? oov)
        {
            if (def.SkipLexicon != true)
            {
                if (Lexicon().TryGetValue(w.Normalize(System.Text.NormalizationForm.FormC), out var hit)) return hit;
            }
            if (oov is not null)
            {
                var o = oov(w);
                if (o is not null) return o;
            }
            return WordRules(w);
        }

        string ToAscii(string digits) =>
            string.Concat(Js.CodePoints(digits)
                .Where(d => d != ",")
                .Select(d => Unicode.BENGALI_DIGITS.GetValueOrDefault(d, d)));

        string Number(string digits, Func<string, string?>? oov)
        {
            string W(string x) => Word(x, oov);
            var ascii = ToAscii(digits);
            var dot = ascii.IndexOf('.');
            if (dot >= 0 && !string.IsNullOrEmpty(def.Numbers.DecimalWord))
            {
                // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA, in every engine built from
                // this maker — bn as bpy, one bug reaching three languages.
                // `isSafeInteger` is right to refuse to COMPOSE (the float has already lost the low digits) but the
                // refusal returned the digit string, and no g2p here reads Latin digits. Digit-at-a-time out of
                // `def.numbers.units` is exactly what the decimal tail on the line below already does, so the
                // fallback needs no word these languages' data was never measured on. See core/numbers.ts
                // `spellDigits`: above 2^53 the reading is a digit string, not a quantity.
                var intHead = ascii[..dot];
                var intN = Js.Number(intHead.Length > 0 ? intHead : "0");
                var head = double.IsInteger(intN) && Math.Abs(intN) <= 9007199254740991d
                    ? Numbers.RenderNumber(intN, def.Numbers, W)
                    : Numbers.SpellDigits(intHead, def.Numbers, W);
                var frac = Js.CodePoints(ascii[(dot + 1)..]).Select(d => W(def.Numbers.Units[(int)Js.Number(d)]));
                return string.Join(" ", new[] { head, W(def.Numbers.DecimalWord!) }.Concat(frac));
            }
            var n = Js.Number(ascii);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return Numbers.SpellDigits(ascii, def.Numbers, W);
            return Numbers.RenderNumber(n, def.Numbers, W);
        }

        // `oovOverride` (neural path only) resolves OOV words between the lexicon and the rule engine; the sync path
        // passes nothing → unchanged. Per-CALL so one engine instance is reused across calls (no per-call rebuild).
        string Text(string input, Func<string, string?>? oovOverride)
        {
            // Bengali-specific rewrites (ordinals, clock, unit abbreviations, signs, fractions) BEFORE the
            // shared symbol tier, whose unit keys are Latin.
            return Clauses.AssembleClauses(SYMBOLS(normalize(input)), tokenRe, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(Word(m.Groups[1].Value, oovOverride));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(foreign is not null ? foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value, oovOverride));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
                else if (m.Groups.Count > 5 && m.Groups[5].Success && m.Groups[5].Value.Length > 0)
                {
                    var sym = m.Groups[5].Value;
                    if (!strip.Contains(sym, StringComparison.Ordinal) && symbols.TryGetValue(sym, out var word) && word.Length > 0)
                        sink.Emit(Word(word, oovOverride));
                }
            });
        }

        return new NativeBengaliEngine { Word = Word, WordRules = WordRules, Number = Number, Text = Text };
    }

    /** Load bengali.jsonc (beside this file) and build the Bengali phonemizer. `foreign` handles embedded Latin; the
     *  returned `text` takes an optional per-call `oovOverride` (neural path only) that injects tagger readings for OOV
     *  words (lexicon → oovOverride → rules). */
    public static NativeBengaliEngine CreateBengali(Func<string, string>? foreign = null) =>
        MakeNativeBengali(
            LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);

    /** The whole-word pronunciation lexicon (cross-source consensus + Kolkata gold). Exposed so the neural OOV path
     *  (bengaliNeural.ts) can skip lexicon-covered words — they are served authoritatively by the sync path. */
    public static IReadOnlyDictionary<string, string> BengaliLexicon() => Lexicon();

    private static NativeBengaliEngine? BN;

    /** Bare word→IPA, SHIPPED path (lexicon override → rule engine). For tests and real text. */
    public static string PhonemizeWord(string w) =>
        (BN ??= MakeNativeBengali(LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc"))).Word(w, null);

    /** Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string w) =>
        (BN ??= MakeNativeBengali(LoadManifest.Load<BengaliDef>("languages/bengali", "bengali.jsonc"))).WordRules(w);

    /** The registry's `ILanguage` adapter — `createBengali(readAsEnglish)` with no per-call OOV override. */
    private sealed class BengaliLanguage : ILanguage
    {
        private readonly NativeBengaliEngine _engine;
        internal BengaliLanguage(NativeBengaliEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input, null);
    }

    internal static void RegisterSelf() =>
        Registry.Register("bengali", () => new BengaliLanguage(CreateBengali(Registry.ReadAsEnglish)));
}
