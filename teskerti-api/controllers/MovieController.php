<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;


class MovieController
{
    /* --- GET /movies --- */
    public function index(Request $req): void
    {
        $db = Database::get();

        $where  = ['1=1'];
        $params = [];

        // Filter: now_playing
        if ($req->get('now_playing') !== null) {
            $active   = (int)(bool)$req->get('now_playing');
            $where[]  = 'm.is_active = ?';
            $params[] = $active;
        }

        // Filter: genre
        if ($genre = $req->get('genre')) {
            $where[]  = 'm.genre = ?';
            $params[] = $genre;
        }

        // Search by title
        if ($q = $req->get('q')) {
            $where[]  = '(m.title_fr LIKE ? OR m.title_ar LIKE ?)';
            $params[] = "%$q%";
            $params[] = "%$q%";
        }

        $whereStr = implode(' AND ', $where);
        $stmt = $db->prepare(
            "SELECT m.id, m.slug, m.title_fr, m.title_ar,
                    m.genre, m.duration_min, m.rating,
                    m.poster_url, m.hero_bg_url, m.release_date,
                    m.synopsis, m.director, m.language, m.is_active
             FROM movies m
             WHERE $whereStr
             ORDER BY m.release_date DESC"
        );
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    /* --- GET /movies/{id} --- */
    public function show(Request $req): void
    {
        $id = $req->param('id');
        $db = Database::get();

        $stmt = $db->prepare(
            'SELECT * FROM movies WHERE id = ? OR slug = ? LIMIT 1'
        );
        $stmt->execute([$id, $id]);
        $movie = $stmt->fetch();

        if (!$movie) {
            Response::error('Film introuvable', 404);
        }

        // Decode JSON cast_list if present
        if (!empty($movie['cast_list'])) {
            $movie['cast_list'] = json_decode($movie['cast_list'], true);
        }

        Response::success($movie);
    }

    /* --- GET /movies/{id}/sessions --- */
    public function sessions(Request $req): void
    {
        $id = $req->param('id');
        $db = Database::get();

        $stmt = $db->prepare(
            'SELECT s.id, s.starts_at, s.ends_at, s.language, s.format,
                    s.price_premium, s.price_confort, s.price_standard,
                    s.price_balcon, c.name AS cinema_name, c.city,
                    h.name AS hall_name
             FROM sessions s
             JOIN cinemas c ON c.id = s.cinema_id
             JOIN halls   h ON h.id = s.hall_id
             WHERE s.movie_id = ? AND s.is_active = 1
               AND s.starts_at > NOW()
             ORDER BY s.starts_at ASC'
        );
        $stmt->execute([$id]);
        Response::success($stmt->fetchAll());
    }

    /* --- POST /movies (admin) --- */
    public function store(Request $req): void
    {
        $d = $req->body;
        $db = Database::get();

        $slug = $d['slug'] ?? strtolower(str_replace(' ', '-', $d['title_fr'] ?? ''));

        $stmt = $db->prepare(
            'INSERT INTO movies
             (slug, title_ar, title_fr, synopsis, director, genre,
              rating, duration_min, release_date, poster_url, is_active)
             VALUES (?,?,?,?,?,?,?,?,?,?,1)'
        );
        $stmt->execute([
            $slug,
            $d['title_ar']     ?? $d['title_fr'] ?? '',
            $d['title_fr']     ?? '',
            $d['synopsis']     ?? '',
            $d['director']     ?? '',
            $d['genre']        ?? '',
            $d['rating']       ?? 0.0,
            $d['duration_min'] ?? 90,
            $d['release_date'] ?? date('Y-m-d'),
            $d['poster_url']   ?? null,
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Film cree', 201);
    }

    /* --- PUT /movies/{id} (admin) --- */
    public function update(Request $req): void
    {
        $id = $req->param('id');
        $d  = $req->body;
        $db = Database::get();

        $db->prepare(
            'UPDATE movies
             SET title_fr=?, title_ar=?, synopsis=?, director=?,
                 genre=?, rating=?, duration_min=?, poster_url=?, is_active=?
             WHERE id=?'
        )->execute([
            $d['title_fr']     ?? '',
            $d['title_ar']     ?? '',
            $d['synopsis']     ?? '',
            $d['director']     ?? '',
            $d['genre']        ?? '',
            $d['rating']       ?? 0.0,
            $d['duration_min'] ?? 90,
            $d['poster_url']   ?? null,
            $d['is_active']    ?? 1,
            $id,
        ]);

        Response::success(null, 'Film mis a jour');
    }

    /* --- DELETE /movies/{id} (admin) --- */
    public function destroy(Request $req): void
    {
        $id = $req->param('id');
        Database::get()
            ->prepare('UPDATE movies SET is_active = 0 WHERE id = ?')
            ->execute([$id]);
        Response::success(null, 'Film desactive');
    }
}
