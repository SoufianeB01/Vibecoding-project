# Cijferboek

Simpele webapp voor een docent om cijfers bij te houden zonder Excel-rommel.

## Openen

Open `index.html` in de browser (dubbelklik, of live server in Cursor/VS Code).

Voor Excel-import en -export is internet nodig (SheetJS via CDN).

## Wat erin zit

- Vier klassen, klasgemiddelde en wie extra aandacht nodig heeft
- Toets / praktijk / presentatie met weging **50 : 30 : 20** (aanpasbaar)
- Eindcijfer via formule (standaard gewogen gemiddelde, zelf te wijzigen)
- Voldoende vanaf **5,45** (groen / rood)
- Herkansingen: per onderdeel telt het **hoogste** cijfer
- Docentenscherm vs studentenscherm (alleen eigen cijfer via code)
- Dev mode: testdata laden via Instellingen
- Excel importeren en exporteren (`.xlsx` / `.csv`)

## Excel-kolommen

`Klas`, `Code`, `Naam`, `Toets`, `Toets herkansing`, `Praktijk`, `Praktijk herkansing`, `Presentatie`, `Presentatie herkansing`

Bij import worden studenten gematcht op code of naam binnen de klas.
