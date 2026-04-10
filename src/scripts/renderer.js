/**
 * Ege Palas OYS - Renderer İşlemleri
 * Ana pencere için JavaScript işlemleri
 */

// Electron modüllerini içe aktar
const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const path = require('path');

// Veritabanı modülünü içe aktar
const db = require(path.join(__dirname, 'database', 'db.js'));

// Flatpickr - Modern tarih seçici
const flatpickr = require('flatpickr');
const Turkish = require('flatpickr/dist/l10n/tr.js').default.tr;

// Veritabanı bağlantı durumu
let dbConnected = false;

// Oda paneli scroll pozisyonu
let roomsPanelScrollPosition = 0;

// Oda paneli mevcut filtre durumu
let currentRoomStatusFilter = 'all';
let selectedRoomTypes = new Set();

// Platform tespiti ve body sınıfı ekleme
document.addEventListener('DOMContentLoaded', () => {
  // Platform sınıfını ekle
  const platform = process.platform;
  document.body.classList.add(`platform-${platform}`);
  
  // Navigasyon bağlantılarını başlat (her zaman)
  initNavigation();
  
  // Context menu'yü başlat
  initContextMenu();
  
  // Windows pencere kontrollerini başlat
  if (platform === 'win32') {
    initWindowControls();
  }
  
  // Veritabanı bağlantısını başlat
  let dbError = null;
  try {
    dbConnected = db.connect();
    if (dbConnected) {
      console.log('Veritabanı bağlantısı başarılı');
    } else {
      console.error('Veritabanı bağlantısı başarısız');
      dbError = 'Veritabanı dosyası oluşturulamadı veya açılamadı.';
    }
  } catch (error) {
    console.error('Veritabanı hatası:', error);
    dbConnected = false;
    dbError = error.message || 'Bilinmeyen veritabanı hatası';
  }
  
  // Veritabanı bağlantısı başarısızsa kullanıcıya uyarı göster
  if (!dbConnected) {
    showDatabaseErrorModal(dbError);
    return; // Diğer işlemleri yapma
  }
  
  // Başlangıçta Oda Paneli sayfasını yükle
  updateContent('rooms');
  
  // EGM badge'ini güncelle
  updateEGMBadge();
  
  console.log('Ege Palas OYS başlatıldı');
});

// Sayfa kapatılırken veritabanı bağlantısını kapat
window.addEventListener('beforeunload', () => {
  db.close();
});

/**
 * Context menu'yü başlatır
 */
function initContextMenu() {
  // Context menu HTML'i oluştur
  const contextMenuHTML = `
    <div class="context-menu" id="context-menu">
      <div class="context-menu-item" data-action="detail">
        <span class="context-menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 12h6"/>
            <path d="M9 16h6"/>
            <path d="M9 8h6"/>
          </svg>
        </span>
        <span>Oda Detay</span>
      </div>
      <div class="context-menu-item" id="add-guest-btn" data-action="add-guest">
        <span class="context-menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M19 8v6"/>
            <path d="M22 11h-6"/>
          </svg>
        </span>
        <span>Misafir Ekle</span>
      </div>
      <div class="context-menu-item" id="clean-dirty-btn" data-action="set-dirty">
        <span class="context-menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 6h18"/>
            <path d="M8 6V4c0-.6.4-1 1-1h6c.6 0 1 .4 1 1v2"/>
            <path d="M19 6v14c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1V6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
          </svg>
        </span>
        <span>Odayı Kirliye Al</span>
      </div>
      <div class="context-menu-item" data-action="add-note">
        <span class="context-menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </span>
        <span>Not Ekle</span>
      </div>
    </div>
  `;
  
  // Context menu'yü body'e ekle
  document.body.insertAdjacentHTML('beforeend', contextMenuHTML);
  
  const contextMenu = document.getElementById('context-menu');
  let selectedRoomId = null;
  
  // Sağ tık event'i
  document.addEventListener('contextmenu', (e) => {
    const roomCard = e.target.closest('.room-card');
    
    if (roomCard) {
      e.preventDefault();
      selectedRoomId = roomCard.dataset.roomId;
      
      // Odanın kirli olup olmadığını kontrol et
      const isDirty = roomCard.classList.contains('room-dirty') || roomCard.classList.contains('room-occupied-dirty');
      const isOccupied = roomCard.classList.contains('room-occupied') || roomCard.classList.contains('room-occupied-dirty');
      const cleanButton = document.getElementById('clean-dirty-btn');
      const addGuestBtn = document.getElementById('add-guest-btn');
      
      // Sadece BOŞ ve kirli odada misafir ekleme butonunu pasif yap
      if (isDirty && !isOccupied) {
        addGuestBtn.classList.add('context-menu-item-disabled');
        addGuestBtn.dataset.disabled = 'true';
      } else {
        addGuestBtn.classList.remove('context-menu-item-disabled');
        addGuestBtn.dataset.disabled = 'false';
      }
      
      if (isDirty) {
        cleanButton.innerHTML = `
          <span class="context-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
          </span>
          <span>Odayı Temizle</span>
        `;
        cleanButton.dataset.action = 'set-clean';
      } else {
        cleanButton.innerHTML = `
          <span class="context-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 6h18"/>
              <path d="M8 6V4c0-.6.4-1 1-1h6c.6 0 1 .4 1 1v2"/>
              <path d="M19 6v14c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1V6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
            </svg>
          </span>
          <span>Odayı Kirliye Al</span>
        `;
        cleanButton.dataset.action = 'set-dirty';
      }
      
      // Menüyü göster
      contextMenu.style.display = 'block';
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      
      // Ekran dışına taşmasını önle
      const menuRect = contextMenu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        contextMenu.style.left = (e.pageX - menuRect.width) + 'px';
      }
      if (menuRect.bottom > window.innerHeight) {
        contextMenu.style.top = (e.pageY - menuRect.height) + 'px';
      }
    }
  });
  
  // Menü dışına tıklanınca kapat
  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });
  
  // Menü item'larına tıklama
  contextMenu.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.context-menu-item');
    if (menuItem && selectedRoomId) {
      const action = menuItem.dataset.action;
      handleContextMenuAction(action, selectedRoomId);
    }
    contextMenu.style.display = 'none';
  });
}

/**
 * Context menu aksiyonlarını işler
 */
function handleContextMenuAction(action, roomId) {
  console.log('Aksiyon:', action, 'Oda ID:', roomId);
  
  switch(action) {
    case 'detail':
      showRoomDetail(roomId);
      break;
    case 'add-guest':
      // Kirli oda kontrolü - sadece BOŞ ve kirli odaya eklenemez
      const roomForGuest = db.getAllRooms().find(r => r.id == roomId);
      const guestsInRoom = db.getGuestsInRoom(roomId) || [];
      const isRoomEmpty = guestsInRoom.length === 0;
      const isRoomDirty = roomForGuest && (roomForGuest.temizlik_durumu === 'kirli' || roomForGuest.durum === 'kirli');
      
      if (isRoomEmpty && isRoomDirty) {
        showToast('Boş kirli odaya misafir eklenemez! Önce odayı temizleyin.', 'error');
        return;
      }
      showAddGuestPage(roomId);
      break;
    case 'set-dirty':
      setRoomDirty(roomId);
      break;
    case 'set-clean':
      setRoomClean(roomId);
      break;
    case 'add-note':
      showAddNoteModal(roomId);
      break;
  }
}

/**
 * Tarihi Türkçe formatına çevirir
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Oda detay sayfasını gösterir
 */
function showRoomDetail(roomId) {
  // Scroll pozisyonunu kaydet
  const mainContent = document.getElementById('main-content');
  roomsPanelScrollPosition = mainContent.scrollTop;
  
  // Önce oda durumlarını senkronla
  db.syncRoomStatus();
  
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == parseInt(roomId));
  if (!room) return;
  
  // Misafirleri al (taze veri için parseInt kullan)
  const guests = db.getGuestsInRoom(parseInt(roomId));
  
  // Durum bilgileri
  const isOccupied = room.doluluk_durumu === 'dolu';
  const isDirty = room.temizlik_durumu === 'kirli';
  
  let statusBadges = '';
  if (isDirty) {
    statusBadges += '<span class="detail-badge badge-dirty">Kirli</span>';
  }
  
  // Kat bilgisi
  const floor = room.oda_numarasi.toString().charAt(0);
  
  // Misafir listesi HTML - Kapasite kadar kart göster
  const capacity = room.kapasite || 1;
  let cardsHTML = '';
  
  // Dolu kartları oluştur
  guests.forEach(g => {
    cardsHTML += `
      <div class="guest-card" data-guest-id="${g.id}">
        <div class="guest-card-header">
          <div class="guest-name">${g.isim} ${g.soyisim}</div>
        </div>
        <div class="guest-card-body">
          <div class="guest-info-row guest-info-row-tc">
            <span class="guest-info-label">TC / Pasaport</span>
            <span class="guest-info-value-tc">${g.tc_no || g.pasaport_no || '-'}</span>
          </div>
          <div class="guest-info-row">
            <span class="guest-info-label">Doğum Tarihi</span>
            <span class="guest-info-value">${g.dogum_tarihi || '-'}</span>
          </div>
          <div class="guest-info-row">
            <span class="guest-info-label">Telefon</span>
            <span class="guest-info-value">${g.telefon || '-'}</span>
          </div>
          <div class="guest-info-row">
            <span class="guest-info-label">Cinsiyet</span>
            <span class="guest-info-value">${g.cinsiyet === 'E' ? 'Erkek' : g.cinsiyet === 'K' ? 'Kadın' : '-'}</span>
          </div>
          <div class="guest-info-row">
            <span class="guest-info-label">Uyruk</span>
            <span class="guest-info-value">${g.uyruk || 'Türkiye'}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  // Boş kartları oluştur (kapasite - mevcut misafir sayısı kadar)
  const emptySlots = capacity - guests.length;
  for (let i = 0; i < emptySlots; i++) {
    cardsHTML += `
      <div class="guest-card guest-card-empty">
        <div class="guest-card-header">
          <div class="guest-name guest-name-empty">Boş Yatak</div>
        </div>
        <div class="guest-card-body guest-card-body-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Müsait</span>
        </div>
      </div>
    `;
  }
  
  // Konaklama bilgilerini al (ilk misafirden)
  const firstGuest = guests[0] || null;
  const girisTarihiRaw = firstGuest?.otele_giris_tarihi || null;
  const cikisTarihiRaw = firstGuest?.cikis_tarihi || null;
  // Ücret olan misafiri bul (ek misafirler ücret olmadan eklenebilir)
  const guestWithPrice = guests.find(g => g.ucret !== null && g.ucret !== undefined && g.ucret !== '');
  const ucret = guestWithPrice?.ucret || null;
  // Not olan misafiri bul
  const guestWithNote = guests.find(g => g.not_alani !== null && g.not_alani !== undefined && g.not_alani !== '');
  const notAlani = guestWithNote?.not_alani || null;
  
  // Tarih formatlama fonksiyonu (gün adı ile)
  function formatDateWithDay(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    // Tarihi parse et (YYYY-MM-DD HH:MM:SS formatı)
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    const [year, month, day] = datePart.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const gunAdi = gunler[date.getDay()];
    const ayAdi = aylar[month - 1];
    
    let result = `${day} ${ayAdi} ${year}, ${gunAdi}`;
    if (timePart) {
      result += ` - ${timePart.substring(0, 5)}`;
    }
    return result;
  }
  
  const girisTarihi = formatDateWithDay(girisTarihiRaw);
  const cikisTarihi = formatDateWithDay(cikisTarihiRaw);
  
  // Raw tarihleri YYYY-MM-DD formatına çevir (modal için)
  const girisTarihiISO = girisTarihiRaw ? girisTarihiRaw.split(' ')[0] : '';
  const cikisTarihiISO = cikisTarihiRaw ? cikisTarihiRaw.split(' ')[0] : '';
  
  // Konaklama bilgileri HTML
  const konaklamaBilgileriHTML = guests.length > 0 ? `
    <div class="detail-section konaklama-section">
      <h4 class="detail-section-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Konaklama Bilgileri
        <div class="konaklama-btn-group">
          <button class="konaklama-edit-btn" onclick="showDateEditModal('${roomId}', '${girisTarihiISO}', '${cikisTarihiISO}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            Tarihleri Düzenle
          </button>
          <button class="konaklama-move-btn" onclick="showGuestSelectModal(${roomId}, '${girisTarihiISO}', '${cikisTarihiISO}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"/>
              <path d="M12 5l7 7-7 7"/>
            </svg>
            Oda Taşı
          </button>
        </div>
      </h4>
      <div class="konaklama-card">
        <div class="konaklama-grid konaklama-grid-3">
          <div class="konaklama-item">
            <div class="konaklama-icon konaklama-icon-giris">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <div class="konaklama-info">
              <span class="konaklama-label">Giriş Tarihi</span>
              <span class="konaklama-value">${girisTarihi}</span>
            </div>
          </div>
          <div class="konaklama-item">
            <div class="konaklama-icon konaklama-icon-cikis">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div class="konaklama-info">
              <span class="konaklama-label">Çıkış Tarihi</span>
              <span class="konaklama-value">${cikisTarihi}</span>
            </div>
          </div>
          <div class="konaklama-item">
            <div class="konaklama-icon konaklama-icon-ucret">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div class="konaklama-info">
              <span class="konaklama-label">Toplam Ücret</span>
              <span class="konaklama-value konaklama-value-ucret">${ucret ? ucret.toLocaleString('tr-TR') + ' ₺' : '-'}</span>
            </div>
          </div>
        </div>
        <div class="konaklama-not konaklama-not-editable" id="edit-konaklama-not" data-room-id="${roomId}">
          <div class="konaklama-not-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </div>
          <span class="konaklama-not-label">Not:</span>
          <span class="konaklama-not-value">${notAlani || 'Not eklemek için tıklayın...'}</span>
        </div>
      </div>
    </div>
  ` : '';
  
  const guestsHTML = `
    ${konaklamaBilgileriHTML}
    <div class="detail-section">
      <h4 class="detail-section-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Misafirler (${guests.length}/${capacity})
      </h4>
      <div class="guest-cards-grid">
        ${cardsHTML}
      </div>
    </div>
  `;
  
  // Sayfa HTML
  mainContent.innerHTML = `
    <div class="page-container">
      <div class="detail-page-header">
        <button class="btn-back" id="back-to-rooms">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          Oda Paneline Dön
        </button>
      </div>
      
      <div class="detail-header">
        <div class="detail-header-left">
          <div class="detail-room-title-row">
            <h1 class="detail-room-number-large">Oda ${room.oda_numarasi}</h1>
            ${room.bakim_ariza_notu ? `<div class="maintenance-info-box-inline">
              <div class="maintenance-info-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                <span class="maintenance-label">Bakım/Arıza Notu</span>
                <span class="maintenance-date">${room.bakim_ariza_tarihi ? formatDate(room.bakim_ariza_tarihi) : ''}</span>
                <div class="maintenance-actions">
                  <button class="maintenance-action-btn" id="edit-maintenance-note" title="Düzenle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="maintenance-action-btn maintenance-action-btn-delete" id="delete-maintenance-note" title="Sil">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="maintenance-note-content">${room.bakim_ariza_notu}</div>
            </div>` : ''}
          </div>
          <div class="detail-badges">${statusBadges}</div>
          <div class="detail-room-info-text">
            <span class="detail-info-chip">${floor}. Kat</span>
            <span class="detail-info-chip">${room.oda_tipi || '-'}</span>
            <span class="detail-info-chip">${room.kapasite} Kişilik</span>
            ${room.balkon ? '<span class="detail-info-chip detail-info-chip-blue">Balkonlu</span>' : ''}
          </div>
        </div>
      </div>
      
      <div class="detail-content-grid">
        <div class="detail-main-content">
          ${guestsHTML}
        </div>
        
        <div class="detail-sidebar-actions">
          <div class="actions-card">
            <h4 class="actions-card-title">Oda ve Misafir İşlemleri</h4>
            <div class="actions-list">
              <button class="btn btn-action-full ${isDirty && guests.length === 0 ? 'btn-disabled' : ''}" id="action-add-guest" data-room-id="${roomId}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M19 8v6M22 11h-6"/>
                </svg>
                Misafir Ekle
              </button>
              ${guests.length > 0 ? `
              <button class="btn btn-action-full btn-action-full-orange" id="action-sign-document" data-room-id="${roomId}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <path d="M12 18v-6"/>
                  <path d="M9 15l3 3 3-3"/>
                </svg>
                İmzalat / Yazdır
              </button>
              <button class="btn btn-action-full btn-action-full-red" id="action-checkout" data-room-id="${roomId}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Check Out
              </button>
              ` : ''}
              <button class="btn btn-action-full ${isDirty ? 'btn-action-full-green' : 'btn-action-full-black'}" id="action-toggle-clean" data-room-id="${roomId}" data-dirty="${isDirty}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                </svg>
                ${isDirty ? 'Temiz İşaretle' : 'Kirliye Al'}
              </button>
              <button class="btn btn-action-full btn-action-full-secondary" id="action-add-maintenance" data-room-id="${roomId}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                Bakım/Arıza Notu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Event Listeners
  document.getElementById('back-to-rooms').addEventListener('click', () => {
    updateContent('rooms', true); // Scroll pozisyonunu geri yükle
  });
  
  document.getElementById('action-add-guest').addEventListener('click', () => {
    // Sadece BOŞ ve kirli odaya eklenemez
    if (isDirty && guests.length === 0) {
      showToast('Boş kirli odaya misafir eklenemez! Önce odayı temizleyin.', 'error');
      return;
    }
    
    // Bugün için bu odaya rezervasyon var mı kontrol et
    const today = db.getTurkeyDate();
    const todayReservations = db.query(
      `SELECT * FROM aktif_rezervasyon WHERE oda_id = ? AND DATE(giris_tarihi) = ?`,
      [roomId, today]
    );
    
    if (todayReservations && todayReservations.length > 0) {
      // Bugün için rezervasyon var, modal göster
      const rez = todayReservations[0];
      showReservationConflictModal(roomId, rez);
    } else {
      // Rezervasyon yok, normal devam et
      showAddGuestPage(roomId);
    }
  });
  
  document.getElementById('action-toggle-clean').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const isDirtyNow = btn.dataset.dirty === 'true';
    if (isDirtyNow) {
      setRoomClean(roomId);
    } else {
      setRoomDirty(roomId);
    }
    showRoomDetail(roomId); // Sayfayı yenile
  });
  
  document.getElementById('action-add-maintenance').addEventListener('click', () => {
    showMaintenanceNoteModal(roomId);
  });
  
  // Bakım notu düzenleme butonu (not kutusundaki)
  const editMaintenanceBtn = document.getElementById('edit-maintenance-note');
  if (editMaintenanceBtn) {
    editMaintenanceBtn.addEventListener('click', () => {
      showMaintenanceNoteModal(roomId);
    });
  }
  
  // Bakım notu silme butonu (not kutusundaki)
  const deleteMaintenanceBtn = document.getElementById('delete-maintenance-note');
  if (deleteMaintenanceBtn) {
    deleteMaintenanceBtn.addEventListener('click', () => {
      if (confirm('Bakım/arıza notunu silmek istediğinize emin misiniz?')) {
        db.run('UPDATE oda SET bakim_ariza_notu = NULL, bakim_ariza_tarihi = NULL WHERE id = ?', [parseInt(roomId)]);
        showRoomDetail(roomId);
      }
    });
  }
  
  // Konaklama notu düzenleme
  const editNotBtn = document.getElementById('edit-konaklama-not');
  if (editNotBtn) {
    editNotBtn.addEventListener('click', () => {
      showEditKonaklamaNotModal(roomId);
    });
  }
  
  // Checkout butonu - modal aç
  const checkoutBtn = document.getElementById('action-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      showCheckoutModal(roomId);
    });
  }
  
  // İmzalat butonu
  const signBtn = document.getElementById('action-sign-document');
  if (signBtn) {
    signBtn.addEventListener('click', () => {
      generateGuestDocument(roomId);
    });
  }
}

/**
 * Misafir ekleme sayfasını gösterir
 * @param {number} roomId - Oda ID'si
 * @param {object} reservationData - Rezervasyondan gelen bilgiler (opsiyonel)
 */
