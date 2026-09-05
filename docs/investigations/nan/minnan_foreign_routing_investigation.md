# Min Nan: telling a POJ word from a foreign name (#1048)

`createMinnan` takes a `foreign` reader, stores it, and never calls it. `NATIVE_CLASS` begins `[A-Za-z…]`,
so every Latin run counts as native and goes to `tailoToIpa`. A foreign name is therefore read out as Min Nan
syllables **with a tone letter**. This log is the measurement that decided the fix.

## Run 1 — 2026-08-26 10:40 — what a character class cannot do

POJ **is** ASCII Latin. `pêng-hong` and `Washington` are the same script and the same alphabet, so no
character-class test can separate them. The discriminator has to be **phonotactic**.

The instrument was already in the tree: `data/languages/minnan/dict.tsv`, 63,561 entries, whose readings
decompose into **2,661 distinct Tâi-lô syllables → 970 distinct toneless skeletons**. A hyphen-part that is
not one of the 970 is not a Min Nan syllable. `Iran` fails on ⟨ran⟩ (Tâi-lô has no ⟨r⟩), `Islam` on ⟨is⟩,
`commune` on ⟨com⟩.

## Run 2 — 10:48 — the first classifier was wrong, and the corpus said so loudly

Scored on the golden's 3,349 Latin runs: 1,673 native / 1,676 foreign. The "foreign" list was topped by

```
128  chng-thâu     122  chi̍t      42  sî-chūn      33  chit-ê      27  chóng-kiōng
```

— all of which are **real Min Nan**. ⚠ **The corpus is POJ and the dict is Tâi-lô.** POJ writes ⟨ch⟩ where
Tâi-lô writes ⟨ts⟩, so I was scoring POJ spellings against `ts`-spelled keys. The engine folds with
`pojToTailo`; the classifier has to fold too.

## Run 3 — 10:52 — folding in the wrong ORDER inverts 65 more

Folding first still misread `he̍k-chiá` and `Lō͘-sòa`. The reason is that the tone diacritic sits **between**
the letters the fold matches: `he̍k` is h + e + U+030D + k, so `/ek/` → `ik` never fires, and `sòa` carries a
precomposed ⟨ò⟩ so `/oa/` → `ua` never fires.

`syllableParts` already does it correctly — strip tone marks (NFD, drop `TONE_MARK`, recompose, lowercase)
**then** fold. ⚠ U+0358 ⟨o͘⟩ is a VOWEL, not a tone mark, and must survive the strip or `o͘`→`oo` never runs.
Matching the engine's order exactly moved 65 runs back to native and left a clean foreign list:

```
31 Iran   31 Islam   15 selo   12 Ukraina-gí   12 Ukraina   11 Lietuva   7 commune
5 Masovia   5 text    4 Khorasan   4 Šiauliai   3 Pomerania   3 Łódź   2 Washington
```

(`text`, `from`, `till`, `color` are EasyTimeline template debris that reached the corpus.)

## Run 4 — 11:05 — the mixed compound, and a rule that was tuned wrong

26 golden runs are MIXED — some parts native, some not — and splitting them naively was wrong for 20:

| shape | × | verdict |
|---|---|---|
| `Ukraina-gí`, `Bulgaria-gí`, `Lietuva-gí`, `Italia-bûn`, `chhaim-tēng` | 5 | **real compounds** — foreign stem + native morpheme; splitting is correct |
| `Fontaine-la-Soret`, `Traubach-le-Haut`, `Ferrières-la-Verrerie` … | 7 | French `la`/`le` — legal Tâi-lô skeletons BY ACCIDENT |
| `Kahriz-e`, `Gilan-e`, `Hoseynabad-e`, `Ji-ye` … | 13 | the Persian ezafe — same accident |

The discriminator is in the data and needed no invention: **all 5 real native morphemes carry a POJ tone
diacritic and not one of the 20 particles does.** A native syllable inside a foreign compound is a content
morpheme, and running POJ marks its tone. The mark test is applied ONLY to mixed runs, so an unmarked tone-1
native compound like `chit-e` is untouched.

⚠ **A wholly-native run is never split**, because tone sandhi applies word-internally — splitting would give
every syllable citation tone and silently delete the sandhi.

⚠ **Classification happens BEFORE `nat`.** The nativiser folds away exactly the letters that prove a run is
foreign (⟨Łódź⟩ → ⟨Lodz⟩), so testing downstream of it destroys the evidence. `foreign` also receives the
original text.

## Result

| measure | before | after |
|---|---|---|
| golden tokens that are a foreign word read as a Min Nan syllable (impossible letter **+** tone letter) | **796** | **0** |
| golden rows changed | — | 187 of 200 |
| ⚠ dict readings routed away from Min Nan (false positives), of 60,986 | — | **0** |

The false-positive bound is the number that matters: every one of the 60,986 distinct readings in
`dict.tsv`, fed through `text()`, still reads as Min Nan. ⚠ A naive "impossible letter" count is NOT the
right measure after the fix — it falls 796 → 307, but the 307 remaining are English readings
(*lˈɪt̬uːvə*, *kʰˈɑːmjuːn*) that legitimately contain those letters. The defect signature is an impossible
letter **carrying a tone letter**, and that is 0.

## Not fixed

`km` ×2 routes to the English reader rather than the unit table — a normalize-layer gap, not a routing one.
`chhaim` (in `chhaim-tēng`) is not a legal skeleton and is probably a corpus typo; it routes to English
while `tēng` stays Min Nan, which is the correct degradation for a mixed run.
