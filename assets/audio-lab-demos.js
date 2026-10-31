/* MLAIA Audio Lab, demos 04-06: machine vibration, sound event detection, spectral subtraction.
   Everything is synthesized and processed in the browser. Shared playback lives in audio-lab.js (window.MLAIALab). */
(function(){
  'use strict';
  const TAU=2*Math.PI;

  /* ---------- DSP core ---------- */
  const fftCache={};
  function fftTables(n){
    if(fftCache[n])return fftCache[n];
    const rev=new Uint32Array(n),bits=Math.log2(n);
    for(let i=0;i<n;i++){let r=0;for(let b=0;b<bits;b++)r|=((i>>b)&1)<<(bits-1-b);rev[i]=r;}
    const cos=new Float64Array(n/2),sin=new Float64Array(n/2);
    for(let i=0;i<n/2;i++){cos[i]=Math.cos(TAU*i/n);sin[i]=Math.sin(TAU*i/n);}
    return(fftCache[n]={rev,cos,sin});
  }
  // In-place iterative radix-2 FFT. inverse=true computes the inverse transform including 1/n.
  function fft(re,im,inverse){
    const n=re.length,{rev,cos,sin}=fftTables(n),sign=inverse?1:-1;
    for(let i=0;i<n;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(let size=2;size<=n;size*=2){
      const half=size/2,step=n/size;
      for(let start=0;start<n;start+=size){
        for(let k=0;k<half;k++){
          const wr=cos[k*step],wi=sign*sin[k*step],a=start+k,b=a+half;
          const xr=re[b]*wr-im[b]*wi,xi=re[b]*wi+im[b]*wr;
          re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;
        }
      }
    }
    if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
  }
  function hann(n){const w=new Float64Array(n);for(let i=0;i<n;i++)w[i]=.5-.5*Math.cos(TAU*i/n);return w;} // periodic: sums to 1 at 50% overlap
  function rng(seed){let a=seed>>>0;const uni=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};let spare=null;const gauss=()=>{if(spare!==null){const s=spare;spare=null;return s;}let u=0,v=0;while(u<1e-12)u=uni();v=uni();const r=Math.sqrt(-2*Math.log(u));spare=r*Math.sin(TAU*v);return r*Math.cos(TAU*v);};return{uni,gauss};}
  function power(a,from,to){from=from||0;to=to===undefined?a.length:to;let s=0;for(let i=from;i<to;i++)s+=a[i]*a[i];return s/Math.max(1,to-from);}
  function median(values){const a=Float64Array.from(values).sort();const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  const dB=x=>10*Math.log10(Math.max(x,1e-20));
  // Single-sided amplitude spectrum with a Hann window, scaled so a sinusoid of peak amplitude A reads A at its bin.
  function amplitudeSpectrum(x){
    const n=x.length,w=hann(n),re=new Float64Array(n),im=new Float64Array(n);let mean=0,wsum=0;
    for(let i=0;i<n;i++)mean+=x[i];mean/=n;
    for(let i=0;i<n;i++){re[i]=(x[i]-mean)*w[i];wsum+=w[i];}
    fft(re,im,false);const out=new Float64Array(n/2+1);
    for(let k=0;k<=n/2;k++)out[k]=2*Math.hypot(re[k],im[k])/wsum;return out;
  }
  // Short-time Fourier transform with a periodic Hann window and 50% overlap (exact reconstruction by overlap-add).
  function stft(x,N){
    const hop=N/2,w=hann(N),padded=new Float64Array(x.length+N+hop);padded.set(x,hop);
    const frames=Math.floor((padded.length-N)/hop)+1,re=new Float64Array(frames*N),im=new Float64Array(frames*N);
    const fr=new Float64Array(N),fi=new Float64Array(N);
    for(let f=0;f<frames;f++){for(let i=0;i<N;i++){fr[i]=padded[f*hop+i]*w[i];fi[i]=0;}fft(fr,fi,false);re.set(fr,f*N);im.set(fi,f*N);}
    return{re,im,frames,N,hop,length:x.length};
  }
  function istft(S,gain){
    const {N,hop,frames}=S,out=new Float64Array(frames*hop+N),fr=new Float64Array(N),fi=new Float64Array(N),bins=N/2+1;
    for(let f=0;f<frames;f++){
      for(let k=0;k<N;k++){const kb=k<bins?k:N-k,g=gain?gain[f*bins+kb]:1;fr[k]=S.re[f*N+k]*g;fi[k]=S.im[f*N+k]*g;}
      fft(fr,fi,true);for(let i=0;i<N;i++)out[f*hop+i]+=fr[i];
    }
    return Float32Array.from(out.subarray(hop,hop+S.length));
  }
  function spectrogramDb(S){const {N,frames}=S,bins=N/2+1,out=new Float32Array(frames*bins),scale=2/(N/2);for(let f=0;f<frames;f++)for(let k=0;k<bins;k++){const a=Math.hypot(S.re[f*N+k],S.im[f*N+k])*scale;out[f*bins+k]=20*Math.log10(a+1e-9);}return{data:out,frames,bins};}
  function biquadBandpass(x,fs,f0,q){const w0=TAU*f0/fs,al=Math.sin(w0)/(2*q),a0=1+al,b0=al/a0,b2=-al/a0,a1=-2*Math.cos(w0)/a0,a2=(1-al)/a0;let x1=0,x2=0,y1=0,y2=0;const y=new Float64Array(x.length);for(let i=0;i<x.length;i++){const v=b0*x[i]+b2*x2-a1*y1-a2*y2;y[i]=v;x2=x1;x1=x[i];y2=y1;y1=v;}return y;}
  function pinkNoise(len,r){let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;const y=new Float64Array(len);for(let i=0;i<len;i++){const w=r.gauss();b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;y[i]=b0+b1+b2+b3+b4+b5+b6+w*.5362;b6=w*.115926;}return y;}
  function scaleTo(x,rms){const p=Math.sqrt(power(x));for(let i=0;i<x.length;i++)x[i]*=rms/p;return x;}

  /* ---------- 04 Vibration: rotating machine with imbalance and an outer-race bearing defect ---------- */
  const VFS=16384,V_BAND=[2000,4500],V_RES=3000,BPFO_FACTOR=4.5*(1-7.94/39.04),HEALTHY_1X=.02;
  function makeVibration(rpm,imbalance,fault,seconds,seed){
    const n=Math.round(VFS*seconds),x=new Float64Array(n),r=rng(seed||7),fr=rpm/60,bpfo=BPFO_FACTOR*fr,a1=HEALTHY_1X+.48*imbalance;
    for(let i=0;i<n;i++){const t=i/VFS;x[i]=a1*Math.sin(TAU*fr*t+.3)+.012*Math.sin(TAU*2*fr*t+1.1)+.006*Math.sin(TAU*3*fr*t+2)+.06*r.gauss();}
    if(fault>0){
      const sigma=TAU*V_RES*.05,len=Math.round(.012*VFS);let t0=.003;
      while(t0<seconds){const amp=fault*1.1*(1+.15*r.gauss()),start=Math.round(t0*VFS);
        for(let j=0;j<len&&start+j<n;j++){const t=j/VFS;x[start+j]+=amp*Math.exp(-sigma*t)*Math.sin(TAU*V_RES*t);}
        t0+=(1+.008*r.gauss())/bpfo;} // ~1% random slip, as in real rolling-element bearings
    }
    return x;
  }
  function analyzeVibration(x,rpm){
    const n=16384,seg=x.subarray(0,n),fr=rpm/60,bpfo=BPFO_FACTOR*fr,df=VFS/n;
    const raw=amplitudeSpectrum(seg);
    // Envelope: band-pass by zeroing FFT bins, keep positive frequencies (analytic signal), take magnitude.
    const re=Float64Array.from(seg),im=new Float64Array(n);fft(re,im,false);
    const lo=Math.round(V_BAND[0]/df),hi=Math.round(V_BAND[1]/df);
    for(let k=0;k<n;k++){if(k>=lo&&k<=hi){re[k]*=2;im[k]*=2;}else{re[k]=0;im[k]=0;}}
    fft(re,im,true);const env=new Float64Array(n),band=new Float64Array(n);
    for(let i=0;i<n;i++){env[i]=Math.hypot(re[i],im[i]);band[i]=re[i];}
    const envSpec=amplitudeSpectrum(env);
    const peakNear=(spec,f,tol)=>{const a=Math.max(1,Math.floor((f-tol)/df)),b=Math.ceil((f+tol)/df);let m=0;for(let k=a;k<=b&&k<spec.length;k++)m=Math.max(m,spec[k]);return m;};
    const oneX=peakNear(raw,fr,2*df),floorBins=[];
    for(let k=Math.round(10/df);k<=Math.round(500/df);k++)floorBins.push(envSpec[k]);
    const envFloor=median(floorBins),bpfoPeak=peakNear(envSpec,bpfo,Math.max(2*df,.02*bpfo));
    return{raw,envSpec,env,band,df,fr,bpfo,oneX,oneXDb:20*Math.log10(oneX/HEALTHY_1X),envFloor,bpfoPeak,bpfoDb:20*Math.log10(bpfoPeak/envFloor),rms:Math.sqrt(power(seg))};
  }

  /* ---------- 05 Sound event detection ---------- */
  const EFS=16000,EDUR=8,EN=512,EHOP=256;
  const TARGETS=[[.6,'knock',0],[1.4,'beep',-4],[2.2,'knock',-14],[4.4,'beep',-16],[5.1,'knock',-6],[6.0,'beep',-10],[7.25,'knock',-12],[7.7,'beep',0]];
  const RUMBLES=[[2.75,1.25],[6.25,.8]];
  function makeScene(bgDb,seed){
    const n=EFS*EDUR,x=new Float64Array(n),r=rng(seed||11),truth=[];
    const bg=scaleTo(pinkNoise(n,r),10**(bgDb/20));for(let i=0;i<n;i++)x[i]=bg[i];
    for(const [t0,type,lev] of TARGETS){
      const start=Math.round(t0*EFS),g=.5*10**(lev/20);
      if(type==='knock'){const len=Math.round(.06*EFS);for(let j=0;j<len;j++){const t=j/EFS,e=Math.exp(-t/.012);x[start+j]+=g*.5*e*(Math.sin(TAU*1900*t)+.8*Math.sin(TAU*3300*t+.5)+.6*Math.sin(TAU*4700*t+1))+(t<.003?g*.3*r.gauss():0);}truth.push({t0,t1:t0+.06,type});}
      else{const len=Math.round(.18*EFS);for(let j=0;j<len;j++){const t=j/EFS,e=Math.min(1,t/.008,(.18-t)/.008);x[start+j]+=g*.16*e*(Math.sin(TAU*2600*t)+.3*Math.sin(TAU*5200*t));}truth.push({t0,t1:t0+.18,type});}
    }
    for(const [t0,dur] of RUMBLES){
      const start=Math.round(t0*EFS),len=Math.round(dur*EFS),w=new Float64Array(len);for(let j=0;j<len;j++)w[j]=r.gauss();
      const low=scaleTo(biquadBandpass(biquadBandpass(w,EFS,90,.7),EFS,90,.7),1);
      for(let j=0;j<len;j++){const t=j/EFS,e=.5-.5*Math.cos(TAU*j/len);x[start+j]+=.5*e*(.32*low[j]+.25*Math.sin(TAU*(68*t+3*t*t)));}
    }
    return{x:Float32Array.from(x),truth,distractors:RUMBLES.map(([a,d])=>({t0:a,t1:a+d}))};
  }
  function sceneFeatures(x){
    const frames=Math.floor((x.length-EN)/EHOP)+1,w=hann(EN),bins=EN/2+1,re=new Float64Array(EN),im=new Float64Array(EN);
    const broad=new Float32Array(frames),band=new Float32Array(frames),spec=new Float32Array(frames*bins),df=EFS/EN,lo=Math.round(1000/df),hi=Math.round(6000/df);
    for(let f=0;f<frames;f++){
      for(let i=0;i<EN;i++){re[i]=x[f*EHOP+i]*w[i];im[i]=0;}fft(re,im,false);let sb=0,sn=0;
      for(let k=0;k<bins;k++){const p=re[k]*re[k]+im[k]*im[k];sb+=p;if(k>=lo&&k<=hi)sn+=p;spec[f*bins+k]=10*Math.log10(p*16/(EN*EN)+1e-12);}
      broad[f]=dB(sb);band[f]=dB(sn);
    }
    return{broad,band,spec,frames,bins,frameTime:f=>(f*EHOP+EN/2)/EFS};
  }
  function detectEvents(feature,threshold,frameTime){
    const floor=median(feature),on=Array.from(feature,v=>v>floor+threshold),segs=[];let s=-1,gap=0;
    for(let f=0;f<=on.length;f++){const v=f<on.length&&on[f];
      if(v){if(s<0)s=f;gap=0;}
      else if(s>=0){gap++;if(gap>3||f===on.length){const e=f-gap;if(e-s+1>=2)segs.push({f0:s,f1:e,t0:frameTime(s)-EN/2/EFS,t1:frameTime(e)+EN/2/EFS});s=-1;gap=0;}}}
    return{floor,segs};
  }
  function scoreEvents(segs,truth){
    const overlap=(a,b)=>a.t0<b.t1&&b.t0<a.t1;
    const hitTruth=truth.map(t=>segs.some(s=>overlap(s,t)));
    const fa=segs.filter(s=>!truth.some(t=>overlap(s,t)));
    segs.forEach(s=>{s.hit=truth.some(t=>overlap(s,t));});
    return{hits:hitTruth.filter(Boolean).length,misses:hitTruth.filter(h=>!h).length,falseAlarms:fa.length,hitTruth};
  }

  /* ---------- 06 Spectral subtraction on a speech-like signal ---------- */
  const SFS=16000,SDUR=4.5,SLEAD=.5,SN=512;
  const VOWELS={a:[[730,90,1],[1090,110,.5],[2440,170,.25]],i:[[270,60,1],[2290,120,.35],[3010,200,.25]],u:[[300,60,1],[870,90,.4],[2240,180,.12]],e:[[530,70,1],[1840,120,.4],[2480,180,.25]],o:[[570,80,1],[840,90,.6],[2410,180,.12]]};
  const SYLLABLES=[[.62,.26,'a',125,150,0],[.95,.22,'i',150,140,1],[1.3,.3,'o',140,115,0],[1.9,.24,'e',130,160,1],[2.2,.32,'a',160,130,0],[2.62,.2,'u',135,120,0],[3.15,.28,'i',145,170,1],[3.5,.34,'o',165,110,0]];
  function makeSpeech(seed){
    const n=Math.round(SFS*SDUR),x=new Float64Array(n),r=rng(seed||5);
    for(const [t0,dur,v,fa,fb,fric] of SYLLABLES){
      const start=Math.round(t0*SFS),len=Math.round(dur*SFS),form=VOWELS[v],H=Math.floor(4000/Math.min(fa,fb)),amps=[],phase=new Float64Array(H+1);
      const env=f=>{let s=0;for(const [F,B,g] of form)s+=g/Math.sqrt(1+((f-F)/B)**2);return s/(1+f/1500);};
      for(let j=0;j<len&&start+j<n;j++){const u=j/len,f0=fa+(fb-fa)*u,e=Math.min(1,u/.12)*Math.min(1,(1-u)/.25)*(1+.15*Math.sin(TAU*5*j/SFS));let s=0;
        for(let h=1;h<=H;h++){const f=h*f0;phase[h]+=TAU*f/SFS;if(f<3800){if(!amps[h]||j%64===0)amps[h]=env(f);s+=amps[h]*Math.sin(phase[h]);}}
        x[start+j]+=.08*e*s;}
      if(fric){const fl=Math.round(.07*SFS),w=new Float64Array(fl);for(let j=0;j<fl;j++)w[j]=r.gauss();const b=biquadBandpass(w,SFS,5200,1.4),fs0=start-Math.round(.08*SFS);
        for(let j=0;j<fl;j++){const e=Math.sin(Math.PI*j/fl);x[fs0+j]+=.05*e*b[j];}}
    }
    return x;
  }
  function makeSpeechNoise(type,len,seed){
    const r=rng(seed||9);let y;
    if(type==='white'){y=new Float64Array(len);for(let i=0;i<len;i++)y[i]=r.gauss();}
    else{y=pinkNoise(len,r);scaleTo(y,1);
      if(type==='fan'){for(let i=0;i<len;i++){const t=i/SFS;y[i]+=.5*Math.sin(TAU*100*t)+.3*Math.sin(TAU*200*t+1)+.2*Math.sin(TAU*300*t+2);}}
      else{for(let i=0;i<len;i++){const t=i/SFS;y[i]*=10**((6*Math.sin(TAU*.55*t+1.4)+4*Math.sin(TAU*1.7*t+.4))/20);}}}
    return y;
  }
  function makeEnhancementCase(type,snr){
    const clean=makeSpeech(5),n=clean.length,noise=makeSpeechNoise(type,n,9),from=Math.round(SLEAD*SFS);
    const k=Math.sqrt(power(clean,from)/(power(noise,from)*10**(snr/10)));for(let i=0;i<n;i++)noise[i]*=k;
    const noisy=new Float64Array(n);for(let i=0;i<n;i++)noisy[i]=clean[i]+noise[i];
    return{clean,noise,noisy,X:stft(noisy,SN),S:stft(clean,SN),D:stft(noise,SN),from};
  }
  function enhance(c,alpha,floorDb){
    const {X,S,D}=c,N=SN,bins=N/2+1,frames=X.frames,leadFrames=Math.floor((SLEAD*SFS)/X.hop)-1,noisePsd=new Float64Array(bins),gain=new Float32Array(frames*bins),fl=10**(floorDb/20);
    for(let f=0;f<leadFrames;f++)for(let k=0;k<bins;k++){const a=X.re[f*N+k],b=X.im[f*N+k];noisePsd[k]+=(a*a+b*b)/leadFrames;}
    for(let f=0;f<frames;f++)for(let k=0;k<bins;k++){const a=X.re[f*N+k],b=X.im[f*N+k],p=a*a+b*b;gain[f*bins+k]=Math.max(fl,Math.sqrt(Math.max(0,1-alpha*noisePsd[k]/Math.max(p,1e-20))));}
    const out=istft(X,gain),sOut=istft(S,gain),nOut=istft(D,gain),from=c.from;
    let dist=0;for(let i=from;i<out.length;i++){const e=sOut[i]-c.clean[i];dist+=e*e;}dist/=out.length-from;
    const inSnr=dB(power(c.clean,from)/power(c.noise,from)),outSnr=dB(power(sOut,from)/power(nOut,from));
    return{out,gain,inSnr,outSnr,distortion:dB(dist/power(c.clean,from)),noiseDrop:dB(power(c.noise,from)/power(nOut,from)),leadFrames};
  }

  const api={fft,hann,amplitudeSpectrum,stft,istft,makeVibration,analyzeVibration,makeScene,sceneFeatures,detectEvents,scoreEvents,makeSpeech,makeEnhancementCase,enhance,BPFO_FACTOR,VFS,EFS,SFS};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}

  /* ---------- UI ---------- */
  const $=id=>document.getElementById(id);
  const lab=window.MLAIALab;
  if(!lab||!$('vibration'))return;
  const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C={bg:'#0a1628',grid:'#30445f',text:'#afc3de',blue:'#72a8ff',cyan:'#63dcf1',amber:'#ffd170',red:'#ff7a7a',green:'#7be0a6',white:'#ffffff'};
  const FONT='12px Arial,sans-serif';
  function canvasCtx(cv,aspect,minH,maxH){
    const w=Math.max(260,cv.clientWidth||cv.parentElement.clientWidth),h=Math.round(Math.min(maxH||9999,Math.max(minH,w*aspect))),dpr=Math.min(window.devicePixelRatio||1,2);
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.height=h+'px';}
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.font=FONT;g.textBaseline='middle';return{g,w,h};
  }
  function line(g,pts,color,width){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width||1.5;g.stroke();}
  function axes(g,box,yTicks,xTicks,title){
    g.fillStyle=C.text;g.textAlign='right';
    for(const [y,label] of yTicks){g.strokeStyle=C.grid;g.lineWidth=1;g.beginPath();g.moveTo(box.x,y);g.lineTo(box.x+box.w,y);g.stroke();g.fillText(label,box.x-6,y);}
    g.textAlign='center';for(const [x,label] of xTicks)g.fillText(label,x,box.y+box.h+14);
    if(title){g.textAlign='left';g.fillStyle=C.white;g.font='600 12px Arial,sans-serif';g.fillText(title,box.x,box.y-12);g.font=FONT;}
  }
  const LUT=(()=>{const stops=[[0,[10,22,40]],[.28,[18,52,128]],[.5,[0,87,255]],[.7,[99,220,241]],[.88,[255,209,112]],[1,[255,255,255]]],lut=new Uint8ClampedArray(256*3);
    for(let i=0;i<256;i++){const v=i/255;let j=0;while(j<stops.length-2&&v>stops[j+1][0])j++;const [a,ca]=stops[j],[b,cb]=stops[j+1],u=(v-a)/(b-a);for(let c=0;c<3;c++)lut[i*3+c]=ca[c]+(cb[c]-ca[c])*u;}return lut;})();
  function drawSpectrogram(g,box,spec,frames,bins,lo,hi){
    const img=new ImageData(frames,bins),d=img.data;
    for(let f=0;f<frames;f++)for(let k=0;k<bins;k++){const v=Math.max(0,Math.min(255,Math.round((spec[f*bins+k]-lo)/(hi-lo)*255))),p=((bins-1-k)*frames+f)*4;d[p]=LUT[v*3];d[p+1]=LUT[v*3+1];d[p+2]=LUT[v*3+2];d[p+3]=255;}
    const off=document.createElement('canvas');off.width=frames;off.height=bins;off.getContext('2d').putImageData(img,0,0);
    g.imageSmoothingEnabled=true;g.drawImage(off,box.x,box.y,box.w,box.h);g.strokeStyle=C.grid;g.strokeRect(box.x+.5,box.y+.5,box.w-1,box.h-1);
  }
  function colorbar(g,x,y,w,h,label){for(let i=0;i<w;i++){const v=Math.round(i/(w-1)*255);g.fillStyle=`rgb(${LUT[v*3]},${LUT[v*3+1]},${LUT[v*3+2]})`;g.fillRect(x+i,y,1,h);}g.fillStyle=C.text;g.textAlign='left';g.fillText(label,x+w+8,y+h/2);}
  function onInputs(ids,fn){let pending=false;const run=()=>{pending=false;fn();};ids.forEach(id=>$(id).addEventListener('input',()=>{if(!pending){pending=true;requestAnimationFrame(run);}}));}
  const fmtDb=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1)+' dB';
  const fmtPlain=v=>(v<0?'−':'')+Math.abs(v).toFixed(1)+' dB';
  let redraws=[];

  /* 04 Vibration UI */
  (function(){
    let state=null;
    function compute(){
      const rpm=+$('vib-rpm').value,imb=+$('vib-imbalance').value/100,fault=+$('vib-fault').value/100,thr=+$('vib-threshold').value;
      const x=makeVibration(rpm,imb,fault,1,7);state={rpm,imb,fault,thr,a:analyzeVibration(x,rpm)};
      $('vib-rpm-value').textContent=rpm.toLocaleString('en-US')+' rpm';$('vib-imbalance-value').textContent=Math.round(imb*100)+'%';$('vib-fault-value').textContent=Math.round(fault*100)+'%';$('vib-threshold-value').textContent=thr+' dB';
      const a=state.a,imbAlarm=a.oneXDb>thr,brgAlarm=a.bpfoDb>thr;
      $('vib-1x').textContent=(a.oneX*1000).toFixed(0)+' mg';$('vib-bpfo').textContent=fmtDb(a.bpfoDb);$('vib-rms').textContent=(a.rms*1000).toFixed(0)+' mg';$('vib-freqs').textContent='Shaft 1× '+a.fr.toFixed(1)+' Hz · outer-race (BPFO) '+a.bpfo.toFixed(1)+' Hz';
      const set=(id,on,text)=>{const el=$(id);el.textContent=text;el.classList.toggle('on',on);};
      set('vib-alarm-imb',imbAlarm,imbAlarm?'ALARM · 1× is '+fmtPlain(a.oneXDb)+' above baseline':'OK · 1× within '+thr+' dB of baseline');
      set('vib-alarm-brg',brgAlarm,brgAlarm?'ALARM · outer-race line '+fmtPlain(a.bpfoDb)+' above floor':'OK · no envelope line above threshold');
      $('vib-summary').textContent=`Shaft ${a.fr.toFixed(1)} Hz, outer-race frequency ${a.bpfo.toFixed(1)} Hz. Imbalance ${imbAlarm?'alarm':'normal'}; bearing ${brgAlarm?'alarm':'normal'}.`;
      draw();
    }
    function draw(){
      if(!state)return;const a=state.a,cv=$('vib-canvas'),{g,w,h}=canvasCtx(cv,.78,430,560),L=48,R=24,pw=w-L-R;
      const av=h-22-44-44-24,top={x:L,y:22,w:pw,h:av*.24},mid={x:L,y:top.y+top.h+44,w:pw,h:av*.38},bot={x:L,y:mid.y+mid.h+44,w:pw,h:av*.38};
      const ns=Math.round(.1*VFS);
      const x=makeVibration(state.rpm,state.imb,state.fault,.1,7),peak=2,yW=v=>top.y+top.h/2-v/peak*top.h/2;
      axes(g,top,[[top.y,'+2 g'],[top.y+top.h/2,'0'],[top.y+top.h,'−2']],[[top.x,'0'],[top.x+pw/2,'50 ms'],[top.x+pw,'100 ms']],'Acceleration, first 100 ms');
      g.save();g.beginPath();g.rect(top.x,top.y,top.w,top.h);g.clip();line(g,Array.from({length:ns},(_,i)=>[top.x+i/(ns-1)*pw,yW(x[i])]),C.blue,1);g.restore();
      // raw spectrum on log frequency axis
      const fx=f=>mid.x+Math.log(f/10)/Math.log(800)*pw,yR=v=>mid.y+Math.min(1,Math.max(0,(0-20*Math.log10(v+1e-9))/80))*mid.h;
      axes(g,mid,[[mid.y,'0 dB'],[mid.y+mid.h/2,'−40'],[mid.y+mid.h,'−80']],[10,100,1000,8000].map(f=>[fx(f),f===8000?'8 kHz':f>=1000?f/1000+'k':String(f)]),'Raw spectrum · dB re 1 g');
      g.fillStyle='rgba(255,209,112,.13)';g.fillRect(fx(V_BAND[0]),mid.y,fx(V_BAND[1])-fx(V_BAND[0]),mid.h);g.fillStyle=C.amber;g.textAlign='center';g.fillText('envelope band',(fx(V_BAND[0])+fx(V_BAND[1]))/2,mid.y+10);
      const pts=[];for(let k=Math.ceil(10/a.df);k<a.raw.length;k++)pts.push([fx(k*a.df),yR(a.raw[k])]);line(g,pts,C.cyan,1);
      g.fillStyle=C.white;g.textAlign='left';g.fillText('1×',fx(a.fr)+4,yR(a.oneX)-2);
      // envelope spectrum 0-500 Hz, linear, dB re envelope floor
      const ex=f=>bot.x+f/500*pw,yE=v=>bot.y+bot.h-Math.min(1,Math.max(0,20*Math.log10(v/a.envFloor+1e-9)+6)/36)*bot.h;
      axes(g,bot,[[yE(a.envFloor*10**(30/20)),'+30'],[yE(a.envFloor*10**(1)),'+20'],[yE(a.envFloor*10**(.5)),'+10'],[yE(a.envFloor),'0 dB']],[0,100,200,300,400,500].map(f=>[ex(f),f===500?'500 Hz':String(f)]),'Envelope spectrum · dB re floor');
      const thrY=yE(a.envFloor*10**(state.thr/20));g.setLineDash([5,5]);line(g,[[bot.x,thrY],[bot.x+pw,thrY]],C.red,1.2);g.setLineDash([]);
      g.fillStyle=C.red;g.textAlign='right';g.fillText('alarm threshold',bot.x+pw-4,thrY-8);
      for(let m=1;m*a.bpfo<500;m++){const X=ex(m*a.bpfo);g.setLineDash([2,4]);line(g,[[X,bot.y],[X,bot.y+bot.h]],C.amber,1);g.setLineDash([]);g.fillStyle=C.amber;g.textAlign='center';g.fillText(m===1?'BPFO':m+'×',X,bot.y+8);}
      const ep=[];for(let k=1;k*a.df<=500;k++)ep.push([ex(k*a.df),yE(Math.max(a.envSpec[k],a.envFloor*.5))]);
      g.save();g.beginPath();g.rect(bot.x,bot.y,bot.w,bot.h);g.clip();line(g,ep,C.cyan,1.3);g.restore();
      cv.setAttribute('aria-label',`Three plots. Waveform peak about ${(Math.max(...x.map(Math.abs))).toFixed(2)} g. Raw spectrum shows the 1× shaft line at ${a.fr.toFixed(1)} Hz, ${(a.oneX*1000).toFixed(0)} milli-g. Envelope spectrum peak near the outer-race frequency ${a.bpfo.toFixed(1)} Hz is ${a.bpfoDb.toFixed(1)} dB above the median floor; alarm threshold ${state.thr} dB.`);
    }
    redraws.push(draw);
    onInputs(['vib-rpm','vib-imbalance','vib-fault','vib-threshold'],()=>{lab.stop('Machine settings updated. Press a listen button to compare.');compute();});
    lab.register('vib-current',()=>({rate:VFS,samples:toAudio(makeVibration(state.rpm,state.imb,state.fault,4,8),.38)}));
    lab.register('vib-healthy',()=>({rate:VFS,samples:toAudio(makeVibration(state.rpm,0,0,4,8),.38)}));
    $('vib-reset').addEventListener('click',()=>{lab.stop('Vibration experiment reset.');$('vib-rpm').value=1800;$('vib-imbalance').value=0;$('vib-fault').value=0;$('vib-threshold').value=12;compute();});
    $('vib-fault-preset').addEventListener('click',()=>{lab.stop('Early bearing defect applied.');$('vib-fault').value=12;compute();});
    compute();
  })();
  function toAudio(x,gain){const n=x.length,out=new Float32Array(n),fade=Math.round(.02*(n/4));for(let i=0;i<n;i++){const e=Math.min(1,i/fade,(n-1-i)/fade);out[i]=Math.max(-1,Math.min(1,x[i]*gain*e));}return out;}

  /* 05 Event detection UI */
  (function(){
    let scene=null,feats=null,bgKey=null,res=null,anim=0;
    function compute(){
      const bg=+$('sed-background').value,thr=+$('sed-threshold').value,kind=document.querySelector('input[name="sed-feature"]:checked').value;
      if(bgKey!==bg){scene=makeScene(bg,11);feats=sceneFeatures(scene.x);bgKey=bg;}
      const feat=kind==='band'?feats.band:feats.broad,det=detectEvents(feat,thr,feats.frameTime),sc=scoreEvents(det.segs,scene.truth);
      res={bg,thr,kind,feat,det,sc};
      $('sed-background-value').textContent=bg+' dBFS';$('sed-threshold-value').textContent=thr+' dB';
      $('sed-hits').textContent=sc.hits+' / '+scene.truth.length;$('sed-fa').textContent=String(sc.falseAlarms);$('sed-misses').textContent=String(sc.misses);
      $('sed-summary').textContent=`${sc.hits} of ${scene.truth.length} events detected, ${sc.falseAlarms} false alarm${sc.falseAlarms===1?'':'s'}, using ${kind==='band'?'1–6 kHz band energy':'broadband energy'} at ${thr} dB above the median.`;
      draw();
    }
    function draw(playT){
      if(!res)return;const cv=$('sed-canvas'),{g,w,h}=canvasCtx(cv,.62,360,500),L=48,R=24,pw=w-L-R;
      const av=h-22-40-28-8,sp={x:L,y:22,w:pw,h:av*.5},ft={x:L,y:sp.y+sp.h+40,w:pw,h:av*.33},ln={x:L,y:ft.y+ft.h+28,w:pw,h:av*.17};
      const tx=t=>L+t/EDUR*pw;
      drawSpectrogram(g,sp,feats.spec,feats.frames,feats.bins,-108,-36);
      axes(g,sp,[[sp.y,'8k'],[sp.y+sp.h/2,'4k'],[sp.y+sp.h,'0 Hz']],[],'Spectrogram (0–8 kHz)');
      if(res.kind==='band'){const y1=sp.y+sp.h*(1-6/8),y2=sp.y+sp.h*(1-1/8);g.strokeStyle=C.amber;g.setLineDash([4,4]);g.strokeRect(L+.5,y1,pw-1,y2-y1);g.setLineDash([]);}
      // feature trace
      const f=res.feat,lo=res.det.floor-10,hi=res.det.floor+45,fy=v=>ft.y+ft.h-Math.min(1,Math.max(0,(v-lo)/(hi-lo)))*ft.h;
      axes(g,ft,[[fy(res.det.floor+40),'+40'],[fy(res.det.floor+20),'+20'],[fy(res.det.floor),'0 dB']],[0,2,4,6,8].map(t=>[tx(t),t+' s']),(res.kind==='band'?'1–6 kHz energy':'Broadband energy')+' · dB re median');
      line(g,Array.from(f,(v,i)=>[tx(feats.frameTime(i)),fy(v)]),C.cyan,1.2);
      const thY=fy(res.det.floor+res.thr);g.setLineDash([5,5]);line(g,[[L,thY],[L+pw,thY]],C.red,1.2);g.setLineDash([]);
      // lanes
      g.textAlign='right';g.fillStyle=C.text;g.fillText('truth',L-6,ln.y+ln.h*.25);g.fillText('found',L-6,ln.y+ln.h*.8);
      for(const d of scene.distractors){g.fillStyle='rgba(175,195,222,.22)';g.fillRect(tx(d.t0),ln.y,tx(d.t1)-tx(d.t0),ln.h*.45);}
      scene.truth.forEach((t,i)=>{g.fillStyle=res.sc.hitTruth[i]?C.green:C.amber;g.fillRect(tx(t.t0),ln.y,Math.max(3,tx(t.t1)-tx(t.t0)),ln.h*.45);});
      for(const s of res.det.segs){g.fillStyle=s.hit?C.blue:C.red;g.fillRect(tx(s.t0),ln.y+ln.h*.6,Math.max(3,tx(s.t1)-tx(s.t0)),ln.h*.4);}
      if(playT!==undefined&&playT<=EDUR){g.strokeStyle=C.white;g.lineWidth=1.5;g.beginPath();g.moveTo(tx(playT),sp.y);g.lineTo(tx(playT),ln.y+ln.h);g.stroke();}
      cv.setAttribute('aria-label',`Spectrogram of an 8 second synthetic scene with 8 target events and 2 low-frequency rumbles, an energy trace with the threshold, and event lanes. ${$('sed-summary').textContent}`);
    }
    function tick(){const p=lab.position();if(p&&(p.kind==='sed-scene'||p.kind==='sed-detected')){draw(p.t);anim=requestAnimationFrame(tick);}else{anim=0;draw();}}
    function startHead(){if(!reduceMotion&&!anim)anim=requestAnimationFrame(tick);}
    redraws.push(()=>draw());
    onInputs(['sed-background','sed-threshold'],()=>{lab.stop('Detector settings updated. Press a listen button to compare.');compute();});
    document.querySelectorAll('input[name="sed-feature"]').forEach(r=>r.addEventListener('change',()=>{lab.stop('Detector feature changed.');compute();}));
    lab.register('sed-scene',()=>{setTimeout(startHead,50);return{rate:EFS,samples:toAudio(scene.x,1.2)};});
    lab.register('sed-detected',()=>{const n=scene.x.length,gate=new Float32Array(n),r=Math.round(.01*EFS);
      for(const s of res.det.segs){const a=Math.max(0,Math.round(s.t0*EFS)),b=Math.min(n,Math.round(s.t1*EFS));for(let i=a;i<b;i++)gate[i]=Math.min(1,(i-a)/r,(b-1-i)/r);}
      const y=new Float32Array(n);for(let i=0;i<n;i++)y[i]=scene.x[i]*gate[i];setTimeout(startHead,50);return{rate:EFS,samples:toAudio(y,1.2)};});
    $('sed-reset').addEventListener('click',()=>{lab.stop('Detection experiment reset.');$('sed-background').value=-46;$('sed-threshold').value=10;document.getElementById('sed-feature-band').checked=true;compute();});
    compute();
  })();

  /* 06 Spectral subtraction UI */
  (function(){
    let key=null,c=null,e=null,specIn=null,specOut=null;
    function compute(){
      const type=$('ss-noise').value,snr=+$('ss-snr').value,alpha=+$('ss-alpha').value,floor=+$('ss-floor').value,k=type+snr;
      if(k!==key){c=makeEnhancementCase(type,snr);specIn=spectrogramDb(c.X);key=k;}
      e=enhance(c,alpha,floor);specOut=spectrogramDb(stft(e.out,SN));
      $('ss-snr-value').textContent=snr+' dB';$('ss-alpha-value').textContent=alpha.toFixed(1)+'×';$('ss-floor-value').textContent=floor+' dB';
      $('ss-in').textContent=fmtPlain(e.inSnr);$('ss-out').textContent=fmtPlain(e.outSnr);$('ss-dist').textContent=fmtPlain(e.distortion);
      $('ss-summary').textContent=`Output SNR ${fmtPlain(e.outSnr)} from ${fmtPlain(e.inSnr)} input; noise power reduced by ${e.noiseDrop.toFixed(1)} dB; speech distortion ${fmtPlain(e.distortion)} relative to the clean signal.`;
      draw();
    }
    function draw(){
      if(!e)return;const cv=$('ss-canvas'),{g,w,h}=canvasCtx(cv,.66,360,520),L=48,R=24,pw=w-L-R;
      const a={x:L,y:22,w:pw,h:h*.36},b={x:L,y:a.y+a.h+40,w:pw,h:h*.36};
      drawSpectrogram(g,a,specIn.data,specIn.frames,specIn.bins,-100,-20);axes(g,a,[[a.y,'8k'],[a.y+a.h/2,'4k'],[a.y+a.h,'0 Hz']],[],'Noisy input');
      drawSpectrogram(g,b,specOut.data,specOut.frames,specOut.bins,-100,-20);axes(g,b,[[b.y,'8k'],[b.y+b.h/2,'4k'],[b.y+b.h,'0 Hz']],[0,1,2,3,4].map(t=>[L+t/SDUR*pw,t+' s']),'After spectral subtraction');
      const lx=L+SLEAD/SDUR*pw;g.strokeStyle=C.amber;g.setLineDash([4,4]);g.strokeRect(L+.5,a.y+.5,lx-L,a.h-1);g.setLineDash([]);g.fillStyle=C.amber;g.textAlign='left';g.fillText('noise estimate',L+4,a.y+10);
      colorbar(g,L,h-16,Math.min(140,pw*.35),8,'−100 to −20 dBFS');
      cv.setAttribute('aria-label',`Two spectrograms, before and after spectral subtraction. ${$('ss-summary').textContent}`);
    }
    redraws.push(draw);
    onInputs(['ss-snr','ss-alpha','ss-floor'],()=>{lab.stop('Enhancement settings updated. Press a listen button to compare.');compute();});
    $('ss-noise').addEventListener('change',()=>{lab.stop('Noise type changed.');compute();});
    lab.register('ss-clean',()=>({rate:SFS,samples:toAudio(c.clean,1.6)}));
    lab.register('ss-noisy',()=>({rate:SFS,samples:toAudio(c.noisy,1.6)}));
    lab.register('ss-enhanced',()=>({rate:SFS,samples:toAudio(e.out,1.6)}));
    $('ss-reset').addEventListener('click',()=>{lab.stop('Enhancement experiment reset.');$('ss-noise').value='fan';$('ss-snr').value=5;$('ss-alpha').value=2;$('ss-floor').value=-20;compute();});
    compute();
  })();

  let resizeTimer=0,lastW=window.innerWidth;
  window.addEventListener('resize',()=>{if(window.innerWidth===lastW)return;lastW=window.innerWidth;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>redraws.forEach(f=>f()),120);});
})();
