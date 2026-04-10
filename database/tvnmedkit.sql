-- =====================================================================
-- TVN Medkit — Full Normalized Schema (MySQL 8+)
-- Version : 2.0 (Clean rewrite)
-- Encoding: utf8mb4 / utf8mb4_general_ci
--
-- Quy ước:
--   • snake_case cho mọi identifier
--   • INT UNSIGNED AUTO_INCREMENT cho PK đơn
--   • Mọi FK đều có index (MySQL không tự tạo ở cột tham chiếu)
--   • TIMESTAMP cho created_at/updated_at (tự động timezone)
--   • Comment giải thích LÝ DO, không giải thích CÁI GÌ
-- =====================================================================

DROP DATABASE IF EXISTS tvnmedkit;
CREATE DATABASE tvnmedkit
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;
USE tvnmedkit;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1 — REFERENCE TABLES  (không phụ thuộc FK nào)         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE hospitals (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(191) NOT NULL,
  address     VARCHAR(255) NULL,
  phone       VARCHAR(20)  NULL,
  image_url   VARCHAR(512) NULL,               -- ảnh đại diện bệnh viện
  details     TEXT         NULL,               -- mô tả chi tiết (HTML/Markdown)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_hosp_name (name),
  -- CHECK đảm bảo image_url đúng format URL hoặc path nội bộ
  CONSTRAINT chk_hosp_image_url CHECK (
    image_url IS NULL
    OR image_url REGEXP '^(https?://.+|/[^\\s]*|\\./[^\\s]*)$'
  )
) ENGINE=InnoDB;


CREATE TABLE specialties (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(120) NULL,           -- slug chuẩn (dùng cho URL/FE routing)
  icon_path       VARCHAR(191) NULL,           -- path tới file SVG icon
  icon_updated_at TIMESTAMP    NULL,           -- FE cache-bust khi icon thay đổi
  description     TEXT         NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_spec_name (name),
  UNIQUE KEY uk_spec_slug (slug)
) ENGINE=InnoDB;


