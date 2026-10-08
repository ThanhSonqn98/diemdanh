// ============================================================
// ADMIN.JS - Logic trang quản lý điểm danh
// ============================================================

// ---- Admin emails (có quyền truy cập admin) ----
const ADMIN_EMAILS = [
  'thanhsonqn98@gmail.com',   // Admin thường
  'chaosonkhung@gmail.com'    // Super Admin - quyền tối cao
];

// ---- Super Admin: có quyền chỉnh sửa mọi dữ liệu ----
const SUPER_ADMIN_EMAILS = [
  'chaosonkhung@gmail.com'
];

let isSuperAdmin = false; // Sẽ được set sau khi đăng nhập

let currentMeetingId = null;
let currentDetailGroup = null;
let allGroups = [];
let editingGroupId = null;
let allMembers = [];
let editingMemberId = null;
let allMeetings = [];
let allAttendances = [];

// ---- AUTHENTICATION ----
document.getElementById('btn-admin-login').addEventListener('click', async () => {
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    showToast('Lỗi đăng nhập: ' + e.message, 'error');
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await auth.signOut();
  location.reload();
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    if (!ADMIN_EMAILS.includes(user.email)) {
      showToast('Bạn không có quyền admin!', 'error');
      await auth.signOut();
      return;
    }
    // Set quyền Super Admin
    isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email);

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-avatar').src = user.photoURL || '';
    const nameEl = document.getElementById('user-name');
    nameEl.textContent = user.displayName || user.email;
    if (isSuperAdmin) {
      nameEl.innerHTML += ' <span style="background:#f59e0b;color:white;font-size:11px;padding:2px 7px;border-radius:10px;font-weight:700">👑 Super</span>';
    }
    await loadAll();

  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
});

// ---- NAV TABS ----
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ---- LOAD ALL DATA ----
async function loadAll() {
  await loadGroups();
  await Promise.all([loadMembers(), loadMeetings()]);
  populateMeetingFilters();
  populateMemberGroupSelect();
  renderDashboard();
  renderMeetingsList();
  renderMembersTable();
  renderGroupsTable();
  populateSummarySelects();
}

