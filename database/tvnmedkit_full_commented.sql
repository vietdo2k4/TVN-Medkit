-- =====================================================================
-- TVN Medkit — Full Normalized Schema (MySQL 8+) — Latest Update
-- - Users = tài khoản
-- - Patients/Doctors = hồ sơ 1–1 với users
-- - Schedules = slot 60'
-- - Doctors.avatar = nullable, nhận URL hoặc path nội bộ
-- =====================================================================
DROP DATABASE IF EXISTS tvnmedkit;
CREATE DATABASE tvnmedkit CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE tvnmedkit;

-- =========================
-- Reference tables
-- =========================
CREATE TABLE hospitals (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(191) NOT NULL,
  address     VARCHAR(255),
  phone       VARCHAR(20),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_hosp_name (name)
) ENGINE=InnoDB;


ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(512) NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS details   TEXT NULL       AFTER image_url,
  ADD CONSTRAINT chk_hosp_image_url CHECK (
    image_url IS NULL
    OR image_url REGEXP '^(https?://.+|/[^\\s]*|\\./[^\\s]*)$'
  );
CREATE TABLE specialties (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_spec_name (name)
) ENGINE=InnoDB;

CREATE TABLE services (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_srv_name (name)
) ENGINE=InnoDB;

-- =========================
-- Accounts
-- =========================
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('patient','doctor','admin') NOT NULL DEFAULT 'patient',
  status        ENUM('active','blocked') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

ALTER TABLE users
MODIFY status ENUM('pending','active','blocked')
DEFAULT 'pending';
-- =========================
-- Profiles (1–1 with users)
-- =========================
CREATE TABLE patients (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL UNIQUE,
  full_name    VARCHAR(191) NOT NULL,
  gender       ENUM('Nam','Nữ','Khác') DEFAULT 'Khác',
  dob          DATE NULL,
  phone        VARCHAR(20) NULL,
  address      VARCHAR(255) NULL,
  insurance_no VARCHAR(64) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_pat_phone (phone),
  INDEX idx_pat_name (full_name)
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED UNIQUE NULL,
  full_name        VARCHAR(191) NOT NULL,
  gender           ENUM('Nam','Nữ','Khác') DEFAULT 'Khác',
  dob              DATE NULL,
  phone            VARCHAR(20) NULL,
  avatar           VARCHAR(512) NULL,                         -- URL hoặc path
  license_no       VARCHAR(64) NULL,
  experience_years TINYINT UNSIGNED NULL,
  bio              TEXT NULL,
  specialty_id     INT UNSIGNED NULL,
  hospital_id      INT UNSIGNED NULL,
  fee_min          DECIMAL(12,2) NULL,
  fee_max          DECIMAL(12,2) NULL,
  rating_avg       DECIMAL(3,2) NULL,
  rating_count     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_user  FOREIGN KEY (user_id)     REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fk_doc_spec  FOREIGN KEY (specialty_id)REFERENCES specialties(id) ON DELETE SET NULL,
  CONSTRAINT fk_doc_hosp  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)   ON DELETE SET NULL,
  CONSTRAINT chk_doctor_avatar_format CHECK (
    avatar IS NULL
    OR avatar REGEXP '^(https?://.+|/[^\\s]*|\\./[^\\s]*)$'
  ),
  UNIQUE KEY uk_doc_phone (phone),
  INDEX idx_doc_name (full_name),
  INDEX idx_doc_spec (specialty_id),
  INDEX idx_doc_hosp (hospital_id)
) ENGINE=InnoDB;

