/**
 * Decoder for `g2p-model.bin`, the binary English OOV G2P model. Ported from
 * src/languages/english/g2pModelBinary.ts, which holds the layout and the encoder.
 */
using System.Buffers.Binary;
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class G2pModelBinary
{
    private const uint Version = 1;

    /** Load `g2p-model.bin` from the module's data directory. */
    public static EnglishG2pModel Load(string moduleDir) =>
        Decode(File.ReadAllBytes(DataPath.Resolve(moduleDir + "/g2p-model.bin")));

    public static EnglishG2pModel Decode(byte[] bytes)
    {
        var r = new Reader(bytes);
        if (Encoding.ASCII.GetString(r.Take(4)) != "VG2P")
            throw new InvalidDataException("g2p-model.bin: not a VG2P file");
        var version = r.U32();
        if (version != Version)
            throw new InvalidDataException($"g2p-model.bin: version {version}, expected {Version}");
        var order = (int)r.U32();
        var alpha = r.F64();
        var evp = r.F64();
        var evpOrder = r.I32();
        _ = r.I32(); // minCount: a training parameter, carried for the round trip
        var chunks = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var l in r.Strings()) chunks[l] = r.Strings();
        var tokens = r.Strings();
        var n = (int)r.U32();
        var ctxOrder = r.Take(n).ToArray();
        var ctxTok = r.U16s(n * 4);
        var total = r.U32s(n);
        var rowStart = r.U32s(n + 1);
        var nnz = (int)rowStart[n];
        var cand = r.U16s(nnz);
        var count = r.U32s(nnz);
        r.Done();
        foreach (var t in cand)
            if (t >= tokens.Count) throw new InvalidDataException("g2p-model.bin: candidate token out of range");
        for (var i = 0; i < n; i++)
        {
            var o = ctxOrder[i];
            if (o > 4) throw new InvalidDataException("g2p-model.bin: context order out of range");
            for (var j = 0; j < 4; j++)
            {
                var t = ctxTok[i * 4 + j];
                if (j < 4 - o ? t != EnglishG2pModel.Pad : t >= tokens.Count)
                    throw new InvalidDataException("g2p-model.bin: context token out of range");
            }
        }
        return new EnglishG2pModel
        {
            Order = order, Alpha = alpha, Evp = evp, EvpOrder = evpOrder, GraphemeChunks = chunks, Tokens = tokens,
            CtxOrder = ctxOrder, CtxTok = ctxTok, Total = total, RowStart = rowStart, Cand = cand, Count = count,
        };
    }

    private sealed class Reader(byte[] buf)
    {
        private static readonly UTF8Encoding Utf8 = new(false, throwOnInvalidBytes: true);
        private int _at;

        public ReadOnlySpan<byte> Take(int n)
        {
            if (n < 0 || _at + n > buf.Length) throw new InvalidDataException("g2p-model.bin: truncated");
            var x = buf.AsSpan(_at, n);
            _at += n;
            return x;
        }

        public uint U32() => BinaryPrimitives.ReadUInt32LittleEndian(Take(4));
        public int I32() => BinaryPrimitives.ReadInt32LittleEndian(Take(4));
        public double F64() => BinaryPrimitives.ReadDoubleLittleEndian(Take(8));

        public uint[] U32s(int n)
        {
            var src = Take(checked(n * 4));
            var out_ = new uint[n];
            for (var i = 0; i < n; i++) out_[i] = BinaryPrimitives.ReadUInt32LittleEndian(src.Slice(i * 4, 4));
            return out_;
        }

        public ushort[] U16s(int n)
        {
            var src = Take(checked(n * 2));
            var out_ = new ushort[n];
            for (var i = 0; i < n; i++) out_[i] = BinaryPrimitives.ReadUInt16LittleEndian(src.Slice(i * 2, 2));
            return out_;
        }

        public List<string> Strings()
        {
            var n = (int)U32();
            var offsets = U32s(n + 1);
            var block = Take((int)offsets[n]);
            var out_ = new List<string>(n);
            for (var i = 0; i < n; i++)
                out_.Add(Utf8.GetString(block.Slice((int)offsets[i], (int)(offsets[i + 1] - offsets[i]))));
            return out_;
        }

        public void Done()
        {
            if (_at != buf.Length) throw new InvalidDataException("g2p-model.bin: trailing bytes");
        }
    }
}
