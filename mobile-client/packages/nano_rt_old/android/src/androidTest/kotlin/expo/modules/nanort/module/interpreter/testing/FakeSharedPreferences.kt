package expo.modules.nanort.module.interpreter.testing

import android.content.SharedPreferences
import java.util.concurrent.ConcurrentHashMap

class FakePrefsDisk {
  val disk = ConcurrentHashMap<String, Any?>()
}

class FakeSharedPreferences(private val disk: FakePrefsDisk) : SharedPreferences {

  private val mem = ConcurrentHashMap<String, Any?>().apply { putAll(disk.disk) }

  override fun getBoolean(key: String, defValue: Boolean): Boolean =
    (mem[key] as? Boolean) ?: defValue

  override fun getString(key: String, defValue: String?): String? =
    (mem[key] as? String) ?: defValue

  override fun edit(): SharedPreferences.Editor = EditorImpl()

  override fun contains(key: String): Boolean = mem.containsKey(key)
  override fun getAll(): MutableMap<String, *> = mem.toMutableMap()
  override fun getInt(key: String, defValue: Int): Int = (mem[key] as? Int) ?: defValue
  override fun getLong(key: String, defValue: Long): Long = (mem[key] as? Long) ?: defValue
  override fun getFloat(key: String, defValue: Float): Float = (mem[key] as? Float) ?: defValue
  override fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>? {
    val value = mem[key] as? Set<*>
    val set = value?.takeIf { it.all { e -> e is String } }?.map { it as String }?.toMutableSet()
    return set ?: defValues
  }

  override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) = Unit
  override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) = Unit

  private inner class EditorImpl : SharedPreferences.Editor {
    private val pending = LinkedHashMap<String, Any?>()
    private var clearAll = false

    override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor = apply { pending[key] = value }
    override fun putString(key: String, value: String?): SharedPreferences.Editor = apply { pending[key] = value }
    override fun remove(key: String): SharedPreferences.Editor = apply { pending[key] = TOMBSTONE }
    override fun clear(): SharedPreferences.Editor = apply { clearAll = true }

    override fun putInt(key: String, value: Int): SharedPreferences.Editor = apply { pending[key] = value }
    override fun putLong(key: String, value: Long): SharedPreferences.Editor = apply { pending[key] = value }
    override fun putFloat(key: String, value: Float): SharedPreferences.Editor = apply { pending[key] = value }
    override fun putStringSet(key: String, values: MutableSet<String>?): SharedPreferences.Editor = apply { pending[key] = values }

    override fun apply() {
      applyToMem()
    }

    override fun commit(): Boolean {
      applyToMem()
      disk.disk.clear()
      disk.disk.putAll(mem)
      return true
    }

    private fun applyToMem() {
      if (clearAll) mem.clear()
      for ((key, value) in pending) {
        if (value === TOMBSTONE) mem.remove(key) else mem[key] = value
      }
      pending.clear()
      clearAll = false
    }
  }

  private companion object {
    private val TOMBSTONE = Any()
  }
}
