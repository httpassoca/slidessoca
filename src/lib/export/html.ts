// The self-contained HTML download (SL-0007): one file with the deck's CSS, every slide as the
// static markup SlideView rendered (already sanitised), optional speaker notes and a tiny
// vanilla-JS player. Pure string assembly — the browser code supplies the markup and the CSS.

export interface HtmlSlide {
  /** SlideView's rendered markup (sanitised by renderMarkdown, never raw deck text). */
  html: string
  /** Sanitised notes HTML; omitted (or empty) when notes are not part of the download. */
  notes?: string
}

export interface DeckHtmlInput {
  title: string
  /** `data-theme` / `data-palette` of the deck theme. */
  mode: 'dark' | 'light'
  palette: string | null
  /** Page background (meta theme-color). */
  bg: string
  /** Tokens + theme + SlideView CSS (+ @font-face with data: URLs when available). */
  css: string
  /** Stylesheet URL used when fonts could not be embedded (falls back to system fonts offline). */
  fontsHref?: string
  slides: HtmlSlide[]
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/** CSS can't close its own <style> element. */
const safeCss = (css: string) => css.replace(/<\/(style)/gi, '<\\/$1')

const PLAYER_CSS = `
html,body{margin:0;block-size:100%;}
body{background:color-mix(in oklch,var(--ss-bg) 82%,var(--ss-black));color:var(--ss-fg);font-family:var(--ss-font-body);overflow:hidden;}
.x-deck{position:fixed;inset:0 0 44px 0;display:grid;place-items:center;padding:8px;box-sizing:border-box;touch-action:pan-y;user-select:none;-webkit-user-select:none;}
.x-frame{inline-size:min(100%,calc((100dvh - 60px)*16/9));}
.x-frame[hidden]{display:none;}
.x-full .x-deck{inset:0;padding:0;}
.x-full .x-frame{inline-size:min(100vw,calc(100dvh*16/9));}
.x-full .x-bar,.x-full .x-progress{display:none;}
.x-progress{position:fixed;inset-inline:0;inset-block-end:44px;block-size:3px;background:var(--ss-line);}
.x-progress span{display:block;block-size:100%;background:var(--ss-primary);}
.x-bar{position:fixed;inset-inline:0;inset-block-end:0;block-size:44px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding-inline:8px;background:var(--ss-bg);border-block-start:1px solid var(--ss-line);}
.x-bar button{min-inline-size:32px;min-block-size:32px;padding-inline:8px;border:1px solid transparent;border-radius:0;background:transparent;color:var(--ss-fg);font:inherit;font-size:14px;cursor:pointer;}
.x-bar button:hover{border-color:var(--ss-line-strong);}
.x-bar button:focus-visible{outline:2px solid var(--ss-primary);}
.x-bar button:disabled{opacity:.4;cursor:default;}
.x-count{min-inline-size:5ch;text-align:center;font-family:var(--ss-font-mono);font-size:14px;font-variant-numeric:tabular-nums;}
.x-title{flex:1;min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;}
.x-notes{position:fixed;inset-inline:0;inset-block-end:47px;max-block-size:40dvh;overflow:auto;box-sizing:border-box;padding:12px 16px;background:var(--ss-bg-elev);border-block-start:1px solid var(--ss-line);font-size:15px;line-height:1.5;}
.x-notes[hidden],.x-note[hidden]{display:none;}
.x-notes p{margin:0 0 .5em;}
.x-sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}
@media (max-width:420px){.x-title{display:none;}}
`

// Keys: ←/→ Space (Shift+Space back) PageUp/PageDown Home/End · F fullscreen · N notes.
// Touch: swipe, tap the left/right third. `#n` (1-based) is kept in the URL.
const PLAYER_JS = `(function(){
var d=document,frames=[].slice.call(d.querySelectorAll('.x-frame')),n=frames.length,i=0;
var notes=d.querySelector('.x-notes'),list=[].slice.call(d.querySelectorAll('.x-note'));
var count=d.querySelector('.x-count-n'),live=d.querySelector('.x-live'),bar=d.querySelector('.x-progress span');
var prev=d.querySelector('[data-x=prev]'),next=d.querySelector('[data-x=next]');
function pad(v){return String(v).padStart(Math.max(2,String(n).length),'0');}
function show(k,push){k=Math.max(0,Math.min(n-1,k));i=k;
frames.forEach(function(f,j){f.hidden=j!==k;});
list.forEach(function(f,j){f.hidden=j!==k;});
count.textContent=pad(n?k+1:0)+' / '+pad(n);live.textContent='Slide '+(k+1)+' of '+n;
bar.style.inlineSize=(n?(k+1)/n*100:0)+'%';prev.disabled=k<=0;next.disabled=k>=n-1;
if(push!==false){var h='#'+(k+1);if(location.hash!==h&&!(k===0&&!location.hash))try{history.replaceState(null,'',h);}catch(e){location.hash=h;}}}
function fromHash(){var m=/^#(\\d+)$/.exec(location.hash);if(m)show(parseInt(m[1],10)-1,false);}
function full(){var e=d.documentElement;if(d.fullscreenElement)d.exitFullscreen();else if(e.requestFullscreen)e.requestFullscreen();}
function toggleNotes(){if(notes)notes.hidden=!notes.hidden;}
d.addEventListener('fullscreenchange',function(){d.body.classList.toggle('x-full',!!d.fullscreenElement);});
d.addEventListener('keydown',function(e){if(e.altKey||e.ctrlKey||e.metaKey)return;var k=e.key,t=null;
if(k==='ArrowRight'||k==='PageDown'||(k===' '&&!e.shiftKey)||k==='ArrowDown')t=i+1;
else if(k==='ArrowLeft'||k==='PageUp'||(k===' '&&e.shiftKey)||k==='ArrowUp')t=i-1;
else if(k==='Home')t=0;else if(k==='End')t=n-1;
else if(k==='f'||k==='F'){full();e.preventDefault();return;}
else if((k==='n'||k==='N')&&notes){toggleNotes();e.preventDefault();return;}
if(t!==null){show(t);e.preventDefault();}});
var stage=d.querySelector('.x-deck'),sx=0,sy=0,down=false;
stage.addEventListener('pointerdown',function(e){down=true;sx=e.clientX;sy=e.clientY;});
stage.addEventListener('pointerup',function(e){if(!down)return;down=false;var dx=e.clientX-sx,dy=e.clientY-sy;
if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){show(dx<0?i+1:i-1);return;}
if(Math.abs(dx)<10&&Math.abs(dy)<10){var w=stage.clientWidth;if(e.clientX<w/3)show(i-1);else if(e.clientX>w*2/3)show(i+1);}});
stage.addEventListener('pointercancel',function(){down=false;});
prev.addEventListener('click',function(){show(i-1);});next.addEventListener('click',function(){show(i+1);});
d.querySelector('[data-x=full]').addEventListener('click',full);
var nb=d.querySelector('[data-x=notes]');if(nb)nb.addEventListener('click',toggleNotes);
window.addEventListener('hashchange',fromHash);
show(0,false);fromHash();
})();`

/** Assemble the whole `.html` document. */
export function buildDeckHtml(input: DeckHtmlInput): string {
  const { title, mode, palette, bg, css, fontsHref, slides } = input
  const theme = `data-theme="${mode}"${palette ? ` data-palette="${escapeHtml(palette)}"` : ''}`
  const hasNotes = slides.some((s) => s.notes && s.notes.trim())
  const t = escapeHtml(title)
  const frames = slides
    .map(
      (s, i) =>
        `<section class="x-frame" aria-label="Slide ${i + 1} of ${slides.length}"${i ? ' hidden' : ''}>${s.html}</section>`,
    )
    .join('\n')
  const notes = hasNotes
    ? `<aside class="x-notes" aria-label="Speaker notes" hidden>${slides
        .map(
          (s, i) =>
            `<div class="x-note"${i ? ' hidden' : ''}>${s.notes?.trim() ? s.notes : '<p>No notes for this slide.</p>'}</div>`,
        )
        .join('')}</aside>`
    : ''
  const notesButton = hasNotes
    ? '<button type="button" data-x="notes" title="Speaker notes (N)">Notes</button>'
    : ''
  return `<!doctype html>
<html lang="en" ${theme}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="slidessoca">
<meta name="theme-color" content="${escapeHtml(bg)}">
<title>${t}</title>
${fontsHref ? `<link rel="stylesheet" href="${escapeHtml(fontsHref)}">\n` : ''}<style>${safeCss(css)}</style>
<style>${PLAYER_CSS}</style>
</head>
<body ${theme}>
<h1 class="x-sr">${t}</h1>
<main class="x-deck">
${frames}
</main>
${notes}
<div class="x-progress" aria-hidden="true"><span></span></div>
<nav class="x-bar" aria-label="Slide controls">
<button type="button" data-x="prev" aria-label="Previous slide">&larr;</button>
<span class="x-count" aria-hidden="true"><span class="x-count-n"></span></span>
<button type="button" data-x="next" aria-label="Next slide">&rarr;</button>
<span class="x-title">${t}</span>
${notesButton}<button type="button" data-x="full" title="Fullscreen (F)">Fullscreen</button>
</nav>
<p class="x-sr x-live" aria-live="polite"></p>
<script>${PLAYER_JS}</script>
</body>
</html>
`
}
