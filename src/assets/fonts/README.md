# Embedded PDF fonts

`NotoSans-Regular.subset.ttf` and `NotoSans-Bold.subset.ttf` are the fonts `buildProtocolPdf`
embeds. They exist because the 14 standard PDF fonts are WinAnsi (Windows-1252) encoded and
pdf-lib's `drawText` **throws** — it does not substitute — on any character outside that
encoding. Of the nine Polish diacritics `ą ć ę ł ń ó ś ź ż`, only `ó` is in Windows-1252.

Source: [Noto Sans](https://github.com/googlefonts/noto-fonts) (unhinted TTF), SIL Open Font
License 1.1 — see `OFL.txt`.

Both are subset to the ranges the app can actually emit, which takes each file from ~393 KB to
~23 KB. They are `?inline`d as data URIs into the island chunk, so those bytes are downloaded by
the employee's phone; the full fonts would have cost ~800 KB.

Regenerate (requires `pip install fonttools`):

```sh
UNI="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2015,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039,U+203A,U+2044,U+20AC,U+2212"
for w in Regular Bold; do
  curl -sSLO "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSans/NotoSans-$w.ttf"
  pyftsubset "NotoSans-$w.ttf" --output-file="NotoSans-$w.subset.ttf" \
    --unicodes="$UNI" --layout-features='' --no-hinting --desubroutinize \
    --drop-tables+=GSUB,GPOS,GDEF,MVAR,STAT,FFTM --name-IDs='*' --recalc-bounds
done
```

The ranges cover ASCII, Latin-1 Supplement (`·` U+00B7), Latin Extended-A (every Polish
diacritic), the dashes and quotes the Polish copy uses (`—` U+2014, `„` U+201E), the euro sign
and the true minus. **Widen `UNI` before adding copy outside those ranges** — a character with no
glyph in the subset throws exactly like a standard font would, which is the whole trap this
guards against. `src/lib/media/protocol-pdf.test.ts` pins the full diacritic set.
