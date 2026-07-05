/** Full-screen splash shown on every full document load (first visit,
 * hard refresh, PWA cold start) - client-side navigations never
 * re-render the root layout, so those are covered by loading.tsx
 * instead. Pure HTML+CSS+inline script: visible from the very first
 * paint, no hydration needed, fades out once the page has loaded (with
 * a short minimum so it doesn't just blink, and a hard timeout so a
 * hung resource can never leave it stuck). */
export function SplashScreen() {
  return (
    <>
      <div
        id="splash"
        aria-hidden
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-2 bg-background transition-opacity duration-300"
      >
        <span className="brand-loader whitespace-nowrap text-3xl font-bold tracking-tight">
          OKTAGON GARÁŽ
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500">
          Tipovačka
        </span>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
var start=Date.now(),MIN=600,MAX=5000;
function hide(){var s=document.getElementById('splash');if(!s)return;s.style.opacity='0';setTimeout(function(){s.remove();},300);}
function onReady(){var left=MIN-(Date.now()-start);setTimeout(hide,left>0?left:0);}
if(document.readyState==='complete'){onReady();}else{window.addEventListener('load',onReady);}
setTimeout(hide,MAX);
})();`,
        }}
      />
    </>
  );
}
