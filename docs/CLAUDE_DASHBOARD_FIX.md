# Ukol pro Claude Code: dashboard, role a navaznost na Home Assistant

Tento ukol ma prednost pred dalsim ladeni vzhledu. Aktualni problem neni
kosmetika, ale produktova smlouva: Smarthome4u ma byt jednoducha nadstavba nad
Home Assistantem, kterou muze pouzivat laik, zatimco technik/spravce vse
nastavi. Upravene veci se nesmi rozpadnout pri prejmenovani v HA a pri vypnuti
Smarthome4u musi zustat dum pouzitelny v Home Assistantu.

## Co je ted spatne

1. Ulozene upravy dashboardu pouzivaji `entity_id`.
   - `home.py` sice posila `ref` z entity registry, ale `storage.py`,
     `api.py`, `blocks.js`, `favorites.js`, `view-home.js` a `view-floorplan.js`
     ukladaji oblibene, bloky, velikosti, prekryti a pudorys podle `entity_id`.
   - `entity_id` se v HA muze zmenit. Po prejmenovani entity se rozvrzeni,
     oblibene a body v pudorysu ztrati nebo zustanou viset na neexistujicim ID.

2. Role jsou prilis hrube.
   - Backend zna v praxi jen `admin` a `user`.
   - Frontendovy technicky rezim je jen docasny prepinac pro admina.
   - Produkt potrebuje trvale role navazane na HA user ID: `user`,
     `technician`, `admin`.

3. Bezni uzivatele si dashboard neupravi.
   - Endpointy `/dashboard`, `/layout`, `/favorites` a `/floorplan` jsou
     zamcene pres `@admin`.
   - To odporuje cili, ze zakaznik muze jednoduse upravit svoji plochu, ale
     nesmi rozbit zarizeni, integrace nebo automatizace.

4. Navaznost na klasicke HA UI neni definovana.
   - Zarizeni, mistnosti, sceny a automatizace vznikaji jako nativni HA objekty,
     to je spravne.
   - Smarthome4u dashboard je ale vlastni panel a HA Lovelace ho automaticky
     neprecte. Pokud ma byt v HA pripraveny i dashboard, musi existovat jasna
     jednosmerna synchronizace/export do HA dashboardu, nebo musi byt zadani
     upraveno tak, ze "v HA pripraveno" znamena nativni objekty a panel
     Smarthome4u zustava samostatna UI vrstva.

## Cil opravy

Po teto oprave musi platit:

- Upravim oblibene, poradi, velikost dlazdice, blok nebo pudorys ve
  Smarthome4u.
- V Home Assistantu prejmenuji entitu tak, ze se zmeni `entity_id`.
- Po refreshi Smarthome4u zustanou upravy navazane na stejnou entitu pres
  registry ID.
- Bezni uzivatel si muze upravit svoji plochu a oblibene, ale nemuze menit
  integrace, registry, zarizeni, mistnosti, patra, klasifikaci entit ani
  automatizace/sceny.
- Technik muze nastavovat dum a uzivatelske dashboardy, admin muze menit role
  a systemova nastaveni Smarthome4u.

## Implementacni plan

### 1. Zavest stabilni reference

Pridat helpery do `home.py` nebo noveho modulu `refs.py`:

- `entity_ref(entity_id) -> str | None`: vrati `RegistryEntry.id`, pokud
  existuje.
- `entity_id_from_ref(ref) -> str | None`: najde aktualni `entity_id`.
- `normalize_entity_key(value)`: pri migraci prijme stare `entity_id` i nove
  `ref`.

Pozor:

- Akce a sluzby HA se porad volaji aktualnim `entity_id`.
- Persistovana data Smarthome4u maji ukladat `ref`.
- Pro entity bez registry entry pouzij fallback `entity:<entity_id>`, ale
  oznac je jako mene stabilni.

### 2. Migrovat `storage.py`

Zvys `STORAGE_VERSION` a pri `load()` proved migraci:

