# Debattforum - Turn-Based Debate System

En dynamisk webapplikasjon hvor brukere deltar i strukturerte debatter mellom to personer.

## Funksjonalitet

- **Turbasert debatt**: Kun to deltakere, meldinger kan ikke redigeres
- **Autentisering**: Registrering og innlogging med hashede passord
- **Debattopprettelse**: Opprett debatter med kategori, tags og deltakere
- **Stemming**: Publikum stemmer etter debatt avsluttes
- **Poengsystem**: Automatisk beregning av vinner og poeng
- **Profil**: Se brukerstatistikk og debatthistorikk
- **Rangering**: Tre rangtrinn basert på poeng

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla, SPA)
- **Backend**: Node.js + Express
- **Database**: SQLite
- **Security**: bcryptjs for password hashing, JWT for token auth

## Setup

### Instalasjon

1. Naviger til server-mappen:
```bash
cd server
npm install
```

2. Start serveren:
```bash
npm start
```

Serveren kjører på `http://localhost:5000`

## Databaseskjema

### Users
- `id`: Integer, Primary Key
- `username`: Unique text
- `password_hash`: Hashed password
- `points`: Brukerpoeng
- `created_at`: Timestamp

### Debates
- `id`: Integer, Primary Key
- `title`: Debattpømt
- `category`: Kategori
- `creator_id`: Oppretters bruker-ID
- `opponent_id`: Motstanders bruker-ID
- `starter_id`: Hvem starter (bruker-ID)
- `ender_id`: Hvem avslutter (bruker-ID)
- `current_turn`: Nåværende spiller (bruker-ID)
- `status`: 'active' eller 'finished'
- `views`: Antall visninger
- `winner_id`: Vinner (bruker-ID)
- `created_at`, `finished_at`: Timestamps

### Messages
- `id`: Integer, Primary Key
- `debate_id`: Foreign Key
- `user_id`: Avsender
- `content`: Meldingsinnhold
- `created_at`: Timestamp

### Votes
- `id`: Integer, Primary Key
- `debate_id`: Foreign Key
- `voter_id`: Hvem som stemte
- `voted_user_id`: Hvem de stemte på
- `UNIQUE(debate_id, voter_id)`: Enstemme per bruker per debatt

### Tags & Debate_Tags
- Supports multiple tags per debate

## API Endepunkter

### Autentisering
- `POST /api/auth/register` - Registrer bruker
- `POST /api/auth/login` - Logg inn
- `GET /api/auth/me` - Hent nåværende bruker

### Debatter
- `GET /api/debates` - Hent alle debatter (med filtrering)
- `GET /api/debates/:id` - Hent spesifikk debatt
- `POST /api/debates` - Opprett debatt
- `POST /api/debates/:id/end` - Avslutt debatt

### Meldinger
- `POST /api/messages` - Post melding
- `GET /api/messages/debate/:debate_id` - Hent meldinger

### Stemmer
- `POST /api/votes` - Post stemme
- `GET /api/votes/debate/:debate_id` - Hent stemmer

### Brukere
- `GET /api/users/:id` - Hent brukerProfil

## Brukerflow

1. **Registrering/Login** - Opprett konto eller logg inn
2. **Debattliste** - Bla gjennom aktive og ferdige debatter
3. **Opprett debatt** - Sett opp ny debatt med motstander
4. **Ta del i debatt** - Post innlegg når det er din tur
5. **Avslutt debatt** - Definert avsluttes debatten
6. **Stemming** - Publikum stemmer på vinner
7. **Resultat** - Se vinner og poengoppdatering

## Sikkerhetsregler

- Backend validerer alle requestsoperasjoner
- Turbasert validering - du kan bare poste når det er din tur
- Stemmeregler - deltakere kan ikke stemme, kun en stemme per bruker
- Innlegg kan ikke redigeres eller slettes
- Debatter låses når de avsluttes

## Mulige Forbedringer

- [ ] Notifikasjoner (real-time med WebSockets)
- [ ] Bruker-søk API
- [ ] Debatt-editering av tittel/kategori
- [ ] Kommentarer på debatter
- [ ] Feed/timeline
- [ ] Brukerprofiler med follow-system
- [ ] Bedre error handling
- [ ] Rate limiting

## Universell Utforming

- Semantisk HTML
- ARIA-labels på skjemaer og regioner
- Tastaturnavigasjon
- Fokusmarkering
- Høy kontrast (dark mode support)
- Respekterer prefers-reduced-motion

## Licens

MIT
