package com.skybolt.azureblob.auth

import com.skybolt.core.auth.AuthTokens
import com.skybolt.core.auth.TokenRefresher
import com.skybolt.core.util.logger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject


class AzureB2CTokenRefresher(
    private val httpClient: OkHttpClient,
    private val config: AzureAuthConfig
) : TokenRefresher {
    private val log by logger()

    override suspend fun refresh(current: AuthTokens): AuthTokens =
        withContext(Dispatchers.IO) {
            log.d { "Refreshing token against ${config.tokenEndpoint}" }
            val form = FormBody.Builder()
                .add("grant_type", "refresh_token")
                .add("client_id", config.clientId)
                .add("refresh_token", current.refreshToken)
                .add("scope", config.scope)
                .build()

            val request = Request.Builder()
                .url(config.tokenEndpoint)
                .post(form)
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    log.w { "Refresh failed: code=${response.code}, msg=${response.message}" }
                    throw IllegalStateException("Refresh token failed: ${response.code}")
                }

                val body = response.body?.string().orEmpty()
                if (body.isEmpty()) {
                    log.e { "Refresh response body is empty" }
                    throw IllegalStateException("Empty refresh response")
                }

                val json = JSONObject(body)

                val accessToken = json.optString("access_token", "")
                val newRefreshToken = json.optString("refresh_token", current.refreshToken)
                val idToken = json.optString("id_token", current.idToken)
                val expiresInSec = json.optLong("expires_in", 0L)

                if (accessToken.isBlank() || expiresInSec <= 0L) {
                    log.e { "Invalid refresh response: accessTokenBlank=${accessToken.isBlank()}, expiresIn=$expiresInSec" }
                    throw IllegalStateException("Invalid refresh response")
                }

                val now = System.currentTimeMillis()
                val accessExpiresAtMs = now + expiresInSec * 1000L - config.clockSkewMs
                
                // If backend doesn't return refresh expiry, we assume a standard window (e.g. 90 days)
                // or we keep the old one if we want to be conservative. 
                // But copying the old one blindly prevents sliding window.
                // Let's assume a default sliding window of 90 days if not provided.
                val refreshExpiresInSec = json.optLong("refresh_token_expires_in", 90 * 24 * 3600L)
                val refreshExpiresAtMs = now + refreshExpiresInSec * 1000L

                log.i { "Token refreshed successfully. Access expires in ${expiresInSec}s" }

                val result = AuthTokens(
                    accessToken = accessToken,
                    refreshToken = newRefreshToken,
                    idToken = idToken,
                    accessExpiresAtMs = accessExpiresAtMs,
                    refreshExpiresAtMs = refreshExpiresAtMs
                )

                require(result.accessToken.isNotBlank()) { "accessToken cannot be blank" }
                require(result.refreshToken.isNotBlank()) { "refreshToken cannot be blank" }
                require(result.idToken.isNotBlank()) { "idToken cannot be blank" }

                result
            }
        }
}

data class AzureAuthConfig(
    val tokenEndpoint: String,
    val clientId: String,
    val scope: String,
    val clockSkewMs: Long = 30_000L
)
