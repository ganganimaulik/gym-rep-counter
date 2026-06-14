const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const STATE_FILE = path.join(__dirname, '..', '.install-iphone-state.json')
const IDLE_THRESHOLD_SECONDS = 300 // 5 minutes
const INTERVAL_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

function getIdleTimeSeconds() {
  try {
    const output = execSync(
      "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'",
    )
      .toString()
      .trim()
    const idleSeconds = parseFloat(output)
    return isNaN(idleSeconds) ? 0 : idleSeconds
  } catch (err) {
    console.error('Warning: Failed to get macOS idle time:', err.message)
    return 0
  }
}

function run() {
  console.log(`[${new Date().toISOString()}] Starting install-iphone check...`)

  if (process.platform !== 'darwin') {
    console.error('Error: This script is designed for macOS.')
    process.exit(1)
  }

  // Load state
  let state = {}
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    } catch (err) {
      console.warn('Warning: Could not parse state file, resetting state.')
    }
  }

  const now = Date.now()
  const lastSuccess = state.lastSuccessTime
    ? parseInt(state.lastSuccessTime)
    : 0
  const timeSinceLastSuccess = now - lastSuccess

  console.log(
    `Time since last successful run: ${(timeSinceLastSuccess / (1000 * 60 * 60)).toFixed(2)} hours`,
  )

  if (lastSuccess && timeSinceLastSuccess < INTERVAL_MS) {
    console.log(
      'Check complete: Install ran successfully less than 2 days ago. Skipping.',
    )
    process.exit(0)
  }

  // Check if laptop is idle
  const idleSeconds = getIdleTimeSeconds()
  console.log(
    `Current idle time: ${idleSeconds.toFixed(1)} seconds (threshold: ${IDLE_THRESHOLD_SECONDS} seconds)`,
  )

  if (idleSeconds < IDLE_THRESHOLD_SECONDS) {
    console.log(
      'Check complete: Laptop is NOT idle (user is active). Will retry on the next scheduled run.',
    )
    process.exit(0)
  }

  console.log("Laptop is idle. Proceeding to run 'npm run install-iphone'...")

  // Run the installation command
  const result = spawnSync('npm', ['run', 'install-iphone'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
  })

  if (result.status === 0) {
    console.log(
      `[${new Date().toISOString()}] npm run install-iphone completed successfully!`,
    )
    state.lastSuccessTime = Date.now()
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
      console.log('State file updated.')
    } catch (err) {
      console.error('Error writing state file:', err.message)
    }
    process.exit(0)
  } else {
    console.error(
      `[${new Date().toISOString()}] Error: npm run install-iphone failed with exit code ${result.status}.`,
    )
    process.exit(1)
  }
}

run()
