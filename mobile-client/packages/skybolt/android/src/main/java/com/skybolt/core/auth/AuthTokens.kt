package com.skybolt.core.auth

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val idToken: String,
    val accessExpiresAtMs: Long,
    val refreshExpiresAtMs: Long
)

fun Map<String, Any?>.toAuthTokens() = AuthTokens(
    accessToken = getRequiredString("accessToken"),
    refreshToken = getRequiredString("refreshToken"),
    idToken = getRequiredString("idToken"),
    accessExpiresAtMs = getRequiredLong("accessExpiresAtMs"),
    refreshExpiresAtMs = getRequiredLong("refreshExpiresAtMs")
)

fun Map<String, Any?>.getRequiredString(key: String): String =
    this[key] as? String ?: throw IllegalArgumentException("$key is required")

fun Map<String, Any?>.getRequiredLong(key: String): Long {
    val value = this[key] ?: throw IllegalArgumentException("$key is required")
    return (value as? Number)?.toLong() 
        ?: throw IllegalArgumentException("$key must be a number")
}