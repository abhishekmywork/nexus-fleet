package com.nexus.fleet.ui.vehicles

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

sealed class VehicleListState {
    data object Loading : VehicleListState()
    data class Success(val vehicles: List<Vehicle>) : VehicleListState()
    data class Error(val message: String) : VehicleListState()
}

@HiltViewModel
class VehiclesViewModel @Inject constructor(
    private val vehicleRepository: VehicleRepository
) : ViewModel() {

    private val _state = MutableStateFlow<VehicleListState>(VehicleListState.Loading)
    val state: StateFlow<VehicleListState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = VehicleListState.Loading
            try {
                val vehicles = vehicleRepository.getVehicles()
                _state.value = VehicleListState.Success(vehicles)
            } catch (e: Exception) {
                _state.value = VehicleListState.Error(e.message ?: "Failed to load")
            }
        }
    }
}
