package com.allenscreations.timelessrewards;

import android.app.Application;
import android.webkit.WebView;

public class TCRPApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();

        // 1. Pre-warm native C/C++ SQLite encrypted database engine
        try {
            NativeStorageEngine.getInstance(this);
        } catch (Exception ignored) {}

        // 2. Pre-warm Android Chromium / Blink WebView engine
        try {
            new WebView(this);
        } catch (Exception ignored) {}
    }
}
