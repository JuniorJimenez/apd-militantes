'use client'
// app/carta/[cedula]/page.tsx
// Carta pública formal — accesible desde la consulta sin login.
// Misma presentación que la carta admin pero usa API pública.

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

function fmtFecha(d: string | null | undefined, largo = true): string {
  if (!d) return '_______________'
  const dt  = new Date(d)
  const dd  = dt.getDate()
  const mm  = dt.getMonth()
  const yy  = dt.getFullYear()
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return largo ? `${dd} de ${meses[mm]} de ${yy}` : `${String(dd).padStart(2,'0')}/${String(mm+1).padStart(2,'0')}/${yy}`
}

function numRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
  let r = ''; for (let i=0;i<vals.length;i++){while(n>=vals[i]){r+=syms[i];n-=vals[i]}}; return r
}

function CartaPublica() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const cedula = decodeURIComponent(String(params.cedula))
  const tipo   = searchParams.get('tipo') ?? 'afiliacion'

  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    // Usa la API pública — no requiere sesión admin
    fetch(`/api/carta/${encodeURIComponent(cedula)}?tipo=${tipo}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); else setError(j.error) })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [cedula, tipo])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'serif' }}>
      <p style={{ color:'#666' }}>Generando constancia...</p>
    </div>
  )

  if (error || !data) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, fontFamily:'serif', background:'#f5f5f5' }}>
      <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:32, maxWidth:420, textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize:28, marginBottom:8 }}>📄</p>
        <p style={{ color:'#C8001E', fontWeight:700, fontSize:15, marginBottom:8 }}>No se puede emitir la constancia</p>
        <p style={{ color:'#555', fontSize:13, lineHeight:1.6 }}>{error || 'La constancia no está disponible para esta cédula.'}</p>
        <button onClick={() => window.close()} style={{ marginTop:16, color:'#0D3B8C', fontSize:13, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Cerrar</button>
      </div>
    </div>
  )

  const { militante, solicitudDesafiliacion, emitidaEn } = data
  const esAfiliacion   = tipo === 'afiliacion'
  const nombreCompleto = `${militante.nombres} ${militante.apellidos}`.trim()
  const hoy            = fmtFecha(emitidaEn)
  const anioRomano     = numRoman(new Date(emitidaEn).getFullYear())
  const numCarta       = `APD-${esAfiliacion ? 'AF' : 'DA'}-${new Date(emitidaEn).getFullYear()}-${militante.cedula.replace(/\D/g,'').slice(-4)}`

  return (
    <>
      <style>{`
        * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; box-sizing:border-box; }
        @page { size: auto; margin: auto; }
        @media print {
          .no-print { display:none !important; }
          body { margin:0; background:white !important; }
          .print-wrapper { background:white !important; padding:0 !important; display:block !important; }
          .pagina { box-shadow:none !important; margin:0 !important; width:100% !important; min-height:100vh !important; }
        }
        body { margin:0; font-family:'Times New Roman',Times,serif; background:#f0f0f0; }
        .print-wrapper { background:#e5e7eb; padding:24px 16px; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .pagina { width:215.9mm; min-height:279.4mm; margin:0 auto; background:white; padding:22mm 25mm 20mm; box-shadow:0 2px 20px rgba(0,0,0,0.15); position:relative; }
      `}</style>

      {/* Barra de herramientas */}
      <div className="no-print" style={{ background:'#0D3B8C', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:'sans-serif', position:'sticky', top:0, zIndex:10 }}>
        <span style={{ color:'white', fontWeight:600, fontSize:13 }}>
          Constancia {esAfiliacion ? 'de Afiliación' : 'de Desafiliación'} — {militante.cedula}
        </span>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => window.history.back()} style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:12 }}>
            ← Volver
          </button>
          <button onClick={() => window.print()} style={{ background:'white', color:'#0D3B8C', fontWeight:700, border:'none', borderRadius:6, padding:'6px 16px', cursor:'pointer', fontSize:13 }}>
            🖨 Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="no-print" style={{ textAlign:'center', padding:'8px 16px', background:'#e5e7eb' }}>
        <p style={{ fontSize:11, color:'#9ca3af', fontFamily:'sans-serif' }}>
          Activa <strong>«Gráficos de fondo y márgenes en (Ninguno)»</strong> en las opciones de impresión para conservar colores y escudo
        </p>
      </div>

      <div className="print-wrapper">
        <div className="pagina">
          {/* Franja tricolor superior */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:6, background:'linear-gradient(to right,#0D3B8C 0 33.33%,#F5C400 33.33% 66.66%,#C8001E 66.66% 100%)' }}/>

          {/* Encabezado */}
          <table style={{ width:'100%', borderBottom:'2px solid #0D3B8C', paddingBottom:6, marginBottom:16 }}>
            <tbody><tr>
              <td style={{ width:150, verticalAlign:'middle' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-apd.png" alt="APD" style={{ width:160, height:160, objectFit:'contain' }}/>
              </td>
              <td style={{ verticalAlign:'middle', paddingLeft:12 }}>
                <p style={{ margin:0, fontSize:18, fontWeight:'bold', color:'#0D3B8C', letterSpacing:1 }}>ALIANZA POR LA DEMOCRACIA</p>
                <p style={{ margin:0, fontSize:11, color:'#555', marginTop:2 }}>Partido Político — República Dominicana</p>
                <p style={{ margin:0, fontSize:10, color:'#888', marginTop:1 }}>Fundado el 2 de agosto de 1992</p>
              </td>
              <td style={{ width:220, textAlign:'right', verticalAlign:'middle', whiteSpace:'nowrap' }}>
                <p style={{ margin:0, fontSize:10, color:'#888', whiteSpace:'nowrap' }}>Ref.: {numCarta}</p>
                <p style={{ margin:0, fontSize:10, color:'#888', marginTop:2, whiteSpace:'nowrap' }}> Santo Domingo, {hoy}
				</p>
              </td>
            </tr></tbody>
          </table>

          {/* Título */}
          <p style={{ textAlign:'center', fontSize:15, fontWeight:'bold', color:'#0D3B8C', textTransform:'uppercase', letterSpacing:2, margin:'20px 0 24px', textDecoration:'underline' }}>
            CERTIFICACIÓN DE {esAfiliacion ? 'AFILIACIÓN' : 'DESAFILIACIÓN'} PARTIDARIA
          </p>

          {/* Cuerpo */}
          <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
            El suscrito <strong>Dr. Max Puig</strong>, en su calidad de <strong>Presidente de la Alianza por la Democracia (APD)</strong>, partido político debidamente reconocido conforme a la legislación electoral de la República Dominicana, en el ejercicio de sus atribuciones estatutarias y legales,
          </p>
          <p style={{ textAlign:'center', fontSize:12, fontWeight:'bold', margin:'14px 0', letterSpacing:1 }}>CERTIFICA:</p>

          {esAfiliacion ? (
            <>
              <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
                Que el/la ciudadano/a <strong>{nombreCompleto}</strong>, portador/a de la Cédula de Identidad y Electoral número <strong>{militante.cedula}</strong>, natural de la provincia de <strong>{militante.provincia}</strong>, municipio de <strong>{militante.municipio}</strong>, figura <strong>debidamente afiliado/a</strong> en el Padrón Oficial de Militantes de la Alianza por la Democracia, con la categoría de <strong>{militante.tipoMilitancia}</strong>.
              </p>
              <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
                Que dicha afiliación fue registrada en el sistema de padrón digital del partido con fecha <strong>{fmtFecha(militante.createdAt)}</strong>{militante.verifiedAt ? `, habiendo sido verificada su identidad el día ${fmtFecha(militante.verifiedAt)}` : ''}, encontrándose en estado <strong>ACTIVO</strong> al momento de la presente certificación.
              </p>
              <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
                La presente certificación se expide a solicitud del/la interesado/a, para los fines legales y administrativos correspondientes, en la ciudad de Santo Domingo, Distrito Nacional, a los <strong>{hoy}</strong>.
              </p>
            </>
          ) : (
            <>
              <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
                Que el/la ciudadano/a <strong>{nombreCompleto}</strong>, portador/a de la Cédula de Identidad y Electoral número <strong>{militante.cedula}</strong>, natural de la provincia de <strong>{militante.provincia}</strong>, municipio de <strong>{militante.municipio}</strong>, quien fuera miembro de la Alianza por la Democracia con la categoría de <strong>{militante.tipoMilitancia}</strong>, presentó solicitud formal de <strong>desafiliación voluntaria</strong> del partido.
              </p>
              {solicitudDesafiliacion && (
                <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
                  Que dicha solicitud de tipo <strong>{solicitudDesafiliacion.tipoSolicitud?.replace(/_/g,' ')}</strong>, presentada en fecha <strong>{fmtFecha(solicitudDesafiliacion.fechaSolicitud)}</strong>, fue debidamente procesada y cerrada en fecha <strong>{fmtFecha(solicitudDesafiliacion.fechaCierre)}</strong>, quedando el/la ciudadano/a <strong>formalmente desafiliado/a</strong> del padrón oficial del partido.
                </p>
              )}
              <p style={{ textAlign:'justify', lineHeight:1.85, fontSize:12, marginBottom:14 }}>
                En consecuencia, el/la ciudadano/a mencionado/a no ostenta en la actualidad ninguna membresía, cargo ni representación en nombre de la Alianza por la Democracia. La presente certificación se expide para los fines legales que correspondan, en la ciudad de Santo Domingo, Distrito Nacional, a los <strong>{hoy}</strong>.
              </p>
            </>
          )}

          <p style={{ textAlign:'center', fontSize:11, color:'#555', marginTop:8 }}>
            Año {anioRomano} de la fundación de la Alianza por la Democracia.
          </p>

          {/* Firma */}
          <div style={{ marginTop:56, display:'flex', justifyContent:'center' }}>
            <div style={{ textAlign:'center', minWidth:220 }}>
              <div style={{ borderTop:'1.5px solid #333', paddingTop:8, marginTop:56 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:'bold', color:'#0D3B8C' }}>Dr. Max Puig</p>
                <p style={{ margin:0, fontSize:11, color:'#444', marginTop:2 }}>Presidente</p>
                <p style={{ margin:0, fontSize:11, color:'#444' }}>Alianza por la Democracia — APD</p>
              </div>
            </div>
          </div>

          {/* Sello */}
          <div style={{ marginTop:20, display:'flex', justifyContent:'flex-end' }}>
            <div style={{ width:90, height:90, borderRadius:'50%', border:'2.5px solid #0D3B8C', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', color:'#0D3B8C', padding:8 }}>
              <p style={{ margin:0, fontSize:7, fontWeight:'bold', letterSpacing:.5, lineHeight:1.3 }}>ALIANZA POR</p>
              <p style={{ margin:0, fontSize:7, fontWeight:'bold', letterSpacing:.5, lineHeight:1.3 }}>LA DEMOCRACIA</p>
              <div style={{ width:24, height:1.5, background:'#0D3B8C', margin:'3px 0' }}/>
              <p style={{ margin:0, fontSize:6, color:'#555', lineHeight:1.4 }}>PARTIDO POLÍTICO</p>
              <p style={{ margin:0, fontSize:6, color:'#555', lineHeight:1.4 }}>REP. DOMINICANA</p>
            </div>
          </div>

          {/* Pie */}
          <div style={{ position:'absolute', bottom:16, left:25, right:25, borderTop:'1px solid #ddd', paddingTop:8 }}>
            <p style={{ margin:0, fontSize:9, color:'#aaa', textAlign:'center' }}>
              Documento generado digitalmente — {numCarta} — {hoy} — Sistema de Padrón APD
            </p>
          </div>

          {/* Franja tricolor inferior */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:5, background:'linear-gradient(to right,#0D3B8C 0 33.33%,#F5C400 33.33% 66.66%,#C8001E 66.66% 100%)' }}/>
        </div>
      </div>
    </>
  )
}

export default function CartaPublicaPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <p style={{ fontFamily:'serif', color:'#666' }}>Cargando...</p>
      </div>
    }>
      <CartaPublica/>
    </Suspense>
  )
}
