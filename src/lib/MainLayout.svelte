<script>
  import { onMount } from "svelte";
  import { Route, navigate, useLocation } from "svelte-routing";
  import { base, deferredPrompt, isLoggedIn } from "./store.js";

  import TabBar from "./TabBar.svelte";

  import Home from "../routes/Home.svelte";
  import EventList from "../routes/EventList.svelte";
  import BulletinBoard from "../routes/BulletinBoard.svelte";
  import Ledger from "../routes/Ledger.svelte";
  import Calculator15 from "../routes/Calculator15.svelte";
  import PensionCalculator from "../routes/PensionCalculator.svelte";
  import Stock from "../routes/Stock.svelte";


  // Games
  import FruitPang from "../routes/FruitPang.svelte";
  import NeonBlast from "../routes/NeonBlast.svelte";
  import NeonBrick from "../routes/NeonBrick.svelte";
  import NeonSurvivor from "../routes/NeonSurvivor.svelte";

  import FoodSpinner from "../routes/FoodSpinner.svelte";
  import CardPick from "../routes/CardPick.svelte";
  import Attendance from "../routes/Attendance.svelte";
  import Settings from "../routes/Settings.svelte";
  import Menu from "../routes/Menu.svelte";
  import NotFound from "../routes/NotFound.svelte";
  import Login from "../routes/Login.svelte";

  import { autoRegisterPushIfGranted } from "./notification.js";

  const location = useLocation();

  // 로그인 상태 및 경로 체크 함수 (백틱 사용하여 경로 수정)
  function checkAuth() {
    const loginPath = `${base}/login`;
    if (!$isLoggedIn && $location.pathname !== loginPath) {
      navigate(loginPath, { replace: true });
    } else if ($isLoggedIn && $location.pathname === loginPath) {
      // 로그인 상태로 /login 진입 시 빈 화면(등록된 Route 없음) 방지
      navigate(base || "/", { replace: true });
    }
  }

  // 설치 관련 이벤트 핸들러
  function onBeforeInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt.set(e);
  }
  function onAppInstalled() {
    deferredPrompt.set(null);
  }

  onMount(() => {
    checkAuth();

    if ($isLoggedIn) {
      autoRegisterPushIfGranted();
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  });


  // 로그인 여부나 경로가 바뀔 때마다 체크
  $: $isLoggedIn, $location.pathname, checkAuth();

  // 페이지 전환 시 스크롤 최상단으로 (이전 페이지의 스크롤 위치 잔존 방지)
  let prevPath = "";
  $: if ($location.pathname !== prevPath) {
    prevPath = $location.pathname;
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }

  $: isGameplayPage =
    $location.pathname.includes("/fruit-pang") ||
    $location.pathname.includes("/neon-blast") ||
    $location.pathname.includes("/neon-brick") ||
    $location.pathname.includes("/neon-survivor");
</script>

<div
  class="relative flex flex-col bg-gray-100 dark:bg-gray-900 {isGameplayPage
    ? 'h-[100dvh] overflow-hidden'
    : 'min-h-screen'}"
>
  <main
    class={isGameplayPage
      ? "flex-1 overflow-hidden relative"
      : "p-4 sm:p-6 pb-24"}
  >
    {#if !$isLoggedIn}
      <Login />
    {:else}
      <Route path="/" component={Home} />
      <Route path="events" component={EventList} />
      <Route path="bulletin-board" component={BulletinBoard} />
      <Route path="ledger" component={Ledger} />
      <Route path="calculator-15" component={Calculator15} />
      <Route path="pension-calculator" component={PensionCalculator} />
      <Route path="stock" component={Stock} />

      <!-- Games -->
      <Route path="fruit-pang" component={FruitPang} />
      <Route path="neon-blast" component={NeonBlast} />
      <Route path="neon-brick" component={NeonBrick} />
      <Route path="neon-survivor" component={NeonSurvivor} />

      <Route path="food-spinner" component={FoodSpinner} />
      <Route path="card-pick" component={CardPick} />
      <Route path="attendance" component={Attendance} />
      <Route path="settings" component={Settings} />
      <Route path="menu" component={Menu} />
      <!-- path 없는 Route = 미등록 주소 폴백 (svelte-routing default route) -->
      <Route component={NotFound} />
    {/if}
  </main>

  {#if $isLoggedIn && $location.pathname !== `${base}/login` && !isGameplayPage}
    <TabBar />
  {/if}
</div>
