const fs = require('fs');
const path = require('path');

const pbxprojPath = path.join(__dirname, '../ios/repcounterapp.xcodeproj/project.pbxproj');

if (!fs.existsSync(pbxprojPath)) {
  console.error('project.pbxproj not found at', pbxprojPath);
  process.exit(1);
}

let content = fs.readFileSync(pbxprojPath, 'utf8');

// 1. Configure DEVELOPMENT_TEAM in buildSettings
// Remove any existing DEVELOPMENT_TEAM lines in buildSettings to avoid duplication
content = content.replace(/\s*DEVELOPMENT_TEAM\s*=\s*[^;]+;/g, '');
// Inject DEVELOPMENT_TEAM = S289LJ5AX9; into every buildSettings block
content = content.replace(/buildSettings\s*=\s*\{/g, 'buildSettings = {\n\t\t\t\tDEVELOPMENT_TEAM = S289LJ5AX9;');

// 2. Configure DevelopmentTeam in TargetAttributes
const startMatch = content.match(/TargetAttributes\s*=\s*\{/);
if (startMatch) {
  const startIndex = startMatch.index;
  let openBraces = 1;
  let endIndex = startIndex + startMatch[0].length;
  while (openBraces > 0 && endIndex < content.length) {
    if (content[endIndex] === '{') openBraces++;
    else if (content[endIndex] === '}') openBraces--;
    endIndex++;
  }
  
  let targetAttributesBlock = content.substring(startIndex, endIndex);
  
  // Clean existing DevelopmentTeam and ProvisioningStyle lines from the block
  targetAttributesBlock = targetAttributesBlock.replace(/\s*DevelopmentTeam\s*=\s*[^;]+;/g, '');
  targetAttributesBlock = targetAttributesBlock.replace(/\s*ProvisioningStyle\s*=\s*[^;]+;/g, '');
  
  // Inject the DevelopmentTeam and ProvisioningStyle into each target's dictionary
  targetAttributesBlock = targetAttributesBlock.replace(
    /([A-Za-z0-9_xX]{24}\s*=\s*\{)/g,
    '$1\n\t\t\t\t\tDevelopmentTeam = S289LJ5AX9;\n\t\t\t\t\tProvisioningStyle = Automatic;'
  );
  
  // Replace the old TargetAttributes block with the new one
  content = content.substring(0, startIndex) + targetAttributesBlock + content.substring(endIndex);
}

fs.writeFileSync(pbxprojPath, content, 'utf8');
console.log('Successfully configured Development Team S289LJ5AX9 (buildSettings & TargetAttributes) in project.pbxproj');
