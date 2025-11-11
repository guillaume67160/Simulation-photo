/* ====== Couleurs RAL (échantillon) ====== */
const RAL = [
  { code:"RAL 9005", name:"Noir foncé",   hex:"#0A0A0A" },
  { code:"RAL 9010", name:"Blanc pur",    hex:"#F1F1EA" },
  { code:"RAL 3020", name:"Rouge vif",    hex:"#CC1F1A" },
  { code:"RAL 2004", name:"Orange pur",   hex:"#F3670A" },
  { code:"RAL 5015", name:"Bleu ciel",    hex:"#007BC0" },
  { code:"RAL 5010", name:"Bleu gentiane",hex:"#0A4C8C" },
  { code:"RAL 6018", name:"Vert",         hex:"#4BA82E" },
  { code:"RAL 7016", name:"Gris anthracite", hex:"#383E42" },
  { code:"RAL 7035", name:"Gris clair",   hex:"#D7D7D7" }
];

/* ====== DOM ====== */
const photoInput   = document.getElementById('photoInput');
const toolSel      = document.getElementById('tool');
const tolRange     = document.getElementById('tolerance');
const featherRange = document.getElementById('feather');
const brushRange   = document.getElementById('brush');
const eraserChk    = document.getElementById('eraser');
const magicControls= document.getElementById('magicControls');
const brushControls= document.getElementById('brushControls');

const selRal       = document.getElementById('ral');
const selFinition  = document.getElementById('finition');
const strengthRange= document.getElementById('strength');

const btnUndo      = document.getElementById('undo');
const btnClear     = document.getElementById('clearMask');
const btnExport    = document.getElementById('export');

const photoCanvas  = document.getElementById('photoCanvas'); // image
const maskCanvas   = document.getElementById('maskCanvas');  // masque
const outCanvas    = document.getElementById('outCanvas');   // rendu final

let pCtx = photoCanvas.getContext('2d', { willReadFrequently:true });
let mCtx = maskCanvas.getContext('2d');
let oCtx = outCanvas.getContext('2d');

let img = new Image();
let drawing = false;
let history = [];
const MAX_HISTORY = 20;

/* ====== Init RAL ====== */
(function initRAL(){
  RAL.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.hex;
    opt.textContent = `${c.code} — ${c.name}`;
    opt.style.backgroundColor = c.hex;
    selRal.appendChild(opt);
  });
  const def = RAL.find(c=>c.code==='RAL 7016') || RAL[0];
  if (def) selRal.value = def.hex;
})();

/* ====== UI ====== */
toolSel.addEventListener('change', ()=>{
  const isMagic = toolSel.value === 'magic';
  magicControls.style.display = isMagic ? 'flex' : 'none';
  brushControls.style.display = isMagic ? 'none' : 'flex';
});
[selRal, selFinition, strengthRange].forEach(el => el.addEventListener('input', renderAll));

btnClear.addEventListener('click', ()=>{
  mCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  pushHistory(); renderAll();
});
btnUndo.addEventListener('click', undoMask);
btnExport.addEventListener('click', exportPNG);

/* ====== Charger photo ====== */
photoInput.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  img.onload = () => {
    setupCanvasForImage(img);
    drawImageContain(img, pCtx, photoCanvas.width, photoCanvas.height);
    mCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
    history = []; pushHistory(); renderAll();
  };
  img.src = url;
});

/* ====== Canvas helpers ====== */
function setupCanvasForImage(){
  const W = 1280, H = 720; // base stable (qualité export)
  [photoCanvas, maskCanvas, outCanvas].forEach(c=>{
    c.width=W; c.height=H; c.style.width='100%'; c.style.height='100%';
  });
  pCtx = photoCanvas.getContext('2d', { willReadFrequently:true });
  mCtx = maskCanvas.getContext('2d');
  oCtx = outCanvas.getContext('2d');
  mCtx.lineCap='round'; mCtx.lineJoin='round';
}
function drawImageContain(image, ctx, W, H){
  const rImg = image.width / image.height;
  const rStage = W / H;
  let dw, dh, dx, dy;
  if (rImg > rStage){ dw=W; dh=Math.round(W/rImg); dx=0; dy=Math.round((H-dh)/2); }
  else{ dh=H; dw=Math.round(H*rImg); dy=0; dx=Math.round((W-dw)/2); }
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(image, dx, dy, dw, dh);
}

