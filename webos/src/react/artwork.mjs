// Rail thumbnails do not need billboard-sized backgrounds. Only this known CDN
// has a verified small variant; leave addon and signed URLs exactly as provided.
export function tvRailArtwork(src){
  return typeof src==='string'&&/^https:\/\/images\.metahub\.space\/background\/(medium|large)\/tt\d+\/img$/.test(src)
    ?src.replace(/\/background\/(medium|large)\//,'/background/small/')
    :src;
}
