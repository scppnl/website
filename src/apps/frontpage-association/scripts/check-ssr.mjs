import worker from '../dist/server/index.js';
for (const path of ['/', '/speltakken', '/verhuur', '/contact', '/downloads']) {
 const r=await worker.fetch(new Request('https://scouting-petrus-paulus.michelsown.chatgpt.site'+path)); const html=await r.text();
 if(r.status!==200||!html.includes('<h1')||!html.includes('ngh='))throw new Error(path+': '+html.slice(0,1000));
 console.log(path, r.status, 'rendered HTML with hydration markers');
}
