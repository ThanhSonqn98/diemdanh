// ============================================================
// ATTEND.JS - Logic trang điểm danh cho thành viên
// ============================================================

// Lấy params từ URL
const urlParams = new URLSearchParams(window.location.search);
const meetingId = urlParams.get('m');
const token = urlParams.get('t');

let meetingData = null;
let userEmail = null;
let userName = null;

// ---- Hiển thị màn hình ----
function showScreen(screenId) {
  const screens = ['screen-loading', 'screen-not-started', 'screen-expired', 'screen-invalid',
    'screen-already', 'screen-login', 'screen-form', 'screen-success', 'screen-fraud'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.remove('hidden');
}

// ---- Validate QR & Load meeting ----
function initPage() {
  showScreen('screen-loading');

  if (!meetingId || !token) {
    showScreen('screen-invalid');
    return;
  }

  // Lắng nghe trạng thái đăng nhập Firebase
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      userEmail = user.email.toLowerCase();
      userName = user.displayName || '';
      await processMeetingForUser();
    } else {
      userEmail = null;
      userName = null;
      // Người dùng chưa đăng nhập: Thử đọc thông tin cuộc họp (nếu Firestore cho phép đọc công khai)
      try {
        const snap = await db.collection('meetings').doc(meetingId).get();
        if (!snap.exists) {
          showScreen('screen-invalid');
          return;
        }

        meetingData = { id: snap.id, ...snap.data() };

        if (meetingData.token !== token) {
          showScreen('screen-invalid');
          return;
        }

        // Check thời gian mở và hết hạn điểm danh
        const now = new Date();
        const startTime = meetingData.startTime?.toDate ? meetingData.startTime.toDate() : new Date(meetingData.startTime);
        const endTime = meetingData.endTime?.toDate ? meetingData.endTime.toDate() : new Date(meetingData.endTime);

        if (now < startTime) {
          const timeEl = document.getElementById('not-started-time');
          if (timeEl) timeEl.textContent = startTime.toLocaleString('vi-VN');
          showScreen('screen-not-started');
          return;
        }

        if (now > endTime) {
          showScreen('screen-expired');
          return;
        }

        document.getElementById('login-meeting-name').textContent = meetingData.name;
      } catch (err) {
        console.warn('Chưa đọc được cuộc họp trước khi đăng nhập (yêu cầu đăng nhập trước):', err);
        document.getElementById('login-meeting-name').textContent = 'Cuộc họp điểm danh';
      }
      showScreen('screen-login');
    }
  });
}

// Xử lý sau khi người dùng đã đăng nhập Google
async function processMeetingForUser() {
  showScreen('screen-loading');
  try {
    const snap = await db.collection('meetings').doc(meetingId).get();
    if (!snap.exists) {
      showScreen('screen-invalid');
      return;
    }

    meetingData = { id: snap.id, ...snap.data() };

    // Validate token
    if (meetingData.token !== token) {
      showScreen('screen-invalid');
      return;
    }

    // Check thời gian mở và hết hạn điểm danh
    const now = new Date();
    const startTime = meetingData.startTime?.toDate ? meetingData.startTime.toDate() : new Date(meetingData.startTime);
    const endTime = meetingData.endTime?.toDate ? meetingData.endTime.toDate() : new Date(meetingData.endTime);

    // Chưa đến giờ bắt đầu điểm danh
    if (now < startTime) {
      const timeEl = document.getElementById('not-started-time');
      if (timeEl) timeEl.textContent = startTime.toLocaleString('vi-VN');
      showScreen('screen-not-started');
      return;
    }

    // Đã hết thời gian điểm danh
    if (now > endTime) {
      showScreen('screen-expired');
      return;
    }

    await onUserLoggedIn();

  } catch (e) {
    console.error('Lỗi tải cuộc họp:', e);
    if (e.code === 'permission-denied') {
      alert('⚠️ Lỗi phân quyền Firebase: Tài khoản của bạn (' + (userEmail || '') + ') chưa được cấp quyền đọc dữ liệu Firestore.\nVui lòng cập nhật lại Firestore Rules trên Firebase Console!');
    }
    showScreen('screen-invalid');
  }
}

// ---- Đăng nhập Google ----
document.getElementById('btn-google-login').addEventListener('click', async () => {
  try {
    showScreen('screen-loading');
    await auth.signInWithPopup(provider);
    // onAuthStateChanged sẽ tự động bắt sự kiện và gọi processMeetingForUser()
  } catch (e) {
    showScreen('screen-login');
    alert('Lỗi đăng nhập: ' + e.message);
  }
});

// ---- Sau khi đăng nhập ----
async function onUserLoggedIn() {
  if (!meetingData) return;

  // Kiểm tra xem đã điểm danh chưa (theo email thực, kể cả fraud)
  const existingSnap = await db.collection('attendances')
    .where('meetingId', '==', meetingId)
    .where('email', '==', userEmail)
    .get();

  if (!existingSnap.empty) {
    // Đã điểm danh
    const existing = existingSnap.docs[0].data();
    let msg = `Bạn đã điểm danh cuộc họp "${meetingData.name}".`;
    if (existing.isFraud) msg += ' (Đã ghi nhận bất thường)';
    document.getElementById('already-msg').textContent = msg;
    const emailEl = document.getElementById('already-user-email');
    if (emailEl) emailEl.textContent = userEmail;
    showScreen('screen-already');
    return;
  }

  // Hiển thị form điểm danh
  document.getElementById('form-meeting-name').textContent = meetingData.name;
  const startTime = meetingData.startTime?.toDate ? meetingData.startTime.toDate() : new Date(meetingData.startTime);
  document.getElementById('form-meeting-time').textContent = '📅 ' + startTime.toLocaleString('vi-VN');
  // Hiển thị email Google đã xác minh trên máy
  document.getElementById('display-email').textContent = userEmail;

  // Gợi ý tên tài khoản Google (giáo viên có thể tự gõ/chỉnh sửa theo ý mình)
  document.getElementById('input-name').value = userName || '';

  // Để trống tổ để giáo viên tự chọn
  document.getElementById('input-group').value = '';

  showScreen('screen-form');
}

