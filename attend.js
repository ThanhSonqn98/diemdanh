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
let allGroups = [];

// ---- Tải danh sách tổ bộ môn ----
async function loadGroups() {
  try {
    const snap = await db.collection('groups').get();
    if (!snap.empty) {
      allGroups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allGroups.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else {
      allGroups = (typeof DEFAULT_GROUPS !== 'undefined' ? DEFAULT_GROUPS : [
        { id: 'to123', name: 'Tổ 1-2-3', icon: '🏢' },
        { id: 'to45', name: 'Tổ 4-5', icon: '🏢' },
        { id: 'tobomon', name: 'Tổ Bộ Môn', icon: '📚' },
        { id: 'tovanphong', name: 'Tổ Văn Phòng', icon: '🏛️' }
      ]);
    }
  } catch (e) {
    console.warn('Lỗi tải danh sách tổ:', e);
    allGroups = (typeof DEFAULT_GROUPS !== 'undefined' ? DEFAULT_GROUPS : [
      { id: 'to123', name: 'Tổ 1-2-3', icon: '🏢' },
      { id: 'to45', name: 'Tổ 4-5', icon: '🏢' },
      { id: 'tobomon', name: 'Tổ Bộ Môn', icon: '📚' },
      { id: 'tovanphong', name: 'Tổ Văn Phòng', icon: '🏛️' }
    ]);
  }

  // Cập nhật từ điển GROUP_NAMES
  allGroups.forEach(g => {
    GROUP_NAMES[g.id] = g.name;
  });

  // Hiển thị ra dropdown tổ
  const groupSelect = document.getElementById('input-group');
  if (groupSelect) {
    const curVal = groupSelect.value;
    groupSelect.innerHTML = '<option value="">-- Chọn tổ --</option>';
    allGroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.icon ? g.icon + ' ' : ''}${g.name}`;
      groupSelect.appendChild(opt);
    });
    if (curVal) groupSelect.value = curVal;
  }
}

// ---- Hiển thị màn hình ----
function showScreen(screenId) {
  const screens = ['screen-loading', 'screen-expired', 'screen-invalid',
    'screen-already', 'screen-login', 'screen-form', 'screen-success', 'screen-fraud'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.remove('hidden');
}

// ---- Validate QR & Load meeting ----
async function initPage() {
  showScreen('screen-loading');
  await loadGroups();

  if (!meetingId || !token) {
    showScreen('screen-invalid');
    return;
  }

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

    // Check expiry
    const now = new Date();
    const endTime = meetingData.endTime?.toDate ? meetingData.endTime.toDate() : new Date(meetingData.endTime);
    if (now > endTime) {
      showScreen('screen-expired');
      return;
    }

    // Kiểm tra auth state
    auth.onAuthStateChanged((user) => {
      if (user) {
        userEmail = user.email.toLowerCase();
        userName = user.displayName || '';
        onUserLoggedIn();
      } else {
        // Hiện màn hình đăng nhập Google
        document.getElementById('login-meeting-name').textContent = meetingData.name;
        showScreen('screen-login');
      }
    });

  } catch (e) {
    console.error(e);
    showScreen('screen-invalid');
  }
}

// ---- Đăng nhập Google ----
document.getElementById('btn-google-login').addEventListener('click', async () => {
  try {
    await auth.signInWithPopup(provider);
    // onAuthStateChanged sẽ tự chạy tiếp
  } catch (e) {
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
    showScreen('screen-already');
    return;
  }

  // Hiển thị form điểm danh
  document.getElementById('form-meeting-name').textContent = meetingData.name;
  const startTime = meetingData.startTime?.toDate ? meetingData.startTime.toDate() : new Date(meetingData.startTime);
  document.getElementById('form-meeting-time').textContent = '📅 ' + startTime.toLocaleString('vi-VN');
  document.getElementById('display-email').textContent = userEmail;

  // Pre-fill tên nếu có
  if (userName) {
    document.getElementById('input-name').value = userName;
  }

  // Pre-fill thông tin đã đăng ký trong hệ thống
  try {
    const memberSnap = await db.collection('members').where('email', '==', userEmail).get();
    if (!memberSnap.empty) {
      const reg = memberSnap.docs[0].data();
      if (reg.name) document.getElementById('input-name').value = reg.name;
      if (reg.group) document.getElementById('input-group').value = reg.group;
    }
  } catch (err) {
    console.warn('Lỗi kiểm tra thông tin thành viên:', err);
  }

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

  // Kiểm tra expiry lần nữa (phòng trường hợp QR hết hạn trong lúc điền form)
  const now = new Date();
  const endTime = meetingData.endTime?.toDate ? meetingData.endTime.toDate() : new Date(meetingData.endTime);
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
      // Email Google không có trong danh sách → gian lận (hoặc chưa đăng ký)
      isFraud = true;
      fraudType = 'Email không có trong hệ thống';
      claimedEmail = userEmail;
    } else {
      registeredMember = { id: memberSnap.docs[0].id, ...memberSnap.docs[0].data() };
      // Kiểm tra tên khai báo có khớp với tên đăng ký không
      const registeredName = registeredMember.name.trim().toLowerCase();
      const claimedName = name.trim().toLowerCase();
      if (registeredName !== claimedName) {
        // Tên không khớp → có thể gian lận (điểm danh hộ)
        isFraud = true;
        fraudType = 'Tên khai báo không khớp hệ thống';
        claimedEmail = userEmail;
      }
      // Nếu khai tổ sai cũng đánh dấu
      if (registeredMember.group && registeredMember.group !== group) {
        isFraud = true;
        fraudType = (fraudType ? fraudType + ' & ' : '') + 'Tổ khai báo không khớp';
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
      let statusText = status === 'present' ? '✅ Có mặt' : status === 'excused' ? '📝 Vắng có phép' : '🚫 Vắng không phép';
      const groupDisplayName = GROUP_NAMES[group] || group;
      document.getElementById('success-title').textContent =
        status === 'present' ? 'Điểm Danh Thành Công!' : 'Đã Ghi Nhận Vắng Mặt';
      document.getElementById('success-msg').textContent =
        `Cuộc họp: ${meetingData.name}`;
      document.getElementById('success-details').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div>👤 <strong>Họ tên:</strong> ${name}</div>
          <div>🏢 <strong>Tổ:</strong> ${groupDisplayName}</div>
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
