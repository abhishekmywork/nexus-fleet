package com.nexus.fleet.ui.navigation

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object TwoFactor : Screen("two_factor/{twoFactorToken}/{method}/{sentTo}") {
        fun createRoute(twoFactorToken: String, method: String, sentTo: String) =
            "two_factor/$twoFactorToken/$method/$sentTo"
    }
    data object Dashboard : Screen("dashboard")
    data object Vehicles : Screen("vehicles")
    data object VehicleDetail : Screen("vehicles/{vehicleId}") {
        fun createRoute(vehicleId: String) = "vehicles/$vehicleId"
    }
    data object Events : Screen("events")
    data object Map : Screen("map")
    data object Geofences : Screen("geofences")
    data object Reports : Screen("reports")
    data object Profile : Screen("profile")
}
