# TESKERTI SPA — Frontend

Le frontend est une SPA responsive en HTML, CSS et JavaScript natif (ES modules), sans compilation ni framework.

## Architecture

- `index.html` contient la structure de l'application, les formulaires d'authentification et les écrans de paiement et de confirmation.
- `js/app.js` gère la navigation par hash/History API et le rendu des pages.
- `js/config.js` centralise l'URL de l'API, configurée par défaut sur `http://localhost:8000/api/v1`.
- `js/data.js`, `js/movies.js` et `js/cinemas.js` chargent et affichent le catalogue.
- `js/booking.js` affiche une première séance disponible, le plan de sièges interactif et les sélecteurs de tarif.
- `js/auth.js`, `js/payment.js` et `js/ui.js` gèrent l'authentification JWT, le formulaire de paiement simulé et les notifications.

## Fonctionnalités et limites

- Films et cinémas chargés depuis l'API REST PHP.
- Sélection visuelle des sièges disponibles pour la première séance renvoyée pour un film.
- Types de billets et calcul de récapitulatif côté navigateur. Les tarifs d'affichage sont définis localement; l'API utilise les prix de zone de la séance, qui peuvent différer.
- Inscription et connexion via l'API, avec JWT stocké dans `localStorage`. L'interface n'utilise pas encore la route de renouvellement.
- Formulaire de carte à usage de démonstration uniquement. Aucun prestataire de paiement réel n'est connecté : n'entrez jamais de vraies coordonnées bancaires.
- Les écrans de réservation personnelle, de profil, de mot de passe oublié, de Google et de génération de QR ne sont pas tous reliés à un parcours fonctionnel.

## Développement local

Lancer l'API sur `http://localhost:8000`, puis servir le dossier `teskerti/` avec n'importe quel serveur HTTP statique. Exemple avec PHP :

```sh
php -S localhost:3000 -t .
```

Réalisé par Mohamed Louai Darguech.
