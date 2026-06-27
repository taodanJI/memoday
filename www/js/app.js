// ===== 念念日历 - 主应用 (v1.1 - 修复共享/删除/确认弹窗) =====
import {
  getAllEvents, getPersonalEvents, saveEvent, deleteEvent, getEventById,
  getSharedEvents, createSharedEvent, deleteSharedEvent,
  updateSharedEvent, getProfile, saveProfile, getSettings, saveSettings,
  encodeShareData, decodeShareData, importSharedEvent, generateShareLink,
} from './db.js';
import {
  EVENT_TYPES, getEventTypeInfo, daysUntilNext, getNextOccurrence,
  getTodayDisplay, sortEventsByCountdown, formatCountdown,
  formatDate, todayStr, parseDate,
} from './utils.js';
import { renderCalendar } from './calendar.js';
import {
  requestNotificationPermission, checkReminders, startReminderCheck,
  getNotificationStatus, sendTestNotification,
} from './notify.js';

// ===== 全局状态 =====
let currentPage = 'home';
let editingEventId = null;
let isSharedCreate = false;
let selectedType = 'birthday';
let calendarSelectedDate = null;
let pendingJoinData = null;
let confirmCallback = null;

window.setCalSelectedDate = (date) => { calendarSelectedDate = date; };

// ===== 种子数据 =====
function seedData() {
  const existing = getPersonalEvents();
  if (existing.length > 0) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const samples = [
    { title: '妈妈的生日', date: fmt(y, m, d + 5), type: 'birthday', repeat: 'yearly', note: '记得提前订蛋糕', reminders: [0, 1, 3] },
    { title: '在一起纪念日', date: fmt(y, m, d + 12), type: 'anniversary', repeat: 'yearly', note: '三年了，准备个惊喜', reminders: [0, 1, 7] },
    { title: '周五约会', date: fmt(y, m, d + 2), type: 'date', repeat: 'weekly', note: '那家新开的餐厅', reminders: [0, 1] },
    { title: '项目截止', date: fmt(y, m, d + 8), type: 'important', repeat: 'once', note: '最终交付', reminders: [0, 1, 3, 7] },
    { title: '爸爸的生日', date: fmt(y, m, d + 20), type: 'birthday', repeat: 'yearly', reminders: [0, 1, 3] },
    { title: '体检', date: fmt(y, m, d + 1), type: 'custom', repeat: 'once', note: '早上空腹', reminders: [0, 1] },
  ];
  for (const s of samples) saveEvent(s);
}

