import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.sql':'text/plain', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
http.createServer(async (request, response) => {
  try {
    let name = decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1) || 'index.html';
    if(name==='email-qa.html'){response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});response.end('<!doctype html><title>Recruiting email verification</title><button id="run">Run recruiting email checks</button><pre id="results" style="white-space:pre-wrap"></pre><iframe id="preview" style="width:390px;height:844px;border:1px solid #ccc"></iframe><script type="module" src="email-qa.js"></script>');return;}
    if(name==='email-qa.js'){response.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});response.end(await readFile(resolve(root,'work/recruiting-email-qa.js')));return;}
    if(name==='onboarding-qa.html'){response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});response.end('<!doctype html><title>Private onboarding checks</title><button id="run">Run onboarding checks</button><pre id="results"></pre><iframe id="preview" style="width:390px;height:844px;border:1px solid #ccc"></iframe><script type="module" src="onboarding-qa.js"></script>');return;}
    if(name==='onboarding-qa.js'){response.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});response.end(await readFile(resolve(root,'work/onboarding-qa.js')));return;}
    if(name==='parent-sql-review.html') { const query=new URL(request.url,'http://localhost').searchParams.has('checks')?'work/parent-db-test.sql':'parent-accounts-setup.sql';const source=(await readFile(resolve(root,query),'utf8')).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});response.end('<!doctype html><title>Reviewed parent account SQL</title><pre id="sql">'+source+'</pre>');return; }
    if(name==='family-qa.html') { response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});response.end('<!doctype html><title>Parent account checks</title><button id="run">Run parent checks</button><pre id="results"></pre><iframe id="preview" style="width:375px;height:812px"></iframe><script type="module" src="family-qa.js"></script>');return; }
    if(name==='family-qa.js'||name==='parent-check.sql') { response.writeHead(200,{'content-type':name.endsWith('.sql')?'text/plain':'text/javascript','cache-control':'no-store'});response.end(await readFile(resolve(root,name==='parent-check.sql'?'work/parent-db-test.sql':'work/family-qa.js')));return; }
    if (name === 'qa.html') {
      response.writeHead(200, {'content-type':'text/html','cache-control':'no-store'});
      response.end('<!doctype html><title>SCOUTCARD browser checks</title><button id="run">Run isolated checks</button><pre id="results"></pre><iframe id="preview" style="width:375px;height:812px"></iframe><script type="module" src="qa-runner.js"></script>'); return;
    }
    if (name === 'qa-runner.js') {
      response.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});
      response.end(await readFile(resolve(root,'work/browser-qa.js'))); return;
    }
    if (name === 'marketing-qa.html') {
      response.writeHead(200, {'content-type':'text/html','cache-control':'no-store'});
      response.end('<!doctype html><title>SCOUTCARD layout checks</title><button id="run">Run marketing checks</button><pre id="results"></pre><iframe id="preview" style="height:812px;border:0"></iframe><script type="module" src="marketing-qa.js"></script>'); return;
    }
    if (name === 'marketing-qa.js') {
      response.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});
      response.end(await readFile(resolve(root,'work/marketing-qa.js'))); return;
    }
    const isolated = name.startsWith('__qa/');
    if (isolated) name = name.slice(5) || 'index.html';
    if (isolated && name === 'mock-sdk.js') {
      const test = await readFile(resolve(root,'work/regression.cjs'),'utf8');
      let mock = test.match(/const mock = `([\s\S]*?)`;/)[1];
      mock += '\n'+await readFile(resolve(root,'work/family-mock.js'),'utf8');
      mock += '\n'+await readFile(resolve(root,'work/onboarding-mock.js'),'utf8');
      mock += "\nif(new URLSearchParams(location.search).has('qa-public'))state.profile={id:'00000000-1111-4222-8333-000000000001',slug:'public-athlete',display_name:'<img src=x onerror=alert(1)>',sport:'Soccer',graduation_year:'2028',position:'Forward',is_public:true,highlight_url:'javascript:alert(1)',details:{stats:'12 goals',events:'Showcase, October 12'}};";
      mock += "\nif(new URLSearchParams(location.search).has('qa-saved'))state.profile=JSON.parse(sessionStorage.getItem('qa-profile')||'null');if(new URLSearchParams(location.search).has('qa-photo-error'))state.failPhoto=true;";
      response.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});response.end(mock);return;
    }
    if (name.includes('..') || (name.includes('/') && !name.startsWith('assets/')) || !types[extname(name)]) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'content-type':types[extname(name)], 'cache-control':'no-store'});
    let source = await readFile(resolve(root,name));
    if (isolated && name==='scoutcard-client.js') source=source.toString().replace("'./assets/vendor/supabase-client.js'", "'/__qa/mock-sdk.js'");
    if (isolated && name==='order-demo.js') source=source.toString().replace('window.location.assign(', 'window.__qaCheckout(');
    response.end(source);
  } catch { response.writeHead(404).end(); }
}).listen(Number(process.env.SCOUTCARD_PORT || 4174),'127.0.0.1',()=>console.log('SCOUTCARD preview server ready'));
