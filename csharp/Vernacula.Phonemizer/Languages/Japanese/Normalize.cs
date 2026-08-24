/**
 * Japanese (ja) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * readable by the kana engine into kana/kanji the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS LAYER'S JOB IS DIFFERENT FROM ITS COUNTERPARTS IN OTHER LANGUAGES. Japanese already has a strong
 * number path — counters (1本→いっぽん), dates, ordinals (第3回), 世紀, percent. What it lacks is a way to keep
 * foreign and symbolic text INSIDE the Japanese phoneme inventory.
 *
 * ⚠ EMBEDDED LATIN ROUTES TO THE ENGLISH PHONEMIZER, WHICH IS WORSE THAN A DROP HERE. A good default for a
 * Cyrillic or Devanagari engine that would otherwise lose the run, it injects phonemes Japanese does not
 * have: `NASA` → [nˈæsə], `WHO` → [dˈʌbəɫjuː ˈeᶦt͡ʃ ˈoᶷ]. That is æ, ʌ, ɫ, t͡ʃ, oᶷ inside an utterance whose
 * whole inventory is the gojūon. A Japanese speaker reads an initialism as its KATAKANA LETTER NAMES — FBI is
 * エフビーアイ — so that is what this file emits, and the kana engine then speaks it natively.
 *
 * ⚠ LETTER-SPELLING IS THE DEFAULT, NOT A GUESS: it is always an available Japanese reading, so an unknown
 * all-caps run is safe to spell. The acronyms read as WORDS (NATO ナトー, UNESCO ユネスコ) are LEXICAL facts and
 * live in a short list of established ones. Same lexical-vs-OOV split core/initialisms.ts uses for the
 * Latin-script languages, with the polarity flipped — there the default is to leave the token alone, which
 * here is not an option.
 *
 * ⚠ MIXED-CASE LATIN IS DELIBERATELY NOT CONVERTED (Apple, Skype, iPhone, ZMapp). Those are loanwords whose
 * katakana is lexical and unguessable from spelling — Apple is アップル, not アプレ — so they keep the English
 * fallback until there is a sourced loanword lexicon. `pH` is listed only because it is an initialism that
 * happens to carry a lowercase letter.
 *
 * ⚠ THE 分の TRAP. `3分の1` reads [sämpɯᵝnno̞ it͡ɕi] — さん*ぷん*の, "three MINUTES of" — because the counter
 * fusion in japanese.ts sees `3` + 分 and applies the minutes reading, which is right for 3分 and wrong here,
 * where 分 is ぶん. Rewriting to katakana ブンノ takes the kanji out of the fusion rule's reach.
 * ⚠ BUT ONLY BETWEEN TWO DIGITS. Most 分の in running text is 自分の ("one's own"), and 7時30分の is a genuine
 * ふん — a blanket rewrite corrupts every one of them.
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
     * established ones, not a guess at every four-letter run in the corpus. Anything absent falls through to
     * letter-spelling, which is always a legitimate Japanese reading and therefore a safe default.
     * `pH` is here because it is an initialism that merely happens to be written with a lowercase letter.
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
     * RUBY (furigana) arrives in two kinds, and they get OPPOSITE treatment.
     *
     * ⚠ TRUE RUBY POSITIONING IS NOT PLAIN TEXT — it is markup, so what reaches a phonemizer is one of these
     * flattenings. `DECLARED` covers the forms that SAY they are ruby: Unicode interlinear annotation
     * (U+FFF9 base U+FFFA ruby U+FFFB, defined for exactly this and discouraged for interchange, so rare) and the
     * aozora convention `｜base《ruby》`. There the author has stated the reading, so the RUBY WINS and the base is
     * dropped — that is the whole point of writing it.
     *
     * `PARENTHESISED` covers `base（ruby）` / `base(ruby)`, which is a CONVENTION and not a declaration: the same
     * shape is an ordinary parenthetical. Those are handled by equality against the computed reading — see step 0b.
     */
    private static readonly JsRe DECLARED_RUBY = JsRegex.Compile(
        $"\\uFFF9(\\p{{Script=Han}}+)\\uFFFA({RUBY})\\uFFFB|｜(\\p{{Script=Han}}+)《({RUBY})》", "gu");
    private static readonly JsRe PARENTHESISED_RUBY = JsRegex.Compile(
        $"(\\p{{Script=Han}}+)(?:（({RUBY})）|\\(({RUBY})\\))", "gu");

    /**
     * Unit abbreviation → its katakana word. These live HERE rather than in the shared symbol tier because
     * that tier matches a unit only when a NUMBER is directly adjacent to it, and two rules below break that
     * adjacency: the decimal rewrite (1.5 km → 1点ゴ km, whose last character is now kana) and the squared
     * unit (km², whose ² the shared tier leaves stranded after claiming the km). Owning the rule locally lets
     * it run BEFORE both, which is the only ordering under which all three cases come out right.
     *
     * `m` and `kg` are the ones the corpus proved were missing: `5kg` leaked the raw letters [kɡ] into the
     * IPA, and `3m` fell through to the English reading of the letter M.
     *
     * The keys are matched CASE-SENSITIVELY, which is the point: an uppercase run is an initialism, not a
     * unit. `MB` is メガバイト to a reader but ケーエム-style letter-spelling is the only safe general rule for
     * two capitals, and the corpus's own `TB` ×4 is tuberculosis, not terabytes. So the byte units are left
     * out rather than guessed at, and the SI units — which are always written lowercase — are complete.
     */
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
        // 0) WIDTH FOLDING first, so every rule below sees one representation. japanese.ts folds the digits
        //    too; doing it here as well makes this function correct standalone and the later fold a no-op.
        var s = FULLWIDTH_LATIN.Replace(
            FULLWIDTH_DIGIT.Replace(input, d => char.ConvertFromUtf32(Js.CodePointAt0(d.Value) - 0xfee0)),
            d => char.ConvertFromUtf32(Js.CodePointAt0(d.Value) - 0xfee0));

        // 0a) DECLARED RUBY — an annotation that says it is one. The author has stated the reading, so it WINS
        //     and the base is dropped: `｜日本《にっぽん》` reads にっぽん, overriding the default にほん. That is
        //     the entire reason for writing it, and it is the one case where the annotation is authoritative.
        s = DECLARED_RUBY.Replace(s, m =>
        {
            var r1 = m.Groups[2].Success ? m.Groups[2].Value : null;
            var r2 = m.Groups[4].Success ? m.Groups[4].Value : null;
            var b1 = m.Groups[1].Success ? m.Groups[1].Value : null;
            return r1 ?? r2 ?? b1 ?? "";
        });

        // 0b) PARENTHESISED RUBY — a CONVENTION, not a declaration, so it needs a guard. Unclaimed, the
        //     annotation is phonemized as ordinary text AFTER the kanji and the reading is emitted TWICE:
        //     `漢字（かんじ）` reads *känd͡ʑi känd͡ʑi*, where a reader says it once.
        //     ⚠ THE GUARD IS EQUALITY WITH THE COMPUTED READING. A parenthesised kana run is NOT always furigana:
        //       日本（にほんじん）   a genuine gloss, not a reading of 日本
        //       日本（にっぽん）     an ALTERNATE reading — written precisely because it differs from the default,
        //                            so suppressing it would delete the author's point
        //       会議（ミーティング） a katakana gloss of a loanword
        //     None equals the computed reading, so all three survive. Only an annotation saying exactly what the
        //     engine would already say is dropped, which is lossless by construction.
        //     ⚠ AND THAT IS WHY THIS CANNOT USE 0a's RULE: here the ruby is not authoritative, so a mismatch means
        //     "keep both", not "the author is overriding".
        s = PARENTHESISED_RUBY.Replace(s, m =>
        {
            var baseW = m.Groups[1].Value;
            var ruby = m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Success ? m.Groups[3].Value : "";
            return ToHiragana(ruby) == Kanji.ApplyReadings(baseW) ? baseW : m.Value;
        });

        // 1) COMMA-GROUPED THOUSANDS (×56, the largest numeric defect). The comma is in this engine's clause
        //    punctuation, so "3,850" became a PHRASE BREAK plus a second number: さん , はっぴゃくごじゅう.
        //    Only a comma with exactly three digits after it and no fourth is grouping — which is why "1,2"
        //    and "2:2" style pairs are left alone. Looped, so 1,000,000 collapses across both separators.
        for (var prev = ""; prev != s;)
        {
            prev = s;
            s = GROUPED_THOUSANDS.Replace(s, "$1$2");
        }

        // 2) UNITS, while a digit is still adjacent to them and the number is still plain ASCII — see
        //    UNIT_KANA for why this cannot be left to the shared symbol tier. The exponent is consumed in the
        //    same match so it can never be stranded.
        // MIGRATION TEST: now composed by the shared tier (units + exponentWords in japanese.ts).

        // 3) 分の BEFORE the counter fusion in japanese.ts can read 分 as the MINUTES counter. See the header:
        //    3分の1 was さんぷんのいち ("three minutes of one"). Katakana ブンノ is out of the fusion's reach.
        //    BOTH DIGITS ARE REQUIRED. A first draft rewrote every 分の and was badly wrong: of the 26 in the
        //    corpus only 5 are fractions. Twelve are 自分の ("one's own"), which the rule corrupted into
        //    自ブンノ; one is 7時30分の間, where 分 really is the minutes counter and ふん is right; the rest
        //    are 部分の / 必要な分の, where the reading was already ぶん and no rewrite was needed.
        s = BUNNO.Replace(s, "$1ブンノ");

        // 4) SLASH FRACTIONS → the same 分の shape, denominator first (1/2 → 2ブンノ1). Guarded on both sides
        //    so a date or a path is not claimed; ×2 in the corpus, and previously the slash was dropped
        //    outright, leaving "1 2".
        s = SLASH_FRACTION.Replace(s, "$2ブンノ$1");

        // 5) CLOCK. Two digits of minutes is the guard that matters: the corpus's other colons are a ratio
        //    (3:2) and a UK degree class (2:2), and neither has them. Both real instances are :00, which drops
        //    the minutes entirely — 11:00 is じゅういちじ, not じゅういちじれいふん.
        s = CLOCK.Replace(s, m =>
        {
            var h = Js.Number(m.Groups[1].Value);
            var min = Js.Number(m.Groups[2].Value);
            return min == 0
                ? $"{Js.NumberToString(h)}時"
                : $"{Js.NumberToString(h)}時{Js.NumberToString(min)}分";
        });

        // 6) DECIMALS (×16). The point was clause punctuation too, so "1.5" broke into "いち . ご". Japanese
        //    says 点 and then the fractional digits INDIVIDUALLY, so those are emitted as katakana digit names
        //    while the integer part stays digits for the cardinal compositor: 6.34 → 6点サンヨン.
        s = DECIMAL_RE.Replace(s, m =>
            $"{m.Groups[1].Value}点{string.Concat(m.Groups[2].Value.Select(d => DIGIT_KANA[d - '0']))}");

        // 7) RANGES (×37). 〜 and its full-width and ASCII twins are read から between the two endpoints
        //    (2～3回, 1894年～1895年). The mark itself is in no table, so it was silently dropped and the range
        //    read as two bare numbers.
        s = RANGE.Replace(s, "から");

        // 8) DEGREES. ℃ is a single character and never decomposed, so the shared symbol tier could not see
        //    it. Japanese says the bare 度 for Celsius — 30℃ is さんじゅうど — and marks Fahrenheit explicitly,
        //    which is the ambiguity 華氏 exists to resolve.
        // THE TRAILING GUARD MUST REJECT A LATIN LETTER, NOT ANY LETTER. Japanese has no spaces, so what
        // follows a temperature is normally kana — and kana is `\p{L}`, so the guard rejected the ORDINARY case:
        // `20℃` read 20度 while `20℃を` read "20度 シー を", the scale letter spelled out because this arm failed
        // and the bare `°` rule below claimed the sign alone. The guard exists to stop `°Cm`-style run-ons, which
        // only a Latin letter can form. Same reasoning as the tier's `unspacedScript`, in a local rule.
        s = CELSIUS.Replace(s, "$1度");
        s = FAHRENHEIT.Replace(s, "華氏$1度");
        s = DEGREE.Replace(s, "$1度");

        // 9) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
        s = MINUS.Replace(s, "$1マイナス$2");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
        //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
        //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
        //    already in this file.
        s = PLUS_MINUS.Replace(s, " プラスマイナス ");
        s = PLUS_LEADING.Replace(s, "$1プラス$2");
        s = PLUS_ATTACHED.Replace(s, "$1プラス$2");

        // 9aa) RELATIONAL AND DIVISION SIGNS. ja.wikipedia states two of these outright, which is as direct
        //      as a sourcing tier gets — an article whose subject IS the sign, saying how it is read:
        //
        //        除算記号 …「日本語では一般に『わる』と読む」        ("generally read as わる in Japanese")
        //        「=（イコール）で表現し」                          (names the sign = as イコール)
        //
        //      ⚠ AND THE INEQUALITIES ARE POSTPOSED, SO AN INFIX RULE WOULD INVERT THE MEANING. Japanese puts the
        //      predicate last: the same source reads the chain `1 < x < 5` as 「xは1より大きく5より小さい」, i.e.
        //      `A < B` is 「AはBより小さい」. Substituting より小さい *between* the operands the way every European
        //      language in this issue does would yield 「7より小さい3」, which reads as "3, which is smaller than 7"
        //      — the comparison backwards. So these two rules consume BOTH operands and rebuild the clause.
        //
        //      ⚠ WHICH MEANS THEY ONLY FIRE BETWEEN TWO NUMBERS, and that is deliberate. Where the operands are not
        //      digits the sign stays dropped, exactly as before — a rule that is correct on the cases it claims
        //      beats a total rule that lies about the rest. 小なり / 大なり, the sign NAMES and infix-safe, were
        //      probed as the alternative and are ×0 / ×0 on ja.wikipedia, so they are not the register's reading.
        s = LESS_THAN.Replace(s, "$1は$2より小さい");
        s = GREATER_THAN.Replace(s, "$1は$2より大きい");
        s = EQUALS_RE.Replace(s, "イコール");
        s = DIVIDE.Replace(s, "わる");

        // 9b) THE DIMENSION `×` → かける, SOURCED FROM THE CORPUS'S OWN AUDIO. The corpus's one instance is the
        //     film-camera sentence, which writes it twice: `6×6 cm、より正確には56×56 mm`. Both are MEASUREMENTS,
        //     not multiplications, and before this the sign was dropped — `6×6` read ろく ろく, two bare numbers.
        //
        //     ⚠ THE WORD COULD NOT BE SOURCED FROM TEXT. Probed against prose, 掛ける returns the everyday verb —
        //     the attestation found was 蕎麦全書 on pouring broth over noodles (`冷たいつゆを掛けていた`), which is
        //     ⚠ THE BARE MODIFIER IS NEVER THE ATTESTATION, here at its most misleading, since the word IS correct and the cited sense is not. Wikidata is no
        //     better: it returns the bare character `×` as ja's label for the multiplication sign.
        //
        //     What settles it is the recording. Qwen3-ASR over ja_jp/train renders BOTH instances in the slot:
        //     `六掛ける六センチ` and `56かける56ミリ`. One speaker — but two independent instances inside the one
        //     utterance, which is stronger than a single occurrence and weaker than two speakers. ja_jp carries
        //     exactly one row for this sentence, so a second speaker is not available here.
        //
        //     Digit-flanked, which is safe for ja: the language is unspaced, so a dimension `×` sits directly
        //     between the numerals. (⚠ That is NOT portable — ar's `29¾ بوصة × 24½ بوصة` has a unit word on the
        //     left, so Arabic keys on the following digit alone.)
        s = TIMES.Replace(s, "$1かける");

        // 10) LATIN INITIALISMS → katakana, LAST, so the rules above still see the ASCII they match on (the
        //     unit and degree rules are keyed on lowercase letters or symbols, untouched by an all-caps rule).
        //     The run may carry internal hyphens (XDR-TB ×4) and is bounded by explicit letter lookarounds so
        //     it cannot bite into a mixed-case word.
        //    ⚠ THE BOUNDARY IS ALL OF LATIN, not `[A-Za-z]`. An ASCII-only lookaround does not see an accented
        //    letter as a letter, so the `S` of `São` passed the isolated-capital test and was spelled out as a
        //    LETTER NAME with the rest of the name left behind: `São` → *esu / ˈʌɔː*.
        s = INITIALISM.Replace(s, m => Spell(m.Value));
        //     `pH` and the other listed mixed-case initialisms, which the all-caps rule cannot reach.
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
     *
     * THE LETTER NAMES ARE JOINED, NOT SPACED, so the acronym stays ONE accentual phrase — FBI is
     * [e̞ɸɯᵝbiːäꜜi] with a single downstep, which is how it is said; spacing every letter instead gives three
     * separate accents. But joining runs the names into kana.ts's LONG-VOWEL COALESCENCE, which is a
     * word-internal rule and has no business spanning two letter names: CEO as シーイーオー came out
     * [ɕiːːː o̞ː], a four-mora vowel, because シー's ー and イー's イ and ー all stacked. So a boundary is
     * inserted exactly where the next name would be absorbed — its first kana is a bare vowel equal to the
     * vowel the previous name ended on (C+E, A+F, O+O, and the other i/i and e/e pairs). Everywhere else the
     * names stay fused.
     *
     * The whole run is also PADDED with spaces, because the same coalescence crosses into the surrounding
     * Japanese: 「とらえられたISIS」 ran た+ア together as [täːi]. The pad is a bunsetsu boundary, which is what
     * an acronym is, and assembleClauses does not emit it as a gap.
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