function showAddGuestPage(roomId, reservationData = null) {
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == roomId);
  if (!room) return;
  
  // Mevcut misafirleri al
  const existingGuests = db.getGuestsInRoom(roomId);
  const availableSlots = room.kapasite - existingGuests.length;
  
  // Bugünün tarihi
  const today = db.getTurkeyDate();
  
  // Eğer odada misafir varsa, onların tarihlerini al
  let defaultGirisTarihi = today;
  let defaultCikisTarihi = '';
  let defaultIsim = '';
  let defaultSoyisim = '';
  let defaultTelefon = '';
  
  // Eğer rezervasyondan geliyorsa, rezervasyon bilgilerini kullan
  if (reservationData) {
    if (reservationData.girisTarihi) {
      defaultGirisTarihi = reservationData.girisTarihi.split(' ')[0];
    }
    if (reservationData.cikisTarihi) {
      defaultCikisTarihi = reservationData.cikisTarihi.split(' ')[0];
    }
    defaultIsim = reservationData.isim || '';
    defaultSoyisim = reservationData.soyisim || '';
    defaultTelefon = reservationData.telefon || '';
  } else if (existingGuests.length > 0) {
    const firstGuest = existingGuests[0];
    // Giriş tarihini al (sadece tarih kısmı)
    if (firstGuest.otele_giris_tarihi) {
      defaultGirisTarihi = firstGuest.otele_giris_tarihi.split(' ')[0];
    }
    // Çıkış tarihini al (sadece tarih kısmı)
    if (firstGuest.cikis_tarihi) {
      defaultCikisTarihi = firstGuest.cikis_tarihi.split(' ')[0];
    }
  }
  
  // Sayfa HTML'i
  const pageHTML = `
    <div class="page-container add-guest-page">
      <div class="add-guest-header">
        <button class="btn-back" id="back-to-room">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          Geri Dön
        </button>
        <div class="add-guest-title-section">
          <h1>Oda ${room.oda_numarasi} için Misafir Kaydı</h1>
          <p class="add-guest-subtitle">${room.oda_tipi} • Kapasite: ${room.kapasite} kişi</p>
        </div>
      </div>
      
      <div class="add-guest-layout">
        <div class="add-guest-main">
          <form id="add-guest-form" class="add-guest-form" ${availableSlots === 0 ? 'style="display:none;"' : ''}>
            <div class="form-section">
              <h3 class="form-section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Konaklama Bilgileri
              </h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="giris-tarihi">Giriş Tarihi</label>
                  <input type="date" id="giris-tarihi" value="${defaultGirisTarihi}" required>
                </div>
                <div class="form-group">
                  <label for="cikis-tarihi">Çıkış Tarihi</label>
                  <input type="date" id="cikis-tarihi" value="${defaultCikisTarihi}" required>
                </div>
              </div>
              <div id="reservation-check-result" class="reservation-check-result"></div>
            </div>
            
            <div class="form-section">
              <div class="form-section-header">
                <h3 class="form-section-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Misafir Bilgileri
                </h3>
                <div class="guest-count-selector">
                  <span class="guest-count-label">Kişi Sayısı:</span>
                  <div class="guest-count-icons" id="guest-count-icons">
                    ${Array.from({length: availableSlots}, (_, i) => `
                      <button type="button" class="guest-icon-btn ${i === 0 ? 'active' : ''}" data-count="${i+1}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      </button>
                    `).join('')}
                  </div>
                  <input type="hidden" id="guest-count" value="1">
                </div>
              </div>
              
              <div id="guests-container">
                <!-- Misafir formları buraya eklenecek -->
              </div>
            </div>
          </form>
        </div>
        
        <div class="add-guest-sidebar">
          <div class="add-guest-info-card add-guest-info-card-compact">
            <div class="info-card-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>Oda ${room.oda_numarasi}</span>
            </div>
            <div class="info-card-body-compact">
              <span class="info-compact-item">${existingGuests.length}/${room.kapasite} Dolu</span>
              <span class="info-compact-divider">•</span>
              <span class="info-compact-item info-compact-highlight">${availableSlots} Boş</span>
              ${availableSlots === 0 ? '<span class="info-compact-warning">Oda Dolu</span>' : ''}
            </div>
          </div>
          
          <div class="sidebar-note-card" ${availableSlots === 0 ? 'style="display:none;"' : ''}>
            <label class="sidebar-note-label">Not (Opsiyonel)</label>
            <textarea id="misafir-notu" class="sidebar-note-textarea" placeholder="Misafirlerle ilgili not..." rows="4"></textarea>
          </div>
          
          <div class="sidebar-price-card" ${availableSlots === 0 || existingGuests.length > 0 ? 'style="display:none;"' : ''}>
            <div class="price-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span>Ücret Bilgisi</span>
            </div>
            <div class="price-card-body">
              <div class="price-input-group">
                <input type="number" id="konaklama-ucreti" class="price-input" placeholder="0" min="0" step="0.01">
                <span class="price-currency">₺</span>
              </div>
              <p class="price-note">Toplam konaklama ücreti</p>
            </div>
          </div>
          
          <div class="sidebar-actions" ${availableSlots === 0 ? 'style="display:none;"' : ''}>
            <button type="button" class="btn-sidebar btn-sidebar-secondary" id="cancel-add-guest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              İptal
            </button>
            <button type="submit" form="add-guest-form" class="btn-sidebar btn-sidebar-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = pageHTML;
  
  // Sayfa yönetimi
  const backBtn = document.getElementById('back-to-room');
  const cancelBtn = document.getElementById('cancel-add-guest');
  const form = document.getElementById('add-guest-form');
  const guestCountSelect = document.getElementById('guest-count');
  const guestsContainer = document.getElementById('guests-container');
  
  // Geri dön (rezervasyonu iptal etmeden)
  const goBack = () => {
    // Rezervasyondan gelindiyse, rezervasyon sayfasına dön
    if (pendingReservationCheckIn && pendingReservationCheckIn.odaId == roomId) {
      pendingReservationCheckIn = null;
      renderReservationsPage(document.getElementById('main-content'));
      return;
    }
    // Normal girişse oda detayına dön
    showRoomDetail(roomId);
  };
  
  backBtn.addEventListener('click', goBack);
  if (cancelBtn) cancelBtn.addEventListener('click', goBack); // İptal butonu da geri butonu gibi davransın
  
  // Misafir formu oluştur
  function createGuestForm(index) {
    const isFirstGuest = index === 0;
    return `
      <div class="guest-form-card" data-guest-index="${index}">
        <div class="guest-form-header">
          <span class="guest-number">${index + 1}. Misafir</span>
        </div>
        <div class="guest-form-body">
          <div class="form-row">
            <div class="form-group">
              <label>İsim *</label>
              <input type="text" name="isim_${index}" required placeholder="İsim">
            </div>
            <div class="form-group">
              <label>Soyisim *</label>
              <input type="text" name="soyisim_${index}" required placeholder="Soyisim">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group id-type-group">
              <label>Kimlik Türü *</label>
              <div class="id-type-toggle">
                <button type="button" class="id-type-btn active" data-type="tc" data-index="${index}">TC Kimlik</button>
                <button type="button" class="id-type-btn" data-type="pasaport" data-index="${index}">Pasaport</button>
              </div>
            </div>
            <div class="form-group id-input-group">
              <label class="id-input-label">TC Kimlik No *</label>
              <input type="text" name="tc_${index}" class="id-input tc-input" maxlength="11" placeholder="11 haneli TC" required>
              <input type="text" name="pasaport_${index}" class="id-input pasaport-input" placeholder="Pasaport numarası" style="display:none;">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Doğum Tarihi</label>
              <input type="date" name="dogum_${index}">
            </div>
            <div class="form-group">
              <label>Cinsiyet</label>
              <select name="cinsiyet_${index}">
                <option value="">Seçiniz</option>
                <option value="E">Erkek</option>
                <option value="K">Kadın</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Uyruk</label>
              <input type="text" name="uyruk_${index}" placeholder="Ülke" value="Türkiye">
            </div>
            <div class="form-group">
              <label>Telefon${isFirstGuest && existingGuests.length === 0 ? ' *' : ''}</label>
              <input type="tel" name="telefon_${index}" placeholder="05XX XXX XX XX" ${isFirstGuest && existingGuests.length === 0 ? 'required' : ''}>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Misafir formlarını güncelle (mevcut verileri koruyarak)
  function updateGuestForms() {
    const count = parseInt(guestCountSelect.value);
    
    // Mevcut form verilerini kaydet
    const savedData = [];
    const existingForms = guestsContainer.querySelectorAll('.guest-form-card');
    existingForms.forEach((form, i) => {
      savedData[i] = {
        isim: form.querySelector(`[name="isim_${i}"]`)?.value || '',
        soyisim: form.querySelector(`[name="soyisim_${i}"]`)?.value || '',
        tc: form.querySelector(`[name="tc_${i}"]`)?.value || '',
        pasaport: form.querySelector(`[name="pasaport_${i}"]`)?.value || '',
        dogum: form.querySelector(`[name="dogum_${i}"]`)?.value || '',
        cinsiyet: form.querySelector(`[name="cinsiyet_${i}"]`)?.value || '',
        uyruk: form.querySelector(`[name="uyruk_${i}"]`)?.value || '',
        telefon: form.querySelector(`[name="telefon_${i}"]`)?.value || ''
      };
    });
    
    // Yeni formları oluştur
    let html = '';
    for (let i = 0; i < count; i++) {
      html += createGuestForm(i);
    }
    guestsContainer.innerHTML = html;
    
    // Kaydedilen verileri geri yükle
    savedData.forEach((data, i) => {
      if (i < count) {
        const form = guestsContainer.querySelector(`.guest-form-card[data-guest-index="${i}"]`);
        if (form && data) {
          const isimInput = form.querySelector(`[name="isim_${i}"]`);
          const soyisimInput = form.querySelector(`[name="soyisim_${i}"]`);
          const tcInput = form.querySelector(`[name="tc_${i}"]`);
          const pasaportInput = form.querySelector(`[name="pasaport_${i}"]`);
          const dogumInput = form.querySelector(`[name="dogum_${i}"]`);
          const cinsiyetInput = form.querySelector(`[name="cinsiyet_${i}"]`);
          const uyrukInput = form.querySelector(`[name="uyruk_${i}"]`);
          const telefonInput = form.querySelector(`[name="telefon_${i}"]`);
          
          if (isimInput) isimInput.value = data.isim;
          if (soyisimInput) soyisimInput.value = data.soyisim;
          if (tcInput) tcInput.value = data.tc;
          if (pasaportInput) pasaportInput.value = data.pasaport;
          if (dogumInput) dogumInput.value = data.dogum;
          if (cinsiyetInput) cinsiyetInput.value = data.cinsiyet;
          if (uyrukInput) uyrukInput.value = data.uyruk;
          if (telefonInput) telefonInput.value = data.telefon;
          
          // Pasaport doluysa toggle'ı pasaport'a çevir
          if (data.pasaport && !data.tc) {
            const pasaportBtn = form.querySelector('.id-type-btn[data-type="pasaport"]');
            if (pasaportBtn) pasaportBtn.click();
          }
        }
      }
    });
    
    // Rezervasyondan geliyorsa ilk misafirin telefon'unu doldur ve yeşil işaretle
    if (reservationData && savedData.length === 0) {
      const firstForm = guestsContainer.querySelector('.guest-form-card[data-guest-index="0"]');
      if (firstForm) {
        const telefonInput = firstForm.querySelector('[name="telefon_0"]');
        if (telefonInput && reservationData.telefon) {
          telefonInput.value = reservationData.telefon;
          telefonInput.classList.add('auto-filled');
        }
      }
    }
    
    // TC/Pasaport toggle butonlarına event listener ekle
    setupIdTypeToggle();
  }
  
  // TC/Pasaport toggle fonksiyonu
  function setupIdTypeToggle() {
    document.querySelectorAll('.id-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        const index = e.currentTarget.dataset.index;
        const card = e.currentTarget.closest('.guest-form-card');
        
        // Toggle butonlarını güncelle
        card.querySelectorAll('.id-type-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Input'ları güncelle
        const tcInput = card.querySelector(`[name="tc_${index}"]`);
        const pasaportInput = card.querySelector(`[name="pasaport_${index}"]`);
        const label = card.querySelector('.id-input-label');
        
        if (type === 'tc') {
          tcInput.style.display = 'block';
          tcInput.required = true;
          tcInput.value = '';
          pasaportInput.style.display = 'none';
          pasaportInput.required = false;
          pasaportInput.value = '';
          label.textContent = 'TC Kimlik No *';
        } else {
          tcInput.style.display = 'none';
          tcInput.required = false;
          tcInput.value = '';
          pasaportInput.style.display = 'block';
          pasaportInput.required = true;
          pasaportInput.value = '';
          label.textContent = 'Pasaport No *';
        }
      });
    });
  }
  
  // Kişi simgesi seçimi
  const guestIconContainer = document.getElementById('guest-count-icons');
  if (guestIconContainer) {
    const iconButtons = guestIconContainer.querySelectorAll('.guest-icon-btn');
    
    iconButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        // Tüm butonları güncelle - seçilen ve önceki butonlar aktif
        iconButtons.forEach((b, i) => {
          if (i <= index) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
        
        // Hidden input değerini güncelle
        guestCountSelect.value = index + 1;
        
        // Formları güncelle
        updateGuestForms();
      });
    });
  }
  
  // İlk yükleme
  if (guestCountSelect) {
    updateGuestForms();
  }
  
  // Rezervasyondan gelindiyse tarih alanlarını yeşil işaretle (ilk yüklemede)
  if (reservationData) {
    const girisInput = document.getElementById('giris-tarihi');
    const cikisInput = document.getElementById('cikis-tarihi');
    if (girisInput && reservationData.girisTarihi) girisInput.classList.add('auto-filled');
    if (cikisInput && reservationData.cikisTarihi) cikisInput.classList.add('auto-filled');
  }
  
  // Flatpickr tarih seçicileri
  const girisTarihiInput = document.getElementById('giris-tarihi');
  const cikisTarihiInput = document.getElementById('cikis-tarihi');
  
  if (girisTarihiInput) {
    flatpickr(girisTarihiInput, {
      locale: Turkish,
      dateFormat: 'Y-m-d',
      defaultDate: today,
      disableMobile: true,
      animate: true
    });
  }
  
  // Rezervasyon kontrol fonksiyonu
  let hasReservationConflict = false;
  
  function checkReservationConflict() {
    const girisTarihi = document.getElementById('giris-tarihi').value;
    const cikisTarihi = document.getElementById('cikis-tarihi').value;
    const resultDiv = document.getElementById('reservation-check-result');
    
    if (!girisTarihi || !cikisTarihi) {
      resultDiv.innerHTML = '';
      hasReservationConflict = false;
      // Kaydet butonunu aktif yap (tarih seçilmediğinde)
      const saveBtn = document.getElementById('save-guests-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
      }
      return;
    }
    
    // Rezervasyon çakışması kontrolü (oda ID'si ile)
    const conflicts = db.checkReservationConflict(room.id, girisTarihi, cikisTarihi);
    
    if (conflicts && conflicts.length > 0) {
      hasReservationConflict = true;
      const conflict = conflicts[0];
      resultDiv.innerHTML = `
        <div class="reservation-conflict">
          <div class="conflict-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="conflict-content">
            <div class="conflict-title">Rezervasyon Çakışması!</div>
            <div class="conflict-message">
              <strong>${conflict.isim} ${conflict.soyisim}</strong> adlı rezervasyon bu oda için 
              <strong>${conflict.giris_tarihi}</strong> tarihinde giriş yapacaktır.
            </div>
            <div class="conflict-action">Misafir kaydına devam edebilmek için rezervasyonu veya oda bilgisini güncelleyin.</div>
          </div>
        </div>
      `;
      // Kaydet butonunu pasif yap
      const saveBtn = document.getElementById('save-guests-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.style.cursor = 'not-allowed';
      }
    } else {
      hasReservationConflict = false;
      resultDiv.innerHTML = `
        <div class="reservation-ok">
          <div class="ok-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div class="ok-message">
            Bu oda için seçili tarihler (<strong>${girisTarihi}</strong> - <strong>${cikisTarihi}</strong>) arasında aktif kesişen bir rezervasyon yoktur. Kayda devam edin.
          </div>
        </div>
      `;
      // Kaydet butonunu aktif yap
      const saveBtn = document.getElementById('save-guests-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
      }
    }
  }
  
  if (cikisTarihiInput) {
    flatpickr(cikisTarihiInput, {
      locale: Turkish,
      dateFormat: 'Y-m-d',
      minDate: today,
      disableMobile: true,
      animate: true,
      onChange: function() {
        checkReservationConflict();
      }
    });
  }
  
  if (girisTarihiInput) {
    // Giriş tarihi değiştiğinde de kontrol et
    girisTarihiInput.addEventListener('change', checkReservationConflict);
  }
  
  // Form gönderimi
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const girisTarihi = document.getElementById('giris-tarihi').value;
      const cikisTarihi = document.getElementById('cikis-tarihi').value;
      const misafirNotu = document.getElementById('misafir-notu').value.trim();
      const konaklamaUcreti = document.getElementById('konaklama-ucreti').value;
      
      // Giriş tarihi kontrolü - zorunlu
      if (!girisTarihi) {
        showToast('Giriş tarihi seçilmelidir!', 'error');
        return;
      }
      
      // Çıkış tarihi kontrolü - zorunlu
      if (!cikisTarihi) {
        showToast('Çıkış tarihi seçilmelidir!', 'error');
        return;
      }
      
      // Tarih kontrolü
      if (new Date(cikisTarihi) <= new Date(girisTarihi)) {
        showToast('Çıkış tarihi giriş tarihinden sonra olmalıdır!', 'error');
        return;
      }
      
      // Rezervasyon çakışması kontrolü
      if (hasReservationConflict) {
        showToast('Seçili tarihlerde rezervasyon çakışması var! Önce rezervasyonu güncelleyin.', 'error');
        return;
      }
      
      const guestCount = parseInt(guestCountSelect.value);
      const guests = [];
      
      // Misafir bilgilerini topla
      for (let i = 0; i < guestCount; i++) {
        const isim = form.querySelector(`[name="isim_${i}"]`).value.trim();
        const soyisim = form.querySelector(`[name="soyisim_${i}"]`).value.trim();
        const tc = form.querySelector(`[name="tc_${i}"]`).value.trim();
        const pasaport = form.querySelector(`[name="pasaport_${i}"]`).value.trim();
        const dogum = form.querySelector(`[name="dogum_${i}"]`).value;
        const cinsiyet = form.querySelector(`[name="cinsiyet_${i}"]`).value;
        const uyruk = form.querySelector(`[name="uyruk_${i}"]`).value.trim();
        const telefon = form.querySelector(`[name="telefon_${i}"]`).value.trim();
        
        // Hangi kimlik türü seçili?
        const guestCard = form.querySelector(`.guest-form-card[data-guest-index="${i}"]`);
        const activeIdType = guestCard.querySelector('.id-type-btn.active').dataset.type;

        if (activeIdType === 'tc') {
          // TC Kimlik kontrolü
          if (!tc) {
            showToast(`${i + 1}. misafir için TC kimlik numarası girilmelidir!`, 'error');
            return;
          }
          if (!/^\d{11}$/.test(tc)) {
            showToast(`${i + 1}. misafir için TC kimlik numarası 11 haneli rakam olmalıdır!`, 'error');
            return;
          }
          if (tc[0] === '0') {
            showToast(`${i + 1}. misafir TC kimlik numarası 0 ile başlayamaz!`, 'error');
            return;
          }
        } else {
          // Pasaport kontrolü
          if (!pasaport) {
            showToast(`${i + 1}. misafir için pasaport numarası girilmelidir!`, 'error');
            return;
          }
          if (pasaport.length < 5) {
            showToast(`${i + 1}. misafir için geçerli bir pasaport numarası giriniz! (en az 5 karakter)`, 'error');
            return;
          }
        }
        
        // Telefon kontrolü - sadece odada hiç misafir yoksa ve 1. misafir için zorunlu
        if (existingGuests.length === 0 && i === 0 && !telefon) {
          showToast('1. misafir için telefon numarası girilmelidir!', 'error');
          return;
        }
        
        guests.push({
          isim,
          soyisim,
          tc_no: tc || null,
          pasaport_no: pasaport || null,
          dogum_tarihi: dogum || null,
          cinsiyet: cinsiyet || null,
          uyruk: uyruk || null,
          telefon: telefon || null,
          eposta: null,
          otele_giris_tarihi: girisTarihi + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }),
          cikis_tarihi: cikisTarihi + ' 12:00:00',
          egm_kaydi: 0,
          not_alani: misafirNotu || (existingGuests.find(g => g.not_alani)?.not_alani || null),
          oda_id: parseInt(roomId),
          ucret: konaklamaUcreti ? parseFloat(konaklamaUcreti) : (existingGuests.find(g => g.ucret)?.ucret || null)
        });
      }
      
      // Kapasite kontrolü
      const totalGuests = existingGuests.length + guests.length;
      if (totalGuests > room.kapasite) {
        showToast(`Oda kapasitesi (${room.kapasite}) aşılamaz! Şu anda ${existingGuests.length} misafir var.`, 'error');
        return;
      }
      
      // Form içi duplikasyon kontrolü (aynı formda aynı TC/Pasaport)
      const tcNumbers = guests.map(g => g.tc_no).filter(Boolean);
      const passportNumbers = guests.map(g => g.pasaport_no).filter(Boolean);

      if (new Set(tcNumbers).size !== tcNumbers.length) {
        showToast('Aynı TC kimlik numarası birden fazla misafir için kullanılamaz!', 'error');
        return;
      }
      if (new Set(passportNumbers).size !== passportNumbers.length) {
        showToast('Aynı pasaport numarası birden fazla misafir için kullanılamaz!', 'error');
        return;
      }

      // TC ve Pasaport numarası kontrolü - aktif misafirlerde aynısı var mı?
      for (const guest of guests) {
        // TC kontrolü
        if (guest.tc_no) {
          const existingTC = db.query('SELECT * FROM aktif_kalanlar WHERE tc_no = ?', [guest.tc_no]);
          if (existingTC && existingTC.length > 0) {
            showToast(`${guest.tc_no} TC numaralı misafir zaten aktif olarak kayıtlı!`, 'error');
            return;
          }
        }
        // Pasaport kontrolü
        if (guest.pasaport_no) {
          const existingPassport = db.query('SELECT * FROM aktif_kalanlar WHERE pasaport_no = ?', [guest.pasaport_no]);
          if (existingPassport && existingPassport.length > 0) {
            showToast(`${guest.pasaport_no} pasaport numaralı misafir zaten aktif olarak kayıtlı!`, 'error');
            return;
          }
        }
      }
      
      // Misafirleri kaydet
      let successCount = 0;
      guests.forEach(guest => {
        try {
          db.addGuest(guest);
          successCount++;
        } catch (error) {
          console.error('Misafir eklenirken hata:', error);
        }
      });
      
      if (successCount === guests.length) {
        showToast(`${successCount} misafir başarıyla kaydedildi!`, 'success');
        // Oda durumunu güncelle
        db.syncRoomStatus();
        // EGM badge'ini güncelle
        updateEGMBadge();
        
        // Eğer rezervasyondan gelindiyse, rezervasyonu tamamla
        if (pendingReservationCheckIn && pendingReservationCheckIn.odaId == roomId) {
          db.checkInReservation(pendingReservationCheckIn.rezId);
          pendingReservationCheckIn = null;
        }
        
        // Oda detayına dön
        setTimeout(() => showRoomDetail(roomId), 500);
      } else {
        showToast('Bazı misafirler kaydedilemedi!', 'error');
      }
    });
  }
}

/**
 * EGM badge'ini günceller
 */
function updateEGMBadge() {
  const badge = document.getElementById('egm-badge');
  if (!badge) return;
  
  // Bekleyen kayıtlar (aktif misafirlerden egm_kaydi = 0 olanlar)
  const pendingRegistrations = db.query(`SELECT COUNT(*) as count FROM aktif_kalanlar WHERE egm_kaydi = 0`)[0]?.count || 0;
  
  // Çıkış bekleyenler (tum_misafirler'den egm_kaydi = 1 ve egm_cikis_yapildi = 0 olanlar)
  const pendingCheckouts = db.query(`SELECT COUNT(*) as count FROM tum_misafirler WHERE egm_kaydi = 1 AND (egm_cikis_yapildi = 0 OR egm_cikis_yapildi IS NULL)`)[0]?.count || 0;
  
  const total = pendingRegistrations + pendingCheckouts;
  
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Toast mesajı gösterir
 */
function showToast(message, type = 'info') {
  // Mevcut toast'ı kaldır
  const existingToast = document.querySelector('.toast-message');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">
      ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
    </span>
    <span class="toast-text">${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Animasyon için
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 3 saniye sonra kaldır
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Veritabanı hata modalını gösterir
 */
function showDatabaseErrorModal(errorMessage) {
  const mainContent = document.getElementById('main-content');
  
  mainContent.innerHTML = `
    <div class="db-error-container">
      <div class="db-error-card">
        <div class="db-error-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 class="db-error-title">Veritabanı Bağlantı Hatası</h1>
        <p class="db-error-message">Program veritabanına bağlanamadı. Bu durum genellikle aşağıdaki nedenlerden kaynaklanır:</p>
        <ul class="db-error-reasons">
          <li>💾 Disk alanı yetersiz</li>
          <li>🔒 Dosya/klasör izin sorunu</li>
          <li>📁 Veritabanı dosyası bozulmuş</li>
          <li>⚙️ Uygulama dosyaları eksik</li>
        </ul>
        <div class="db-error-detail">
          <span class="db-error-detail-label">Hata Detayı:</span>
          <code class="db-error-code">${errorMessage || 'Bilinmeyen hata'}</code>
        </div>
        <div class="db-error-actions">
          <button class="db-error-btn db-error-btn-primary" onclick="retryDatabaseConnection()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Tekrar Dene
          </button>
          <button class="db-error-btn db-error-btn-secondary" onclick="closeDatabaseApp()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Uygulamayı Kapat
          </button>
        </div>
        <p class="db-error-footer">
          Sorun devam ederse, uygulamayı yeniden yükleyin veya sistem yöneticinize başvurun.
        </p>
      </div>
    </div>
  `;
}

/**
 * Veritabanı bağlantısını tekrar dener
 */
function retryDatabaseConnection() {
  let dbError = null;
  try {
    dbConnected = db.connect();
    if (dbConnected) {
      console.log('Veritabanı bağlantısı başarılı');
      // Başarılı - sayfayı yükle
      updateContent('rooms');
      updateEGMBadge();
      showToast('Veritabanı bağlantısı başarılı!', 'success');
    } else {
      dbError = 'Veritabanı dosyası oluşturulamadı veya açılamadı.';
      showDatabaseErrorModal(dbError);
    }
  } catch (error) {
    console.error('Veritabanı hatası:', error);
    dbConnected = false;
    dbError = error.message || 'Bilinmeyen veritabanı hatası';
    showDatabaseErrorModal(dbError);
  }
}

/**
 * Uygulamayı kapatır
 */
function closeDatabaseApp() {
  const { app } = require('@electron/remote');
  app.quit();
}

/**
 * Odayı kirli olarak işaretler
 */
function setRoomDirty(roomId) {
  const id = parseInt(roomId);
  const result = db.run('UPDATE oda SET temizlik_durumu = ?, cleaning_status = NULL WHERE id = ?', ['kirli', id]);
  if (result.success) {
    console.log('Oda kirli olarak işaretlendi. Oda ID:', id);
    updateContent('rooms'); // Sayfayı yenile
  } else {
    console.error('Oda kirli yapılamadı:', result.error);
  }
}

/**
 * Odayı temiz olarak işaretler
 */
function setRoomClean(roomId) {
  const id = parseInt(roomId);
  // Temizlendi olarak işaretle - kat hizmetlerinde "Temizlendi" sütununda görünsün
  const result = db.run('UPDATE oda SET temizlik_durumu = ?, cleaning_status = ? WHERE id = ?', ['temiz', 'completed', id]);
  if (result.success) {
    console.log('Oda temiz olarak işaretlendi. Oda ID:', id);
    updateContent('rooms'); // Sayfayı yenile
  } else {
    console.error('Oda temiz yapılamadı:', result.error);
  }
}

/**
 * Not ekleme modalını gösterir
 */
function showAddNoteModal(roomId) {
  // Mevcut notu al
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == roomId);
  const currentNote = room ? (room.oda_notu || '') : '';
  
  // Modal HTML
  const modalHTML = `
    <div class="modal-overlay" id="note-modal">
      <div class="modal-content modal-modern">
        <div class="modal-header-modern modal-header-simple">
          <h3>Oda ${room ? room.oda_numarasi : ''} - Not</h3>
        </div>
        <div class="modal-body-modern">
          <div class="input-group-modern">
            <input type="text" id="room-note-input" class="input-modern" placeholder="Not yazın..." maxlength="40" value="${currentNote}">
            <div class="char-counter-modern"><span id="char-count">${currentNote.length}</span>/40</div>
          </div>
        </div>
        <div class="modal-footer-modern">
          <button class="btn-modern btn-modern-secondary" id="cancel-note">İptal</button>
          <button class="btn-modern btn-modern-primary" id="save-note">Kaydet</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('note-modal');
  const cancelBtn = document.getElementById('cancel-note');
  const saveBtn = document.getElementById('save-note');
  const noteInput = document.getElementById('room-note-input');
  
  // Focus
  noteInput.focus();
  
  // Karakter sayacı
  const charCount = document.getElementById('char-count');
  noteInput.addEventListener('input', () => {
    charCount.textContent = noteInput.value.length;
  });
  
  // Kapat
  const closeModal = () => modal.remove();
  
  // Kaydet fonksiyonu
  const saveNote = () => {
    const note = noteInput.value.trim();
    const result = db.run('UPDATE oda SET oda_notu = ? WHERE id = ?', [note, parseInt(roomId)]);
    if (result.success) {
      console.log('Not kaydedildi');
      closeModal();
      updateContent('rooms');
    } else {
      console.error('Not kaydedilemedi:', result.error);
    }
  };
  
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Enter tuşuna basınca kaydet
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNote();
    }
  });
  
  // Kaydet butonu
  saveBtn.addEventListener('click', saveNote);
}

/**
 * Checkout modalını gösterir
 */
function showCheckoutModal(roomId) {
  // Modal zaten açıksa tekrar açma
  if (document.getElementById('checkout-modal')) {
    return;
  }
  
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == roomId);
  const guests = db.getGuestsInRoom(roomId);
  
  if (guests.length === 0) {
    alert('Bu odada misafir bulunmuyor.');
    return;
  }
  
  // Modal HTML
  let guestListHTML = '';
  guests.forEach(g => {
    const initials = `${g.isim.charAt(0)}${g.soyisim.charAt(0)}`.toUpperCase();
    guestListHTML += `
      <div class="checkout-guest-item" data-guest-id="${g.id}">
        <div class="checkout-guest-left">
          <div class="checkout-guest-avatar">${initials}</div>
          <div class="checkout-guest-info">
            <div class="checkout-guest-name">${g.isim} ${g.soyisim}</div>
            <div class="checkout-guest-tc">${g.tc_no || '-'}</div>
          </div>
        </div>
        <div class="checkout-checkbox-wrapper">
          <input type="checkbox" class="checkout-guest-checkbox" data-guest-id="${g.id}" checked>
          <div class="checkout-checkmark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
      </div>
    `;
  });
  
  const modalHTML = `
    <div class="modal-overlay" id="checkout-modal">
      <div class="modal-content modal-checkout-apple">
        <div class="modal-header-apple">
          <h3>Check Out</h3>
          <p class="modal-subtitle">Oda ${room.oda_numarasi}</p>
        </div>
        <div class="modal-body-apple">
          <div class="checkout-guest-list">
            ${guestListHTML}
          </div>
        </div>
        <div class="modal-footer-apple">
          <button class="btn-apple btn-apple-secondary" id="cancel-checkout">İptal</button>
          <button class="btn-apple btn-apple-danger" id="confirm-checkout">
            <span id="checkout-confirm-text">Checkout'u Tamamla ve Odayı Kirliye Al</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('checkout-modal');
  const cancelBtn = document.getElementById('cancel-checkout');
  const confirmBtn = document.getElementById('confirm-checkout');
  const confirmText = document.getElementById('checkout-confirm-text');
  const guestCheckboxes = document.querySelectorAll('.checkout-guest-checkbox');
  const totalGuests = guests.length;
  
  // Kapat
  const closeModal = () => {
    if (modal) modal.remove();
  };
  
  // Buton metnini güncelle
  const updateButtonText = () => {
    const checkedCount = document.querySelectorAll('.checkout-guest-checkbox:checked').length;
    
    if (checkedCount === 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmText.textContent = 'Misafir Seçin';
    } else if (checkedCount === totalGuests) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmText.textContent = "Checkout'u Tamamla ve Odayı Kirliye Al";
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmText.textContent = `Checkout'u Tamamla (${checkedCount} Misafir)`;
    }
    
    // Seçili kartları vurgula
    document.querySelectorAll('.checkout-guest-item').forEach(item => {
      const cb = item.querySelector('.checkout-guest-checkbox');
      if (cb.checked) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  };
  
  // Checkbox dinleyicileri
  guestCheckboxes.forEach(cb => {
    cb.addEventListener('change', updateButtonText);
  });
  
  // Kart tıklaması
  document.querySelectorAll('.checkout-guest-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const cb = item.querySelector('.checkout-guest-checkbox');
        cb.checked = !cb.checked;
        updateButtonText();
      }
    });
  });
  
  // Checkout işlemi
  confirmBtn.addEventListener('click', () => {
    const checkedBoxes = document.querySelectorAll('.checkout-guest-checkbox:checked');
    const selectedCount = checkedBoxes.length;

    if (selectedCount === 0) return;

    const isFullCheckout = selectedCount === totalGuests;

    // Her seçili misafir için db.checkOutGuest() kullan (tek kaynak)
    checkedBoxes.forEach(cb => {
      const guestId = parseInt(cb.dataset.guestId);
      db.checkOutGuest(guestId);
    });

    // Oda durumunu senkronla
    db.syncRoomStatus();

    // EGM badge'ini güncelle
    updateEGMBadge();

    // Modalı kapat
    closeModal();

    // Eğer tüm misafirler çıktıysa oda paneline dön, değilse detay sayfasını yenile
    if (isFullCheckout) {
      updateContent('rooms');
    } else {
      showRoomDetail(roomId);
    }
  });
  
  // Enter tuşu ile onaylama, Escape ile iptal
  const handleKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!confirmBtn.disabled) {
        confirmBtn.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  
  document.addEventListener('keydown', handleKeydown);
  
  // Modal kapanınca event listener'ı temizle
  const cleanupAndClose = () => {
    document.removeEventListener('keydown', handleKeydown);
    closeModal();
  };
  
  cancelBtn.addEventListener('click', cleanupAndClose);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanupAndClose();
  });
  
  // Confirm butonunda da temizlik yap
  const originalConfirmClick = confirmBtn.onclick;
  confirmBtn.addEventListener('click', () => {
    document.removeEventListener('keydown', handleKeydown);
  });
  
  // İlk yüklemede kartları seçili göster ve buton durumunu ayarla
  document.querySelectorAll('.checkout-guest-item').forEach(item => {
    item.classList.add('selected');
  });
  updateButtonText();
}

