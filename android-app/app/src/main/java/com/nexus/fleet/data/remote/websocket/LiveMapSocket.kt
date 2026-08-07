package com.nexus.fleet.data.remote.websocket

import android.util.Log
import com.nexus.fleet.BuildConfig
import com.nexus.fleet.data.local.prefs.TokenStore
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

data class PositionUpdate(
    val deviceId: String,
    val vehicleId: String? = null,
    val plateNumber: String? = null,
    val make: String? = null,
    val model: String? = null,
    val latitude: Double,
    val longitude: Double,
    val speed: Double? = null,
    val heading: Double? = null,
    val ignition: String? = null,
    val movement: String? = null,
    val batteryV: Double? = null,
    val gsmSignal: Int? = null,
    val lastSeen: String? = null,
    val timestamp: String = ""
)

@Singleton
class LiveMapSocket @Inject constructor(
    private val tokenStore: TokenStore
) {
    private var socket: Socket? = null
    private val _positions = MutableSharedFlow<PositionUpdate>(extraBufferCapacity = 64)
    val positions: SharedFlow<PositionUpdate> = _positions.asSharedFlow()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    fun connect() {
        if (socket?.connected() == true) return

        val token = runBlocking { tokenStore.getAccessToken() } ?: return

        val opts = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .setReconnectionAttempts(10)
            .setReconnectionDelay(2000L)
            .build()

        socket = IO.socket("${BuildConfig.WS_URL}/live-map", opts)

        socket?.on(Socket.EVENT_CONNECT) {
            Log.d("LiveMapSocket", "Connected")
            _connected.value = true
        }

        socket?.on(Socket.EVENT_DISCONNECT) { args ->
            Log.d("LiveMapSocket", "Disconnected: ${args.firstOrNull()}")
            _connected.value = false
        }

        socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e("LiveMapSocket", "Error: ${args.firstOrNull()}")
            _connected.value = false
        }

        socket?.on("position:update") { args ->
            try {
                val data = args.firstOrNull() as? JSONObject ?: return@on
                val update = PositionUpdate(
                    deviceId = data.optString("deviceId", ""),
                    vehicleId = data.optString("vehicleId", null),
                    plateNumber = data.optString("plateNumber", null),
                    make = data.optString("make", null),
                    model = data.optString("model", null),
                    latitude = data.optDouble("latitude", 0.0),
                    longitude = data.optDouble("longitude", 0.0),
                    speed = data.optDouble("speed", -1.0).takeIf { it >= 0 },
                    heading = data.optDouble("heading", -1.0).takeIf { it >= 0 },
                    ignition = data.optString("ignition", null),
                    movement = data.optString("movement", null),
                    batteryV = data.optDouble("batteryV", -1.0).takeIf { it >= 0 },
                    gsmSignal = data.optInt("gsmSignal", -1).takeIf { it >= 0 },
                    lastSeen = data.optString("lastSeen", null),
                    timestamp = data.optString("timestamp", "")
                )
                _positions.tryEmit(update)
            } catch (e: Exception) {
                Log.e("LiveMapSocket", "Parse error", e)
            }
        }

        socket?.connect()
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
        _connected.value = false
    }

    fun isConnected(): Boolean = socket?.connected() == true
}