CREATE TABLE doctor_services (
  doctor_id  INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  price      DECIMAL(12,2) NULL,
  PRIMARY KEY (doctor_id, service_id),
  CONSTRAINT fk_ds_doc FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ds_srv FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- Schedules (60' slots)
-- =========================
CREATE TABLE schedules (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id     INT UNSIGNED NOT NULL,
  session       ENUM('morning','afternoon','evening') NULL,
  start_time    DATETIME NOT NULL,
  end_time      DATETIME NOT NULL,
  slot_minutes  TINYINT UNSIGNED NOT NULL DEFAULT 60,
  room          VARCHAR(64) NULL,
  capacity      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sch_doc FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT chk_sch_duration CHECK (TIMESTAMPDIFF(MINUTE, start_time, end_time) = slot_minutes),
  CONSTRAINT chk_sch_minute   CHECK (EXTRACT(MINUTE FROM start_time) IN (0,30)),
  UNIQUE KEY uk_sch_doc_start (doctor_id, start_time),
  INDEX idx_sch_doc_time (doctor_id, start_time)
) ENGINE=InnoDB;

ALTER TABLE schedules 
MODIFY COLUMN session ENUM('morning', 'afternoon', 'evening') NOT NULL DEFAULT 'morning';
DELIMITER //
CREATE TRIGGER trg_schedules_bi BEFORE INSERT ON schedules
FOR EACH ROW BEGIN
  SET NEW.end_time = DATE_ADD(NEW.start_time, INTERVAL COALESCE(NEW.slot_minutes,60) MINUTE);
END//
CREATE TRIGGER trg_schedules_bu BEFORE UPDATE ON schedules
FOR EACH ROW BEGIN
  SET NEW.end_time = DATE_ADD(NEW.start_time, INTERVAL COALESCE(NEW.slot_minutes,60) MINUTE);
END//
DELIMITER ;

-- =========================
-- Appointments
-- =========================
CREATE TABLE appointments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NOT NULL,
  doctor_id      INT UNSIGNED NOT NULL,
  schedule_id    INT UNSIGNED NOT NULL,
  status         ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  symptoms_note  VARCHAR(255) NULL,
  payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_patient  FOREIGN KEY (patient_id)  REFERENCES patients(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_appt_doctor   FOREIGN KEY (doctor_id)   REFERENCES doctors(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_appt_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_appt_patient_schedule (patient_id, schedule_id),
  INDEX idx_appt_doc_sched (doctor_id, schedule_id)
) ENGINE=InnoDB;

-- =========================
-- Reviews / Medical records / Notifications / Medicines / Chat
-- =========================
CREATE TABLE reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT UNSIGNED NOT NULL,
  doctor_id   INT UNSIGNED NOT NULL,
  rating      DECIMAL(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
  comment     TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rev_pat FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_doc FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  UNIQUE KEY uk_rev_pat_doc (patient_id, doctor_id),
  INDEX idx_rev_doc (doctor_id)
) ENGINE=InnoDB;

CREATE TABLE medical_records (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  diagnosis      TEXT,
  prescription   TEXT,
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_mr_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  INDEX idx_mr_appt (appointment_id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  message    TEXT NOT NULL,
  sent_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user_time (user_id, sent_at)
) ENGINE=InnoDB;

CREATE TABLE medicines (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(191) NOT NULL,
  description         TEXT,
  usage_instructions  VARCHAR(255),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_med_name (name)
) ENGINE=InnoDB;

CREATE TABLE chat_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,
  message    TEXT,
  response   TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_chat_user_time (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE email_otps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_user (user_id),
    INDEX idx_otp (otp_code)
);
-- =========================
-- Procedure: generate daily 60' slots
-- =========================
DELIMITER //
CREATE PROCEDURE sp_generate_daily_slots(
  IN p_doctor_id INT UNSIGNED,
  IN p_day DATE,
  IN p_morning_start TIME,
  IN p_morning_end   TIME,
  IN p_afternoon_start TIME,
  IN p_afternoon_end   TIME,
  IN p_capacity TINYINT UNSIGNED,
  IN p_room VARCHAR(64)
)
BEGIN
  DECLARE s DATETIME;
  DECLARE e DATETIME;

  -- morning
  SET s = TIMESTAMP(p_day, p_morning_start);
  SET e = TIMESTAMP(p_day, p_morning_end);
  WHILE s < e DO
    INSERT INTO schedules(doctor_id, session, start_time, room, capacity, slot_minutes)
    VALUES (p_doctor_id, 'morning', s, p_room, p_capacity, 60)
    ON DUPLICATE KEY UPDATE room=VALUES(room), capacity=VALUES(capacity), updated_at=NOW();
    SET s = s + INTERVAL 60 MINUTE;
  END WHILE;

  -- afternoon
  SET s = TIMESTAMP(p_day, p_afternoon_start);
  SET e = TIMESTAMP(p_day, p_afternoon_end);
  WHILE s < e DO
    INSERT INTO schedules(doctor_id, session, start_time, room, capacity, slot_minutes)
    VALUES (p_doctor_id, 'afternoon', s, p_room, p_capacity, 60)
    ON DUPLICATE KEY UPDATE room=VALUES(room), capacity=VALUES(capacity), updated_at=NOW();
    SET s = s + INTERVAL 60 MINUTE;
  END WHILE;
END//
DELIMITER ;


INSERT INTO hospitals(name,address,phone) VALUES
 ('BV Chợ Rẫy','201B Nguyễn Chí Thanh, Q5, TP.HCM','02838554137'),
 ('BV Nhi Đồng 1','341 Sư Vạn Hạnh, Q10, TP.HCM','02839271119');
 
 INSERT IGNORE INTO hospitals(name, address, phone) VALUES
  ('Bệnh viện Bạch Mai', '78 Giải Phóng, P. Kim Liên, Hà Nội', '1900888866'),
  ('Bệnh viện Hữu nghị Việt Đức', '40 Tràng Thi, Hoàn Kiếm, Hà Nội', '02438253531'),
  ('Bệnh viện Từ Dũ', '284 Cống Quỳnh, Q1, TP.HCM', '02839526568'),
  ('Bệnh viện Trung ương Huế', '16 Lê Lợi, TP. Huế', '+842343822325'),
  ('Bệnh viện Đại học Y Dược TP.HCM', '215 Hồng Bàng, Q5, TP.HCM', '02838554269');

INSERT INTO users(email,password_hash,role) VALUES
 ('patient1@example.com','$2b$10$hash_demo_patient','patient'),
 ('doctor1@example.com','$2b$10$hash_demo_doctor','doctor');

INSERT INTO patients(user_id, full_name, gender, dob, phone, address)
SELECT id,'Nguyễn Văn A','Nam','1999-10-01','0912345678','TP.HCM'
FROM users WHERE email='patient1@example.com';

INSERT INTO doctors(user_id, full_name, gender, phone, avatar, specialty_id, hospital_id, fee_min, fee_max, experience_years, bio)
SELECT u.id,'BS. Nguyễn Văn An','Nam','0951234567',
       'https://cdn.example.com/doctors/doctor1.jpg',
       (SELECT id FROM specialties WHERE name='Nội tổng quát'),
       (SELECT id FROM hospitals   WHERE name='BV Chợ Rẫy'),
       300000,500000,8,'Khám nội tổng quát.'
FROM users u WHERE u.email='doctor1@example.com';

-- 2) PGS.TS Nguyễn Hoàng Bắc – BV ĐH Y Dược TP.HCM
INSERT INTO doctors (
  user_id, full_name, gender, dob, phone, avatar, license_no,
  experience_years, bio, specialty_id, hospital_id, fee_min, fee_max, rating_avg
)
SELECT
  NULL, 'PGS.TS Nguyễn Hoàng Bắc', 'Nam', NULL, NULL, NULL, NULL,
  25, 'Giám đốc BV ĐH Y Dược TP.HCM.',
  (SELECT id FROM specialties WHERE name='Nội tổng quát'),
  (SELECT id FROM hospitals   WHERE name='Bệnh viện Đại học Y Dược TP.HCM'),
  400000, 700000, 4.8;

-- 3) GS.TS Phạm Như Hiệp – BV Trung ương Huế
INSERT INTO doctors (
  user_id, full_name, gender, dob, phone, avatar, license_no,
  experience_years, bio, specialty_id, hospital_id, fee_min, fee_max, rating_avg
)
SELECT
  NULL, 'GS.TS Phạm Như Hiệp', 'Nam', NULL, NULL, NULL, NULL,
  30, 'Giám đốc BV Trung ương Huế; ngoại khoa, ghép tạng.',
  (SELECT id FROM specialties WHERE name='Nội tổng quát'),
  (SELECT id FROM hospitals   WHERE name='Bệnh viện Trung ương Huế'),
  350000, 700000, 4.9;

-- 4) TS.BS Nguyễn Tri Thức – BV Chợ Rẫy
INSERT INTO doctors (
  user_id, full_name, gender, dob, phone, avatar, license_no,
  experience_years, bio, specialty_id, hospital_id, fee_min, fee_max, rating_avg
)
SELECT
  NULL, 'TS.BS Nguyễn Tri Thức', 'Nam', NULL, NULL, NULL, NULL,
  20, 'Giám đốc Bệnh viện Chợ Rẫy.',
  (SELECT id FROM specialties WHERE name='Nội tổng quát'),
  (SELECT id FROM hospitals   WHERE name='BV Chợ Rẫy'),
  400000, 800000, 4.8;

-- 5) PGS.TS Nguyễn Lân Hiếu – BV Bạch Mai (Viện Tim mạch)
INSERT INTO doctors (
  user_id, full_name, gender, dob, phone, avatar, license_no,
  experience_years, bio, specialty_id, hospital_id, fee_min, fee_max, rating_avg
)
SELECT
  NULL, 'PGS.TS Nguyễn Lân Hiếu', 'Nam', NULL, NULL, NULL, NULL,
  25, 'Tim mạch can thiệp; Viện Tim mạch.',
  (SELECT id FROM specialties WHERE name='Tim mạch'),
  (SELECT id FROM hospitals   WHERE name='Bệnh viện Bạch Mai'),
  500000, 900000, 4.9;


