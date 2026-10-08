<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;


class HealthController
{
    public function check(Request $req): void
    {
        $dbStatus = 'ok';
        try {
            Database::get()->query('SELECT 1');
        } catch (\Throwable $e) {
            $dbStatus = 'error: ' . $e->getMessage();
        }

        Response::success([
            'status'   => 'ok',
            'version'  => '1.0.0',
            'php'      => PHP_VERSION,
            'database' => $dbStatus,
            'time'     => date('c'),
        ]);
    }
}
