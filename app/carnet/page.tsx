// app/carnet/page.tsx — v4 FINAL
'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface DatosMilitante {
  cedula: string; nombres: string; apellidos: string
  provincia: string; municipio: string
  seccion?: string | null; sector?: string | null; direccion?: string | null
  tipoMilitancia: string; estado: string
  fechaRegistro: string; ocupacion?: string | null
  qrDataUrl: string; verifyUrl?: string
  codigoColegio?: string | null; descripcionColegio?: string | null
  codigoRecinto?: string | null; nombreRecinto?: string | null
  direccionRecinto?: string | null; circunscripcion?: string | null
  posPagina?: number | null
  electoralProvincia?: string | null; electoralMunicipio?: string | null
}

const TIPO_COLORS: Record<string, string> = {
  'Dirigente': '#C8001E', 'Militante orgánico': '#0D3B8C',
  'Militante activo': '#1a7f37', 'Militante': '#2d6a4f',
  'Militante de base': '#2d6a4f', 'Adherente': '#7b5ea7',
  'Militante electoral': '#b45309', 'Voluntario político': '#0369a1',
  'Simpatizante': '#444444', 'Exmilitante': '#9ca3af',
}

function CardFace({ d }: { d: DatosMilitante }) {
  const ini       = `${d.nombres?.[0] ?? ''}${d.apellidos?.split(' ')?.[0]?.[0] ?? ''}`.toUpperCase()
  const colorTipo = TIPO_COLORS[d.tipoMilitancia] ?? '#0D3B8C'
  const fechaCorta= d.fechaRegistro
    ? new Date(d.fechaRegistro).toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit' })
    : '—'

  return (
    <div className="cr80">
      <div className="strip"/>
      {/* Header */}
      <div className="hdr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-apd.png" alt="APD" className="hdr-logo"/>
        <div>
          <div className="hdr-org">ALIANZA POR LA DEMOCRACIA</div>
          <div className="hdr-sub">República Dominicana</div>
        </div>
        <div className="hdr-badge" style={{ background: colorTipo }}>{d.tipoMilitancia}</div>
      </div>
      {/* Body */}
      <div className="body">
        {/* Left */}
        <div className="left">
          <div className="avatar">{ini}</div>
          <div className="qr-wrap">
            {d.qrDataUrl
              ? <img src={d.qrDataUrl} alt="QR verificación" className="qr-img"/>
              : <span style={{fontSize:'4pt',color:'#aaa',textAlign:'center',padding:'2px'}}>Sin QR</span>
            }
          </div>
          <div className="qr-lbl">Escanea<br/>para verificar</div>
        </div>
        {/* Right */}
        <div className="right">
          <div className="name">{d.nombres} {d.apellidos}</div>
          <div className="ced">CED: {d.cedula}</div>
          <div className="rows">
            {d.ocupacion && (
              <div className="row"><span className="lbl">Profesión</span><span className="val">{d.ocupacion.split(',')[0].trim()}</span></div>
            )}
            <div className="row"><span className="lbl">Provincia</span><span className="val">{d.provincia}</span></div>
            <div className="row"><span className="lbl">Municipio</span><span className="val">{d.municipio}</span></div>
            {d.seccion  && <div className="row"><span className="lbl">Sección</span><span className="val">{d.seccion}</span></div>}
            {d.sector   && <div className="row"><span className="lbl">Barrio</span><span className="val">{d.sector}</span></div>}
            {d.direccion&& <div className="row"><span className="lbl">Dirección</span><span className="val">{d.direccion}</span></div>}
          </div>
          <div className="div"/>
          {/* Electoral */}
          <div className="electoral">
            <div className="el-title">▸ Colegio Electoral JCE</div>
            {d.codigoColegio && (
              <div className="el-row"><span className="ell">Colegio</span><span className="elv">{d.codigoColegio} — {d.descripcionColegio?.trim()}</span></div>
            )}
            {d.codigoRecinto && (
              <div className="el-row"><span className="ell">Recinto</span><span className="elv">{d.codigoRecinto} — {d.nombreRecinto?.trim()}</span></div>
            )}
            {d.circunscripcion && (
              <div className="el-row"><span className="ell">Circ.</span><span className="elv">{d.circunscripcion}</span></div>
            )}
            {d.posPagina != null && (
              <div className="el-row"><span className="ell">Pos. Página</span><span className="elv" style={{fontWeight:800,color:'#C8001E'}}>{d.posPagina}</span></div>
            )}
            {!d.codigoColegio && (
              <>
                <div className="el-row"><span className="ell">Provincia</span><span className="elv">{d.electoralProvincia || d.provincia}</span></div>
                <div className="el-row"><span className="ell">Municipio</span><span className="elv">{d.electoralMunicipio || d.municipio}</span></div>
              </>
            )}
            {d.direccionRecinto && (
              <div className="el-addr">📌 {d.direccionRecinto.trim()}</div>
            )}
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="foot">
        <span><span className="dot"/>ACTIVO · Desde {fechaCorta}</span>
        <span>APD · apd.org.do</span>
      </div>
      <div className="strip"/>
    </div>
  )
}