CALL sp_generate_daily_slots(
  (SELECT id FROM doctors ORDER BY id LIMIT 1),
  CURDATE(),
  '09:00:00','12:00:00',
  '13:30:00','17:30:00',
  1,'P101'
);


select *from schedules;

-- 1) Thêm user tài khoản cho bác sĩ (nếu chưa tồn tại)
-- Lưu ý: thay mật khẩu hash thật sau (đang dùng demo hash giống seed trước)
INSERT IGNORE INTO users(email, password_hash, role, status) VALUES
  ('nguyenhoangbac@example.com', '$2b$10$hash_demo_doctor', 'doctor', 'active'),
  ('phamnhuhiep@example.com',   '$2b$10$hash_demo_doctor', 'doctor', 'active'),
  ('nguyentrithuc@example.com', '$2b$10$hash_demo_doctor', 'doctor', 'active'),
  ('nguyenlanhieu@example.com', '$2b$10$hash_demo_doctor', 'doctor', 'active');


-- Thêm danh mục theo select của bạn
INSERT INTO specialties(name, description) VALUES
  ('Nội tổng quát','Khám bệnh nội chung'),
  ('Nhi','Nhi khoa tổng quát'),
  ('Sản','Sản khoa'),
  ('Tim mạch','Khám và điều trị tim mạch'),
  ('Tai mũi họng','TMH'),
  ('Mắt','Nhãn khoa'),
  ('Da liễu','Bệnh da'),
  ('Nội tiết','Đái tháo đường, tuyến giáp...'),
  ('Cơ xương khớp','Cơ xương khớp'),
  ('Hô hấp','Phổi, hen, COPD'),
  ('Tiêu hoá','Tiêu hoá - gan mật'),
  ('Thần kinh','Bệnh lý hệ thần kinh'),
  ('Thận - tiết niệu','Thận, bàng quang, đường tiểu'),
  ('Răng hàm mặt','Nha khoa tổng quát và chuyên sâu'),
  ('Ung bướu','Chẩn đoán và điều trị ung thư'),
  ('Chấn thương chỉnh hình','Xương khớp, chấn thương'),
  ('Phục hồi chức năng','VLTL, hoạt động trị liệu')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- B1) Thêm cột dạng NULL, chưa unique
