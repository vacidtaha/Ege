/**
 * Ege Palas OYS - Veritabanı Bağlantı Modülü
 * SQLite veritabanı işlemleri (better-sqlite3)
 * Anlık senkronizasyon - doğrudan dosyayla çalışır
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('@electron/remote');

// Veritabanı yolu - Kullanıcı verisi klasöründe (uygulama dağıtımına uygun)
const DB_PATH = path.join(app.getPath('userData'), 'egepalas.db');

let db = null;

/**
 * Türkiye saatine göre tarih/saat döndürür
 * Format: YYYY-MM-DD HH:MM:SS
 */
function getTurkeyDateTime() {
  const now = new Date();
  const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const year = turkeyTime.getFullYear();
  const month = String(turkeyTime.getMonth() + 1).padStart(2, '0');
  const day = String(turkeyTime.getDate()).padStart(2, '0');
  const hours = String(turkeyTime.getHours()).padStart(2, '0');
  const minutes = String(turkeyTime.getMinutes()).padStart(2, '0');
  const seconds = String(turkeyTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Türkiye saatine göre sadece tarih döndürür
 * Format: YYYY-MM-DD
 */
function getTurkeyDate() {
  const now = new Date();
  const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const year = turkeyTime.getFullYear();
  const month = String(turkeyTime.getMonth() + 1).padStart(2, '0');
  const day = String(turkeyTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Veritabanını sıfırdan oluşturur (ilk kurulum)
 */
function initializeDatabase() {
  console.log('Yeni veritabanı oluşturuluyor:', DB_PATH);
  
  // Veritabanı klasörünü oluştur
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Yeni veritabanı oluştur
  db = new Database(DB_PATH);
  
  // ============================================
  // TABLO OLUŞTURMA
  // ============================================
  
  // Oda Tipi Tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS oda_tipi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oda_tipi TEXT NOT NULL
    )
  `);
  
  // Oda Tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS oda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oda_numarasi TEXT NOT NULL,
      oda_tipi_id INTEGER,
      doluluk_durumu TEXT DEFAULT 'bos',
      temizlik_durumu TEXT DEFAULT 'temiz',
      kapasite INTEGER,
      bakim_ariza_notu TEXT DEFAULT NULL,
      bakim_ariza_tarihi TEXT DEFAULT NULL,
      balkon INTEGER DEFAULT 0,
      oda_notu TEXT DEFAULT '',
      cleaning_status TEXT DEFAULT NULL,
      FOREIGN KEY (oda_tipi_id) REFERENCES oda_tipi(id)
    )
  `);
  
  // Aktif Kalanlar (Otelde bulunan misafirler)
  db.exec(`
    CREATE TABLE IF NOT EXISTS aktif_kalanlar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT NOT NULL,
      soyisim TEXT NOT NULL,
      tc_no TEXT,
      pasaport_no TEXT,
      telefon TEXT,
      eposta TEXT,
      cinsiyet TEXT,
      uyruk TEXT,
      dogum_tarihi TEXT DEFAULT NULL,
      otele_giris_tarihi DATE,
      cikis_tarihi DATE,
      egm_kaydi INTEGER DEFAULT 0,
      not_alani TEXT,
      oda_id INTEGER REFERENCES oda(id),
      ucret REAL DEFAULT NULL
    )
  `);
  
  // Tüm Misafirler (Checkout yapılmış)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tum_misafirler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT NOT NULL,
      soyisim TEXT NOT NULL,
      tc_no TEXT,
      pasaport_no TEXT,
      telefon TEXT,
      eposta TEXT,
      cinsiyet TEXT,
      uyruk TEXT,
      dogum_tarihi TEXT DEFAULT NULL,
      otele_giris_tarihi DATE,
      cikis_tarihi DATE,
      egm_kaydi INTEGER DEFAULT 0,
      not_alani TEXT,
      ucret REAL DEFAULT NULL,
      egm_cikis_yapildi INTEGER DEFAULT 0,
      oda_id INTEGER DEFAULT NULL
    )
  `);
  
  // tum_misafirler index'leri (arama performansı için)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_isim ON tum_misafirler(isim)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_soyisim ON tum_misafirler(soyisim)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_tc ON tum_misafirler(tc_no)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_pasaport ON tum_misafirler(pasaport_no)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_giris ON tum_misafirler(otele_giris_tarihi)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_cikis ON tum_misafirler(cikis_tarihi)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tum_misafirler_oda ON tum_misafirler(oda_id)`);

  // Aktif Rezervasyonlar
  db.exec(`
    CREATE TABLE IF NOT EXISTS aktif_rezervasyon (
      rezervasyon_id INTEGER PRIMARY KEY AUTOINCREMENT,
      giris_tarihi DATETIME,
      cikis_tarihi DATETIME,
      isim TEXT NOT NULL,
      soyisim TEXT NOT NULL,
      oda_id INTEGER NOT NULL,
      not_alani TEXT,
      telefon TEXT,
      ucret TEXT,
      FOREIGN KEY (oda_id) REFERENCES oda(id)
    )
  `);
  
  // Giriş Yapan Rezervasyonlar
  db.exec(`
    CREATE TABLE IF NOT EXISTS giris_yapan_rezervasyon (
      rezervasyon_id INTEGER PRIMARY KEY AUTOINCREMENT,
      giris_tarihi DATE,
      cikis_tarihi DATE,
      isim TEXT NOT NULL,
      soyisim TEXT NOT NULL,
      oda TEXT,
      not_alani TEXT,
      telefon TEXT,
      oda_id INTEGER
    )
  `);
  
  // İptal Edilen Rezervasyonlar
  db.exec(`
    CREATE TABLE IF NOT EXISTS iptal_edilen_rezervasyon (
      rezervasyon_id INTEGER PRIMARY KEY AUTOINCREMENT,
      giris_tarihi DATE,
      cikis_tarihi DATE,
      isim TEXT NOT NULL,
      soyisim TEXT NOT NULL,
      oda TEXT,
      not_alani TEXT,
      telefon TEXT,
      oda_id INTEGER
    )
  `);
  
  // ============================================
  // ODA TİPLERİNİ EKLE
  // ============================================
  const odaTipleri = [
    { id: 1, tip: '3 Single' },
    { id: 2, tip: 'Double' },
    { id: 3, tip: '1 Single' },
    { id: 4, tip: '2 Single' },
    { id: 5, tip: 'Suit' },
    { id: 6, tip: '1 Double 1 Single' },
    { id: 7, tip: '1 Double 2 Single' }
  ];
  
  const insertOdaTipi = db.prepare('INSERT INTO oda_tipi (id, oda_tipi) VALUES (?, ?)');
  odaTipleri.forEach(tip => {
    insertOdaTipi.run(tip.id, tip.tip);
  });
  console.log('✓ Oda tipleri eklendi');
  
  // ============================================
  // EGE PALAS ODALARINI EKLE
  // ============================================
  const odalar = [
    // 1. Kat
    { id: 1, numara: '101', tipiId: 1, kapasite: 3, balkon: 0 },
    { id: 2, numara: '102', tipiId: 2, kapasite: 2, balkon: 1 },
    { id: 3, numara: '103', tipiId: 3, kapasite: 1, balkon: 1 },
    { id: 5, numara: '105', tipiId: 4, kapasite: 2, balkon: 0 },
    
    // 2. Kat
    { id: 7, numara: '201', tipiId: 6, kapasite: 3, balkon: 0 },
    { id: 8, numara: '202', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 9, numara: '203', tipiId: 3, kapasite: 1, balkon: 1 },
    { id: 10, numara: '204', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 11, numara: '205', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 12, numara: '206', tipiId: 6, kapasite: 3, balkon: 0 },
    { id: 13, numara: '207', tipiId: 2, kapasite: 2, balkon: 1 },
    { id: 14, numara: '208', tipiId: 6, kapasite: 3, balkon: 0 },
    { id: 15, numara: '209', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 43, numara: '210', tipiId: 2, kapasite: 2, balkon: 1 },
    
    // 3. Kat
    { id: 16, numara: '301', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 17, numara: '302', tipiId: 2, kapasite: 2, balkon: 1 },
    { id: 18, numara: '303', tipiId: 3, kapasite: 1, balkon: 1 },
    { id: 19, numara: '304', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 20, numara: '305', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 21, numara: '306', tipiId: 1, kapasite: 3, balkon: 0 },
    { id: 22, numara: '307', tipiId: 2, kapasite: 2, balkon: 1 },
    { id: 23, numara: '308', tipiId: 7, kapasite: 4, balkon: 0 },
    { id: 24, numara: '309', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 44, numara: '310', tipiId: 2, kapasite: 2, balkon: 1 },
    
    // 4. Kat
    { id: 25, numara: '401', tipiId: 6, kapasite: 3, balkon: 0 },
    { id: 26, numara: '402', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 27, numara: '403', tipiId: 3, kapasite: 1, balkon: 1 },
    { id: 28, numara: '404', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 29, numara: '405', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 30, numara: '406', tipiId: 6, kapasite: 3, balkon: 0 },
    { id: 31, numara: '407', tipiId: 2, kapasite: 2, balkon: 1 },
    { id: 32, numara: '408', tipiId: 7, kapasite: 4, balkon: 0 },
    { id: 33, numara: '409', tipiId: 2, kapasite: 2, balkon: 0 },
    { id: 45, numara: '410', tipiId: 2, kapasite: 2, balkon: 1 },
    
    // 5. Kat
    { id: 34, numara: '501', tipiId: 1, kapasite: 3, balkon: 0 },
    { id: 35, numara: '502', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 36, numara: '503', tipiId: 3, kapasite: 1, balkon: 1 },
    { id: 37, numara: '504', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 38, numara: '505', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 39, numara: '506', tipiId: 1, kapasite: 3, balkon: 0 },
    { id: 40, numara: '507', tipiId: 4, kapasite: 2, balkon: 1 },
    { id: 41, numara: '508', tipiId: 1, kapasite: 3, balkon: 0 },
    { id: 42, numara: '509', tipiId: 4, kapasite: 2, balkon: 0 },
    { id: 46, numara: '510', tipiId: 4, kapasite: 2, balkon: 1 },
    
    // Suit
    { id: 6, numara: 'Suit', tipiId: 5, kapasite: 7, balkon: 1 }
  ];
  
  const insertOda = db.prepare(`
    INSERT INTO oda (id, oda_numarasi, oda_tipi_id, kapasite, balkon, doluluk_durumu, temizlik_durumu)
    VALUES (?, ?, ?, ?, ?, 'bos', 'temiz')
  `);
  
  odalar.forEach(oda => {
    insertOda.run(oda.id, oda.numara, oda.tipiId, oda.kapasite, oda.balkon);
  });
  console.log('✓ Ege Palas odaları eklendi (' + odalar.length + ' oda)');
  
  console.log('✓ Veritabanı başarıyla oluşturuldu!');
  return true;
}