// ---- GROUPS (QUẢN LÝ TỔ BỘ MÔN) ----
async function loadGroups() {
  try {
    const snap = await db.collection('groups').get();
    if (snap.empty) {
      // Khởi tạo các tổ mặc định nếu collection rỗng
      const batch = db.batch();
      for (const g of DEFAULT_GROUPS) {
        const ref = db.collection('groups').doc(g.id);
        batch.set(ref, {
          name: g.name,
          icon: g.icon || '🏢',
          order: g.order || 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      try {
        await batch.commit();
      } catch (err) {
        console.warn('Lỗi lưu tổ mặc định vào Firestore:', err);
      }
      allGroups = DEFAULT_GROUPS.map(g => ({ ...g }));
    } else {
      allGroups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allGroups.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  } catch (e) {
    console.warn('Lỗi tải tổ từ database:', e);
    allGroups = DEFAULT_GROUPS.map(g => ({ ...g }));
  }

  // Luôn cập nhật từ điển GROUP_NAMES
  allGroups.forEach(g => {
    GROUP_NAMES[g.id] = g.name;
  });
}

function populateMemberGroupSelect() {
  const sel = document.getElementById('member-group');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- Chọn tổ --</option>';
  allGroups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.icon ? g.icon + ' ' : ''}${g.name}`;
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
}

// ---- MEMBERS ----
async function loadMembers() {
  const snap = await db.collection('members').orderBy('name').get();
  allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderMembersTable() {
  const tbody = document.getElementById('members-tbody');
  tbody.innerHTML = '';
  allMembers.forEach((m, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${m.name}</td>
      <td>${m.email}</td>
      <td>${GROUP_NAMES[m.group] || m.group}</td>
      <td>${m.role || '--'}</td>
      <td>
        <button class="btn-edit" onclick="editMember('${m.id}')">Sửa</button>
        <button class="btn-danger" onclick="deleteMember('${m.id}')">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (!allMembers.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:32px">Chưa có thành viên nào</td></tr>';
  }
}

// Add member button
document.getElementById('btn-add-member').addEventListener('click', () => {
  editingMemberId = null;
  document.getElementById('member-form-title').textContent = 'Thêm thành viên';
  document.getElementById('member-name').value = '';
  document.getElementById('member-email').value = '';
  populateMemberGroupSelect();
  document.getElementById('member-group').value = '';
  document.getElementById('member-role').value = '';
  document.getElementById('member-form-section').classList.remove('hidden');
  document.getElementById('member-form-section').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-cancel-member').addEventListener('click', () => {
  document.getElementById('member-form-section').classList.add('hidden');
  editingMemberId = null;
});

document.getElementById('btn-save-member').addEventListener('click', async () => {
  const name = document.getElementById('member-name').value.trim();
  const email = document.getElementById('member-email').value.trim().toLowerCase();
  const group = document.getElementById('member-group').value;
  const role = document.getElementById('member-role').value.trim();

  if (!name || !email || !group) {
    showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
    return;
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    showToast('Email không hợp lệ', 'error');
    return;
  }

  try {
    if (editingMemberId) {
      await db.collection('members').doc(editingMemberId).update({ name, email, group, role });
      showToast('Đã cập nhật thành viên');
    } else {
      // Check duplicate email
      const existing = allMembers.find(m => m.email === email);
      if (existing) {
        showToast('Email này đã tồn tại trong hệ thống', 'error');
        return;
      }
      await db.collection('members').add({ name, email, group, role, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('Đã thêm thành viên mới');
    }
    document.getElementById('member-form-section').classList.add('hidden');
    editingMemberId = null;
    await loadMembers();
    renderMembersTable();
    renderGroupsTable();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
});

function editMember(id) {
  const m = allMembers.find(x => x.id === id);
  if (!m) return;
  editingMemberId = id;
  document.getElementById('member-form-title').textContent = 'Sửa thành viên';
  document.getElementById('member-name').value = m.name;
  document.getElementById('member-email').value = m.email;
  populateMemberGroupSelect();
  document.getElementById('member-group').value = m.group;
  document.getElementById('member-role').value = m.role || '';
  document.getElementById('member-form-section').classList.remove('hidden');
  document.getElementById('member-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteMember(id) {
  if (!confirm('Xóa thành viên này?')) return;
  await db.collection('members').doc(id).delete();
  await loadMembers();
  renderMembersTable();
  renderGroupsTable();
  showToast('Đã xóa thành viên');
}

// Import Excel
document.getElementById('import-excel').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      let added = 0, skipped = 0;
      for (const row of rows) {
        const name = (row['Họ tên'] || row['name'] || '').trim();
        const email = (row['Email'] || row['email'] || '').trim().toLowerCase();
        const group = (row['Tổ'] || row['group'] || '').trim();
        const role = (row['Chức vụ'] || row['role'] || '').trim();
        if (!name || !email || !group) { skipped++; continue; }
        const existing = allMembers.find(m => m.email === email);
        if (existing) { skipped++; continue; }
        
        // Tìm tổ tương ứng trong allGroups
        let groupKey = group;
        const matched = allGroups.find(g => 
          g.id.toLowerCase() === group.toLowerCase() || 
          g.name.toLowerCase() === group.toLowerCase() ||
          g.name.toLowerCase().includes(group.toLowerCase())
        );
        if (matched) {
          groupKey = matched.id;
        }

        await db.collection('members').add({ name, email, group: groupKey, role, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        added++;
      }
      showToast(`Import xong: +${added} mới, bỏ qua ${skipped}`);
      await loadMembers();
      renderMembersTable();
      renderGroupsTable();
    } catch (err) {
      showToast('Lỗi đọc file: ' + err.message, 'error');
    }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
});

// Export template Excel
document.getElementById('btn-export-template').addEventListener('click', () => {
  const sampleRows = [
    ['Họ tên', 'Email', 'Tổ', 'Chức vụ']
  ];
  if (allGroups.length) {
    allGroups.slice(0, 4).forEach((g, i) => {
      sampleRows.push([
        `Nguyễn Văn ${String.fromCharCode(65 + i)}`,
        `giaovien${i + 1}@gmail.com`,
        g.name,
        'Giáo viên'
      ]);
    });
  } else {
    sampleRows.push(['Nguyễn Văn A', 'nguyen.a@gmail.com', 'Tổ 1-2-3', 'Giáo viên']);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');
  XLSX.writeFile(wb, 'mau_danh_sach_giao_vien.xlsx');
});

// ---- MEETINGS ----
async function loadMeetings() {
  const snap = await db.collection('meetings').orderBy('createdAt', 'desc').get();
  allMeetings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function populateMeetingFilters() {
  const selects = ['filter-meeting', 'fraud-meeting-filter'];
  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    const currentVal = sel.value;
    while (sel.children.length > 1) sel.removeChild(sel.lastChild);
    allMeetings.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name + ' (' + formatDate(m.startTime) + ')';
      sel.appendChild(opt);
    });
    sel.value = currentVal;
  });
}

document.getElementById('filter-meeting').addEventListener('change', async (e) => {
  currentMeetingId = e.target.value || null;
  await loadAttendances();
  renderDashboard();
});

document.getElementById('btn-refresh').addEventListener('click', async () => {
  await loadAll();
  if (currentMeetingId) await loadAttendances();
  showToast('Đã cập nhật dữ liệu');
});

async function loadAttendances() {
  if (!currentMeetingId) { allAttendances = []; return; }
  const snap = await db.collection('attendances')
    .where('meetingId', '==', currentMeetingId).get();
  allAttendances = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- DASHBOARD RENDER ----
function renderDashboard() {
  const groupsGrid = document.getElementById('groups-grid');

  if (!currentMeetingId) {
    document.getElementById('meeting-info').classList.add('hidden');
    document.getElementById('stat-total').textContent = allMembers.length;
    document.getElementById('stat-present').textContent = '0';
    document.getElementById('stat-absent').textContent = allMembers.length;
    document.getElementById('stat-excused').textContent = '0';
    document.getElementById('stat-unexcused').textContent = '0';

    if (groupsGrid) {
      groupsGrid.innerHTML = allGroups.map(g => {
        const count = allMembers.filter(m => m.group === g.id).length;
        return `
          <div class="group-card" data-group="${g.id}">
            <div class="group-header">${g.icon || '🏢'} ${g.name}</div>
            <div class="group-stats">
              <div class="gs-item"><span>Tổng:</span> <strong id="g-${g.id}-total">${count}</strong></div>
              <div class="gs-item present"><span>Có mặt:</span> <strong id="g-${g.id}-present">0</strong></div>
              <div class="gs-item absent"><span>Vắng có phép:</span> <strong id="g-${g.id}-excused">0</strong></div>
              <div class="gs-item unexcused"><span>Vắng K.phép:</span> <strong id="g-${g.id}-unexcused">0</strong></div>
            </div>
            <button class="btn-view-detail" data-group="${g.id}">Xem chi tiết</button>
          </div>
        `;
      }).join('');
      attachGroupDetailEvents();
    }

    document.getElementById('attendance-tbody').innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:32px">← Chọn cuộc họp để xem kết quả</td></tr>';
    return;
  }

  // Meeting info
  const meeting = allMeetings.find(m => m.id === currentMeetingId);
  if (meeting) {
    document.getElementById('meeting-info').classList.remove('hidden');
    document.getElementById('meeting-title').textContent = '📌 ' + meeting.name;
    document.getElementById('meeting-time').textContent = '⏰ ' + formatDateTime(meeting.startTime);
    const now = new Date();
    const expiry = meeting.endTime?.toDate ? meeting.endTime.toDate() : new Date(meeting.endTime);
    const isExpired = now > expiry;
    document.getElementById('meeting-status').innerHTML = isExpired
      ? '<span class="badge badge-expired">⏱ QR Hết hạn</span>'
      : '<span class="badge badge-active">✅ QR Còn hiệu lực</span>';
  }

  // Valid (non-fraud) attendances
  const valid = allAttendances.filter(a => !a.isFraud);
  const presentSet = new Set(valid.filter(a => a.status === 'present').map(a => a.email));
  const excusedSet = new Set(valid.filter(a => a.status === 'excused').map(a => a.email));
  const unexcusedSet = new Set(valid.filter(a => a.status === 'unexcused').map(a => a.email));

  const totalPresent = presentSet.size;
  const totalExcused = excusedSet.size;
  const totalUnexcused = unexcusedSet.size;
  const totalAbsent = totalExcused + totalUnexcused;

  document.getElementById('stat-total').textContent = allMembers.length;
  document.getElementById('stat-present').textContent = totalPresent;
  document.getElementById('stat-absent').textContent = totalAbsent;
  document.getElementById('stat-excused').textContent = totalExcused;
  document.getElementById('stat-unexcused').textContent = totalUnexcused;

  if (groupsGrid) {
    groupsGrid.innerHTML = allGroups.map(g => {
      const groupMembers = allMembers.filter(m => m.group === g.id);
      const groupAttendances = valid.filter(a => a.group === g.id);
      const gPresent = groupAttendances.filter(a => a.status === 'present').length;
      const gExcused = groupAttendances.filter(a => a.status === 'excused').length;
      const gUnexcused = groupAttendances.filter(a => a.status === 'unexcused').length;

      return `
        <div class="group-card" data-group="${g.id}">
          <div class="group-header">${g.icon || '🏢'} ${g.name}</div>
          <div class="group-stats">
            <div class="gs-item"><span>Tổng:</span> <strong id="g-${g.id}-total">${groupMembers.length}</strong></div>
            <div class="gs-item present"><span>Có mặt:</span> <strong id="g-${g.id}-present">${gPresent}</strong></div>
            <div class="gs-item absent"><span>Vắng có phép:</span> <strong id="g-${g.id}-excused">${gExcused}</strong></div>
            <div class="gs-item unexcused"><span>Vắng K.phép:</span> <strong id="g-${g.id}-unexcused">${gUnexcused}</strong></div>
          </div>
          <button class="btn-view-detail" data-group="${g.id}">Xem chi tiết</button>
        </div>
      `;
    }).join('');
    attachGroupDetailEvents();
  }

  // Render all attendances or filtered group
  if (currentDetailGroup && allGroups.some(g => g.id === currentDetailGroup)) {
    const filtered = valid.filter(a => a.group === currentDetailGroup);
    renderAttendanceTable(filtered, GROUP_NAMES[currentDetailGroup] || currentDetailGroup);
  } else {
    currentDetailGroup = null;
    renderAttendanceTable(valid, 'Tất cả');
  }
}

function attachGroupDetailEvents() {
  document.querySelectorAll('#groups-grid .btn-view-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      currentDetailGroup = group;
      const valid = allAttendances.filter(a => !a.isFraud);
      const filtered = valid.filter(a => a.group === group);
      renderAttendanceTable(filtered, GROUP_NAMES[group] || group);
      document.querySelector('.detail-section').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function renderAttendanceTable(data, groupTitle) {
  const titleEl = document.getElementById('detail-group-title');
  if (currentDetailGroup) {
    titleEl.innerHTML = `Chi tiết điểm danh - ${groupTitle} <button id="btn-show-all-groups" class="btn-secondary" style="font-size:12px;padding:3px 10px;margin-left:12px">👁️ Xem tất cả tổ</button>`;
    document.getElementById('btn-show-all-groups')?.addEventListener('click', () => {
      currentDetailGroup = null;
      const valid = allAttendances.filter(a => !a.isFraud);
      renderAttendanceTable(valid, 'Tất cả');
    });
  } else {
    titleEl.textContent = 'Chi tiết điểm danh - ' + groupTitle;
  }
  const tbody = document.getElementById('attendance-tbody');
  tbody.innerHTML = '';

  // Cập nhật header nếu là Super Admin
  const theadRow = document.querySelector('#attendance-table thead tr');
  if (theadRow) {
    const lastTh = theadRow.querySelector('th:last-child');
    if (isSuperAdmin && lastTh && lastTh.textContent === 'Ghi chú') {
      lastTh.textContent = 'Ghi chú';
      // Thêm cột Sửa nếu chưa có
      if (!theadRow.querySelector('.th-edit')) {
        const editTh = document.createElement('th');
        editTh.className = 'th-edit';
        editTh.textContent = '✏️ Sửa';
        theadRow.appendChild(editTh);
      }
    }
  }

  data.forEach((a, i) => {
    const tr = document.createElement('tr');
    let statusBadge = '';
    if (a.status === 'present') statusBadge = '<span class="badge badge-present">✅ Có mặt</span>';
    else if (a.status === 'excused') statusBadge = '<span class="badge badge-excused">📝 Vắng có phép</span>';
    else statusBadge = '<span class="badge badge-unexcused">❌ Vắng KP</span>';

    const editBtn = isSuperAdmin
      ? `<button class="btn-edit" onclick="editAttendance('${a.id}')" style="font-size:12px;padding:4px 10px">✏️ Sửa</button>`
      : '';

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${a.memberName || '--'}</td>
      <td>${GROUP_NAMES[a.group] || '--'}</td>
      <td id="status-${a.id}">${statusBadge}</td>
      <td style="font-size:12px">${a.email || '--'}</td>
      <td style="font-size:12px">${formatDateTime(a.timestamp)}</td>
      <td>${a.note || ''}</td>
      ${isSuperAdmin ? `<td>${editBtn}</td>` : ''}
    `;
    tbody.appendChild(tr);
  });
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:32px">Chưa có dữ liệu điểm danh</td></tr>';
  }
}

