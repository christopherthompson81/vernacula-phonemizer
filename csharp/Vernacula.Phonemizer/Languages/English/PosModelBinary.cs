/**
 * Decoder for `pos-model.bin`, the binary POS model. Ported from src/languages/english/posModelBinary.ts,
 * which holds the layout and the encoder. It decodes to <see cref="PosModel"/>, the compressed rows the
 * tagger reads directly.
 */
using System.Buffers.Binary;
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class PosModelBinary
{
    private const uint Version = 1;

    /** Load `pos-model.bin` from the module's data directory. */
    public static PosModel Load(string moduleDir) =>
        Decode(File.ReadAllBytes(DataPath.Resolve(moduleDir + "/pos-model.bin")));

    public static PosModel Decode(byte[] bytes)
    {
        var r = new Reader(bytes);
        if (Encoding.ASCII.GetString(r.Bytes(4)) != "VPOS")
            throw new InvalidDataException("pos-model.bin: not a VPOS file");
        var version = r.U32();
        if (version != Version)
            throw new InvalidDataException($"pos-model.bin: version {version}, expected {Version}");
        var scale = r.I32();
        var classes = r.Strings();
        var tagKeys = r.Strings();
        var tagCls = r.Bytes(tagKeys.Count);
        var tagdict = new Dictionary<string, int>(tagKeys.Count);
        for (var i = 0; i < tagKeys.Count; i++) tagdict[tagKeys[i]] = tagCls[i];
        var features = r.Strings();
        var rowStart = new uint[features.Count + 1];
        for (var i = 0; i <= features.Count; i++) rowStart[i] = r.U32();
        var nnz = (int)rowStart[features.Count];
        var cls = r.Bytes(nnz);
        var weight = new int[nnz];
        for (var k = 0; k < nnz; k++) weight[k] = r.I32();
        var rows = new Dictionary<string, int>(features.Count);
        for (var i = 0; i < features.Count; i++)
            if (!rows.TryAdd(features[i], i)) throw new InvalidDataException("pos-model.bin: repeated feature");
        r.Done();
        return new PosModel
        {
            Scale = scale, Classes = classes, Tagdict = tagdict,
            Rows = rows, RowStart = rowStart, Cls = cls, Weight = weight,
        };
    }

    private sealed class Reader(byte[] buf)
    {
        private static readonly UTF8Encoding Utf8 = new(false, throwOnInvalidBytes: true);
        private int _at;

        private void Need(int n)
        {
            if (n < 0 || _at + n > buf.Length) throw new InvalidDataException("pos-model.bin: truncated");
        }

        public uint U32()
        {
            Need(4);
            var x = BinaryPrimitives.ReadUInt32LittleEndian(buf.AsSpan(_at, 4));
            _at += 4;
            return x;
        }

        public int I32()
        {
            Need(4);
            var x = BinaryPrimitives.ReadInt32LittleEndian(buf.AsSpan(_at, 4));
            _at += 4;
            return x;
        }

        public byte[] Bytes(int n)
        {
            Need(n);
            var x = buf.AsSpan(_at, n).ToArray();
            _at += n;
            return x;
        }

        public List<string> Strings()
        {
            var n = (int)U32();
            var offsets = new uint[n + 1];
            for (var i = 0; i <= n; i++) offsets[i] = U32();
            Need((int)offsets[n]);
            var at = _at;
            var out_ = new List<string>(n);
            for (var i = 0; i < n; i++)
                out_.Add(Utf8.GetString(buf, at + (int)offsets[i], (int)(offsets[i + 1] - offsets[i])));
            _at += (int)offsets[n];
            return out_;
        }

        public void Done()
        {
            if (_at != buf.Length) throw new InvalidDataException("pos-model.bin: trailing bytes");
        }
    }
}
