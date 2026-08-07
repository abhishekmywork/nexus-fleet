package com.nexus.fleet.ui.geofences

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.remote.api.GeofenceApi
import com.nexus.fleet.domain.model.Geofence
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class GeofenceListState {
    data object Loading : GeofenceListState()
    data class Success(val geofences: List<Geofence>) : GeofenceListState()
    data class Error(val message: String) : GeofenceListState()
}

@HiltViewModel
class GeofencesViewModel @Inject constructor(
    private val geofenceApi: GeofenceApi
) : ViewModel() {

    private val _state = MutableStateFlow<GeofenceListState>(GeofenceListState.Loading)
    val state: StateFlow<GeofenceListState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = GeofenceListState.Loading
            try {
                val geofences = geofenceApi.list()
                _state.value = GeofenceListState.Success(geofences)
            } catch (e: Exception) {
                _state.value = GeofenceListState.Error(e.message ?: "Failed to load geofences")
            }
        }
    }
}
