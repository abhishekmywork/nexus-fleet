package com.nexus.fleet.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PaginatedResponse<T>(
    val data: List<T>,
    val meta: PaginationMeta
)

@JsonClass(generateAdapter = true)
data class PaginationMeta(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)
