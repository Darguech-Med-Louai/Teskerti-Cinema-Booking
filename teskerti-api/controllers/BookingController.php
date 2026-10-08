<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;
use App\Middleware\AuthMiddleware;
use PDO;


class BookingController
{
    private const SERVICE_FEE   = 1.000;
    private const MAX_SEATS     = 8;

    /* --- POST /bookings --- */
    public function create(Request $req): void
    {
        $user = AuthMiddleware::currentUser();
        $d    = $req->body;
        $db   = Database::get();

        $sessionId = (int)($d['session_id'] ?? 0);
        $seatIds   = array_map('intval', $d['seat_ids'] ?? []);
        $tickets   = $d['tickets']   ?? [];   // [{seat_id, type}]
        $promoCode = strtoupper(trim($d['promo_code'] ?? ''));

        // Validation
        if (!$sessionId)         Response::error('session_id requis', 422);
        if (empty($seatIds))     Response::error('Selectionnez au moins un siege', 422);
        if (count($seatIds) > self::MAX_SEATS)
            Response::error('Maximum ' . self::MAX_SEATS . ' places par reservation', 422);

        // -- Atomic transaction start -----------------------------
        $db->beginTransaction();
        try {
            // 1. Lock session row to serialize bookings for this session
            $sessStmt = $db->prepare(
                'SELECT id, price_premium, price_confort, price_standard, price_balcon 
                 FROM sessions WHERE id = ? AND is_active = 1 AND starts_at > NOW() 
                 LIMIT 1 FOR UPDATE'
            );
            $sessStmt->execute([$sessionId]);
            $session = $sessStmt->fetch();
            if (!$session) {
                throw new \Exception('Seance introuvable ou deja passee', 404);
            }

            // 2. Check if seats are already taken or locked (pending < 15min)
            $ph      = implode(',', array_fill(0, count($seatIds), '?'));
            $taken   = $db->prepare(
                "SELECT bs.seat_id FROM booking_seats bs
                 JOIN bookings b ON b.id = bs.booking_id
                 WHERE bs.seat_id IN ($ph)
                   AND b.session_id = ?
                   AND (
                        b.status = 'confirmed' 
                        OR (b.status = 'pending' AND b.created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE))
                   )"
            );
            $taken->execute([...$seatIds, $sessionId]);
            $takenIds = $taken->fetchAll(PDO::FETCH_COLUMN);

            if ($takenIds) {
                Response::error('Certains sieges sont deja reserves ou en cours de paiement', 409, ['taken' => $takenIds]);
                $db->rollBack();
                return;
            }


        // Get seat zones for pricing
        $seatsStmt = $db->prepare(
            "SELECT id, zone FROM seats WHERE id IN ($ph)"
        );
        $seatsStmt->execute($seatIds);
        $seatZones = array_column($seatsStmt->fetchAll(), 'zone', 'id');

        $priceMap = [
            'premium'  => (float)$session['price_premium'],
            'confort'  => (float)$session['price_confort'],
            'standard' => (float)$session['price_standard'],
            'balcon'   => (float)$session['price_balcon'],
        ];

        // Build ticket map
        $ticketMap = [];
        foreach ($tickets as $t) {
            $ticketMap[(int)($t['seat_id'] ?? 0)] = $t['type'] ?? 'normal';
        }

        // Calculate subtotal
        $subtotal = 0.0;
        foreach ($seatIds as $sid) {
            $zone      = $seatZones[$sid] ?? 'standard';
            $basePrice = $priceMap[$zone];
            $type      = $ticketMap[$sid] ?? 'normal';
            $unitPrice = match ($type) {
                'senior', 'etudiant' => $basePrice - 3.000,
                'enfant'             => $basePrice - 6.000,
                default              => $basePrice,
            };
            $subtotal += max(0, $unitPrice);
        }

        // Promo code
        $discount = 0.0;
        $promoId  = null;
        if ($promoCode) {
            $promoStmt = $db->prepare(
                'SELECT * FROM promo_codes WHERE code = ? AND is_active = 1
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND (uses_limit IS NULL OR uses_count < uses_limit)
                 LIMIT 1'
            );
            $promoStmt->execute([$promoCode]);
            $promo = $promoStmt->fetch();
            if ($promo && $subtotal >= (float)$promo['min_amount']) {
                $promoId  = $promo['id'];
                $discount = $promo['discount_type'] === 'percent'
                    ? $subtotal * ((float)$promo['discount_value'] / 100)
                    : (float)$promo['discount_value'];
            }
        }

        $total = max(0.0, round($subtotal + self::SERVICE_FEE - $discount, 3));

        // Generate unique booking reference
        do {
            $ref      = 'TSK-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $refCheck = $db->prepare('SELECT id FROM bookings WHERE reference = ?');
            $refCheck->execute([$ref]);
        } while ($refCheck->fetch());

        $db->prepare(
            'INSERT INTO bookings
             (reference, user_id, session_id, status, subtotal,
              service_fee, promo_code, discount, total)
             VALUES (?,?,?,?,?,?,?,?,?)'
        )->execute([
            $ref, $user['sub'], $sessionId, 'pending',
            round($subtotal, 3), self::SERVICE_FEE,
            $promoCode ?: null, round($discount, 3), $total,
        ]);
        $bookingId = (int)$db->lastInsertId();

        // Insert booking seats
        foreach ($seatIds as $sid) {
            $zone      = $seatZones[$sid] ?? 'standard';
            $basePrice = $priceMap[$zone];
            $type      = $ticketMap[$sid] ?? 'normal';
            $unitPrice = match ($type) {
                'senior', 'etudiant' => $basePrice - 3.000,
                'enfant'             => $basePrice - 6.000,
                default              => $basePrice,
            };
            $db->prepare(
                'INSERT INTO booking_seats (booking_id, seat_id, ticket_type, unit_price)
                 VALUES (?,?,?,?)'
            )->execute([$bookingId, $sid, $type, max(0, $unitPrice)]);
        }

        // Increment promo usage
        if ($promoId) {
            $db->prepare('UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = ?')
               ->execute([$promoId]);
        }

        $db->commit();
    } catch (\Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[Booking] Error: ' . $e->getMessage());
        Response::error(
            $e->getCode() === 409 ? $e->getMessage() : 'Erreur lors de la creation de la reservation',
            (int)($e->getCode() ?: 500)
        );
    }


