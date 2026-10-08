<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\JwtHelper;


class AuthMiddleware
{
    /**
     * Validate JWT Bearer token. Stores payload in $GLOBALS['auth_user'].
     * Calls Response::error() and exits on failure.
     */
    public static function handle(): array
    {
        $req   = new Request();
        $token = $req->bearerToken();

        if (!$token) {
            Response::error('Token d\'authentification manquant', 401);
        }

        $payload = JwtHelper::decode($token);
        if (!$payload) {
            Response::error('Token invalide ou expire', 401);
        }

        // Store for downstream use
        $GLOBALS['auth_user'] = $payload;
        return $payload;
    }

    /**
     * Require authenticated user to have 'admin' role.
     */
    public static function requireAdmin(): void
    {
        $user = $GLOBALS['auth_user'] ?? null;
        if (!$user || ($user['role'] ?? 'user') !== 'admin') {
            Response::error('Acces reserve aux administrateurs', 403);
        }
    }

    /**
     * Get currently authenticated user payload.
     */
    public static function currentUser(): ?array
    {
        return $GLOBALS['auth_user'] ?? null;
    }
}
