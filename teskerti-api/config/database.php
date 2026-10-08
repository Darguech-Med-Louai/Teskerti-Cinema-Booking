<?php
declare(strict_types=1);

namespace App\Config;

use PDO;


class Database
{
    private static ?PDO $instance = null;

    public static function connect(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $_ENV['DB_HOST']    ?? '127.0.0.1',
            $_ENV['DB_PORT']    ?? '3306',
            $_ENV['DB_NAME']    ?? 'teskerti_db',
            $_ENV['DB_CHARSET'] ?? 'utf8mb4'
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND =>
                "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ];

        self::$instance = new PDO(
            $dsn,
            $_ENV['DB_USER'] ?? 'root',
            $_ENV['DB_PASS'] ?? '',
            $options
        );

        return self::$instance;
    }

    public static function get(): PDO
    {
        return self::connect();
    }
}
