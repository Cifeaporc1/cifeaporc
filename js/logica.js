// CIFEAPORC · lógica del ciclo reproductivo, avisos y comprobaciones.
// Sin dependencias: se usa en la app y en las pruebas.
(function (raiz) {
  'use strict';

  // Valores de referencia del centro (chato murciano).
  const REF = {
    ecoDesde: 19,        // días tras la IA a partir de los que se puede ecografiar
    ecoIdeal: 21,
    paridera: 99,        // entrada prevista en paridera: IA + 99
    gestacion: 114,      // parto probable: IA + 114
    lactacion: 30,
    idcMin: 4, idcMax: 6,          // intervalo destete-cubrición
    destetadosMin: 7, destetadosMax: 9,
    dosisAviso: 4, dosisCaduca: 5, // el día de extracción es el día 0
    sinEcoDias: 35,      // a partir de aquí, una IA sin ecografía se trata como posible gestación
  };

  const CAPACIDAD = { 'Vacías': 10, 'Gestación': 8, 'Implantación': 12, 'Partos': 1 };

  const FASES = [
    { id: 'vacia', nombre: 'Vacía' },
    { id: 'inseminada', nombre: 'Inseminada' },
    { id: 'gestante', nombre: 'Gestante' },
    { id: 'paridera', nombre: 'Paridera' },
    { id: 'lactante', nombre: 'Lactante' },
    { id: 'destetada', nombre: 'Destetada' },
  ];

  // ---- Fechas (siempre 'AAAA-MM-DD', sin horas para evitar desfases) ----
  function aFecha(iso) { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d); }
  function sumarDias(iso, n) { return new Date(aFecha(iso) + n * 864e5).toISOString().slice(0, 10); }
  function dias(desde, hasta) { return Math.round((aFecha(hasta) - aFecha(desde)) / 864e5); }
  function hoyISO(fecha) {
    const f = fecha || new Date();
    return new Date(f.getTime() - f.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }
  const n = (v) => (Number.isFinite(+v) ? +v : 0);

  function ordenar(eventos) {
    return eventos.slice().sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || '') < (b.creado || '') ? -1 : 1);
  }

  // ---- Estado de una cerda a partir de sus eventos en una granja ----
  function estadoCerda(eventos) {
    const ciclos = [];
    let cur = null, fase = 'vacia', ubicacion = null, ultimoDestete = null, partos = 0;

    const nuevoCiclo = (ia) => ({
      ia, ecos: [], paridera: null, parto: null, aborto: null, adopciones: [], bajas: [], destete: null,
      cierre: null, numParto: null, destetePrevio: ultimoDestete,
    });

    for (const e of ordenar(eventos)) {
      const d = e.datos || {};
      switch (e.tipo) {
        case 'ia':
          if (cur && !cur.parto && !cur.cierre) cur.cierre = 'repeticion';
          cur = nuevoCiclo(e); ciclos.push(cur); fase = 'inseminada';
          break;
        case 'eco':
          if (!cur) break;
          cur.ecos.push(e);
          if (d.resultado === 'positiva') fase = 'gestante';
          else if (d.resultado === 'negativa') { cur.cierre = 'eco_negativa'; cur = null; fase = 'vacia'; }
          break;
        case 'paridera':
          if (cur) cur.paridera = e;
          fase = 'paridera';
          break;
        case 'parto':
          if (!cur) { cur = nuevoCiclo(null); ciclos.push(cur); }
          cur.parto = e; partos += 1; cur.numParto = partos; fase = 'lactante';
          break;
        case 'aborto':
          if (cur) { cur.aborto = e; cur.cierre = 'aborto'; }
          cur = null; fase = 'vacia';
          break;
        case 'adopcion':
          if (cur) cur.adopciones.push(e);
          break;
        case 'baja_lechones':
          if (cur) cur.bajas.push(e);
          break;
        case 'destete':
          if (cur) { cur.destete = e; cur.cierre = 'destete'; }
          ultimoDestete = e; cur = null; fase = 'destetada';
          break;
        default: break;
      }
      if (d.ubicacion) ubicacion = d.ubicacion;
    }
    const actual = cur || null;
    return { fase, ciclos, actual, ultimo: ciclos[ciclos.length - 1] || null, partos, ubicacion, ultimoDestete };
  }

  // ---- Camada ----
  function camada(ciclo) {
    if (!ciclo || !ciclo.parto) return null;
    const p = ciclo.parto.datos || {};
    const vivos = n(p.vivos_h) + n(p.vivos_m) + n(p.vivos_ss); // _ss: sin sexar (histórico)
    const muertos = n(p.muertos_h) + n(p.muertos_m) + n(p.muertos_ss);
    const momias = n(p.momificados);
    let entran = 0, salen = 0;
    for (const a of ciclo.adopciones) {
      if (a.datos.sentido === 'entra') entran += n(a.datos.numero); else salen += n(a.datos.numero);
    }
    const bajas = ciclo.bajas.reduce((s, b) => s + n(b.datos.numero), 0);
    const actuales = vivos + entran - salen - bajas;
    let destetados = null, bajasCalculadas = null;
    if (ciclo.destete) {
      const dd = ciclo.destete.datos || {};
      destetados = n(dd.destetados_h) + n(dd.destetados_m) + n(dd.destetados_ss);
      bajasCalculadas = vivos + entran - salen - destetados;
    }
    return { vivos, muertos, momias, totales: vivos + muertos + momias, entran, salen, bajas, actuales, destetados, bajasCalculadas };
  }

  // ---- Fechas clave e índices de un ciclo ----
  function fechasCiclo(ciclo) {
    if (!ciclo || !ciclo.ia) return {};
    const ia = ciclo.ia.fecha;
    return {
      ia,
      ecoDesde: sumarDias(ia, REF.ecoDesde),
      ecoIdeal: sumarDias(ia, REF.ecoIdeal),
      paridera: sumarDias(ia, REF.paridera),
      parto: sumarDias(ia, REF.gestacion),
    };
  }

  function indicesCiclo(ciclo) {
    const r = {};
    if (ciclo.ia && ciclo.parto) r.gestacion = dias(ciclo.ia.fecha, ciclo.parto.fecha);
    if (ciclo.parto && ciclo.destete) r.lactacion = dias(ciclo.parto.fecha, ciclo.destete.fecha);
    if (ciclo.ia && ciclo.destetePrevio) r.idc = dias(ciclo.destetePrevio.fecha, ciclo.ia.fecha);
    return r;
  }

  // ---- Avisos del día ----
  // Devuelve [{cerdaId, crotal, titulo, detalle, fecha, nivel}] nivel: 'urgente' | 'proximo'
  function avisos(cerdas, eventosPorCerda, hoy) {
    const out = [];
    for (const c of cerdas) {
      if (c.fecha_baja) continue;
      const est = estadoCerda(eventosPorCerda[c.id] || []);
      const cur = est.actual;
      const f = fechasCiclo(cur);
      const add = (titulo, detalle, fecha, nivel) =>
        out.push({ cerdaId: c.id, crotal: c.crotal, titulo, detalle, fecha, nivel });

      // IA de hace más de 35 días sin ninguna ecografía: se trata como posible gestación
      // (avisa de paridera y parto) y se pide confirmarla.
      const sinEco = est.fase === 'inseminada' && cur && cur.ia && cur.ecos.length === 0 && dias(cur.ia.fecha, hoy) >= REF.sinEcoDias;
      if (sinEco) add('Gestación sin ecografía registrada', `Día ${dias(cur.ia.fecha, hoy)} tras la IA · registra la ecografía o la repetición`, cur.ia.fecha, 'proximo');
      if (est.fase === 'inseminada' && cur && cur.ia && !sinEco) {
        const ultimaEco = cur.ecos[cur.ecos.length - 1];
        if (ultimaEco && ultimaEco.datos.resultado === 'dudosa') {
          const toca = sumarDias(ultimaEco.fecha, 1);
          if (hoy >= toca) add('Repetir ecografía', `Dudosa el ${ultimaEco.fecha.split('-').reverse().join('/')}`, toca, 'urgente');
        } else if (hoy >= f.ecoDesde) {
          const d = dias(cur.ia.fecha, hoy);
          add('Ecografía pendiente', `Día ${d} tras la IA (recomendado día ${REF.ecoIdeal})`, f.ecoDesde, d >= REF.ecoIdeal ? 'urgente' : 'proximo');
        }
      }
      if ((est.fase === 'gestante' || sinEco) && cur && cur.ia && !cur.paridera && dias(hoy, f.parto) >= 0) {
        const faltan = dias(hoy, f.paridera);
        if (faltan <= 3) add('Entrada en paridera', faltan < 0 ? `Prevista hace ${-faltan} ${-faltan === 1 ? 'día' : 'días'} · confirmar sala y paridera` : faltan === 0 ? 'Prevista hoy · confirmar sala y paridera' : faltan === 1 ? 'Prevista mañana' : `Prevista en ${faltan} días`, f.paridera, faltan <= 0 ? 'urgente' : 'proximo');
      }
      if ((est.fase === 'gestante' || est.fase === 'paridera' || sinEco) && cur && cur.ia) {
        const faltan = dias(hoy, f.parto);
        if (faltan <= 7) add('Parto previsto', faltan < 0 ? `Previsto hace ${-faltan} ${-faltan === 1 ? 'día' : 'días'}` : faltan === 0 ? 'Previsto hoy' : faltan === 1 ? 'Previsto mañana' : `En ${faltan} días`, f.parto, faltan <= 1 ? 'urgente' : 'proximo');
      }
      if (est.fase === 'lactante' && cur && cur.parto) {
        const d = dias(cur.parto.fecha, hoy);
        if (d >= REF.lactacion - 3) {
          const fd = sumarDias(cur.parto.fecha, REF.lactacion);
          add('Destete previsto', `${d} días de lactación (referencia ${REF.lactacion})`, fd, d >= REF.lactacion ? 'urgente' : 'proximo');
        }
      }
      if (est.fase === 'destetada' && est.ultimoDestete) {
        const d = dias(est.ultimoDestete.fecha, hoy);
        if (d > REF.idcMax) add('Sin cubrir tras el destete', `${d} días (referencia ${REF.idcMin}–${REF.idcMax})`, est.ultimoDestete.fecha, 'urgente');
      }
    }
    const peso = { urgente: 0, proximo: 1 };
    return out.sort((a, b) => peso[a.nivel] - peso[b.nivel] || (a.fecha < b.fecha ? -1 : 1));
  }

  // ---- Ocupación por zona (para avisar de plazas llenas) ----
  function ocupacion(cerdas, eventosPorCerda) {
    const zonas = {};
    for (const c of cerdas) {
      if (c.fecha_baja) continue;
      const u = estadoCerda(eventosPorCerda[c.id] || []).ubicacion;
      if (!u) continue;
      (zonas[u] = zonas[u] || []).push(c);
    }
    return zonas;
  }
  function capacidadDe(ubicacion) {
    if (!ubicacion) return null;
    const zona = ubicacion.split(' · ')[0];
    return CAPACIDAD[zona] ?? null;
  }

  // ---- Comprobaciones al registrar (errores bloquean, avisos no) ----
  function comprobar(tipo, v, est, ctx) {
    const errores = [], avisosF = [];
    const hoy = ctx.hoy;
    if (!v.fecha) errores.push('Falta la fecha.');
    else if (v.fecha > sumarDias(hoy, 1)) errores.push('La fecha no puede ser futura.');
    const cur = est.actual;
    const ia = cur && cur.ia ? cur.ia.fecha : null;

    if (tipo === 'ia') {
      if (!v.verraco) errores.push('Elige el verraco.');
      if (est.fase === 'gestante' || est.fase === 'paridera' || est.fase === 'lactante')
        avisosF.push(`La cerda figura como ${FASES.find((f) => f.id === est.fase).nombre.toLowerCase()}. ¿Seguro que es una nueva inseminación?`);
      if (est.ultimoDestete && v.fecha) {
        const idc = dias(est.ultimoDestete.fecha, v.fecha);
        if (est.fase === 'destetada' && (idc < REF.idcMin || idc > REF.idcMax))
          avisosF.push(`Intervalo destete-cubrición de ${idc} días (referencia ${REF.idcMin}–${REF.idcMax}).`);
      }
    }
    if (tipo === 'eco') {
      if (!ia) errores.push('No hay una inseminación abierta para esta cerda.');
      else if (v.fecha && dias(ia, v.fecha) < REF.ecoDesde)
        avisosF.push(`Solo han pasado ${dias(ia, v.fecha)} días desde la IA; la ecografía es fiable a partir del día ${REF.ecoDesde}.`);
      if (!v.resultado) errores.push('Indica el resultado.');
    }
    if (tipo === 'paridera') {
      if (est.fase !== 'gestante') avisosF.push('La cerda no figura como gestante confirmada.');
      if (!v.sala || !v.plaza) errores.push('Indica la sala y la paridera.');
    }
    if (tipo === 'parto') {
      if (ia && v.fecha) {
        if (v.fecha < ia) errores.push('El parto no puede ser anterior a la inseminación.');
        else {
          const g = dias(ia, v.fecha);
          if (Math.abs(g - REF.gestacion) > 4) avisosF.push(`Gestación de ${g} días (referencia ${REF.gestacion}). Revisa las fechas.`);
        }
      }
      if (n(v.vivos_h) + n(v.vivos_m) + n(v.muertos_h) + n(v.muertos_m) + n(v.momificados) === 0)
        errores.push('Indica cuántos lechones han nacido.');
    }
    if (tipo === 'aborto') {
      if (!ia) errores.push('No hay una inseminación abierta para esta cerda.');
      else if (v.fecha && v.fecha < ia) errores.push('El aborto no puede ser anterior a la inseminación.');
    }
    if (tipo === 'destete' || tipo === 'adopcion' || tipo === 'baja_lechones') {
      if (!cur || !cur.parto) errores.push('No hay un parto abierto para esta cerda.');
    }
    if (tipo === 'destete' && cur && cur.parto) {
      const c = camada(cur);
      const dest = n(v.destetados_h) + n(v.destetados_m);
      if (dest > c.actuales) errores.push(`Destetas ${dest} lechones, pero la cerda tiene ${c.actuales} según los registros (vivos, adopciones y bajas).`);
      else if (dest < c.actuales) avisosF.push(`Faltan ${c.actuales - dest} lechones respecto a los registros. Anota sus bajas con fecha y causa.`);
      if (v.fecha) {
        const l = dias(cur.parto.fecha, v.fecha);
        if (Math.abs(l - REF.lactacion) > 5) avisosF.push(`Lactación de ${l} días (referencia ${REF.lactacion}).`);
      }
      if (dest && (dest < REF.destetadosMin || dest > REF.destetadosMax))
        avisosF.push(`${dest} destetados (referencia ${REF.destetadosMin}–${REF.destetadosMax} en chato murciano).`);
    }
    if (tipo === 'adopcion') {
      if (!v.sentido) errores.push('Indica si la cerda recibe o cede lechones.');
      if (!v.otra_cerda) errores.push('Elige la otra cerda.');
      if (!n(v.numero)) errores.push('Indica cuántos lechones.');
      if (v.sentido === 'sale' && cur && cur.parto && n(v.numero) > camada(cur).actuales)
        errores.push('No puede ceder más lechones de los que tiene.');
    }
    if (tipo === 'baja_lechones') {
      if (!n(v.numero)) errores.push('Indica cuántos lechones.');
      if (!v.causa) errores.push('Indica la causa.');
      if (cur && cur.parto && n(v.numero) > camada(cur).actuales) errores.push('Son más bajas que lechones tiene la cerda.');
    }
    // Ocupación de la plaza de destino
    if (ctx.destino) {
      const cap = capacidadDe(ctx.destino);
      const ocupan = (ctx.ocupacion[ctx.destino] || []).filter((c) => c.id !== ctx.cerdaId).length;
      if (cap !== null && ocupan >= cap)
        avisosF.push(cap === 1 ? `${ctx.destino} ya está ocupada.` : `${ctx.destino} ya tiene ${ocupan} cerdas (capacidad ${cap}).`);
    }
    return { errores, avisos: avisosF };
  }

  const api = { REF, CAPACIDAD, FASES, sumarDias, dias, hoyISO, ordenar, estadoCerda, camada, fechasCiclo, indicesCiclo, avisos, ocupacion, capacidadDe, comprobar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Logica = api;
})(typeof window !== 'undefined' ? window : globalThis);
