package com.nexus.fleet.ui.vehicles

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.repository.VehicleRepository
import com.nexus.fleet.domain.model.Vehicle
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class VehicleDetailState {
    data object Loading : VehicleDetailState()
    data class Success(val vehicle: Vehicle) : VehicleDetailState()
    data class Error(val message: String) : VehicleDetailState()
}

@HiltViewModel
class VehicleDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val vehicleRepository: VehicleRepository
) : ViewModel() {

    private val vehicleId: String = savedStateHandle["vehicleId"] ?: ""

    private val _state = MutableStateFlow<VehicleDetailState>(VehicleDetailState.Loading)
    val state: StateFlow<VehicleDetailState> = _state.asStateFlow()

    init { load() }

    fun load() {
        if (vehicleId.isEmpty()) {
            _state.value = VehicleDetailState.Error("No vehicle ID")
            return
        }
        viewModelScope.launch {
            _state.value = VehicleDetailState.Loading
            try {
                val vehicle = vehicleRepository.getVehicle(vehicleId)
                _state.value = VehicleDetailState.Success(vehicle)
            } catch (e: Exception) {
                _state.value = VehicleDetailState.Error(e.message ?: "Failed to load vehicle")
            }
        }
    }
}
