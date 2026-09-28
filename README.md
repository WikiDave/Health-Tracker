# Gezondheid – persoonlijk gezondheidsdossier

Een app om je gezondheid bij te houden, op je telefoon of computer.

| Onderdeel | Wat kun je ermee |
|---|---|
| 🏠 **Vandaag** | Overzicht van de dag: je dagelijkse check, welke medicijnen je nog moet innemen, aandachtspunten (bijna op, recept verloopt, afwijkende bloedwaarden) en je komende afspraken. |
| 📝 **Dagelijkse check** | Stemming, energie, pijn, slaap, bloeddruk, hartslag, gewicht, temperatuur, bloedsuiker, saturatie, klachten en notities. Met grafieken van het verloop. |
| 💊 **Medicatie** | Medicijnen met dosis, innametijden en gebruiksaanwijzing. Innames afvinken, voorraad telt automatisch af (waarschuwing bij minder dan 7 dagen), en je ziet hoe trouw je ze inneemt. |
| 🩸 **Bloedonderzoeken** | Uitslagen met referentiewaarden. Afwijkende waarden worden gemarkeerd (↑ hoog / ↓ laag) en per bepaling zie je een grafiek van het verloop. |
| 📄 **Voorschriften** | Recepten, verwijzingen en hulpmiddelen, met geldigheid, herhalingen en apotheek. Waarschuwing als een voorschrift (bijna) verloopt. |
| 🏥 **Bezoeken** | Afspraken bij huisarts, ziekenhuis, specialist enz. Vooraf je vragen noteren, achteraf de uitkomst en het vervolg. Met één klik in je agenda zetten. |
| 👤 **Profiel** | Allergieën, aandoeningen, huisarts, apotheek, noodcontact. Plus een **medisch overzicht** om te printen of als PDF op te slaan voor de dokter. |

## Privacy

Er is geen server en geen account. **Al je gegevens blijven alleen in de browser op je eigen apparaat** (localStorage). Omdat alles lokaal staat:

- Maak af en toe een **back-up** via *Profiel → Back-up downloaden*. Daarmee zet je je gegevens ook over naar een ander apparaat (*Back-up terugzetten*).
- Als je de browsergegevens van de site wist, ben je je gegevens kwijt (zonder back-up).

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
js/form.js            generieke formulier-dialoog
js/chart.js           SVG-lijngrafiek met referentieband en tooltip
js/views/*.js         de schermen
sw.js                 service worker (offline)
tests/                unit tests: npm test
```

Bij een nieuwe versie: verhoog `VERSION` in `sw.js`.

---

*Deze app vervangt geen medisch advies. Neem bij twijfel of klachten contact op met je huisarts. Bij spoed: bel 112.*
