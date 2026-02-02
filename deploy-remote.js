#!/usr/bin/env node

/**
 * Remote Deployment Script for Gmail Client
 * Connects via SSH to production server and executes deployment
 */

const { Client } = require("ssh2");

// SSH Configuration
const config = {
  host: process.env.SSH_HOST || "mail.mindenes.org",
  port: 22,
  username: process.env.SSH_USERNAME || "root",
  password: process.env.SSH_PASSWORD,
};

if (!config.password) {
  console.error("Error: SSH_PASSWORD environment variable is required");
  process.exit(1);
}

// Commands to execute
const commands = [
  { label: "Check directory", cmd: "cd /root/gmail-client && pwd" },
  {
    label: "Pull latest code",
    cmd: "cd /root/gmail-client && git pull origin main",
  },
  {
    label: "Install backend dependencies",
    cmd: "cd /root/gmail-client/server && npm install",
  },
  {
    label: "Install frontend dependencies",
    cmd: "cd /root/gmail-client/client && npm install",
  },
  {
    label: "Build frontend",
    cmd: "cd /root/gmail-client/client && npm run build",
  },
  {
    label: "Build backend",
    cmd: "cd /root/gmail-client/server && npm run build",
  },
  {
    label: "Restart PM2",
    cmd: "pm2 restart gmail-client 2>/dev/null || (cd /root/gmail-client/server && pm2 start npm --name gmail-client -- start)",
  },
  { label: "Show PM2 status", cmd: "pm2 list" },
  {
    label: "Show recent logs",
    cmd: "pm2 logs gmail-client --lines 30 --nostream",
  },
];

const conn = new Client();

console.log("🔌 Connecting to production server...");
console.log(`   Host: ${config.host}`);
console.log(`   User: ${config.username}\n`);

conn.on("ready", () => {
  console.log("✅ SSH connection established!\n");

  let currentIndex = 0;

  const executeCommand = () => {
    if (currentIndex >= commands.length) {
      console.log("\n🎉 Deployment completed!");
      console.log("\n🌐 Check website: https://mail.mindenes.org");
      conn.end();
      return;
    }

    const { label, cmd } = commands[currentIndex];
    console.log(`📋 ${label}...`);
    console.log(`   $ ${cmd}`);

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(`   ❌ Error: ${err.message}`);
        currentIndex++;
        executeCommand();
        return;
      }

      let stdout = "";
      let stderr = "";

      stream.on("close", (code, signal) => {
        if (stdout) {
          console.log(`   ✓ Output:`);
          stdout
            .split("\n")
            .slice(0, 20)
            .forEach((line) => {
              if (line.trim()) console.log(`     ${line}`);
            });
        }

        if (stderr && !stderr.toLowerCase().includes("warning")) {
          console.log(`   ⚠ Stderr:`);
          stderr
            .split("\n")
            .slice(0, 10)
            .forEach((line) => {
              if (line.trim()) console.log(`     ${line}`);
            });
        }

        if (code === 0 || label === "Restart PM2") {
          console.log(`   ✅ Done\n`);
        } else {
          console.log(`   ❌ Failed with exit code ${code}\n`);
        }

        currentIndex++;
        setTimeout(executeCommand, 500);
      });

      stream.on("data", (data) => {
        stdout += data.toString("utf8");
      });

      stream.stderr.on("data", (data) => {
        stderr += data.toString("utf8");
      });
    });
  };

  executeCommand();
});

conn.on("error", (err) => {
  console.error(`❌ SSH Connection Error: ${err.message}`);
  process.exit(1);
});

conn.connect(config);
