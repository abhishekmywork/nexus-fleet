package com.nexus.fleet.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.repository.AuthRepository
import com.nexus.fleet.domain.model.LoginResponse
import com.nexus.fleet.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class AuthState {
    data object Idle : AuthState()
    data object Loading : AuthState()
    data class TwoFactorRequired(
        val token: String,
        val method: String,
        val sentTo: String,
        val devCode: String?
    ) : AuthState()
    data class Success(val user: User) : AuthState()
    data class Error(val message: String) : AuthState()
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _state = MutableStateFlow<AuthState>(AuthState.Idle)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            try {
                val response = authRepository.login(email, password)
                handleLoginResponse(response)
            } catch (e: Exception) {
                _state.value = AuthState.Error(e.message ?: "Login failed")
            }
        }
    }

    fun verifyTwoFactor(twoFactorToken: String, code: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            try {
                val response = authRepository.verifyTwoFactor(twoFactorToken, code)
                handleLoginResponse(response)
            } catch (e: Exception) {
                _state.value = AuthState.Error(e.message ?: "Verification failed")
            }
        }
    }

    private fun handleLoginResponse(response: LoginResponse) {
        if (response.twoFactorRequired == true) {
            _state.value = AuthState.TwoFactorRequired(
                token = response.twoFactorToken ?: "",
                method = response.method ?: "email",
                sentTo = response.sentTo ?: "",
                devCode = response.devCode
            )
        } else if (response.user != null) {
            _state.value = AuthState.Success(response.user)
        } else {
            _state.value = AuthState.Error("Login failed")
        }
    }

    suspend fun isLoggedIn(): Boolean = authRepository.isLoggedIn()

    suspend fun getProfile(): User? {
        return try {
            authRepository.getProfile()
        } catch (e: Exception) {
            null
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            _state.value = AuthState.Idle
            onDone()
        }
    }

    fun resetState() {
        _state.value = AuthState.Idle
    }
}
