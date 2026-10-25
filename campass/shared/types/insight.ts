export type Insight = {
  passages: number;
  confusions: number;
  rate: number;
  feedbacks: number;
  points: {
    id: string;
    name: string;
    passages: number;
    confusions: number;
    rate: number;
  }[];
};
