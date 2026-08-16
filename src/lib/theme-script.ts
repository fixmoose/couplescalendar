export const THEME_KEY = "cc.theme";

/**
 * Injected into <head> so the stored theme is applied before first paint —
 * without it every reload flashes light before switching to dark.
 */
export const themeScript = `(()=>{try{const t=localStorage.getItem("${THEME_KEY}")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;}catch{}})();`;
