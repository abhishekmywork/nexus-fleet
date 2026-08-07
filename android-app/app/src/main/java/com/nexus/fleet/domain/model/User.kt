package com.nexus.fleet.domain.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class RoleSummary(
    val key: String,
    val name: String
)

@JsonClass(generateAdapter = true)
data class User(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val phone: String?,
    val isActive: Boolean,
    val isSuperUser: Boolean,
    val twoFactorEnabled: Boolean,
    val twoFactorMethod: String?,
    val tenantId: String?,
    val roles: List<RoleSummary>,
    val permissions: List<String>,
    val createdAt: String? = null,
    val updatedAt: String? = null
) {
    val fullName: String get() = "$firstName $lastName".trim()
    val isAdmin: Boolean get() = isSuperUser || permissions.contains("vehicles:read")
    val isDriver: Boolean get() = !isSuperUser && permissions.contains("drivers:read") && !permissions.contains("vehicles:create")
}

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val accessToken: String?,
    val refreshToken: String?,
    val tokenType: String?,
    val expiresIn: Long?,
    val user: User?,
    val twoFactorRequired: Boolean?,
    val method: String?,
    val sentTo: String?,
    val devCode: String?,
    val twoFactorToken: String?
)
