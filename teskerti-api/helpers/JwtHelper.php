<?php
declare(strict_types=1);

namespace App\Helpers;


/**
 * JWT HS256 implementation -- no external library required.
 */
class JwtHelper
{
    private static function base64url_encode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64url_decode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }

    /**
     * Create a signed JWT token.
     */
    public static function encode(array $payload): string
    {
        $secret  = $_ENV['JWT_SECRET'] ?? 'change_me_in_production';
        $expiry  = (int)($_ENV['JWT_EXPIRY'] ?? 86400);

        $header  = self::base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload['iat'] = time();
        $payload['exp'] = time() + $expiry;

        $pl  = self::base64url_encode(json_encode($payload));
        $sig = self::base64url_encode(
            hash_hmac('sha256', "$header.$pl", $secret, true)
        );

        return "$header.$pl.$sig";
    }

    /**
     * Decode and verify a JWT token. Returns payload or null if invalid/expired.
     */
    public static function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $sig] = $parts;
        $secret   = $_ENV['JWT_SECRET'] ?? 'change_me_in_production';
        $expected = self::base64url_encode(
            hash_hmac('sha256', "$header.$payload", $secret, true)
        );

        // Timing-safe comparison
        if (!hash_equals($expected, $sig)) {
            return null;
        }

        $data = json_decode(self::base64url_decode($payload), true);
        if (!is_array($data)) {
            return null;
        }

        // Check expiration
        if (isset($data['exp']) && $data['exp'] < time()) {
            return null;
        }

        return $data;
    }

    /**
     * Generate a cryptographically secure refresh token.
     */
    public static function generateRefreshToken(): string
    {
        return bin2hex(random_bytes(32));
    }
}
