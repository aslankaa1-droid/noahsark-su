/* PIN-gate Платформы Ноев Ковчег. Сессия — 30 дней в localStorage. */
(function(){
  var HASHES = [
    "0a44cd2cbce532cd9caae282721286ca5ee7d65f3fc119d9e1cd37341144615e",
    "831f7756d9ceeeaf55c495a005261772fbc546b15704cfa7fd300f9947ceb775",
    "3e4360471ed97c89d6c0ecb0ae0a888aa28a9576c4429c58f54c40176c1e2714",
    "0409eab7d375cb35eccaff5c0d58f1cbba07e1987ca60bcb9fb79ae09fd794d2",
    "8b76a77156d3a40827e29704a590372f844872f961094a7cf774ef67a1be62e9"
  ];
  var KEY = "noah-ark-unlocked-v1";
  var TTL_MS = 30 * 24 * 3600 * 1000;

  function now(){ return Date.now(); }
  function isUnlocked(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return false;
      var v = JSON.parse(raw);
      if(!v || !v.ts) return false;
      return (now() - v.ts) < TTL_MS;
    }catch(e){ return false; }
  }
  function setUnlocked(){
    try{ localStorage.setItem(KEY, JSON.stringify({ts: now()})); }catch(e){}
  }
  function sha256Hex(str){
    if(window.crypto && window.crypto.subtle){
      var enc = new TextEncoder().encode(str);
      return window.crypto.subtle.digest("SHA-256", enc).then(function(buf){
        var bytes = new Uint8Array(buf), hex = "";
        for(var i=0;i<bytes.length;i++){
          var h = bytes[i].toString(16);
          if(h.length === 1) h = "0" + h;
          hex += h;
        }
        return hex;
      });
    }
    return Promise.reject(new Error("crypto unavailable"));
  }

  if(isUnlocked()){ return; }

  // Lock document
  document.documentElement.classList.add("noah-locked");

  function mount(){
    if(document.getElementById("noah-gate")) return;
    var gate = document.createElement("div");
    gate.id = "noah-gate";
    gate.innerHTML =
      '<div class="box" role="dialog" aria-modal="true" aria-label="PIN access">'+
        '<span class="eyebrow">Confidential · Конфиденциально</span>'+
        '<h2>Платформа «Ноев Ковчег»</h2>'+
        '<p>Доступ к материалам по PIN-коду. После ввода доступ сохранится на 30 дней. <span style="display:block;margin-top:.4em;opacity:.7">Access by PIN. Session: 30 days.</span></p>'+
        '<label for="noah-gate-pin">PIN · 6 digits</label>'+
        '<input id="noah-gate-pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="6" />'+
        '<button class="submit" type="button" id="noah-gate-btn">Открыть · Unlock</button>'+
        '<div class="msg" id="noah-gate-msg" aria-live="polite"></div>'+
        '<div class="meta">Aslan Kaa · <a href="mailto:aslankaa@yandex.ru">aslankaa@yandex.ru</a></div>'+
      '</div>';
    document.body.appendChild(gate);

    var input = document.getElementById("noah-gate-pin");
    var btn = document.getElementById("noah-gate-btn");
    var msg = document.getElementById("noah-gate-msg");
    var busy = false;

    function tryUnlock(){
      if(busy) return;
      var pin = (input.value || "").trim();
      if(!/^[0-9]{4,8}$/.test(pin)){
        msg.textContent = "Введите PIN (6 цифр) · Enter your 6-digit PIN";
        input.classList.add("err");
        setTimeout(function(){ input.classList.remove("err"); }, 400);
        return;
      }
      busy = true;
      msg.textContent = "Проверка… · Checking…";
      sha256Hex(pin).then(function(hex){
        busy = false;
        if(HASHES.indexOf(hex) >= 0){
          setUnlocked();
          msg.textContent = "Доступ открыт · Access granted";
          var g = document.getElementById("noah-gate");
          document.documentElement.classList.remove("noah-locked");
          if(g) g.parentNode.removeChild(g);
        } else {
          msg.textContent = "Неверный PIN · Wrong PIN";
          input.classList.add("err");
          input.value = "";
          setTimeout(function(){ input.classList.remove("err"); input.focus(); }, 400);
        }
      }).catch(function(){
        busy = false;
        msg.textContent = "Браузер не поддерживает Web Crypto · Browser missing crypto API";
      });
    }

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", function(e){ if(e.key === "Enter") tryUnlock(); });
    setTimeout(function(){ try{ input.focus(); }catch(e){} }, 50);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
