package com.nexus.fleet.data.repository

import com.nexus.fleet.data.local.prefs.TokenStore
import com.nexus.fleet.data.remote.api.AuthApi
import com.nexus.fleet.domain.model.LoginResponse
import com.nexus.fleet.domain.model.User
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenStore: TokenStore
) {
    suspend fun login(email: String, password: String): LoginResponse {
        val response = authApi.login(mapOf("email" to email, "password" to password))
        if (response.accessToken != null && response.refreshToken != null) {
            tokenStore.saveTokens(response.accessToken, response.refreshToken)
        }
        return response
    }

    suspend fun verifyTwoFactor(twoFactorToken: String, code: String): LoginResponse {
        val response = authApi.verifyTwoFactor(mapOf(
            "twoFactorToken" to twoFactorToken,
            "code" to code
        ))
        if (response.accessToken != null && response.refreshToken != null) {
            tokenStore.saveTokens(response.accessToken, response.refreshToken)
        }
        return response
    }

    suspend fun getProfile(): User = authApi.me()

    suspend fun logout() {
        val refresh = tokenStore.getRefreshToken()
        if (refresh != null) {
            try { authApi.logout(mapOf("refreshToken" to refresh)) } catch (_: Exception) {}
        }
        tokenStore.clearTokens()
    }

    suspend fun isLoggedIn(): Boolean = !tokenStore.getAccessToken().isNullOrEmpty()

    suspend fun setupTwoFactor(method: String): Map<String, Any> =
        authApi.setupTwoFactor(mapOf("method" to method))

    suspend fun verifyTwoFactorSetup(code: String): Map<String, Any> =
        authApi.verifyTwoFactorSetup(mapOf("code" to code))

    suspend fun disableTwoFactor(code: String): Map<String, Any> =
        authApi.disableTwoFactor(mapOf("code" to code))
}
