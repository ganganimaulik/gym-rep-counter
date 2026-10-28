const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const PODFILE_DEPLOYMENT_TARGET_SNIPPET = `
    projects = [installer.pods_project]
    projects.concat(installer.generated_projects) if installer.respond_to?(:generated_projects)
    projects.compact.each do |project|
      project.targets.each do |target|
        target.build_configurations.each do |config|
          if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] && config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
            config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
          end
        end
      end
    end
`

module.exports = function withPodfileDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      )
      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, 'utf8')
        if (
          !podfile.includes(
            "config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'",
          )
        ) {
          const postInstallRegex =
            /(post_install\s+do\s+\|installer\|[\s\S]*?)(^\s*end\s*$)/m
          if (postInstallRegex.test(podfile)) {
            podfile = podfile.replace(
              postInstallRegex,
              `$1${PODFILE_DEPLOYMENT_TARGET_SNIPPET}$2`,
            )
            fs.writeFileSync(podfilePath, podfile, 'utf8')
          }
        }
      }
      return config
    },
  ])
}