function fmt(y, m, d) {
  const date = new Date(y, m, d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// ===== 自定义确认弹窗（替代 confirm()，PWA 下 confirm 会失效） =====
function showConfirm(title, msg, onConfirm, icon = '⚠️') {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  confirmCallback = onConfirm;
  document.getElementById('confirmModal').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('show');
  confirmCallback = null;
}

// ===== 初始化 =====
function init() {
  seedData();
  bindNavigation();
  bindFab();
  bindEventModal();
  bindShareModal();
  bindCodeModal();
  bindJoinModal();
  bindConfirmModal();
  bindSettingsModals();
  navigateTo('home');
  startReminderCheck();

  // 检查 URL 是否有加入邀请
  checkUrlJoin();

  window.addEventListener('editevent', (e) => openEventModal(e.detail));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW注册失败:', err));
  }
}

// ===== 检查 URL 加入参数 =====
function checkUrlJoin() {
  const params = new URLSearchParams(window.location.search);
  const joinData = params.get('join');
  if (!joinData) return;

  const data = decodeShareData(joinData);
  if (!data) {
    showToast('邀请链接无效');
    return;
  }

  // 检查是否已加入
  const shared = getSharedEvents();
  if (data.inviteCode && shared.some(e => e.inviteCode === data.inviteCode)) {
    showToast('你已经加入过这个纪念日了');
    // 清除 URL 参数
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }

  pendingJoinData = data;
  const info = getEventTypeInfo(data.type || 'anniversary');
  document.getElementById('joinTitle').textContent = `${data.owner || '好友'} 邀请你加入`;
  document.getElementById('joinDesc').innerHTML =
    `${info.icon} <strong>${data.title}</strong><br>` +
    `日期：${formatDate(data.date)}<br>` +
    `类型：${info.label}<br>` +
    `加入后双方都会收到提醒通知 💞`;
  document.getElementById('joinModal').classList.add('show');

  // 清除 URL 参数
  window.history.replaceState({}, '', window.location.pathname);
}

// ===== 导航 =====
function bindNavigation() {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  const headerTitle = document.getElementById('headerTitle');
  const headerAction = document.getElementById('headerAction');
  const fab = document.getElementById('fab');

  switch (page) {
    case 'home':
      headerTitle.textContent = '念念日历';
      headerAction.style.display = 'none';
      fab.style.display = 'flex';
      renderHome();
      break;
    case 'calendar':
      headerTitle.textContent = '日历';
      headerAction.style.display = 'none';
      fab.style.display = 'flex';
      renderCalendar();
      break;
    case 'shared':
      headerTitle.textContent = '共享纪念日';
      headerAction.style.display = 'flex';
      headerAction.textContent = '+';
      fab.style.display = 'none';
      renderSharedPage();
      headerAction.onclick = () => openShareModal();
      break;
    case 'settings':
      headerTitle.textContent = '我的';
      headerAction.style.display = 'none';
      fab.style.display = 'none';
      renderSettingsPage();
      break;
  }
}

// ===== 首页 =====
function renderHome() {
  const container = document.getElementById('appContent');
  const events = getAllEvents();
  const todayDisplay = getTodayDisplay();

  const todayEvents = events.filter(e => daysUntilNext(e) === 0);
  const upcoming = sortEventsByCountdown(events).filter(e => e._days >= 0 && e._days <= 30).slice(0, 10);
  const nextEvent = upcoming[0];

  const totalEvents = events.length;
  const thisMonthCount = events.filter(e => {
    const next = getNextOccurrence(e);
    if (!next) return false;
    const now = new Date();
    return next.getMonth() === now.getMonth() && next.getFullYear() === now.getFullYear();
  }).length;

  let html = `
    <div class="page active">
      <div class="hero-card">
        <div class="hero-date">${todayDisplay}</div>
        <div class="hero-title">${getGreeting()}</div>
        <div class="hero-subtitle">${todayEvents.length > 0 ? `今天有 ${todayEvents.length} 个重要日子` : '今天暂无安排，享受美好的一天'}</div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="hero-stat-num">${totalEvents}</div><div class="hero-stat-label">总事件</div></div>
          <div class="hero-stat"><div class="hero-stat-num">${thisMonthCount}</div><div class="hero-stat-label">本月</div></div>
          <div class="hero-stat"><div class="hero-stat-num">${todayEvents.length}</div><div class="hero-stat-label">今天</div></div>
        </div>
      </div>
  `;

  if (nextEvent && nextEvent._days > 0) {
    const info = getEventTypeInfo(nextEvent.type);
    const cd = formatCountdown(nextEvent._days);
    html += `
      <div class="big-countdown">
        <div class="big-countdown-num">${cd.num}</div>
        <div class="big-countdown-label">天后</div>
        <div class="big-countdown-name">${info.icon} ${nextEvent.title}</div>
      </div>
    `;
  }

  html += `<div class="section-title">今日 · ${todayEvents.length}<span class="count">${todayEvents.length > 0 ? '别忘记哦' : ''}</span></div>`;
  if (todayEvents.length === 0) {
    html += `<div class="empty-state" style="padding:24px 12px"><div class="empty-icon">🌤️</div><div class="empty-text">今天没有安排，放松一下吧</div></div>`;
  } else {
    html += '<div class="event-list">';
    for (const event of todayEvents) html += renderEventCard(event, true);
    html += '</div>';
  }

  html += `<div class="section-title">即将到来<span class="count">30天内</span></div>`;
  const upcomingFiltered = upcoming.filter(e => e._days > 0);
  if (upcomingFiltered.length === 0) {
    html += `<div class="empty-state" style="padding:24px 12px"><div class="empty-icon">📅</div><div class="empty-text">30天内暂无事件</div></div>`;
  } else {
    html += '<div class="event-list">';
    for (const event of upcomingFiltered) html += renderEventCard(event);
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
  bindEventCardClicks(container);
}

function renderEventCard(event, isToday = false) {
  const info = getEventTypeInfo(event.type);
  const days = isToday ? 0 : event._days;
  const cd = formatCountdown(days);
  const sharedBadge = event.isShared ? `<span class="shared-badge">👥</span>` : '';
  const repeatText = { yearly: '每年', once: '一次', monthly: '每月', weekly: '每周' }[event.repeat] || '每年';
  return `
    <div class="event-card" data-id="${event.id}">
      <div class="event-bar ${info.cls}"></div>
      <div class="event-icon ${info.cls}">${info.icon}</div>
      <div class="event-info">
        <div class="event-name">${event.title}${sharedBadge}</div>
        <div class="event-meta">${info.label} · ${repeatText}${event.isShared ? ' · 共享' : ''}</div>
        ${event.note ? `<div class="event-note">${event.note}</div>` : ''}
      </div>
      <div class="event-countdown">
        <div class="countdown-num ${cd.cls}">${cd.num}</div>
        <div class="countdown-label">${cd.label}</div>
      </div>
    </div>
  `;
}

function bindEventCardClicks(container) {
  container.querySelectorAll('.event-card').forEach(el => {
    el.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('editevent', { detail: el.dataset.id }));
    });
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，早点休息';
  if (h < 12) return '早上好，新的一天';
  if (h < 14) return '中午好，记得吃饭';
  if (h < 18) return '下午好，继续加油';
  if (h < 22) return '晚上好，放松一下';
  return '夜深了，注意休息';
}

// ===== 共享纪念日页面 =====
function renderSharedPage() {
  const container = document.getElementById('appContent');
  const sharedEvents = getSharedEvents();

  let html = '<div class="page active">';
  html += `
    <div class="hero-card" style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);">
      <div class="hero-title">共享纪念日</div>
      <div class="hero-subtitle">邀请好友一起记录属于你们的重要日子</div>
      <div class="hero-subtitle" style="margin-top:6px">双方都会收到提醒通知 💞</div>
    </div>
  `;

  if (sharedEvents.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">💌</div><div class="empty-text">还没有共享纪念日</div><div class="empty-text" style="margin-top:8px;font-size:12px">点击右上角 + 创建</div></div>`;
  } else {
    html += `<div class="section-title">共享列表 · ${sharedEvents.length}</div>`;
    for (const event of sharedEvents) {
      const info = getEventTypeInfo(event.type);
      const days = daysUntilNext(event);
      const members = event.members || [];
      const memberBadges = members.map(m =>
        `<div class="member-avatar" style="${m.isOwner ? 'background:var(--primary);' : ''}">${(m.name || '?').charAt(0)}</div>`
      ).join('');
      const daysText = days === 0 ? '就是今天🎉' : days !== null ? `还有${days}天` : '已过';

      html += `
        <div class="shared-card" data-id="${event.id}">
          <div class="shared-card-header">
            <div class="shared-card-icon">${info.icon}</div>
            <div class="shared-card-title">${event.title}</div>
            <div class="shared-card-code">${event.inviteCode}</div>
          </div>
          <div class="shared-card-meta">${info.label} · ${formatDate(event.date)} · ${daysText}</div>
          ${event.note ? `<div class="shared-card-meta" style="margin-top:4px;color:var(--text-light)">${event.note}</div>` : ''}
          <div class="shared-card-members">${memberBadges}<span>${members.map(m => m.name).join('、')}</span></div>
          <button class="btn-secondary btn-block share-again-btn" data-id="${event.id}" style="margin-top:10px;font-size:13px;padding:8px;">📤 再次分享链接</button>
        </div>
      `;
    }
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.shared-card').forEach(el => {
    el.addEventListener('click', (e) => {
      // 如果点的是分享按钮，不打开编辑
      if (e.target.classList.contains('share-again-btn')) {
        e.stopPropagation();
        const event = getEventById(el.dataset.id);
        if (event) showShareLink(event);
        return;
      }
      openEventModal(el.dataset.id);
    });
  });
}

