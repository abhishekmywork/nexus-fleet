package com.nexus.fleet.ui.reports

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nexus.fleet.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(
    viewModel: ReportsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Trips", "Speed", "Events", "Drivers")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reports", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = {
                            selectedTab = index
                            val tab = when (index) {
                                0 -> ReportTab.VehicleTrips
                                1 -> ReportTab.SpeedViolations
                                2 -> ReportTab.EventLog
                                3 -> ReportTab.DriverActivity
                                else -> ReportTab.VehicleTrips
                            }
                            viewModel.switchTab(tab)
                        },
                        text = { Text(title, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal) }
                    )
                }
            }

            when (val s = state) {
                is ReportsState.Loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is ReportsState.Error -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(s.message, color = MaterialTheme.colorScheme.error)
                            Spacer(Modifier.height(8.dp))
                            Button(onClick = { viewModel.load() }) { Text("Retry") }
                        }
                    }
                }
                is ReportsState.Success -> {
                    if (s.data.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("No data available", color = Muted)
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(s.data) { row ->
                                ReportRow(row, s.tab)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReportRow(row: Map<String, Any>, tab: ReportTab) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            when (tab) {
                is ReportTab.VehicleTrips -> {
                    Text(
                        row["plateNumber"] as? String ?: row["vehiclePlate"] as? String ?: "Unknown",
                        fontWeight = FontWeight.SemiBold
                    )
                    val dist = row["totalDistanceKm"]
                    if (dist != null) Text("Distance: ${dist} km", style = MaterialTheme.typography.bodySmall, color = Muted)
                    val dur = row["tripDurationMin"]
                    if (dur != null) Text("Duration: ${dur} min", style = MaterialTheme.typography.bodySmall, color = Muted)
                }
                is ReportTab.SpeedViolations -> {
                    Text(row["plateNumber"] as? String ?: row["vehiclePlate"] as? String ?: "Unknown", fontWeight = FontWeight.SemiBold)
                    val speed = row["speed"]
                    if (speed != null) Text("Speed: $speed km/h", style = MaterialTheme.typography.bodySmall, color = Error)
                }
                is ReportTab.EventLog -> {
                    val type = (row["eventType"] as? String)?.replace("_", " ") ?: "Event"
                    Text(type, fontWeight = FontWeight.SemiBold)
                    Text(row["vehiclePlate"] as? String ?: "Unknown", style = MaterialTheme.typography.bodySmall, color = Muted)
                }
                is ReportTab.DriverActivity -> {
                    Text(row["driverName"] as? String ?: "Unknown Driver", fontWeight = FontWeight.SemiBold)
                    val trips = row["totalTrips"]
                    if (trips != null) Text("Trips: $trips", style = MaterialTheme.typography.bodySmall, color = Muted)
                }
            }
        }
    }
}
