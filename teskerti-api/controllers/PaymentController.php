<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Config\Database;
use App\Helpers\CardHelper;
use App\Middleware\AuthMiddleware;


class PaymentController
{
    /* --- POST /payments/process --- */
    public function process(Request $req): void
    {
        $auth = AuthMiddleware::currentUser();
        $d    = $req->body;
        $db   = Database::get();

        // -- 1. Validate Visa card --------------------------------
        $cardErrors = CardHelper::validate([
            'number' => $d['card_number'] ?? '',
            'holder' => $d['card_holder'] ?? '',
            'expiry' => $d['card_expiry'] ?? '',
            'cvv'    => $d['card_cvv']    ?? '',
        ]);
        if ($cardErrors) {
            Response::error('Donnees carte invalides', 422, $cardErrors);
        }

        // -- 2. Find booking --------------------------------------
        $bookingRef = trim($d['booking_ref'] ?? '');
        $stmt = $db->prepare(
            'SELECT b.*, s.price_standard FROM bookings b
             JOIN sessions s ON s.id = b.session_id
             WHERE b.reference = ? AND b.user_id = ? AND b.status = "pending"
             LIMIT 1'
        );
        $stmt->execute([$bookingRef, $auth['sub']]);
        $booking = $stmt->fetch();

        if (!$booking) {
            Response::error('Reservation introuvable ou deja traitee', 404);
        }

        // -- 3. Amount tamper check --------------------------------
        $expected = (float)$booking['total'];
        $paid     = (float)($d['amount'] ?? 0);
        if (abs($paid - $expected) > 0.01) {
            Response::error('Montant incorrect -- manipulation detectee', 400);
        }

        // -- 4. Payment gateway call (MOCK) ------------------------
        // Replace with: Paymee, CMI, Konnect, etc.
        $transactionRef  = 'TXN-' . strtoupper(bin2hex(random_bytes(6)));
        $gatewaySuccess  = true;  // <-- Actual gateway response here
        $gatewayResponse = [
            'mock'      => true,
            'timestamp' => date('c'),
            'ref'       => $transactionRef,
        ];

        // -- 5. Record payment & Confirm booking ------------------
        $db->beginTransaction();
        try {
            $status = $gatewaySuccess ? 'success' : 'failed';
            $db->prepare(
                'INSERT INTO payments
                 (booking_id, transaction_ref, method, amount, currency,
                  status, card_last4, card_brand, gateway_ref, gateway_response, processed_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)'
            )->execute([
                $booking['id'],
                $transactionRef,
                'visa',
                $expected,
                'TND',
                $status,
                CardHelper::mask($d['card_number']),
                'VISA',
                $transactionRef,
                json_encode($gatewayResponse),
                $gatewaySuccess ? date('Y-m-d H:i:s') : null,
            ]);

            if ($gatewaySuccess) {
                $db->prepare(
                    'UPDATE bookings SET status = "confirmed", confirmed_at = NOW() WHERE id = ?'
                )->execute([$booking['id']]);
            }

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('[Payment] Transaction failed: ' . $e->getMessage());
            Response::error('Erreur lors du traitement de la transaction', 500);
        }

        if (!$gatewaySuccess) {
            Response::error('Paiement refuse par la banque', 402);
        }


        // -- 7. Generate QR code (optional) ------------------------
        $qrCodeUrl = null;
        try {
            if (class_exists('\Endroid\QrCode\QrCode')) {
                $qrData  = json_encode([
                    'ref'         => $bookingRef,
                    'transaction' => $transactionRef,
                    'user'        => $auth['sub'],
                    'ts'          => time(),
                ]);
                $qrDir  = __DIR__ . '/../storage/qr/';
                $qrFile = $qrDir . $bookingRef . '.png';
                if (!is_dir($qrDir)) mkdir($qrDir, 0755, true);

                \Endroid\QrCode\QrCode::create($qrData)
                    ->setSize(200)
                    ->setMargin(10);
                // Writer: \Endroid\QrCode\Writer\PngWriter
                $qrCodeUrl = ($_ENV['APP_URL'] ?? '') . '/storage/qr/' . $bookingRef . '.png';

                $db->prepare('UPDATE bookings SET qr_code_path = ? WHERE id = ?')
                   ->execute(['storage/qr/' . $bookingRef . '.png', $booking['id']]);
            }
        } catch (\Throwable $e) {
            // QR is optional, don't fail the payment
            error_log('[QR] ' . $e->getMessage());
        }

        // -- 8. Send confirmation email (optional) -----------------
        // MailHelper::sendBookingConfirmation($auth, $booking, $transactionRef);

        Response::success([
            'transaction_ref' => $transactionRef,
            'booking_ref'     => $bookingRef,
            'amount'          => $expected,
            'currency'        => 'TND',
            'card_last4'      => CardHelper::mask($d['card_number']),
            'card_brand'      => 'VISA',
            'qr_code_url'     => $qrCodeUrl,
            'confirmed_at'    => date('c'),
        ], 'Paiement effectue avec succes -- Reservation confirmee !');
    }

    /* --- GET /payments/{id}/status --- */
    public function status(Request $req): void
    {
        $id   = (int)$req->param('id');
        $user = AuthMiddleware::currentUser();
        $db   = Database::get();

        $stmt = $db->prepare(
            'SELECT p.id, p.transaction_ref, p.method, p.amount, p.currency,
                    p.status, p.card_last4, p.card_brand, p.processed_at,
                    b.reference AS booking_ref
             FROM payments p
             JOIN bookings b ON b.id = p.booking_id
             WHERE p.id = ? AND b.user_id = ? LIMIT 1'
        );
        $stmt->execute([$id, $user['sub']]);
        $payment = $stmt->fetch();

        if (!$payment) Response::error('Paiement introuvable', 404);
        Response::success($payment);
    }

    /* --- POST /payments/{id}/refund (admin) --- */
    public function refund(Request $req): void
    {
        $id = (int)$req->param('id');
        $db = Database::get();

        $stmt = $db->prepare(
            'SELECT p.*, b.reference FROM payments p
             JOIN bookings b ON b.id = p.booking_id
             WHERE p.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $payment = $stmt->fetch();

        if (!$payment) Response::error('Paiement introuvable', 404);
        if ($payment['status'] !== 'success')
            Response::error('Ce paiement ne peut pas etre rembourse', 400);

        // Call gateway refund API here (Paymee/CMI)
        // For now: mock success

        $db->beginTransaction();
        try {
            $db->prepare('UPDATE payments SET status = "refunded" WHERE id = ?')
               ->execute([$id]);
            $db->prepare('UPDATE bookings SET status = "refunded" WHERE id = ?')
               ->execute([$payment['booking_id']]);
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('[Refund] Transaction failed: ' . $e->getMessage());
            Response::error('Erreur lors du remboursement', 500);
        }


        Response::success([
            'refunded_amount' => $payment['amount'],
            'booking_ref'     => $payment['reference'],
        ], 'Remboursement effectue avec succes');
    }
}
