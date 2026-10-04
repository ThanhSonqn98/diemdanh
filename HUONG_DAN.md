# Hướng Dẫn Cài Đặt - Hệ Thống Điểm Danh QR

## Bước 1: Tạo Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → Nhập tên project (VD: `diem-danh-truong`)
3. Tắt Google Analytics (không cần) → Click **"Create project"**

## Bước 2: Bật Authentication

1. Trong Firebase Console → **Authentication** → **Sign-in method**
2. Click **"Google"** → Bật **Enable** → Chọn email hỗ trợ → **Save**

## Bước 3: Tạo Firestore Database

1. **Firestore Database** → **"Create database"**
2. Chọn **"Start in production mode"** → Chọn vùng (asia-southeast1 - Singapore) → **Enable**
3. Vào tab **"Rules"** → Thay toàn bộ nội dung bằng:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Members: admin đọc/ghi, user đọc để verify
    match /members/{memberId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email in
        ['ADMIN_EMAIL_1@gmail.com', 'ADMIN_EMAIL_2@gmail.com'];
    }
    // Meetings: admin tạo, user đọc để điểm danh
    match /meetings/{meetingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email in
        ['ADMIN_EMAIL_1@gmail.com', 'ADMIN_EMAIL_2@gmail.com'];
    }
    // Attendances: user tạo (điểm danh), admin đọc tất cả
    match /attendances/{attendanceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.token.email in
        ['ADMIN_EMAIL_1@gmail.com', 'ADMIN_EMAIL_2@gmail.com'];
    }
  }
}
```

> ⚠️ **Thay `ADMIN_EMAIL_1@gmail.com`** bằng email admin thực của bạn!

4. Click **"Publish"**

## Bước 4: Lấy Firebase Config

1. **Project Settings** (⚙️ icon) → **"Your apps"**
2. Click icon **"</>"** (Web app) → Đặt tên app → **Register app**
3. Copy đoạn config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Bước 5: Cập nhật file `firebase-init.js`

Mở file `firebase-init.js` và thay đoạn config:

```javascript
const firebaseConfig = {
  apiKey: "THAY_BẰNG_API_KEY_THỰC",
  authDomain: "THAY_BẰNG_AUTH_DOMAIN",
  ...
};
```

## Bước 6: Cập nhật Admin Emails

Mở file `admin.js`, tìm dòng:
```javascript
const ADMIN_EMAILS = ['admin@gmail.com'];
```
Thay bằng email thực của admin.

## Bước 7: Bật Authorized Domains

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Thêm domain của bạn (nếu host lên web)
3. `localhost` đã được thêm sẵn để test local

## Bước 8: Host lên web (tùy chọn)

### Option A: Firebase Hosting (miễn phí)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Option B: GitHub Pages (miễn phí)
- Push code lên GitHub
- Settings → Pages → Source: main branch

### Option C: Test local
Dùng VS Code + extension **"Live Server"** → Click "Go Live"

---

## Cấu trúc Files

```
diemdanh/
├── admin.html      ← Trang quản lý (admin)
├── admin.js        ← Logic admin
├── attend.html     ← Trang điểm danh (thành viên quét QR)
├── attend.js       ← Logic điểm danh
├── firebase-init.js ← Firebase config (⚠️ CẦN ĐIỀN THÔNG TIN)
├── style.css       ← Giao diện
└── HUONG_DAN.md    ← File này
```

## Luồng sử dụng

```
Admin tạo QR → Gửi vào nhóm chat
        ↓
Thành viên quét QR bằng điện thoại
        ↓
Đăng nhập Google (lấy email tự động)
        ↓
Điền tên + chọn tổ + trạng thái
        ↓
Bấm "Điểm Danh" → Lưu Firebase
        ↓
Admin xem kết quả real-time trên Dashboard
```

## Cơ chế Phát hiện Gian lận

| Trường hợp | Hệ thống xử lý |
|---|---|
| Email Google ≠ Email đăng ký | Đánh dấu fraud, ghi log |
| Tên khai báo ≠ Tên đăng ký | Đánh dấu fraud |
| Tổ khai báo ≠ Tổ đăng ký | Đánh dấu fraud |
| QR hết hạn | Không cho điểm danh |
| 1 email điểm danh 2 lần | Không cho điểm danh lần 2 |

---

> 💡 **Mẹo:** Khi gửi QR vào nhóm, nên ghi rõ thời gian hết hạn để mọi người biết deadline điểm danh.
