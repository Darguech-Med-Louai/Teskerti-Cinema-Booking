<?php
declare(strict_types=1);

namespace App\Core;


class Response
{
    private const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT;

    /**
     * Generic JSON response.
     */
    public static function json(mixed $data, int $code = 200): never
    {
        http_response_code($code);
        echo json_encode($data, self::JSON_FLAGS);
        exit;
    }

    /**
     * Successful response wrapper.
     */
    public static function success(mixed $data, string $message = 'OK', int $code = 200): never
    {
        http_response_code($code);
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], self::JSON_FLAGS);
        exit;
    }

    /**
     * Error response wrapper.
     */
    public static function error(string $message, int $code = 400, array $errors = []): never
    {
        http_response_code($code);
        $body = [
            'success' => false,
            'error'   => $message,
        ];
        if (!empty($errors)) {
            $body['errors'] = $errors;
        }
        echo json_encode($body, self::JSON_FLAGS);
        exit;
    }

    /**
     * Pagination response wrapper.
     */
    public static function paginate(array $items, int $total, int $page, int $perPage): never
    {
        http_response_code(200);
        echo json_encode([
            'success'     => true,
            'data'        => $items,
            'pagination'  => [
                'total'       => $total,
                'page'        => $page,
                'per_page'    => $perPage,
                'total_pages' => (int)ceil($total / $perPage),
            ],
        ], self::JSON_FLAGS);
        exit;
    }
}
