<script>
  import { onMount } from "svelte";
  import { fade, slide, fly } from "svelte/transition";
  import { api } from "../lib/api.js";
  import { formatDate } from "../lib/utils.js";
  import { readCache, writeCache } from "../lib/cache.js";
  import Spinner from "../lib/components/Spinner.svelte";
  import { currentUser, isAdmin } from "../lib/store.js";

  let posts = [];
  let isLoading = true;
  let showWriteModal = false;
  let isSubmitting = false;

  // Selected Category Filter
  let selectedCategory = "전체";

  // Detail View State
  let showDetailModal = false;
  let currentPost = null;
  let comments = [];
  let commentContent = "";
  let isCommentLoading = false;
  let isCommentSubmitting = false;

  // Image State
  let imageLoadFailed = false;
  let imageLoading = true;

  function looksLikeImageUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    const imageExts = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
      ".ico",
    ];
    if (imageExts.some((ext) => lower.includes(ext))) return true;
    if (lower.includes("imgur.com")) return true;
    if (lower.includes("i.ibb.co")) return true;
    if (lower.includes("drive.google.com") && lower.includes("thumbnail"))
      return true;
    if (lower.includes("lh3.googleusercontent.com")) return true;
    return false;
  }

  $: displayName = $currentUser || "가족";

  let formData = {
    id: null,
    date: formatDate(new Date()),
    category: "일상",
    title: "",
    content: "",
    image_url: "",
    author: "",
  };

  const CATEGORIES = ["일상", "공지", "유머", "정보", "축하"];
  const CATEGORY_EMOJIS = {
    일상: "☕",
    공지: "📢",
    유머: "😆",
    정보: "💡",
    축하: "🎉",
  };

  const MEMBER_AVATARS = {
    아빠: "👨",
    엄마: "👩",
    현구: "🧑",
    범수: "👦",
  };

  async function loadPosts() {
    const cached = readCache("posts");
    if (cached) {
      posts = cached;
      isLoading = false;
    } else {
      isLoading = true;
    }

    const res = await api.getPosts();
    if (res.success) {
      posts = res.posts;
      writeCache("posts", posts);
    } else if (!cached) {
      alert("게시글 불러오기 실패");
    }
    isLoading = false;
  }

  function openWriteModal(post = null) {
    if (post) {
      formData = { ...post };
    } else {
      formData = {
        id: null,
        date: formatDate(new Date()),
        category: "일상",
        title: "",
        content: "",
        image_url: "",
        author: displayName,
      };
    }
    showWriteModal = true;
  }

  async function savePost() {
    if (!formData.title || !formData.content)
      return alert("제목과 내용을 입력해주세요.");
    isSubmitting = true;

    if (!formData.author) formData.author = displayName;

    const res = formData.id
      ? await api.updatePost(formData)
      : await api.addPost(formData);

    if (res.success) {
      showWriteModal = false;
      loadPosts();
    } else {
      alert("저장 실패: " + res.message);
    }
    isSubmitting = false;
  }

  async function deletePost(id) {
    if (!confirm("정말 삭제하시겠습니까? 관련 댓글도 모두 삭제됩니다.")) return;
    const res = await api.deletePost(id);
    if (res.success) {
      showDetailModal = false;
      loadPosts();
    } else {
      alert("삭제 실패: " + res.message);
    }
  }

  async function openDetail(post) {
    currentPost = post;
    showDetailModal = true;
    comments = [];
    imageLoadFailed = false;
    imageLoading = true;

    api.incrementPostView(post.id);

    isCommentLoading = true;
    const res = await api.getComments(post.id);
    if (res.success) {
      comments = res.comments;
    }
    isCommentLoading = false;
  }

  function handleImageError() {
    imageLoadFailed = true;
    imageLoading = false;
  }

  function handleImageLoad() {
    imageLoading = false;
  }

  async function addComment() {
    if (!commentContent.trim()) return;
    isCommentSubmitting = true;

    const res = await api.addComment({
      post_id: currentPost.id,
      author: displayName,
      content: commentContent,
    });

    if (res.success) {
      commentContent = "";
      isCommentLoading = true;
      const r = await api.getComments(currentPost.id);
      if (r.success) comments = r.comments;
      isCommentLoading = false;
    }
    isCommentSubmitting = false;
  }

  async function deleteComment(id) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const res = await api.deleteComment(id);
    if (res.success) {
      isCommentLoading = true;
      const r = await api.getComments(currentPost.id);
      if (r.success) comments = r.comments;
      isCommentLoading = false;
    }
  }

  onMount(() => {
    loadPosts();
  });

  $: filteredPosts =
    selectedCategory === "전체"
      ? posts
      : posts.filter((p) => p.category === selectedCategory);
</script>

