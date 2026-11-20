import nextVitals from "eslint-config-next/core-web-vitals"

const config = [
  ...nextVitals,
  { ignores: [".next/**", "node_modules/**", "namaste-mobile/**", "streamer/**", "public/**", "storage/**", "test-results/**", "tour-output/**", "prisma/**", "livekit-server.exe", "bin/**"] },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // React-Compiler style advisories (the compiler is not enabled): reported, but they do not block the build
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // Playwright fixtures name their callback `use`, which the hooks rule mistakes for React's `use`
    files: ["tests/e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
]
export default config
