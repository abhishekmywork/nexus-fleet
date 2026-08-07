package com.nexus.fleet.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.hilt.navigation.compose.hiltViewModel
import com.nexus.fleet.ui.theme.*

@Composable
fun LiveMapScreen(
    viewModel: LiveMapViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val state by viewModel.state.collectAsState()
    val visibleVehicles by viewModel.visibleVehicles.collectAsState()
    val showGeofences by viewModel.showGeofences.collectAsState()
    val geofences by viewModel.geofences.collectAsState()
    val connected by viewModel.connected.collectAsState()
    val mapMode by viewModel.mapMode.collectAsState()

    var sidebarOpen by remember { mutableStateOf(true) }

    val allVehicles = when (val s = state) {
        is LiveMapState.Success -> s.vehicles
        else -> emptyList()
    }
    val visibleList = allVehicles.filter { it.deviceId in visibleVehicles }

    Box(modifier = Modifier.fillMaxSize()) {
        // 1) Map — bottom layer
        when (val s = state) {
            is LiveMapState.Loading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is LiveMapState.Error -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(s.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { viewModel.loadInitialPositions() }) { Text("Retry") }
                    }
                }
            }
            is LiveMapState.Success -> {
                LeafMap(
                    modifier = Modifier.fillMaxSize(),
                    vehicles = visibleList,
                    selectedDeviceId = s.selectedDeviceId,
                    trail = s.trail,
                    geofences = if (showGeofences) geofences else emptyList(),
                    mapMode = mapMode,
                    onVehicleTap = { viewModel.selectDevice(it) }
                )

                // Map mode switcher — top center
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 12.dp)
                ) {
                    MapModeSwitcher(
                        currentMode = mapMode,
                        onModeSelected = { viewModel.setMapMode(it) }
                    )
                }

                // Connection indicator — top right
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 12.dp, end = 12.dp)
                ) {
                    ConnectionIndicator(connected = connected)
                }

                // Sidebar reopen — top left (when closed)
                if (!sidebarOpen) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(12.dp)
                            .zIndex(10f)
                    ) {
                        SidebarReopenButton(onClick = { sidebarOpen = true })
                    }
                }

                // Selected vehicle info card — bottom
                val selected = visibleList.find { it.deviceId == s.selectedDeviceId }
                if (selected != null) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(12.dp)
                            .fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surface,
                        shadowElevation = 4.dp
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    selected.plateNumber ?: selected.deviceId,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                                IconButton(onClick = { viewModel.selectDevice(null) }, modifier = Modifier.size(24.dp)) {
                                    Icon(Icons.Default.Close, contentDescription = "Close", modifier = Modifier.size(18.dp))
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                selected.speed?.let {
                                    Text("${it.toInt()} km/h", fontSize = 12.sp, color = Muted)
                                }
                                selected.ignition?.let {
                                    Text("IGN $it", fontSize = 12.sp, color = if (it == "ON") Success else Muted)
                                }
                                selected.batteryV?.let {
                                    Text("${it}V", fontSize = 12.sp, color = Muted)
                                }
                            }
                            selected.make?.let { make ->
                                val model = selected.model
                                Text(
                                    if (model != null) "$make $model" else make,
                                    fontSize = 11.sp, color = Muted
                                )
                            }
                        }
                    }
                }

                // Trail loading indicator
                if (s.trailLoading) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = 12.dp, bottom = 80.dp),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(6.dp))
                            Text("Loading trail...", fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        // 2) Sidebar overlay — top layer
        if (sidebarOpen) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF000000).copy(alpha = 0.4f))
                    .noRippleClickable { sidebarOpen = false }
            )
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(280.dp)
                    .align(Alignment.CenterStart)
                    .zIndex(15f)
            ) {
                VehicleSidebar(
                    vehicles = allVehicles,
                    visibleVehicles = visibleVehicles,
                    selectedDeviceId = when (val s = state) {
                        is LiveMapState.Success -> s.selectedDeviceId
                        else -> null
                    },
                    showGeofences = showGeofences,
                    onToggle = { viewModel.toggleVehicle(it) },
                    onSelect = { viewModel.selectDevice(it) },
                    onShowAll = { viewModel.showAll() },
                    onHideAll = { viewModel.hideAll() },
                    onToggleGeofences = { viewModel.toggleGeofences() },
                    onBack = {
                        sidebarOpen = false
                        onBack()
                    }
                )
            }
        }
    }
}

@Composable
private fun Modifier.noRippleClickable(onClick: () -> Unit): Modifier =
    this.then(
        Modifier.clickable(
            indication = null,
            interactionSource = remember { MutableInteractionSource() },
            onClick = onClick
        )
    )
