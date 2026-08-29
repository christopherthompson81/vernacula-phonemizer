/**
 * Native English text phonemizer — canonical IPA.
 * Ported from src/languages/english/english.ts — see that file for the corpus evidence.
 */
using System.Numerics;
using System.Text;
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public sealed class EnglishPhonemizer : IEnglishPhonemizer
{
    private readonly IReadOnlyDictionary<string, string> _lexicon;
    private readonly IReadOnlyDictionary<string, HeteronymEntry> _heteronyms;
    private readonly IEnglishG2p _g2p;
    private readonly PosTagger _tagger;
    private readonly IReadOnlySet<string> _unstressed;
    private readonly IReadOnlyDictionary<string, string> _clausePunctuation;
    private readonly IReadOnlySet<string> _nonTonicFinal;
    private readonly IReadOnlySet<string> _whSecondary;

    public EnglishPhonemizer(
        IReadOnlyDictionary<string, string> lexicon,
        IReadOnlyDictionary<string, HeteronymEntry> heteronyms,
        IEnglishG2p g2p,
        PosTagger tagger,
        IReadOnlySet<string> unstressed,
        IReadOnlyDictionary<string, string> clausePunctuation,
        IReadOnlySet<string> nonTonicFinal,
        IReadOnlySet<string> whSecondary)
    {
        _lexicon = lexicon;
        _heteronyms = heteronyms;
        _g2p = g2p;
        _tagger = tagger;
        _unstressed = unstressed;
        _clausePunctuation = clausePunctuation;
        _nonTonicFinal = nonTonicFinal;
        _whSecondary = whSecondary;
    }

    private static readonly JsRe TRAILING_DIACRITICS = JsRegex.Compile("[̀-ͯːˈˌ‿ᶦᶷʰʲ]", "u");

    /** English regular plural/3sg/genitive sibilant allomorph appended to a base IPA: sibilant→ɪz, voiceless→s,
     *  else voiced/vowel→z. Skips trailing diacritics/length/stress/offglide to read the final base phone. */
    private static string SibilantAllomorph(string ipa)
    {
        var chars = Js.CodePoints(ipa.Normalize(NormalizationForm.FormC));
        var i = chars.Count - 1;
        while (i >= 0 && TRAILING_DIACRITICS.IsMatch(chars[i])) i--;
        var last = i >= 0 ? chars[i] : "";
        if (last.Length == 1 && "szʃʒ".Contains(last, StringComparison.Ordinal)) return "ɪz";
        if (last.Length == 1 && "ptkfθ".Contains(last, StringComparison.Ordinal)) return "s";
        return "z";
    }

    private static readonly JsRe COMBINING = JsRegex.Compile("[̀-ͯ]", "gu");
    private static readonly JsRe STRESS_MARKS = JsRegex.Compile("[ˈˌː]", "g");

    /** A voicing-pair heteronym (default & marked differ only in the final consonant: use/close/house). Their
     *  -s inflection voicing is lexical/irregular, so those defer their plurals to the flat lexicon. */
    private static bool IsVoicingHeteronym(HeteronymEntry het)
    {
        var marked = het.Verb ?? het.Noun ?? het.Past;
        if (marked is null) return false;
        static string Strip(string s) => STRESS_MARKS.Replace(COMBINING.Replace(s.Normalize(NormalizationForm.FormD), ""), "");
        string a = Strip(het.Default), b = Strip(marked);
        return a.Length == b.Length
            && a.Length > 0
            && a[..^1] == b[..^1]
            && a[^1..] != b[^1..];
    }

    private static readonly JsRe FIRST_VOWEL = JsRegex.Compile("[aeiouɪʊɛɔəɐæɑɒʌɝɚɜɨʉ]", "u");

    /**
     * Insert primary stress before the first vowel — the nuclear-tonic fallback for an all-unstressed clause.
     */
    private static string PromoteFirstVowel(string ipa)
    {
        var m = FIRST_VOWEL.Match(ipa);
        return !m.Success ? ipa : ipa[..m.Index] + "ˈ" + ipa[m.Index..];
    }

    /** `Src` is carried for the #1150 trace only — nothing in the reading path reads it. */
    private sealed record Src(int Start, int End, string Surface);
    private abstract record Token { public Src? Source { get; init; } }
    private sealed record WordToken(string Text) : Token;
    private sealed record NumberToken(string Text, bool Ordinal) : Token;
    private sealed record ClauseToken(string Text) : Token;
    private sealed record ForeignToken(string Ipa) : Token;

    private static readonly JsRe TOKEN_RE = JsRegex.Compile(
        "(\\d+(?:(?<!(?<!\\d)0),\\d+)*(?:\\.\\d+)?)(st|nd|rd|th)?|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*(?:['’]\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)*['’]?)|([.?!,;:])",
        "gu");

    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "gu");
    private static readonly JsRe APOSTROPHES = JsRegex.Compile("'", "g");
    private static readonly JsRe ASCII_WORD = JsRegex.Compile("^[a-z]+$");
    private static readonly JsRe GROUPING = JsRegex.Compile("[,.]", "g");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "g");
    private static readonly JsRe PRIMARY_MARK = JsRegex.Compile("ˈ", "g");

    /** Dict-only lookup for creoles (e.g. Naija) that NATIVISE English-etymological words: the CMUdict-derived
     *  citation IPA if `word` is known English, else null (an OOV word — likely a substrate loan — for the
     *  caller to handle differently). No OOV G2P and no clause/stress processing — the raw pronunciation
     *  to remap. */
    public string? KnownWord(string word)
    {
        var lower = Js.ToLowerCase(word);
        if (_lexicon.TryGetValue(lower, out var v)) return v;
        return _heteronyms.TryGetValue(lower, out var het) ? het.Default : null;
    }

    /**
     * `text` with an `oovOverride`, for the registry's FOREIGN reader — the path that reads an embedded Latin
     * run inside another language, which needs the prewarmed neural readings.
     *
     * ⚠ In the TS this had to call the PROTOTYPE's `text`, because `getPhonemizer` shadows `text` as an OWN
     * property with a one-argument wrapper that would silently drop the extra arguments. C# has no such
     * shadowing — the registry wraps the INSTANCE — so this simply calls the real method.
     */
    public string TextWithOov(string input, Func<string, string?> oovOverride) =>
        Text(input, null, oovOverride);

    /** One orthographic word → canonical IPA, given its POS expectation. `oovOverride` (async neural path only,
     *  enNeural.ts) resolves a genuinely-OOV g2pKey to the BiLSTM tagger's reading BEFORE the sync n-gram
     *  engine — the sync path passes nothing, so behaviour is byte-identical. */
    private string ResolveWord(string word, PosExpectation? e, Func<string, string?>? oovOverride)
    {
        var lower = CURLY_APOSTROPHE.Replace(Unicode.FoldLatinDiacritics(Js.ToLowerCase(word)), "'");

        HeteronymEntry? het = _heteronyms.TryGetValue(lower, out var direct) ? direct : null;
        var pluralAllomorph = false;
        if (het is null)
        {
            string? bas =
                lower.EndsWith("es", StringComparison.Ordinal) && _heteronyms.ContainsKey(lower[..^2]) ? lower[..^2]
                : lower.EndsWith("s", StringComparison.Ordinal) && lower.Length > 1 && _heteronyms.ContainsKey(lower[..^1]) ? lower[..^1]
                : null;
            var cand = bas is not null && _heteronyms.TryGetValue(bas, out var cv) ? cv : null;
            if (cand is not null && !IsVoicingHeteronym(cand))
            {
                het = cand;
                pluralAllomorph = true;
            }
        }
        if (het is not null)
        {
            // JS `(a && b) || (c && d) || … || fallback` — the first NON-EMPTY marked reading wins.
            var ipa = (e?.Past == true && !string.IsNullOrEmpty(het.Past)) ? het.Past!
                : (e?.Verb == true && !string.IsNullOrEmpty(het.Verb)) ? het.Verb!
                : (e?.Noun == true && !string.IsNullOrEmpty(het.Noun)) ? het.Noun!
                : het.Default;
            if (pluralAllomorph) ipa += SibilantAllomorph(ipa);
            return ipa;
        }

        var lookupKey = lower;
        var possAllomorph = false;
        if (lower.EndsWith("'s", StringComparison.Ordinal) && lower.Length > 2)
        {
            lookupKey = lower[..^2];
            possAllomorph = true;
        }
        else if (lower.EndsWith("'", StringComparison.Ordinal) && lower.Length > 2 && lower[^2] == 's')
        {
            lookupKey = lower[..^1];
        }

        var over = _lexicon.TryGetValue(lookupKey, out var lex) ? lex : null;
        if (over is null)
        {
            var g2pKey = APOSTROPHES.Replace(lookupKey, "");
            over = oovOverride?.Invoke(g2pKey) ?? (ASCII_WORD.IsMatch(g2pKey) ? _g2p.G2p(g2pKey) : g2pKey);
        }
        if (possAllomorph) over += SibilantAllomorph(over);
        return over;
    }

    /** POS expectations for a sentence's words (perceptron tags → verb/noun/past, + imperative recovery). */
    private List<PosExpectation?> PosExpectations(IReadOnlyList<string> words)
    {
        var tags = _tagger.Tag(words);
        var outp = tags.Select(t => (PosExpectation?)Pos.PosExpectationOf(t)).ToList();
        if (outp.Count > 1 && outp[0]!.Verb == false && Pos.HeadsObjectPhrase(tags.Count > 1 ? tags[1] : ""))
            outp[0] = new PosExpectation { Verb = true, Noun = false, Past = false }; // sentence-initial imperative ("Wind the clock")
        return outp;
    }

    private sealed class NumWord
    {
        public required string Text { get; init; }
        public bool Reduced { get; init; }
    }

    private sealed class Unit
    {
        public List<NumWord> Words { get; init; } = new();
        public string? Clause { get; init; }
        /** Already-resolved IPA (a foreign run); contributes NO words, so tagger alignment is
         *  unaffected and `expect[wi]` keeps indexing the English stream correctly. */
        public string? Foreign { get; init; }
        public Src? Source { get; init; }
    }

    private sealed class Item
    {
        public required string Word { get; init; }
        public required string Citation { get; init; }
        public required bool Reduced { get; init; }
        public required string Display { get; set; }
        public Src? Source { get; init; }
    }

    private sealed class ClauseAcc
    {
        public List<Item> Items { get; } = new();
        public string? Mark { get; set; }
    }

    public string Text(string input) => Text(input, null, null);

    /** `wordTransform`, if given, post-processes each resolved word's IPA with its (lowercased) source word —
     *  the hook the en-GB accent variant uses to apply its per-word lexical-set delta while reusing this
     *  engine's full number/heteronym/prosody context. Clause pause marks are not passed through it. */
    public string Text(string input, Func<string, string, string>? wordTransform, Func<string, string?>? oovOverride)
    {
        input = Normalize.NormalizeEnglishInitialisms(Normalize.NormalizeEnglish(input), w => _lexicon.ContainsKey(w));
        Core.Trace.EnterEngine(input);
        var tokens = new List<Token>();
        var gapCursor = 0;
        void ClaimGap(int upto)
        {
            if (upto > gapCursor)
            {
                var gap = input[gapCursor..upto];
                foreach (Match g in Clauses.FOREIGN_RUN.Matches(gap))
                {
                    var ipa = Foreign.ReadForeignRun(g.Value);
                    var at = gapCursor + g.Index;
                    if (ipa is not null && ipa != "")
                        tokens.Add(new ForeignToken(ipa) { Source = new Src(at, at + g.Value.Length, g.Value) });
                }
            }
            gapCursor = upto;
        }
        foreach (Match m in TOKEN_RE.Matches(input))
        {
            ClaimGap(m.Index);
            gapCursor = m.Index + m.Value.Length;
            var src = new Src(m.Index, gapCursor, m.Value);
            if (m.Groups[1].Success) tokens.Add(new NumberToken(m.Groups[1].Value, m.Groups[2].Success) { Source = src });
            else if (m.Groups[3].Success) tokens.Add(new WordToken(m.Groups[3].Value) { Source = src });
            else if (m.Groups[4].Success) tokens.Add(new ClauseToken(m.Groups[4].Value) { Source = src });
        }
        ClaimGap(input.Length);

        var units = new List<Unit>();
        foreach (var t in tokens)
        {
            switch (t)
            {
                case ClauseToken ct:
                    if (_clausePunctuation.TryGetValue(ct.Text, out var mk) && mk.Length > 0)
                        units.Add(new Unit { Clause = mk, Source = t.Source });
                    break;
                case ForeignToken ft:
                    units.Add(new Unit { Foreign = ft.Ipa, Source = t.Source });
                    break;
                case WordToken wt:
                    units.Add(new Unit { Words = { new NumWord { Text = wt.Text } }, Source = t.Source });
                    break;
                case NumberToken nt:
                {
                    var n = BigInteger.Parse(GROUPING.Replace(nt.Text, ""), System.Globalization.CultureInfo.InvariantCulture); // integer part; fractional read separately below
                    var dot = nt.Text.IndexOf('.');
                    if (dot >= 0)
                    {
                        var intText = COMMAS.Replace(nt.Text[..dot], "");
                        var intWords = Numbers.NumberToWords(BigInteger.Parse(
                                intText.Length > 0 ? intText : "0", System.Globalization.CultureInfo.InvariantCulture))
                            .Select(w => new NumWord { Text = w });
                        var frac = nt.Text[(dot + 1)..].Select(d =>
                            new NumWord { Text = Numbers.NumberToWords(BigInteger.Parse(d.ToString(), System.Globalization.CultureInfo.InvariantCulture))[0] });
                        var u = new Unit { Source = t.Source };
                        u.Words.AddRange(intWords);
                        u.Words.Add(new NumWord { Text = "point", Reduced = true });
                        u.Words.AddRange(frac);
                        units.Add(u);
                    }
                    else
                    {
                        var u = new Unit { Source = t.Source };
                        u.Words.AddRange((nt.Ordinal ? Numbers.OrdinalToWords(n) : Numbers.NumberToWords(n))
                            .Select(w => new NumWord { Text = w }));
                        units.Add(u);
                    }
                    break;
                }
            }
        }

        var allWords = units.SelectMany(u => u.Words.Select(w => w.Text)).ToList();
        var expect = PosExpectations(allWords);
        var wi = 0;
        var clauses = new List<ClauseAcc> { new() };
        foreach (var u in units)
        {
            if (u.Clause is not null)
            {
                var cur = clauses[^1];
                if (cur.Items.Count > 0)
                {
                    cur.Mark = u.Clause;
                    clauses.Add(new ClauseAcc());
                }
                continue;
            }
            if (u.Foreign is not null)
            {
                clauses[^1].Items.Add(new Item { Word = "", Citation = u.Foreign, Reduced = false, Display = u.Foreign, Source = u.Source });
                continue;
            }
            foreach (var w in u.Words)
            {
                var citation = ResolveWord(w.Text, wi < expect.Count ? expect[wi] : null, oovOverride);
                wi++;
                if (citation == "") continue;
                var lw = Js.ToLowerCase(w.Text);
                clauses[^1].Items.Add(new Item
                {
                    Word = lw,
                    Citation = citation,
                    Reduced = w.Reduced || _unstressed.Contains(lw),
                    Display = citation,
                    Source = u.Source,
                });
            }
        }

        var parts = new List<string>();
        // ⚠ RECORDED AFTER RENDERING (#1150): this pipeline is two-phase, so no token is ever "open" while
        // its reading is produced. One source token can yield many readings, so they accumulate per span.
        var traced = new Dictionary<string, (Src Src, List<string> Emitted, List<int> Parts)>();
        foreach (var c in clauses)
        {
            foreach (var it in c.Items)
            {
                if (_whSecondary.Contains(it.Word)) it.Display = PRIMARY_MARK.Replace(it.Citation, "ˌ"); // wh-pronoun → secondary
                else if (it.Reduced) it.Display = PRIMARY_MARK.Replace(it.Citation, ""); // unstressed function word / decimal point
            }
            if (c.Items.Count > 0)
            {
                var terminal = c.Mark is null || c.Mark == "." || c.Mark == "?" || c.Mark == "!";
                var hasPrimary = c.Items.Any(it => it.Display.Contains('ˈ'));
                var last = c.Items[^1];
                var promote = !hasPrimary || (terminal && !last.Display.Contains('ˈ') && !_nonTonicFinal.Contains(last.Word));
                if (promote)
                    last.Display = last.Citation.Contains('ˈ') ? last.Citation : PromoteFirstVowel(last.Citation);
            }
            foreach (var it in c.Items)
            {
                var rendered = wordTransform is not null ? wordTransform(it.Display, it.Word) : it.Display;
                parts.Add(rendered);
                if (it.Source is not null)
                {
                    // ⚠ #1150 STAGE 3: THE PART INDEX, NOT AN OFFSET. `parts` is joined with " " at the end,
                    // so a piece's position is only known once every piece exists; recording which slot it
                    // went into lets the offsets be computed exactly below, rather than guessed by searching
                    // the reading for a substring that may occur more than once.
                    var key = $"{it.Source.Start}:{it.Source.End}";
                    if (traced.TryGetValue(key, out var b)) { b.Emitted.Add(rendered); b.Parts.Add(parts.Count - 1); }
                    else traced[key] = (it.Source, new List<string> { rendered }, new List<int> { parts.Count - 1 });
                }
            }
            if (c.Mark is not null) parts.Add(c.Mark);
        }
        // ⚠ THE JOIN IS THE ARITHMETIC: piece `i` starts at the sum of the lengths before it, plus one
        // separator per preceding piece. Computed here rather than threaded, because `parts` is complete now
        // and was not when the pieces were made.
        var at = new int[parts.Count];
        var cursor = 0;
        for (var i = 0; i < parts.Count; i++) { at[i] = cursor; cursor += parts[i].Length + 1; }
        foreach (var (src, emitted, slots) in traced.Values)
        {
            var lo = slots.Min(i => at[i]);
            var hi = slots.Max(i => at[i] + parts[i].Length);
            Core.Trace.NoteToken(src.Start, src.End, src.Surface, emitted, null, (lo, hi));
        }
        var assembled = string.Join(" ", parts);
        // ⚠ DECLARED SO IT CAN BE DISBELIEVED, exactly as `ClauseSink.Finish` does.
        Core.Trace.NoteAssembled(assembled);
        return assembled;
    }
}

