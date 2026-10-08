<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;


class CinemaController
{
    /* --- GET /cinemas --- */
    public function index(Request $req): void
    {
        $db   = Database::get();
        $city = $req->get('city');

        if ($city) {
            $stmt = $db->prepare(
                'SELECT id, slug, name, city, address, phone, image_url,
                        (SELECT COUNT(*) FROM halls WHERE cinema_id=cinemas.id) AS halls_count
                 FROM cinemas WHERE is_active=1 AND city LIKE ?
                 ORDER BY name'
            );
            $stmt->execute(["%$city%"]);
        } else {
            $stmt = $db->query(
                'SELECT id, slug, name, city, address, phone, image_url,
                        (SELECT COUNT(*) FROM halls WHERE cinema_id=cinemas.id) AS halls_count
                 FROM cinemas WHERE is_active=1
                 ORDER BY city, name'
            );
        }

        Response::success($stmt->fetchAll());
    }

    /* --- GET /cinemas/{id} --- */
    public function show(Request $req): void
    {
        $id   = $req->param('id');
        $db   = Database::get();
        $stmt = $db->prepare(
            'SELECT c.*, 
                    (SELECT COUNT(*) FROM halls WHERE cinema_id=c.id) AS halls_count
             FROM cinemas c WHERE c.id=? OR c.slug=? LIMIT 1'
        );
        $stmt->execute([$id, $id]);
        $cinema = $stmt->fetch();

        if (!$cinema) {
            Response::error('Cinema introuvable', 404);
        }

        // Get halls
        $halls = $db->prepare('SELECT id, name, total_seats FROM halls WHERE cinema_id=?');
        $halls->execute([$cinema['id']]);
        $cinema['halls'] = $halls->fetchAll();

        Response::success($cinema);
    }

    /* --- GET /cinemas/{id}/sessions --- */
    public function sessions(Request $req): void
    {
        $id   = $req->param('id');
        $date = $req->get('date', date('Y-m-d'));
        $db   = Database::get();

        $stmt = $db->prepare(
            'SELECT s.id, s.starts_at, s.ends_at, s.language, s.format,
                    s.price_standard, s.price_premium,
                    m.id AS movie_id, m.title_fr, m.title_ar,
                    m.poster_url, m.duration_min, m.genre,
                    h.name AS hall_name
             FROM sessions s
             JOIN movies m ON m.id = s.movie_id
             JOIN halls  h ON h.id = s.hall_id
             WHERE s.cinema_id = ? AND s.is_active = 1
               AND DATE(s.starts_at) = ?
             ORDER BY s.starts_at ASC'
        );
        $stmt->execute([$id, $date]);
        Response::success($stmt->fetchAll());
    }
}
