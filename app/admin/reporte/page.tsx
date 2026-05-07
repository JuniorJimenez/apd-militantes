// app/admin/reporte/page.tsx
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function fmtFecha(d: any): string {
  if (!d) return '—'
  try {
    const s = String(d).slice(0, 10)
    if (s.length < 10) return "—"
    const [y, m, dd] = s.split("-")
    return `${dd}/${m}/${y}`
  }
  catch { return '—' }
}

function edad(f: any): string {
  if (!f) return ''
  try {
    const s = String(f).slice(0, 10)
    const [y, m, d] = s.split('-').map(Number)
    const nac = new Date(y, m - 1, d)
    const hoy = new Date()
    let e = hoy.getFullYear() - nac.getFullYear()
    const dm = hoy.getMonth() - nac.getMonth()
    if (dm < 0 || (dm === 0 && hoy.getDate() < nac.getDate())) e--
    return e > 0 && e < 120 ? `${e} años` : ''
  } catch { return '' }
}

function Reporte() {
  const sp         = useSearchParams()
  const estado     = sp.get('estado')    ?? 'TODOS'
  const provincia  = sp.get('provincia') ?? ''
  const municipio  = sp.get('municipio') ?? ''
  const q          = sp.get('q')         ?? ''

  const [rows,    setRows]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    const p = new URLSearchParams({ estado, q })
    if (provincia) p.set('provincia', provincia)
    if (municipio) p.set('municipio', municipio)

    fetch(`/api/reporte?${p}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setRows(j.data)
        else setErr(j.error || 'Error')
      })
      .catch(() => setErr('Error de conexión'))
      .finally(() => setLoading(false))
  }, [estado, provincia, municipio, q])

  const now    = new Date()
  const fecha  = now.toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })
  const hora   = now.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' })
  const total  = rows.length
  const activos    = rows.filter(r => r.estado === 'ACTIVO').length
  const pendientes = rows.filter(r => r.estado === 'PENDIENTE').length
  const inactivos  = rows.filter(r => r.estado === 'INACTIVO').length

  const filtroTexto = [
    estado !== 'TODOS' ? `Estado: ${estado}` : 'Todos los estados',
    provincia || '',
    municipio || '',
    q ? `Búsqueda: "${q}"` : '',
  ].filter(Boolean).join(' · ')

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial'}}>
      <p style={{color:'#666'}}>Cargando reporte...</p>
    </div>
  )

  if (err) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial',gap:12,padding:24,textAlign:'center'}}>
      <p style={{color:'#C8001E',fontWeight:700,fontSize:16}}>Error: {err}</p>
      <button onClick={() => window.close()} style={{color:'#0D3B8C',fontSize:13,background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Cerrar</button>
    </div>
  )

  const td: React.CSSProperties = {
    padding:'4pt 5pt', borderBottom:'0.5pt solid #e5e7eb',
    fontSize:'7.5pt', verticalAlign:'top'
  }

  return (
    <>
      <style>{`
        *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}
        @page{size:letter portrait;margin:12mm 10mm}
        @media print{
          .no-print{display:none!important}
          body{background:white}
          tr{page-break-inside:avoid}
        }
        body{margin:0;font-family:Arial,sans-serif;background:white}
      `}</style>

      {/* ── TOOLBAR ─────────────────────────────────────── */}
      <div className="no-print" style={{
        position:'fixed',top:0,left:0,right:0,zIndex:50,
        background:'#0D3B8C',padding:'8px 16px',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        fontFamily:'Arial',boxShadow:'0 2px 8px rgba(0,0,0,.25)',flexWrap:'wrap',gap:8,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={() => window.close()}
            style={{color:'rgba(255,255,255,.85)',fontSize:13,background:'none',border:'none',cursor:'pointer'}}>
            ← Cerrar
          </button>
          <span style={{color:'rgba(255,255,255,.7)',fontSize:12}}>{total} registro(s) · {filtroTexto}</span>
        </div>
        <button onClick={() => window.print()} style={{
          background:'white',color:'#0D3B8C',fontWeight:700,fontSize:13,
          border:'none',borderRadius:8,padding:'6px 18px',cursor:'pointer',
        }}>🖨 Imprimir / PDF</button>
      </div>

      {/* ── CONTENIDO ───────────────────────────────────── */}
      <div style={{paddingTop:52,padding:'52px 0 0',fontFamily:'Arial,sans-serif',fontSize:'9pt',background:'white',minHeight:'100vh'}}>

        {/* ENCABEZADO */}
        <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'10pt',borderBottom:'2.5pt solid #0D3B8C',paddingBottom:'8pt'}}>
          <tbody><tr>
            <td style={{width:'78pt',verticalAlign:'middle'}}>
              <img src="/logo-apd.png" alt="APD" style={{width:'62pt',height:'62pt',objectFit:'contain'}}/>
            </td>
            <td style={{verticalAlign:'middle',paddingLeft:'8pt'}}>
              <div style={{fontSize:'15pt',fontWeight:'bold',color:'#0D3B8C',lineHeight:1.2}}>Alianza por la Democracia</div>
              <div style={{fontSize:'10pt',fontWeight:600,color:'#333',marginTop:'2pt'}}>Padrón de Militantes — Reporte Oficial</div>
              <div style={{fontSize:'7.5pt',color:'#666',marginTop:'3pt'}}>{filtroTexto} &nbsp;|&nbsp; {fecha} a las {hora}</div>
            </td>
            <td style={{width:'78pt',textAlign:'right',verticalAlign:'middle'}}>
              <div style={{background:'#0D3B8C',color:'white',borderRadius:'6pt',padding:'5pt 10pt',textAlign:'center',display:'inline-block'}}>
                <div style={{fontSize:'20pt',fontWeight:'bold',lineHeight:1}}>{total}</div>
                <div style={{fontSize:'6.5pt',marginTop:'1pt',letterSpacing:'.5pt'}}>REGISTROS</div>
              </div>
            </td>
          </tr></tbody>
        </table>

        {/* STATS */}
        <table style={{width:'100%',borderCollapse:'separate',borderSpacing:'5pt 0',marginBottom:'10pt'}}>
          <tbody><tr>
            {[
              {label:'Activos',   val:activos,    c:'#166534',bg:'#dcfce7',b:'#86efac'},
              {label:'Pendientes',val:pendientes,  c:'#92400e',bg:'#fef3c7',b:'#fcd34d'},
              {label:'Inactivos', val:inactivos,   c:'#374151',bg:'#f3f4f6',b:'#d1d5db'},
            ].map(({label,val,c,bg,b}) => (
              <td key={label} style={{background:bg,border:`1pt solid ${b}`,borderRadius:'4pt',padding:'5pt 8pt',textAlign:'center'}}>
                <div style={{fontSize:'16pt',fontWeight:'bold',color:c}}>{val}</div>
                <div style={{fontSize:'7pt',color:'#555',marginTop:'1pt'}}>{label}</div>
              </td>
            ))}
          </tr></tbody>
        </table>

        {/* TABLA */}
        {total === 0 ? (
          <div style={{textAlign:'center',padding:'30pt',color:'#9ca3af',fontSize:'11pt'}}>No se encontraron registros.</div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'7.5pt'}}>
            <thead>
              <tr style={{backgroundColor:'#0D3B8C'}}>
                {['#','Cédula','Apellidos, Nombres','Fecha nac.','Edad','Teléfono','Provincia','Municipio','Tipo Militancia','Estado','Registro'].map(h=>(
                  <th key={h} style={{color:'white',padding:'5pt 5pt',textAlign:'left',fontWeight:'bold',fontSize:'6.5pt',textTransform:'uppercase',letterSpacing:'.2pt',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m,i) => {
                const ec = m.estado==='ACTIVO'?'#166534':m.estado==='PENDIENTE'?'#92400e':'#6b7280'
                const eb = m.estado==='ACTIVO'?'#dcfce7':m.estado==='PENDIENTE'?'#fef3c7':'#f3f4f6'
                const el = m.estado==='ACTIVO'?'Activo':m.estado==='PENDIENTE'?'Pendiente':'Inactivo'
                return (
                  <tr key={m.id??i} style={{backgroundColor:i%2===0?'#f9fafb':'#fff'}}>
                    <td style={{...td,color:'#999',fontSize:'6.5pt'}}>{i+1}</td>
                    <td style={{...td,fontFamily:'monospace',whiteSpace:'nowrap',fontSize:'7pt'}}>{m.cedula}</td>
                    <td style={{...td,fontWeight:600}}>{m.apellidos}, {m.nombres}</td>
                    <td style={{...td,whiteSpace:'nowrap'}}>{fmtFecha(m.fechaNac)}</td>
                    <td style={{...td,whiteSpace:'nowrap',color:'#555'}}>{edad(m.fechaNac)}</td>
                    <td style={{...td,whiteSpace:'nowrap'}}>{m.telefono}</td>
                    <td style={{...td}}>{m.provincia}</td>
                    <td style={{...td}}>{m.municipio}</td>
                    <td style={{...td,fontSize:'7pt'}}>{m.tipoMilitancia||'Simpatizante'}</td>
                    <td style={{...td}}>
                      <span style={{color:ec,fontWeight:'bold',fontSize:'6.5pt',padding:'1pt 4pt',borderRadius:'3pt',background:eb}}>{el}</span>
                    </td>
                    <td style={{...td,color:'#555',whiteSpace:'nowrap',fontSize:'7pt'}}>{fmtFecha(m.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* PIE */}
        <div style={{marginTop:'18pt',borderTop:'1pt solid #e5e7eb',paddingTop:'10pt'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <tbody><tr>
              <td style={{width:'45%',verticalAlign:'bottom',paddingRight:'16pt'}}>
                <div style={{borderTop:'1pt solid #333',paddingTop:'4pt',marginTop:'28pt'}}>
                  <div style={{fontSize:'8pt',fontWeight:'bold'}}>Firma y sello</div>
                  <div style={{fontSize:'7pt',color:'#555',marginTop:'2pt'}}>Encargado de Organización · APD</div>
                </div>
              </td>
              <td style={{width:'10%'}}/>
              <td style={{width:'45%',verticalAlign:'bottom',textAlign:'right'}}>
                <div style={{fontSize:'7.5pt',color:'#555',lineHeight:1.7}}>
                  <div style={{color:'#0D3B8C',fontWeight:'bold',marginBottom:'2pt'}}>Alianza por la Democracia — APD</div>
                  <div>Documento generado: {fecha}</div>
                  <div>Total registros: <strong>{total}</strong></div>
                  <div style={{marginTop:'3pt',fontSize:'6.5pt',color:'#aaa'}}>Documento de uso interno y confidencial.</div>
                </div>
              </td>
            </tr></tbody>
          </table>
        </div>

      </div>
    </>
  )
}

export default function ReportePage() {
  return (
    <Suspense fallback={
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial'}}>
        <p style={{color:'#666',fontSize:14}}>Cargando...</p>
      </div>
    }>
      <Reporte/>
    </Suspense>
  )
}
