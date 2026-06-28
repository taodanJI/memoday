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
        title = "念念日历"
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.defaultWebpagePreferences?.allowsContentJavaScript = true
        webView = WKWebView(frame: view.bounds, configuration: cfg)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.scrollView.bounces = false
        view.addSubview(webView)
        if let u = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent())
        } else if let u = URL(string: "https://772e2c5c13b4487d91faaa869468fee5.app.codebuddy.work/") {
            webView.load(URLRequest(url: u))
        }
    }
    func webView(_: WKWebView, didStartProvisionalNavigation _: WKNavigation?) {}
    func webView(_: WKWebView, didFinish _: WKNavigation?) {}
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
