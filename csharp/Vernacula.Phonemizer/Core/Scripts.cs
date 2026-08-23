/**
 * SCRIPT ROUTING — which language reads a run of text in a script the host engine does not own.
 *
 * ⚠ WHY THIS EXISTS. `core/foreign.ts` alone gives every engine a fallback for embedded foreign text, but only
 * for LATIN — every other script in an unclaimed gap is dropped outright:
 *
 *   Cyrillic inside Greek      Ο Πούτιν και ο Владимир   →  "o putin ce o"        (Владимир GONE)
 *   Greek inside English       The word λόγος means word →  "ðə wˈɝd mˈiːnz wˈɝd" (λόγος GONE)
 *   Cyrillic inside Japanese   これは Москва です          →  Москва GONE
 *   Greek inside Thai          คำว่า Ελλάδα คือ           →  Ελλάδα GONE
 *   Latin inside Russian       Слово hello значит        →  works, because Latin is the special case
 *
 * ⚠ A DROPPED RUN IS INVISIBLE TO EVERY LEAK-BASED CHECK — nothing survives into the IPA to be flagged.
 *
 * THE MODEL: a DEFAULT READER PER SCRIPT, overridable per language. A script is a much better predictor
 * of language than nothing at all, and for several scripts it is nearly deterministic — Greek script is
 * Greek, Hangul is Korean, Thai is Thai. Where a script serves several languages the default is the one
 * that makes an arbitrary run most likely readable (Cyrillic → Russian, Latin → English, Devanagari →
 * Hindi), and any engine that knows better injects its own reader.
 *
 * ⚠ THE LONE GREEK LETTER — the limit this file used to record, and now reads. A lone Greek letter in
 * another script is usually MATHEMATICS (α, β, π, Δ) and wants its NAME — "alpha", "pi" — not a Greek
 * word's worth of phonology, so the router declined it and the letter was DELETED in 186 of 188 engines.
 * See `GREEK_LETTER_NAME` for what replaced that, and why the name did not need a per-host table.
 */
namespace Vernacula.Phonemizer.Core;