/**
 * Konaklama notu düzenleme modalını gösterir
 */
function showEditKonaklamaNotModal(roomId) {
  // Mevcut notu al (odadaki ilk misafirden)
  const guests = db.getGuestsInRoom(roomId);
  const currentNote = guests.length > 0 ? (guests[0].not_alani || '') : '';
  
  // Modal HTML
  const modalHTML = `
    <div class="modal-overlay" id="konaklama-not-modal">
      <div class="modal-content modal-modern">
        <div class="modal-header-modern modal-header-simple">
          <h3>Konaklama Notu Düzenle</h3>
        </div>
        <div class="modal-body-modern">
          <textarea id="konaklama-not-input" class="textarea-modern" placeholder="Misafirlerle ilgili not yazın..." rows="3">${currentNote}</textarea>
        </div>
        <div class="modal-footer-modern">
          <button class="btn-modern btn-modern-secondary" id="cancel-konaklama-not">İptal</button>
          <button class="btn-modern btn-modern-primary" id="save-konaklama-not">Kaydet</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('konaklama-not-modal');
  const cancelBtn = document.getElementById('cancel-konaklama-not');
  const saveBtn = document.getElementById('save-konaklama-not');
  const noteInput = document.getElementById('konaklama-not-input');
  
  // Focus
  noteInput.focus();
  
  // Kapat
  const closeModal = () => modal.remove();
  
  // Kaydet
  const saveNote = () => {
    const note = noteInput.value.trim();
    // Odadaki tüm misafirlerin notunu güncelle
    guests.forEach(g => {
      db.run('UPDATE aktif_kalanlar SET not_alani = ? WHERE id = ?', [note || null, g.id]);
    });
    closeModal();
    showRoomDetail(roomId); // Sayfayı yenile
  };
  
  cancelBtn.addEventListener('click', closeModal);
  saveBtn.addEventListener('click', saveNote);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Enter ile kaydet
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveNote();
    }
  });
}

/**
 * Rezervasyon çakışması modalını gösterir
 */
function showReservationConflictModal(roomId, reservation) {
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == roomId);
  const odaNo = room ? room.oda_numarasi : roomId;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-content-reservation-conflict">
      <div class="modal-header-modern modal-header-clickable" id="conflict-header" title="Rezervasyonu görüntüle">
        <div class="modal-icon-warning">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h3>Bugün İçin Rezervasyon Mevcut</h3>
        <span class="modal-header-hint">Rezervasyonu görmek için tıklayın →</span>
      </div>
      <div class="modal-body-modern">
        <div class="reservation-conflict-info">
          <p>Bu oda <strong>${reservation.isim} ${reservation.soyisim}</strong> adına bugün için rezerve edilmiştir.</p>
          <div class="reservation-conflict-details">
            <span class="conflict-detail-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              Oda ${odaNo}
            </span>
            <span class="conflict-detail-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${reservation.giris_tarihi} → ${reservation.cikis_tarihi}
            </span>
            ${reservation.telefon ? `
            <span class="conflict-detail-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              ${reservation.telefon}
            </span>
            ` : ''}
          </div>
        </div>
        <p class="conflict-question">Bu kişi adına mı misafir kaydı açmak istiyorsunuz?</p>
      </div>
      <div class="modal-footer-modern modal-footer-conflict">
        <button class="btn-modern btn-modern-secondary" id="conflict-no">Hayır</button>
        <button class="btn-modern btn-modern-primary btn-conflict-yes" id="conflict-yes">Evet, ${reservation.isim} ${reservation.soyisim} Adına Kayıt Aç</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Evet butonuna tıklanınca - rezervasyondan giriş yap gibi davran
  document.getElementById('conflict-yes').addEventListener('click', () => {
    const rez = reservation;
    
    // Odanın kirli olup olmadığını kontrol et
    if (rez.oda_id) {
      const room = db.query('SELECT * FROM oda WHERE id = ?', [rez.oda_id]);
      if (room.length > 0 && room[0].temizlik_durumu === 'kirli') {
        modal.remove();
        showToast('Bu oda kirli! Önce odayı temizleyin.', 'error');
        return;
      }
    }
    
    modal.remove();
    
    // Rezervasyon giriş işlemini başlat (handleReservationCheckIn gibi)
    // Bekleyen rezervasyon bilgisini ayarla
    pendingReservationCheckIn = {
      rezId: rez.rezervasyon_id,
      odaId: rez.oda_id,
      isim: rez.isim,
      soyisim: rez.soyisim,
      girisTarihi: rez.giris_tarihi,
      cikisTarihi: rez.cikis_tarihi,
      telefon: rez.telefon || ''
    };
    
    // Misafir ekleme sayfasına git (rezervasyon bilgileriyle)
    showAddGuestPage(rez.oda_id, pendingReservationCheckIn);
  });
  
  // Hayır butonuna tıklanınca
  document.getElementById('conflict-no').addEventListener('click', () => {
    modal.remove();
    showToast('Önce bu rezervasyonun odasını veya tarihini değiştirin.', 'warning');
  });
  
  // Header'a tıklanınca rezervasyon sayfasına git ve highlight et
  document.getElementById('conflict-header').addEventListener('click', () => {
    modal.remove();
    highlightReservationId = reservation.rezervasyon_id;
    updateContent('reservations');
  });
  
  // Modal dışına tıklanınca kapat
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Bakım/Arıza notu modalını gösterir
 */
function showMaintenanceNoteModal(roomId) {
  // Mevcut notu al
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == roomId);
  const currentNote = room ? (room.bakim_ariza_notu || '') : '';
  
  // Modal HTML
  const modalHTML = `
    <div class="modal-overlay" id="maintenance-modal">
      <div class="modal-content modal-modern">
        <div class="modal-header-modern">
          <div class="modal-icon modal-icon-maintenance">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <h3>Bakım / Arıza Notu</h3>
          <p class="modal-subtitle-modern">Oda ${room ? room.oda_numarasi : ''}</p>
        </div>
        <div class="modal-body-modern">
          <textarea id="maintenance-note-input" class="textarea-modern" placeholder="Bakım veya arıza notunu yazın..." rows="4">${currentNote}</textarea>
        </div>
        <div class="modal-footer-modern">
          ${currentNote ? '<button class="btn-modern btn-modern-danger" id="delete-maintenance">Notu Sil</button>' : ''}
          <button class="btn-modern btn-modern-secondary" id="cancel-maintenance">İptal</button>
          <button class="btn-modern btn-modern-primary" id="save-maintenance">Kaydet</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('maintenance-modal');
  const cancelBtn = document.getElementById('cancel-maintenance');
  const saveBtn = document.getElementById('save-maintenance');
  const deleteBtn = document.getElementById('delete-maintenance');
  const noteInput = document.getElementById('maintenance-note-input');
  
  // Focus
  if (noteInput) noteInput.focus();
  
  // Kapat
  const closeModal = () => {
    if (modal) modal.remove();
  };
  
  // Kaydet fonksiyonu
  const saveMaintenanceNote = () => {
    const note = noteInput ? noteInput.value.trim() : '';
    const tarih = db.getTurkeyDateTime();
    const result = db.run('UPDATE oda SET bakim_ariza_notu = ?, bakim_ariza_tarihi = ? WHERE id = ?', [note, tarih, parseInt(roomId)]);
    if (result.success) {
      console.log('Bakım notu kaydedildi');
      closeModal();
      showRoomDetail(roomId);
    } else {
      console.error('Bakım notu kaydedilemedi:', result.error);
    }
  };
  
  // Enter tuşuna basınca kaydet (Ctrl+Enter ile çok satırlı yazabilsin)
  if (noteInput) {
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveMaintenanceNote();
      }
    });
  }
  
  // İptal butonu
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }
  
  // Modal dışına tıkla
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
  
  // Kaydet butonu
  if (saveBtn) {
    saveBtn.addEventListener('click', saveMaintenanceNote);
  }
  
  // Sil butonu
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Bakım notunu silmek istediğinize emin misiniz?')) {
        db.run('UPDATE oda SET bakim_ariza_notu = NULL, bakim_ariza_tarihi = NULL WHERE id = ?', [parseInt(roomId)]);
        closeModal();
        showRoomDetail(roomId);
      }
    });
  }
}

/**
 * Navigasyon menüsünü başlatır
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const mainContent = document.getElementById('main-content');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Tüm nav-link'lerden aktif sınıfı kaldır
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Sayfa adını al
      const page = link.getAttribute('data-page');
      
      // İçeriği güncelle (şimdilik placeholder)
      updateContent(page);
      
      console.log(`Sayfa değişti: ${page}`);
    });
  });
}

// Mevcut aktif sayfa
let currentActivePage = 'rooms';

/**
 * Ana içerik alanını günceller
 * @param {string} page - Sayfa adı
 */
function updateContent(page, restoreScroll = false) {
  const mainContent = document.getElementById('main-content');
  
  // Oda panelinden çıkıyorsak scroll pozisyonunu kaydet
  if (currentActivePage === 'rooms' && page !== 'rooms') {
    roomsPanelScrollPosition = mainContent.scrollTop;
  }
  
  // Mevcut sayfayı güncelle
  currentActivePage = page;
  
  // Sidebar'daki aktif menü öğesini güncelle
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-page') === page) {
      link.classList.add('active');
    }
  });
  
  switch (page) {
    case 'rooms':
      renderRoomsPage(mainContent);
      // Scroll pozisyonunu her zaman geri yükle
      if (roomsPanelScrollPosition > 0) {
        setTimeout(() => {
          mainContent.scrollTop = roomsPanelScrollPosition;
        }, 10);
      }
      break;
    case 'egm':
      renderEGMPage(mainContent);
      break;
    case 'database':
      renderDatabasePage(mainContent);
      break;
    case 'housekeeping':
      renderHousekeepingPage(mainContent);
      break;
    case 'reservations':
      renderReservationsPage(mainContent);
      break;
    default:
      renderPlaceholder(mainContent, page);
  }
}

/**
 * EGM Kaydı sayfasını render eder
 */
function renderEGMPage(container) {
  // Aktif misafirleri al
  const activeGuests = db.getActiveGuests();
  
  // Checkout yapılmış ama EGM çıkışı yapılmamış misafirleri al
  const checkoutGuests = db.query(`
    SELECT * FROM tum_misafirler 
    WHERE egm_kaydi = 1 AND (egm_cikis_yapildi = 0 OR egm_cikis_yapildi IS NULL)
    ORDER BY cikis_tarihi DESC
  `) || [];
  
  // İstatistikler
  const totalActive = activeGuests.length;
  const registeredCount = activeGuests.filter(g => g.egm_kaydi === 1).length;
  const pendingCount = totalActive - registeredCount;
  const checkoutCount = checkoutGuests.length;
  
  // Aktif misafir satırları
  let activeRows = '';
  if (activeGuests.length === 0 && checkoutGuests.length === 0) {
    activeRows = `
      <tr>
        <td colspan="6" class="egm-empty">Kayıt bulunmamaktadır.</td>
      </tr>
    `;
  } else {
    const sortedGuests = [...activeGuests].sort((a, b) => a.egm_kaydi - b.egm_kaydi);
    
    activeRows = sortedGuests.map(guest => {
      const isRegistered = guest.egm_kaydi === 1;
      const room = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [guest.oda_id])[0];
      const roomNumber = room ? room.oda_numarasi : '-';
      
      const tcOrPassport = guest.tc_no || guest.pasaport_no || '-';
      
      // Giriş tarihini formatla (tarih + saat)
      let girisTarihiFormatted = '-';
      if (guest.otele_giris_tarihi) {
        const parts = guest.otele_giris_tarihi.split(' ');
        const tarih = parts[0] || '';
        const saat = parts[1] ? parts[1].substring(0, 5) : '';
        girisTarihiFormatted = saat ? `${tarih} ${saat}` : tarih;
      }
      
      return `
        <tr class="${isRegistered ? 'egm-row-done' : 'egm-row-pending'}">
          <td class="egm-td-name">${guest.isim} ${guest.soyisim}</td>
          <td class="egm-td-tc">
            <span>${tcOrPassport}</span>
            ${tcOrPassport !== '-' ? `<button class="egm-copy-btn" data-tc="${tcOrPassport}">Kopyala</button>` : ''}
          </td>
          <td>${roomNumber}</td>
          <td>${girisTarihiFormatted}</td>
          <td>
            ${isRegistered ? 
              '<span class="egm-badge-done">Kayıt Yapıldı</span>' : 
              '<span class="egm-badge-pending">Check-in</span>'
            }
          </td>
          <td>
            ${isRegistered ? 
              '-' : 
              `<button class="egm-btn" data-guest-id="${guest.id}">Kayıt Yapıldı</button>`
            }
          </td>
        </tr>
      `;
    }).join('');
  }
  
  // Checkout yapılmış misafir satırları
  let checkoutRows = checkoutGuests.map(guest => {
    const tcOrPassport = guest.tc_no || guest.pasaport_no || '-';
    const room = guest.oda_id ? db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [guest.oda_id])[0] : null;
    const roomNumber = room ? room.oda_numarasi : '-';
    
    // Çıkış tarihini formatla (tarih + saat)
    let cikisTarihiFormatted = '-';
    if (guest.cikis_tarihi) {
      const parts = guest.cikis_tarihi.split(' ');
      const tarih = parts[0] || '';
      const saat = parts[1] ? parts[1].substring(0, 5) : '';
      cikisTarihiFormatted = saat ? `${tarih} ${saat}` : tarih;
    }
    
    return `
      <tr class="egm-row-checkout">
        <td class="egm-td-name">${guest.isim} ${guest.soyisim}</td>
        <td class="egm-td-tc">
          <span>${tcOrPassport}</span>
          ${tcOrPassport !== '-' ? `<button class="egm-copy-btn" data-tc="${tcOrPassport}">Kopyala</button>` : ''}
        </td>
        <td>${roomNumber}</td>
        <td>${cikisTarihiFormatted}</td>
        <td><span class="egm-badge-checkout">Checkout</span></td>
        <td>
          <button class="egm-checkout-btn" data-guest-id="${guest.id}">Çıkış Yapıldı</button>
        </td>
      </tr>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="egm-page-simple">
      <div class="egm-header-simple">
        <h1>EGM Kaydı</h1>
        <div class="egm-counts">
          <span class="egm-count-item">${totalActive} Aktif</span>
          <span class="egm-count-divider">•</span>
          <span class="egm-count-item egm-count-done">${registeredCount} Kayıtlı</span>
          <span class="egm-count-divider">•</span>
          <span class="egm-count-item egm-count-pending">${pendingCount} Bekleyen</span>
          ${checkoutCount > 0 ? `<span class="egm-count-divider">•</span><span class="egm-count-item egm-count-checkout">${checkoutCount} Çıkış Bekliyor</span>` : ''}
        </div>
      </div>
      
      <table class="egm-table">
        <thead>
          <tr>
            <th>Misafir</th>
            <th>TC / Pasaport</th>
            <th>Oda</th>
            <th>Tarih</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${activeRows}
          ${checkoutRows}
        </tbody>
      </table>
    </div>
  `;
  
  // Event listener'ları ekle
  setupEGMPageEvents();
}

/**
 * EGM sayfası event listener'larını ayarlar
 */
function setupEGMPageEvents() {
  // Kayıt yapıldı butonları
  document.querySelectorAll('.egm-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const guestId = e.currentTarget.dataset.guestId;
      
      // EGM kaydını güncelle
      const result = db.run('UPDATE aktif_kalanlar SET egm_kaydi = 1 WHERE id = ?', [parseInt(guestId)]);
      
      if (result.success) {
        showToast('EGM kaydı güncellendi', 'success');
        updateEGMBadge();
        renderEGMPage(document.getElementById('main-content'));
      } else {
        showToast('Hata oluştu', 'error');
      }
    });
  });
  
  // TC kopyalama butonları
  document.querySelectorAll('.egm-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget;
      const tc = button.dataset.tc;
      navigator.clipboard.writeText(tc).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Kopyalandı';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('copied');
        }, 1500);
      }).catch(() => {
        showToast('Kopyalanamadı', 'error');
      });
    });
  });
  
  // EGM Çıkış yapıldı butonları (tum_misafirler için)
  document.querySelectorAll('.egm-checkout-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const guestId = e.currentTarget.dataset.guestId;
      
      // EGM çıkışını işaretle
      const result = db.run('UPDATE tum_misafirler SET egm_cikis_yapildi = 1 WHERE id = ?', [parseInt(guestId)]);
      
      if (result.success) {
        showToast('EGM çıkışı tamamlandı', 'success');
        updateEGMBadge();
        renderEGMPage(document.getElementById('main-content'));
      } else {
        showToast('Hata oluştu', 'error');
      }
    });
  });
}

// Veritabanı sayfası için global değişkenler
let dbPastGuestsLimit = 20;
let dbCurrentFilter = 'all';
let dbCurrentSearch = '';
let dbDateStart = '';
let dbDateEnd = '';

/**
 * Veritabanı Sorgula sayfasını render eder
 */
function renderDatabasePage(container) {
  // Sayfa değiştiğinde limiti sıfırla
  dbPastGuestsLimit = 100;
  dbCurrentFilter = 'all';
  dbCurrentSearch = '';
  dbDateStart = '';
  dbDateEnd = '';
  
  // Aktif misafir sayısını al
  const activeCount = (db.query('SELECT COUNT(*) as count FROM aktif_kalanlar')[0]?.count) || 0;

  // Toplam geçmiş kayıt sayısını al
  const pastCount = (db.query('SELECT COUNT(*) as count FROM tum_misafirler')[0]?.count) || 0;

  container.innerHTML = `
    <div class="db-page">
      <div class="db-header">
        <h1>Veritabanı Sorgula</h1>
        <div class="db-stats">
          <span class="db-stat-item">${activeCount} Aktif Misafir</span>
          <span class="db-stat-divider">•</span>
          <span class="db-stat-item">${pastCount} Toplam Kayıt</span>
        </div>
      </div>
      
      <div class="db-search-section">
        <div class="db-search-row">
          <div class="db-search-box">
            <input type="text" id="db-search-input" class="db-search-input" placeholder="İsim, TC, Pasaport veya Oda No ile ara...">
            <button id="db-search-btn" class="db-search-btn">Ara</button>
          </div>
          <div class="db-date-filter">
            <span class="db-date-label">Tarih Aralığı:</span>
            <input type="text" id="db-date-start" class="db-date-input" placeholder="Başlangıç">
            <span class="db-date-separator">-</span>
            <input type="text" id="db-date-end" class="db-date-input" placeholder="Bitiş">
            <button id="db-date-clear" class="db-date-clear" title="Temizle">✕</button>
          </div>
        </div>
        <div class="db-filter-tabs">
          <button class="db-filter-tab active" data-filter="all">Tümü</button>
          <button class="db-filter-tab" data-filter="active">Aktif Misafirler</button>
          <button class="db-filter-tab" data-filter="past">Geçmiş Misafirler</button>
        </div>
      </div>
      
      <div class="db-results">
        <table class="db-table">
          <thead>
            <tr>
              <th>İsim Soyisim</th>
              <th>TC / Pasaport</th>
              <th>Doğum Tarihi</th>
              <th>Telefon</th>
              <th>Oda</th>
              <th>Giriş</th>
              <th>Çıkış</th>
              <th>Ücret</th>
              <th>Not</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody id="db-table-body">
          </tbody>
        </table>
        <div id="db-no-results" class="db-no-results" style="display: none;">
          Sonuç bulunamadı.
        </div>
        <div id="db-load-more" class="db-load-more" style="display: none;">
          <button id="db-load-more-btn" class="db-load-more-btn">Daha Fazla Göster</button>
        </div>
      </div>
    </div>
  `;
  
  // İlk yükleme - tüm verileri göster
  renderDatabaseResults('all', '');
  
  // Event listener'ları ekle
  setupDatabasePageEvents();
}

