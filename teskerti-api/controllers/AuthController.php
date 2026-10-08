<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;
use App\Helpers\PasswordHelper;
use App\Helpers\JwtHelper;
use App\Middleware\AuthMiddleware;


class AuthController
{
    /* --------------------------- REGISTER --------------------------- */
    public function register(Request $req): void
    {
        $data = $req->body;

        // Validation
        $errors = [];
        if (empty(trim($data['first_name'] ?? '')))  $errors['first_name'] = 'Prenom requis';
        if (empty(trim($data['last_name']  ?? '')))  $errors['last_name']  = 'Nom requis';
        if (!filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL))
            $errors['email'] = 'Email invalide';
        if (strlen($data['password'] ?? '') < 8)
            $errors['password'] = 'Mot de passe minimum 8 caracteres';

        if ($errors) {
            Response::error('Donnees invalides', 422, $errors);
        }

        $db = Database::get();

        // Unique email check
        $check = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $check->execute([strtolower(trim($data['email']))]);
        if ($check->fetch()) {
            Response::error('Cet email est deja utilise', 409);
        }

        // Insert user
        $hash = PasswordHelper::hash($data['password']);
        $stmt = $db->prepare(
            'INSERT INTO users (first_name, last_name, email, phone, password_hash)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            trim($data['first_name']),
            trim($data['last_name']),
            strtolower(trim($data['email'])),
            !empty($data['phone']) ? trim($data['phone']) : null,
            $hash,
        ]);
        $userId = (int)$db->lastInsertId();

        $name  = trim($data['first_name']) . ' ' . trim($data['last_name']);
        $token = JwtHelper::encode([
            'sub'   => $userId,
            'email' => strtolower(trim($data['email'])),
            'role'  => 'user',
            'name'  => $name,
        ]);

        Response::success([
            'token' => $token,
            'user'  => [
                'id'       => $userId,
                'name'     => $name,
                'email'    => strtolower(trim($data['email'])),
                'role'     => 'user',
                'initials' => strtoupper(mb_substr($data['first_name'], 0, 1) . mb_substr($data['last_name'], 0, 1)),
            ],
        ], 'Compte cree avec succes', 201);
    }

    /* --------------------------- LOGIN ------------------------------ */
    public function login(Request $req): void
    {
        $email    = strtolower(trim($req->get('email', '')));
        $password = $req->get('password', '');

        if (!$email || !$password) {
            Response::error('Email et mot de passe requis', 422);
        }

        $db   = Database::get();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !PasswordHelper::verify($password, $user['password_hash'])) {
            Response::error('Identifiants incorrects', 401);
        }

        // Rehash if needed (after security upgrade)
        if (PasswordHelper::needsRehash($user['password_hash'])) {
            $newHash = PasswordHelper::hash($password);
            $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
               ->execute([$newHash, $user['id']]);
        }

        $name  = $user['first_name'] . ' ' . $user['last_name'];
        $token = JwtHelper::encode([
            'sub'   => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'name'  => $name,
        ]);

        // Store refresh token
        $refresh     = JwtHelper::generateRefreshToken();
        $refreshHash = hash('sha256', $refresh);
        $db->prepare(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        )->execute([$user['id'], $refreshHash, (int)($_ENV['JWT_REFRESH_EXPIRY'] ?? 604800)]);

        Response::success([
            'token'         => $token,
            'refresh_token' => $refresh,
            'user'          => [
                'id'       => $user['id'],
                'name'     => $name,
                'email'    => $user['email'],
                'role'     => $user['role'],
                'initials' => strtoupper(mb_substr($user['first_name'], 0, 1) . mb_substr($user['last_name'], 0, 1)),
            ],
        ], 'Connexion reussie');
    }

    /* --------------------------- REFRESH ---------------------------- */
    public function refresh(Request $req): void
    {
        $raw = $req->get('refresh_token', '');
        if (!$raw) {
            Response::error('Refresh token requis', 422);
        }

        $hash = hash('sha256', $raw);
        $db   = Database::get();

        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'SELECT rt.*, u.id as user_id, u.email, u.role, u.first_name, u.last_name
                 FROM refresh_tokens rt
                 JOIN users u ON u.id = rt.user_id
                 WHERE rt.token_hash = ? AND rt.expires_at > NOW()
                 LIMIT 1 FOR UPDATE'
            );
            $stmt->execute([$hash]);
            $row = $stmt->fetch();

            if (!$row) {
                $db->rollBack();
                Response::error('Refresh token invalide ou expire', 401);
            }

            // 1. Generate new tokens
            $newToken = JwtHelper::encode([
                'sub'   => $row['user_id'],
                'email' => $row['email'],
                'role'  => $row['role'],
                'name'  => $row['first_name'] . ' ' . $row['last_name'],
            ]);
            $newRefresh = JwtHelper::generateRefreshToken();
            $newHash    = hash('sha256', $newRefresh);

            // 2. Rotate: Delete old, Insert new
            $db->prepare('DELETE FROM refresh_tokens WHERE id = ?')->execute([$row['id']]);
            $db->prepare(
                'INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
            )->execute([
                $row['user_id'], 
                $newHash, 
                (int)($_ENV['JWT_REFRESH_EXPIRY'] ?? 604800)
            ]);

            $db->commit();

            Response::success([
                'token'         => $newToken,
                'refresh_token' => $newRefresh
            ], 'Token renouvele avec succes (rotation active)');

        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('[Auth] Refresh failed: ' . $e->getMessage());
            Response::error('Erreur lors du renouvellement du token', 500);
        }
    }


    /* --------------------------- LOGOUT ----------------------------- */
    public function logout(Request $req): void
    {
        $raw = $req->get('refresh_token', '');
        if ($raw) {
            $hash = hash('sha256', $raw);
            Database::get()
                ->prepare('DELETE FROM refresh_tokens WHERE token_hash = ?')
                ->execute([$hash]);
        }
        Response::success(null, 'Deconnexion reussie');
    }

    /* --------------------------- ME --------------------------------- */
    public function me(Request $req): void
    {
        $user = AuthMiddleware::currentUser();
        $db   = Database::get();
        $stmt = $db->prepare(
            'SELECT id, first_name, last_name, email, phone, role, is_verified, created_at
             FROM users WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$user['sub']]);
        $userData = $stmt->fetch();

        if (!$userData) {
            Response::error('Utilisateur introuvable', 404);
        }

        $userData['name']     = $userData['first_name'] . ' ' . $userData['last_name'];
        $userData['initials'] = strtoupper(
            mb_substr($userData['first_name'], 0, 1) .
            mb_substr($userData['last_name'],  0, 1)
        );
        unset($userData['password_hash']);

        Response::success($userData);
    }
}
