/**
 * Japanese kana → canonical IPA (Standard/Tokyo, narrow). Mora-based: gojūon + dakuten/handakuten + youon
 * (きゃ…) + sokuon (っ, gemination) + long vowels (ー, おう→o̞ː, えい→e̞ː) + moraic ん→ɴ. Katakana is folded to
 * hiragana first. Vowels: あ→ä い→i う→ɯᵝ え→e̞ お→o̞. Segmental only — pitch accent is a later phase.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class Kana
{
    // Vowels (narrow Tokyo): centralized ä, compressed ɯᵝ, mid-lowered e̞/o̞. Lookup tables are DATA (japanese.jsonc).
    private static string A => Manifest.MANIFEST.Vowels["a"];
    private static string I => Manifest.MANIFEST.Vowels["i"];
    private static string U => Manifest.MANIFEST.Vowels["u"];
    private static string E => Manifest.MANIFEST.Vowels["e"];
    private static string O => Manifest.MANIFEST.Vowels["o"];
    private static IReadOnlyDictionary<string, string> MORA => Manifest.MANIFEST.Mora;                // single kana → IPA mora
    private static IReadOnlyDictionary<string, string> YOUON_ONSET => Manifest.MANIFEST.YouonOnset;   // Ci + small ゃゅょ onset (already-palatal ɕ/t͡ɕ/d͡ʑ/ç take no ʲ)
    private static IReadOnlyDictionary<string, string> SMALL_Y => Manifest.MANIFEST.SmallY;           // the small ゃゅょ vowel
    private static IReadOnlyDictionary<string, string> FOREIGN => Manifest.MANIFEST.Foreign;          // extended (foreign-sound) katakana: base + small kana → onset + vowel
    private static IReadOnlyDictionary<string, string> VOWEL_KANA => Manifest.MANIFEST.VowelKana;     // vowel-continuation kana for same-vowel lengthening (を excluded)
    private static IReadOnlyList<NasalAssimilationClass> NASAL_ASSIM => Manifest.MANIFEST.NasalAssimilation; // moraic ん → place-assimilated nasal by next onset

    /** Fold katakana (and the long mark) to hiragana; leave everything else. */
    private static string ToHiragana(string w)
    {
        var @out = "";
        foreach (var ch in Js.CodePoints(w))
        {
            var c = Js.CodePointAt0(ch);
            if (c >= 0x30a1 && c <= 0x30f6) @out += char.ConvertFromUtf32(c - 0x60); // カ → か
            else @out += ch;
        }
        return @out;
    }

    private static bool IsVowelChar(string ph) => ph == A || ph == I || ph == U || ph == E || ph == O;

    /** The vowel phoneme a mora ends in (ɯᵝ/o̞/e̞ before their bases), or "" for ん/っ/onset-only. */
    private static string VowelOf(string ms)
    {
        foreach (var v in new[] { U, O, E, A, I })
            if (ms.EndsWith(v, StringComparison.Ordinal))
                return v;
        return "";
    }

    /** First CODE POINT of a mora string — the TS `ms[0]` reads a UTF-16 unit, and every onset here is BMP. */
    private static string First(string s) => s.Length == 0 ? "" : Js.CodePoints(s)[0];

    /**
     * A run of kana → its list of MORAE (one array element per mora: a long vowel ː is its own mora, a moraic ん is
     * its own mora, a sokuon っ its own mora). `join("")` reconstructs the IPA. Keeping morae separate lets the pitch
     * pass place the downstep by index without re-parsing (our assimilated ん→n/m would be ambiguous in the string).
     * Returns null if the text isn't kana (so the caller can handle romaji/punctuation/unresolved kanji).
     */
    public static List<string>? KanaToMorae(string word)
    {
        var chars = Js.CodePoints(ToHiragana(word));
        var morae = new List<string>();
        var i = 0;
        var lastVowel = ""; // trailing vowel of the current syllable (survives a ː, cleared by ん/っ)
        string At(int k) => k >= 0 && k < chars.Count ? chars[k] : "";
        while (i < chars.Count)
        {
            string c = chars[i], nx = At(i + 1);
            // Extended katakana (foreign sounds): base kana + small kana → onset + vowel (ファ→ɸä, チェ→t͡ɕe̞, ディ→di,
            // デュ→dʲɯᵝ). Keys carry the small 2nd kana, so a direct FOREIGN lookup can't shadow a normal mora sequence.
            if (FOREIGN.TryGetValue(c + nx, out var fms) && fms.Length > 0)
            {
                morae.Add(fms);
                lastVowel = VowelOf(fms);
                i += 2;
                continue;
            }
            // Youon: Ci + small ゃゅょ.
            if (YOUON_ONSET.TryGetValue(c, out var yo) && yo.Length > 0
                && SMALL_Y.TryGetValue(nx, out var sy) && sy.Length > 0)
            {
                var ms = yo + sy;
                morae.Add(ms);
                lastVowel = VowelOf(ms);
                i += 2;
                continue;
            }
            // Sokuon っ → geminate the next mora's first consonant (its own mora). Word-final / vowel-onset → glottal ʔ.
            if (c == "っ" || c == "ッ")
            {
                var nx2 = At(i + 2);
                string? next;
                if (SMALL_Y.TryGetValue(nx2, out var sy2) && sy2.Length > 0
                    && YOUON_ONSET.TryGetValue(nx, out var yo2) && yo2.Length > 0)
                    next = yo2 + sy2;
                else next = MORA.GetValueOrDefault(nx);
                morae.Add(!string.IsNullOrEmpty(next) && !IsVowelChar(First(next)) ? First(next) : "ʔ");
                lastVowel = "";
                i++;
                continue;
            }
            // Long vowel mark ー → +1 mora (ː).
            if (c == "ー" || c == "ｰ")
            {
                if (morae.Count > 0) morae.Add("ː");
                i++;
                continue;
            }
            if (!MORA.TryGetValue(c, out var m)) return null; // not kana → let the caller handle (romaji, punctuation, kanji)
            // Long-vowel coalescence, keyed on the CURRENT KANA (not the phoneme): the お+う / え+い digraphs (おう→o̞ː,
            // えい→e̞ː) and a vowel kana repeating the previous vowel (おお→o̞ː, いい→iː) all fold to a length mark. This
            // fires after a youon mora too — ː is the preferred long-vowel notation everywhere (じゅう→d͡ʑɯᵝː, きゅう→kʲɯᵝː,
            // きょう→kʲo̞ː), for canonical consistency (a doubled vowel and a ー-lengthened vowel are the same length).
            // A fold pushes a bare ː mora; stacking (けいい→ke̞ːː) works since lastVowel survives the ː. を is EXCLUDED from
            // the same-vowel rule (a distinct kana, near-always the particle): 語を→ɡo̞o̞, never ɡo̞ː.
            if (lastVowel != "")
            {
                if (c == "う" && lastVowel == O) { morae.Add("ː"); i++; continue; }
                if (c == "い" && lastVowel == E) { morae.Add("ː"); i++; continue; }
                if (VOWEL_KANA.GetValueOrDefault(c) == lastVowel && VOWEL_KANA.ContainsKey(c)) { morae.Add("ː"); i++; continue; }
            }
            morae.Add(m);
            lastVowel = VowelOf(m);
            i++;
        }
        return AssimilateMoraicN(morae);
    }

    /**
     * Sokuon っ geminates the FOLLOWING mora's initial consonant. Like the ん pass below, this is split out so it
     * can run again over CONCATENATED segments: per-morpheme conversion (segmentsToMorae) leaves a
     * segment-final っ unable to see the next segment's onset, so it fell back to the glottal ʔ — 吹っ切れ came
     * out ɸɯᵝʔkiɾe̞ instead of ɸɯᵝkkiɾe̞. Idempotent: an already-geminated mora is no longer "ʔ".
     */
    public static List<string> GeminateSokuon(List<string> morae)
    {
        for (var k = 0; k < morae.Count; k++)
        {
            if (morae[k] != "ʔ") continue;
            var onset = k + 1 < morae.Count ? First(morae[k + 1]) : "";
            // Only a CONSONANT-initial next mora geminates. A word-final っ, or one before a vowel-onset mora,
            // is a genuine glottal stop and must stay ʔ.
            if (onset != "" && !IsVowelChar(onset)) morae[k] = onset;
        }
        return morae;
    }

    /**
     * Moraic ん assimilates to the FOLLOWING onset's place: n before coronals, ŋ before velars, m before labials,
     * else ɴ (before vowels/glides/fricatives or word-finally): こんにちは→ko̞nni…, にほんご→niho̞ŋɡo̞, さんぽ→sampo̞.
     *
     * Split out so it can run a second time over CONCATENATED segments: when a word is moraised per morpheme
     * (segmentsToMorae), a ん ending one segment cannot see the next segment's onset, and 健康 けん|こう
     * came out ke̞ɴko̞ː instead of ke̞ŋko̞ː. Re-running over the joined morae fixes that, and is idempotent —
     * an already-assimilated mora is no longer "ɴ", so the loop skips it.
     */
    public static List<string> AssimilateMoraicN(List<string> morae)
    {
        for (var k = 0; k < morae.Count; k++)
        {
            if (morae[k] != "ɴ") continue;
            var o = k + 1 < morae.Count ? First(morae[k + 1]) : "";
            if (o == "") continue; // word-final ん stays ɴ (guard includes("") trap)
            foreach (var cls in NASAL_ASSIM)
                if (cls.Onsets.Contains(o, StringComparison.Ordinal))
                {
                    morae[k] = cls.Nasal;
                    break;
                }
        }
        return morae;
    }

    /** A run of kana → IPA. Returns null if the text isn't kana. */
    public static string? KanaToIpa(string word)
    {
        var morae = KanaToMorae(word);
        return morae is null ? null : string.Concat(morae);
    }

    /**
     * Morae for a word given as READING SEGMENTS (one per kanji reading; a literal-kana run is one segment).
     *
     * Long-vowel coalescence is confined to a segment, so the first vowel of one morpheme can never be absorbed
     * into the previous morpheme's length: 経営 けい|えい → ke̞ːe̞ː (not ke̞ːːː), 聖域 せい|いき → se̞ːiki (not
     * se̞ːːki), 子牛 こ|うし → ko̞ɯᵝɕi (not ko̞ːɕi).
     *
     * The mora COUNT is unchanged by this — a coalesced ː was already one mora — so accent-nucleus indices from
     * the pitch dictionary keep pointing at the same mora. Only the vowel QUALITY is corrected.
     *
     * Returns null if any segment is not kana, matching kanaToMorae's contract.
     */
    public static List<string>? SegmentsToMorae(IReadOnlyList<string> segments)
    {
        var @out = new List<string>();
        foreach (var seg in segments)
        {
            if (seg == "") continue;
            var m = KanaToMorae(seg);
            if (m is null) return null;
            @out.AddRange(m);
        }
        // Re-run the two rules that depend on the FOLLOWING onset over the JOINED morae: per-segment conversion
        // hides the next segment's onset from a segment-final ん (健康 けん|こう → ke̞ɴko̞ː) and から a segment-final
        // っ (吹っ切れ ふ|っ|き|れ → ɸɯᵝʔkiɾe̞). Both are idempotent, so within-segment results are unaffected.
        return AssimilateMoraicN(GeminateSokuon(@out));
    }
}
