import UIKit
import WebKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 设置通知中心代理（确保 App 在前台时也能收到通知）
        UNUserNotificationCenter.current().delegate = self as? UNUserNotificationCenterDelegate
        // 请求通知权限
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            print("[Notify] 权限请求结果: \(granted)")
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
    let nc = UNUserNotificationCenter.current()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1)

        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.defaultWebpagePreferences?.allowsContentJavaScript = true
        cfg.preferences.javaScriptEnabled = true
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true
        cfg.userContentController.add(self, name: "nativeNotify")
        cfg.userContentController.add(self, name: "nativeLog")

        // 注入 JS 桥接代码
        let bridgeJS = """
        (function(){
          window.__nativeBridgeReady=true;
          window.__nativeNotif={
            requestPermission:function(){window.webkit.messageHandlers.nativeNotify.postMessage({action:'requestPermission'});return Promise.resolve(true);},
            getPermissionStatus:function(){window.webkit.messageHandlers.nativeNotify.postMessage({action:'getPermissionStatus'});},
            schedule:function(id,title,body,fireDate,userInfo){
              window.webkit.messageHandlers.nativeNotify.postMessage({action:'schedule',id:id,title:title,body:body,fireDate:Math.floor(fireDate/1000),userInfo:userInfo||{}});
            },
            scheduleIn:function(id,title,body,secondsFromNow,userInfo){
              window.webkit.messageHandlers.nativeNotify.postMessage({action:'scheduleIn',id:id,title:title,body:body,seconds:secondsFromNow,userInfo:userInfo||{}});
            },
            cancel:function(id){window.webkit.messageHandlers.nativeNotify.postMessage({action:'cancel',id:id});},
            cancelAll:function(){window.webkit.messageHandlers.nativeNotify.postMessage({action:'cancelAll'});}
          };
          window.__sendNativeNotification=function(title,body,notifId,fireDateTimestamp){window.__nativeNotif.schedule(notifId,title,body,fireDateTimestamp,{});};
          window.__sendNativeNotificationIn=function(title,body,notifId,secondsFromNow){window.__nativeNotif.scheduleIn(notifId,title,body,secondsFromNow,{});};
          window.__cancelNativeNotification=function(notifId){window.__nativeNotif.cancel(notifId);};
          window.__cancelAllNativeNotifications=function(){window.__nativeNotif.cancelAll();};
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

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any] else { return }
        let action = dict["action"] as? String ?? ""
        if message.name == "nativeLog" { print("[JSLog] \(message.body)"); return }
        if message.name == "nativeNotify" { handleNotifyAction(action, dict) }
    }

    func handleNotifyAction(_ action: String, _ dict: [String: Any]) {
        if action == "requestPermission" {
            nc.requestAuthorization(options: [.alert, .badge, .sound]) { g, e in print("[Notify] 权限:\(g)") }
        }
        else if action == "getPermissionStatus" {
            nc.getNotificationSettings { s in
                let st: String
                switch s.authorizationStatus {
                case .authorized: st = "granted"
                case .denied: st = "denied"
                case .notDetermined: st = "notDetermined"
                case .provisional: st = "provisional"
                @unknown default: st = "unknown"
                }
                DispatchQueue.main.async { self.webView.evaluateJavaScript("window.__nativePermissionStatus='\(st)';") { _,_ in } }
            }
        }
        else if action == "schedule" {
            guard let id = dict["id"] as? String, let title = dict["title"] as? String, let body = dict["body"] as? String, let ts = dict["fireDate"] as? TimeInterval else { return }
            let secondsFromNow = max(1, Date(timeIntervalSince1970: ts).timeIntervalSinceNow)
            if secondsFromNow > 0 { schedule(id: id, title: title, body: body, seconds: secondsFromNow) }
        }
        else if action == "scheduleIn" {
            guard let id = dict["id"] as? String, let title = dict["title"] as? String, let body = dict["body"] as? String, let seconds = dict["seconds"] as? TimeInterval else { return }
            schedule(id: id, title: title, body: body, seconds: max(1, seconds))
        }
        else if action == "cancel" {
            guard let id = dict["id"] as? String else { return }
            nc.removePendingNotificationRequests(withIdentifiers: [id])
            nc.removeDeliveredNotifications(withIdentifiers: [id])
            print("[Notify] 已取消: \(id)")
        }
        else if action == "cancelAll" {
            nc.removeAllPendingNotificationRequests()
            nc.removeAllDeliveredNotifications()
        }
    }

    func schedule(id: String, title: String, body: String, seconds: TimeInterval) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: 1)
        if #available(iOS 15.0, *) { content.interruptionLevel = .active }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        nc.add(request) { error in
            if let e = error { print("[Notify] 调度失败: \(e)") }
            else { print("[Notify] 已调度: \(id) → \(Date().addingTimeInterval(seconds))") }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let js = "document.documentElement.style.webkitUserSelect='none';document.documentElement.style.webkitTouchCallout='none';"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[WebView] 失败: \(error.localizedDescription)")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