/* ====== Historique masque ====== */
function pushHistory(){
  try{
    const snap = mCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height);
    history.push(snap); if (history.length>MAX_HISTORY) history.shift();
  }catch(e){}
}
function undoMask(){
  if (history.length<=1) return;
  history.pop();
  mCtx.putImageData(history[history.length-1],0,0);
  renderAll();
}

/* ====== Coordonnées pointeur (Pointer Events) ====== */
function getPos(ev, canvas){
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX ?? (ev.touches && ev.touches[0].clientX) ?? 0) - rect.left;
  const y = (ev.clientY ?? (ev.touches && ev.touches[0].clientY) ?? 0) - rect.top;
  const sx = x * (canvas.width / rect.width);
  const sy = y * (canvas.height / rect.height);
  return {x:sx, y:sy};
}

/* ====== Pinceau (Pointer Events) ====== */
maskCanvas.addEventListener('pointerdown', (ev)=>{
  if (toolSel.value !== 'brush' || !photoCanvas.width) return;
  drawing = true;
  maskCanvas.setPointerCapture(ev.pointerId);
  const {x,y} = getPos(ev, maskCanvas);
  mCtx.beginPath(); mCtx.moveTo(x,y);
  ev.preventDefault();
});
maskCanvas.addEventListener('pointermove', (ev)=>{
  if (!drawing || toolSel.value !== 'brush') return;
  const {x,y} = getPos(ev, maskCanvas);
  mCtx.lineWidth = parseInt(brushRange.value,10);
  if (eraserChk.checked){
    mCtx.globalCompositeOperation='destination-out';
    mCtx.strokeStyle='rgba(0,0,0,1)';
  } else {
    mCtx.globalCompositeOperation='source-over';
    mCtx.strokeStyle='rgba(255,255,255,1)';
  }
  mCtx.lineTo(x,y); mCtx.stroke();
  renderAll();
  ev.preventDefault();
});
maskCanvas.addEventListener('pointerup', (ev)=>{
  if (!drawing) return;
  drawing = false; mCtx.closePath();
  maskCanvas.releasePointerCapture(ev.pointerId);
  pushHistory();
});
maskCanvas.addEventListener('pointercancel', ()=>{ drawing=false; mCtx.closePath(); });

/* ====== Baguette magique (Pointer Events + correctif coords) ====== */
maskCanvas.addEventListener('pointerdown', (ev)=>{
  if (toolSel.value !== 'magic' || !photoCanvas.width) return;
  const {x,y} = getPos(ev, maskCanvas); // <<< IMPORTANT: coords depuis maskCanvas
  magicWandSelect(Math.round(x), Math.round(y));
  pushHistory();
  renderAll();
  ev.preventDefault();
});

