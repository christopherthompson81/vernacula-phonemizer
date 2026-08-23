// A startup guard for the one runtime setting that breaks this engine SILENTLY.
//
// ⚠ InvariantGlobalization=true (csproj property, runtimeconfig switch, or the
// DOTNET_SYSTEM_GLOBALIZATION_INVARIANT environment variable) turns string.Normalize into a NO-OP.
// It does not throw and it does not warn — it returns the string unchanged. Every NFC/NFD fold in
// the engine then quietly stops working: the nativiser cannot decompose ⟨ć⟩ to fold it, so a foreign
// letter reaches the g2p and comes out as a plausible native phoneme.
//
// It was the parity tool's own csproj that had it set, and the gate accordingly reported the ENGINE
// as broken — Quechua went from 2 failing rows to 20. A gate that can misreport the thing it
// measures is worse than no gate, so the condition is now checked once and fails loudly.
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Globalization
{
    private static bool checkedOnce;

    /// <summary>Throw unless Unicode normalization actually normalizes. Called once, before the first
    /// engine is built.</summary>
    public static void AssertNormalizationWorks()
    {
        if (checkedOnce) return;
        checkedOnce = true;
        // e + COMBINING ACUTE composes to a single code point under a working ICU; under invariant
        // globalization Normalize returns the two-character input untouched.
        if ("é".Normalize(NormalizationForm.FormC).Length != 1)
            throw new InvalidOperationException(
                "vernacula-phonemizer: Unicode normalization is disabled (InvariantGlobalization / " +
                "DOTNET_SYSTEM_GLOBALIZATION_INVARIANT). string.Normalize is a no-op in that mode, which " +
                "silently breaks every NFC/NFD fold in the engine and produces WRONG PHONEMES rather than " +
                "an error. Remove <InvariantGlobalization>true</InvariantGlobalization> from the host project.");
    }
}
