package com.nexus.fleet.ui.events

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.fleet.data.repository.EventRepository
import com.nexus.fleet.domain.model.Event
import com.nexus.fleet.domain.model.PaginatedResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class EventListState {
    data object Loading : EventListState()
    data class Success(val events: List<Event>, val total: Int, val page: Int, val totalPages: Int) : EventListState()
    data class Error(val message: String) : EventListState()
}

@HiltViewModel
class EventsViewModel @Inject constructor(
    private val eventRepository: EventRepository
) : ViewModel() {

    private val _state = MutableStateFlow<EventListState>(EventListState.Loading)
    val state: StateFlow<EventListState> = _state.asStateFlow()

    init { load() }

    fun load(page: Int = 1) {
        viewModelScope.launch {
            _state.value = EventListState.Loading
            try {
                val response = eventRepository.getEvents(page = page)
                _state.value = EventListState.Success(
                    events = response.data,
                    total = response.meta.total,
                    page = response.meta.page,
                    totalPages = response.meta.totalPages
                )
            } catch (e: Exception) {
                _state.value = EventListState.Error(e.message ?: "Failed to load")
            }
        }
    }

    fun acknowledge(eventId: String) {
        viewModelScope.launch {
            try {
                eventRepository.acknowledge(eventId)
                load()
            } catch (_: Exception) {}
        }
    }
}
