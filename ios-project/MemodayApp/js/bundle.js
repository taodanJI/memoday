// ===== 念念日历 打包版 (无ES Module依赖，兼容WKWebView) =====
// 文件顺序: db.js -> utils.js -> calendar.js -> notify.js -> app.js

// ########## db.js ##########
const STORAGE_KEYS = {
  events: 'memoday_events',
  shared: 'memoday_shared',
  profile: 'memoday_profile',
  settings: 'memoday_settings',
};

function loadData(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('加载数据失败:', key, e);
    return null;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('保存数据失败:', key, e);
    return false;
  }
}

function getAllEvents() {
  const personal = loadData(STORAGE_KEYS.events) || [];
  const shared = getSharedEvents();
  return [...personal, ...shared];
}

function getPersonalEvents() {
  return loadData(STORAGE_KEYS.events) || [];
}

function saveEvent(event) {
  const events = getPersonalEvents();
  if (event.id) {
    const idx = events.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      events[idx] = { ...events[idx], ...event };
    } else {
      events.push(event);
    }
  } else {
    event.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    event.createdAt = Date.now();
    events.push(event);
  }
  saveData(STORAGE_KEYS.events, events);
  return event;
}

function deleteEvent(id) {
  const events = getPersonalEvents();
  const filtered = events.filter(e => e.id !== id);
  saveData(STORAGE_KEYS.events, filtered);
}

function getEventById(id) {
  const all = getAllEvents();
  return all.find(e => e.id === id);
}

function getSharedEvents() {
  return loadData(STORAGE_KEYS.shared) || [];
}

function createSharedEvent(eventData, ownerName) {
  const shared = getSharedEvents();
  const code = generateInviteCode();
  const event = {
    id: 'shr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    ...eventData,
    isShared: true,
    inviteCode: code,
    owner: ownerName || '我',
    members: [{ name: ownerName || '我', isOwner: true, joinedAt: Date.now() }],
    createdAt: Date.now(),
  };
  shared.push(event);
  saveData(STORAGE_KEYS.shared, shared);
  return event;
}

function deleteSharedEvent(id) {
  const shared = getSharedEvents();
  const filtered = shared.filter(e => e.id !== id);
  saveData(STORAGE_KEYS.shared, filtered);
}

function updateSharedEvent(id, updates) {
  const shared = getSharedEvents();
  const idx = shared.findIndex(e => e.id === id);
  if (idx >= 0) {
    shared[idx] = { ...shared[idx], ...updates };
    saveData(STORAGE_KEYS.shared, shared);
    return shared[idx];
  }
  return null;
}

function getProfile() {
  return loadData(STORAGE_KEYS.profile) || { name: '我', avatar: '😊' };
}

function saveProfile(profile) {
  saveData(STORAGE_KEYS.profile, profile);
}

function getSettings() {
  return loadData(STORAGE_KEYS.settings) || {
    notifications: true,
    sound: true,
    defaultReminder: [0, 1],
  };
}

function saveSettings(settings) {
  saveData(STORAGE_KEYS.settings, settings);
}

