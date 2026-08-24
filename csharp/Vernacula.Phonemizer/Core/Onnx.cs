/**
 * Shared ONNX plumbing for every neural path (the taggers, the seq2seq and context restorers, the rider and
 * Arabic diacritizers). ONE source for the Ort* interfaces and the loader.
 * Ported from src/core/onnx.ts — see that file for the rationale.
 *
 * C# PORT NOTE: Microsoft.ML.OnnxRuntime is a HARD reference here (it is already the vernacula stack's
 * runtime), so the TS "optional dependency" machinery reduces to: LoadOrt memoizes ONE IOrtLike per process,
 * and a native-library initialization failure clears the memo and throws a context-named error, which
 * consumers catch to fall back to the sync path — the same control flow the lazy dynamic import gives the TS.
 */
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace Vernacula.Phonemizer.Core;

/** An ORT input/output tensor. The TS `data` union (int64 ids, float32 logits/states, uint8 bool masks) is
 *  carried as a bare `Array`, narrowed by the AsX accessors — hence `Type`, which the union implied. */
public sealed class OrtTensor
{
    public OrtTensor(string type, Array data, int[] dims)
    {
        Type = type;
        Data = data;
        Dims = dims;
    }

    /** "int64" | "float32" | "uint8" | "bool" — the TS `new ort.Tensor(type, …)` strings, verbatim. */
    public string Type { get; }
    public Array Data { get; }
    public int[] Dims { get; }

    public float[] AsFloat32() => (float[])Data;
    public long[] AsInt64() => (long[])Data;
    public byte[] AsUint8() => (byte[])Data;
}

public interface IOrtSession
{
    Task<Dictionary<string, OrtTensor>> Run(IReadOnlyDictionary<string, OrtTensor> feeds);
}

public interface IOrtLike
{
    /** Either the model bytes or a path, with an optional execution-provider list (CPU default; the taggers
     *  opt into CUDA via an env var). Two overloads stand in for the TS union parameter. */
    Task<IOrtSession> CreateInferenceSession(byte[] model, IReadOnlyList<string>? executionProviders = null);

    Task<IOrtSession> CreateInferenceSession(string modelPath, IReadOnlyList<string>? executionProviders = null);

    OrtTensor Tensor(string type, Array data, int[] dims);
}

public static class Onnx
{
    private static Task<IOrtLike>? _ortTask;
    private static readonly object Gate = new();

    /**
     * Get the runtime, once per process. `context` names the caller in the error (e.g. "Arabic diacritization").
     * ⚠ THE FAILURE IS NOT MEMOIZED — the memo is cleared before throwing, so a later call retries and each
     * caller sees its own context, matching the TS, which caches the import promise only on success.
     */
    public static Task<IOrtLike> LoadOrt(string context = "Neural inference")
    {
        lock (Gate)
        {
            if (_ortTask is not null && !_ortTask.IsFaulted) return _ortTask;
            try
            {
                // OrtEnv instantiation is the point where a broken native install surfaces.
                _ = OrtEnv.Instance();
                return _ortTask = Task.FromResult<IOrtLike>(new OrtLikeImpl());
            }
            catch (Exception e)
            {
                _ortTask = null;
                throw new InvalidOperationException(
                    $"{context} needs the ONNX runtime (Microsoft.ML.OnnxRuntime), whose native library failed to load: {e.Message}", e);
            }
        }
    }

    private sealed class OrtLikeImpl : IOrtLike
    {
        private static SessionOptions BuildOptions(IReadOnlyList<string>? executionProviders)
        {
            var opts = new SessionOptions();
            if (executionProviders is null) return opts; // shipping default: CPU
            foreach (var ep in executionProviders)
            {
                switch (ep.Trim().ToLowerInvariant())
                {
                    case "cuda":
                    case "cudaexecutionprovider":
                        opts.AppendExecutionProvider_CUDA();
                        break;
                    case "cpu":
                    case "cpuexecutionprovider":
                        break; // CPU is always registered last by default
                    default:
                        // Mirror onnxruntime-node's behaviour of rejecting unknown provider names loudly.
                        throw new ArgumentException($"Onnx: unknown execution provider \"{ep}\"");
                }
            }
            return opts;
        }

