import UIKit
import WebKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?
    static var pendingJoinData: String? = nil

    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        window = UIWindow(frame: UIScreen.main.bounds)
        let vc = ViewController()
        window?.rootViewController = vc
        window?.makeKeyAndVisible()

        // 通知权限：只在第一次打开App时请求（notDetermined），已授权或已拒绝都不弹
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            if settings.authorizationStatus == .notDetermined {
                // 延迟2秒，等WebView加载完再弹，体验更好
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
                        print("[Notify] 首次权限请求结果: \(granted)")
                    }
                }
            } else {
                print("[Notify] 权限状态: \(settings.authorizationStatus.rawValue)，不重复请求")
            }
        }

        // 检查剪贴板是否有分享链接（用户建议的自动检测功能）
        checkClipboardForShareLink()

        return true
    }

    // 处理 URL Scheme: memoday://join?data=xxx
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        print("[URL] 收到URL: \(url.absoluteString)")
        if url.scheme == "memoday" {
            // 提取 join 数据
            if url.host == "join" {
                // memoday://join?data=xxx
                let data = url.queryParam("data") ?? ""
                if !data.isEmpty {
                    AppDelegate.pendingJoinData = data
                    // 如果 webview 已加载，立即处理
                    if let vc = window?.rootViewController as? ViewController {
                        vc.handleJoinData(data)
                    }
                }
            }
            return true
        }
        // 处理 https 链接带 ?join= 参数
        if url.scheme == "https" {
            let joinData = url.queryParam("join") ?? ""
            if !joinData.isEmpty {
                AppDelegate.pendingJoinData = joinData
                if let vc = window?.rootViewController as? ViewController {
                    vc.handleJoinData(joinData)
                }
            }
            return true
        }
        return false
    }

    // 检查剪贴板是否有分享链接
    func checkClipboardForShareLink() {
        let pasteboard = UIPasteboard.general
        let clipboardStr = pasteboard.string ?? ""
        if clipboardStr.isEmpty { return }

        // 检查是否包含分享链接
        // 格式1: https://xxx?join=xxx
        // 格式2: memoday://join?data=xxx
        var joinData: String? = nil

        if clipboardStr.contains("?join=") || clipboardStr.contains("&join=") {
            // 从 URL 中提取 join 参数
            if let url = URL(string: clipboardStr) {
                joinData = url.queryParam("join")
            }
            // 如果 URL 解析失败，尝试正则
            if joinData == nil {
                if let range = clipboardStr.range(of: "join=") {
                    let after = String(clipboardStr[range.upperBound...])
                    // 取到下一个 & 或结尾
                    let endIdx = after.firstIndex(where: { $0 == "&" || $0 == " " || $0 == "\n" }) ?? after.endIndex
                    joinData = String(after[..<endIdx])
                }
            }
        } else if clipboardStr.contains("memoday://join") {
            if let url = URL(string: clipboardStr) {
                joinData = url.queryParam("data")
            }
        }

        if let data = joinData, !data.isEmpty {
            print("[Clipboard] 检测到分享链接: \(data.prefix(20))...")
            AppDelegate.pendingJoinData = data
            // 延迟一点等 webview 加载完
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                if let vc = self.window?.rootViewController as? ViewController {
                    vc.handleJoinData(data)
                }
            }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }
}

// URL 查询参数扩展
extension URL {
    func queryParam(_ key: String) -> String? {
        let items = URLComponents(url: self, resolvingAgainstBaseURL: false)?.queryItems
        return items?.first(where: { $0.name == key })?.value
    }
}

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    var webView: WKWebView!
    let nc = UNUserNotificationCenter.current()
    var pageLoaded = false

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
        cfg.userContentController.add(self, name: "nativeShare")

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

          // 原生分享和复制（file:// 下浏览器API不可用，走原生桥接）
          window.__nativeShareText=function(text){
            window.webkit.messageHandlers.nativeShare.postMessage({action:'share',text:text||''});
          };
          window.__nativeCopyText=function(text){
            window.webkit.messageHandlers.nativeShare.postMessage({action:'copy',text:text||''});
          };

          console.log('[NativeBridge] iOS 桥接已加载（含分享+复制）');
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

    // 处理 join 数据（来自URL Scheme 或 剪贴板）
    func handleJoinData(_ data: String) {
        if !pageLoaded {
            // 页面还没加载完，等加载完再处理
            print("[Join] 页面未加载完，等待...")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.handleJoinData(data)
            }
            return
        }
        let js = "window.__setJoinData && window.__setJoinData('\(data)');"
        webView.evaluateJavaScript(js) { result, error in
            if let e = error { print("[Join] 注入失败: \(e.localizedDescription)") }
            else { print("[Join] 注入成功") }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any] else { return }
        let action = dict["action"] as? String ?? ""
        if message.name == "nativeLog" { print("[JSLog] \(message.body)"); return }
        if message.name == "nativeNotify" { handleNotifyAction(action, dict) }
        if message.name == "nativeShare" { handleShareAction(action, dict) }
    }

    // 处理分享和复制
    func handleShareAction(_ action: String, _ dict: [String: Any]) {
        let text = dict["text"] as? String ?? ""
        if action == "copy" {
            UIPasteboard.general.string = text
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("showToast && showToast('\u{94FE}\u{63A5}\u{5DF2}\u{590D}\u{5236}');") { _,_ in }
            }
            print("[Share] 已复制到剪贴板")
        }
        else if action == "share" {
            let items: [Any] = [text]
            let avc = UIActivityViewController(activityItems: items, applicationActivities: nil)
            // iPad 需要 popover
            if let popover = avc.popoverPresentationController {
                popover.sourceView = self.view
                popover.sourceRect = CGRect(x: self.view.bounds.midX, y: self.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            self.present(avc, animated: true)
            print("[Share] 分享面板已弹出")
        }
    }

    func handleNotifyAction(_ action: String, _ dict: [String: Any]) {
        if action == "requestPermission" {
            nc.getNotificationSettings { settings in
                if settings.authorizationStatus == .authorized {
                    print("[Notify] 已授权，不重复弹窗")
                } else {
                    self.nc.requestAuthorization(options: [.alert, .badge, .sound]) { g, e in print("[Notify] 权限:\(g)") }
                }
            }
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
        if #available(iOS 15.0, *) {
            content.interruptionLevel = .active
        }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        nc.add(request) { error in
            if let e = error {
                print("[Notify] 调度失败: \(e.localizedDescription)")
            } else {
                let fireDate = Date().addingTimeInterval(max(1, seconds))
                print("[Notify] 已调度: \(id) → \(fireDate)")
            }
        }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageLoaded = true
        let js = "document.documentElement.style.webkitUserSelect='none';document.documentElement.style.webkitTouchCallout='none';"
        webView.evaluateJavaScript(js, completionHandler: nil)

        // 页面加载完后，检查是否有待处理的 join 数据
        if let pending = AppDelegate.pendingJoinData {
            print("[Join] 页面加载完，处理待处理数据")
            AppDelegate.pendingJoinData = nil
            handleJoinData(pending)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[WebView] 失败: \(error.localizedDescription)")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
