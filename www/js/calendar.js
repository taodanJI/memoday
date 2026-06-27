// ===== 日历视图渲染 =====
import { getAllEvents } from './db.js';
import { getEventDatesInMonth, getEventsOnDate, getEventTypeInfo, formatDate, todayStr, parseDate } from './utils.js';

let calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedDate: todayStr(),
};

export function renderCalendar() {
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

  // 上个月的尾部
  const prevMonthLastDay = new Date(calState.year, calState.month, 0).getDate();

  let html = '';

  // 上月填充
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    html += `<div class="cal-day other-month">${day}</div>`;
  }

  // 本月日期
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

  // 下月填充
  const totalCells = startWeekday + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month">${i}</div>`;
  }

  daysContainer.innerHTML = html;

  // 绑定日期点击
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

  // 绑定事件点击
  container.querySelectorAll('.event-card').forEach(el => {
    el.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('editevent', { detail: el.dataset.id }));
    });
  });
}

// 跳转到指定日期
export function goToCalendarDate(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return;
  calState.year = date.getFullYear();
  calState.month = date.getMonth();
  calState.selectedDate = dateStr;
}
