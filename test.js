const path = require('path');
const rootDir = process.cwd();
const envUrl = "file:./prisma/padel.db";
const filePath = envUrl.replace(/^file:/, '');
const clean = filePath.replace(/^\.\//, '');
console.log(path.resolve(rootDir, clean));
