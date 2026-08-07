package com.nexus.fleet.data.remote.api

import com.nexus.fleet.domain.model.Event
import com.nexus.fleet.domain.model.PaginatedResponse
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.Query

interface EventApi {
    @GET("events")
    suspend fun list(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
        @Query("deviceId") deviceId: String? = null,
        @Query("eventType") eventType: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("acknowledged") acknowledged: Boolean? = null
    ): PaginatedResponse<Event>

    @PATCH("events/{id}/acknowledge")
    suspend fun acknowledge(@Path("id") id: String): Event
}
