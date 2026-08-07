package com.nexus.fleet.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nexus.fleet.domain.model.User
import com.nexus.fleet.ui.auth.LoginScreen
import com.nexus.fleet.ui.auth.TwoFactorScreen
import com.nexus.fleet.ui.auth.AuthViewModel
import com.nexus.fleet.ui.vehicles.VehiclesScreen
import com.nexus.fleet.ui.vehicles.VehicleDetailScreen
import com.nexus.fleet.ui.events.EventsScreen
import com.nexus.fleet.ui.dashboard.DashboardScreen
import com.nexus.fleet.ui.map.LiveMapScreen
import com.nexus.fleet.ui.reports.ReportsScreen
import com.nexus.fleet.ui.profile.ProfileScreen
import com.nexus.fleet.ui.geofences.GeofencesScreen

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val adminOnly: Boolean = false
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Dashboard, "Dashboard", Icons.Filled.Dashboard, Icons.Outlined.Dashboard),
    BottomNavItem(Screen.Vehicles, "Vehicles", Icons.Filled.DirectionsCar, Icons.Outlined.DirectionsCar),
    BottomNavItem(Screen.Map, "Map", Icons.Filled.Map, Icons.Outlined.Map),
    BottomNavItem(Screen.Events, "Alerts", Icons.Filled.Event, Icons.Outlined.Event),
    BottomNavItem(Screen.Profile, "Profile", Icons.Filled.Person, Icons.Outlined.Person),
)

@Composable
fun NexusAppContent() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    var currentUser by remember { mutableStateOf<User?>(null) }
    var isAuthenticated by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        isAuthenticated = authViewModel.isLoggedIn()
        if (isAuthenticated) {
            currentUser = authViewModel.getProfile()
        }
    }

    if (!isAuthenticated) {
        LoginScreen(
            authViewModel = authViewModel,
            onLoginSuccess = { user ->
                currentUser = user
                isAuthenticated = true
            },
            onTwoFactorRequired = { token, method, sentTo ->
                navController.navigate(Screen.TwoFactor.createRoute(token, method, sentTo))
            }
        )
        return
    }

    LaunchedEffect(isAuthenticated) {
        navController.navigate(Screen.Dashboard.route) {
            popUpTo(0) { inclusive = true }
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute in bottomNavItems.map { it.screen.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    val filteredItems = bottomNavItems.filter { item ->
                        !item.adminOnly || currentUser?.isAdmin == true
                    }
                    filteredItems.forEach { item ->
                        val selected = currentRoute == item.screen.route
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    if (selected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label
                                )
                            },
                            label = { Text(item.label) },
                            selected = selected,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(padding),
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) }
        ) {
            composable(Screen.TwoFactor.route,
                arguments = listOf(
                    navArgument("twoFactorToken") { type = NavType.StringType },
                    navArgument("method") { type = NavType.StringType },
                    navArgument("sentTo") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                TwoFactorScreen(
                    authViewModel = authViewModel,
                    twoFactorToken = backStackEntry.arguments?.getString("twoFactorToken") ?: "",
                    method = backStackEntry.arguments?.getString("method") ?: "",
                    sentTo = backStackEntry.arguments?.getString("sentTo") ?: "",
                    onVerified = { user ->
                        currentUser = user
                        isAuthenticated = true
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Dashboard.route) {
                DashboardScreen()
            }

            composable(Screen.Vehicles.route) {
                VehiclesScreen(
                    onVehicleClick = { vehicleId ->
                        navController.navigate(Screen.VehicleDetail.createRoute(vehicleId))
                    }
                )
            }

            composable(
                Screen.VehicleDetail.route,
                arguments = listOf(navArgument("vehicleId") { type = NavType.StringType })
            ) {
                VehicleDetailScreen(
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Map.route) {
                LiveMapScreen(
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Events.route) {
                EventsScreen()
            }

            composable(Screen.Geofences.route) {
                GeofencesScreen()
            }

            composable(Screen.Reports.route) {
                ReportsScreen()
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLoggedOut = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