ALTER TABLE specialties
  ADD COLUMN IF NOT EXISTS slug VARCHAR(120) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS icon_path VARCHAR(191) NULL AFTER slug;
  
  SHOW COLUMNS FROM specialties LIKE 'slug';
SELECT COUNT(*) AS total,
       SUM(slug IS NULL OR slug='') AS null_or_empty
FROM specialties;

SET SQL_SAFE_UPDATES = 0;
-- Bảo đảm có slug chuẩn
UPDATE specialties SET slug = CASE TRIM(name)
  WHEN 'Nội tổng quát'          THEN 'noi-tong-quat'
  WHEN 'Nhi'                    THEN 'nhi'
  WHEN 'Sản'                    THEN 'san'
  WHEN 'Tim mạch'               THEN 'tim-mach'
  WHEN 'Tai mũi họng'           THEN 'tai-mui-hong'
  WHEN 'Mắt'                    THEN 'mat'
  WHEN 'Da liễu'                THEN 'da-lieu'
  WHEN 'Nội tiết'               THEN 'noi-tiet'
  WHEN 'Cơ xương khớp'          THEN 'co-xuong-khop'
  WHEN 'Hô hấp'                 THEN 'ho-hap'
  WHEN 'Tiêu hoá'               THEN 'tieu-hoa'
  WHEN 'Thần kinh'              THEN 'than-kinh'
  WHEN 'Thận - tiết niệu'       THEN 'than-tiet-nieu'
  WHEN 'Răng hàm mặt'           THEN 'rang-ham-mat'
  WHEN 'Ung bướu'               THEN 'ung-buou'
  WHEN 'Chấn thương chỉnh hình' THEN 'chan-thuong-chinh-hinh'
  WHEN 'Phục hồi chức năng'     THEN 'phuc-hoi-chuc-nang'
  ELSE slug END
WHERE slug IS NULL OR slug='';

-- Gán icon_path đúng thư mục /assets/icons/specialties/
UPDATE specialties
SET icon_path = CONCAT('/assets/icons/specialties/',
  CASE slug
    WHEN 'tim-mach'        THEN 'noi-tim-mach'
    WHEN 'tieu-hoa'        THEN 'noi-tieu-hoa'
    WHEN 'ho-hap'          THEN 'noi-ho-hap'
    WHEN 'than-kinh'       THEN 'than-kinh'
    WHEN 'noi-tiet'        THEN 'noi-tiet'
    WHEN 'co-xuong-khop'   THEN 'noi-co-xuong-khop'
    WHEN 'noi-tong-quat'   THEN 'noi-tong-quat'
    WHEN 'san'             THEN 'san-phu-khoa'
    ELSE slug
  END,
'.svg')
WHERE id > 0;

SET GLOBAL event_scheduler = ON;
SET time_zone = '+07:00'; 

DROP EVENT IF EXISTS ev_test_min;

