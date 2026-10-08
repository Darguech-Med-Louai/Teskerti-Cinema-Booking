# TESKERTI API — Backend

API REST en PHP avec front controller, routeur personnalisé, contrôleurs, helpers et middleware. Les données sont stockées dans MySQL ou MariaDB.

## Sécurité implémentée

- Les mots de passe créés par l'API sont hachés avec Argon2id.
- Les JWT sont signés en HS256. Les refresh tokens à usage unique sont stockés sous forme de hash et renouvelés par rotation.
- Le middleware protège les opérations utilisateur et administrateur prévues dans le routeur.
- Les écritures de réservation et de paiement utilisent des transactions; le code de réservation verrouille la ligne de séance avec `FOR UPDATE`.
- CORS, en-têtes HTTP de sécurité et limitation MySQL des requêtes sur le traitement du paiement sont configurés.

Ces protections ne transforment pas l'application en service prêt pour la production : la valeur du secret JWT doit être changée, la règle CORS de développement est permissive pour `localhost`, et le rate limiter échoue en mode permissif en cas d'erreur de base de données.

## Réservation et paiement

L'API recalcule les tarifs des sièges à partir de la séance et enregistre les réservations à l'état `pending`. Les contrôles de disponibilité cessent de bloquer leurs sièges après 15 minutes, mais ne modifient pas automatiquement leur état; l'endpoint de paiement n'impose pas non plus ce délai.

Le paiement et le remboursement sont des simulations : aucun fournisseur n'est contacté et le paiement valide réussit toujours. Le contrôleur persiste la marque et les quatre derniers chiffres de carte, mais pas le numéro complet, la date d'expiration ou le CVV. N'utilisez jamais de données bancaires réelles.

## Installation

1. Installer PHP 8.2+ avec `pdo_mysql`, `mbstring` et `openssl`, MySQL 8+ ou MariaDB 10.6+, et Composer.
2. Dans ce dossier, exécuter `composer install`.
3. Copier `.env.example` vers `.env` et renseigner les paramètres de la base, un long `JWT_SECRET` aléatoire et les origines locales. Laisser `APP_DEBUG=false` en dehors des essais locaux.
4. Créer la base et son utilisateur, puis importer `database/schema.sql` et `database/seeds.sql`. Les seeds créent du contenu de démonstration, des séances et des promotions, mais aucun compte administrateur.
5. Lancer l'API depuis ce dossier :

   ```sh
   php -S localhost:8000 -t public public/index.php
   ```

Les routes et leurs niveaux d'accès sont récapitulés dans le [README racine](../README.md).

Réalisé par Mohamed Louai Darguech.
