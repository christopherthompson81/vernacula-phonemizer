/**
 * Russian grapheme→phoneme engine (standard Moscow Russian). Cyrillic + a stress-vowel ordinal → canonical
 * IPA. Handles palatalization (hard/soft consonant pairs Cʲ), iotation (я/е/ё/ю after a vowel/sign/initial →
 * j+V), stress-based vowel reduction (akanye/ikanye), final devoicing and regressive voicing assimilation.
 * Stress is lexical (not derivable from spelling) — supplied by the caller from stress.tsv.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public static class G2p
{
    // All letter→IPA / voicing lookup tables are DATA (russian.jsonc). Consonant → [hard, soft] IPA (ж/ш/ц always
    // hard; ч/щ/й always soft). Voicing pairs drive final devoicing + regressive assimilation.
    private static IReadOnlyDictionary<string, string[]> CONS => Manifest.MANIFEST.Consonants;
    private static readonly IReadOnlySet<string> ALWAYS_HARD = new HashSet<string>(Manifest.MANIFEST.AlwaysHard, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> ALWAYS_SOFT = new HashSet<string>(Manifest.MANIFEST.AlwaysSoft, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> SOFT_VOWEL = new HashSet<string>(Manifest.MANIFEST.SoftVowels, StringComparer.Ordinal); // palatalize the preceding consonant
    private static readonly IReadOnlySet<string> VOWELS = new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.VowelLetters), StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> IOTATED = new HashSet<string>(Manifest.MANIFEST.IotatedVowels, StringComparer.Ordinal); // → j+V after a vowel/ъ/ь/word-initial

    private static IReadOnlyDictionary<string, string> DEVOICE => Manifest.MANIFEST.Devoice;
    private static IReadOnlyDictionary<string, string> VOICE => Manifest.MANIFEST.Voice;
    private static readonly IReadOnlySet<string> VOICELESS_OBSTR = new HashSet<string>(Manifest.MANIFEST.VoicelessObstruents, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOICED_OBSTR = new HashSet<string>(Manifest.MANIFEST.VoicedObstruents, StringComparer.Ordinal);

    private sealed class ConsPart
    {
        public required string Ph { get; set; }
        public required bool Soft { get; set; }
    }

    private sealed class VowelPart
    {
        public required string Letter { get; init; }
        public required bool Glide { get; init; }
        public required string Ph { get; set; }
    }

    private sealed class Unit
    {
        public required string Cyr { get; set; }
        public ConsPart? Cons { get; set; } // a consonant (ph already hard/soft-selected)
        public VowelPart? Vowel { get; set; } // ph filled at realize
    }

    private static string SOFTEN_TGT => Manifest.MANIFEST.SoftenTargets; // dentals that soften regressively (л excluded — пополнять keeps ɫ)

    /** JS `chars[i] ?? ""` over a code-point list. */
    private static string At(IReadOnlyList<string> chars, int i) => i >= 0 && i < chars.Count ? chars[i] : "";

    /** Split a lowercased Cyrillic word into consonant / vowel / sign units, resolving palatalization + iotation. */
    private static List<Unit> Parse(string w)
    {
        var chars = Js.CodePoints(w);
        var units = new List<Unit>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            // т/д before с → affricate t͡s (детский, отсюда); with a ь between (-ться) → long t͡sː.
            if (c == "т" || c == "д")
            {
                var soft = At(chars, i + 1) == "ь";
                var sIdx = soft ? i + 2 : i + 1;
                if (At(chars, sIdx) == "с")
                {
                    units.Add(new Unit { Cyr = "ц", Cons = new ConsPart { Ph = soft ? "t͡sː" : "t͡s", Soft = false } });
                    i = sIdx;
                    continue;
                }
                if (At(chars, i + 1) == "ч")
                {
                    units.Add(new Unit { Cyr = "ч", Cons = new ConsPart { Ph = "t͡ɕː", Soft = true } });
                    i += 1;
                    continue;
                } // тч → t͡ɕː
                if (At(chars, i + 1) == "ц") continue; // тц/дц → t͡s (т/д merges into ц; отца → ɐt͡sa)
            }
            // сч / зч / жч → ɕː (счастье → ɕːasʲtʲjə, мужчина → mʊɕːinə).
            if ((c == "с" || c == "з" || c == "ж") && At(chars, i + 1) == "ч")
            {
                units.Add(new Unit { Cyr = "щ", Cons = new ConsPart { Ph = "ɕː", Soft = true } });
                i += 1;
                continue;
            }
            // дж → the affricate d͡ʐ (loanwords: джинсы, менеджер, Джон, поджарить).
            if (c == "д" && At(chars, i + 1) == "ж")
            {
                units.Add(new Unit { Cyr = "ж", Cons = new ConsPart { Ph = "d͡ʐ", Soft = false } });
                i += 1;
                continue;
            }
            // Reflexive -ся / -сь after a hard consonant keeps hard с (вернулся → …ɫsə); after й (-йся) it stays soft
            // (соприкасающийся → …jsʲə).
            if (c == "с"
                && (At(chars, i + 1) == "я" || At(chars, i + 1) == "ь")
                && i + 2 >= chars.Count
                && At(chars, i - 1) != "й"
                && !VOWELS.Contains(At(chars, i - 1)))
            {
                units.Add(new Unit { Cyr = "с", Cons = new ConsPart { Ph = "s", Soft = false } });
                continue;
            }
            if (CONS.TryGetValue(c, out var pair))
            {
                var next = At(chars, i + 1);
                bool soft;
                if (ALWAYS_HARD.Contains(c)) soft = false;
                else if (ALWAYS_SOFT.Contains(c)) soft = true;
                else soft = next == "ь" || SOFT_VOWEL.Contains(next);
                units.Add(new Unit { Cyr = c, Cons = new ConsPart { Ph = pair[soft ? 1 : 0], Soft = soft } });
            }
            else if (VOWELS.Contains(c))
            {
                var prev = At(chars, i - 1);
                var glide = IOTATED.Contains(c) && (prev == "" || VOWELS.Contains(prev) || prev == "ь" || prev == "ъ");
                units.Add(new Unit { Cyr = c, Vowel = new VowelPart { Letter = c, Glide = glide, Ph = "" } });
            }
            // ь/ъ carry no phoneme (ь already softened the preceding consonant); skip.
        }
        // Regressive palatalization: a dental softens before an immediately-following soft dental (гостиный → sʲtʲ).
        for (var i = 0; i < units.Count; i++)
        {
            var c = units[i];
            if (c.Cons is null || c.Cons.Soft || !SOFTEN_TGT.Contains(c.Cyr, StringComparison.Ordinal)) continue;
            var nx = i + 1 < units.Count ? units[i + 1] : null;
            if (nx?.Cons is null || !nx.Cons.Soft) continue;
            // two-tier: с/з soften only before soft т (сделать/здесь keep hard z before soft д); т/д/н soften before
            // soft т/д/н/ч (стаканчик → nʲt͡ɕ; but женщина keeps hard н before щ).
            var ok = "сз".Contains(c.Cyr, StringComparison.Ordinal)
                ? "тд".Contains(nx.Cyr, StringComparison.Ordinal)
                : "тднч".Contains(nx.Cyr, StringComparison.Ordinal); // с/з soften before soft т/д (сделать→zʲdʲ, ездил→zʲdʲ)
            if (ok) c.Cons = new ConsPart { Ph = CONS[c.Cyr][1], Soft = true };
        }
        // Geminate softness agreement: identical adjacent consonant letters take the softness of the second (россия
        // → sʲsʲ → collapses to sʲː downstream).
        for (var i = 0; i < units.Count - 1; i++)
        {
            Unit a = units[i], b = units[i + 1];
            if (a.Cons is not null && b.Cons is not null && a.Cyr == b.Cyr && b.Cons.Soft && !a.Cons.Soft && CONS.ContainsKey(a.Cyr))
                a.Cons = new ConsPart { Ph = CONS[a.Cyr][1], Soft = true };
        }
        return units;
    }

    // Base (stressed) vowel quality by letter + whether the preceding consonant is soft.
    private static string StressedVowel(string letter, bool softContext) => letter switch
    {
        "а" => softContext ? "æ" : "a", // а fronts to æ between soft C (счастье → ɕːæsʲtʲje)
        "я" => "æ",
        "о" => "o",
        "ё" => "o",
        "э" => "ɛ",
        "е" => "e",
        "у" or "ю" => "u",
        "и" => "i",
        "ы" => "ɨ",
        _ => letter,
    };

    // Unstressed reduction (akanye/ikanye), position-sensitive: `strong` = immediately-pretonic OR absolute
    // word-initial (→ ɐ for hard а/о); post-tonic soft vowels reduce further to ə.
    private static string ReducedVowel(string letter, bool softContext, bool strong, bool postTonic)
    {
        var soft = softContext || letter == "я" || letter == "е" || letter == "и" || letter == "ё" || letter == "ю";
        switch (letter)
        {
            case "а":
            case "о":
                if (soft) return postTonic ? "ə" : "ɪ"; // after a soft consonant (ча, чо…): pretonic ɪ, post-tonic ə
                return strong ? "ɐ" : "ə"; // hard: 1st-pretonic/initial ɐ, else ə
            case "я": return postTonic ? "ə" : "ɪ"; // post-tonic я → ə (далями), pretonic → ɪ
            case "е": return "ɪ"; // unstressed е → ɪ (both positions)
            case "и": return "ɪ";
            case "э": return postTonic ? "ə" : "ɪ";
            case "у":
            case "ю": return "ʊ";
            case "ы": return "ɨ";
            case "ё": return "o"; // ё is always stressed; unreached
            default: return letter;
        }
    }

    // Adverbs in -ого that keep [ɡ] (the genitive -ого/-его → v rule does NOT apply). Their genitive ADJECTIVE
    // forms (многого, дорогого…) are regular genitives → v, so they must NOT be listed here.
    private static readonly IReadOnlySet<string> GEN_KEEP_G = new HashSet<string>(Manifest.MANIFEST.GenitiveKeepG, StringComparer.Ordinal);

    /** Phonemize a Russian word given the 0-based ordinal of its stressed vowel, and optionally a set of vowel
     *  ordinals whose preceding consonant is HARD (loanword е/и: тест → tɛst, not tʲest — supplied by the lexicon). */
    public static string ToIpa(string word, int stressOrd, IReadOnlyList<int>? hard = null)
    {
        var w0 = word.ToLowerInvariant();
        var units = Parse(w0);
        // Genitive -ого/-его → the г is [v] (красного → …nəvə, его → jɪvo); adverbs (много…) keep ɡ.
        if ((w0.EndsWith("ого", StringComparison.Ordinal) || w0.EndsWith("его", StringComparison.Ordinal)) && !GEN_KEEP_G.Contains(w0))
        {
            for (var i = units.Count - 1; i >= 0; i--)
                if (units[i].Cons?.Ph == "ɡ" || units[i].Cons?.Ph == "ɡʲ")
                {
                    units[i].Cons = new ConsPart { Ph = "v", Soft = false };
                    break;
                }
        }
        var vowelIdx = new List<int>();
        for (var i = 0; i < units.Count; i++) if (units[i].Vowel is not null) vowelIdx.Add(i);
        var stressPos = stressOrd >= 0 && stressOrd < vowelIdx.Count ? vowelIdx[stressOrd]
            : vowelIdx.Count > 0 ? vowelIdx[^1] : -1;

        // Realize vowels (quality depends on stress + soft context + reduction position).
        var stressK = vowelIdx.IndexOf(stressPos);
        for (var k = 0; k < vowelIdx.Count; k++)
        {
            var i = vowelIdx[k];
            var v = units[i].Vowel!;
            var prevCons = i - 1 >= 0 ? units[i - 1].Cons : null;
            var softCtx = (prevCons?.Soft ?? false) || (v.Glide && v.Letter != "э" && v.Letter != "ы");
            // soft context to the right (for æ/ɵ fronting): a soft consonant, or an iotated (glide) vowel.
            var nextSoft = false;
            for (var j = i + 1; j < units.Count; j++)
            {
                if (units[j].Cons is not null) { nextSoft = units[j].Cons!.Soft; break; }
                if (units[j].Vowel is not null) { nextSoft = units[j].Vowel!.Glide; break; }
            }
            var prevSoft = prevCons?.Soft ?? false;
            if (i == stressPos)
            {
                v.Ph = StressedVowel(v.Letter, softCtx);
                if ((v.Letter == "я" || v.Letter == "а") && v.Ph == "æ" && !nextSoft) v.Ph = "a"; // æ only between two soft C
                // ё → ɵ whenever not word-initial (встаёт, жильё); о → ɵ after a soft consonant (тётя).
                if ((v.Letter == "ё" && i > 0) || (v.Letter == "о" && prevSoft)) v.Ph = "ɵ";
            }
            else
            {
                var strong = k == stressK - 1 || i == 0; // immediately-pretonic or absolute word-initial
                v.Ph = ReducedVowel(v.Letter, softCtx, strong, k > stressK);
            }
            if ((v.Letter == "у" || v.Letter == "ю") && (prevSoft || v.Glide) && nextSoft) v.Ph = "ʉ"; // у between soft → ʉ
            // After a hard sibilant / ц: и → ɨ, stressed е → ɛ, unstressed е → ɨ.
            var prevCyr = i - 1 >= 0 ? units[i - 1].Cyr : null;
            if (prevCyr is not null && "жшц".Contains(prevCyr, StringComparison.Ordinal))
            {
                if (v.Letter == "и") v.Ph = "ɨ";
                else if (v.Letter == "е") v.Ph = i == stressPos ? "ɛ" : "ɨ";
            }
            // Word-final unstressed vowels: е → e (сборище → …ɕːe, счастье → …je); я → ə (дядя → …dʲə).
            if (i == units.Count - 1 && i != stressPos)
            {
                if (v.Letter == "е") v.Ph = "e";
                else if (v.Letter == "я") v.Ph = "ə";
            }
        }

        // Voicing: regressive assimilation + final devoicing (right to left over the segment sequence).
        for (var i = units.Count - 1; i >= 0; i--)
        {
            var c = units[i].Cons;
            if (c is null) continue;
            (string Ph, string Kind)? next = null;
            for (var j = i + 1; j < units.Count; j++)
            {
                if (units[j].Cons is not null) { next = (units[j].Cons!.Ph, "c"); break; }
                if (units[j].Vowel is not null) { next = (units[j].Vowel!.Ph, "v"); break; }
            }
            if (next is null)
            {
                // word-final → devoice
                if (VOICED_OBSTR.Contains(c.Ph)) c.Ph = DEVOICE.TryGetValue(c.Ph, out var d) ? d : c.Ph;
                continue;
            }
            if (next.Value.Kind == "v") continue; // before a vowel: keep as is
            // NB: в devoices normally (вш → fʂ), it just doesn't TRIGGER voicing of a preceding C (guarded below).
            if (VOICELESS_OBSTR.Contains(next.Value.Ph) && VOICED_OBSTR.Contains(c.Ph))
                c.Ph = DEVOICE.TryGetValue(c.Ph, out var d2) ? d2 : c.Ph;
            else if (VOICED_OBSTR.Contains(next.Value.Ph) && next.Value.Ph != "v" && next.Value.Ph != "vʲ" && VOICELESS_OBSTR.Contains(c.Ph))
                c.Ph = VOICE.TryGetValue(c.Ph, out var vv) ? vv : c.Ph;
        }

        // Loanword hard consonant before е/и (lexicon): harden the preceding C and lower the vowel (е→ɛ/ɨ, и→ɨ).
        if (hard is not null)
        {
            foreach (var o in hard)
            {
                if (o < 0 || o >= vowelIdx.Count) continue;
                var i = vowelIdx[o];
                var v = units[i].Vowel!;
                if (v.Letter != "е" && v.Letter != "и") continue; // guard: only е/и harden (generator may misalign)
                var prev = i - 1 >= 0 ? units[i - 1].Cons : null;
                if (prev?.Soft == true)
                {
                    var cyr = units[i - 1].Cyr;
                    if (CONS.TryGetValue(cyr, out var pair))
                    {
                        prev.Ph = pair[0];
                        prev.Soft = false;
                    }
                    // undo a stranded regressive softening of the consonant before it (стенд: с softened before soft т → re-hard)
                    var p2 = i - 2 >= 0 ? units[i - 2].Cons : null;
                    if (p2?.Soft == true && SOFTEN_TGT.Contains(units[i - 2].Cyr, StringComparison.Ordinal))
                    {
                        var c2 = units[i - 2].Cyr;
                        p2.Ph = CONS[c2][0];
                        p2.Soft = false;
                    }
                }
                v.Ph = v.Letter == "и" ? "ɨ" : i == stressPos ? "ɛ" : "ɨ";
            }
        }

        return WithStress(units, stressPos);
    }

    private static readonly JsRe SIBILANT_HEAD = JsRegex.Compile("^[szʂʐ]|ɕ");

    /** Assemble the IPA string, inserting ˈ before the stressed vowel (after any onset j-glide). Monosyllables
     *  carry no stress mark (matching the reference convention). */
    private static string WithStress(IReadOnlyList<Unit> units, int stressPos)
    {
        var nVowels = units.Count(u => u.Vowel is not null);
        var lastIdx = units.Count - 1;
        var outSb = new StringBuilder();
        var prevCons = "";
        var prevCyr = "";
        for (var i = 0; i < units.Count; i++)
        {
            var u = units[i];
            if (u.Cons is not null)
            {
                if (u.Cons.Ph == prevCons)
                {
                    // Geminate: written doubles and voicing-assimilated stops stay long (русский → sː, отдых → odːɨx); only
                    // a SIBILANT assimilated across a morpheme (different letters: французский зс → s) simplifies to single.
                    // Final geminate → single either way.
                    var sibilantAssim = SIBILANT_HEAD.IsMatch(u.Cons.Ph) && u.Cyr != prevCyr;
                    if (!sibilantAssim && i != lastIdx) outSb.Append('ː');
                }
                else outSb.Append(u.Cons.Ph);
                prevCons = u.Cons.Ph;
                prevCyr = u.Cyr;
                continue;
            }
            if (u.Vowel is not null)
            {
                if (u.Vowel.Glide) outSb.Append('j');
                if (i == stressPos && nVowels > 1) outSb.Append('ˈ');
                outSb.Append(u.Vowel.Ph);
                prevCons = "";
                prevCyr = "";
            }
        }
        return outSb.ToString();
    }
}
