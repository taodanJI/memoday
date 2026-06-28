import UIKit
import WebKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        let vc = ViewController()
        window?.rootViewController = vc
        window?.makeKeyAndVisible()
        return true
    }
}

class ViewController: UIViewController, WKNavigationDelegate {
    var webView: WKWebView!
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1)
        title = "\u5FF5\u5FF5\u65E5\u5386"
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.defaultWebpagePreferences?.allowsContentJavaScript = true
        cfg.preferences.javaScriptEnabled = true
        webView = WKWebView(frame: view.bounds, configuration: cfg)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.scrollView.bounces = false
        view.addSubview(webView)
        loadContent()
    }

    func loadContent() {
        let onlineURL = URL(string: "https://772e2c5c13b4487d91faaa869468fee5.app.codebuddy.work/")
        if let url = onlineURL {
            var req = URLRequest(url: url)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            webView.load(req)
        } else if let u = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
        }
    }

    func webView(_: WKWebView, didFinish _: WKNavigation?) {}
    func webView(_: WKWebView, didFail _: WKNavigation?, withError error: Error) {
        print("WebView load error: \(error.localizedDescription)")
        if let u = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
        }
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
