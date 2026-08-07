package com.nexus.fleet.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Vehicle(
    val id: String,
    val plateNumber: String,
    val make: String?,
    val model: String?,
    val year: Int?,
    val status: String,
    val notes: String?,
    val driver: DriverSummary?,
    val gpsDevice: GpsDeviceSummary?,
    val servingAreas: List<ServingAreaSummary>,
    val createdAt: String?,
    val updatedAt: String?
) {
    val displayName: String get() = listOfNotNull(make, model).joinToString(" ").ifEmpty { plateNumber }
}

@JsonClass(generateAdapter = true)
data class DriverSummary(
    val id: String,
    val firstName: String,
    val lastName: String
) {
    val fullName: String get() = "$firstName $lastName".trim()
}

@JsonClass(generateAdapter = true)
data class GpsDeviceSummary(
    val id: String,
    val imei: String,
    val serialNumber: String?
)

@JsonClass(generateAdapter = true)
data class ServingAreaSummary(
    val id: String,
    val name: String
)
