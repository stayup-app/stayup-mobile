# StayUp Mobile

[![CI](https://github.com/stayup-app/stayup-mobile/actions/workflows/ci.yml/badge.svg)](https://github.com/stayup-app/stayup-mobile/actions/workflows/ci.yml)
[![EAS Preview Build](https://github.com/stayup-app/stayup-mobile/actions/workflows/eas-preview.yml/badge.svg)](https://github.com/stayup-app/stayup-mobile/actions/workflows/eas-preview.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Site web :** https://stayup-ui.vercel.app

Application mobile StayUp — un lecteur unifié qui agrège vos sources de veille technique
(changelogs GitHub, chaînes YouTube, flux RSS et pages scrapées) dans un seul feed.

## Stack

| Domaine     | Technologie                                |
| ----------- | ------------------------------------------ |
| Framework   | Expo SDK 54 · React Native 0.81 · React 19 |
| Navigation  | expo-router (typed routes)                 |
| Styles      | NativeWind (Tailwind CSS)                  |
| État        | Zustand                                    |
| Formulaires | react-hook-form + Zod                      |
| Stockage    | expo-secure-store · AsyncStorage           |
| Tests       | Jest · @testing-library/react-native       |
| Langage     | TypeScript (strict)                        |

## Fonctionnalités

- **Feed unifié** — tous les providers agrégés, triés par date, filtrables par provider ou par flux. Chaque provider est rendu à partir d'un template embarqué dans l'app (`src/lib/providers.ts`).
- **Une seule API** — l'app parle à l'API StayUp définie à la compilation par `EXPO_PUBLIC_STAYUP_API_URL`.
- **Suivi de lecture** — items lus/non lus persistés localement, filtre « non lu », tout marquer lu.
- **Lecteur d'articles** — vue plein écran avec navigation précédent/suivant.
- **Gestion des flux** — ajout via le descripteur de formulaire du provider, abonnement à un flux existant ou demande de nouveau flux quand le provider est en validation manuelle.
- **Authentification** — email/mot de passe et OAuth (GitHub, Google) via deep link `stayup://`.
- **Thème & langue** — clair/sombre automatique ; anglais, français, allemand, espagnol, italien, portugais, japonais et chinois.

## Prérequis

- Node.js 20
- npm
- [Expo Go](https://expo.dev/go) ou un build de développement

## Démarrage

```bash
npm ci --legacy-peer-deps
npm start
```

Puis `i` pour iOS, `a` pour Android, ou scannez le QR code avec Expo Go.

## Scripts

| Commande               | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm start`            | Démarre le serveur de développement Expo |
| `npm run android`      | Build et lance sur Android               |
| `npm run ios`          | Build et lance sur iOS                   |
| `npm run web`          | Lance la version web                     |
| `npm test`             | Lance les tests + rapport de couverture  |
| `npm run test:watch`   | Tests en mode watch                      |
| `npm run typecheck`    | Vérifie les types TypeScript             |
| `npm run lint`         | Lance ESLint                             |
| `npm run format`       | Formate le code avec Prettier            |
| `npm run format:check` | Vérifie le formatage                     |

## Structure

```
app/                  Routes expo-router
  (auth)/             Écrans de connexion / inscription
  (app)/              Écrans authentifiés (tabs feed + profil)
src/
  components/         Composants par domaine (auth, feed, ui)
  context/            Providers React (thème, langue)
  hooks/              Logique métier (useAuth, useFeed)
  lib/                Client API, stockage, session JWT, utils, traductions
  store/              Stores Zustand
  types/              Types partagés
tests/                Tests unitaires et composants
```

## API

L'app parle à une seule API StayUp, définie par `EXPO_PUBLIC_STAYUP_API_URL`
(`https://stayup-api.r-sik.workers.dev` par défaut, voir `src/lib/config.ts`). Le token JWT est
conservé dans le keychain via `expo-secure-store` (`auth_token`).

## CI/CD

- **CI** (`.github/workflows/ci.yml`) — typecheck, lint, format check et tests sur chaque push
  (`main`, `develop`) et chaque pull request vers `main`.
- **EAS Preview Build** (`.github/workflows/eas-preview.yml`) — build iOS + Android sur le profil
  `preview` à chaque push sur `main`. Nécessite le secret `EXPO_TOKEN`.

## Licence

[MIT](LICENSE)
