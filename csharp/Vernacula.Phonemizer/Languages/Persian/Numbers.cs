/**
 * Persian (fa) cardinal number compositor — the DECIMAL IRANIAN system, the same shape already implemented for
 * its relatives Central Kurdish (central-kurdish/numbers.ts) and Balochi (balochi/numbers.ts):
 *
 *     21        بیست و یک              bist-o-yek
 *     105       صد و پنج               sad-o-panj
 *     1979      هزار و نهصد و هفتاد و نه   hezâr-o-nohsad-o-haftâd-o-noh
 *     1,000,000 یک میلیون              yek milyun
 *
 * WHY THIS FILE EXISTS. Persian was previously composed by `indicNumberWords`, the 2-2-3 lakh/crore composer,
 * with persian.jsonc faking `lakh: "صد هزار"` and `crore: "ده میلیون"` to approximate the Iranian scale. Over the
 * fa_ir corpus's 591 digit runs that produced, measurably:
 *   21        → "یک بیست"  [ˈiːk bˈiːst]        (Indic unit-before-tens, and no connective)
 *   100       → "یک صد"                          (Persian says the bare صد)
 *   200/300   → "دو صد" / "سه صد"                (Persian has the IRREGULAR fused دویست / سیصد)
 *   1000      → "یک هزار"                        (Persian says the bare هزار)
 *   1,000,000 → "ده صد هزار" [dˈah sadahzˈaːɾ]   (ten-hundred-thousand, and the faked two-word magnitude was
 *                                                 g2p'd as ONE word because renderNumber maps each entry whole)
 * and no ⟨و⟩ anywhere, so 1979 read as a bare five-word list.
 *
 * THREE THINGS THE IRANIAN SYSTEM NEEDS THAT THE SHARED COMPOSERS DO NOT PROVIDE:
 *
 * 1. IRREGULAR HUNDREDS. 200-900 are single fused words (دویست، سیصد، چهارصد، پانصد، ششصد، هفتصد، هشتصد، نهصد),
 *    not multiplier + صد. That is exactly what the shared `NumbersDef.hundreds` slot is for (the Western/Slavic
 *    composer already reads it), so the data lives in persian.jsonc; only the linking differs.
 *
 * 2. THE CONNECTIVE ⟨و⟩ /o/ between every group. Given as IPA (`connectiveIpa`), NOT orthography, for the reason
 *    balochi/numbers.ts records: this g2p reads a bare ⟨و⟩ as the long [uː] (isV → longVowel), so a spelled-out
 *    ⟨بیستو⟩ would yield [biːstuː] and a standalone ⟨و⟩ token [ˈuː] — neither is the Persian enclitic /o/. So the
 *    composer MARKS the word that carries it and `encliticWord` appends the single segment [o] after that word has
 *    been phonemized. Central Kurdish takes the orthographic route because its -u genuinely IS long.
 *
 * 3. THE BARE-vs-یک RULE, which differs per magnitude: صد and هزار are bare (صد = 100, هزار = 1000 — *یک صد is
 *    not idiomatic), while میلیون and میلیارد keep it (یک میلیون). Same split as ckb's سەد/هەزار vs ملیۆن/ملیار.
 *
 * SOURCE: standard Iranian Persian cardinals, the same basis as the rest of persian.jsonc. Corroborated in-repo by
 * the mined harakat lexicon, which independently carries سیصد and پانصد as headwords (persian/lexicon.tsv) — i.e.
 * the fused hundreds are attested as single words by data this repo already shipped, not asserted here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

/** The fa numbers table: the shared schema (units/teens/tens/hundreds/magnitudes) + the connective's IPA. */
public sealed class FaNumbersDef : NumbersDef
{
    /** IPA of the linking enclitic ⟨و⟩ /o/; appended after the preceding word is phonemized. See §2 above. */
    public string ConnectiveIpa = "";
}

public static class Numbers
{
    // Internal marker: "this word carries the connective". Stripped by the word renderer, which then appends the
    // connective's IPA. A private-use codepoint, so it can never collide with a Persian spelling.
    private static readonly string CONNECTIVE = char.ConvertFromUtf32(0xE000);

    /** Wrap a word→IPA renderer so a connective-marked word gets [o] appended to its IPA (بیست → [bˈiːsto]). */
    public static Func<string, string> EncliticWord(Func<string, string> word, FaNumbersDef d) =>
        w => w.EndsWith(CONNECTIVE, StringComparison.Ordinal)
            ? word(w[..^CONNECTIVE.Length]) + d.ConnectiveIpa
            : word(w);

    /** Link two groups with the connective: it attaches to the LAST word of the head (بیست → بیست-و). */
    private static List<string> Link(List<string> head, List<string> tail)
    {
        if (tail.Count == 0) return head;
        var @out = new List<string>(head);
        @out[^1] += CONNECTIVE;
        @out.AddRange(tail);
        return @out;
    }

    /** Compose a non-negative integer into ordered Persian number-word spellings. */
    public static List<string?> PersianNumberWords(double n, NumbersDef def)
    {
        var d = (FaNumbersDef)def;
        List<string> Go(double x)
        {
            if (x < 10) return new List<string> { d.Units[(int)x] };
            if (x < 20) return new List<string> { d.Teens![(int)x - 10] };
            if (x < 100)
            {
                var t = Math.Floor(x / 10) * 10;
                return Link(new List<string> { d.Tens[Js.NumberToString(t)] }, x % 10 != 0 ? Go(x % 10) : new List<string>());
            }
            // The hundreds are ONE fused word each (§1) — no multiplier, so nothing to link inside the group.
            if (x < 1000)
                return Link(new List<string> { d.Hundreds![(int)Math.Floor(x / 100)] }, x % 100 != 0 ? Go(x % 100) : new List<string>());
            // Multiplier + magnitude form one group; `bare` drops a multiplier of 1 (هزار, not *یک هزار) (§3).
            List<string> Grouped(double mult, string mag, bool bare)
            {
                if (bare && mult == 1) return new List<string> { mag };
                var g = Go(mult);
                g.Add(mag);
                return g;
            }
            if (x < 1_000_000)
                return Link(Grouped(Math.Floor(x / 1000), d.Magnitudes.Thousand, true), x % 1000 != 0 ? Go(x % 1000) : new List<string>());
            if (x < 1_000_000_000)
                return Link(Grouped(Math.Floor(x / 1_000_000), d.Magnitudes.Million!, false),
                    x % 1_000_000 != 0 ? Go(x % 1_000_000) : new List<string>());
            return Link(Grouped(Math.Floor(x / 1_000_000_000), d.Magnitudes.Billion!, false),
                x % 1_000_000_000 != 0 ? Go(x % 1_000_000_000) : new List<string>());
        }
        return Go(n).Select(x => (string?)x).ToList();
    }
}
