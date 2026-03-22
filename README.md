# Valg 2026 — Dansk Valgprognose

En uafhængig, datadriven valgprognose for det danske folketingsvalg den 24. marts 2026. Inspireret af [FiveThirtyEight](https://fivethirtyeight.com/) og tilpasset det danske proportionelle valgsystem.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Funktioner

### Prognosemodel
- **Vægtet gennemsnit** af meningsmålinger med eksponentiel recency-vægtning (14 dages halveringstid)
- **House effects-korrektion** kalibreret mod valgresultater fra 2019 og 2022
- **d'Hondt mandatberegning** for alle 175 folketingspladser
- **10.000 Monte Carlo-simuleringer** med korreleret blok-støj for usikkerhedskvantificering
- **Spærregrænseanalyse** — sandsynlighed for at hvert parti klarer 2%-grænsen

### Dashboard & Visualiseringer
- **Interaktivt dashboard** med blokoversigt, hemicycle-diagram og partioversigt
- **Folketingssalen** — SVG-hemicycle med 175 farvekodede mandater
- **Meningsmålingstrender** — multi-line chart med institutvælger og scatter-overlay
- **Mandatinterval** — horisontale søjler med 5.–95. percentil-fejlbjælker
- **Blokfordeling** — donut-chart med rød/blå/midterblok
- **Spærregrænse-gauges** — visuel risikovurdering for grænsetilfælde

### Sider
| Side | Beskrivelse |
|------|-------------|
| `/` | Forside med nedtælling, blokoversigt og hurtig navigation |
| `/dashboard` | Komplet overblik: hemicycle, partitabel, trends, blokfordeling |
| `/meningsmaalinger` | Alle målinger med trendchart, filtrering og sorterbar tabel |
| `/prognose` | Mandatberegning, Monte Carlo-resultater, konfidensintervaller |
| `/partier` | Partigrid med farver, ledere, mandater og trends |
| `/partier/[id]` | Detaljeside for hvert parti med individuel trendkurve |
| `/koalitioner` | Koalitionsbygger med forudindstillinger og flertalsberegning |
| `/historik` | Sammenligning af valgresultater fra 2011–2022 |
| `/metodologi` | Fuld dokumentation af modellen på dansk |

### Partier
12 partier fordelt på tre blokke:

| Blok | Partier |
|------|---------|
| **Rød** | Enhedslisten (Ø), SF (F), Socialdemokratiet (A), Radikale Venstre (B), Alternativet (Å) |
| **Blå** | Venstre (V), Konservative (C), Liberal Alliance (I), Danmarksdemokraterne (Æ), Dansk Folkeparti (O), Borgernes Parti (H) |
| **Midter** | Moderaterne (M) |

## Tech Stack

- **[Next.js 16](https://nextjs.org/)** — App Router med React 19
- **[TypeScript](https://www.typescriptlang.org/)** — End-to-end typesikkerhed
- **[Tailwind CSS v4](https://tailwindcss.com/)** — Utility-first styling
- **[shadcn/ui](https://ui.shadcn.com/)** — Komponentbibliotek med base-nova stil
- **[Recharts](https://recharts.org/)** — Interaktive charts (line, bar, pie, error bars)
- **Custom SVG** — Hemicycle-visualisering af Folketinget

## Kom i gang

### Forudsætninger
- Node.js 18+
- npm, yarn, pnpm eller bun

### Installation

```bash
# Klon repositoriet
git clone https://github.com/dit-brugernavn/valg2026.git
cd valg2026

# Installer afhængigheder
npm install

# Start udviklingsserveren
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000) i din browser.

### Build

```bash
npm run build
npm start
```

## Projektstruktur

```
src/
├── app/                          # Next.js App Router sider
│   ├── page.tsx                  # Forside med hero og nedtælling
│   ├── dashboard/page.tsx        # Fuldt dashboard
│   ├── meningsmaalinger/         # Meningsmålinger med tabel
│   ├── prognose/page.tsx         # Prognose med Monte Carlo
│   ├── partier/                  # Partioversigt + [partyId] detaljer
│   ├── koalitioner/page.tsx      # Koalitionsbygger
│   ├── historik/page.tsx         # Historiske valg
│   └── metodologi/page.tsx       # Metodologibeskrivelse
├── components/
│   ├── charts/                   # Alle visualiseringer
│   │   ├── poll-trend-chart.tsx  # Multi-line meningsmålingsgrafer
│   │   ├── hemicycle-chart.tsx   # SVG folketingssal
│   │   ├── seat-bar-chart.tsx    # Mandatsøjler med flertalslinje
│   │   ├── seat-range-chart.tsx  # Konfidensintervaller
│   │   ├── bloc-donut-chart.tsx  # Blokfordeling
│   │   └── threshold-gauge.tsx   # Spærregrænse-gauge
│   ├── dashboard/                # Dashboard-specifikke komponenter
│   ├── layout/                   # Header, footer
│   └── ui/                       # shadcn/ui base-komponenter
├── data/
│   ├── polls.json                # 66 meningsmålinger (jan 2025 – mar 2026)
│   ├── institutes.json           # Institutprofiler med kvalitetsratings
│   └── elections/                # Historiske valgresultater (2011–2022)
└── lib/
    ├── types.ts                  # TypeScript-typer
    ├── constants.ts              # Parti-, blok- og institutdefinitioner
    ├── data.ts                   # Dataindlæsningsfunktioner
    └── forecast/
        ├── poll-averager.ts      # Vægtet gennemsnit med house effects
        ├── seat-allocator.ts     # d'Hondt mandatberegning
        ├── monte-carlo.ts        # 10.000 simuleringer
        └── forecast-engine.ts    # Orkestrator + koalitionsscenarier
```

## Prognosemodel

### 1. Vægtet gennemsnit
Hver meningsmåling vægtes med:
```
vægt = e^(-ln(2) × alder_i_dage / 14) × institutKvalitet
```
- **Halveringstid:** 14 dage — en måling der er 2 uger gammel tæller halvt
- **Kvalitetsscorer:** Baseret på historisk præcision, metodik og stikprøvestørrelse

### 2. House Effects
Systematiske afvigelser for hvert institut estimeres fra valgresultaterne i 2019 og 2022 og korrigeres inden det vægtede gennemsnit beregnes.

### 3. d'Hondt Mandatberegning
- Partier under 2% filtreres fra (spærregrænsen)
- Stemmeandele omfordeles proportionalt til resterende partier
- 175 mandater fordeles via d'Hondts metode

### 4. Monte Carlo-simulering
For hver af 10.000 simuleringer:
1. Normalfordelt støj tilføjes til hvert partis gennemsnit
2. Korreleret blok-støj (σ = 0,5%) skubber alle partier i samme blok i samme retning
3. Stemmeandelene normaliseres til 100%
4. Spærregrænsen anvendes og mandater beregnes
5. Percentiler (5., 25., 50., 75., 95.) og flertals­sandsynligheder uddrages

### 5. Koalitionsscenarier
7 foruddefinerede scenarier:
- Rød blok (Ø+F+A+B+Å)
- Blå blok (V+C+I+Æ+O+H)
- Rød + M, Blå + M
- SVM (S+V+M)
- S + SF + R
- Bred blå (V+C+I+Æ+H)

## Datakilder

| Institut | Medie | Metode |
|----------|-------|--------|
| Voxmeter | Ritzau | Telefon + web (ugentlig) |
| Epinion | DR | 5.000+ interviews (løbende) |
| Megafon | TV 2 / Politiken | Telefon + web |
| Verian | Berlingske | Telefon |
| YouGov | B.T. | Online panel |

Data indsamles fra Wikipedia's oversigt over meningsmålinger samt institutters egne publikationer.

## Deploy

### Vercel (anbefalet)
Projektet er klar til deploy på [Vercel](https://vercel.com):

```bash
npx vercel
```

### Docker
```bash
docker build -t valg2026 .
docker run -p 3000:3000 valg2026
```

## Begrænsninger

- National mandatberegning (ikke valgkredsspecifik)
- House effects estimeret fra kun to valg (2019 og 2022)
- Modellen antager normalfordelte målingsafvigelser
- Sene vælgerbevægelser (24–48 timer før valg) fanges ikke
- Grønland og Færøernes 4 mandater er ikke inkluderet

## Inspiration

- [FiveThirtyEight](https://fivethirtyeight.com/) — Amerikansk valgprognose
- [Zweitstimme.org](https://zweitstimme.org/) — Tysk valgprognose
- [The Economist Election Model](https://www.economist.com/interactive/us-2024-election/prediction-model/president/) — Bayesiansk valgmodel
- [Valgidanmark.dk](https://valgidanmark.dk/) — Dansk meningsmålingsoversigt

## Licens

MIT

---

*Dette er et uafhængigt projekt og har ingen tilknytning til medierne eller de nævnte analyseinstitutter.*
