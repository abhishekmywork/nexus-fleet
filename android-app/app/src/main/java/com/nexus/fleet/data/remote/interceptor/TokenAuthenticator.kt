package com.nexus.fleet.data.remote.interceptor

import com.nexus.fleet.data.local.prefs.TokenStore
import com.nexus.fleet.data.remote.api.AuthApi
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider

class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val authApiProvider: Provider<AuthApi>
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.code == 401) {
            val refreshToken = runBlocking { tokenStore.getRefreshToken() }
            if (refreshToken.isNullOrEmpty()) return null

            val result = runBlocking {
                try {
                    authApiProvider.get().refresh(mapOf("refreshToken" to refreshToken))
                } catch (e: Exception) {
                    null
                }
            }

            if (result != null && result.accessToken != null && result.refreshToken != null) {
                runBlocking {
                    tokenStore.saveTokens(result.accessToken, result.refreshToken)
                }
                return response.request.newBuilder()
                    .header("Authorization", "Bearer ${result.accessToken}")
                    .build()
            }

            runBlocking { tokenStore.clearTokens() }
        }
        return null
    }
}
