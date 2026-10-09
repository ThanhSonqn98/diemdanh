// ============================================================
// FIREBASE INITIALIZATION - Dùng chung cho tất cả trang
// ============================================================

// ⚠️ QUAN TRỌNG: Điền thông tin Firebase của bạn vào đây
// Lấy từ: Firebase Console > Project Settings > Your apps > Firebase SDK snippet
const firebaseConfig = {
  apiKey: "AIzaSyA5YKj6haHOZkTxQ7qnPm8K9BEINnj2obU",
  authDomain: "diem-danh-truc-tuyen.firebaseapp.com",
  projectId: "diem-danh-truc-tuyen",
  storageBucket: "diem-danh-truc-tuyen.firebasestorage.app",
  messagingSenderId: "731367322288",
  appId: "1:731367322288:web:38bbf1c980f14ab2f80175"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);

// Export các services để các file khác dùng
const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Hàm tiện ích chung
const GROUP_NAMES = {
  bgh: 'BGH',
  to123: 'Tổ 1-2-3',
  to45: 'Tổ 4-5',
  tobomon: 'Tổ Bộ Môn',
  tovanphong: 'Tổ Văn Phòng'
};

function formatDateTime(ts) {
  if (!ts) return '--';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDate(ts) {
  if (!ts) return '--';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('vi-VN');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    padding: 14px 20px; border-radius: 10px; color: white;
    font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
    transform: translateX(120%); transition: transform 0.3s ease;
    max-width: 300px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.style.transform = 'translateX(0)', 100);
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
