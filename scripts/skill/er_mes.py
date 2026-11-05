#!/usr/bin/env python3
"""ER devengado de Yourebrand a partir de la hoja BALANCE (método de Thomy).
Uso: python3 er_mes.py <xlsx> <Mes> <Año> [--roles roles.json] [--clientes clientes.json]
                       [--ajustes ajustes.json] [--json out.json]
roles.json    {"alias en minúscula": "Rol de Notion", ...}
clientes.json [{"alias": ["fir24"], "paga_ars": 900000, "paga_eur": null,
               "duracion": 1|3|6|12, "desde": "2026-10-02"}, ...]
ajustes.json  {"filas": {"37": "Desarrollo web"}, "agregar": [{"concepto": "...", "linea": "...", "monto": 0}]}
"""
import sys, re, json, argparse, unicodedata, datetime as dt
import openpyxl
from openpyxl.utils import get_column_letter as L

MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
ING = ['RRSS Mens','RRSS Trim diferidos','RRSS Sems diferidos','RRSS Anual diferidos','Extras ingreso']
COP = ['Community Managers','Produccion de contenido','Desarrollo web','Publicidad']
CFI = ['Gastos campañas','Gasto redes organico','Sueldo marketing','Sueldos Fijos','Suscripciones','Sueldo Thomy']
OTROS = ['Extras','Impuestos','Fees']
DUR = {3: 'RRSS Trim diferidos', 6: 'RRSS Sems diferidos', 12: 'RRSS Anual diferidos'}

def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '').strip().lower()).encode('ascii','ignore').decode()
    return re.sub(r'\s+', ' ', s)
def toks(s): return [w for w in re.split(r'[^a-z0-9]+', norm(s)) if w]
STOP = {'de','la','el','y','los','las','del','web','redes','video','videos','mitad','pago','eli','3','2','1'}
def clave(s):
    t = [w for w in toks(s) if w not in STOP]; return t[0] if t else norm(s)
def num(v): return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) else 0.0
def tiene(n, *ps): return any(p in n for p in ps)

# ---------------- reglas fijas (confirmadas por Thomy) ----------------
K_IMP  = ('monotrib','vep','cm thomy','cm san','iibb','impuesto','afip','arca','contador')
K_SUBS = ('claude','hosting','dominio','ssl','capcut','calendly','mailchimp','canva','chatgpt','notion','suscrip','gemini','workspace')
K_CAMP = ('meta','tiktok ads','google ads','meet alf','sales nav','navigator','linkedin')
K_EXTR = ('incentiv','almuerzo','comida','cafe','merienda','regalo','capacit','capa ','dji','estacionamiento','uber','cumple','vicente lopez',
          'premio','bono','festejo','torta')
K_PROD = ('creador','creadora','filmaker','filmmaker','editor','edicion','videos')
K_ING_EXTRA = ('web','video','branding','jornada','grabacion','extra','pago 1','pago 2','mitad','logo','diseno','ugc','viaje','seo')
ROL_CAT = {'community manager':'Community Managers','community manager senior':'Community Managers',
           'creador de contenido':'Produccion de contenido','editor de video':'Produccion de contenido',
           'publicista':'Publicidad','desarrollador web':'Desarrollo web'}
# ex-integrantes que ya no están en la nómina de Notion
ROLES_HIST = {'lari':'Community Manager','tefy':'Community Manager','caro':'Community Manager','santino':'Desarrollador Web',
              'evi':'Creador de Contenido','cami briones':'Creador de Contenido'}