/**
 * Veritabanı sonuçlarını render eder (SQL Optimize Edilmiş)
 */
function renderDatabaseResults(filter, searchTerm, dateStart = '', dateEnd = '') {
  const tableBody = document.getElementById('db-table-body');
  const noResults = document.getElementById('db-no-results');
  const loadMoreDiv = document.getElementById('db-load-more');
  
  if (!tableBody) return;
  
  // Global değişkenleri güncelle
  dbCurrentFilter = filter;
  dbCurrentSearch = searchTerm;
  dbDateStart = dateStart;
  dbDateEnd = dateEnd;
  
  const isSearching = searchTerm && searchTerm.trim() !== '';
  const term = isSearching ? searchTerm.trim() : '';
  const termLower = term.toLowerCase();
  const isNumeric = /^\d+$/.test(term);
  
  // Tarih filtresi kontrolü
  const hasDateFilter = dateStart || dateEnd;
  
  // SQL WHERE koşulu oluştur
  let searchCondition = '';
  let searchParams = [];
  
  if (isSearching) {
    if (isNumeric) {
      if (term.length <= 3) {
        // Oda numarası araması - oda tablosuyla JOIN gerekli
        searchCondition = '';  // Oda araması ayrı yapılacak
      } else if (term.length >= 10) {
        searchCondition = `AND (tc_no LIKE ? OR telefon LIKE ?)`;
        searchParams = [`%${term}%`, `%${term}%`];
      } else {
        searchCondition = `AND (tc_no LIKE ? OR pasaport_no LIKE ? OR telefon LIKE ?)`;
        searchParams = [`%${term}%`, `%${term}%`, `%${term}%`];
      }
    } else {
      searchCondition = `AND (LOWER(isim) LIKE ? OR LOWER(soyisim) LIKE ? OR LOWER(isim || ' ' || soyisim) LIKE ? OR LOWER(pasaport_no) LIKE ?)`;
      searchParams = [`%${termLower}%`, `%${termLower}%`, `%${termLower}%`, `%${termLower}%`];
    }
  }
  
  // Tarih filtresi koşulları
  let dateCondition = '';
  let dateParams = [];
  if (dateStart) {
    dateCondition += ` AND DATE(otele_giris_tarihi) >= ?`;
    dateParams.push(dateStart);
  }
  if (dateEnd) {
    dateCondition += ` AND DATE(otele_giris_tarihi) <= ?`;
    dateParams.push(dateEnd);
  }
  
  let results = [];
  let totalPastCount = 0;
  let hasMore = false;
  
  // Aktif misafirleri al (SQL ile)
  let activeGuests = [];
  if (filter === 'all' || filter === 'active') {
    let activeSQL = `
      SELECT a.*, o.oda_numarasi 
      FROM aktif_kalanlar a 
      LEFT JOIN oda o ON a.oda_id = o.id 
      WHERE 1=1 ${searchCondition} ${dateCondition}
      ORDER BY a.otele_giris_tarihi DESC
    `;
    
    // Oda numarası araması için özel kontrol
    if (isSearching && isNumeric && term.length <= 3) {
      activeSQL = `
        SELECT a.*, o.oda_numarasi 
        FROM aktif_kalanlar a 
        LEFT JOIN oda o ON a.oda_id = o.id 
        WHERE o.oda_numarasi = ? ${dateCondition}
        ORDER BY a.otele_giris_tarihi DESC
      `;
      activeGuests = db.query(activeSQL, [term, ...dateParams]) || [];
    } else {
      activeGuests = db.query(activeSQL, [...searchParams, ...dateParams]) || [];
    }
    
    activeGuests = activeGuests.map(g => ({ ...g, isActive: true }));
  }
  
  // Geçmiş misafirler için tarih koşulu (giriş tarihi bazlı)
  let pastDateCondition = '';
  let pastDateParams = [];
  if (dateStart) {
    pastDateCondition += ` AND DATE(otele_giris_tarihi) >= ?`;
    pastDateParams.push(dateStart);
  }
  if (dateEnd) {
    pastDateCondition += ` AND DATE(otele_giris_tarihi) <= ?`;
    pastDateParams.push(dateEnd);
  }
  
  // Geçmiş misafirleri al (SQL ile LIMIT)
  let pastGuests = [];
  if (filter === 'all' || filter === 'past') {
    // Önce toplam sayıyı al
    let countSQL = `SELECT COUNT(*) as count FROM tum_misafirler WHERE 1=1 ${searchCondition} ${pastDateCondition}`;
    
    if (isSearching && isNumeric && term.length <= 3) {
      countSQL = `
        SELECT COUNT(*) as count 
        FROM tum_misafirler t 
        LEFT JOIN oda o ON t.oda_id = o.id 
        WHERE o.oda_numarasi = ? ${pastDateCondition}
      `;
      totalPastCount = (db.query(countSQL, [term, ...pastDateParams])[0]?.count) || 0;
    } else {
      totalPastCount = (db.query(countSQL, [...searchParams, ...pastDateParams])[0]?.count) || 0;
    }
    
    // Limit ile veri çek
    const limit = dbPastGuestsLimit;
    
    let pastSQL = `
      SELECT t.*, o.oda_numarasi 
      FROM tum_misafirler t 
      LEFT JOIN oda o ON t.oda_id = o.id 
      WHERE 1=1 ${searchCondition} ${pastDateCondition}
      ORDER BY t.cikis_tarihi DESC
      LIMIT ?
    `;
    
    if (isSearching && isNumeric && term.length <= 3) {
      pastSQL = `
        SELECT t.*, o.oda_numarasi 
        FROM tum_misafirler t 
        LEFT JOIN oda o ON t.oda_id = o.id 
        WHERE o.oda_numarasi = ? ${pastDateCondition}
        ORDER BY t.cikis_tarihi DESC
        LIMIT ?
      `;
      pastGuests = db.query(pastSQL, [term, ...pastDateParams, limit]) || [];
    } else {
      pastGuests = db.query(pastSQL, [...searchParams, ...pastDateParams, limit]) || [];
    }
    
    pastGuests = pastGuests.map(g => ({ ...g, isActive: false }));
    
    // Daha fazla var mı?
    if (totalPastCount > dbPastGuestsLimit) {
      hasMore = true;
    }
  }
  
  // Sonuçları birleştir
  if (filter === 'active') {
    results = activeGuests;
  } else if (filter === 'past') {
    results = pastGuests;
  } else {
    results = [...activeGuests, ...pastGuests];
  }
  
  // Sonuçları göster
  if (results.length === 0) {
    tableBody.innerHTML = '';
    noResults.style.display = 'block';
    if (loadMoreDiv) loadMoreDiv.style.display = 'none';
    return;
  }
  
  noResults.style.display = 'none';
  
  // Daha fazla butonu
  if (loadMoreDiv) {
    if (hasMore) {
      loadMoreDiv.style.display = 'block';
      const remaining = totalPastCount - dbPastGuestsLimit;
      const loadMoreBtn = document.getElementById('db-load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.textContent = `Daha Fazla Göster (${remaining} kayıt daha)`;
      }
    } else {
      loadMoreDiv.style.display = 'none';
    }
  }
  
  tableBody.innerHTML = results.map(guest => {
    const tcOrPassport = guest.tc_no || guest.pasaport_no || '-';
    const odaNo = guest.oda_numarasi || '-';
    
    let girisTarihi = '-';
    if (guest.otele_giris_tarihi) {
      const parts = guest.otele_giris_tarihi.split(' ');
      girisTarihi = parts[0] || '-';
    }
    
    let cikisTarihi = '-';
    if (guest.cikis_tarihi) {
      const parts = guest.cikis_tarihi.split(' ');
      cikisTarihi = parts[0] || '-';
    }
    
    const dogumTarihi = guest.dogum_tarihi || '-';
    const ucret = guest.ucret ? `₺${guest.ucret}` : '-';
    
    let notAlani = '-';
    if (guest.not_alani) {
      notAlani = guest.not_alani.length > 20 ? guest.not_alani.substring(0, 20) + '...' : guest.not_alani;
    }
    
    return `
      <tr class="${guest.isActive ? 'db-row-active' : 'db-row-past'}">
        <td class="db-td-name">${guest.isim || '-'} ${guest.soyisim || ''}</td>
        <td class="db-td-tc">
          <span>${tcOrPassport}</span>
          ${tcOrPassport !== '-' ? `<button class="db-copy-btn" data-value="${tcOrPassport}">Kopyala</button>` : ''}
        </td>
        <td>${dogumTarihi}</td>
        <td>${guest.telefon || '-'}</td>
        <td>${odaNo}</td>
        <td>${girisTarihi}</td>
        <td>${cikisTarihi}</td>
        <td>${ucret}</td>
        <td class="db-td-note" title="${guest.not_alani || ''}">${notAlani}</td>
        <td>
          ${guest.isActive ? 
            '<span class="db-badge-active">Aktif</span>' : 
            '<span class="db-badge-past">Geçmiş</span>'
          }
        </td>
      </tr>
    `;
  }).join('');
  
  // Kopyala butonlarına event listener ekle
  document.querySelectorAll('.db-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget;
      const value = button.dataset.value;
      navigator.clipboard.writeText(value).then(() => {
        button.textContent = 'Kopyalandı';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = 'Kopyala';
          button.classList.remove('copied');
        }, 1500);
      }).catch(() => {
        showToast('Kopyalanamadı', 'error');
      });
    });
  });
}

/**
 * Veritabanı sayfası event listener'larını ayarlar
 */
function setupDatabasePageEvents() {
  const searchInput = document.getElementById('db-search-input');
  const searchBtn = document.getElementById('db-search-btn');
  const filterTabs = document.querySelectorAll('.db-filter-tab');
  const loadMoreBtn = document.getElementById('db-load-more-btn');
  const dateStartInput = document.getElementById('db-date-start');
  const dateEndInput = document.getElementById('db-date-end');
  const dateClearBtn = document.getElementById('db-date-clear');
  
  let currentFilter = 'all';
  
  // Flatpickr tarih seçicileri
  let fpStart = null;
  let fpEnd = null;
  
  if (dateStartInput) {
    fpStart = flatpickr(dateStartInput, {
      locale: Turkish,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd.m.Y',
      allowInput: true,
      onChange: () => doSearch()
    });
  }
  
  if (dateEndInput) {
    fpEnd = flatpickr(dateEndInput, {
      locale: Turkish,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd.m.Y',
      allowInput: true,
      onChange: () => doSearch()
    });
  }
  
  // Arama fonksiyonu
  const doSearch = () => {
    // Arama yapılınca limiti sıfırla
    dbPastGuestsLimit = 100;
    const searchTerm = searchInput ? searchInput.value : '';
    const dateStart = dateStartInput ? dateStartInput.value : '';
    const dateEnd = dateEndInput ? dateEndInput.value : '';
    renderDatabaseResults(currentFilter, searchTerm, dateStart, dateEnd);
  };
  
  // Tarih temizle butonu
  if (dateClearBtn) {
    dateClearBtn.addEventListener('click', () => {
      if (fpStart) fpStart.clear();
      if (fpEnd) fpEnd.clear();
      doSearch();
    });
  }
  
  // Arama butonu
  if (searchBtn) {
    searchBtn.addEventListener('click', doSearch);
  }
  
  // Enter tuşu ile arama (anında)
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        doSearch();
      }
    });

    // Debounce ile arama (300ms bekle)
    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 300);
    });
  }
  
  // Filtre sekmeleri
  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = e.currentTarget.dataset.filter;
      // Filtre değişince limiti sıfırla
      dbPastGuestsLimit = 100;
      doSearch();
    });
  });
  
  // Daha fazla butonu
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      dbPastGuestsLimit += 100;
      const searchTerm = searchInput ? searchInput.value : '';
      const dateStart = dateStartInput ? dateStartInput.value : '';
      const dateEnd = dateEndInput ? dateEndInput.value : '';
      renderDatabaseResults(currentFilter, searchTerm, dateStart, dateEnd);
    });
  }
}

/**
 * Kat Hizmetleri - Günlük sıfırlama kontrolü
 */
function checkDailyHousekeepingReset() {
  const today = db.getTurkeyDate();
  const lastResetDate = localStorage.getItem('housekeeping_last_reset');
  
  if (lastResetDate !== today) {
    // Yeni gün başladı - tüm cleaning_status'ları sıfırla
    db.run('UPDATE oda SET cleaning_status = NULL WHERE cleaning_status IS NOT NULL');
    localStorage.setItem('housekeeping_last_reset', today);
    console.log('Kat hizmetleri günlük sıfırlandı:', today);
  }
}

/**
 * Kat Hizmetleri sayfasını render eder
 */
function renderHousekeepingPage(container) {
  // Günlük sıfırlama kontrolü
  checkDailyHousekeepingReset();
  
  const today = db.getTurkeyDate();
  const rooms = db.getAllRooms();
  
  // Bugün çıkışı olan odalar (aktif misafirlerden)
  const activeGuests = db.getActiveGuests() || [];
  const checkoutTodayRoomIds = new Set();
  
  activeGuests.forEach(guest => {
    if (guest.cikis_tarihi) {
      const cikisTarihi = guest.cikis_tarihi.split(' ')[0];
      if (cikisTarihi === today) {
        checkoutTodayRoomIds.add(guest.oda_id);
      }
    }
  });
  
  // Sol sütun: Bugün çıkışı olan + kirli odalar
  const pendingRooms = rooms.filter(room => {
    const isCheckoutToday = checkoutTodayRoomIds.has(room.id);
    const isDirty = room.temizlik_durumu === 'kirli' || room.durum === 'kirli';
    // Temizliğe başlanmamış olanlar (cleaning_status = null veya 'pending')
    return (isCheckoutToday || isDirty) && (!room.cleaning_status || room.cleaning_status === 'pending');
  }).sort((a, b) => {
    // Bugün çıkışı olanlar önce
    const aCheckout = checkoutTodayRoomIds.has(a.id) ? 0 : 1;
    const bCheckout = checkoutTodayRoomIds.has(b.id) ? 0 : 1;
    return aCheckout - bCheckout;
  });
  
  // Orta sütun: Temizliğe başlanan odalar
  const inProgressRooms = rooms.filter(room => room.cleaning_status === 'in_progress');
  
  // Sağ sütun: Temizlenmiş odalar (bugün temizlenenler)
  const completedRooms = rooms.filter(room => room.cleaning_status === 'completed');
  
  // Oda kartı oluştur
  const createRoomCard = (room, column) => {
    const guests = db.getGuestsInRoom(room.id) || [];
    const guestNames = guests.map(g => `${g.isim} ${g.soyisim}`).join(', ');
    const isDirty = room.temizlik_durumu === 'kirli' || room.durum === 'kirli';
    const isOccupied = guests.length > 0;
    
    let statusText = '';
    const isCheckoutToday = checkoutTodayRoomIds.has(room.id);
    if (isDirty && isOccupied) statusText = 'Dolu ve Kirli';
    else if (isDirty) statusText = 'Kirli';
    else if (isCheckoutToday) statusText = 'Bugün Çıkışı Bekleniyor';
    
    let buttons = '';
    if (column === 'pending') {
      buttons = `<button class="hk-btn hk-btn-start" data-room-id="${room.id}">Temizliğe Başla</button>`;
    } else if (column === 'in_progress') {
      buttons = `<button class="hk-btn hk-btn-complete" data-room-id="${room.id}">Temizliği Bitir</button>`;
    } else if (column === 'completed') {
      buttons = `<span class="hk-completed-text">✓ Temizlendi</span>`;
    }
    
    return `
      <div class="hk-room-card" data-room-id="${room.id}">
        <div class="hk-room-header">
          <span class="hk-room-number">${room.oda_numarasi}</span>
          ${statusText ? `<span class="hk-room-status ${isDirty && isOccupied ? 'hk-status-both' : (isDirty ? 'hk-status-dirty' : 'hk-status-checkout')}">${statusText}</span>` : ''}
        </div>
        ${guestNames ? `<div class="hk-room-guests">${guestNames}</div>` : ''}
        <div class="hk-room-info">${room.oda_tipi} • ${room.kapasite} Kişilik</div>
        <div class="hk-room-actions">${buttons}</div>
      </div>
    `;
  };
  
  container.innerHTML = `
    <div class="hk-page">
      <div class="hk-header">
        <h1>Kat Hizmetleri</h1>
        <p class="hk-date">Bugün: ${today}</p>
      </div>
      
      <div class="hk-board">
        <div class="hk-column hk-column-pending">
          <div class="hk-column-header">
            <h3>Temizlik Bekliyor</h3>
            <span class="hk-column-count">${pendingRooms.length}</span>
          </div>
          <div class="hk-column-body">
            ${pendingRooms.length > 0 ? pendingRooms.map(r => createRoomCard(r, 'pending')).join('') : '<p class="hk-empty">Temizlik bekleyen oda yok</p>'}
          </div>
        </div>
        
        <div class="hk-column hk-column-progress">
          <div class="hk-column-header">
            <h3>Temizleniyor</h3>
            <span class="hk-column-count">${inProgressRooms.length}</span>
          </div>
          <div class="hk-column-body">
            ${inProgressRooms.length > 0 ? inProgressRooms.map(r => createRoomCard(r, 'in_progress')).join('') : '<p class="hk-empty">Temizlenen oda yok</p>'}
          </div>
        </div>
        
        <div class="hk-column hk-column-completed">
          <div class="hk-column-header">
            <h3>Temizlendi</h3>
            <span class="hk-column-count">${completedRooms.length}</span>
          </div>
          <div class="hk-column-body">
            ${completedRooms.length > 0 ? completedRooms.map(r => createRoomCard(r, 'completed')).join('') : '<p class="hk-empty">Henüz temizlenen oda yok</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Event listeners
  setupHousekeepingEvents();
}

/**
 * Kat Hizmetleri event listener'larını ayarlar
 */
function setupHousekeepingEvents() {
  // Temizliğe başla butonları
  document.querySelectorAll('.hk-btn-start').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const roomId = parseInt(e.currentTarget.dataset.roomId);
      db.run('UPDATE oda SET cleaning_status = ? WHERE id = ?', ['in_progress', roomId]);
      renderHousekeepingPage(document.getElementById('main-content'));
      showToast('Temizliğe başlandı', 'success');
    });
  });
  
  // Temizlendi butonları
  document.querySelectorAll('.hk-btn-complete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const roomId = parseInt(e.currentTarget.dataset.roomId);
      // Odayı temiz yap ve cleaning_status'u completed yap
      db.run('UPDATE oda SET temizlik_durumu = ?, cleaning_status = ? WHERE id = ?', ['temiz', 'completed', roomId]);
      renderHousekeepingPage(document.getElementById('main-content'));
      showToast('Oda temizlendi', 'success');
    });
  });
}

/**
 * Placeholder sayfa gösterir
 */
function renderPlaceholder(container, page) {
  const pageTitles = {
    'rooms': 'Oda Paneli',
    'reservations': 'Rezervasyon Yönetimi',
    'housekeeping': 'Kat Hizmetleri',
    'egm': 'EGM Kaydı',
    'database': 'Veritabanı Sorgula'
  };
  
  container.innerHTML = `
    <div class="content-placeholder">
      <div class="placeholder-text">${pageTitles[page] || 'İçerik'} - İçerik alanı</div>
    </div>
  `;
}

/**
 * Oda Paneli sayfasını render eder
 */
function renderRoomsPage(container) {
  try {
    if (!dbConnected) {
      container.innerHTML = `
        <div class="page-container">
          <div class="page-header">
            <h1 class="page-title">Oda Paneli</h1>
          </div>
          <div class="error-message">
            <p>Veritabanı bağlantısı kurulamadı.</p>
            <p>Lütfen egepalas.db dosyasının masaüstünde olduğundan emin olun.</p>
          </div>
        </div>
      `;
      return;
    }
    
    // Önce oda durumlarını aktif misafirlere göre senkronla
    db.syncRoomStatus();
    
    const rooms = db.getAllRooms();
    const stats = db.getDashboardStats();
    
    // Aktif misafirleri al ve oda_id'ye göre map yap
    const activeGuests = db.getActiveGuests();
    const guestsByRoomId = {};
    activeGuests.forEach(guest => {
      if (guest.oda_id) {
        if (!guestsByRoomId[guest.oda_id]) {
          guestsByRoomId[guest.oda_id] = [];
        }
        guestsByRoomId[guest.oda_id].push(guest);
      }
    });
    
    // Bugün giriş yapacak rezervasyonları al (oda_id -> rezervasyon bilgisi map)
    const today = db.getTurkeyDate();
    const activeReservations = db.getActiveReservations() || [];
    const todayReservationsByRoom = new Map();
    activeReservations.forEach(rez => {
      if (rez.oda_id) {
        const girisDate = rez.giris_tarihi ? rez.giris_tarihi.split(' ')[0] : '';
        if (girisDate === today) {
          todayReservationsByRoom.set(rez.oda_id, {
            id: rez.rezervasyon_id,
            isim: rez.isim,
            soyisim: rez.soyisim
          });
        }
      }
    });
    
    // Odaları kata göre grupla
    const roomsByFloor = groupRoomsByFloor(rooms);
    
    // Oda tiplerini al (Suit hariç)
    const roomTypes = (db.getRoomTypes() || []).filter(rt => rt.oda_tipi !== 'Suit');
    const roomTypeButtons = roomTypes.map(rt => 
      `<button class="filter-btn filter-type-btn" data-type="${rt.oda_tipi}">${rt.oda_tipi}</button>`
    ).join('');
    
    // Çıkış tarihi geçmiş misafirleri kontrol et
    const overdueGuests = db.getOverdueGuests() || [];
    const overdueCount = overdueGuests.length;
    
    // Çıkış tarihi geçmiş misafir uyarı HTML'i
    let overdueWarningHtml = '';
    if (overdueCount > 0) {
      overdueWarningHtml = `
        <div class="overdue-warning-banner">
          <div class="overdue-warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="overdue-warning-content">
            <div class="overdue-warning-title">Çıkış Tarihi Geçmiş Misafirler</div>
            <div class="overdue-warning-text">
              <strong>${overdueCount}</strong> misafirin çıkış tarihi geçmiş ancak checkout işlemi yapılmamış.
              Bu misafirlerin çıkışını yapabilir veya süresini uzatabilirsiniz.
            </div>
          </div>
          <button class="overdue-warning-btn" onclick="showOverdueGuestsModal()">
            Görüntüle
          </button>
        </div>
      `;
    }
    
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-header-left">
            <h1 class="page-title">Oda Paneli</h1>
            <div class="room-legend-mini">
              <span class="legend-mini-item"><svg width="14" height="10" viewBox="0 0 24 20" fill="none" stroke="#888" stroke-width="1.5"><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/></svg> Single</span>
              <span class="legend-mini-item"><svg width="18" height="10" viewBox="0 0 32 20" fill="none" stroke="#b0b0b0" stroke-width="1.5"><rect x="2" y="8" width="28" height="8" rx="1"/><path d="M4 8V6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v2"/><line x1="16" y1="4" x2="16" y2="8"/></svg> Double</span>
              <span class="legend-mini-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.5"><rect x="3" y="12" width="18" height="9" rx="1"/><path d="M3 15h18"/><path d="M7 12V3"/><path d="M17 12V3"/><path d="M7 3h10"/></svg> Balkon</span>
              <span class="legend-mini-item"><span style="display:inline-block;width:16px;height:6px;background:#f59e0b;border-radius:3px;"></span> Bugün Girecek Rezervasyon</span>
            </div>
          </div>
          <div class="page-stats">
            <div class="stat-item stat-success">
              <span class="stat-value">${stats.emptyRooms}</span>
              <span class="stat-label">Boş</span>
            </div>
            <div class="stat-item stat-danger">
              <span class="stat-value">${stats.occupiedRooms}</span>
              <span class="stat-label">Dolu</span>
            </div>
            <div class="stat-item stat-dirty">
              <span class="stat-value">${stats.dirtyRooms}</span>
              <span class="stat-label">Kirli</span>
            </div>
            <div class="stat-item stat-reserved">
              <span class="stat-value">${todayReservationsByRoom.size}</span>
              <span class="stat-label">Rezerve</span>
            </div>
          </div>
        </div>
        
        ${overdueWarningHtml}
        
        <div class="room-controls">
          <div class="room-filters">
            <button class="filter-btn active" data-filter="all">Tüm Odalar</button>
            <button class="filter-btn" data-filter="empty">Boş Odalar</button>
            <button class="filter-btn" data-filter="occupied">Dolu Odalar</button>
            <button class="filter-btn" data-filter="dirty">Kirli Odalar</button>
          </div>
          <div class="room-type-filters">
            ${roomTypeButtons}
          </div>
        </div>
        
        <div class="floors-container">
          ${rooms.length > 0 ? renderFloors(roomsByFloor, guestsByRoomId, todayReservationsByRoom) : '<p class="no-data">Henüz oda kaydı bulunmuyor.</p>'}
        </div>
      </div>
    `;
    
    // Filtre butonlarına event listener ekle
    initRoomFilters();
    
    // Not silme butonlarına event listener ekle
    initNoteDeleteButtons();
    
    // Oda kartlarına tıklama event listener'ı
    initRoomCardClicks();
    
  } catch (error) {
    console.error('Oda paneli render hatası:', error);
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1 class="page-title">Oda Paneli</h1>
        </div>
        <div class="error-message">
          <p>Sayfa yüklenirken hata oluştu: ${error.message}</p>
        </div>
      </div>
    `;
  }
}

// Highlight edilecek rezervasyon ID'si (oda panelinden gelindiğinde)
let highlightReservationId = null;

/**
 * Oda kartı tıklamalarını başlatır
 */
function initRoomCardClicks() {
  const roomCards = document.querySelectorAll('.room-card');
  
  roomCards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Sağ tık menüsü veya not silme butonu değilse
      if (!e.target.closest('.note-delete')) {
        const roomId = card.dataset.roomId;
        showRoomDetail(roomId);
      }
    });
  });
  
  // Rezervasyon etiketi tıklamaları
  const reservationTags = document.querySelectorAll('.room-reservation-tag');
  reservationTags.forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.stopPropagation(); // Oda kartı tıklamasını engelle
      const rezId = tag.dataset.rezId;
      if (rezId) {
        highlightReservationId = parseInt(rezId);
        // Rezervasyon sayfasına git
        updateContent('reservations');
      }
    });
  });
}

/**
 * Not silme butonlarını başlatır
 */
function initNoteDeleteButtons() {
  const deleteButtons = document.querySelectorAll('.note-delete');
  
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const roomId = btn.dataset.roomId;
      
      // Notu sil
      const result = db.run('UPDATE oda SET oda_notu = ? WHERE id = ?', ['', parseInt(roomId)]);
      if (result.success) {
        console.log('Not silindi');
        updateContent('rooms');
      }
    });
  });
}

/**
 * Oda filtrelerini başlatır
 */
function initRoomFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn:not(.filter-type-btn)');
  const typeBtns = document.querySelectorAll('.filter-type-btn');
  const roomCards = document.querySelectorAll('.room-card-wrapper');
  
  // Filtreleme fonksiyonu
  function applyFilters() {
    roomCards.forEach(wrapper => {
      const card = wrapper.querySelector('.room-card');
      const roomType = card.dataset.roomType || '';
      
      // Durum filtresi kontrolü
      let statusMatch = false;
      switch(currentRoomStatusFilter) {
        case 'all':
          statusMatch = true;
          break;
        case 'empty':
          statusMatch = card.classList.contains('room-empty');
          break;
        case 'occupied':
          statusMatch = card.classList.contains('room-occupied') || card.classList.contains('room-occupied-dirty');
          break;
        case 'dirty':
          statusMatch = card.classList.contains('room-dirty') || card.classList.contains('room-occupied-dirty');
          break;
      }
      
      // Oda tipi filtresi kontrolü
      const typeMatch = selectedRoomTypes.size === 0 || selectedRoomTypes.has(roomType);
      
      wrapper.style.display = (statusMatch && typeMatch) ? '' : 'none';
    });
  }
  
  // Durum filtreleri
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRoomStatusFilter = btn.dataset.filter;
      
      // "Tüm Odalar" seçildiğinde oda tipi filtrelerini de temizle
      if (btn.dataset.filter === 'all') {
        selectedRoomTypes.clear();
        typeBtns.forEach(tb => tb.classList.remove('active'));
      }
      
      applyFilters();
    });
  });
  
  // Oda tipi filtreleri (çoklu seçim)
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      
      if (selectedRoomTypes.has(type)) {
        selectedRoomTypes.delete(type);
        btn.classList.remove('active');
      } else {
        selectedRoomTypes.add(type);
        btn.classList.add('active');
      }
      
      applyFilters();
    });
  });
  
  // Sayfa yenilendiğinde mevcut filtreleri uygula
  filterBtns.forEach(btn => {
    if (btn.dataset.filter === currentRoomStatusFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Oda tipi filtrelerini geri yükle
  typeBtns.forEach(btn => {
    if (selectedRoomTypes.has(btn.dataset.type)) {
      btn.classList.add('active');
    }
  });
  
  applyFilters();
}

/**
 * Odaları kat numarasına göre gruplar
 */
function groupRoomsByFloor(rooms) {
  const floors = {};
  
  rooms.forEach(room => {
    const roomNum = room.oda_numarasi.toString();
    let floor;
    
    // Eğer oda numarası sayısal değilse (Suit gibi) 1. kata ekle
    if (isNaN(parseInt(roomNum.charAt(0)))) {
      floor = '1';
    } else {
      // Oda numarasının ilk karakterini kat olarak al (101 -> 1, 201 -> 2)
      floor = roomNum.charAt(0);
    }
    
    if (!floors[floor]) {
      floors[floor] = [];
    }
    floors[floor].push(room);
  });
  
  // Her katı oda numarasına göre sırala (Suit en sona)
  Object.keys(floors).forEach(floor => {
    floors[floor].sort((a, b) => {
      const numA = parseInt(a.oda_numarasi) || 9999;
      const numB = parseInt(b.oda_numarasi) || 9999;
      return numA - numB;
    });
  });
  
  return floors;
}

/**
 * Katları render eder
 */
function renderFloors(roomsByFloor, guestsByRoomId, todayReservationsByRoom = new Map()) {
  // Kat numaralarını sırala
  const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b));
  
  return sortedFloors.map(floor => `
    <div class="floor-section">
      <div class="floor-label">${floor}. Kat</div>
      <div class="floor-rooms">
        ${roomsByFloor[floor].map(room => createRoomCard(room, guestsByRoomId[room.id] || [], todayReservationsByRoom.get(room.id))).join('')}
      </div>
    </div>
  `).join('');
}

/**
 * Tek bir oda kartı oluşturur
 */
function createRoomCard(room, guests = [], todayReservation = null) {
  const hasTodayReservation = !!todayReservation;
  const isOccupied = room.doluluk_durumu === 'dolu';
  const isDirty = room.temizlik_durumu === 'kirli';
  
  let statusClass = 'room-empty';
  let statusText = 'Boş';
  
  if (isOccupied && isDirty) {
    statusClass = 'room-occupied-dirty';
    statusText = 'Dolu / Kirli';
  } else if (isOccupied) {
    statusClass = 'room-occupied';
    statusText = 'Dolu';
  } else if (isDirty) {
    statusClass = 'room-dirty';
    statusText = 'Kirli';
  }
  
  const bedIcons = getRoomTypeIcons(room.oda_tipi);
  
  // Kapasite kadar slot oluştur
  const capacity = room.kapasite || 1;
  const slots = createGuestSlots(capacity, guests);
  const isSuit = room.oda_tipi && room.oda_tipi.toLowerCase() === 'suit';
  
  // Balkon simgesi
  const balkonIcon = room.balkon ? `<svg class="balcony-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="12" width="18" height="9" rx="1"/>
    <path d="M3 15h18"/>
    <path d="M7 12V3"/>
    <path d="M17 12V3"/>
    <path d="M7 3h10"/>
    <path d="M9 12V9"/>
    <path d="M12 12V9"/>
    <path d="M15 12V9"/>
  </svg>` : '';
  
  // Bugün girecek rezervasyon etiketi
  const todayReservationTag = hasTodayReservation ? `
    <div class="room-reservation-tag" data-rez-id="${todayReservation.id}" title="Rezervasyon detayına git">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="rez-tag-name">${todayReservation.isim} ${todayReservation.soyisim}</span>
      <svg class="rez-tag-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  ` : '';

  return `
    <div class="room-card-wrapper">
      ${room.oda_notu ? `<div class="room-user-note"><span class="note-text">${room.oda_notu}</span><button class="note-delete" data-room-id="${room.id}">&times;</button></div>` : ''}
      ${todayReservationTag}
      <div class="room-card ${statusClass} ${hasTodayReservation ? 'has-reservation' : ''}" data-room-id="${room.id}" data-room-type="${room.oda_tipi || ''}">
        <div class="room-header">
          <div class="room-number">${room.oda_numarasi}</div>
          <div class="room-status-badge">${statusText}</div>
        </div>
        <div class="room-slots ${isSuit ? 'slots-horizontal' : ''}">
          ${slots}
        </div>
      </div>
      <div class="room-type-info">
        <div class="room-type-icons">
          <span class="bed-icons">${bedIcons}</span>
          <span class="room-type-text">${room.oda_tipi || '-'}</span>
          ${balkonIcon ? `<span class="balkon-wrapper">${balkonIcon}</span>` : ''}
        </div>
      </div>
      ${room.bakim_ariza_notu ? `<div class="room-maintenance-tag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        Bakım/Arıza
      </div>` : ''}
    </div>
  `;
}