<div class="space-y-6 max-w-md mx-auto relative">
  <!-- Header Card -->
  <header
    class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-7 text-white shadow-xl space-y-4"
  >
    <div class="relative z-10 space-y-2">
      <div class="flex justify-between items-center">
        <span class="text-indigo-200 font-bold text-xs tracking-widest uppercase">
          Family Board
        </span>
        <span class="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
          총 {posts.length}개의 이야기
        </span>
      </div>
      <h1 class="text-3xl font-black tracking-tight leading-tight">
        우리 가족 게시판 📝
      </h1>
      <p class="text-xs text-indigo-100/80">
        서로의 일상과 따뜻한 소식을 자유롭게 나눠보세요.
      </p>
    </div>

    <!-- Decor -->
    <div class="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
    <div class="absolute -left-8 -bottom-8 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>
  </header>

  <!-- Action: Write Post Button -->
  <button
    type="button"
    on:click={() => openWriteModal()}
    class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-sm"
  >
    <span>✏️ 새 이야기 남기기</span>
  </button>

  <!-- Category Filter Pills -->
  <div class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
    <button
      type="button"
      on:click={() => (selectedCategory = "전체")}
      class="px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all {selectedCategory ===
      '전체'
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700'}"
    >
      전체보기
    </button>
    {#each CATEGORIES as cat}
      <button
        type="button"
        on:click={() => (selectedCategory = cat)}
        class="px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all {selectedCategory ===
        cat
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700'}"
      >
        {CATEGORY_EMOJIS[cat] || ""} {cat}
      </button>
    {/each}
  </div>

  <!-- Post List Feed -->
  <div class="space-y-3">
    {#if isLoading}
      <div class="py-16 text-center">
        <Spinner label="게시글을 불러오는 중..." />
      </div>
    {:else if filteredPosts.length === 0}
      <div class="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400">
        <span class="text-4xl block mb-2">📮</span>
        <p class="text-sm font-bold text-gray-600 dark:text-gray-300">등록된 글이 없습니다.</p>
        <p class="text-xs text-gray-400 mt-1">상단의 '새 이야기 남기기'로 첫 글을 작성해보세요!</p>
      </div>
    {:else}
      {#each filteredPosts as post (post.id)}
        <button
          type="button"
          on:click={() => openDetail(post)}
          class="w-full text-left bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 active:scale-[0.99] transition-all group cursor-pointer"
        >
          <!-- Author & Meta -->
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-lg p-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl leading-none">
                {MEMBER_AVATARS[post.author] || "👤"}
              </span>
              <div>
                <p class="text-xs font-black text-gray-900 dark:text-white leading-tight">
                  {post.author}
                </p>
                <p class="text-[10px] text-gray-400 font-medium">
                  {post.date}
                </p>
              </div>
            </div>

            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
              {CATEGORY_EMOJIS[post.category] || "💬"} {post.category}
            </span>
          </div>

          <!-- Title & Content Snippet -->
          <div class="space-y-1">
            <h3 class="text-base font-black text-gray-900 dark:text-white leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
              {post.title}
            </h3>
            <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
              {post.content}
            </p>
          </div>

          <!-- Thumbnail if image exists -->
          {#if post.image_url && looksLikeImageUrl(post.image_url)}
            <div class="w-full h-36 bg-gray-100 dark:bg-gray-700/50 rounded-2xl overflow-hidden relative">
              <img
                src={post.image_url}
                alt="미리보기"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          {/if}

          <!-- Footer Counts -->
          <div class="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-[11px] text-gray-400 font-bold">
            <span class="flex items-center gap-1">
              👁️ 조회 {post.view_count || 0}
            </span>
            <span class="text-indigo-500 font-bold group-hover:underline">
              자세히 보기 →
            </span>
          </div>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Write / Edit Modal -->
  {#if showWriteModal}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4"
        transition:slide={{ axis: "y" }}
      >
        <div class="flex justify-between items-center shrink-0">
          <h2 class="text-lg font-black text-gray-900 dark:text-white">
            {formData.id ? "글 수정하기" : "새로운 이야기 작성"}
          </h2>
          <button
            type="button"
            on:click={() => (showWriteModal = false)}
            class="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3 overflow-y-auto flex-1 pr-1">
          <!-- Category Select -->
          <div>
            <label for="post-cat" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1.5">
              분류 선택
            </label>
            <div id="post-cat" class="flex gap-1.5 overflow-x-auto pb-1">
              {#each CATEGORIES as cat}
                <button
                  type="button"
                  on:click={() => (formData.category = cat)}
                  class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all {formData.category ===
                  cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}"
                >
                  {CATEGORY_EMOJIS[cat]} {cat}
                </button>
              {/each}
            </div>
          </div>

          <!-- Title -->
          <div>
            <label for="post-title" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">
              제목
            </label>
            <input
              id="post-title"
              type="text"
              bind:value={formData.title}
              placeholder="제목을 입력하세요"
              class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
            />
          </div>

          <!-- Content -->
          <div>
            <label for="post-content" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">
              내용
            </label>
            <textarea
              id="post-content"
              bind:value={formData.content}
              placeholder="가족들과 나눌 이야기를 자유롭게 적어주세요..."
              rows="5"
              class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl px-4 py-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700 resize-none"
            ></textarea>
          </div>

          <!-- Image / Link URL -->
          <div>
            <label for="post-img" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">
              사진 또는 링크 URL (선택)
            </label>
            <input
              id="post-img"
              type="text"
              bind:value={formData.image_url}
              placeholder="https://..."
              class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>

        <div class="flex gap-2 shrink-0 pt-2">
          <button
            type="button"
            on:click={() => (showWriteModal = false)}
            class="flex-1 py-3.5 font-bold text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-2xl active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            on:click={savePost}
            disabled={isSubmitting}
            class="flex-1 py-3.5 font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md active:scale-95 disabled:opacity-40"
          >
            {isSubmitting ? "저장 중..." : "게시하기"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Detail View Modal with Comments -->
  {#if showDetailModal && currentPost}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      transition:fade
    >
      <div
        class="w-full h-full sm:h-auto sm:max-w-md max-h-[92vh] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden"
        in:fly={{ y: 30, duration: 250 }}
      >
        <!-- Modal Top Bar -->
        <div class="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-800">
          <button
            type="button"
            on:click={() => (showDetailModal = false)}
            class="p-2 -ml-2 text-gray-500 dark:text-gray-400 font-black text-sm"
          >
            ← 닫기
          </button>

          {#if $currentUser === currentPost.author || $isAdmin}
            <div class="flex gap-1.5">
              <button
                type="button"
                on:click={() => {
                  showDetailModal = false;
                  openWriteModal(currentPost);
                }}
                class="text-xs font-bold text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40"
              >
                수정
              </button>
              <button
                type="button"
                on:click={() => deletePost(currentPost.id)}
                class="text-xs font-bold text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40"
              >
                삭제
              </button>
            </div>
          {/if}
        </div>

        <!-- Scrollable Article + Comments -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <!-- Post Author Header -->
          <div class="flex items-center gap-3">
            <span class="text-2xl p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl leading-none">
              {MEMBER_AVATARS[currentPost.author] || "👤"}
            </span>
            <div>
              <p class="text-sm font-black text-gray-900 dark:text-white">
                {currentPost.author}
              </p>
              <p class="text-xs text-gray-400 font-medium">
                {currentPost.date} · 조회 {currentPost.view_count + 1}
              </p>
            </div>
            <span class="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
              {CATEGORY_EMOJIS[currentPost.category] || "💬"} {currentPost.category}
            </span>
          </div>

          <!-- Title & Content -->
          <div class="space-y-3">
            <h2 class="text-xl font-black text-gray-900 dark:text-white leading-snug">
              {currentPost.title}
            </h2>

            <!-- Image if available -->
            {#if currentPost.image_url}
              {#if looksLikeImageUrl(currentPost.image_url) && !imageLoadFailed}
                <div class="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {#if imageLoading}
                    <div class="w-full h-48 animate-pulse flex items-center justify-center text-xs text-gray-400">
                      이미지 로딩 중...
                    </div>
                  {/if}
                  <a href={currentPost.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={currentPost.image_url}
                      alt="첨부 이미지"
                      class="w-full max-h-72 object-contain rounded-2xl"
                      class:hidden={imageLoading}
                      on:error={handleImageError}
                      on:load={handleImageLoad}
                    />
                  </a>
                </div>
              {:else}
                <a
                  href={currentPost.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-bold border border-blue-200 dark:border-blue-800"
                >
                  🔗 첨부 링크 열기 ↗
                </a>
              {/if}
            {/if}

            <p class="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
              {currentPost.content}
            </p>
          </div>

          <!-- Comments Section -->
          <div class="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <h4 class="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>💬 댓글</span>
              <span class="text-indigo-600 font-bold">({comments.length})</span>
            </h4>

            {#if isCommentLoading}
              <div class="py-4 text-center">
                <Spinner label="댓글 불러오는 중..." />
              </div>
            {:else if comments.length === 0}
              <p class="text-xs text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                첫 번째 따뜻한 댓글을 남겨보세요! ✨
              </p>
            {:else}
              <div class="space-y-2.5">
                {#each comments as comment}
                  <div class="flex gap-2 items-start">
                    <span class="text-base p-1 bg-gray-100 dark:bg-gray-700 rounded-xl leading-none shrink-0">
                      {MEMBER_AVATARS[comment.author] || "👤"}
                    </span>
                    <div class="flex-1 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-2xl space-y-1 relative group">
                      <div class="flex justify-between items-center">
                        <span class="text-xs font-black text-gray-800 dark:text-gray-200">
                          {comment.author}
                        </span>
                        <span class="text-[10px] text-gray-400">
                          {comment.date}
                        </span>
                      </div>
                      <p class="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        {comment.content}
                      </p>

                      {#if $currentUser === comment.author || $isAdmin}
                        <button
                          type="button"
                          on:click={() => deleteComment(comment.id)}
                          class="absolute right-2.5 top-2.5 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          title="삭제"
                        >
                          ✕
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Sticky Comment Input Bar -->
        <div class="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={commentContent}
              placeholder="댓글을 남겨보세요..."
              class="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2.5 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700"
              on:keypress={(e) => e.key === "Enter" && addComment()}
            />
            <button
              type="button"
              on:click={addComment}
              disabled={!commentContent.trim() || isCommentSubmitting}
              class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs rounded-2xl transition-all active:scale-95"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
