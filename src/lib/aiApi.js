import { api } from "./api.js";

// AI 기본 설정 불러오기 (로컬스토리지)
export function getAiConfig() {
  const rawUrl = localStorage.getItem("aiUrl") || "";
  const aiUrl = rawUrl.trim().replace(/\/+$/, ""); // 끝자리 슬래시 제거 정규화
  const aiToken = (localStorage.getItem("aiToken") || "").trim();
  return { aiUrl, aiToken, isConfigured: Boolean(aiUrl && aiToken) };
}

// AI 설정 로컬스토리지에 저장
export function saveAiConfig(url, token) {
  const cleanUrl = (url || "").trim().replace(/\/+$/, "");
  const cleanToken = (token || "").trim();
  localStorage.setItem("aiUrl", cleanUrl);
  localStorage.setItem("aiToken", cleanToken);
  return { aiUrl: cleanUrl, aiToken: cleanToken, isConfigured: Boolean(cleanUrl && cleanToken) };
}

// GAS 백엔드에서 AI 설정 동기화
export async function syncAiConfigFromGAS() {
  try {
    const res = await api.getAiConfig();
    if (res && res.success && res.aiUrl) {
      return saveAiConfig(res.aiUrl, res.aiToken);
    }
    throw new Error(res?.message || "서버에서 AI 설정을 찾을 수 없습니다.");
  } catch (error) {
    console.error("AI 설정 동기화 실패:", error);
    throw error;
  }
}

// ==========================================
// 내 위치 날씨 (설정 페이지 토글, 좌표는 10분 캐시)
// ==========================================
const GEO_CACHE_MS = 10 * 60 * 1000;

export function isGeoWeatherEnabled() {
  return localStorage.getItem("useGeoWeather") === "true";
}

export function setGeoWeatherEnabled(enabled) {
  localStorage.setItem("useGeoWeather", String(enabled));
  if (!enabled) localStorage.removeItem("geoCoords");
}

// 위경도 획득 — 꺼져 있거나 실패하면 null (서버가 도시명 매칭으로 폴백)
export function getGeoLocation() {
  if (!isGeoWeatherEnabled() || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }

  try {
    const cached = JSON.parse(localStorage.getItem("geoCoords") || "null");
    if (cached && Date.now() - cached.ts < GEO_CACHE_MS) {
      return Promise.resolve({ lat: cached.lat, lon: cached.lon });
    }
  } catch {
    localStorage.removeItem("geoCoords");
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        };
        localStorage.setItem(
          "geoCoords",
          JSON.stringify({ ...coords, ts: Date.now() }),
        );
        resolve(coords);
      },
      () => resolve(null),
      { timeout: 3000, maximumAge: GEO_CACHE_MS },
    );
  });
}

// 1. AI 서버 헬스체크 (연결 테스트)
export async function testAiConnection(customUrl = null) {
  const { aiUrl } = getAiConfig();
  const targetUrl = (customUrl || aiUrl || "").trim().replace(/\/+$/, "");

  if (!targetUrl) {
    return { success: false, message: "AI 서버 주소가 설정되지 않았습니다." };
  }

  try {
    const res = await fetch(`${targetUrl}/health`, {
      method: "GET",
    });

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: `서버 응답 오류 (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      data,
      message: "AI 서버에 성공적으로 연결되었습니다.",
    };
  } catch (error) {
    return {
      success: false,
      message: `연결 실패: ${error.message}`,
    };
  }
}

// 2. AI 대화 (일반 JSON 및 SSE 실시간 스트리밍 지원)
export async function askAIChat({
  messages,
  systemInstruction = "너는 친절하고 다정한 가족 비서 AI야.",
  model = undefined,
  stream = false,
  onChunk = null,
}) {
  const { aiUrl, aiToken, isConfigured } = getAiConfig();

  if (!isConfigured) {
    throw new Error("AI 서버 주소 또는 토큰이 설정되지 않았습니다. 설정 화면에서 설정을 확인해주세요.");
  }

  const endpoint = `${aiUrl}/api/chat`;
  const location = await getGeoLocation();

  if (stream) {
    const payload = {
      messages,
      systemInstruction,
      stream: true,
    };
    if (model) payload.model = model;
    if (location) payload.location = location;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": aiToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP 오류: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    // 한 줄 처리. [DONE]이면 true 반환
    const handleLine = (line) => {
      if (!line.startsWith("data: ")) return false;
      const dataStr = line.slice(6).trim();
      if (dataStr === "[DONE]") return true;

      let parsed;
      try {
        parsed = JSON.parse(dataStr);
      } catch (jsonErr) {
        return false;
      }

      if (parsed.error) {
        let errorMsg = parsed.error;
        try {
          const nested = JSON.parse(errorMsg);
          if (nested.error?.message) errorMsg = nested.error.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      // 도구 실행 시작 알림 (텍스트 없음 — UI 상태 표시용)
      if (parsed.tool) {
        if (onChunk) onChunk("", fullText, { tool: parsed.tool });
        return false;
      }

      if (parsed.text !== undefined || parsed.searchQueries || parsed.sources) {
        const deltaText = parsed.text || "";
        fullText += deltaText;
        if (onChunk) {
          onChunk(deltaText, fullText, {
            searchQueries: parsed.searchQueries,
            sources: parsed.sources,
          });
        }
      }
      return false;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // TCP 청크가 줄 중간에서 끊길 수 있으므로 마지막 불완전 라인은
      // 버퍼에 남겨 다음 청크와 이어붙인다 (없으면 긴 응답에서 텍스트 유실)
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (handleLine(line)) return fullText;
      }
    }

    // 스트림 종료 후 버퍼에 남은 마지막 라인 처리
    handleLine(buffer + decoder.decode());

    return fullText;
  }

  // 일반 단일 JSON 요청
  const jsonPayload = {
    messages,
    systemInstruction,
    stream: false,
  };
  if (model) jsonPayload.model = model;
  if (location) jsonPayload.location = location;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-token": aiToken,
    },
    body: JSON.stringify(jsonPayload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `HTTP 오류: ${response.status}`);
  }

  return data.reply;
}

// 3. AI 단일 텍스트/요약 생성 (/api/generate)
export async function generateAIText(prompt, {
  systemInstruction = "정확하고 간결하게 답변해줘.",
  model = undefined,
} = {}) {
  const { aiUrl, aiToken, isConfigured } = getAiConfig();

  if (!isConfigured) {
    throw new Error("AI 서버 주소 또는 토큰이 설정되지 않았습니다. 설정 화면에서 설정을 확인해주세요.");
  }

  const endpoint = `${aiUrl}/api/generate`;
  const payload = {
    prompt,
    systemInstruction,
  };
  if (model) payload.model = model;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-token": aiToken,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `HTTP 오류: ${response.status}`);
  }

  return data.reply;
}
