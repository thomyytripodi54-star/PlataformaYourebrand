// Descarga la foto de perfil de Instagram de cada cliente y la guarda como logo.
// Uso: npm run logos            (solo los que no tienen logo)
//      npm run logos -- --todos (vuelve a descargar todos)
import fs from "node:fs/promises";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DATA = path.join(RAIZ, "data", "clientes.json");
const LOGOS = path.join(RAIZ, "public", "logos");
const todos = process.argv.includes("--todos");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function urlFotoPerfil(usuario) {
  // 1) API web de Instagram
  try {
    const r = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${usuario}`,
      { headers: { "User-Agent": UA, "x-ig-app-id": "936619743392459" } },
    );
    if (r.ok) {
      const j = await r.json();
      const u = j?.data?.user;
      if (u?.profile_pic_url_hd || u?.profile_pic_url) return u.profile_pic_url_hd || u.profile_pic_url;
    }
  } catch {}
  // 2) Respaldo: unavatar.io
  return `https://unavatar.io/instagram/${usuario}?fallback=false`;
}

const clientes = JSON.parse(await fs.readFile(DATA, "utf8"));
await fs.mkdir(LOGOS, { recursive: true });

let ok = 0, fallos = [];
for (const c of clientes) {
  if (!c.instagram) continue;
  if (c.logo && !todos) continue;
  try {
    const url = await urlFotoPerfil(c.instagram);
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok || !tipo.startsWith("image/")) throw new Error(`HTTP ${r.status}`);
    const archivo = `${c.id}.jpg`;
    await fs.writeFile(path.join(LOGOS, archivo), Buffer.from(await r.arrayBuffer()));
    c.logo = `/logos/${archivo}`;
    ok++;
    console.log(`✓ ${c.nombre} (@${c.instagram})`);
  } catch (e) {
    fallos.push(c.nombre);
    console.log(`✗ ${c.nombre} (@${c.instagram}): ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1500)); // evita bloqueos de Instagram
}

await fs.writeFile(DATA, JSON.stringify(clientes, null, 2) + "\n");
console.log(`\nLogos descargados: ${ok}. Fallaron: ${fallos.length}${fallos.length ? " → " + fallos.join(", ") : ""}`);
