-- ===============================================================
-- TESKERTI -- Donnees initiales (seeds)
-- ===============================================================
USE teskerti_db;

-- -- Films tunisiens ------------------------------------------
INSERT INTO movies (slug, title_ar, title_fr, duration_min, genre, rating, director, release_date, language, synopsis, poster_url, hero_bg_url, is_active) VALUES
('nouba', 'Nouba', 'Nouba', 95, 'Drame', 7.8, 'Abdelhamid Bouchnak', '2014-01-01', 'AR',
 'Une plongee fascinante dans le milieu de l''art populaire tunisien (Mezoued) dans les annees 90, entre amour, trahison et passion musicale.',
 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80&fit=crop',
 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1920&q=80&fit=crop', 1),

('bchira', 'Bchira', 'Bchira', 108, 'Drame romantique', 7.2, 'Leyla Bouzid', '2023-05-20', 'AR',
 'L''histoire touchante d''une jeune femme luttant pour son independance dans un village du sud tunisien.',
 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&fit=crop',
 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1920&q=80&fit=crop', 1),

('beni-khiar', 'Beni Khiar', 'Beni Khiar', 90, 'Comedie', 7.0, 'Moncef Dhouib', '2016-06-15', 'AR',
 'Une famille tunisoise decide de passer ses vacances d''ete dans une petite maison a Beni Khiar, mais rien ne se passe comme prevu.',
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&fit=crop',
 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80&fit=crop', 1),

('el-jadida', 'El Jadida', 'El Jadida', 112, 'Thriller', 8.1, 'Abdelhamid Bouchnak', '2022-08-10', 'AR',
 'Un detective use enquete sur une serie de disparitions mysterieuses dans la nouvelle ville, affrontant les fantomes de son passe.',
 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&q=80&fit=crop',
 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80&fit=crop', 1),

('fatwa', 'Fatwa', 'Fatwa', 100, 'Drame', 7.5, 'Mahmoud Ben Mahmoud', '2018-01-01', 'AR',
 'Brahim rentre en Tunisie pour enterrer son fils mort dans un accident de moto, mais decouvre qu''il militait dans un groupuscule salafiste.',
 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80&fit=crop',
 'https://images.unsplash.com/photo-1524712245354-2c4e5e7121c0?w=1920&q=80&fit=crop', 0),

('tlamess', 'Tlamess', 'Tlamess', 120, 'Mystere', 8.3, 'Ala Eddine Slim', '2019-09-01', 'AR',
 'Un soldat deserte l''armee apres le deces de sa mere et croise le chemin d''une femme enceinte et fuyante. Un conte troublant et poetique.',
 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&q=80&fit=crop',
 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80&fit=crop', 0);

-- -- Cinemas --------------------------------------------------
INSERT INTO cinemas (slug, name, city, address, phone, image_url) VALUES
('pathe-tunis-city',  'Pathe Tunis City',   'Tunis',  'Tunis City Mall, Route de La Marsa', '71 123 456',
 'https://images.unsplash.com/photo-1568876694728-451bbf694b83?w=800&q=80&fit=crop'),
('cinema-colisee',    'Cinema Colisee',      'Tunis',  '38 Av. Habib Bourguiba, Tunis',      '71 234 567',
 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&q=80&fit=crop'),
('abc-cinema',        'ABC Cinema',          'Tunis',  'ABC Mall, La Soukra',                '71 345 678',
 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&q=80&fit=crop'),
('cite-culture',      'Cite de la Culture',  'Tunis',  'Cite de la Culture, Montplaisir',    '71 456 789',
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80&fit=crop'),
('le-rio-sfax',       'Cinema Le Rio',       'Sfax',   'Av. Habib Bourguiba, Sfax',          '74 123 456',
 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80&fit=crop'),
('majestic-sousse',   'Cinema Majestic',     'Sousse', 'Av. Habib Bourguiba, Sousse',        '73 123 456',
 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80&fit=crop');

-- -- Salle + Sieges pour Pathe Tunis City ---------------------
INSERT INTO halls (cinema_id, name, total_seats) VALUES (1, 'Salle Premium 1', 100);

-- Generer les sieges (Premium A-C, Confort D-G, Standard H-L, Balcon M-O)
INSERT INTO seats (hall_id, zone, row_label, seat_num)
SELECT 1, zone, row_label, n FROM (
  SELECT 'premium'  AS zone, 'A' AS row_label, n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) t
  UNION ALL SELECT 'premium',  'B', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) t
  UNION ALL SELECT 'confort',  'C', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16) t
  UNION ALL SELECT 'confort',  'D', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16) t
  UNION ALL SELECT 'standard', 'E', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18) t
  UNION ALL SELECT 'standard', 'F', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18) t
  UNION ALL SELECT 'balcon',   'G', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20) t
) seats_data;

-- -- Seances exemple ------------------------------------------
INSERT INTO sessions (movie_id, cinema_id, hall_id, starts_at, ends_at, language, format, price_premium, price_confort, price_standard, price_balcon) VALUES
(1, 1, 1, DATE_ADD(NOW(), INTERVAL 2 HOUR),    DATE_ADD(NOW(), INTERVAL 3 HOUR),    'AR', '2D', 25.000, 19.000, 15.000, 12.000),
(1, 1, 1, DATE_ADD(NOW(), INTERVAL 6 HOUR),    DATE_ADD(NOW(), INTERVAL 7 HOUR),    'AR', '2D', 25.000, 19.000, 15.000, 12.000),
(2, 1, 1, DATE_ADD(NOW(), INTERVAL 1 DAY),     DATE_ADD(NOW(), INTERVAL 26 HOUR), 'AR', '2D', 25.000, 19.000, 15.000, 12.000),
(3, 2, 1, DATE_ADD(NOW(), INTERVAL 3 HOUR),    DATE_ADD(NOW(), INTERVAL 4 HOUR),    'AR', '2D', 20.000, 16.000, 13.000, 10.000),
(4, 1, 1, DATE_ADD(NOW(), INTERVAL 4 HOUR),    DATE_ADD(NOW(), INTERVAL 5 HOUR),    'AR', '2D', 25.000, 19.000, 15.000, 12.000);

-- Aucun compte administrateur n'est preconfigure.

-- -- Codes promo -----------------------------------------------
INSERT INTO promo_codes (code, discount_type, discount_value, min_amount, uses_limit, expires_at) VALUES
('TESKERTI10', 'percent', 10.000, 20.000, 100, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
('ETUDIANT5',  'flat',     5.000, 15.000, 500, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
('BIENVENUE',  'flat',     3.000,  0.000, 200, DATE_ADD(NOW(), INTERVAL 6 MONTH)),
('PREMIUM20',  'percent', 20.000, 50.000,  50, DATE_ADD(NOW(), INTERVAL 3 MONTH));