/**
 * Günlük otomatik yedekleme (son 3 yedeği tutar)
 */
function autoBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return;

    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Bugünün tarihi (Türkiye saati)
    const now = new Date();
    const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    const today = `${turkeyTime.getFullYear()}-${String(turkeyTime.getMonth() + 1).padStart(2, '0')}-${String(turkeyTime.getDate()).padStart(2, '0')}`;
    const backupFile = path.join(backupDir, `egepalas_yedek_${today}.db`);

    // Bugünün yedeği yoksa al
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(DB_PATH, backupFile);
      console.log('✓ Otomatik yedek alındı:', backupFile);
    }

    // Eski yedekleri temizle (son 3 tane kalsın)
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('egepalas_yedek_') && f.endsWith('.db'))
      .sort();

    while (backups.length > 3) {
      const oldest = backups.shift();
      fs.unlinkSync(path.join(backupDir, oldest));
      console.log('✗ Eski yedek silindi:', oldest);
    }
  } catch (err) {
    console.error('Yedekleme hatası:', err.message);
  }
}

/**
 * Veritabanı bağlantısını başlatır
 */
function connect() {
  try {
    // Veritabanı dosyası yoksa yeni oluştur
    if (!fs.existsSync(DB_PATH)) {
      console.log('Veritabanı bulunamadı, yeni oluşturuluyor...');
      const result = initializeDatabase();
      // Yeni oluşturulan DB'nin de yedeğini al
      autoBackup();
      return result;
    }

    // Bağlanmadan önce günlük yedek al
    autoBackup();

    // Mevcut veritabanına bağlan
    db = new Database(DB_PATH);
    
    // Sütun güncellemeleri (mevcut veritabanları için uyumluluk)
    const alterColumns = [
      { table: 'oda', column: 'bakim_ariza_notu', type: 'TEXT DEFAULT NULL' },
      { table: 'oda', column: 'bakim_ariza_tarihi', type: 'TEXT DEFAULT NULL' },
      { table: 'oda', column: 'cleaning_status', type: 'TEXT DEFAULT NULL' },
      { table: 'aktif_kalanlar', column: 'dogum_tarihi', type: 'TEXT DEFAULT NULL' },
      { table: 'aktif_kalanlar', column: 'ucret', type: 'REAL DEFAULT NULL' },
      { table: 'tum_misafirler', column: 'dogum_tarihi', type: 'TEXT DEFAULT NULL' },
      { table: 'tum_misafirler', column: 'ucret', type: 'REAL DEFAULT NULL' },
      { table: 'aktif_rezervasyon', column: 'ucret', type: 'TEXT' }
    ];
    
    alterColumns.forEach(({ table, column, type }) => {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`${column} sütunu ${table} tablosuna eklendi`);
      } catch (e) {
        // Sütun zaten varsa sorun değil
      }
    });
    
    console.log('Veritabanına bağlanıldı:', DB_PATH);
    return true;
  } catch (error) {
    console.error('Veritabanı bağlantı hatası:', error);
    console.error('Hata detayı:', error.stack);
    return false;
  }
}

