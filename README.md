# TESKERTI — Plateforme de réservation de billets de cinéma

TESKERTI est un projet de réservation de cinéma composé d'une interface web SPA en JavaScript natif et d'une API PHP connectée à MySQL/MariaDB. L'API fournit le catalogue, les séances, les sièges, les réservations, l'authentification et un traitement de paiement **simulé**.

## Captures et démonstration

Aucune capture d'écran ni vidéo de démonstration n'était présente dans les fichiers source au moment de la publication.

## Fonctionnalités vérifiées dans le code

- Consultation des films et des cinémas chargés depuis l'API.
- Consultation des séances d'un film et d'un plan de salle; sélection interactive des sièges libres.
- Choix d'un tarif par billet et calcul d'un récapitulatif. Le navigateur affiche toutefois des tarifs configurés dans `teskerti/js/data.js`; l'API recalcule le montant à partir du tarif de la zone du siège, ce qui peut provoquer un écart.
- Création d'une réservation `pending` avec un délai annoncé de 15 minutes. Les réservations en attente ne bloquent plus les sièges après 15 minutes dans les contrôles de disponibilité. Il n'y a pas de tâche qui change automatiquement leur statut, et la route de paiement ne vérifie pas l'âge de la réservation.
- Création de compte et connexion. L'API émet des JWT et dispose d'une route de renouvellement par rotation de jeton; l'interface actuelle n'utilise pas ce renouvellement et conserve le JWT dans `localStorage`.
- Formulaire Visa avec vérification locale et validation côté API.
- Confirmation visuelle et page d'impression du billet.

### Paiement : simulation uniquement

**N'entrez jamais de numéro de carte, date d'expiration ou CVV réel.** `PaymentController` ne contacte aucune banque ni aucun prestataire : il valide les champs, crée une référence de transaction de démonstration et marque systématiquement comme réussi tout paiement dont la validation et le montant passent. Le remboursement est lui aussi simulé. Le schéma ne conserve que les quatre derniers chiffres, la marque et une réponse fictive; le code du contrôleur ne journalise pas le numéro complet ni le CVV. Les données complètes sont néanmoins envoyées par l'interface à l'API et traitées en mémoire. L'URL API configurée pour le développement est en HTTP; ne déployez pas ce flux avec de vraies données bancaires.

## Architecture

- `teskerti/` : frontend SPA en HTML/CSS et JavaScript natif en ES modules, avec routeur basé sur History API.
- `teskerti-api/` : API REST PHP organisée en contrôleurs MVC, routeur personnalisé, helpers et middleware.
- MySQL 8+ ou MariaDB : stockage relationnel avec clés étrangères, tables InnoDB et types JSON.

### Schéma de données

Le schéma `teskerti-api/database/schema.sql` définit les tables `users`, `refresh_tokens`, `movies`, `cinemas`, `halls`, `seats`, `sessions`, `bookings`, `booking_seats`, `payments`, `promo_codes` et `rate_limits`. Les clés étrangères relient les utilisateurs, séances, salles, sièges, réservations et paiements. Les valeurs monétaires sont stockées avec trois décimales.

### API v1

Les routes sont préfixées par `/api/v1`.

| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/` ; `/api/v1` ; `/api/v1/health` | Public |
| POST | `/auth/register` ; `/auth/login` ; `/auth/refresh` | Public |
| POST | `/auth/logout` | JWT |
| GET | `/auth/me` | JWT |
| GET | `/movies` ; `/movies/{id}` ; `/movies/{id}/sessions` | Public |
| POST | `/movies` ; PUT `/movies/{id}` ; DELETE `/movies/{id}` | Admin |
| GET | `/cinemas` ; `/cinemas/{id}` ; `/cinemas/{id}/sessions` | Public |
| GET | `/sessions/{id}` ; `/sessions/{id}/seats` | Public |
| POST | `/sessions` | Admin |
| POST | `/bookings` ; `/bookings/validate-promo` | JWT |
| GET | `/bookings` ; `/bookings/{ref}` | JWT |
| POST | `/payments/process` | JWT; rate limiter |
| GET | `/payments/{id}/status` | JWT |
| POST | `/payments/{id}/refund` | Admin |

## Sécurité : comportement réel et limites

- Les mots de passe créés par l'inscription sont hachés avec Argon2id.
- Les JWT sont signés en HS256; les jetons d'actualisation générés à la connexion sont stockés sous forme de SHA-256 et la route `/auth/refresh` remplace l'ancien jeton.
- Les accès utilisateur et administrateur aux routes concernées sont contrôlés par middleware.
- Les requêtes de réservation utilisent des requêtes SQL préparées et une transaction qui verrouille la ligne de séance avec `FOR UPDATE`; le serveur recalcule le prix.
- Les sièges liés aux réservations confirmées ou aux réservations `pending` de moins de 15 minutes sont considérés occupés. Les réservations expirées ne sont pas automatiquement annulées, et un paiement tardif reste accepté par le contrôleur.
- Des en-têtes HTTP de sécurité et une liste CORS sont configurés. En développement, la règle de repli accepte les origines dont le texte commence par `http://localhost`; ce n'est pas une politique à conserver telle quelle en production.
- Le rate limiter MySQL s'applique à la route de traitement du paiement; en cas d'erreur, il échoue en mode permissif après journalisation.
- L'interface conserve les JWT dans `localStorage`. Aucun mécanisme CSRF dédié n'est implémenté.
- Les valeurs `JWT_SECRET` et les identifiants de base doivent être remplacés dans `.env`. La valeur d'exemple du secret ne doit jamais servir en production.