/**
 * Kapasite kadar misafir slotu oluşturur
 */
function createGuestSlots(capacity, guests) {
  // Boş odalarda çizgi gösterme
  if (guests.length === 0) {
    return '';
  }
  
  let slots = '';
  
  for (let i = 0; i < capacity; i++) {
    if (guests[i]) {
      // Misafir var - isim göster
      slots += `<div class="guest-slot guest-filled">${guests[i].isim} ${guests[i].soyisim}</div>`;
    } else {
      // Misafir yok - çizgi göster
      slots += `<div class="guest-slot guest-empty"></div>`;
    }
  }
  
  return slots;
}

/**
 * Oda tipine göre yatak simgelerini döndürür
 */
function getRoomTypeIcons(odaTipi) {
  if (!odaTipi) return '';
  
  // Tek kişilik yatak simgesi
  const singleBed = `<svg class="bed-icon single" width="20" height="16" viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="2" y="8" width="20" height="8" rx="1"/>
    <path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/>
    <line x1="2" y1="16" x2="2" y2="18"/>
    <line x1="22" y1="16" x2="22" y2="18"/>
  </svg>`;
  
  // Çift kişilik yatak simgesi
  const doubleBed = `<svg class="bed-icon double" width="28" height="16" viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="2" y="8" width="28" height="8" rx="1"/>
    <path d="M4 8V6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v2"/>
    <line x1="16" y1="4" x2="16" y2="8"/>
    <line x1="2" y1="16" x2="2" y2="18"/>
    <line x1="30" y1="16" x2="30" y2="18"/>
  </svg>`;
  
  // Suit simgesi
  const suitIcon = `<svg class="bed-icon suit" width="24" height="16" viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M12 2l8 4v10l-8 4-8-4V6l8-4z"/>
    <path d="M12 12v8"/>
    <path d="M4 6l8 6 8-6"/>
  </svg>`;
  
  const type = odaTipi.toLowerCase();
  
  if (type === 'suit') {
    return suitIcon;
  }
  
  let icons = '';
  
  // Double sayısını bul
  const doubleMatch = type.match(/(\d+)\s*double/);
  const doubleCount = doubleMatch ? parseInt(doubleMatch[1]) : (type === 'double' ? 1 : 0);
  
  // Single sayısını bul
  const singleMatch = type.match(/(\d+)\s*single/);
  const singleCount = singleMatch ? parseInt(singleMatch[1]) : 0;
  
  // Double yatakları ekle
  for (let i = 0; i < doubleCount; i++) {
    icons += doubleBed;
  }
  
  // Single yatakları ekle
  for (let i = 0; i < singleCount; i++) {
    icons += singleBed;
  }
  
  return icons || singleBed;
}

/**
 * Windows pencere kontrollerini başlatır
 */
function initWindowControls() {
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');
  const closeBtn = document.getElementById('close-btn');
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      const win = remote.getCurrentWindow();
      win.minimize();
    });
  }
  
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      const win = remote.getCurrentWindow();
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const win = remote.getCurrentWindow();
      win.close();
    });
  }
}

/**
 * Tarih ve saat formatları için yardımcı fonksiyonlar
 */
const DateUtils = {
  /**
   * Tarihi Türkçe formatında döndürür
   * @param {Date} date - Tarih objesi
   * @returns {string} Formatlanmış tarih
   */
  formatDate(date) {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    };
    return date.toLocaleDateString('tr-TR', options);
  },
  
  /**
   * Saati formatlar
   * @param {Date} date - Tarih objesi
   * @returns {string} Formatlanmış saat
   */
  formatTime(date) {
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
};

/**
 * Bildirim gösterme fonksiyonu
 * @param {string} message - Bildirim mesajı
 * @param {string} type - Bildirim tipi (success, error, warning, info)
 */
function showNotification(message, type = 'info') {
  // İleride bildirim sistemi eklenecek
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================
// REZERVASYON YÖNETİMİ SAYFALARI
// ============================================

// Rezervasyon görünüm durumu
let reservationViewMode = 'today'; // 'today' veya 'all'

/**
 * Rezervasyon Yönetimi ana sayfasını render eder
 */
function renderReservationsPage(container) {
  // Eğer yeni rezervasyon formu açıksa direkt o sayfayı göster
  if (isNewReservationFormOpen) {
    showNewReservationPage();
    return;
  }
  
  const today = db.getTurkeyDate();
  
  // Tüm aktif rezervasyonları al
  const allReservations = db.getActiveReservations() || [];
  
  // Bugün giriş yapacak rezervasyonları filtrele
  const todayReservations = allReservations.filter(r => {
    const girisDate = r.giris_tarihi ? r.giris_tarihi.split(' ')[0] : '';
    return girisDate === today;
  });
  
  // Bugün giriş yapmış rezervasyonları al (giris_yapan_rezervasyon tablosundan)
  const checkedInReservations = db.query(
    `SELECT * FROM giris_yapan_rezervasyon WHERE DATE(giris_tarihi) = ? ORDER BY rezervasyon_id DESC`,
    [today]
  ) || [];
  
  // Görüntülenecek rezervasyonları belirle
  const displayReservations = reservationViewMode === 'today' ? todayReservations : allReservations;
  
  // İstatistikler
  const totalReservations = allReservations.length;
  const todayCount = todayReservations.length;
  const checkedInCount = checkedInReservations.length;
  
  // Geçmiş tarihli (işlenmemiş) rezervasyonları kontrol et
  const expiredReservations = db.getExpiredReservations() || [];
  const expiredCount = expiredReservations.length;
  
  // Geçmiş tarihli rezervasyon uyarı HTML'i
  let expiredWarningHtml = '';
  if (expiredCount > 0) {
    expiredWarningHtml = `
      <div class="expired-warning-banner">
        <div class="expired-warning-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="expired-warning-content">
          <div class="expired-warning-title">Geçmiş Tarihli Rezervasyonlar</div>
          <div class="expired-warning-text">
            <strong>${expiredCount}</strong> adet rezervasyonun giriş tarihi geçmiş ancak işlem yapılmamış. 
            Bu rezervasyonları iptal edebilir veya giriş kaydı oluşturabilirsiniz.
          </div>
        </div>
        <button class="expired-warning-btn" onclick="showExpiredReservationsModal()">
          Görüntüle
        </button>
      </div>
    `;
  }
  
  // Rezervasyon satırlarını oluştur
  let reservationRows = '';
  if (displayReservations.length === 0) {
    reservationRows = `
      <tr>
        <td colspan="8" class="rez-empty">
          ${reservationViewMode === 'today' ? 'Bugün giriş yapacak rezervasyon bulunmamaktadır.' : 'Aktif rezervasyon bulunmamaktadır.'}
        </td>
      </tr>
    `;
  } else {
    reservationRows = displayReservations.map(rez => {
      // Oda bilgisini al
      let odaNo = rez.oda || '-';
      if (rez.oda_id) {
        const room = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [rez.oda_id])[0];
        if (room) odaNo = room.oda_numarasi;
      }
      
      // Giriş tarihi kontrolü
      const girisDate = rez.giris_tarihi ? rez.giris_tarihi.split(' ')[0] : '';
      const isToday = girisDate === today;
      
      // Tarih formatla (sadece tarih, saat yok)
      const formatTarih = (tarih) => {
        if (!tarih) return '-';
        const datePart = tarih.split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
          return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return datePart;
      };
      const girisDisplay = formatTarih(rez.giris_tarihi);
      const cikisDisplay = formatTarih(rez.cikis_tarihi);
      
      // Ücret formatla
      const ucretDisplay = rez.ucret ? `₺${rez.ucret}` : '-';
      
      // Not satırı (eğer not varsa)
      const noteRow = rez.not_alani ? `
        <tr class="rez-note-row ${isToday ? 'rez-row-today' : ''}">
          <td colspan="8" class="rez-td-note-full">
            <div class="rez-note-container">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>${rez.not_alani}</span>
            </div>
          </td>
        </tr>
      ` : '';
      
      return `
        <tr class="rez-main-row ${isToday ? 'rez-row-today' : ''} ${rez.not_alani ? 'has-note' : ''}" data-rez-id="${rez.rezervasyon_id}">
          <td class="rez-td-name">${rez.isim || '-'} ${rez.soyisim || ''}</td>
          <td class="rez-td-phone">${rez.telefon || '-'}</td>
          <td>${odaNo}</td>
          <td>${girisDisplay}</td>
          <td>${cikisDisplay}</td>
          <td class="rez-td-price">${ucretDisplay}</td>
          <td>
            ${isToday ? '<span class="rez-badge-today">Bugün</span>' : '<span class="rez-badge-future">Gelecek</span>'}
          </td>
          <td class="rez-actions">
            ${(reservationViewMode === 'today' && isToday) ? `<button class="rez-btn rez-btn-checkin" data-rez-id="${rez.rezervasyon_id}">Giriş Yap</button>` : ''}
            <button class="rez-btn rez-btn-cancel" data-rez-id="${rez.rezervasyon_id}">İptal</button>
            <button class="rez-btn rez-btn-edit" data-rez-id="${rez.rezervasyon_id}" title="Düzenle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </td>
        </tr>
        ${noteRow}
      `;
    }).join('');
  }
  
  container.innerHTML = `
    <div class="rez-page">
      <div class="rez-header">
        <div class="rez-header-left">
          <h1>Rezervasyon Yönetimi</h1>
          <div class="rez-stats">
            <span class="rez-stat-item">${totalReservations} Toplam</span>
            <span class="rez-stat-divider">•</span>
            <span class="rez-stat-item rez-stat-today">${todayCount} Bugün Giriş</span>
          </div>
        </div>
      </div>
      
      ${expiredWarningHtml}
      
      <div class="rez-controls">
        <div class="rez-view-tabs">
          <button class="rez-view-tab ${reservationViewMode === 'today' ? 'active' : ''}" data-view="today">
            Bugün Giriş Yapacaklar (${todayCount})
          </button>
          <button class="rez-view-tab ${reservationViewMode === 'all' ? 'active' : ''}" data-view="all">
            Tüm Rezervasyonlar (${totalReservations})
          </button>
        </div>
        <button class="rez-btn-new" id="new-reservation-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Yeni Rezervasyon
        </button>
      </div>
      
      <div class="rez-table-container">
        <table class="rez-table">
          <thead>
            <tr>
              <th>Misafir</th>
              <th>Telefon</th>
              <th>Oda</th>
              <th>Giriş Tarihi</th>
              <th>Çıkış Tarihi</th>
              <th>Ücret</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${reservationRows}
          </tbody>
        </table>
      </div>
      
      ${checkedInCount > 0 ? `
      <div class="rez-checked-in-section">
        <div class="rez-checked-in-header">
          <span class="checked-in-title">Bugün Giriş Yapanlar (${checkedInCount})</span>
        </div>
        <table class="rez-table rez-table-passive">
          <thead>
            <tr>
              <th>Misafir</th>
              <th>Telefon</th>
              <th>Oda</th>
              <th>Çıkış Tarihi</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            ${checkedInReservations.map(rez => {
              let odaNo = '-';
              if (rez.oda_id) {
                const room = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [rez.oda_id])[0];
                if (room) odaNo = room.oda_numarasi;
              }
              // Çıkış tarihini formatla (sadece tarih, saat yok)
              let cikisDisplay = '-';
              if (rez.cikis_tarihi) {
                const datePart = rez.cikis_tarihi.split(' ')[0];
                const parts = datePart.split('-');
                if (parts.length === 3) {
                  cikisDisplay = parts[2] + '.' + parts[1] + '.' + parts[0];
                } else {
                  cikisDisplay = datePart;
                }
              }
              return `
                <tr>
                  <td>${rez.isim || '-'} ${rez.soyisim || ''}</td>
                  <td>${rez.telefon || '-'}</td>
                  <td>${odaNo}</td>
                  <td>${cikisDisplay}</td>
                  <td><span class="rez-badge-checked">Giriş Yaptı</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>
  `;
  
  // Event listener'ları ekle
  setupReservationsPageEvents();
}

/**
 * Rezervasyon sayfası event listener'larını ayarlar
 */
function setupReservationsPageEvents() {
  // Görünüm sekmeleri
  document.querySelectorAll('.rez-view-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      reservationViewMode = e.currentTarget.dataset.view;
      renderReservationsPage(document.getElementById('main-content'));
    });
  });
  
  // Yeni rezervasyon butonu
  const newBtn = document.getElementById('new-reservation-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      showNewReservationPage();
    });
  }
  
  // Giriş yap butonları
  document.querySelectorAll('.rez-btn-checkin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rezId = e.currentTarget.dataset.rezId;
      handleReservationCheckIn(rezId);
    });
  });
  
  // İptal butonları
  document.querySelectorAll('.rez-btn-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rezId = e.currentTarget.dataset.rezId;
      handleReservationCancel(rezId);
    });
  });
  
  // Düzenleme butonları
  document.querySelectorAll('.rez-btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rezId = e.currentTarget.dataset.rezId;
      showEditReservationPage(rezId);
    });
  });
  
  // Hover olayları - ana satır ve not satırı birlikte hover olsun
  document.querySelectorAll('.rez-main-row').forEach(mainRow => {
    const noteRow = mainRow.nextElementSibling;
    const isNoteRow = noteRow && noteRow.classList.contains('rez-note-row');
    
    // Ana satıra hover
    mainRow.addEventListener('mouseenter', () => {
      mainRow.classList.add('hover-active');
      if (isNoteRow) noteRow.classList.add('hover-active');
    });
    mainRow.addEventListener('mouseleave', () => {
      mainRow.classList.remove('hover-active');
      if (isNoteRow) noteRow.classList.remove('hover-active');
    });
    
    // Not satırına hover
    if (isNoteRow) {
      noteRow.addEventListener('mouseenter', () => {
        mainRow.classList.add('hover-active');
        noteRow.classList.add('hover-active');
      });
      noteRow.addEventListener('mouseleave', () => {
        mainRow.classList.remove('hover-active');
        noteRow.classList.remove('hover-active');
      });
    }
  });
  
  // Oda panelinden gelinmişse ilgili rezervasyonu highlight et
  if (highlightReservationId) {
    const targetRow = document.querySelector(`.rez-main-row[data-rez-id="${highlightReservationId}"]`);
    if (targetRow) {
      // Sayfayı o satıra kaydır
      setTimeout(() => {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      
      // Yanıp sönme efekti
      targetRow.classList.add('rez-highlight');
      const noteRow = targetRow.nextElementSibling;
      if (noteRow && noteRow.classList.contains('rez-note-row')) {
        noteRow.classList.add('rez-highlight');
      }
      
      // 2.5 saniye sonra efekti kaldır (1 kez 2 saniyelik ışıldama)
      setTimeout(() => {
        targetRow.classList.remove('rez-highlight');
        if (noteRow && noteRow.classList.contains('rez-note-row')) {
          noteRow.classList.remove('rez-highlight');
        }
      }, 2500);
    }
    // ID'yi temizle
    highlightReservationId = null;
  }
}

// Bekleyen rezervasyon giriş bilgisi (misafir kaydı tamamlanınca silinecek)
let pendingReservationCheckIn = null;

/**
 * Rezervasyon giriş işlemi
 */
function handleReservationCheckIn(rezId) {
  const reservations = db.query('SELECT * FROM aktif_rezervasyon WHERE rezervasyon_id = ?', [rezId]);
  
  if (reservations.length === 0) {
    showToast('Rezervasyon bulunamadı', 'error');
    return;
  }
  
  const rez = reservations[0];
  
  // Oda ID'si varsa misafir ekleme sayfasına yönlendir
  if (rez.oda_id) {
    // Önce odanın dolu olup olmadığını kontrol et
    const room = db.query('SELECT * FROM oda WHERE id = ?', [rez.oda_id]);
    if (room.length > 0 && room[0].doluluk_durumu === 'dolu') {
      showToast('Bu odada hala misafir var! Önce mevcut misafirin çıkışını yapın.', 'error');
      return;
    }
    
    // Odanın kirli olup olmadığını kontrol et
    if (room.length > 0 && room[0].temizlik_durumu === 'kirli') {
      showToast('Bu oda kirli! Önce odayı temizleyin.', 'error');
      return;
    }
    
    // Rezervasyonu henüz silme, sadece bekleyen olarak işaretle
    pendingReservationCheckIn = {
      rezId: rezId,
      odaId: rez.oda_id,
      isim: rez.isim,
      soyisim: rez.soyisim,
      girisTarihi: rez.giris_tarihi,
      cikisTarihi: rez.cikis_tarihi,
      telefon: rez.telefon || ''
    };
    
    // Misafir ekleme sayfasına git (rezervasyon bilgileriyle)
    showAddGuestPage(rez.oda_id, pendingReservationCheckIn);
  } else {
    showToast('Bu rezervasyona oda atanmamış!', 'error');
  }
}

/**
 * Geçmiş tarihli rezervasyonlar modalını gösterir
 */
function showExpiredReservationsModal() {
  const expiredReservations = db.getExpiredReservations() || [];
  
  if (expiredReservations.length === 0) {
    showToast('Geçmiş tarihli rezervasyon bulunmamaktadır', 'info');
    return;
  }
  
  // Modal satırlarını oluştur
  const rows = expiredReservations.map(rez => {
    let odaNo = '-';
    if (rez.oda_id) {
      const room = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [rez.oda_id])[0];
      if (room) odaNo = room.oda_numarasi;
    }
    
    const formatTarih = (tarih) => {
      if (!tarih) return '-';
      const datePart = tarih.split(' ')[0];
      const parts = datePart.split('-');
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : datePart;
    };
    
    return `
      <tr class="expired-row">
        <td><strong>${rez.isim || '-'} ${rez.soyisim || ''}</strong></td>
        <td>${rez.telefon || '-'}</td>
        <td>Oda ${odaNo}</td>
        <td>${formatTarih(rez.giris_tarihi)}</td>
        <td>${formatTarih(rez.cikis_tarihi)}</td>
        <td>
          <button class="expired-btn-cancel" data-rez-id="${rez.rezervasyon_id}">İptal Et</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Modal HTML
  const modalHtml = `
    <div class="expired-modal-overlay" id="expired-modal-overlay">
      <div class="expired-modal">
        <div class="expired-modal-header">
          <span class="expired-modal-title">⚠️ Geçmiş Tarihli Rezervasyonlar (${expiredReservations.length})</span>
          <button class="expired-modal-close" onclick="closeExpiredModal()">✕</button>
        </div>
        <div class="expired-modal-body">
          <p class="expired-modal-info">
            Aşağıdaki rezervasyonların giriş tarihi geçmiş ancak giriş işlemi yapılmamıştır. 
            Bu misafirler <strong>gelmedi</strong> ise iptal edebilirsiniz.
          </p>
          <table class="expired-table">
            <thead>
              <tr>
                <th>Misafir</th>
                <th>Telefon</th>
                <th>Oda</th>
                <th>Giriş</th>
                <th>Çıkış</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="expired-modal-footer">
          <button class="expired-btn-all" onclick="cancelAllExpiredReservations()">Tümünü İptal Et</button>
          <button class="expired-btn-close" onclick="closeExpiredModal()">Kapat</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // İptal butonlarına event listener
  document.querySelectorAll('.expired-btn-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleExpiredReservationCancel(e.currentTarget.dataset.rezId);
    });
  });
  
  // Overlay tıklama
  document.getElementById('expired-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'expired-modal-overlay') closeExpiredModal();
  });
}