/**
 * Veritabanı bağlantısını kapatır
 */
function close() {
  if (db) {
    db.close();
    db = null;
    console.log('Veritabanı bağlantısı kapatıldı');
  }
}

/**
 * SQL sorgusu çalıştırır ve sonuçları döndürür
 */
function query(sql, params = []) {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    console.error('SQL Hatası:', error);
    return [];
  }
}

/**
 * SQL sorgusu çalıştırır (INSERT, UPDATE, DELETE)
 */
function run(sql, params = []) {
  if (!db) return { success: false };
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('SQL Hatası:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// ODA İŞLEMLERİ
// ============================================

/**
 * Oda durumlarını aktif misafirlere göre senkronlar
 */
function syncRoomStatus() {
  try {
    // Tüm odaları al
    const allRooms = query('SELECT id, oda_numarasi FROM oda');
    
    // Aktif kalanların oda ID'lerini al
    const activeGuests = query('SELECT DISTINCT oda_id FROM aktif_kalanlar WHERE oda_id IS NOT NULL');
    
    // Dolu oda ID'lerini set olarak tut
    const occupiedRoomIds = new Set(activeGuests.map(g => g.oda_id));
    
    console.log('Aktif misafir sayısı:', activeGuests.length);
    console.log('Dolu oda IDleri:', Array.from(occupiedRoomIds));
    
    // Her odanın durumunu güncelle
    const updateStmt = db.prepare('UPDATE oda SET doluluk_durumu = ? WHERE id = ?');
    
    allRooms.forEach(room => {
      const isOccupied = occupiedRoomIds.has(room.id);
      const newStatus = isOccupied ? 'dolu' : 'bos';
      updateStmt.run(newStatus, room.id);
    });
    
    console.log('Oda durumları senkronlandı. Dolu oda sayısı:', occupiedRoomIds.size);
    return true;
  } catch (error) {
    console.error('Oda senkronizasyon hatası:', error);
    return false;
  }
}

/**
 * Tüm odaları getirir
 */
function getAllRooms() {
  const sql = `
    SELECT 
      o.id,
      o.oda_numarasi,
      o.doluluk_durumu,
      o.temizlik_durumu,
      o.temizlik_durumu as durum,
      o.kapasite,
      o.bakim_ariza_notu,
      o.bakim_ariza_tarihi,
      o.balkon,
      o.oda_notu,
      o.cleaning_status,
      ot.oda_tipi
    FROM oda o
    LEFT JOIN oda_tipi ot ON o.oda_tipi_id = ot.id
    ORDER BY o.oda_numarasi
  `;
  return query(sql);
}

/**
 * Oda durumunu günceller
 */
function updateRoomStatus(roomId, doluluk, temizlik) {
  return run(
    'UPDATE oda SET doluluk_durumu = ?, temizlik_durumu = ? WHERE id = ?',
    [doluluk, temizlik, roomId]
  );
}

/**
 * Oda bakım notunu günceller
 */
function updateRoomNote(roomId, note) {
  return run('UPDATE oda SET bakim_ariza_notu = ? WHERE id = ?', [note, roomId]);
}

/**
 * Oda tiplerini getirir
 */
function getRoomTypes() {
  return query('SELECT * FROM oda_tipi ORDER BY id');
}

// ============================================
// REZERVASYON İŞLEMLERİ
// ============================================

/**
 * Aktif rezervasyonları getirir
 */
function getActiveReservations() {
  return query('SELECT * FROM aktif_rezervasyon ORDER BY giris_tarihi');
}

/**
 * Geçmiş tarihli (giriş yapılmamış) rezervasyonları getirir
 * Giriş tarihi bugünden önce olan ve hala aktif_rezervasyon tablosunda kalan rezervasyonlar
 */
function getExpiredReservations() {
  const today = getTurkeyDate();
  return query(`
    SELECT * FROM aktif_rezervasyon 
    WHERE DATE(giris_tarihi) < ? 
    ORDER BY giris_tarihi DESC
  `, [today]);
}

/**
 * Çıkış tarihi geçmiş (checkout yapmamış) misafirleri getirir
 * Çıkış tarihi bugünden önce olan ve hala aktif_kalanlar tablosunda kalan misafirler
 */
function getOverdueGuests() {
  const today = getTurkeyDate();
  return query(`
    SELECT ak.*, o.oda_numarasi 
    FROM aktif_kalanlar ak
    LEFT JOIN oda o ON ak.oda_id = o.id
    WHERE DATE(ak.cikis_tarihi) < ? 
    ORDER BY ak.cikis_tarihi ASC
  `, [today]);
}

/**
 * Giriş yapan rezervasyonları getirir
 */
function getCheckedInReservations() {
  return query('SELECT * FROM giris_yapan_rezervasyon ORDER BY giris_tarihi');
}

/**
 * İptal edilen rezervasyonları getirir
 */
function getCancelledReservations() {
  return query('SELECT * FROM iptal_edilen_rezervasyon ORDER BY giris_tarihi DESC');
}

/**
 * Yeni rezervasyon ekler
 */
function addReservation(data) {
  return run(
    `INSERT INTO aktif_rezervasyon (giris_tarihi, cikis_tarihi, isim, soyisim, not_alani, oda_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.giris_tarihi, data.cikis_tarihi, data.isim, data.soyisim, data.not_alani || null, data.oda_id || null]
  );
}

/**
 * Rezervasyonu giriş yapılana taşır
 */
function checkInReservation(reservationId) {
  const reservations = query('SELECT * FROM aktif_rezervasyon WHERE rezervasyon_id = ?', [reservationId]);
  
  if (reservations.length > 0) {
    const r = reservations[0];
    run(
      `INSERT INTO giris_yapan_rezervasyon (giris_tarihi, cikis_tarihi, isim, soyisim, not_alani, oda_id, telefon)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.giris_tarihi, r.cikis_tarihi, r.isim, r.soyisim, r.not_alani, r.oda_id, r.telefon]
    );
    run('DELETE FROM aktif_rezervasyon WHERE rezervasyon_id = ?', [reservationId]);
    return true;
  }
  return false;
}

