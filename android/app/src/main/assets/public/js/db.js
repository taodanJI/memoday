// ===== 数据存储层 =====
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

// ===== 事件数据管理 =====
export function getAllEvents() {
  const personal = loadData(STORAGE_KEYS.events) || [];
  const shared = getSharedEvents();
  return [...personal, ...shared];
}

export function getPersonalEvents() {
  return loadData(STORAGE_KEYS.events) || [];
}

export function saveEvent(event) {
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

export function deleteEvent(id) {
  const events = getPersonalEvents();
  const filtered = events.filter(e => e.id !== id);
  saveData(STORAGE_KEYS.events, filtered);
}

export function getEventById(id) {
  const all = getAllEvents();
  return all.find(e => e.id === id);
}

// ===== 共享事件管理 =====
export function getSharedEvents() {
  return loadData(STORAGE_KEYS.shared) || [];
}

export function createSharedEvent(eventData, ownerName) {
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

export function joinSharedEventByCode(code, userName) {
  // 已废弃：纯前端无法跨设备查找邀请码，改为链接导入
  // 保留函数防止外部引用报错
  return { success: false, error: '请让好友通过分享链接邀请你加入' };
}

export function deleteSharedEvent(id) {
  const shared = getSharedEvents();
  const filtered = shared.filter(e => e.id !== id);
  saveData(STORAGE_KEYS.shared, filtered);
}

export function updateSharedEvent(id, updates) {
  const shared = getSharedEvents();
  const idx = shared.findIndex(e => e.id === id);
  if (idx >= 0) {
    shared[idx] = { ...shared[idx], ...updates };
    saveData(STORAGE_KEYS.shared, shared);
    return shared[idx];
  }
  return null;
}

export function getSharedEventByCode(code) {
  const shared = getSharedEvents();
  return shared.find(e => e.inviteCode === code.toUpperCase());
}

// ===== 个人资料 =====
export function getProfile() {
  return loadData(STORAGE_KEYS.profile) || { name: '我', avatar: '😊' };
}

export function saveProfile(profile) {
  saveData(STORAGE_KEYS.profile, profile);
}

// ===== 设置 =====
export function getSettings() {
  return loadData(STORAGE_KEYS.settings) || {
    notifications: true,
    sound: true,
    defaultReminder: [0, 1],
  };
}

export function saveSettings(settings) {
  saveData(STORAGE_KEYS.settings, settings);
}

// ===== 链接编码/解码（用于跨设备共享） =====

// 将共享事件编码为 URL 安全的 Base64 字符串
export function encodeShareData(event) {
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
  // encodeURIComponent + btoa 确保中文也能正确编码
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 从 Base64 字符串解码共享事件数据
export function decodeShareData(encoded) {
  try {
    // 还原 Base64
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

// 导入好友分享的共享事件到本地
export function importSharedEvent(data, myName) {
  const shared = getSharedEvents();

  // 用 inviteCode 去重，避免重复导入
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

// 生成分享链接
export function generateShareLink(event) {
  const encoded = encodeShareData(event);
  const base = window.location.origin + window.location.pathname;
  return `${base}?join=${encoded}`;
}

// ===== 工具函数 =====
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

export function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