public static class Scripts
{
    /** The scripts worth routing. Ordered longest-lived first; detection tries each in turn.
     *  (TS `ScriptName` union → plain strings here; UnicodeScripts.Cls throws on anything unknown.)
     *  ⚠ THIS SET MUST BE DERIVED FROM WHAT THE FLEET CAN READ — the registry, the language catalogue, the
     *  README examples — never from recall. A script with an engine that is missing here does not fall back:
     *  every run in it vanishes from the host language's output, silently. */
    // ⚠ ORDER MATTERS (a List, not a Dictionary): scriptOf tries each test in turn.
    private static readonly List<(string Name, JsRe Re)> SCRIPT_TESTS = new()
    {
        ("Latin", JsRegex.Compile(@"\p{Script=Latin}", "u")),
        ("Cyrillic", JsRegex.Compile(@"\p{Script=Cyrillic}", "u")),
        ("Greek", JsRegex.Compile(@"\p{Script=Greek}", "u")),
        // Kana BEFORE Han: Japanese text mixes them, and a run containing any kana is Japanese whatever else
        // it holds, whereas a Han-only run is ambiguous between Chinese and Japanese.
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

    /**
     * DEFAULT READER PER SCRIPT. Three tiers of confidence, and the comments say which is which, because a
     * near-deterministic mapping and a pragmatic guess should not look alike to whoever edits this next:
     *
     *   NEARLY DETERMINISTIC — the script serves essentially one language.
     *   DOMINANT            — several languages share it; this is the one an arbitrary run most likely is.
     *   PRAGMATIC           — genuinely contested; the choice maximises the chance of a readable result and
     *                         is expected to be overridden by any engine that has better information.
     */
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
        // NEARLY DETERMINISTIC — one script, one major language, and the fleet has an engine for each.
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

    /**
     * PER-LANGUAGE OVERRIDES: host language → the reader IT wants for a given script. This is the "overridable
     * per language" half, and the Han row is the reason it has to exist — a Han run inside Japanese text is
     * Japanese, not Mandarin, and inside Korean text is hanja read as Korean.
     */
    public static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> OVERRIDES =
        new Dictionary<string, IReadOnlyDictionary<string, string>>
        {
            ["ja"] = new Dictionary<string, string> { ["Han"] = "ja" },
            ["ko"] = new Dictionary<string, string> { ["Han"] = "ko" }, // hanja in Korean text is read with Korean readings
            ["yue"] = new Dictionary<string, string> { ["Han"] = "yue" },
            // A Cyrillic run inside Ukrainian or Serbian text is that language's own, not Russian — those engines
            // claim their script anyway, so this only matters for characters outside their own alphabet.
            ["uk"] = new Dictionary<string, string> { ["Cyrillic"] = "uk" },
            ["sr"] = new Dictionary<string, string> { ["Cyrillic"] = "sr" },
            ["fa"] = new Dictionary<string, string> { ["Arabic"] = "fa" },
            ["ur"] = new Dictionary<string, string> { ["Arabic"] = "ur" },
            ["mr"] = new Dictionary<string, string> { ["Devanagari"] = "mr" },
            ["ne"] = new Dictionary<string, string> { ["Devanagari"] = "ne" },
        };

    /**
     * Script declarations for the codes that have NO `.jsonc` manifest of their own — the complement of the
     * manifests, so that (manifests ∪ this) covers every registered code exactly once. Two reasons a code lands
     * here, and both are deliberate:
     *
     *   · a VARIETY of another language (the nine Arabic dialects) — the engine and its manifest belong to `ar`;
     *   · an ACCENT VARIANT (en-GB, en-IN, fr-CA, pt-BR, es-419) or an ALIAS (ms/zsm, bgc, pnb, skr) — the
     *     manifest it reuses names its PARENT, not this code.
     *
     * Every LANGUAGE engine declares its script in its own manifest (#741 gave the last 26 theirs), so a new row
     * here should only ever be a variety or an alias.
     *
     * test/manifest-script.test.ts asserts the union is exact in BOTH directions, so a new engine cannot be added
     * without landing in one place or the other, and a stale row here cannot outlive its code.
     */
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> MANIFESTLESS_SCRIPTS =
        new Dictionary<string, IReadOnlyList<string>>
        {
            // Arabic varieties — the shared `ar` engine plus a VarietyDef delta.
            ["acm"] = new[] { "Arabic" }, ["acw"] = new[] { "Arabic" }, ["afb"] = new[] { "Arabic" },
            ["ajp"] = new[] { "Arabic" }, ["apc"] = new[] { "Arabic" },
            ["apd"] = new[] { "Arabic" }, ["ary"] = new[] { "Arabic" }, ["arz"] = new[] { "Arabic" },
            ["ayl"] = new[] { "Arabic" },
            // Accent variants — a post-process on the parent engine's output.
            ["en-GB"] = new[] { "Latin" }, ["en-IN"] = new[] { "Latin" }, ["es-419"] = new[] { "Latin" },
            ["fr-CA"] = new[] { "Latin" }, ["pt-BR"] = new[] { "Latin" },
            // Aliases and close siblings riding another language's engine.
            ["ms"] = new[] { "Latin" }, ["zsm"] = new[] { "Latin" },          // Malay / Standard Malay
            ["bgc"] = new[] { "Devanagari" },                    // Haryanvi, on the Hindi engine
            ["pnb"] = new[] { "Arabic" }, ["skr"] = new[] { "Arabic" },       // Western Punjabi + Saraiki, both Shahmukhi
            // Southern/Kandahari Pashto — the MEMBER code for the engine `ps` also resolves to. `pus` is a
            // macrolanguage (pbt/pbu/pst) and src/languages/pashto/ implements the Southern variety only, so `pbt` is
            // the accurate code; the manifest declares `ps`, which is why this one needs a row here.
            ["pbt"] = new[] { "Arabic" },
        };

    /**
     * Languages whose PRIMARY script is Cyrillic — the tie-break for `foldCyrillicConfusables`, which needs to know
     * whether the HOST language is Cyrillic when a word's own letters split evenly (`рaсa`, 2 and 2).
     *
     * The manifests are authoritative — every Cyrillic-led entry here has a manifest whose `script` array leads
     * with "Cyrillic" — but the set is written out rather than derived at import time so that the fold does not
     * pay a 190-file directory scan on startup. test/cyrillic-confusables.test.ts asserts the two agree in both
     * directions, so a new Cyrillic-primary manifest cannot be forgotten and a stale entry cannot linger.
     *
     * `sr` and `kk` declare "Cyrillic/Latin" and are included — Cyrillic leads, so it is the primary. `bs` declares
     * "Latin + Cyrillic" and `uz` "Latin/Cyrillic", both Latin-led, and are NOT included.
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

    /**
     * THE LONE GREEK LETTER, AND WHY ITS NAME IS SPELLED IN GREEK.
     *
     * A run of two or more Greek letters is Greek text and routes to the Greek reader: si's `Παν` reads *pan*.
     * A run of ONE was declined — and a declined run is a DELETED run, because `emitUnclaimed`'s only
     * fall-through is the Latin-to-English path and a Greek letter is not Latin. Measured across the fleet:
     * **the letter vanished in 186 of 188 engines** (the two exceptions being Greek itself, which owns the
     * script, and Ancient Greek). That is gd's `γ-iarann` → *ˈiərˠən̪ˠ*, both of sn's lone letters, and the
     * reason six Greek HTML entities were declined from `core/markup.ts`'s table: decoding `&gamma;` would have
     * fed the decoder's output straight into this deletion, so which entities were safe to add depended on
     * which letters a corpus happened to reach for.
     *
     * ⚠ ROUTING THE LONE LETTER AS GREEK TEXT IS THE WRONG FIX, and is why the threshold was there. `α` in
     * "the value is α" is not a Greek word being quoted, it is a mathematical symbol, and its reading is the
     * LETTER NAME. A phone (`γ` → /ɣ/) would be a wrong reading where there had been a silence, which is the
     * worse trade.
     *
     * ⚠ AND THE NAME DOES NOT NEED A PER-HOST TABLE — the objection that kept this unfixed. The name of a Greek
     * letter is a GREEK WORD; the international names (alpha, beta, delta, sigma) ARE those words borrowed. So
     * the letter's own script supplies its own lexical data, one table for all 193 engines instead of 193
     * tables, and the Greek engine speaks it: ⟨α⟩ → «άλφα» → *alfa*, ⟨π⟩ → «πι» → *pi*, ⟨Δ⟩ → «δέλτα» →
     * *ðelta*, ⟨σ⟩ → «σίγμα» → *siɣma*. Reading an embedded run with the phonology of the script's own language
     * is exactly what this router already does everywhere else — a Cyrillic name inside Greek is read as
     * Russian, not transliterated into Greek — so the lone letter is now the same rule, not a special case.
     *
     * ⚠ THE ACCENT IS THE DISCRIMINATOR, AND IT WAS MEASURED, NOT REASONED. The one-letter GREEK WORD is the
     * real ambiguity — `ή` "or", `ὁ`/`ἡ` the article — and reading those as letter names would be a wrong
     * reading put where a silence had been, which is the worse trade. A census of every lone Greek letter in
     * all 162 mined artifacts separates the two populations with nothing left over:
     *
     *   MATHEMATICS, ~34 languages, and every instance BARE — an `α Scorpii` (an), `Ψ 1 und … Ψ 2` (bar),
     *   `圓周率，一般用 π 表示` (gan), `π × i` (gd), `χ² kritēriju` (lv), `[Ω m]`, `Φ से प्रदशित` (mag), `δ(G)`
     *   (mn), `α, β, γ радиоактивдүүлүк` (ky), `θ बलके दिशा` (mag), `μ = np` (su), `λ′ − λ` (skr).
     *   GREEK PROSE, 2 languages, and every instance ACCENTED — crh's `ἡ θάλασσα` ×5 (the article, quoted from
     *   Ancient Greek) and lg's `Ελευθερία ή θάνατος` (the conjunction "or").
     *
     * A mathematical symbol is never written with a Greek accent or breathing; a Greek one-letter word always
     * is. So the lone letter is named only when it is BARE, and an accented one stays declined exactly as it
     * was — the two cost cases above are unchanged by this fix rather than newly mis-read.
     *
     * ⚠ BOTH CASES, ONE NAME. `Δ` is the commonest lone letter of all in mathematics, and ⟨ς⟩ final sigma is
     * the same letter as ⟨σ⟩, so the lookup lowercases. It does NOT strip accents — see above. Names are the
     * modern Greek ones as the Greek Wikipedia's own alphabet article spells them.
     */
    // prettier-ignore
    private static readonly IReadOnlyDictionary<string, string> GREEK_LETTER_NAME = new Dictionary<string, string>
    {
        ["α"] = "άλφα", ["β"] = "βήτα", ["γ"] = "γάμμα", ["δ"] = "δέλτα", ["ε"] = "έψιλον", ["ζ"] = "ζήτα", ["η"] = "ήτα", ["θ"] = "θήτα",
        ["ι"] = "ιώτα", ["κ"] = "κάππα", ["λ"] = "λάμδα", ["μ"] = "μι", ["ν"] = "νι", ["ξ"] = "ξι", ["ο"] = "όμικρον", ["π"] = "πι",
        ["ρ"] = "ρο", ["σ"] = "σίγμα", ["ς"] = "σίγμα", ["τ"] = "ταυ", ["υ"] = "ύψιλον", ["φ"] = "φι", ["χ"] = "χι", ["ψ"] = "ψι", ["ω"] = "ωμέγα",
    };

    private static readonly JsRe GREEK_LETTER = JsRegex.Compile(@"\p{Script=Greek}", "u");
    private static readonly JsRe AnyMark = JsRegex.Compile(@"\p{M}", "u");

    /**
     * The name of the ONE BARE Greek letter in `run` — `undefined` if the run holds none, holds several, or
     * holds one that carries an accent or breathing, which is the Greek-prose signal (see the table above).
     */
    private static (string Letter, string Name)? LoneGreekLetterName(string run)
    {
        var letters = Js.CodePoints(run).Where(c => GREEK_LETTER.IsMatch(c) && !AnyMark.IsMatch(c)).ToList();
        if (letters.Count != 1) return null;
        var letter = letters[0];
        // NFD, so a PRECOMPOSED accent (`ή` U+03AE) is caught as surely as a combining one (`ἡ` U+1F21). A run
        // whose letter is followed by a loose combining mark fails the `length !== 1` test above already.
        var nfd = letter.Normalize(System.Text.NormalizationForm.FormD);
        if (nfd.Length != 1) return null;
        return GREEK_LETTER_NAME.TryGetValue(nfd.ToLowerInvariant(), out var name)
            ? (letter, name)
            : null;
    }

    /**
     * Which language should read `run`, given the host language reading the document, and WHAT TEXT it should
     * be handed. `undefined` means "leave it dropped": either the script is unknown, or the answer is the host
     * itself — which would mean handing the engine back text its own tokenizer already declined, and recursing.
     *
     * `text` differs from `run` only for the lone Greek letter, which is rewritten to its NAME — see
     * `GREEK_LETTER_NAME`. Returning the pair rather than just the target is what keeps that rewrite a fact
     * about the SCRIPT, next to the table that states it, instead of a special case in the registry's callback.
     */
    public static (string Target, string Text)? ReaderFor(string run, string host)
    {
        var script = ScriptOf(run);
        if (script is null) return null;
        var text = run;
        if (script == "Greek" && Js.CodePoints(run).Count(c => GREEK_LETTER.IsMatch(c)) < 2)
        {
            var named = LoneGreekLetterName(run);
            // An unnamed lone symbol (an archaic letter, an accented one, a lone combining mark) stays
            // declined, exactly as the whole class was before this existed.
            if (named is null) return null;
            // ⚠ SUBSTITUTED IN PLACE, not substituted FOR the run. `FOREIGN_RUN` carries a trailing superscript
            // and a joining hyphen along with the letter (`χ²`, gd's `γ-`), and replacing the whole run would
            // delete those before the reader ever saw them — trading one silent deletion for a smaller one.
            // (What the reader then does with them is its own business: `el` reads `χ²` as *çi* today either
            // way. The point is that this function stops making that decision on its behalf.)
            text = Js.ReplaceFirst(run, named.Value.Letter, named.Value.Name);
        }
        var target =
            OVERRIDES.TryGetValue(host, out var ov) && ov.TryGetValue(script, out var o)
                ? o
                : DEFAULT_READER[script];
        return target == host ? null : (target, text);
    }
}
