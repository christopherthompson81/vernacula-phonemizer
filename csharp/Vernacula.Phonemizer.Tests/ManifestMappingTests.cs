// Does the C# type actually CONSUME every key its manifest declares?
//
// ⚠ THE FAILURE THIS EXISTS FOR IS SILENT AND TYPED. System.Text.Json ignores a JSON member no property
// matches, so a name the loader's camelCase policy mangles deserializes to the type's DEFAULT — "" for a
// string — and the engine emits nothing where that value belonged. English's ARPABET block is keyed by
// ALL-CAPS phone names (`AH`, `ER`, `IY`, `UW`), none of which survive the policy: `virgin` read *vd͡ʒɪn*
// and `branson` *bɹˈænsn*, the nucleus simply gone. Nothing threw, the ONNX tagger and its mask were
// byte-identical to Node's, and the only visible symptom was 42 golden rows.
//
// So every ported manifest is checked STRUCTURALLY: serialize the loaded object back with the same options
// and diff the key sets against the source file. A key present in the file and absent from the round-trip
// is a key no property claimed.
using System.Text.Json;
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ManifestMappingTests
{
    // IncludeFields mirrors the loader (Jsonc.JsonOpts): a field-based data class must round-trip its fields
    // or this guard reports them as unmapped when they are in fact consumed.
    private static readonly JsonSerializerOptions Opts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, IncludeFields = true };

    private static void CollectUnmapped(JsonElement source, JsonElement round, string path, List<string> missing)
    {
        if (source.ValueKind == JsonValueKind.Object)
        {
            if (round.ValueKind != JsonValueKind.Object) { missing.Add(path); return; }
            foreach (var prop in source.EnumerateObject())
            {
                if (!round.TryGetProperty(prop.Name, out var mirror)) { missing.Add($"{path}.{prop.Name}"); continue; }
                CollectUnmapped(prop.Value, mirror, $"{path}.{prop.Name}", missing);
            }
            return;
        }
        if (source.ValueKind == JsonValueKind.Array)
        {
            if (round.ValueKind != JsonValueKind.Array || round.GetArrayLength() != source.GetArrayLength())
            {
                missing.Add($"{path}[]");
                return;
            }
            var i = 0;
            foreach (var item in source.EnumerateArray())
            {
                CollectUnmapped(item, round[i], $"{path}[{i}]", missing);
                i++;
            }
        }
    }

    /// <summary>Leaf key names that are DOCUMENTATION anywhere they appear, not data. `note` annotates each
    /// abugida consonant/vowel row with its phonological class and any referee decision; the TypeScript
    /// interface declares the row as `{ ipa: string }` and never reads it either, so a C# property for it
    /// would model a field neither engine has. Matched by leaf NAME at any depth, unlike `metadataOnly`
    /// which is top-level only.</summary>
    private static readonly IReadOnlySet<string> DocumentationLeaves =
        new HashSet<string>(new[] { "note" }, StringComparer.Ordinal);

    /// <param name="metadataOnly">Top-level keys the TYPESCRIPT interface does not declare either —
    /// provenance prose, the convention note, the `models` file list the loader resolves by path. Listed
    /// explicitly so a NEW unclaimed key still fails; an empty default would make the guard vacuous.</param>
    private static void AssertFullyMapped<T>(string dir, string file, T loaded, params string[] metadataOnly)
    {
        using var source = JsonDocument.Parse(Jsonc.StripJsonc(File.ReadAllText(DataPath.Resolve($"{dir}/{file}"))));
        using var round = JsonDocument.Parse(JsonSerializer.Serialize(loaded, Opts));
        var missing = new List<string>();
        CollectUnmapped(source.RootElement, round.RootElement, file, missing);
        missing.RemoveAll(k => metadataOnly.Contains(k[(file.Length + 1)..])
                            || DocumentationLeaves.Contains(k[(k.LastIndexOf('.') + 1)..]));
        Assert.True(missing.Count == 0, $"manifest keys no C# property consumed:\n  {string.Join("\n  ", missing)}");
    }

    [Fact]
    public void EnglishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/english", "english.jsonc", Languages.English.Manifest.MANIFEST,
            "language", "script", "name", "provenance", "convention", "models", "resolve");

    [Fact]
    public void AfrikaansManifestIsFullyMapped() =>
        AssertFullyMapped("languages/afrikaans", "afrikaans.jsonc", Languages.Afrikaans.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void GreekManifestIsFullyMapped() =>
        AssertFullyMapped("languages/greek", "greek.jsonc", Languages.Greek.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void RussianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/russian", "russian.jsonc", Languages.Russian.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void AmharicManifestIsFullyMapped() =>
        AssertFullyMapped("languages/amharic", "amharic.jsonc",
            typeof(Languages.Amharic.AmharicPhonemizer).GetField("DEF",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!.GetValue(null)!,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void QuechuaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/quechua", "quechua.jsonc", Languages.Quechua.Manifest.MANIFEST);

    [Fact]
    public void PunjabiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/punjabi", "punjabi.jsonc", Languages.Punjabi.PunjabiPhonemizer.LoadPunjabiManifest(),
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void ShahmukhiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/punjabi", "shahmukhi.jsonc", Languages.Punjabi.Shahmukhi.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void IndonesianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/indonesian", "indonesian.jsonc", Languages.Indonesian.IndonesianPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void UrduManifestIsFullyMapped() =>
        AssertFullyMapped("languages/urdu", "urdu.jsonc", Languages.Urdu.G2p.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void GermanManifestIsFullyMapped() =>
        AssertFullyMapped("languages/german", "german.jsonc", Languages.German.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention", "dataFiles");

    [Fact]
    public void JapaneseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/japanese", "japanese.jsonc", Languages.Japanese.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention", "dataFiles");

    [Fact]
    public void FrenchManifestIsFullyMapped() =>
        AssertFullyMapped("languages/french", "french.jsonc", Languages.French.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void BengaliManifestIsFullyMapped() =>
        AssertFullyMapped("languages/bengali", "bengali.jsonc",
            Core.LoadManifest.Load<Languages.Bengali.BengaliDef>("languages/bengali", "bengali.jsonc"),
            "language", "name", "script", "provenance", "convention");

    // Assamese reuses the Bengali engine and its def type; its manifest carries the divergence fields
    // (heightHarmony / medialSchwaDeletion / skipLexicon / unitWords) that bengali.jsonc leaves unset.
    [Fact]
    public void AssameseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/assamese", "assamese.jsonc",
            Core.LoadManifest.Load<Languages.Bengali.BengaliDef>("languages/assamese", "assamese.jsonc"),
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void PortugueseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/portuguese", "portuguese.jsonc", Languages.Portuguese.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void ArabicManifestIsFullyMapped() =>
        AssertFullyMapped("languages/arabic", "arabic.jsonc", Languages.Arabic.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    // The nine variety defs share one shape; egyptian is the richest instance (articleVowel + full
    // per-variety numbers with the FUSED hundreds), so it exercises every optional field.
    [Fact]
    public void ArabicEgyptianVarietyIsFullyMapped() =>
        AssertFullyMapped("languages/arabic", "egyptian.jsonc",
            Core.LoadManifest.Load<Languages.Arabic.Arabic.VarietyDef>("languages/arabic", "egyptian.jsonc"));
}
