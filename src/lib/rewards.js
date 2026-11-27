// Rewards that open the allowance card pick. The key travels in navigation state;
// the label goes into the ledger title of the draw, which is also how a reward is known to be spent.
export const REWARD_LABELS = {
  attendance: "출석 100일",
  rune: "룬 가디언 클리어",
};

// One draw per account for each reward: a draw already on the ledger under the reward's label means it is spent
export const hasDrawn = (ledger, user, source) =>
  ledger.some((item) => {
    const title = String(item.title ?? "");
    return item.receiver === user && title.startsWith("카드뽑기 당첨") && title.includes(REWARD_LABELS[source]);
  });
