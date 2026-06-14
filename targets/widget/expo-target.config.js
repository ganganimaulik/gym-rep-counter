/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "widget",
  icon: 'https://github.com/expo.png',
  entitlements: {
    "com.apple.security.application-groups": ["group.com.ganganimaulik.repcounterapp"]
  },
  frameworks: ['SwiftUI', 'ActivityKit'],
});