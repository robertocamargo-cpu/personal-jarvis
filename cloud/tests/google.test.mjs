import assert from "node:assert/strict";
import { test } from "node:test";
import { authorization, stateMatches, seal, unseal, googleConfiguration, parseOperation, SCOPES, CALLBACK } from "../lib/google/policy.mjs";
import { readService, validateGrant, exchange } from "../lib/google/provider.mjs";
const key="a".repeat(64);
test("Google credentials fail closed and encryption binds ciphertext to the account",()=>{
  assert.equal(googleConfiguration({}),null);
  const value=seal({refresh:"synthetic-refresh"},"owner-a",key);
  assert.ok(!value.includes("synthetic-refresh"));
  assert.equal(unseal(value,"owner-a",key).refresh,"synthetic-refresh");
  assert.throws(()=>unseal(value,"owner-b",key));
  const tampered=Buffer.from(value,"base64");tampered[15]^=1;
  assert.throws(()=>unseal(tampered.toString("base64"),"owner-a",key));
});
test("Google authorization uses fixed callback, CSRF state, PKCE and read scopes",()=>{
  const flow=authorization({clientId:"client"},"owner@example.test"), url=new URL(flow.url);
  assert.equal(url.origin,"https://accounts.google.com");
  assert.equal(url.searchParams.get("redirect_uri"),CALLBACK);
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.ok(stateMatches(flow.state,flow.state));
  assert.ok(!stateMatches(flow.state,"wrong"));assert.ok(!stateMatches(null,null));
  const scopes=url.searchParams.get("scope").split(" ");
  assert.deepEqual(scopes,["openid","email",...Object.values(SCOPES)]);
  assert.notEqual(authorization({clientId:"client"},"owner@example.test").state,flow.state);
});
test("Google operations cannot send messages, inject owners or request arbitrary URLs",()=>{
  for(const body of [{operation:"send"},{operation:"read",service:"gmail",owner:"other"},{operation:"read",service:"https://evil.test"},{operation:"disconnect",service:"gmail"}]) assert.throws(()=>parseOperation(body));
  assert.equal(parseOperation({operation:"read",service:"calendar"}).service,"calendar");
});
test("OAuth grant requires the verified login account and preserves partial consent",()=>{
  const token={access_token:"access",refresh_token:"refresh",expires_in:3600,scope:SCOPES.calendar};
  const account={email:"owner@example.test"}, user={email:account.email,email_verified:true};
  assert.deepEqual(validateGrant(token,user,account),[SCOPES.calendar]);
  assert.throws(()=>validateGrant(token,{...user,email:"other@example.test"},account),/account_mismatch/);
  assert.throws(()=>validateGrant({...token,refresh_token:null},user,account),/incomplete_grant/);
});
test("Google read adapters use GET only and expose bounded metadata without tokens",async()=>{
  const requests=[];
  const fetcher=async(url,options)=>{
    requests.push({url,options}); assert.equal(options.method,undefined);
    if(url.includes("/messages?"))return Response.json({messages:[{id:"message"}],nextPageToken:"next"});
    if(url.includes("/messages/message"))return Response.json({payload:{headers:[{name:"Subject",value:"Synthetic subject"},{name:"From",value:"sender@example.test"}]},privateToken:"never-return"});
    if(url.includes("/calendar/"))return Response.json({items:[{summary:"Synthetic event",start:{date:"2026-09-07"}}]});
    return Response.json({files:[{name:"Synthetic file",mimeType:"text/plain",modifiedTime:"2026-09-06"}]});
  };
  for(const service of Object.keys(SCOPES)){const data=await readService(service,"access",fetcher);assert.equal(data.items.length,1);assert.ok(!JSON.stringify(data).includes("never-return"));}
  assert.equal(requests.length,4);
  assert.ok(requests.every(r=>r.options.headers.Authorization==="Bearer access"));
});
test("OAuth failures do not expose the upstream body or retry a code",async()=>{
  let count=0;
  await assert.rejects(exchange({clientId:"id",clientSecret:"secret"},"code","verifier",async()=>{count++;return new Response("private-secret-body",{status:400});}),error=>!error.message.includes("private-secret-body"));
  assert.equal(count,1);
});