## Installation locale

Prérequis : PHP 8.2+ avec `pdo_mysql`, `mbstring` et `openssl`, Composer, et MySQL 8+ ou MariaDB 10.6+.

1. Cloner le dépôt et aller dans `teskerti-api/`.
2. Installer les dépendances PHP :

   ```sh
   composer install
   ```

3. Créer `teskerti-api/.env` à partir de `teskerti-api/.env.example` (par exemple `cp .env.example .env`, ou sous PowerShell `Copy-Item .env.example .env`). Renseigner la base et générer un `JWT_SECRET` robuste; conserver `APP_DEBUG=false` hors développement local.
4. Créer une base de données et un utilisateur MySQL/MariaDB correspondant à `.env`, puis importer le schéma et les données de démonstration :

   ```sh
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seeds.sql
   ```

   `seeds.sql` doit être exécuté une seule fois sur une base vide. Il crée des films, des cinémas, des sièges, des séances et des codes promo, mais **aucun compte de démonstration**.

5. Depuis `teskerti-api/`, lancer l'API :

   ```sh
   php -S localhost:8000 -t public public/index.php
   ```

6. Dans un autre terminal, lancer le frontend :

   ```sh
   cd ../teskerti
   php -S localhost:3000 -t .
   ```

   Ouvrir [http://localhost:3000](http://localhost:3000). L'URL de l'API est configurée dans `teskerti/js/config.js`; la valeur par défaut est `http://localhost:8000/api/v1`. `FRONTEND_URL` dans `.env` doit correspondre à l'origine du frontend.

### Lancement sous Windows

Double-cliquez sur `lancer-teskerti.bat`; `arreter-teskerti.bat` arrête proprement les services lancés par le script. Le lanceur attend PHP 8.4 dans `%LOCALAPPDATA%\TeskertiRuntime\php-8.4.26\php.exe`, ainsi que les extensions PHP et les données MariaDB dans un sous-dossier `mariadb-data-*` du même répertoire. Les exécutables MariaDB sont attendus dans `C:\xampp\mysql\bin`. Il vérifie les fichiers requis, la présence de tables de démonstration, l'état de santé de l'API et la réponse du frontend avant d'ouvrir le navigateur. Consultez `%LOCALAPPDATA%\TeskertiRuntime\logs` en cas d'erreur.

### Comptes et données de démonstration

Il n'y a pas de compte de connexion préconfiguré. L'inscription crée un utilisateur standard; aucun parcours dans l'interface ne crée un administrateur. L'ancien seed contenait un hash Argon2id factice et un commentaire suggérant un mot de passe de test, qui ont été retirés de cette copie. Pour les essais, les codes promo insérés par le seed sont `TESKERTI10`, `ETUDIANT5`, `BIENVENUE` et `PREMIUM20`; leurs seuils et dates de validité sont définis dans `teskerti-api/database/seeds.sql`.

## Limites et pistes d'amélioration

- Intégrer un prestataire de paiement réel dans un flux conforme, avec HTTPS; jusqu'alors, conserver l'avertissement de simulation et ne jamais utiliser de vraies cartes.
- Faire appliquer côté serveur l'expiration de réservation au paiement, et mettre en place un nettoyage ou une transition d'état des réservations expirées.
- Synchroniser le tarif présenté par le frontend avec les tarifs par zone de la séance calculés par l'API.
- Vérifier côté serveur que chaque siège sélectionné appartient à la salle de la séance.
- Finaliser le renouvellement JWT dans l'interface, la révocation au logout, les parcours « mot de passe oublié » et OAuth Google annoncés par certains éléments visuels.
- Générer et enregistrer réellement le QR code : le contrôleur prépare actuellement une référence/URL mais n'écrit pas de fichier image QR.
- Remplacer les origines CORS de développement par une configuration de production stricte et revoir le mode d'échec permissif du rate limiter.
- Ajouter des tests automatisés et des captures/une vidéo de démonstration.

Le script destructif `teskerti-api/database/clear_db.sql` n'est pas inclus : il tronque les tables de données. L'archive source `Teskerti.zip` n'est pas incluse.

## Licence

Licence à définir.
