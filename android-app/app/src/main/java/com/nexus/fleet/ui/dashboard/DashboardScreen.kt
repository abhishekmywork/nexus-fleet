package com.nexus.fleet.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dashboard", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        when (val s = state) {
            is DashboardState.Loading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is DashboardState.Error -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(s.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { viewModel.load() }) { Text("Retry") }
                    }
                }
            }
            is DashboardState.Success -> {
                LazyColumn(
                    modifier = Modifier.padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            StatCard(
                                modifier = Modifier.weight(1f),
                                title = "Vehicles",
                                value = "${s.stats.totalVehicles}",
                                subtitle = "${s.stats.activeVehicles} active",
                                icon = Icons.Default.DirectionsCar,
                                color = Primary
                            )
                            StatCard(
                                modifier = Modifier.weight(1f),
                                title = "Events",
                                value = "${s.stats.totalEvents}",
                                subtitle = "${s.stats.unacknowledged} pending",
                                icon = Icons.Default.Warning,
                                color = Warning
                            )
                        }
                    }

                    item {
                        Text(
                            "Recent Alerts",
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }

                    if (s.recentEvents.isEmpty()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    "No recent events",
                                    modifier = Modifier.padding(16.dp),
                                    color = Muted
                                )
                            }
                        }
                    } else {
                        items(s.recentEvents) { event ->
                            EventRow(event)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: androidx.compose.ui.graphics.Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
            Spacer(Modifier.height(8.dp))
            Text(value, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
            Text(title, style = MaterialTheme.typography.bodySmall, color = Muted)
            Text(subtitle, style = MaterialTheme.typography.labelSmall, color = color)
        }
    }
}

@Composable
fun EventRow(event: Map<String, Any>) {
    val eventType = (event["eventType"] as? String)?.replace("_", " ") ?: "Unknown"
    val vehiclePlate = event["vehiclePlate"] as? String ?: "Unknown"
    val severity = event["severity"] as? String ?: "info"

    val color = when (severity) {
        "critical" -> Error
        "high" -> Warning
        "medium" -> Muted
        else -> Success
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = color.copy(alpha = 0.1f),
                modifier = Modifier.size(8.dp)
            ) {}
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(eventType, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
                Text(vehiclePlate, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
            Text(severity.uppercase(), style = MaterialTheme.typography.labelSmall, color = color)
        }
    }
}
