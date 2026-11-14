package expo.modules.sdnative

object SdBridge {
  init {
    System.loadLibrary("sdnative")
  }

  @Volatile
  var listener: ((Int, Int) -> Unit)? = null

  // Вызывается из JNI во время генерации.
  @Suppress("unused")
  fun onProgress(step: Int, steps: Int) {
    listener?.invoke(step, steps)
  }

  external fun nativeGenerate(
    model: String,
    prompt: String,
    negative: String,
    width: Int,
    height: Int,
    steps: Int,
    cfg: Float,
    seed: Long,
    threads: Int,
    out: String
  ): String

  external fun nativeCancel()
  external fun nativeRelease()
}