CREATE TABLE services (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT         NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_srv_name (name)
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2 — ACCOUNTS                                          ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  -- 'pending' = chờ xác thực OTP sau đăng ký
  role          ENUM('patient','doctor','admin') NOT NULL DEFAULT 'patient',
  status        ENUM('pending','active','blocked') NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3 — PROFILES  (1-1 với users)                          ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE patients (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  full_name    VARCHAR(191) NOT NULL,
  gender       ENUM('Nam','Nữ','Khác') DEFAULT 'Khác',
  dob          DATE         NULL,
  phone        VARCHAR(20)  NULL,
  address      VARCHAR(255) NULL,
  insurance_no VARCHAR(64)  NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 1-1: mỗi user chỉ có 1 hồ sơ bệnh nhân
  UNIQUE KEY uk_pat_user  (user_id),
  UNIQUE KEY uk_pat_phone (phone),
  INDEX idx_pat_name (full_name),

  CONSTRAINT fk_pat_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE doctors (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED     NULL,      -- NULL = bác sĩ chưa có tài khoản đăng nhập
  full_name        VARCHAR(191) NOT NULL,
  gender           ENUM('Nam','Nữ','Khác')  DEFAULT 'Khác',
  dob              DATE             NULL,
  phone            VARCHAR(20)      NULL,
  avatar           VARCHAR(512)     NULL,      -- URL hoặc path nội bộ
  license_no       VARCHAR(64)      NULL,
  experience_years TINYINT UNSIGNED NULL,
  bio              TEXT             NULL,
  specialty_id     INT UNSIGNED     NULL,
  hospital_id      INT UNSIGNED     NULL,
  fee_min          DECIMAL(12,2)    NULL,
  fee_max          DECIMAL(12,2)    NULL,
  rating_avg       DECIMAL(3,2)     NULL,
  rating_count     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_doc_user  (user_id),
  UNIQUE KEY uk_doc_phone (phone),
  INDEX idx_doc_name (full_name),
  INDEX idx_doc_spec (specialty_id),           -- FK index (JOIN specialties)
  INDEX idx_doc_hosp (hospital_id),            -- FK index (JOIN hospitals)

  CONSTRAINT fk_doc_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_spec FOREIGN KEY (specialty_id)
    REFERENCES specialties(id) ON DELETE SET NULL,
  CONSTRAINT fk_doc_hosp FOREIGN KEY (hospital_id)
    REFERENCES hospitals(id) ON DELETE SET NULL,
  -- CHECK avatar format giống hospitals.image_url
  CONSTRAINT chk_doctor_avatar_format CHECK (
    avatar IS NULL
    OR avatar REGEXP '^(https?://.+|/[^\\s]*|\\./[^\\s]*)$'
  )
) ENGINE=InnoDB;


-- Bảng trung gian: bác sĩ ↔ dịch vụ (N-N)
CREATE TABLE doctor_services (
  doctor_id  INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  price      DECIMAL(12,2) NULL,

  PRIMARY KEY (doctor_id, service_id),
  INDEX idx_ds_srv (service_id),               -- FK index ngược (tìm bác sĩ theo dịch vụ)

  CONSTRAINT fk_ds_doc FOREIGN KEY (doctor_id)
    REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT fk_ds_srv FOREIGN KEY (service_id)
    REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 4 — SCHEDULING  (slot 60 phút)                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE schedules (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id    INT UNSIGNED NOT NULL,
  session      ENUM('morning','afternoon','evening') NOT NULL DEFAULT 'morning',
  start_time   DATETIME NOT NULL,
  end_time     DATETIME NOT NULL,              -- tự động tính bởi trigger
  slot_minutes TINYINT UNSIGNED NOT NULL DEFAULT 60,
  room         VARCHAR(64)      NULL,
  capacity     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Mỗi bác sĩ chỉ có 1 slot tại 1 thời điểm
  UNIQUE KEY uk_sch_doc_start (doctor_id, start_time),
  INDEX idx_sch_doc_time (doctor_id, start_time),

  CONSTRAINT fk_sch_doc FOREIGN KEY (doctor_id)
    REFERENCES doctors(id) ON DELETE CASCADE,
  -- end_time phải đúng = start_time + slot_minutes
  CONSTRAINT chk_sch_duration CHECK (
    TIMESTAMPDIFF(MINUTE, start_time, end_time) = slot_minutes
  ),
  -- start_time phải bắt đầu ở phút :00 hoặc :30
  CONSTRAINT chk_sch_minute CHECK (
    EXTRACT(MINUTE FROM start_time) IN (0, 30)
  )
) ENGINE=InnoDB;


-- ── Triggers: tự động tính end_time từ start_time + slot_minutes ──

DELIMITER //
CREATE TRIGGER trg_schedules_bi BEFORE INSERT ON schedules
FOR EACH ROW
BEGIN
  SET NEW.end_time = DATE_ADD(
    NEW.start_time,
    INTERVAL COALESCE(NEW.slot_minutes, 60) MINUTE
  );
END//

CREATE TRIGGER trg_schedules_bu BEFORE UPDATE ON schedules
FOR EACH ROW
BEGIN
  SET NEW.end_time = DATE_ADD(
    NEW.start_time,
    INTERVAL COALESCE(NEW.slot_minutes, 60) MINUTE
  );
END//
DELIMITER ;


-- ── Stored Procedure: tạo hàng loạt slot 60' cho 1 bác sĩ trong 1 ngày ──

DELIMITER //
CREATE PROCEDURE sp_generate_daily_slots(
  IN p_doctor_id       INT UNSIGNED,
  IN p_day             DATE,
  IN p_morning_start   TIME,
  IN p_morning_end     TIME,
  IN p_afternoon_start TIME,
  IN p_afternoon_end   TIME,
  IN p_capacity        TINYINT UNSIGNED,
  IN p_room            VARCHAR(64)
)
BEGIN
  DECLARE s DATETIME;
  DECLARE e DATETIME;

  -- Ca sáng
  SET s = TIMESTAMP(p_day, p_morning_start);
  SET e = TIMESTAMP(p_day, p_morning_end);
  WHILE s < e DO
    INSERT INTO schedules(doctor_id, session, start_time, room, capacity, slot_minutes)
    VALUES (p_doctor_id, 'morning', s, p_room, p_capacity, 60)
    ON DUPLICATE KEY UPDATE
      room       = VALUES(room),
      capacity   = VALUES(capacity),
      updated_at = NOW();
    SET s = s + INTERVAL 60 MINUTE;
  END WHILE;

  -- Ca chiều
  SET s = TIMESTAMP(p_day, p_afternoon_start);
  SET e = TIMESTAMP(p_day, p_afternoon_end);
  WHILE s < e DO
    INSERT INTO schedules(doctor_id, session, start_time, room, capacity, slot_minutes)
    VALUES (p_doctor_id, 'afternoon', s, p_room, p_capacity, 60)
    ON DUPLICATE KEY UPDATE
      room       = VALUES(room),
      capacity   = VALUES(capacity),
      updated_at = NOW();
    SET s = s + INTERVAL 60 MINUTE;
  END WHILE;
END//
DELIMITER ;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 5 — APPOINTMENTS & SLOT HOLDS                         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE appointments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NOT NULL,
  doctor_id      INT UNSIGNED NOT NULL,
  schedule_id    INT UNSIGNED NOT NULL,
  status         ENUM('pending','confirmed','completed','cancelled','no_show')
                   NOT NULL DEFAULT 'pending',
  cancel_reason  VARCHAR(255) NULL,            -- lý do hủy (nếu có)
  symptoms_note  VARCHAR(255) NULL,            -- triệu chứng bệnh nhân khai
  payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  -- Cột sinh: chỉ chứa schedule_id khi appointment còn active (pending/confirmed).
  -- NULL khi đã cancelled/completed/no_show → unique index bỏ qua NULL.
  -- Mục đích: ngăn 2 appointment active cùng 1 slot.
  active_key     INT GENERATED ALWAYS AS (
    CASE WHEN status IN ('pending','confirmed') THEN schedule_id ELSE NULL END
  ) STORED,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Chỉ cho phép 1 appointment active trên 1 slot (NULL được loại trừ bởi unique)
  UNIQUE KEY uk_appt_active_key (active_key),
  INDEX idx_appt_patient  (patient_id),        -- FK index
  INDEX idx_appt_doc_sched (doctor_id, schedule_id),
  INDEX idx_appt_schedule (schedule_id),       -- FK index

  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id)
    REFERENCES patients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id)
    REFERENCES doctors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_appt_schedule FOREIGN KEY (schedule_id)
    REFERENCES schedules(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- Giữ slot tạm thời: "mềm" 60s khi chọn, "cứng" 5 phút khi checkout
CREATE TABLE slot_holds (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  expires_at  DATETIME     NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Mỗi user chỉ hold 1 lần trên 1 slot
  UNIQUE KEY uk_hold_sched_user (schedule_id, user_id),
  INDEX idx_hold_sched_exp (schedule_id, expires_at),

  CONSTRAINT fk_hold_sched FOREIGN KEY (schedule_id)
    REFERENCES schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_hold_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 6 — REVIEWS, MEDICAL RECORDS, MEDICINES               ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE reviews (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id  INT UNSIGNED NOT NULL,
  rating     DECIMAL(2,1) NOT NULL,
  comment    TEXT         NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Mỗi bệnh nhân chỉ đánh giá 1 lần cho 1 bác sĩ
  UNIQUE KEY uk_rev_pat_doc (patient_id, doctor_id),
  INDEX idx_rev_doc (doctor_id),               -- FK index

  CONSTRAINT fk_rev_pat FOREIGN KEY (patient_id)
    REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_doc FOREIGN KEY (doctor_id)
    REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT chk_rev_rating CHECK (rating >= 1.0 AND rating <= 5.0)
) ENGINE=InnoDB;


CREATE TABLE medical_records (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  diagnosis      TEXT NULL,
  prescription   TEXT NULL,
  notes          TEXT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_mr_appt (appointment_id),          -- FK index

  CONSTRAINT fk_mr_appt FOREIGN KEY (appointment_id)
    REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE medicines (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(191) NOT NULL,
  description        TEXT         NULL,
  usage_instructions VARCHAR(255) NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_med_name (name)
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 7 — NOTIFICATIONS & EMAIL OTP                         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE notifications (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  message        TEXT         NOT NULL,
  -- Loại thông báo để phân kênh hiển thị và chống trùng
  kind           ENUM('booked','confirmed','cancelled','upcoming_24h','upcoming_2h','other')
                   NOT NULL DEFAULT 'other',
  appointment_id INT UNSIGNED NULL,            -- FK liên kết tới lịch hẹn (nếu có)
  sent_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read        BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Mỗi user + loại + appointment chỉ nhận 1 thông báo (chống trùng)
  UNIQUE KEY uk_notif_unique (user_id, kind, appointment_id),
  -- Index phục vụ query list: "lấy chưa đọc, sắp mới nhất"
  INDEX idx_notif_user_unread_time (user_id, is_read, sent_at DESC),
  INDEX idx_notif_appt (appointment_id),       -- FK index

  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_appt FOREIGN KEY (appointment_id)
    REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- OTP xác thực email khi đăng ký
CREATE TABLE email_otps (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,            -- FIX: khớp kiểu với users.id
  email      VARCHAR(255) NOT NULL,
  otp_code   VARCHAR(6)   NOT NULL,
  expires_at DATETIME     NOT NULL,
  is_used    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_otp_email (email),
  INDEX idx_otp_user  (user_id),
  INDEX idx_otp_code  (otp_code),

  CONSTRAINT fk_otp_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 8 — HOSPITAL EXTRAS  (ảnh phụ, quan hệ chuyên khoa)   ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- Ảnh phụ bệnh viện (gallery)
CREATE TABLE hospital_photos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT UNSIGNED     NOT NULL,
  image_url   VARCHAR(512)     NOT NULL,
  caption     VARCHAR(191)     NULL,
  sort_order  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_hphoto_hosp_sort (hospital_id, sort_order, id),

  CONSTRAINT fk_hphoto_hosp FOREIGN KEY (hospital_id)
    REFERENCES hospitals(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- Bảng trung gian: bệnh viện ↔ chuyên khoa (N-N)
CREATE TABLE hospital_specialties (
  hospital_id  INT UNSIGNED NOT NULL,
  specialty_id INT UNSIGNED NOT NULL,

  PRIMARY KEY (hospital_id, specialty_id),
  INDEX idx_hs_spec (specialty_id, hospital_id),  -- FK index ngược

  CONSTRAINT fk_hs_hospital FOREIGN KEY (hospital_id)
    REFERENCES hospitals(id) ON DELETE CASCADE,
  CONSTRAINT fk_hs_specialty FOREIGN KEY (specialty_id)
    REFERENCES specialties(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 9 — ADMIN AUDIT LOG                                   ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE admin_audit_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT UNSIGNED NOT NULL,
  action        VARCHAR(64)  NOT NULL,         -- 'create' | 'update' | 'delete'
  entity        VARCHAR(64)  NOT NULL,         -- tên bảng: 'doctors', 'hospitals'...
  entity_id     BIGINT UNSIGNED NULL,
  details       JSON         NULL,             -- payload thay đổi (trước/sau)
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_admin_audit_user (admin_user_id),
  INDEX idx_admin_audit_time (created_at)
) ENGINE=InnoDB;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 10 — CHAT SYSTEM  (assistant AI, retention 7 ngày)     ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE chat_sessions (
  id            CHAR(26)     PRIMARY KEY,      -- ULID / compact UUID
  user_id       INT UNSIGNED NOT NULL,
  title         VARCHAR(180) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_cs_user (user_id, last_activity DESC),

  CONSTRAINT fk_cs_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE chat_messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id CHAR(26)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,            -- chủ phiên (để purge theo user)
  role       ENUM('system','user','assistant','tool') NOT NULL,
  content    MEDIUMTEXT   NOT NULL,
  meta       JSON         NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_cm_session (session_id, created_at),

  CONSTRAINT fk_cm_session FOREIGN KEY (session_id)
    REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 11 — NEWS SYSTEM  (RSS aggregator)                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE news_categories (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name     VARCHAR(32)  NOT NULL,          -- 'service' | 'domestic' | 'world'
  display_name VARCHAR(100) NOT NULL,

  UNIQUE KEY uniq_cat_key (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE news_sources (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,          -- tên nguồn hiển thị
  domain       VARCHAR(150) NULL,              -- ví dụ: vnexpress.net
  rss_url      VARCHAR(500) NOT NULL,          -- URL RSS gốc
  category_key VARCHAR(32)  NOT NULL,          -- key → news_categories
  country_code VARCHAR(8)   NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,

  UNIQUE KEY uniq_rss (rss_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE news_articles (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED     NOT NULL,
  source_id    INT UNSIGNED     NULL,
  title        VARCHAR(255)     NOT NULL,
  slug         VARCHAR(255)     NOT NULL,
  summary      TEXT             NULL,
  content_text MEDIUMTEXT       NULL,          -- full-text search mở rộng
  cover_url    VARCHAR(500)     NULL,
  cover_alt    VARCHAR(200)     NULL,
  is_external  TINYINT(1)       NOT NULL DEFAULT 1,
  external_url VARCHAR(500)     NULL,
  status       ENUM('published','archived') NOT NULL DEFAULT 'published',
  published_at DATETIME         NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_slug     (slug),
  UNIQUE KEY uniq_external (external_url),
  INDEX idx_status_pub (status, published_at),
  INDEX idx_news_cat   (category_id),          -- FK index
  INDEX idx_news_src   (source_id),            -- FK index
  FULLTEXT KEY ft_news (title, content_text),

  CONSTRAINT fk_news_cat FOREIGN KEY (category_id)
    REFERENCES news_categories(id),
  CONSTRAINT fk_news_src FOREIGN KEY (source_id)
    REFERENCES news_sources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 12 — SCHEDULED EVENTS  (bảo trì tự động)              ║
-- ╚═══════════════════════════════════════════════════════════════════╝

SET GLOBAL event_scheduler = ON;

-- Xóa thông báo cũ hơn 7 ngày (chạy lúc 00:10 mỗi đêm)
DELIMITER $$
CREATE EVENT IF NOT EXISTS ev_cleanup_notifications_7d
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURRENT_DATE, '00:10:00')
DO
BEGIN
  DELETE FROM notifications WHERE sent_at < NOW() - INTERVAL 7 DAY;
END$$
DELIMITER ;

-- Xóa lịch sử chat cũ hơn 7 ngày (chạy lúc 00:20 mỗi đêm)
DELIMITER $$
CREATE EVENT IF NOT EXISTS ev_cleanup_chat_7d
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURRENT_DATE, '00:20:00')
DO
BEGIN
  DELETE cm FROM chat_messages cm
    JOIN chat_sessions cs ON cs.id = cm.session_id
    WHERE cs.last_activity < NOW() - INTERVAL 7 DAY;

  DELETE FROM chat_sessions
    WHERE last_activity < NOW() - INTERVAL 7 DAY;
END$$
DELIMITER ;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 13 — SEED DATA                                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ── 13.1  Chuyên khoa ──

INSERT INTO specialties (name, slug, icon_path, description) VALUES
  ('Nội tổng quát',          'noi-tong-quat',           '/assets/icons/specialties/noi-tong-quat.svg',           'Khám bệnh nội chung'),
  ('Nhi',                    'nhi',                     '/assets/icons/specialties/nhi.svg',                     'Nhi khoa tổng quát'),
  ('Sản',                    'san',                     '/assets/icons/specialties/san-phu-khoa.svg',            'Sản khoa'),
  ('Tim mạch',               'tim-mach',                '/assets/icons/specialties/noi-tim-mach.svg',            'Khám và điều trị tim mạch'),
  ('Tai mũi họng',           'tai-mui-hong',            '/assets/icons/specialties/tai-mui-hong.svg',            'TMH'),
  ('Mắt',                    'mat',                     '/assets/icons/specialties/mat.svg',                     'Nhãn khoa'),
  ('Da liễu',                'da-lieu',                 '/assets/icons/specialties/da-lieu.svg',                 'Bệnh da'),
  ('Nội tiết',               'noi-tiet',                '/assets/icons/specialties/noi-tiet.svg',                'Đái tháo đường, tuyến giáp...'),
  ('Cơ xương khớp',          'co-xuong-khop',           '/assets/icons/specialties/noi-co-xuong-khop.svg',       'Cơ xương khớp'),
  ('Hô hấp',                 'ho-hap',                  '/assets/icons/specialties/noi-ho-hap.svg',              'Phổi, hen, COPD'),
  ('Tiêu hoá',               'tieu-hoa',                '/assets/icons/specialties/noi-tieu-hoa.svg',            'Tiêu hoá - gan mật'),
  ('Thần kinh',              'than-kinh',               '/assets/icons/specialties/than-kinh.svg',               'Bệnh lý hệ thần kinh'),
  ('Thận - tiết niệu',      'than-tiet-nieu',          '/assets/icons/specialties/than-tiet-nieu.svg',          'Thận, bàng quang, đường tiểu'),
  ('Răng hàm mặt',          'rang-ham-mat',            '/assets/icons/specialties/rang-ham-mat.svg',             'Nha khoa tổng quát và chuyên sâu'),
  ('Ung bướu',               'ung-buou',                '/assets/icons/specialties/ung-buou.svg',                'Chẩn đoán và điều trị ung thư'),
  ('Chấn thương chỉnh hình', 'chan-thuong-chinh-hinh',  '/assets/icons/specialties/chan-thuong-chinh-hinh.svg',  'Xương khớp, chấn thương'),
  ('Phục hồi chức năng',     'phuc-hoi-chuc-nang',     '/assets/icons/specialties/phuc-hoi-chuc-nang.svg',      'VLTL, hoạt động trị liệu');


-- ── 13.2  Bệnh viện ──

INSERT INTO hospitals (name, address, phone) VALUES
  ('BV Chợ Rẫy',                        '201B Nguyễn Chí Thanh, Q5, TP.HCM',         '02838554137'),
  ('BV Nhi Đồng 1',                     '341 Sư Vạn Hạnh, Q10, TP.HCM',             '02839271119'),
  ('Bệnh viện Bạch Mai',                '78 Giải Phóng, P. Kim Liên, Hà Nội',       '1900888866'),
  ('Bệnh viện Hữu nghị Việt Đức',       '40 Tràng Thi, Hoàn Kiếm, Hà Nội',         '02438253531'),
  ('Bệnh viện Từ Dũ',                   '284 Cống Quỳnh, Q1, TP.HCM',               '02839526568'),
  ('Bệnh viện Trung ương Huế',          '16 Lê Lợi, TP. Huế',                       '+842343822325'),
  ('Bệnh viện Đại học Y Dược TP.HCM',   '215 Hồng Bàng, Q5, TP.HCM',               '02838554269'),
  ('Bệnh viện Đại học Y Hà Nội',        'Số 1 Tôn Thất Tùng, Đống Đa, Hà Nội',     '02438523798');


-- ── 13.3  Users (demo) ──
-- Mật khẩu chung: 12345678 (bcrypt cost=10)
-- Xóa dữ liệu cũ trước khi seed lại (CASCADE sẽ dọn patients, doctors liên quan)

DELETE FROM users WHERE id > 0;

INSERT INTO users (email, password_hash, role, status) VALUES
  ('patient1@example.com',       '$2b$10$cXlOXTcLKQ8Xl4uWTKmG8.K9g30GQWG260AsKCZP/yGB3o/UCruRi', 'patient', 'active'),
  ('admin@tvnmedkit.com',        '$2b$10$cXlOXTcLKQ8Xl4uWTKmG8.K9g30GQWG260AsKCZP/yGB3o/UCruRi', 'admin',  'active'),
  ('nguyenhoangbac@doctor.com', '$2b$10$cXlOXTcLKQ8Xl4uWTKmG8.K9g30GQWG260AsKCZP/yGB3o/UCruRi', 'doctor',  'active'),
  ('phamnhuhiep@doctor.com',    '$2b$10$cXlOXTcLKQ8Xl4uWTKmG8.K9g30GQWG260AsKCZP/yGB3o/UCruRi', 'doctor',  'active'),
  ('nguyentrithuc@doctor.com',  '$2b$10$cXlOXTcLKQ8Xl4uWTKmG8.K9g30GQWG260AsKCZP/yGB3o/UCruRi', 'doctor',  'active'),
  ('nguyenlanhieu@doctor.com',  '$2b$10$cXlOXTcLKQ8Xl4uWTKmG8.K9g30GQWG260AsKCZP/yGB3o/UCruRi', 'doctor',  'active');


-- ── 13.4  Patients (demo) ──

INSERT INTO patients (user_id, full_name, gender, dob, phone, address)
SELECT id, 'Nguyễn Văn A', 'Nam', '1999-10-01', '0912345678', 'TP.HCM'
FROM users WHERE email = 'patient1@example.com';


-- ── 13.5  Doctors (demo) ──

-- BS. Nguyễn Văn An — BV Chợ Rẫy
INSERT INTO doctors (user_id, full_name, gender, phone, avatar, specialty_id, hospital_id,
                     fee_min, fee_max, experience_years, bio)
SELECT u.id, 'BS. Nguyễn Văn An', 'Nam', '0951234567',
       'https://cdn.example.com/doctors/doctor1.jpg',
       (SELECT id FROM specialties WHERE name = 'Nội tổng quát'),
       (SELECT id FROM hospitals   WHERE name = 'BV Chợ Rẫy'),
       300000, 500000, 8, 'Khám nội tổng quát.'
FROM users u WHERE u.email = 'doctor1@example.com';

-- PGS.TS Nguyễn Hoàng Bắc — BV ĐH Y Dược TP.HCM
INSERT INTO doctors (user_id, full_name, gender, experience_years, bio,
                     specialty_id, hospital_id, fee_min, fee_max, rating_avg)
VALUES (
  NULL, 'PGS.TS Nguyễn Hoàng Bắc', 'Nam', 25,
  'Giám đốc BV ĐH Y Dược TP.HCM.',
  (SELECT id FROM specialties WHERE name = 'Nội tổng quát'),
  (SELECT id FROM hospitals   WHERE name = 'Bệnh viện Đại học Y Dược TP.HCM'),
  400000, 700000, 4.8
);

-- GS.TS Phạm Như Hiệp — BV Trung ương Huế
INSERT INTO doctors (user_id, full_name, gender, experience_years, bio,
                     specialty_id, hospital_id, fee_min, fee_max, rating_avg)
VALUES (
  NULL, 'GS.TS Phạm Như Hiệp', 'Nam', 30,
  'Giám đốc BV Trung ương Huế; ngoại khoa, ghép tạng.',
  (SELECT id FROM specialties WHERE name = 'Nội tổng quát'),
  (SELECT id FROM hospitals   WHERE name = 'Bệnh viện Trung ương Huế'),
  350000, 700000, 4.9
);

-- TS.BS Nguyễn Tri Thức — BV Chợ Rẫy
INSERT INTO doctors (user_id, full_name, gender, experience_years, bio,
                     specialty_id, hospital_id, fee_min, fee_max, rating_avg)
VALUES (
  NULL, 'TS.BS Nguyễn Tri Thức', 'Nam', 20,
  'Giám đốc Bệnh viện Chợ Rẫy.',
  (SELECT id FROM specialties WHERE name = 'Nội tổng quát'),
  (SELECT id FROM hospitals   WHERE name = 'BV Chợ Rẫy'),
  400000, 800000, 4.8
);

-- PGS.TS Nguyễn Lân Hiếu — BV ĐH Y Hà Nội (Tim mạch)
INSERT INTO doctors (user_id, full_name, gender, experience_years, bio,
                     specialty_id, hospital_id, fee_min, fee_max, rating_avg, avatar)
VALUES (
  NULL, 'PGS.TS Nguyễn Lân Hiếu', 'Nam', 25,
  CONCAT(
    'PGS.TS. BS. Nguyễn Lân Hiếu, chuyên gia Tim mạch người lớn và nhi; ',
    'Giám đốc Bệnh viện Đại học Y Hà Nội (từ 2019); ',
    'Phó chủ nhiệm Bộ môn Tim mạch, Đại học Y Hà Nội; ',
    'Đại biểu Quốc hội khóa XIV–XV. ',
    'Từng kiêm nhiệm Giám đốc BVĐK tỉnh Bình Dương (2022).'
  ),
  (SELECT id FROM specialties WHERE name = 'Tim mạch'),
  (SELECT id FROM hospitals   WHERE name = 'Bệnh viện Đại học Y Hà Nội'),
  500000, 900000, 4.9,
  '/assets/doctors/pgs_nguyen_lan_hieu.jpg'
);


-- ── 13.6  Hospital ↔ Specialty (tự động từ doctor data) ──

INSERT IGNORE INTO hospital_specialties (hospital_id, specialty_id)
SELECT DISTINCT d.hospital_id, d.specialty_id
FROM doctors d
WHERE d.hospital_id IS NOT NULL
  AND d.specialty_id IS NOT NULL;


-- ── 13.7  News categories & sources ──

INSERT INTO news_categories (key_name, display_name) VALUES
  ('service',  'Tin dịch vụ'),
  ('domestic', 'Tin y tế trong nước'),
  ('world',    'Tin y tế thế giới');

INSERT INTO news_sources (name, domain, rss_url, category_key, country_code) VALUES
  ('Báo Sức khỏe & Đời sống - Y tế',      'suckhoedoisong.vn', 'https://suckhoedoisong.vn/y-te.rss',                            'domestic', 'VN'),
  ('VnExpress - Sức khỏe',                  'vnexpress.net',     'https://vnexpress.net/rss/suc-khoe.rss',                        'domestic', 'VN'),
  ('Báo Sức khỏe & Đời sống - Dược',       'suckhoedoisong.vn', 'https://suckhoedoisong.vn/duoc.rss',                            'service',  'VN'),
  ('ECDC - News / Press releases',           'ecdc.europa.eu',    'https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed',         'world',    'EU'),
  ('CDC (US) - Newsroom',                    'cdc.gov',           'https://tools.cdc.gov/api/v2/resources/media/132608.rss',       'world',    'US');


-- ── 13.8  Demo schedules (bác sĩ đầu tiên, ngày hiện tại) ──

CALL sp_generate_daily_slots(
  (SELECT id FROM doctors ORDER BY id LIMIT 1),
  CURDATE(),
  '09:00:00', '12:00:00',
  '13:30:00', '17:30:00',
  1, 'P101'
);


-- =====================================================================
-- ✅ Schema ready — tổng cộng 22 bảng, 2 triggers, 1 procedure, 2 events
-- =====================================================================

show tables;
select *from doctors;
select *from users;
select *from patients;
select *from hospitals; 
select *from specialties;
select *from appointments;
select *from notifications;
select *from hospital_specialties;
select *from schedules;