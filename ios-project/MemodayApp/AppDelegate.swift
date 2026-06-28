import UIKit
import WebKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 请求通知权限（包括临时授权，确保能立即收到）
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound, .provisional]
        ) { granted, error in
            DispatchQueue.main.async {
                print("[Notify] 权限请求结果: \(granted)")
            }
        }
        window = UIWindow(frame: UIScreen.main.bounds)
        let vc = ViewController()
        window?.rootViewController = vc
        window?.makeKeyAndVisible()
        return true
    }
}

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    var webView: WKWebView!
    let notificationCenter = UNUserNotificationCenter.current()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1)

        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.defaultWebpagePreferences?.allowsContentJavaScript = true
        cfg.preferences.javaScriptEnabled = true
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true

        // 添加 JS 消息处理器
        cfg.userContentController.add(self, name: "nativeNotify")
        cfg.userContentController.add(self, name: "nativeLog")

        // 注入 JS 桥接代码（在网页加载前执行）
        let bridgeJS = """
        (function() {
          window.__nativeBridgeReady = true;
          window.__nativeNotif = {
            requestPermission: function() {
              window.webkit.messageHandlers.nativeNotify.postMessage({action:'requestPermission'});
              return Promise.resolve(true);
            },
            getPermissionStatus: function() {
              window.webkit.messageHandlers.nativeNotify.postMessage({action:'getPermissionStatus'});
            },
            schedule: function(id, title, body, fireDate, userInfo) {
              window.webkit.messageHandlers.nativeNotify.postMessage({
                action:'schedule',
                id:id, title:title, body:body,
                fireDate: Math.floor(fireDate/1000),
                userInfo:userInfo||{}
              });
            },
            scheduleIn: function(id, title, body, secondsFromNow, userInfo) {
              window.webkit.messageHandlers.nativeNotify.postMessage({
                action:'scheduleIn',
                id:id, title:title, body:body,
                seconds:secondsFromNow,
                userInfo:userInfo||{}
              });
            },
            cancel: function(id) {
              window.webkit.messageHandlers.nativeNotify.postMessage({action:'cancel', id:id});
            },
            cancelAll: function() {
              window.webkit.messageHandlers.nativeNotify.postMessage({action:'cancelAll'});
            }
          };
          window.__sendNativeNotification = function(title, body, notifId, fireDateTimestamp) {
            window.__nativeNotif.schedule(notifId, title, body, fireDateTimestamp, {});
          };
          window.__sendNativeNotificationIn = function(title, body, notifId, secondsFromNow) {
            window.__nativeNotif.scheduleIn(notifId, title, body, secondsFromNow, {});
          };
          window.__cancelNativeNotification = function(notifId) {
            window.__nativeNotif.cancel(notifId);
          };
          window.__cancelAllNativeNotifications = function() {
            window.__nativeNotif.cancelAll();
          };
          console.log('[NativeBridge] iOS 通知桥接已加载');
        })();
        """
        let script = WKUserScript(source: bridgeJS, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        cfg.userContentController.addUserScript(script)

        webView = WKWebView(frame: view.bounds, configuration: cfg)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1)
        view.addSubview(webView)

        loadContent()
    }

    func loadContent() {
        if let htmlURL = Bundle.main.url(forResource: "standalone", withExtension: "html") {
            let dir = htmlURL.deletingLastPathComponent()
            webView.loadFileURL(htmlURL, allowingReadAccessTo: dir)
        }
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any] else { return }
        let action = dict["action"] as? String ?? ""

        if message.name == "nativeLog" {
            print("[JSLog] \(message.body)")
            return
        }

        if message.name == "nativeNotify" {
            handleNotifyAction(action, dict)
        }
    }

    func handleNotifyAction(_ action: String, _ dict: [String: Any]) {
        if action == "requestPermission" {
            notificationCenter.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
                DispatchQueue.main.async {
                    print("[Notify] 权限请求结果: \(granted)")
                }
            }
        }
        else if action == "getPermissionStatus" {
            notificationCenter.getNotificationSettings { settings in
                let status: String
                switch settings.authorizationStatus {
                case .authorized: status = "granted"
                case .denied: status = "denied"
                case .notDetermined: status = "notDetermined"
                case .provisional: status = "provisional"
                @unknown default: status = "unknown"
                }
                DispatchQueue.main.async {
                    self.webView.evaluateJavaScript("window.__nativePermissionStatus = '\(status)';") { _, _ in }
                }
            }
        }
        else if action == "schedule" {
            // 使用精确的时间间隔触发（更快更可靠）
            guard let id = dict["id"] as? String,
                  let title = dict["title"] as? String,
                  let body = dict["body"] as? String,
                  let ts = dict["fireDate"] as? TimeInterval else { return }
            let fireDate = Date(timeIntervalSince1970: ts)
            let secondsFromNow = max(1, fireDate.timeIntervalSinceNow)
            if secondsFromNow > 0 {
                scheduleNotificationIn(id: id, title: title, body: body, secondsFromNow: secondsFromNow, userInfo: dict["userInfo"] as? [String: Any] ?? [:])
            }
        }
        else if action == "scheduleIn" {
            // 直接按秒数调度（用于测试通知，最快最准）
            guard let id = dict["id"] as? String,
                  let title = dict["title"] as? String,
                  let body = dict["body"] as? String,
                  let seconds = dict["seconds"] as? TimeInterval else { return }
            scheduleNotificationIn(id: id, title: title, body: body, secondsFromNow: max(1, seconds), userInfo: dict["userInfo"] as? [String: Any] ?? [:])
        }
        else if action == "cancel" {
            guard let id = dict["id"] as? String else { return }
            cancelNotification(id: id)
        }
        else if action == "cancelAll" {
            notificationCenter.removeAllPendingNotificationRequests()
            // 同时清除已送达的通知（重新授权后会显示）
            notificationCenter.removeAllDeliveredNotifications()
        }
    }

    // 使用 UNTimeIntervalNotificationTrigger（最快最精确）
    func scheduleNotificationIn(id: String, title: String, body: String, secondsFromNow: TimeInterval, userInfo: [String: Any]) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = userInfo
        content.badge = NSNumber(value: 1)
        // 关键：设置 interruptionLevel 为 .active，确保立即弹出横幅
        if #available(iOS 15.0, *) {
            content.interruptionLevel = .active
        }

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: secondsFromNow, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        notificationCenter.add(request) { error in
            if let error = error {
                print("[Notify] 调度失败: \(error.localizedDescription)")
            } else {
                let date = Date().addingTimeInterval(secondsFromNow)
                print("[Notify] 已调度: \(id) → \(date)")
            }
        }
    }

    func cancelNotification(id: String) {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [id])
        // 同时取消已送达的通知
        notificationCenter.removeDeliveredNotifications(withIdentifiers: [id])
        print("[Notify] 已取消: \(id)")
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let js = "document.documentElement.style.webkitUserSelect='none';document.documentElement.style.webkitTouchCallout='none';"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[WebView] 加载失败: \(error.localizedDescription)")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
