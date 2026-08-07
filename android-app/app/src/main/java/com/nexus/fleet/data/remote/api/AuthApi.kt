package com.nexus.fleet.data.remote.api

import com.nexus.fleet.domain.model.LoginResponse
import com.nexus.fleet.domain.model.User
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body body: Map<String, String>): LoginResponse

    @POST("auth/2fa/verify-login")
    suspend fun verifyTwoFactor(@Body body: Map<String, String>): LoginResponse

    @POST("auth/refresh")
    suspend fun refresh(@Body body: Map<String, String>): LoginResponse

    @POST("auth/logout")
    suspend fun logout(@Body body: Map<String, String>)

    @GET("auth/me")
    suspend fun me(): User

    @PATCH("auth/me")
    suspend fun updateProfile(@Body body: Map<String, Any?>): User

    @POST("auth/2fa/setup")
    suspend fun setupTwoFactor(@Body body: Map<String, String>): Map<String, Any>

    @POST("auth/2fa/verify")
    suspend fun verifyTwoFactorSetup(@Body body: Map<String, String>): Map<String, Any>

    @POST("auth/2fa/disable")
    suspend fun disableTwoFactor(@Body body: Map<String, String>): Map<String, Any>
}