        public Task<IOrtSession> CreateInferenceSession(byte[] model, IReadOnlyList<string>? executionProviders = null) =>
            Task.FromResult<IOrtSession>(new OrtSessionImpl(new InferenceSession(model, BuildOptions(executionProviders))));

        public Task<IOrtSession> CreateInferenceSession(string modelPath, IReadOnlyList<string>? executionProviders = null) =>
            Task.FromResult<IOrtSession>(new OrtSessionImpl(new InferenceSession(modelPath, BuildOptions(executionProviders))));

        public OrtTensor Tensor(string type, Array data, int[] dims) => new(type, data, dims);
    }

    private sealed class OrtSessionImpl : IOrtSession
    {
        private readonly InferenceSession _session;
        private readonly object _runGate = new();

        internal OrtSessionImpl(InferenceSession session) => _session = session;

        /** An ORT bool tensor: allocate with the element type declared, then copy the 0/1 bytes in. */
        private static OrtValue BoolTensor(byte[] data, long[] shape)
        {
            var v = OrtValue.CreateAllocatedTensorValue(OrtAllocator.DefaultInstance, TensorElementType.Bool, shape);
            data.AsSpan().CopyTo(v.GetTensorMutableDataAsSpan<byte>());
            return v;
        }

        public Task<Dictionary<string, OrtTensor>> Run(IReadOnlyDictionary<string, OrtTensor> feeds)
        {
            lock (_runGate)
            {
                var inputs = new Dictionary<string, OrtValue>();
                try
                {
                    foreach (var (name, t) in feeds)
                    {
                        var shape = t.Dims.Select(d => (long)d).ToArray();
                        inputs[name] = t.Type switch
                        {
                            "int64" => OrtValue.CreateTensorValueFromMemory((long[])t.Data, shape),
                            "float32" => OrtValue.CreateTensorValueFromMemory((float[])t.Data, shape),
                            "uint8" => OrtValue.CreateTensorValueFromMemory((byte[])t.Data, shape),
                            // ⚠ A BOOL TENSOR CANNOT BE BUILT FROM byte[] BY INFERENCE — CreateTensorValueFromMemory
                            // reads the element type off the array and hands ORT a uint8 tensor, which the graph
                            // rejects outright ("Actual: (tensor(uint8)), expected: (tensor(bool))"). The element type
                            // has to be stated. `new ort.Tensor("bool", Uint8Array)` in JS does state it; this is the
                            // one place the two APIs disagree about what a byte array means.
                            "bool" => BoolTensor((byte[])t.Data, shape),
                            _ => throw new ArgumentException($"Onnx: unsupported tensor type \"{t.Type}\""),
                        };
                    }
                    var outputNames = _session.OutputMetadata.Keys.ToList();
                    using var runOptions = new RunOptions();
                    using var results = _session.Run(runOptions, inputs, outputNames);
                    var outp = new Dictionary<string, OrtTensor>();
                    for (var i = 0; i < outputNames.Count; i++)
                    {
                        var v = results[i];
                        var info = v.GetTensorTypeAndShape();
                        var dims = info.Shape.Select(d => (int)d).ToArray();
                        outp[outputNames[i]] = info.ElementDataType switch
                        {
                            TensorElementType.Float => new OrtTensor("float32", v.GetTensorDataAsSpan<float>().ToArray(), dims),
                            TensorElementType.Int64 => new OrtTensor("int64", v.GetTensorDataAsSpan<long>().ToArray(), dims),
                            TensorElementType.UInt8 => new OrtTensor("uint8", v.GetTensorDataAsSpan<byte>().ToArray(), dims),
                            TensorElementType.Bool => new OrtTensor("bool", v.GetTensorDataAsSpan<byte>().ToArray(), dims),
                            var other => throw new NotSupportedException($"Onnx: unsupported output element type {other}"),
                        };
                    }
                    return Task.FromResult(outp);
                }
                finally
                {
                    foreach (var v in inputs.Values) v.Dispose();
                }
            }
        }
    }
}
