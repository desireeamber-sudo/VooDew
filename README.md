# VooDew

**Entertainment-Focused Group Event & Trip Planner** — a React Native (Expo) app built for ACS-5413 (Summer 2026).

VooDew helps a user create an event or trip, generates a suggested checklist based on event type and travel needs, stores reservation links, shows the venue/destination on a map, schedules local reminders, assigns travelers, and tracks shared expenses — replacing the usual scatter of email, ticket apps, hotel confirmations, texts, and notes.

## Features (Class MVP)

- **Trips**: create, view, edit, delete — persisted in Firebase Firestore.
- **Smart Checklist**: pick an event type (in-town concert, out-of-town concert, cruise, festival, custom); the app asks if travel is required and, if so, whether you're driving/flying/cruising/other, then generates a starter checklist. Items can be checked, added, edited, and deleted.
- **Travelers**: create/select travelers and assign them to a trip.
- **Reservations & Links**: save labeled URLs (ticket, flight, hotel, parking, rental car, cruise docs, restaurant, custom) and open them in the browser or an installed app.
- **Map**: venue/destination shown on an interactive map with a marker, plus a "Get Directions" action.
- **Local Notifications**: schedule a reminder (e.g., for incomplete checklist items).
- **Expenses**: add an expense with description, amount, date, payer, and split; the app calculates each traveler's share and nets balances into "who owes whom" (e.g., "Amber owes Des $300.00").

## Tech Stack

- React Native + Expo, Expo Router for navigation
- Firebase Firestore for data persistence
- `react-native-maps`, `expo-location`, `expo-notifications`

## Project Structure

```
app/                    Expo Router screens
  _layout.js
  index.js               Home / Saved Trips
  trips/
    create.js             Create / Edit Trip
    [tripId]/
      index.js             Trip Dashboard
      checklist.js
      links.js
      map.js
      expenses.js
      travelers.js
components/             Reusable UI: AppButton, AppInput, TripCard,
                        DashboardCard, ChecklistRow, ExpenseRow, Chip, EmptyState
services/               firebase.js, tripService.js, notificationService.js, locationService.js
utils/                  checklistTemplates.js, expenseCalculator.js, validators.js
constants/              colors.js, typography.js
assets/images/          App icon / splash / logo assets (add your own PNGs here)
```

## Setup

### 1. Install dependencies

```bash
npm install
npx expo install --fix
```

`expo install --fix` aligns every Expo/React Native package version with the installed Expo SDK — run it once after cloning in case dependency versions have moved on since this was written.

### 2. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) and create a new project.
2. Enable **Firestore Database** (start in test mode for development).
3. Add a **Web app** to the project (Project settings → General → Your apps → Web).
4. Copy the resulting config values.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env` with your Firebase config values:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

`.env` is git-ignored — never commit real keys. `services/firebase.js` reads these via `process.env.EXPO_PUBLIC_*`, which Expo inlines at build time.

### 4. Run the app

```bash
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a simulator/emulator. Maps and notifications require a physical device or a simulator with location services configured; the Expo Go app will prompt for the relevant permissions the first time each feature is used.

## Firebase Data Model

| Collection | Fields | Relationship |
|---|---|---|
| `trips` | id, title, eventType, travelRequired, travelMode, startDate, endDate, destination, venue, address, latitude, longitude, notes, travelerIds, createdAt | Primary record |
| `travelers` | id, name, email | Shared list; referenced by `trips.travelerIds` |
| `trips/{id}/checklistItems` | id, title, completed, category, order, isDefault | Belongs to one trip |
| `trips/{id}/reservationLinks` | id, type, label, url, confirmationNumber | Belongs to one trip |
| `trips/{id}/expenses` | id, description, amount, paidByTravelerId, splitTravelerIds, date | Belongs to one trip |
| `trips/{id}/notifications` | id, title, scheduledAt, notificationType, osIdentifier | Belongs to one trip |

Full CRUD (create, read, update, delete) is implemented for trips, travelers, checklist items, reservation links, and expenses in `services/tripService.js`.

## How Each Rubric Requirement Is Satisfied

| Requirement | Where |
|---|---|
| Home + 3+ additional screens, working navigation | `app/index.js` + 7 additional screens under `app/trips/`, via Expo Router stack navigation (`app/_layout.js`) |
| View, Text, Image, TextInput, StyleSheet, Button | Used throughout `components/` and `app/` screens (`AppButton`/`AppInput` wrap `Pressable`/`TextInput`; `StyleSheet.create` used in every file) |
| Interactive map with marker | `app/trips/[tripId]/map.js` via `react-native-maps` |
| Local push notification | `services/notificationService.js`, triggered from `app/trips/[tripId]/checklist.js` |
| Firebase CRUD | `services/firebase.js` + `services/tripService.js` |
| Clean, consistent UI | `constants/colors.js`, `constants/typography.js`, shared components |
| Loading / empty / validation / success / error states | Loading spinners on every data-dependent screen, `EmptyState` component, `utils/validators.js`, `Alert` confirmations for destructive actions |

## Known Class-Version Boundaries (see project handoff, Section 11 for the future backlog)

Not implemented by design for the first version: authentication, real-time multi-user collaboration, payment processing, Apple Wallet integration, receipt image upload, live flight data. The architecture (separate services/utils/constants) is intentionally left open for these later.

## Demo Checklist

See the class project handoff document for the full submission/demo checklist (sample data, Firebase CRUD demo, map/marker, notification trigger, expense split, link opening, README screenshots, video requirements).
