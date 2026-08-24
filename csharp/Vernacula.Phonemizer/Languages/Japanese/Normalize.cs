/**
 * Japanese (ja) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * readable by the kana engine into kana/kanji the pipeline speaks.
 * Ported from src/languages/japanese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class Normalize
{
    private static readonly JsRe HIRAGANA_RANGE = JsRegex.Compile("[ぁ-ゖ]", "gu");
    private static readonly JsRe KATAKANA_RANGE = JsRegex.Compile("[ァ-ヶ]", "gu");

    /** Hiragana → katakana. Counter and digit readings are injected as KATAKANA throughout this engine so
     *  segmentText's hiragana-specific は→わ particle heuristic cannot corrupt an internal は — はち would
     *  otherwise surface as わち. Same reason japanese.ts folds readCounter's output. */
    private static string ToKatakana(string s) =>
        HIRAGANA_RANGE.Replace(s, c => char.ConvertFromUtf32(Js.CodePointAt0(c.Value) + 0x60));

    /** Digit → its katakana name, for the places Japanese reads digits ONE AT A TIME rather than composing a
     *  cardinal: the fractional part of a decimal (6.34 is ろくてん*さんよん*, never ろくてんさんじゅうよん).
     *  Read off the manifest's own number words so there is a single source for them. */
    private static readonly IReadOnlyList<string> DIGIT_KANA =
        new[] { Manifest.MANIFEST.Numbers.Zero }
            .Concat(Manifest.MANIFEST.Numbers.Ones.Skip(1))
            .Select(ToKatakana)
            .ToList();

    /** Latin letter → its katakana name. The 26 are fixed and uncontroversial; ダブリュー for W and エックス
     *  for X are the full forms Japanese actually uses. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_KANA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "エー", ["B"] = "ビー", ["C"] = "シー", ["D"] = "ディー", ["E"] = "イー", ["F"] = "エフ", ["G"] = "ジー",
        ["H"] = "エイチ", ["I"] = "アイ", ["J"] = "ジェー", ["K"] = "ケー", ["L"] = "エル", ["M"] = "エム", ["N"] = "エヌ",
        ["O"] = "オー", ["P"] = "ピー", ["Q"] = "キュー", ["R"] = "アール", ["S"] = "エス", ["T"] = "ティー", ["U"] = "ユー",
        ["V"] = "ブイ", ["W"] = "ダブリュー", ["X"] = "エックス", ["Y"] = "ワイ", ["Z"] = "ゼット",
    };

    /**
     * Acronyms Japanese reads as a WORD rather than as letters — a lexical fact, so this list holds only
     * established ones. Anything absent falls through to letter-spelling, always a legitimate reading.
     */
    private static readonly IReadOnlyDictionary<string, string> WORD_ACRONYM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["NASA"] = "ナサ", ["NATO"] = "ナトー", ["UNESCO"] = "ユネスコ", ["UNICEF"] = "ユニセフ", ["ASEAN"] = "アセアン",
        ["OPEC"] = "オペック", ["JAXA"] = "ジャクサ", ["JICA"] = "ジャイカ", ["AIDS"] = "エイズ", ["FIFA"] = "フィファ",
        ["pH"] = "ピーエイチ",
    };

    /** Full-width Latin Ａ-Ｚ / ａ-ｚ → ASCII, so one representation reaches the rules below. */
    private static readonly JsRe FULLWIDTH_LATIN = JsRegex.Compile("[Ａ-Ｚａ-ｚ]", "gu");
    private static readonly JsRe FULLWIDTH_DIGIT = JsRegex.Compile("[０-９]", "gu");

    private const string RUBY = "[\\p{Script=Hiragana}\\p{Script=Katakana}ー]+";

    /**
     * RUBY (furigana) arrives in two kinds, and they get OPPOSITE treatment: a DECLARED annotation states the
     * reading, so the ruby wins and the base is dropped; a PARENTHESISED one is only a convention, so it is
     * dropped solely when it equals the computed reading (see the two steps in NormalizeJapanese).
     */
    private static readonly JsRe DECLARED_RUBY = JsRegex.Compile(
        $"\\uFFF9(\\p{{Script=Han}}+)\\uFFFA({RUBY})\\uFFFB|｜(\\p{{Script=Han}}+)《({RUBY})》", "gu");
    private static readonly JsRe PARENTHESISED_RUBY = JsRegex.Compile(
        $"(\\p{{Script=Han}}+)(?:（({RUBY})）|\\(({RUBY})\\))", "gu");

    /** Unit abbreviation → its katakana word. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_KANA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "キロメートル", ["cm"] = "センチメートル", ["mm"] = "ミリメートル", ["nm"] = "ナノメートル", ["m"] = "メートル",
        ["kg"] = "キログラム", ["mg"] = "ミリグラム", ["g"] = "グラム", ["t"] = "トン", ["ha"] = "ヘクタール",
        ["ml"] = "ミリリットル", ["l"] = "リットル",
    };
    /** Longest first, so `km` is not read as `k` + `m` and `mm` is not read as `m` + `m`. */
    private static readonly string UNIT_ALT = string.Join("|", UNIT_KANA.Keys.OrderByDescending(k => k.Length));
    /** The exponent's measure word, which in Japanese precedes the unit: 3850平方キロメートル. */
    private static readonly IReadOnlyDictionary<string, string> MEASURE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["²"] = "平方", ["³"] = "立方",
    };

    private static readonly JsRe GROUPED_THOUSANDS = JsRegex.Compile("(\\d),(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe BUNNO = JsRegex.Compile("(\\d)分の(?=\\d)", "gu");
    private static readonly JsRe SLASH_FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<=[\\d\\p{Script=Han}\\p{sc=Katakana}])[〜～~](?=\\d)", "gu");
    private static readonly JsRe CELSIUS = JsRegex.Compile("(\\d)\\s?(?:℃|°\\s?C)(?![\\p{sc=Latn}])", "gui");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile("(\\d)\\s?(?:℉|°\\s?F)(?![\\p{sc=Latn}])", "gui");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(（])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|[\\s(（])\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s?<\\s?(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s?>\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(?=\\d)", "gu");
    private static readonly JsRe INITIALISM = JsRegex.Compile(
        "(?<![\\p{Script=Latin}\\p{M}])[A-Z][A-Z-]*[A-Z](?![\\p{Script=Latin}\\p{M}])"
        + "|(?<![\\p{Script=Latin}\\p{M}])[A-Z](?![\\p{Script=Latin}\\p{M}])", "gu");
    private static readonly JsRe HAS_LOWER = JsRegex.Compile("[a-z]", "u");
    private static readonly JsRe TRAILING_CHOON = JsRegex.Compile("ー+$", "u");

    /** Normalize one Japanese input string. Pure text→text; every rule emits kana, kanji or ASCII digits and
     *  lets the existing engine do the pronouncing. */
    public static string NormalizeJapanese(string input)
    {
        var s = FULLWIDTH_LATIN.Replace(
            FULLWIDTH_DIGIT.Replace(input, d => char.ConvertFromUtf32(Js.CodePointAt0(d.Value) - 0xfee0)),
            d => char.ConvertFromUtf32(Js.CodePointAt0(d.Value) - 0xfee0));

        s = DECLARED_RUBY.Replace(s, m =>
        {
            var r1 = m.Groups[2].Success ? m.Groups[2].Value : null;
            var r2 = m.Groups[4].Success ? m.Groups[4].Value : null;
            var b1 = m.Groups[1].Success ? m.Groups[1].Value : null;
            return r1 ?? r2 ?? b1 ?? "";
        });

        // The guard is EQUALITY WITH THE COMPUTED READING: a parenthesised kana run is not always furigana
        // (a gloss, an alternate reading, a katakana loan), so only an annotation saying exactly what the
        // engine would already say may be dropped — anything else is kept and read as ordinary text.
        s = PARENTHESISED_RUBY.Replace(s, m =>
        {
            var baseW = m.Groups[1].Value;
            var ruby = m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Success ? m.Groups[3].Value : "";
            return ToHiragana(ruby) == Kanji.ApplyReadings(baseW) ? baseW : m.Value;
        });

        for (var prev = ""; prev != s;)
        {
            prev = s;
            s = GROUPED_THOUSANDS.Replace(s, "$1$2");
        }

        // 分の must be rewritten BEFORE the counter fusion in Japanese.cs can read 分 as the MINUTES counter
        // (3分の1 → *さんぷんのいち). Katakana ブンノ is out of the fusion's reach. Only BETWEEN TWO DIGITS: most
        // 分の in running text is 自分の / 部分の, where the reading is already ぶん and a rewrite corrupts it.
        s = BUNNO.Replace(s, "$1ブンノ");

        s = SLASH_FRACTION.Replace(s, "$2ブンノ$1");

        s = CLOCK.Replace(s, m =>
        {
            var h = Js.Number(m.Groups[1].Value);
            var min = Js.Number(m.Groups[2].Value);
            return min == 0
                ? $"{Js.NumberToString(h)}時"
                : $"{Js.NumberToString(h)}時{Js.NumberToString(min)}分";
        });

        s = DECIMAL_RE.Replace(s, m =>
            $"{m.Groups[1].Value}点{string.Concat(m.Groups[2].Value.Select(d => DIGIT_KANA[d - '0']))}");

        s = RANGE.Replace(s, "から");

        // ⚠ The trailing guard rejects a LATIN letter, not any letter: Japanese is unspaced, so what follows a
        // temperature is normally kana — and kana is `\p{L}`, so a `\p{L}` guard would reject the ordinary case
        // (`20℃を`). Only a Latin letter can form the `°Cm` run-on the guard exists to stop.
        s = CELSIUS.Replace(s, "$1度");
        s = FAHRENHEIT.Replace(s, "華氏$1度");
        s = DEGREE.Replace(s, "$1度");

        s = MINUS.Replace(s, "$1マイナス$2");
        s = PLUS_MINUS.Replace(s, " プラスマイナス ");
        s = PLUS_LEADING.Replace(s, "$1プラス$2");
        s = PLUS_ATTACHED.Replace(s, "$1プラス$2");

        // ⚠ The inequalities are POSTPOSED in Japanese (`A < B` is 「AはBより小さい」), so these two rules consume
        // BOTH operands and rebuild the clause. Substituting より小さい infix the way the European languages do
        // would invert the comparison. They therefore fire only between two digits; elsewhere the sign is
        // dropped as before.
        s = LESS_THAN.Replace(s, "$1は$2より小さい");
        s = GREATER_THAN.Replace(s, "$1は$2より大きい");
        s = EQUALS_RE.Replace(s, "イコール");
        s = DIVIDE.Replace(s, "わる");

        s = TIMES.Replace(s, "$1かける");

        // Latin initialisms LAST, so the rules above still see the ASCII they key on. The boundary lookarounds
        // are ALL of Latin, not `[A-Za-z]`: an ASCII-only guard does not see the accented letter of `São`, and
        // the isolated capital `S` was spelled out as a letter name.
        s = INITIALISM.Replace(s, m => Spell(m.Value));
        foreach (var (k, v) in WORD_ACRONYM)
            if (HAS_LOWER.IsMatch(k))
                s = s.Replace(k, v, StringComparison.Ordinal);

        return s;
    }

    private static string ToHiragana(string s) =>
        KATAKANA_RANGE.Replace(s, c => char.ConvertFromUtf32(Js.CodePointAt0(c.Value) - 0x60));

    /** The five vowel phonemes, longest-first so ɯᵝ and the mid-lowered e̞/o̞ are matched whole. */
    private static readonly IReadOnlyList<string> VOWEL_IPA =
        Manifest.MANIFEST.Vowels.Values.OrderByDescending(v => v.Length).ToList();

    /** The IPA vowel a katakana name ENDS on, with a trailing ー resolved to the vowel it lengthens (ティー →
     *  てぃ → i). `undefined` for a name whose last mora the table does not carry alone, which simply means
     *  "do not separate" — the conservative direction. */
    private static string? FinalVowel(string name)
    {
        var stripped = Js.CodePoints(TRAILING_CHOON.Replace(ToHiragana(name), ""));
        var last = stripped.Count > 0 ? stripped[^1] : null;
        var mora = last is null ? null : Manifest.MANIFEST.Mora.GetValueOrDefault(last);
        return mora is null ? null : VOWEL_IPA.FirstOrDefault(v => mora.EndsWith(v, StringComparison.Ordinal));
    }

    /** The IPA vowel a katakana name BEGINS with, and only when it begins with a BARE vowel kana — those are
     *  the only ones that can be swallowed by the preceding name's vowel. */
    private static string? InitialVowel(string name)
    {
        var cs = Js.CodePoints(ToHiragana(name));
        return Manifest.MANIFEST.VowelKana.GetValueOrDefault(cs.Count > 0 ? cs[0] : "");
    }

    /**
     * One all-caps Latin run → katakana: the listed word reading if it has one, else its letter names.
     * The letter names are JOINED, not spaced, so the acronym stays one accentual phrase — but a boundary is
     * inserted wherever the next name's leading bare vowel would be swallowed by Kana's long-vowel
     * coalescence (シー+イー), and the whole run is space-padded so that coalescence cannot cross into the
     * surrounding Japanese either.
     */
    private static string Spell(string run)
    {
        if (WORD_ACRONYM.TryGetValue(run, out var word)) return $" {word} ";
        var @out = "";
        foreach (var ch in Js.CodePoints(run))
        {
            if (!LETTER_KANA.TryGetValue(ch, out var kana)) continue; // the internal hyphen of XDR-TB; nothing else reaches here
            var prev = FinalVowel(@out);
            if (@out != "" && prev is not null && InitialVowel(kana) == prev) @out += " ";
            @out += kana;
        }
        return @out == "" ? run : $" {@out} ";
    }
}
