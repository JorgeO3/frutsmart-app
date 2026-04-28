package expo.modules.nanort.module.interpreter.testing

object ThreadIntrospection {

  fun countAliveThreadsWithNamePrefix(prefix: String): Int {
    return Thread.getAllStackTraces()
      .keys
      .count { it.isAlive && it.name.startsWith(prefix) }
  }
}
