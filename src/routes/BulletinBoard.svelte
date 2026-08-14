<script>
  import { onMount } from "svelte";
  import { fade, slide, fly } from "svelte/transition";
  import { api } from "../lib/api.js";
  import { currentUser, isAdmin } from "../lib/store.js";

  let posts = [];
  let isLoading = true;
  let showWriteModal = false;
  let isSubmitting = false;

  // Detail View State
  let showDetailModal = false;
  let currentPost = null;
  let comments = [];
  let commentContent = "";
  let isCommentLoading = false;
  let isCommentSubmitting = false;

  // Image URL State
  let imageLoadFailed = false;
  let imageLoading = true;

  // 이미지 URL인지 판별하는 함수
  function looksLikeImageUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    // 이미지 확장자 체크
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    if (imageExts.some(ext => lower.includes(ext))) return true;
    // 알려진 이미지 호스팅 서비스
    if (lower.includes('imgur.com')) return true;
    if (lower.includes('i.ibb.co')) return true;
    // Google Drive 직접 보기 링크
    if (lower.includes('drive.google.com') && lower.includes('thumbnail')) return true;
    if (lower.includes('lh3.googleusercontent.com')) return true;
    return false;
  }

  // User State - 글로벌 store 사용 ($currentUser, $isAdmin)
  $: displayName = $currentUser || "가족";

  // Form State
  let formData = {
    id: null,
    date: new Date().toISOString().split("T")[0],
    category: "일상",
    title: "",
    content: "",
    image_url: "",
    author: "",
  };

  const CATEGORIES = ["일상", "공지", "유머", "정보", "축하"];

  // --- Actions ---

  async function loadPosts() {
    isLoading = true;
    const res = await api.getPosts();
    if (res.success) {
      posts = res.posts; // Backend already reverses them? Or we sort here.
    } else {
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
        date: new Date().toISOString().split("T")[0],
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

    // Ensure author is set
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
      showDetailModal = false; // Close detail if open
      loadPosts();
    } else {
      alert("삭제 실패: " + res.message);
    }
  }

  // --- Detail View & Comments ---

  async function openDetail(post) {
    currentPost = post;
    showDetailModal = true;
    comments = []; // Reset first
    imageLoadFailed = false; // 이미지 상태 초기화
    imageLoading = true;

    // 1. Increment View
    api.incrementPostView(post.id);

    // 2. Load Comments
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
      // Reload comments
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
      // Reload comments
      isCommentLoading = true;
      const r = await api.getComments(currentPost.id);
      if (r.success) comments = r.comments;
      isCommentLoading = false;
    }
  }

  onMount(() => {
    loadPosts();
  });
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
  <!-- Header -->
  <header
    class="bg-white dark:bg-gray-800 shadow-sm px-6 py-6 sticky top-0 z-10 transition-colors"
  >
    <div class="flex justify-between items-center">
      <div>
        <h2
          class="text-2xl font-black text-gray-900 dark:text-white tracking-tight"
        >
          가족 게시판
        </h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          우리 가족의 소소한 이야기 공간
        </p>
      </div>
      <button
        on:click={() => openWriteModal()}
        class="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg active:scale-95 transition-all"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          ></path></svg
        >
      </button>
    </div>
  </header>

  <!-- Post List -->
  <main class="p-4 space-y-4">
    {#if isLoading}
      <div class="flex flex-col items-center justify-center py-20 space-y-4">
        <div
          class="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"
        ></div>
        <p class="text-gray-500 font-bold animate-pulse">
          게시글을 불러오고 있습니다...
        </p>
      </div>
    {:else if posts.length === 0}
      <div
        class="flex flex-col items-center justify-center py-20 text-gray-400"
      >
        <span class="text-4xl mb-4">📝</span>
        <p>아직 등록된 글이 없어요.</p>
        <p class="text-sm">가장 먼저 글을 남겨보세요!</p>
      </div>
    {:else}
      {#each posts as post (post.id)}
        <!-- Card -->
        <div
          on:click={() => openDetail(post)}
          class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm active:scale-[0.99] transition-all cursor-pointer border border-gray-100 dark:border-gray-700"
          in:slide={{ duration: 300 }}
        >
          <div class="flex justify-between items-start mb-2">
            <span
              class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300"
            >
              {post.category}
            </span>
            <span class="text-xs text-gray-400">{post.date}</span>
          </div>

          <h3
            class="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-snug"
          >
            {post.title}
          </h3>

          {#if post.image_url}
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold {looksLikeImageUrl(post.image_url) ? 'bg-green-50 dark:bg-green-900/30 text-green-500 dark:text-green-300' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-300'}"
            >
              {looksLikeImageUrl(post.image_url) ? '🖼️ 이미지' : '🔗 링크'}
            </span>
          {/if}

          <div
            class="flex justify-between items-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 mt-1"
          >
            <div class="flex items-center gap-2">
              <span class="font-bold text-gray-600 dark:text-gray-300"
                >by {post.author}</span
              >
            </div>
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  ></path></svg
                >
                {post.view_count}
              </span>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </main>

  <!-- Write Modal -->
  {#if showWriteModal}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-lg bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-2xl relative flex flex-col max-h-[90vh]"
        transition:slide={{ axis: "y" }}
      >
        <h2 class="text-xl font-black text-gray-900 dark:text-white mb-6">
          {formData.id ? "글 수정하기" : "새 글 쓰기"}
        </h2>

        <div class="space-y-4 overflow-y-auto flex-1 p-1">
          <div>
            <label class="text-xs font-bold text-gray-400 ml-2 block mb-1"
              >카테고리</label
            >
            <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {#each CATEGORIES as cat}
                <button
                  class="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all {formData.category ===
                  cat
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}"
                  on:click={() => (formData.category = cat)}
                >
                  {cat}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-400 ml-2 block mb-1"
              >제목</label
            >
            <input
              type="text"
              bind:value={formData.title}
              placeholder="제목을 입력하세요"
              class="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-400 ml-2 block mb-1"
              >내용</label
            >
            <textarea
              bind:value={formData.content}
              placeholder="무슨 일이 있었나요?"
              rows="6"
              class="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
            ></textarea>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-400 ml-2 block mb-1"
              >이미지/URL (선택)</label
            >
            <input
              type="text"
              bind:value={formData.image_url}
              placeholder="https://..."
              class="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div class="flex gap-3 mt-6 shrink-0">
          <button
            on:click={() => (showWriteModal = false)}
            class="flex-1 py-4 font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-2xl"
            >취소</button
          >
          <button
            on:click={savePost}
            disabled={isSubmitting}
            class="flex-1 py-4 font-black text-white bg-indigo-600 rounded-2xl shadow-lg"
          >
            {isSubmitting ? "저장 중..." : "등록하기"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Detail Modal -->
  {#if showDetailModal && currentPost}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      transition:fade
    >
      <div
        class="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] bg-white dark:bg-gray-800 sm:rounded-[2rem] flex flex-col relative overflow-hidden"
        in:fly={{ y: 50, duration: 300 }}
      >
        <!-- Header Actions -->
        <div
          class="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10"
        >
          <button
            on:click={() => (showDetailModal = false)}
            class="p-2 -ml-2 text-gray-500 dark:text-gray-400"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              ></path></svg
            >
          </button>

          {#if $currentUser === currentPost.author || $isAdmin}
            <div class="flex gap-2">
              <button
                on:click={() => {
                  showDetailModal = false;
                  openWriteModal(currentPost);
                }}
                class="text-xs font-bold text-indigo-500 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30"
                >수정</button
              >
              <button
                on:click={() => deletePost(currentPost.id)}
                class="text-xs font-bold text-red-500 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30"
                >삭제</button
              >
            </div>
          {/if}
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-0">
          <!-- Post Content -->
          <div class="p-6">
            <span
              class="inline-block py-1 px-2 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-bold mb-3"
              >{currentPost.category}</span
            >
            <h1
              class="text-2xl font-black text-gray-900 dark:text-white mb-4 leading-tight"
            >
              {currentPost.title}
            </h1>

            <div class="flex items-center gap-2 mb-6 text-xs text-gray-400">
              <span class="font-bold text-gray-600 dark:text-gray-300"
                >{currentPost.author}</span
              >
              <span>•</span>
              <span>{currentPost.date}</span>
              <span>•</span>
              <span>조회 {currentPost.view_count + 1}</span>
              <!-- Optimistic view count -->
            </div>

            {#if currentPost.image_url}
              {#if looksLikeImageUrl(currentPost.image_url) && !imageLoadFailed}
                <!-- 이미지 URL: 이미지로 렌더링 시도 -->
                <div class="mb-6">
                  {#if imageLoading}
                    <div class="w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse flex items-center justify-center">
                      <span class="text-gray-400 text-sm">이미지 로딩중...</span>
                    </div>
                  {/if}
                  <a href={currentPost.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={currentPost.image_url}
                      alt="첨부 이미지"
                      class="max-w-full rounded-xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                      class:hidden={imageLoading}
                      on:error={handleImageError}
                      on:load={handleImageLoad}
                    />
                  </a>
                </div>
              {:else}
                <!-- 일반 URL 또는 이미지 로드 실패: 링크 버튼으로 표시 -->
                <a
                  href={currentPost.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors mb-6 border border-blue-100 dark:border-blue-800"
                >
                  🔗 첨부 링크 열기
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    ></path></svg
                  >
                </a>
              {/if}
            {/if}

            <div
              class="text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line text-sm md:text-base"
            >
              {currentPost.content}
            </div>
          </div>

          <!-- Comments Section -->
          <div class="bg-gray-50 dark:bg-gray-900/50 p-6 min-h-[300px]">
            <h3
              class="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"
            >
              댓글 <span
                class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-1.5 rounded"
                >{comments.length}</span
              >
            </h3>

            <div class="space-y-4 mb-20">
              {#if isCommentLoading}
                <div class="flex justify-center py-6">
                  <div
                    class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"
                  ></div>
                </div>
              {:else if comments.length === 0}
                <p class="text-sm text-gray-400 text-center py-6">
                  첫 댓글을 남겨보세요!
                </p>
              {:else}
                {#each comments as comment}
                  <div class="flex gap-3">
                    <div
                      class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300 shrink-0"
                    >
                      {comment.author[0]}
                    </div>
                    <div class="flex-1">
                      <div
                        class="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm relative group"
                      >
                        <div class="flex justify-between items-start mb-1">
                          <span
                            class="text-xs font-bold text-gray-900 dark:text-white"
                            >{comment.author}</span
                          >
                          <span class="text-[10px] text-gray-400"
                            >{comment.date}</span
                          >
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                          {comment.content}
                        </p>

                        {#if $currentUser === comment.author || $isAdmin}
                          <button
                            on:click={() => deleteComment(comment.id)}
                            class="absolute right-2 bottom-2 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                            >삭제</button
                          >
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>

        <!-- Comment Input (Fixed) -->
        <div
          class="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0"
        >
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={commentContent}
              placeholder="댓글을 입력하세요..."
              class="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              on:keypress={(e) => e.key === "Enter" && addComment()}
            />
            <button
              on:click={addComment}
              disabled={!commentContent.trim() || isCommentSubmitting}
              class="bg-indigo-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white px-4 rounded-xl font-bold text-sm transition-all"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
