import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../dist',import.meta.url)));
const port=Number(process.env.STRIDE_PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.onnx':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({app:'stride-local',version:'0.2'}));return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  try{
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const path=resolve(root,relative.slice(1));
    if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    const info=await stat(path);if(!info.isFile())throw new Error('not found');
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':path.includes(`${sep}models${sep}`)?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('File not found. Run npm run build if you are developing STRIDE.');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`STRIDE ready: http://127.0.0.1:${port} (local only)`));