// ---- Toggle absent section ----
document.getElementById('chk-absent').addEventListener('change', (e) => {
  const section = document.getElementById('absent-reason-section');
  if (e.target.checked) {
    section.classList.remove('hidden');
  } else {
    section.classList.add('hidden');
    document.querySelectorAll('input[name="absent-type"]').forEach(r => r.checked = false);
  }
});

// ---- Submit điểm danh ----
document.getElementById('btn-submit').addEventListener('click', async () => {
  const name = document.getElementById('input-name').value.trim();
  const group = document.getElementById('input-group').value;
  const isAbsent = document.getElementById('chk-absent').checked;
  const absentType = document.querySelector('input[name="absent-type"]:checked')?.value;

  // Validation
  if (!name) {
    alert('Vui lòng nhập họ tên!');
    return;
  }
  if (!group) {
    alert('Vui lòng chọn tổ!');
    return;
  }
  if (isAbsent && !absentType) {
    alert('Vui lòng chọn lý do vắng (có phép / không phép)!');
    return;
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = '⏳ Đang xử lý...';

  // Kiểm tra thời gian điểm danh lần nữa
  const now = new Date();
  const startTime = meetingData.startTime?.toDate ? meetingData.startTime.toDate() : new Date(meetingData.startTime);
  const endTime = meetingData.endTime?.toDate ? meetingData.endTime.toDate() : new Date(meetingData.endTime);

  if (now < startTime) {
    const timeEl = document.getElementById('not-started-time');
    if (timeEl) timeEl.textContent = startTime.toLocaleString('vi-VN');
    showScreen('screen-not-started');
    return;
  }

  if (now > endTime) {
    showScreen('screen-expired');
    return;
  }

  try {
    // Xác định status
    let status = 'present';
    if (isAbsent) status = absentType; // 'excused' or 'unexcused'

    // Kiểm tra gian lận: so sánh email Google với email trong hệ thống
    const memberSnap = await db.collection('members').where('email', '==', userEmail).get();

    let isFraud = false;
    let fraudType = '';
    let claimedEmail = '';
    let registeredMember = null;

    if (memberSnap.empty) {
      // 1. Email Google không có trong danh sách thành viên -> gian lận
      isFraud = true;
      fraudType = 'Email không có trong hệ thống';
      claimedEmail = '';
    } else {
      registeredMember = { id: memberSnap.docs[0].id, ...memberSnap.docs[0].data() };
      // 2. Tổ bộ môn: tổ giáo viên chọn phải khớp với tổ đăng ký trong hệ thống
      if (registeredMember.group && registeredMember.group !== group) {
        const groupNames = { bgh: 'BGH', to123: 'Tổ 1-2-3', to45: 'Tổ 4-5', tobomon: 'Tổ Bộ Môn', tovanphong: 'Tổ Văn Phòng' };
        const registeredGroupName = groupNames[registeredMember.group] || registeredMember.group;
        isFraud = true;
        fraudType = `Tổ không khớp (Hệ thống: ${registeredGroupName})`;
        claimedEmail = registeredMember.email || userEmail;
      }
    }

    // Lưu vào Firestore
    const attendanceData = {
      meetingId,
      meetingName: meetingData.name,
      memberName: name,
      group,
      email: userEmail,
      status,
      isFraud,
      fraudType: isFraud ? fraudType : '',
      claimedEmail: isFraud ? claimedEmail : '',
      registeredMemberId: registeredMember?.id || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    };

    await db.collection('attendances').add(attendanceData);

    if (isFraud) {
      document.getElementById('fraud-msg').textContent =
        `Lưu ý: ${fraudType}. Trường hợp này đã được ghi nhận và thông báo đến admin.`;
      showScreen('screen-fraud');
    } else {
      const groupNames = { bgh: 'BGH', to123: 'Tổ 1-2-3', to45: 'Tổ 4-5', tobomon: 'Tổ Bộ Môn', tovanphong: 'Tổ Văn Phòng' };
      let statusText = status === 'present' ? '✅ Có mặt' : status === 'excused' ? '📝 Vắng có phép' : '🚫 Vắng không phép';
      document.getElementById('success-title').textContent =
        status === 'present' ? 'Điểm Danh Thành Công!' : 'Đã Ghi Nhận Vắng Mặt';
      document.getElementById('success-msg').textContent =
        `Cuộc họp: ${meetingData.name}`;
      document.getElementById('success-details').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div>👤 <strong>Họ tên:</strong> ${name}</div>
          <div>🏢 <strong>Tổ:</strong> ${groupNames[group] || group}</div>
          <div>📊 <strong>Trạng thái:</strong> ${statusText}</div>
          <div>📧 <strong>Email:</strong> ${userEmail}</div>
          <div>🕐 <strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</div>
        </div>
      `;
      showScreen('screen-success');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '✅ Điểm Danh';
    alert('Lỗi: ' + e.message);
  }
});

// ---- Khởi động ----
initPage();
