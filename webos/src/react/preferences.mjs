// GPL-3.0-or-later. Versioned, device-local Home preference.
export const HOME_MODE_KEY='streamglass-home-v1';
export function readHomeMode(){try{return localStorage.getItem(HOME_MODE_KEY)==='addons'?'addons':'curated';}catch(_){return 'curated';}}
export function saveHomeMode(mode){if(!['curated','addons'].includes(mode))return false;try{localStorage.setItem(HOME_MODE_KEY,mode);return true;}catch(_){return false;}}
