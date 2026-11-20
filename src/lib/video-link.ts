export const VIDEO_EXT = /\.(?:mp4|webm|ogg|ogv|mov)$/i

/** Does this link point at a file the browser can play itself (our uploads or a direct video file)? */
export const isDirectVideo = (url: string) => url.startsWith("/uploads/videos/") || VIDEO_EXT.test(url.split("?")[0])