function encodeShareData(event) {
  const payload = {
    t: event.title,
    d: event.date,
    y: event.type,
    r: event.repeat || 'yearly',
    n: event.note || '',
    l: event.lunar ? true : false,
    m: event.reminders || [0, 1],
    o: event.owner || '好友',
    c: event.inviteCode || '',
  };
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeShareData(encoded) {
  try {
    let base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const json = decodeURIComponent(atob(base64));
    const payload = JSON.parse(json);
    return {
      title: payload.t,
      date: payload.d,
      type: payload.y,
      repeat: payload.r,
      note: payload.n,
      lunar: payload.l,
      reminders: payload.m,
      owner: payload.o,
      inviteCode: payload.c,
    };
  } catch (e) {
    console.error('解码失败:', e);
    return null;
  }
}

function importSharedEvent(data, myName) {
  const shared = getSharedEvents();
  if (data.inviteCode && shared.some(e => e.inviteCode === data.inviteCode)) {
    return { success: false, error: '你已经加入过这个纪念日了' };
  }
  const event = {
    id: 'shr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title: data.title,
    date: data.date,
    type: data.type || 'anniversary',
    repeat: data.repeat || 'yearly',
    note: data.note || '',
    lunar: data.lunar || false,
    reminders: data.reminders || [0, 1],
    isShared: true,
    inviteCode: data.inviteCode || generateInviteCode(),
    owner: data.owner || '好友',
    members: [
      { name: data.owner || '好友', isOwner: true, joinedAt: Date.now() },
      { name: myName || '我', isOwner: false, joinedAt: Date.now() },
    ],
    createdAt: Date.now(),
  };
  shared.push(event);
  saveData(STORAGE_KEYS.shared, shared);
  return { success: true, event };
}

function generateShareLink(event) {
  const encoded = encodeShareData(event);
  const base = window.location.origin + window.location.pathname;
  return `${base}?join=${encoded}`;
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  const shared = getSharedEvents();
  if (shared.some(e => e.inviteCode === code)) {
    return generateInviteCode();
  }
  return code;
}

function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ########## utils.js ##########
const EVENT_TYPES = {
  birthday:    { label: '生日',    icon: '🎂', color: '#FF6B9D', cls: 'birthday' },
  anniversary: { label: '纪念日',  icon: '💝', color: '#A855F7', cls: 'anniversary' },
  date:        { label: '约会',    icon: '🌹', color: '#F43F5E', cls: 'date' },
  important:   { label: '重要',    icon: '⭐', color: '#F59E0B', cls: 'important' },
  custom:      { label: '自定义',  icon: '📌', color: '#3B82F6', cls: 'custom' },
};

function formatDate(date, fmt) {
  fmt = fmt || 'YYYY年MM月DD日';
  if (typeof date === 'string') date = new Date(date);
  if (!(date instanceof Date) || isNaN(date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return fmt
    .replace('YYYY', y)
    .replace('MM', m)
    .replace('DD', d)
    .replace('WW', weekdays[date.getDay()]);
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function daysUntilNext(event) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const eventDate = parseDate(event.date);
  if (!eventDate) return null;
  if (event.repeat === 'once') {
    const diff = Math.floor((eventDate - now) / 86400000);
    return diff;
  }
  const next = getNextOccurrence(event, now);
  if (!next) return null;
  const diff = Math.floor((next - now) / 86400000);
  return diff;
}

function getNextOccurrence(event, fromDate) {
  fromDate = fromDate || new Date();
  fromDate.setHours(0, 0, 0, 0);
  const eventDate = parseDate(event.date);
  if (!eventDate) return null;
  if (event.repeat === 'once') {
    return eventDate >= fromDate ? eventDate : null;
  }
  if (event.repeat === 'yearly') {
    let year = fromDate.getFullYear();
    let next = new Date(year, eventDate.getMonth(), eventDate.getDate());
    if (next < fromDate) {
      next = new Date(year + 1, eventDate.getMonth(), eventDate.getDate());
    }
    return next;
  }
  if (event.repeat === 'monthly') {
    let year = fromDate.getFullYear();
    let month = fromDate.getMonth();
    let next = new Date(year, month, eventDate.getDate());
    if (next < fromDate) {
      next = new Date(year, month + 1, eventDate.getDate());
    }
    return next;
  }
  if (event.repeat === 'weekly') {
    const dayOfWeek = eventDate.getDay();
    let next = new Date(fromDate);
    let diff = (dayOfWeek - next.getDay() + 7) % 7;
    if (diff === 0 && next.getTime() === fromDate.getTime()) {
      return next;
    }
    next.setDate(next.getDate() + diff);
    if (next < fromDate) next.setDate(next.getDate() + 7);
    return next;
  }
  return eventDate;
}

function getEventsOnDate(events, dateStr) {
  const date = parseDate(dateStr);
  if (!date) return [];
  const result = [];
  for (const event of events) {
    const next = getNextOccurrence(event, date);
    if (next) {
      const nextStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
      if (nextStr === dateStr) {
        result.push({ ...event, nextDate: next });
      }
    }
    if (event.repeat === 'once' && event.date === dateStr) {
      if (!result.find(r => r.id === event.id)) {
        result.push({ ...event, nextDate: date });
      }
    }
  }
  return result;
}

function getEventDatesInMonth(events, year, month) {
  const dates = new Set();
  const lastDay = new Date(year, month + 1, 0);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = getEventsOnDate(events, dateStr);
    if (dayEvents.length > 0) {
      dates.add(d);
    }
  }
  return dates;
}

function getEventTypeInfo(type) {
  return EVENT_TYPES[type] || EVENT_TYPES.custom;
}

function getTodayDisplay() {
  const now = new Date();
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  return `${now.getFullYear()}年${months[now.getMonth()]}${now.getDate()}日 ${weekdays[now.getDay()]}`;
}

function sortEventsByCountdown(events) {
  return events.map(e => ({ ...e, _days: daysUntilNext(e) }))
    .filter(e => e._days !== null && e._days >= 0)
    .sort((a, b) => a._days - b._days);
}

function formatCountdown(days) {
  if (days === 0) return { num: '今天', label: '就是今天', cls: 'today' };
  if (days === 1) return { num: '1', label: '天后', cls: 'soon' };
  if (days <= 7) return { num: String(days), label: '天后', cls: 'soon' };
  return { num: String(days), label: '天后', cls: '' };
}

// ########## calendar.js ##########
let calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedDate: todayStr(),
};

function renderCalendar() {
  const container = document.getElementById('appContent');
  container.innerHTML = `
    <div class="page active">
      <div class="calendar-header">
        <div class="cal-title">${calState.year}年${calState.month + 1}月</div>
        <div class="cal-nav">
          <button id="calPrev">‹</button>
          <button id="calToday">今</button>
          <button id="calNext">›</button>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="cal-weekdays">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div class="cal-days" id="calDays"></div>
      </div>
      <div class="day-events" id="dayEvents"></div>
    </div>
  `;
  renderCalendarDays();
  renderDayEvents();
  document.getElementById('calPrev').addEventListener('click', () => {
    calState.month--;
    if (calState.month < 0) { calState.month = 11; calState.year--; }
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calState.month++;
    if (calState.month > 11) { calState.month = 0; calState.year++; }
    renderCalendar();
  });
  document.getElementById('calToday').addEventListener('click', () => {
    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    calState.selectedDate = todayStr();
    renderCalendar();
  });
}

function renderCalendarDays() {
  const daysContainer = document.getElementById('calDays');
  const events = getAllEvents();
  const today = todayStr();
  const firstDay = new Date(calState.year, calState.month, 1);
  const lastDay = new Date(calState.year, calState.month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevMonthLastDay = new Date(calState.year, calState.month, 0).getDate();
  let html = '';
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    html += `<div class="cal-day other-month">${day}</div>`;
  }
  const eventDates = getEventDatesInMonth(events, calState.year, calState.month);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calState.year}-${String(calState.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSelected = dateStr === calState.selectedDate;
    const isToday = dateStr === today;
    let dotsHtml = '';
    if (eventDates.has(d)) {
      const dayEvents = getEventsOnDate(events, dateStr);
      const types = [...new Set(dayEvents.map(e => e.type))].slice(0, 3);
      dotsHtml = '<div class="cal-dots">' +
        types.map(t => `<span class="cal-dot ${getEventTypeInfo(t).cls}"></span>`).join('') +
        '</div>';
    }
    const classes = ['cal-day'];
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');
    html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${d}${dotsHtml}</div>`;
  }
  const totalCells = startWeekday + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month">${i}</div>`;
  }
  daysContainer.innerHTML = html;
  daysContainer.querySelectorAll('.cal-day[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      calState.selectedDate = el.dataset.date;
      if (window.setCalSelectedDate) window.setCalSelectedDate(el.dataset.date);
      renderCalendarDays();
      renderDayEvents();
    });
  });
}

