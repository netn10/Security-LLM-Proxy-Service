/**
 * Simple startup script that sets environment variables and starts the server
 * This ensures the server has the necessary configuration even without a .env file
 */

const { spawn, exec } = require('child_process');
const path = require('path');

// Set default environment variables
process.env.PORT = process.env.PORT || '3000';
process.env.OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com';
process.env.ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com';
process.env.ENABLE_DATA_SANITIZATION = process.env.ENABLE_DATA_SANITIZATION || 'true';

// Function to kill processes on the specified port
function killProcessOnPort(port) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows 
      ? `netstat -ano | findstr :${port} | findstr LISTENING`
      : `lsof -ti:${port}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        console.log(`✅ No processes found on port ${port}`);
        resolve();
        return;
      }
      
      const pids = isWindows 
        ? stdout.split('\n').map(line => line.trim().split(/\s+/).pop()).filter(pid => pid && !isNaN(pid))
        : stdout.trim().split('\n');
      
      if (pids.length === 0) {
        console.log(`✅ No processes found on port ${port}`);
        resolve();
        return;
      }
      
      console.log(`🔫 Killing ${pids.length} process(es) on port ${port}...`);
      
      const killCommand = isWindows 
        ? `taskkill /F /PID ${pids.join(' /PID ')}`
        : `kill -9 ${pids.join(' ')}`;
      
      exec(killCommand, (killError, killStdout, killStderr) => {
        if (killError) {
          console.warn(`⚠️  Warning: Could not kill all processes: ${killError.message}`);
        } else {
          console.log(`✅ Successfully killed process(es) on port ${port}`);
        }
        resolve();
      });
    });
  });
}

// Warn about missing API keys
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set. OpenAI requests will fail.');
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set. Anthropic requests will fail.');
}

console.log('🚀 Starting Lasso Security LLM Proxy Service...');
console.log('📋 Configuration:');
console.log(`   Port: ${process.env.PORT}`);
console.log(`   OpenAI URL: ${process.env.OPENAI_API_URL}`);
console.log(`   Anthropic URL: ${process.env.ANTHROPIC_API_URL}`);
console.log(`   Data Sanitization: ${process.env.ENABLE_DATA_SANITIZATION}`);
console.log('');

// Kill existing processes and start the server
async function startServer() {
  try {
    await killProcessOnPort(process.env.PORT);
    
    // Small delay to ensure port is freed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start the NestJS application
    const child = spawn('npm', ['run', 'start:dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });

    child.on('error', (error) => {
      console.error('Failed to start server:', error);
    });

    child.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

startServer();
