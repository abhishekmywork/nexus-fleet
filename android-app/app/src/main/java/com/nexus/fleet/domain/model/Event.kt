package com.nexus.fleet.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Event(
    val id: String,
    val deviceId: String,
    val eventType: String,
    val latitude: Double?,
    val longitude: Double?,
    val speed: Double?,
    val metadata: Map<String, Any>?,
    val acknowledged: Boolean,
    val startedAt: String,
    val endedAt: String?,
    val tenantId: String,
    val createdAt: String?
) {
    val vehiclePlate: String get() = metadata?.get("vehiclePlate") as? String ?: "Unknown"
    val ruleName: String get() = metadata?.get("ruleName") as? String ?: eventType
    val isOngoing: Boolean get() = endedAt == null
}

@JsonClass(generateAdapter = true)
data class EventStats(
    val total: Int,
    val unacknowledged: Int,
    val byType: Map<String, Int>
)