def cat_egreso(nombre, monto, formula, roles):
    n, f = norm(nombre), str(formula or '')
    t = toks(nombre); first = t[0] if t else ''
    if n.startswith('thomy') and '1500' in f: return 'Sueldo Thomy', ''
    if n.startswith('bruno pack'): return 'Sueldo marketing', ''
    if tiene(n, *K_IMP) or first == 'ger': return 'Impuestos', ''
    if tiene(n, *K_SUBS): return 'Suscripciones', ''
    if tiene(n, *K_CAMP): return 'Gastos campañas', ''
    if tiene(n, *K_EXTR): return 'Extras', ''
    if n in ('web bruno', 'bruno web') or 'yourebrand' in n:
        return 'Extras', '?web propia YB (autoservicio): confirmar que no sea de un cliente'
    if (re.search(r'\byb\b', n) or 'gym' in n or 'gimnasio' in n):
        if 'bruno' in n or 'web' in n: return 'Extras', 'web propia YB (autoservicio)'
        return 'Gasto redes organico', ''
    rol = ROLES_HIST.get(n) or roles.get(n) or roles.get(first) or ROLES_HIST.get(first)
    if 'bruno' in t:
        if tiene(n,'web','mitad') or '/2' in f: return 'Desarrollo web', 'Bruno web'
        if monto >= 250_000: return 'Desarrollo web', '?Bruno monto grande: web (confirmar en hoja PAGOS, sección Bruno)'
        return 'Publicidad', ''
    if first in ('debu','deborah'):
        return ('Sueldos Fijos','') if monto >= 500_000 else ('Produccion de contenido','Debu filmaker')
    if first in ('marce','marcelo'):
        if monto >= 400_000: return 'Sueldos Fijos', ''
        if monto <= 90_000: return 'Produccion de contenido', 'Marce filmaker'
        return 'Community Managers', 'Marce como CM (~100k)'
    if first in ('thomy','thomas'): return 'Produccion de contenido', 'Thomy filmaker/creador'
    if first in ('cami','camila') and monto <= 90_000: return 'Produccion de contenido', 'Cami contenido (montos chicos)'
    if tiene(n, *K_PROD): return 'Produccion de contenido', ''
    if rol and norm(rol) in ROL_CAT: return ROL_CAT[norm(rol)], ''
    return 'Community Managers', '?no está en la nómina: lo mando a CM'

def cat_dif_neg(nombre):
    n = norm(nombre)
    if tiene(n, *K_CAMP): return 'Gastos campañas'
    if tiene(n, *K_SUBS): return 'Suscripciones'
    return 'Extras'

# ---------------- lectura del Excel ----------------
def bloques(ws, anio_ult):
    bs = []
    for c in range(1, ws.max_column + 1):
        v = norm(ws.cell(23, c).value).replace('setiembre','septiembre')
        if v in MESES: bs.append([c, MESES.index(v)])
    a = anio_ult
    for i in range(len(bs)-1, -1, -1):
        if i < len(bs)-1 and bs[i][1] >= bs[i+1][1]: a -= 1
        bs[i].append(a)
    return bs

