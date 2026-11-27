<script>
  import { onMount } from "svelte";
  import { Route, navigate, useLocation } from "svelte-routing";
  import { base, deferredPrompt, isLoggedIn } from "./store.js";

  import TabBar from "./TabBar.svelte";
  import Toaster from "./components/Toaster.svelte";
  import ConfirmDialog from "./components/ConfirmDialog.svelte";
  import Spinner from "./components/Spinner.svelte";

  // Tabs and home shortcuts load up front
  import Home from "../routes/Home.svelte";
  import EventList from "../routes/EventList.svelte";
  import BulletinBoard from "../routes/BulletinBoard.svelte";
  import Ledger from "../routes/Ledger.svelte";
  import FoodSpinner from "../routes/FoodSpinner.svelte";
  import Attendance from "../routes/Attendance.svelte";
  import Settings from "../routes/Settings.svelte";
  import Menu from "../routes/Menu.svelte";
  import NotFound from "../routes/NotFound.svelte";
  import Login from "../routes/Login.svelte";

  import { autoRegisterPushIfGranted } from "./notification.js";

  const location = useLocation();

  // The game and occasional tools load on first visit (svelte-routing awaits
  // a function component). A tab left open across a deploy can request
  // chunk hashes that no longer exist, so reload once to pick up the new build.
  // The router asks again on every history change, the back button included: it has to
  // get the same promise back, or the page would be torn down and built anew under the user.
  // True while such a page's code is on its way: the router shows nothing of its own meanwhile
  let isPageLoading = false;
  const lazy = (load) => {
    let loading;
    return () =>
      (loading ??= ((isPageLoading = true), load())
        .finally(() => (isPageLoading = false))
        .then((mod) => {
          sessionStorage.removeItem("chunkReload");
          return mod;
        })
        .catch((err) => {
          loading = undefined;
          if (sessionStorage.getItem("chunkReload")) throw err;
          sessionStorage.setItem("chunkReload", "1");
          window.location.reload();
        }));
  };

  const Stock = lazy(() => import("../routes/Stock.svelte"));
  const CardPick = lazy(() => import("../routes/CardPick.svelte"));
  const RuneGuardian = lazy(() => import("../routes/RuneGuardian.svelte"));

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

  // The game takes the whole screen: no padding, no tab bar, no page scroll
  $: isGameplayPage = $location.pathname.includes("/rune-guardian");
</script>

<div
  class="relative flex flex-col bg-gray-100 dark:bg-gray-900 {isGameplayPage
    ? 'h-[100dvh] overflow-hidden overflow-clip'
    : 'min-h-screen'}"
>
  <main class={isGameplayPage ? "flex-1 overflow-hidden overflow-clip relative" : "p-4 sm:p-6 pb-24"}>
    {#if !$isLoggedIn}
      <Login />
    {:else}
      <Route path="/" component={Home} />
      <Route path="events" component={EventList} />
      <Route path="bulletin-board" component={BulletinBoard} />
      <Route path="ledger" component={Ledger} />
      <Route path="stock" component={Stock} />
      <Route path="rune-guardian" component={RuneGuardian} />
      <Route path="food-spinner" component={FoodSpinner} />
      <Route path="card-pick" component={CardPick} />
      <Route path="attendance" component={Attendance} />
      <Route path="settings" component={Settings} />
      <Route path="menu" component={Menu} />
      <!-- path 없는 Route = 미등록 주소 폴백 (svelte-routing default route) -->
      <Route component={NotFound} />
      {#if isPageLoading}
        <Spinner label="화면을 불러오는 중..." />
      {/if}
    {/if}
  </main>

  {#if $isLoggedIn && $location.pathname !== `${base}/login` && !isGameplayPage}
    <TabBar />
  {/if}

  <Toaster />
  <ConfirmDialog />
</div>
