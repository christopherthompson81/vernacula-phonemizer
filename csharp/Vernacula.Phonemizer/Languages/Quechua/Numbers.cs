/**
 * Southern Quechua (qu / Runasimi) cardinal number → words.
 * Ported from src/languages/quechua/numbers.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Quechua;

public static class Numbers
{
    private static readonly string[] UNITS =
        { "ch'usaq", "huk", "iskay", "kimsa", "tawa", "pichqa", "suqta", "qanchis", "pusaq", "isqun" };

    private const string TEN = "chunka", HUNDRED = "pachak", THOUSAND = "waranqa", MILLION = "hunu", BILLION = "lluna";

    private static readonly IReadOnlySet<string> VOWELS =
        new HashSet<string>(Manifest.MANIFEST.SpellingVowels); // ORTHOGRAPHIC (quechua.jsonc), never core/ipa.ts

    /** The -yuq linker with its allomorphy: -niyuq after a consonant (huk → hukniyuq), -yuq after a vowel
     *  (kimsa → kimsayuq); ⟨y⟩ counts as a consonant. */
    private static string Linked(int u)
    {
        var w = UNITS[u];
        return w + (VOWELS.Contains(w[^1].ToString()) ? "yuq" : "niyuq");
    }

    /** A magnitude group: `count` × `word`, with the leading "one" dropped (pachak, never *huk pachak). */
    private static string Times(double count, string word) =>
        count == 1 ? word : $"{Group(count)} {word}";

    /** 1 ≤ n < 100. 11 → "chunka hukniyuq", 20 → "iskay chunka", 21 → "iskay chunka hukniyuq". */
    private static string Below100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        double t = Math.Floor(n / 10), u = n % 10;
        var tens = Times(t, TEN);
        return u == 0 ? tens : $"{tens} {Linked((int)u)}";
    }

    /** 1 ≤ n < 1000. 101 → "pachak hukniyuq", 555 → "pichqa pachak pichqa chunka pichqayuq". */
    private static string Group(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var head = Times(h, HUNDRED);
        if (r == 0) return head;
        return $"{head} {(r < 10 ? Linked((int)r) : Below100(r))}";
    }

    /** Largest-first magnitude chain (…lluna …hunu …waranqa …), each group composed by `group`. */
    private static string Compose(double n)
    {
        foreach (var (scale, word) in new (double, string)[] { (1e9, BILLION), (1e6, MILLION), (1e3, THOUSAND) })
        {
            if (n < scale) continue;
            double c = Math.Floor(n / scale), r = n % scale;
            var head = Times(c, word);
            return r == 0 ? head : $"{head} {(r < 10 ? Linked((int)r) : Compose(r))}";
        }
        return Group(n);
    }

    /** Non-negative integer → Southern Quechua words. 10¹² and above → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
        {
            var sb = new StringBuilder();
            foreach (var c in (raw ?? Js.NumberToString(Math.Abs(n))))
            {
                if (c < '0' || c > '9') continue;
                if (sb.Length > 0) sb.Append(' ');
                sb.Append(UNITS[c - '0']);
            }
            return sb.ToString();
        }
        return n == 0 ? UNITS[0] : Compose(n);
    }
}
