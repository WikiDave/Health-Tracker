# Gezondheid – persoonlijk gezondheidsdossier

Een app om je gezondheid bij te houden, op je telefoon of computer.

## Menu

| Menu | Onderdelen |
|---|---|
| 🏠 **Vandaag** | Startscherm met je dag in één oogopslag en snelknoppen |
| 📝 **Check** | De dagelijkse check |
| 📔 **Dagboek** | Welzijn, Slaap, Pijn, Sport, Voeding, Drinken, Stoelgang, Middelen, Omgeving |
| 💊 **Medicijnen** | Medicatie, Supplementen, Voorschriften |
| 🏥 **Medisch** | Bloedonderzoeken, Bezoeken, Vaccinaties |
| 👤 **Profiel** | Je gegevens, medisch overzicht, Excel-export en back-up |

Op de telefoon staat het menu als balk onderin. Een groep opent een pagina met tegels (met de stand van vandaag); binnen een groep wissel je via de knoppen bovenaan.

## Onderdelen

| Onderdeel | Wat kun je ermee |
|---|---|
| 🏠 **Vandaag** | Overzicht van de dag: je dagelijkse check, welke medicijnen je nog moet innemen, aandachtspunten (bijna op, recept verloopt, afwijkende bloedwaarden) en je komende afspraken. |
| 📝 **Dagelijkse check** | Stemming, energie, pijn, slaap, bloeddruk, hartslag, gewicht, temperatuur, bloedsuiker, saturatie, klachten en notities. Met grafieken van het verloop. |
| 🧠 **Vermoeidheid & mentaal** | In de dagelijkse check houd je vermoeidheid (0–10, wat je nog kon, rust/dutjes, uitgerust wakker) en je mentale gezondheid bij (stress, angst, somberheid, concentratie, wat je bezighield, iets fijns). Ook libido (alleen op je apparaat, niet in het medisch overzicht) en stappen. Het scherm *Welzijn* toont weekgemiddelden met vergelijking, grafieken, een dagboek en zelftests (PHQ-9 voor somberheid, GAD-7 voor angst) met uitleg en hulp-informatie. |
| 🏃 **Sport & beweging** | Activiteit, duur, inspanning, afstand, hartslag, hoe je je erna voelde en eventuele klachten. Voortgang naar de Beweegrichtlijn (150 min per week) en een grafiek per week. |
| 🌙 **Slaap** | Slaapdagboek per nacht: bedtijd, opstaan (uren worden berekend), inslaaptijd, keer wakker, kwaliteit, wat je wakker hield, slaapmiddel en schermtijd voor bed. Gemiddelden, grafiek en verbanden (bv. koffie of schermtijd en slaapkwaliteit). |
| 🥗 **Voeding** | Eetdagboek per maaltijd met klachten na het eten, en dagdoelen volgens de Schijf van Vijf (groente, fruit, drinken) plus eetlust. |
| 🍷 **Middelengebruik** | Alcohol, roken, cafeïne en drugs per dag, zonder oordeel. Alcoholvrije dagen, glazen per week, teller voor stoppen met roken (dagen rookvrij, bespaard geld), verbanden met slaap, stemming en vermoeidheid, en verwijzingen naar hulp. Drugs staan alleen in het medisch overzicht als je dat aanvinkt. |
| 🌳 **Omgeving** | Werk (soort, uren, werkdruk), tijd buiten en weer, feest/uitgaan, mensen gezien, onderweg, schermtijd en bijzonderheden. Laat zien wat samenhangt met hoe je je voelt, bijvoorbeeld de dag na een feest of op werkdagen. |
| 🚽 **Stoelgang** | Vorm volgens de Bristol-schaal (type 1–7), hoe het ging, kleur, aandrang, bloed en slijm. Overzicht van frequentie en vorm; bloed of een afwijkende kleur geeft een waarschuwing om naar de huisarts te gaan. |
| 💊 **Medicatie** | Medicijnen met dosis, innametijden en gebruiksaanwijzing. Innames afvinken, voorraad telt automatisch af (waarschuwing bij minder dan 7 dagen), en je ziet hoe trouw je ze inneemt. Vergeten innames worden gemarkeerd. |
| 🌿 **Supplementen & vitamines** | Net als medicijnen: dosis, merk, innametijden, afvinken, voorraad en herinneringen, met wie het adviseerde. Apart vermeld in het medisch overzicht, omdat supplementen medicijnen kunnen beïnvloeden. |
| 💧 **Drinken** | Met één tik een glas, fles, thee of koffie toevoegen (ook op het startscherm). Dagdoel of maximum (vochtbeperking), achter-op-schema-hint, kleur urine, grafiek van 14 dagen en een herinnering als je achterloopt. |
| 🔔 **Herinneringen** | Zet al je innametijden met één klik in de agenda van je telefoon (dagelijks terugkerend, met melding). Daarnaast kan de app zelf meldingen geven voor medicatie en voor je dagelijkse check. |
| ⚡ **Pijndagboek** | Noteer pijn wanneer je het voelt: hoe erg (0–10), waar, soort, oorzaak en wat hielp. Met grafiek en overzicht (gemiddelde, hoogste, meest genoemde plek). |
| 🩸 **Bloedonderzoeken** | Uitslagen met referentiewaarden. Afwijkende waarden worden gemarkeerd (↑ hoog / ↓ laag) en per bepaling zie je een grafiek van het verloop. |
| 📄 **Voorschriften** | Recepten, verwijzingen en hulpmiddelen, met geldigheid, herhalingen en apotheek. Waarschuwing als een voorschrift (bijna) verloopt. |
| 🏥 **Bezoeken** | Afspraken bij huisarts, ziekenhuis, specialist enz. Vooraf je vragen noteren, achteraf de uitkomst en het vervolg. Met één klik in je agenda zetten. |
| 💉 **Vaccinaties** | Welke prik, wanneer, batchnummer en wanneer de volgende nodig is (met waarschuwing). |
| 👤 **Profiel** | Allergieën, aandoeningen, huisarts, apotheek, noodcontact. Plus een **medisch overzicht** om te printen of als PDF op te slaan voor de dokter, en een **export naar Excel** (een tabblad per onderdeel). |

