/**
 * Port 1:1 de `er_mes.py` (skill consolidar-estado-resultados). No cambiar reglas acá sin cambiarlas en la skill.
 * Función pura: recibe los bloques ya leídos del Excel (BALANCE) + roles/clientes de Notion + ajustes,
 * y devuelve el ER devengado, el detalle, la lista REVISAR y el control contra "Calculo diferido".
 */

export const MESES_ER = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const ING = ["RRSS Mens", "RRSS Trim diferidos", "RRSS Sems diferidos", "RRSS Anual diferidos", "Extras ingreso"] as const;
export const COP = ["Community Managers", "Produccion de contenido", "Desarrollo web", "Publicidad"] as const;
export const CFI = ["Gastos campañas", "Gasto redes organico", "Sueldo marketing", "Sueldos Fijos", "Suscripciones", "Sueldo Thomy"] as const;
export const OTROS = ["Extras", "Impuestos", "Fees"] as const;
export const LINEAS = [...ING, ...COP, ...CFI, ...OTROS] as string[];
const DUR: Record<number, string> = { 3: "RRSS Trim diferidos", 6: "RRSS Sems diferidos", 12: "RRSS Anual diferidos" };

/* ---------- helpers (mismos que el script) ---------- */
export function norm(s: unknown) {
  const t = String(s ?? "").trim().toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  return t.replace(/\s+/g, " ");
}
export const toks = (s: unknown) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
const STOP = new Set(["de", "la", "el", "y", "los", "las", "del", "web", "redes", "video", "videos", "mitad", "pago", "eli", "3", "2", "1"]);
export function clave(s: unknown) {
  const t = toks(s).filter((w) => !STOP.has(w));
  return t.length ? t[0] : norm(s);
}
const tiene = (n: string, ...ps: string[]) => ps.some((p) => n.includes(p));
/** round() de Python (redondeo bancario). */
export function pyRound(x: number) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 ? (r % 2 === 0 ? r : r - 1) : r;
}
/** Formato `{x:,.0f}` de Python. */
const f0 = (x: number) => {
  const r = pyRound(x);
  return (r < 0 ? "-" : "") + Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/* ---------- reglas fijas (confirmadas por Thomy) ---------- */
const K_IMP = ["monotrib", "vep", "cm thomy", "cm san", "iibb", "impuesto", "afip", "arca", "contador"];
const K_SUBS = ["claude", "hosting", "dominio", "ssl", "capcut", "calendly", "mailchimp", "canva", "chatgpt", "notion", "suscrip", "gemini", "workspace"];
const K_CAMP = ["meta", "tiktok ads", "google ads", "meet alf", "sales nav", "navigator", "linkedin"];
const K_EXTR = ["incentiv", "almuerzo", "comida", "cafe", "merienda", "regalo", "capacit", "capa ", "dji", "estacionamiento", "uber", "cumple", "vicente lopez", "premio", "bono", "festejo", "torta"];
const K_PROD = ["creador", "creadora", "filmaker", "filmmaker", "editor", "edicion", "videos"];
const K_ING_EXTRA = ["web", "video", "branding", "jornada", "grabacion", "extra", "pago 1", "pago 2", "mitad", "logo", "diseno", "ugc", "viaje", "seo"];
const ROL_CAT: Record<string, string> = {
  "community manager": "Community Managers",
  "community manager senior": "Community Managers",
  "creador de contenido": "Produccion de contenido",
  "editor de video": "Produccion de contenido",
  publicista: "Publicidad",
  "desarrollador web": "Desarrollo web",
};
const ROLES_HIST: Record<string, string> = { lari: "Community Manager", tefy: "Community Manager", caro: "Community Manager", santino: "Desarrollador Web", evi: "Creador de Contenido", "cami briones": "Creador de Contenido" };

export function catEgreso(nombre: string, monto: number, formula: unknown, roles: Record<string, string>): [string, string] {
  const n = norm(nombre);
  const f = String(formula ?? "");
  const t = toks(nombre);
  const first = t[0] ?? "";
  if (n.startsWith("thomy") && f.includes("1500")) return ["Sueldo Thomy", ""];
  if (n.startsWith("bruno pack")) return ["Sueldo marketing", ""];
  if (tiene(n, ...K_IMP) || first === "ger") return ["Impuestos", ""];
  if (tiene(n, ...K_SUBS)) return ["Suscripciones", ""];
  if (tiene(n, ...K_CAMP)) return ["Gastos campañas", ""];
  if (tiene(n, ...K_EXTR)) return ["Extras", ""];
  if (n === "web bruno" || n === "bruno web" || n.includes("yourebrand")) return ["Extras", "?web propia YB (autoservicio): confirmar que no sea de un cliente"];
  if (/\byb\b/.test(n) || n.includes("gym") || n.includes("gimnasio")) {
    if (n.includes("bruno") || n.includes("web")) return ["Extras", "web propia YB (autoservicio)"];
    return ["Gasto redes organico", ""];
  }
  const rol = ROLES_HIST[n] || roles[n] || roles[first] || ROLES_HIST[first];
  if (t.includes("bruno")) {
    if (tiene(n, "web", "mitad") || f.includes("/2")) return ["Desarrollo web", "Bruno web"];
    if (monto >= 250_000) return ["Desarrollo web", "?Bruno monto grande: web (confirmar en hoja PAGOS, sección Bruno)"];
    return ["Publicidad", ""];
  }
  if (first === "debu" || first === "deborah") return monto >= 500_000 ? ["Sueldos Fijos", ""] : ["Produccion de contenido", "Debu filmaker"];
  if (first === "marce" || first === "marcelo") {
    if (monto >= 400_000) return ["Sueldos Fijos", ""];
    if (monto <= 90_000) return ["Produccion de contenido", "Marce filmaker"];
    return ["Community Managers", "Marce como CM (~100k)"];
  }
  if (first === "thomy" || first === "thomas") return ["Produccion de contenido", "Thomy filmaker/creador"];
  if ((first === "cami" || first === "camila") && monto <= 90_000) return ["Produccion de contenido", "Cami contenido (montos chicos)"];
  if (tiene(n, ...K_PROD)) return ["Produccion de contenido", ""];
  if (rol && ROL_CAT[norm(rol)]) return [ROL_CAT[norm(rol)], ""];
  return ["Community Managers", "?no está en la nómina: lo mando a CM"];
}

export function catDifNeg(nombre: string) {
  const n = norm(nombre);
  if (tiene(n, ...K_CAMP)) return "Gastos campañas";
  if (tiene(n, ...K_SUBS)) return "Suscripciones";
  return "Extras";
}

/* ---------- datos de entrada (leídos del Excel) ---------- */
export type Renglon = { fila: number; nombre: string; ing: number; egr: number; dif: number; fEgr: string | null; fDif: string | null };
export type Bloque = {
  col: number;
  mes: number; // 0-11
  anio: number;
  rows: Renglon[] | null; // null = el bloque no tiene fila =SUM (el script lo saltea)
  meta: { usd: number; eur: number; bajas: unknown; nuevos: unknown; calc: { ing: number; egr: number; res: number } | null };
};
export type ClienteNotion = { alias: string[]; paga_ars?: number | null; paga_eur?: number | null; duracion?: number; desde?: string | null };
export type Ajustes = { filas?: Record<string, string>; agregar?: { concepto: string; linea: string; monto: number }[] };

export type Detalle = { fila: number | "+"; nombre: string; tipo: string; monto: number; linea: string; nota: string; revisar: boolean };

export function calcularER(bloques: Bloque[], idx: number, roles0: Record<string, string>, clientes: ClienteNotion[], aj: Ajustes = {}) {
  const roles = Object.fromEntries(Object.entries(roles0).map(([k, v]) => [norm(k), v]));
  const b = bloques[idx];
  if (!b.rows) throw new Error("El bloque del mes no tiene la fila =SUM");
  const rows = b.rows;
  const usd = b.meta.usd || 1;
  const eur = b.meta.eur;

  const cliente = (nombre: string) => {
    const k = clave(nombre);
    return clientes.find((cl) => (cl.alias ?? []).some((x) => k === clave(x) || toks(x).includes(k))) ?? null;
  };
  const paga = (cl: ClienteNotion | null) => (cl ? cl.paga_ars || (cl.paga_eur || 0) * eur : 0);

  // contratos multi-mes cobrados antes (cash + violeta en el mismo renglón)
  type Prev = { k: string; nombre: string; idx: number; n: number; total: number; cuota: number; mes: string };
  const prev: Prev[] = [];
  for (let j = Math.max(0, idx - 13); j < idx; j++) {
    const pr = bloques[j].rows;
    if (!pr) continue;
    for (const x of pr) {
      if (x.ing > 0 && x.dif > 0 && 2 <= pyRound(x.ing / x.dif) && pyRound(x.ing / x.dif) <= 12) {
        const n = pyRound(x.ing / x.dif);
        prev.push({ k: clave(x.nombre), nombre: x.nombre, idx: j, n, total: x.ing, cuota: x.ing / n, mes: `${MESES_ER[bloques[j].mes]} ${bloques[j].anio}` });
      }
    }
  }
  const vig = new Map<string, Prev>();
  for (const p of prev) {
    if (0 < idx - p.idx && idx - p.idx < p.n) vig.set(p.k, p);
    else if (vig.has(p.k) && p.idx > vig.get(p.k)!.idx) vig.delete(p.k);
  }

  const er: Record<string, number> = Object.fromEntries(LINEAS.map((k) => [k, 0]));
  const det: Detalle[] = [];
  const rev: string[] = [];
  const explicado: { concepto: string; monto: number }[] = [];
  const put = (f: number | "+", nombre: string, tipo: string, monto: number, linea0: string, nota = "") => {
    const linea = aj.filas?.[String(f)] ?? linea0;
    er[linea] += monto;
    det.push({ fila: f, nombre, tipo, monto, linea, nota: nota.replace(/^\?/, ""), revisar: nota.startsWith("?") });
    if (nota.startsWith("?")) rev.push(`F${f} ${nombre} ${f0(monto)} → ${linea}: ${nota.slice(1)}`);
  };

  // cobros duplicados del mismo cliente
  const dup = new Map<string, Renglon[]>();
  for (const x of rows) if (x.ing > 0 && !x.dif) dup.set(clave(x.nombre), [...(dup.get(clave(x.nombre)) ?? []), x]);
  const vistosDif = new Set<string>();

  for (const x of rows) {
    const n = x.nombre;
    const k = clave(n);
    if (x.ing > 0 && x.dif > 0) {
      const nm = pyRound(x.ing / x.dif);
      const linea = DUR[nm] ?? "RRSS Trim diferidos";
      put(x.fila, n, "cobro multi-mes", x.ing / nm, linea, `cobró ${f0(x.ing)} por ${nm} meses` + (DUR[nm] ? "" : " ?no es 3/6/12"));
      vistosDif.add(k);
    } else if (x.ing > 0) {
      const cl = cliente(n);
      const nn = norm(n);
      const p = paga(cl);
      const grupo = dup.get(k) ?? [];
      const minimo = grupo.reduce<Renglon | null>((m, z) => (m === null || z.ing < m.ing ? z : m), null);
      if (tiene(nn, ...K_ING_EXTRA)) {
        put(x.fila, n, "ingreso", x.ing, "Extras ingreso", "trabajo puntual");
      } else if (grupo.length > 1 && x === minimo && !grupo.some((z) => tiene(norm(z.nombre), ...K_ING_EXTRA))) {
        put(x.fila, n, "ingreso", x.ing, "Extras ingreso", "segundo cobro del cliente en el mes");
      } else if (p && x.ing > p * 1.2) {
        put(x.fila, n, "ingreso", p, "RRSS Mens", "abono según Notion");
        put(x.fila, n, "ingreso", x.ing - p, "Extras ingreso", "?excedente sobre el abono de Notion → extra");
      } else {
        put(x.fila, n, "ingreso", x.ing, "RRSS Mens", cl || !clientes.length ? "" : "?no lo encontré en Clientes de Notion");
      }
    } else if (x.dif > 0) {
      const v = vig.get(k);
      if (v) {
        const difiere = Math.abs(v.cuota - x.dif) > 1000;
        put(x.fila, n, "cuota diferida", v.cuota, DUR[v.n] ?? "RRSS Trim diferidos", difiere ? `?Excel ${f0(x.dif)} → uso cuota cobrada en ${v.mes}` : `pago de ${v.mes}`);
        if (difiere) explicado.push({ concepto: `${n}: cuota a lo cobrado en ${v.mes} (Excel ${f0(x.dif)})`, monto: v.cuota - x.dif });
      } else {
        const cl = cliente(n);
        const d = cl?.duracion ?? 3;
        put(x.fila, n, "cuota diferida", x.dif, DUR[d] ?? "RRSS Trim diferidos", "?no encontré el cobro original en los últimos 13 meses");
      }
      vistosDif.add(k);
    } else if (x.dif < 0) {
      put(x.fila, n, "gasto diferido", -x.dif, catDifNeg(n), "prepago devengado");
    }
    if (x.egr) {
      if (x.dif < 0) {
        det.push({ fila: x.fila, nombre: n, tipo: "egreso prepago", monto: x.egr, linea: "EXCLUIDO", nota: "se devenga por la columna violeta", revisar: false });
        continue;
      }
      const [linea, nota] = catEgreso(n, x.egr, x.fEgr, roles);
      put(x.fila, n, "egreso", x.egr, linea, nota);
    }
  }
  for (const [k, v] of vig) {
    if (!vistosDif.has(k)) {
      put("+", v.nombre, "cuota faltante", v.cuota, DUR[v.n] ?? "RRSS Trim diferidos", `?faltaba en el Excel: pagó ${f0(v.total)} en ${v.mes} por ${v.n} meses`);
      explicado.push({ concepto: `${v.nombre}: diferido faltante en el Excel (pagó ${f0(v.total)} en ${v.mes})`, monto: v.cuota });
    }
  }
  for (const ad of aj.agregar ?? []) put("+", ad.concepto, "ajuste manual", ad.monto, ad.linea);

  const sum = (ks: readonly string[]) => ks.reduce((s, k) => s + er[k], 0);
  const ib = sum(ING);
  const cop = sum(COP);
  const cfi = sum(CFI);
  const mo = ib - cop;
  const ebitda = mo - cfi - er["Extras"];
  const neta = ebitda - er["Impuestos"] - er["Fees"];
  return {
    mes: `${MESES_ER[b.mes]} ${b.anio}`,
    dolarExcel: b.meta.usd,
    euro: eur,
    bajasExcel: b.meta.bajas,
    nuevosExcel: b.meta.nuevos,
    lineas: er,
    ingresos_brutos: ib,
    costos_operativos: cop,
    margen_operativo: mo,
    costos_fijos: cfi,
    ebitda,
    utilidad_neta: neta,
    control_excel: b.meta.calc,
    revisar: rev,
    detalle: det,
    explicado,
    usdDivisor: usd,
  };
}
export type ResultadoER = ReturnType<typeof calcularER>;
