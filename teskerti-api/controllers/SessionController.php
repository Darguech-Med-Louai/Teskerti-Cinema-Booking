<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;


class SessionController
{
    /* --- GET /sessions/{id} --- */
    public function show(Request $req): void
    {
        $id   = $req->param('id');
        $db   = Database::get();
        $stmt = $db->prepare(
            'SELECT s.*, m.title_fr, m.title_ar, m.poster_url,
                    m.duration_min, m.synopsis,
                    c.name AS cinema_name, c.address AS cinema_address,
                    h.name AS hall_name, h.total_seats
             FROM sessions s
             JOIN movies  m ON m.id = s.movie_id
             JOIN cinemas c ON c.id = s.cinema_id
             JOIN halls   h ON h.id = s.hall_id
             WHERE s.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $session = $stmt->fetch();

        if (!$session) {
            Response::error('Seance introuvable', 404);
        }

        Response::success($session);
    }

    /* --- POST /sessions (admin) --- */
    public function store(Request $req): void
    {
        $d  = $req->body;
        $db = Database::get();

        $required = ['movie_id', 'cinema_id', 'hall_id', 'starts_at'];
        foreach ($required as $field) {
            if (empty($d[$field])) {
                Response::error("Champ requis : $field", 422);
            }
        }

        $startsAt = new \DateTime($d['starts_at']);
        $duration = (int)($d['duration_min'] ?? 120);
        $endsAt   = (clone $startsAt)->modify("+{$duration} minutes");

        $stmt = $db->prepare(
            'INSERT INTO sessions
             (movie_id, cinema_id, hall_id, starts_at, ends_at, language, format,
              price_premium, price_confort, price_standard, price_balcon)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $d['movie_id'],
            $d['cinema_id'],
            $d['hall_id'],
            $startsAt->format('Y-m-d H:i:s'),
            $endsAt->format('Y-m-d H:i:s'),
            $d['language']       ?? 'AR',
            $d['format']         ?? '2D',
            $d['price_premium']  ?? 25.000,
            $d['price_confort']  ?? 19.000,
            $d['price_standard'] ?? 15.000,
            $d['price_balcon']   ?? 12.000,
        ]);

        Response::success(['id' => (int)$db->lastInsertId()], 'Seance creee', 201);
    }
}