public static class EnglishFactory
{
    /** Load the English data and build the phonemizer. */
    public static EnglishPhonemizer CreateEnglish()
    {
        const string dir = "languages/english";
        var lexicon = LoadTsv.LoadTsvMap<string>(dir, "accent-lexicon.tsv", (rest, _) =>
        {
            var fields = rest.Split('\t');
            var ipa = fields.Length > 1 ? fields[1].Trim() : null;
            return fields.Length >= 2 && !string.IsNullOrEmpty(ipa) ? ipa : null;
        });

        var manifest = Manifest.MANIFEST; // consolidated hand-authored facts (english.jsonc), loaded once by manifest.ts
        var heteronyms = manifest.Heteronyms;
        var unstressed = new HashSet<string>(manifest.UnstressedWords, StringComparer.Ordinal);
        var arpabetToIpa = EnglishArpabet.MakeArpabetToIpa(manifest.Arpabet);

        var g2pDict = LoadTsv.LoadTsvMap<List<string>>(dir, "g2p-dict.tsv", (v, _) => v.Split(' ').ToList());
        var g2pCommon = new HashSet<string>(LoadTsv.LoadLines(dir, "g2p-common.txt"), StringComparer.Ordinal);
        var g2p = EnglishG2pFactory.CreateEnglishG2p(
            LoadManifest.LoadJson<EnglishG2pModel>(dir, "g2p-model.json"),
            g2pDict,
            g2pCommon,
            arpabetToIpa,
            new G2pClassSets
            {
                VowelLetters = manifest.G2pClasses.VowelLetters,
                Voiceless = manifest.G2pClasses.Voiceless,
                Sibilants = manifest.G2pClasses.Sibilants,
                StopPieces = manifest.G2pClasses.StopPieces,
                Vowels = manifest.Arpabet.Vowels, // OOV G2P reuses arpabet.vowels (single source)
            });

        var tagger = new PosTagger(LoadManifest.LoadJson<PosModel>(dir, "pos-model.json"));

        return new EnglishPhonemizer(
            lexicon,
            heteronyms,
            g2p,
            tagger,
            unstressed,
            manifest.ClausePunctuation,
            new HashSet<string>(manifest.NonTonicFinal, StringComparer.Ordinal),
            new HashSet<string>(manifest.WhSecondary, StringComparer.Ordinal));
    }

    internal static void RegisterSelf() => Registry.Register("english", () => CreateEnglish());
}
