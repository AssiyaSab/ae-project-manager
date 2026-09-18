const fs = require('fs');

const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./src/app/api', (filePath) => {
  if (!filePath.endsWith('route.ts')) return;
  if (filePath.includes('telegram') || filePath.includes('auth')) return; // Skip telegram webhooks and auth itself

  let code = fs.readFileSync(filePath, 'utf8');

  // Replace definitions with import
  const authRegex = /function validateAuth[\s\S]*?return[\s\S]*?}[\s\n]*function validateAdmin[\s\S]*?return[\s\S]*?}/m;
  if (authRegex.test(code)) {
    code = code.replace(authRegex, `import { validateAuth, validateAdmin } from '@/lib/auth';`);
  } else {
      // Maybe just one of them exists or it's different
      code = code.replace(/function validateAuth[\s\S]*?return[\s\S]*?}/m, `import { validateAuth, validateAdmin } from '@/lib/auth';`);
      code = code.replace(/function validateAdmin[\s\S]*?return[\s\S]*?}/m, ``);
  }

  // Ensure import is not duplicated
  if (code.match(/import { validateAuth/g) && code.match(/import { validateAuth/g).length > 1) {
     // manual cleanup might be needed, but regex should just replace the first.
  }

  // Replace usage
  code = code.replace(/!validateAuth\(request\)/g, '!(await validateAuth(request))');
  code = code.replace(/!validateAdmin\(request\)/g, '!(await validateAdmin(request))');
  
  // For `const isAdmin = validateAdmin(request);`
  code = code.replace(/const isAdmin = validateAdmin\(request\);/g, 'const isAdmin = await validateAdmin(request);');

  fs.writeFileSync(filePath, code);
  console.log('Processed', filePath);
});