// ---- SUPER ADMIN: Sửa trạng thái điểm danh ----
async function editAttendance(attendanceId) {
  const a = allAttendances.find(x => x.id === attendanceId);
  if (!a) return;

  const modalBody = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ Sửa điểm danh - ' + (a.memberName || '');
  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:4px">👤 Họ tên</p>
        <p style="font-weight:600">${a.memberName || '--'}</p>
      </div>
      <div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:4px">📧 Email</p>
        <p style="font-size:13px">${a.email || '--'}</p>
      </div>
      <div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px">📊 Trạng thái hiện tại</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid ${a.status==='present'?'#10b981':'#e5e7eb'};border-radius:8px;cursor:pointer">
            <input type="radio" name="edit-status" value="present" ${a.status==='present'?'checked':''} style="width:18px;height:18px;accent-color:#10b981">
            <span>✅ Có mặt</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid ${a.status==='excused'?'#f59e0b':'#e5e7eb'};border-radius:8px;cursor:pointer">
            <input type="radio" name="edit-status" value="excused" ${a.status==='excused'?'checked':''} style="width:18px;height:18px;accent-color:#f59e0b">
            <span>📝 Vắng có phép</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid ${a.status==='unexcused'?'#ef4444':'#e5e7eb'};border-radius:8px;cursor:pointer">
            <input type="radio" name="edit-status" value="unexcused" ${a.status==='unexcused'?'checked':''} style="width:18px;height:18px;accent-color:#ef4444">
            <span>❌ Vắng không phép</span>
          </label>
        </div>
      </div>
      <div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:4px">📝 Ghi chú (tùy chọn)</p>
        <input type="text" id="edit-note" value="${a.note||''}" placeholder="Lý do chỉnh sửa..." class="form-control">
      </div>
      <button onclick="saveAttendanceEdit('${attendanceId}')" class="btn-primary" style="width:100%">💾 Lưu thay đổi</button>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function saveAttendanceEdit(attendanceId) {
  const newStatus = document.querySelector('input[name="edit-status"]:checked')?.value;
  const note = document.getElementById('edit-note')?.value.trim();
  if (!newStatus) { showToast('Vui lòng chọn trạng thái', 'error'); return; }

  try {
    await db.collection('attendances').doc(attendanceId).update({
      status: newStatus,
      note: note || '',
      editedBy: auth.currentUser?.email,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Cập nhật local data
    const idx = allAttendances.findIndex(x => x.id === attendanceId);
    if (idx !== -1) { allAttendances[idx].status = newStatus; allAttendances[idx].note = note; }

    document.getElementById('modal-overlay').classList.add('hidden');
    showToast('✅ Đã cập nhật trạng thái!');

    // Re-render
    renderDashboard();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}


// Export Excel - attendance
document.getElementById('btn-export').addEventListener('click', () => {
  const data = currentDetailGroup
    ? allAttendances.filter(a => !a.isFraud && a.group === currentDetailGroup)
    : allAttendances.filter(a => !a.isFraud);
  const rows = data.map((a, i) => ({
    'STT': i + 1,
    'Họ tên': a.memberName,
    'Tổ': GROUP_NAMES[a.group] || a.group,
    'Trạng thái': a.status === 'present' ? 'Có mặt' : a.status === 'excused' ? 'Vắng có phép' : 'Vắng không phép',
    'Email': a.email,
    'Thời gian': formatDateTime(a.timestamp)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const meeting = allMeetings.find(m => m.id === currentMeetingId);
  const groupSuffix = currentDetailGroup ? `_${(GROUP_NAMES[currentDetailGroup] || currentDetailGroup).replace(/\s/g, '_')}` : '';
  XLSX.utils.book_append_sheet(wb, ws, 'Điểm danh');
  XLSX.writeFile(wb, `diemdanh_${(meeting?.name || 'cuochop').replace(/\s/g, '_')}${groupSuffix}.xlsx`);
});

// ---- CREATE QR ----
document.getElementById('btn-create-qr').addEventListener('click', async () => {
  const name = document.getElementById('meeting-name').value.trim();
  const start = document.getElementById('meeting-start').value;
  const end = document.getElementById('meeting-end').value;
  if (!name || !start || !end) {
    showToast('Vui lòng điền đầy đủ thông tin', 'error');
    return;
  }
  if (new Date(end) <= new Date(start)) {
    showToast('Thời gian kết thúc phải sau thời gian bắt đầu', 'error');
    return;
  }
  const note = document.getElementById('meeting-note').value.trim();
  const token = generateToken();
  try {
    const ref = await db.collection('meetings').add({
      name,
      token,
      startTime: new Date(start),
      endTime: new Date(end),
      note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const meetingId = ref.id;
    const url = `${location.origin}/attend.html?m=${meetingId}&t=${token}`;
    // Render QR
    document.getElementById('qr-code-display').innerHTML = '';
    new QRCode(document.getElementById('qr-code-display'), {
      text: url, width: 220, height: 220,
      colorDark: '#4f46e5', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById('qr-meeting-name').textContent = '📋 ' + name;
    document.getElementById('qr-time-info').textContent = '⏰ Bắt đầu: ' + new Date(start).toLocaleString('vi-VN');
    document.getElementById('qr-expire-info').textContent = '⚠️ Hết hiệu lực: ' + new Date(end).toLocaleString('vi-VN');
    document.getElementById('qr-result').classList.remove('hidden');
    // Store current meeting id for download
    document.getElementById('btn-download-qr').dataset.meetingId = meetingId;
    document.getElementById('btn-copy-link').dataset.url = url;
    showToast('Đã tạo QR thành công!');
    await loadMeetings();
    renderMeetingsList();
    populateMeetingFilters();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
});

document.getElementById('btn-download-qr').addEventListener('click', () => {
  const qrImg = document.querySelector('#qr-code-display img');
  if (!qrImg) return;
  // Create canvas for download with title
  const canvas = document.createElement('canvas');
  const meeting = allMeetings.find(m => m.id === document.getElementById('btn-download-qr').dataset.meetingId);
  canvas.width = 300; canvas.height = 380;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 300, 380);
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(0, 0, 300, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QR ĐIỂM DANH', 150, 22);
  ctx.font = '12px Arial';
  ctx.fillText(meeting?.name || '', 150, 40);
  const img = new Image();
  img.src = qrImg.src;
  img.onload = () => {
    ctx.drawImage(img, 40, 60, 220, 220);
    ctx.fillStyle = '#374151';
    ctx.font = '11px Arial';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Hết hiệu lực: ' + (meeting ? new Date(meeting.endTime?.seconds * 1000 || meeting.endTime).toLocaleString('vi-VN') : ''), 150, 310);
    ctx.fillStyle = '#374151';
    ctx.font = '10px Arial';
    ctx.fillText('Quét QR để điểm danh cuộc họp', 150, 330);
    const link = document.createElement('a');
    link.download = `QR_${(meeting?.name || 'cuochop').replace(/\s/g, '_')}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };
});

document.getElementById('btn-copy-link').addEventListener('click', () => {
  const url = document.getElementById('btn-copy-link').dataset.url;
  navigator.clipboard.writeText(url).then(() => showToast('Đã copy link!')).catch(() => {
    prompt('Copy link này:', url);
  });
});

function generateToken() {
  return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
}

function renderMeetingsList() {
  const tbody = document.getElementById('meetings-tbody');
  tbody.innerHTML = '';
  const now = new Date();
  allMeetings.forEach(m => {
    const endTime = m.endTime?.toDate ? m.endTime.toDate() : new Date(m.endTime);
    const isExpired = now > endTime;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${formatDateTime(m.startTime)}</td>
      <td>${formatDateTime(m.endTime)}</td>
      <td id="count-${m.id}">...</td>
      <td>${isExpired ? '<span class="badge badge-expired">⏱ Hết hạn</span>' : '<span class="badge badge-active">✅ Hiệu lực</span>'}</td>
      <td>
        <button class="btn-edit" onclick="showMeetingQR('${m.id}')">Xem QR</button>
        <button class="btn-danger" onclick="deleteMeeting('${m.id}')">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
    // Load attendance count
    db.collection('attendances').where('meetingId', '==', m.id).where('isFraud', '==', false).get()
      .then(snap => {
        const el = document.getElementById('count-' + m.id);
        if (el) el.textContent = snap.size + ' người';
      });
  });
  if (!allMeetings.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:32px">Chưa có cuộc họp nào</td></tr>';
  }
}

async function showMeetingQR(id) {
  const meeting = allMeetings.find(m => m.id === id);
  if (!meeting) return;
  const url = `${location.origin}/attend.html?m=${id}&t=${meeting.token}`;
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = '<div id="modal-qr-display" style="display:flex;flex-direction:column;align-items:center;gap:16px"></div>';
  document.getElementById('modal-title').textContent = meeting.name;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => {
    new QRCode(document.getElementById('modal-qr-display'), {
      text: url, width: 200, height: 200,
      colorDark: '#4f46e5', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    const p = document.createElement('p');
    p.style.cssText = 'font-size:12px;color:#6b7280;word-break:break-all;text-align:center';
    p.textContent = url;
    document.getElementById('modal-qr-display').appendChild(p);
  }, 100);
}

async function deleteMeeting(id) {
  if (!confirm('Xóa cuộc họp này? Dữ liệu điểm danh liên quan cũng bị xóa!')) return;
  await db.collection('meetings').doc(id).delete();
  const snap = await db.collection('attendances').where('meetingId', '==', id).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  await loadMeetings();
  renderMeetingsList();
  populateMeetingFilters();
  showToast('Đã xóa cuộc họp');
}

// Modal close
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
});

// ---- SUMMARY (TỔNG KẼT THÁNG) ----
function populateSummarySelects() {
  const monthSel = document.getElementById('summary-month');
  const yearSel = document.getElementById('summary-year');
  monthSel.innerHTML = '';
  const months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
    'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  months.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1; opt.textContent = m; monthSel.appendChild(opt);
  });
  const now = new Date();
  monthSel.value = now.getMonth() + 1;
  yearSel.innerHTML = '';
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y; yearSel.appendChild(opt);
  }
  yearSel.value = now.getFullYear();
}

document.getElementById('btn-load-summary').addEventListener('click', async () => {
  const month = parseInt(document.getElementById('summary-month').value);
  const year = parseInt(document.getElementById('summary-year').value);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const snap = await db.collection('attendances')
    .where('timestamp', '>=', startOfMonth)
    .where('timestamp', '<=', endOfMonth)
    .where('isFraud', '==', false)
    .get();
  const attendances = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Get distinct meeting IDs in this month
  const meetingIds = [...new Set(attendances.map(a => a.meetingId))];
  const totalMeetings = meetingIds.length;

  const tbody = document.getElementById('summary-tbody');
  tbody.innerHTML = '';
  allMembers.forEach((member, i) => {
    const memberAttendances = attendances.filter(a => a.email === member.email);
    const present = memberAttendances.filter(a => a.status === 'present').length;
    const excused = memberAttendances.filter(a => a.status === 'excused').length;
    const unexcused = memberAttendances.filter(a => a.status === 'unexcused').length;
    const attendance = present + excused + unexcused;
    const rate = totalMeetings > 0 ? Math.round((present / totalMeetings) * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${member.name}</td>
      <td>${GROUP_NAMES[member.group] || member.group}</td>
      <td>${totalMeetings}</td>
      <td style="color:#10b981;font-weight:600">${present}</td>
      <td style="color:#f59e0b;font-weight:600">${excused}</td>
      <td style="color:#ef4444;font-weight:600">${unexcused}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:#e5e7eb;border-radius:4px;height:8px">
            <div style="width:${rate}%;background:${rate>=80?'#10b981':rate>=60?'#f59e0b':'#ef4444'};height:8px;border-radius:4px"></div>
          </div>
          <span style="font-size:12px;font-weight:600">${rate}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (!allMembers.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:32px">Không có dữ liệu</td></tr>';
  }
});

document.getElementById('btn-export-summary').addEventListener('click', () => {
  const rows = [];
  document.querySelectorAll('#summary-tbody tr').forEach((tr, i) => {
    const cells = tr.querySelectorAll('td');
    if (cells.length >= 8) {
      rows.push({
        'STT': cells[0].textContent,
        'Họ tên': cells[1].textContent,
        'Tổ': cells[2].textContent,
        'Tổng họp': cells[3].textContent,
        'Có mặt': cells[4].textContent,
        'Vắng có phép': cells[5].textContent,
        'Vắng KP': cells[6].textContent
      });
    }
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const m = document.getElementById('summary-month').value;
  const y = document.getElementById('summary-year').value;
  XLSX.utils.book_append_sheet(wb, ws, 'Tổng kết');
  XLSX.writeFile(wb, `tong_ket_thang_${m}_${y}.xlsx`);
});

// ---- FRAUD DETECTION ----
document.getElementById('fraud-meeting-filter').addEventListener('change', async (e) => {
  await loadFraudData(e.target.value || null);
});

async function loadFraudData(meetingId) {
  let query = db.collection('attendances').where('isFraud', '==', true);
  if (meetingId) query = query.where('meetingId', '==', meetingId);
  const snap = await query.get();
  const fraudData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const tbody = document.getElementById('fraud-tbody');
  tbody.innerHTML = '';

  // Cập nhật header nếu Super Admin
  const fraudTheadRow = document.querySelector('#tab-fraud thead tr');
  if (fraudTheadRow && isSuperAdmin && !fraudTheadRow.querySelector('.th-fraud-edit')) {
    const th = document.createElement('th');
    th.className = 'th-fraud-edit';
    th.textContent = '👑 Xử lý';
    fraudTheadRow.appendChild(th);
  }

  fraudData.forEach(f => {
    const meeting = allMeetings.find(m => m.id === f.meetingId);
    const tr = document.createElement('tr');
    const superAdminActions = isSuperAdmin ? `
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-edit" style="font-size:11px;padding:4px 8px"
          onclick="clearFraud('${f.id}','present')">✅ Duyệt có mặt</button>
        <button class="btn-edit" style="font-size:11px;padding:4px 8px;background:#f59e0b"
          onclick="clearFraud('${f.id}','excused')">📝 Có phép</button>
        <button class="btn-danger" style="font-size:11px;padding:4px 8px"
          onclick="deleteFraud('${f.id}')">🗑️ Xóa</button>
      </td>` : '';
    tr.innerHTML = `
      <td>${meeting?.name || f.meetingId}</td>
      <td>${f.memberName || '--'}</td>
      <td style="color:#6b7280;font-size:12px">${f.claimedEmail || '--'}</td>
      <td style="color:#ef4444;font-size:12px">${f.email || '--'}</td>
      <td><span class="badge badge-fraud">${f.fraudType || 'Email không khớp'}</span></td>
      <td style="font-size:12px">${formatDateTime(f.timestamp)}</td>
      ${superAdminActions}
    `;
    tbody.appendChild(tr);
  });
  if (!fraudData.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#10b981;padding:32px">✅ Không phát hiện gian lận</td></tr>';
  }
}

// Super Admin: Duyệt bỏ gian lận → chuyển thành điểm danh hợp lệ
async function clearFraud(attendanceId, newStatus) {
  const statusText = newStatus === 'present' ? 'có mặt' : 'vắng có phép';
  if (!confirm(`Xác nhận duyệt trường hợp này thành "${statusText}"?`)) return;
  try {
    await db.collection('attendances').doc(attendanceId).update({
      isFraud: false,
      fraudType: '',
      status: newStatus,
      clearedBy: auth.currentUser?.email,
      clearedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`✅ Đã duyệt thành ${statusText}!`);
    await loadFraudData(document.getElementById('fraud-meeting-filter').value || null);
    // Reload dashboard nếu đang xem cùng cuộc họp
    if (currentMeetingId) await loadAttendances();
    renderDashboard();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// Super Admin: Xóa hẳn bản ghi gian lận
async function deleteFraud(attendanceId) {
  if (!confirm('Xóa hẳn bản ghi này?')) return;
  try {
    await db.collection('attendances').doc(attendanceId).delete();
    showToast('🗑️ Đã xóa bản ghi!');
    await loadFraudData(document.getElementById('fraud-meeting-filter').value || null);
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// Load fraud data khi chuyển sang tab
document.querySelector('[data-tab="fraud"]').addEventListener('click', () => {
  loadFraudData(null);
});

// ============================================================
// QUẢN LÝ TỔ BỘ MÔN (GROUPS MANAGEMENT)
// ============================================================

function slugifyGroup(name) {
  let str = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!str.startsWith('to_') && !str.startsWith('to')) {
    str = 'to_' + str;
  }
  return str || ('to_' + Date.now().toString(36));
}

function renderGroupsTable() {
  const tbody = document.getElementById('groups-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  allGroups.forEach((g, i) => {
    const memberCount = allMembers.filter(m => m.group === g.id).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td style="font-size:22px;text-align:center">${g.icon || '🏢'}</td>
      <td><strong>${g.name}</strong></td>
      <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px">${g.id}</code></td>
      <td><span class="badge" style="background:#e0e7ff;color:#3730a3">${memberCount} người</span></td>
      <td>${g.order || i + 1}</td>
      <td>
        <button class="btn-edit" onclick="editGroup('${g.id}')">Sửa</button>
        <button class="btn-danger" onclick="deleteGroup('${g.id}')">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (!allGroups.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:32px">Chưa có tổ bộ môn nào</td></tr>';
  }
}

function editGroup(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;
  editingGroupId = id;
  document.getElementById('group-form-title').textContent = 'Sửa tổ bộ môn: ' + g.name;
  document.getElementById('group-name-input').value = g.name;
  document.getElementById('group-icon-input').value = g.icon || '🏢';
  document.getElementById('group-id-input').value = g.id;
  document.getElementById('group-id-input').disabled = true;
  document.getElementById('group-order-input').value = g.order || 1;
  document.getElementById('group-form-section').classList.remove('hidden');
  document.getElementById('group-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteGroup(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;

  const memberCount = allMembers.filter(m => m.group === id).length;
  if (memberCount > 0) {
    alert(`Không thể xóa tổ "${g.name}" vì hiện đang có ${memberCount} thành viên thuộc tổ này!\n\nVui lòng chuyển các thành viên sang tổ khác trước khi xóa.`);
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn xóa tổ "${g.name}"?`)) return;

  try {
    await db.collection('groups').doc(id).delete();
    showToast('Đã xóa tổ bộ môn');
    await loadGroups();
    populateMemberGroupSelect();
    renderGroupsTable();
    renderDashboard();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// Thêm tổ mới
document.getElementById('btn-add-group')?.addEventListener('click', () => {
  editingGroupId = null;
  document.getElementById('group-form-title').textContent = 'Thêm tổ bộ môn mới';
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-icon-input').value = '🏢';
  document.getElementById('group-id-input').value = '';
  document.getElementById('group-id-input').disabled = false;
  document.getElementById('group-order-input').value = allGroups.length + 1;
  document.getElementById('group-form-section').classList.remove('hidden');
  document.getElementById('group-form-section').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-cancel-group')?.addEventListener('click', () => {
  document.getElementById('group-form-section').classList.add('hidden');
  editingGroupId = null;
});

// Icon presets buttons
document.querySelectorAll('.btn-icon-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const icon = btn.dataset.icon;
    const input = document.getElementById('group-icon-input');
    if (input) input.value = icon;
  });
});

// Lưu tổ
document.getElementById('btn-save-group')?.addEventListener('click', async () => {
  const name = document.getElementById('group-name-input').value.trim();
  const icon = document.getElementById('group-icon-input').value.trim() || '🏢';
  let idInput = document.getElementById('group-id-input').value.trim();
  const order = parseInt(document.getElementById('group-order-input').value) || (allGroups.length + 1);

  if (!name) {
    showToast('Vui lòng nhập tên tổ bộ môn', 'error');
    return;
  }

  try {
    if (editingGroupId) {
      await db.collection('groups').doc(editingGroupId).update({
        name,
        icon,
        order,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Đã cập nhật tổ bộ môn');
    } else {
      let targetId = idInput;
      if (!targetId) {
        targetId = slugifyGroup(name);
      } else {
        targetId = targetId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      }

      // Kiểm tra trùng ID
      if (allGroups.some(g => g.id === targetId)) {
        targetId = `${targetId}_${Date.now().toString(36).slice(-4)}`;
      }

      await db.collection('groups').doc(targetId).set({
        name,
        icon,
        order,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Đã thêm tổ bộ môn mới');
    }

    document.getElementById('group-form-section').classList.add('hidden');
    editingGroupId = null;
    await loadGroups();
    populateMemberGroupSelect();
    renderGroupsTable();
    renderMembersTable();
    renderDashboard();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
});

// Nút chuyển nhanh sang quản lý tổ từ tab thành viên
document.getElementById('btn-quick-groups')?.addEventListener('click', () => {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const tabBtn = document.querySelector('.nav-tab[data-tab="groups"]');
  if (tabBtn) tabBtn.classList.add('active');
  const tabContent = document.getElementById('tab-groups');
  if (tabContent) tabContent.classList.add('active');
  renderGroupsTable();
});

// Khi chuyển sang tab groups
document.querySelector('[data-tab="groups"]')?.addEventListener('click', () => {
  renderGroupsTable();
});

