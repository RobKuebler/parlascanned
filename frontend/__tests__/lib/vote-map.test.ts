import {
  buildVoteIndex,
  computeCohesionRecords,
  findDivergentPollIds,
  normalizeSelection,
} from "@/lib/vote-map";
import { EmbeddingPoint, Politician, Poll, VoteRecord } from "@/lib/data";

const POLITICIANS: Politician[] = [
  {
    politician_id: 1,
    name: "Alice",
    party: "SPD",
    sex: null,
    year_of_birth: null,
    occupation: null,
    education: null,
    field_title: null,
  },
  {
    politician_id: 2,
    name: "Bob",
    party: "SPD",
    sex: null,
    year_of_birth: null,
    occupation: null,
    education: null,
    field_title: null,
  },
  {
    politician_id: 3,
    name: "Carla",
    party: "BÜNDNIS 90/\u00adDIE GRÜNEN",
    sex: null,
    year_of_birth: null,
    occupation: null,
    education: null,
    field_title: null,
  },
];

describe("computeCohesionRecords", () => {
  it("computes cohesion per party and normalizes soft-hyphen party names", () => {
    const points: EmbeddingPoint[] = [
      { politician_id: 1, x: 0, y: 0 },
      { politician_id: 2, x: 2, y: 0 },
      { politician_id: 3, x: 10, y: 10 },
    ];

    expect(computeCohesionRecords(points, POLITICIANS)).toEqual([
      { party: "SPD", label: "SPD", streuung: 1 },
    ]);
  });
});

describe("normalizeSelection", () => {
  it("collapses full-party selections into a party pill", () => {
    expect(normalizeSelection([1, 2], [], POLITICIANS)).toEqual({
      polIds: [],
      parties: ["SPD"],
    });
  });

  it("keeps incomplete selections as individual ids", () => {
    expect(normalizeSelection([1], [], POLITICIANS)).toEqual({
      polIds: [1],
      parties: [],
    });
  });
});

describe("buildVoteIndex", () => {
  it("indexes votes by politician and poll", () => {
    const votes: VoteRecord[] = [
      { politician_id: 1, poll_id: 10, answer: "yes" },
      { politician_id: 2, poll_id: 10, answer: "no" },
    ];

    const index = buildVoteIndex(votes);
    expect(index.get(1)?.get(10)).toBe("yes");
    expect(index.get(2)?.get(10)).toBe("no");
  });
});

describe("findDivergentPollIds", () => {
  const polls: Poll[] = [
    { poll_id: 10, topic: "A" },
    { poll_id: 11, topic: "B" },
  ];
  const votes: VoteRecord[] = [
    { politician_id: 1, poll_id: 10, answer: "yes" },
    { politician_id: 2, poll_id: 10, answer: "no" },
    { politician_id: 1, poll_id: 11, answer: "yes" },
    { politician_id: 2, poll_id: 11, answer: "no_show" },
  ];

  it("finds divergent polls including absences by default", () => {
    expect(
      findDivergentPollIds(votes, polls, [1, 2], { ignoreNoShow: false }),
    ).toEqual([10, 11]);
  });

  it("ignores no_show when requested", () => {
    expect(
      findDivergentPollIds(votes, polls, [1, 2], { ignoreNoShow: true }),
    ).toEqual([10]);
  });

  it("returns undefined for fewer than two politicians", () => {
    expect(
      findDivergentPollIds(votes, polls, [1], { ignoreNoShow: false }),
    ).toBeUndefined();
  });
});
