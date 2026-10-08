<?php
declare(strict_types=1);

namespace App\Config;

class Cors
{
    public static function applyHeaders(): void
    {
        $allowed = array_map('trim', explode(',', $_ENV['FRONTEND_URL'] ?? 'http://localhost:3000'));
        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (in_array($origin, $allowed, true) || ($allowed[0] ?? '') === '*') {
            header('Access-Control-Allow-Origin: ' . ($origin ?: $allowed[0]));
        } else {
            // Dev fallback : autoriser localhost
            if (str_starts_with($origin, 'http://localhost')) {
                header('Access-Control-Allow-Origin: ' . $origin);
            }
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
        header('Vary: Origin');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}

