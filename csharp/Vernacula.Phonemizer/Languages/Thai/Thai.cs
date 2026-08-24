/**
 * Thai (th) phonemizer — canonical IPA (authored). Abugida g2p (g2p.ts) with computed tone;
 * words in the frequency corpus are pre-segmented. text() tokenizes Thai runs / numbers / punctuation.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

public static class ThaiPhonemizer
{
    private static readonly JsRe TOKEN = JsRegex.Compile("([฀-๿]+)|(\\d+)|([.!?…,;:])", "gu");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────
    // The tokenizer matched (\d+) but NO branch consumed it — every digit run in Thai text was silently
    // dropped (23.4% of FLEURS th_th utterances contain digits; all lost their numbers). The compositor emits
    // THAI-SCRIPT words (each kaikki-attested with IPA) and reads them through the ordinary g2p, so no IPA is
    // authored here. Grammar: 20 is ยี่สิบ (not สองสิบ); a FINAL 1 in any compound ≥11 is เอ็ด (สิบเอ็ด,
    // ยี่สิบเอ็ด); magnitudes 10⁴ หมื่น and 10⁵ แสน are their own words.
    private static IReadOnlyList<string> TH_UNITS => Normalize.THAI_DIGIT_WORDS;
    private static readonly (double V, string W)[] TH_MAG =
        { (1e6, "ล้าน"), (1e5, "แสน"), (1e4, "หมื่น"), (1e3, "พัน"), (100, "ร้อย") };

    private static List<string> NumberToThaiWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
        {
            return Js.CodePoints(Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => TH_UNITS[(int)Js.Number(d)])
                .ToList();
        }
        if (n == 0) return new List<string> { TH_UNITS[0] };
        var @out = new List<string>();
        var r = n;
        foreach (var (v, w) in TH_MAG)
        {
            if (r >= v)
            {
                var q = Math.Floor(r / v);
                @out.AddRange(NumberToThaiWords(q));
                @out.Add(w);
                r %= v;
            }
        }
        if (r >= 10)
        {
            var t = Math.Floor(r / 10);
            if (t == 2) @out.Add("ยี่สิบ");
            else if (t == 1) @out.Add("สิบ");
            else { @out.Add(TH_UNITS[(int)t]); @out.Add("สิบ"); }
            r %= 10;
            if (r == 1) { @out.Add("เอ็ด"); r = 0; } // final 1 after a ten is เอ็ด
        }
        if (r > 0) @out.Add(TH_UNITS[(int)r]);
        return @out;
    }

    // symbol normalization — Thai: เปอร์เซ็นต์ (kaikki-attested /pɤː˧.sen˧/), read by the Thai g2p.
    //
    // CURRENCY. `$5` read as bare *hˈaː˥˩*. th_th contains ZERO `$` against 39 `%`, so the corpus-driven
    // gate that caught the percent could not see this — yet all four words are in that same corpus, spelled out
    // and immediately after a numeral, which is the slot the tier emits into:
    //
    //   ดอลลาร์ ×28  "ธนบัตรใหม่ชนิดราคา 5 และ 100 ดอลลาร์แคนาดา"
    //   ปอนด์   ×14  "ที่ใช้อย่างเป็นทางการในฟอล์กแลนด์คือปอนด์ฟอล์กแลนด์ (FKP)"
    //   เยน     ×6   "ราคาตั้งแต่ 2,500 เยน ไปจนถึง 130,000 เยน"
    //   ยูโร    ×3   "ทำรายได้มากกว่า 10 พันล้านยูโร (14.7 พันล้านดอลลาร์สหรัฐ"
    //
    // One form each: Thai nouns do not inflect for number. Counted by SUBSTRING and that is correct here — Thai
    // is written without spaces, so there is no token boundary to test and the examples are the evidence.
    //
    // `unspacedScript` for the same reason: a currency sign in Thai is normally flanked by Thai letters, and the
    // tier's letter-boundary guard would reject exactly that ordinary case — `$5ของ` dropped the sign while `$5`
    // alone read it.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `&` was DROPPED outright, losing the sign from `ที่พักประเภท B&B`. `และ` is the ordinary
        // conjunction and the corpus's own word, ×1711 — the most frequent candidate by a wide margin (`กับ`
        // ×674 is "with", and `แอนด์`, the transliterated English "and", is ×0 here).
        // ⚠ THE STRONGEST EVIDENCE IS IN THE SENTENCE ITSELF: the corpus GLOSSES the abbreviation using this very
        // word — `ที่พักประเภท B&B แข่งขันกันในสองสิ่งเป็นหลัก คือ ที่นอนและอาหารเช้า` ("bed AND breakfast").
        // The text states what the sign expands to, in the same breath, with the conjunction chosen here.
        // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
        // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
        // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
        // omitted and defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "คูณ" },
        Ampersand = "และ",
        Percent = new[] { "เปอร์เซ็นต์" },
        // `5 km` read as *hˈaː˥˩ ˈʊkm*: no unit was declared. Verified in th_th, each immediately after a
        // numeral: กิโลเมตร ×25 "ห่างจากบัวโนสไอเรส 50 กิโลเมตร", เมตร ×46 "ยอดเขาวินสันสูง 4,892 เมตร",
        // เซนติเมตร ×1 "อยู่ห่างกันเพียง 69 เซนติเมตร". มิลลิเมตร and กิโลกรัม are ×0 and stay undeclared.
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "กิโลเมตร" }, ["m"] = new[] { "เมตร" }, ["cm"] = new[] { "เซนติเมตร" },
        },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "ดอลลาร์" }, ["€"] = new[] { "ยูโร" }, ["£"] = new[] { "ปอนด์" }, ["¥"] = new[] { "เยน" },
        },
        // `ตารางกิโลเมตร` ×5 and `ลูกบาศก์เมตร` ×1.
        // ⚠ Bare ตาราง substring-matches ×11 and its first instance is `ตารางธาตุ` — the periodic TABLE, which
        // is what ตาราง means on its own. In an unspaced script the bare count cannot be a token count at all
        // (⚠ a word-boundary test is meaningless in an unspaced script), so only the full compound is evidence.
        // `before` RATHER THAN `compound`, against the orthography, because the fused form is MIS-SYLLABIFIED by
        // this G2P and the spaced one is not:
        //   5 ตารางกิโลเมตร  → …mˌeː˧to˧n      5 ตาราง กิโลเมตร  → …mˌeː˦˥t   (= bare กิโลเมตร)
        //   5 ลูกบาศก์เมตร   → lˈuːkbaː˧sˌa˨˩meː…   spaced → lˈuːkbaː˨˩t mˈeː˦˥t
        // The second is the clearer one: ลูกบาศก์ ends in a KARAN (ก์, a silencing mark) and only the spaced
        // reading honours it. This is not a defect introduced by the choice — the corpus's own
        // `2.2 ล้านตารางกิโลเมตรภายใน` already reads mˌeː˧to˧n as written, so the Thai compound path is broken
        // independently and is recorded as such. The space is an intermediate-representation hint to the G2P,
        // never output, so taking the correct reading costs nothing here.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ตาราง" },
            Cubed = new[] { "ลูกบาศก์" },
            Position = ExponentPosition.Before,
        },
        UnspacedScript = true,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // SYMBOLS (%, the shared tier) runs FIRST: it needs the raw `80%`, which step 5/7 of
            // normalizeThai would otherwise have rewritten out from under it. normalizeThai then owns
            // everything Thai-script and Thai-specific — see normalize.ts for the ordered steps.
            Clauses.AssembleClauses(Normalize.NormalizeThai(SYMBOLS(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(G2p.PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in NumberToThaiWords(Js.Number(m.Groups[2].Value))) sink.Emit(G2p.PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    public static ILanguage CreateThai() => new Engine();

    internal static void RegisterSelf() => Registry.Register("thai", CreateThai);
}
