package az.universitet.tycoon;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#eef3e6"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage keeps the save between launches
        setContentView(web);
        if (getResources().getBoolean(R.bool.fullscreen)) hideBars();
        web.loadUrl("file:///android_asset/index.html");
    }

    // The page saves on visibilitychange; pausing the WebView triggers it.
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() {
        super.onResume(); web.onResume();
        if (getResources().getBoolean(R.bool.fullscreen)) hideBars();
    }

    // Immersive full screen for landscape games (system bars swipe in on demand).
    @SuppressWarnings("deprecation")
    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
}
