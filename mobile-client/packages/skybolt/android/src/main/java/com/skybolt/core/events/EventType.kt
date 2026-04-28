package com.skybolt.core.events

enum class EventType(val wireName: String) {
    // Session
    SESSION_STARTED("session:started"),
    SESSION_PAUSED("session:paused"),
    SESSION_RESUMED("session:resumed"),
    SESSION_COMPLETED("session:completed"),
    SESSION_CANCELED("session:canceled"),
    SESSION_FAILED("session:failed"),

    // Items
    ITEM_PROGRESS("item:progress"),
    ITEM_COMPLETED("item:completed"),
    ITEM_FAILED("item:failed"),

    // Auth
    AUTH_REQUIRED("auth:required"),

    // Errors
    ERROR_FORBIDDEN("error:forbidden"),
    ERROR_RATE_LIMITED("error:rate-limited"),
    ERROR_THROTTLED("error:throttled"),
    ERROR_CONTRACT("error:contract"),
    ERROR_NETWORK("error:network"),
    ERROR_CHECKSUM("error:checksum"),
    ERROR_FILE_ACCESS("error:file-access"),
    ERROR_FATAL("error:fatal"),

    // SAS
    SAS_REQUESTED("sas:requested"),
    SAS_RECEIVED("sas:received"),
    SAS_ERROR("sas:error"),

    // Upload meta
    UPLOAD_STATE_CHANGE("upload:state-change"),
    UPLOAD_RECOVERY_COMPLETE("upload:recovery-complete"),
    UPLOAD_RESUME_ALL_COMPLETE("upload:resume-all-complete"),

    // Misc
    DEBUG("debug");
}
