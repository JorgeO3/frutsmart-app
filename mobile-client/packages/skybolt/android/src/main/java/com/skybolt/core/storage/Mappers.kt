package com.skybolt.core.storage

import com.skybolt.core.upload.api.ItemSpec
import com.skybolt.proto.ItemRecord
import kotlin.collections.map
import kotlin.takeIf
import kotlin.text.isNotBlank

/**
 * Mappers entre modelos de dominio y proto/uploader.
 * 
 * Útil para convertir ItemRecord (proto) a ItemSpec (uploader API)
 * y viceversa, manteniendo separación de responsabilidades.
 */
object Mappers {

  /**
   * Convierte un ItemRecord (proto) a ItemSpec (uploader API).
   * 
   * @param item ItemRecord desde proto DataStore
   * @return ItemSpec listo para el uploader
   */
  fun itemRecordToItemSpec(item: ItemRecord): ItemSpec {
    return ItemSpec(
      clientItemId = item.clientItemId,
      localUri = item.localUri,
      blobName = item.blobName,
      contentType = item.contentType,
      sizeBytes = item.totalBytes,
      md5Hex = item.md5Hex.takeIf { it.isNotBlank() },
      metadata = item.metadataMap.toMap()
    )
  }

  /**
   * Convierte múltiples ItemRecords a ItemSpecs.
   * 
   * @param items Lista de ItemRecord
   * @return Lista de ItemSpec
   */
  fun itemRecordsToItemSpecs(items: List<ItemRecord>): List<ItemSpec> {
    return items.map { itemRecordToItemSpec(it) }
  }
}
