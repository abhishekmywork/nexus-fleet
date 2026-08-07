package com.nexus.fleet.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.fleet.ui.theme.*

data class MapModeOption(
    val mode: MapMode,
    val label: String,
    val icon: ImageVector
)

private val mapModeOptions = listOf(
    MapModeOption(MapMode.STANDARD, "Standard", Icons.Default.Map),
    MapModeOption(MapMode.SATELLITE, "Satellite", Icons.Default.SatelliteAlt),
    MapModeOption(MapMode.TERRAIN, "Terrain", Icons.Default.Terrain),
    MapModeOption(MapMode.HYBRID, "Hybrid", Icons.Default.Layers),
)

@Composable
fun MapModeSwitcher(
    currentMode: MapMode,
    onModeSelected: (MapMode) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val currentOption = mapModeOptions.find { it.mode == currentMode } ?: mapModeOptions[0]

    Box {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
            shadowElevation = 2.dp,
            modifier = Modifier.clickable { expanded = true }
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(currentOption.icon, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(currentOption.label, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                Spacer(Modifier.width(4.dp))
                Icon(Icons.Default.ArrowDropDown, contentDescription = null, modifier = Modifier.size(14.dp))
            }
        }

        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            mapModeOptions.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(option.icon, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(option.label, fontSize = 12.sp)
                        }
                    },
                    onClick = {
                        onModeSelected(option.mode)
                        expanded = false
                    },
                    leadingIcon = if (option.mode == currentMode) {
                        { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp), tint = Primary) }
                    } else null
                )
            }
        }
    }
}

@Composable
fun ConnectionIndicator(connected: Boolean) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
        shadowElevation = 2.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (connected) Success else Error)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                if (connected) "Live" else "Disconnected",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun SidebarReopenButton(onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
        shadowElevation = 4.dp,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = "Open sidebar",
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(2.dp))
            Text("Menu", fontSize = 11.sp)
        }
    }
}
