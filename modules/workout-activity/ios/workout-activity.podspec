Pod::Spec.new do |s|
  s.name           = 'workout-activity'
  s.version        = '1.0.0'
  s.summary        = 'Local Expo module for iOS Live Activities and Android Foreground Service'
  s.description    = 'Local Expo module for iOS Live Activities and Android Foreground Service'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'workout-attributes'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
