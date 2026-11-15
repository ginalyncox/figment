import test from "node:test";
import assert from "node:assert/strict";
import { computePayouts } from "../lib/payouts.ts";
import { decideAccess } from "../lib/paywall.ts";

const sum = (lines) => lines.reduce((s, l) => s + l.amountCents, 0);

test("simple split: 20% fee, two creators 75/25", () => {
  const p = computePayouts({
    netRevenueCents: 10000,
    feeBps: 2000,
    watch: [{ creatorId: "a", watchSeconds: 300 }, { creatorId: "b", watchSeconds: 100 }],
  });
  assert.equal(p.platformFeeCents, 2000);
  assert.equal(p.creatorPoolCents, 8000);
  assert.deepEqual(p.lines.map((l) => [l.creatorId, l.amountCents]), [["a", 6000], ["b", 2000]]);
});

test("rounding never creates or loses a cent", () => {
  const p = computePayouts({
    netRevenueCents: 1000,
    feeBps: 2000,
    watch: [{ creatorId: "a", watchSeconds: 1 }, { creatorId: "b", watchSeconds: 1 }, { creatorId: "c", watchSeconds: 1 }],
  });
  assert.equal(p.creatorPoolCents, 800);
  assert.equal(sum(p.lines), 800);
  assert.deepEqual(p.lines.map((l) => l.amountCents).sort(), [266, 267, 267]);
});

test("fee + pool always equals net revenue, lines always equal pool (random checks)", () => {
  let seed = 42;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 2000; i++) {
    const net = rand(5_000_000);
    const feeBps = rand(10001);
    const watch = Array.from({ length: 1 + rand(12) }, (_, k) => ({ creatorId: `c${k}`, watchSeconds: rand(100000) }));
    const p = computePayouts({ netRevenueCents: net, feeBps, watch });
    assert.equal(p.platformFeeCents + p.creatorPoolCents, net);
    assert.equal(sum(p.lines) + p.undistributedCents, p.creatorPoolCents);
    for (const l of p.lines) assert.ok(Number.isInteger(l.amountCents) && l.amountCents >= 0);
  }
});

test("nobody watched: nothing is paid out", () => {
  const p = computePayouts({ netRevenueCents: 5000, feeBps: 2000, watch: [{ creatorId: "a", watchSeconds: 0 }] });
  assert.equal(p.lines.length, 0);
  assert.equal(p.undistributedCents, 4000);
});

test("more refunds than sales: nobody is paid, nothing goes negative", () => {
  const p = computePayouts({ netRevenueCents: -300, feeBps: 2000, watch: [{ creatorId: "a", watchSeconds: 50 }] });
  assert.equal(p.creatorPoolCents, 0);
  assert.equal(p.lines.length, 0);
});

test("one creator gets the whole pool", () => {
  const p = computePayouts({ netRevenueCents: 999, feeBps: 1500, watch: [{ creatorId: "a", watchSeconds: 7 }] });
  assert.equal(p.platformFeeCents, 150);
  assert.equal(p.lines[0].amountCents, 849);
});

test("bad input is rejected", () => {
  assert.throws(() => computePayouts({ netRevenueCents: 10.5, feeBps: 2000, watch: [] }));
  assert.throws(() => computePayouts({ netRevenueCents: 100, feeBps: 10001, watch: [] }));
});

test("paywall: free limit, re-watch, subscriber, owner", () => {
  const base = { subscribed: false, isOwner: false, alreadyFreeViewed: false, freeUsed: 0, limit: 3 };
  assert.deepEqual(decideAccess(base), { allowed: true, reason: "free", recordFreeView: true });
  assert.equal(decideAccess({ ...base, freeUsed: 2 }).allowed, true);
  assert.deepEqual(decideAccess({ ...base, freeUsed: 3 }), { allowed: false, reason: "paywall", recordFreeView: false });
  // re-watching one of your free videos does not hit the paywall or use another slot
  assert.deepEqual(decideAccess({ ...base, freeUsed: 3, alreadyFreeViewed: true }), { allowed: true, reason: "free", recordFreeView: false });
  assert.equal(decideAccess({ ...base, freeUsed: 99, subscribed: true }).reason, "subscriber");
  assert.equal(decideAccess({ ...base, freeUsed: 99, isOwner: true }).reason, "owner");
  assert.equal(decideAccess({ ...base, limit: 0 }).allowed, false);
});