function magicWandSelect(sx, sy){
  const W = photoCanvas.width, H = photoCanvas.height;
  const imgData = pCtx.getImageData(0,0,W,H);
  const data = imgData.data;

  const idx = (sx + sy*W) * 4;
  const sr = data[idx], sg = data[idx+1], sb = data[idx+2];

  const tol = parseInt(tolRange.value,10); // 1..100
  const tol2 = (tol/100) * 255;
  const visited = new Uint8Array(W*H);
  const stack = [[sx,sy]];

  const sel = mCtx.getImageData(0,0,W,H);
  const sdata = sel.data;

  function matches(r,g,b){
    return Math.abs(r-sr)<=tol2 && Math.abs(g-sg)<=tol2 && Math.abs(b-sb)<=tol2;
  }

  while(stack.length){
    const [x,y] = stack.pop();
    if (x<0||y<0||x>=W||y>=H) continue;
    const i = (x + y*W);
    if (visited[i]) continue;
    visited[i]=1;

    const di = i*4;
    const r=data[di], g=data[di+1], b=data[di+2];
    if (matches(r,g,b)){
      sdata[di]=255; sdata[di+1]=255; sdata[di+2]=255; sdata[di+3]=255;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
  }

  const feather = parseInt(featherRange.value,10);
  if (feather>0) boxBlurMask(sdata,W,H,feather);

  mCtx.putImageData(sel,0,0);
}

/* Flou boîte sur alpha (feather) */
function boxBlurMask(sdata, W, H, radius){
  const alpha = new Uint8ClampedArray(W*H);
  for (let i=0;i<W*H;i++) alpha[i] = sdata[i*4+3];

  const tmp = new Uint8ClampedArray(alpha);
  const r = radius;

  // horizontal
  for (let y=0;y<H;y++){
    let sum = 0;
    for (let x=-r; x<=r; x++){
      const xi = Math.min(W-1, Math.max(0, x)) + y*W;
      sum += tmp[xi];
    }
    for (let x=0;x<W;x++){
      const i = x + y*W;
      alpha[i] = sum / (2*r + 1);
      const xAdd = Math.min(W-1, x + r + 1) + y*W;
      const xSub = Math.max(0, x - r) + y*W;
      sum += tmp[xAdd] - tmp[xSub];
    }
  }
  // vertical
  tmp.set(alpha);
  for (let x=0;x<W;x++){
    let sum = 0;
    for (let y=-r; y<=r; y++){
      const yi = x + (Math.min(H-1, Math.max(0, y)))*W;
      sum += tmp[yi];
    }
    for (let y=0;y<H;y++){
      const i = x + y*W;
      alpha[i] = sum / (2*r + 1);
      const yAdd = x + (Math.min(H-1, y + r + 1))*W;
      const ySub = x + (Math.max(0, y - r))*W;
      sum += tmp[yAdd] - tmp[ySub];
    }
  }
  for (let i=0;i<W*H;i++){ sdata[i*4+3] = alpha[i]; }
}

/* ====== Rendu (teinte + finition) ====== */
function renderAll(){
  if (!photoCanvas.width) return;
  const W = photoCanvas.width, H = photoCanvas.height;

  // base
  oCtx.globalCompositeOperation='source-over';
  oCtx.clearRect(0,0,W,H);
  oCtx.drawImage(photoCanvas,0,0);

  // calque couleur limité au masque (multiply)
  const color = selRal.value || '#2196f3';
  const intensity = parseInt(strengthRange.value,10)/100;

  const tmp = document.createElement('canvas');
  tmp.width=W; tmp.height=H;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle=color; tctx.fillRect(0,0,W,H);
  tctx.globalCompositeOperation='destination-in';
  tctx.drawImage(maskCanvas,0,0);

  oCtx.globalCompositeOperation='multiply';
  oCtx.globalAlpha=intensity;
  oCtx.drawImage(tmp,0,0);
  oCtx.globalAlpha=1;

  applyFinish(oCtx, W, H, selFinition.value);
}

function applyFinish(ctx, W, H, fin){
  if (fin==='mat' || fin==='satine'){
    ctx.globalCompositeOperation='overlay';
    const k = fin==='mat' ? 0.06 : 0.03;
    ctx.fillStyle = `rgba(255,255,255,${k})`;
    ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='source-over';
  }
  if (fin==='brillant'){
    ctx.globalCompositeOperation='screen';
    const grad = ctx.createLinearGradient(0,0,W,H*0.6);
    grad.addColorStop(0,'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5,'rgba(255,255,255,0.04)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='source-over';
  }
  if (fin==='sable_fin' || fin==='sable_epais'){
    const density = fin==='sable_epais' ? 0.14 : 0.08;
    const img = ctx.getImageData(0,0,W,H);
    const d = img.data;
    for (let i=0;i<d.length;i+=4){
      if (Math.random()<density){
        const k = fin==='sable_epais' ? 35 : 20;
        d[i]=Math.min(255,d[i]+k);
        d[i+1]=Math.min(255,d[i+1]+k);
        d[i+2]=Math.min(255,d[i+2]+k);
      }
    }
    ctx.putImageData(img,0,0);
  }
}

/* ====== Export PNG ====== */
function exportPNG(){
  if (!outCanvas.width) return;
  const a = document.createElement('a');
  a.download='gc-simulateur-rendu.png';
  a.href = outCanvas.toDataURL('image/png');
  a.click();
}

/* ====== Re-render au resize ====== */
window.addEventListener('resize', ()=>{ if (photoCanvas.width) renderAll(); });