def leer(wv, wf, c):
    ft = next((r for r in range(24, 400) if str(wf.cell(r, c+1).value or '').upper().startswith('=SUM(')), None)
    if not ft: raise ValueError('sin fila =SUM')
    rows = []
    for r in range(24, ft):
        ing, egr, dif = (num(wv.cell(r, c+i).value) for i in (1, 2, 3))
        ing = 0 if abs(ing) <= 1 else ing; dif = 0 if abs(dif) <= 1 else dif; egr = 0 if abs(egr) <= 1 else egr
        if ing or egr or dif:
            rows.append(dict(fila=r, nombre=str(wv.cell(r, c).value or '').strip(), ing=ing, egr=egr, dif=dif,
                             f_egr=wf.cell(r, c+2).value, f_dif=wf.cell(r, c+3).value))
    calc = None
    for r in range(ft, ft + 8):
        if 'diferido' in norm(wv.cell(r, c).value):
            calc = dict(ing=num(wv.cell(r, c+1).value), egr=num(wv.cell(r, c+2).value), res=num(wv.cell(r, c+3).value))
    meta = dict(usd=num(wv.cell(26, c+4).value), eur=num(wv.cell(24, c+4).value),
                bajas=wv.cell(25, c+6).value, nuevos=wv.cell(25, c+7).value, calc=calc)
    return rows, meta

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx'); ap.add_argument('mes'); ap.add_argument('anio', type=int)
    ap.add_argument('--anio-ultimo', type=int); ap.add_argument('--roles'); ap.add_argument('--clientes')
    ap.add_argument('--ajustes'); ap.add_argument('--json')
    a = ap.parse_args()
    roles = {norm(k): v for k, v in json.load(open(a.roles)).items()} if a.roles else {}
    clientes = json.load(open(a.clientes)) if a.clientes else []
    aj = json.load(open(a.ajustes)) if a.ajustes else {}
    wf = openpyxl.load_workbook(a.xlsx)['BALANCE']; wv = openpyxl.load_workbook(a.xlsx, data_only=True)['BALANCE']
    bs = bloques(wf, a.anio_ultimo or a.anio)
    mi = MESES.index(norm(a.mes))
    idx = next((i for i, b in enumerate(bs) if b[1] == mi and b[2] == a.anio), None)
    if idx is None: sys.exit('No encontré el mes. Últimos bloques: ' + ', '.join(f'{MESES[m]} {y}@{L(c)}' for c, m, y in bs[-6:]))
    c = bs[idx][0]; rows, meta = leer(wv, wf, c)
    usd, eur = meta['usd'] or 1, meta['eur']
    mes_ini = dt.date(a.anio, mi + 1, 1)

    def cliente(nombre):
        k = clave(nombre)
        for cl in clientes:
            if any(k == clave(x) or k in toks(x) for x in cl.get('alias', [])): return cl
        return None
    def paga(cl):
        if not cl: return 0
        return cl.get('paga_ars') or (cl.get('paga_eur') or 0) * eur

    # contratos multi-mes cobrados antes (cash + violeta en el mismo renglón)
    prev = []
    for j in range(max(0, idx - 13), idx):
        try: pr, _ = leer(wv, wf, bs[j][0])
        except ValueError: continue
        for x in pr:
            if x['ing'] > 0 and x['dif'] > 0 and 2 <= round(x['ing'] / x['dif']) <= 12:
                n = round(x['ing'] / x['dif'])
                prev.append(dict(k=clave(x['nombre']), nombre=x['nombre'], idx=j, n=n, total=x['ing'], cuota=x['ing'] / n,
                                 mes=f'{MESES[bs[j][1]]} {bs[j][2]}'))
    vig = {}
    for p in prev:  # el último pago de cada cliente manda
        if 0 < idx - p['idx'] < p['n']: vig[p['k']] = p
        elif p['k'] in vig and p['idx'] > vig[p['k']]['idx']: vig.pop(p['k'])

    er = {k: 0.0 for k in ING + COP + CFI + OTROS}; det, rev = [], []
    def put(f, nombre, tipo, monto, linea, nota=''):
        linea = aj.get('filas', {}).get(str(f), linea)
        er[linea] += monto; det.append((f, nombre, tipo, monto, linea, nota.lstrip('?')))
        if nota.startswith('?'): rev.append(f'F{f} {nombre} {monto:,.0f} → {linea}: {nota[1:]}')

    # cobros duplicados del mismo cliente
    dup = {}
    for x in rows:
        if x['ing'] > 0 and not x['dif']: dup.setdefault(clave(x['nombre']), []).append(x)
    vistos_dif = set()
    for x in rows:
        n, k = x['nombre'], clave(x['nombre'])
        if x['ing'] > 0 and x['dif'] > 0:
            nm = round(x['ing'] / x['dif']); linea = DUR.get(nm, 'RRSS Trim diferidos')
            put(x['fila'], n, 'cobro multi-mes', x['ing'] / nm, linea, f'cobró {x["ing"]:,.0f} por {nm} meses' + ('' if nm in DUR else ' ?no es 3/6/12'))
            vistos_dif.add(k)
        elif x['ing'] > 0:
            cl, nn = cliente(n), norm(n); p = paga(cl); grupo = dup.get(k, [])
            if tiene(nn, *K_ING_EXTRA):
                put(x['fila'], n, 'ingreso', x['ing'], 'Extras ingreso', 'trabajo puntual')
            elif len(grupo) > 1 and x is min(grupo, key=lambda z: z['ing']) and not any(tiene(norm(z['nombre']), *K_ING_EXTRA) for z in grupo):
                put(x['fila'], n, 'ingreso', x['ing'], 'Extras ingreso', 'segundo cobro del cliente en el mes')
            elif p and x['ing'] > p * 1.2:
                put(x['fila'], n, 'ingreso', p, 'RRSS Mens', 'abono según Notion')
                put(x['fila'], n, 'ingreso', x['ing'] - p, 'Extras ingreso', '?excedente sobre el abono de Notion → extra')
            else:
                put(x['fila'], n, 'ingreso', x['ing'], 'RRSS Mens', '' if cl or not clientes else '?no lo encontré en Clientes de Notion')
        elif x['dif'] > 0:
            v = vig.get(k)
            if v:
                put(x['fila'], n, 'cuota diferida', v['cuota'], DUR.get(v['n'], 'RRSS Trim diferidos'),
                    (f'?Excel {x["dif"]:,.0f} → uso cuota cobrada en {v["mes"]}' if abs(v['cuota'] - x['dif']) > 1000 else f'pago de {v["mes"]}'))
            else:
                cl = cliente(n); d = (cl or {}).get('duracion', 3)
                put(x['fila'], n, 'cuota diferida', x['dif'], DUR.get(d, 'RRSS Trim diferidos'), '?no encontré el cobro original en los últimos 13 meses')
            vistos_dif.add(k)
        elif x['dif'] < 0:
            put(x['fila'], n, 'gasto diferido', -x['dif'], cat_dif_neg(n), 'prepago devengado')
        if x['egr']:
            if x['dif'] < 0:
                det.append((x['fila'], n, 'egreso prepago', x['egr'], 'EXCLUIDO', 'se devenga por la columna violeta')); continue
            linea, nota = cat_egreso(n, x['egr'], x['f_egr'], roles)
            put(x['fila'], n, 'egreso', x['egr'], linea, nota)
    for k, v in vig.items():
        if k not in vistos_dif:
            put('+', v['nombre'], 'cuota faltante', v['cuota'], DUR.get(v['n'], 'RRSS Trim diferidos'),
                f'?faltaba en el Excel: pagó {v["total"]:,.0f} en {v["mes"]} por {v["n"]} meses')
    for ad in aj.get('agregar', []):
        put('+', ad['concepto'], 'ajuste manual', ad['monto'], ad['linea'])

    ib = sum(er[k] for k in ING); cop = sum(er[k] for k in COP); cfi = sum(er[k] for k in CFI)
    mo = ib - cop; ebitda = mo - cfi - er['Extras']; neta = ebitda - er['Impuestos'] - er['Fees']
    pct = lambda v: f'{v/ib*100:6.2f}%' if ib else ''
    print(f"\n=== {a.mes} {a.anio} | bloque {L(c)} | dólar Excel {meta['usd']:g} | euro {eur:g} | bajas {meta['bajas']} | nuevos {meta['nuevos']} ===\nDETALLE")
    for d in det: print(f'  F{d[0]!s:<4} {d[1][:26]:<26} {d[2]:<15} {d[3]:>12,.0f} → {d[4]:<24} {d[5]}')
    print('\nESTADO DE RESULTADOS (ARS)')
    for k in ING: print(f'  {k:<30}{er[k]:>14,.0f} {pct(er[k])}')
    print(f'  {"INGRESOS BRUTOS":<30}{ib:>14,.0f}   USD {ib/usd:,.2f}')
    for k in COP: print(f'  {k:<30}{er[k]:>14,.0f}')
    print(f'  {"Costos operativos":<30}{cop:>14,.0f}   USD {cop/usd:,.2f}')
    print(f'  {"MARGEN OPERATIVO":<30}{mo:>14,.0f} {pct(mo)}   USD {mo/usd:,.2f}')
    for k in CFI: print(f'  {k:<30}{er[k]:>14,.0f}')
    print(f'  {"COSTOS FIJOS TOTALES":<30}{cfi:>14,.0f} {pct(cfi)}   USD {cfi/usd:,.2f}')
    print(f'  {"Extras":<30}{er["Extras"]:>14,.0f}   USD {er["Extras"]/usd:,.2f}')
    print(f'  {"EBITDA":<30}{ebitda:>14,.0f} {pct(ebitda)}')
    print(f'  {"Impuestos":<30}{er["Impuestos"]:>14,.0f}\n  {"Fees":<30}{er["Fees"]:>14,.0f}')
    print(f'  {"UTILIDAD NETA":<30}{neta:>14,.0f} {pct(neta)}   USD {neta/usd:,.2f} (al dólar del Excel; en Sheets va el blue del día)')
    if meta['calc']:
        ct = meta['calc']
        print(f'\nCONTROL vs "Calculo diferido" del Excel: resultado {ct["res"]:,.0f} | ER {neta:,.0f} | diferencia {neta-ct["res"]:,.0f}')
    if rev:
        print('\nREVISAR CON THOMY'); [print('  - ' + r) for r in rev]
    if a.json:
        json.dump(dict(mes=f'{a.mes} {a.anio}', dolar=meta['usd'], euro=eur, bajas=meta['bajas'], nuevos=meta['nuevos'],
                       lineas=er, ingresos_brutos=ib, costos_operativos=cop, margen_operativo=mo, costos_fijos=cfi,
                       ebitda=ebitda, utilidad_neta=neta, control_excel=meta['calc'], revisar=rev, detalle=det),
                  open(a.json, 'w'), ensure_ascii=False, indent=1, default=str)

if __name__ == '__main__':
    main()
