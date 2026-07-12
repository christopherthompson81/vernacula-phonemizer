# vernacula-phonemizer

A **canonical-IPA** phonemizer — native and **espeak-independent**. One output mode:
consistent canonical IPA for speech synthesis / TTS training. No espeak parity mode,
no dual rendering, no legacy fallback.

Grew out of the native-language work in `espeak-ng-portable` (Hindi + English were
divested from espeak there), lifted into a clean project with no espeak base to
anchor it.

## Languages
- **Hindi (hi)** — Devanagari abugida, rule-derived from the Unicode chart + Hindi
  phonology (a self-describing JSONC definition + a generic abugida engine).
- **English (en)** — irregular, so a lexicon (CMUdict-derived) + a cleanroom n-gram
  OOV G2P + a POS perceptron for heteronyms. A manifest (`english.jsonc`) carries the
  small hand-authored facts; the big models are shipped data.

## Design
- **Canonical IPA is the only output.** Conventions: stress before the nucleus,
  GenAm flapping `t̬`, dark-l `ɫ`, aspiration `kʰ/pʰ/tʰ`, offglide superscripts `aᶦ/aᶷ`,
  weak vowel `ᵻ`. Hindi: dental `t̪`, breathy `ʰ`, retroflex series.
- **No espeak dependency.** Whatever the native paths don't cover perfectly stays on
  the native G2P — never a fallback to espeak.

## Usage
```ts
import { phonemize } from "vernacula-phonemizer";
phonemize("I read a book", "en"); // aᶦ ɹˈɛd ə bˈʊk
phonemize("भारत", "hi");          // bʱaːɾət̪
```