/**
 * Geçmiş tarihli tek bir rezervasyonu iptal eder
 */
function handleExpiredReservationCancel(rezId) {
  if (confirm('Bu rezervasyonu iptal etmek istediğinize emin misiniz?')) {
    const result = db.cancelReservation(rezId);
    if (result) {
      showToast('Rezervasyon iptal edildi', 'success');
      closeExpiredModal();
      renderReservationsPage(document.getElementById('main-content'));
    } else {
      showToast('İptal işlemi başarısız', 'error');
    }
  }
}

/**
 * Tüm geçmiş tarihli rezervasyonları iptal eder
 */
function cancelAllExpiredReservations() {
  const expiredReservations = db.getExpiredReservations() || [];
  
  if (expiredReservations.length === 0) {
    showToast('İptal edilecek rezervasyon bulunmuyor', 'info');
    return;
  }
  
  if (confirm(`${expiredReservations.length} adet geçmiş tarihli rezervasyonu iptal etmek istediğinize emin misiniz?`)) {
    let successCount = 0;
    let failCount = 0;
    
    expiredReservations.forEach(rez => {
      const result = db.cancelReservation(rez.rezervasyon_id);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
    });
    
    if (successCount > 0) {
      showToast(`${successCount} rezervasyon iptal edildi`, 'success');
    }
    if (failCount > 0) {
      showToast(`${failCount} rezervasyon iptal edilemedi`, 'error');
    }
    
    closeExpiredModal();
    renderReservationsPage(document.getElementById('main-content'));
  }
}

/**
 * Geçmiş tarihli rezervasyonlar modalını kapatır
 */
function closeExpiredModal() {
  const modal = document.getElementById('expired-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

/**
 * Çıkış tarihi geçmiş misafirler modalını gösterir
 */
function showOverdueGuestsModal() {
  const overdueGuests = db.getOverdueGuests() || [];
  
  if (overdueGuests.length === 0) {
    showToast('Çıkış tarihi geçmiş misafir bulunmamaktadır', 'info');
    return;
  }
  
  // Modal satırlarını oluştur
  const rows = overdueGuests.map(guest => {
    const formatTarih = (tarih) => {
      if (!tarih) return '-';
      const datePart = tarih.split(' ')[0];
      const parts = datePart.split('-');
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : datePart;
    };
    
    // Kaç gün geçmiş hesapla
    const today = new Date(db.getTurkeyDate());
    const cikisDate = new Date(guest.cikis_tarihi);
    const diffTime = today - cikisDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return `
      <tr class="overdue-row">
        <td><strong>${guest.isim || '-'} ${guest.soyisim || ''}</strong></td>
        <td>${guest.telefon || '-'}</td>
        <td>Oda ${guest.oda_numarasi || '-'}</td>
        <td>${formatTarih(guest.cikis_tarihi)}</td>
        <td class="overdue-days">${diffDays} gün</td>
        <td class="overdue-actions">
          <button class="overdue-btn-checkout" data-guest-id="${guest.id}">Çıkış Yap</button>
          <button class="overdue-btn-detail" data-room-id="${guest.oda_id}">Oda Detay</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Modal HTML
  const modalHtml = `
    <div class="overdue-modal-overlay" id="overdue-modal-overlay">
      <div class="overdue-modal">
        <div class="overdue-modal-header">
          <h2>Çıkış Tarihi Geçmiş Misafirler</h2>
          <button class="overdue-modal-close" onclick="closeOverdueModal()">&times;</button>
        </div>
        <div class="overdue-modal-info">
          Bu misafirlerin çıkış tarihi geçmiş ancak checkout işlemi yapılmamış.
          Çıkış yapabilir veya kalış süresini uzatabilirsiniz.
        </div>
        <div class="overdue-modal-body">
          <table class="overdue-table">
            <thead>
              <tr>
                <th>Misafir</th>
                <th>Telefon</th>
                <th>Oda</th>
                <th>Çıkış Tarihi</th>
                <th>Gecikme</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="overdue-modal-footer">
          <button class="overdue-btn-all-checkout" onclick="checkoutAllOverdueGuests()">
            Tümünü Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Modal'ı body'ye ekle
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Event listener'ları ekle
  document.querySelectorAll('.overdue-btn-checkout').forEach(btn => {
    btn.addEventListener('click', () => {
      const guestId = btn.dataset.guestId;
      handleOverdueCheckout(guestId);
    });
  });
  
  document.querySelectorAll('.overdue-btn-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const roomId = btn.dataset.roomId;
      closeOverdueModal();
      showRoomDetail(roomId);
    });
  });
  
  // Overlay tıklamasıyla kapatma
  document.getElementById('overdue-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'overdue-modal-overlay') {
      closeOverdueModal();
    }
  });
}

/**
 * Çıkış tarihi geçmiş misafirin çıkış işlemini yapar
 */
function handleOverdueCheckout(guestId) {
  if (confirm('Bu misafirin çıkış işlemini yapmak istediğinize emin misiniz?')) {
    const result = db.checkOutGuest(parseInt(guestId));
    if (result.success) {
      // Oda durumlarını senkronla (güvenlik için)
      db.syncRoomStatus();
      // EGM badge'ini güncelle
      updateEGMBadge();
      showToast('Misafir çıkışı yapıldı', 'success');
      closeOverdueModal();
      renderRoomsPage(document.getElementById('main-content'));
    } else {
      showToast('Çıkış işlemi başarısız', 'error');
    }
  }
}

/**
 * Tüm çıkış tarihi geçmiş misafirlerin çıkışını yapar
 */
function checkoutAllOverdueGuests() {
  const overdueGuests = db.getOverdueGuests() || [];
  
  if (overdueGuests.length === 0) {
    showToast('Çıkış yapılacak misafir bulunmuyor', 'info');
    return;
  }
  
  if (confirm(`${overdueGuests.length} misafirin çıkış işlemini yapmak istediğinize emin misiniz?`)) {
    let successCount = 0;
    let failCount = 0;
    
    overdueGuests.forEach(guest => {
      const result = db.checkOutGuest(guest.id);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    });
    
    // Tüm işlemler bittikten sonra oda durumlarını senkronla
    db.syncRoomStatus();
    // EGM badge'ini güncelle
    updateEGMBadge();
    
    if (successCount > 0) {
      showToast(`${successCount} misafir çıkışı yapıldı`, 'success');
    }
    if (failCount > 0) {
      showToast(`${failCount} çıkış işlemi başarısız`, 'error');
    }
    
    closeOverdueModal();
    renderRoomsPage(document.getElementById('main-content'));
  }
}

/**
 * Çıkış tarihi geçmiş misafirler modalını kapatır
 */
function closeOverdueModal() {
  const modal = document.getElementById('overdue-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

/**
 * Konaklama tarihi düzenleme modalını gösterir
 */
function showDateEditModal(roomId, girisTarihi, cikisTarihi) {
  // Tarih formatlama
  const formatTarihDisplay = (tarih) => {
    if (!tarih) return '-';
    const parts = tarih.split('-');
    if (parts.length !== 3) return tarih;
    const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return `${parts[2]} ${aylar[parseInt(parts[1]) - 1]} ${parts[0]}, ${gunler[date.getDay()]}`;
  };
  
  // Oda bilgisini al
  const rooms = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [parseInt(roomId)]);
  const odaNo = rooms.length > 0 ? rooms[0].oda_numarasi : roomId;
  
  const modalHtml = `
    <div class="date-edit-modal-overlay" id="date-edit-modal-overlay">
      <div class="date-edit-modal">
        <div class="date-edit-modal-header">
          <div class="date-edit-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div class="date-edit-header-text">
            <h2>Konaklama Süresini Düzenle</h2>
            <span class="date-edit-room-badge">Oda ${odaNo}</span>
          </div>
          <button class="date-edit-modal-close" onclick="closeDateEditModal()">&times;</button>
        </div>
        
        <div class="date-edit-modal-body">
          <div class="date-edit-info-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Misafirin konaklama süresini uzatabilir veya kısaltabilirsiniz. Sistem otomatik olarak seçtiğiniz tarih aralığında başka bir rezervasyon olup olmadığını kontrol edecektir.</span>
          </div>
          
          <div class="date-edit-dates-container">
            <div class="date-edit-group date-edit-group-locked">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Giriş Tarihi
              </label>
              <div class="date-edit-value date-edit-disabled">
                <span class="date-edit-date-text">${formatTarihDisplay(girisTarihi)}</span>
                <span class="date-edit-lock" title="Giriş tarihi değiştirilemez">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
              </div>
              <span class="date-edit-hint">Giriş tarihi değiştirilemez</span>
            </div>
            
            <div class="date-edit-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            
            <div class="date-edit-group date-edit-group-active">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Çıkış Tarihi
              </label>
              <input type="text" id="date-edit-cikis" class="date-edit-input" placeholder="Tarih seçin..." readonly>
              <span class="date-edit-hint">Yeni çıkış tarihini seçin</span>
            </div>
          </div>
          
          <div id="date-edit-conflict-msg" class="date-edit-conflict-msg" style="display: none;"></div>
        </div>
        
        <div class="date-edit-modal-footer">
          <button class="date-edit-btn-cancel" onclick="closeDateEditModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            İptal
          </button>
          <button class="date-edit-btn-save" id="date-edit-save-btn" onclick="saveDateEdit('${roomId}', '${girisTarihi}')" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Değişiklikleri Kaydet
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Flatpickr ile tarih seçici
  const cikisInput = document.getElementById('date-edit-cikis');
  flatpickr(cikisInput, {
    locale: Turkish,
    dateFormat: 'Y-m-d',
    defaultDate: cikisTarihi,
    minDate: girisTarihi,
    disableMobile: true,
    onChange: function(selectedDates, dateStr) {
      checkDateConflict(roomId, girisTarihi, dateStr);
    }
  });
  
  // Overlay tıklamasıyla kapatma
  document.getElementById('date-edit-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'date-edit-modal-overlay') {
      closeDateEditModal();
    }
  });
}

/**
 * Tarih çakışması kontrolü
 */
function checkDateConflict(roomId, girisTarihi, yeniCikisTarihi) {
  const conflictMsg = document.getElementById('date-edit-conflict-msg');
  const saveBtn = document.getElementById('date-edit-save-btn');
  
  if (!yeniCikisTarihi) {
    conflictMsg.style.display = 'none';
    saveBtn.disabled = true;
    return;
  }
  
  // Tarih formatlama fonksiyonu
  const formatTarihDetay = (tarih) => {
    if (!tarih) return '-';
    const parts = tarih.split(' ')[0].split('-');
    if (parts.length !== 3) return tarih;
    const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return `${parts[2]} ${aylar[parseInt(parts[1]) - 1]} ${parts[0]}, ${gunler[date.getDay()]}`;
  };
  
  // Gün sayısı hesaplama
  const hesaplaGunSayisi = (baslangic, bitis) => {
    const start = new Date(baslangic);
    const end = new Date(bitis);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  // Yeni çıkış tarihi giriş tarihinden önce olamaz
  if (yeniCikisTarihi <= girisTarihi) {
    conflictMsg.innerHTML = `
      <div class="conflict-icon conflict-icon-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div class="conflict-content">
        <div class="conflict-title">Geçersiz Tarih Seçimi</div>
        <div class="conflict-text">Çıkış tarihi, giriş tarihinden sonra olmalıdır. Lütfen geçerli bir çıkış tarihi seçin.</div>
        <div class="conflict-detail">
          <span>Giriş: <strong>${formatTarihDetay(girisTarihi)}</strong></span>
          <span>Seçilen Çıkış: <strong>${formatTarihDetay(yeniCikisTarihi)}</strong></span>
        </div>
      </div>
    `;
    conflictMsg.className = 'date-edit-conflict-msg date-edit-conflict-error';
    conflictMsg.style.display = 'flex';
    saveBtn.disabled = true;
    return;
  }
  
  // Rezervasyon çakışması kontrolü
  const conflicts = db.checkReservationConflict(parseInt(roomId), girisTarihi, yeniCikisTarihi);
  
  if (conflicts && conflicts.length > 0) {
    const conflict = conflicts[0];
    
    conflictMsg.innerHTML = `
      <div class="conflict-icon conflict-icon-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="conflict-content">
        <div class="conflict-title">Rezervasyon Çakışması Tespit Edildi!</div>
        <div class="conflict-text">Bu oda için seçtiğiniz tarih aralığında mevcut bir rezervasyon bulunmaktadır. Konaklama süresini bu rezervasyonun başlangıç tarihinden önce bitecek şekilde ayarlayın.</div>
        <div class="conflict-reservation">
          <div class="conflict-rez-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <strong>${conflict.isim} ${conflict.soyisim}</strong>
          </div>
          <div class="conflict-rez-dates">
            <span>Giriş: ${formatTarihDetay(conflict.giris_tarihi)}</span>
            <span>Çıkış: ${formatTarihDetay(conflict.cikis_tarihi)}</span>
          </div>
        </div>
      </div>
    `;
    conflictMsg.className = 'date-edit-conflict-msg date-edit-conflict-error';
    conflictMsg.style.display = 'flex';
    saveBtn.disabled = true;
  } else {
    const gunSayisi = hesaplaGunSayisi(girisTarihi, yeniCikisTarihi);
    
    conflictMsg.innerHTML = `
      <div class="conflict-icon conflict-icon-success">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="conflict-content">
        <div class="conflict-title">Tarih Uygun!</div>
        <div class="conflict-text">Seçtiğiniz tarih aralığında bu oda için herhangi bir rezervasyon bulunmamaktadır. Değişikliği güvenle kaydedebilirsiniz.</div>
        <div class="conflict-summary">
          <div class="conflict-summary-item">
            <span class="summary-label">Yeni Çıkış Tarihi</span>
            <span class="summary-value">${formatTarihDetay(yeniCikisTarihi)}</span>
          </div>
          <div class="conflict-summary-item">
            <span class="summary-label">Toplam Konaklama</span>
            <span class="summary-value">${gunSayisi} gece</span>
          </div>
        </div>
      </div>
    `;
    conflictMsg.className = 'date-edit-conflict-msg date-edit-conflict-success';
    conflictMsg.style.display = 'flex';
    saveBtn.disabled = false;
  }
}

/**
 * Tarih değişikliğini kaydet
 */
function saveDateEdit(roomId, girisTarihi) {
  const yeniCikisTarihi = document.getElementById('date-edit-cikis').value;
  
  if (!yeniCikisTarihi) {
    showToast('Çıkış tarihi seçiniz', 'error');
    return;
  }
  
  // Son kontrol - çakışma var mı?
  const conflicts = db.checkReservationConflict(parseInt(roomId), girisTarihi, yeniCikisTarihi);
  
  if (conflicts && conflicts.length > 0) {
    showToast('Bu tarih aralığında rezervasyon var, değişiklik yapılamaz', 'error');
    return;
  }
  
  // Onay al
  const formatTarih = (t) => {
    if (!t) return '-';
    const parts = t.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  };
  
  if (!confirm(`Çıkış tarihi ${formatTarih(yeniCikisTarihi)} olarak güncellenecek. Onaylıyor musunuz?`)) {
    return;
  }
  
  // Tüm misafirlerin çıkış tarihini güncelle
  const result = db.run(
    'UPDATE aktif_kalanlar SET cikis_tarihi = ? WHERE oda_id = ?',
    [yeniCikisTarihi, parseInt(roomId)]
  );
  
  if (result.success) {
    showToast('Çıkış tarihi güncellendi', 'success');
    closeDateEditModal();
    // Oda detay sayfasını yenile
    showRoomDetail(roomId);
  } else {
    showToast('Güncelleme başarısız: ' + (result.error || ''), 'error');
  }
}

/**
 * Tarih düzenleme modalını kapatır
 */
function closeDateEditModal() {
  const modal = document.getElementById('date-edit-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// Taşınacak misafirler için global değişkenler
let selectedGuestsForMove = [];
let moveFromRoomId = null;
let moveGirisTarihi = null;
let moveCikisTarihi = null;

/**
 * Misafir seçim modalını gösterir (Adım 1)
 */
function showGuestSelectModal(roomId, girisTarihi, cikisTarihi) {
  // Odadaki misafirleri al
  const guests = db.getGuestsInRoom(roomId) || [];
  
  if (guests.length === 0) {
    showToast('Bu odada misafir bulunmuyor', 'error');
    return;
  }
  
  // Global değişkenleri ayarla
  moveFromRoomId = roomId;
  moveGirisTarihi = girisTarihi;
  moveCikisTarihi = cikisTarihi;
  selectedGuestsForMove = [];
  
  // Mevcut oda bilgisini al
  const currentRoom = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [parseInt(roomId)])[0];
  const currentRoomNo = currentRoom ? currentRoom.oda_numarasi : roomId;
  
  // Misafir kartlarını oluştur
  let guestCardsHTML = guests.map(g => `
    <div class="guest-select-card" data-guest-id="${g.id}" onclick="toggleGuestSelection(${g.id}, '${g.isim}', '${g.soyisim}')">
      <div class="guest-select-checkbox">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="guest-select-info">
        <div class="guest-select-name">${g.isim} ${g.soyisim}</div>
        <div class="guest-select-detail">${g.tc_no || g.pasaport_no || '-'}</div>
      </div>
    </div>
  `).join('');
  
  const modalHtml = `
    <div class="guest-select-modal-overlay" id="guest-select-modal-overlay">
      <div class="guest-select-modal">
        <div class="guest-select-modal-header">
          <div class="guest-select-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="guest-select-header-text">
            <h2>Taşınacak Misafirleri Seçin</h2>
            <span class="guest-select-room-badge">Oda ${currentRoomNo}</span>
          </div>
          <button class="guest-select-modal-close" onclick="closeGuestSelectModal()">&times;</button>
        </div>
        
        <div class="guest-select-modal-body">
          <div class="guest-select-info-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Başka odaya taşımak istediğiniz misafirleri seçin. Birden fazla misafir seçebilirsiniz.</span>
          </div>
          
          <div class="guest-select-list">
            ${guestCardsHTML}
          </div>
          
          <div id="guest-select-count" class="guest-select-count" style="display: none;">
            <span id="selected-guest-count">0</span> misafir seçildi
          </div>
        </div>
        
        <div class="guest-select-modal-footer">
          <button class="guest-select-btn-cancel" onclick="closeGuestSelectModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            İptal
          </button>
          <button class="guest-select-btn-next" id="guest-select-next-btn" onclick="proceedToRoomSelection()" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"/>
              <path d="M12 5l7 7-7 7"/>
            </svg>
            Devam Et
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Overlay tıklamasıyla kapatma
  document.getElementById('guest-select-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'guest-select-modal-overlay') {
      closeGuestSelectModal();
    }
  });
}

/**
 * Misafir seçimini toggle et
 */
function toggleGuestSelection(guestId, isim, soyisim) {
  const card = document.querySelector(`.guest-select-card[data-guest-id="${guestId}"]`);
  const index = selectedGuestsForMove.findIndex(g => g.id === guestId);
  
  if (index > -1) {
    // Seçimi kaldır
    selectedGuestsForMove.splice(index, 1);
    card.classList.remove('guest-select-selected');
  } else {
    // Seçime ekle
    selectedGuestsForMove.push({ id: guestId, isim, soyisim });
    card.classList.add('guest-select-selected');
  }
  
  // Sayacı güncelle
  const countDiv = document.getElementById('guest-select-count');
  const countSpan = document.getElementById('selected-guest-count');
  const nextBtn = document.getElementById('guest-select-next-btn');
  
  if (selectedGuestsForMove.length > 0) {
    countDiv.style.display = 'flex';
    countSpan.textContent = selectedGuestsForMove.length;
    nextBtn.disabled = false;
  } else {
    countDiv.style.display = 'none';
    nextBtn.disabled = true;
  }
}

/**
 * Oda seçimine geç (Adım 2)
 */
function proceedToRoomSelection() {
  if (selectedGuestsForMove.length === 0) {
    showToast('Lütfen en az bir misafir seçin', 'error');
    return;
  }
  
  // Misafir seçim modalını kapat
  closeGuestSelectModal();
  
  // Oda seçim modalını aç
  showRoomSelectModal();
}

/**
 * Oda seçim modalını gösterir (Adım 2)
 */
