/**
 * SCRIPT ROUTING — which language reads a run of text in a script the host engine does not own.
 * Ported from src/core/scripts.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Core;

public static class Scripts
{
    /** The scripts worth routing.
     *  ⚠ ORDER MATTERS, and it is a List rather than a Dictionary for that reason: `ScriptOf` tries each
     *  test in turn, and Kana must come BEFORE Han — a run containing any kana is Japanese whatever else it
     *  holds, whereas a Han-only run is ambiguous.
     *  ⚠ THIS SET MUST BE DERIVED FROM WHAT THE FLEET CAN READ, never from recall: a script whose engine is
     *  missing here does not fall back — every run in it vanishes from the host's output, silently. */
    private static readonly List<(string Name, JsRe Re)> SCRIPT_TESTS = new()
    {
        ("Latin", JsRegex.Compile(@"\p{Script=Latin}", "u")),
        ("Cyrillic", JsRegex.Compile(@"\p{Script=Cyrillic}", "u")),
        ("Greek", JsRegex.Compile(@"\p{Script=Greek}", "u")),
        ("Kana", JsRegex.Compile(@"[\p{Script=Hiragana}\p{Script=Katakana}]", "u")),
        ("Han", JsRegex.Compile(@"\p{Script=Han}", "u")),
        ("Hangul", JsRegex.Compile(@"\p{Script=Hangul}", "u")),
        ("Arabic", JsRegex.Compile(@"\p{Script=Arabic}", "u")),
        ("Hebrew", JsRegex.Compile(@"\p{Script=Hebrew}", "u")),
        ("Devanagari", JsRegex.Compile(@"\p{Script=Devanagari}", "u")),
        ("Bengali", JsRegex.Compile(@"\p{Script=Bengali}", "u")),
        ("Tamil", JsRegex.Compile(@"\p{Script=Tamil}", "u")),
        ("Thai", JsRegex.Compile(@"\p{Script=Thai}", "u")),
        ("Ethiopic", JsRegex.Compile(@"\p{Script=Ethiopic}", "u")),
        ("Armenian", JsRegex.Compile(@"\p{Script=Armenian}", "u")),
        ("Georgian", JsRegex.Compile(@"\p{Script=Georgian}", "u")),
        ("Myanmar", JsRegex.Compile(@"\p{Script=Myanmar}", "u")),
        ("Telugu", JsRegex.Compile(@"\p{Script=Telugu}", "u")),
        ("Kannada", JsRegex.Compile(@"\p{Script=Kannada}", "u")),
        ("Malayalam", JsRegex.Compile(@"\p{Script=Malayalam}", "u")),
        ("Gujarati", JsRegex.Compile(@"\p{Script=Gujarati}", "u")),
        ("Gurmukhi", JsRegex.Compile(@"\p{Script=Gurmukhi}", "u")),
        ("Oriya", JsRegex.Compile(@"\p{Script=Oriya}", "u")),
        ("Sinhala", JsRegex.Compile(@"\p{Script=Sinhala}", "u")),
        ("Khmer", JsRegex.Compile(@"\p{Script=Khmer}", "u")),
        ("Lao", JsRegex.Compile(@"\p{Script=Lao}", "u")),
        ("Tibetan", JsRegex.Compile(@"\p{Script=Tibetan}", "u")),
        ("Tifinagh", JsRegex.Compile(@"\p{Script=Tifinagh}", "u")),
        ("Cherokee", JsRegex.Compile(@"\p{Script=Cherokee}", "u")),
        ("Ol_Chiki", JsRegex.Compile(@"\p{Script=Ol_Chiki}", "u")),
        ("Adlam", JsRegex.Compile(@"\p{Script=Adlam}", "u")),
        ("Nko", JsRegex.Compile(@"\p{Script=Nko}", "u")),
        ("Syloti_Nagri", JsRegex.Compile(@"\p{Script=Syloti_Nagri}", "u")),
        ("Javanese", JsRegex.Compile(@"\p{Script=Javanese}", "u")),
        ("Sundanese", JsRegex.Compile(@"\p{Script=Sundanese}", "u")),
    };

    /** DEFAULT READER PER SCRIPT, in three tiers of confidence, which the row comments name because a
     *  near-deterministic mapping and a pragmatic guess must not look alike to whoever edits this next:
     *  NEARLY DETERMINISTIC (the script serves one language), DOMINANT (several share it; this is what an
     *  arbitrary run most likely is), and PRAGMATIC (contested; expected to be overridden by any engine
     *  with better information). */
    public static readonly IReadOnlyDictionary<string, string> DEFAULT_READER = new Dictionary<string, string>
    {
        ["Greek"] = "el", // nearly deterministic
        ["Hangul"] = "ko", // nearly deterministic
        ["Thai"] = "th", // nearly deterministic
        ["Hebrew"] = "he", // nearly deterministic
        ["Armenian"] = "hy", // nearly deterministic
        ["Georgian"] = "ka", // nearly deterministic
        ["Myanmar"] = "my", // nearly deterministic
        ["Ethiopic"] = "am", // dominant (also Tigrinya)
        ["Kana"] = "ja", // nearly deterministic
        ["Latin"] = "en", // dominant — and already the de facto default at 44 registry call sites
        ["Cyrillic"] = "ru", // dominant
        ["Arabic"] = "ar", // dominant (also fa, ur, ps, sd — but MSA reads an arbitrary run best)
        ["Devanagari"] = "hi", // dominant (also mr, ne)
        ["Bengali"] = "bn", // dominant (also as)
        ["Tamil"] = "ta", // nearly deterministic
        ["Han"] = "cmn", // pragmatic — Japanese and Cantonese also write Han; see OVERRIDES
        ["Telugu"] = "te",
        ["Kannada"] = "kn",
        ["Malayalam"] = "ml",
        ["Gujarati"] = "gu",
        ["Gurmukhi"] = "pa",
        ["Oriya"] = "or",
        ["Sinhala"] = "si",
        ["Khmer"] = "km",
        ["Lao"] = "lo",
        ["Tibetan"] = "bo",
        ["Tifinagh"] = "shi", // Tashelhit is the fleet's Tifinagh engine (Central Atlas Tamazight also uses it)
        ["Cherokee"] = "chr",
        ["Ol_Chiki"] = "sat",
        ["Adlam"] = "ff", // Fula, which the catalogue records as Latin/Adlam
        ["Nko"] = "bm", // the fleet's N'Ko engine is Bambara (Latin/N'Ko)
        ["Syloti_Nagri"] = "syl",
        ["Javanese"] = "jv", // Latin/Javanese — the native script routes to the same engine
        ["Sundanese"] = "su", // Latin/Aksara Sunda
    };

    /** PER-LANGUAGE OVERRIDES: host language → the reader IT wants for a given script. The Han rows are why
     *  this has to exist — a Han run inside Japanese text is Japanese, not Mandarin. */
    public static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> OVERRIDES =
        new Dictionary<string, IReadOnlyDictionary<string, string>>
        {
            ["ja"] = new Dictionary<string, string> { ["Han"] = "ja" },
            ["ko"] = new Dictionary<string, string> { ["Han"] = "ko" }, // hanja in Korean text is read with Korean readings
            ["yue"] = new Dictionary<string, string> { ["Han"] = "yue" },
            ["uk"] = new Dictionary<string, string> { ["Cyrillic"] = "uk" },
            ["sr"] = new Dictionary<string, string> { ["Cyrillic"] = "sr" },
            ["fa"] = new Dictionary<string, string> { ["Arabic"] = "fa" },
            ["ur"] = new Dictionary<string, string> { ["Arabic"] = "ur" },
            ["mr"] = new Dictionary<string, string> { ["Devanagari"] = "mr" },
            ["ne"] = new Dictionary<string, string> { ["Devanagari"] = "ne" },
        };

    /**
     * Script declarations for the codes that have NO `.jsonc` manifest of their own — the complement of the
     * manifests, so that (manifests ∪ this) covers every registered code exactly once. A row here should
     * only ever be a VARIETY of another language or an ACCENT VARIANT / ALIAS whose manifest names its
     * parent; every language engine declares its own script. ManifestScriptTests asserts the union is exact
     * in both directions, so a stale row cannot outlive its code.
     */
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> MANIFESTLESS_SCRIPTS =
        new Dictionary<string, IReadOnlyList<string>>
        {
            ["acm"] = new[] { "Arabic" }, ["acw"] = new[] { "Arabic" }, ["afb"] = new[] { "Arabic" },
            ["ajp"] = new[] { "Arabic" }, ["apc"] = new[] { "Arabic" },
            ["apd"] = new[] { "Arabic" }, ["ary"] = new[] { "Arabic" }, ["arz"] = new[] { "Arabic" },
            ["ayl"] = new[] { "Arabic" },
            ["en-GB"] = new[] { "Latin" }, ["en-IN"] = new[] { "Latin" }, ["es-419"] = new[] { "Latin" },
            ["fr-CA"] = new[] { "Latin" }, ["pt-BR"] = new[] { "Latin" },
            ["ms"] = new[] { "Latin" }, ["zsm"] = new[] { "Latin" },          // Malay / Standard Malay
            ["bgc"] = new[] { "Devanagari" },                    // Haryanvi, on the Hindi engine
            ["pnb"] = new[] { "Arabic" }, ["skr"] = new[] { "Arabic" },       // Western Punjabi + Saraiki, both Shahmukhi
            ["pbt"] = new[] { "Arabic" },
        };

    /**
     * Languages whose PRIMARY script is Cyrillic — the tie-break for `FoldCyrillicConfusables`, which needs
     * to know whether the HOST language is Cyrillic when a word's own letters split evenly.
     */
    public static readonly IReadOnlySet<string> CYRILLIC_HOSTS = new HashSet<string>
    {
        "ab", "ba", "be", "bg", "chv", "kk", "ky", "mk", "mn", "nog", "ru", "sr", "tg", "tt", "uk",
    };

    /** The script of a run, or `null` if it carries no letters this router knows. */
    public static string? ScriptOf(string run)
    {
        foreach (var (name, re) in SCRIPT_TESTS)
            if (re.IsMatch(run)) return name;
        return null;
    }

    /** THE LONE GREEK LETTER, AND WHY ITS NAME IS SPELLED IN GREEK. A lone Greek letter in another script is
     *  usually MATHEMATICS and wants its NAME, not a phone — and the name of a Greek letter IS a Greek word,
     *  so the Greek engine speaks it and one table serves every host. ⚠ THE ACCENT IS THE DISCRIMINATOR: a
     *  mathematical symbol is never written with an accent or breathing, a one-letter Greek WORD always is,
     *  so only a BARE letter is named. The lookup lowercases (⟨ς⟩ is ⟨σ⟩) but must NOT strip accents. */
    private static readonly IReadOnlyDictionary<string, string> GREEK_LETTER_NAME = new Dictionary<string, string>
    {
        ["α"] = "άλφα", ["β"] = "βήτα", ["γ"] = "γάμμα", ["δ"] = "δέλτα", ["ε"] = "έψιλον", ["ζ"] = "ζήτα", ["η"] = "ήτα", ["θ"] = "θήτα",
        ["ι"] = "ιώτα", ["κ"] = "κάππα", ["λ"] = "λάμδα", ["μ"] = "μι", ["ν"] = "νι", ["ξ"] = "ξι", ["ο"] = "όμικρον", ["π"] = "πι",
        ["ρ"] = "ρο", ["σ"] = "σίγμα", ["ς"] = "σίγμα", ["τ"] = "ταυ", ["υ"] = "ύψιλον", ["φ"] = "φι", ["χ"] = "χι", ["ψ"] = "ψι", ["ω"] = "ωμέγα",
    };

    private static readonly JsRe GREEK_LETTER = JsRegex.Compile(@"\p{Script=Greek}", "u");
    private static readonly JsRe AnyMark = JsRegex.Compile(@"\p{M}", "u");

    /**
     * The name of the ONE BARE Greek letter in `run` — null if the run holds none, holds several, or holds
     * one that carries an accent or breathing, which marks it as ordinary Greek text rather than a symbol.
     */
    private static (string Letter, string Name)? LoneGreekLetterName(string run)
    {
        var letters = Js.CodePoints(run).Where(c => GREEK_LETTER.IsMatch(c) && !AnyMark.IsMatch(c)).ToList();
        if (letters.Count != 1) return null;
        var letter = letters[0];
        // NFD, so a PRECOMPOSED accent is caught as surely as a combining one.
        var nfd = letter.Normalize(System.Text.NormalizationForm.FormD);
        if (nfd.Length != 1) return null;
        return GREEK_LETTER_NAME.TryGetValue(nfd.ToLowerInvariant(), out var name)
            ? (letter, name)
            : null;
    }

    /**
     * Which language should read `run`, given the host language reading the document, and WHAT TEXT it
     * should be handed. Null means "leave it dropped": the script is unknown, or the answer is the host
     * itself, which would hand the engine back text its own tokenizer already declined, and recurse.
     *
     * `text` differs from `run` only for the lone Greek letter, which is rewritten to its NAME. ⚠ THE NAME
     * IS SUBSTITUTED IN PLACE, not substituted FOR the run: a run carries a trailing superscript or a
     * joining hyphen along with the letter, and replacing the whole run would delete those before the
     * reader ever saw them.
     */
    public static (string Target, string Text)? ReaderFor(string run, string host)
    {
        var script = ScriptOf(run);
        if (script is null) return null;
        var text = run;
        if (script == "Greek" && Js.CodePoints(run).Count(c => GREEK_LETTER.IsMatch(c)) < 2)
        {
            // An unnamed lone symbol — an archaic letter, an accented one, a lone combining mark — stays
            // declined, exactly as the whole class was before this existed.
            var named = LoneGreekLetterName(run);
            if (named is null) return null;
            text = Js.ReplaceFirst(run, named.Value.Letter, named.Value.Name);
        }
        var target =
            OVERRIDES.TryGetValue(host, out var ov) && ov.TryGetValue(script, out var o)
                ? o
                : DEFAULT_READER[script];
        return target == host ? null : (target, text);
    }
}
