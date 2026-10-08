<?php
declare(strict_types=1);

namespace App\Helpers;


class PasswordHelper
{
    private const OPTIONS = [
        'memory_cost' => 65536,  // 64MB
        'time_cost'   => 4,
        'threads'     => 3,
    ];

    /**
     * Hash a password with Argon2id (most secure option).
     */
    public static function hash(string $plain): string
    {
        return password_hash($plain, PASSWORD_ARGON2ID, self::OPTIONS);
    }

    /**
     * Verify a plain password against an Argon2id hash.
     */
    public static function verify(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    /**
     * Check if a hash needs re-hashing (after options change).
     */
    public static function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID, self::OPTIONS);
    }

    /**
     * Validate password strength.
     * Returns array of issues or empty array if valid.
     */
    public static function validate(string $password): array
    {
        $issues = [];
        if (strlen($password) < 8) {
            $issues[] = 'Minimum 8 caracteres';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $issues[] = 'Au moins une majuscule';
        }
        if (!preg_match('/[0-9]/', $password)) {
            $issues[] = 'Au moins un chiffre';
        }
        return $issues;
    }
}
