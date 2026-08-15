<script>
  import { slide } from "svelte/transition";

  // --- 1. 세액공제 계산 로직 ---
  let annualContribution = 6000000;
  let salaryCondition = "low";
  const LIMIT = 6000000;

  $: taxRate = salaryCondition === "low" ? 16.5 : 13.2;
  $: refundableAmount = Math.floor(
    Math.min(annualContribution, LIMIT) * (taxRate / 100),
  );

  // --- 2. 복리 수익률 계산 로직 ---
  let monthlyInvest = 500000;
  let investYears = 20;
  let expectedRate = 8;

  let totalPrincipal = 0;
  let finalAsset = 0;
  let interestEarned = 0;

  function calculateROI() {
    let months = investYears * 12;
    let monthlyRate = expectedRate / 100 / 12;

    let current = 0;
    for (let i = 0; i < months; i++) {
      current = (current + monthlyInvest) * (1 + monthlyRate);
    }

    finalAsset = Math.floor(current);
    totalPrincipal = monthlyInvest * months;
    interestEarned = finalAsset - totalPrincipal;
  }

  $: {
    monthlyInvest, investYears, expectedRate;
    calculateROI();
  }

  // --- 3. 추천 포트폴리오 ---
  const products = [
    {
      category: "📈 시장 지수",
      name: "미국 S&P500",
      code: "TIGER / ACE / SOL 미국S&P500",
      fee: "0.07% 내외",
      desc: "미국 상위 500개 우량 기업에 분산 투자하는 장기 투자의 정석입니다.",
      risk: "중위험",
    },
    {
      category: "🛡️ 안전 자산",
      name: "미국 30년 국채",
      code: "ACE / TIGER 미국30년국채액티브(H)",
      fee: "0.05% 내외",
      desc: "미국 정부 보증 장기 채권으로 시장 하락 시 든든한 방어 역할을 합니다.",
      risk: "저위험",
    },
    {
      category: "🇰🇷 국내 배당",
      name: "맥쿼리인프라",
      code: "088980",
      fee: "운용보수 상이",
      desc: "국내 도로/항만 인프라에 투자하여 안정적인 배당을 지급하는 대표 고배당주입니다.",
      risk: "중위험",
    },
  ];

  let activeTab = "tax"; // 'tax' | 'roi' | 'products'
</script>

