package com.nexus.fleet.data.repository

import com.nexus.fleet.data.remote.api.EventApi
import com.nexus.fleet.domain.model.Event
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EventRepository @Inject constructor(
    private val eventApi: EventApi
) {
    suspend fun getEvents(
        page: Int = 1,
        limit: Int = 50,
        deviceId: String? = null,
        eventType: String? = null
    ) = eventApi.list(page = page, limit = limit, deviceId = deviceId, eventType = eventType)

    suspend fun acknowledge(eventId: String): Event = eventApi.acknowledge(eventId)
}
