/**
 * NGUNI LOANWORD LEXICON — the words whose reading cannot be derived, only listed, plus the de-clicking
 * rewrite that reads ⟨c/q/x⟩ as their Latin values.
 * Ported from src/languages/zulu/nguniLoans.ts — see that file for the ASR evidence behind each verdict.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zulu;

/** How a listed loan is read. TS `type LoanReading = "declick" | "foreign"`. */
public static class LoanReading
{
    public const string Declick = "declick";
    public const string Foreign = "foreign";
}

public static class NguniLoans
{
    public static readonly IReadOnlyDictionary<string, string> NGUNI_LOANS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        // ── NATIVISED: Nguni phonology, click letter read as its Latin value.
        ["canada"] = LoanReading.Declick,
        ["congo"] = LoanReading.Declick,
        ["mexico"] = LoanReading.Declick,
        ["covid"] = LoanReading.Declick,

        // ── ENGLISH-READ place names.
        ["china"] = LoanReading.Foreign,
        ["chile"] = LoanReading.Foreign,
        ["carolina"] = LoanReading.Foreign,

        // ── FOREIGN SURNAMES.
        ["cuerden"] = LoanReading.Foreign,
        ["cadwalder"] = LoanReading.Foreign,
        ["corniglia"] = LoanReading.Foreign,
        ["choudhary"] = LoanReading.Foreign,
        ["capuzzo"] = LoanReading.Foreign,
        ["chhatrapati"] = LoanReading.Foreign,
    };

    private static readonly JsRe X = JsRegex.Compile("x", "gu");
    private static readonly JsRe CQ = JsRegex.Compile("[cq]", "gu");

    /** Read the click letters as their Latin values. ⚠ ⟨x⟩ → the two-letter ⟨ks⟩ first, so nothing can
     *  match the ⟨s⟩ it introduces. */
    public static string DeClick(string word) => CQ.Replace(X.Replace(word, "ks"), "k");
}