<div class="max-w-md mx-auto space-y-6">
  <!-- Header -->
  <div class="text-left space-y-1">
    <h2 class="text-2xl font-black text-gray-900 dark:text-white">연금저축 계산기 📈</h2>
    <p class="text-xs font-bold text-gray-400 dark:text-gray-500">
      절세 혜택과 복리 수익 시뮬레이션을 한눈에 확인하세요.
    </p>
  </div>

  <!-- Segmented Tab Controls -->
  <div class="grid grid-cols-3 p-1 bg-gray-200 dark:bg-gray-800 rounded-2xl gap-1">
    <button
      class="py-2.5 px-2 text-xs font-bold rounded-xl transition-all {activeTab === 'tax'
        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}"
      on:click={() => (activeTab = "tax")}
    >
      💰 세액공제
    </button>
    <button
      class="py-2.5 px-2 text-xs font-bold rounded-xl transition-all {activeTab === 'roi'
        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}"
      on:click={() => (activeTab = "roi")}
    >
      📈 복리수익
    </button>
    <button
      class="py-2.5 px-2 text-xs font-bold rounded-xl transition-all {activeTab === 'products'
        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'}"
      on:click={() => (activeTab = "products")}
    >
      🏆 포트폴리오
    </button>
  </div>

  <!-- TAB 1: 세액공제 계산 -->
  {#if activeTab === "tax"}
    <section in:slide class="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
      <h3 class="text-base font-bold text-gray-900 dark:text-white">연말정산 예상 환급액</h3>

      <div class="space-y-4">
        <!-- 연봉 기준 라디오 -->
        <div>
          <span class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-2">연봉 기준</span>
          <div class="grid grid-cols-2 gap-2">
            <label
              class="flex items-center justify-center p-3 border rounded-2xl cursor-pointer text-xs font-bold transition-all {salaryCondition === 'low'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}"
            >
              <input
                type="radio"
                bind:group={salaryCondition}
                value="low"
                class="sr-only"
              />
              <span>5,500만 이하 (16.5%)</span>
            </label>
            <label
              class="flex items-center justify-center p-3 border rounded-2xl cursor-pointer text-xs font-bold transition-all {salaryCondition === 'high'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}"
            >
              <input
                type="radio"
                bind:group={salaryCondition}
                value="high"
                class="sr-only"
              />
              <span>5,500만 초과 (13.2%)</span>
            </label>
          </div>
        </div>

        <!-- 연간 납입 금액 -->
        <div>
          <label for="annual-contrib" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">
            연간 납입 금액 (한도: 연 600만원)
          </label>
          <div class="relative">
            <input
              id="annual-contrib"
              type="number"
              bind:value={annualContribution}
              step="100000"
              class="w-full p-3.5 pr-12 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-base font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">원</span>
          </div>
        </div>

        <!-- 결과 카드 -->
        <div class="mt-4 p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl text-center shadow-lg shadow-indigo-500/20">
          <p class="text-xs font-bold text-indigo-200">예상 환급 세액</p>
          <p class="text-3xl font-black mt-1">
            {refundableAmount.toLocaleString()}<span class="text-lg font-bold">원</span>
          </p>
          <p class="text-xs text-indigo-200 mt-2 font-bold">
            ✨ 연말정산 시 확정 수익률 {taxRate}% 효과
          </p>
        </div>
      </div>
    </section>
  {/if}

  <!-- TAB 2: 복리 수익 시뮬레이션 -->
  {#if activeTab === "roi"}
    <section in:slide class="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
      <h3 class="text-base font-bold text-gray-900 dark:text-white">복리 수익 시뮬레이션</h3>

      <div class="space-y-4">
        <div>
          <label for="monthly-invest" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">
            월 투자금
          </label>
          <div class="relative">
            <input
              id="monthly-invest"
              type="number"
              bind:value={monthlyInvest}
              step="50000"
              class="w-full p-3.5 pr-12 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-base font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">원</span>
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label for="invest-years" class="text-xs font-bold text-gray-400 dark:text-gray-500">투자 기간</label>
            <span class="text-xs font-black text-indigo-600 dark:text-indigo-400">{investYears}년</span>
          </div>
          <input
            id="invest-years"
            type="range"
            bind:value={investYears}
            min="1"
            max="40"
            class="w-full accent-indigo-600 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <label for="expected-rate" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">
            예상 연평균 수익률 (%)
          </label>
          <div class="flex items-center gap-2">
            <input
              id="expected-rate"
              type="number"
              bind:value={expectedRate}
              step="0.5"
              class="w-24 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-base font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span class="text-[11px] text-gray-400 leading-tight">
              (미국 S&P500의 과거 연평균 수익률 약 8~10%)
            </span>
          </div>
        </div>

        <!-- 계산 요약 카드 -->
        <div class="space-y-2 pt-2 text-xs font-bold">
          <div class="flex justify-between p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
            <span class="text-gray-500 dark:text-gray-400">총 투자 원금</span>
            <span class="text-gray-800 dark:text-gray-200">{totalPrincipal.toLocaleString()}원</span>
          </div>
          <div class="flex justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-2xl border border-emerald-100 dark:border-emerald-800">
            <span>예상 복리 수익</span>
            <span>+{interestEarned.toLocaleString()}원</span>
          </div>
          <div class="p-5 bg-gradient-to-br from-indigo-900 to-gray-900 text-white rounded-2xl text-center shadow-md">
            <p class="text-xs text-indigo-300 mb-1">{investYears}년 후 예상 총 자산</p>
            <p class="text-3xl font-black text-amber-300">{finalAsset.toLocaleString()}<span class="text-lg">원</span></p>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- TAB 3: 추천 포트폴리오 -->
  {#if activeTab === "products"}
    <section in:slide class="space-y-3">
      {#each products as item}
        <div class="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-2">
          <div class="flex justify-between items-center">
            <span class="px-2.5 py-1 text-[11px] font-bold rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
              {item.category}
            </span>
            <span class="text-[11px] text-gray-400 font-medium">수수료 {item.fee}</span>
          </div>
          
          <h4 class="text-base font-black text-gray-900 dark:text-white">{item.name}</h4>
          <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{item.desc}</p>
          
          <div class="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-[11px] text-gray-400 font-mono">
            <span>코드: {item.code}</span>
            <span class="font-bold text-indigo-500 dark:text-indigo-400">{item.risk}</span>
          </div>
        </div>
      {/each}

      <p class="text-[11px] text-center text-gray-400 pt-2">
        * 본 자료는 가족 투자 참고용이며 실제 투자에 대한 책임은 본인에게 있습니다.
      </p>
    </section>
  {/if}
</div>
