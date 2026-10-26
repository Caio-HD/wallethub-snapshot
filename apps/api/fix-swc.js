const fs = require('fs');
const path = require('path');

const entitiesDir = path.join(__dirname, 'src', 'database', 'entities');
const files = fs.readdirSync(entitiesDir).filter(f => f.endsWith('.entity.ts'));

for (const file of files) {
  const filePath = path.join(entitiesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  let modified = false;

  // Replace import('typeorm').Relation<Entity> with Relation<Entity>
  const relationRegex = /import\('typeorm'\)\.Relation<([A-Za-z]+)>/g;
  if (relationRegex.test(content)) {
    content = content.replace(relationRegex, 'Relation<$1>');
    modified = true;
  }

  // Add Relation to the typeorm import
  if (modified) {
    const typeormImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]typeorm['"]/;
    const match = content.match(typeormImportRegex);
    if (match) {
      if (!match[1].includes('Relation')) {
        const newImport = match[0].replace(/\{([^}]+)\}/, '{$1, Relation }');
        content = content.replace(match[0], newImport);
      }
    } else {
      content = `import { Relation } from 'typeorm';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${file}`);
  }
}