// ===== 设置页面 =====
function renderSettingsPage() {
  const container = document.getElementById('appContent');
  const profile = getProfile();
  const settings = getSettings();
  const notifStatus = getNotificationStatus();
  const totalEvents = getAllEvents().length;
  const notifText = { granted: '已开启', denied: '已拒绝', unsupported: '不支持', default: '未开启' }[notifStatus] || '未开启';

  container.innerHTML = `
    <div class="page active">
      <div class="hero-card" style="text-align:center;padding:28px 20px;">
        <div style="font-size:56px;margin-bottom:8px;">${profile.avatar}</div>
        <div class="hero-title" style="font-size:22px;">${profile.name}</div>
        <div class="hero-subtitle">已记录 ${totalEvents} 个重要日子</div>
      </div>

      <div class="settings-group">
        <div class="settings-item" id="settingNotif">
          <div class="settings-icon" style="background:rgba(124,58,237,0.1)">🔔</div>
          <div class="settings-label">通知提醒</div>
          <div class="settings-value">${notifText}</div>
          <div class="toggle ${settings.notifications ? 'on' : ''}"></div>
        </div>
        <div class="settings-item" id="settingSound">
          <div class="settings-icon" style="background:rgba(245,158,11,0.1)">🔊</div>
          <div class="settings-label">提醒声音</div>
          <div class="toggle ${settings.sound ? 'on' : ''}"></div>
        </div>
        <div class="settings-item" id="settingTest">
          <div class="settings-icon" style="background:rgba(16,185,129,0.1)">📋</div>
          <div class="settings-label">发送测试通知</div>
          <div class="settings-arrow">›</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-item" id="settingName">
          <div class="settings-icon" style="background:rgba(59,130,246,0.1)">👤</div>
          <div class="settings-label">我的昵称</div>
          <div class="settings-value">${profile.name}</div>
          <div class="settings-arrow">›</div>
        </div>
        <div class="settings-item" id="settingAvatar">
          <div class="settings-icon" style="background:rgba(255,107,157,0.1)">😊</div>
          <div class="settings-label">我的头像</div>
          <div class="settings-value">${profile.avatar}</div>
          <div class="settings-arrow">›</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-item" id="settingInstall" style="cursor:pointer;">
          <div class="settings-icon" style="background:rgba(16,185,129,0.1)">📱</div>
          <div class="settings-label">安装到手机桌面</div>
          <div class="settings-arrow">›</div>
        </div>
        <div class="settings-item" id="settingExport">
          <div class="settings-icon" style="background:rgba(168,85,247,0.1)">📤</div>
          <div class="settings-label">导出数据</div>
          <div class="settings-arrow">›</div>
        </div>
        <div class="settings-item" id="settingClear">
          <div class="settings-icon" style="background:rgba(239,68,68,0.1)">🗑️</div>
          <div class="settings-label" style="color:var(--danger)">清空所有数据</div>
          <div class="settings-arrow">›</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-item">
          <div class="settings-icon" style="background:rgba(124,58,237,0.1)">📱</div>
          <div class="settings-label">版本</div>
          <div class="settings-value">v1.1.0</div>
        </div>
        <div class="settings-item">
          <div class="settings-icon" style="background:rgba(244,63,94,0.1)">💝</div>
          <div class="settings-label">念念日历</div>
          <div class="settings-value">念念不忘的日子</div>
        </div>
      </div>
    </div>
  `;
  bindSettingsEvents(settings, profile);
}

