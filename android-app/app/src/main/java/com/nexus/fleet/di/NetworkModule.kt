package com.nexus.fleet.di

import android.content.Context
import com.nexus.fleet.BuildConfig
import com.nexus.fleet.data.local.prefs.TokenStore
import com.nexus.fleet.data.remote.interceptor.AuthInterceptor
import com.nexus.fleet.data.remote.interceptor.TokenAuthenticator
import com.nexus.fleet.data.remote.api.AuthApi
import com.nexus.fleet.data.remote.api.DashboardApi
import com.nexus.fleet.data.remote.api.EventApi
import com.nexus.fleet.data.remote.api.GeofenceApi
import com.nexus.fleet.data.remote.api.ReportApi
import com.nexus.fleet.data.remote.api.TelemetryApi
import com.nexus.fleet.data.remote.api.VehicleApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .authenticator(tokenAuthenticator)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit = Retrofit.Builder()
        .baseUrl("${BuildConfig.BASE_URL}/")
        .client(client)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    @Provides @Singleton fun provideAuthApi(retrofit: Retrofit) = retrofit.create(AuthApi::class.java)
    @Provides @Singleton fun provideVehicleApi(retrofit: Retrofit) = retrofit.create(VehicleApi::class.java)
    @Provides @Singleton fun provideEventApi(retrofit: Retrofit) = retrofit.create(EventApi::class.java)
    @Provides @Singleton fun provideTelemetryApi(retrofit: Retrofit) = retrofit.create(TelemetryApi::class.java)
    @Provides @Singleton fun provideGeofenceApi(retrofit: Retrofit) = retrofit.create(GeofenceApi::class.java)
    @Provides @Singleton fun provideReportApi(retrofit: Retrofit) = retrofit.create(ReportApi::class.java)
    @Provides @Singleton fun provideDashboardApi(retrofit: Retrofit) = retrofit.create(DashboardApi::class.java)
}
