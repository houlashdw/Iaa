cmake_minimum_required(VERSION 3.22.1)
project(sdnative CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# stable-diffusion.cpp клонируется в third_party скриптом/CI (см. README и workflow)
set(SD_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../third_party/stable-diffusion.cpp")
if(NOT EXISTS "${SD_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "stable-diffusion.cpp not found at ${SD_DIR}. Run scripts/fetch-sd.sh first.")
endif()

set(SD_WEBP OFF CACHE BOOL "" FORCE)
set(SD_WEBM OFF CACHE BOOL "" FORCE)
set(SD_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SD_BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
# Базовый ARMv8.2 + dotprod подходит для Dimensity 9400 и большинства современных телефонов.
set(GGML_CPU_ARM_ARCH "armv8.2-a+dotprod+fp16" CACHE STRING "" FORCE)

add_subdirectory(${SD_DIR} sd-build)

add_library(sdnative SHARED sd_jni.cpp)
target_include_directories(sdnative PRIVATE "${SD_DIR}/include" "${SD_DIR}/thirdparty")
target_link_libraries(sdnative PRIVATE stable-diffusion log android)
target_link_options(sdnative PRIVATE "-Wl,-z,max-page-size=16384")
