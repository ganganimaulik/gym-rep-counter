#!/usr/bin/env bash
# Builds the web app in demo mode for DemoPilot into dist-demo/ and serves it on :8090 (PORT
# overrides). `--build-only` stops after the build; `--deploy` publishes it to Vercel instead.
# See CLAUDE.md, "Demo build (DemoPilot)".
set -euo pipefail
cd "$(dirname "$0")/.."

# Metro's production transform cache doesn't key on EXPO_PUBLIC_* values, so a demo export and a
# normal one from the same checkout would reuse each other's output: the demo would come out
# without demo mode, or a later normal build with it. The demo gets a cache of its own (Metro
# keeps it under os.tmpdir()).
export TMPDIR="$PWD/node_modules/.cache/demo-tmp"
mkdir -p "$TMPDIR"

# No .env: the demo bundle never carries the production Firebase settings.
EXPO_NO_DOTENV=1 \
  EXPO_PUBLIC_DEMO_MODE=1 \
  EXPO_PUBLIC_API_KEY=demo \
  EXPO_PUBLIC_AUTH_DOMAIN=demo.invalid \
  EXPO_PUBLIC_PROJECT_ID=demo \
  npx expo export -p web --output-dir dist-demo

if [ "${1:-}" = "--build-only" ]; then exit 0; fi
# The production deployment of a Vercel project of its own (gym-rep-counter-demo.vercel.app),
# apart from the app's. The build goes up as prebuilt static output (Build Output API v3), so
# Vercel runs no install or build of its own, and the repo's .vercel link isn't used.
if [ "${1:-}" = "--deploy" ]; then
  stage="$PWD/node_modules/.cache/demo-deploy"
  rm -rf "$stage"
  mkdir -p "$stage/.vercel/output"
  cp -R dist-demo "$stage/.vercel/output/static"
  echo '{"version":3}' >"$stage/.vercel/output/config.json"
  exec vercel deploy --prebuilt --cwd "$stage" --prod --yes \
    --scope ganganimauliks-projects --project gym-rep-counter-demo
fi
# On both IPv6 and IPv4: DemoPilot's egress proxy connects to the first address localhost resolves
# to (::1 on macOS) with no fallback, and http-server alone listens on IPv4 only.
exec npx --yes http-server dist-demo -a :: -p "${PORT:-8090}" -c-1
