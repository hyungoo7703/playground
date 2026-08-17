<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { marked } from "marked";
  import { askAIChat } from "../aiApi.js";

  // Configure marked for smooth chat rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  function formatMessage(content) {
    if (!content) return "";
    try {
      return marked.parse(content);
    } catch (e) {
      return content;
    }
  }

  // Props passed from Home.svelte
  export let isOpen = false;
  export let onClose = () => {};
  export let userName = "가족";
  export let monthlyEvents = [];
  export let dDayEvent = null;
  export let dDayDiff = null;
  export let monthCount = 0;
  export let monthUnsettledCount = 0;
  export let monthUnsettledAmount = 0;
  export let monthTotalAmount = 0;
  export let monthUnsettledItems = [];
  export let todayCheckedIn = false;
  export let attendanceStreak = 0;
  export let stockCount = 0;
  export let stockTotalAmount = 0;
  export let aiKnowledgeList = [];

  let messages = [];
  let inputText = "";
  let isStreaming = false;
  let chatContainer;
  let historyPushed = false;

  const QUICK_PROMPTS = [
    { label: "📅 이달 주요 일정", prompt: "이번 달 우리 가족 주요 일정과 중요한 약속들 한눈에 요약해줘!" },
    { label: "💰 가계부 정산 현황", prompt: "이번 달 가계부 미정산 내역이나 정산 현황이 어떻게 돼? 누가 누구한테 줄 게 있어?" },
    { label: "🌤️ 날씨 & 우산 예보", prompt: "오늘이랑 내일 날씨 어때? 외출할 때 우산 챙겨야 해?" },
    { label: "📰 오늘 주요 뉴스", prompt: "오늘 세상 돌아가는 주요 뉴스 핵심 3줄로 브리핑해줘!" },
    { label: "🍳 오늘 저녁 뭐 해먹지?", prompt: "오늘 가족들과 함께 집에서 맛있고 간단하게 만들어 먹을 수 있는 저녁 요리 메뉴와 초간단 레시피 추천해줘!" },
    { label: "🎂 D-Day 챙기기", prompt: "현재 다가오는 D-Day 기념일 정보랑 챙길 팁 알려줘!" },
    { label: "🚗 주말 가족 나들이", prompt: "가족들과 함께 가기 좋은 주말 나들이나 휴식 아이디어 추천해줘!" },
    { label: "✨ 오늘의 가족 응원", prompt: "오늘 하루 우리 가족 모두 힘낼 수 있는 따뜻하고 유쾌한 덕담 한마디 해줘!" },
  ];

  // Lock body scroll when modal is open to prevent background scrolling confusion
  $: if (typeof document !== "undefined") {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  // Handle Android / Mobile hardware back button & swipe gesture
  $: if (typeof window !== "undefined") {
    if (isOpen && !historyPushed) {
      history.pushState({ modal: "familyButler" }, "");
      historyPushed = true;
    }
  }

  function handlePopState(e) {
    if (isOpen) {
      historyPushed = false;
      onClose();
    }
  }

  onMount(() => {
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", handlePopState);
      if (historyPushed && history.state?.modal === "familyButler") {
        historyPushed = false;
        history.back();
      }
    }
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  });

  function handleClose() {
    if (historyPushed) {
      historyPushed = false;
      if (history.state?.modal === "familyButler") {
        history.back();
        return; // popstate handler will trigger onClose()
      }
    }
    onClose();
  }

  // 챗봇 열릴 때 초기 안내 메시지 세팅
  $: if (isOpen && messages.length === 0) {
    initGreeting();
  }

  function initGreeting() {
    let dDayIntro = dDayEvent
      ? ` 🎂 D-Day: **${dDayEvent.title}** (D-${dDayDiff === 0 ? "Day" : dDayDiff})`
      : "";

    messages = [
      {
        role: "model",
        content: `안녕하세요 **${userName}**님! 저는 우리 가족 전용 AI 집사 **패밀리봇**이에요 🏡✨\n${dDayIntro}\n이번 달 일정, 가계부 미정산, 실시간 날씨/뉴스, 오늘 저녁 요리 추천 등 무엇이든 물어보세요!`,
      },
    ];
  }

  // 실시간 홈 컨텍스트를 압축한 시스템 프롬프트 구성
  function buildSystemInstruction() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일)`;

    // 이달 일정 요약
    const eventsStr = monthlyEvents && monthlyEvents.length > 0
      ? monthlyEvents.map(e => `- ${e.date}: ${e.title} (${e.category || '일반'})`).join("\n")
      : "등록된 일정 없음";

    // D-Day 요약
    const dDayStr = dDayEvent
      ? `${dDayEvent.title} (날짜: ${dDayEvent.date}, D-${dDayDiff === 0 ? "DAY" : dDayDiff}일)`
      : "설정된 D-Day 없음";

    // 가계부 요약 (건수 + 금액 정확히 분리)
    let unsettledDetail = "";
    if (monthUnsettledItems && monthUnsettledItems.length > 0) {
      unsettledDetail = "\n  * 미정산 세부항목:\n" + monthUnsettledItems.map(i => `    - ${i.title}: ${Number(i.amount).toLocaleString()}원 (${i.giver} → ${i.receiver}, ${i.date})`).join("\n");
    }

    const ledgerStr = `이달 등록 내역 총 ${monthCount}건 (총 이체/지출 예정액: 약 ${monthTotalAmount.toLocaleString()}원), 미정산 내역: ${monthUnsettledCount}건 (총 미정산액: 약 ${monthUnsettledAmount.toLocaleString()}원)${unsettledDetail}`;

    // 출석/자산
    const attendanceStr = todayCheckedIn
      ? `오늘 출석 완료 (${attendanceStreak}일 연속 출석 중)`
      : `오늘 아직 미출석 (${attendanceStreak}일 연속 출석 중)`;

    const stockStr = stockCount > 0
      ? `보유 종목 ${stockCount}개 (총 매입액 약 ${stockTotalAmount.toLocaleString()}원)`
      : "등록된 주식 정보 없음";

    let customKnowledgeStr = "";
    if (aiKnowledgeList && aiKnowledgeList.length > 0) {
      customKnowledgeStr = "\n\n[우리 가족 맞춤 메모 & 중요 지식]\n" + aiKnowledgeList.map((k) => `- ${k}`).join("\n");
    }

    return `너는 화목하고 따뜻한 가족의 전용 AI 집사 '패밀리봇'이야.
