package com.memoday.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final String CHANNEL_ID = "memoday_notifications";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create notification channel (required Android 8+)
        createNotificationChannel();

        // NOTE: 不在启动时请求通知权限
        // 通知权限在用户保存事件时由 JS 端触发请求，避免每次打开都弹窗

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Add JS interface for native notifications
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject JS: mark as Android app + notification permission status
                String js = "if(window.__setNativeReady){window.__setNativeReady('android');}" +
                            "if(window.__updateNotifPerm){window.__updateNotifPerm(" + hasNotificationPermission() + ");}";
                // 处理 Deep Link: 把 join 参数传给 JS
                Intent intent = getIntent();
                Uri data = intent.getData();
                if (data != null) {
                    String joinParam = data.getQueryParameter("join");
                    if (joinParam != null) {
                        js += "if(window.__setJoinData){window.__setJoinData('" + joinParam + "');}";
                    }
                }
                view.evaluateJavascript(js, null);
            }
        });

        webView.loadUrl("file:///android_asset/public/standalone.html");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "纪念日提醒",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("纪念日和重要日期的提醒通知");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST);
            }
        }
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return NotificationManagerCompat.from(this).areNotificationsEnabled();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // 处理新的 Deep Link（App已在运行时收到新链接）
        setIntent(intent);
        Uri data = intent.getData();
        if (data != null && webView != null) {
            String joinParam = data.getQueryParameter("join");
            if (joinParam != null) {
                webView.evaluateJavascript(
                    "if(window.__setJoinData){window.__setJoinData('" + joinParam + "');}",
                    null
                );
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            // Notify the web page about permission result
            if (webView != null) {
                webView.evaluateJavascript(
                    "if(window.__updateNotifPerm){window.__updateNotifPerm(" + granted + ");}",
                    null
                );
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // Inner class: JS interface for native notification bridge
    public class WebAppInterface {
        Context context;

        WebAppInterface(Context c) {
            context = c;
        }

        @JavascriptInterface
        public boolean hasNotificationPermission() {
            return MainActivity.this.hasNotificationPermission();
        }

        @JavascriptInterface
        public void requestPermission() {
            // 只在未授权时请求，已授权不会重复弹窗
            if (!MainActivity.this.hasNotificationPermission()) {
                MainActivity.this.runOnUiThread(() -> {
                    MainActivity.this.requestNotificationPermission();
                });
            }
        }

        @JavascriptInterface
        public void sendNotification(String title, String message) {
            MainActivity.this.showNotification(title, message);
        }

        @JavascriptInterface
        public void sendNotificationWithDelay(String title, String message, int delaySeconds) {
            // For delayed notifications, we use a simple thread
            new Thread(() -> {
                try {
                    Thread.sleep(delaySeconds * 1000L);
                    MainActivity.this.showNotification(title, message);
                } catch (InterruptedException e) {
                    MainActivity.this.showNotification(title, message);
                }
            }).start();
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }
    }

    private void showNotification(String title, String message) {
        if (!hasNotificationPermission()) {
            // 没权限就静默跳过，不弹窗（弹窗只在用户主动保存事件时触发）
            return;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Use app icon as large icon (matches iOS notification style)
        Bitmap largeIcon = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(largeIcon)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(false)  // Don't auto-dismiss (like iOS - user must manually clear)
            .setOngoing(false)
            .setContentIntent(pendingIntent);

        // Use a unique ID based on timestamp so each notification is separate
        int notificationId = (int) System.currentTimeMillis() % 100000;
        NotificationManagerCompat.from(this).notify(notificationId, builder.build());
    }
}
