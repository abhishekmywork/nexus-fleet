package com.nexus.fleet.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.fleet.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private fun timeAgo(ts: String?): String {
    if (ts.isNullOrEmpty()) return ""
    return try {
        val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(ts)
            ?: return ""
        val diff = (System.currentTimeMillis() - date.time) / 1000
        when {
            diff < 60 -> "${diff}s"
            diff < 3600 -> "${diff / 60}m"
            diff < 86400 -> "${diff / 3600}h"
            else -> "${diff / 86400}d"
        }
    } catch (_: Exception) { "" }
}

@Composable
fun VehicleSidebar(
    vehicles: List<MapVehicle>,
    visibleVehicles: Set<String>,
    selectedDeviceId: String?,
    showGeofences: Boolean,
    onToggle: (String) -> Unit,
    onSelect: (String) -> Unit,
    onShowAll: () -> Unit,
    onHideAll: () -> Unit,
    onToggleGeofences: () -> Unit,
    onBack: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }

    val movingCount = remember(vehicles) { vehicles.count { it.isMoving } }

    val filtered = remember(vehicles, searchQuery) {
        if (searchQuery.isBlank()) vehicles
        else {
            val q = searchQuery.lowercase()
            vehicles.filter { v ->
                v.plateNumber?.lowercase()?.contains(q) == true ||
                v.deviceId.lowercase().contains(q) ||
                v.movement?.lowercase()?.contains(q) == true ||
                v.ignition?.let { "ignition $it".lowercase().contains(q) } == true
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(280.dp)
            .background(MaterialTheme.colorScheme.surface)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Power, contentDescription = null, tint = Success, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Fleet", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Spacer(Modifier.weight(1f))
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Text(
                    "$movingCount/${vehicles.size}",
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Search
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search vehicles...", fontSize = 12.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp)) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }, modifier = Modifier.size(16.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(14.dp))
                    }
                }
            },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            textStyle = MaterialTheme.typography.bodySmall,
            shape = RoundedCornerShape(8.dp)
        )

        // Vehicle list
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            if (filtered.isEmpty()) {
                item {
                    Text(
                        if (vehicles.isEmpty()) "No vehicles with GPS data." else "No matches found.",
                        modifier = Modifier.padding(vertical = 32.dp).fillMaxWidth(),
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
            items(filtered, key = { it.deviceId }) { vehicle ->
                VehicleCard(
                    vehicle = vehicle,
                    isVisible = vehicle.deviceId in visibleVehicles,
                    isSelected = vehicle.deviceId == selectedDeviceId,
                    onToggle = { onToggle(vehicle.deviceId) },
                    onSelect = { onSelect(vehicle.deviceId) }
                )
            }
        }

        HorizontalDivider()

        // Show All / Hide All
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onShowAll,
                modifier = Modifier.weight(1f).height(28.dp),
                contentPadding = PaddingValues(0.dp)
            ) {
                Text("Show All", fontSize = 10.sp)
            }
            OutlinedButton(
                onClick = onHideAll,
                modifier = Modifier.weight(1f).height(28.dp),
                contentPadding = PaddingValues(0.dp)
            ) {
                Text("Hide All", fontSize = 10.sp)
            }
        }

        // Geofence toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Fence, contentDescription = null, tint = Muted, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Geofences", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
            Switch(
                checked = showGeofences,
                onCheckedChange = { onToggleGeofences() }
            )
        }

        HorizontalDivider()

        // Back button
        OutlinedButton(
            onClick = onBack,
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
                .height(32.dp),
            contentPadding = PaddingValues(0.dp)
        ) {
            Icon(Icons.Default.ArrowBack, contentDescription = null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Dashboard", fontSize = 11.sp)
        }
    }
}

@Composable
private fun VehicleCard(
    vehicle: MapVehicle,
    isVisible: Boolean,
    isSelected: Boolean,
    onToggle: () -> Unit,
    onSelect: () -> Unit
) {
    val statusColor = when {
        vehicle.isMoving -> Success
        vehicle.movement == "STOPPED" -> Warning
        else -> Muted
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(
                if (isSelected) Primary.copy(alpha = 0.1f)
                else Color.Transparent
            )
            .clickable(onClick = onSelect)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.Top
    ) {
        Switch(
            checked = isVisible,
            onCheckedChange = { onToggle() },
            modifier = Modifier.padding(top = 2.dp)
        )

        Spacer(Modifier.width(6.dp))

        Column(modifier = Modifier.weight(1f)) {
            // Plate number + status dot
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(statusColor)
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    vehicle.plateNumber ?: vehicle.deviceId.take(8),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (isSelected) {
                    Icon(
                        Icons.Default.Route,
                        contentDescription = null,
                        tint = Primary,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }

            // Speed + movement
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    vehicle.speed?.let { "${it.toInt()} km/h" } ?: "—",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(Modifier.width(4.dp))
                Text("·", fontSize = 10.sp, color = Muted)
                Spacer(Modifier.width(4.dp))
                Text(
                    vehicle.movement ?: "N/A",
                    fontSize = 10.sp,
                    color = statusColor,
                    fontWeight = FontWeight.Medium
                )
            }

            // Ignition, battery, GSM, time ago
            Row(verticalAlignment = Alignment.CenterVertically) {
                vehicle.ignition?.let {
                    Text(
                        "IGN $it",
                        fontSize = 9.sp,
                        color = if (it == "ON") Success else Muted
                    )
                    Spacer(Modifier.width(6.dp))
                }
                vehicle.batteryV?.let {
                    Text("${it}V", fontSize = 9.sp, color = Muted)
                    Spacer(Modifier.width(6.dp))
                }
                vehicle.gsmSignal?.let {
                    Text("${it}%", fontSize = 9.sp, color = Muted)
                    Spacer(Modifier.width(6.dp))
                }
                Spacer(Modifier.weight(1f))
                val ago = timeAgo(vehicle.lastSeen ?: vehicle.timestamp)
                if (ago.isNotEmpty()) {
                    Text(ago, fontSize = 9.sp, color = Muted)
                }
            }
        }
    }
}