/**
 * Rezervasyonu iptal eder
 */
function cancelReservation(reservationId) {
  const reservations = query('SELECT * FROM aktif_rezervasyon WHERE rezervasyon_id = ?', [reservationId]);
  
  if (reservations.length > 0) {
    const r = reservations[0];
    run(
      `INSERT INTO iptal_edilen_rezervasyon (giris_tarihi, cikis_tarihi, isim, soyisim, not_alani, oda_id, telefon)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.giris_tarihi, r.cikis_tarihi, r.isim, r.soyisim, r.not_alani, r.oda_id, r.telefon]
    );
    run('DELETE FROM aktif_rezervasyon WHERE rezervasyon_id = ?', [reservationId]);
    return true;
  }
  return false;
}

// ============================================
// MİSAFİR İŞLEMLERİ
// ============================================

/**
 * Aktif (otelde kalan) misafirleri getirir
 */
function getActiveGuests() {
  return query(`
    SELECT ak.*, o.oda_numarasi 
    FROM aktif_kalanlar ak
    LEFT JOIN oda o ON ak.oda_id = o.id
    ORDER BY ak.id ASC
  `);
}

/**
 * Belirli bir odadaki misafirleri getirir
 */
function getGuestsInRoom(roomId) {
  return query(`
    SELECT * FROM aktif_kalanlar 
    WHERE oda_id = ?
    ORDER BY id ASC
  `, [parseInt(roomId)]);
}

/**
 * Tüm misafirleri getirir
 */
function getAllGuests() {
  return query('SELECT * FROM tum_misafirler ORDER BY id DESC');
}

/**
 * Yeni misafir ekler (otele giriş)
 */
function addGuest(data) {
  // Giriş tarihi yoksa Türkiye saatine göre şimdiki zamanı kullan
  const girisTarihi = data.otele_giris_tarihi || getTurkeyDateTime();
  
  // Sadece aktif kalanlara ekle (tum_misafirler checkout yapıldığında doldurulacak)
  run(
    `INSERT INTO aktif_kalanlar (isim, soyisim, tc_no, pasaport_no, telefon, eposta, cinsiyet, uyruk, dogum_tarihi, otele_giris_tarihi, cikis_tarihi, egm_kaydi, not_alani, oda_id, ucret)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.isim, data.soyisim, data.tc_no || null, data.pasaport_no || null,
     data.telefon || null, data.eposta || null, data.cinsiyet || null, data.uyruk || null,
     data.dogum_tarihi || null, girisTarihi, data.cikis_tarihi || null, data.egm_kaydi || 0, data.not_alani || null, data.oda_id || null, data.ucret || null]
  );
  
  // Oda durumunu güncelle
  if (data.oda_id) {
    run('UPDATE oda SET doluluk_durumu = ? WHERE id = ?', ['dolu', data.oda_id]);
  }
  
  return true;
}

