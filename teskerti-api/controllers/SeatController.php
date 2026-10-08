<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;
use PDO;


class SeatController
{
    /* --- GET /sessions/{id}/seats --- */
    public function availability(Request $req): void
    {
        $sessionId = (int)$req->param('id');
        $db        = Database::get();

        // Get session + hall
        $sessionStmt = $db->prepare(
            'SELECT s.*, h.id AS hall_id, h.name AS hall_name, h.total_seats,
                    m.title_fr, c.name AS cinema_name
             FROM sessions s
             JOIN halls   h ON h.id = s.hall_id
             JOIN movies  m ON m.id = s.movie_id
             JOIN cinemas c ON c.id = s.cinema_id
             WHERE s.id = ? LIMIT 1'
        );
        $sessionStmt->execute([$sessionId]);
        $session = $sessionStmt->fetch();

        if (!$session) {
            Response::error('Seance introuvable', 404);
        }

        // Get taken seat IDs for this session (Confirmed or Pending < 15min)
        $takenStmt = $db->prepare(
            "SELECT bs.seat_id
             FROM booking_seats bs
             JOIN bookings b ON b.id = bs.booking_id
             WHERE b.session_id = ?
               AND (
                   b.status = 'confirmed'
                   OR (b.status = 'pending' AND b.created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE))
               )"
        );
        $takenStmt->execute([$sessionId]);
        $takenIds = $takenStmt->fetchAll(PDO::FETCH_COLUMN);


        // Get all seats in hall
        $seatsStmt = $db->prepare(
            'SELECT id, zone, row_label, seat_num, is_pmr
             FROM seats WHERE hall_id = ?
             ORDER BY row_label ASC, seat_num ASC'
        );
        $seatsStmt->execute([$session['hall_id']]);
        $seats = $seatsStmt->fetchAll();

        // Build price map from session
        $priceMap = [
            'premium'  => (float)$session['price_premium'],
            'confort'  => (float)$session['price_confort'],
            'standard' => (float)$session['price_standard'],
            'balcon'   => (float)$session['price_balcon'],
        ];

        // Mark availability and attach price
        foreach ($seats as &$seat) {
            $seat['is_taken'] = in_array($seat['id'], $takenIds, true);
            $seat['price']    = $priceMap[$seat['zone']] ?? (float)$session['price_standard'];
        }
        unset($seat);

        Response::success([
            'session'      => [
                'id'         => $session['id'],
                'movie'      => $session['title_fr'],
                'cinema'     => $session['cinema_name'],
                'hall'       => $session['hall_name'],
                'starts_at'  => $session['starts_at'],
                'format'     => $session['format'],
                'language'   => $session['language'],
                'prices'     => $priceMap,
            ],
            'seats'        => $seats,
            'taken_count'  => count($takenIds),
            'total_seats'  => count($seats),
        ]);
    }
}
