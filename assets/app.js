'use strict';
// Showcase Studio: no backend; all media processing occurs in the browser.
const $ = (id) => document.getElementById(id);
const playSvg = (playing=false) => playing ? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const setPlayerIcon = playing => { $('playPause').innerHTML = playSvg(playing); };

const canvas = $('previewCanvas');
const g = canvas.getContext('2d', { alpha: false });
const video = $('sourceVideo');
const musicEl = $('musicElement');
const state = {
  file: null, url: null, audioUrl: null, loaded: false, duration: 0,
  trimStart: 0, trimEnd: 0, format: 'landscape', theme: 'violet',
  rendering: false, recorder: null, chunks: [], raf: 0, cancelled: false,
  ctx: null, mix: null, videoGain: null, musicGain: null, mediaAudioNode: null,
  customAudioNode: null, synth: null, synthTimer: null, synthNotes: 0,
  lastPreviewTime: 0, sampleLoading: false, queuedDownload: null, logo: null, logoUrl: null,
};
const formats = {
  linkedin: { w: 720, h: 900, label: 'LinkedIn · 4:5' },
  reels: { w: 720, h: 1280, label: 'Reels / Shorts · 9:16' },
  landscape: { w: 1280, h: 720, label: 'Landscape · 16:9' },
};
const exportSizes = {
  high: { linkedin: [1080,1350], reels: [1080,1920], landscape: [1920,1080] },
  standard: { linkedin: [720,900], reels: [720,1280], landscape: [1280,720] },
};
const getExportSize = () => exportSizes[$('exportQuality').value]?.[state.format] || exportSizes.high.landscape;
const themes = {
  violet: ['#080f29', '#312466', '#8754b5'],
  ocean: ['#06172a', '#123e73', '#0d9dbe'],
  carbon: ['#090c17', '#283247', '#4b5669'],
};
const persistIds = ['projectName','hookText','captionText','outroText','brandText','accentColor','captionsEnabled','outroEnabled','zoomEnabled','originalSound','musicPreset','musicVolume','exportContainer','exportQuality'];
const read = (id) => $(id).type === 'checkbox' ? $(id).checked : $(id).value;
const toHexRgb = (hex) => { const m = /^#([a-f0-9]{6})$/i.exec(hex || '');return m ? [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)] : [150,102,255]; };
const clock = (sec) => { const v=Math.max(0,Math.floor(Number.isFinite(sec)?sec:0));return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;};
const slug = (s) => String(s||'showcase').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,45) || 'showcase';
const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
function saveSettings(){
  const data = Object.fromEntries(persistIds.map(k=>[k,read(k)]));
  data.format=state.format;data.theme=state.theme;
  try { localStorage.setItem('showcase-studio-project',JSON.stringify(data)); } catch {}
  $('projectState').textContent='';
}
function restoreSettings(){
  try {
    const data=JSON.parse(localStorage.getItem('showcase-studio-project')||localStorage.getItem('showcase-studio-v03')||'{}');
    for(const key of persistIds){if(data[key]!==undefined){if($(key).type==='checkbox')$(key).checked=!!data[key];else $(key).value=String(data[key]);}}
    if(data.format in formats)state.format=data.format;
    if(data.theme in themes)state.theme=data.theme;
  } catch {}
  setFormat(state.format,false);setTheme(state.theme,false);
  $('volumeValue').textContent=$('musicVolume').value+'%';
}
function setTheme(theme,save=true){
  state.theme=theme;
  document.querySelectorAll('.theme-option').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));
  if(save)saveSettings();
  drawFrame();
}
function setFormat(format,save=true){
  state.format=format;
  const f=formats[format]; canvas.width=f.w;canvas.height=f.h;
  $('previewLabel').textContent=f.label;
  document.querySelectorAll('.format-option').forEach(b=>b.classList.toggle('active',b.dataset.format===format));
  document.querySelectorAll('[data-preview-format]').forEach(b=>b.classList.toggle('active',b.dataset.previewFormat===format));
  if(save)saveSettings();drawFrame();
}
function roundRect(x,y,w,h,r,fill){g.fillStyle=fill;g.beginPath();g.roundRect(x,y,w,h,Math.max(0,r));g.fill();}
function alpha(rgb,amount){return `rgba(${rgb.join(',')},${clamp(amount,0,1)})`;}
function wrapText(text,limit,desiredSize,lines=2){
  const words=(text||'').trim().split(/\s+/).filter(Boolean), built=[];let line='';
  for(const word of words){const nxt=line?line+' '+word:word;if(g.measureText(nxt).width>limit&&line){built.push(line);line=word;}else line=nxt;}
  if(line)built.push(line);
  const result=built.slice(0,lines);
  if(built.length>lines&&result.length){let last=result[lines-1];while(last.length>2&&g.measureText(last+'…').width>limit)last=last.slice(0,-1);result[lines-1]=last+'…';}
  return result;
}
function paintText(text,x,y,maxWidth,fontSize,options={}){
  const {align='center',weight=850,fill='#fff',maxLines=3,lineHeight=1.14}=options;
  if(!String(text||'').trim())return 0;
  let size=fontSize;let result=[];
  while(size>15){g.font=`${weight} ${size}px system-ui, sans-serif`;result=wrapText(text,maxWidth,size,maxLines);if(result.length<=maxLines&&result.every(t=>g.measureText(t).width<=maxWidth))break;size-=3;}
  g.font=`${weight} ${size}px system-ui, sans-serif`;g.textAlign=align;g.textBaseline='top';g.fillStyle=fill;
  result.forEach((t,i)=>g.fillText(t,x,y+i*size*lineHeight));
  return result.length*size*lineHeight;
}
function paintBackdrop(W,H,rgb){
  const colors=themes[state.theme];
  const fill=g.createLinearGradient(0,0,W,H);fill.addColorStop(0,colors[0]);fill.addColorStop(.63,colors[1]);fill.addColorStop(1,colors[2]);g.fillStyle=fill;g.fillRect(0,0,W,H);
  let glow=g.createRadialGradient(W*.78,H*.29,1,W*.78,H*.29,W*.68);glow.addColorStop(0,alpha(rgb,.38));glow.addColorStop(1,alpha(rgb,0));g.fillStyle=glow;g.fillRect(0,0,W,H);
  g.strokeStyle=alpha(rgb,.13);g.lineWidth=1;
  for(let i=0;i<11;i++){g.beginPath();g.arc(W*.72,H*.42,W*(.2+i*.055),0,Math.PI*2);g.stroke();}
}
function paintVideo(W,H,progress,rgb){
  const portrait=H>W;
  const margin=W*(portrait?.052:.027);
  const top=H*(portrait?.235:.047);
  const bottom=H*(portrait?.212:.055);
  const frameW=W-2*margin,frameH=H-top-bottom;
  const rounded=Math.round(W*.011);
  roundRect(margin-2,top-2,frameW+4,frameH+4,rounded+2,'#8190ae60');
  roundRect(margin,top,frameW,frameH,rounded,'#111521');
  if(state.loaded&&video.readyState>=2&&video.videoWidth>0){
    const zoom=$('zoomEnabled').checked?1+.013*Math.sin(progress*Math.PI):1;
    const ratio=video.videoWidth/video.videoHeight,frameRatio=frameW/frameH;
    let dw,dh;
    if(ratio>frameRatio){dw=frameW*zoom;dh=dw/ratio;}else{dh=frameH*zoom;dw=dh*ratio;}
    const dx=margin+(frameW-dw)/2,dy=top+(frameH-dh)/2;
    g.save();g.beginPath();g.roundRect(margin,top,frameW,frameH,rounded);g.clip();
    try{g.drawImage(video,dx,dy,dw,dh);}catch{}
    g.restore();
  }else{
    g.fillStyle='#0b1120';g.fillRect(margin,top,frameW,frameH);
    paintText('Upload a screen recording',W/2,H*.45,W*.65,W*.036,{fill:'#c5cce1',maxLines:2});
  }
  g.fillStyle='#10182b';g.fillRect(margin,top+frameH-4,frameW,4);
  g.fillStyle=alpha(rgb,.9);g.fillRect(margin,top+frameH-4,frameW*clamp(progress,0,1),4);
  return {margin,top,frameH,frameW};
}
function drawFrame(){
  const W=canvas.width,H=canvas.height,portrait=H>W;
  const rgb=toHexRgb($('accentColor').value);
  g.fillStyle='#111827';g.fillRect(0,0,W,H);
  const t=state.loaded?clamp(video.currentTime-state.trimStart,0,Math.max(.01,state.trimEnd-state.trimStart)):0;
  const length=Math.max(1,state.trimEnd-state.trimStart||1),pct=t/length;
  const frame=paintVideo(W,H,pct,rgb);
  // Restrained badges, never overpaint the actual demo with a big promotional card.
  const brand=String($('brandText').value||'').trim();
  if(brand){
    g.save();g.font=`700 ${Math.round(W*(portrait?.024:.015))}px system-ui, sans-serif`;
    const label=brand.toUpperCase().slice(0,38);const labelW=g.measureText(label).width;
    const badgeX=frame.margin+W*.013,badgeY=frame.top+H*.021;
    roundRect(badgeX-7,badgeY-5,labelW+19,W*(portrait?.041:.028),7,'rgba(12,17,35,.78)');
    g.fillStyle='#fff';g.textAlign='left';g.textBaseline='top';g.fillText(label,badgeX+3,badgeY+2);
    g.restore();
  }
  if(state.logo&&state.logo.complete&&state.logo.naturalWidth){
    const mw=W*.066,mh=H*.06,fit=Math.min(mw/state.logo.naturalWidth,mh/state.logo.naturalHeight);
    try{g.drawImage(state.logo,frame.margin+frame.frameW-mw-W*.012,frame.top+H*.014,state.logo.naturalWidth*fit,state.logo.naturalHeight*fit);}catch{}
  }
  if($('captionsEnabled').checked){
    const isHook=t<Math.min(2.1,Math.max(.7,length*.17));
    const copy=isHook?$('hookText').value:$('captionText').value;
    if(String(copy).trim()&&!($('outroEnabled').checked&&pct>.92)){
      const f=Math.round(W*(portrait?.036:.021));
      const lines=String(copy).length>46?2:1;
      const bandW=W*(portrait?.83:.73), bandH=f*1.3*lines+H*.018;
      const y=portrait?H*.78:(frame.top+frame.frameH-bandH-H*.053);
      roundRect((W-bandW)/2,y,bandW,bandH,Math.round(W*.008),'rgba(8,13,30,.78)');
      paintText(copy,W*.5,y+H*.010,bandW-W*.045,f,{maxLines:2,weight:700,lineHeight:1.17});
    }
  }
  if($('outroEnabled').checked&&pct>.94&&state.loaded){
    const p=clamp((pct-.94)/.04,0,1);g.save();g.globalAlpha=p;
    const y=portrait?H*.83:H*.79;
    roundRect(W*.18,y,W*.64,H*.09,Math.round(W*.012),'rgba(8,13,30,.88)');
    paintText($('outroText').value,W*.5,y+H*.019,W*.6,W*(portrait?.034:.024),{maxLines:2,weight:750});
    g.restore();
  }
}
function frameLoop(){
  if(state.loaded&&!state.rendering&&!video.paused){
    if(video.currentTime>=state.trimEnd-.015){video.pause();video.currentTime=state.trimStart;stopAudio();}
    $('scrubber').value=state.duration>0?String(video.currentTime/state.duration*100):'0';
    updateTimeLabels();
  }
  if(!state.rendering)drawFrame();
  state.raf=requestAnimationFrame(frameLoop);
}
function updateTimeLabels(){
  const time=state.loaded?video.currentTime:0;
  $('currentClock').textContent=clock(time);$('durationClock').textContent=clock(state.loaded?state.duration:0);
  $('previewTime').textContent=`${clock(time)} / ${clock(state.duration)}`;
  $('startTimeLabel').textContent=clock(state.trimStart);$('endTimeLabel').textContent=clock(state.trimEnd);
}
function updateTrim(e){
  if(!state.loaded)return;
  let v=clamp(Number(e.target.value)*state.duration/100,0,state.duration);
  if(e.target.id==='trimStart')state.trimStart=Math.min(v,state.trimEnd-.2);
  else state.trimEnd=Math.max(v,state.trimStart+.2);
  $('trimStart').value=String(state.trimStart/state.duration*100);
  $('trimEnd').value=String(state.trimEnd/state.duration*100);
  if(video.currentTime<state.trimStart||video.currentTime>state.trimEnd)video.currentTime=state.trimStart;
  updateTimeLabels();drawFrame();
}
function cleanInputFile(){
  if(state.url){URL.revokeObjectURL(state.url);state.url=null;}
  state.loaded=false;state.file=null;state.duration=0;state.trimStart=0;state.trimEnd=0;
  video.removeAttribute('src');video.load();stopAudio();
}
async function installFile(file,sourceLabel='Uploaded video'){
  if(!file)return;
  if(state.rendering){notify('Wait until export finishes or cancel it.');return;}
  if(file.size>500*1024*1024){notify('This release supports source files up to 500 MB (smaller files export faster).');return;}
  if(file.type&&!file.type.startsWith('video/')&&!/\.(mp4|mov|webm|m4v|ogv)$/i.test(file.name)){notify('Select a browser-compatible video file.');return;}
  cleanInputFile();state.file=file;state.url=URL.createObjectURL(file);
  video.src=state.url;
  $('sourceDescription').textContent='Reading recording…';
  try{
    await new Promise((resolve,reject)=>{let timer=setTimeout(()=>reject(new Error('Video metadata did not load. Check the file format.')),12000);video.addEventListener('loadedmetadata',()=>{clearTimeout(timer);resolve();},{once:true});video.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('This video cannot be decoded by your browser. Try MP4 or WebM.'));},{once:true});video.load();});
    if(!Number.isFinite(video.duration)||video.duration<=0)throw new Error('Video duration could not be read.');
    state.loaded=true;state.duration=video.duration;state.trimStart=0;state.trimEnd=state.duration;
    $('trimStart').value='0';$('trimEnd').value='100';$('scrubber').value='0';
    $('sourceDescription').textContent=`${sourceLabel}: ${file.name} · ${clock(state.duration)} · ${(file.size/1048576).toFixed(1)} MB`;
    $('clipName').textContent=(file.name||'SCREEN RECORDING').toUpperCase().slice(0,36);
    $('timelineMiddle').textContent=clock(state.duration/2);$('timelineEnd').textContent=clock(state.duration);
    $('emptyOverlay').hidden=true;
    await waitForFrame();
    // Force a decoded first source frame; first frame on some MP4s is temporarily blank.
    try { await safeSeek(Math.min(.18,state.duration*.035)); } catch {}
    updateTimeLabels();drawFrame();saveSettings();notify(`Video loaded: ${file.name}`);
    makeRealFilmstrip().catch(()=>{});
  }catch(error){cleanInputFile();$('sourceDescription').textContent='Could not load video';$('emptyOverlay').hidden=false;notify(error.message||String(error),true);}
}
async function makeRealFilmstrip(){
  // Six actual thumbnails sampled from the uploaded source, not a decorative illustration.
  if(!state.url||!state.loaded)return;
  const sourceUrl=state.url;
  const thumbVideo=document.createElement('video');thumbVideo.preload='auto';thumbVideo.muted=true;thumbVideo.playsInline=true;
  thumbVideo.src=sourceUrl;
  try{
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Thumbnail metadata timeout')),4000);thumbVideo.addEventListener('loadedmetadata',()=>{clearTimeout(timeout);resolve();},{once:true});thumbVideo.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Thumbnail decoding unavailable'));},{once:true});thumbVideo.load();});
    const strip=document.createElement('canvas');strip.width=720;strip.height=60;
    const ctx=strip.getContext('2d');
    const count=6,thumbWidth=120;
    for(let i=0;i<count;i++){
      const at=Math.max(0,Math.min(thumbVideo.duration-.025,thumbVideo.duration*(i+.5)/count));
      await new Promise(resolve=>{const timer=setTimeout(resolve,1200);const finish=()=>{clearTimeout(timer);resolve();};thumbVideo.addEventListener('seeked',finish,{once:true});try{thumbVideo.currentTime=at;}catch{finish();}});
      if(thumbVideo.readyState>=2){
        ctx.fillStyle='#0b1021';ctx.fillRect(i*thumbWidth,0,thumbWidth,60);
        const r=Math.min(thumbWidth/thumbVideo.videoWidth,60/thumbVideo.videoHeight),w=thumbVideo.videoWidth*r,h=thumbVideo.videoHeight*r;
        try{ctx.drawImage(thumbVideo,i*thumbWidth+(thumbWidth-w)/2,(60-h)/2,w,h);}catch{}
      }
    }
    if(state.url===sourceUrl)$('filmstrip').style.setProperty('--filmstrip-images',`url("${strip.toDataURL('image/jpeg',.78)}")`);
  }finally{thumbVideo.removeAttribute('src');thumbVideo.load();}
}
async function waitForFrame(){
  if(video.readyState>=2)return;
  await new Promise(r=>{let done=false;const end=()=>{if(done)return;done=true;r();};video.addEventListener('loadeddata',end,{once:true});setTimeout(end,2000);});
}
function notify(msg,error=false){
  const el=$('projectState');el.textContent=(error?'⚠ ':'● ')+msg;el.style.color=error?'#cb4259':'#668072';
}
function safeSeek(time){
  if(!state.loaded)return Promise.resolve();
  const target=clamp(time,0,Math.max(0,state.duration-.01));
  if(Math.abs(video.currentTime-target)<.016)return Promise.resolve();
  return new Promise(resolve=>{let finished=false;const done=()=>{if(finished)return;finished=true;resolve();};video.addEventListener('seeked',done,{once:true});video.currentTime=target;setTimeout(done,3000);});
}
function setupMixer(){
  if(state.ctx)return;
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)throw new Error('This browser cannot mix audio.');
  state.ctx=new AudioContext();state.mix=state.ctx.createMediaStreamDestination();
  state.videoGain=state.ctx.createGain();state.videoGain.gain.value=1;
  state.mediaAudioNode=state.ctx.createMediaElementSource(video);
  state.mediaAudioNode.connect(state.videoGain);
  state.videoGain.connect(state.mix);
  state.videoGain.connect(state.ctx.destination);
  state.musicGain=state.ctx.createGain();state.musicGain.gain.value=0;
  state.musicGain.connect(state.mix);state.musicGain.connect(state.ctx.destination);
  state.customAudioNode=state.ctx.createMediaElementSource(musicEl);
  state.customAudioNode.connect(state.musicGain);
}
function updateAudioGains(){
  if(!state.ctx)return;
  const v=Number($('musicVolume').value)/100;
  state.videoGain.gain.value=$('originalSound').checked?1:0;
  state.musicGain.gain.value=$('musicPreset').value==='custom'?v:0;
  if(state.synth)state.synth.master.gain.value=($('musicPreset').value==='ambient'||$('musicPreset').value==='uplift') ? v*.19:0;
}
function startSynth(){
  stopSynth();const preset=$('musicPreset').value;
  if(preset!=='ambient'&&preset!=='uplift')return;
  const ctx=state.ctx;
  const master=ctx.createGain();master.gain.value=Number($('musicVolume').value)/100*.19;
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=preset==='uplift'?980:560;
  master.connect(filter);filter.connect(state.mix);filter.connect(ctx.destination);
  state.synth={master,filter,voices:[]};state.synthNotes=0;
  const major=preset==='uplift'?[261.63,329.63,392.0,493.88]:[174.61,220,261.63,329.63];
  function chord(){
    if(!state.synth||state.ctx!==ctx)return;
    const i=state.synthNotes++%major.length;const freq=major[i];
    for(const harmonic of [1,1.5,2]){
      const o=ctx.createOscillator();o.type='sine';o.frequency.value=freq*harmonic;
      const gn=ctx.createGain();const now=ctx.currentTime;
      gn.gain.setValueAtTime(0,now);
      gn.gain.linearRampToValueAtTime(harmonic===1?.18:.065,now+.35);
      gn.gain.exponentialRampToValueAtTime(.001,now+2.1);
      o.connect(gn).connect(master);o.start(now);o.stop(now+2.2);
      state.synth.voices.push(o);
      o.onended=()=>{try{o.disconnect();gn.disconnect()}catch{}};
    }
  }
  chord();state.synthTimer=setInterval(chord,1900);
}
function stopSynth(){
  if(state.synthTimer){clearInterval(state.synthTimer);state.synthTimer=null;}
  if(state.synth){try{state.synth.master.gain.setValueAtTime(0,state.ctx.currentTime);state.synth.master.disconnect();state.synth.filter.disconnect();}catch{}for(const o of state.synth.voices){try{o.stop();}catch{}}state.synth=null;}
}
async function startAudio(){
  try{
    setupMixer();await state.ctx.resume();updateAudioGains();startSynth();
    if($('musicPreset').value==='custom'&&state.audioUrl){musicEl.currentTime=0;await musicEl.play().catch(()=>{});}
  }catch(error){notify('Audio unavailable: '+error.message,true);}
}
function stopAudio(){stopSynth();musicEl.pause();}
async function togglePreview(){
  if(!state.loaded){notify('First upload a recording or choose the sample.');return;}
  if(state.rendering)return;
  if(!video.paused){video.pause();stopAudio();setPlayerIcon(false);return;}
  if(video.currentTime<state.trimStart||video.currentTime>=state.trimEnd-.05)await safeSeek(state.trimStart);
  await startAudio();await video.play().catch(e=>notify('Could not play: '+e.message,true));
  setPlayerIcon(true);
}
function supportedMime(kind){
  if(!window.MediaRecorder)return null;
  const candidates=kind==='mp4'?[
    'video/mp4;codecs="avc1.42E01E"','video/mp4;codecs=avc1','video/mp4;codecs=avc3'
  ]:[
    'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'
  ];
  return candidates.find(v=>MediaRecorder.isTypeSupported(v))||null;
}
function selectMime(){
  const chosen=$('exportContainer').value;
  const mp4=supportedMime('mp4'),webm=supportedMime('webm');
  if(chosen==='mp4'){
    if(!mp4)throw new Error('H.264 MP4 recording is unavailable in this browser. Select WebM, or use Chrome/Edge with supported encoding.');
    return {mime:mp4,ext:'mp4'};
  }
  if(chosen==='webm'){
    if(!webm)throw new Error('This browser cannot export WebM. Try MP4 or a newer browser.');
    return {mime:webm,ext:'webm'};
  }
  if(mp4)return {mime:mp4,ext:'mp4'};
  if(webm)return {mime:webm,ext:'webm'};
  throw new Error('MediaRecorder export is not supported by your browser.');
}
function status(text,detail,percentage){
  $('renderStatus').hidden=false;$('renderStatusText').textContent=text;$('renderStatusDetail').textContent=detail;
  $('renderProgress').style.width=String(clamp(percentage,0,100))+'%';
}
function finishRender(download=true){
  if(!state.rendering)return;
  state.rendering=false;video.pause();stopAudio();
  $('renderButton').disabled=false;$('exportTop').disabled=false;setPlayerIcon(false);
  $('renderStatus').hidden=true;
  try{if(state.recorder&&state.recorder.state!=='inactive')state.recorder.stop();}catch{}
  if(!download)state.cancelled=true;
}
async function renderVideo(){
  if(!state.loaded){notify('Upload a recording first to render a video.',true);return;}
  if(state.rendering)return;
  let opts;
  try{opts=selectMime();}catch(error){notify(error.message,true);return;}
  const clipDuration=state.trimEnd-state.trimStart;
  if(clipDuration<.4){notify('The selected clip is too short. Choose at least 0.4 seconds.',true);return;}
  state.cancelled=false;state.chunks=[];
  try{
    video.pause();stopAudio();await safeSeek(state.trimStart);await waitForFrame();
    state.rendering=true;$('renderButton').disabled=true;$('exportTop').disabled=true;
    status('Starting export…','Keep this tab active; rendering runs at the recording’s playback speed.',1);
    await startAudio();
    const [exportWidth,exportHeight]=getExportSize();
    canvas.width=exportWidth;canvas.height=exportHeight;drawFrame();
    const videoStream=canvas.captureStream(30);
    const tracks=[...videoStream.getVideoTracks(),...(state.mix?state.mix.stream.getAudioTracks():[])];
    const mixed=new MediaStream(tracks);
    let mr;
    try{mr=new MediaRecorder(mixed,{mimeType:opts.mime,videoBitsPerSecond:$('exportQuality').value==='high'?8000000:4400000});}
    catch(err){throw new Error('Encoder could not start with this format: '+err.message);}
    state.recorder=mr;
    let resolved=false;
    const result=new Promise((resolve,reject)=>{
      mr.ondataavailable=e=>{if(e.data&&e.data.size)state.chunks.push(e.data);};
      mr.onerror=e=>reject(new Error('Media recording failed: '+String(e.error?.message||'unknown')));
      mr.onstop=()=>{if(!resolved){resolved=true;resolve();}};
    });
    drawFrame();mr.start(1000);
    await video.play();
    const start=performance.now();
    await new Promise((resolve,reject)=>{
      function tick(){
        if(state.cancelled){resolve();return;}
        if(!state.rendering){resolve();return;}
        const elapsed=Math.max(0,video.currentTime-state.trimStart);
        if(elapsed>=clipDuration-.018||video.ended||performance.now()-start>(clipDuration+10)*1000){resolve();return;}
        drawFrame();status('Rendering your video…',`${clock(elapsed)} / ${clock(clipDuration)} · Keep this tab active`,Math.min(98,elapsed/clipDuration*100));
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    drawFrame();video.pause();stopAudio();
    if(mr.state!=='inactive')mr.stop();
    await Promise.race([result,new Promise(resolve=>setTimeout(resolve,6000))]);
    if(!state.cancelled){
      const blob=new Blob(state.chunks,{type:mr.mimeType||opts.mime});
      if(blob.size<1000)throw new Error('Export produced no usable media. Try another format.');
      const actualMime=mr.mimeType||opts.mime;
      const ext=actualMime.startsWith('video/mp4')?'mp4':'webm';
      const file=`${slug($('projectName').value)}-${state.format}-${Date.now()}.${ext}`;
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      const codecNote=await mediaCodecNotes(blob,ext);notify(`Downloaded ${file} · ${codecNote}`);
      status('Export complete!',`Downloaded ${file}`,100);
    }else{notify('Export canceled.');}
  }catch(error){notify('Export failed: '+(error?.message||String(error)),true);}
  finally{finishRender(false);state.recorder=null;state.chunks=[];canvas.width=formats[state.format].w;canvas.height=formats[state.format].h;drawFrame();}
}
function mediaCodecNotes(blob,container){
  if(container!=='mp4')return 'WebM is supported by some platforms; check the destination requirements.';
  return blob.slice(0,Math.min(blob.size,1024*1024)).arrayBuffer().then(buf=>{
    const bytes=new Uint8Array(buf),ascii=(s)=>{const pattern=[...s].map(x=>x.charCodeAt(0));
      outer:for(let i=0;i<bytes.length-pattern.length;i++){for(let j=0;j<pattern.length;j++)if(bytes[i+j]!==pattern[j])continue outer;return true;}return false;};
    if(ascii('Opus'))return 'MP4 contains Opus audio. Convert the file to AAC before uploading where required.';
    if(ascii('mp4a'))return 'MP4 includes an AAC audio track; review video and audio before posting.';
    return 'Audio codec was not confirmed; check compatibility before uploading.';
  }).catch(()=> 'Audio codec could not be inspected; check compatibility before uploading.');
}
function downloadText(filename,body,mime='text/plain'){
 const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function srtTime(s){const t=Math.max(0,Math.floor(s*1000));return `${String(Math.floor(t/3600000)).padStart(2,'0')}:${String(Math.floor(t/60000)%60).padStart(2,'0')}:${String(Math.floor(t/1000)%60).padStart(2,'0')},${String(t%1000).padStart(3,'0')}`;}
function exportCaptions(){
 if(!state.loaded){notify('Load a video before exporting captions.',true);return;}
 const length=state.trimEnd-state.trimStart,segments=[];
 if($('captionsEnabled').checked){
  const hook=String($('hookText').value||'').trim(),caption=String($('captionText').value||'').trim();
  const split=Math.min(2.2,Math.max(.7,length*.17));
  if(hook)segments.push({start:0,end:split,text:hook});
  if(caption&&length>split+.3)segments.push({start:split,end:$('outroEnabled').checked?Math.max(split+.1,length*.93):length,text:caption});
 }
 if($('outroEnabled').checked&&length>1){const outro=String($('outroText').value||'').trim();if(outro)segments.push({start:Math.max(0,length*.93),end:length,text:outro});}
 if(!segments.length){notify('Add text overlays before downloading captions.',true);return;}
 const srt=segments.filter(x=>x.end>x.start).map((s,i)=>`${i+1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n');
 downloadText(`${slug($('projectName').value)}.srt`,srt,'application/x-subrip;charset=utf-8');notify('Caption file downloaded.');
}
function exportEditingPreset(){
 const data={product:'Showcase Studio',schema:1,settings:Object.fromEntries(persistIds.map(k=>[k,read(k)])),format:state.format,theme:state.theme};
 downloadText(`${slug($('projectName').value)}-preset.json`,JSON.stringify(data,null,2),'application/json');notify('Editing preset downloaded. Media files are never included.');
}
async function importEditingPreset(file){
 if(!file)return;
 if(file.size>200000){notify('Preset file is too large.',true);return;}
 try{const preset=JSON.parse(await file.text());if(preset.product!=='Showcase Studio'||preset.schema!==1||!preset.settings||typeof preset.settings!=='object')throw Error('Not a Showcase Studio preset.');
  for(const key of persistIds){if(!Object.prototype.hasOwnProperty.call(preset.settings,key))continue;const el=$(key),val=preset.settings[key];
   if(el.type==='checkbox'){if(typeof val==='boolean')el.checked=val;}
   else if(['text','textarea','color','range','select-one'].includes(el.type)||el.tagName==='TEXTAREA'||el.tagName==='SELECT'){
    if(typeof val!=='string'&&typeof val!=='number')continue;
    if(el.tagName==='SELECT'&&!Array.from(el.options).some(o=>o.value===String(val)))continue;
    el.value=String(val).slice(0,200);
   }
  }
  if(preset.format in formats)setFormat(preset.format,false);
  if(preset.theme in themes)setTheme(preset.theme,false);
  $('volumeValue').textContent=$('musicVolume').value+'%';updateAudioGains();saveSettings();drawFrame();notify('Editing preset loaded.');
 }catch(e){notify('Preset not loaded: '+e.message,true);}finally{$('presetInput').value='';}
}
function setLogoFile(){
  const file=$('logoInput').files?.[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){notify('Use a PNG, JPEG or WebP logo under 8 MB.',true);return;}
  if(state.logoUrl)URL.revokeObjectURL(state.logoUrl);
  state.logoUrl=URL.createObjectURL(file);
  const img=new Image();img.onload=()=>{state.logo=img;drawFrame();notify('Logo added: '+file.name);};
  img.onerror=()=>notify('Could not load that logo file.',true);
  img.src=state.logoUrl;
  $('logoFileLabel').textContent=file.name;
}
function saveCover(){
  if(!state.loaded){notify('Load a recording before saving a cover.',true);return;}
  drawFrame();canvas.toBlob(blob=>{
    if(!blob){notify('Could not create cover image.',true);return;}
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=slug($('projectName').value)+'-cover-'+state.format+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    notify('Cover image downloaded.');
  },'image/png');
}
function updateMusicInput(){
  const file=$('audioInput').files?.[0];if(!file)return;
  if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);
  state.audioUrl=URL.createObjectURL(file);musicEl.src=state.audioUrl;
  $('audioFileLabel').textContent=file.name;
  $('musicPreset').value='custom';$('musicTrack').textContent=`MUSIC: ${file.name}`;saveSettings();
}
async function loadSample(auto=false){
  if(state.sampleLoading)return;state.sampleLoading=true;
  try{
    notify('Loading included sample…');
    const resp=await fetch('assets/sample-demo.mp4');
    if(!resp.ok)throw new Error('Sample file unavailable (serve the project through a web server).');
    const blob=await resp.blob();
    await installFile(new File([blob],'mohsin-tools-website-tour.mp4',{type:'video/mp4'}),'Mohsin Tools website showcase · example footage');
    $('hookText').value='Mohsin Tools — 26 free browser utilities';
    $('captionText').value='Real tools for images, text and everyday work.';
    $('outroText').value='tools.mohsinlabs.com ↗';
    $('brandText').value='MOHSIN LABS';saveSettings();drawFrame();
    if(!auto)window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){notify(error.message,true);}finally{state.sampleLoading=false;}
}
function selectPanel(panel){
  document.body.classList.toggle('export-pane-visible',panel==='export');
  const panes=['text','style','audio','export'];
  if(!panes.includes(panel))panel='text';
  document.querySelectorAll('[data-pane]').forEach(el=>el.classList.toggle('current',el.dataset.pane===panel));
  document.querySelectorAll('.inspector-tabs [data-panel]').forEach(el=>el.classList.toggle('on',el.dataset.panel===panel));
  document.querySelectorAll('.rail [data-panel]').forEach(el=>el.classList.toggle('current',el.dataset.panel===panel));
  if(window.matchMedia('(max-width: 860px)').matches && panel!=='media')document.querySelector('.inspector')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function bind(){
  restoreSettings();
  document.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',event=>{event.preventDefault();if(btn.dataset.panel==='media'){document.querySelector('#uploadCard')?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.rail [data-panel]').forEach(x=>x.classList.toggle('current',x===btn));return;}selectPanel(btn.dataset.panel);}));
  const storyPresets={
    portfolio:{hook:'Here is what I built.',caption:'A practical product, from concept to working software.',outro:'Explore my portfolio ↗',name:'MY PORTFOLIO'},
    launch:{hook:'I just launched something new.',caption:'A useful solution, built for real people.',outro:'Try the product ↗',name:'MOHSIN LABS'},
    feature:{hook:'One feature. A better workflow.',caption:'See how this makes the everyday task easier.',outro:'See it in action ↗',name:'MY PRODUCT'}
  };
  document.querySelectorAll('[data-story-preset]').forEach(btn=>btn.addEventListener('click',()=>{
    const p=storyPresets[btn.dataset.storyPreset];if(!p)return;
    $('hookText').value=p.hook;$('captionText').value=p.caption;$('outroText').value=p.outro;$('brandText').value=p.name;
    document.querySelectorAll('[data-story-preset]').forEach(x=>x.classList.toggle('active',x===btn));
    saveSettings();drawFrame();notify(`Template applied: ${btn.textContent}`);
  }));
  const dropZone=document.querySelector('.canvas-center');
  ['dragenter','dragover'].forEach(event=>dropZone.addEventListener(event,e=>{e.preventDefault();dropZone.classList.add('dragover');}));
  ['dragleave','drop'].forEach(event=>dropZone.addEventListener(event,e=>{e.preventDefault();dropZone.classList.remove('dragover');}));
  dropZone.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(f)installFile(f);});
  document.addEventListener('keydown',e=>{
    if(e.target?.matches?.('input,textarea,select')||e.ctrlKey||e.altKey||e.metaKey||state.rendering)return;
    if(e.code==='Space'){e.preventDefault();togglePreview();}
    else if(e.code==='ArrowRight'&&state.loaded){e.preventDefault();video.currentTime=clamp(video.currentTime+2,state.trimStart,state.trimEnd-.02);}
    else if(e.code==='ArrowLeft'&&state.loaded){e.preventDefault();video.currentTime=clamp(video.currentTime-2,state.trimStart,state.trimEnd-.02);}
  });


  $('videoInput').addEventListener('change',e=>installFile(e.target.files?.[0]));
  $('sampleButton').addEventListener('click',()=>loadSample(false));
  // App-first layout: load the sample from the media toolbar.

  $('playPause').addEventListener('click',togglePreview);
  $('replay').addEventListener('click',async()=>{if(state.loaded){video.pause();stopAudio();await safeSeek(state.trimStart);drawFrame();}});
  $('scrubber').addEventListener('input',e=>{if(!state.loaded||state.rendering)return;video.pause();stopAudio();video.currentTime=clamp(Number(e.target.value)*state.duration/100,state.trimStart,state.trimEnd);updateTimeLabels();});
  $('trimStart').addEventListener('input',updateTrim);$('trimEnd').addEventListener('input',updateTrim);
  document.querySelectorAll('.theme-option').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
  document.querySelectorAll('.format-option').forEach(b=>b.addEventListener('click',()=>setFormat(b.dataset.format)));
  document.querySelectorAll('[data-preview-format]').forEach(b=>b.addEventListener('click',()=>setFormat(b.dataset.previewFormat)));
  for(const k of persistIds){$(k).addEventListener('input',()=>{if(k==='musicVolume'){$('volumeValue').textContent=$(k).value+'%';updateAudioGains();}if(k==='musicPreset'){stopAudio();$('musicTrack').textContent=$(k).value==='none'?'NO SOUNDTRACK':`MUSIC: ${$(k).selectedOptions[0].textContent}`;}if(k==='originalSound')updateAudioGains();saveSettings();drawFrame();});}
  $('audioInput').addEventListener('change',updateMusicInput);
  $('logoInput').addEventListener('change',setLogoFile);
  $('saveCover').addEventListener('click',saveCover);
  $('downloadSrt').addEventListener('click',exportCaptions);
  $('exportPreset').addEventListener('click',exportEditingPreset);
  $('importPreset').addEventListener('click',()=> $('presetInput').click());
  $('presetInput').addEventListener('change',e=>importEditingPreset(e.target.files?.[0]));
  $('renderButton').addEventListener('click',renderVideo);$('exportTop').addEventListener('click',renderVideo);
  $('cancelRender').addEventListener('click',()=>{state.cancelled=true;notify('Canceling export…');});
  $('resetProject').addEventListener('click',()=>{
    if(state.rendering){notify('Cancel export before resetting.',true);return;}
    if(!window.confirm('Reset text, theme and trim choices, and remove your selected media?'))return;
    try{localStorage.removeItem('showcase-studio-project');localStorage.removeItem('showcase-studio-v03');}catch{}
    cleanInputFile();if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl=null;musicEl.removeAttribute('src');musicEl.load();
    if(state.logoUrl)URL.revokeObjectURL(state.logoUrl);state.logoUrl=null;state.logo=null;$('logoInput').value='';$('logoFileLabel').textContent='Use a transparent PNG for best results';
    $('videoInput').value='';$('audioInput').value='';$('audioFileLabel').textContent='Optional MP3, WAV, M4A or WebM';
    const defaultValues={projectName:'My Product Showcase',hookText:'Built something worth sharing.',captionText:'Turn ideas into real products.',outroText:'Explore the project ↗',brandText:'MOHSIN LABS',accentColor:'#9b6dff',musicPreset:'ambient',musicVolume:'20',exportContainer:'auto',exportQuality:'high'};
    for(const [k,v] of Object.entries(defaultValues))$(k).value=v;
    for(const k of ['captionsEnabled','outroEnabled','zoomEnabled','originalSound'])$(k).checked=true;
    setFormat('landscape',false);setTheme('violet',false);$('trimStart').value='0';$('trimEnd').value='100';$('clipName').textContent='YOUR SCREEN RECORDING';
    $('sourceDescription').textContent='No video selected';$('emptyOverlay').hidden=false;updateTimeLabels();drawFrame();notify('Project reset.');
  });
  video.addEventListener('pause',()=>{setPlayerIcon(false);});
  video.addEventListener('play',()=>{setPlayerIcon(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.rendering)status('Export running…','For reliable rendering, bring this tab back to the foreground.',Math.min(95,(video.currentTime-state.trimStart)/Math.max(.01,state.trimEnd-state.trimStart)*100));});
  canvas.width=formats[state.format].w;canvas.height=formats[state.format].h;
  setPlayerIcon(false);drawFrame();state.raf=requestAnimationFrame(frameLoop);
  // Preload a genuine short demo clip so the video canvas showcases real footage immediately.
  // No automatic demo preload; real footage only appears when explicitly selected.
}
bind();
window.__showcaseTest = {state,selectMime,clock,installFile,renderVideo,drawFrame,setFormat,setTheme};