DELIMITER $$
CREATE EVENT ev_test_min
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURRENT_DATE, '00:05:00')
DO
BEGIN
  CREATE TABLE IF NOT EXISTS event_log(
    id INT AUTO_INCREMENT PRIMARY KEY,
    note VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO event_log(note) VALUES('ev_test_min tick');
END$$
DELIMITER ;

USE tvnmedkit;

SHOW VARIABLES LIKE 'event_scheduler';

SHOW EVENTS FROM tvnmedkit WHERE Name='ev_test_min';

SHOW CREATE EVENT tvnmedkit.ev_test_min;

-- Kiểm tra kết quả
SELECT id, name, icon_path FROM specialties ORDER BY name;

-- đảm bảo bệnh viện tồn tại
INSERT IGNORE INTO hospitals(name, address, phone)
VALUES ('Bệnh viện Đại học Y Hà Nội', 'Số 1 Tôn Thất Tùng, Đống Đa, Hà Nội', '02438523798');

-- cập nhật hồ sơ bác sĩ Nguyễn Lân Hiếu
UPDATE doctors d
JOIN specialties sp ON sp.name = 'Tim mạch'
JOIN hospitals   h  ON h.name = 'Bệnh viện Đại học Y Hà Nội'
SET
  d.avatar           = '/assets/doctors/pgs_nguyen_lan_hieu.jpg',
  d.specialty_id     = sp.id,
  d.hospital_id      = h.id,
  d.experience_years = COALESCE(d.experience_years, 25),
  d.bio = CONCAT(
    'PGS.TS. BS. Nguyễn Lân Hiếu, chuyên gia Tim mạch người lớn và nhi; ',
    'Giám đốc Bệnh viện Đại học Y Hà Nội (từ 2019); ',
    'Phó chủ nhiệm Bộ môn Tim mạch, Đại học Y Hà Nội; ',
    'Đại biểu Quốc hội khóa XIV–XV. ',
    'Từng kiêm nhiệm Giám đốc BVĐK tỉnh Bình Dương (2022).'
  )
WHERE d.full_name LIKE 'PGS.TS Nguyễn Lân Hiếu';

		SELECT id, full_name FROM doctors
		WHERE full_name LIKE '%GS.TS Phạm Như Hiệp%';
        
SET @doc_id := 6;
SELECT @doc_id AS doc_id; 

DELETE FROM schedules
WHERE doctor_id = @doc_id AND start_time >= CURRENT_DATE();
-- Xoá lịch tương lai nếu muốn làm sạch trước khi seed (không bắt buộc)
-- DELETE FROM schedules WHERE doctor_id=@doc_id AND start_time >= CURRENT_DATE();

-- Tạo lịch: sáng 08:00–11:00, chiều 13:30–16:30 (60’/slot), phòng P201
CALL sp_generate_daily_slots(@doc_id, CURDATE(),                              '08:00:00','11:00:00', '13:30:00','16:30:00', 1, 'P201');
CALL sp_generate_daily_slots(@doc_id, DATE_ADD(CURDATE(), INTERVAL 1 DAY),     '08:00:00','11:00:00', '13:30:00','16:30:00', 1, 'P201');
CALL sp_generate_daily_slots(@doc_id, DATE_ADD(CURDATE(), INTERVAL 2 DAY),     '08:00:00','11:00:00', '13:30:00','16:30:00', 1, 'P201');
CALL sp_generate_daily_slots(@doc_id, DATE_ADD(CURDATE(), INTERVAL 3 DAY),     '08:00:00','11:00:00', '13:30:00','16:30:00', 1, 'P201');
CALL sp_generate_daily_slots(@doc_id, DATE_ADD(CURDATE(), INTERVAL 7 DAY),     '08:00:00','11:00:00', '13:30:00','16:30:00', 1, 'P201');

CALL sp_generate_daily_slots(@doc_id, DATE_ADD(CURDATE(), INTERVAL 1 DAY),
  '08:00:00','11:00:00','13:30:00','16:30:00', 1, 'P201');

CALL sp_generate_daily_slots(@doc_id, DATE_ADD(CURDATE(), INTERVAL 2 DAY),
  '08:00:00','11:00:00','13:30:00','16:30:00', 1, 'P201');


SET @doc_id := 4;
SELECT @doc_id AS doc_id; 

CALL sp_generate_daily_slots(4, DATE_ADD(CURDATE(), INTERVAL 1 DAY),
  '08:00:00','11:00:00','13:30:00','16:30:00', 1, 'P205');

CALL sp_generate_daily_slots(4, DATE_ADD(CURDATE(), INTERVAL 2 DAY),
  '08:00:00','11:00:00','13:30:00','16:30:00', 1, 'P205');
  
SET @has := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name   = 'appointments'
    AND index_name   = 'uk_appt_schedule_once'
);
SET @sql := IF(@has=0,
  'ALTER TABLE appointments ADD UNIQUE KEY uk_appt_schedule_once (schedule_id)',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SHOW INDEX FROM appointments WHERE Key_name='uk_appt_schedule_once';
-- Kiểm tra nhanh các slot vừa tạo
SELECT DATE(start_time) AS day, TIME(start_time) AS time, session, room
FROM schedules
WHERE doctor_id= 4 AND start_time >= CURRENT_DATE()
ORDER BY start_time;


SELECT DATABASE();

SELECT schedule_id, COUNT(*) cnt
FROM appointments
GROUP BY schedule_id
HAVING cnt > 1;

CREATE UNIQUE INDEX uk_appt_schedule_once ON appointments(schedule_id);
SHOW INDEX FROM appointments WHERE Key_name='uk_appt_schedule_once';

ALTER TABLE notifications
  ADD COLUMN kind ENUM('booked','cancelled','upcoming_24h','upcoming_2h','other') NOT NULL DEFAULT 'other' AFTER message,
  ADD COLUMN appointment_id INT UNSIGNED NULL AFTER kind,
  ADD CONSTRAINT fk_notif_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  ADD UNIQUE KEY uk_notif_unique (user_id, kind, appointment_id);
 


-- 1) Bỏ unique cũ đang khóa slot vĩnh viễn
DROP INDEX uk_appt_schedule_once ON appointments;
-- (nếu đang có) bỏ luôn unique theo bệnh nhân+slot vì không còn phù hợp
DROP INDEX uk_appt_patient_schedule ON appointments;

