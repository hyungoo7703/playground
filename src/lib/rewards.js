// Rewards that open the allowance card pick. The key travels in navigation state;
// the label goes into the ledger title of the draw, which is also how a reward is known to be spent.
export const REWARD_LABELS = {
  attendance: "출석 100일",
  guardian: "네온 가디언 클리어",
  // Must not contain the normal label: each one is looked up in ledger titles on its own
  guardianHard: "네온 가디언 하드 클리어",
};
