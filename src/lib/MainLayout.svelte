<script>
  import { onMount } from "svelte";
  import { Route, navigate, useLocation } from "svelte-routing";
  import { base, deferredPrompt, isLoggedIn } from "./store.js";

  import Header from "./Header.svelte";
  import SideMenu from "./SideMenu.svelte";

  import Home from "../routes/Home.svelte";
  import EventList from "../routes/EventList.svelte";
  import Settings from "../routes/Settings.svelte";
  import PensionCalculator from "../routes/PensionCalculator.svelte";
  import Calculator15 from "../routes/Calculator15.svelte";
  import FoodSpinner from "../routes/FoodSpinner.svelte";
  import Login from "../routes/Login.svelte";
  import BulletinBoard from "../routes/BulletinBoard.svelte";
  import Ledger from "../routes/Ledger.svelte";
  import Game from "../routes/Game.svelte";
  import FruitPang from "../routes/FruitPang.svelte";
  import NeonBlast from "../routes/NeonBlast.svelte";
  import NeonBrick from "../routes/NeonBrick.svelte";
  import Stock from "../routes/Stock.svelte";
  import SecretLedger from "../routes/SecretLedger.svelte";

  const location = useLocation();

  // 로그인 상태 및 경로 체크 함수 (백틱 사용하여 경로 수정)
  function checkAuth() {
    const loginPath = `${base}/login`;
    if (!$isLoggedIn && $location.pathname !== loginPath) {
      navigate(loginPath, { replace: true });
    }
  }

  onMount(() => {
    // 서비스 워커 등록 경로 수정 (백틱 사용)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${base}/sw.js`)
        .then(() => console.log("SW Registered!"))
        .catch((err) => console.error("SW Registration failed:", err));
    }
    checkAuth();
  });

  // 로그인 여부나 경로가 바뀔 때마다 체크
  $: $isLoggedIn, $location.pathname, checkAuth();

  $: isGameplayPage =
    $location.pathname.includes("/fruit-pang") ||
    $location.pathname.includes("/neon-blast") ||
    $location.pathname.includes("/neon-brick");

  // 설치 관련 이벤트
  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt.set(e);
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt.set(null);
    });
  }
</script>

<div
  class="relative flex flex-col bg-gray-100 dark:bg-gray-900 {isGameplayPage
    ? 'h-[100dvh] overflow-hidden'
    : 'min-h-screen'}"
>
  {#if $isLoggedIn && $location.pathname !== `${base}/login`}
    <Header />
    <SideMenu />
  {/if}

  <main
    class={isGameplayPage ? "flex-1 overflow-hidden relative" : "p-4 sm:p-6"}
  >
    {#if !$isLoggedIn}
      <Login />
    {:else}
      <Route path="/" component={Home} />
      <Route path="events" component={EventList} />
      <Route path="pension-calculator" component={PensionCalculator} />
      <Route path="calculator-15" component={Calculator15} />
      <Route path="food-spinner" component={FoodSpinner} />
      <Route path="settings" component={Settings} />
      <Route path="bulletin-board" component={BulletinBoard} />
      <Route path="ledger" component={Ledger} />
      <Route path="game" component={Game} />
      <Route path="fruit-pang" component={FruitPang} />
      <Route path="neon-blast" component={NeonBlast} />
      <Route path="neon-brick" component={NeonBrick} />
      <Route path="neon-brick" component={NeonBrick} />
      <Route path="stock" component={Stock} />
      <Route path="secret-ledger" component={SecretLedger} />
    {/if}
  </main>
</div>
