# Co si bereme z Tessery

Tessera je editor pro fyzické dotykové displeje ESP32 připojené k Home
Assistantu. Smarthome4u je webový panel v Home Assistantu. Převzít chceme
způsob práce s plochou, nikoli zdrojový kód, vzhledové assety ani architekturu
firmwaru. Implementace v tomto repozitáři je samostatná.

Prostudované primární zdroje:

- [Editor](https://tessera-maxgramser.on-forge.com/docs/editor)
- [Stránky a mřížka](https://tessera-maxgramser.on-forge.com/docs/pages)
- [Dlaždice](https://tessera-maxgramser.on-forge.com/docs/tiles)
- [Zdrojový projekt a licence](https://github.com/MaxGramser/homeassistant_espscreen)

## Principy pro Smarthome4u

1. Editor ukazuje skutečný vzhled dlaždic. Úchyt pro přesun a tlačítka změny
   jsou přímo na nich. Ovládání zařízení je během editace vypnuté.
2. Zařízení se hledá podle názvu, typu a místnosti. Z knihovny ho lze přidat
   klepnutím a na desktopu přetáhnout do mřížky. Na dotykovém zařízení
   funguje klepnutí.
3. Velikost mění obsah. Velká dlaždice ukazuje ovládání zařízení a kamera
   větší náhled, pokud ho Home Assistant poskytuje.
4. Chytrá domácnost je rychlá mřížka s filtrem typu a hledáním. Domov je
   složený z upravitelných skupin místností. Přehled HA staví na samostatných
   metrikách a upozorněních. Půdorys používá body na nahraném plánku.
5. Uložené plochy zůstávají oddělené podle podoby dashboardu a účtu. Stav
   zařízení stále vlastní Home Assistant.

## Další práce

- Doplnit plnohodnotný editor automatického plánku místností bez nahraného
  obrázku. Pojmenování místností zůstává v evidenci Home Assistantu.
- Ověřit nové ovládání v živé instalaci HA na telefonu a dotykovém panelu.
- Rozšířit editor o vrácení kroku a možnost rozpracované změny potvrdit
  najednou. Současný editor ukládá po jednotlivých změnách.
