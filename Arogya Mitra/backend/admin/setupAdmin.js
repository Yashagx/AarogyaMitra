// ================= ADMIN PORTAL AUTOMATED SETUP SCRIPT =================
// File: setupAdmin.js
// Run this script to automatically set up the admin portal

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     🏥 AAROGYA MITRA ADMIN PORTAL SETUP                     ║
║                                                              ║
║     Automated Installation & Configuration Script           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

`);

async function main() {
    try {
        console.log('📋 Starting setup process...\n');

        // Step 1: Check Node.js version
        console.log('1️⃣  Checking Node.js version...');
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        
        if (majorVersion < 16) {
            console.error('❌ Node.js version 16 or higher is required!');
            console.error(`   Current version: ${nodeVersion}`);
            process.exit(1);
        }
        console.log(`✅ Node.js version: ${nodeVersion}\n`);

        // Step 2: Install dependencies
        console.log('2️⃣  Installing npm dependencies...');
        const depsToInstall = [
            'express',
            'cors',
            'body-parser',
            'sqlite3',
            'bcryptjs',
            'jsonwebtoken',
            'dotenv',
            'express-session'
        ];

        console.log('   Installing:', depsToInstall.join(', '));
        try {
            execSync(`npm install ${depsToInstall.join(' ')}`, { stdio: 'inherit' });
            console.log('✅ Dependencies installed successfully\n');
        } catch (error) {
            console.error('❌ Failed to install dependencies');
            console.error('   Please run manually: npm install ' + depsToInstall.join(' '));
            process.exit(1);
        }

        // Step 3: Create directory structure
        console.log('3️⃣  Creating directory structure...');
        const directories = [
            'middleware',
            'routes',
            '../admin-frontend'
        ];

        directories.forEach(dir => {
            const dirPath = path.join(__dirname, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`   Created: ${dir}`);
            } else {
                console.log(`   Exists: ${dir}`);
            }
        });
        console.log('✅ Directory structure ready\n');

        // Step 4: Configure .env file
        console.log('4️⃣  Configuring environment variables...');
        const envPath = path.join(__dirname, '.env');
        let envContent = '';

        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            console.log('   Found existing .env file');
        }

        // Check if admin settings exist
        if (!envContent.includes('ADMIN_PORT')) {
            console.log('   Adding admin portal configuration...');
            
            const adminPort = await question('   Enter Admin Portal port (default: 5001): ') || '5001';
            const jwtSecret = await question('   Enter JWT secret (or press Enter for auto-generated): ') || 
                              Math.random().toString(36).substring(2) + Date.now().toString(36);

            const adminEnvConfig = `