-- 2) Tạo cột sinh (generated) đánh dấu active
ALTER TABLE appointments
  ADD COLUMN is_active TINYINT(1)
  AS (status IN ('pending','confirmed')) STORED;

-- 3) Chỉ cấm 2 bản ghi active cùng schedule
CREATE UNIQUE INDEX uk_appt_sched_active ON appointments(schedule_id, is_active);

select *from notifications;


-- cột kind
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='notifications' AND COLUMN_NAME='kind')=0,
  'ALTER TABLE notifications ADD COLUMN kind ENUM(''booked'',''cancelled'',''upcoming_24h'',''upcoming_2h'',''other'') NOT NULL DEFAULT ''other'' AFTER message',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- cột appointment_id
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='notifications' AND COLUMN_NAME='appointment_id')=0,
  'ALTER TABLE notifications ADD COLUMN appointment_id INT UNSIGNED NULL AFTER kind',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- FK tới appointments(id)
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='notifications' AND CONSTRAINT_NAME='fk_notif_appt')=0,
  'ALTER TABLE notifications ADD CONSTRAINT fk_notif_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- unique chống trùng
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='notifications' AND INDEX_NAME='uk_notif_unique')=0,
  'ALTER TABLE notifications ADD UNIQUE KEY uk_notif_unique (user_id, kind, appointment_id)',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SHOW COLUMNS FROM notifications LIKE 'kind';
SHOW COLUMNS FROM notifications LIKE 'appointment_id';
SHOW INDEX FROM notifications WHERE Key_name='uk_notif_unique';
SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notifications' AND CONSTRAINT_NAME='fk_notif_appt';

SHOW CREATE TABLE appointments;
ALTER TABLE appointments DROP FOREIGN KEY fk_appt_schedule;
DROP INDEX uk_appt_schedule_once ON appointments;

DROP INDEX uk_appt_patient_schedule ON appointments;

ALTER TABLE appointments
  ADD COLUMN is_active TINYINT(1)
  GENERATED ALWAYS AS (CASE WHEN status IN ('pending','confirmed') THEN 1 ELSE 0 END) STORED;

CREATE UNIQUE INDEX uk_appt_sched_active ON appointments(schedule_id, is_active);

ALTER TABLE appointments
  ADD CONSTRAINT fk_appt_schedule
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT;
  
SHOW INDEX FROM appointments;
SHOW CREATE TABLE appointments;
DROP INDEX uk_appt_patient_schedule ON appointments;

-- Tên FK xác nhận bằng SHOW CREATE TABLE (thường là fk_appt_patient)
ALTER TABLE appointments DROP FOREIGN KEY fk_appt_patient;

DROP INDEX uk_appt_patient_schedule ON appointments;

-- Tạo index đơn cho patient_id (tốt cho hiệu năng và để FK dùng)
CREATE INDEX idx_appt_patient ON appointments(patient_id);

-- Tạo lại FK
ALTER TABLE appointments
  ADD CONSTRAINT fk_appt_patient
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

-- 1) Bỏ unique cũ gây lỗi
SHOW CREATE TABLE appointments;
CREATE INDEX idx_appt_schedule ON appointments(schedule_id);
ALTER TABLE appointments DROP INDEX uk_appt_sched_active;
ALTER TABLE appointments DROP FOREIGN KEY fk_appt_schedule;
DROP INDEX uk_appt_sched_active ON appointments;
-- 2) Thêm cột sinh: chỉ set bằng schedule_id khi còn active
ALTER TABLE appointments
  ADD COLUMN active_key INT
  GENERATED ALWAYS AS (
    CASE WHEN status IN ('pending','confirmed') THEN schedule_id ELSE NULL END
  ) STORED;

-- 3) Unique chỉ áp vào các hàng active (NULL không bị unique)
CREATE UNIQUE INDEX uk_appt_active_key ON appointments(active_key);

ALTER TABLE appointments
  ADD CONSTRAINT fk_appt_schedule
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT;
 
CREATE TABLE IF NOT EXISTS slot_holds (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id  INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  expires_at   DATETIME NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hold_sched_exp (schedule_id, expires_at),
  UNIQUE KEY uk_hold_sched_user (schedule_id, user_id),
  CONSTRAINT fk_hold_sched  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_hold_user   FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
);



ALTER TABLE appointments
  ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER status;
select *from slot_holds;
select *from  services;

drop table chat_logs;

select *from schedules;
DELETE FROM slot_holds WHERE expires_at <= NOW() LIMIT 10000;



-- Biểu đồ
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_audit_user (admin_user_id),
  INDEX idx_admin_audit_time (created_at)
) ENGINE=InnoDB;

select *from admin_audit_logs;

UPDATE users SET role='admin', status='active' WHERE email='admin123@gmail.com';

INSERT INTO users (email, password_hash, role, status)
VALUES ('admin2@tvn.local', '$2b$10$4iPZla1cZ1pdqZdFlgoZEOjLjyaNr4LBjLFB21ymtiPsMSkULP9Gq', 'admin', 'active');

