/**
 * Builds the self-contained HTML rendered by the secure viewer.
 *
 * The decrypted document is embedded in memory as base64 — it is never written
 * to disk. A strict Content-Security-Policy forbids every network request
 * (default-src 'none', no connect-src to http/https), so even a malicious PDF
 * cannot exfiltrate anything.
 */

export const VIEWER_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  'worker-src blob:',
  'img-src data: blob:',
  "style-src 'unsafe-inline'",
  'font-src data: blob:',
  'connect-src data: blob:',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
].join('; ');

const BASE_STYLE = `
  html,body{margin:0;padding:0;background:#05080F;color:#EAF0FA;
    font-family:-apple-system,system-ui,Roboto,sans-serif;-webkit-user-select:none;user-select:none;
    -webkit-touch-callout:none}
  .wrap{padding:12px;display:flex;flex-direction:column;align-items:center;gap:12px}
  img,canvas{max-width:100%;height:auto;border-radius:10px;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.45)}
  pre{white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.5;padding:16px;margin:0}
  .msg{color:#9AA8C2;font-size:14px;padding:40px 16px;text-align:center}
`;

function shell(body: string, scripts = ''): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${VIEWER_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=6, user-scalable=yes">
<meta name="referrer" content="no-referrer">
<style>${BASE_STYLE}</style></head><body>${body}${scripts}</body></html>`;
}

const post = `function post(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m))}catch(e){}}`;

export function imageHtml(base64: string, mimeType: string): string {
  const safeMime = /^image\/[a-z0-9.+-]+$/i.test(mimeType) ? mimeType : 'image/jpeg';
  return shell(
    `<div class="wrap"><img id="img" alt="" src="data:${safeMime};base64,${base64}"></div>`,
    `<script>${post}
     var i=document.getElementById('img');
     i.onload=function(){post({type:'loaded',pages:1})};
     i.onerror=function(){post({type:'error',message:'This image format cannot be displayed on this device.'})};</script>`,
  );
}

export function textHtml(text: string): string {
  const esc = text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return shell(`<pre>${esc}</pre>`, `<script>${post}post({type:'loaded',pages:1})</script>`);
}

export function pdfHtml(base64: string, lib: string, worker: string): string {
  // lib / worker are JSON-encoded JS string literals (see scripts/bundle-pdfjs.js).
  return shell(
    `<div class="wrap" id="pages"><div class="msg" id="status">Decrypting and rendering…</div></div>`,
    `<script type="module">
${post}
const LIB=${lib};
const WORKER=${worker};
let DATA="${base64}";
const blobUrl=(src)=>URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
try{
  const pdfjs=await import(blobUrl(LIB));
  pdfjs.GlobalWorkerOptions.workerSrc=blobUrl(WORKER);
  const raw=atob(DATA); DATA=null;
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const doc=await pdfjs.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,
    disableAutoFetch:true,disableStream:true,stopAtErrors:false,useSystemFonts:true}).promise;
  const host=document.getElementById('pages');
  document.getElementById('status').remove();
  const cssWidth=Math.min(window.innerWidth-24,1400);
  const dpr=Math.min(window.devicePixelRatio||1,3);
  for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n);
    const base=page.getViewport({scale:1});
    let scale=(cssWidth/base.width)*dpr*1.5;
    const maxPx=16e6; if(base.width*base.height*scale*scale>maxPx)scale=Math.sqrt(maxPx/(base.width*base.height));
    const vp=page.getViewport({scale});
    const c=document.createElement('canvas');
    c.width=Math.floor(vp.width); c.height=Math.floor(vp.height);
    c.style.width=cssWidth+'px'; c.style.height=Math.floor(cssWidth*vp.height/vp.width)+'px';
    host.appendChild(c);
    await page.render({canvas:c,canvasContext:c.getContext('2d'),viewport:vp}).promise;
    page.cleanup();
  }
  post({type:'loaded',pages:doc.numPages});
}catch(e){
  const s=document.getElementById('status'); if(s)s.textContent='This PDF could not be displayed.';
  post({type:'error',message:String(e&&e.message||e)});
}
</script>`,
  );
}
