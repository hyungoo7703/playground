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

  if (stream) {
    const payload = {
      messages,
      systemInstruction,
      stream: true,
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

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP 오류: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") return fullText;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
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
          } catch (e) {
            if (e.message && !e.message.includes("JSON")) {
              throw e;
            }
          }
        }
      }
    }

    return fullText;
  }

  // 일반 단일 JSON 요청
  const jsonPayload = {
    messages,
    systemInstruction,
    stream: false,
  };
  if (model) jsonPayload.model = model;

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
