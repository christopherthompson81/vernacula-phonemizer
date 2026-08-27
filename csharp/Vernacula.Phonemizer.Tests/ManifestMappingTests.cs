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
    /// <summary>…and `medialRule` / `grouping`, which NAME THE SHARED ALGORITHM the manifest expects rather
    /// than parameterising it: their values are the literal strings "ohala-VCaCV" and "indian-lakh-crore".
    /// Ten Indic manifests carry them and NEITHER ENGINE READS EITHER — the TypeScript's `HindiDef` does not
    /// declare them and no code looks them up.
    ///
    /// ⚠ THIS IS THE `note` CASE, NOT THE tg `numbers.and` CASE, and the difference is what decides the fix.
    /// tg declared a VALUE — the connector "у" — that the compositor then re-typed as a literal, so wiring
    /// it up removed a real duplicate (#901). These two are LABELS: "indian-lakh-crore" is not something
    /// `indicNumberWords` could consume without inventing a dispatch it does not have, and making one up to
    /// satisfy a test would be worse than recording that the key documents rather than configures.</summary>
    private static readonly IReadOnlySet<string> DocumentationLeaves =
        new HashSet<string>(new[] { "note", "medialRule", "grouping" }, StringComparer.Ordinal);

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
    public void DanishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/danish", "danish.jsonc", Languages.Danish.Manifest.MANIFEST,
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
    public void TigrinyaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/tigrinya", "tigrinya.jsonc",
            typeof(Languages.Tigrinya.TigrinyaPhonemizer).GetField("DEF",
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
    public void PersianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/persian", "persian.jsonc", Languages.Persian.PersianPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention", "models");

    [Fact]
    public void TajikManifestIsFullyMapped() =>
        AssertFullyMapped("languages/tajik", "tajik.jsonc", Languages.Tajik.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void ThaiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/thai", "thai.jsonc", Languages.Thai.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void LaoManifestIsFullyMapped() =>
        AssertFullyMapped("languages/lao", "lao.jsonc", Languages.Lao.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void AwadhiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/awadhi", "awadhi.jsonc", Languages.Awadhi.AwadhiPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void BhojpuriManifestIsFullyMapped() =>
        AssertFullyMapped("languages/bhojpuri", "bhojpuri.jsonc", Languages.Bhojpuri.BhojpuriPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void ChhattisgarhiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/chhattisgarhi", "chhattisgarhi.jsonc", Languages.Chhattisgarhi.ChhattisgarhiPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void RangpuriManifestIsFullyMapped() =>
        AssertFullyMapped("languages/rangpuri", "rangpuri.jsonc", Languages.Rangpuri.RangpuriPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void MagahiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/magahi", "magahi.jsonc", Languages.Magahi.MagahiPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void MaithiliManifestIsFullyMapped() =>
        AssertFullyMapped("languages/maithili", "maithili.jsonc", Languages.Maithili.MaithiliPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void NepaliManifestIsFullyMapped() =>
        AssertFullyMapped("languages/nepali", "nepali.jsonc", Languages.Nepali.NepaliPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void MarathiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/marathi", "marathi.jsonc", Languages.Marathi.MarathiPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void MalayalamManifestIsFullyMapped() =>
        AssertFullyMapped("languages/malayalam", "malayalam.jsonc", Languages.Malayalam.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void KannadaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/kannada", "kannada.jsonc", Languages.Kannada.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void TeluguManifestIsFullyMapped() =>
        AssertFullyMapped("languages/telugu", "telugu.jsonc", Languages.Telugu.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void HausaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/hausa", "hausa.jsonc", Languages.Hausa.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void AzerbaijaniManifestIsFullyMapped() =>
        AssertFullyMapped("languages/azerbaijani", "azerbaijani.jsonc", Languages.Azerbaijani.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void TurkishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/turkish", "turkish.jsonc", Languages.Turkish.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void TamilManifestIsFullyMapped() =>
        AssertFullyMapped("languages/tamil", "tamil.jsonc", Languages.Tamil.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void SwahiliManifestIsFullyMapped() =>
        AssertFullyMapped("languages/swahili", "swahili.jsonc", Languages.Swahili.SwahiliPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void CantoneseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/cantonese", "cantonese.jsonc", Languages.Cantonese.CantonesePhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void MinNanManifestIsFullyMapped() =>
        AssertFullyMapped("languages/minnan", "minnan.jsonc", Languages.MinNan.MinNanPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void WuManifestIsFullyMapped() =>
        AssertFullyMapped("languages/wu", "wu.jsonc", Languages.Wu.WuPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void VietnameseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/vietnamese", "vietnamese.jsonc", Languages.Vietnamese.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void KoreanManifestIsFullyMapped() =>
        AssertFullyMapped("languages/korean", "korean.jsonc", Languages.Korean.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void JavaneseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/javanese", "javanese.jsonc", Languages.Javanese.JavanesePhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void ItalianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/italian", "italian.jsonc", Languages.Italian.ItalianPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void GujaratiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/gujarati", "gujarati.jsonc", Languages.Gujarati.GujaratiPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void PolishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/polish", "polish.jsonc", Languages.Polish.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    // ⚠ ADDED WITH THE es LIFT, WHICH IS WHY IT IS LATE: Spanish was one of the manifests this guard never
    // covered, and the lift added 21 keys to it — exactly the situation the guard exists for.
    // ⚠ ADDED WITH THE letterNames BATCH: Mandarin was another manifest this guard never covered, and the
    // batch added an UPPERCASE-keyed dictionary to it — exactly the shape that mangled English's ARPABET.
    [Fact]
    public void MandarinManifestIsFullyMapped() =>
        AssertFullyMapped("languages/mandarin", "cmn.jsonc", Languages.Mandarin.Manifest.MANIFEST,
            // ⚠ `resolve` and `phases` are PROSE, not configuration: an ordered description of the pipeline
            // and a done/deferred status list. Neither engine reads either, and the TypeScript's `CmnManifest`
            // does not declare them — the `note` case, not the tg `numbers.and` case. Listed as metadata
            // rather than given C# properties, which would model a field neither side has.
            "language", "name", "script", "provenance", "convention", "resolve", "phases");

    [Fact]
    public void SpanishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/spanish", "spanish.jsonc", Languages.Spanish.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void UkrainianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/ukrainian", "ukrainian.jsonc", Languages.Ukrainian.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void RomanianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/romanian", "romanian.jsonc", Languages.Romanian.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void DutchManifestIsFullyMapped() =>
        AssertFullyMapped("languages/dutch", "dutch.jsonc", Languages.Dutch.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void HungarianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/hungarian", "hungarian.jsonc", Languages.Hungarian.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void YorubaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/yoruba", "yoruba.jsonc", Languages.Yoruba.Manifest.MANIFEST,
            "language", "name", "script", "provenance");

    [Fact]
    public void BurmeseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/burmese", "burmese.jsonc", Languages.Burmese.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void IgboManifestIsFullyMapped() =>
        AssertFullyMapped("languages/igbo", "igbo.jsonc", Languages.Igbo.Manifest.MANIFEST,
            "language", "name", "script", "provenance");

    [Fact]
    public void LingalaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/lingala", "lingala.jsonc", Languages.Lingala.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void MalagasyManifestIsFullyMapped() =>
        AssertFullyMapped("languages/malagasy", "malagasy.jsonc", Languages.Malagasy.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void NorwegianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/norwegian", "norwegian.jsonc", Languages.Norwegian.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void OromoManifestIsFullyMapped() =>
        AssertFullyMapped("languages/oromo", "oromo.jsonc", Languages.Oromo.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void SomaliManifestIsFullyMapped() =>
        AssertFullyMapped("languages/somali", "somali.jsonc", Languages.Somali.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void SundaneseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/sundanese", "sundanese.jsonc", Languages.Sundanese.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void UzbekManifestIsFullyMapped() =>
        AssertFullyMapped("languages/uzbek", "uzbek.jsonc", Languages.Uzbek.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void PashtoManifestIsFullyMapped() =>
        AssertFullyMapped("languages/pashto", "pashto.jsonc", Languages.Pashto.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void NaijaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/naija", "naija.jsonc", Languages.Naija.Manifest.MANIFEST,
            "language", "name", "script", "provenance");

    [Fact]
    public void ZuluManifestIsFullyMapped() =>
        AssertFullyMapped("languages/zulu", "zulu.jsonc", Languages.Zulu.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void TibetanManifestIsFullyMapped() =>
        AssertFullyMapped("languages/tibetan", "tibetan.jsonc", Languages.Tibetan.Manifest.MANIFEST,
            "language", "name", "script");

    [Fact]
    public void AncientGreekManifestIsFullyMapped() =>
        AssertFullyMapped("languages/ancientgreek", "ancientgreek.jsonc", Languages.AncientGreek.Manifest.MANIFEST);

    [Fact]
    public void SepediManifestIsFullyMapped() =>
        AssertFullyMapped("languages/sepedi", "sepedi.jsonc", Languages.Sepedi.Manifest.MANIFEST,
            "provenance");

    [Fact]
    public void BambaraManifestIsFullyMapped() =>
        AssertFullyMapped("languages/bambara", "bambara.jsonc", Languages.Bambara.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void BavarianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/bavarian", "bavarian.jsonc", Languages.Bavarian.Manifest.MANIFEST);

    [Fact]
    public void AkanManifestIsFullyMapped() =>
        AssertFullyMapped("languages/akan", "akan.jsonc", Languages.Akan.Manifest.MANIFEST,
            "language", "name", "script", "provenance");

    [Fact]
    public void XhosaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/xhosa", "xhosa.jsonc", Languages.Xhosa.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void SindhiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/sindhi", "sindhi.jsonc", Languages.Sindhi.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void TagalogManifestIsFullyMapped() =>
        AssertFullyMapped("languages/tagalog", "tagalog.jsonc", Languages.Tagalog.Manifest.MANIFEST,
            "language", "name", "script", "provenance");

    [Fact]
    public void CentralKurdishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/central-kurdish", "central-kurdish.jsonc", Languages.CentralKurdish.Manifest.DEF,
            "language", "name", "script", "provenance");

    [Fact]
    public void FulaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/fula", "fula.jsonc", Languages.Fula.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    // ── MODEL SIDECARS ────────────────────────────────────────────────────────────────────────────────────
    //
    // ⚠ THE SAME SILENT FAILURE, ONE DIRECTORY OVER. A `*.meta.json` beside an ONNX model is deserialized by
    // the SAME options as a manifest, so the same camelCase mangling applies — and no manifest test covered
    // them. Persian's two seq2seq sidecars key the hidden size as capital `H`, the policy renamed the property
    // to "h", it bound to 0, and ONNX rejected a zero-width hidden state the first time the CLASSICAL context
    // model ran. The parity gate could not see it: the fa golden runs the TAGGER, whose sidecar has no such
    // key, so the crash lived entirely off-golden and was found by an off-golden probe against Node.
    //
    // `Seq2SeqMeta.H` now states its JSON name explicitly. The theory below is the general guard: EVERY model
    // sidecar in the data tree is checked for a top-level key the policy would rename, and a new one fails
    // unless it is listed here as deliberately annotated.
    private static readonly IReadOnlySet<string> AnnotatedSidecarKeys =
        new HashSet<string>(new[] { "H" }, StringComparer.Ordinal); // Seq2SeqMeta.H carries [JsonPropertyName("H")]

    /// <summary>System.Text.Json's camelCase policy: lowercase the leading uppercase run, keeping the last of
    /// it when a lowercase follows (so `H`→`h`, `IPA`→`ipa`, `ARPAbet`→`arpAbet`).</summary>
    private static string CamelCase(string k) => JsonNamingPolicy.CamelCase.ConvertName(k);

    public static TheoryData<string> ModelSidecars()
    {
        var data = new TheoryData<string>();
        foreach (var f in Directory.EnumerateFiles(DataPath.Root(), "*.meta.json", SearchOption.AllDirectories).Order(StringComparer.Ordinal))
            data.Add(Path.GetRelativePath(DataPath.Root(), f));
        return data;
    }

    [Theory]
    [MemberData(nameof(ModelSidecars))]
    public void ModelSidecarKeysSurviveTheNamingPolicy(string relative)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(DataPath.Root(), relative)));
        var mangled = doc.RootElement.EnumerateObject()
            .Select(p => p.Name)
            .Where(k => CamelCase(k) != k && !AnnotatedSidecarKeys.Contains(k))
            .ToList();
        Assert.True(mangled.Count == 0,
            $"{relative}: key(s) the camelCase policy renames, with no [JsonPropertyName] to claim them: {string.Join(", ", mangled)}");
    }

    /// <summary>The concrete half: Persian's two seq2seq sidecars really do bind their hidden size. A `H` of 0
    /// is what ONNX rejected, so this asserts the value the crash proved was missing.</summary>
    [Theory]
    [InlineData("fa-context-restorer")]
    [InlineData("fa-vowel-restorer")]
    public void PersianSeq2SeqSidecarBindsHiddenSize(string basename)
    {
        var meta = JsonSerializer.Deserialize<Languages.Persian.Seq2SeqMeta>(
            File.ReadAllText(DataPath.Resolve($"languages/persian/{basename}.meta.json")), Opts)!;
        Assert.Equal(256, meta.H);
        Assert.NotEmpty(meta.Src);
        Assert.NotEmpty(meta.Tgt);
    }

    /// <summary>The Sindhi tagger sidecar really does bind all three of its tables. `src`/`tags`/`charTags`
    /// are plain camelCase, so the policy leaves them alone — this pins that rather than assuming it.</summary>
    [Fact]
    public void SindhiTaggerSidecarBindsItsTables()
    {
        var meta = JsonSerializer.Deserialize<Core.TaggerMeta>(
            File.ReadAllText(DataPath.Resolve("languages/sindhi/sd-g2p-tagger.meta.json")), Opts)!;
        Assert.Equal(51, meta.Src.Count);
        Assert.Equal(168, meta.Tags.Count);
        Assert.NotEmpty(meta.CharTags);
    }

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

    // hak carries two blocks no other Han-dict manifest has — `pfsOnsets` and `pfsTones`, whose KEYS are
    // bare combining marks and the empty string. Checked structurally for the reason the file gives.
    [Fact]
    public void XiangManifestIsFullyMapped() =>
        AssertFullyMapped("languages/xiang", "xiang.jsonc",
            Core.LoadManifest.Load<Core.HanDictDef>("languages/xiang", "xiang.jsonc"),
            "language", "name", "script");

    [Fact]
    public void HakkaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/hakka", "hakka.jsonc", Languages.Hakka.HakkaPhonemizer.DEF,
            "language", "name", "script");

    [Fact]
    public void KhmerManifestIsFullyMapped() =>
        AssertFullyMapped("languages/khmer", "khmer.jsonc", Languages.Khmer.KhmerPhonemizer.DEF,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void SinhalaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/sinhala", "sinhala.jsonc", Languages.Sinhala.Manifest.MANIFEST,
            "language", "name", "script");

    [Fact]
    public void ZhuangManifestIsFullyMapped() =>
        AssertFullyMapped("languages/zhuang", "zhuang.jsonc", Languages.Zhuang.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void ChichewaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/chichewa", "chichewa.jsonc", Languages.Chichewa.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void KinyarwandaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/kinyarwanda", "kinyarwanda.jsonc", Languages.Kinyarwanda.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void KazakhManifestIsFullyMapped() =>
        AssertFullyMapped("languages/kazakh", "kazakh.jsonc", Languages.Kazakh.Manifest.MANIFEST,
            "language", "name", "script", "convention");

    [Fact]
    public void MadureseManifestIsFullyMapped() =>
        AssertFullyMapped("languages/madurese", "madurese.jsonc", Languages.Madurese.Manifest.MANIFEST,
            "provenance");

    [Fact]
    public void ShonaManifestIsFullyMapped() =>
        AssertFullyMapped("languages/shona", "shona.jsonc", Languages.Shona.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void SylhetiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/sylheti", "sylheti.jsonc", Languages.Sylheti.SylhetiPhonemizer.DEF,
            "name", "script", "provenance");

    [Fact]
    public void UyghurManifestIsFullyMapped() =>
        AssertFullyMapped("languages/uyghur", "uyghur.jsonc", Languages.Uyghur.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void CatalanManifestIsFullyMapped() =>
        AssertFullyMapped("languages/catalan", "catalan.jsonc", Languages.Catalan.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void CzechManifestIsFullyMapped() =>
        AssertFullyMapped("languages/czech", "czech.jsonc", Languages.Czech.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void HebrewManifestIsFullyMapped() =>
        AssertFullyMapped("languages/hebrew", "hebrew.jsonc", Languages.Hebrew.Manifest.MANIFEST,
            "provenance", "convention");

    [Fact]
    public void KurmanjiManifestIsFullyMapped() =>
        AssertFullyMapped("languages/kurmanji", "kurmanji.jsonc", Languages.Kurmanji.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    /** ⚠ Croatian's `numbers` DESERIALIZES INTO SERBIAN'S TYPE — the shape is shared and only the words
     *  differ, so this sweep is also what proves the reuse still covers every Croatian key. */
    [Fact]
    public void CroatianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/croatian", "croatian.jsonc", Languages.Croatian.Manifest.MANIFEST,
            "language", "name", "script");

    [Fact]
    public void BosnianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/bosnian", "bosnian.jsonc", Languages.Bosnian.Manifest.MANIFEST,
            "language", "name", "script");

    [Fact]
    public void SlovenianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/slovenian", "slovenian.jsonc", Languages.Slovenian.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    [Fact]
    public void SerbianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/serbian", "serbian.jsonc", Languages.Serbian.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention");

    // ⚠ "vowelChars" IS LISTED AS METADATA, and this test is what forced the question. It was declared in
    // both manifest interfaces and read by NEITHER engine — sv's stress ordinal comes from the NST lexicon
    // and the OOV fallback works on the orthography, so no pass needs an IPA nucleus set (de does, and reads
    // its own copy). The key stays in the JSONC as a language fact, marked documentation there; declaring it
    // here is what keeps the guard honest rather than vacuous.
    [Fact]
    public void SwedishManifestIsFullyMapped() =>
        AssertFullyMapped("languages/swedish", "swedish.jsonc", Languages.Swedish.Manifest.MANIFEST,
            "language", "name", "script", "provenance", "convention", "vowelChars");

    [Fact]
    public void ArmenianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/armenian", "armenian.jsonc", Languages.Armenian.Manifest.MANIFEST,
            "language", "name", "script", "provenance");

    // haitian.jsonc is read by TWO independent types, mirroring the TypeScript's module split: the engine's
    // `HaitianDef` (which does not declare `numbers`, so numbers.ts can load the file without an import
    // cycle) and `HaitianNumbersDef`. Each is checked against the whole file with the other's keys listed
    // as metadata, so a key claimed by NEITHER still fails.
    [Fact]
    public void HaitianManifestIsFullyMapped() =>
        AssertFullyMapped("languages/haitian", "haitian.jsonc", Languages.Haitian.Manifest.MANIFEST,
            "language", "name", "script", "numbers");

    [Fact]
    public void HaitianNumbersManifestIsFullyMapped() =>
        AssertFullyMapped("languages/haitian", "haitian.jsonc",
            new { numbers = Languages.Haitian.Numbers.N },
            "language", "name", "script", "digraphs", "hiatusVowels", "graphemes", "clausePunctuation",
            "ordinalTails");
}
