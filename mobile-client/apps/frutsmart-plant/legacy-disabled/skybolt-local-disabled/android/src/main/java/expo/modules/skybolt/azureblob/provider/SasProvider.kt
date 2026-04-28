package expo.modules.skybolt.azureblob.provider

import expo.modules.skybolt.core.upload.api.ItemSpec

/**
 * Proveedor de SAS desacoplado del backend.
 * El Worker (o tu repositorio http/) provee una implementación concreta.
 */
interface SasProvider {
    suspend fun acquire(item: ItemSpec): String
    suspend fun refresh(item: ItemSpec): String
}