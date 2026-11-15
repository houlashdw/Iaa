package expo.modules.sdnative

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SdNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SdNative")

    Events("onProgress")

    AsyncFunction("generate") { o: Map<String, Any?> ->
      fun num(k: String, d: Double) = (o[k] as? Number)?.toDouble() ?: d
      SdBridge.listener = { step, steps ->
        sendEvent("onProgress", mapOf("step" to step, "steps" to steps))
      }
      try {
        SdBridge.nativeGenerate(
          (o["model"] as? String) ?: "",
          (o["prompt"] as? String) ?: "",
          (o["negative"] as? String) ?: "",
          num("width", 512.0).toInt(),
          num("height", 512.0).toInt(),
          num("steps", 4.0).toInt(),
          num("cfg", 1.0).toFloat(),
          num("seed", -1.0).toLong(),
          num("threads", 4.0).toInt(),
          (o["out"] as? String) ?: "",
          (o["sampler"] as? String) ?: "auto",
          (o["scheduler"] as? String) ?: "auto",
          (o["filter"] as? String) ?: ""
        )
      } finally {
        SdBridge.listener = null
      }
    }

    Function("cancel") {
      SdBridge.nativeCancel()
    }

    AsyncFunction("release") {
      SdBridge.nativeRelease()
    }
  }
}