function renderDayEvents() {
  const container = document.getElementById('dayEvents');
  const events = getAllEvents();
  const date = calState.selectedDate;
  const dayEvents = getEventsOnDate(events, date);
  const dateDisplay = formatDate(date, 'MM月DD日 星期WW');
  let html = `<div class="day-events-title">${dateDisplay} · ${dayEvents.length}个事件</div>`;
  if (dayEvents.length === 0) {
    html += `
      <div class="empty-state" style="padding:24px 12px">
        <div class="empty-text">这一天还没有事件</div>
        <div class="empty-text" style="margin-top:8px;font-size:12px">点击右下角 + 添加</div>
      </div>
    `;
  } else {
    html += '<div class="event-list">';
    for (const event of dayEvents) {
      const info = getEventTypeInfo(event.type);
      const sharedBadge = event.isShared
        ? `<span class="shared-badge">👥 共享</span>` : '';
      const memberInfo = event.isShared && event.members
        ? ` · ${event.members.length}人共享` : '';
      html += `
        <div class="event-card" data-id="${event.id}">
          <div class="event-bar ${info.cls}"></div>
          <div class="event-icon ${info.cls}">${info.icon}</div>
          <div class="event-info">
            <div class="event-name">${event.title}${sharedBadge}</div>
            <div class="event-meta">${info.label}${memberInfo}</div>
            ${event.note ? `<div class="event-note">${event.note}</div>` : ''}
          </div>
          <div class="event-countdown">
            <div class="countdown-num today">今天</div>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.event-card').forEach(el => {
    el.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('editevent', { detail: el.dataset.id }));
    });
  });
}

// ########## notify.js ##########
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('此浏览器不支持通知');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendNotification(title, options) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const settings = getSettings();
  if (!settings.notifications) return;
  try {
    const notification = new Notification(title, {
      body: options.body || '',
      icon: options.icon || '',
      tag: options.tag || Date.now().toString(),
      badge: options.badge,
      requireInteraction: false,
      silent: !settings.sound,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };
    setTimeout(() => notification.close(), 8000);
  } catch (e) {
    console.error('通知发送失败:', e);
  }
}

function checkReminders() {
  const events = getAllEvents();
  const settings = getSettings();
  if (!settings.notifications) return;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStrVal = formatDateStr(today);
  const tomorrowStrVal = formatDateStr(tomorrow);
  let todayEvents = [];
  let tomorrowEvents = [];
  for (const event of events) {
    const days = daysUntilNext(event);
    if (days === null) continue;
    const reminderDays = event.reminders || settings.defaultReminder || [0, 1];
    for (const rd of reminderDays) {
      if (days === rd) {
        if (rd === 0) {
          todayEvents.push(event);
        } else if (rd === 1) {
          tomorrowEvents.push(event);
        } else if (days === rd) {
          const info = getEventTypeInfo(event.type);
          sendNotification(`【${info.label}提醒】${event.title}`, {
            body: `还有${days}天就是「${event.title}」了，别忘了准备哦！${event.note ? '\n备注：' + event.note : ''}`,
            tag: `reminder_${event.id}_${days}d`,
          });
        }
      }
    }
  }
  if (tomorrowEvents.length > 0) {
    for (const event of tomorrowEvents) {
      const info = getEventTypeInfo(event.type);
      const sharedText = event.isShared ? '（共享纪念日）' : '';
      sendNotification(`【明天提醒】${event.title}`, {
        body: `明天就是「${event.title}」${sharedText}啦！${event.note ? '\n' + event.note : ''}`,
        tag: `reminder_${event.id}_1d`,
      });
    }
  }
  if (todayEvents.length > 0) {
    for (const event of todayEvents) {
      const info = getEventTypeInfo(event.type);
      const sharedText = event.isShared ? '（共享纪念日）' : '';
      sendNotification(`【今天】${event.title}`, {
        body: `今天是「${event.title}」${sharedText}🎉 ${event.note ? '\n' + event.note : ''}`,
        tag: `reminder_${event.id}_0d`,
      });
    }
  }
  return { today: todayEvents.length, tomorrow: tomorrowEvents.length };
}

function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getNotificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

let checkInterval = null;
function startReminderCheck() {
  checkReminders();
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkReminders, 60 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkReminders();
    }
  });
}

function sendTestNotification() {
  sendNotification('念念日历 🎉', {
    body: '通知功能已开启！重要纪念日会提前提醒你。',
    tag: 'test_notification',
  });
}

// ########## app.js ##########
let currentPage = 'home';
let editingEventId = null;
let isSharedCreate = false;
let selectedType = 'birthday';
let calendarSelectedDate = null;
let pendingJoinData = null;
let confirmCallback = null;
let currentShareEventTitle = '';

window.setCalSelectedDate = (date) => { calendarSelectedDate = date; };

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

function showConfirm(title, msg, onConfirm, icon) {
  icon = icon || '⚠️';
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

function init() {
  seedData();
  bindNavigation();
  bindFab();
  bindEventModal();
  bindShareModal();
  bindCodeModal();
  bindJoinModal();
  bindConfirmModal();
  navigateTo('home');
  startReminderCheck();
  checkUrlJoin();
  window.addEventListener('editevent', (e) => openEventModal(e.detail));
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW注册失败:', err));
  }
}

function checkUrlJoin() {
  const params = new URLSearchParams(window.location.search);
  const joinData = params.get('join');
  if (!joinData) return;
  const data = decodeShareData(joinData);
  if (!data) {
    showToast('邀请链接无效');
    return;
  }
  const shared = getSharedEvents();
  if (data.inviteCode && shared.some(e => e.inviteCode === data.inviteCode)) {
    showToast('你已经加入过这个纪念日了');
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
  window.history.replaceState({}, '', window.location.pathname);
}

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

function renderEventCard(event, isToday) {
  isToday = isToday || false;
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
  document.getElementById('settingInstall').addEventListener('click', () => {
    showToast('已安装到桌面');
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
  document.getElementById('settingClear').addEventListener('click', () => {
    showConfirm('清空所有数据', '确定要清空所有纪念日和事件吗？此操作不可撤销！', () => {
      localStorage.removeItem('memoday_events');
      localStorage.removeItem('memoday_shared');
      showToast('数据已清空');
      renderSettingsPage();
    }, '🗑️');
  });
}

function bindSettingsModals() {}

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

function bindCodeModal() {
  const modal = document.getElementById('codeModal');
  document.getElementById('codeModalClose').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
  document.getElementById('btnShareLink').addEventListener('click', () => {
    const link = document.getElementById('shareLinkDisplay').textContent;
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

function showShareLink(event) {
  currentShareEventTitle = event.title;
  const link = generateShareLink(event);
  document.getElementById('shareLinkDisplay').textContent = link;
  document.getElementById('inviteCodeTag').innerHTML = `邀请码：<span>${event.inviteCode}</span>`;
  document.getElementById('codeModal').classList.add('show');
}

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

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function refreshCurrentPage() {
  navigateTo(currentPage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
