import * as fs from 'fs';
import * as path from 'path';

describe('Jest Configuration Validation', () => {
  const rootDir = process.cwd();
  
  describe('Package.json Configuration', () => {
    it('should have package.json with test scripts', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBeTruthy();
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('test:watch');
      expect(packageJson.scripts).toHaveProperty('test:cov');
      expect(packageJson.scripts).toHaveProperty('test:e2e');
    });

    it('should have Jest dependencies', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.devDependencies).toHaveProperty('@types/jest');
      expect(packageJson.devDependencies).toHaveProperty('jest');
      expect(packageJson.devDependencies).toHaveProperty('ts-jest');
    });

    it('should have NestJS testing dependencies', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.devDependencies).toHaveProperty('@nestjs/testing');
    });
  });

  describe('Test File Structure', () => {
    it('should have test directory', () => {
      const testDir = path.join(rootDir, 'test');
      expect(fs.existsSync(testDir)).toBeTruthy();
    });

    it('should have proper test file patterns', () => {
      const testDir = path.join(rootDir, 'test');
      
      if (fs.existsSync(testDir)) {
        const testFiles = fs.readdirSync(testDir, { recursive: true });
        const specFiles = testFiles.filter(file => 
          typeof file === 'string' && file.endsWith('.spec.ts')
        );
        
        expect(specFiles.length).toBeGreaterThan(0);
      }
    });

    it('should have test directories matching src structure', () => {
      const testDir = path.join(rootDir, 'test');
      const srcDir = path.join(rootDir, 'src');
      
      if (fs.existsSync(srcDir) && fs.existsSync(testDir)) {
        const srcDirs = fs.readdirSync(srcDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        // Check that main directories have corresponding test directories
        const importantDirs = ['auth', 'users', 'supabase'];
        importantDirs.forEach(dir => {
          if (srcDirs.includes(dir)) {
            const testDirPath = path.join(testDir, dir);
            expect(fs.existsSync(testDirPath)).toBeTruthy();
          }
        });
      }
    });
  });

  describe('TypeScript Configuration', () => {
    it('should have proper TypeScript configuration for tests', () => {
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        
        expect(tsconfig.compilerOptions).toBeDefined();
        expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
        expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
      }
    });

    it('should support ES2020+ features for testing', () => {
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        
        expect(tsconfig.compilerOptions.target).toBeDefined();
        expect(['ES2020', 'ES2021', 'ES2022', 'ESNext']).toContain(tsconfig.compilerOptions.target);
      }
    });
  });

  describe('Environment Files', () => {
    it('should have .env.example file', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBeTruthy();
    });

    it('should have proper gitignore for env files', () => {
      const gitignorePath = path.join(rootDir, '.gitignore');
      
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        expect(gitignoreContent).toContain('.env');
      }
    });
  });
});