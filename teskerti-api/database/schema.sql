-- ===============================================================
-- TESKERTI -- Schema MySQL complet
-- Compatible MySQL 8.0+ / MariaDB 10.6+
-- ===============================================================

CREATE DATABASE IF NOT EXISTS teskerti_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE teskerti_db;

-- -- USERS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  uuid          CHAR(36)       NOT NULL UNIQUE DEFAULT (UUID()),
  first_name    VARCHAR(60)    NOT NULL,
  last_name     VARCHAR(60)    NOT NULL,
  email         VARCHAR(180)   NOT NULL UNIQUE,
  phone         VARCHAR(20)    NULL,
  password_hash VARCHAR(255)   NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  is_verified   TINYINT(1)     NOT NULL DEFAULT 0,
  verify_token  VARCHAR(64)    NULL,
  reset_token   VARCHAR(64)    NULL,
  reset_expires DATETIME       NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_uuid  (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- REFRESH TOKENS -----------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- MOVIES -------------------------------------------------------
CREATE TABLE IF NOT EXISTS movies (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(120)  NOT NULL UNIQUE,
  title_ar     VARCHAR(200)  NOT NULL,
  title_fr     VARCHAR(200)  NOT NULL,
  title_en     VARCHAR(200)  NULL,
  synopsis     TEXT          NOT NULL,
  director     VARCHAR(120)  NOT NULL DEFAULT '',
  cast_list    JSON          NULL,
  genre        VARCHAR(60)   NOT NULL,
  rating       DECIMAL(3,1)  NOT NULL DEFAULT 0.0,
  duration_min SMALLINT      NOT NULL,
  release_date DATE          NOT NULL,
  poster_url   VARCHAR(300)  NULL,
  hero_bg_url  VARCHAR(300)  NULL,
  trailer_url  VARCHAR(300)  NULL,
  language     VARCHAR(20)   NOT NULL DEFAULT 'AR',
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slug    (slug),
  INDEX idx_active  (is_active),
  INDEX idx_release (release_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- CINEMAS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS cinemas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug       VARCHAR(80)  NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  city       VARCHAR(80)  NOT NULL,
  address    VARCHAR(255) NOT NULL,
  phone      VARCHAR(20)  NULL,
  email      VARCHAR(120) NULL,
  image_url  VARCHAR(300) NULL,
  lat        DECIMAL(9,6) NULL,
  lng        DECIMAL(9,6) NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- HALLS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS halls (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cinema_id   INT UNSIGNED NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  total_seats SMALLINT     NOT NULL DEFAULT 100,
  layout_json JSON         NULL,
  FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- SEATS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS seats (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hall_id   INT UNSIGNED NOT NULL,
  zone      ENUM('premium','confort','standard','balcon') NOT NULL DEFAULT 'standard',
  row_label CHAR(2)      NOT NULL,
  seat_num  TINYINT      NOT NULL,
  is_pmr    TINYINT(1)   NOT NULL DEFAULT 0,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
  UNIQUE KEY uq_seat (hall_id, row_label, seat_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- SESSIONS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  movie_id       INT UNSIGNED  NOT NULL,
  cinema_id      INT UNSIGNED  NOT NULL,
  hall_id        INT UNSIGNED  NOT NULL,
  starts_at      DATETIME      NOT NULL,
  ends_at        DATETIME      NOT NULL,
  language       ENUM('VO','VF','VF-ST','AR') NOT NULL DEFAULT 'AR',
  format         ENUM('2D','3D','4DX','IMAX')  NOT NULL DEFAULT '2D',
  price_premium  DECIMAL(8,3)  NOT NULL DEFAULT 25.000,
  price_confort  DECIMAL(8,3)  NOT NULL DEFAULT 19.000,
  price_standard DECIMAL(8,3)  NOT NULL DEFAULT 15.000,
  price_balcon   DECIMAL(8,3)  NOT NULL DEFAULT 12.000,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  FOREIGN KEY (movie_id)  REFERENCES movies(id)  ON DELETE CASCADE,
  FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE,
  FOREIGN KEY (hall_id)   REFERENCES halls(id)   ON DELETE CASCADE,
  INDEX idx_starts (starts_at),
  INDEX idx_movie  (movie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- BOOKINGS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  reference    CHAR(12)      NOT NULL UNIQUE,
  user_id      INT UNSIGNED  NOT NULL,
  session_id   INT UNSIGNED  NOT NULL,
  status       ENUM('pending','confirmed','cancelled','refunded') NOT NULL DEFAULT 'pending',
  subtotal     DECIMAL(10,3) NOT NULL,
  service_fee  DECIMAL(8,3)  NOT NULL DEFAULT 1.000,
  promo_code   VARCHAR(20)   NULL,
  discount     DECIMAL(8,3)  NOT NULL DEFAULT 0.000,
  total        DECIMAL(10,3) NOT NULL,
  qr_code_path VARCHAR(255)  NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME      NULL,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE RESTRICT,
  INDEX idx_reference (reference),
  INDEX idx_user      (user_id),
  INDEX idx_status    (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- BOOKING_SEATS ------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_seats (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT UNSIGNED NOT NULL,
  seat_id     INT UNSIGNED NOT NULL,
  ticket_type ENUM('normal','senior','etudiant','enfant') NOT NULL DEFAULT 'normal',
  unit_price  DECIMAL(8,3) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id)    REFERENCES seats(id)    ON DELETE RESTRICT,
  UNIQUE KEY uq_booking_seat (booking_id, seat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- PAYMENTS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id               INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT UNSIGNED  NOT NULL,
  transaction_ref  VARCHAR(60)   NOT NULL UNIQUE,
  method           ENUM('visa')  NOT NULL DEFAULT 'visa',
  amount           DECIMAL(10,3) NOT NULL,
  currency         CHAR(3)       NOT NULL DEFAULT 'TND',
  status           ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  card_last4       CHAR(4)       NOT NULL,
  card_brand       VARCHAR(20)   NOT NULL DEFAULT 'VISA',
  gateway_ref      VARCHAR(120)  NULL,
  gateway_response JSON          NULL,
  processed_at     DATETIME      NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  INDEX idx_booking (booking_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- PROMO_CODES --------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(20)   NOT NULL UNIQUE,
  discount_type  ENUM('flat','percent') NOT NULL DEFAULT 'flat',
  discount_value DECIMAL(8,3)  NOT NULL,
  min_amount     DECIMAL(8,3)  NOT NULL DEFAULT 0.000,
  uses_limit     SMALLINT      NULL,
  uses_count     SMALLINT      NOT NULL DEFAULT 0,
  expires_at     DATETIME      NULL,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- RATE LIMITS --------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_address   VARCHAR(45)  NOT NULL,
  endpoint     VARCHAR(100) NOT NULL,
  requests     SMALLINT     NOT NULL DEFAULT 1,
  window_start DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_endpoint (ip_address, endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
