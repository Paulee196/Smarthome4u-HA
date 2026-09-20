# Smarthome4u

Jednoduché rozhraní pro Home Assistant. Po spuštění se přehled vaší domácnosti
vytvoří sám z místností a zařízení, která už v Home Assistantu máte.

Nic se nenastavuje. Nic se nepřepisuje.

## Co aplikace dělá

- Načte vaše patra, místnosti a zařízení z Home Assistantu.
- Seskupí je podle místností.
- Umožní zapínat a vypínat světla a zásuvky.
- Zobrazí hodnoty senzorů a stavy dveří, oken nebo čidel pohybu.
- Reaguje okamžitě, když někdo přepne vypínač na zdi.

## Co aplikace nedělá

Home Assistant zůstává jádrem vaší domácnosti. Smarthome4u je jen rozhraní nad
ním.

- Nespouští vaše automatizace. Ty běží v Home Assistantu.
- Nemění vaši konfiguraci.
- Když aplikaci vypnete nebo odinstalujete, domácnost funguje dál.

## Spuštění

1. Dejte **Instalovat**. První instalace trvá několik minut, protože se
   aplikace sestavuje přímo ve vašem Home Assistantu.
2. Zapněte přepínač **Zobrazit v postranním panelu**.
3. Dejte **Spustit**.
4. Otevřete Smarthome4u v levém menu.

Žádné heslo ani token nezadáváte. Jste už přihlášení přes Home Assistant.

## Nastavení

Aplikace nemá žádné volby. To je záměr.

## Když něco nefunguje

**Stránka hlásí "Bez spojení"**
Home Assistant se právě restartuje nebo ještě nenaběhl. Aplikace se připojí
sama, stačí počkat. Vaše domácnost mezitím funguje normálně.

**Nevidím některá zařízení**
Verze 0.1 zobrazuje světla, zásuvky, senzory a binární senzory. Žaluzie,
termostaty a zámky přibudou ve verzi 1.0.

**Zařízení nemá místnost**
Objeví se v sekci **Nezařazeno**. Místnost mu přiřadíte v Home Assistantu
v **Nastavení → Zařízení a služby**.

**Aplikace se nespustí**
Otevřete záložku **Log** a podívejte se na poslední řádky. Chybová hláška
je česky a říká, co se nepovedlo.

## Podporované prostředí

Home Assistant OS na architektuře amd64 nebo aarch64. Typicky Home Assistant
Green, Raspberry Pi 4 a 5, mini PC nebo virtuální stroj.

Otestováno proti Home Assistantu 2026.8 a 2026.9.

## Verze

Toto je verze 0.1 - technický základ, ne hotový produkt. Slouží k ověření, že
architektura funguje na reálné instalaci.
