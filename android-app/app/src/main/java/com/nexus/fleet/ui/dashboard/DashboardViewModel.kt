package com.nexus.fleet.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.remote.api.DashboardApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardStats(
    val totalVehicles: Int = 0,
    val activeVehicles: Int = 0,
    val totalEvents: Int = 0,
    val unacknowledged: Int = 0
)

sealed class DashboardState {
    data object Loading : DashboardState()
    data class Success(
        val stats: DashboardStats,
        val recentEvents: List<Map<String, Any>>,
        val vehiclePositions: List<Map<String, Any>>
    ) : DashboardState()
    data class Error(val message: String) : DashboardState()
}

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val dashboardApi: DashboardApi
) : ViewModel() {

    private val _state = MutableStateFlow<DashboardState>(DashboardState.Loading)
    val state: StateFlow<DashboardState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = DashboardState.Loading
            try {
                val stats = dashboardApi.stats()
                val events = dashboardApi.recentEvents(10)
                val positions = dashboardApi.vehiclePositions()

                _state.value = DashboardState.Success(
                    stats = DashboardStats(
                        totalVehicles = (stats["totalVehicles"] as? Number)?.toInt() ?: 0,
                        activeVehicles = (stats["activeVehicles"] as? Number)?.toInt() ?: 0,
                        totalEvents = (stats["totalEvents"] as? Number)?.toInt() ?: 0,
                        unacknowledged = (stats["unacknowledged"] as? Number)?.toInt() ?: 0
                    ),
                    recentEvents = events,
                    vehiclePositions = positions
                )
            } catch (e: Exception) {
                _state.value = DashboardState.Error(e.message ?: "Failed to load dashboard")
            }
        }
    }
}
