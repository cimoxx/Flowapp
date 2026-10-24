# Testy výpočtov

Automatické testy beží priamo nad skutočným kódom appky (`assets/js/*.js`) v izolovanom Node kontexte,
bez prehliadača a bez závislostí (iba vstavané `node:test`). Čas je zmrazený na 24. 10. 2026, takže
výsledky sú opakovateľné.

```bash
node --test "tests/unit/*.test.js"
```

Vyžaduje Node 22 alebo novší.

| Súbor | Čo kontroluje |
|---|---|
| `forecast-model.test.js` | všetci kandidáti odhadu sú na stabilných dátach presní, sezónnosť sa zachytí, nepozorovaný mesiac sa nepočíta ako nula (regresia v2.53) |
| `month-end.test.js` | odhad na koniec mesiaca podľa tempa, rezerva „koľko ešte môžem minúť“, rozpätie, plánované udalosti |
| `quick-picks.test.js` | pravidlá návrhov Často používané (30 dní, vylúčenia, radenie) |
| `champion-backtest.test.js` | porovnanie šampiónov s jednoduchým modelom |
| `escape.test.js` | escapovanie textu do HTML a inline handlerov |
| `cockpit-card.test.js` | karta „Koľko ešte môžem minúť?“: riadok „Z príjmu mesiaca ostáva“ a jeho rozpis, bez sekcie „Čo je dobré vedieť“ |
| `month-snapshots.test.js` | trvalé snímky porovnania odhad vs. skutočnosť: vytvoriť, refresh, nové zariadenie, nemennosť, výpadok siete, poškodený archív, časové zóny |
| `gas-snapshots.test.js` | Google Apps Script (`.gs`) so simulovaným Sheets: mesiac ako text, snímky, oprava archívu |

`harness.js` načíta skripty appky, `gas-harness.js` načíta Apps Script do simulovaného Google Sheets
(vrátane správania, ktoré mení text `2026-09` na dátum) a prepojí ho s appkou, `helpers.js` obsahuje syntetickú domácnosť
(kategórie, obvyklé sumy, šum a voliteľná sezónnosť).

## Ako testy rozšíriť
Pri zmene výpočtu najprv napíš test, ktorý zlyhá na starom správaní, a až potom zmenu. Overené mutáciami:
po vrátení opráv v2.53 testy `forecast-model` (stabilné dáta, nepozorovaný mesiac) zlyhajú, rovnako ako
test odhadu na koniec mesiaca po vrátení starého vzorca.

## Čo testy nepokrývajú
- Skutočné dáta z Google Sheets. Testy používajú syntetické dáta, takže dokazujú správnosť logiky, nie presnosť na tvojich číslach.
- Zobrazenie (DOM) a prihlásenie. Tie sa kontrolovali ručne a skriptami Playwright mimo repozitára.
