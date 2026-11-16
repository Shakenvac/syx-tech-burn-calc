# Syx Tech Burn Calculator

An unofficial calculator for **Songs of Syx**. It answers one question for each of the game's three tech rooms: is it worth feeding them a resource, or should those workers just staff the rooms?

| Tab | Burns | In | For |
|---|---|---|---|
| Clay → Labs | Clay from claypits | Laboratories | Innovation (×2 while stocked) |
| Leather → Libraries | Leather from hunters or auroch pens | Libraries | Knowledge (×2 while stocked) |
| Paper → Admin | Paper from paper workshops, fed by woodcutters | Administration | Admin (×3 while stocked) |

Set your workforce, research, race bonuses, nobles and logistics, and the calculator finds the best split of workers. It also shows what more research would buy, with a rough verdict on whether it's worth the cost.

**Use it:** open `index.html` in any browser, or visit the GitHub Pages site for this repository.

## How it works

All rates, bonuses, tech costs, caps and experience curves come from the game's own data and source files (game version 0.71.90). Each tab has a "How the numbers are worked out" section that lists the formulas and what isn't modelled.

## Building

The page is a single self-contained HTML file. To rebuild it after editing the sources:

```bash
python src/build.py
```

This writes `index.html` (for GitHub Pages, with the page-view counter) and `clay-calculator.html` (without it) from:

- `src/clay-calculator.template.html`: page layout, styles and the Clay tab
- `src/burn-tabs.js`: the Leather and Paper tabs
- `src/icons.json`: game icons as data URIs
- `src/extract_icons.py`: how the icons were cut from the game's sprite sheets

## Page views

The public page (`index.html`) counts visits with [GoatCounter](https://www.goatcounter.com/), which uses no cookies and stores no personal data.

## Disclaimer

Unofficial fan tool, not affiliated with or endorsed by the developer. Game data and icons © the Songs of Syx developer.
