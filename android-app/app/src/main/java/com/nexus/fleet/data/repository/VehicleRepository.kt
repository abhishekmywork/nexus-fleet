package com.nexus.fleet.data.repository

import com.nexus.fleet.data.remote.api.VehicleApi
import com.nexus.fleet.domain.model.Vehicle
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VehicleRepository @Inject constructor(
    private val vehicleApi: VehicleApi
) {
    suspend fun getVehicles(): List<Vehicle> = vehicleApi.list()

    suspend fun getVehicle(id: String): Vehicle = vehicleApi.get(id)
}
