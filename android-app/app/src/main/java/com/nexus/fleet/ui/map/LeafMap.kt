package com.nexus.fleet.ui.map

import android.annotation.SuppressLint
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.nexus.fleet.domain.model.Geofence
import com.nexus.fleet.domain.model.TrailPoint
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "LeafMap"

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LeafMap(
    modifier: Modifier = Modifier,
    vehicles: List<MapVehicle>,
    selectedDeviceId: String?,
    trail: List<TrailPoint>,
    geofences: List<Geofence>,
    mapMode: MapMode,
    onVehicleTap: (String) -> Unit
) {
    var webView by remember { mutableStateOf<WebView?>(null) }
    var initialized by remember { mutableStateOf(false) }
    var vehiclesSent by remember { mutableStateOf(false) }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val html = loadHtmlFromAssets(ctx)

            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                settings.allowFileAccess = true
                settings.allowContentAccess = true
                settings.allowFileAccessFromFileURLs = true
                settings.allowUniversalAccessFromFileURLs = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                settings.useWideViewPort = true
                settings.loadWithOverviewMode = true

                setBackgroundColor(0xFFE8EFF7.toInt())

                addJavascriptInterface(object {
                    @JavascriptInterface
                    fun onVehicleTap(deviceId: String) {
                        onVehicleTap(deviceId)
                    }

                    @JavascriptInterface
                    fun onMapClick(lat: Double, lng: Double) {}
                }, "Android")

                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        Log.d(TAG, "Page finished: $url")
                        initialized = true
                    }
                    override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                        Log.e(TAG, "WebView error: $errorCode $description at $failingUrl")
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                        Log.d(TAG, "JS: ${consoleMessage?.message()} [${consoleMessage?.messageLevel()}]")
                        return true
                    }
                }

                loadDataWithBaseURL(
                    "http://127.0.0.1",
                    html,
                    "text/html",
                    "UTF-8",
                    null
                )
                webView = this
            }
        }
    )

    val wv = webView ?: return

    // Send ALL data when WebView becomes ready
    LaunchedEffect(initialized) {
        if (!initialized) return@LaunchedEffect
        kotlinx.coroutines.delay(200)
        wv.post {
            // Set initial map mode first
            wv.evaluateJavascript("setMapMode('${mapMode.key}');", null)
            // Send vehicles
            val arr = JSONArray()
            vehicles.forEach { v ->
                arr.put(vehicleToJson(v))
            }
            wv.evaluateJavascript("updateVehicles('${arr.toString().replace("'", "\\'")}')") {
                // After vehicles are on the map, fit bounds
                wv.evaluateJavascript("fitBoundsToAll();", null)
            }
            // Send geofences
            if (geofences.isNotEmpty()) {
                wv.evaluateJavascript("showGeofences('${geofencesToJson(geofences).replace("'", "\\'")}')", null)
            }
            vehiclesSent = true
        }
    }

    // Vehicle updates (after initial send)
    LaunchedEffect(vehicles) {
        if (!vehiclesSent) return@LaunchedEffect
        val arr = JSONArray()
        vehicles.forEach { v ->
            arr.put(vehicleToJson(v))
        }
        wv.post {
            wv.evaluateJavascript("updateVehicles('${arr.toString().replace("'", "\\'")}')", null)
            if (vehicles.isNotEmpty()) {
                wv.evaluateJavascript("fitBoundsToAll();", null)
            }
        }
    }

    // Geofences updates (after initial send)
    LaunchedEffect(geofences) {
        if (!vehiclesSent) return@LaunchedEffect
        wv.post {
            if (geofences.isEmpty()) {
                wv.evaluateJavascript("clearGeofences();", null)
            } else {
                wv.evaluateJavascript("showGeofences('${geofencesToJson(geofences).replace("'", "\\'")}')", null)
            }
        }
    }

    // Center on selected vehicle
    LaunchedEffect(selectedDeviceId, vehiclesSent) {
        if (!vehiclesSent || selectedDeviceId == null) return@LaunchedEffect
        wv.post {
            wv.evaluateJavascript("centerOnVehicle('$selectedDeviceId');", null)
        }
    }

    // Trail
    LaunchedEffect(trail, vehiclesSent) {
        if (!vehiclesSent) return@LaunchedEffect
        if (trail.isEmpty()) {
            wv.post { wv.evaluateJavascript("clearTrail();", null) }
        } else {
            val arr = JSONArray()
            trail.forEach { t ->
                val obj = JSONObject().apply {
                    put("latitude", t.latitude)
                    put("longitude", t.longitude)
                }
                arr.put(obj)
            }
            wv.post {
                wv.evaluateJavascript("showTrail('${arr.toString().replace("'", "\\'")}')", null)
            }
        }
    }

    // Map mode
    LaunchedEffect(mapMode, vehiclesSent) {
        if (!vehiclesSent) return@LaunchedEffect
        wv.post {
            wv.evaluateJavascript("setMapMode('${mapMode.key}');", null)
        }
    }
}

private fun vehicleToJson(v: MapVehicle): JSONObject {
    return JSONObject().apply {
        put("deviceId", v.deviceId)
        put("latitude", v.latitude)
        put("longitude", v.longitude)
        put("isMoving", v.isMoving)
        put("ignition", v.ignition ?: "")
        put("speed", v.speed ?: 0.0)
        put("plateNumber", v.plateNumber ?: "")
        put("make", v.make ?: "")
        put("model", v.model ?: "")
    }
}

private fun geofencesToJson(geofences: List<Geofence>): String {
    val arr = JSONArray()
    geofences.forEach { gf ->
        val obj = JSONObject().apply {
            put("id", gf.id)
            put("name", gf.name)
            put("type", gf.type)
            put("enabled", gf.enabled)
            val coords = JSONObject()
            gf.coordinates.forEach { (k, v) ->
                when (v) {
                    is Map<*, *> -> {
                        val inner = JSONObject()
                        v.forEach { (ik, iv) ->
                            if (ik is String) inner.put(ik, iv)
                        }
                        coords.put(k, inner)
                    }
                    is List<*> -> {
                        val list = JSONArray()
                        v.forEach { item ->
                            if (item is Map<*, *>) {
                                val inner = JSONObject()
                                item.forEach { (ik, iv) ->
                                    if (ik is String) inner.put(ik, iv)
                                }
                                list.put(inner)
                            }
                        }
                        coords.put(k, list)
                    }
                    else -> coords.put(k, v)
                }
            }
            put("coordinates", coords)
        }
        arr.put(obj)
    }
    return arr.toString()
}

private fun loadHtmlFromAssets(ctx: android.content.Context): String {
    val html = ctx.assets.open("leaflet_map.html").bufferedReader().use { it.readText() }
    val css = ctx.assets.open("leaflet.css").bufferedReader().use { it.readText() }
    val js = ctx.assets.open("leaflet.js").bufferedReader().use { it.readText() }
    return html
        .replace("<link rel=\"stylesheet\" href=\"leaflet.css\"/>", "<style>$css</style>")
        .replace("<script src=\"leaflet.js\"></script>", "<script>$js</script>")
}