# ========== ADMIN PORTAL CONFIGURATION ==========
ADMIN_PORT=${adminPort}
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=8h
NODE_ENV=development
`;

            fs.appendFileSync(envPath, adminEnvConfig);
            console.log('✅ Environment variables configured\n');
        } else {
            console.log('✅ Admin portal configuration already exists\n');
        }

        // Step 5: Create database tables info
        console.log('5️⃣  Database setup...');
        console.log('   The following tables will be created when you start the server:');
        console.log('   - admin_users (admin portal users)');
        console.log('   - audit_logs (activity tracking)');
        console.log('   - Enhanced existing tables with verification fields');
        console.log('✅ Database schema ready\n');

        // Step 6: File checklist
        console.log('6️⃣  Required files checklist:');
        const requiredFiles = [
            { path: 'adminDbSetup.js', name: 'Database Setup' },
            { path: 'adminServer.js', name: 'Admin Server' },
            { path: 'middleware/adminAuth.js', name: 'Auth Middleware' },
            { path: 'routes/adminAuth.js', name: 'Auth Routes' },
            { path: 'routes/superAdmin.js', name: 'Super Admin Routes' },
            { path: 'routes/operatorRoutes.js', name: 'Operator Routes' },
            { path: 'routes/doctorRoutes.js', name: 'Doctor Routes' },
            { path: 'routes/hospitalPharmacyLabRoutes.js', name: 'Hospital/Pharmacy/Lab Routes' }
        ];

        console.log('\n   Backend Files:');
        requiredFiles.forEach(file => {
            const exists = fs.existsSync(path.join(__dirname, file.path));
            console.log(`   ${exists ? '✅' : '❌'} ${file.name} (${file.path})`);
        });

        const frontendFiles = [
            'index.html',
            'super-admin-dashboard.html',
            'doctor-dashboard.html',
            'operator-dashboard.html',
            'hospital-dashboard.html',
            'pharmacy-dashboard.html',
            'lab-dashboard.html'
        ];

        console.log('\n   Frontend Files (in ../admin-frontend):');
        frontendFiles.forEach(file => {
            const exists = fs.existsSync(path.join(__dirname, '../admin-frontend', file));
            console.log(`   ${exists ? '✅' : '❌'} ${file}`);
        });

        console.log('\n');

        // Step 7: Package.json check
        console.log('7️⃣  Checking package.json...');
        const packagePath = path.join(__dirname, 'package.json');
        
        if (fs.existsSync(packagePath)) {
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Add admin scripts if not present
            if (!pkg.scripts) pkg.scripts = {};
            
            if (!pkg.scripts['admin:start']) {
                pkg.scripts['admin:start'] = 'node adminServer.js';
                pkg.scripts['admin:dev'] = 'nodemon adminServer.js';
                
                fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
                console.log('✅ Added admin scripts to package.json\n');
            } else {
                console.log('✅ Admin scripts already configured\n');
            }
        }

        // Step 8: Summary
        console.log('8️⃣  Setup Summary:');
        console.log('   ═══════════════════════════════════════════════════\n');
        console.log('   📦 Dependencies: Installed');
        console.log('   📁 Directories: Created');
        console.log('   ⚙️  Environment: Configured');
        console.log('   🗄️  Database: Schema Ready');
        console.log('\n   ═══════════════════════════════════════════════════\n');

        // Step 9: Next steps
        console.log('✅ SETUP COMPLETE!\n');
        console.log('📝 Next Steps:\n');
        console.log('   1. Ensure all backend files are created in /backend:');
        console.log('      - adminDbSetup.js');
        console.log('      - adminServer.js');
        console.log('      - middleware/adminAuth.js');
        console.log('      - routes/*.js (all route files)\n');
        
        console.log('   2. Create frontend files in /admin-frontend:');
        console.log('      - index.html (login page)');
        console.log('      - *-dashboard.html (role-specific dashboards)\n');
        
        console.log('   3. Start the servers:\n');
        console.log('      Terminal 1 (Main App):');
        console.log('      $ cd backend');
        console.log('      $ node server.js\n');
        
        console.log('      Terminal 2 (Admin Portal):');
        console.log('      $ cd backend');
        console.log('      $ node adminServer.js\n');
        
        console.log('   4. Access Admin Portal:');
        console.log(`      🌐 http://localhost:${process.env.ADMIN_PORT || 5001}\n`);
        
        console.log('   5. Default Login:');
        console.log('      Username: superadmin');
        console.log('      Password: Admin@123');
        console.log('      ⚠️  CHANGE PASSWORD IMMEDIATELY!\n');

        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('📚 For detailed documentation, see:');
        console.log('   - README_ADMIN_PORTAL.md\n');
        console.log('💡 Need help?');
        console.log('   - Email: support@aarogyamitra.gov.in');
        console.log('   - Phone: 1800-XXX-XXXX\n');
        console.log('═══════════════════════════════════════════════════════════\n');

        rl.close();

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.error('\nPlease check the error and try again.');
        console.error('For manual setup, refer to README_ADMIN_PORTAL.md\n');
        rl.close();
        process.exit(1);
    }
}

// Run setup
main();