package com.nexus.fleet.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ActivePosition(
    val deviceId: String,
    val imei: String? = null,
    val vehicleId: String? = null,
    val plateNumber: String? = null,
    val make: String? = null,
    val model: String? = null,
    val status: String? = null,
    val latitude: Double,
    val longitude: Double,
    val speed: Double? = null,
    val heading: Double? = null,
    val ignition: String? = null,
    val movement: String? = null,
    val odometerKm: Double? = null,
    val batteryV: Double? = null,
    val gsmSignal: Int? = null,
    val timestamp: String? = null,
    val lastSeen: String? = null
)

@JsonClass(generateAdapter = true)
data class TrailPoint(
    val latitude: Double,
    val longitude: Double,
    val speed: Double? = null,
    val heading: Double? = null,
    val ignition: String? = null,
    val movement: String? = null,
    val timestamp: String? = null
)

@JsonClass(generateAdapter = true)
data class Geofence(
    val id: String,
    val name: String,
    val type: String,
    val coordinates: Map<String, Any>,
    val enabled: Boolean,
    val tenantId: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)
