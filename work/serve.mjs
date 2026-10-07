import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.sql':'text/plain'};
http.createServer(async (request, response) => {
  try {
    let name = decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1) || 'index.html';
    if (name === 'qa.html') {
      response.writeHead(200, {'content-type':'text/html','cache-control':'no-store'});
      response.end('<!doctype html><title>SCOUTCARD browser checks</title><button id="run">Run isolated checks</button><pre id="results"></pre><iframe id="preview" style="width:375px;height:812px"></iframe><script type="module" src="qa-runner.js"></script>'); return;
    }
    if (name === 'qa-runner.js') {
      response.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});
      response.end(await readFile(resolve(root,'work/browser-qa.js'))); return;
    }
    const isolated = name.startsWith('__qa/');
    if (isolated) name = name.slice(5) || 'index.html';
    if (isolated && name === 'mock-sdk.js') {
      const test = await readFile(resolve(root,'work/regression.cjs'),'utf8');
      let mock = test.match(/const mock = `([\s\S]*?)`;/)[1];
      mock += "\nif(new URLSearchParams(location.search).has('qa-public'))state.profile={id:'00000000-1111-4222-8333-000000000001',slug:'public-athlete',display_name:'<img src=x onerror=alert(1)>',sport:'Soccer',graduation_year:'2028',position:'Forward',is_public:true,highlight_url:'javascript:alert(1)',details:{stats:'12 goals',events:'Showcase, October 12'}};";
      response.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});response.end(mock);return;
    }
    if (name.includes('/') || name.includes('..') || !types[extname(name)]) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'content-type':types[extname(name)], 'cache-control':'no-store'});
    let source = await readFile(resolve(root,name),'utf8');
    if (isolated && name==='scoutcard-client.js') source=source.replace("'./assets/vendor/supabase-client.js'", "'/__qa/mock-sdk.js'");
    if (isolated && name==='order-demo.js') source=source.replace('window.location.assign(', 'window.__qaCheckout(');
    response.end(source);
  } catch { response.writeHead(404).end(); }
}).listen(Number(process.env.SCOUTCARD_PORT || 4174),'127.0.0.1',()=>console.log('SCOUTCARD preview server ready'));
