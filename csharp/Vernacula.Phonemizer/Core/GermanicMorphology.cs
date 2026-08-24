/**
 * Shared West-Germanic morphological decomposition — the layer that makes boundary-sensitive phonology
 * possible for the compounding Germanic languages (German, Dutch, Afrikaans, …).
 * Ported from src/core/germanicMorphology.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Core;

// TS: `export type Kind = "prefix" | "stem" | "suffix";`
public enum Kind
{
    Prefix, // "prefix"
    Stem, // "stem"
    Suffix, // "suffix"
}

public sealed class Decomp
{
    public required List<string> Parts { get; init; } // morphemes in order (prefixes, stems, suffixes)
    public required List<Kind> Kinds { get; init; } // kind of each part
    public required int StressPart { get; init; } // index of the part carrying primary stress
}

public sealed class MorphologyConfig
{
    public required string Vowels { get; init; } // the language's vowel LETTERS (for the isStemish onset gate)
    public required IReadOnlyList<string> PrefixUnstressed { get; init; } // longest-first; reduce their vowel, stem is element-initial
    public required IReadOnlyList<string> PrefixStressed { get; init; } // separable prefixes — carry primary stress
    public required IReadOnlySet<string> AmbiguousPrefixes { get; init; } // prefixes that also start roots → strip only if the remainder is a word
    public required IReadOnlyList<string> Suffixes { get; init; } // longest-first derivational/inflectional suffixes
    public required IReadOnlySet<string> VowelInitialSuffixes { get; init; } // resyllabify onto the stem (no boundary) → loose to strip
    public required IReadOnlySet<string> ReliableConsSuffixes { get; init; } // consonant-initial but reliable, loose-stripped when the stem ends voiced
    public required Func<string, IReadOnlyList<string>> LinksFor { get; init; } // Fugen-elemente to try for this head, in order (promote -s- if flagged)
    public required IReadOnlySet<string> ValidOnsets { get; init; } // valid 2-/3-letter onsets for the isStemish gate
    public required IReadOnlySet<string> StKeep { get; init; } // monomorphemic words to keep whole (no false prefix boundary)
    public required Func<string, bool> IsWord { get; init; } // a known content word (lexicon)
    public required Func<string, bool> IsConstituent { get; init; } // a valid compound part (lexicon; caller enforces any min length/flag)
    public string? NegationPrefix { get; init; } // a negation prefix strippable ONLY before another prefix (German un-)
    public JsRe? NegationFollows { get; init; } // …which prefixes may follow it
    public IReadOnlySet<string>? RealWordStressedPrefixes { get; init; } // stressed prefixes needing a REAL-word stem (German mit-)
    public Func<string, string, bool>? SuffixDigraphGuard { get; init; } // reject a suffix strip that shatters a digraph
    public JsRe? SeamElementInitial { get; init; } // a non-first constituent starting like this resets element-initial (German st/sp/sch)
    public string? WholeVerbSuffix { get; init; } // keep a whole known verb lexeme ending in this suffix un-split (German -en)
    // min letters for a compound's trailing part (default 3; nl uses 4 to reject 3-letter
    // inflectional-lookalike tails that are real words but not compound heads)
    public int? MinTrailingConstituent { get; init; }
    // never split a word that is itself a lexicon entry (nl only; German splits known compounds so it stays
    // off — its lexicon flags constituents, not whole compounds)
    public bool DontSplitKnownWords { get; init; }
}

public static class GermanicMorphology
{
    public const string BOUNDARY = "·"; // inserted between morphemes; the g2p treats the next letter as element-initial

    private static readonly JsRe EndsVoicedObstruent = JsRegex.Compile("[bdg]$", ""); // TS literal /[bdg]$/

    /** Port of JS `w[i] ?? ""`: one UTF-16 code unit as a string, or "" out of range. */
    private static string CharAt(string w, int i) => i < w.Length ? w[i].ToString() : "";

    /** Build a `decompose(word)` for a language from its morphology config. */
    public static Func<string, Decomp> MakeDecompose(MorphologyConfig cfg)
    {
        var VOWELS = cfg.Vowels;
        // TS declares `isVowelStart` here; it is unused in the module and is not ported.

        /** Loose gate: a stripped stem must have a vowel and start with a valid onset (so a prefix isn't peeled off a
         *  non-word — be+rlin, where "rl" is not an onset). */
        bool isStemish(string w)
        {
            if (!Js.CodePoints(w).Any(c => VOWELS.Contains(c, StringComparison.Ordinal))) return false;
            string a = CharAt(w, 0), b = CharAt(w, 1);
            if (VOWELS.Contains(a, StringComparison.Ordinal)) return true; // vowel-initial
            if (VOWELS.Contains(b, StringComparison.Ordinal) || b == "") return true; // single consonant onset
            return cfg.ValidOnsets.Contains(a + b) || cfg.ValidOnsets.Contains(w[..Math.Min(3, w.Length)]); // valid cluster
        }

        bool resolves(string w) =>
            cfg.IsWord(w) || cfg.IsConstituent(w) || splitCompound(w) != null;

        /** Split a run into compound constituents (longest-leading, ≤3 parts). null = not a compound. */
        List<string>? splitCompound(string w, int depth = 0)
        {
            if (depth > 2) return null;
            if (cfg.DontSplitKnownWords && cfg.IsWord(w)) return null;
            var minTail = cfg.MinTrailingConstituent ?? 3;
            // ⚠ A LEADING CONSTITUENT MUST BE ≥4 LETTERS, and the floor is load-bearing rather than
            // cautious: a stem lexicon is a WORDLIST, so at ≥3 every three-letter word in it becomes a
            // compound head and the splitter shatters ordinary vocabulary. A named-exception list for the
            // real 3-letter stems was tried and rejected.
            for (var i = w.Length - minTail; i >= 4; i--)
            {
                var head = w[..i];
                if (!cfg.IsConstituent(head)) continue;
                foreach (var lk in cfg.LinksFor(head))
                {
                    if (!w[i..].StartsWith(lk, StringComparison.Ordinal)) continue;
                    var rest = w[(i + lk.Length)..];
                    if (rest.Length < minTail) continue;
                    if (cfg.IsConstituent(rest))
                    {
                        var deeper = splitCompound(rest, depth + 1) ?? splitPrefixedStem(rest, depth + 1);
                        return deeper != null
                            ? new List<string> { head + lk }.Concat(deeper).ToList()
                            : new List<string> { head + lk, rest };
                    }
                    var tail = splitCompound(rest, depth + 1);
                    if (tail != null) return new List<string> { head + lk }.Concat(tail).ToList();
                }
            }
            return null;
        }

        /** A constituent may itself be a stressed-prefix + stem (vorstellung → vor·stellung): strip so the stem is
         *  g2p'd element-initially. */
        List<string>? splitPrefixedStem(string w, int depth)
        {
            if (depth > 2) return null;
            foreach (var p in cfg.PrefixStressed)
            {
                if (!w.StartsWith(p, StringComparison.Ordinal) || w.Length - p.Length < 4) continue;
                var r = w[p.Length..];
                if (cfg.IsConstituent(r)) return new List<string> { p, r };
                var sub = splitCompound(r, depth + 1);
                if (sub != null) return new List<string> { p }.Concat(sub).ToList();
                if (isStemish(r)) return new List<string> { p, r };
            }
            return null;
        }

        return delegate (string word)
        {
            var w = word.ToLowerInvariant();
            if (cfg.StKeep.Contains(w))
                return new Decomp { Parts = new List<string> { w }, Kinds = new List<Kind> { Kind.Stem }, StressPart = 0 };
            var prefixes = new List<string>();
            var rest = w;
            for (var round = 0; round < 3; round++)
            {
                var stripped = false;
                foreach (var p in cfg.PrefixUnstressed)
                {
                    if (!rest.StartsWith(p, StringComparison.Ordinal) || rest.Length - p.Length < 4) continue;
                    var r = rest[p.Length..];
                    var ok =
                        p == cfg.NegationPrefix
                            ? cfg.NegationFollows?.IsMatch(r) == true
                            : cfg.AmbiguousPrefixes.Contains(p)
                              ? cfg.IsWord(r) || splitCompound(r) != null
                              : isStemish(r);
                    if (ok) { prefixes.Add(p); rest = r; stripped = true; break; }
                }
                if (!stripped) break;
            }
            var sepPrefix = "";
            foreach (var p in cfg.PrefixStressed)
            {
                if (!rest.StartsWith(p, StringComparison.Ordinal) || rest.Length - p.Length < 4) continue;
                var r = rest[p.Length..];
                var ok = cfg.RealWordStressedPrefixes?.Contains(p) == true
                    ? cfg.IsWord(r) || splitCompound(r) != null
                    : isStemish(r);
                if (ok) { sepPrefix = p; rest = r; break; }
            }
            var suffixes = new List<string>();
            for (var round = 0; round < 2; round++)
            {
                var stripped = false;
                foreach (var s in cfg.Suffixes)
                {
                    if (!rest.EndsWith(s, StringComparison.Ordinal) || rest.Length - s.Length < 3) continue;
                    var stem = rest[..(rest.Length - s.Length)];
                    if (cfg.SuffixDigraphGuard?.Invoke(s, stem) == true) continue;
                    var reliableLoose = cfg.ReliableConsSuffixes.Contains(s) && EndsVoicedObstruent.IsMatch(stem);
                    var ok = cfg.VowelInitialSuffixes.Contains(s) || reliableLoose ? isStemish(stem) : resolves(stem);
                    if (ok) { suffixes.Insert(0, s); rest = stem; stripped = true; break; }
                }
                if (!stripped) break;
            }
            var stemParts = splitCompound(rest) ?? new List<string> { rest };
            if (stemParts.Count == 1 && suffixes.Count > 0)
            {
                var whole = rest + string.Concat(suffixes);
                var split = splitCompound(whole);
                var seamSplit = split != null && split.Count >= 2 && cfg.SeamElementInitial != null
                    && split.Skip(1).Any(p => cfg.SeamElementInitial!.IsMatch(p)); // TS: cfg.seamElementInitial!.test(p)
                var cs = !string.IsNullOrEmpty(cfg.WholeVerbSuffix) && cfg.IsWord(whole)
                        && whole.EndsWith(cfg.WholeVerbSuffix, StringComparison.Ordinal) && !seamSplit
                    ? null : split;
                if (cs != null && cs.Count >= 2) { stemParts = cs; suffixes.Clear(); }
            }

            var parts = prefixes
                .Concat(sepPrefix != "" ? new[] { sepPrefix } : Array.Empty<string>())
                .Concat(stemParts)
                .Concat(suffixes)
                .ToList();
            var kinds = prefixes.Select(_ => Kind.Prefix)
                .Concat(sepPrefix != "" ? new[] { Kind.Prefix } : Array.Empty<Kind>())
                .Concat(stemParts.Select(_ => Kind.Stem))
                .Concat(suffixes.Select(_ => Kind.Suffix))
                .ToList();
            return new Decomp { Parts = parts, Kinds = kinds, StressPart = prefixes.Count };
        };
    }
}
