// ===== 通知提醒系统 =====
import { getAllEvents, getSettings } from './db.js';
import { daysUntilNext, getNextOccurrence, getEventTypeInfo } from './utils.js';

// 请求通知权限
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('此浏览器不支持通知');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

// 发送本地通知
export function sendNotification(title, options) {
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

    // 5秒后自动关闭
    setTimeout(() => notification.close(), 8000);
  } catch (e) {
    console.error('通知发送失败:', e);
  }
}

// 检查今天和明天需要提醒的事件
export function checkReminders() {
  const events = getAllEvents();
  const settings = getSettings();
  if (!settings.notifications) return;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = formatDateStr(today);
  const tomorrowStr = formatDateStr(tomorrow);

  let todayEvents = [];
  let tomorrowEvents = [];

  for (const event of events) {
    const days = daysUntilNext(event);
    if (days === null) continue;

    // 获取提醒天数设置
    const reminderDays = event.reminders || settings.defaultReminder || [0, 1];

    // 检查是否需要今天提醒
    for (const rd of reminderDays) {
      if (days === rd) {
        if (rd === 0) {
          todayEvents.push(event);
        } else if (rd === 1) {
          tomorrowEvents.push(event);
        } else if (days === rd) {
          // 提前几天提醒
          const info = getEventTypeInfo(event.type);
          sendNotification(`【${info.label}提醒】${event.title}`, {
            body: `还有${days}天就是「${event.title}」了，别忘了准备哦！${event.note ? '\n备注：' + event.note : ''}`,
            tag: `reminder_${event.id}_${days}d`,
          });
        }
      }
    }
  }

  // 发送明天提醒
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

  // 发送今天提醒
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

// 检查通知权限状态
export function getNotificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// 启动定时检查（每60分钟检查一次）
let checkInterval = null;
export function startReminderCheck() {
  // 启动时立即检查一次
  checkReminders();

  // 每小时检查一次
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkReminders, 60 * 60 * 1000);

  // 当页面重新可见时也检查
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkReminders();
    }
  });
}

// 发送测试通知
export function sendTestNotification() {
  sendNotification('念念日历 🎉', {
    body: '通知功能已开启！重要纪念日会提前提醒你。',
    tag: 'test_notification',
  });
}
