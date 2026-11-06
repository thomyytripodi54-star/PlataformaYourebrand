import { test } from "node:test";
import assert from "node:assert/strict";
import { pestanaComoTexto } from "@/lib/asistente/formato";

test("pestaña de la planilla como texto: saca vacíos y separa bloques", () => {
  const filas = [
    [],
    ["", "Resumen USD", "", "", "", "Octubre"],
    ["", "Dolar", "1551", "", "", "Ingresos", "ARS$", "%"],
    ["", "Clientes", "30", "", "$3.509,67", "Costos fijos totales"],
    ["", "", "", "", "", "", "", "", "", "", "- Comprar equipamiento"],
  ];
  assert.equal(
    pestanaComoTexto(filas),
    ["Resumen USD   ‖   Octubre", "Dolar | 1551   ‖   Ingresos | ARS$ | %", "Clientes | 30 |  | $3.509,67 | Costos fijos totales", "- Comprar equipamiento"].join("\n"),
  );
});

import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { credencialesDeEnv, explicarErrorGoogle, jwtCuentaServicio } from "@/lib/asistente/google";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const json = JSON.stringify({ type: "service_account", client_email: "asistente@yb.iam.gserviceaccount.com", private_key: pem });

test("credenciales de Google: JSON pegado, en base64 o con saltos de línea escapados", () => {
  assert.equal(credencialesDeEnv(json).private_key, pem);
  assert.equal(credencialesDeEnv(Buffer.from(json).toString("base64")).client_email, "asistente@yb.iam.gserviceaccount.com");
  const escapado = JSON.stringify({ client_email: "a@b", private_key: pem.replace(/\n/g, "\\n") });
  assert.equal(credencialesDeEnv(escapado).private_key, pem);
  assert.throws(() => credencialesDeEnv("no es json"), /no es un JSON válido/);
  assert.throws(() => credencialesDeEnv('{"a":1}'), /client_email o private_key/);
});

test("JWT de la cuenta de servicio: firma válida y alcance de solo lectura", () => {
  const jwt = jwtCuentaServicio(credencialesDeEnv(json), 1_700_000_000);
  const [h, c, firma] = jwt.split(".");
  const v = createVerify("RSA-SHA256").update(`${h}.${c}`);
  assert.ok(v.verify(createPublicKey(publicKey.export({ type: "spki", format: "pem" })), firma, "base64url"));
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.scope, "https://www.googleapis.com/auth/spreadsheets.readonly");
  assert.equal(claims.exp - claims.iat, 3600);
});

test("errores de Google con qué hacer", () => {
  assert.match(explicarErrorGoogle(403, "The caller does not have permission", "x@y"), /compartila como Lector con x@y/);
  assert.match(explicarErrorGoogle(403, "SERVICE_DISABLED", "x@y"), /habilitar la Google Sheets API/);
  assert.match(explicarErrorGoogle(400, '{"error":"invalid_grant"}', "x@y"), /clave JSON nueva/);
});