select *from hospital_photos;
-- Ảnh phụ bệnh viện
CREATE TABLE IF NOT EXISTS hospital_photos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT UNSIGNED NOT NULL,
  image_url   VARCHAR(512) NOT NULL,
  caption     VARCHAR(191) NULL,
  sort_order  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hphoto_hosp FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  INDEX idx_hphoto_hosp_sort (hospital_id, sort_order, id)
) ENGINE=InnoDB;



-- ví dụ seed
INSERT INTO hospital_photos (hospital_id, image_url, caption, sort_order)
SELECT id,
       '/assets/hospitals/dhycs338-1712219517759.webp',
       'Mặt tiền bệnh viện',
       1
FROM hospitals
WHERE name = 'Bệnh viện Đại học Y Hà Nội';

INSERT INTO hospital_photos (hospital_id, image_url, caption, sort_order)
SELECT id,
       '/assets/hospitals/DHY-HN.jpg',
       'Khuôn viên bệnh viện',
       2
FROM hospitals
WHERE name = 'Bệnh viện Đại học Y Hà Nội';

delete from hospital_photos
where id > 0;

-- 1) Bảng trung gian nhiều-nhiều: bệnh viện <-> chuyên khoa
CREATE TABLE IF NOT EXISTS hospital_specialties (
  hospital_id  INT UNSIGNED NOT NULL,
  specialty_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (hospital_id, specialty_id),
  CONSTRAINT fk_hs_hospital  FOREIGN KEY (hospital_id)  REFERENCES hospitals(id)   ON DELETE CASCADE,
  CONSTRAINT fk_hs_specialty FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2) Seed quan hệ dựa trên hồ sơ bác sĩ đã có (bác sĩ nào thuộc BV X & CK Y thì mặc định BV X có CK Y)
INSERT IGNORE INTO hospital_specialties (hospital_id, specialty_id)
SELECT DISTINCT d.hospital_id, d.specialty_id
FROM doctors d
WHERE d.hospital_id IS NOT NULL
  AND d.specialty_id IS NOT NULL;
  
CREATE INDEX IF NOT EXISTS idx_hs_spec ON hospital_specialties(specialty_id, hospital_id);

-- 1) Mở rộng enum 'kind' thêm 'confirmed'
ALTER TABLE notifications
  MODIFY COLUMN kind ENUM('booked','confirmed','cancelled','upcoming_24h','upcoming_2h','other')
  NOT NULL DEFAULT 'other';

-- 2) Tạo event xóa thông báo > 7 ngày, chạy hằng ngày lúc 00:10
SET GLOBAL event_scheduler = ON;
DELIMITER $$
CREATE EVENT IF NOT EXISTS ev_cleanup_notifications_7d
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURRENT_DATE, '00:10:00')
DO
BEGIN
  DELETE FROM notifications WHERE sent_at < NOW() - INTERVAL 7 DAY;
END$$
DELIMITER ;

-- 3) Chỉ số phục vụ list nhanh
CREATE INDEX IF NOT EXISTS idx_notif_user_unread_time ON notifications(user_id, is_read, sent_at DESC);

-- ========== TVN Medkit • Assistant Chat (7-day retention) ==========
-- Bảng phiên chat
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            CHAR(26) PRIMARY KEY,          -- ulid/uuid rút gọn
  user_id       INT UNSIGNED NOT NULL,
  title         VARCHAR(180) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cs_user (user_id, last_activity DESC),
  CONSTRAINT fk_cs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng tin nhắn
CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  CHAR(26) NOT NULL,
  user_id     INT UNSIGNED NOT NULL,           -- chủ phiên (để purge theo user)
  role        ENUM('system','user','assistant','tool') NOT NULL,
  content     MEDIUMTEXT NOT NULL,
  meta        JSON NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cm_session (session_id, created_at),
  CONSTRAINT fk_cm_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bật event scheduler (nếu server cho phép)
SET GLOBAL event_scheduler = ON;

-- Event dọn lịch sử > 7 ngày
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
-- ===============================================================
select *from chat_messages;

-- [NEWS-DB] Bảng chuyên mục: 3 danh mục cố định
CREATE TABLE IF NOT EXISTS news_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(32) NOT NULL UNIQUE,     -- 'service' | 'domestic' | 'world'
  display_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- [NEWS-DB] Bảng nguồn RSS: quản lý feed, map trực tiếp sang category
