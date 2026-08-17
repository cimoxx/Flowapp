# Flow v2.40.0

## Champion / Challenger Forecast

Flow v2.40.0 vyberá forecast model pre každú kategóriu podľa reálnej historickej presnosti namiesto jedného pevného algoritmu pre všetky kategórie.

Model testuje viac kandidátov pomocou walk-forward validácie a challenger sa nasadí iba vtedy, keď preukázateľne prekoná pôvodný adaptívny baseline aspoň o 3 %.

Aktuálny forecast model:

`2.40.0-champion-challenger-v1`

## Nasadenie

1. Nahraj celý frontend na GitHub Pages.
2. Google Apps Script nemeníš – zostáva backend v2.38.8.
3. Po načítaní otvor **Ročný plán** a spusti **Vyhodnotiť históriu**.
4. Porovnaj nový Forecast WAPE / Budget WAPE / MAE s v2.39.0.

## Dôležité pravidlá

- žiadny future leakage,
- challenger musí zlepšiť validačné skóre minimálne o 3 %,
- maximálne 12 mesiacov budúcich pravidelných platieb,
- Forecast Archive je cloud-first,
- changelog je dostupný aj priamo v aplikácii cez ⓘ.

Podrobnosti sú v `V2.40.0-IMPLEMENTACIA.md` a `CHANGELOG.md`.