function showRoomSelectModal() {
  const guestCount = selectedGuestsForMove.length;
  const guestNames = selectedGuestsForMove.map(g => `${g.isim} ${g.soyisim}`).join(', ');
  
  // Mevcut oda bilgisini al
  const currentRoom = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [parseInt(moveFromRoomId)])[0];
  const currentRoomNo = currentRoom ? currentRoom.oda_numarasi : moveFromRoomId;
  
  // Tüm odaları al
  const allRooms = db.getAllRooms();
  
  // Oda kartlarını oluştur
  let roomCardsHTML = '';
  allRooms.forEach(room => {
    // Mevcut oda seçilemez
    if (room.id === parseInt(moveFromRoomId)) return;
    
    const isDirty = room.temizlik_durumu === 'kirli';
    
    // Odadaki mevcut misafirleri al
    const roomGuests = db.getGuestsInRoom(room.id) || [];
    const currentGuestCount = roomGuests.length;
    const capacity = room.kapasite || 1;
    const remainingCapacity = capacity - currentGuestCount;
    const hasEnoughCapacity = remainingCapacity >= guestCount;
    const hasGuests = currentGuestCount > 0;
    
    // İlk misafirin ismini al
    const firstGuestName = roomGuests.length > 0 ? `${roomGuests[0].isim} ${roomGuests[0].soyisim}` : '';
    
    // Rezervasyon çakışması kontrolü
    let hasConflict = false;
    let conflictInfo = null;
    if (moveGirisTarihi && moveCikisTarihi) {
      const conflicts = db.checkReservationConflict(room.id, moveGirisTarihi, moveCikisTarihi);
      if (conflicts && conflicts.length > 0) {
        hasConflict = true;
        conflictInfo = conflicts[0];
      }
    }
    
    // Devre dışı durumu: yetersiz kapasite, çakışma var veya kirli
    const isDisabled = !hasEnoughCapacity || hasConflict || isDirty;
    
    // Status class belirleme
    let statusClass = '';
    if (isDirty) {
      statusClass = 'room-select-dirty';
    } else if (!hasEnoughCapacity) {
      statusClass = 'room-select-full';
    } else if (hasConflict) {
      statusClass = 'room-select-conflict';
    } else if (hasGuests) {
      statusClass = 'room-select-partial';
    } else {
      statusClass = 'room-select-available';
    }
    
    let statusText = '';
    let statusIcon = '';
    let extraInfo = '';
    
    if (isDirty) {
      statusText = 'Kirli';
      statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
    } else if (!hasEnoughCapacity) {
      statusText = remainingCapacity <= 0 ? 'Dolu' : `${remainingCapacity} yer (yetersiz)`;
      statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      if (hasGuests) extraInfo = `<div class="room-select-guest-name">${firstGuestName}</div>`;
    } else if (hasConflict) {
      statusText = 'Rezerveli';
      statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      extraInfo = `<div class="room-select-conflict-info">${conflictInfo.isim} ${conflictInfo.soyisim}</div>`;
    } else if (hasGuests) {
      statusText = `${remainingCapacity} yer müsait`;
      statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      extraInfo = `<div class="room-select-guest-name">${firstGuestName}</div>`;
    } else {
      statusText = `${capacity} kişilik`;
      statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    }
    
    roomCardsHTML += `
      <div class="room-select-card ${statusClass} ${isDisabled ? 'room-select-disabled' : ''}" 
           data-room-id="${room.id}" 
           data-disabled="${isDisabled}"
           ${!isDisabled ? `onclick="selectMoveRoom(${room.id}, '${room.oda_numarasi}')"` : ''}>
        <div class="room-select-number">${room.oda_numarasi}</div>
        <div class="room-select-type">${room.oda_tipi || ''}</div>
        <div class="room-select-status">
          ${statusIcon}
          <span>${statusText}</span>
        </div>
        ${extraInfo}
      </div>
    `;
  });
  
  const modalHtml = `
    <div class="move-guest-modal-overlay" id="move-guest-modal-overlay">
      <div class="move-guest-modal">
        <div class="move-guest-modal-header">
          <div class="move-guest-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div class="move-guest-header-text">
            <h2>Hedef Oda Seçin</h2>
            <span class="move-guest-name-badge">${guestCount} misafir taşınacak</span>
          </div>
          <button class="move-guest-modal-close" onclick="closeMoveGuestModal()">&times;</button>
        </div>
        
        <div class="move-guest-modal-body">
          <div class="move-guest-current-info">
            <div class="move-guest-info-item">
              <span class="move-info-label">Taşınacak Misafirler</span>
              <span class="move-info-value">${guestNames}</span>
            </div>
            <div class="move-guest-info-item">
              <span class="move-info-label">Mevcut Oda</span>
              <span class="move-info-value move-info-room">Oda ${currentRoomNo}</span>
            </div>
          </div>
          
          <div class="move-guest-target-section">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              ${guestCount > 1 ? `En az ${guestCount} kişilik oda seçin` : 'Hedef oda seçin'}
            </h3>
            <div class="move-guest-room-legend">
              <span class="legend-item legend-available"><span class="legend-dot"></span> Boş</span>
              <span class="legend-item legend-partial"><span class="legend-dot"></span> Yer Var</span>
              <span class="legend-item legend-full"><span class="legend-dot"></span> Yetersiz/Dolu</span>
              <span class="legend-item legend-dirty"><span class="legend-dot"></span> Kirli</span>
              <span class="legend-item legend-conflict"><span class="legend-dot"></span> Rezerveli</span>
            </div>
            <div class="move-guest-rooms-grid">
              ${roomCardsHTML}
            </div>
          </div>
          
          <div id="move-guest-selected-info" class="move-guest-selected-info" style="display: none;">
            <div class="move-selected-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="move-selected-content">
              <div class="move-selected-title">Hedef Oda Seçildi</div>
              <div class="move-selected-text">
                <strong>${guestCount} misafir</strong> Oda ${currentRoomNo}'dan <span id="move-to-room">-</span>'a taşınacak.
              </div>
            </div>
          </div>
        </div>
        
        <div class="move-guest-modal-footer">
          <button class="move-guest-btn-cancel" onclick="closeMoveGuestModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            İptal
          </button>
          <button class="move-guest-btn-save" id="move-guest-save-btn" onclick="confirmMoveGuests()" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"/>
              <path d="M12 5l7 7-7 7"/>
            </svg>
            Taşımayı Onayla
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Overlay tıklamasıyla kapatma
  document.getElementById('move-guest-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'move-guest-modal-overlay') {
      closeMoveGuestModal();
    }
  });
}

// Seçili hedef oda ID'si
let selectedMoveRoomId = null;
let selectedMoveRoomNo = null;

/**
 * Taşıma için oda seçimi
 */
function selectMoveRoom(roomId, roomNo) {
  // Önceki seçimi kaldır
  document.querySelectorAll('.room-select-card').forEach(card => {
    card.classList.remove('room-select-selected');
  });
  
  // Yeni seçimi işaretle
  const selectedCard = document.querySelector(`.room-select-card[data-room-id="${roomId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('room-select-selected');
  }
  
  selectedMoveRoomId = roomId;
  selectedMoveRoomNo = roomNo;
  
  // Seçim bilgisini göster
  const infoSection = document.getElementById('move-guest-selected-info');
  const toRoomSpan = document.getElementById('move-to-room');
  const saveBtn = document.getElementById('move-guest-save-btn');
  
  if (infoSection && toRoomSpan) {
    toRoomSpan.textContent = `Oda ${roomNo}`;
    infoSection.style.display = 'flex';
  }
  
  if (saveBtn) {
    saveBtn.disabled = false;
  }
}

/**
 * Seçili misafirleri taşıma işlemini onayla
 */
function confirmMoveGuests() {
  if (!selectedMoveRoomId) {
    showToast('Lütfen hedef oda seçin', 'error');
    return;
  }
  
  if (selectedGuestsForMove.length === 0) {
    showToast('Taşınacak misafir seçilmedi', 'error');
    return;
  }
  
  const guestCount = selectedGuestsForMove.length;
  const targetRoomId = parseInt(selectedMoveRoomId);
  const targetRoomNo = selectedMoveRoomNo;
  
  // Onay al
  if (!confirm(`${guestCount} misafir Oda ${targetRoomNo}'a taşınacak. Onaylıyor musunuz?`)) {
    return;
  }
  
  // Her misafirin oda_id'sini güncelle
  let successCount = 0;
  selectedGuestsForMove.forEach(guest => {
    const result = db.run('UPDATE aktif_kalanlar SET oda_id = ? WHERE id = ?', [targetRoomId, parseInt(guest.id)]);
    if (result.success) successCount++;
  });
  
  if (successCount > 0) {
    // Tüm oda durumlarını aktif misafirlere göre senkronla
    db.syncRoomStatus();
    
    showToast(`${successCount} misafir Oda ${targetRoomNo}'a taşındı`, 'success');
    
    // Önce modalı kapat
    closeMoveGuestModal();
    
    // Kısa bir gecikme ile sayfayı yenile (veritabanı işlemlerinin tamamlanması için)
    setTimeout(() => {
      showRoomDetail(targetRoomId);
    }, 100);
  } else {
    showToast('Taşıma işlemi başarısız', 'error');
  }
}

/**
 * Misafir seçim modalını kapatır
 */
function closeGuestSelectModal() {
  const modal = document.getElementById('guest-select-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

/**
 * Oda seçim modalını kapatır
 */
function closeMoveGuestModal() {
  const modal = document.getElementById('move-guest-modal-overlay');
  if (modal) {
    modal.remove();
  }
  selectedMoveRoomId = null;
  selectedMoveRoomNo = null;
  selectedGuestsForMove = [];
}

/**
 * Rezervasyon iptal işlemi
 */
function handleReservationCancel(rezId) {
  if (confirm('Bu rezervasyonu iptal etmek istediğinize emin misiniz?')) {
    const result = db.cancelReservation(rezId);
    if (result) {
      showToast('Rezervasyon iptal edildi', 'success');
      renderReservationsPage(document.getElementById('main-content'));
    } else {
      showToast('İptal işlemi başarısız', 'error');
    }
  }
}

/**
 * Yeni rezervasyon sayfasını gösterir
 */
function showNewReservationPage() {
  const mainContent = document.getElementById('main-content');
  const today = db.getTurkeyDate();
  
  // Form açık olarak işaretle
  isNewReservationFormOpen = true;
  
  // Sayfa başlığını belirle
  const pageTitle = isEditMode ? 'Rezervasyonu Düzenle' : 'Yeni Rezervasyon Oluştur';
  
  mainContent.innerHTML = `
    <div class="new-rez-page">
      <div class="new-rez-header">
        <button class="btn-back" id="back-to-reservations">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          Rezervasyonlara Dön
        </button>
        <h1>${pageTitle}</h1>
      </div>
      
      <div class="new-rez-content">
        <!-- Tarih Seçimi -->
        <div class="new-rez-dates-section">
          <h3 class="new-rez-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            1. Tarih Seçimi
          </h3>
          <div class="new-rez-dates-row">
            <div class="new-rez-date-group">
              <label>Giriş Tarihi</label>
              <input type="text" id="rez-giris-tarihi" class="new-rez-date-input" placeholder="Giriş tarihi seçin">
              <span class="new-rez-date-time">Saat: 14:00</span>
            </div>
            <div class="new-rez-date-group">
              <label>Çıkış Tarihi</label>
              <input type="text" id="rez-cikis-tarihi" class="new-rez-date-input" placeholder="Çıkış tarihi seçin">
              <span class="new-rez-date-time">Saat: 12:00</span>
            </div>
            <button class="new-rez-check-btn" id="check-availability-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Müsaitlik Kontrol Et
            </button>
          </div>
        </div>
        
        <!-- Oda Seçimi -->
        <div class="new-rez-rooms-section" id="rooms-selection-section" style="display: none;">
          <h3 class="new-rez-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/>
              <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
              <path d="M12 4v6"/>
              <path d="M2 18h20"/>
            </svg>
            2. Oda Seçimi
          </h3>
          <div class="new-rez-info-bar">
            <p class="new-rez-instruction" id="rez-instruction-text">Lütfen konaklama yapılacak oda veya odaları işaretleyip rezervasyon kaydına devam edin.</p>
            <div class="new-rez-legend">
              <span class="legend-item"><span class="legend-color legend-green"></span> Müsait</span>
              <span class="legend-item"><span class="legend-color legend-yellow"></span> Rezerve</span>
              <span class="legend-item"><span class="legend-color legend-red"></span> Dolu</span>
            </div>
          </div>
          <div class="new-rez-rooms-grid" id="rooms-grid">
            <!-- Odalar buraya yüklenecek -->
          </div>
        </div>
        
        <!-- Rezervasyon Bilgileri -->
        <div class="new-rez-info-section" id="reservation-info-section" style="display: none;">
          <h3 class="new-rez-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            3. Rezervasyon Bilgileri
          </h3>
          <div class="new-rez-selected-room" id="selected-room-info">
            <!-- Seçilen oda bilgisi -->
          </div>
          <form id="reservation-form" class="new-rez-form">
            <div class="form-row">
              <div class="form-group">
                <label>İsim *</label>
                <input type="text" name="isim" required placeholder="Misafir adı">
              </div>
              <div class="form-group">
                <label>Soyisim *</label>
                <input type="text" name="soyisim" required placeholder="Misafir soyadı">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Telefon *</label>
                <input type="text" name="telefon" required placeholder="İletişim numarası">
              </div>
              <div class="form-group">
                <label>Ücret</label>
                <div class="rez-price-input-group">
                  <input type="number" name="ucret" class="rez-price-input" placeholder="0" min="0" step="0.01">
                  <span class="rez-price-currency">₺</span>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group form-group-full">
                <label>Not</label>
                <textarea name="not_alani" class="form-textarea" placeholder="Rezervasyon notu (isteğe bağlı)"></textarea>
              </div>
            </div>
            <div class="new-rez-form-actions">
              <button type="button" class="btn-modern btn-modern-secondary" id="cancel-reservation-btn">İptal</button>
              <button type="submit" class="btn-modern btn-modern-primary" id="save-reservation-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                ${isEditMode ? 'Değişiklikleri Kaydet' : 'Rezervasyonu Kaydet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  // Event listener'ları ekle
  setupNewReservationPageEvents();
  
  // Eğer daha önce rezervasyon formu açıksa durumu restore et
  restoreReservationFormState();
}

/**
 * Rezervasyon form durumunu restore eder
 */
function restoreReservationFormState() {
  if (!isNewReservationFormOpen) return;
  
  // Yeni rezervasyon bölümünü göster
  const newRezSection = document.getElementById('new-reservation-section');
  if (newRezSection) {
    newRezSection.style.display = 'block';
  }
  
  // Tarih inputlarını doldur
  const girisInput = document.getElementById('rez-giris-tarihi');
  const cikisInput = document.getElementById('rez-cikis-tarihi');
  
  if (girisInput && reservationGirisTarihi) {
    girisInput.value = reservationGirisTarihi;
    if (girisInput._flatpickr) {
      girisInput._flatpickr.setDate(reservationGirisTarihi, false);
    }
  }
  
  if (cikisInput && reservationCikisTarihi) {
    cikisInput.value = reservationCikisTarihi;
    if (cikisInput._flatpickr) {
      cikisInput._flatpickr.setDate(reservationCikisTarihi, false);
      cikisInput._flatpickr.set('minDate', reservationGirisTarihi);
    }
  }
  
  // Eğer tarihler seçiliyse oda seçim bölümünü göster
  if (reservationGirisTarihi && reservationCikisTarihi) {
    const roomsSection = document.getElementById('rooms-selection-section');
    if (roomsSection) {
      roomsSection.style.display = 'block';
      // Odaları yükle
      checkRoomAvailability();
    }
  }
  
  // Form verilerini restore et
  const form = document.getElementById('reservation-form');
  if (form) {
    const isimInput = form.querySelector('[name="isim"]');
    const soyisimInput = form.querySelector('[name="soyisim"]');
    const telefonInput = form.querySelector('[name="telefon"]');
    const ucretInput = form.querySelector('[name="ucret"]');
    const notInput = form.querySelector('[name="not_alani"]');
    
    if (isimInput) isimInput.value = reservationFormData.isim || '';
    if (soyisimInput) soyisimInput.value = reservationFormData.soyisim || '';
    if (telefonInput) telefonInput.value = reservationFormData.telefon || '';
    if (ucretInput) ucretInput.value = reservationFormData.ucret || '';
    if (notInput) notInput.value = reservationFormData.not_alani || '';
  }
  
  // Info section'ı seçili oda durumuna göre göster/gizle
  const infoSection = document.getElementById('reservation-info-section');
  if (infoSection) {
    if (selectedReservationRooms.length > 0) {
      infoSection.style.display = 'block';
      updateSelectedRoomsInfo();
    } else {
      infoSection.style.display = 'none';
    }
  }
}

/**
 * Rezervasyon form verilerini sıfırlar
 */
function resetReservationFormState() {
  isNewReservationFormOpen = false;
  selectedReservationRooms = [];
  reservationGirisTarihi = null;
  reservationCikisTarihi = null;
  reservationRoomsLoaded = false;
  selectedRezRoomTypes.clear();
  reservationFormData = {
    isim: '',
    soyisim: '',
    telefon: '',
    ucret: '',
    not_alani: ''
  };
  // Düzenleme modu değişkenlerini sıfırla
  isEditMode = false;
  editingReservationId = null;
  dateChangedInEditMode = false;
  editingOriginalRoomId = null;
  editingOriginalRoomName = null;
  editingOriginalGirisTarihi = null;
  editingOriginalCikisTarihi = null;
}

// Yeni rezervasyon için global değişkenler
let selectedReservationRooms = []; // Birden fazla oda seçimi için array
let reservationGirisTarihi = null;
let reservationCikisTarihi = null;
let isNewReservationFormOpen = false; // Yeni rezervasyon formu açık mı
let reservationFormData = { // Form verileri
  isim: '',
  soyisim: '',
  telefon: '',
  ucret: '',
  not_alani: ''
};
let reservationRoomsLoaded = false; // Odalar yüklendi mi
let selectedRezRoomTypes = new Set(); // Rezervasyon oda tipi filtreleri

// Düzenleme modu için değişkenler
let isEditMode = false; // Düzenleme modunda mı
let editingReservationId = null; // Düzenlenen rezervasyonun ID'si
let dateChangedInEditMode = false; // Düzenleme modunda tarih değişti mi
let editingOriginalRoomId = null; // Düzenlemeden önceki orijinal oda ID'si
let editingOriginalRoomName = null; // Düzenlemeden önceki orijinal oda adı
let editingOriginalGirisTarihi = null; // Düzenlemeden önceki orijinal giriş tarihi
let editingOriginalCikisTarihi = null; // Düzenlemeden önceki orijinal çıkış tarihi

/**
 * Rezervasyon düzenleme sayfasını gösterir
 */
function showEditReservationPage(rezId) {
  // Rezervasyon bilgilerini al
  const reservations = db.query('SELECT * FROM aktif_rezervasyon WHERE rezervasyon_id = ?', [rezId]);
  if (!reservations || reservations.length === 0) {
    showToast('Rezervasyon bulunamadı', 'error');
    return;
  }
  
  const rez = reservations[0];
  
  // Düzenleme modunu aktif et
  isEditMode = true;
  editingReservationId = rezId;
  isNewReservationFormOpen = true;
  
  // Tarihleri ayarla (saat kısmını kaldır)
  reservationGirisTarihi = rez.giris_tarihi ? rez.giris_tarihi.split(' ')[0] : null;
  reservationCikisTarihi = rez.cikis_tarihi ? rez.cikis_tarihi.split(' ')[0] : null;
  
  // Orijinal tarihleri sakla
  editingOriginalGirisTarihi = reservationGirisTarihi;
  editingOriginalCikisTarihi = reservationCikisTarihi;
  
  // Seçili odayı ayarla ve orijinal oda bilgisini sakla
  if (rez.oda_id) {
    selectedReservationRooms = [rez.oda_id];
    editingOriginalRoomId = rez.oda_id;
    // Oda adını al
    const roomInfo = db.query('SELECT oda_numarasi FROM oda WHERE id = ?', [rez.oda_id]);
    editingOriginalRoomName = roomInfo && roomInfo.length > 0 ? roomInfo[0].oda_numarasi : 'Bilinmiyor';
  }
  
  // Form verilerini ayarla
  reservationFormData = {
    isim: rez.isim || '',
    soyisim: rez.soyisim || '',
    telefon: rez.telefon || '',
    ucret: rez.ucret || '',
    not_alani: rez.not_alani || ''
  };
  
  // Sayfayı göster
  showNewReservationPage();
}

/**
 * Yeni rezervasyon sayfası event listener'larını ayarlar
 */
function setupNewReservationPageEvents() {
  // Geri butonu
  const backBtn = document.getElementById('back-to-reservations');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      resetReservationFormState();
      renderReservationsPage(document.getElementById('main-content'));
    });
  }
  
  // Flatpickr tarih seçicileri
  const girisInput = document.getElementById('rez-giris-tarihi');
  const cikisInput = document.getElementById('rez-cikis-tarihi');
  const today = db.getTurkeyDate();
  
  if (girisInput) {
    flatpickr(girisInput, {
      locale: Turkish,
      dateFormat: 'Y-m-d',
      minDate: today,
      disableMobile: true,
      onChange: function(selectedDates, dateStr) {
        reservationGirisTarihi = dateStr;
        // Çıkış tarihinin minimum değerini güncelle
        if (cikisInput._flatpickr) {
          cikisInput._flatpickr.set('minDate', dateStr);
        }
        
        let showInfoSection = false;
        
        // Düzenleme modunda tarih kontrolü yap
        if (isEditMode) {
          // Tarihler orijinal tarihlere eşit mi kontrol et
          const isOriginalDates = reservationGirisTarihi === editingOriginalGirisTarihi && 
                                  reservationCikisTarihi === editingOriginalCikisTarihi;
          
          if (isOriginalDates) {
            // Orijinal tarihlere döndüyse, orijinal odayı seç
            dateChangedInEditMode = false;
            selectedReservationRooms = editingOriginalRoomId ? [editingOriginalRoomId] : [];
            showInfoSection = true;
          } else {
            // Tarihler farklıysa, seçili odayı kaldır ve info bölümünü HEMEN gizle
            dateChangedInEditMode = true;
            selectedReservationRooms = [];
            const infoSection = document.getElementById('reservation-info-section');
            if (infoSection) infoSection.style.display = 'none';
          }
        } else {
          selectedReservationRooms = [];
          const infoSection = document.getElementById('reservation-info-section');
          if (infoSection) infoSection.style.display = 'none';
        }
        
        // Her iki tarih de seçiliyse otomatik müsaitlik kontrolü yap
        if (reservationGirisTarihi && reservationCikisTarihi) {
          checkRoomAvailability();
          
          // Orijinal tarihlere döndüyse info bölümünü göster ve seçili odaları güncelle
          if (showInfoSection && selectedReservationRooms.length > 0) {
            const infoSection = document.getElementById('reservation-info-section');
            if (infoSection) {
              infoSection.style.display = 'block';
              updateSelectedRoomsInfo();
            }
          }
        }
      }
    });
  }
  
  if (cikisInput) {
    flatpickr(cikisInput, {
      locale: Turkish,
      dateFormat: 'Y-m-d',
      minDate: today,
      disableMobile: true,
      onChange: function(selectedDates, dateStr) {
        reservationCikisTarihi = dateStr;
        
        let showInfoSection = false;
        
        // Düzenleme modunda tarih kontrolü yap
        if (isEditMode) {
          // Tarihler orijinal tarihlere eşit mi kontrol et
          const isOriginalDates = reservationGirisTarihi === editingOriginalGirisTarihi && 
                                  reservationCikisTarihi === editingOriginalCikisTarihi;
          
          if (isOriginalDates) {
            // Orijinal tarihlere döndüyse, orijinal odayı seç
            dateChangedInEditMode = false;
            selectedReservationRooms = editingOriginalRoomId ? [editingOriginalRoomId] : [];
            showInfoSection = true;
          } else {
            // Tarihler farklıysa, seçili odayı kaldır ve info bölümünü HEMEN gizle
            dateChangedInEditMode = true;
            selectedReservationRooms = [];
            const infoSection = document.getElementById('reservation-info-section');
            if (infoSection) infoSection.style.display = 'none';
          }
        } else {
          selectedReservationRooms = [];
          const infoSection = document.getElementById('reservation-info-section');
          if (infoSection) infoSection.style.display = 'none';
        }
        
        // Her iki tarih de seçiliyse otomatik müsaitlik kontrolü yap
        if (reservationGirisTarihi && reservationCikisTarihi) {
          checkRoomAvailability();
          
          // Orijinal tarihlere döndüyse info bölümünü göster ve seçili odaları güncelle
          if (showInfoSection && selectedReservationRooms.length > 0) {
            const infoSection = document.getElementById('reservation-info-section');
            if (infoSection) {
              infoSection.style.display = 'block';
              updateSelectedRoomsInfo();
            }
          }
        }
      }
    });
  }
  
  // Müsaitlik kontrol butonu
  const checkBtn = document.getElementById('check-availability-btn');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      checkRoomAvailability();
    });
  }
  
  // İptal butonu
  const cancelBtn = document.getElementById('cancel-reservation-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      resetReservationFormState();
      renderReservationsPage(document.getElementById('main-content'));
    });
  }
  
  // Form gönderimi
  const form = document.getElementById('reservation-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNewReservation();
    });
    
    // Form alanlarını takip et ve kaydet
    const isimInput = form.querySelector('[name="isim"]');
    const soyisimInput = form.querySelector('[name="soyisim"]');
    const telefonInput = form.querySelector('[name="telefon"]');
    const ucretInput = form.querySelector('[name="ucret"]');
    const notInput = form.querySelector('[name="not_alani"]');
    
    if (isimInput) {
      isimInput.addEventListener('input', (e) => {
        reservationFormData.isim = e.target.value;
      });
    }
    if (soyisimInput) {
      soyisimInput.addEventListener('input', (e) => {
        reservationFormData.soyisim = e.target.value;
      });
    }
    if (telefonInput) {
      telefonInput.addEventListener('input', (e) => {
        reservationFormData.telefon = e.target.value;
      });
    }
    if (ucretInput) {
      ucretInput.addEventListener('input', (e) => {
        reservationFormData.ucret = e.target.value;
      });
    }
    if (notInput) {
      notInput.addEventListener('input', (e) => {
        reservationFormData.not_alani = e.target.value;
      });
    }
  }
}

/**
 * Oda müsaitlik kontrolü yapar ve odaları gösterir
 */
function checkRoomAvailability() {
  const girisTarihi = reservationGirisTarihi;
  const cikisTarihi = reservationCikisTarihi;
  
  if (!girisTarihi || !cikisTarihi) {
    showToast('Lütfen giriş ve çıkış tarihlerini seçin', 'error');
    return;
  }
  
  if (new Date(cikisTarihi) <= new Date(girisTarihi)) {
    showToast('Çıkış tarihi giriş tarihinden sonra olmalıdır', 'error');
    return;
  }
  
  // Oda seçim bölümünü göster
  const roomsSection = document.getElementById('rooms-selection-section');
  if (roomsSection) {
    roomsSection.style.display = 'block';
  }
  
  // Talimat metnini güncelle
  const instructionText = document.getElementById('rez-instruction-text');
  if (instructionText) {
    const formatTarih = (d) => {
      const parts = d.split('-');
      return parts[2] + '.' + parts[1] + '.' + parts[0];
    };
    
    // Düzenleme modunda özel mesajlar göster
    if (isEditMode) {
      if (dateChangedInEditMode) {
        // Tarih değiştiyse uyarı mesajı
        instructionText.innerHTML = `<strong style="color: #f59e0b;">⚠️ Tarihler değişti!</strong> Önceki seçili oda: <strong style="color: #6366f1;">Oda ${editingOriginalRoomName}</strong><br><strong>${formatTarih(girisTarihi)}</strong> - <strong>${formatTarih(cikisTarihi)}</strong> tarihleri için müsait odalardan yeniden seçim yapın.`;
      } else {
        // Normal düzenleme modu mesajı
        instructionText.innerHTML = `Düzenlenen rezervasyonun odası: <strong style="color: #6366f1;">Oda ${editingOriginalRoomName}</strong><br><strong>${formatTarih(girisTarihi)}</strong> - <strong>${formatTarih(cikisTarihi)}</strong> tarihleri arasında odayı değiştirmek isterseniz başka bir oda seçebilirsiniz.`;
      }
    } else {
      instructionText.innerHTML = `<strong>${formatTarih(girisTarihi)}</strong> - <strong>${formatTarih(cikisTarihi)}</strong> tarihleri arasında konaklama yapılacak oda veya odaları işaretleyip rezervasyon kaydına devam edin.`;
    }
  }
  
  // Odaları yükle
  loadAvailabilityRooms(girisTarihi, cikisTarihi);
}

/**
 * Müsaitlik durumuna göre odaları yükler
 */
function loadAvailabilityRooms(girisTarihi, cikisTarihi) {
  const roomsGrid = document.getElementById('rooms-grid');
  if (!roomsGrid) return;
  
  const rooms = db.getAllRooms();
  const activeGuests = db.getActiveGuests() || [];
  const activeReservations = db.getActiveReservations() || [];
  
  // Giriş ve çıkış tarihlerini datetime'a çevir (saat ekle)
  const rezGirisDateTime = new Date(girisTarihi + 'T14:00:00');
  const rezCikisDateTime = new Date(cikisTarihi + 'T12:00:00');
  
  // Dolu odaları bul (aktif misafirler) - Map ile misafir bilgisi sakla
  const occupiedRoomInfo = new Map();
  activeGuests.forEach(guest => {
    if (!guest.oda_id) return;
    
    const guestGiris = guest.otele_giris_tarihi ? new Date(guest.otele_giris_tarihi.replace(' ', 'T')) : null;
    let guestCikis = null;
    
    if (guest.cikis_tarihi) {
      const cikisParts = guest.cikis_tarihi.split(' ');
      guestCikis = new Date(cikisParts[0] + 'T' + (cikisParts[1] || '12:00:00'));
    }
    
    // Çakışma kontrolü: misafir_cikis > rez_giris VE misafir_giris < rez_cikis
    let isConflict = false;
    if (guestCikis && guestGiris) {
      if (guestCikis > rezGirisDateTime && guestGiris < rezCikisDateTime) {
        isConflict = true;
      }
    } else if (guestGiris && !guestCikis) {
      // Çıkış tarihi belirsiz, dolu say
      isConflict = true;
    }
    
    if (isConflict && !occupiedRoomInfo.has(guest.oda_id)) {
      // Sadece ilk misafiri kaydet
      occupiedRoomInfo.set(guest.oda_id, {
        isim: guest.isim || '',
        soyisim: guest.soyisim || '',
        cikisTarihi: guest.cikis_tarihi ? guest.cikis_tarihi.split(' ')[0] : '-'
      });
    }
  });
  
  // Rezervasyonlu odaları bul - Map ile rezervasyon bilgisi sakla
  const reservedRoomInfo = new Map();
  activeReservations.forEach(rez => {
    if (!rez.oda_id) return;
    
    // Düzenleme modunda kendi rezervasyonumuzu atla (böylece seçilebilir olur)
    if (isEditMode && editingReservationId && rez.rezervasyon_id == editingReservationId) {
      return;
    }
    
    let rezGiris = null;
    let rezCikis = null;
    
    if (rez.giris_tarihi) {
      const girisParts = rez.giris_tarihi.split(' ');
      rezGiris = new Date(girisParts[0] + 'T' + (girisParts[1] || '14:00:00'));
    }
    
    if (rez.cikis_tarihi) {
      const cikisParts = rez.cikis_tarihi.split(' ');
      rezCikis = new Date(cikisParts[0] + 'T' + (cikisParts[1] || '12:00:00'));
    }
    
    // Çakışma kontrolü
    if (rezGiris && rezCikis) {
      if (rezCikis > rezGirisDateTime && rezGiris < rezCikisDateTime) {
        if (!reservedRoomInfo.has(rez.oda_id)) {
          // Tarih formatı: gün.ay.yıl
          const girisDate = rez.giris_tarihi.split(' ')[0];
          const cikisDate = rez.cikis_tarihi.split(' ')[0];
          const formatDate = (d) => {
            const parts = d.split('-');
            return parts[2] + '.' + parts[1] + '.' + parts[0];
          };
          reservedRoomInfo.set(rez.oda_id, {
            isim: rez.isim || '',
            soyisim: rez.soyisim || '',
            girisTarihi: formatDate(girisDate),
            cikisTarihi: formatDate(cikisDate)
          });
        }
      }
    }
  });
  
  // Odaları kata göre grupla ve render et
  const roomsByFloor = {};
  rooms.forEach(room => {
    const roomNum = room.oda_numarasi.toString();
    const floor = isNaN(parseInt(roomNum.charAt(0))) ? '1' : roomNum.charAt(0);
    
    if (!roomsByFloor[floor]) {
      roomsByFloor[floor] = [];
    }
    roomsByFloor[floor].push(room);
  });
  
  // Her katı sırala
  Object.keys(roomsByFloor).forEach(floor => {
    roomsByFloor[floor].sort((a, b) => {
      const numA = parseInt(a.oda_numarasi) || 9999;
      const numB = parseInt(b.oda_numarasi) || 9999;
      return numA - numB;
    });
  });
  
  // Oda tiplerini al
  const roomTypes = db.getRoomTypes() || [];
  const roomTypeButtons = roomTypes.map(type => 
    `<button class="rez-type-btn ${selectedRezRoomTypes.has(type.oda_tipi) ? 'active' : ''}" data-type="${type.oda_tipi}">${type.oda_tipi}</button>`
  ).join('');
  
  // HTML oluştur
  const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b));
  
  // Filtre bölümü
  let filterHtml = `
    <div class="rez-room-filters">
      <span class="rez-filter-label">Oda Tipi Filtrele:</span>
      <div class="rez-type-filters">
        ${roomTypeButtons}
      </div>
    </div>
  `;
  
  let html = filterHtml + sortedFloors.map(floor => {
    const floorRooms = roomsByFloor[floor].map(room => {
      const occupiedInfo = occupiedRoomInfo.get(room.id);
      const reservedInfo = reservedRoomInfo.get(room.id);
      
      let statusClass = 'room-available';
      let statusText = 'Müsait';
      let isSelectable = true;
      let infoHtml = '';
      
      if (occupiedInfo) {
        statusClass = 'room-occupied-rez';
        statusText = 'Dolu';
        isSelectable = false;
        const guestName = `${occupiedInfo.isim} ${occupiedInfo.soyisim}`.trim() || 'Misafir';
        infoHtml = `
          <div class="rez-room-info">
            <div class="rez-room-guest-name">${guestName}</div>
          </div>
        `;
      } else if (reservedInfo) {
        statusClass = 'room-reserved';
        statusText = 'Rezerve';
        isSelectable = false;
        const guestName = `${reservedInfo.isim} ${reservedInfo.soyisim}`.trim() || 'Rezervasyon';
        infoHtml = `
          <div class="rez-room-info">
            <div class="rez-room-guest-name">${guestName}</div>
            <div class="rez-room-dates">${reservedInfo.girisTarihi} - ${reservedInfo.cikisTarihi}</div>
          </div>
        `;
      }
      
      // Eğer bu oda seçili ise (düzenleme modunda veya yeni seçim)
      const isSelected = selectedReservationRooms.includes(room.id);
      if (isSelected) {
        statusClass = 'room-available selected';
        statusText = 'Seçili';
        isSelectable = true;
      }
      
      return `
        <div class="rez-room-card ${statusClass} ${isSelectable ? 'selectable' : ''}" 
             data-room-id="${room.id}" 
             data-selectable="${isSelectable}"
             data-room-type="${room.oda_tipi || ''}">
          <div class="rez-room-header">
            <div class="rez-room-number">${room.oda_numarasi}</div>
            <div class="rez-room-status-badge">${statusText}</div>
          </div>
          <div class="rez-room-details">
            <div class="rez-room-type">${room.oda_tipi || '-'}</div>
            <div class="rez-room-capacity">${room.kapasite} Kişi</div>
          </div>
          ${infoHtml}
        </div>
      `;
    }).join('');
    
    return `
      <div class="rez-floor-section">
        <div class="rez-floor-label">${floor}. Kat</div>
        <div class="rez-floor-rooms">${floorRooms}</div>
      </div>
    `;
  }).join('');
  
  roomsGrid.innerHTML = html;
  
  // Oda seçim event listener'ları
  document.querySelectorAll('.rez-room-card.selectable').forEach(card => {
    card.addEventListener('click', () => {
      const roomId = parseInt(card.dataset.roomId);
      selectReservationRoom(roomId);
    });
  });
  
  // Oda tipi filtre event listener'ları
  document.querySelectorAll('.rez-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      
      if (selectedRezRoomTypes.has(type)) {
        selectedRezRoomTypes.delete(type);
        btn.classList.remove('active');
      } else {
        selectedRezRoomTypes.add(type);
        btn.classList.add('active');
      }
      
      applyRezRoomTypeFilter();
    });
  });
  
  // Mevcut filtreyi uygula
  applyRezRoomTypeFilter();
}

/**
 * Rezervasyon oda tipi filtresini uygular
 */
function applyRezRoomTypeFilter() {
  const allCards = document.querySelectorAll('.rez-room-card');
  
  allCards.forEach(card => {
    const roomType = card.dataset.roomType;
    const typeMatch = selectedRezRoomTypes.size === 0 || selectedRezRoomTypes.has(roomType);
    card.style.display = typeMatch ? '' : 'none';
  });
}

/**
 * Rezervasyon için oda seçer (toggle - birden fazla seçim veya düzenleme modunda tek seçim)
 */
function selectReservationRoom(roomId) {
  const selectedCard = document.querySelector(`.rez-room-card[data-room-id="${roomId}"]`);
  const statusBadge = selectedCard ? selectedCard.querySelector('.rez-room-status-badge') : null;
  
  // Toggle selection
  const index = selectedReservationRooms.indexOf(roomId);
  if (index > -1) {
    // Zaten seçili, kaldır
    selectedReservationRooms.splice(index, 1);
    if (selectedCard) selectedCard.classList.remove('selected');
    if (statusBadge) statusBadge.textContent = 'Müsait';
  } else {
    // Düzenleme modunda sadece tek oda seçilebilir
    if (isEditMode) {
      // Önceki seçimi kaldır
      selectedReservationRooms.forEach(prevRoomId => {
        const prevCard = document.querySelector(`.rez-room-card[data-room-id="${prevRoomId}"]`);
        if (prevCard) {
          prevCard.classList.remove('selected');
          const prevBadge = prevCard.querySelector('.rez-room-status-badge');
          if (prevBadge) prevBadge.textContent = 'Müsait';
        }
      });
      selectedReservationRooms = [];
    }
    
    // Seçili değil, ekle
    selectedReservationRooms.push(roomId);
    if (selectedCard) selectedCard.classList.add('selected');
    if (statusBadge) statusBadge.textContent = 'Seçili';
  }
  
  // Rezervasyon bilgileri bölümünü göster/gizle
  const infoSection = document.getElementById('reservation-info-section');
  if (infoSection) {
    infoSection.style.display = selectedReservationRooms.length > 0 ? 'block' : 'none';
  }
  
  // Seçilen odaların bilgisini göster
  updateSelectedRoomsInfo();
}

/**
 * Seçilen odaların bilgisini günceller
 */
function updateSelectedRoomsInfo() {
  const selectedRoomInfo = document.getElementById('selected-room-info');
  if (!selectedRoomInfo) return;
  
  if (selectedReservationRooms.length === 0) {
    selectedRoomInfo.innerHTML = '';
    return;
  }
  
  const allRooms = db.getAllRooms();
  const selectedRoomsData = selectedReservationRooms.map(id => allRooms.find(r => r.id === id)).filter(Boolean);
  
  const roomCards = selectedRoomsData.map(room => `
    <div class="selected-room-card">
      <div class="selected-room-info-block">
        <div class="selected-room-number">Oda ${room.oda_numarasi}</div>
        <div class="selected-room-meta">
          <span class="selected-room-type">${room.oda_tipi || '-'}</span>
          <span class="selected-room-capacity">${room.kapasite} Kişilik</span>
        </div>
      </div>
      <button type="button" class="selected-room-remove" data-room-id="${room.id}" title="Seçimi Kaldır">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  selectedRoomInfo.innerHTML = `
    <div class="selected-rooms-header">
      <span class="selected-rooms-count">${selectedReservationRooms.length} oda seçildi</span>
      <span class="selected-rooms-dates">${reservationGirisTarihi} → ${reservationCikisTarihi}</span>
    </div>
    <div class="selected-rooms-list">
      ${roomCards}
    </div>
  `;
  
  // Seçim kaldırma butonlarına event listener ekle
  document.querySelectorAll('.selected-room-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const roomId = parseInt(btn.dataset.roomId);
      selectReservationRoom(roomId); // Toggle ile kaldır
    });
  });
}