CREATE TABLE IF NOT EXISTS news_sources (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,               -- tên nguồn hiển thị
  domain VARCHAR(150) NULL,                 -- ví dụ: moh.gov.vn
  rss_url VARCHAR(500) NOT NULL,            -- URL RSS gốc
  category_key VARCHAR(32) NOT NULL,        -- key của news_categories
  country_code VARCHAR(8) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_rss (rss_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- [NEWS-DB] Bảng bài viết: lưu tóm tắt/metadata từ RSS
CREATE TABLE IF NOT EXISTS news_articles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,        -- FK -> news_categories
  source_id INT UNSIGNED NULL,              -- FK -> news_sources
  title VARCHAR(255) NOT NULL,              -- tiêu đề
  slug VARCHAR(255) NOT NULL,               -- slug nội bộ (unique để dự phòng)
  summary TEXT NULL,                        -- mô tả ngắn (text-only)
  content_text MEDIUMTEXT NULL,             -- để mở rộng search sau này
  cover_url VARCHAR(500) NULL,              -- ảnh đại diện (nếu tách được)
  cover_alt VARCHAR(200) NULL,              -- alt cho ảnh
  is_external TINYINT(1) NOT NULL DEFAULT 1,-- bài dẫn link ra ngoài
  external_url VARCHAR(500) NULL,           -- link nguồn gốc (unique chống trùng)
  status ENUM('published','archived') NOT NULL DEFAULT 'published',
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_news_cat FOREIGN KEY (category_id) REFERENCES news_categories(id),
  CONSTRAINT fk_news_src FOREIGN KEY (source_id) REFERENCES news_sources(id),
  UNIQUE KEY uniq_slug (slug),
  UNIQUE KEY uniq_external (external_url),
  INDEX idx_status_pub (status, published_at),
  FULLTEXT KEY ft_news (title, content_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- [NEWS-DB] Seed 3 danh mục chuẩn
INSERT IGNORE INTO news_categories (key_name, display_name) VALUES
  ('service','Tin dịch vụ'),
  ('domestic','Tin y tế trong nước'),
  ('world','Tin y tế thế giới');
  
  INSERT IGNORE INTO news_sources (name, domain, rss_url, category_key, country_code) VALUES
-- ========== DOMESTIC (Tin y tế trong nước) ==========
('Báo Sức khỏe & Đời sống - Chuyên mục Y tế', 'suckhoedoisong.vn', 'https://suckhoedoisong.vn/y-te.rss', 'domestic', 'VN'),
('VnExpress - Sức khỏe',                         'vnexpress.net',       'https://vnexpress.net/rss/suc-khoe.rss',         'domestic', 'VN'),

-- ========== SERVICE (Tin dịch vụ) ==========
-- Có thể dùng các nhánh thiên về dịch vụ/tra cứu/dược để điền tạm nhóm "service"
('Báo Sức khỏe & Đời sống - Dược',              'suckhoedoisong.vn', 'https://suckhoedoisong.vn/duoc.rss',  'service',  'VN'),
('VTV.vn - Sức khỏe (RSS trang chính thức)',    'vtv.vn',             'https://vtv.vn/rss/suc-khoe.rss',     'service',  'VN'),

-- ========== WORLD (Tin y tế thế giới) ==========
('ECDC - News / Press releases',                 'ecdc.europa.eu',     'https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed', 'world', 'EU'),
('CDC (US) - Newsroom (Health & Medicine)',     'cdc.gov',            'https://tools.cdc.gov/api/v2/resources/media/132608.rss', 'world', 'US');

SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;

-- 1) Kiểm tra trước khi xóa
SELECT id, name, rss_url
FROM news_sources
WHERE domain = 'vtv.vn' OR rss_url LIKE '%vtv.vn%';

-- 2) Xóa tất cả bài viết thuộc nguồn VTV
DELETE a
FROM news_articles a
JOIN news_sources s ON s.id = a.source_id
WHERE s.domain = 'vtv.vn' OR s.rss_url LIKE '%vtv.vn%';

-- 3) Xóa nguồn VTV khỏi bảng news_sources
DELETE FROM news_sources
WHERE domain = 'vtv.vn' OR rss_url LIKE '%vtv.vn%';

COMMIT;

-- 4) Xác nhận đã sạch
SELECT COUNT(*) AS left_sources
FROM news_sources
WHERE domain = 'vtv.vn' OR rss_url LIKE '%vtv.vn%';

SELECT c.key_name, COUNT(*) AS n
FROM news_articles a
JOIN news_sources s ON s.id = a.source_id
JOIN news_categories c ON c.id = a.category_id
WHERE s.domain = 'vtv.vn' OR s.rss_url LIKE '%vtv.vn%'
GROUP BY c.key_name;

use tvnmedkit;
show tables;
select *from users;
UPDATE users
SET password_hash = '$2b$10$aJ5WlvAk4bDdjhVPzfzmtO.7Xyu5aEfuEbUpb2hscPkAPOC75rZGC'
WHERE email IN ('phamnhuhiep@example.com','nguyenhoangbac@example.com')
  AND role='doctor';
  
select *from doctors;
select *from users;
select *from patients;
select *from hospitals; 
select *from specialties;
select *from appointments;
select *from notifications;
select *from hospital_specialties;
select *from schedules;
SET SQL_SAFE_UPDATES = 0;

-- gán sao cho bác sĩ
UPDATE doctors
SET
  rating_avg   = ROUND(3.9 + RAND() * 1.2, 1),  -- 3.8 → 5.0, làm tròn 1 chữ số
  rating_count = FLOOR(10 + RAND() * 90)        -- 10 → 99 lượt
WHERE rating_avg IS NULL OR rating_avg = 0;

show tables;



select *from chat_messages;