function CarnetContent() {
  const params    = useSearchParams()
  const cedula    = params.get('cedula') ?? ''
  const [datos,   setDatos]   = useState<DatosMilitante | null>(null)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cedula) { setError('Cédula no especificada'); setLoading(false); return }
    fetch(`/api/carnet?cedula=${encodeURIComponent(cedula)}`)
      .then(r => r.json())
      .then(j => { if (j.success) setDatos(j.data); else setError(j.error || 'No encontrado') })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [cedula])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:12, background:'#f3f4f6' }}>
      <svg style={{width:36,height:36,animation:'spin 1s linear infinite'}} viewBox="0 0 24 24" fill="none">
        <circle opacity=".25" cx="12" cy="12" r="10" stroke="#0D3B8C" strokeWidth="4"/>
        <path opacity=".75" fill="#0D3B8C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p style={{color:'#374151',fontFamily:'sans-serif',fontSize:14}}>Generando carnet...</p>
    </div>
  )

  if (error || !datos) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#f3f4f6', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, padding:32, textAlign:'center', maxWidth:320, width:'100%' }}>
        <p style={{color:'#C8001E',fontWeight:600,marginBottom:8,fontFamily:'sans-serif'}}>Error</p>
        <p style={{color:'#6b7280',fontSize:14,fontFamily:'sans-serif'}}>{error}</p>
        <button onClick={() => window.history.back()}
          style={{marginTop:16,color:'#0D3B8C',fontSize:14,textDecoration:'underline',
                  background:'none',border:'none',cursor:'pointer',fontFamily:'sans-serif'}}>
          Volver
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="toolbar no-print">
        <button onClick={() => window.history.back()} className="btn-back">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
          Volver
        </button>
        <span className="toolbar-title">Carnet de Militante · APD</span>
        <button onClick={() => window.print()} className="btn-print">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9a1 1 0 011-1h6a1 1 0 011 1v4H6v-4z" clipRule="evenodd"/></svg>
          Imprimir / PDF
        </button>
      </div>

      {/* ── Preview con logo grande ─────────────────────────────────────────── */}
      <div className="page-bg no-print">
        {/* LOGO GRANDE — igual que la página de consulta */}
        <div className="hero-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-apd.png" alt="Alianza por la Democracia"
            style={{ width:140, height:140, objectFit:'contain',
                     filter:'drop-shadow(0 6px 20px rgba(0,0,0,0.35))' }}/>
          <p className="hero-name">Alianza por la Democracia</p>
          <p className="hero-sub">Carnet de Militante</p>
        </div>
        <p className="hint">
          Al imprimir activa <strong>«Gráficos de fondo»</strong> para conservar colores
        </p>
        <CardFace d={datos}/>
      </div>

      {/* ── Solo impresión ──────────────────────────────────────────────────── */}
      <div className="print-zone">
        <CardFace d={datos}/>
      </div>

      <style>{`
        *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media print{
          .no-print{display:none!important}
          .print-zone{display:flex!important;align-items:flex-start;justify-content:flex-start}
          html,body{margin:0;padding:0;background:white}
          @page{size:85.6mm 54mm landscape;margin:0}
          .cr80{box-shadow:none!important}
        }
        .print-zone{display:none}

        /* ── Toolbar ── */
        .toolbar{
          position:fixed;top:0;left:0;right:0;z-index:50;
          background:#0D3B8C;padding:10px 16px;
          display:flex;align-items:center;justify-content:space-between;
          box-shadow:0 2px 10px rgba(0,0,0,.3);font-family:sans-serif;
        }
        .toolbar-title{color:white;font-weight:700;font-size:14px}
        .btn-back{
          display:flex;align-items:center;gap:6px;
          color:rgba(255,255,255,.8);font-size:13px;
          background:none;border:none;cursor:pointer;
        }
        .btn-back svg{width:16px;height:16px}
        .btn-print{
          display:flex;align-items:center;gap:6px;
          background:white;color:#0D3B8C;font-weight:700;
          font-size:13px;border:none;border-radius:8px;
          padding:6px 14px;cursor:pointer;
        }
        .btn-print svg{width:14px;height:14px}

        /* ── Page background ── */
        .page-bg{
          min-height:100vh;
          background: #f3f4f6;
          display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          padding:80px 16px 48px;gap:16px;
          font-family:sans-serif;
        }

        /* ── Hero logo ── */
        .hero-logo{
          display:flex;flex-direction:column;align-items:center;
          gap:8px;margin-bottom:8px;
        }
        .hero-name{
          color:#111827;font-weight:800;font-size:22px;
          letter-spacing:.01em;text-align:center;line-height:1.2;
          text-shadow:0 2px 8px rgba(0,0,0,.25);margin:0;
        }
        .hero-sub{
          color:#6b7280;font-size:13px;
          text-align:center;margin:0;
        }

        .hint{
          font-size:11px;color:#9ca3af;
          text-align:center;max-width:380px;line-height:1.5;margin:0;
        }
        .hint strong{color:#374151}

        /* ── CARD CR80 ── */
        .cr80{
          width:85.6mm;height:54mm;
          border-radius:3.5mm;overflow:hidden;background:white;
          box-shadow:0 8px 32px rgba(0,0,0,.22);
          display:flex;flex-direction:column;
          font-family:'Helvetica Neue',Arial,sans-serif;
        }
        .strip{
          height:3px;flex-shrink:0;
          background:linear-gradient(to right,
            #0D3B8C 0 33.33%,#F5C400 33.33% 66.66%,#C8001E 66.66% 100%);
        }
        .hdr{
          background:#0D3B8C;padding:3px 7px;
          display:flex;align-items:center;gap:5px;flex-shrink:0;
        }
        .hdr-logo{width:18px;height:18px;object-fit:contain;flex-shrink:0}
        .hdr-org{font-size:5.5pt;font-weight:800;color:#fff;letter-spacing:.04em;line-height:1.2}
        .hdr-sub{font-size:4.2pt;color:rgba(255,255,255,.65)}
        .hdr-badge{
          margin-left:auto;flex-shrink:0;
          font-size:4.5pt;font-weight:700;color:#fff;
          padding:1.5px 5px;border-radius:2.5px;
          text-transform:uppercase;letter-spacing:.04em;
        }
        .body{flex:1;display:flex;gap:5px;padding:4px 7px 3px;overflow:hidden}
        .left{display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;width:20mm}
        .avatar{
          width:16mm;height:16mm;border-radius:2mm;
          background:linear-gradient(135deg,#e8edf5,#c8d5e8);
          color:#0D3B8C;font-size:13pt;font-weight:800;
          display:flex;align-items:center;justify-content:center;
          border:1px solid #b8c8d8;flex-shrink:0;
        }
        .qr-wrap{
          width:16mm;height:16mm;border:1px solid #dde5f0;border-radius:1.5mm;
          display:flex;align-items:center;justify-content:center;
          background:white;overflow:hidden;flex-shrink:0;
        }
        .qr-img{width:14mm;height:14mm;display:block}
        .qr-lbl{font-size:3.5pt;color:#999;text-align:center;line-height:1.4}
        .right{flex:1;display:flex;flex-direction:column;gap:1.5px;overflow:hidden;min-width:0}
        .name{font-size:7pt;font-weight:800;color:#111;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ced{font-size:5.2pt;color:#555;font-family:'Courier New',monospace;font-weight:600;letter-spacing:.02em}
        .rows{display:flex;flex-direction:column;gap:.5px;padding-top:1px}
        .row{display:flex;gap:2px;align-items:baseline}
        .lbl{font-size:3.8pt;color:#888;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0;width:13mm}
        .val{font-size:4.8pt;color:#222;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
        .div{height:.5px;background:#e5e7eb;margin:2px 0;flex-shrink:0}
        .electoral{
          background:#eef2ff;border:.5px solid #c7d2ee;
          border-radius:1.5mm;padding:2px 4px;
          display:flex;flex-direction:column;gap:.5px;
        }
        .el-title{font-size:3.8pt;font-weight:700;color:#0D3B8C;letter-spacing:.04em;margin-bottom:.5px}
        .el-row{display:flex;gap:2px;align-items:baseline}
        .ell{font-size:3.8pt;color:#6685aa;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;width:10mm}
        .elv{font-size:4.5pt;color:#1a3a6b;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .el-addr{font-size:3.8pt;color:#4a6a9a;margin-top:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .foot{
          background:#f8f9fa;border-top:.5px solid #e5e7eb;
          padding:2px 7px;flex-shrink:0;
          display:flex;align-items:center;justify-content:space-between;
          font-size:3.8pt;color:#888;
          font-family:'Helvetica Neue',Arial,sans-serif;
        }
        .dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:#1a7f37;margin-right:3px;vertical-align:middle}
      `}</style>
    </>
  )
}

export default function CarnetPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:'100vh',background:'#f3f4f6',
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <p style={{color:'#374151',fontFamily:'sans-serif',fontSize:14}}>Cargando...</p>
      </div>
    }>
      <CarnetContent/>
    </Suspense>
  )
}
