/**
 * Danish (da) phonemizer — Standard rigsdansk, canonical IPA. The primary path is the NST pronunciation
 * lexicon; the neural BiLSTM tagger (async, DanishNeural.cs) then the rule g2p are the OOV fallbacks.
 * Ported from src/languages/danish/danish.ts — see that file for the corpus evidence and the tier ordering.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Danish;

/** Per-call OOV resolver: the raw word (as tokenized, NOT lowercased) → IPA, or null to defer to the rule
 *  engine. Consulted BETWEEN the lexicon and the rule g2p; used only by the async neural path. */
public delegate string? OovResolver(string word);

public sealed class DanishPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> V => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> C => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static bool IsV(string ch) => ch != "" && V.ContainsKey(ch);

    private static Dictionary<string, string>? LEX;
    private static readonly object LexGate = new();

    /** The NST pronunciation lexicon (lowercased word → IPA). */
    public static Dictionary<string, string> Lexicon()
    {
        lock (LexGate)
            // ⚠ #1068: alias each key to its NATIVISED spelling, because Text() folds before it looks up.
            // 4 keys; three of the four folded spellings are already in the file and WIN, per LoadTsvMap.
            return LEX ??= LoadTsv.LoadTsvMap("languages/danish", "da-lexicon.tsv", (v, _) => v,
                optional: true, fold: Nat);
    }

    /** Exposed so the async neural path can skip lexicon-covered words. */
    public static bool DanishLexiconHas(string w) => Lexicon().ContainsKey(w);

    private static readonly JsRe UNSTRESSED_PREFIX =
        JsRegex.Compile("^(be|for|ge|und|er)[^aeiouyæøå]*[aeiouyæøå]", "u");

    private static readonly JsRe AF_PREFIX = JsRegex.Compile("^af[bcdfghjklmnpqstvz]", "u");

    private sealed class Seg
    {
        public string Ph = "";
        public bool Nuc;
        public bool Reduced;
        public bool Stress;
    }

    /** One Danish word → canonical IPA by RULE (the OOV fallback). Exposed to the referee eval so the
     *  measurement is NON-CIRCULAR. */
    public static string PhonemizeWordRules(string word)
    {
        var lw = Js.ToLowerCase(word);
        var chars = Js.CodePoints(lw);
        // ⟨af-⟩ prefix: ⟨f⟩ vocalises to the glide [w]. `lw[2] !== "r"` is JS UTF-16 indexing; the class
        // above already excludes ⟨r⟩, so the guard is redundant in both engines and is kept as written.
        var afPrefix = AF_PREFIX.IsMatch(lw) && (lw.Length <= 2 || lw[2] != 'r');
        var n = chars.Count;
        var segs = new List<Seg>();
        void C_(string ph) => segs.Add(new Seg { Ph = ph, Nuc = false });
        void V_(string ph, bool reduced = false) => segs.Add(new Seg { Ph = ph, Nuc = true, Reduced = reduced });
        bool HasNucleus() => segs.Any(s => s.Nuc);

        for (var i = 0; i < n; i++)
        {
            var c = chars[i];
            var prev = i - 1 >= 0 ? chars[i - 1] : "";
            var next = i + 1 < n ? chars[i + 1] : "";
            var final = i == n - 1;

            // ── final-suffix reductions (only when a nucleus already precedes) ──
            if (HasNucleus() && c == "e" && next == "r" && i + 2 == n) { V_("ɐ", true); i++; continue; }
            if (HasNucleus() && c == "e" && next == "t" && i + 2 == n) { V_("ə", true); C_("ð"); i++; continue; }
            if (HasNucleus() && c == "e" && (next == "n" || next == "l") && i + 2 == n)
            { V_("ə", true); C_(C[next]); i += 2; continue; }

            // ── clusters / silent letters ──
            if (c == "f" && i == 1 && afPrefix) { C_("w"); continue; }
            if (c == "n" && next == "g") { C_("ŋ"); i++; continue; }
            if (c == "n" && next == "k") { C_("ŋ"); C_("k"); i++; continue; }
            if (c == "h" && (next == "j" || next == "v")) continue;
            if (c == "t" && next == "h") continue;
            if (c == "d" && (prev == "n" || prev == "l")) continue;
            if (c == "g" && IsV(prev) && final) continue;
            if (!IsV(c) && next == c) continue; // doubled consonant → single

            // ── vowels ──
            if (IsV(c))
            {
                if (c == "e" && final) { V_("ə", true); continue; }
                var nn = i + 2 < n ? chars[i + 2] : "";
                if (c == "i" && next == "n" && nn != "" && !IsV(nn)) { V_("e"); continue; }
                if (c == "o" && next == "l" && nn == "d") { V_("ʌ"); continue; }
                V_(V[c]);
                continue;
            }

            // ── context consonants. The DEFAULT phone comes from the manifest (these four letters never
            // reach the fall-through below, so a literal here is a dead manifest key); only the context
            // ALLOPHONES stay literal. ──
            if (c == "d") { C_(IsV(prev) && (IsV(next) || next == "") ? "ð" : C[c]); continue; }
            if (c == "r") { C_(C[c]); continue; }
            if (c == "t") { C_(final && IsV(prev) ? "d" : C[c]); continue; }
            // ⚠ JS `"eiyæø".includes(next)` is TRUE for the empty string, and the reading depends on it:
            // a word-final ⟨c⟩ takes the SOFT [s]. The bare Contains is the faithful port.
            if (c == "c") { C_("eiyæø".Contains(next, StringComparison.Ordinal) ? "s" : C[c]); continue; }
            if (C.TryGetValue(c, out var cp)) C_(cp); // else: unknown char → skip
        }

        // ── stress: ONE primary ˈ on a FULL nucleus; default first syllable, shifted past an unstressed prefix ──
        var nuclei = segs.Where(s => s.Nuc).ToList();
        if (nuclei.Count >= 2)
        {
            var ord = UNSTRESSED_PREFIX.IsMatch(lw) ? 1 : 0;
            var target = ord < nuclei.Count && !nuclei[ord].Reduced
                ? nuclei[ord]
                : nuclei.FirstOrDefault(s => !s.Reduced);
            if (target is not null) target.Stress = true;
        }
        return string.Concat(segs.Select(s => (s.Stress ? "ˈ" : "") + s.Ph));
    }

    /** One Danish word → canonical IPA: lexicon → tagger (async path only) → rule engine. */
    public static string PhonemizeWord(string word, OovResolver? oovOverride = null)
    {
        var w = Js.ToLowerCase(word);
        if (Lexicon().TryGetValue(w, out var lex)) return lex;
        return oovOverride?.Invoke(word) ?? PhonemizeWordRules(word);
    }

    // A Danish word (Latin incl. æ ø å + loanword accents) / number / punctuation token.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** ⚠ NARROWER THAN THE TOKEN CLASS ON PURPOSE — ó è ã à are absent because the g2p has no rule for them
     *  and DROPS them; see danish.ts. `test/native-inventory.test.ts` measures the claim. */
    private const string NATIVE_CLASS = "[a-zæøåéöäü]";

    /** ⚠ ALSO THE LEXICON'S FOLD (#1068): the same function is passed to LoadTsvMap above. */
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input) => Text(input, null);

    public string Text(string input, OovResolver? oovOverride)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeDanish(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value), oovOverride));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                    sink.Emit(PhonemizeWord(wd, oovOverride));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Danish phonemizer (NST lexicon → rule fallback). */
    public static DanishPhonemizer CreateDanish() => new();

    internal static void RegisterSelf() => Registry.Register("danish", () => CreateDanish());
}
