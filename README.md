# Flow v2.39.0

Osobná finančná PWA s evidenciou transakcií, ročným plánom, budgetom, pravidelnými platbami, forecastom, Burn Rate a analytikou.

## Aktuálna forecast verzia

`2.39.0-category-adaptive-v1`

Hlavnou zmenou v2.39.0 je kategóriovo adaptívny forecast. Flow automaticky rozlišuje stabilné, variabilné, riedko sezónne a nepravidelné výdavky a podľa toho volí spôsob predikcie.

## Nasadenie

Frontend nahraj celý na GitHub Pages. Google Apps Script sa pri prechode z v2.38.8 na v2.39.0 nemení.

Po nasadení odporúčame spustiť **Ročný plán → Vyhodnotiť históriu**, aby sa vytvoril nový walk-forward backtest pre model v2.39.0.

Podrobnosti sú v `V2.39.0-IMPLEMENTACIA.md` a `CHANGELOG.md`.
