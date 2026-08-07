package com.nexus.fleet.data.remote.api

import com.nexus.fleet.domain.model.ActivePosition
import com.nexus.fleet.domain.model.Geofence
import com.nexus.fleet.domain.model.TrailPoint
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface TelemetryApi {
    @GET("telemetry/readings/latest")
    suspend fun latestPositions(): List<ActivePosition>

    @GET("telemetry/trail/{deviceId}")
    suspend fun trail(@Path("deviceId") deviceId: String): List<TrailPoint>

    @GET("live-map/positions")
    suspend fun activePositions(): List<ActivePosition>
}

interface GeofenceApi {
    @GET("geofences")
    suspend fun list(): List<Geofence>

    @GET("geofences/{id}")
    suspend fun get(@Path("id") id: String): Geofence
}

interface ReportApi {
    @GET("reports/vehicle-trips")
    suspend fun vehicleTrips(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("vehicleId") vehicleId: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Map<String, Any>

    @GET("reports/daily-summary")
    suspend fun dailySummary(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Map<String, Any>

    @GET("reports/speed-violations")
    suspend fun speedViolations(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Map<String, Any>

    @GET("reports/event-log")
    suspend fun eventLog(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Map<String, Any>

    @GET("reports/driver-activity")
    suspend fun driverActivity(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("driverId") driverId: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Map<String, Any>
}

interface DashboardApi {
    @GET("dashboard/stats")
    suspend fun stats(): Map<String, Any>

    @GET("dashboard/recent-events")
    suspend fun recentEvents(@Query("limit") limit: Int = 15): List<Map<String, Any>>

    @GET("dashboard/vehicle-positions")
    suspend fun vehiclePositions(): List<Map<String, Any>>
}
