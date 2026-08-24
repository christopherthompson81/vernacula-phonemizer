/**
 * Persian OOV short-vowel restorer — a char-level SEQ2SEQ (BiLSTM encoder + attention decoder) that maps a
 * bare Persian abjad word directly to IPA, run via ONNX Runtime.
 * Ported from src/languages/persian/vowelRestorer.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public interface IFaVowelRestorer
{
    /** A bare Persian abjad word → restored Iranian IPA (no stress mark). */
    Task<string> Restore(string word);
}

public static class VowelRestorer
{
    private static readonly JsRe VOWEL_G = JsRegex.Compile("[aeiouɒæ]ː?", "gu");
    private static readonly JsRe SHORT_I = JsRegex.Compile("i(?!ː)", "gu");
    private static readonly JsRe SHORT_U = JsRegex.Compile("u(?!ː)", "gu");
    private static readonly JsRe FINAL_HE = JsRegex.Compile("ه$", "u");
    private static readonly JsRe FINAL_A = JsRegex.Compile("a$", "u");

    /**
     * classical/Dari (the training convention) → Iranian: short i→e, u→o (long iː/uː kept); final
     * ه → [e]; then Persian FINAL stress, so the neural output matches the sync g2p convention.
     */
    private static string ToIranian(string ipa, string word)
    {
        var s = SHORT_U.Replace(SHORT_I.Replace(ipa, "e"), "o");
        if (FINAL_HE.IsMatch(word)) s = FINAL_A.Replace(s, "e");
        var vs = VOWEL_G.Matches(s);
        if (vs.Count > 0)
        {
            var last = vs[^1].Index;
            s = s[..last] + "ˈ" + s[last..];
        }
        return s;
    }

    private sealed class Loaded : IFaVowelRestorer
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _enc;
        private readonly IOrtSession _dec;
        private readonly Seq2SeqMeta _meta;
        private readonly Dictionary<int, string> _i2t;

        internal Loaded(IOrtLike ort, IOrtSession enc, IOrtSession dec, Seq2SeqMeta meta)
        {
            _ort = ort;
            _enc = enc;
            _dec = dec;
            _meta = meta;
            _i2t = meta.Tgt.ToDictionary(kv => kv.Value, kv => kv.Key);
        }

        public async Task<string> Restore(string word)
        {
            var cps = Js.CodePoints(word);
            var ids = cps.Select(c => (long)_meta.Src.GetValueOrDefault(c, _meta.Unk)).ToArray();
            var T = ids.Length;
            if (T == 0) return "";
            var eo = (await _enc.Run(new Dictionary<string, OrtTensor>
            {
                ["tokens"] = _ort.Tensor("int64", ids, new[] { 1, T }),
            }).ConfigureAwait(false))["enc_o"];
            var mask = _ort.Tensor("bool", Enumerable.Repeat((byte)1, T).ToArray(), new[] { 1, T });
            var toks = await ContextRestorer.BeamDecode(_ort, _dec, eo, mask, _meta, 40).ConfigureAwait(false);
            return ToIranian(string.Concat(toks.Select(t => _i2t.GetValueOrDefault(t) ?? "")), word);
        }
    }

    /** Build the Persian OOV vowel restorer, or null if the model / the ONNX runtime is unavailable. */
    public static async Task<IFaVowelRestorer?> CreateFaVowelRestorer()
    {
        Seq2SeqMeta meta;
        byte[] encBytes, decBytes;
        try
        {
            meta = System.Text.Json.JsonSerializer.Deserialize<Seq2SeqMeta>(
                File.ReadAllText(DataPath.ResolveAllowMissing("languages/persian/fa-vowel-restorer.meta.json")), Jsonc.JsonOpts)!;
            encBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing("languages/persian/fa-vowel-restorer.enc.onnx"));
            decBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing("languages/persian/fa-vowel-restorer.dec.onnx"));
        }
        catch { return null; } // model or sidecar absent
        try
        {
            var ort = await Onnx.LoadOrt("Persian neural restoration").ConfigureAwait(false);
            var enc = await ort.CreateInferenceSession(encBytes).ConfigureAwait(false);
            var dec = await ort.CreateInferenceSession(decBytes).ConfigureAwait(false);
            return new Loaded(ort, enc, dec, meta);
        }
        catch { return null; } // onnxruntime-node absent or a session failed → sync fallback
    }
}
