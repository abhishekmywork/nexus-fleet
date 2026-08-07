package com.nexus.fleet.ui.events

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nexus.fleet.domain.model.Event
import com.nexus.fleet.ui.theme.Error
import com.nexus.fleet.ui.theme.Muted
import com.nexus.fleet.ui.theme.Success
import com.nexus.fleet.ui.theme.Warning
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(
    viewModel: EventsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Alerts", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        when (val s = state) {
            is EventListState.Loading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is EventListState.Error -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(s.message, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { viewModel.load() }) { Text("Retry") }
                    }
                }
            }
            is EventListState.Success -> {
                LazyColumn(
                    modifier = Modifier.padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(s.events, key = { it.id }) { event ->
                        EventCard(event, onAcknowledge = { viewModel.acknowledge(event.id) })
                    }
                }
            }
        }
    }
}

@Composable
fun EventCard(event: Event, onAcknowledge: () -> Unit) {
    val typeColor = when {
        event.eventType in listOf("SOS", "TOW_AWAY", "POWER_CUT") -> Error
        event.eventType in listOf("OVERSPEED", "HARSH_BRAKING", "HARSH_ACCELERATION") -> Warning
        event.eventType in listOf("GEOFENCE_IN", "IGNITION_ON") -> Success
        else -> Muted
    }

    val dateFormat = remember { SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()) }
    val timeStr = remember(event.startedAt) {
        try {
            val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(event.startedAt)
            date?.let { dateFormat.format(it) } ?: event.startedAt
        } catch (_: Exception) { event.startedAt }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = typeColor.copy(alpha = 0.1f)
                ) {
                    Text(
                        text = event.eventType.replace("_", " "),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                        color = typeColor,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(timeStr, style = MaterialTheme.typography.labelSmall, color = Muted)
            }

            Spacer(Modifier.height(6.dp))

            Text(
                text = event.vehiclePlate,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.bodyMedium
            )

            if (event.speed != null) {
                Text(
                    text = "Speed: ${event.speed} km/h",
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted
                )
            }

            if (!event.acknowledged) {
                Spacer(Modifier.height(6.dp))
                TextButton(
                    onClick = onAcknowledge,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Acknowledge", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}