- `favorites`: ze seznamu `entity_id` na seznam refs.
- `layout.entities[area_id]`: entity poradi na refs.
- `layout.sizes`: klice na refs.
- `overrides`: klice na refs.
- `floorplan.points[].entityId`: prejmenovat na `entityRef`.
- `dashboard[preset][].entities`: na refs.

Migrace musi byt idempotentni. Stare instalace se nesmi rozbit.

### 3. Upravit API kontrakt

Model muze dal posilat oboje:

- `id`: aktualni `entity_id` pro ovladani.
- `ref`: stabilni registry reference pro ulozene rozvrzeni.

Endpointy pro ulozene UI maji prijimat primarne `entityRef`, ne `entityId`:

- `/dashboard`
- `/layout`
- `/favorites`
- `/floorplan`

Kvuli kompatibilite do dalsi verze prijmi i stare `entityId`, ale uloz vzdy
`ref`.

### 4. Upravit frontend

Frontend smi pro ovladani pouzivat `entity.id`, ale pro ulozene seznamy musi
pouzivat `entity.ref`.

Zmenit zejmena:

- `app.js`: `entityById` rozdelit na `entityByRef` a pripadne kompatibilni
  fallback.
- `blocks.js`: bloky `entities` drzet jako refs.
- `favorites.js`: vyber a vymena mist pouziva refs.
- `view-home.js`: velikosti, poradi a schovani posilat jako refs tam, kde jde
  o ulozeny layout.
- `view-floorplan.js`: body ukladat jako `entityRef`.

### 5. Rozdelit opravneni

V `storage.py` ulozit mapu roli:

```json
{
  "roles": {
    "<ha_user_id>": "technician"
  }
}
```

Pravidla:

- HA admin bez ulozene role muze pri prvnim spusteni prevzit `admin`.
- `admin`: role, system, technici, vsechny zapisy.
- `technician`: zarizeni, mistnosti, patra, integrace, automatizace, sceny,
  klasifikace, layouty.
- `user`: ovladani domu, vlastni dashboard, vlastni oblibene.

Pridat dekoratory:

- `@requires("user")`
- `@requires("technician")`
- `@requires("admin")`

Nenechat rozhodovani jen ve frontendu.

### 6. Ujasnit HA dashboard navaznost

Nedavat potichu zapis do `.storage/lovelace*`. Pokud ma vznikat dashboard pro
klasicke HA UI, udelej to jako samostatny adapter s testy a feature flagem.

Minimalni spravna verze pro 1.0:

- Smarthome4u vytvari nativni HA objekty: oblasti, patra, zarizeni, sceny,
  automatizace.
- V dokumentaci jasne rict, ze Smarthome4u dashboard je vlastni panel.
- Pridat pozdejsi ukol `lovelace_export`: jednosmerne vygenerovat HA dashboard
  z aktualniho Smarthome4u layoutu, bez mazani uzivatelskych HA dashboardu.

## Povinne testy

Pridat testy do `tests/test_setup.py` nebo rozdelit do noveho souboru:

1. `test_favorites_survive_entity_rename`
   - vytvor entity registry entry,
   - uloz favorite,
   - zmen `entity_id`,
   - over, ze favorite ukazuje na novy aktualni entity_id.

2. `test_dashboard_blocks_survive_entity_rename`
   - uloz blok s entitou,
   - prejmenuj entitu,
   - model vrati blok se stejnym ref a aktualnim entity_id.

3. `test_floorplan_survives_entity_rename`
   - bod je ulozeny pres ref, po prejmenovani se vykresli nad novou entitou.

4. `test_user_can_edit_own_dashboard_but_not_devices`
   - user ulozi vlastni favorites/layout,
   - user nesmi volat zmeny zarizeni, integraci, klasifikace ani role.

5. `test_technician_can_manage_house_without_admin_role`
   - HA user bez `is_admin` s roli `technician` smi spravovat dum.

## Co ted nedelat

- Neprepisovat dashboard do Lovelace rucnim zapisem do `.storage`.
- Neudelat z bezneho uzivatele HA admina jen kvuli upravam dashboardu.
- Nevracet se k Long-Lived Access Tokenum.
- Neopravovat to jen pres texty v UI. Musi se zmenit backendova autorizace a
  persistovana identita.

