// JNI-обёртка над stable-diffusion.cpp: txt2img -> PNG файл.
#include <jni.h>
#include <android/log.h>
#include <atomic>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <string>

#include "stable-diffusion.h"

#define STB_IMAGE_WRITE_STATIC
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

#define TAG "SdNative"

namespace {

std::mutex g_mutex;
sd_ctx_t* g_ctx = nullptr;
std::string g_model;
int g_threads = 0;
std::string g_last_error;

JavaVM* g_vm = nullptr;
jobject g_bridge = nullptr;  // global ref
jmethodID g_on_progress = nullptr;

void log_cb(enum sd_log_level_t level, const char* text, void*) {
  int prio = ANDROID_LOG_INFO;
  if (level == SD_LOG_ERROR) {
    prio = ANDROID_LOG_ERROR;
    g_last_error = text ? text : "";
    while (!g_last_error.empty() && (g_last_error.back() == '\n' || g_last_error.back() == '\r')) {
      g_last_error.pop_back();
    }
  } else if (level == SD_LOG_WARN) {
    prio = ANDROID_LOG_WARN;
  } else if (level == SD_LOG_DEBUG || level == SD_LOG_VERBOSE) {
    return;
  }
  __android_log_print(prio, TAG, "%s", text ? text : "");
}

void progress_cb(int step, int steps, float /*time*/, void*) {
  if (!g_vm || !g_bridge || !g_on_progress) return;
  JNIEnv* env = nullptr;
  bool attached = false;
  if (g_vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
    if (g_vm->AttachCurrentThread(&env, nullptr) != JNI_OK) return;
    attached = true;
  }
  env->CallVoidMethod(g_bridge, g_on_progress, step, steps);
  if (env->ExceptionCheck()) env->ExceptionClear();
  if (attached) g_vm->DetachCurrentThread();
}

std::string to_str(JNIEnv* env, jstring s) {
  if (!s) return "";
  const char* c = env->GetStringUTFChars(s, nullptr);
  std::string out = c ? c : "";
  if (c) env->ReleaseStringUTFChars(s, c);
  return out;
}

void free_ctx_locked() {
  if (g_ctx) {
    free_sd_ctx(g_ctx);
    g_ctx = nullptr;
  }
  g_model.clear();
  g_threads = 0;
}

}  // namespace

extern "C" {

JNIEXPORT jstring JNICALL Java_expo_modules_sdnative_SdBridge_nativeGenerate(
    JNIEnv* env, jobject thiz, jstring jModel, jstring jPrompt, jstring jNegative, jint width,
    jint height, jint steps, jfloat cfg, jlong seed, jint threads, jstring jOut) {
  std::lock_guard<std::mutex> lock(g_mutex);

  env->GetJavaVM(&g_vm);
  if (g_bridge) env->DeleteGlobalRef(g_bridge);
  g_bridge = env->NewGlobalRef(thiz);
  g_on_progress = env->GetMethodID(env->GetObjectClass(thiz), "onProgress", "(II)V");

  const std::string model = to_str(env, jModel);
  const std::string prompt = to_str(env, jPrompt);
  const std::string negative = to_str(env, jNegative);
  const std::string out = to_str(env, jOut);

  g_last_error.clear();
  sd_set_log_callback(log_cb, nullptr);
  sd_set_progress_callback(progress_cb, nullptr);

  if (!g_ctx || g_model != model || g_threads != threads) {
    free_ctx_locked();
    sd_ctx_params_t cp;
    sd_ctx_params_init(&cp);
    cp.model_path = model.c_str();
    cp.n_threads = threads;
    cp.enable_mmap = true;
    g_ctx = new_sd_ctx(&cp);
    if (!g_ctx) {
      std::string msg = "Не удалось загрузить модель-художник.";
      if (!g_last_error.empty()) msg += " " + g_last_error;
      return env->NewStringUTF(msg.c_str());
    }
    g_model = model;
    g_threads = threads;
  }

  sd_cancel_generation(g_ctx, SD_CANCEL_RESET);

  sd_img_gen_params_t gp;
  sd_img_gen_params_init(&gp);
  gp.prompt = prompt.c_str();
  gp.negative_prompt = negative.c_str();
  gp.width = width;
  gp.height = height;
  gp.seed = seed;
  gp.batch_count = 1;
  gp.sample_params.sample_steps = steps;
  gp.sample_params.guidance.txt_cfg = cfg;
  gp.sample_params.sample_method = sd_get_default_sample_method(g_ctx);
  gp.sample_params.scheduler = sd_get_default_scheduler(g_ctx, gp.sample_params.sample_method);
  gp.vae_tiling_params.enabled = true;  // экономит память при декодировании

  sd_image_generation_result_t* result = nullptr;
  bool ok = generate_image(g_ctx, &gp, &result);
  if (!ok || !result || result->count < 1 || !result->items[0].image.data) {
    if (result) free_sd_image_generation_result(result);
    std::string msg = "Генерация не удалась или была остановлена.";
    if (!g_last_error.empty()) msg += " " + g_last_error;
    return env->NewStringUTF(msg.c_str());
  }

  const sd_image_t& im = result->items[0].image;
  int wrote = stbi_write_png(out.c_str(), (int)im.width, (int)im.height, (int)im.channel, im.data,
                             (int)(im.width * im.channel));
  free_sd_image_generation_result(result);
  if (!wrote) return env->NewStringUTF("Не удалось сохранить PNG.");
  return env->NewStringUTF("");
}

JNIEXPORT void JNICALL Java_expo_modules_sdnative_SdBridge_nativeCancel(JNIEnv*, jobject) {
  // без mutex: генерация держит его всё время работы
  sd_ctx_t* c = g_ctx;
  if (c) sd_cancel_generation(c, SD_CANCEL_ALL);
}

JNIEXPORT void JNICALL Java_expo_modules_sdnative_SdBridge_nativeRelease(JNIEnv*, jobject) {
  std::lock_guard<std::mutex> lock(g_mutex);
  free_ctx_locked();
}

}  // extern "C"
