import { test } from "node:test";
import assert from "node:assert/strict";
import { estado } from "@/lib/followup-calculo";

const D = 86_400_000;
const ultimo = "2026-10-01T12:00:00.000Z";
const t0 = new Date(ultimo).getTime();

test("follow up cada 30 días: faltan días antes de vencer", () => {
  const e = estado({ cada: 30, ultimo }, t0 + 10 * D);
  assert.equal(e.vencido, false);
  assert.equal(e.dias, 20);
});

test("follow up vence justo al cumplirse el plazo y cuenta el atraso", () => {
  assert.equal(estado({ cada: 30, ultimo }, t0 + 30 * D).vencido, true);
  const e = estado({ cada: 7, ultimo }, t0 + 10 * D);
  assert.equal(e.vencido, true);
  assert.equal(e.dias, -3);
});

test("marcar revisado reinicia la cuenta", () => {
  const ahora = t0 + 40 * D;
  const e = estado({ cada: 30, ultimo: new Date(ahora).toISOString() }, ahora);
  assert.equal(e.vencido, false);
  assert.equal(e.dias, 30);
});