        Response::success([
            'booking_ref' => $ref,
            'booking_id'  => $bookingId,
            'subtotal'    => round($subtotal, 3),
            'service_fee' => self::SERVICE_FEE,
            'discount'    => round($discount, 3),
            'total'       => $total,
            'currency'    => 'TND',
            'status'      => 'pending',
            'expires_in'  => 900, // 15 min to complete payment
        ], 'Reservation creee -- procedez au paiement', 201);
    }

    /* --- GET /bookings --- */
    public function myBookings(Request $req): void
    {
        $user = AuthMiddleware::currentUser();
        $db   = Database::get();
        $stmt = $db->prepare(
            'SELECT b.reference, b.status, b.total, b.created_at,
                    m.title_fr AS movie_title, m.poster_url,
                    c.name AS cinema_name, s.starts_at
             FROM bookings b
             JOIN sessions s ON s.id = b.session_id
             JOIN movies   m ON m.id = s.movie_id
             JOIN cinemas  c ON c.id = s.cinema_id
             WHERE b.user_id = ?
             ORDER BY b.created_at DESC'
        );
        $stmt->execute([$user['sub']]);
        Response::success($stmt->fetchAll());
    }

    /* --- GET /bookings/{ref} --- */
    public function show(Request $req): void
    {
        $ref  = $req->param('ref');
        $user = AuthMiddleware::currentUser();
        $db   = Database::get();

        $stmt = $db->prepare(
            'SELECT b.*, m.title_fr, m.poster_url, m.duration_min,
                    c.name AS cinema_name, c.address AS cinema_address,
                    s.starts_at, s.format, s.language AS session_language
             FROM bookings b
             JOIN sessions s ON s.id = b.session_id
             JOIN movies   m ON m.id = s.movie_id
             JOIN cinemas  c ON c.id = s.cinema_id
             WHERE b.reference = ? AND b.user_id = ? LIMIT 1'
        );
        $stmt->execute([$ref, $user['sub']]);
        $booking = $stmt->fetch();

        if (!$booking) Response::error('Reservation introuvable', 404);

        // Attach seats
        $seats = $db->prepare(
            'SELECT s.row_label, s.seat_num, s.zone, bs.ticket_type, bs.unit_price
             FROM booking_seats bs JOIN seats s ON s.id = bs.seat_id
             WHERE bs.booking_id = ?'
        );
        $seats->execute([$booking['id']]);
        $booking['seats'] = $seats->fetchAll();

        // Attach payment if exists
        $pay = $db->prepare(
            'SELECT transaction_ref, status, card_last4, processed_at
             FROM payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1'
        );
        $pay->execute([$booking['id']]);
        $booking['payment'] = $pay->fetch() ?: null;

        Response::success($booking);
    }

    /* --- POST /bookings/validate-promo --- */
    public function validatePromo(Request $req): void
    {
        $code   = strtoupper(trim($req->get('code', '')));
        $amount = (float)$req->get('amount', 0);

        if (!$code) Response::error('Code requis', 422);

        $db   = Database::get();
        $stmt = $db->prepare(
            'SELECT * FROM promo_codes WHERE code = ? AND is_active = 1
             AND (expires_at IS NULL OR expires_at > NOW())
             AND (uses_limit IS NULL OR uses_count < uses_limit)
             LIMIT 1'
        );
        $stmt->execute([$code]);
        $promo = $stmt->fetch();

        if (!$promo) Response::error('Code promo invalide ou expire', 404);

        if ($amount < (float)$promo['min_amount']) {
            Response::error(
                'Montant minimum ' . number_format($promo['min_amount'], 3) . ' TND requis',
                400
            );
        }

        $discount = $promo['discount_type'] === 'percent'
            ? $amount * ((float)$promo['discount_value'] / 100)
            : (float)$promo['discount_value'];

        Response::success([
            'code'          => $code,
            'discount_type' => $promo['discount_type'],
            'discount'      => round($discount, 3),
            'new_total'     => round(max(0, $amount - $discount) + self::SERVICE_FEE, 3),
        ]);
    }
}