가족 구성원(현구, 범수, 아빠, 엄마)을 잘 알고 있으며, 항상 다정하고 친근하며 센스 있는 존댓말(해요체)로 대답해.

[오늘 정보]
- 날짜: ${todayStr}
- 현재 대화 중인 가족: ${userName}

[우리 가족 이번 달 실시간 현황]
- D-Day: ${dDayStr}
- 이번 달 주요 일정:
${eventsStr}
- 가계부 현황: ${ledgerStr}
- 출석 현황: ${attendanceStr}
- 자산/주식: ${stockStr}${customKnowledgeStr}

[답변 원칙]
1. [가족 맞춤 메모 최우선 반영]: [우리 가족 맞춤 메모 & 중요 지식]에 기재된 가족별 취향(예: 엄마 매운 음식 못 드심), 집 규칙, 공지사항을 반드시 기억하고 메뉴/일정/나들이 추천 시 적극 반영해줘!
2. [가족 데이터 질의]: 가족의 일정, 가계부 금액/미정산, D-Day, 기념일 등에 대해 물어보면 위의 [우리 가족 이번 달 실시간 현황] 데이터를 정확하게 인용해서 답변해. (미정산 금액은 원 단위로 정확하게 표기해줘!)
3. [실시간 기상 & 미세먼지 & 뉴스]: 날씨, 기온, 강수확률, 미세먼지(PM10/PM2.5), 뉴스 헤드라인 질문은 시스템에 주입된 [실시간 외부 정보]를 바탕으로 명쾌하게 답변해.
4. [지원되지 않는 외부 실시간 데이터 가드]: 실시간 주가 틱 변동, 로또 당첨 번호, 실시간 도로 교통 CCTV 등 시스템에 제공되지 않는 실시간 외부 정보는 추측하거나 헤매지 말고 "해당 실시간 정보는 네이버나 전용 앱에서 가장 정확하게 확인하실 수 있어요!" 라고 1~2줄로 솔직하고 산뜻하게 안내해.
5. [일상 & 추천 질의]: 저녁 요리 레시피, 주말 나들이, 생활 꿀팁, 가족 간의 따뜻한 응원이나 센스 있는 덕담은 실용적이고 다정하게 제안해.
6. 모바일 화면에서 보기 편하도록 적절한 줄바꿈, 볼드(**강조**), 이모지(📅, 💰, 🌤️, 📰, 🍳 등)를 활용해 깔끔하게 작성해.
7. 너무 장황하지 않게 핵심 위주로 명확하고 위트 있게 답변해.`;
  }

  async function scrollToBottom() {
    await tick();
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  async function handleSend(text = null) {
    const query = (text || inputText).trim();
    if (!query || isStreaming) return;

    inputText = "";

    // 1. 사용자 메시지 추가
    messages = [...messages, { role: "user", content: query }];
    await scrollToBottom();

    // 2. AI 응답 슬롯 준비
    const aiMsgIndex = messages.length;
    messages = [
      ...messages,
      { role: "model", content: "" },
    ];
    isStreaming = true;

    try {
      const systemInstruction = buildSystemInstruction();

      // 슬라이딩 윈도우: 최근 8개 대화만 전달하여 토큰 절약
      const recentMessages = messages
        .slice(0, -1)
        .filter(m => m.content && !m.content.includes("패밀리봇이에요 🏡"))
        .slice(-8)
        .map(m => ({
          role: m.role === "model" ? "model" : "user",
          content: m.content,
        }));

      if (recentMessages.length === 0) {
        recentMessages.push({ role: "user", content: query });
      }

      await askAIChat({
        messages: recentMessages,
        systemInstruction,
        stream: true,
        onChunk: (chunk, fullText) => {
          messages[aiMsgIndex].content = fullText;
          messages = [...messages];
          scrollToBottom();
        },
      });

      if (!messages[aiMsgIndex].content.trim()) {
        messages[aiMsgIndex].content = "앗, 일시적인 응답 지연이 발생했어요. 다시 한 번 질문해주세요! 😊";
        messages = [...messages];
      }
    } catch (err) {
      console.error("AI 챗봇 통신 오류:", err);
      let errText = err.message || "잠시 후 다시 시도해주세요.";
      if (errText.includes("429") || errText.includes("quota")) {
        errText = "무료 API 요청 한도(분당 횟수)에 도달했어요. 잠시 후 다시 질문해 주세요!";
      }
      messages[aiMsgIndex].content = `앗, AI 집사와 연결 중 오류가 발생했어요 😢\n(${errText})`;
      messages = [...messages];
    } finally {
      isStreaming = false;
      await scrollToBottom();
    }
  }

  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

{#if isOpen}
  <!-- Full Screen on Mobile, Centered Modal on Tablet/Desktop -->
  <div
    class="fixed inset-0 z-50 bg-white dark:bg-gray-900 sm:bg-black/60 sm:backdrop-blur-sm transition-opacity flex items-center justify-center p-0 sm:p-4"
    transition:fade={{ duration: 150 }}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="presentation"
  >
    <!-- Main Chat Window (100% full viewport height on mobile, 720px on desktop) -->
    <div
      class="w-full h-[100dvh] sm:h-[720px] sm:max-w-xl bg-white dark:bg-gray-900 rounded-none sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden sm:border border-gray-100 dark:border-gray-800"
      transition:fly={{ y: 150, duration: 200 }}
    >
      <!-- Top App Bar -->
      <div class="px-4 sm:px-5 py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-between shadow-md shrink-0 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg sm:text-xl shadow-inner border border-white/20">
            🤖
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-black text-sm sm:text-base leading-none">우리집 AI 집사</h3>
              <span class="text-[10px] bg-emerald-400 text-emerald-950 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-900 animate-ping"></span>
                실시간
              </span>
            </div>
            <p class="text-[10.5px] sm:text-[11px] text-indigo-200 mt-1">이달 일정 · 가계부 정산 · 실시간 날씨 & 뉴스 · 레시피</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            on:click={handleClose}
            class="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all text-sm font-bold w-9 h-9 flex items-center justify-center"
            title="닫기"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Quick Prompt Chips (Horizontal Scroll) -->
      <div class="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 shrink-0 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {#each QUICK_PROMPTS as chip}
          <button
            type="button"
            disabled={isStreaming}
            on:click={() => handleSend(chip.prompt)}
            class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            {chip.label}
          </button>
        {/each}
      </div>

      <!-- Messages Area (Full Height Scrollable) -->
      <div
        bind:this={chatContainer}
        class="flex-1 p-4 overflow-y-auto overscroll-contain space-y-4 bg-gray-50/50 dark:bg-gray-900/50"
      >
        {#each messages as msg, idx}
          <div class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'}">
            <div class="flex items-end gap-2 max-w-[92%] sm:max-w-[85%] {msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
              {#if msg.role === 'model'}
                <div class="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs shrink-0 mb-1 shadow-sm font-bold">
                  🤖
                </div>
              {/if}

              <!-- Message Bubble -->
              <div
                class="chat-bubble px-4 py-3 rounded-2xl leading-relaxed break-words shadow-sm text-[14px] sm:text-[15px] {msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none font-medium'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700/80 rounded-bl-none'}"
              >
                {#if !msg.content && isStreaming && idx === messages.length - 1}
                  <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 py-1">
                    <svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span class="font-bold text-sm">
                      패밀리봇이 답변 작성 중... ✍️
                    </span>
                  </div>
                {:else if msg.role === 'user'}
                  <div class="whitespace-pre-wrap">{msg.content}</div>
                {:else}
                  <div class="markdown-content">{@html formatMessage(msg.content)}</div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Bottom Input Area (Safe Area Aware) -->
      <div class="p-3 sm:p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <form
          on:submit|preventDefault={() => handleSend()}
          class="flex items-center gap-2"
        >
          <input
            type="text"
            bind:value={inputText}
            on:keydown={handleKeydown}
            disabled={isStreaming}
            placeholder="우리 가족 일정, 가계부, 날씨, 오늘 저녁 요리 등 물어보세요..."
            class="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent dark:border-gray-700 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputText.trim()}
            class="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl text-sm font-black shadow-md active:scale-95 transition-all shrink-0 flex items-center justify-center min-w-[56px]"
          >
            {#if isStreaming}
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            {:else}
              전송
            {/if}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .markdown-content {
    font-size: 14.5px;
    line-height: 1.68;
  }
  @media (min-width: 640px) {
    .markdown-content {
      font-size: 15.5px;
    }
  }

  .markdown-content :global(p) {
    margin-bottom: 0.55rem;
  }
  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }
  .markdown-content :global(strong) {
    font-weight: 800;
    color: #4f46e5;
  }
  :global(.dark) .markdown-content :global(strong) {
    color: #a5b4fc;
  }
  .markdown-content :global(ul) {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin-bottom: 0.55rem;
  }
  .markdown-content :global(ol) {
    list-style-type: decimal;
    padding-left: 1.25rem;
    margin-bottom: 0.55rem;
  }
  .markdown-content :global(li) {
    margin-bottom: 0.25rem;
  }
  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4) {
    font-weight: 800;
    margin-top: 0.75rem;
    margin-bottom: 0.35rem;
  }
  .markdown-content :global(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    font-size: 0.88em;
  }
  :global(.dark) .markdown-content :global(code) {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
