import*as q from"os";import{Worker as W}from"worker_threads";import{ensureDirSync as h}from"fs-extra";import{exec as C}from"shelljs";var l=[],x=q.cpus(),p=x.length,S=/CREATE TABLE IF NOT EXISTS ([^\s]+) \(/,b=[],m=0,k=!1,g=0;async function T(e,n,u){return new Promise(c=>{function a(o,s){let t=new W(e),r=null;function i(){!r&&l.length&&(g+=1,r=l.shift(),t.postMessage(r.message))}t.on("online",()=>{b.push({takeWork:i,shutdown:()=>t.terminate()}),i()}).on("message",async f=>{if(f===!0){if(g-=1,l.length===0&&g===0&&u()===!0)return c(!0)}else{if(r===null)return;r.resolve(f),r=null,i()}}).on("error",f=>{console.error(f)}),n(t,s)}x.forEach(a)})}var w=async e=>new Promise((n,u)=>{l.push({resolve:n,reject:u,message:e});let c=0;for(let a of b){if(c===m){a.takeWork(),m=(m+1)%p;break}c+=1}}),y=async(e,n,u,c,a=!1)=>(h(e),T(__dirname+"/../dist/insert.js",(o,s)=>{o.postMessage({type:"connect",path:e+"/"+n+"."+s+".sqlite",transactions:c.toString()||"function (sql) { return sql }"}),o.postMessage({sql:u})},()=>{if(l.length>0||a===!1||k)return!1;k=!0,b.forEach(t=>t.shutdown());let o=e+"/"+n+".sqlite",s=[`(rm -f "${o}" && touch "${o}")`];for(let t=0;t<p;t++){let r=e+"/"+n+"."+t+".sqlite",i=u.match(S)[1];s.push(`(sqlite3 "${r}" ".dump ${i}" | sed -e 's/CREATE TABLE ${i} /CREATE TABLE IF NOT EXISTS ${i} /' | sqlite3 "${o}")`),s.push(`(rm -f "${r}" && rm -f "${r}-journal")`)}return C(`((${s.join(" && ")}) & wait)`),!0}));import $ from"better-sqlite3";import{ensureFileSync as j}from"fs-extra";var d={},E=e=>(d[e]===void 0&&(j(e),d[e]=new $(e,{verbose:console.log})),d[e]),D=async e=>w({type:"collection",data:e});var P=y,X=D,_=E,G=p;export{X as enqueue,_ as getDb,P as startWriters,G as workerCount};
//# sourceMappingURL=index.js.map