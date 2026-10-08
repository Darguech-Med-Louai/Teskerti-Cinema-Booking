<?php
declare(strict_types=1);

namespace App\Core;

use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimitMiddleware;


class Router
{
    private array $routes = [];

    /* -- HTTP method helpers -- */
    public function get(string $path, array|callable $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, array|callable $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, array|callable $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    public function delete(string $path, array|callable $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    public function patch(string $path, array|callable $handler, array $middleware = []): void
    {
        $this->add('PATCH', $path, $handler, $middleware);
    }

    /* -- Internal registration -- */
    private function add(string $method, string $pattern, array|callable $handler, array $middleware): void
    {
        // Convert {param} -- named regex group
        $regex = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern);
        $this->routes[] = compact('method', 'regex', 'pattern', 'handler', 'middleware');
    }

    /* -- Dispatch -- */
    public function dispatch(): void
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        if ($uri !== '/' && str_ends_with($uri, '/')) {
            $uri = rtrim($uri, '/');
        }
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            $regex = '#^' . $route['regex'] . '$#i';
            if (!preg_match($regex, $uri, $matches)) {
                continue;
            }

            // Extract named params only
            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

            // Execute middleware stack
            foreach ($route['middleware'] as $mw) {
                match ($mw) {
                    'auth'       => AuthMiddleware::handle(),
                    'admin'      => AuthMiddleware::requireAdmin(),
                    'rate_limit' => RateLimitMiddleware::handle(),
                    default      => null,
                };
            }

            // Support both [ClassName, method] and callable closures
            $handler = $route['handler'];
            if (is_callable($handler)) {
                ($handler)(new Request($params));
                return;
            }

            [$class, $action] = $handler;
            if (!class_exists($class)) {
                Response::error("Controller {$class} not found", 500);
            }
            $controller = new $class();
            if (!method_exists($controller, $action)) {
                Response::error("Action {$action} not found in {$class}", 500);
            }
            $controller->$action(new Request($params));
            return;
        }

        Response::error('Route introuvable', 404);
    }
}