## Privacy

Er is geen server en geen account. **Al je gegevens blijven alleen in de browser op je eigen apparaat** (localStorage). Omdat alles lokaal staat:

- Maak af en toe een **back-up** via *Profiel → Back-up downloaden*. Daarmee zet je je gegevens ook over naar een ander apparaat (*Back-up terugzetten*).
- Als je de browsergegevens van de site wist, ben je je gegevens kwijt (zonder back-up).

## Over de herinneringen

- **Via je agenda (aanbevolen):** *Medicatie → Innametijden in agenda zetten* downloadt een agendabestand (`.ics`). Open het op je telefoon en voeg het toe aan je agenda. Je krijgt dan elke dag op de innametijd een melding, ook als de app dicht is. Wijzigt je medicatie? Verwijder de oude items en zet ze opnieuw in je agenda.
- **Via de app:** zet *Meldingen van app aanzetten* aan. Een webapp zonder server kan alleen melden als hij open is of net op de achtergrond draait. Gebruik dit dus als extra, niet als enige herinnering.

## Gebruiken

### Op je computer
Open `index.html` door erop te dubbelklikken. Het werkt direct.

Of start een lokale webserver (dan werkt ook de offline-modus):

```bash
npm start          # opent op http://localhost:8080
```

### Op je telefoon (als app)
Zet de map op een website, bijvoorbeeld gratis via **GitHub Pages**
(*Settings → Pages → Deploy from a branch → `main` / root*). Open de link op je telefoon en kies:

- **iPhone (Safari):** Deel-knop → *Zet op beginscherm*
- **Android (Chrome):** menu ⋮ → *App installeren* / *Toevoegen aan startscherm*

De app werkt daarna ook zonder internet. Let op: de gegevens op je telefoon en computer zijn gescheiden; gebruik de back-up om ze over te zetten.

## Voor ontwikkelaars

Geen build-stap of afhankelijkheden: gewone HTML, CSS en JavaScript.

```
index.html            pagina + navigatie
css/styles.css        opmaak (licht/donker, mobiel, print)
js/utils.js           datums, getallen, berekeningen (ook getest in Node)
js/store.js           opslag in localStorage, back-up
js/xlsx.js            Excel-bestanden maken zonder bibliotheek (ook getest in Node)
js/export.js          export van alle gegevens naar Excel
js/reminders.js       meldingen voor medicatie en dagelijkse check
js/questionnaires.js  PHQ-9 en GAD-7 met scoring (ook getest in Node)
js/form.js            generieke formulier-dialoog
js/chart.js           SVG-lijngrafiek met referentieband en tooltip
js/views/*.js         de schermen
sw.js                 service worker (offline)
tests/                unit tests: npm test
```

Bij een nieuwe versie: verhoog `VERSION` in `sw.js`.

---

*Deze app vervangt geen medisch advies. Neem bij twijfel of klachten contact op met je huisarts. Bij spoed: bel 112. Denk je aan zelfdoding? Bel 113 of gratis 0800-0113 (113 Zelfmoordpreventie, dag en nacht).*
