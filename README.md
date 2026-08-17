# Flow v2.41.0

## Meta Forecast + Income Intelligence

Flow v2.41.0 nadväzuje na Champion/Challenger forecast a pridáva dve hlavné zmeny:

1. **Meta výber výdavkového modelu podľa kategórie aj kalendárneho mesiaca.**
2. **Nový prediktívny model príjmov**, ktorý oddeľuje stabilné, variabilné a riedke zdroje a zabraňuje dvojitému započítaniu pravidelného príjmu.

Aktuálny forecast model:

`2.41.0-meta-income-v1`

## Prečo sa menil forecast príjmov

Doterajšia logika počítala príjem ako jednoduchý priemer posledných kladných uzavretých mesiacov. To malo tri zásadné nevýhody:

- ignorovalo nulové mesiace pri nepravidelných príjmoch,
- nepoznalo sezónnosť bonusov/predajov,
- historický príjem a pravidelný príjmový plán sa mohli započítať súčasne.

V2.41.0 modeluje príjem po zdrojoch/podkategóriách a explicitný pravidelný príjem má prednosť pred historickým odhadom rovnakého zdroja.

## Vyhodnotenie príjmov

Po spustení **Ročný plán → Vyhodnotiť históriu** sa v diagnostike zobrazia samostatne:

- Income WAPE,
- Income MAE,
- Income Bias,
- počet mesačných income backtestov.

Doterajší súbor scenárov obsahoval backtesty výdavkov, nie samostatné predikcie príjmov. V2.41.0 ich začne archivovať, takže ďalšie ladenie príjmov už bude možné robiť z reálnych meraní rovnako ako pri výdavkoch.

## Pravidelné príjmy

V tabe **Pravidelné** môže byť položka typu:

- Výdavok
- Príjem

Pri príjme je možné zvoliť napríklad `Prijem / Vyplata`. Známy pravidelný príjem sa používa priamo v ročnom pláne a historický model rovnakého zdroja sa už nepripočíta navyše.

Automaticky generované transakcie sú stále obmedzené na **maximálne 12 mesiacov dopredu**.

## Nasadenie

1. Nahraj celý frontend v2.41.0 na GitHub Pages.
2. Google Apps Script **nemeníš** – zostáva backend v2.38.8.
3. Po načítaní otvor **Ročný plán**.
4. Spusti **Vyhodnotiť históriu**.
5. V diagnostike skontroluj Forecast WAPE aj novú sekciu **Predikcia príjmov**.

## Model governance

- bez future leakage,
- mesačný modelový signál sa nepoužíva bez minimálnej historickej vzorky,
- mesačné skóre je shrinkované smerom ku kategóriovému skóre,
- explicitné plány majú prednosť pred odhadom,
- nové modely sa merajú cez walk-forward backtest,
- Forecast Archive zostáva cloud-first.

Podrobnosti sú v `V2.41.0-IMPLEMENTACIA.md` a `CHANGELOG.md`.
