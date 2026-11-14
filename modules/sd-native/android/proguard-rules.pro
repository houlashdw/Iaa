# JNI вызывает onProgress по имени, а нативные методы связаны по имени класса.
-keep class expo.modules.sdnative.SdBridge { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}
