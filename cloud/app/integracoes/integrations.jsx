"use client";
import { useEffect,useRef,useState } from "react";
const labels={gmail:"Gmail",calendar:"Agenda",drive:"Drive"};
const notices={connected:"Autorização salva. Consulte um serviço para verificar o acesso.",failed:"Não foi possível conectar. Tente novamente.",account_mismatch:"Escolha a mesma conta Google usada para entrar no Jarvis.",consent_denied:"A autorização foi cancelada. Você pode conectar quando quiser."};
const errors={not_connected:"Conecte sua conta Google para consultar.",permission_denied:"O serviço não está autorizado ou sua API ainda não foi habilitada. Reconecte e confira as permissões.",reconnect:"Sua autorização expirou. Conecte novamente.",unauthorized:"Sua sessão expirou. Entre novamente."};
async function json(response){const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
export function Integrations({outcome}) {
  const notice=typeof outcome==="string"&&Object.hasOwn(notices,outcome)?notices[outcome]:null;
  const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState(null);
  const active=useRef(false);
  useEffect(()=>{fetch("/api/google",{cache:"no-store"}).then(json).then(setStatus).catch(()=>setError("Não foi possível consultar a conexão."));},[]);
  async function run(operation,service){
    if(active.current)return;active.current=true;setBusy(true);setError("");setResult(null);
    try{const data=await json(await fetch("/api/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation,...(service?{service}:{})})}));
      if(operation==="disconnect")setStatus({connected:false,services:{}});else setResult({...data,service});
    }catch(e){setError(errors[e.message]||"A consulta não foi concluída. Tente novamente em alguns instantes.");}
    finally{active.current=false;setBusy(false);}
  }
  return <>
    {notice&&<p role="status">{notice}</p>}
    <article><h2>{status?.connected?"Conexão salva":"Conectar Google"}</h2>
      {status?.email&&<p>{status.email}</p>}
      <p>Permissões somente para leitura: emails, eventos da agenda e metadados de arquivos. O Jarvis não poderá enviar emails, alterar compromissos ou editar arquivos nesta etapa.</p>
      <p>Use a mesma conta do login. Você escolhe as permissões na tela do Google.</p>
      <form method="post" action="/api/google/connect"><button disabled={busy||!status}>{status?.connected?"Revisar autorização":"Conectar com Google"}</button></form>
      {status?.connected&&<p><button className="secondary" disabled={busy} onClick={()=>run("disconnect")}>Desconectar do Jarvis</button></p>}
    </article>
    <div className="grid">{Object.entries(labels).map(([service,label])=><article key={service}><h2>{label}</h2><p>{status?.services?.[service]?"Permissão salva; consulte para verificar o acesso atual.":"Sem permissão salva."}</p><p><button className="secondary" disabled={busy||!status?.services?.[service]} onClick={()=>run("read",service)}>Consultar {label}</button></p></article>)}</div>
    {busy&&<p role="status">Consultando…</p>}{error&&<p className="error" role="alert">{error}</p>}
    {result&&<section aria-label="Resultado da consulta"><h2>{labels[result.service]}</h2><p>{result.description}</p>{!result.items.length&&<p>Nenhum item visível nesta consulta.</p>}
      {result.items.map((item,index)=><article className="integration-result" key={index}><h3>{item.title}</h3><p>{item.detail}</p><small>{item.date}</small></article>)}{result.more&&<p>Há mais resultados no Google; esta consulta mostra somente os primeiros 10.</p>}</section>}
    <p className="muted">As consultas são feitas quando você toca nos botões. Os resultados não são enviados ao Gemini nem salvos no histórico do chat. Desconectar remove as credenciais salvas no Jarvis; você também pode revogar o acesso nas permissões da sua conta Google.</p>
  </>;
}