function bindSettingsEvents(settings, profile) {
  document.getElementById('settingNotif').addEventListener('click', async () => {
    if (!settings.notifications) {
      const granted = await requestNotificationPermission();
      if (granted) {
        settings.notifications = true;
        saveSettings(settings);
        showToast('通知已开启');
      } else {
        showToast('请在浏览器设置中允许通知');
        return;
      }
    } else {
      settings.notifications = !settings.notifications;
      saveSettings(settings);
    }
    renderSettingsPage();
  });

  document.getElementById('settingSound').addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings(settings);
    renderSettingsPage();
  });

  document.getElementById('settingTest').addEventListener('click', () => {
    if (getNotificationStatus() !== 'granted') {
      showToast('请先开启通知权限');
      return;
    }
    sendTestNotification();
    showToast('测试通知已发送');
  });

  document.getElementById('settingName').addEventListener('click', () => {
    const name = prompt('输入你的昵称', profile.name);
    if (name && name.trim()) {
      profile.name = name.trim();
      saveProfile(profile);
      showToast('已保存');
      renderSettingsPage();
    }
  });

  document.getElementById('settingAvatar').addEventListener('click', () => {
    const input = prompt('输入一个 emoji 作为头像', profile.avatar);
    if (input && input.trim()) {
      profile.avatar = input.trim().charAt(0);
      saveProfile(profile);
      showToast('已保存');
      renderSettingsPage();
    }
  });

  // 安装指南
  document.getElementById('settingInstall').addEventListener('click', () => {
    window.open('install-guide.html', '_blank');
  });

  document.getElementById('settingExport').addEventListener('click', () => {
    const data = {
      events: getPersonalEvents(),
      shared: getSharedEvents(),
      profile: getProfile(),
      settings: getSettings(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `念念日历_备份_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
  });

  // 清空数据 — 用自定义确认弹窗替代 confirm()
  document.getElementById('settingClear').addEventListener('click', () => {
    showConfirm('清空所有数据', '确定要清空所有纪念日和事件吗？此操作不可撤销！', () => {
      localStorage.removeItem('memoday_events');
      localStorage.removeItem('memoday_shared');
      showToast('数据已清空');
      renderSettingsPage();
    }, '🗑️');
  });
}

// 设置页面的弹窗绑定（清空确认等已用 showConfirm）
function bindSettingsModals() {
  // 占位，设置事件在 renderSettingsPage 中绑定
}

// ===== 事件编辑弹窗 =====
function bindFab() {
  document.getElementById('fab').addEventListener('click', () => {
    const presetDate = currentPage === 'calendar' ? calendarSelectedDate : null;
    openEventModal(null, presetDate);
  });
}

function bindEventModal() {
  const modal = document.getElementById('eventModal');
  document.getElementById('modalClose').addEventListener('click', closeEventModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeEventModal(); });

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
    });
  });

  document.getElementById('eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleEventSave();
  });

  // 删除按钮 — 用自定义确认弹窗替代 confirm()
  document.getElementById('btnDelete').addEventListener('click', () => {
    if (!editingEventId) return;
    const event = getEventById(editingEventId);
    if (!event) return;

    showConfirm('删除事件', `确定要删除「${event.title}」吗？${event.isShared ? '删除后你将不再收到此共享纪念日的提醒。' : '此操作不可撤销。'}`, () => {
      if (event.isShared) {
        deleteSharedEvent(editingEventId);
      } else {
        deleteEvent(editingEventId);
      }
      closeEventModal();
      showToast('已删除');
      refreshCurrentPage();
    }, '🗑️');
  });
}

function openEventModal(eventId, presetDate) {
  editingEventId = eventId;
  isSharedCreate = false;
  const modal = document.getElementById('eventModal');
  const modalTitle = document.getElementById('modalTitle');
  const deleteBtn = document.getElementById('btnDelete');

  if (eventId) {
    const event = getEventById(eventId);
    if (!event) return;

    modalTitle.textContent = event.isShared ? '编辑共享纪念日' : '编辑事件';
    deleteBtn.style.display = 'block';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventLunar').value = event.lunar ? 'true' : 'false';
    document.getElementById('eventRepeat').value = event.repeat || 'yearly';
    document.getElementById('eventNote').value = event.note || '';

    selectedType = event.type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === event.type));

    const reminders = event.reminders || [0, 1];
    document.querySelectorAll('#reminderOptions input').forEach(input => {
      input.checked = reminders.includes(parseInt(input.value));
    });
  } else {
    modalTitle.textContent = '新建事件';
    deleteBtn.style.display = 'none';
    document.getElementById('eventId').value = '';
    document.getElementById('eventForm').reset();
    document.getElementById('eventDate').value = presetDate || todayStr();
    document.getElementById('eventRepeat').value = 'yearly';

    selectedType = 'birthday';
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'birthday'));

    const settings = getSettings();
    const defaultReminder = settings.defaultReminder || [0, 1];
    document.querySelectorAll('#reminderOptions input').forEach(input => {
      input.checked = defaultReminder.includes(parseInt(input.value));
    });
  }

  modal.classList.add('show');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('show');
  editingEventId = null;
  isSharedCreate = false;
}

function handleEventSave() {
  const id = document.getElementById('eventId').value;
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const repeat = document.getElementById('eventRepeat').value;
  const note = document.getElementById('eventNote').value.trim();
  const lunar = document.getElementById('eventLunar').value === 'true';

  const reminders = [];
  document.querySelectorAll('#reminderOptions input:checked').forEach(input => {
    reminders.push(parseInt(input.value));
  });

  if (!title || !date) {
    showToast('请填写事件名称和日期');
    return;
  }

  const eventData = { title, date, type: selectedType, repeat, note, lunar, reminders };

  if (isSharedCreate) {
    const profile = getProfile();
    const event = createSharedEvent(eventData, profile.name);
    closeEventModal();
    showToast('共享纪念日已创建');
    showShareLink(event);
    refreshCurrentPage();
    return;
  }

  if (id) {
    const existing = getEventById(id);
    if (existing && existing.isShared) {
      updateSharedEvent(id, eventData);
    } else {
      saveEvent({ id, ...eventData });
    }
    showToast('已保存');
  } else {
    saveEvent(eventData);
    showToast('已创建');
  }

  closeEventModal();
  refreshCurrentPage();
  checkReminders();
}

// ===== 共享弹窗 =====
function bindShareModal() {
  const modal = document.getElementById('shareModal');
  document.getElementById('shareModalClose').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

  document.getElementById('btnCreateShared').addEventListener('click', () => {
    modal.classList.remove('show');
    openSharedEventModal();
  });
}

function openShareModal() {
  document.getElementById('shareModal').classList.add('show');
}

function openSharedEventModal() {
  isSharedCreate = true;
  const modal = document.getElementById('eventModal');
  document.getElementById('modalTitle').textContent = '创建共享纪念日';
  document.getElementById('btnDelete').style.display = 'none';
  document.getElementById('eventId').value = '';
  document.getElementById('eventForm').reset();
  document.getElementById('eventDate').value = todayStr();
  document.getElementById('eventRepeat').value = 'yearly';

  selectedType = 'anniversary';
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'anniversary'));

  const settings = getSettings();
  const defaultReminder = settings.defaultReminder || [0, 1];
  document.querySelectorAll('#reminderOptions input').forEach(input => {
    input.checked = defaultReminder.includes(parseInt(input.value));
  });

  modal.classList.add('show');
}

// ===== 分享链接弹窗 =====
function bindCodeModal() {
  const modal = document.getElementById('codeModal');
  document.getElementById('codeModalClose').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

  document.getElementById('btnShareLink').addEventListener('click', () => {
    const link = document.getElementById('shareLinkDisplay').textContent;
    const code = document.getElementById('inviteCodeTag').querySelector('span').textContent;
    const profile = getProfile();
    const text = `${profile.name} 邀请你一起记录纪念日「${currentShareEventTitle}」💞\n点击链接加入：\n${link}`;
    if (navigator.share) {
      navigator.share({ title: '念念日历邀请', text, url: link });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('邀请信息已复制，去发给好友吧'));
    }
  });

  document.getElementById('btnCopyLink').addEventListener('click', () => {
    const link = document.getElementById('shareLinkDisplay').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => showToast('链接已复制'));
    } else {
      showToast('请手动长按复制链接');
    }
  });
}

let currentShareEventTitle = '';

function showShareLink(event) {
  currentShareEventTitle = event.title;
  const link = generateShareLink(event);
  document.getElementById('shareLinkDisplay').textContent = link;
  document.getElementById('inviteCodeTag').innerHTML = `邀请码：<span>${event.inviteCode}</span>`;
  document.getElementById('codeModal').classList.add('show');
}

// ===== 加入确认弹窗 =====
function bindJoinModal() {
  const modal = document.getElementById('joinModal');
  document.getElementById('btnJoinCancel').addEventListener('click', () => {
    modal.classList.remove('show');
    pendingJoinData = null;
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      pendingJoinData = null;
    }
  });

  document.getElementById('btnJoinConfirm').addEventListener('click', () => {
    if (!pendingJoinData) return;
    const profile = getProfile();
    const result = importSharedEvent(pendingJoinData, profile.name);
    modal.classList.remove('show');
    if (result.success) {
      showToast('加入成功！双方都会收到提醒 💞');
      navigateTo('shared');
    } else {
      showToast(result.error);
    }
    pendingJoinData = null;
  });
}

// ===== 确认弹窗 =====
function bindConfirmModal() {
  const modal = document.getElementById('confirmModal');
  document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirm);
  document.getElementById('btnConfirmOk').addEventListener('click', () => {
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeConfirm();
  });
}

// ===== 工具 =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function refreshCurrentPage() {
  navigateTo(currentPage);
}

// ===== 启动 =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
