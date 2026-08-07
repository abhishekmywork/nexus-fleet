package com.nexus.fleet.ui.map

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.remote.api.GeofenceApi
import com.nexus.fleet.data.remote.api.TelemetryApi
import com.nexus.fleet.data.remote.websocket.LiveMapSocket
import com.nexus.fleet.data.remote.websocket.PositionUpdate
import com.nexus.fleet.domain.model.Geofence
import com.nexus.fleet.domain.model.TrailPoint
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class MapMode(val key: String) {
    STANDARD("standard"),
    SATELLITE("satellite"),
    TERRAIN("terrain"),
    HYBRID("hybrid");

    companion object {
        fun fromKey(key: String): MapMode = entries.find { it.key == key } ?: STANDARD
    }
}

data class MapVehicle(
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
    val timestamp: String? = null,
    val isMoving: Boolean = false
)

sealed class LiveMapState {
    data object Loading : LiveMapState()
    data class Success(
        val vehicles: List<MapVehicle>,
        val selectedDeviceId: String? = null,
        val trail: List<TrailPoint> = emptyList(),
        val trailLoading: Boolean = false
    ) : LiveMapState()
    data class Error(val message: String) : LiveMapState()
}

@HiltViewModel
class LiveMapViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val telemetryApi: TelemetryApi,
    private val geofenceApi: GeofenceApi,
    private val liveMapSocket: LiveMapSocket
) : ViewModel() {

    private val prefs by lazy { context.getSharedPreferences("live_map", Context.MODE_PRIVATE) }

    private val _state = MutableStateFlow<LiveMapState>(LiveMapState.Loading)
    val state: StateFlow<LiveMapState> = _state.asStateFlow()

    private val _visibleVehicles = MutableStateFlow<Set<String>>(emptySet())
    val visibleVehicles: StateFlow<Set<String>> = _visibleVehicles.asStateFlow()

    private val _showGeofences = MutableStateFlow(true)
    val showGeofences: StateFlow<Boolean> = _showGeofences.asStateFlow()

    private val _geofences = MutableStateFlow<List<Geofence>>(emptyList())
    val geofences: StateFlow<List<Geofence>> = _geofences.asStateFlow()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private val _mapMode = MutableStateFlow(
        MapMode.fromKey(prefs.getString("live-map-mode", MapMode.STANDARD.key) ?: MapMode.STANDARD.key)
    )
    val mapMode: StateFlow<MapMode> = _mapMode.asStateFlow()

    private val vehicles = mutableMapOf<String, MapVehicle>()

    init {
        loadInitialPositions()
        observeSocket()
        loadGeofences()
    }

    fun loadInitialPositions() {
        viewModelScope.launch {
            _state.value = LiveMapState.Loading
            try {
                val positions = telemetryApi.activePositions()
                vehicles.clear()
                positions.forEach { pos ->
                    vehicles[pos.deviceId] = MapVehicle(
                        deviceId = pos.deviceId,
                        vehicleId = pos.vehicleId,
                        plateNumber = pos.plateNumber,
                        make = pos.make,
                        model = pos.model,
                        latitude = pos.latitude,
                        longitude = pos.longitude,
                        speed = pos.speed,
                        heading = pos.heading,
                        ignition = pos.ignition,
                        movement = pos.movement,
                        batteryV = pos.batteryV,
                        gsmSignal = pos.gsmSignal,
                        lastSeen = pos.lastSeen,
                        timestamp = pos.timestamp,
                        isMoving = pos.movement?.uppercase() == "MOVING"
                    )
                }
                _visibleVehicles.value = vehicles.keys.toSet()
                _state.value = LiveMapState.Success(vehicles.values.toList())
                liveMapSocket.connect()
            } catch (e: Exception) {
                _state.value = LiveMapState.Error(e.message ?: "Failed to load positions")
            }
        }
    }

    private fun observeSocket() {
        viewModelScope.launch {
            liveMapSocket.connected.collect { _connected.value = it }
        }
        viewModelScope.launch {
            liveMapSocket.positions.collect { update ->
                vehicles[update.deviceId] = MapVehicle(
                    deviceId = update.deviceId,
                    vehicleId = update.vehicleId,
                    plateNumber = update.plateNumber,
                    make = update.make,
                    model = update.model,
                    latitude = update.latitude,
                    longitude = update.longitude,
                    speed = update.speed,
                    heading = update.heading,
                    ignition = update.ignition,
                    movement = update.movement,
                    batteryV = update.batteryV,
                    gsmSignal = update.gsmSignal,
                    lastSeen = update.lastSeen,
                    timestamp = update.timestamp,
                    isMoving = update.movement?.uppercase() == "MOVING"
                )
                // Auto-add new vehicles to visible set
                val currentVisible = _visibleVehicles.value.toMutableSet()
                if (!currentVisible.contains(update.deviceId)) {
                    currentVisible.add(update.deviceId)
                    _visibleVehicles.value = currentVisible
                }
                emitState()
            }
        }
    }

    private fun loadGeofences() {
        viewModelScope.launch {
            try {
                _geofences.value = geofenceApi.list()
            } catch (_: Exception) {}
        }
    }

    fun selectDevice(deviceId: String?) {
        val current = _state.value
        if (current is LiveMapState.Success) {
            if (current.selectedDeviceId == deviceId) {
                // Deselect
                _state.value = current.copy(selectedDeviceId = null, trail = emptyList())
            } else {
                _state.value = current.copy(selectedDeviceId = deviceId, trail = emptyList(), trailLoading = true)
                loadTrail(deviceId!!)
            }
        }
    }

    private fun loadTrail(deviceId: String) {
        viewModelScope.launch {
            try {
                val trail = telemetryApi.trail(deviceId)
                val current = _state.value
                if (current is LiveMapState.Success && current.selectedDeviceId == deviceId) {
                    _state.value = current.copy(trail = trail, trailLoading = false)
                }
            } catch (e: Exception) {
                val current = _state.value
                if (current is LiveMapState.Success) {
                    _state.value = current.copy(trail = emptyList(), trailLoading = false)
                }
            }
        }
    }

    fun toggleVehicle(deviceId: String) {
        val current = _visibleVehicles.value.toMutableSet()
        if (current.contains(deviceId)) current.remove(deviceId) else current.add(deviceId)
        _visibleVehicles.value = current
    }

    fun showAll() {
        _visibleVehicles.value = vehicles.keys.toSet()
    }

    fun hideAll() {
        _visibleVehicles.value = emptySet()
    }

    fun toggleGeofences() {
        _showGeofences.value = !_showGeofences.value
    }

    fun setMapMode(mode: MapMode) {
        _mapMode.value = mode
        prefs.edit().putString("live-map-mode", mode.key).apply()
    }

    private fun emitState() {
        val current = _state.value
        if (current is LiveMapState.Success) {
            val selectedId = current.selectedDeviceId
            _state.value = current.copy(
                vehicles = vehicles.values.toList(),
                selectedDeviceId = selectedId
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        liveMapSocket.disconnect()
    }
}
