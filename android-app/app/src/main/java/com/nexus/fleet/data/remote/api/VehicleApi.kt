package com.nexus.fleet.data.remote.api

import com.nexus.fleet.domain.model.Vehicle
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface VehicleApi {
    @GET("vehicles")
    suspend fun list(): List<Vehicle>

    @GET("vehicles/{id}")
    suspend fun get(@Path("id") id: String): Vehicle
}
