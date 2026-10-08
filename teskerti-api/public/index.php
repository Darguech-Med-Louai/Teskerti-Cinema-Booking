<?php
declare(strict_types=1);

/*
 * ===============================================================
 * TESKERTI API -- Front Controller
 * ===============================================================
 */

use App\Core\Router;
use App\Core\Response;
use App\Config\Cors;

// 1. Load Composer + Env
require_once __DIR__ . '/../vendor/autoload.php';

(function () {
    $envFile = __DIR__ . '/../.env';
    if (!file_exists($envFile)) return;
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        if (str_contains($val, '#')) $val = trim(explode('#', $val, 2)[0]);
        $_ENV[trim($key)] = trim($val);
        putenv(trim($key) . '=' . trim($val));
    }
})();

// 2. Security Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Content-Type: application/json; charset=utf-8');

if (($_ENV['APP_ENV'] ?? 'development') === 'production') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
}

Cors::applyHeaders();

// 3. Error Handling
set_exception_handler(function (\Throwable $e) {
    Response::error(
        ($_ENV['APP_DEBUG'] ?? 'true') === 'true' ? $e->getMessage() : 'Erreur interne du serveur',
        500,
        ($_ENV['APP_DEBUG'] ?? 'true') === 'true' ? ['file' => $e->getFile() . ':' . $e->getLine()] : []
    );
});

set_error_handler(function (int $severity, string $message, string $file, int $line) {
    if (!(error_reporting() & $severity)) return false;
    throw new \ErrorException($message, 0, $severity, $file, $line);
});

// 4. Router Setup
$router = new Router();
$c = 'App\\Controllers\\';

/* --- AUTH --- */
$router->post('/api/v1/auth/register', [$c . 'AuthController', 'register']);
$router->post('/api/v1/auth/login',    [$c . 'AuthController', 'login']);
$router->post('/api/v1/auth/refresh',  [$c . 'AuthController', 'refresh']);
$router->post('/api/v1/auth/logout',   [$c . 'AuthController', 'logout'], ['auth']);
$router->get ('/api/v1/auth/me',       [$c . 'AuthController', 'me'],     ['auth']);

/* --- MOVIES --- */
$router->get   ('/api/v1/movies',               [$c . 'MovieController', 'index']);
$router->get   ('/api/v1/movies/{id}',          [$c . 'MovieController', 'show']);
$router->get   ('/api/v1/movies/{id}/sessions', [$c . 'MovieController', 'sessions']);
$router->post  ('/api/v1/movies',               [$c . 'MovieController', 'store'],   ['auth', 'admin']);
$router->put   ('/api/v1/movies/{id}',          [$c . 'MovieController', 'update'],  ['auth', 'admin']);
$router->delete('/api/v1/movies/{id}',          [$c . 'MovieController', 'destroy'], ['auth', 'admin']);

/* --- CINEMAS --- */
$router->get('/api/v1/cinemas',               [$c . 'CinemaController', 'index']);
$router->get('/api/v1/cinemas/{id}',          [$c . 'CinemaController', 'show']);
$router->get('/api/v1/cinemas/{id}/sessions', [$c . 'CinemaController', 'sessions']);

/* --- SESSIONS --- */
$router->get ('/api/v1/sessions/{id}',       [$c . 'SessionController', 'show']);
$router->get ('/api/v1/sessions/{id}/seats', [$c . 'SeatController',    'availability']);
$router->post('/api/v1/sessions',            [$c . 'SessionController', 'store'], ['auth', 'admin']);

/* --- BOOKINGS --- */
$router->post('/api/v1/bookings',                [$c . 'BookingController', 'create'],        ['auth']);
$router->get ('/api/v1/bookings',                [$c . 'BookingController', 'myBookings'],    ['auth']);
$router->post('/api/v1/bookings/validate-promo', [$c . 'BookingController', 'validatePromo'], ['auth']);
$router->get ('/api/v1/bookings/{ref}',          [$c . 'BookingController', 'show'],          ['auth']);

/* --- PAYMENTS --- */
$router->post('/api/v1/payments/process',     [$c . 'PaymentController', 'process'], ['auth', 'rate_limit']);
$router->get ('/api/v1/payments/{id}/status', [$c . 'PaymentController', 'status'],  ['auth']);
$router->post('/api/v1/payments/{id}/refund', [$c . 'PaymentController', 'refund'],  ['auth', 'admin']);

/* --- SYSTEM --- */
$router->get('/' , function() { Response::success(['status' => 'online'], 'Teskerti API'); });
$router->get('/api/v1', function() { Response::success(['version' => '1.0.0'], 'Teskerti API v1'); });
$router->get('/api/v1/health', [$c . 'HealthController', 'check']);

$router->dispatch();