/**
 * Misafir çıkışı yapar
 */
function checkOutGuest(guestId) {
  // Önce misafirin tüm bilgilerini al
  const guests = query('SELECT * FROM aktif_kalanlar WHERE id = ?', [guestId]);
  
  if (guests.length === 0) {
    return { success: false, error: 'Misafir bulunamadı' };
  }
  
  const guest = guests[0];
  
  // Misafiri tum_misafirler tablosuna taşı (EGM çıkış kaydı için)
  run(
    `INSERT INTO tum_misafirler (isim, soyisim, tc_no, pasaport_no, telefon, eposta, cinsiyet, uyruk, dogum_tarihi, otele_giris_tarihi, cikis_tarihi, egm_kaydi, not_alani, ucret, egm_cikis_yapildi, oda_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [guest.isim, guest.soyisim, guest.tc_no, guest.pasaport_no, guest.telefon, guest.eposta, guest.cinsiyet, guest.uyruk, guest.dogum_tarihi, guest.otele_giris_tarihi, guest.cikis_tarihi, guest.egm_kaydi, guest.not_alani, guest.ucret, guest.oda_id]
  );
  
  // Aktif kalanlardan sil
  const deleteResult = run('DELETE FROM aktif_kalanlar WHERE id = ?', [guestId]);
  
  // Odada başka misafir kaldı mı kontrol et ve durumu güncelle
  if (guest.oda_id) {
    const remainingGuests = query('SELECT COUNT(*) as count FROM aktif_kalanlar WHERE oda_id = ?', [guest.oda_id]);
    const hasRemainingGuests = remainingGuests[0] && remainingGuests[0].count > 0;
    
    if (!hasRemainingGuests) {
      // Odada başka misafir kalmadı, odayı boş ve kirli yap, oda notunu temizle
      run('UPDATE oda SET doluluk_durumu = ?, temizlik_durumu = ?, oda_notu = NULL WHERE id = ?', ['bos', 'kirli', guest.oda_id]);
    }
    // Eğer hala misafir varsa oda "dolu" kalır
  }
  
  return deleteResult;
}

/**
 * EGM kaydını günceller
 */
function updateEgmStatus(guestId, status) {
  return run('UPDATE aktif_kalanlar SET egm_kaydi = ? WHERE id = ?', [status, guestId]);
}

// ============================================
// İSTATİSTİKLER
// ============================================

/**
 * Dashboard istatistiklerini getirir
 */
function getDashboardStats() {
  const totalRooms = query('SELECT COUNT(*) as count FROM oda')[0]?.count || 0;
  const occupiedRooms = query("SELECT COUNT(*) as count FROM oda WHERE doluluk_durumu = 'dolu'")[0]?.count || 0;
  const emptyRooms = query("SELECT COUNT(*) as count FROM oda WHERE doluluk_durumu = 'bos'")[0]?.count || 0;
  const dirtyRooms = query("SELECT COUNT(*) as count FROM oda WHERE temizlik_durumu = 'kirli'")[0]?.count || 0;
  const activeGuests = query('SELECT COUNT(*) as count FROM aktif_kalanlar')[0]?.count || 0;
  const pendingReservations = query('SELECT COUNT(*) as count FROM aktif_rezervasyon')[0]?.count || 0;
  const pendingEgm = query('SELECT COUNT(*) as count FROM aktif_kalanlar WHERE egm_kaydi = 0')[0]?.count || 0;
  
  return {
    totalRooms,
    occupiedRooms,
    emptyRooms,
    dirtyRooms,
    activeGuests,
    pendingReservations,
    pendingEgm,
    occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
  };
}

// ============================================
// VERİTABANI SORGULAMA (Manuel SQL)
// ============================================

/**
 * Manuel SQL sorgusu çalıştırır
 */
function executeQuery(sql) {
  try {
    const trimmedSql = sql.trim().toUpperCase();
    
    if (trimmedSql.startsWith('SELECT')) {
      return { success: true, data: query(sql) };
    } else {
      const result = run(sql);
      return result;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Belirtilen oda ve tarih aralığında çakışan rezervasyon var mı kontrol eder
 * Misafir girişi: seçilen tarih + şimdiki saat
 * Misafir çıkışı: seçilen tarih + 14:00 (standart çıkış saati)
 * Rezervasyon girişi: 12:00, Rezervasyon çıkışı: 14:00
 */
function checkReservationConflict(odaId, girisTarihi, cikisTarihi) {
  // Saatli karşılaştırma
  // Misafir giriş: seçilen tarih + 14:00 (standart giriş saati)
  // Misafir çıkış: seçilen tarih + 12:00 (standart çıkış saati)
  // Rezervasyon giriş: 14:00, Rezervasyon çıkış: 12:00
  
  // Tüm rezervasyonları al bu oda için (foreign key ile bağlı)
  const rezervasyonlar = query(`SELECT * FROM aktif_rezervasyon WHERE oda_id = ?`, [odaId]);
  
  if (!rezervasyonlar || rezervasyonlar.length === 0) {
    return [];
  }
  
  // Misafir giriş: tarih + 14:00
  const misafirGiris = new Date(girisTarihi + 'T14:00:00');
  // Misafir çıkış: tarih + 12:00
  const misafirCikis = new Date(cikisTarihi + 'T12:00:00');
  
  // Kesişen rezervasyonları bul
  const kesisen = rezervasyonlar.filter(rez => {
    // Rezervasyon tarihlerini parse et
    let rezGirisStr = rez.giris_tarihi;
    let rezCikisStr = rez.cikis_tarihi;
    
    // Eğer saat yoksa varsayılan ekle
    if (!rezGirisStr.includes(' ') && !rezGirisStr.includes('T')) {
      rezGirisStr = rezGirisStr + 'T14:00:00';
    } else {
      rezGirisStr = rezGirisStr.replace(' ', 'T');
    }
    
    if (!rezCikisStr.includes(' ') && !rezCikisStr.includes('T')) {
      rezCikisStr = rezCikisStr + 'T12:00:00';
    } else {
      rezCikisStr = rezCikisStr.replace(' ', 'T');
    }
    
    const rezGiris = new Date(rezGirisStr);
    const rezCikis = new Date(rezCikisStr);
    
    // Kesişme: misafir_cikis > rez_giris VE misafir_giris < rez_cikis
    return misafirCikis > rezGiris && misafirGiris < rezCikis;
  });
  
  return kesisen;
}

// Modül exports
module.exports = {
  connect,
  close,
  query,
  run,
  // Oda
  getAllRooms,
  updateRoomStatus,
  updateRoomNote,
  getRoomTypes,
  syncRoomStatus,
  // Rezervasyon
  getActiveReservations,
  getExpiredReservations,
  getCheckedInReservations,
  getCancelledReservations,
  addReservation,
  checkInReservation,
  cancelReservation,
  // Misafir
  getActiveGuests,
  getGuestsInRoom,
  getAllGuests,
  addGuest,
  checkOutGuest,
  updateEgmStatus,
  getOverdueGuests,
  // İstatistik
  getDashboardStats,
  // Manuel sorgu
  executeQuery,
  // Tarih/Saat yardımcıları
  getTurkeyDateTime,
  getTurkeyDate,
  // Rezervasyon kontrol
  checkReservationConflict
};
