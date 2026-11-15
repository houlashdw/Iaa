// Фильтры постобработки для RGB-буферов (uint8, channel = 3 или 4).
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace sdfilters {

// Быстрый box blur по одной оси (скользящее окно), в float.
inline void box_blur_axis(std::vector<float>& src, std::vector<float>& dst, int w, int h, int r,
                          bool horizontal) {
  const int len = horizontal ? w : h;
  const int lines = horizontal ? h : w;
  for (int l = 0; l < lines; l++) {
    auto at = [&](int i) -> float& {
      return horizontal ? src[(size_t)l * w + i] : src[(size_t)i * w + l];
    };
    auto out = [&](int i) -> float& {
      return horizontal ? dst[(size_t)l * w + i] : dst[(size_t)i * w + l];
    };
    double acc = 0;
    for (int i = -r; i <= r; i++) acc += at(std::clamp(i, 0, len - 1));
    for (int i = 0; i < len; i++) {
      out(i) = (float)(acc / (2 * r + 1));
      acc += at(std::min(i + r + 1, len - 1)) - at(std::max(i - r, 0));
    }
  }
}

inline void blur(std::vector<float>& v, int w, int h, int r) {
  std::vector<float> tmp(v.size());
  for (int pass = 0; pass < 3; pass++) {  // 3 прохода ≈ гауссово размытие
    box_blur_axis(v, tmp, w, h, r, true);
    box_blur_axis(tmp, v, w, h, r, false);
  }
}

// Карандашный эскиз с тенями: серый + инверсия + размытие + color dodge, затем подмешиваем тон.
inline void pencil_sketch(uint8_t* data, int w, int h, int ch) {
  const size_t n = (size_t)w * h;
  std::vector<float> gray(n), inv(n);
  for (size_t i = 0; i < n; i++) {
    const uint8_t* p = data + i * ch;
    gray[i] = 0.299f * p[0] + 0.587f * p[1] + 0.114f * p[2];
    inv[i] = 255.0f - gray[i];
  }
  int r = std::max(2, std::min(w, h) / 70);
  blur(inv, w, h, r);
  for (size_t i = 0; i < n; i++) {
    float dodge = std::min(255.0f, gray[i] * 255.0f / std::max(1.0f, 255.0f - inv[i]));
    float line = dodge / 255.0f;
    float shade = gray[i] / 255.0f;
    // линии от dodge + мягкая штриховка тоном оригинала
    float v = line * (0.5f + 0.5f * shade);
    v = std::pow(std::clamp(v, 0.0f, 1.0f), 1.35f);
    uint8_t o = (uint8_t)std::clamp(v * 255.0f + 0.5f, 0.0f, 255.0f);
    uint8_t* p = data + i * ch;
    // слегка тёплая бумага
    p[0] = (uint8_t)std::min(255.0f, o * 1.0f + 3);
    p[1] = o;
    p[2] = (uint8_t)std::max(0.0f, o * 0.96f);
  }
}

}  // namespace sdfilters
