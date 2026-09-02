package com.allenscreations.timelessrewards;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class LauncherActivity extends AppCompatActivity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int PERMISSION_REQUEST_WRITE_STORAGE = 1002;
    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;

    private String pendingBase64Data = null;
    private String pendingFilename = null;
    private String pendingMimeType = null;

    public class AndroidBridge {
        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            runOnUiThread(() -> saveBase64ToStorage(base64Data, filename, mimeType));
        }

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(LauncherActivity.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Customize status bar color to match the dark cockpit theme (#0a0a0f)
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0A0A0F"));

        webView = new WebView(this);
        setContentView(webView);

        // Custom PathHandler mapped to root ("/") to seamlessly serve root-relative CSS, JS, fonts, and HTML
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", new WebViewAssetLoader.PathHandler() {
                    @Nullable
                    @Override
                    public WebResourceResponse handle(String path) {
                        try {
                            String assetPath = path.startsWith("/") ? path.substring(1) : path;
                            if (assetPath.isEmpty() || assetPath.endsWith("/")) {
                                assetPath += "index.html";
                            }

                            InputStream is = null;
                            try {
                                is = getAssets().open("www/" + assetPath);
                            } catch (IOException e) {
                                try {
                                    is = getAssets().open(assetPath);
                                } catch (IOException e2) {
                                    return null;
                                }
                            }

                            String mimeType = "text/html";
                            if (assetPath.endsWith(".css")) mimeType = "text/css";
                            else if (assetPath.endsWith(".js")) mimeType = "application/javascript";
                            else if (assetPath.endsWith(".json")) mimeType = "application/json";
                            else if (assetPath.endsWith(".png")) mimeType = "image/png";
                            else if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg")) mimeType = "image/jpeg";
                            else if (assetPath.endsWith(".svg")) mimeType = "image/svg+xml";
                            else if (assetPath.endsWith(".woff2")) mimeType = "font/woff2";
                            else if (assetPath.endsWith(".woff")) mimeType = "font/woff";
                            else if (assetPath.endsWith(".ttf")) mimeType = "font/ttf";

                            Map<String, String> headers = new HashMap<>();
                            headers.put("Access-Control-Allow-Origin", "*");
                            headers.put("Cache-Control", "no-cache");
                            return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, is);
                        } catch (Exception e) {
                            return null;
                        }
                    }
                })
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Register Android JavascriptInterface Bridge
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equals("appassets.androidplatform.net") ||
                                     host.endsWith("vercel.app") ||
                                     host.contains("github.io"))) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadUrl("https://appassets.androidplatform.net/index.html");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (ActivityNotFoundException e) {
                    fileUploadCallback = null;
                    Toast.makeText(LauncherActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });

        // Handle Back Navigation
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        // Handle Native APK, Slip Images, and File Downloads
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                if (url != null && url.startsWith("data:")) {
                    String fn = "OrderSummary-" + System.currentTimeMillis() + ".png";
                    saveBase64ToStorage(url, fn, "image/png");
                    return;
                }
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(url));
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(LauncherActivity.this, "Unable to start download", Toast.LENGTH_SHORT).show();
            }
        });

        // Load root index.html with full CSS styling
        webView.loadUrl("https://appassets.androidplatform.net/index.html");
    }

    private void saveBase64ToStorage(String base64Data, String filename, String mimeType) {
        if (base64Data == null || base64Data.isEmpty()) {
            Toast.makeText(this, "Empty file data", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            String cleanData = base64Data;
            if (cleanData.contains(",")) {
                cleanData = cleanData.substring(cleanData.indexOf(",") + 1);
            }
            byte[] fileBytes = Base64.decode(cleanData, Base64.DEFAULT);

            String finalMimeType = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "image/png";
            String finalFilename = (filename != null && !filename.isEmpty()) ? filename : ("OrderSummary-" + System.currentTimeMillis() + ".png");

            // Android 10+ (API 29+): Scoped Storage via MediaStore
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalFilename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, finalMimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/TimelessRewards");

                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            os.write(fileBytes);
                            os.flush();
                            Toast.makeText(this, "✓ " + finalFilename + " saved to Pictures!", Toast.LENGTH_LONG).show();
                            return;
                        }
                    }
                }
                Toast.makeText(this, "Failed to write image to MediaStore", Toast.LENGTH_SHORT).show();
            } else {
                // Android 9 and below: Check WRITE_EXTERNAL_STORAGE permission
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingBase64Data = base64Data;
                    pendingFilename = finalFilename;
                    pendingMimeType = finalMimeType;
                    ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, PERMISSION_REQUEST_WRITE_STORAGE);
                    return;
                }

                File picturesDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "TimelessRewards");
                if (!picturesDir.exists()) {
                    picturesDir.mkdirs();
                }
                File targetFile = new File(picturesDir, finalFilename);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                // Notify media scanner
                sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(targetFile)));
                Toast.makeText(this, "✓ " + finalFilename + " saved to Pictures!", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error saving slip: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_WRITE_STORAGE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (pendingBase64Data != null) {
                    saveBase64ToStorage(pendingBase64Data, pendingFilename, pendingMimeType);
                    pendingBase64Data = null;
                    pendingFilename = null;
                    pendingMimeType = null;
                }
            } else {
                Toast.makeText(this, "Storage permission required to save order slips.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
