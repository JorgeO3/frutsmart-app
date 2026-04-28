import ExpoModulesCore

/**
 * Skybolt Native Module for iOS.
 * 
 * ⚠️ WARNING: iOS implementation is not yet available.
 * This module currently only supports Android.
 * 
 * iOS implementation is planned for a future release and will include:
 * - Background URLSession uploads
 * - Chunked uploads to Azure Blob Storage
 * - Progress tracking and events
 * - Automatic retry logic
 * - SAS token management
 * 
 * For now, calling any of these methods from iOS will result in errors.
 */
public class SkyboltModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Skybolt")
    
    Events("onUploadEvent")
    
    // Throw not implemented errors for all functions
    AsyncFunction("configure") { (settings: [String: Any]) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
    
    AsyncFunction("initializeSession") { (config: [String: Any]) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
    
    AsyncFunction("startSession") { (sessionId: String) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
    
    AsyncFunction("pauseSession") { (sessionId: String) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
    
    AsyncFunction("resumeSession") { (sessionId: String) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
    
    AsyncFunction("cancelSession") { (sessionId: String) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
    
    AsyncFunction("getSessionProgress") { (sessionId: String) -> [String: Any]? in
      return nil
    }
    
    AsyncFunction("listActiveSessions") { () -> [String] in
      return []
    }
    
    AsyncFunction("purgeCompletedSessions") { (olderThanMs: Double?) -> Int in
      return 0
    }
    
    AsyncFunction("cleanupTempFiles") { () -> Int in
      return 0
    }
    
    AsyncFunction("extractMD5FromFiles") { (fileUris: [String]) in
      throw NSError(
        domain: "SkyboltModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "iOS implementation not available yet. Android only."]
      )
    }
  }
}
