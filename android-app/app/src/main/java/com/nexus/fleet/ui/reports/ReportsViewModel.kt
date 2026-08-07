package com.nexus.fleet.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.remote.api.ReportApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class ReportTab {
    data object VehicleTrips : ReportTab()
    data object SpeedViolations : ReportTab()
    data object EventLog : ReportTab()
    data object DriverActivity : ReportTab()
}

sealed class ReportsState {
    data object Loading : ReportsState()
    data class Success(
        val tab: ReportTab,
        val data: List<Map<String, Any>>,
        val total: Int = 0
    ) : ReportsState()
    data class Error(val message: String) : ReportsState()
}

@HiltViewModel
class ReportsViewModel @Inject constructor(
    private val reportApi: ReportApi
) : ViewModel() {

    private val _state = MutableStateFlow<ReportsState>(ReportsState.Loading)
    val state: StateFlow<ReportsState> = _state.asStateFlow()

    private var currentTab: ReportTab = ReportTab.VehicleTrips

    init { load() }

    fun switchTab(tab: ReportTab) {
        currentTab = tab
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = ReportsState.Loading
            try {
                val result = when (currentTab) {
                    is ReportTab.VehicleTrips -> {
                        val res = reportApi.vehicleTrips()
                        @Suppress("UNCHECKED_CAST")
                        (res["data"] as? List<Map<String, Any>>) ?: emptyList()
                    }
                    is ReportTab.SpeedViolations -> {
                        val res = reportApi.speedViolations()
                        @Suppress("UNCHECKED_CAST")
                        (res["data"] as? List<Map<String, Any>>) ?: emptyList()
                    }
                    is ReportTab.EventLog -> {
                        val res = reportApi.eventLog()
                        @Suppress("UNCHECKED_CAST")
                        (res["data"] as? List<Map<String, Any>>) ?: emptyList()
                    }
                    is ReportTab.DriverActivity -> {
                        val res = reportApi.driverActivity()
                        @Suppress("UNCHECKED_CAST")
                        (res["data"] as? List<Map<String, Any>>) ?: emptyList()
                    }
                }
                _state.value = ReportsState.Success(tab = currentTab, data = result, total = result.size)
            } catch (e: Exception) {
                _state.value = ReportsState.Error(e.message ?: "Failed to load report")
            }
        }
    }
}
