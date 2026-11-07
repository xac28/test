// Public address of the AYA server. Set EXPO_PUBLIC_API_BASE (e.g. in .env or eas.json) for your own domain.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://5.63.21.194.sslip.io:3000"

// Colours — the same tokens as the web design (tailwind.config.js): coral for actions, lagoon teal for brand surfaces,
// saffron and lotus as soft accents, warm paper and ink for the rest.
export const colors = {
  cream: "#fbf6ee",
  paper: "#fffdf9",
  rule: "#e4dccd",
  ink: "#17313a",
  sage: {
    50: "#f6f6f1",
    100: "#ecece4",
    200: "#dbdbcf",
    300: "#bfc0b2",
    400: "#999b8d",
    500: "#6a7068",
    600: "#525a56",
    700: "#2d4a4c",
    800: "#1d3739",
    900: "#12272b",
  },
  clay: {
    50: "#fef3ee",
    100: "#fce6dc",
    200: "#f9cdbb",
    300: "#f4a58a",
    400: "#ee8466",
    500: "#e2684a",
    600: "#c94e32",
    700: "#a53d27",
  },
  teal: {
    50: "#eef7f6",
    100: "#d6ece9",
    200: "#aedbd5",
    300: "#7bc2ba",
    400: "#47a39a",
    500: "#2a857d",
    600: "#1f6b66",
    700: "#1a5652",
    800: "#17433f",
    900: "#12302e",
  },
  saffron: { 100: "#fdf0cf", 300: "#f7cf66", 400: "#f2bb3a", 600: "#c0820f" },
  lotus: { 100: "#f9e3ea", 400: "#d96f93", 500: "#c24d77" },
  red: "#d9382c",
  green: "#2a857d",
  white: "#ffffff",
}

export const fonts = {
  display: "serif",
  body: "System",
}

/** absolute address of a file the server hosts (/poses/…, /uploads/…) */
export const assetUrl = (path: string | null | undefined) => (!path ? null : /^https?:/.test(path) ? path : `${API_BASE}${path}`)
