/** Filas de una pestaña como texto: sin celdas vacías al final y con "‖" donde la hoja tiene bloques separados. */
export function pestanaComoTexto(filas: string[][]): string {
  return filas
    .map((f) => {
      const segmentos: string[][] = [[]];
      let vacias = 0;
      for (const c of f.map((x) => (x ?? "").toString().trim())) {
        if (!c) {
          vacias++;
          continue;
        }
        if (vacias >= 2 && segmentos[segmentos.length - 1].length) segmentos.push([]);
        else if (vacias === 1 && segmentos[segmentos.length - 1].length) segmentos[segmentos.length - 1].push("");
        segmentos[segmentos.length - 1].push(c);
        vacias = 0;
      }
      return segmentos
        .filter((x) => x.length)
        .map((x) => x.join(" | "))
        .join("   ‖   ");
    })
    .filter(Boolean)
    .join("\n");
}
