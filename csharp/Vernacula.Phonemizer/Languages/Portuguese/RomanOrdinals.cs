/**
 * PORTUGUESE (pt) Roman-numeral reading.
 *
 * A CENTURY IS A CARDINAL — the existing shared pass is already right, and this file deliberately does not
 * touch it. Ciberdúvidas da Língua Portuguesa, «Numeração romana: ordinal ou cardinal?» and «Numeração de
 * reis, papas e séculos, novamente»: the settled usage is ordinal up to X and cardinal from XI on, and the
 * century is named explicitly — «"Século XIX" não corresponde a "século décimo nono", mas a "século
 * dezenove"», alongside *Bento XVI* = *dezasseis*, *João XXI* = *vinte e um*, *Luís XIV* = *catorze*.
 *   → https://ciberduvidas.iscte-iul.pt/consultorio/perguntas/numeracao-romana-ordinal-ou-cardinal/14167
 *   → https://ciberduvidas.iscte-iul.pt/consultorio/perguntas/numeracao-de-reis-papas-e-seculos-novamente/14284
 * So `século XV` → *século quinze*, which is what the cardinal pass already produces. Neither `século` nor
 * any regnal name appears in the triggers below.
 *
 * WHAT THIS FILE IS FOR: the *prenominal* ordinal — a Roman numeral placed BEFORE its noun in the name of
 * an anniversary, congress or edition, read as an ordinal at ANY value. `XL aniversário` is *quadragésimo
 * aniversário*, `L aniversário` is *quinquagésimo*; the cardinal pass reads *quarenta* / *cinquenta*, which
 * is wrong. Hence `ordinal` is a function over all n, not a century-sized table, and only `ordinalAfter`
 * (the noun FOLLOWING the numeral) is populated.
 *
 * WHY REGNAL IS OUT OF SCOPE, explicitly: the norm is ordinal ≤ X (*D. João V* = *quinto*, *Paulo VI* =
 * *sexto*) / cardinal ≥ XI, but the policy exposes ONE ordinal function shared by every context and the
 * prenominal-event context needs an ordinal at 40 and 50 — bounding it at ten would break the case this
 * file exists for, and leaving it unbounded with regnal triggers would produce *Luís décimo quarto* against
 * the source. Documented shortcoming: `João VI` keeps the cardinal (in fact it is not converted at all —
 * `VI` is on the shared pass's global collision list, as `I` is below its two-character minimum).
 *
 * FORM: the -ésimo series is not derivable from Portuguese's cardinal compositor (*vigésimo* contains no
 * *vinte*), so this is authored ordinal data — units, the *décimo …* teens, the -ésimo tens and hundreds.
 * Above one thousand it returns `undefined` and the cardinal stands, which is also the right reading for a
 * Roman-numeral year. Spellings are the post-Acordo forms shared by pt-PT and pt-BR.
 *
 * AGREEMENT: masculine singular. Every trigger noun below is masculine. LIMITATION: feminine heads need
 * -ésima (*a XXV edição* is *vigésima quinta*), so feminine nouns are kept OUT of the trigger list and keep
 * the cardinal reading rather than acquiring a wrong-gender ordinal.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public static class RomanOrdinals
{
    private static readonly string[] UNITS = { "", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono" };
    private static readonly string[] TENS = { "", "décimo", "vigésimo", "trigésimo", "quadragésimo", "quinquagésimo",
        "sexagésimo", "septuagésimo", "octogésimo", "nonagésimo" };
    private static readonly string[] HUNDREDS = { "", "centésimo", "ducentésimo", "trecentésimo", "quadringentésimo",
        "quingentésimo", "seiscentésimo", "septingentésimo", "octingentésimo", "noningentésimo" };

    /** Portuguese masculine ordinal, 1 … 1000; `undefined` above that (a Roman-numeral year reads as a cardinal). */
    /** Exported so normalize.ts can reuse it for the ordinal INDICATORS (1º/5ª) and for fractions. */
    public static string? PortugueseOrdinal(int n)
    {
        if (n < 1 || n > 1000) return null;
        if (n == 1000) return "milésimo";
        if (n < 10) return UNITS[n];
        if (n < 100)
        {
            int t = n / 10, u = n % 10;
            return u == 0 ? TENS[t] : $"{TENS[t]} {UNITS[u]}"; // décimo primeiro, vigésimo quinto
        }
        int h = n / 100, r = n % 100;
        return r == 0 ? HUNDREDS[h] : $"{HUNDREDS[h]} {PortugueseOrdinal(r)}";
    }

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = PortugueseOrdinal,
        /**
         * Noun AFTER the numeral — the prenominal ordinal of event and edition names, the one Portuguese
         * context that is genuinely ordinal at any value. Masculine nouns only (see AGREEMENT). `século` is
         * absent on purpose: it precedes its numeral, and it is a cardinal anyway.
         */
        OrdinalAfter = JsRegex.Compile(
            "^(aniversário|centenário|congresso|encontro|festival|campeonato|certame|concurso|prémio|premio|salão|simpósio|colóquio|seminário|torneio|fórum|ciclo|volume|capítulo|tomo|canto|ato|acto|artigo|batalhão|regimento|governo)$",
            "iu"),
    };
}
