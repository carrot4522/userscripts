// ==UserScript==
// @name         TrippyWiki Visual Test (v1.5 – living pulse icon)
// @namespace    solomon.testing.trippywiki
// @version      1.5
// @description  Animated badge that fades away, leaves a pulsing glowing icon, and can be reopened by clicking it
// @match        https://trippywiki.com/5-meo-dmt/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  document.getElementById('testBadge')?.remove();
  document.getElementById('testMini')?.remove();

  const time = new Date().toLocaleTimeString();
  const badge = document.createElement('div');
  badge.id = 'testBadge';
  badge.innerHTML = `
    <div class="tw-header">🌬️ Script Loaded</div>
    <div class="tw-sub">v1.5 — ${time}</div>
  `;

  Object.assign(badge.style, {
    position: 'fixed',
    bottom: '40px',
    right: '40px',
    padding: '16px 22px',
    background: 'linear-gradient(135deg,#7b1fa2,#00e5ff)',
    color: '#fff',
    fontFamily: 'Segoe UI, sans-serif',
    fontSize: '14px',
    textAlign: 'center',
    borderRadius: '14px',
    boxShadow: '0 0 25px rgba(0,229,255,0.6)',
    zIndex: 999999,
    opacity: 0,
    transform: 'translateY(20px) scale(0.8)',
    transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(.17,.67,.83,.67)',
    cursor: 'pointer'
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes badgeGlow {
      0% { box-shadow: 0 0 10px rgba(0,229,255,0.3); filter:hue-rotate(0deg);}
      50% { box-shadow: 0 0 30px rgba(0,229,255,0.9); filter:hue-rotate(180deg);}
      100% { box-shadow: 0 0 10px rgba(0,229,255,0.3); filter:hue-rotate(360deg);}
    }
    @keyframes iconPulse {
      0% { transform: scale(1); opacity: 0.7; text-shadow: 0 0 6px rgba(0,229,255,0.6);}
      50% { transform: scale(1.15); opacity: 1; text-shadow: 0 0 14px rgba(0,229,255,1);}
      100% { transform: scale(1); opacity: 0.7; text-shadow: 0 0 6px rgba(0,229,255,0.6);}
    }
    #testBadge { animation: badgeGlow 4s infinite; }
    #testBadge .tw-header { font-weight:700;font-size:15px;letter-spacing:0.5px; }
    #testBadge .tw-sub { font-size:12px;opacity:0.9; }
    #testMini.pulsing { animation: iconPulse 3s ease-in-out infinite; }
  `;
  document.head.appendChild(style);

  document.body.appendChild(badge);

  // fade-in
  setTimeout(() => {
    badge.style.opacity = '1';
    badge.style.transform = 'translateY(0) scale(1)';
  }, 100);

  // mini icon
  const mini = document.createElement('div');
  mini.id = 'testMini';
  mini.textContent = '💠';
  Object.assign(mini.style, {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    fontSize: '28px',
    opacity: '0',
    transition: 'opacity 0.4s ease, transform 0.4s ease',
    transform: 'scale(0.5)',
    cursor: 'pointer',
    zIndex: 999998
  });
  document.body.appendChild(mini);

  // fade away badge and show icon
  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translateY(-20px) scale(0.9)';
    setTimeout(() => {
      badge.remove();
      mini.classList.add('pulsing');
      mini.style.opacity = '0.8';
      mini.style.transform = 'scale(1)';
    }, 800);
  }, 5000);

  // clicking icon reopens badge
  mini.addEventListener('click', () => {
    mini.classList.remove('pulsing');
    mini.style.opacity = '0';
    mini.style.transform = 'scale(0.5)';
    document.body.appendChild(badge);
    setTimeout(() => {
      badge.style.opacity = '1';
      badge.style.transform = 'translateY(0) scale(1)';
    }, 50);
    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateY(-20px) scale(0.9)';
      setTimeout(() => {
        badge.remove();
        mini.classList.add('pulsing');
        mini.style.opacity = '0.8';
        mini.style.transform = 'scale(1)';
      }, 800);
    }, 5000);
  });

  console.log(`💠 TrippyWiki Test v1.5 loaded at ${time}`);
})();