/**
 * Yeni rezervasyonu kaydeder veya düzenler (birden fazla oda için ayrı ayrı)
 */
function saveNewReservation() {
  if (selectedReservationRooms.length === 0) {
    showToast('Lütfen en az bir oda seçin', 'error');
    return;
  }
  
  if (!reservationGirisTarihi || !reservationCikisTarihi) {
    showToast('Lütfen tarih bilgilerini girin', 'error');
    return;
  }
  
  const form = document.getElementById('reservation-form');
  const isim = form.querySelector('[name="isim"]').value.trim();
  const soyisim = form.querySelector('[name="soyisim"]').value.trim();
  const telefon = form.querySelector('[name="telefon"]').value.trim();
  const ucret = form.querySelector('[name="ucret"]').value.trim();
  const notAlani = form.querySelector('[name="not_alani"]').value.trim();
  
  if (!isim || !soyisim) {
    showToast('İsim ve soyisim zorunludur', 'error');
    return;
  }
  
  if (!telefon) {
    showToast('Telefon numarası zorunludur', 'error');
    return;
  }
  
  // Tarih formatını düzenle (saat ekle)
  const girisTarihiFormatted = reservationGirisTarihi + ' 14:00:00';
  const cikisTarihiFormatted = reservationCikisTarihi + ' 12:00:00';
  
  // Düzenleme modunda ise UPDATE yap
  if (isEditMode && editingReservationId) {
    const roomId = selectedReservationRooms[0]; // Düzenleme modunda sadece 1 oda olur
    const result = db.run(
      `UPDATE aktif_rezervasyon 
       SET giris_tarihi = ?, cikis_tarihi = ?, isim = ?, soyisim = ?, not_alani = ?, oda_id = ?, telefon = ?, ucret = ?
       WHERE rezervasyon_id = ?`,
      [girisTarihiFormatted, cikisTarihiFormatted, isim, soyisim, notAlani || null, roomId, telefon, ucret || null, editingReservationId]
    );
    
    if (result.success) {
      showToast('Rezervasyon başarıyla güncellendi', 'success');
      highlightReservationId = editingReservationId;
      resetReservationFormState();
      renderReservationsPage(document.getElementById('main-content'));
    } else {
      showToast('Rezervasyon güncellenemedi', 'error');
    }
    return;
  }
  
  // Yeni rezervasyon modu - her seçilen oda için ayrı rezervasyon kaydı oluştur
  let successCount = 0;
  let errorCount = 0;
  let lastInsertedId = null;
  
  selectedReservationRooms.forEach(roomId => {
    const result = db.run(
      `INSERT INTO aktif_rezervasyon (giris_tarihi, cikis_tarihi, isim, soyisim, not_alani, oda_id, telefon, ucret)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [girisTarihiFormatted, cikisTarihiFormatted, isim, soyisim, notAlani || null, roomId, telefon, ucret || null]
    );
    
    if (result.success) {
      successCount++;
      // Son eklenen rezervasyonun ID'sini al
      const lastId = db.query('SELECT last_insert_rowid() as id')[0];
      if (lastId) lastInsertedId = lastId.id;
    } else {
      errorCount++;
    }
  });
  
  if (successCount > 0) {
    if (successCount === 1) {
      showToast('Rezervasyon başarıyla kaydedildi', 'success');
    } else {
      showToast(`${successCount} oda için rezervasyon başarıyla kaydedildi`, 'success');
    }
    
    // Yeni eklenen rezervasyonu highlight et
    if (lastInsertedId) {
      highlightReservationId = lastInsertedId;
    }
    
    // Form durumunu sıfırla
    resetReservationFormState();
    
    renderReservationsPage(document.getElementById('main-content'));
  } else {
    showToast('Rezervasyon kaydedilemedi', 'error');
  }
}

/**
 * Misafir belgesi oluşturur ve yazdırma penceresi açar
 */
function generateGuestDocument(roomId) {
  const rooms = db.getAllRooms();
  const room = rooms.find(r => r.id == roomId);
  if (!room) return;
  
  const guests = db.getGuestsInRoom(roomId);
  if (guests.length === 0) {
    showToast('Bu odada misafir bulunmamaktadır', 'error');
    return;
  }
  
  const firstGuest = guests[0];
  const today = new Date();
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  // Giriş ve çıkış tarihlerini formatla
  const girisTarihi = firstGuest.otele_giris_tarihi ? formatDate(firstGuest.otele_giris_tarihi.split(' ')[0]) : '-';
  const cikisTarihi = firstGuest.cikis_tarihi ? formatDate(firstGuest.cikis_tarihi.split(' ')[0]) : '-';
  
  // Ücret bilgisi
  const guestWithPrice = guests.find(g => g.ucret !== null && g.ucret !== undefined && g.ucret !== '');
  const ucret = guestWithPrice?.ucret ? `${guestWithPrice.ucret.toLocaleString('tr-TR')} ₺` : '-';
  
  // Misafir bilgileri HTML - kompakt
  let guestInfoHTML = guests.map((g, index) => `
    <div class="guest-box">
      <strong>Misafir ${index + 1}:</strong> ${g.isim} ${g.soyisim} | 
      TC/Pasaport: ${g.tc_no || g.pasaport_no || '-'} | 
      Tel: ${g.telefon || '-'} | 
      Uyruk: ${g.uyruk || 'Türkiye'}
    </div>
  `).join('');
  
  // Belge HTML'i - A4 siyah beyaz kompakt
  const documentHTML = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Konaklama Belgesi - Oda ${room.oda_numarasi}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #000;
          line-height: 1.4;
          font-size: 11px;
        }
        
        .document {
          max-width: 100%;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
          margin-bottom: 15px;
        }
        
        .hotel-name {
          font-size: 22px;
          font-weight: 700;
          color: #000;
          margin-bottom: 3px;
        }
        
        .hotel-address {
          font-size: 10px;
          color: #333;
        }
        
        .document-title {
          font-size: 14px;
          font-weight: 600;
          margin-top: 10px;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .section {
          border: 1px solid #000;
          padding: 10px;
          margin-bottom: 12px;
        }
        
        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: #000;
          margin-bottom: 8px;
          text-transform: uppercase;
          border-bottom: 1px solid #ccc;
          padding-bottom: 4px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
        }
        
        .info-label {
          font-size: 9px;
          color: #555;
          text-transform: uppercase;
        }
        
        .info-value {
          font-size: 12px;
          font-weight: 600;
          color: #000;
        }
        
        .guest-box {
          padding: 6px 0;
          border-bottom: 1px dotted #ccc;
          font-size: 10px;
        }
        
        .guest-box:last-child {
          border-bottom: none;
        }
        
        .rules-list {
          list-style: none;
          columns: 2;
          column-gap: 20px;
        }
        
        .rules-list li {
          font-size: 9px;
          color: #000;
          padding: 3px 0;
          padding-left: 12px;
          position: relative;
        }
        
        .rules-list li:before {
          content: "•";
          position: absolute;
          left: 0;
        }
        
        .declaration {
          font-size: 10px;
          color: #000;
          margin: 15px 0;
          text-align: justify;
        }
        
        .signature-section {
          margin-top: 20px;
          display: flex;
          justify-content: flex-start;
        }
        
        .signature-box {
          width: 200px;
        }
        
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 40px;
          padding-top: 5px;
        }
        
        .signature-label {
          font-size: 9px;
          color: #000;
          text-transform: uppercase;
        }
        
        .footer {
          margin-top: 15px;
          text-align: center;
          font-size: 8px;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 8px;
        }
        
        @media print {
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="document">
        <div class="header">
          <div class="hotel-name">EGE PALAS HOTEL</div>
          <div class="hotel-address">Pulur Mahallesi Ahi Emir Caddesi No:1 Sivas Merkez • Tel: 0 346 225 05 45</div>
          <div class="document-title">Konaklama Kayıt Belgesi</div>
        </div>
        
        <div class="section">
          <div class="section-title">Konaklama Bilgileri</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Oda No</span>
              <span class="info-value">${room.oda_numarasi}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Giriş Tarihi</span>
              <span class="info-value">${girisTarihi}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Çıkış Tarihi</span>
              <span class="info-value">${cikisTarihi}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Toplam Ücret</span>
              <span class="info-value">${ucret}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Oda Tipi</span>
              <span class="info-value">${room.oda_tipi || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Kişi Sayısı</span>
              <span class="info-value">${guests.length}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Belge Tarihi</span>
              <span class="info-value">${formatDate(today)}</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Misafir Bilgileri</div>
          ${guestInfoHTML}
        </div>
        
        <div class="section">
          <div class="section-title">Otel Kuralları</div>
          <ul class="rules-list">
            <li>Giriş saati 14:00, çıkış saati 12:00'dir.</li>
            <li>Odalarda sigara içilmesi yasaktır.</li>
            <li>Otel eşyalarına verilen zararlardan misafir sorumludur.</li>
            <li>Değerli eşyalarınızı resepsiyonda muhafaza edebilirsiniz.</li>
            <li>Misafirler genel ahlak kurallarına uymakla yükümlüdür.</li>
            <li>Evcil hayvan kabul edilmemektedir.</li>
            <li>Oda anahtarı kaybında ücret talep edilir.</li>
            <li>Acil durumlarda resepsiyonu arayınız.</li>
          </ul>
        </div>
        
        <p class="declaration">
          Yukarıda belirtilen bilgilerin doğruluğunu ve otel kurallarını okuduğumu, anladığımı ve kabul ettiğimi beyan ederim.
        </p>
        
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">
              <div class="signature-label">Misafir İmzası</div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          Bu belge ${formatDate(today)} tarihinde Ege Palas Hotel tarafından düzenlenmiştir.
        </div>
      </div>
    </body>
    </html>
  `;
  
  // A4 boyutunda pencere aç (tam ekran değil)
  const width = 650;
  const height = 900;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;
  
  const printWindow = window.open('', 'Konaklama Belgesi', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  printWindow.document.write(documentHTML);
  printWindow.document.close();
  
  // Sayfa yüklendikten sonra yazdırma diyaloğunu aç
  printWindow.onload = function() {
    printWindow.print();
  };
}

// Global değişkenler ve fonksiyonlar
window.EgePalasOYS = {
  version: '1.0.0',
  db,
  DateUtils,
  showNotification
};

