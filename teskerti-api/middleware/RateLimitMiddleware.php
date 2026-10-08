<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Config\Database;
use App\Core\Response;


class RateLimitMiddleware
{
    /**
     * Sliding-window rate limiter backed by MySQL.
     * Blocks when requests exceed RATE_LIMIT_REQUESTS within RATE_LIMIT_WINDOW seconds.
     */
    public static function handle(): void
    {
        $ip       = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $endpoint = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        $limit    = (int)($_ENV['RATE_LIMIT_REQUESTS'] ?? 60);
        $window   = (int)($_ENV['RATE_LIMIT_WINDOW']   ?? 60);

        try {
            $db = Database::get();

            // Remove expired windows
            $db->prepare(
                'DELETE FROM rate_limits
                 WHERE window_start < DATE_SUB(NOW(), INTERVAL ? SECOND)'
            )->execute([$window]);

            // Check current count
            $stmt = $db->prepare(
                'SELECT id, requests FROM rate_limits
                 WHERE ip_address = ? AND endpoint = ?
                   AND window_start >= DATE_SUB(NOW(), INTERVAL ? SECOND)
                 LIMIT 1'
            );
            $stmt->execute([$ip, $endpoint, $window]);
            $row = $stmt->fetch();

            if (!$row) {
                // First request in window
                $db->prepare(
                    'INSERT INTO rate_limits (ip_address, endpoint, requests) VALUES (?, ?, 1)'
                )->execute([$ip, $endpoint]);
            } elseif ($row['requests'] >= $limit) {
                header('Retry-After: ' . $window);
                header('X-RateLimit-Limit: '     . $limit);
                header('X-RateLimit-Remaining: 0');
                Response::error(
                    'Trop de requetes. Reeessayez dans ' . $window . ' secondes.',
                    429
                );
            } else {
                $db->prepare(
                    'UPDATE rate_limits SET requests = requests + 1 WHERE id = ?'
                )->execute([$row['id']]);
            }

            // Expose headers
            $remaining = $limit - ($row['requests'] ?? 0) - 1;
            header('X-RateLimit-Limit: '     . $limit);
            header('X-RateLimit-Remaining: ' . max(0, $remaining));

        } catch (\Throwable $e) {
            // Fail open -- log but don't block the request
            error_log('[RateLimit] ' . $e->getMessage());
        }
    }
}
