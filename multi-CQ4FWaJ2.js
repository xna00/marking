import{i}from"./imageSrc-78_mFZhl.js";const n=i.filter(e=>/image\d\.png$/.test(e)),o=n.map(e=>e.replace(/\.png$/,"A.png")),l=n.map(e=>e.replace(/\.png$/,"B.png")),m=document.getElementById("imageContainer"),d=document.getElementById("currentLabel");let t=0;function c(e){m.innerHTML=`
    <div class="outBox">
      <div class="imgSection clear">
        <img src="${o[e]}" />
      </div>
    </div>
    <div class="outBox">
      <div class="imgSection clear">
        <img src="${l[e]}" />
      </div>
    </div>
  `,d.textContent=`${e+1} / ${n.length}`}c(0);document.getElementById("prevBtn").onclick=()=>{t=(t-1+n.length)%n.length,c(t)};document.getElementById("nextBtn").onclick=()=>{t=(t+1)%n.length,c(t)};document.getElementById("submitBtn").onclick=()=>{c(t=(t+1)%n.length)};document.addEventListener("customSubmit",()=>{document.getElementById("submitBtn").click()});
