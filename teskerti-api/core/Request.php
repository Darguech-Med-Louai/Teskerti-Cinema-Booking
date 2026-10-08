<?php
declare(strict_types=1);

namespace App\Core;


class Request
{
    public readonly array  $params;   // URL path parameters {id}
    public readonly array  $query;    // GET query string params
    public readonly array  $body;     // Parsed JSON body
    public readonly array  $headers;  // HTTP headers
    public readonly string $method;   // HTTP method

    public function __construct(array $params = [])
    {
        $this->params  = $params;
        $this->query   = $_GET;
        $this->method  = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $raw           = file_get_contents('php://input') ?: '';
        $decoded       = json_decode($raw, true);
        $this->body    = is_array($decoded) ? $decoded : [];
        $this->headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
    }

    /**
     * Get a value from body or query string (body takes precedence).
     */
    public function get(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    /**
     * Get a URL path parameter {id}
     */
    public function param(string $key, mixed $default = null): mixed
    {
        return $this->params[$key] ?? $default;
    }

    /**
     * Extract Bearer token from Authorization header.
     */
    public function bearerToken(): ?string
    {
        $auth = $this->headers['Authorization']
             ?? $this->headers['authorization']
             ?? '';
        if (!str_starts_with($auth, 'Bearer ')) {
            return null;
        }
        return substr($auth, 7);
    }

    /**
     * Check if the request expects JSON.
     */
    public function isJson(): bool
    {
        $ct = $this->headers['Content-Type'] ?? $this->headers['content-type'] ?? '';
        return str_contains($ct, 'application/json');
    }
}
