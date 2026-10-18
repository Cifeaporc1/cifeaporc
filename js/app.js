// CIFEAPORC · app (fase 1): acceso, inicio, cerdas, ficha, registro de eventos,
// verracos, cuenta y administración del profesor.
(function () {
  'use strict';
  const L = window.Logica;
  const C = window.CONFIG;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);

  // ---------------------------------------------------------------- estado
  const S = {
    sesion: null, perfil: null, granja: null, granjas: [],
    cerdas: [], verracos: [], eventos: [], porCerda: {}, cargado: null,
    perfiles: null, borrador: {}, nombres: {},
  };
  const $app = document.getElementById('app');

  // ---------------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const corta = (iso) => (iso ? `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1]}` : '—');
  const dos = (x) => String(x).padStart(2, '0');
  const fechaHora = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
  const hoy = () => L.hoyISO();
  const esProf = () => S.perfil && S.perfil.rol === 'profesor';
  const nombreGranja = (id) => (S.granjas.find((g) => g.id === id) || {}).nombre || `Granja ${id}`;
  const cerdaPorId = (id) => S.cerdas.find((c) => c.id === id);
  const verracoPorId = (id) => S.verracos.find((v) => v.id === id);
  const nombreVerraco = (d) => { const v = verracoPorId(d && d.verraco); return v ? v.crotal : (d && d.verraco_crotal) || 'no anotado'; };
  // "Juan G. (A07)" si hay nombre; si no, el alias.
  const quienEs = (userId, alias) => { const p = S.nombres[userId]; return p && p.nombre ? `${p.nombre} (${p.alias})` : (alias || (p && p.alias) || '?'); };
  const yo = () => (S.perfil.nombre ? `${S.perfil.nombre} (${S.perfil.alias})` : S.perfil.alias);
  const faseNombre = (id) => (L.FASES.find((f) => f.id === id) || {}).nombre || id;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function traducirError(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Alias, granja o PIN incorrectos.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión. Revisa la cobertura e inténtalo de nuevo.';
    if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto (o han pasado más de 24 horas desde el registro).';
    if (/nombre/i.test(m) && /column|schema cache/i.test(m)) return 'Falta ejecutar en Supabase el archivo 04_nombres_alumnos.sql.';
    if (/duplicate key/i.test(m)) return 'Ya existe un registro con ese crotal o alias.';
    if (/already registered|already been registered|User already/i.test(m)) return 'Ese alias ya existe en esa granja.';
    if (/Email not confirmed/i.test(m)) return 'La cuenta no está confirmada: en Supabase hay que desactivar "Confirm email" (ver guía).';
    if (/email rate limit/i.test(m)) return 'Supabase está intentando enviar correos de confirmación: desactiva "Confirm email" en Authentication → Sign In / Providers → Email y vuelve a probar. (' + m + ')';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar. (' + m + ')';
    if (/Signups not allowed/i.test(m)) return 'El alta de usuarios está desactivada en Supabase (ver guía de puesta en marcha).';
    if (/Password should be/i.test(m)) return 'El PIN debe tener 6 cifras.';
    return m;
  }

  const ICONOS = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-6 8 6v8H4z"/></svg>',
    cerdas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16H6zM9 9h6M9 13h6M9 17h3"/></svg>',
    verracos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6v4l3 3v11H6V10l3-3z"/></svg>',
    cuenta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    atras: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  };

  // ---------------------------------------------------------------- datos
  async function cargarPerfil() {
    const uid = S.sesion.user.id;
    const { data, error } = await sb.from('perfiles').select('*').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    S.perfil = data && data.activo ? data : null;
    if (!S.perfil) return;
    if (esProf()) {
      let g = 1;
      try { g = Number(localStorage.getItem('cife-granja')) || 1; } catch (_) { /* sin almacenamiento */ }
      S.granja = g;
    } else S.granja = S.perfil.granja_id;
  }

  async function cargarDatos() {
    const [g, c, v, e] = await Promise.all([
      sb.from('granjas').select('*').order('id'),
      sb.from('cerdas').select('*').order('crotal'),
      sb.from('verracos').select('*').order('crotal'),
      sb.from('eventos').select('*').eq('granja_id', S.granja).order('fecha').order('creado'),
    ]);
    for (const r of [g, c, v, e]) if (r.error) throw r.error;
    S.granjas = g.data; S.cerdas = c.data; S.verracos = v.data; S.eventos = e.data;
    S.porCerda = {};
    for (const ev of S.eventos) (S.porCerda[ev.cerda_id] = S.porCerda[ev.cerda_id] || []).push(ev);
    // Nombres visibles (los de la propia granja y los profesores). Si la función
    // aún no existe en Supabase, la app sigue funcionando solo con alias.
    const nv = await sb.rpc('nombres_visibles');
    S.nombres = {};
    if (!nv.error && Array.isArray(nv.data)) for (const p of nv.data) S.nombres[p.user_id] = p;
    S.cargado = new Date();
  }

  async function cargarTodo() {
    await cargarPerfil();
    if (S.perfil) await cargarDatos();
  }

  async function refrescar(mostrar) {
    try { await cargarDatos(); render(); if (mostrar) toast('Datos actualizados'); }
    catch (e) { toast(traducirError(e)); }
  }

  const estadoDe = (id) => L.estadoCerda(S.porCerda[id] || []);
  const cerdasActivas = () => S.cerdas.filter((c) => !c.fecha_baja);
  const verracosActivos = () => S.verracos.filter((v) => !v.fecha_baja);

  // ---------------------------------------------------------------- maquetación
  function cabecera(o = {}) {
    const quien = esProf()
      ? `Profesor · ${esc(yo())} · viendo ${esc(nombreGranja(S.granja))}`
      : `${esc(nombreGranja(S.granja))} · ${esc(yo())}`;
    const horas = `<div class="horas"><span>Consulta: <span id="hora-consulta">${fechaHora(new Date())}</span></span><span>Datos actualizados: ${S.cargado ? fechaHora(S.cargado) : '—'}</span></div>`;
    if (o.volver) {
      return `<header class="cab ${o.prof ? 'prof' : ''}">
        <div class="fila"><a class="volver" href="${o.volver}">${ICONOS.atras}${esc(o.textoVolver || 'Volver')}</a>
        <img class="logo" src="img/logo-mini.jpg" alt="" style="margin-left:auto"></div>
        <h1>${esc(o.titulo)}</h1>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}
        <div class="quien peq" style="margin-top:4px">${quien}</div>${horas}</header>`;
    }
    return `<header class="cab ${o.prof ? 'prof' : ''}">
      <div class="fila"><img class="logo" src="img/logo-mini.jpg" alt="">
        <div><div class="marca">CIFEAPORC</div><div class="quien">${quien}</div></div>
        <button class="refrescar" type="button" data-accion="refrescar" aria-label="Actualizar datos">Actualizar</button></div>
      ${horas}</header>`;
  }

  function navegacion(activa) {
    const items = [['inicio', 'Inicio'], ['cerdas', 'Cerdas'], ['verracos', 'Verracos']];
    if (esProf()) items.push(['admin', 'Gestión']);
    items.push(['cuenta', 'Cuenta']);
    return `<nav class="nav" aria-label="Secciones"><div class="dentro">${items.map(([id, t]) =>
      `<a href="#/${id}" class="${activa === id ? 'activo' : ''}" ${activa === id ? 'aria-current="page"' : ''}>${ICONOS[id]}${t}</a>`).join('')}</div></nav>`;
  }

  function pintar(html) { $app.className = ''; $app.innerHTML = html; window.scrollTo(0, 0); }

  // ---------------------------------------------------------------- acceso
  function vistaAcceso(modo = 'alumno', mensaje = '') {
    pintar(`<main class="acceso">
      <div class="foto logo"><img src="img/logo.jpg" alt="Logotipo CIFEAPORC, chato murciano"></div>
      <h1 style="text-align:center">Entrar en CIFEAPORC</h1>
      <div class="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected="${modo === 'alumno'}" class="${modo === 'alumno' ? 'activo' : ''}" data-modo="alumno">Alumno</button>
        <button type="button" role="tab" aria-selected="${modo === 'profesor'}" class="${modo === 'profesor' ? 'activo' : ''}" data-modo="profesor">Profesor</button>
      </div>
      ${mensaje ? `<div class="error-caja" role="alert">${esc(mensaje)}</div>` : ''}
      <form class="formu" id="f-acceso" novalidate>
        ${modo === 'alumno' ? `
          <div class="campo"><span class="et" id="et-granja">Granja</span>
            <div class="opciones" role="radiogroup" aria-labelledby="et-granja">
              <label><input type="radio" name="granja" value="1" checked> 1.º curso</label>
              <label><input type="radio" name="granja" value="2"> 2.º curso</label></div></div>
          <div class="campo"><label for="alias">Alias</label>
            <input id="alias" name="alias" type="text" autocomplete="username" autocapitalize="characters" placeholder="Ej.: A07" required></div>
          <div class="campo"><label for="pin">PIN</label>
            <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" placeholder="6 cifras" required></div>`
        : `
          <div class="campo"><label for="correo">Correo</label>
            <input id="correo" name="correo" type="email" autocomplete="username" required></div>
          <div class="campo"><label for="clave">Contraseña</label>
            <input id="clave" name="clave" type="password" autocomplete="current-password" required></div>`}
        <button class="btn" type="submit">Entrar</button>
      </form>
      <p class="suave" style="text-align:center">Si has olvidado el PIN, pide uno nuevo a tu profesor.</p>
    </main>`);
    $app.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => vistaAcceso(b.dataset.modo)));
    document.getElementById('f-acceso').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const boton = ev.target.querySelector('button[type=submit]');
      boton.disabled = true; boton.textContent = 'Entrando…';
      let email, password;
      if (modo === 'alumno') {
        const alias = String(f.get('alias') || '').trim().toUpperCase();
        email = `${alias.toLowerCase()}.g${f.get('granja')}@${C.dominioAlumnos}`;
        password = String(f.get('pin') || '').trim();
        if (!alias || !/^\d{6}$/.test(password)) { vistaAcceso(modo, 'Escribe tu alias y un PIN de 6 cifras.'); return; }
      } else {
        email = String(f.get('correo') || '').trim(); password = String(f.get('clave') || '');
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { vistaAcceso(modo, traducirError(error)); return; }
      S.sesion = data.session;
      try { await cargarTodo(); } catch (e) { vistaAcceso(modo, traducirError(e)); return; }
      location.hash = '#/inicio'; render();
    });
  }

  function vistaSinPerfil() {
    pintar(`<main class="acceso">
      <div class="foto logo"><img src="img/logo.jpg" alt="CIFEAPORC"></div>
      <div class="aviso-caja"><strong>Tu cuenta no tiene acceso.</strong><br>Puede que esté desactivada o que aún no tenga un perfil. Habla con tu profesor.</div>
      <button class="btn sec" type="button" data-accion="salir">Salir</button></main>`);
  }

  // ---------------------------------------------------------------- inicio
  function vistaInicio() {
    const h = hoy();
    const d = new Date();
    const lista = L.avisos(cerdasActivas(), S.porCerda, h);
    const recuento = {};
    for (const c of cerdasActivas()) { const f = estadoDe(c.id).fase; recuento[f] = (recuento[f] || 0) + 1; }
    const tarjetas = lista.map((a) => `
      <a class="tarjeta enlace" href="#/cerda/${a.cerdaId}">
        <div class="entre"><strong>${esc(a.titulo)}</strong><span class="chip ${a.nivel === 'urgente' ? 'nar' : ''}">${a.nivel === 'urgente' ? 'Hoy' : corta(a.fecha)}</span></div>
        <div class="suave">${esc(a.crotal)} · ${esc(a.detalle)}</div></a>`).join('');
    pintar(`${cabecera()}
      <main class="cuerpo">
        <div class="foto logo"><img src="img/logo.jpg" alt="Logotipo CIFEAPORC, chato murciano"></div>
        <div class="entre"><h1 style="font-size:22px">Hoy, ${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}</h1>
          <span class="suave">${lista.length} ${lista.length === 1 ? 'aviso' : 'avisos'}</span></div>
        ${tarjetas || '<div class="vacio">No hay avisos para hoy.</div>'}
        <div class="tarjeta"><h2>Cerdas por fase</h2>
          <div class="opciones">${L.FASES.map((f) => `<span class="chip ${recuento[f.id] ? '' : 'gris'}">${f.nombre}: ${recuento[f.id] || 0}</span>`).join('')}</div>
          ${S.cerdas.length === 0 ? `<div class="suave">Aún no hay cerdas en el censo.${esProf() ? ' Dalas de alta en Gestión.' : ''}</div>` : ''}</div>
        <a class="btn" href="#/cerdas">${ICONOS.mas}Registrar evento</a>
      </main>${navegacion('inicio')}`);
  }

  // ---------------------------------------------------------------- cerdas
  function vistaCerdas() {
    const filtro = S.borrador.filtro || '';
    const lista = cerdasActivas().filter((c) => !filtro ||
      [c.crotal, ...(c.otros_crotales || [])].some((x) => String(x).toLowerCase().includes(filtro.toLowerCase())));
    pintar(`${cabecera()}
      <main class="cuerpo">
        <div class="entre"><h1 style="font-size:22px">Cerdas</h1><span class="suave">${cerdasActivas().length} en el censo</span></div>
        <div class="campo"><input id="buscar" type="text" inputmode="search" aria-label="Buscar por crotal" placeholder="Buscar por crotal…" value="${esc(filtro)}"></div>
        <div class="lista">${lista.map((c) => {
          const e = estadoDe(c.id);
          return `<a class="cerda-fila" href="#/cerda/${c.id}"><div><strong>${esc(c.crotal)}</strong>
            <div class="suave">${esc(e.ubicacion || 'Sin ubicación')} · ${e.partos} ${e.partos === 1 ? 'parto' : 'partos'}</div></div>
            <span class="chip ${['inseminada', 'paridera'].includes(e.fase) ? 'nar' : ''}">${faseNombre(e.fase)}</span></a>`;
        }).join('') || '<div class="vacio">No hay cerdas que coincidan.</div>'}</div>
      </main>${navegacion('cerdas')}`);
    const b = document.getElementById('buscar');
    b.addEventListener('input', () => {
      S.borrador.filtro = b.value; const pos = b.selectionStart; vistaCerdas();
      const nb = document.getElementById('buscar'); nb.focus(); nb.setSelectionRange(pos, pos);
    });
  }

  // ---------------------------------------------------------------- ficha
  const ACCIONES = {
    vacia: ['ia', 'traslado', 'nota'],
    destetada: ['ia', 'traslado', 'nota'],
    inseminada: ['eco', 'ia', 'aborto', 'traslado', 'nota'],
    gestante: ['paridera', 'eco', 'parto', 'aborto', 'traslado', 'nota'],
    paridera: ['parto', 'aborto', 'traslado', 'nota'],
    lactante: ['destete', 'adopcion', 'baja_lechones', 'nota'],
  };

  function puedeEditar(e) {
    if (esProf()) return true;
    return e.autor === S.sesion.user.id && (Date.now() - new Date(e.creado).getTime()) < 864e5;
  }

  function resumenEvento(e) {
    const d = e.datos || {};
    const T = TIPOS[e.tipo];
    switch (e.tipo) {
      case 'ia': return `Verraco ${esc(nombreVerraco(d))}`;
      case 'eco': return `Resultado: ${esc(d.resultado)}`;
      case 'paridera': return `Sala ${esc(d.sala)} · paridera ${esc(d.plaza)}`;
      case 'parto': { const ss = d.vivos_ss !== undefined; return `Vivos ${(+d.vivos_h || 0) + (+d.vivos_m || 0) + (+d.vivos_ss || 0)}${ss ? '' : ` (${+d.vivos_h || 0} H, ${+d.vivos_m || 0} M)`} · muertos ${(+d.muertos_h || 0) + (+d.muertos_m || 0) + (+d.muertos_ss || 0)}${ss ? '' : ` · momias ${+d.momificados || 0}`}`; }
      case 'adopcion': return `${d.sentido === 'entra' ? 'Recibe' : 'Cede'} ${esc(d.numero)} lechones ${d.sentido === 'entra' ? 'de' : 'a'} ${esc(d.otra_crotal || '?')}`;
      case 'baja_lechones': return `${esc(d.numero)} lechones · ${esc(d.causa)}`;
      case 'destete': return d.destetados_ss !== undefined ? `Destetados ${+d.destetados_ss || 0}` : `Destetados ${(+d.destetados_h || 0) + (+d.destetados_m || 0)} (${+d.destetados_h || 0} H, ${+d.destetados_m || 0} M) · lechonera ${esc(d.lechonera)}`;
      case 'traslado': return esc(d.ubicacion || '');
      case 'aborto': return 'Fin de la gestación sin parto';
      case 'nota': return esc(d.texto || '');
      default: return T ? T.nombre : e.tipo;
    }
  }

  function vistaFicha(id) {
    const c = cerdaPorId(id);
    if (!c) return vistaNoEncontrado();
    const est = estadoDe(id);
    const cur = est.actual;
    const f = L.fechasCiclo(cur);
    const h = hoy();
    const idx = L.FASES.findIndex((x) => x.id === est.fase);

    let fechas = '';
    const sinEco = est.fase === 'inseminada' && f.ia && cur.ecos.length === 0 && L.dias(f.ia, h) >= L.REF.sinEcoDias;
    if (sinEco) fechas = `<div class="aviso-caja"><strong>Sin ecografía registrada</strong> · día ${L.dias(f.ia, h)} tras la IA. Registra la ecografía o, si ha repetido, una nueva inseminación.</div>` + datoPar('Entrada en paridera', corta(f.paridera), 'IA + 99 días', true, 'Parto probable', corta(f.parto), 'IA + 114 días');
    else if (est.fase === 'inseminada' && f.ia) fechas = datoPar('Ecografía', corta(f.ecoIdeal), `Desde el día 19 (${corta(f.ecoDesde)})`, true, 'Parto probable', corta(f.parto), 'IA + 114 días');
    else if (est.fase === 'gestante' && f.ia) fechas = datoPar('Entrada en paridera', corta(f.paridera), 'IA + 99 días', true, 'Parto probable', corta(f.parto), 'IA + 114 días');
    else if (est.fase === 'paridera' && f.ia) fechas = datoPar('Parto probable', corta(f.parto), (() => { const x = L.dias(h, f.parto); return x > 1 ? `Faltan ${x} días` : x === 1 ? 'Mañana' : x === 0 ? 'Hoy' : `Pasado ${-x} ${x === -1 ? 'día' : 'días'}`; })(), true, 'Ubicación', esc(est.ubicacion || '—').replace('Partos · ', ''), '');
    else if (est.fase === 'lactante' && cur && cur.parto) {
      const cm = L.camada(cur);
      fechas = datoPar('Destete previsto', corta(L.sumarDias(cur.parto.fecha, L.REF.lactacion)), `${L.dias(cur.parto.fecha, h)} días de lactación`, true, 'Lechones ahora', String(cm.actuales), `${cm.vivos} vivos${cm.entran ? ` +${cm.entran}` : ''}${cm.salen ? ` −${cm.salen}` : ''}${cm.bajas ? ` −${cm.bajas} bajas` : ''}`);
    } else if (est.fase === 'destetada' && est.ultimoDestete) {
      const dd = L.dias(est.ultimoDestete.fecha, h);
      fechas = `<div class="${dd > L.REF.idcMax ? 'aviso-caja' : 'ok-caja'}">Destetada hace ${dd} días · cubrición de referencia a los ${L.REF.idcMin}–${L.REF.idcMax} días.</div>`;
    } else fechas = '<div class="vacio">Pendiente de detectar celo.</div>';

    const acciones = (ACCIONES[est.fase] || ACCIONES.vacia);
    const [principal, ...resto] = acciones;

    const eventos = (S.porCerda[id] || []).slice().reverse();
    const tarjetaEvento = (e) => `
      <div class="evento"><div class="entre"><strong>${esc(TIPOS[e.tipo] ? TIPOS[e.tipo].nombre : e.tipo)}</strong><span class="suave">${fmt(e.fecha)}</span></div>
        <div>${resumenEvento(e)}</div>
        ${e.datos && e.datos.obs ? `<div class="suave">${esc(e.datos.obs)}</div>` : ''}
        <div class="suave peq">${e.datos && e.datos.origen === 'historico' ? 'Importado de las fichas anteriores' : `Por ${esc(quienEs(e.autor, e.autor_alias))}`}${e.modificado ? ` · corregido por ${esc(e.modificado_por || '?')}` : ''}</div>
        ${puedeEditar(e) ? `<div class="acciones">${e.tipo !== 'adopcion' ? `<a class="btn sec peq" href="#/registrar/${id}/${e.tipo}/${e.id}">Corregir</a>` : ''}
          <button class="btn peligro peq" type="button" data-borrar="${e.id}">Borrar</button></div>` : ''}
      </div>`;
    const historial = eventos.slice(0, 8).map(tarjetaEvento).join('') + (eventos.length > 8
      ? `<details><summary class="suave" style="min-height:44px;display:flex;align-items:center">Ver ${eventos.length - 8} registros anteriores</summary>${eventos.slice(8).map(tarjetaEvento).join('')}</details>` : '');

    const conParto = est.ciclos.filter((x) => x.parto).reverse();
    const partos = conParto.map((x) => {
      const cm = L.camada(x); const ix = L.indicesCiclo(x);
      const dest = cm.destetados;
      return `<tr><td><strong>${x.numParto}.º</strong></td><td>${x.parto.fecha.slice(8)}/${x.parto.fecha.slice(5, 7)}/${x.parto.fecha.slice(2, 4)}</td><td>${cm.vivos} / ${cm.muertos} / ${cm.momias}</td>
        <td>${dest === null ? '—' : `<span class="chip ${dest < L.REF.destetadosMin || dest > L.REF.destetadosMax ? 'nar' : ''}">${dest}</span>`}</td>
        <td>${ix.gestacion ?? '—'}</td><td>${ix.lactacion ?? '—'}</td></tr>`;
    }).join('');
    const repeticiones = est.ciclos.filter((x) => x.cierre === 'repeticion' || x.cierre === 'eco_negativa').length;
    const abortos = est.ciclos.filter((x) => x.cierre === 'aborto').length;

    pintar(`${cabecera({ volver: '#/cerdas', textoVolver: 'Cerdas', titulo: c.crotal, sub: `${esc(c.raza)} · ${est.partos} ${est.partos === 1 ? 'parto' : 'partos'} · <strong>${faseNombre(est.fase)}${est.ubicacion ? ` · ${esc(est.ubicacion)}` : ''}</strong>` })}
      <main class="cuerpo">
        <div class="foto"><img src="img/hembra.jpg" alt="Cerda chata murciana"></div>
        <section class="tarjeta" aria-label="Fase del ciclo"><div class="suave peq" style="font-weight:700">FASE DEL CICLO</div>
          <div class="ciclo">${L.FASES.map((x, i) => `<div class="${i < idx ? 'hecho' : i === idx ? 'ahora' : ''}"><i></i>${x.nombre.replace('Inseminada', 'Insemi\u00ADnada')}</div>`).join('')}</div></section>
        ${fechas}
        <a class="btn" href="#/registrar/${id}/${principal}">${ICONOS.mas}${esc(TIPOS[principal].nombre)}</a>
        <div class="botones">${resto.map((t) => `<a class="btn sec peq" href="#/registrar/${id}/${t}">${esc(TIPOS[t].nombre)}</a>`).join('')}</div>
        ${cur && cur.ia ? `<section class="tarjeta"><h2>Ciclo actual</h2><div class="filas">
          <div><span>Inseminación</span><span>${fmt(cur.ia.fecha)} · ${esc(nombreVerraco(cur.ia.datos))}</span></div>
          ${cur.ecos.map((e) => `<div><span>Ecografía</span><span>${fmt(e.fecha)} · ${esc(e.datos.resultado)}</span></div>`).join('')}
          ${cur.paridera ? `<div><span>Entrada en paridera</span><span>${fmt(cur.paridera.fecha)}</span></div>` : ''}
          ${cur.parto ? `<div><span>Parto</span><span>${fmt(cur.parto.fecha)}</span></div>` : ''}</div></section>` : ''}
        <section class="tarjeta"><h2>Partos</h2>
          ${partos ? `<table class="tabla"><thead><tr><th>N.º</th><th>Fecha</th><th>Vivos / muertos / momias</th><th>Destet.</th><th>Gest.</th><th>Lact.</th></tr></thead><tbody>${partos}</tbody></table>
            <div class="suave peq">Referencia: ${L.REF.destetadosMin}–${L.REF.destetadosMax} destetados por camada · gestación ${L.REF.gestacion} d · lactación ${L.REF.lactacion} d${repeticiones ? ` · ${repeticiones} ${repeticiones === 1 ? 'repetición' : 'repeticiones'}` : ''}${abortos ? ` · ${abortos} ${abortos === 1 ? 'aborto' : 'abortos'}` : ''}</div>`
            : '<div class="suave">Sin partos registrados en esta granja.</div>'}</section>
        <section class="tarjeta"><h2>Historial</h2>${historial || '<div class="suave">Sin eventos registrados.</div>'}</section>
        <section class="tarjeta"><h2>Datos fijos</h2><div class="filas">
          <div><span>Crotales</span><span>${esc([c.crotal, ...(c.otros_crotales || [])].join(' · '))}</span></div>
          <div><span>Raza</span><span>${esc(c.raza)}</span></div>
          <div><span>Nacimiento</span><span>${fmt(c.fecha_nacimiento)}</span></div>
          <div><span>Entrada en granja</span><span>${fmt(c.fecha_entrada)}</span></div>
          ${c.origen ? `<div><span>Procedencia</span><span>${esc(c.origen)}</span></div>` : ''}</div></section>
      </main>${navegacion('cerdas')}`);

    $app.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => confirmarBorrado(b, id)));
  }

  function datoPar(et1, v1, n1, nar, et2, v2, n2) {
    return `<div class="dos"><div class="dato ${nar ? 'nar' : ''}"><span class="et">${et1}</span><span class="val">${v1}</span><span class="nota">${n1}</span></div>
      <div class="dato"><span class="et">${et2}</span><span class="val">${v2}</span><span class="nota">${n2}</span></div></div>`;
  }

  function confirmarBorrado(boton, cerdaId) {
    if (boton.dataset.confirmar !== '1') {
      boton.dataset.confirmar = '1'; boton.textContent = '¿Seguro? Pulsa otra vez'; return;
    }
    const e = S.eventos.find((x) => x.id === boton.dataset.borrar);
    boton.disabled = true;
    (async () => {
      let q = sb.from('eventos').delete();
      q = e && e.tipo === 'adopcion' && e.datos.vinculo ? q.eq('granja_id', S.granja).eq('datos->>vinculo', e.datos.vinculo) : q.eq('id', boton.dataset.borrar);
      const { error } = await q;
      if (error) { toast(traducirError(error)); boton.disabled = false; return; }
      toast('Registro borrado');
      await refrescar(); location.hash = `#/cerda/${cerdaId}`;
    })();
  }

  // ---------------------------------------------------------------- formularios de eventos
  const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
  const F = {
    fecha: { n: 'fecha', t: 'date', l: 'Fecha' },
    obs: { n: 'obs', t: 'textarea', l: 'Observaciones', opcional: true },
  };
  const TIPOS = {
    ia: {
      nombre: 'Inseminación',
      ayuda: 'Fecha de la 1.ª inseminación (la de detección del celo). La 2.ª dosis se da por hecha al día siguiente con el mismo verraco.',
      campos: [F.fecha, { n: 'verraco', t: 'verraco', l: 'Verraco' }, F.obs],
      ubicacion: () => 'Implantación',
    },
    eco: {
      nombre: 'Ecografía',
      ayuda: 'A partir del día 19 tras la IA; mejor el día 21. Si es dudosa, se repite al día siguiente.',
      campos: [F.fecha,
        { n: 'resultado', t: 'radio', l: 'Resultado', op: [['positiva', 'Positiva +'], ['negativa', 'Negativa −'], ['dudosa', 'Dudosa ?']] },
        { n: 'parque', t: 'select', l: 'Pasa al parque de gestación', op: rango(1, 4), si: (v) => v.resultado === 'positiva' },
        { n: 'parque_v', t: 'select', l: 'Vuelve al parque de vacías', op: rango(1, 2), si: (v) => v.resultado === 'negativa' },
        F.obs],
      ubicacion: (v) => (v.resultado === 'positiva' ? `Gestación · parque ${v.parque}` : v.resultado === 'negativa' ? `Vacías · parque ${v.parque_v}` : null),
    },
    paridera: {
      nombre: 'Entrada en paridera',
      ayuda: 'Prevista a los 99 días de la IA. Indica la sala y la paridera reales.',
      campos: [F.fecha, { n: 'sala', t: 'select', l: 'Sala de partos', op: rango(1, 3) }, { n: 'plaza', t: 'select', l: 'Paridera', op: rango(1, 6) }, F.obs],
      ubicacion: (v) => `Partos · sala ${v.sala} · paridera ${v.plaza}`,
    },
    parto: {
      nombre: 'Parto',
      campos: [F.fecha,
        { grupo: 'Nacidos vivos', campos: [{ n: 'vivos_h', t: 'contador', l: 'Hembras' }, { n: 'vivos_m', t: 'contador', l: 'Machos' }] },
        { grupo: 'Nacidos muertos', campos: [{ n: 'muertos_h', t: 'contador', l: 'Hembras' }, { n: 'muertos_m', t: 'contador', l: 'Machos' }, { n: 'momificados', t: 'contador', l: 'Momificados' }] },
        F.obs],
      ubicacion: () => null,
    },
    adopcion: {
      nombre: 'Adopción',
      ayuda: 'Se anota a la vez en las dos cerdas.',
      campos: [F.fecha,
        { n: 'sentido', t: 'radio', l: 'Esta cerda…', op: [['entra', 'Recibe lechones'], ['sale', 'Cede lechones']] },
        { n: 'numero', t: 'contador', l: 'Número de lechones' },
        { n: 'otra_cerda', t: 'lactante', l: 'Otra cerda' }, F.obs],
      ubicacion: () => null,
    },
    baja_lechones: {
      nombre: 'Baja de lechones',
      campos: [F.fecha, { n: 'numero', t: 'contador', l: 'Número de lechones' }, { n: 'causa', t: 'text', l: 'Causa' }, F.obs],
      ubicacion: () => null,
    },
    destete: {
      nombre: 'Destete',
      ayuda: 'Referencia: 30 días de lactación y 7–9 destetados por camada.',
      campos: [F.fecha,
        { grupo: 'Lechones destetados', campos: [{ n: 'destetados_h', t: 'contador', l: 'Hembras' }, { n: 'destetados_m', t: 'contador', l: 'Machos' }] },
        { n: 'lechonera', t: 'select', l: 'Los lechones van a la lechonera', op: rango(1, 4) },
        { n: 'parque_v', t: 'select', l: 'La madre pasa al parque de vacías', op: rango(1, 2) },
        F.obs],
      ubicacion: (v) => `Vacías · parque ${v.parque_v}`,
    },
    traslado: {
      nombre: 'Traslado',
      campos: [F.fecha,
        { n: 'zona', t: 'select', l: 'Zona', op: [['Vacías', 'Parque de vacías'], ['Implantación', 'Sala de implantación'], ['Gestación', 'Parque de gestación']] },
        { n: 'parque', t: 'select', l: 'Parque', op: rango(1, 2), si: (v) => v.zona === 'Vacías' },
        { n: 'parque_g', t: 'select', l: 'Parque', op: rango(1, 4), si: (v) => v.zona === 'Gestación' },
        F.obs],
      ubicacion: (v) => (v.zona === 'Vacías' ? `Vacías · parque ${v.parque}` : v.zona === 'Gestación' ? `Gestación · parque ${v.parque_g}` : 'Implantación'),
    },
    aborto: {
      nombre: 'Aborto',
      ayuda: 'Cierra la gestación sin parto. La cerda vuelve a vacías hasta detectar celo.',
      campos: [F.fecha, { n: 'parque_v', t: 'select', l: 'Pasa al parque de vacías', op: rango(1, 2) }, F.obs],
      ubicacion: (v) => `Vacías · parque ${v.parque_v}`,
    },
    nota: { nombre: 'Nota', campos: [F.fecha, { n: 'texto', t: 'textarea', l: 'Nota' }], ubicacion: () => null },
  };

  function valoresIniciales(tipo, evento) {
    const v = { fecha: hoy() };
    const recorrer = (cs) => cs.forEach((c) => {
      if (c.grupo) return recorrer(c.campos);
      if (c.t === 'contador') v[c.n] = '0';
      else if (c.t === 'select') v[c.n] = Array.isArray(c.op[0]) ? c.op[0][0] : c.op[0];
      else if (c.t === 'radio') v[c.n] = c.defecto ?? '';
      else if (c.t !== 'date') v[c.n] = '';
    });
    recorrer(TIPOS[tipo].campos);
    if (evento) { Object.assign(v, evento.datos || {}); v.fecha = evento.fecha; }
    return v;
  }

  function campoHTML(c, v, cerdaId) {
    if (c.grupo) return `<fieldset><legend>${esc(c.grupo)}</legend>${c.campos.map((x) => campoHTML(x, v, cerdaId)).join('')}</fieldset>`;
    if (c.si && !c.si(v)) return '';
    const id = `c-${c.n}`;
    const val = v[c.n] ?? '';
    switch (c.t) {
      case 'date': return `<div class="campo"><label for="${id}">${c.l}</label><input id="${id}" name="${c.n}" type="date" value="${esc(val)}" max="${L.sumarDias(hoy(), 1)}" required></div>`;
      case 'text': return `<div class="campo"><label for="${id}">${c.l}</label><input id="${id}" name="${c.n}" type="text" value="${esc(val)}"></div>`;
      case 'textarea': return `<div class="campo"><label for="${id}">${c.l}${c.opcional ? ' <span class="suave">(opcional)</span>' : ''}</label><textarea id="${id}" name="${c.n}">${esc(val)}</textarea></div>`;
      case 'select': return `<div class="campo"><label for="${id}">${c.l}</label><select id="${id}" name="${c.n}">${c.op.map((o) => {
        const [k, t] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(k)}" ${String(val) === String(k) ? 'selected' : ''}>${esc(t)}</option>`;
      }).join('')}</select></div>`;
      case 'radio': return `<div class="campo"><span class="et" id="et-${id}">${c.l}</span><div class="opciones" role="radiogroup" aria-labelledby="et-${id}">${c.op.map(([k, t]) =>
        `<label><input type="radio" name="${c.n}" value="${esc(k)}" ${val === k ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div></div>`;
      case 'contador': return `<div class="contador"><label for="${id}">${c.l}</label><div class="ctl">
        <button type="button" data-paso="-1" data-campo="${c.n}" aria-label="Restar ${esc(c.l)}">−</button>
        <input id="${id}" name="${c.n}" type="number" inputmode="numeric" min="0" step="1" value="${esc(val)}">
        <button type="button" data-paso="1" data-campo="${c.n}" aria-label="Sumar ${esc(c.l)}">+</button></div></div>`;
      case 'verraco': {
        const vs = verracosActivos();
        if (!vs.length) return '<div class="aviso-caja">No hay verracos en el censo. El profesor debe darlos de alta en Gestión.</div>';
        return `<div class="campo"><label for="${id}">${c.l}</label><select id="${id}" name="${c.n}"><option value="">Elige…</option>${vs.map((x) =>
          `<option value="${x.id}" ${val === x.id ? 'selected' : ''}>${esc(x.crotal)}${x.verraquera ? ` · verraquera ${x.verraquera}` : ''}</option>`).join('')}</select></div>`;
      }
      case 'lactante': {
        const otras = cerdasActivas().filter((x) => x.id !== cerdaId && estadoDe(x.id).fase === 'lactante');
        if (!otras.length) return '<div class="aviso-caja">No hay otra cerda lactante con la que hacer la adopción.</div>';
        return `<div class="campo"><label for="${id}">${c.l}</label><select id="${id}" name="${c.n}"><option value="">Elige…</option>${otras.map((x) =>
          `<option value="${x.id}" ${val === x.id ? 'selected' : ''}>${esc(x.crotal)} · ${L.camada(estadoDe(x.id).actual).actuales} lechones</option>`).join('')}</select></div>`;
      }
      default: return '';
    }
  }

  function leerFormulario(form, v) {
    const fd = new FormData(form);
    for (const [k, val] of fd.entries()) v[k] = typeof val === 'string' ? val.trim() : val;
    return v;
  }

  function vistaRegistrar(cerdaId, tipo, eventoId) {
    const c = cerdaPorId(cerdaId);
    const T = TIPOS[tipo];
    if (!c || !T) return vistaNoEncontrado();
    const evento = eventoId ? S.eventos.find((e) => e.id === eventoId) : null;
    if (eventoId && (!evento || !puedeEditar(evento) || tipo === 'adopcion')) return vistaNoEncontrado('No puedes corregir este registro.');
    const clave = `${cerdaId}/${tipo}/${eventoId || ''}`;
    if (S.borrador.clave !== clave) S.borrador = { clave, v: valoresIniciales(tipo, evento), confirmado: false, filtro: S.borrador.filtro };
    const v = S.borrador.v;
    const foto = tipo === 'parto' || tipo === 'destete' || tipo === 'adopcion' || tipo === 'baja_lechones' ? 'madre' : tipo === 'ia' ? 'verraco' : 'hembra';

    pintar(`${cabecera({ volver: `#/cerda/${cerdaId}`, textoVolver: 'Cancelar', titulo: `${eventoId ? 'Corregir' : 'Registrar'}: ${T.nombre.toLowerCase()}`, sub: `${esc(c.crotal)} · ${faseNombre(estadoDe(cerdaId).fase)}` })}
      <main class="cuerpo">
        <div class="foto"><img src="img/${foto}.jpg" alt=""></div>
        ${T.ayuda ? `<div class="suave">${esc(T.ayuda)}</div>` : ''}
        <form class="formu" id="f-evento" novalidate>
          ${T.campos.map((x) => campoHTML(x, v, cerdaId)).join('')}
          <div id="resumen"></div>
          <div id="mensajes" aria-live="polite"></div>
          <div class="suave peq">${eventoId ? `Registrado por ${esc(quienEs(evento.autor, evento.autor_alias))}` : `Lo registras como ${esc(yo())}`}${esProf() ? '' : ' · podrás corregirlo durante 24 horas'}</div>
          <button class="btn" type="submit">${eventoId ? 'Guardar corrección' : 'Guardar'}</button>
        </form>
      </main>`);

    const form = document.getElementById('f-evento');
    const pintarResumen = () => {
      const r = document.getElementById('resumen');
      if (tipo === 'parto') {
        const viv = (+v.vivos_h || 0) + (+v.vivos_m || 0);
        const tot = viv + (+v.muertos_h || 0) + (+v.muertos_m || 0) + (+v.momificados || 0);
        r.innerHTML = `<div class="ok-caja entre"><span>Total nacidos</span><strong>${tot} · ${viv} vivos</strong></div>`;
      } else if (tipo === 'destete') {
        const cm = L.camada(estadoDe(cerdaId).actual);
        const d = (+v.destetados_h || 0) + (+v.destetados_m || 0);
        if (cm) r.innerHTML = `<div class="ok-caja entre"><span>Destetados / lechones según registros</span><strong>${d} / ${cm.actuales}</strong></div>`;
      }
    };
    pintarResumen();
    form.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-paso]'); if (!b) return;
      const inp = form.querySelector(`[name="${b.dataset.campo}"]`);
      inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.dataset.paso));
      leerFormulario(form, v); S.borrador.confirmado = false; pintarResumen();
    });
    form.addEventListener('input', () => { leerFormulario(form, v); S.borrador.confirmado = false; pintarResumen(); });
    form.addEventListener('change', (ev) => {
      leerFormulario(form, v); S.borrador.confirmado = false;
      if (ev.target.type === 'radio' || ev.target.name === 'zona') vistaRegistrar(cerdaId, tipo, eventoId);
    });
    form.addEventListener('submit', (ev) => { ev.preventDefault(); leerFormulario(form, v); guardarEvento(c, tipo, evento); });
  }

  async function guardarEvento(c, tipo, evento) {
    const T = TIPOS[tipo];
    const v = S.borrador.v;
    const propios = (S.porCerda[c.id] || []).filter((e) => !evento || e.id !== evento.id);
    const est = L.estadoCerda(propios);
    const destino = T.ubicacion(v);
    const porCerdaSin = Object.assign({}, S.porCerda, { [c.id]: propios });
    const comp = L.comprobar(tipo, v, est, { hoy: hoy(), destino, ocupacion: L.ocupacion(cerdasActivas(), porCerdaSin), cerdaId: c.id });
    const msj = document.getElementById('mensajes');
    if (comp.errores.length) {
      msj.innerHTML = `<div class="error-caja" role="alert"><strong>Revisa:</strong><br>${comp.errores.map(esc).join('<br>')}</div>`;
      return;
    }
    if (comp.avisos.length && !S.borrador.confirmado) {
      S.borrador.confirmado = true;
      msj.innerHTML = `<div class="aviso-caja" role="alert"><strong>Comprueba antes de guardar:</strong><br>${comp.avisos.map(esc).join('<br>')}<br><br>Si es correcto, pulsa otra vez <strong>Guardar</strong>.</div>`;
      return;
    }

    // Solo se guardan los campos visibles del formulario.
    const datos = {};
    const recorrer = (cs) => cs.forEach((x) => { if (x.grupo) return recorrer(x.campos); if (x.n !== 'fecha' && (!x.si || x.si(v))) datos[x.n] = x.t === 'contador' ? Math.max(0, parseInt(v[x.n], 10) || 0) : v[x.n]; });
    recorrer(T.campos);
    if (destino) datos.ubicacion = destino;

    const boton = document.querySelector('#f-evento button[type=submit]');
    boton.disabled = true; boton.textContent = 'Guardando…';
    let error;
    if (evento) {
      ({ error } = await sb.from('eventos').update({ fecha: v.fecha, datos }).eq('id', evento.id));
    } else if (tipo === 'adopcion') {
      const otra = cerdaPorId(v.otra_cerda);
      const vinculo = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
      datos.vinculo = vinculo; datos.otra_crotal = otra.crotal;
      const espejo = { ...datos, sentido: datos.sentido === 'entra' ? 'sale' : 'entra', otra_cerda: c.id, otra_crotal: c.crotal };
      ({ error } = await sb.from('eventos').insert([
        { granja_id: S.granja, cerda_id: c.id, tipo, fecha: v.fecha, datos },
        { granja_id: S.granja, cerda_id: otra.id, tipo, fecha: v.fecha, datos: espejo },
      ]));
    } else {
      ({ error } = await sb.from('eventos').insert({ granja_id: S.granja, cerda_id: c.id, tipo, fecha: v.fecha, datos }));
    }
    if (error) { boton.disabled = false; boton.textContent = 'Guardar'; msj.innerHTML = `<div class="error-caja" role="alert">${esc(traducirError(error))}</div>`; return; }
    S.borrador = { filtro: S.borrador.filtro };
    toast(evento ? 'Corrección guardada' : `Guardado: ${T.nombre.toLowerCase()}`);
    await refrescar();
    location.hash = `#/cerda/${c.id}`;
  }

  // ---------------------------------------------------------------- verracos
  function vistaVerracos() {
    const stats = {};
    for (const c of S.cerdas) {
      for (const ci of estadoDe(c.id).ciclos) {
        if (!ci.ia) continue;
        const id = ci.ia.datos.verraco; const s = (stats[id] = stats[id] || { ia: 0, ecos: 0, pos: 0, partos: 0, vivos: 0 });
        s.ia += 1;
        const ultima = ci.ecos.filter((e) => e.datos.resultado !== 'dudosa').pop();
        if (ultima) { s.ecos += 1; if (ultima.datos.resultado === 'positiva') s.pos += 1; }
        if (ci.parto) { s.partos += 1; s.vivos += L.camada(ci).vivos; }
      }
    }
    pintar(`${cabecera()}
      <main class="cuerpo">
        <div class="foto"><img src="img/verraco.jpg" alt="Verraco chato murciano"></div>
        <div class="entre"><h1 style="font-size:22px">Verracos</h1><span class="suave">${verracosActivos().length} en el censo</span></div>
        <section class="tarjeta"><h2>Resultados en esta granja</h2>
          ${verracosActivos().length ? `<table class="tabla"><thead><tr><th>Verraco</th><th>Verraquera</th><th>IA</th><th>Eco +</th><th>Vivos/parto</th></tr></thead><tbody>
          ${verracosActivos().map((x) => { const s = stats[x.id] || { ia: 0, ecos: 0, pos: 0, partos: 0, vivos: 0 };
            return `<tr><td><strong>${esc(x.crotal)}</strong></td><td>${x.verraquera || '—'}</td><td>${s.ia}</td><td>${s.ecos ? Math.round((100 * s.pos) / s.ecos) + ' %' : '—'}</td><td>${s.partos ? (s.vivos / s.partos).toFixed(1).replace('.', ',') : '—'}</td></tr>`; }).join('')}
          </tbody></table>` : '<div class="suave">No hay verracos en el censo.</div>'}</section>
        <div class="vacio">El registro de extracciones y dosis llega en la siguiente fase.</div>
      </main>${navegacion('verracos')}`);
  }

  // ---------------------------------------------------------------- cuenta
  function vistaCuenta(mensaje) {
    pintar(`${cabecera()}
      <main class="cuerpo">
        <h1 style="font-size:22px">Tu cuenta</h1>
        <section class="tarjeta"><div class="filas">
          ${S.perfil.nombre ? `<div><span>Nombre</span><span>${esc(S.perfil.nombre)}</span></div>` : ''}
          <div><span>Alias</span><span>${esc(S.perfil.alias)}</span></div>
          <div><span>Rol</span><span>${esProf() ? 'Profesor' : 'Alumno'}</span></div>
          <div><span>Granja</span><span>${esc(esProf() ? 'Las dos' : nombreGranja(S.granja))}</span></div></div></section>
        ${mensaje || ''}
        <form class="formu tarjeta" id="f-clave" novalidate>
          <h2>${esProf() ? 'Cambiar contraseña' : 'Cambiar PIN'}</h2>
          <div class="campo"><label for="n1">${esProf() ? 'Nueva contraseña (mínimo 8 caracteres)' : 'Nuevo PIN (6 cifras)'}</label>
            <input id="n1" name="n1" type="password" ${esProf() ? '' : 'inputmode="numeric" maxlength="6"'} autocomplete="new-password"></div>
          <div class="campo"><label for="n2">Repítelo</label>
            <input id="n2" name="n2" type="password" ${esProf() ? '' : 'inputmode="numeric" maxlength="6"'} autocomplete="new-password"></div>
          <button class="btn" type="submit">Guardar</button>
        </form>
        <section class="tarjeta"><h2>Instalar en el móvil</h2>
          <div class="suave">Android: en Chrome, menú ⋮ → <strong>Instalar aplicación</strong>.<br>iPhone: en Safari, botón Compartir → <strong>Añadir a pantalla de inicio</strong>.</div></section>
        <button class="btn sec" type="button" data-accion="salir">Salir</button>
        <div class="suave peq" style="text-align:center">CIFEAPORC · versión ${esc(C.version)}</div>
      </main>${navegacion('cuenta')}`);
    document.getElementById('f-clave').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target); const a = String(f.get('n1')); const b = String(f.get('n2'));
      const ok = esProf() ? a.length >= 8 : /^\d{6}$/.test(a);
      const err = (t) => vistaCuenta(`<div class="error-caja" role="alert">${esc(t)}</div>`);
      if (!ok) return err(esProf() ? 'La contraseña debe tener al menos 8 caracteres.' : 'El PIN debe tener 6 cifras.');
      if (a !== b) return err('No coinciden.');
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) return err(traducirError(error));
      vistaCuenta(`<div class="ok-caja" role="status">${esProf() ? 'Contraseña cambiada.' : 'PIN cambiado.'}</div>`);
    });
  }

  // ---------------------------------------------------------------- gestión (profesor)
  async function cargarPerfiles() {
    const { data, error } = await sb.from('perfiles').select('*').order('alias');
    if (error) throw error;
    S.perfiles = data;
  }

  function vistaAdmin(seccion = 'censo', extra) {
    if (!esProf()) return vistaNoEncontrado();
    const pest = `<div class="pestanas" role="tablist">${[['censo', 'Censo'], ['alumnos', 'Alumnos'], ['granja', 'Granja']].map(([id, t]) =>
      `<a role="tab" href="#/admin/${id}" class="${seccion === id ? 'activo' : ''}" aria-selected="${seccion === id}">${t}</a>`).join('')}</div>`;
    let cuerpo = '';
    if (seccion === 'censo') cuerpo = adminCenso(extra);
    if (seccion === 'alumnos') {
      if (!S.perfiles) { cargarPerfiles().then(() => vistaAdmin('alumnos', extra)).catch((e) => toast(traducirError(e))); cuerpo = '<div class="suave">Cargando alumnos…</div>'; }
      else cuerpo = adminAlumnos(extra);
    }
    if (seccion === 'granja') cuerpo = adminGranja(extra);
    pintar(`${cabecera({ prof: true })}<main class="cuerpo"><h1 style="font-size:22px">Gestión del profesor</h1>${pest}${cuerpo}</main>${navegacion('admin')}`);
    enlazarAdmin(seccion);
  }

  function adminCenso(msg) {
    const fila = (x, tipo) => `<a class="cerda-fila" href="#/admin/${tipo}/${x.id}"><div><strong>${esc(x.crotal)}</strong>
      <div class="suave">${x.fecha_baja ? `Baja ${fmt(x.fecha_baja)} · ${esc(x.causa_baja || '')}` : tipo === 'verraco' ? `Verraquera ${x.verraquera || '—'}` : esc(x.origen ? `Procede de ${x.origen}` : x.raza)}</div></div>
      <span class="chip ${x.fecha_baja ? 'gris' : ''}">${x.fecha_baja ? 'Baja' : 'Editar'}</span></a>`;
    const activas = S.cerdas.filter((x) => !x.fecha_baja), bajas = S.cerdas.filter((x) => x.fecha_baja);
    return `${msg || ''}<div class="suave">El censo es común: las altas y bajas aparecen a la vez en las dos granjas.</div>
      <section class="tarjeta"><div class="entre"><h2>Cerdas (${activas.length})</h2><a class="btn peq" href="#/admin/cerda/nueva">${ICONOS.mas}Alta</a></div>
        <div class="lista">${activas.map((x) => fila(x, 'cerda')).join('') || '<div class="suave">Sin cerdas.</div>'}</div>
        ${bajas.length ? `<details><summary class="suave">Ver ${bajas.length} cerdas dadas de baja</summary><div class="lista" style="margin-top:8px">${bajas.map((x) => fila(x, 'cerda')).join('')}</div></details>` : ''}</section>
      <section class="tarjeta"><div class="entre"><h2>Verracos (${verracosActivos().length})</h2><a class="btn peq" href="#/admin/verraco/nuevo">${ICONOS.mas}Alta</a></div>
        <div class="lista">${S.verracos.map((x) => fila(x, 'verraco')).join('') || '<div class="suave">Sin verracos.</div>'}</div></section>`;
  }

  function vistaAnimal(tipo, id) {
    if (!esProf()) return vistaNoEncontrado();
    const lista = tipo === 'cerda' ? S.cerdas : S.verracos;
    const x = lista.find((a) => a.id === id) || {};
    const nuevo = !x.id;
    const t = tipo === 'cerda' ? 'cerda' : 'verraco';
    pintar(`${cabecera({ prof: true, volver: '#/admin/censo', textoVolver: 'Censo', titulo: nuevo ? `Alta de ${t}` : `${tipo === 'cerda' ? 'Cerda' : 'Verraco'} ${x.crotal}` })}
      <main class="cuerpo"><form class="formu" id="f-animal" novalidate>
        <div class="campo"><label for="a-crotal">Crotal principal</label><input id="a-crotal" name="crotal" type="text" value="${esc(x.crotal)}" required></div>
        ${tipo === 'cerda' ? `<div class="campo"><label for="a-otros">Otros crotales <span class="suave">(opcional, separados por comas)</span></label><input id="a-otros" name="otros" type="text" value="${esc((x.otros_crotales || []).join(', '))}"></div>` : ''}
        <div class="campo"><label for="a-raza">Raza</label><input id="a-raza" name="raza" type="text" value="${esc(x.raza || 'Chato murciano')}"></div>
        <div class="dos"><div class="campo"><label for="a-nac">Nacimiento</label><input id="a-nac" name="fecha_nacimiento" type="date" value="${esc(x.fecha_nacimiento || '')}"></div>
          <div class="campo"><label for="a-ent">Entrada en granja</label><input id="a-ent" name="fecha_entrada" type="date" value="${esc(x.fecha_entrada || '')}"></div></div>
        ${tipo === 'cerda' ? `<div class="campo"><label for="a-ori">Explotación de procedencia <span class="suave">(reposición)</span></label><input id="a-ori" name="origen" type="text" value="${esc(x.origen || '')}"></div>`
          : `<div class="campo"><label for="a-vq">Verraquera</label><select id="a-vq" name="verraquera"><option value="">—</option>${rango(1, 5).map((k) => `<option ${String(x.verraquera) === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>`}
        ${nuevo ? '' : `<fieldset><legend>Baja</legend><div class="campo"><label for="a-fb">Fecha de baja</label><input id="a-fb" name="fecha_baja" type="date" value="${esc(x.fecha_baja || '')}"></div>
          <div class="campo"><label for="a-cb">Causa</label><input id="a-cb" name="causa_baja" type="text" value="${esc(x.causa_baja || '')}"></div>
          <div class="suave peq">Al dar de baja, el animal deja de aparecer en las granjas, pero su historial se conserva. Para anularla, vacía la fecha.</div></fieldset>`}
        <div id="mensajes" aria-live="polite"></div>
        <button class="btn" type="submit">${nuevo ? 'Dar de alta' : 'Guardar cambios'}</button>
      </form></main>`);
    document.getElementById('f-animal').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      const reg = { crotal: String(f.crotal || '').trim(), raza: String(f.raza || '').trim() || 'Chato murciano', fecha_nacimiento: f.fecha_nacimiento || null, fecha_entrada: f.fecha_entrada || null };
      if (tipo === 'cerda') { reg.otros_crotales = String(f.otros || '').split(',').map((s) => s.trim()).filter(Boolean); reg.origen = String(f.origen || '').trim() || null; }
      else reg.verraquera = f.verraquera ? Number(f.verraquera) : null;
      if (!nuevo) { reg.fecha_baja = f.fecha_baja || null; reg.causa_baja = String(f.causa_baja || '').trim() || null; }
      const msj = document.getElementById('mensajes');
      if (!reg.crotal) { msj.innerHTML = '<div class="error-caja" role="alert">Falta el crotal.</div>'; return; }
      if (reg.fecha_baja && !reg.causa_baja) { msj.innerHTML = '<div class="error-caja" role="alert">Indica la causa de la baja.</div>'; return; }
      const tabla = tipo === 'cerda' ? 'cerdas' : 'verracos';
      const { error } = nuevo ? await sb.from(tabla).insert(reg) : await sb.from(tabla).update(reg).eq('id', x.id);
      if (error) { msj.innerHTML = `<div class="error-caja" role="alert">${esc(traducirError(error))}</div>`; return; }
      toast(nuevo ? 'Alta guardada' : 'Cambios guardados');
      await refrescar(); location.hash = '#/admin/censo';
    });
  }

  const pinAzar = () => String(Math.floor(100000 + Math.random() * 900000));
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // Crea la cuenta de un alumno (alias + PIN) y su perfil. Devuelve null si va bien o el texto del error.
  async function crearAcceso(alias, pin, granja, nombre) {
    // Cliente aparte para no cerrar la sesión del profesor.
    const sb2 = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cife-alta' } });
    const { data, error } = await sb2.auth.signUp({ email: `${alias.toLowerCase()}.g${granja}@${C.dominioAlumnos}`, password: pin });
    if (error) return traducirError(error);
    if (!data.user || (data.user.identities && data.user.identities.length === 0)) return 'Ese alias ya existe en esa granja.';
    const r = await sb.from('perfiles').insert({ user_id: data.user.id, alias, rol: 'alumno', granja_id: granja, ...(nombre ? { nombre } : {}) });
    return r.error ? traducirError(r.error) : null;
  }
  // "LÓPEZ GARCÍA, JUAN" o "Juan López García" → "Juan L." (se puede corregir antes de crear)
  const capital = (t) => t.toLocaleLowerCase('es').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));
  function acortarNombre(linea, acortar) {
    const t = linea.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    let nombre, apellido;
    if (t.includes(',')) { const [a, n] = t.split(','); apellido = a.trim(); nombre = (n || '').trim(); }
    else {
      // Desde el final: hasta dos apellidos, cada uno con sus partículas (de, del, la…).
      const w = t.split(' '); if (w.length === 1) return capital(w[0]);
      const part = /^(de|del|la|las|los|y|san)$/i; let i = w.length; const grupos = [];
      while (grupos.length < 2 && i > 1) { let j = i - 1; while (j > 1 && part.test(w[j - 1])) j -= 1; grupos.unshift(w.slice(j, i).join(' ')); i = j; }
      nombre = w.slice(0, i).join(' '); apellido = grupos.join(' ');
    }
    if (!nombre) return capital(apellido).slice(0, 40);
    const minus = (x) => x.replace(/ (De|Del|La|Las|Los|Y|San) /g, (m) => m.toLocaleLowerCase('es'));
    if (!acortar) return minus(capital(`${nombre} ${apellido}`)).slice(0, 40);
    const ini = (apellido.split(' ').find((x) => !/^(de|del|la|las|los|y)$/i.test(x)) || '')[0];
    return `${capital(nombre)}${ini ? ` ${ini.toLocaleUpperCase('es')}.` : ''}`.slice(0, 40);
  }
  function siguienteAlias(prefijo, granja, usados) {
    let maxN = 0;
    for (const a of usados) { const m = a.match(new RegExp(`^${prefijo}(\\d+)$`)); if (m) maxN = Math.max(maxN, Number(m[1])); }
    return () => { maxN += 1; return `${prefijo}${String(maxN).padStart(2, '0')}`; };
  }

  function bloqueVarios() {
    const L = S.borrador.lote;
    if (S.borrador.resultado) {
      const R = S.borrador.resultado;
      const filas = R.map((r) => `<tr><td>${esc(r.nombre || '—')}</td><td><strong>${esc(r.alias)}</strong></td><td>${r.error ? `<span class="chip rojo">${esc(r.error)}</span>` : `<strong>${esc(r.pin)}</strong>`}</td></tr>`).join('');
      return `<section class="tarjeta"><h2>Accesos creados (${R.filter((r) => !r.error).length} de ${R.length})</h2>
        <div class="aviso-caja"><strong>Copia o imprime esta lista ahora:</strong> los PIN no se vuelven a mostrar. Entrégale a cada alumno su alias y su PIN.</div>
        <table class="tabla"><thead><tr><th>Nombre</th><th>Alias</th><th>PIN</th></tr></thead><tbody>${filas}</tbody></table>
        <div class="botones"><button class="btn sec peq" type="button" data-accion="copiar-lista">Copiar lista</button><button class="btn sec peq" type="button" data-accion="imprimir">Imprimir</button><button class="btn peq" type="button" data-accion="cerrar-lista">Hecho</button></div></section>`;
    }
    if (L) {
      return `<form class="formu tarjeta" id="f-lote" novalidate><h2>Revisa la lista · ${esc(nombreGranja(L.granja))}</h2>
        <div class="suave peq">Corrige los nombres o los alias si hace falta. Al pulsar Crear se generan los accesos uno a uno (tarda unos segundos por alumno).</div>
        <table class="tabla"><thead><tr><th>Nombre</th><th>Alias</th></tr></thead><tbody>${L.filas.map((f, i) => `<tr>
          <td><input type="text" name="n${i}" aria-label="Nombre ${i + 1}" maxlength="40" value="${esc(f.nombre)}"></td>
          <td style="width:96px"><input type="text" name="a${i}" aria-label="Alias ${i + 1}" maxlength="10" value="${esc(f.alias)}"></td></tr>`).join('')}</tbody></table>
        <div id="progreso" aria-live="polite"></div>
        <div class="botones"><button class="btn sec" type="button" data-accion="cancelar-lote">Cancelar</button><button class="btn" type="submit">Crear ${L.filas.length} accesos</button></div></form>`;
    }
    return `<details class="tarjeta"><summary style="min-height:44px;display:flex;align-items:center;font-weight:700">Añadir varios alumnos a la vez</summary>
      <form class="formu" id="f-varios" novalidate style="margin-top:10px">
        <div class="campo"><span class="et" id="et-gv">Granja</span><div class="opciones" role="radiogroup" aria-labelledby="et-gv">
          <label><input type="radio" name="granja" value="1" checked> 1.º curso</label><label><input type="radio" name="granja" value="2"> 2.º curso</label></div></div>
        <div class="campo"><label for="v-lista">Pega la lista (un alumno por línea)</label>
          <textarea id="v-lista" name="lista" rows="8" placeholder="LÓPEZ GARCÍA, JUAN\nMartínez Ruiz, Eva\nAna Pérez Sánchez"></textarea>
          <span class="ayuda">Vale copiar la columna de nombres de un Excel o de la lista de clase.</span></div>
        <div class="opciones"><label><input type="checkbox" name="acortar" checked> Guardar solo nombre e inicial del apellido (recomendado)</label></div>
        <div class="campo"><label for="v-pref">Letra de los alias</label><input id="v-pref" name="prefijo" type="text" maxlength="2" autocapitalize="characters" placeholder="A para 1.º, B para 2.º"></div>
        <button class="btn" type="submit">Revisar lista</button></form></details>`;
  }

  function adminAlumnos(msg) {
    const alumnos = S.perfiles.filter((p) => p.rol === 'alumno');
    const profes = S.perfiles.filter((p) => p.rol === 'profesor');
    const pin = pinAzar();
    const porGranja = (g) => alumnos.filter((a) => a.granja_id === g).map((a) => `
      <div class="evento"><div class="entre"><strong>${esc(a.alias)}${a.nombre ? ` · ${esc(a.nombre)}` : ''}</strong><span class="chip ${a.activo ? '' : 'gris'}">${a.activo ? 'Activo' : 'Desactivado'}</span></div>
        ${S.borrador.editNombre === a.user_id ? `<form class="entre" data-form-nombre="${a.user_id}" novalidate style="gap:8px"><input name="nombre" type="text" aria-label="Nombre de ${esc(a.alias)}" maxlength="40" value="${esc(a.nombre || '')}" placeholder="Nombre e inicial (Juan G.)"><button class="btn peq" type="submit">Guardar</button></form>` : ''}
        <div class="acciones"><button class="btn sec peq" type="button" data-nombre="${a.user_id}">${a.nombre ? 'Cambiar nombre' : 'Poner nombre'}</button>
        <button class="btn sec peq" type="button" data-pin="${a.user_id}" data-alias="${esc(a.alias)}">Nuevo PIN</button>
        <button class="btn sec peq" type="button" data-activo="${a.user_id}" data-valor="${a.activo ? '0' : '1'}">${a.activo ? 'Desactivar' : 'Activar'}</button></div></div>`).join('') || '<div class="suave">Sin alumnos.</div>';
    if (S.borrador.resultado) return `${msg || ''}${bloqueVarios()}`;
    return `${msg || ''}
      <form class="formu tarjeta" id="f-alumno" novalidate><h2>Añadir alumno</h2>
        <div class="campo"><span class="et" id="et-ga">Granja</span><div class="opciones" role="radiogroup" aria-labelledby="et-ga">
          <label><input type="radio" name="granja" value="1" checked> 1.º curso</label><label><input type="radio" name="granja" value="2"> 2.º curso</label></div></div>
        <div class="dos"><div class="campo"><label for="al-alias">Alias</label><input id="al-alias" name="alias" type="text" autocapitalize="characters" placeholder="A07"></div>
          <div class="campo"><label for="al-pin">PIN</label><input id="al-pin" name="pin" type="text" inputmode="numeric" maxlength="6" value="${pin}"></div></div>
        <div class="campo"><label for="al-nombre">Nombre <span class="suave">(opcional: nombre e inicial del apellido)</span></label><input id="al-nombre" name="nombre" type="text" maxlength="40" placeholder="Juan G."></div>
        <div class="suave peq">El nombre solo lo ven los compañeros de su curso y el profesor. Se borra al cerrar el curso. Para entrar se usa siempre el alias y el PIN.</div>
        <button class="btn" type="submit">Crear acceso</button></form>
      ${bloqueVarios()}
      <section class="tarjeta"><h2>Alumnos · 1.º curso</h2>${porGranja(1)}</section>
      <section class="tarjeta"><h2>Alumnos · 2.º curso</h2>${porGranja(2)}</section>
      <section class="tarjeta"><h2>Profesores</h2>${profes.map((p) => `<div>${esc(p.alias)}</div>`).join('')}
        <div class="suave peq">Para añadir otro profesor, sigue la guía de puesta en marcha (paso del profesor).</div></section>
      <section class="aviso-caja"><strong>Cambio de curso escolar</strong><br>Desactiva a todos los alumnos y <strong>borra sus nombres</strong>. Sus registros se conservan con el alias. Después crea los alias del curso nuevo.
        <div style="margin-top:10px"><button class="btn peligro peq" type="button" data-accion="fin-curso">Cerrar el curso</button></div></section>`;
  }

  function adminGranja() {
    return `<section class="tarjeta"><h2>Granja que estás viendo</h2>
      <div class="suave">Como profesor puedes ver y registrar en las dos granjas. Elige cuál mostrar.</div>
      <div class="pestanas">${S.granjas.map((g) => `<button type="button" data-granja="${g.id}" class="${S.granja === g.id ? 'activo' : ''}" aria-pressed="${S.granja === g.id}">${esc(g.nombre.replace('Granja ', ''))}</button>`).join('')}</div></section>
      <div class="foto"><img src="img/granja.jpg" alt="Vista aérea de la granja porcina"></div>
      <div class="vacio">El plano de la granja, los lotes, la sanidad y la comparación entre granjas llegan en las siguientes fases.</div>`;
  }

  function enlazarAdmin(seccion) {
    if (seccion === 'granja') {
      $app.querySelectorAll('[data-granja]').forEach((b) => b.addEventListener('click', async () => {
        S.granja = Number(b.dataset.granja);
        try { localStorage.setItem('cife-granja', String(S.granja)); } catch (_) { /* sin almacenamiento */ }
        await refrescar(); toast(`Viendo ${nombreGranja(S.granja)}`); vistaAdmin('granja');
      }));
    }
    if (seccion !== 'alumnos' || !S.perfiles) return;
    const fa = document.getElementById('f-alumno');
    if (fa) fa.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(fa).entries());
      const alias = String(f.alias || '').trim().toUpperCase();
      const pin = String(f.pin || '').trim();
      const granja = Number(f.granja);
      const nombre = String(f.nombre || '').trim().replace(/\s+/g, ' ').slice(0, 40) || null;
      const err = (t) => vistaAdmin('alumnos', `<div class="error-caja" role="alert">${esc(t)}</div>`);
      if (!/^[A-Z0-9]{1,10}$/.test(alias)) return err('El alias solo puede tener letras y números (máximo 10), sin espacios.');
      if (!/^\d{6}$/.test(pin)) return err('El PIN debe tener 6 cifras.');
      if (S.perfiles.some((p) => p.alias.toUpperCase() === alias && p.granja_id === granja)) return err('Ese alias ya existe en esa granja.');
      const fallo = await crearAcceso(alias, pin, granja, nombre);
      if (fallo) return err(fallo);
      await cargarPerfiles();
      vistaAdmin('alumnos', `<div class="ok-caja" role="status"><strong>Acceso creado.</strong><br>${esc(nombreGranja(granja))} · alias <strong>${esc(alias)}</strong>${nombre ? ` (${esc(nombre)})` : ''} · PIN <strong>${esc(pin)}</strong><br>Apúntalo ahora: el PIN no se vuelve a mostrar.</div>`);
    });
    const fv = document.getElementById('f-varios');
    if (fv) fv.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = new FormData(fv);
      const granja = Number(f.get('granja'));
      const acortar = f.get('acortar') === 'on';
      const prefijo = (String(f.get('prefijo') || '').trim().toUpperCase().replace(/[^A-Z]/g, '') || (granja === 1 ? 'A' : 'B')).slice(0, 2);
      const nombres = String(f.get('lista') || '').split(/\r?\n/).map((l) => acortarNombre(l, acortar)).filter(Boolean);
      if (!nombres.length) return vistaAdmin('alumnos', '<div class="error-caja" role="alert">Pega al menos un nombre.</div>');
      if (nombres.length > 40) return vistaAdmin('alumnos', '<div class="error-caja" role="alert">Máximo 40 alumnos por lista.</div>');
      const sig = siguienteAlias(prefijo, granja, S.perfiles.filter((p) => p.granja_id === granja).map((p) => p.alias.toUpperCase()));
      S.borrador.lote = { granja, filas: nombres.map((nombre) => ({ nombre, alias: sig() })) };
      vistaAdmin('alumnos');
    });
    const fl = document.getElementById('f-lote');
    if (fl) fl.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const L = S.borrador.lote; const f = new FormData(fl);
      const filas = L.filas.map((x, i) => ({ nombre: String(f.get(`n${i}`) || '').trim().replace(/\s+/g, ' ').slice(0, 40) || null, alias: String(f.get(`a${i}`) || '').trim().toUpperCase() }));
      const usados = new Set(S.perfiles.filter((p) => p.granja_id === L.granja).map((p) => p.alias.toUpperCase()));
      const prog = document.getElementById('progreso');
      for (const x of filas) {
        if (!/^[A-Z0-9]{1,10}$/.test(x.alias)) { prog.innerHTML = `<div class="error-caja" role="alert">Alias no válido: «${esc(x.alias)}». Solo letras y números, sin espacios.</div>`; return; }
        if (usados.has(x.alias)) { prog.innerHTML = `<div class="error-caja" role="alert">El alias ${esc(x.alias)} está repetido o ya existe en esa granja.</div>`; return; }
        usados.add(x.alias);
      }
      fl.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
      const resultado = [];
      for (let i = 0; i < filas.length; i++) {
        const x = filas[i]; const pin = pinAzar();
        prog.innerHTML = `<div class="ok-caja">Creando ${i + 1} de ${filas.length}: ${esc(x.alias)}…</div>`;
        const fallo = await crearAcceso(x.alias, pin, L.granja, x.nombre);
        resultado.push({ ...x, pin, error: fallo });
        if (fallo && /Demasiados|rate limit/i.test(fallo)) {
          for (const y of filas.slice(i + 1)) resultado.push({ ...y, pin: '', error: 'No creado: espera unos minutos y vuelve a añadirlo' });
          break;
        }
        await espera(1200);
      }
      S.borrador.lote = null; S.borrador.resultado = resultado;
      await cargarPerfiles(); vistaAdmin('alumnos');
    });
    const cl = $app.querySelector('[data-accion="cancelar-lote"]');
    if (cl) cl.addEventListener('click', () => { S.borrador.lote = null; vistaAdmin('alumnos'); });
    const cp = $app.querySelector('[data-accion="copiar-lista"]');
    if (cp) cp.addEventListener('click', async () => {
      const texto = ['Nombre\tAlias\tPIN', ...S.borrador.resultado.filter((r) => !r.error).map((r) => `${r.nombre || ''}\t${r.alias}\t${r.pin}`)].join('\n');
      try { await navigator.clipboard.writeText(texto); toast('Lista copiada: pégala en un Excel o documento'); } catch (_) { toast('No se pudo copiar. Usa Imprimir.'); }
    });
    const im = $app.querySelector('[data-accion="imprimir"]');
    if (im) im.addEventListener('click', () => window.print());
    const ce = $app.querySelector('[data-accion="cerrar-lista"]');
    if (ce) ce.addEventListener('click', () => { S.borrador.resultado = null; vistaAdmin('alumnos'); });
    $app.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', async () => {
      const pin = pinAzar();
      const { error } = await sb.rpc('restablecer_pin', { p_user: b.dataset.pin, p_pin: pin });
      if (error) return vistaAdmin('alumnos', `<div class="error-caja" role="alert">${esc(traducirError(error))}</div>`);
      vistaAdmin('alumnos', `<div class="ok-caja" role="status">Nuevo PIN para <strong>${esc(b.dataset.alias)}</strong>: <strong>${pin}</strong>. Apúntalo ahora.</div>`);
    }));
    $app.querySelectorAll('[data-nombre]').forEach((b) => b.addEventListener('click', () => {
      S.borrador.editNombre = S.borrador.editNombre === b.dataset.nombre ? null : b.dataset.nombre; vistaAdmin('alumnos');
      const i = $app.querySelector('[data-form-nombre] input'); if (i) i.focus();
    }));
    $app.querySelectorAll('[data-form-nombre]').forEach((f) => f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const nombre = String(new FormData(f).get('nombre') || '').trim().replace(/\s+/g, ' ').slice(0, 40) || null;
      const { error } = await sb.from('perfiles').update({ nombre }).eq('user_id', f.dataset.formNombre);
      if (error) return vistaAdmin('alumnos', `<div class="error-caja" role="alert">${esc(traducirError(error))}</div>`);
      S.borrador.editNombre = null; await cargarPerfiles(); await refrescar(); location.hash = '#/admin/alumnos'; vistaAdmin('alumnos');
    }));
    $app.querySelectorAll('[data-activo]').forEach((b) => b.addEventListener('click', async () => {
      const { error } = await sb.from('perfiles').update({ activo: b.dataset.valor === '1' }).eq('user_id', b.dataset.activo);
      if (error) return toast(traducirError(error));
      await cargarPerfiles(); vistaAdmin('alumnos');
    }));
    const fin = $app.querySelector('[data-accion="fin-curso"]');
    if (fin) fin.addEventListener('click', async () => {
      if (fin.dataset.confirmar !== '1') { fin.dataset.confirmar = '1'; fin.textContent = '¿Seguro? Pulsa otra vez para desactivar a todos y borrar sus nombres'; return; }
      const { data, error } = await sb.rpc('cerrar_curso');
      if (error) return vistaAdmin('alumnos', `<div class="error-caja" role="alert">${esc(/cerrar_curso/.test(error.message) ? 'Falta ejecutar en Supabase el archivo 04_nombres_alumnos.sql.' : traducirError(error))}</div>`);
      await cargarPerfiles(); await refrescar(); location.hash = '#/admin/alumnos';
      vistaAdmin('alumnos', `<div class="ok-caja" role="status">Curso cerrado: ${data ?? 0} alumnos desactivados y sus nombres borrados.</div>`);
    });
  }

  function vistaNoEncontrado(texto) {
    pintar(`${cabecera()}<main class="cuerpo"><div class="vacio">${esc(texto || 'No se ha encontrado lo que buscabas.')}</div>
      <a class="btn sec" href="#/inicio">Volver al inicio</a></main>${navegacion('')}`);
  }

  // ---------------------------------------------------------------- enrutado
  function render() {
    if (!S.sesion) return vistaAcceso();
    if (!S.perfil) return vistaSinPerfil();
    const [ruta, a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
    switch (ruta || 'inicio') {
      case 'inicio': return vistaInicio();
      case 'cerdas': return vistaCerdas();
      case 'cerda': return vistaFicha(a);
      case 'registrar': return vistaRegistrar(a, b, c);
      case 'verracos': return vistaVerracos();
      case 'cuenta': return vistaCuenta();
      case 'admin':
        if (a === 'cerda' || a === 'verraco') return vistaAnimal(a, b);
        return vistaAdmin(a || 'censo');
      default: return vistaNoEncontrado();
    }
  }

  // Botones comunes (actualizar, salir)
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    if (b.dataset.accion === 'refrescar') refrescar(true);
    if (b.dataset.accion === 'salir') {
      await sb.auth.signOut();
      Object.assign(S, { sesion: null, perfil: null, perfiles: null, eventos: [], porCerda: {}, borrador: {} });
      location.hash = ''; vistaAcceso();
    }
  });

  window.addEventListener('hashchange', () => { if (S.perfiles && !location.hash.startsWith('#/admin')) S.perfiles = null; render(); });

  // Hora de consulta en vivo y recarga al volver a la app
  setInterval(() => { const h = document.getElementById('hora-consulta'); if (h) h.textContent = fechaHora(new Date()); }, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.perfil && (!S.cargado || Date.now() - S.cargado > 120000) && !location.hash.startsWith('#/registrar')) refrescar();
  });

  async function iniciar() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    try {
      const { data } = await sb.auth.getSession();
      S.sesion = data.session;
      if (S.sesion) await cargarTodo();
    } catch (e) {
      if (S.sesion) { pintar(`<main class="acceso"><div class="error-caja" role="alert">${esc(traducirError(e))}</div><button class="btn" type="button" onclick="location.reload()">Reintentar</button></main>`); return; }
    }
    sb.auth.onAuthStateChange((evento, sesion) => { S.sesion = sesion; if (evento === 'SIGNED_OUT') { S.perfil = null; render(); } });
    render();
  }
  iniciar();
})();
