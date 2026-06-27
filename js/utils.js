// ===== 日期工具函数 =====

// 事件类型配置
export const EVENT_TYPES = {
  birthday:    { label: '生日',    icon: '🎂', color: '#FF6B9D', cls: 'birthday' },
  anniversary: { label: '纪念日',  icon: '💝', color: '#A855F7', cls: 'anniversary' },
  date:        { label: '约会',    icon: '🌹', color: '#F43F5E', cls: 'date' },
  important:   { label: '重要',    icon: '⭐', color: '#F59E0B', cls: 'important' },
  custom:      { label: '自定义',  icon: '📌', color: '#3B82F6', cls: 'custom' },
};

// 格式化日期
export function formatDate(date, fmt = 'YYYY年MM月DD日') {
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

export function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

export function parseDate(str) {
  if (!str) return null;
  const parts = str.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// 计算距离下一个纪念日还有多少天
export function daysUntilNext(event) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const eventDate = parseDate(event.date);
  if (!eventDate) return null;

  if (event.repeat === 'once') {
    const diff = Math.floor((eventDate - now) / 86400000);
    return diff;
  }

  // 计算下一次发生日期
  const next = getNextOccurrence(event, now);
  if (!next) return null;
  const diff = Math.floor((next - now) / 86400000);
  return diff;
}

// 获取事件的下一次发生日期
export function getNextOccurrence(event, fromDate) {
  fromDate = fromDate || new Date();
  fromDate.setHours(0, 0, 0, 0);
  const eventDate = parseDate(event.date);
  if (!eventDate) return null;

  if (event.repeat === 'once') {
    return eventDate >= fromDate ? eventDate : null;
  }

  if (event.repeat === 'yearly') {
    // 找今年或明年的纪念日
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

// 获取某一天的所有事件
export function getEventsOnDate(events, dateStr) {
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
    // 也检查原始日期是否匹配（一次性事件）
    if (event.repeat === 'once' && event.date === dateStr) {
      if (!result.find(r => r.id === event.id)) {
        result.push({ ...event, nextDate: date });
      }
    }
  }
  return result;
}

// 获取本月有事件的日期集合
export function getEventDatesInMonth(events, year, month) {
  const dates = new Set();
  const firstDay = new Date(year, month, 1);
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

// 获取事件的类型颜色和图标
export function getEventTypeInfo(type) {
  return EVENT_TYPES[type] || EVENT_TYPES.custom;
}

// 获取今天日期的友好显示
export function getTodayDisplay() {
  const now = new Date();
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  return `${now.getFullYear()}年${months[now.getMonth()]}${now.getDate()}日 ${weekdays[now.getDay()]}`;
}

// 排序事件列表（按距离天数排序）
export function sortEventsByCountdown(events) {
  return events.map(e => ({ ...e, _days: daysUntilNext(e) }))
    .filter(e => e._days !== null && e._days >= 0)
    .sort((a, b) => a._days - b._days);
}

// 格式化倒计时文字
export function formatCountdown(days) {
  if (days === 0) return { num: '今天', label: '就是今天', cls: 'today' };
  if (days === 1) return { num: '1', label: '天后', cls: 'soon' };
  if (days <= 7) return { num: String(days), label: '天后', cls: 'soon' };
  return { num: String(days), label: '天后', cls: '' };
}
