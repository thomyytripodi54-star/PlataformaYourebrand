export type FollowUp = { cada: number; ultimo: string };
export type EstadoFollowUp = FollowUp & { proximo: string; vencido: boolean; dias: number };

const DIA = 86_400_000;

/** Calcula el próximo follow up y si ya venció. `dias`: días que faltan (negativo = atrasado). */
export function estado(f: FollowUp, ahora = Date.now()): EstadoFollowUp {
  const prox = new Date(f.ultimo).getTime() + f.cada * DIA;
  return { ...f, proximo: new Date(prox).toISOString(), vencido: ahora >= prox, dias: Math.ceil((prox - ahora) / DIA) };
}

