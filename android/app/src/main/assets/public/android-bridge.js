// Android (Capacitor) 通知桥接层
// 在 standalone.html 加载后执行，注入 Android 通知支持

(function() {
  // 检测是否在 Android Capacitor 环境中
  var isAndroidApp = !!(window.Capacitor && Capacitor.getPlatform() === 'android');
  if (!isAndroidApp) return; // 非 Android 环境，不执行

  console.log('[Android] 检测到 Capacitor Android 环境，注入通知桥接');

  // 请求通知权限
  function requestAndroidPermission() {
    return Capacitor.Plugins.LocalNotifications.requestPermissions()
      .then(function(r) {
        var granted = r.granted || (r.display === 'granted');
        console.log('[Android] 通知权限:', granted);
        return granted;
      })
      .catch(function(e) {
        console.log('[Android] 请求权限失败:', e);
        return false;
      });
  }

  // 将字符串 ID 转为数字 ID（Android 要求）
  function hashId(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0) % 2147483647;
  }

  // 调度单个通知
  function scheduleAndroidNotification(id, title, body, secondsFromNow) {
    secondsFromNow = Math.max(1, secondsFromNow);
    Capacitor.Plugins.LocalNotifications.schedule({
      notifications: [{
        id: hashId(id),
        title: title,
        body: body,
        schedule: { in: secondsFromNow },
        sound: 'default',
        actionTypeId: '',
        extra: null
      }]
    }).then(function() {
      console.log('[Android] 已调度通知:', id, '→', secondsFromNow, '秒后');
    }).catch(function(e) {
      console.error('[Android] 调度通知失败:', e);
    });
  }

  // 取消单个通知
  function cancelAndroidNotification(id) {
    Capacitor.Plugins.LocalNotifications.cancel({
      notifications: [{ id: hashId(id) }]
    }).then(function() {
      console.log('[Android] 已取消通知:', id);
    }).catch(function(e) {
      console.error('[Android] 取消通知失败:', e);
    });
  }

  // 取消所有通知
  function cancelAllAndroidNotifications() {
    Capacitor.Plugins.LocalNotifications.cancelAll().then(function() {
      console.log('[Android] 已取消所有通知');
    }).catch(function(e) {
      console.error('[Android] 取消所有通知失败:', e);
    });
  }

  // 覆盖 iOS 通知桥接，改为 Android 实现
  // 在 App 初始化后执行
  function injectAndroidBridge() {
    if (!window.__nativeNotif) window.__nativeNotif = {};

    // 覆盖 scheduleIn（最常用：N 秒后触发）
    window.__sendNativeNotificationIn = function(title, body, notifId, secondsFromNow) {
      scheduleAndroidNotification(notifId, title, body, secondsFromNow);
    };

    // 覆盖 schedule（指定时间戳）
    window.__sendNativeNotification = function(title, body, notifId, fireDateTimestamp) {
      var secondsFromNow = Math.max(1, (fireDateTimestamp - Date.now()) / 1000);
      scheduleAndroidNotification(notifId, title, body, secondsFromNow);
    };

    // 覆盖 cancel
    window.__cancelNativeNotification = function(notifId) {
      cancelAndroidNotification(notifId);
    };

    // 覆盖 cancelAll
    window.__cancelAllNativeNotifications = function() {
      cancelAllAndroidNotifications();
    };

    // 覆盖 requestPermission
    window.__nativeNotif.requestPermission = function() {
      return requestAndroidPermission().then(function() { return true; });
    };

    console.log('[Android] 通知桥接已注入，__sendNativeNotificationIn 可用');
  }

  // DOM ready 后注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(injectAndroidBridge, 500);
    });
  } else {
    setTimeout(injectAndroidBridge, 500);
  }

  // 在第一个用户交互时请求权限
  var permissionRequested = false;
  function requestPermissionOnInteraction() {
    if (permissionRequested) return;
    permissionRequested = true;
    requestAndroidPermission();
    document.removeEventListener('click', requestPermissionOnInteraction);
    document.removeEventListener('touchstart', requestPermissionOnInteraction);
  }
  document.addEventListener('click', requestPermissionOnInteraction);
  document.addEventListener('touchstart', requestPermissionOnInteraction);

})();
