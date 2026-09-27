package com.instaIraq.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private String pendingUrl;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingUrl != null && getBridge() != null && getBridge().getWebView() != null) {
            final String url = pendingUrl;
            pendingUrl = null;
            getBridge().getWebView().postDelayed(() ->
                getBridge().getWebView().evaluateJavascript(
                    "window.location.href=" + org.json.JSONObject.quote(url), null
                ), 700);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.hasExtra("sdm_url")) {
            pendingUrl = intent.getStringExtra("sdm_url");
        }
    }
}
