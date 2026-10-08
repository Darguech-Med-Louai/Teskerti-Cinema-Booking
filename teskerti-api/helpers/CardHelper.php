<?php
declare(strict_types=1);

namespace App\Helpers;


/**
 * Visa card validation helper.
 * Implements Luhn algorithm, BIN check, expiry and CVV validation.
 */
class CardHelper
{
    /**
     * Verify card is Visa (BIN starts with 4, exactly 16 digits).
     */
    public static function isVisa(string $number): bool
    {
        $n = preg_replace('/\D/', '', $number);
        return strlen($n) === 16 && $n[0] === '4';
    }

    /**
     * Luhn algorithm -- industry-standard card number checksum.
     */
    public static function luhn(string $number): bool
    {
        $n      = preg_replace('/\D/', '', $number);
        $len    = strlen($n);
        $sum    = 0;
        $parity = $len % 2;

        for ($i = 0; $i < $len; $i++) {
            $d = (int)$n[$i];
            if ($i % 2 === $parity) {
                $d *= 2;
            }
            if ($d > 9) {
                $d -= 9;
            }
            $sum += $d;
        }

        return $sum % 10 === 0;
    }

    /**
     * Check if card expiry date is past (MM/YY format).
     */
    public static function isExpired(string $expiry): bool
    {
        if (!preg_match('/^(\d{2})\/(\d{2})$/', $expiry, $m)) {
            return true;
        }
        $month = (int)$m[1];
        $year  = 2000 + (int)$m[2];

        if ($month < 1 || $month > 12) {
            return true;
        }

        // Card is valid until end of expiry month
        $expTimestamp = mktime(0, 0, 0, $month + 1, 1, $year);
        return $expTimestamp <= time();
    }

    /**
     * Full card validation. Returns array of field errors.
     */
    public static function validate(array $card): array
    {
        $errors = [];
        $number = $card['number'] ?? '';
        $holder = strtoupper(trim($card['holder'] ?? ''));
        $expiry = $card['expiry'] ?? '';
        $cvv    = $card['cvv']    ?? '';

        // Number
        if (!self::isVisa($number)) {
            $errors['number'] = 'Carte Visa invalide (16 chiffres commencant par 4)';
        } elseif (!self::luhn($number)) {
            $errors['number'] = 'Numero de carte invalide (checksum Luhn)';
        }

        // Holder name
        if (empty($holder) || !preg_match('/^[A-Z\s\-]{3,26}$/u', $holder)) {
            $errors['holder'] = 'Nom du titulaire invalide (lettres majuscules uniquement)';
        }

        // Expiry
        if (self::isExpired($expiry)) {
            $errors['expiry'] = 'Carte expiree ou date invalide (format MM/AA)';
        }

        // CVV
        if (!preg_match('/^\d{3}$/', $cvv)) {
            $errors['cvv'] = 'CVV invalide (3 chiffres au verso de la carte)';
        }

        return $errors;
    }

    /**
     * Return last 4 digits only -- NEVER store full card number.
     */
    public static function mask(string $number): string
    {
        $n = preg_replace('/\D/', '', $number);
        return substr($n, -4);
    }
}
